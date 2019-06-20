'use strict'

/* global db, git, lang */

const path = require('path')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))
const readChunk = require('read-chunk')
const fileType = require('file-type')
const mime = require('mime-types')
const crypto = require('crypto')
const chokidar = require('chokidar')
const jimp = require('jimp')
const imageSize = Promise.promisify(require('image-size'))
const klaw = require('klaw')
const through2 = require('through2')
const _ = require('lodash')
const entryHelper = require('../helpers/entry')

/**
 * Uploads - Agent
 */
module.exports = {

  _uploadsPath: './repo/uploads',
  _uploadsThumbsPath: './data/thumbs',

  _watcher: null,

  /**
   * Initialize Uploads model
   *
   * @return     {Object}  Uploads model instance
   */
  init () {
    let self = this

    self._uploadsPath = path.resolve(ROOTPATH, appconfig.paths.repo, 'uploads')
    self._uploadsThumbsPath = path.resolve(ROOTPATH, appconfig.paths.data, 'thumbs')

    return self
  },

  /**
   * Watch the uploads folder for changes
   *
   * @return     {Void}  Void
   */
  watch (destFolderPath) {
    let self = this
    let specificPath = self._uploadsPath

    if (destFolderPath !== '') {
      specificPath = destFolderPath
    }

    self._watcher = chokidar.watch(specificPath, {
      persistent: true,
      ignoreInitial: true,
      cwd: specificPath,
      depth: Math.pow(10, 1000),
      awaitWriteFinish: true
    })

    // -> Add new upload file

    self._watcher.on('add', (p) => {
      let pInfo = self.parseUploadsRelPath(p)
      return self.processFile(pInfo.folder, pInfo.filename).then((mData) => {
        return db.UplFile.findByIdAndUpdate(mData._id, mData, { upsert: true })
      }).then(() => {
        return git.commitUploads(lang.t('git:uploaded', { path: p }))
      })
    })

    // -> Remove upload file

    self._watcher.on('unlink', (p) => {
      return git.commitUploads(lang.t('git:deleted', { path: p }))
    })
  },

  /**
   * Initial Uploads scan (Whole Folder)
   *
   * @return     {Promise<Void>}  Promise of the scan operation
   */
  initialScan (needWatch) {
    let self = this

    return fs.readdirAsync(self._uploadsPath).then((ls) => {
      // Get all folders

      return new Promise((resolve, reject) => {
        let items = []
        const includeDirFilter = through2.obj(function (item, enc, next) {
          if (item.stats.isDirectory()) this.push(item)
          next()
        })

        klaw(self._uploadsPath)
          .pipe(includeDirFilter)
          .on('data', function (item) {
            let correctedPath = entryHelper.getEntryPathFromFullPath(item.path).replace('/uploads', '')
            correctedPath = correctedPath.substr(1, correctedPath.length)
            items.push(correctedPath)
          }).on('end', () => {
            return resolve(items)
          }).on('error', (err, item) => {
            global.winston.error(err)
          })
      }).then((folders) => {
        // Add folders to DB

        let folderNames = folders
        return db.UplFolder.remove({}).then(() => {
          return db.UplFolder.insertMany(_.map(folderNames, (f) => {
            return {
              _id: 'f:' + f,
              name: f
            }
          }))
        }).then(() => {
          // Travel each directory and scan files

          let allFiles = []

          return Promise.map(folderNames, (fldName) => {
            let fldPath = path.join(self._uploadsPath, fldName)
            return fs.readdirAsync(fldPath).then((fList) => {
              return Promise.map(fList, (f) => {
                return self.processFile(fldName, f).then((mData) => {
                  if (mData) {
                    allFiles.push(mData)
                  }
                  return true
                })
              }, {concurrency: 3})
            })
          }, {concurrency: 1}).finally(() => {
            // Add files to DB

            return db.UplFile.remove({}).then(() => {
              if (_.isArray(allFiles) && allFiles.length > 0) {
                return db.UplFile.insertMany(allFiles)
              } else {
                return true
              }
            })
          })
        })
      })
    }).then(() => {
      if (needWatch) {
        // Watch for new changes

        return self.watch('')
      } else {
        return true
      }
    })
  },

  /**
   * Parse relative Uploads path
   *
   * @param      {String}  f       Relative Uploads path
   * @return     {Object}  Parsed path (folder and filename)
   */
  parseUploadsRelPath (f) {
    let fObj = path.parse(f)
    return {
      folder: fObj.dir,
      filename: fObj.base
    }
  },

  /**
   * Get metadata from file and generate thumbnails if necessary
   *
   * @param      {String}  fldName  The folder name
   * @param      {String}  f        The filename
   * @return     {Promise<Object>}  Promise of the file metadata
   */
  processFile (fldName, f) {
    let self = this

    let fldPath = path.join(self._uploadsPath, fldName)
    let fPath = path.join(fldPath, f)
    let fPathObj = path.parse(fPath)
    let fUid = crypto.createHash('md5').update(fldName + '/' + f).digest('hex')

    return fs.statAsync(fPath).then((s) => {
      if (!s.isFile()) { return false }

      // Get MIME info

      let mimeInfo = fileType(readChunk.sync(fPath, 0, 262))
      if (_.isNil(mimeInfo)) {
        mimeInfo = {
          mime: mime.lookup(fPathObj.ext) || 'application/octet-stream'
        }
      }

      // Images

      if (s.size < 3145728) { // ignore files larger than 3MB
        if (_.includes(['image/png', 'image/jpeg', 'image/gif', 'image/bmp'], mimeInfo.mime)) {
          return self.getImageSize(fPath).then((mImgSize) => {
            let cacheThumbnailPath = path.parse(path.join(self._uploadsThumbsPath, fUid + '.png'))
            let cacheThumbnailPathStr = path.format(cacheThumbnailPath)

            let mData = {
              _id: fUid,
              category: 'image',
              mime: mimeInfo.mime,
              extra: mImgSize,
              folder: 'f:' + fldName,
              filename: f,
              basename: fPathObj.name,
              filesize: s.size
            }

            // Generate thumbnail

            return fs.statAsync(cacheThumbnailPathStr).then((st) => {
              return st.isFile()
            }).catch((err) => { // eslint-disable-line handle-callback-err
              return false
            }).then((thumbExists) => {
              return (thumbExists) ? mData : fs.ensureDirAsync(cacheThumbnailPath.dir).then(() => {
                return self.generateThumbnail(fPath, cacheThumbnailPathStr)
              }).return(mData)
            })
          })
        }
      }

      // Other Files

      return {
        _id: fUid,
        category: 'binary',
        mime: mimeInfo.mime,
        folder: 'f:' + fldName,
        filename: f,
        basename: fPathObj.name,
        filesize: s.size
      }
    })
  },

  /**
   * Generate thumbnail of image
   *
   * @param      {String}           sourcePath  The source path
   * @param      {String}           destPath    The destination path
   * @return     {Promise<Object>}  Promise returning the resized image info
   */
  generateThumbnail (sourcePath, destPath) {
    return jimp.read(sourcePath).then(img => {
      return img
        .contain(150, 150)
        .rgba(false)
        .write(destPath)
    })
  },

  /**
   * Gets the image dimensions.
   *
   * @param      {String}  sourcePath  The source path
   * @return     {Object}  The image dimensions.
   */
  getImageSize (sourcePath) {
    return imageSize(sourcePath)
  }

}
