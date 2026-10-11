import AppHeader from './Header.vue'

export default {
  title: 'App/Header',
  component: AppHeader,
}

const Template = (args, { argTypes }) => ({
  props: Object.keys(argTypes),
  components: { AppHeader },
  template: '<AppHeader v-bind="$props" />'
})

export const Default = Template.bind({})
Default.args = {
  title: 'DruxtJS',
  // A development build shows its tag, with the build time in the title.
  version: 'v0.25.0-dev',
  versionTitle: 'v0.25.0-dev.20261007123456'
}
