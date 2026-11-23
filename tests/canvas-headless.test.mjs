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
const { cookies, serialise, workspaceFetch } = createRequire(import.meta.url)(
  '../nuxt/modules/canvas-headless/server.js'
)

const names = readdirSync(COMPONENTS)
const camel = (name) => name.replace(/_+([a-z0-9])/g, (m, c) => c.toUpperCase())

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
    // A component with no inputs writes `properties: {}`.
    const props = yml.includes('\n  properties: {}') ? [] : keysUnder(yml, 'properties', 4)
    const slots = yml.includes('\nslots: {}') ? [] : keysUnder(yml, 'slots', 2)

    test(`${name} is named for its directory, which the renderer finds it by`, () => {
      assert.match(yml, new RegExp(`^machineName: ${name}$`, 'm'))
    })

    test(`${name} declares each input as a prop, in camel case as Canvas passes it`, () => {
      assert.ok(props, 'no properties were read')
      for (const prop of props) assert.match(vue, new RegExp(`^ {4}${camel(prop)}: \\{`, 'm'), prop)
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
      assert.deepEqual(config.includes('\nprops: {  }') ? [] : keysUnder(config, 'props', 2), props)
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

  test('a cookie that is not valid percent-encoding is kept as sent', () => {
    assert.deepEqual(cookies({ headers: { cookie: 'tracking=%; a=1' } }), { tracking: '%', a: '1' })
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

describe("Canvas Headless and the editor's workspace", () => {
  const sent = async (workspace, headers) => {
    let seen
    await workspaceFetch(workspace, async (url, init) => {
      seen = init.headers
    })('http://drupal.test/canvas/content-api', { headers })
    return seen.get('X-Druxt-Workspace')
  }

  test("a session's request names the workspace", async () => {
    assert.equal(await sent('stage', { Authorization: 'Bearer token' }), 'stage')
  })

  test('a request without the token names none, and live names none', async () => {
    assert.equal(await sent('stage', { Accept: 'application/json' }), null)
    assert.equal(await sent(null, { Authorization: 'Bearer token' }), null)
  })

  test('Drupal lets the preview token view a workspace', () => {
    const hook = readFileSync(
      'drupal/web/modules/custom/druxtjsorg/src/Hook/CanvasHeadlessHooks.php',
      'utf8'
    )
    assert.match(hook, /#\[Hook\('canvas_headless_safe_permissions'\)\]/)
    assert.match(hook, /'view any workspace'/)
  })

  test('a framed page without a session element is given one', () => {
    const plugin = readFileSync('nuxt/modules/canvas-headless/plugin.js', 'utf8')
    assert.match(plugin, /window\.self === window\.top\) return/)
    assert.match(plugin, /document\.createElement\(ELEMENT\)/)
  })
})

describe("Canvas Headless and the page's layout", async () => {
  const { default: layout } = await import('../nuxt/modules/canvas-headless/layout.js')
  const framed = (referer) => ({
    query: {},
    req: { headers: { 'sec-fetch-dest': 'iframe', referer } },
  })

  test('the editor frames the page alone', () => {
    assert.equal(layout(framed('https://site.test/canvas/editor/canvas_page/1')), 'canvas-headless')
    assert.equal(layout(framed(undefined)), 'canvas-headless')
  })

  test("Canvas's preview frames the page in the site's layout", () => {
    assert.equal(layout(framed('https://site.test/canvas/preview/canvas_page/1/full')), 'default')
  })

  test('a page that is not framed has the site around it', () => {
    assert.equal(layout({ query: {}, req: { headers: {} } }), 'default')
  })

  test('the layout parameter picks either', () => {
    assert.equal(
      layout({ ...framed('https://site.test/canvas/preview/x'), query: { layout: 'page' } }),
      'canvas-headless'
    )
    assert.equal(
      layout({ ...framed('https://site.test/canvas/editor/x'), query: { layout: 'site' } }),
      'default'
    )
  })
})

describe('Canvas Headless page results', () => {
  const read = (file) =>
    readFileSync(new URL(`../nuxt/modules/canvas-headless/${file}`, import.meta.url), 'utf8')

  test('a path Drupal redirects is followed, not drawn', () => {
    assert.match(read('page.vue'), /if \(data\.page\.redirect\) return redirect\(/)
  })

  test('a refresh that fails or redirects reloads the document', () => {
    const source = read('CanvasPage.vue')
    assert.match(source, /load\(this\.path\)\.catch\(/)
    assert.match(
      source,
      /if \(page && !page\.redirect\) this\.refreshed = page\s+else window\.location\.reload\(\)/
    )
  })
})

describe("the front page's Canvas page", () => {
  const front = () => import('../nuxt/modules/canvas-headless/front.js')
  const own = {
    element: 'renderless-container',
    slots: { default: [{ element: 'js-hero', slots: { actions: [{ element: 'js-action' }] } }] },
  }
  const drupal = {
    element: 'renderless-container',
    slots: {
      default: [
        { element: 'js-hero' },
        { element: 'drupal-markup', slots: { default: '<p>Hero</p>' } },
      ],
    },
  }

  test("a tree with any of the site's own components is drawn from the tree", async () => {
    const { hasOwnComponents } = await front()
    assert.equal(hasOwnComponents(own), true)
    // Drupal's markup beside them, a mixed page or an empty slot's default, changes nothing.
    assert.equal(hasOwnComponents(drupal), true)
    assert.equal(
      hasOwnComponents({
        element: 'renderless-container',
        slots: { default: { element: 'js-hero' } },
      }),
      true
    )
  })

  test("a tree of Drupal's markup alone is not, and neither is no tree", async () => {
    const { hasOwnComponents } = await front()
    const markup = { element: 'drupal-markup', slots: { default: '<p>Hero</p>' } }
    assert.equal(
      hasOwnComponents({ element: 'renderless-container', slots: { default: [markup, markup] } }),
      false
    )
    assert.equal(hasOwnComponents(null), false)
    assert.equal(hasOwnComponents('<p>Hero</p>'), false)
  })

  test('the tree and the JSON:API page agree on whose a page is', async () => {
    const { hasOwnComponents, usesOwnComponents } = await front()
    const page = (...ids) => ({
      attributes: { components: ids.map((id) => ({ component_id: id })) },
    })
    const tree = (...elements) => ({
      element: 'renderless-container',
      slots: { default: elements.map((element) => ({ element })) },
    })
    for (const [ids, elements] of [
      [
        ['js.hero', 'js.modules'],
        ['js-hero', 'js-modules'],
      ],
      [
        ['sdc.druxtjsorg.hero', 'js.modules'],
        ['drupal-markup', 'js-modules'],
      ],
      [['sdc.druxtjsorg.hero'], ['drupal-markup']],
    ]) {
      assert.equal(
        hasOwnComponents(tree(...elements)),
        usesOwnComponents(page(...ids)),
        ids.join(' ')
      )
    }
  })

  test("a JSON:API page says whether it holds the site's own components", async () => {
    const { usesOwnComponents } = await front()
    const page = (...ids) => ({
      attributes: { components: ids.map((id) => ({ component_id: id })) },
    })
    assert.equal(usesOwnComponents(page('sdc.druxtjsorg.hero', 'sdc.druxtjsorg.action')), false)
    assert.equal(usesOwnComponents(page('sdc.druxtjsorg.hero', 'js.action')), true)
    assert.equal(usesOwnComponents(null), false)
  })

  test("a draft session draws any page from the tree, Drupal's components included", async () => {
    const { drawnFromTree } = await front()
    const markup = { element: 'drupal-markup', slots: { default: '<p>Hero</p>' } }
    const theirs = { content: { element: 'renderless-container', slots: { default: [markup] } } }
    assert.equal(drawnFromTree(theirs, { enabled: false }), false)
    assert.equal(drawnFromTree(theirs, undefined), false)
    // The editor's frame: only the tree is the draft, and can be selected.
    assert.equal(drawnFromTree(theirs, { enabled: true }), true)
    assert.equal(drawnFromTree({ content: own }, { enabled: false }), true)
    // Nothing to draw, in a session or out of one.
    assert.equal(drawnFromTree(null, { enabled: true }), false)
    assert.equal(drawnFromTree({ redirect: '/elsewhere' }, { enabled: true }), false)
  })

  test('the front page asks the one rule which rendering draws it', () => {
    const page = readFileSync('nuxt/pages/index.vue', 'utf8')
    assert.match(page, /headless: drawnFromTree\(page, session\)/)
    assert.match(page, /page && !usesOwnComponents\(page\) \? page : null/)
  })

  test("Lagoon names the site as Canvas's frontend, with every component the site has", () => {
    const settings = readFileSync('drupal/web/sites/default/settings.lagoon.php', 'utf8')
    assert.match(
      settings,
      /if \(\$frontend && getenv\('CANVAS_SITE_URL'\)\) \{\s+\$config\['canvas_headless\.settings'\]\['frontends'\]/
    )
    const block = settings.slice(
      settings.indexOf("$config['canvas_headless.settings']['frontends']")
    )
    const listed = [...block.slice(0, block.indexOf('];')).matchAll(/'(js\.[a-z-]+)'/g)].map(
      (match) => match[1]
    )
    assert.deepEqual(listed, names.map((name) => `js.${name}`).sort())
  })
})
