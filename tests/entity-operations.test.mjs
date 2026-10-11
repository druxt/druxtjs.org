import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const { hasEditorHint, operationsUrl, operationsOf } = (
  await import('../nuxt/lib/entity-operations.js')
).default

describe('hasEditorHint', () => {
  it('finds the hint among other cookies', () => {
    assert.equal(hasEditorHint('a=1; druxt_editor=1; b=2'), true)
  })

  it('is false without it, including for a cookie that only ends in the name', () => {
    assert.equal(hasEditorHint(''), false)
    assert.equal(hasEditorHint('not_druxt_editor=1'), false)
    assert.equal(hasEditorHint(undefined), false)
  })
})

describe('operationsUrl', () => {
  it('asks for the links of several entities of one type, and no fields', () => {
    const url = new URL(operationsUrl('node--doc_page', ['a', 'b']), 'http://x')
    assert.equal(url.pathname, '/jsonapi/node/doc_page')
    assert.equal(url.searchParams.get('filter[ids][condition][path]'), 'id')
    assert.equal(url.searchParams.get('filter[ids][condition][operator]'), 'IN')
    assert.deepEqual(url.searchParams.getAll('filter[ids][condition][value][]'), ['a', 'b'])
    assert.equal(url.searchParams.get('fields[node--doc_page]'), '')
  })
})

describe('operationsOf', () => {
  const resource = {
    links: {
      self: { href: 'https://example.com/jsonapi/node/doc_page/a' },
      'delete-form': {
        href: 'https://example.com/node/1/delete',
        meta: { linkParams: { title: 'Delete' } },
      },
      'edit-form': {
        href: 'https://example.com/node/1/edit?x=1',
        meta: { linkParams: { title: 'Edit' } },
      },
      'version-history': {
        href: 'https://example.com/node/1/revisions',
        meta: { linkParams: { title: 'Revisions' } },
      },
    },
  }

  it('lists the operations in a fixed order, Delete last', () => {
    assert.deepEqual(
      operationsOf(resource).map((o) => o.title),
      ['Edit', 'Revisions', 'Delete']
    )
  })

  it('links to this origin, so the proxied backend answers', () => {
    assert.equal(operationsOf(resource)[0].href, '/node/1/edit?x=1')
  })

  it('ignores the links that are not operations', () => {
    assert.equal(
      operationsOf(resource).some((o) => o.key === 'self'),
      false
    )
  })

  it('offers nothing for a resource with no operations', () => {
    assert.deepEqual(operationsOf({ links: { self: { href: '/x' } } }), [])
    assert.deepEqual(operationsOf({}), [])
  })
})

describe('EntityOperations.vue', () => {
  // A second method with the same name replaces the first without a warning:
  // the E shortcut was registered on the document under a name the menu's
  // navigation handler then took over, so every arrow key on the page went
  // to the menu. The two are named for where they listen.
  it('registers the document shortcut and the menu handler under different names', async () => {
    const { readFile } = await import('node:fs/promises')
    const source = await readFile(
      new URL('../nuxt/components/app/EntityOperations.vue', import.meta.url),
      'utf8'
    )
    const script = source.slice(source.indexOf('<script>'), source.indexOf('</script>'))
    const methods = script.slice(script.indexOf('  methods: {'))
    const names = [...methods.matchAll(/^ {4}(?:async )?([a-zA-Z]+)\(/gm)].map((m) => m[1])
    const duplicates = names.filter((name, i) => names.indexOf(name) !== i)
    assert.deepEqual(duplicates, [], 'a method name defined twice')
    assert.ok(source.includes("document.addEventListener('keydown', this.onDocumentKey)"))
    assert.ok(source.includes("document.removeEventListener('keydown', this.onDocumentKey)"))
    assert.ok(source.includes('@keydown="onMenuKey"'))
    assert.ok(!source.includes('@keydown="onKey"'))
  })
})
