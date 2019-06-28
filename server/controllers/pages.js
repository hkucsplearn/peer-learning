'use strict'

/* global entries, git, lang, winston, upl */

const express = require('express')
const router = express.Router()
const _ = require('lodash')

const entryHelper = require('../helpers/entry')

// ==========================================
// EDIT MODE
// ==========================================

/**
 * Edit document in Markdown
 */
router.get('/edit/*', (req, res, next) => {
  if (!res.locals.rights.write) {
    return res.render('error-forbidden')
  }

  let safePath = entryHelper.parsePath(_.replace(req.path, '/edit', ''))

  entries.fetchOriginal(safePath, {
    parseMarkdown: false,
    parseMeta: true,
    parseTree: false,
    includeMarkdown: true,
    includeParentInfo: false,
    cache: false
  }).then((pageData) => {
    if (pageData) {
      res.render('pages/edit', { pageData })
    } else {
      throw new Error(lang.t('errors:invalidpath'))
    }
    return true
  }).catch((err) => {
    res.render('error', {
      message: err.message,
      error: {}
    })
  })
})

router.put('/edit/*', (req, res, next) => {
  if (!res.locals.rights.write) {
    return res.json({
      ok: false,
      msg: lang.t('errors:forbidden'),
      error: lang.t('errors:forbidden')
    })
  }

  let safePath = entryHelper.parsePath(_.replace(req.path, '/edit', ''))

  entries.update(safePath, req.body.markdown, req.user).then(() => {
    return res.json({
      ok: true
    }) || true
  }).catch((err) => {
    res.json({
      ok: false,
      msg: err.message,
      error: err.message
    })
  })
})

// ==========================================
// CREATE MODE
// ==========================================

router.get('/createcheck/*', (req, res, next) => {
  if (!res.locals.rights.write) {
    return res.json({
      ok: false,
      msg: lang.t('error-forbidden')
    })
  }

  if (_.some(['create', 'home', 'edit', 'account', 'source', 'history', 'mk', 'all'], (e) => { return _.startsWith(req.path, '/createcheck/' + e) })) {
    return res.json({
      ok: false,
      msg: lang.t('errors:reservedname')
    })
  }

  let safePath = entryHelper.parsePath(_.replace(req.path, '/createcheck', ''))

  entries.exists(safePath).then((docExists) => {
    if (!docExists) {
      let safePath = entryHelper.parsePath(_.replace(req.path, '/createcheck', ''))
      let parentPath = safePath.substr(0, safePath.lastIndexOf('/'))
      if (safePath.lastIndexOf('/') === -1) {
        parentPath = safePath
      }

      return entries.parentEntryExists(parentPath).then((results) => {
        if (results.length === 1 || safePath === parentPath) {
          return entries.getStarter(safePath).then((contents) => {
            return res.json({
              ok: true,
              msg: ''
            })
          }).catch((err) => {
            winston.warn(err)
            return res.json({
              ok: false,
              msg: lang.t('errors:starterfailed')
            })
          })
        } else {
          return res.json({
            ok: false,
            msg: lang.t('errors:forbiddencreate')
          })
        }
      })
    } else {
      return res.json({
        ok: false,
        msg: lang.t('errors:alreadyexists')
      })
    }
  }).catch((err) => {
    return res.json({
      ok: false,
      msg: err
    })
  })
})

router.get('/create/*', (req, res, next) => {
  let safePath = entryHelper.parsePath(_.replace(req.path, '/create', ''))

  return entries.getStarter(safePath).then((contents) => {
    let pageData = {
      markdown: contents,
      meta: {
        title: _.startCase(safePath),
        path: safePath
      }
    }

    res.render('pages/create', { pageData })
    return true
  }).catch((err) => {
    winston.warn(err)
    return Promise.reject(new Error(lang.t('errors:starterfailed')))
  })
})

router.put('/create/*', (req, res, next) => {
  if (!res.locals.rights.write) {
    return res.json({
      ok: false,
      msg: lang.t('errors:forbidden'),
      error: lang.t('errors:forbidden')
    })
  }

  let safePath = entryHelper.parsePath(_.replace(req.path, '/create', ''))
  let parentPath = safePath.substr(0, safePath.lastIndexOf('/'))
  if (safePath.lastIndexOf('/') === -1) {
    parentPath = safePath
  }

  return entries.parentEntryExists(parentPath).then((results) => {
    if (results.length === 1 || safePath === parentPath) {
      entries.create(safePath, req.body.markdown, req.user).then(() => {
        return res.json({
          ok: true
        }) || true
      }).catch((err) => {
        return res.json({
          ok: false,
          msg: err.message,
          error: err.message
        })
      })
    } else {
      return res.json({
        ok: false,
        msg: lang.t('errors:forbiddencreate')
      })
    }
  })
})

// ==========================================
// LIST ALL PAGES
// ==========================================

/**
 * View tree view of all pages
 */
router.use((req, res, next) => {
  if (_.endsWith(req.url, '/all')) {
    entries.getAllEntry(req.user)
      .then(data => {
        const pageData = data.filter(d => {
          const path = d._id.toString()
          return !(['home', 'guide'].includes(path)) && !path.startsWith('/uploads')
        })

        res.render('pages/all', { pageData })
        return true
      })
      .catch((err) => {
        res.render('error', {
          message: err.message,
          error: {}
        })
      })
  } else {
    next()
  }
})

// ==========================================
// VIEW MODE
// ==========================================

