// What the live example's form widgets show, from a field's schema.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

const w = await import('../nuxt/utils/form-widgets.js')

describe('numberRange', () => {
  test('spans the configured range', () => {
    assert.deepEqual(
      w.numberRange({ settings: { config: { min: -2, max: 2 } } }, 0),
      [-2, -1, 0, 1, 2]
    )
  })
  test('widens to hold the current value, and defaults to -10..10', () => {
    const range = w.numberRange({ settings: {} }, [-14])
    assert.equal(range[0], -14)
    assert.equal(range[range.length - 1], 10)
  })
})

describe('allowedOptions', () => {
  test('takes a list of value and label, or a map of value to label', () => {
    assert.deepEqual(
      w.allowedOptions({ settings: { storage: { allowed_values: [{ value: 'a', label: 'A' }] } } }),
      [{ value: 'a', label: 'A' }]
    )
    assert.deepEqual(w.allowedOptions({ settings: { config: { allowed_values: { b: 'B' } } } }), [
      { value: 'b', label: 'B' },
    ])
    assert.deepEqual(w.allowedOptions({}), [])
  })
})

describe('references', () => {
  const schema = {
    settings: {
      storage: { target_type: 'taxonomy_term' },
      config: { handler_settings: { target_bundles: { tags: 'tags', section: 'section' } } },
    },
  }
  test('lists the resource types a reference can point at', () => {
    assert.deepEqual(w.referenceTypes(schema), ['taxonomy_term--tags', 'taxonomy_term--section'])
    assert.deepEqual(w.referenceTypes({}), [])
  })
  test('reads the referenced id from relationship data, an item, or a bare id', () => {
    assert.equal(w.referenceId({ data: { type: 'user--user', id: 'u1' } }), 'u1')
    assert.equal(w.referenceId([{ id: 'x' }]), 'x')
    assert.equal(w.referenceId('bare'), 'bare')
    assert.equal(w.referenceId(null), '')
  })
  test('lists every reference a value holds', () => {
    assert.deepEqual(
      w
        .referenceItems({
          data: [
            { type: 'taxonomy_term--tags', id: 't1' },
            { type: 'taxonomy_term--tags', id: 't2' },
          ],
        })
        .map((o) => o.id),
      ['t1', 't2']
    )
    assert.deepEqual(
      w.referenceItems({ data: { type: 'user--user', id: 'u1' } }).map((o) => o.id),
      ['u1']
    )
    assert.deepEqual(
      w.referenceItems([{ id: 'x', type: 'node--page' }]).map((o) => o.id),
      ['x']
    )
    assert.deepEqual(w.referenceItems(null), [])
    assert.deepEqual(w.referenceItems('bare'), [])
  })

  test('labels entities by name, title or label, and carries their type back', () => {
    assert.deepEqual(
      w.entityOptions([
        { id: '1', type: 'taxonomy_term--tags', attributes: { name: 'Baked' } },
        { id: '2', type: 'node--page', attributes: { title: 'About' } },
      ]),
      [
        { value: '1', label: 'Baked', type: 'taxonomy_term--tags' },
        { value: '2', label: 'About', type: 'node--page' },
      ]
    )
  })
})
