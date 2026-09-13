import DuiDiagram from './Diagram.vue'

export default {
  title: 'DUI/Diagram',
  component: DuiDiagram,
  argTypes: { source: { control: 'text' } },
}

const Template = (args, { argTypes }) => ({
  components: { DuiDiagram },
  props: Object.keys(argTypes),
  template: '<div class="prose"><DuiDiagram v-bind="$props" /></div>',
})

export const Sequence = Template.bind({})
Sequence.args = {
  source: `sequenceDiagram
  participant B as Browser
  participant N as Nuxt + Druxt
  participant D as Drupal
  B->>N: GET /article-path
  N->>D: translate-path?path=/article-path
  D-->>N: type, bundle, uuid
  N->>D: fetch the resource
  D-->>N: resource + includes
  N-->>B: HTML + serialised store`,
}
