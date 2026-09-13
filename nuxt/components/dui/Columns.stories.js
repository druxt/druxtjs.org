import DuiColumns from './Columns.vue'

export default {
  title: 'DUI/Columns',
  component: DuiColumns,
  argTypes: { row: { control: 'boolean' } },
}

const Template = (args, { argTypes }) => ({
  components: { DuiColumns },
  props: Object.keys(argTypes),
  template: `
    <DuiColumns v-bind="$props">
      <p class="p-4 bg-base-200 rounded-md">One column of the page.</p>
      <p class="p-4 bg-base-200 rounded-md">Another, beside it when row is on.</p>
    </DuiColumns>`,
})

export const Stacked = Template.bind({})
Stacked.args = { row: false }

export const Row = Template.bind({})
Row.args = { row: true }
