'use strict'

/* global db, lang */

const Promise = require('bluebird')
const express = require('express')
const router = express.Router()
const passport = require('passport')
const ExpressBrute = require('express-brute')
const ExpressBruteMongooseStore = require('express-brute-mongoose')
const moment = require('moment')
const url = require('url')
const dns = require('dns')

/**
 * Setup Express-Brute
 */
const EBstore = new ExpressBruteMongooseStore(db.Bruteforce)
const bruteforce = new ExpressBrute(EBstore, {
  freeRetries: 5,
  minWait: 60 * 1000,
  maxWait: 5 * 60 * 1000,
  refreshTimeoutOnRequest: false,
  failCallback (req, res, next, nextValidRequestDate) {
    req.flash('alert', {
      class: 'error',
      title: lang.t('auth:errors.toomanyattempts'),
      message: lang.t('auth:errors.toomanyattemptsmsg', { time: moment(nextValidRequestDate).fromNow() }),
      iconClass: 'fa-times'
    })
    res.redirect('/login')
  }
})

/**
 * Login form
 */
router.get('/login', function (req, res, next) {
  res.render('auth/login', {
    usr: res.locals.usr
  })
})

router.post('/login/:token', bruteforce.prevent, (req, res, next) => {
  const authToken = req.params.token

  new Promise((resolve, reject) => {
    // [3] HKU AUTHENTICATION
    passport.authenticate('hku', (err, user, info) => {
      if (err) { return reject(err) }
      if (info && info.message) { return reject(new Error(info.message)) }
      if (!user) { return reject(new Error('INVALID_LOGIN')) }
      resolve(user)
    })(req, res, next)
  }).then((user) => {
    // LOGIN SUCCESS
    return req.logIn(user, (err) => {
      if (err) { return next(err) }
      req.brute.reset(() => {
        return res.redirect(req.session.redirectTo || '/')
      })
    }) || true
  }).catch(err => {
    // LOGIN FAIL
    if (err.message === 'INVALID_LOGIN') {
      req.flash('alert', {
        title: lang.t('auth:errors.invalidlogin'),
        message: lang.t('auth:errors.invalidloginmsg')
      })
      return res.redirect('/login')
    } else {
      req.flash('alert', {
        title: lang.t('auth:errors.loginerror'),
        message: err.message
      })
      return res.redirect('/login')
    }
  })
})

router.post('/login', bruteforce.prevent, function (req, res, next) {
  new Promise((resolve, reject) => {
    // [1] LOCAL AUTHENTICATION
    passport.authenticate('local', function (err, user, info) {
      if (err) { return reject(err) }
      if (!user) { return reject(new Error('INVALID_LOGIN')) }
      resolve(user)
    })(req, res, next)
  }).catch({ message: 'INVALID_LOGIN' }, err => {
    if (appconfig.auth.ldap && appconfig.auth.ldap.enabled) {
      // [2] LDAP AUTHENTICATION
      return new Promise((resolve, reject) => {
        passport.authenticate('ldapauth', function (err, user, info) {
          if (err) { return reject(err) }
          if (info && info.message) { return reject(new Error(info.message)) }
          if (!user) { return reject(new Error('INVALID_LOGIN')) }
          resolve(user)
        })(req, res, next)
      })
    } else {
      throw err
    }
  }).then((user) => {
    // LOGIN SUCCESS
    return req.logIn(user, (err) => {
      if (err) { return next(err) }
      req.brute.reset(() => {
        return res.redirect(req.session.redirectTo || '/')
      })
    }) || true
  }).catch(err => {
    // LOGIN FAIL
    if (err.message === 'INVALID_LOGIN') {
      req.flash('alert', {
        title: lang.t('auth:errors.invalidlogin'),
        message: lang.t('auth:errors.invalidloginmsg')
      })
      return res.redirect('/login')
    } else {
      req.flash('alert', {
        title: lang.t('auth:errors.loginerror'),
        message: err.message
      })
      return res.redirect('/login')
    }
  })
})

router.post('/redirect-to-hkucas', (req, res, next) => {
  res.redirect(303, url.format(
    {
      pathname: 'https://i.cs.hku.hk/~plearn/',
      query: {
        's': 1,
        't': 2
      }
    }
  ))
})

router.post('/hku-login-result', (req, res, next) => {
  dns.lookup('i.cs.hku.hk', (err, addresses, family) => {
    if (err) {
      console.error(err.message)
    }
    const clientIPAdress = req.connection.remoteAddress

    if (clientIPAdress !== addresses) {
      return res.status(401).json({success: false, message: '401 Unauthorized'})
    }

    return res.status(200).json({success: true, message: 'OK'})
  })
})

/**
 * Social Login
 */

// router.get('/login/ms', passport.authenticate('windowslive', { scope: ['wl.signin', 'wl.basic', 'wl.emails'] }))
// router.get('/login/google', passport.authenticate('google', { scope: ['profile', 'email'] }))
// router.get('/login/facebook', passport.authenticate('facebook', { scope: ['public_profile', 'email'] }))
// router.get('/login/github', passport.authenticate('github', { scope: ['user:email'] }))
// router.get('/login/slack', passport.authenticate('slack', { scope: ['identity.basic', 'identity.email'] }))
// router.get('/login/azure', passport.authenticate('azure_ad_oauth2'))
// router.get('/login/oauth2', passport.authenticate('oauth2'))
// router.get('/login/oidc', passport.authenticate('oidc'))

// router.get('/login/ms/callback', passport.authenticate('windowslive', { failureRedirect: '/login', successRedirect: '/' }))
// router.get('/login/google/callback', passport.authenticate('google', { failureRedirect: '/login', successRedirect: '/' }))
// router.get('/login/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login', successRedirect: '/' }))
// router.get('/login/github/callback', passport.authenticate('github', { failureRedirect: '/login', successRedirect: '/' }))
// router.get('/login/slack/callback', passport.authenticate('slack', { failureRedirect: '/login', successRedirect: '/' }))
// router.get('/login/azure/callback', passport.authenticate('azure_ad_oauth2', { failureRedirect: '/login', successRedirect: '/' }))
// router.get('/login/oauth2/callback', passport.authenticate('oauth2', { failureRedirect: '/login', successRedirect: '/' }))
// router.get('/login/oidc/callback', passport.authenticate('oidc', { failureRedirect: '/login', successRedirect: '/' }))

/**
 * Logout
 */
router.get('/logout', function (req, res) {
  req.logout()
  res.redirect('/')
})

module.exports = router
