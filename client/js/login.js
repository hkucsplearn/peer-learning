'use strict'

/* global $ */

$(() => {
  $('#login-user').focus()
  $('#back_button').on('click', (event) => {
    event.preventDefault()
    window.location = '/'
  })
})
