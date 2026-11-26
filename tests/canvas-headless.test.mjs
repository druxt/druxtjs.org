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
const { cookies, serialise, toDocument, workspaceFetch } = createRequire(import.meta.url)(
  '../nuxt/modules/canvas-headless/server.js'
)
const nuxt = createRequire(new URL('../nuxt/package.json', import.meta.url))

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

    test(`${name} declares each input as a prop, in camel case as the renderer passes it`, () => {
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

// A json-render document from elements given as [key, type, children, slots].
const doc = (root, ...elements) => ({
  root,
  elements: Object.fromEntries(
    elements.map(([key, type, children = [], slots, props = {}]) => [
      key,
      { type, props, children, ...(slots ? { slots } : {}) },
    ])
  ),
})
const markupOf = (key, markup = '<p>Hero</p>') => [key, 'drupal-markup', [], undefined, { markup }]

describe("the front page's Canvas page", () => {
  const front = () => import('../nuxt/modules/canvas-headless/front.js')
  const own = doc(
    'c',
    ['c', 'renderless-container', ['hero']],
    ['hero', 'js.hero', [], { actions: ['action'] }],
    ['action', 'js.action']
  )

  test("a document with any of the site's own components is drawn from it", async () => {
    const { hasOwnComponents } = await front()
    assert.equal(hasOwnComponents(own), true)
    // Drupal's markup beside them, a mixed page or an empty slot's default, changes nothing.
    assert.equal(
      hasOwnComponents(
        doc('c', ['c', 'renderless-container', ['hero', 'm']], ['hero', 'js.hero'], markupOf('m'))
      ),
      true
    )
    assert.equal(hasOwnComponents(doc('hero', ['hero', 'js.hero'])), true)
  })

  test("a document of Drupal's markup alone is not, and neither is no document", async () => {
    const { hasOwnComponents } = await front()
    assert.equal(
      hasOwnComponents(
        doc('c', ['c', 'renderless-container', ['a', 'b']], markupOf('a'), markupOf('b'))
      ),
      false
    )
    // An element nothing refers to is not on the page.
    assert.equal(hasOwnComponents(doc('a', markupOf('a'), ['stray', 'js.hero'])), false)
    assert.equal(hasOwnComponents({ root: '', elements: {} }), false)
    assert.equal(hasOwnComponents(null), false)
    assert.equal(hasOwnComponents('<p>Hero</p>'), false)
  })

  test('the document and the JSON:API page agree on whose a page is', async () => {
    const { hasOwnComponents, usesOwnComponents } = await front()
    const page = (...ids) => ({
      attributes: { components: ids.map((id) => ({ component_id: id })) },
    })
    // Canvas answers a component of Drupal's as its markup.
    const tree = (...ids) =>
      doc(
        'c',
        ['c', 'renderless-container', ids.map((id, index) => `e${index}`)],
        ...ids.map((id, index) =>
          id.startsWith('js.') ? [`e${index}`, id] : markupOf(`e${index}`)
        )
      )
    for (const ids of [
      ['js.hero', 'js.modules'],
      ['sdc.druxtjsorg.hero', 'js.modules'],
      ['sdc.druxtjsorg.hero'],
    ]) {
      assert.equal(hasOwnComponents(tree(...ids)), usesOwnComponents(page(...ids)), ids.join(' '))
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
    const theirs = { content: doc('c', ['c', 'renderless-container', ['m']], markupOf('m')) }
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

describe('Canvas Headless rendering', () => {
  const Vue = nuxt('vue')
  const { createRenderer } = nuxt('vue-server-renderer')
  // A stand-in for one of the site's components: its props, and each slot.
  const stub = (props, slots = []) => ({
    props,
    render(h) {
      return h('section', { attrs: { 'data-props': JSON.stringify(this.$props) } }, [
        ...slots.map((slot) =>
          h(
            'div',
            { attrs: { 'data-slot': slot } },
            this.$scopedSlots[slot] ? this.$scopedSlots[slot]() : []
          )
        ),
      ])
    },
  })
  const components = {
    hero: stub(['heading', 'noteLinkText'], ['actions', 'content']),
    action: stub(['label']),
  }
  const draw = async (tree, preview = false) => {
    const { default: CanvasComponentTree } = await import(
      '../nuxt/modules/canvas-headless/CanvasComponentTree.js'
    )
    const html = await createRenderer().renderToString(
      new Vue({ render: (h) => h(CanvasComponentTree, { props: { tree, preview, components } }) })
    )
    return html.replace(/&quot;/g, '"')
  }
  const comments = (html) => [...html.matchAll(/<!-- (\S+) -->/g)].map(([, text]) => text)

  // As Canvas 1.13.0 answers a page of the site's hero with an action in it.
  const page = doc(
    'hero-uuid',
    [
      'hero-uuid',
      'js.hero',
      [],
      { actions: ['action-uuid'] },
      { heading: 'Druxt', note_link_text: 'support' },
    ],
    ['action-uuid', 'js.action', [], undefined, { label: 'Get started' }]
  )

  test("a page draws the site's components, with props as they declare them", async () => {
    const html = await draw(page)
    const [, props] = html.match(/<section data-props="(\{.*?\})" heading=/)
    assert.deepEqual(JSON.parse(props), { heading: 'Druxt', noteLinkText: 'support' })
    assert.match(html, /<div data-slot="actions"><section data-props="\{"label":"Get started"\}"/)
    assert.deepEqual(comments(html), [])
  })

  test("in the editor each component, slot and the page's region has its markers", async () => {
    assert.deepEqual(comments(await draw(page, true)), [
      'canvas-region-start-content',
      'canvas-start-hero-uuid',
      'canvas-slot-start-hero-uuid/actions',
      'canvas-start-action-uuid',
      'canvas-end-action-uuid',
      'canvas-slot-end-hero-uuid/actions',
      'canvas-end-hero-uuid',
      'canvas-region-end-content',
    ])
  })

  test('an empty slot is a drop area in the editor, and nothing on the page', async () => {
    const empty = doc(
      'hero-uuid',
      ['hero-uuid', 'js.hero', [], { content: ['el-0'] }],
      ['el-0', 'canvas-slot-placeholder']
    )
    assert.match(
      await draw(empty, true),
      /canvas-slot-start-hero-uuid\/content --><div aria-hidden="true" class="canvas--slot-empty-placeholder"><\/div><!-- canvas-slot-end/
    )
    assert.doesNotMatch(await draw(empty), /placeholder/)
    // A slot holding only a component's example markup is empty too.
    const example = doc(
      'hero-uuid',
      ['hero-uuid', 'js.hero', [], { content: ['el-0'] }],
      markupOf('el-0')
    )
    assert.match(await draw(example, true), /class="canvas--slot-empty-placeholder"/)
    assert.match(await draw(example), /<p>Hero<\/p>/)
  })

  test("Drupal's markup renders as it is, and a marker only marks in the editor", async () => {
    const tree = doc(
      'm-uuid',
      ['m-uuid', 'canvas-marker', ['el-0'], undefined, { markerId: 'title' }],
      markupOf('el-0')
    )
    assert.match(await draw(tree), /<span style="display:contents;"><p>Hero<\/p><\/span>/)
    assert.deepEqual(comments(await draw(tree)), [])
    assert.deepEqual(comments(await draw(tree, true)), [
      'canvas-region-start-content',
      'canvas-start-m-uuid',
      'canvas-end-m-uuid',
      'canvas-region-end-content',
    ])
  })

  test('a page with its own region is marked there, and an empty page is a drop area', async () => {
    const chrome = doc(
      'c',
      ['c', 'renderless-container', ['header', 'r']],
      markupOf('header', '<header></header>'),
      ['r', 'canvas-preview-content-region']
    )
    const html = await draw(chrome, true)
    assert.deepEqual(comments(html), ['canvas-region-start-content', 'canvas-region-end-content'])
    assert.match(
      html,
      /<header><\/header><\/span><!-- canvas-region-start-content --><div aria-hidden="true" class="canvas--region-empty-placeholder">/
    )
    assert.match(await draw({ root: '', elements: {} }, true), /canvas--region-empty-placeholder/)
    assert.equal(
      await draw(null),
      '<div data-server-rendered="true" class="canvas-component-tree"></div>'
    )
  })

  test('a component the site does not have is left out, and says so', async () => {
    const errors = []
    const error = console.error
    console.error = (message) => errors.push(message)
    try {
      assert.doesNotMatch(
        await draw(doc('x-uuid', ['x-uuid', 'js.missing', ['el-0']], markupOf('el-0'))),
        /Hero/
      )
    } finally {
      console.error = error
    }
    assert.match(errors.join('\n'), /"missing" \(instance "x-uuid"\) is not registered/)
  })
})

describe('Canvas Headless content', () => {
  const sdk = async () => ({
    core: await import(nuxt.resolve('@drupal-canvas/headless')),
    jsonRender: await import(nuxt.resolve('@drupal-canvas/headless/json-render')),
    own: () => ({ hero: true, action: true }),
  })

  test("Canvas's document is drawn as it came", async () => {
    const tree = doc('hero-uuid', ['hero-uuid', 'js.hero'])
    assert.deepEqual(toDocument(tree, await sdk()), tree)
    assert.equal(toDocument(null, await sdk()), null)
  })

  test('an answer in the format before Canvas 1.13 is converted', async () => {
    const legacy = {
      element: 'js-hero',
      props: { heading: 'Druxt', canvasUuid: 'hero-uuid' },
      slots: {
        actions: { element: 'js-action', props: { label: 'Go', canvasUuid: 'action-uuid' } },
      },
    }
    const tree = toDocument(legacy, await sdk())
    assert.equal(tree.root, 'hero-uuid')
    assert.equal(tree.elements['hero-uuid'].type, 'js.hero')
    assert.deepEqual(tree.elements['hero-uuid'].slots, { actions: ['action-uuid'] })
    assert.deepEqual(tree.elements['action-uuid'].props, { label: 'Go' })
  })

  test('a document that is not one is refused on the server', async () => {
    const { core, jsonRender, own } = await sdk()
    assert.throws(() => toDocument({ root: 'missing', elements: {} }, { core, jsonRender, own }))
  })
})
