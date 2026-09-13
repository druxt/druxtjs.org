import DuiCodeBlock from './CodeBlock.vue'

export default {
  title: 'DUI/CodeBlock',
  component: DuiCodeBlock,
  argTypes: {
    code: { control: 'text' },
    language: { control: 'select', options: ['vue', 'js', 'sh', 'yaml', 'php', 'text'] },
  },
}

const Template = (args, { argTypes }) => ({
  components: { DuiCodeBlock },
  props: Object.keys(argTypes),
  template: '<div class="prose"><DuiCodeBlock v-bind="$props" /></div>',
})

export const Vue = Template.bind({})
Vue.args = {
  language: 'vue',
  code: '<DruxtEntity type="node--article" :uuid="uuid" mode="teaser" />',
}

export const Shell = Template.bind({})
Shell.args = {
  language: 'sh',
  code: 'npx create-nuxt-app my-druxt-site\ncd my-druxt-site && yarn add druxt',
}
