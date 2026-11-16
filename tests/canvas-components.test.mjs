// Canvas components: each of the site's single-directory components in
// Drupal has a wrapper the frontend renders it through, declaring its inputs.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

const COMPONENTS = 'drupal/web/modules/custom/druxtjsorg/components'
const WRAPPERS = 'nuxt/components/druxt/canvas/sdc/druxtjsorg'

const pascal = (name) => name.replace(/(^|[-_])([a-z0-9])/g, (m, sep, c) => c.toUpperCase())
const camel = (name) => name.replace(/[-_]+([a-z0-9])/g, (m, c) => c.toUpperCase())

// The names under `properties:` and under `slots:`, read by indentation: the
// definitions are plain enough that a YAML parser is not needed. Null when
// the definition has no such key written that way.
const keysUnder = (yml, parent, indent) => {
  const lines = yml.split('\n')
  const start = lines.findIndex((line) => line === `${' '.repeat(indent - 2)}${parent}:`)
  if (start < 0) return null
  const keys = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && line.search(/\S/) < indent) break
    const match = line.match(new RegExp(`^ {${indent}}([a-z_]+):`))
    if (match) keys.push(match[1])
  }
  return keys
}

const components = readdirSync(COMPONENTS)

describe('the site components', () => {
  test('there are components to check', () => {
    assert.ok(components.length >= 7)
  })

  for (const name of components) {
    const yml = readFileSync(`${COMPONENTS}/${name}/${name}.component.yml`, 'utf8')
    const file = `${WRAPPERS}/${pascal(name)}.vue`

    test(`${name} has a Twig template for Canvas's editor`, () => {
      assert.ok(existsSync(`${COMPONENTS}/${name}/${name}.twig`))
    })

    test(`${name} has a wrapper that declares its inputs and renders its slots`, () => {
      assert.ok(existsSync(file), file)
      const wrapper = readFileSync(file, 'utf8')
      // No inputs read means none declared, written as an empty map, and
      // not a definition this test cannot read.
      const props = keysUnder(yml, 'properties', 4)
      assert.ok(
        props ? props.length : /^ {2}properties: \{\}$/m.test(yml),
        `${name}: no properties read`
      )
      for (const prop of props || []) {
        assert.match(wrapper, new RegExp(`\\b${camel(prop)}: \\{`), `${name}: ${prop}`)
      }
      assert.equal(
        /^slots:/m.test(yml),
        keysUnder(yml, 'slots', 2) !== null,
        `${name}: slots not read`
      )
      for (const slot of keysUnder(yml, 'slots', 2) || []) {
        assert.match(wrapper, new RegExp(`<slot name="${slot}"`), `${name}: slot ${slot}`)
      }
    })
  }

  test('no wrapper is left without a component', () => {
    const expected = components.map((name) => `${pascal(name)}.vue`).sort()
    assert.deepEqual(readdirSync(WRAPPERS).sort(), expected)
  })
})
