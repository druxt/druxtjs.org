// What the floating editor bar is acting on. A page is not one entity: a doc
// page is a node made of paragraphs, so the bar has a subject and the page is
// the fallback.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  editHref,
  editLabel,
  kindOf,
  pageSubject,
  subjectFromElement,
  subjectsOn,
} = require('../nuxt/lib/editor-subject.js')

/** An element, as the field wrappers render one. */
const el = (attributes) => ({
  getAttribute: (name) => (name in attributes ? attributes[name] : null),
})

const page = pageSubject({
  uuid: 'page-1',
  type: 'node--doc_page',
  title: 'Configure CORS in Drupal',
})

describe('kindOf', () => {
  test('names the paragraphs this site renders', () => {
    assert.equal(kindOf('paragraph--docs_text'), 'Text')
    assert.equal(kindOf('paragraph--docs_code'), 'Code')
  })

  test('a paragraph it has no name for is a block', () => {
    assert.equal(kindOf('paragraph--docs_something_new'), 'Block')
  })

  test('a node is a page, and anything else says what it is', () => {
    assert.equal(kindOf('node--doc_page'), 'Page')
    assert.equal(kindOf('media--image'), 'Media')
  })
})

describe('subjectFromElement', () => {
  test('reads the anchors a field wrapper wrote', () => {
    const subject = subjectFromElement(
      el({
        'data-druxt-entity': 'p-1',
        'data-druxt-type': 'paragraph--docs_text',
        'data-druxt-field': 'field_text',
      }),
      { closest: (node) => node }
    )
    assert.equal(subject.uuid, 'p-1')
    assert.equal(subject.kind, 'Text')
    assert.equal(subject.label, 'Text')
  })

  test('an anchor with no uuid is nothing to act on', () => {
    assert.equal(
      subjectFromElement(el({ 'data-druxt-entity': 'false' }), { closest: (node) => node }),
      null
    )
  })

  test('an element outside anything anchored is nothing to act on', () => {
    assert.equal(subjectFromElement(el({}), { closest: () => null }), null)
  })
})

describe('the label a reader reads', () => {
  test('says the field only when it adds something', () => {
    const code = subjectFromElement(
      el({
        'data-druxt-entity': 'p-2',
        'data-druxt-type': 'paragraph--docs_code',
        'data-druxt-field': 'field_code',
      }),
      { closest: (node) => node }
    )
    assert.equal(code.label, 'Code', 'a code block whose field is the code is just Code')

    const callout = subjectFromElement(
      el({
        'data-druxt-entity': 'p-3',
        'data-druxt-type': 'paragraph--docs_callout',
        'data-druxt-field': 'field_callout',
      }),
      { closest: (node) => node }
    )
    assert.equal(callout.label, 'Callout, the text')
  })
})

describe('pageSubject', () => {
  test('is the page, by its title', () => {
    assert.equal(page.kind, 'Page')
    assert.equal(page.label, 'Configure CORS in Drupal')
  })

  test('there is none before the page is known', () => {
    assert.equal(pageSubject(null), null)
  })
})

describe('editHref', () => {
  test('the page opens its own form, and comes back here', () => {
    const back = '/how-to/configure-cors'
    const href = editHref(page, page, '/node/27/edit', back)
    // Encoded here rather than written out: Drupal reads `destination` as one
    // value, and a literal of it reads as gibberish to a spell checker.
    assert.equal(href, `/node/27/edit?destination=${encodeURIComponent(back)}`)
  })

  test('a block opens the page form at the field that holds it', () => {
    const block = { uuid: 'p-1', kind: 'Text', label: 'Text, the text' }
    const href = editHref(block, page, '/node/27/edit', '/how-to/configure-cors')
    assert.match(href, /#edit-field-content-wrapper$/)
  })

  test('an operation Drupal did not offer is not a link', () => {
    assert.equal(editHref(page, page, null, '/x'), null)
  })
})

describe('editLabel', () => {
  test('says what Edit will open, before it is pressed', () => {
    assert.equal(editLabel(page, page), 'Edit this page')
    assert.equal(editLabel({ uuid: 'p-1', kind: 'Code' }, page), 'Edit this page, at the code')
    assert.equal(
      editLabel({ uuid: 'p-2', kind: 'Text', field: 'field_text' }, page),
      'Edit this page, at the text'
    )
  })
})

describe('subjectsOn', () => {
  test('lists the page first, then what the page anchored, in order', () => {
    const nodes = [
      el({ 'data-druxt-entity': 'p-1', 'data-druxt-type': 'paragraph--docs_text' }),
      el({ 'data-druxt-entity': 'p-2', 'data-druxt-type': 'paragraph--docs_code' }),
      // The same block, anchored twice, is one thing to act on.
      el({ 'data-druxt-entity': 'p-1', 'data-druxt-type': 'paragraph--docs_text' }),
    ]
    const found = subjectsOn({ querySelectorAll: () => nodes }, page)
    assert.deepEqual(
      found.map((subject) => subject.uuid),
      ['page-1', 'p-1', 'p-2']
    )
  })

  test('a page with nothing anchored still offers itself', () => {
    assert.deepEqual(
      subjectsOn({ querySelectorAll: () => [] }, page).map((s) => s.uuid),
      ['page-1']
    )
  })
})

// `/user` is proxied to Drupal whole, because a login form that posts to
// another origin sets its cookie there. The profile pages this site renders
// itself sit inside that path, so they are named as the exception.
describe('which /user paths this site claims', () => {
  const { isProfilePath } = require('../nuxt/lib/profile-path.js')

  test('Drupal keeps its own screens under /user', () => {
    assert.equal(isProfilePath('/user/login'), false)
    assert.equal(isProfilePath('/user/logout'), false)
    assert.equal(isProfilePath('/user/password'), false)
    assert.equal(isProfilePath('/user/2/edit'), false)
    assert.equal(isProfilePath('/user/2/cancel'), false)
  })

  test('a profile is this site to render, query and all', () => {
    assert.equal(isProfilePath('/user/2'), true)
    assert.equal(isProfilePath('/user/2?x=1'), true)
  })

  test('nothing else is', () => {
    assert.equal(isProfilePath('/users/2'), false)
    assert.equal(isProfilePath('/how-to/proxy'), false)
    assert.equal(isProfilePath(''), false)
  })
})
