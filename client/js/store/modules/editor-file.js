'use strict'

export default {
  namespaced: true,
  state: {
    shown: false,
    mode: 'image',
    uploadFolder: ''
  },
  getters: {},
  mutations: {
    shownChange: (state, shownState) => { state.shown = shownState },
    modeChange: (state, modeState) => { state.mode = modeState },
    uploadFolderChange: (state, uploadFolderState) => { state.uploadFolder = uploadFolderState }
  },
  actions: {
    open({ commit }, opts) {
      commit('shownChange', true)
      commit('modeChange', opts.mode)
      commit('uploadFolderChange', opts.uploadFolder)
      wikijs.$emit('editorFile/init')
    },
    close({ commit }) { commit('shownChange', false) }
  }
}
