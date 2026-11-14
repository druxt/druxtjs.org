import Vue from 'vue'

// The SDK's session element: it runs the renewal protocol and reports
// geometry and height to the editor.
Vue.config.ignoredElements = [...Vue.config.ignoredElements, 'canvas-draft-session']
