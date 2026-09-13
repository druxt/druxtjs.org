import DuiRichText from './RichText.vue'

export default {
  title: 'DUI/RichText',
  component: DuiRichText,
  argTypes: { html: { control: 'text' } },
}

const Template = (args, { argTypes }) => ({
  components: { DuiRichText },
  props: Object.keys(argTypes),
  template: '<div class="prose"><DuiRichText v-bind="$props" /></div>',
})

export const Body = Template.bind({})
Body.args = {
  html: '<h2>Rendering an entity</h2><p>Give <code>DruxtEntity</code> a type and a uuid, and it renders the display Drupal configured for it.</p><ul><li>View mode: <code>mode</code></li><li>Form mode: <code>schema-type="form"</code></li></ul>',
}
