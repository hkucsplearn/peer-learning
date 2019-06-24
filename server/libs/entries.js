'use strict'

/* global db, git, lang, mark, rights, search, winston */

const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs-extra'))
const klaw = require('klaw')
const _ = require('lodash')
var uplAgent = require('../libs/uploads-agent')

const entryHelper = require('../helpers/entry')

/**
 * Entries Model
 */
module.exports = {

  _repoPath: 'repo',
  _cachePath: 'data/cache',

  /**
   * Initialize Entries model
   *
   * @return     {Object}  Entries model instance
   */
  init() {
    let self = this

    self._repoPath = path.resolve(ROOTPATH, appconfig.paths.repo)
    self._cachePath = path.resolve(ROOTPATH, appconfig.paths.data, 'cache')
    appdata.repoPath = self._repoPath
    appdata.cachePath = self._cachePath

    return self
  },

  /**
   * Check if a document already exists
   *
   * @param      {String}  entryPath  The entry path
   * @return     {Promise<Boolean>}  True if exists, false otherwise
   */
  exists(entryPath) {
    let self = this

    return self.fetchOriginal(entryPath, {
      parseMarkdown: false,
      parseMeta: false,
      parseTree: false,
      includeMarkdown: false,
      includeParentInfo: false,
      cache: false
    }).then(() => {
      return true
    }).catch((err) => { // eslint-disable-line handle-callback-err
      return false
    })
  },

  /**
   * Fetch a document from cache, otherwise the original
   *
   * @param      {String}           entryPath  The entry path
   * @return     {Promise<Object>}  Page Data
   */
  fetch(entryPath) {
    let self = this

    let cpath = entryHelper.getCachePath(entryPath)

    return fs.statAsync(cpath).then((st) => {
      return st.isFile()
    }).catch((err) => { // eslint-disable-line handle-callback-err
      return false
    }).then((isCache) => {
      if (isCache) {
        // Load from cache

        return fs.readFileAsync(cpath).then((contents) => {
          return JSON.parse(contents)
        }).catch((err) => { // eslint-disable-line handle-callback-err
          winston.error('Corrupted cache file. Deleting it...')
          fs.unlinkSync(cpath)
          return false
        })
      } else {
        // Load original

        return self.fetchOriginal(entryPath)
      }
    })
  },

  /**
   * Fetches the original document entry
   *
   * @param      {String}           entryPath  The entry path
   * @param      {Object}           options    The options
   * @return     {Promise<Object>}  Page data
   */
  fetchOriginal(entryPath, options) {
    let self = this

    let fpath = entryHelper.getFullPath(entryPath)
    let cpath = entryHelper.getCachePath(entryPath)

    options = _.defaults(options, {
      parseMarkdown: true,
      parseMeta: true,
      parseTree: true,
      includeMarkdown: false,
      includeParentInfo: true,
      cache: true
    })

    return fs.statAsync(fpath).then((st) => {
      if (st.isFile()) {
        return fs.readFileAsync(fpath, 'utf8').then((contents) => {
          let htmlProcessor = (options.parseMarkdown) ? mark.parseContent(contents) : Promise.resolve('')

          // Parse contents

          return htmlProcessor.then(html => {
            let pageData = {
              markdown: (options.includeMarkdown) ? contents : '',
              html,
              meta: (options.parseMeta) ? mark.parseMeta(contents) : {},
              tree: (options.parseTree) ? mark.parseTree(contents) : []
            }

            if (!pageData.meta.title) {
              pageData.meta.title = _.startCase(entryPath)
            }

            pageData.meta.path = entryPath

            // Get parent
            let parentPromise = (options.includeParentInfo) ? self.getParentInfo(entryPath).then((parentData) => {
              return (pageData.parent = parentData)
            }).catch((err) => { // eslint-disable-line handle-callback-err
              return (pageData.parent = false)
            }) : Promise.resolve(true)

            return parentPromise.then(() => {
              // Cache to disk

              if (options.cache) {
                let cacheData = JSON.stringify(_.pick(pageData, ['html', 'meta', 'tree', 'parent']), false, false, false)
                return fs.writeFileAsync(cpath, cacheData).catch((err) => {
                  winston.error('Unable to write to cache! Performance may be affected.')
                  winston.error(err)
                  return true
                })
              } else {
                return true
              }
            }).return(pageData)
          })
        })
      } else {
        return false
      }
    }).catch((err) => { // eslint-disable-line handle-callback-err
      throw new Promise.OperationalError(lang.t('errors:notexist', { path: entryPath }))
    })
  },

  /**
   * Created on 14/06/2019
   * Obtain the file silibings of a document
   *
   * @param      {String}           rawEntryPath  The entry path
   * @return     {Promise<Object>}  All file silibing paths of the current document
   */
  getPageSilibing(rawEntryPath) {
    return entryHelper.isFolder(rawEntryPath).then((folderExists) => {
      let realEntryPath = entryHelper.getRootPath(rawEntryPath)

      if (folderExists) {
        // If sub-folder exists

        return this.getFolderDirectory(rawEntryPath, folderExists)
      } else if (rawEntryPath === 'home') {
        // If sub-folder not exists + Current page is 'home'

        return this.getFolderDirectory(rawEntryPath, true)
      } else {
        // If sub-folder not exists + Current page is not 'home'

        if (realEntryPath === '') {
          return this.getFolderDirectory(rawEntryPath, false)
        } else {
          return this.getFolderDirectory(realEntryPath, true)
        }
      }
    })
  },

  /**
   * Created on 15/06/2019
   * Obtain the document files inside a folder
   *
   * @param      {String}           entryPath     The entry path
   * @param      {Boolean}          folderExists  Is entryPath contains a folder
   * @return     {Promise<Object>}  All document paths inside a folder
   */
  getFolderDirectory(entryPath, folderExists) {
    let fPath = entryHelper.getFullPath(entryPath).replace('.md', '')
    let items = []

    return new Promise((resolve, reject) => {
      if (entryPath === 'home') {
        // If current page is 'home'

        fPath = fPath.replace(/\\home$/, '').replace(/\/home$/, '') // former replace for windows, latter replace for Unix
        klaw(fPath, {
          filter: pathItem => {
            return pathItem.endsWith('.md') && !pathItem.endsWith('README.md')
          }
        }).on('data', item => {
          let correctedPath = entryHelper.getEntryPathFromFullPath(item.path)
          if (!(['/home', '/guide', ''].includes(correctedPath))) {
            items.push(correctedPath)
          }
        }).on('end', () => {
          return resolve(items)
        }).on('error', (err, item) => {
          console.error(err.message)
          return resolve(items)
        })
      } else if (folderExists) {
        // If sub-folder exists

        klaw(fPath, {
          filter: pathItem => {
            return pathItem.endsWith('.md')
          }
        }).on('data', item => {
          let correctedPath = entryHelper.getEntryPathFromFullPath(item.path)
          if (correctedPath !== '') {
            items.push(correctedPath)
          }
        }).on('end', () => {
          return resolve(items)
        }).on('error', (err, item) => {
          console.error(err.message)
          return resolve(items)
        })
      } else {
        // If sub-folder not exists
        items.push('/' + entryPath)
        return resolve(items)
      }
    })
  },

  /**
   * Created on 17/06/2019
   * Obtain all the parent directories of a document
   *
   * @param      {String}           rawEntryPath  The entry path
   * @return     {Promise<Object>}  All parent directories of the current document
   */
  getParentList(entryPath) {
    entryPath = entryPath + '/'
    let tempPath = entryPath
    let parentList = []

    return new Promise((resolve, reject) => {
      while (tempPath.indexOf('/') !== -1) {
        let parentInfo = {
          name: '',
          link: ''
        }
        parentInfo.name = tempPath.substr(0, tempPath.indexOf('/'))
        parentInfo.link = '/' + entryPath.replace(tempPath, '') + tempPath.substr(0, tempPath.indexOf('/'))
        parentList.push(parentInfo)

        tempPath = tempPath.substr(tempPath.indexOf('/') + 1, tempPath.length)
      }

      return resolve(parentList)
    })
  },

  /**
   * Gets the parent information.
   *
   * @param      {String}                 entryPath  The entry path
   * @return     {Promise<Object|False>}  The parent information.
   */
  getParentInfo(entryPath) {
    if (_.includes(entryPath, '/')) {
      let parentParts = _.initial(_.split(entryPath, '/'))
      let parentPath = _.join(parentParts, '/')
      let parentFile = _.last(parentParts)
      let fpath = entryHelper.getFullPath(parentPath)

      return fs.statAsync(fpath).then((st) => {
        if (st.isFile()) {
          return fs.readFileAsync(fpath, 'utf8').then((contents) => {
            let pageMeta = mark.parseMeta(contents)

            return {
              path: parentPath,
              title: (pageMeta.title) ? pageMeta.title : _.startCase(parentFile),
              subtitle: (pageMeta.subtitle) ? pageMeta.subtitle : false
            }
          })
        } else {
          return Promise.reject(new Error(lang.t('errors:parentinvalid')))
        }
      })
    } else {
      return Promise.reject(new Error(lang.t('errors:parentisroot')))
    }
  },

  /**
   * Update an existing document
   *
   * @param      {String}            entryPath  The entry path
   * @param      {String}            contents   The markdown-formatted contents
   * @param      {Object} author The author user object
   * @return     {Promise<Boolean>}  True on success, false on failure
   */
  update(entryPath, contents, author) {
    let self = this
    let fpath = entryHelper.getFullPath(entryPath)

    return fs.statAsync(fpath).then((st) => {
      if (st.isFile()) {
        return self.makePersistent(entryPath, contents, author).then(() => {
          return self.updateCache(entryPath).then(entry => {
            return search.add(entry)
          })
        })
      } else {
        return Promise.reject(new Error(lang.t('errors:notexist', { path: entryPath })))
      }
    }).catch((err) => {
      winston.error(err)
      return Promise.reject(new Error(lang.t('errors:savefailed')))
    })
  },

  /**
   * Update local cache
   *
   * @param      {String}   entryPath  The entry path
   * @return     {Promise}  Promise of the operation
   */
  updateCache(entryPath) {
    let self = this

    return self.fetchOriginal(entryPath, {
      parseMarkdown: true,
      parseMeta: true,
      parseTree: true,
      includeMarkdown: true,
      includeParentInfo: true,
      cache: true
    }).catch(err => {
      winston.error(err)
      return err
    }).then((pageData) => {
      return {
        entryPath,
        meta: pageData.meta,
        parent: pageData.parent || {},
        text: mark.removeMarkdown(pageData.markdown)
      }
    }).catch(err => {
      winston.error(err)
      return err
    }).then((content) => {
      let parentPath = _.chain(content.entryPath).split('/').initial().join('/').value()

      return db.Entry.findOneAndUpdate({
        _id: content.entryPath
      }, {
        _id: content.entryPath,
        title: content.meta.title || content.entryPath,
        subtitle: content.meta.subtitle || '',
        parentTitle: content.parent.title || '',
        parentPath: parentPath,
        isDirectory: false,
        isEntry: true
      }, {
        new: true,
        upsert: true
      }).then(result => {
        let plainResult = result.toObject()
        plainResult.text = content.text
        return plainResult
      })
    }).then(result => {
      return self.updateTreeInfo().then(() => {
        return result
      })
    }).catch(err => {
      winston.error(err)
      return err
    })
  },

  /**
   * Update tree info for all directory and parent entries
   *
   * @returns {Promise<Boolean>} Promise of the operation
   */
  updateTreeInfo() {
    return db.Entry.distinct('parentPath', { parentPath: { $ne: '' } }).then(allPaths => {
      if (allPaths.length > 0) {
        return Promise.map(allPaths, pathItem => {
          let parentPath = _.chain(pathItem).split('/').initial().join('/').value()
          let guessedTitle = _.chain(pathItem).split('/').last().startCase().value()

          return db.Entry.update({ _id: pathItem }, {
            $set: { isDirectory: true },
            $setOnInsert: { isEntry: false, title: guessedTitle, parentPath }
          }, { upsert: true })
        })
      } else {
        return true
      }
    })
  },

  /**
   * Create a new document
   *
   * @param {String} entryPath The entry path
   * @param {String}  contents The markdown-formatted contents
   * @param {Object} author The author user object
   * @return {Promise<Boolean>} True on success, false on failure
   */
  create(entryPath, contents, author) {
    let self = this

    return self.exists(entryPath).then((docExists) => {
      if (!docExists) {
        return self.makePersistent(entryPath, contents, author).then(() => {
          return self.updateCache(entryPath).then(entry => {
            return search.add(entry)
          })
        })
      } else {
        return Promise.reject(new Error(lang.t('errors:alreadyexists')))
      }
    }).catch((err) => {
      winston.error(err)
      return Promise.reject(new Error(lang.t('errors:generic')))
    })
  },

  /**
   * Makes a document persistent to disk and git repository
   *
   * @param {String} entryPath The entry path
   * @param {String} contents The markdown-formatted contents
   * @param {Object} author The author user object
   * @return {Promise<Boolean>} True on success, false on failure
   */
  makePersistent(entryPath, contents, author) {
    let fpath = entryHelper.getFullPath(entryPath)
    let upathDB = entryPath
    let upathInitShort = 'uploads/' + entryPath + '/initializeFolder'
    let upathInit = entryHelper.getUploadFullPath(entryPath) + '/initializeFolder.md'

    return fs.outputFileAsync(fpath, contents).then(() => {
      return fs.outputFileAsync(upathInit, 'At the time you see this file, it has no use. Feel free to delete this file!').then(() => {
        return git.commitDocument(entryPath, author).then(() => {
          return git.commitDocument(upathInitShort, author).then(() => {
            return db.UplFolder.findOneAndUpdate({
              _id: 'f:' + upathDB
            }, {
              name: upathDB
            }, {
              upsert: true
            })
          })
        })
      })
    })
  },

  /**
   * Move a document
   *
   * @param {String} entryPath The current entry path
   * @param {String} newEntryPath  The new entry path
   * @param {Object} author The author user object
   * @return {Promise} Promise of the operation
   */
  move(entryPath, newEntryPath, author) {
    let self = this

    if (_.isEmpty(entryPath) || ['home', 'guide'].includes(entryPath)) {
      return Promise.reject(new Error(lang.t('errors:invalidpath')))
    }

    return git.moveDocument(entryPath, newEntryPath).then(() => {
      return git.commitDocument(newEntryPath, author).then(() => {
        // Delete old cache version

        let oldEntryCachePath = entryHelper.getCachePath(entryPath)
        fs.unlinkAsync(oldEntryCachePath).catch((err) => { return true }) // eslint-disable-line handle-callback-err

        // Delete old index entry

        search.delete(entryPath)

        // Create cache for new entry

        return Promise.join(
          db.Entry.deleteOne({ _id: entryPath }),
          self.updateCache(newEntryPath).then(entry => {
            return search.add(entry)
          })
        )
      })
    })
  },

  /**
   * Delete a document
   *
   * @param {String} entryPath The current entry path
   * @param {Object} author The author user object
   * @return {Promise} Promise of the operation
   */
  remove(entryPath, author) {
    if (_.isEmpty(entryPath) || ['home', 'guide'].includes(entryPath)) {
      return Promise.reject(new Error(lang.t('errors:invalidpath')))
    }

    let upathShort = 'uploads/' + entryPath

    return git.deleteDocument(entryPath, author).then(() => {
      // Delete old cache version

      let oldEntryCachePath = entryHelper.getCachePath(entryPath)
      fs.unlinkAsync(oldEntryCachePath).catch((err) => { return true }) // eslint-disable-line handle-callback-err

      // Delete old index entry
      search.delete(entryPath)

      // Delete entry
      return this.entryHasFolder(entryPath).then((result) => {
        if (result[0] === true) {
          return db.Entry.deleteOne({ _id: entryPath }).then(() => {
            return git.deleteFolder(entryPath, author).then(() => {
              return git.deleteFolder(upathShort, author).then(() => {
                return uplAgent.initialScan(false)
              })
            })
          })
        } else {
          return db.Entry.deleteOne({ _id: entryPath }).then(() => {
            return git.deleteFolder(upathShort, author).then(() => {
              return uplAgent.initialScan(false)
            })
          })
        }
      })
    })
  },

  /**
   * Generate a starter page content based on the entry path
   *
   * @param      {String}           entryPath  The entry path
   * @return     {Promise<String>}  Starter content
   */
  getStarter(entryPath) {
    let formattedTitle = _.startCase(_.last(_.split(entryPath, '/')))

    return fs.readFileAsync(path.join(SERVERPATH, 'app/content/create.md'), 'utf8').then((contents) => {
      return _.replace(contents, new RegExp('{TITLE}', 'g'), formattedTitle)
    })
  },

  /**
   * Created on 21/06/2019
   * Find if entry is a folder also
   *
   * @return     {Array<String>}  The entry folder.
   */
  entryHasFolder (entryPath) {
    return db.Entry.find({ _id: {$eq: entryPath} }, '_id').exec().then((result) => {
      return (result) ? _.map(result, 'isDirectory') : [{ name: '' }]
    })
  },

  /**
   * Created on 21/06/2019
   * Find if there is specific entry
   *
   * @return     {Array<String>}  Existence of the entry
   */
  parentEntryExists (entryPath) {
    return db.Entry.find({ _id: {$eq: entryPath} }, '_id').exec().then((results) => {
      return (results) ? _.map(results, 'name') : [{ name: '' }]
    })
  },

  /**
   * Created on 21/06/2019
   * Find all children entries.
   *
   * @return     {Array<String>}  The children entries.
   */
  getChildrenEntry (parentEntryPath) {
    return db.Entry.find({ _id: new RegExp(`${parentEntryPath}/.*`) }, '_id').exec().then((results) => {
      return (results) ? _.map(results, 'name') : [{ name: '' }]
    })
  },

  /**
   * Get all entries from base path
   *
   * @param {String} basePath Path to list from
   * @param {Object} usr Current user
   * @return {Promise<Array>} List of entries
   */
  getFromTree(basePath, usr) {
    return db.Entry.find({ parentPath: basePath }, 'title parentPath isDirectory isEntry').sort({ title: 'asc' }).then(results => {
      return _.filter(results, r => {
        return rights.checkRole('/' + r._id, usr.rights, 'read')
      })
    })
  },

  getAllEntry(usr) {
    return db.Entry.find({}, 'title parentPath isDirectory isEntry subtitle updatedAt').sort({ _id: 'asc' }).then(results => {
      return _.filter(results, r => {
        return rights.checkRole('/' + r._id, usr.rights, 'read')
      })
    })
  },

  getHistory(entryPath, repeat) {
    return db.Entry.findOne({ _id: entryPath, isEntry: true }).then(entry => {
      if (!entry) {
        if (repeat === undefined) {
          // try to update db via cache
          this.updateCache(entryPath)
            .then(_ => {
              return this.getHistory(entryPath, true)
            })
            .catch(err => {
              winston.error(err)
            })
        } else {
          return false
        }
      }
      return git.getHistory(entryPath).then(history => {
        return {
          meta: entry,
          history
        }
      })
    })
  },

  getLastEdit(entryPath, repeat) {
    return db.Entry.findOne({ _id: entryPath, isEntry: true }).then(entry => {
      if (!entry) {
        if (repeat === undefined) {
          // try to update db via cache
          this.updateCache(entryPath)
            .then(_ => {
              return this.getLastEdit(entryPath, true)
            })
            .catch(err => {
              winston.error(err)
            })
        } else {
          return false
        }
      }
      return git.getLastEdit(entryPath).then(history => {
        return history[0]
      })
    })
  }
}
