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
const crypto = require('crypto')

const ObjectId = mongoose.Types.ObjectId

/**
 * Setup Express-Brute
 */
const EBstore = new ExpressBruteMongooseStore(db.Bruteforce)
const bruteforce = new ExpressBrute(EBstore, {
  freeRetries: 10,
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
router.get('/login', (req, res, next) => {
  res.render('auth/login', {
    usr: res.locals.usr
  })
})

router.post('/login', bruteforce.prevent, function (req, res, next) {
  new Promise((resolve, reject) => {
    // LOCAL AUTHENTICATION
    passport.authenticate('local', function (err, user, info) {
      if (err) { return reject(err) }
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

/**
 * HKU Portal Login
 */
router.get('/portal-login/redirect', (req, res, next) => {
  return res.redirect(303, 'https://i.cs.hku.hk/~plearn/')
})

router.post('/portal-login/get-login-token', (req, res, next) => {
  const loginAgentHostname = 'i.cs.hku.hk'
  // const loginAgentHostname = 'localhost'

  dns.lookup(loginAgentHostname, (err, addresses, family) => {
    if (err) {
      console.error(err.message)
      return res.status(500).json({success: false, message: err.message})
    }
    const clientIPAdress = req.headers['x-forwarded-for'] || req.connection.remoteAddress

    if (clientIPAdress !== addresses) {
      return res.status(401).send('unauthorized access')
    }

    if (!req.body.s || !req.body.uid) {
      return res.status(400).send('bad request')
    }

    const s = req.body.s
    const uid = req.body.uid
    const secret = uid + appconfig.loginAgentSecret

    const correctS = crypto.createHash('sha256').update(secret).digest('hex').toString()

    if (s !== correctS) {
      return res.status(401).send('wrong secret')
    }

    // expire in 10 seconds
    const expiryDate = new Date(new Date().getTime() + 10 * 1000)

    const authToken = new db.AuthToken({
      _id: new ObjectId(),
      token: uuidv1(),
      expiryDate,
      uid,
      isAuthenticated: true
    })

    authToken.save().then((token) => {
      return authToken.save().then(() => res.status(200).send(token.token))
    })
  })
})

router.get('/portal-login/:token', (req, res, next) => {
  if (!req.params.token) {
    return res.status(400).json({success: false, message: 'bad request'})
  }

  let fakeQuery = {
    token: req.params.token,
    dummy: req.params.token
  }

  req.query = fakeQuery // for using passport local strategy

  // HKU AUTHENTICATION
  passport.authenticate('hku', (err, user, info) => {
    if (err) { return res.status(401).send(err.message) }
    if (!user) { return res.status(401).send('user not exists') }
    req.logIn(user, (err) => {
      if (err) { return next(err) }
      return res.redirect(req.session.redirectTo || '/')
    })
  })(req, res, next)
})

/**
 * Logout
 */
router.get('/logout', (req, res) => {
  req.logout()
  res.redirect('/')
})

module.exports = router
