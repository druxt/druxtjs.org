// Canvas Headless: the components an editor places are the site's own, each
// declared to Canvas by a component.yml, and Drupal's copy of that declaration
// is tracked config.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

const COMPONENTS = 'nuxt/components/canvas'
const CONFIG = 'drupal/config/sync'
const { cookies, serialise } = createRequire(import.meta.url)(
  '../nuxt/modules/canvas-headless/server.js'
)

const names = readdirSync(COMPONENTS)

// The keys one level under a line, read by indentation: the definitions are
// plain enough that a YAML parser is not needed.
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

describe('Canvas Headless components', () => {
  test('there are some', () => assert.ok(names.length > 0))

  for (const name of names) {
    const yml = readFileSync(`${COMPONENTS}/${name}/component.yml`, 'utf8')
    const vue = readFileSync(`${COMPONENTS}/${name}/index.vue`, 'utf8')
    const props = keysUnder(yml, 'properties', 4)
    const slots = yml.includes('\nslots: {}') ? [] : keysUnder(yml, 'slots', 2)

    test(`${name} is named for its directory, which the renderer finds it by`, () => {
      assert.match(yml, new RegExp(`^machineName: ${name}$`, 'm'))
    })

    test(`${name} declares each input as a prop of the same name`, () => {
      assert.ok(props && props.length > 0, 'no properties were read')
      for (const prop of props) assert.match(vue, new RegExp(`^ {4}${prop}: \\{`, 'm'), prop)
    })

    test(`${name} renders each slot`, () => {
      assert.ok(slots, 'no slots were read')
      for (const slot of slots) assert.ok(vue.includes(`name="${slot}"`), slot)
    })

    test(`${name} is the component Drupal's config declares`, () => {
      const file = `${CONFIG}/canvas.js_component.${name}.yml`
      assert.ok(existsSync(file), `${file} is missing: sync it in Canvas and export the config`)
      const config = readFileSync(file, 'utf8')
      assert.match(config, /^type: external$/m)
      assert.deepEqual(keysUnder(config, 'props', 2), props)
      assert.deepEqual(config.includes('\nslots: {  }') ? [] : keysUnder(config, 'slots', 2), slots)
    })
  }
})

describe('Canvas Headless cookies', () => {
  test('a request cookie header is read by name', () => {
    assert.deepEqual(
      cookies({ headers: { cookie: 'a=1; canvas_headless_draft_mode=1; b=x%3Dy' } }),
      {
        a: '1',
        canvas_headless_draft_mode: '1',
        b: 'x=y',
      }
    )
    assert.deepEqual(cookies({ headers: {} }), {})
  })

  test('a draft cookie keeps the attributes a framed, cross-site session needs', () => {
    const cookie = {
      name: 'n',
      value: 'a b',
      httpOnly: true,
      path: '/',
      sameSite: 'none',
      secure: true,
      partitioned: true,
    }
    assert.equal(serialise(cookie), 'n=a%20b; Path=/; HttpOnly; Secure; SameSite=None; Partitioned')
    assert.match(
      serialise({ ...cookie, value: '', expires: new Date(0) }),
      /Expires=Thu, 01 Jan 1970 00:00:00 GMT/
    )
  })
})
