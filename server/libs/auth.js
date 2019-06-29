'use strict'

/* global appconfig, appdata, db, lang, winston */

const LocalStrategy = require('passport-local').Strategy
const crypto = require('crypto')

module.exports = function (passport) {
  // Serialization user methods

  passport.serializeUser(function (user, done) {
    done(null, user._id)
  })

  passport.deserializeUser(function (id, done) {
    db.User.findById(id).then((user) => {
      if (user) {
        done(null, user)
      } else {
        done(new Error(lang.t('auth:errors:usernotfound')), null)
      }
      return true
    }).catch((err) => {
      done(err, null)
    })
  })

  // Local Account
  if (appconfig.auth.local && appconfig.auth.local.enabled) {
    passport.use('local',
      new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password'
      }, (uEmail, uPassword, done) => {
        db.User.findOne({ email: uEmail, provider: 'local' }).then((user) => {
          if (user) {
            return user.validatePassword(uPassword).then(() => {
              return done(null, user) || true
            })
          } else {
            return done(new Error('INVALID_LOGIN'), null)
          }
        }).catch((err) => {
          done(err, null)
        })
      })
    )
  }

  // HKU Account (check if the authToken valid)
  if (appconfig.auth.hku && appconfig.auth.hku.enabled) {
    passport.use('hku',
      new LocalStrategy(
        {
          usernameField: 'token',
          passwordField: 's'
        },
        (authToken, s, done) => {
          const secret = authToken + appconfig.sessionSecret + appconfig.authAgentSecret
          const correctS = crypto.createHash('sha256').update(secret).digest('hex').toString()

          if (s !== correctS) {
            return done(new Error('wrong secret'), null)
          }

          return db.AuthToken.findOne({ token: authToken }).then(authToken => {
            if (!authToken || new Date() > authToken.expiryDate) {
              return done(new Error('invalid or expired token'), null)
            }

            if (!authToken.isAuthenticated) {
              return done(new Error('invalid login'), null)
            }

            // proceed to login
            const hkuEmail = authToken.uid + '@hku.hk'
            const provider = 'hku'
            return db.User.findOne({ email: hkuEmail, provider }).then((user) => {
              if (user) {
                return done(null, user) || true
              } else {
              // first time login, create user in DB
                let nUsr = {
                  email: hkuEmail,
                  provider,
                  name: 'Peer Learner',
                  rights: [{
                    role: 'write',
                    path: '/',
                    exact: false,
                    deny: false
                  }]
                }
                return db.User.create(nUsr).then((createdUser) => {
                  return authToken.remove().then(() => {
                    return done(null, createdUser) || true
                  })
                })
              }
            })
          }).catch(err => {
            if (err) console.error(err)
            done(new Error(err.message), null)
          })
        }
      )
    )
  }

  // Create users for first-time guest login
  db.onReady.then(() => {
    return db.User.findOne({ provider: 'local', email: 'guest' }).then((c) => {
      if (c < 1) {
        // Create guest account

        return db.User.create({
          provider: 'local',
          email: 'guest',
          name: 'Guest',
          password: '',
          rights: [{
            role: 'read',
            path: '/',
            exact: false,
            deny: !appconfig.public
          }]
        }).then(() => {
          winston.info('[AUTH] Guest account created successfully!')
        }).catch((err) => {
          winston.error('[AUTH] An error occured while creating guest account:')
          winston.error(err)
        })
      }
    }).then(() => {
      if (process.env.WIKI_JS_HEROKU) {
        return db.User.findOne({ provider: 'local', email: process.env.WIKI_ADMIN_EMAIL }).then((c) => {
          if (c < 1) {
            // Create root admin account (HEROKU ONLY)

            return db.User.create({
              provider: 'local',
              email: process.env.WIKI_ADMIN_EMAIL,
              name: 'Administrator',
              password: '$2a$04$MAHRw785Xe/Jd5kcKzr3D.VRZDeomFZu2lius4gGpZZ9cJw7B7Mna', // admin123 (default)
              rights: [{
                role: 'admin',
                path: '/',
                exact: false,
                deny: false
              }]
            }).then(() => {
              winston.info('[AUTH] Root admin account created successfully!')
            }).catch((err) => {
              winston.error('[AUTH] An error occured while creating root admin account:')
              winston.error(err)
            })
          } else { return true }
        })
      } else { return true }
    })
  })
}