/**
 * View source of a document
 */
router.get('/source/*', (req, res, next) => {
  let safePath = entryHelper.parsePath(_.replace(req.path, '/source', ''))

  entries.fetchOriginal(safePath, {
    parseMarkdown: false,
    parseMeta: true,
    parseTree: false,
    includeMarkdown: true,
    includeParentInfo: false,
    cache: false
  }).then((pageData) => {
    if (pageData) {
      res.render('pages/source', { pageData })
    } else {
      throw new Error(lang.t('errors:invalidpath'))
    }
    return true
  }).catch((err) => {
    res.render('error', {
      message: err.message,
      error: {}
    })
  })
})

/**
 * View history of a document
 */
router.get('/hist/*', (req, res, next) => {
  let safePath = entryHelper.parsePath(_.replace(req.path, '/hist', ''))

  entries.getHistory(safePath).then((data) => {
    const pageData = Object.assign({}, data)
    if (pageData) {
      if (!res.locals.rights.manage && pageData.history) {
        pageData.history.forEach(cm => {
          cm.authorEmail = ''
        })
      }
      res.render('pages/history', { pageData })
    } else {
      throw new Error(lang.t('errors:invalidpath'))
    }
    return true
  }).catch((err) => {
    res.render('error', {
      message: err.message,
      error: {}
    })
  })
})

/**
 * View history of a document
 */
router.post('/hist', (req, res, next) => {
  let commit = req.body.commit
  let safePath = entryHelper.parsePath(req.body.path)

  if (!/^[a-f0-9]{40}$/.test(commit)) {
    return res.status(400).json({ ok: false, error: 'Invalid commit' })
  }

  git.getHistoryDiff(safePath, commit).then((diff) => {
    res.json({ ok: true, diff })
    return true
  }).catch((err) => {
    if (err.message === 'No diff') {
      res.json({ ok: false, noDiff: true })
    } else {
      res.status(500).json({ ok: false, error: err.message })
    }
  })
})

/**
 * View document
 */
router.get('/*', (req, res, next) => {
  let safePath = entryHelper.parsePath(req.path)
  entries.fetch(safePath).then((pageData) => {
    global.db.Entry.findOne({ _id: safePath, isEntry: true }).then((entry) => {
      if (entry) {
        entries.getPageSilibing(safePath).then((pageSilibingList) => {
          entries.getParentList(safePath).then((parentList) => {
            entries.getLastEdit(safePath).then((lastEdit) => {
              if (!res.locals.rights.manage && lastEdit) {
                lastEdit.authorEmail = ''
              }
              pageData.lastEdit = lastEdit
              res.render('pages/view', { pageData, parentList, pageSilibingList })
            })
          })
        })
      } else {
        entries.updateCache(safePath).then(() => {
          // also see line 79 of server/agent.js
          entries.fetch(safePath).then((pageData) => {
            if (pageData) {
              entries.getPageSilibing(safePath).then((pageSilibingList) => {
                entries.getParentList(safePath).then((parentList) => {
                  entries.getLastEdit(safePath).then((lastEdit) => {
                    if (!res.locals.rights.manage && lastEdit) {
                      lastEdit.authorEmail = ''
                    }
                    pageData.lastEdit = lastEdit
                    res.render('pages/view', { pageData, parentList, pageSilibingList })
                  })
                })
              })
            } else {
              res.status(404).render('error-notexist', {
                newpath: safePath
              })
            }
          })
        }).catch(err => {
          winston.error(err)
          res.status(404).render('error-notexist', {
            newpath: safePath
          })
        })
      }
    })
    return true
  }).error((err) => {
    if (safePath === 'home') {
      res.render('pages/welcome')
    } else {
      res.status(404).render('error-notexist', {
        message: err.message,
        newpath: safePath
      })
    }
    return true
  }).catch((err) => {
    res.render('error', {
      message: err.message,
      error: {}
    })
    return true
  })
})

/**
 * Move document
 */
router.put('/*', (req, res, next) => {
  if (!res.locals.rights.write) {
    return res.json({
      ok: false,
      msg: lang.t('errors:forbidden'),
      error: lang.t('errors:forbidden')
    })
  }

  let safePath = entryHelper.parsePath(req.path)

  if (_.isEmpty(req.body.move)) {
    return res.json({
      ok: false,
      msg: lang.t('errors:invalidaction'),
      error: lang.t('errors:invalidaction')
    })
  }

  let safeNewPath = entryHelper.parsePath(req.body.move)

  entries.move(safePath, safeNewPath, req.user).then(() => {
    res.json({
      ok: true
    })
  }).catch((err) => {
    res.json({
      ok: false,
      msg: err.message,
      error: err.message
    })
  })
})

/**
 * Delete document
 */
router.delete('/*', (req, res, next) => {
  if (!res.locals.rights.write) {
    return res.json({
      ok: false,
      msg: lang.t('errors:forbidden')
    })
  }

  let safePath = entryHelper.parsePath(req.path)

  return entries.getChildrenEntry(safePath).then((results) => {
    if (results.length >= 1) {
      return res.json({
        ok: false,
        msg: lang.t('errors:forbiddendelete')
      })
    } else {
      entries.remove(safePath, req.user).then(() => {
        res.json({
          ok: true
        })
      }).catch((err) => {
        res.json({
          ok: false,
          err: err.message,
          msg: err.message
        })
      })
    }
  })
})

module.exports = router
