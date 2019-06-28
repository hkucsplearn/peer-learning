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
const mongoose = require('mongoose')
const uuidv1 = require('uuid/v1')
const bcrypt = require('bcryptjs-then')

const ObjectId = mongoose.Types.ObjectId

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
  // expire in 5 mins
  const expiryDate = new Date(new Date().getTime() + 5 * 60 * 1000)

  const authToken = new db.AuthToken({
    _id: new ObjectId(),
    token: uuidv1(),
    expiryDate,
    isAuthenticated: false
  })

  authToken.save().then((result) => {
    return result.token
  }).then(token => {
    let secret = token + appconfig.sessionSecret
    bcrypt.hash(secret).then((hash) => {
      return res.json({
        't': token,
        's': hash
      })
      // res.redirect(303, url.format(
      //   {
      //     pathname: 'https://i.cs.hku.hk/~plearn/',
      //     query: {
      //       't': token,
      //       's': hash
      //     }
      //   }
      // ))
    })
  }).catch(err => {
    console.error(err)
    req.flash('alert', {
      title: lang.t('auth:errors.loginerror'),
      message: 'Something goes wrong, try again later.'
    })
  })
})

router.post('/activate-auth-token', (req, res, next) => {
  dns.lookup('localhost', (err, addresses, family) => {
    if (err) {
      console.error(err.message)
    }
    const clientIPAdress = req.connection.remoteAddress

    if (clientIPAdress !== addresses) {
      return res.status(401).json({success: false})
    }

    if (!req.body.t || !req.body.s) {
      return res.status(400).json({success: false, message: 'missing t or s'})
    }

    const t = req.body.t
    const s = req.body.s
    let secret = t + appconfig.sessionSecret

    bcrypt.compare(secret, s).then((valid) => {
      if (!valid) {
        return res.status(401).json({success: false, message: 'wrong secret'})
      }

      return db.AuthToken.findOne({ token: t }).then(authToken => {
        if (new Date() > authToken.expiryDate) {
          return res.status(401).json({success: false, message: 'expired token'})
        }

        authToken.isAuthenticated = true
        return authToken.save()
          .then(() => res.status(200).json({success: true, message: 'OK'}))
      })
    }).catch(err => {
      console.error(err)
      return res.status(500).json({success: false, message: err.message})
    })
  })
})

/**
 * Logout
 */
router.get('/logout', function (req, res) {
  req.logout()
  res.redirect('/')
})

module.exports = router
