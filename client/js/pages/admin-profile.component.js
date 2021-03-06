'use strict'

export default {
  name: 'admin-profile',
  props: ['email', 'name', 'provider', 'tfaIsActive'],
  data() {
    return {
      password: '********',
      passwordVerify: '********'
    }
  },
  computed: {
    tfaStatus() {
      return this.tfaIsActive ? this.$t('profile.tfaenabled') : this.$t('profile.tfadisabled')
    }
  },
  methods: {
    saveUser() {
      let self = this
      if (this.password !== this.passwordVerify) {
        return self.$store.dispatch('alert', {
          style: 'red',
          icon: 'square-cross',
          msg: 'The passwords don\'t match. Try again.'
        })
      }
      this.$http.post(window.location.href, {
        password: this.password,
        name: this.name
      }).then(resp => {
        return resp.json()
      }).then(resp => {
        if (resp.ok) {
          self.$store.dispatch('alert', {
            style: 'green',
            icon: 'check',
            msg: 'Changes have been applied successfully.'
          })
        } else {
          self.$store.dispatch('alert', {
            style: 'red',
            icon: 'square-cross',
            msg: 'Error: ' + resp.msg
          })
        }
      }).catch(err => {
        console.error(err)
        self.$store.dispatch('alert', {
          style: 'red',
          icon: 'square-cross',
          msg: 'Error: ' + err.message
        })
      })
    }
  }
}
