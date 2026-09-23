// Unit tests for the authoring script: the layout it computes, the JSON:API
// resources it hands the Druxt client, the order it writes them in, and the
// report a failed write leaves behind. The client is a recording double with
// the client's own method names, so the request shapes are what is tested.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const {
  AuthoringError,
  authorPage,
  authorizeUrl,
  blockResource,
  layoutSections,
  pageResource,
  assertDocument,
  parseArgs,
  pkcePair,
  sectionResource,
  sectionTerm,
} = await import('../nuxt/scripts/author-page.mjs')

const text = (markdown) => ({ type: 'text', markdown })
const diagram = (group) => ({ type: 'diagram', source: 'graph TD', syntax: 'mermaid', group })

const document = {
  source: 'docs/nuxt/content/how-to/new-page.md',
  url: '/how-to/new-page',
  section: 'how-to',
  isLanding: false,
  title: 'A new page',
  description: 'What it covers.',
  weight: -3,
  blocks: [
    text('Intro'),
    { type: 'code', code: 'npm i', language: 'sh' },
    diagram('pair'),
    diagram('pair'),
    { type: 'callout', callout: 'tip', markdown: 'Note' },
  ],
}

/** A client double: answers as Drupal would, and records every call. */
const fakeClient = ({ failOn } = {}) => {
  const calls = []
  let n = 0
  // Drupal names a node's revision `vid` and a paragraph's `revision_id`.
  const answer = (resource) => {
    n += 1
    const revision = resource.type.startsWith('node--')
      ? { drupal_internal__vid: 100 + n }
      : { drupal_internal__revision_id: 100 + n }
    return {
      data: { data: { type: resource.type, id: resource.id || `uuid-${n}`, attributes: revision } },
    }
  }
  return {
    calls,
    getCollection: async (type, query) => {
      calls.push({ method: 'getCollection', type, query })
      return { data: [{ type, id: 'term-how-to', attributes: { name: 'How-to guides' } }] }
    },
    createResource: async (resource) => {
      calls.push({ method: 'createResource', resource })
      if (failOn && failOn(resource, calls))
        throw new Error('422: Unprocessable Entity\n\nURL: /jsonapi')
      return answer(resource)
    },
    updateResource: async (resource) => {
      calls.push({ method: 'updateResource', resource })
      return answer(resource)
    },
  }
}

describe('layoutSections', () => {
  test('puts a run of ungrouped blocks in one single-column section, in order', () => {
    assert.deepEqual(layoutSections([text('a'), text('b')]), [
      {
        layout: 'layout_onecol',
        blocks: [
          { index: 0, region: 'content' },
          { index: 1, region: 'content' },
        ],
      },
    ])
  })

  test('stands a run of grouped blocks side by side, two or three wide', () => {
    assert.deepEqual(
      layoutSections([
        diagram('x'),
        diagram('x'),
        text('t'),
        diagram('y'),
        diagram('y'),
        diagram('y'),
      ]),
      [
        {
          layout: 'layout_twocol',
          blocks: [
            { index: 0, region: 'first' },
            { index: 1, region: 'second' },
          ],
        },
        { layout: 'layout_onecol', blocks: [{ index: 2, region: 'content' }] },
        {
          layout: 'layout_threecol_33_34_33',
          blocks: [
            { index: 3, region: 'first' },
            { index: 4, region: 'second' },
            { index: 5, region: 'third' },
          ],
        },
      ]
    )
  })

  test('a lone grouped block, or an empty group, is a single column', () => {
    assert.deepEqual(layoutSections([diagram('solo'), { ...diagram(''), type: 'diagram' }]), [
      { layout: 'layout_onecol', blocks: [{ index: 0, region: 'content' }] },
      { layout: 'layout_onecol', blocks: [{ index: 1, region: 'content' }] },
    ])
  })

  test('refuses a group wider than any layout', () => {
    assert.throws(
      () => layoutSections([diagram('w'), diagram('w'), diagram('w'), diagram('w')]),
      /no layout has that many columns/
    )
  })
})

describe('resources', () => {
  test('a section carries its layout and no parent, as layout_paragraphs stores it', () => {
    assert.deepEqual(sectionResource('layout_twocol'), {
      type: 'paragraph--docs_layout_section',
      attributes: {
        behavior_settings: {
          value: {
            layout_paragraphs: {
              layout: 'layout_twocol',
              config: { label: '' },
              parent_uuid: '',
              region: '',
            },
          },
        },
      },
    })
  })

  test('each block type maps to its paragraph fields, placed in its section', () => {
    const placed = {
      value: {
        layout_paragraphs: { layout: '', config: {}, parent_uuid: 'sec-1', region: 'first' },
      },
    }
    assert.deepEqual(blockResource(text('Hi'), 'sec-1', 'first'), {
      type: 'paragraph--docs_text',
      attributes: {
        field_text: { value: 'Hi', format: 'docs_markdown' },
        behavior_settings: placed,
      },
    })
    assert.deepEqual(
      blockResource({ type: 'code', code: 'ls', language: 'sh' }, 'sec-1', 'first').attributes,
      {
        field_code: 'ls',
        field_language: 'sh',
        behavior_settings: placed,
      }
    )
    assert.deepEqual(
      blockResource({ type: 'callout', callout: 'warning', markdown: 'Careful' }, 'sec-1', 'first')
        .attributes,
      {
        field_callout: { value: 'Careful', format: 'docs_markdown' },
        field_callout_type: 'warning',
        behavior_settings: placed,
      }
    )
    assert.deepEqual(blockResource(diagram('g'), 'sec-1', 'first').attributes, {
      field_diagram: 'graph TD',
      field_syntax: 'mermaid',
      field_group: 'g',
      behavior_settings: placed,
    })
  })

  test('an image block, and an unknown block, are refused before anything is written', () => {
    assert.throws(
      () => blockResource({ type: 'image', src: '/x.png', alt: '' }, 's', 'content'),
      /media upload/
    )
    assert.throws(() => blockResource({ type: 'video' }, 's', 'content'), /No paragraph type/)
  })

  test("a new page carries the importer's fields, its alias, its section, and its paragraphs by revision", () => {
    const references = [
      { type: 'paragraph--docs_layout_section', id: 's-1', revision: 11 },
      { type: 'paragraph--docs_text', id: 't-1', revision: 12 },
    ]
    assert.deepEqual(pageResource(document, references, 'term-how-to'), {
      type: 'node--doc_page',
      attributes: {
        title: 'A new page',
        field_description: 'What it covers.',
        moderation_state: 'draft',
        field_weight: -3,
        field_is_landing: false,
        field_source_path: 'docs/nuxt/content/how-to/new-page.md',
        path: { alias: '/how-to/new-page' },
      },
      relationships: {
        field_content: {
          data: [
            { type: 'paragraph--docs_layout_section', id: 's-1', meta: { target_revision_id: 11 } },
            { type: 'paragraph--docs_text', id: 't-1', meta: { target_revision_id: 12 } },
          ],
        },
        field_section: {
          data: { type: 'taxonomy_term--documentation_section', id: 'term-how-to' },
        },
      },
    })
  })

  test('an existing page gets only what a draft revision changes', () => {
    const resource = pageResource(document, [], null, 'page-uuid')
    assert.equal(resource.id, 'page-uuid')
    assert.deepEqual(Object.keys(resource.attributes), [
      'title',
      'field_description',
      'moderation_state',
    ])
    assert.deepEqual(Object.keys(resource.relationships), ['field_content'])
  })
})

describe('authorPage', () => {
  test("writes sections, then their blocks with the section's id, then the page referencing all of them in order", async () => {
    const client = fakeClient()
    const { page, created } = await authorPage(client, document)
    const creates = client.calls.filter((c) => c.method === 'createResource').map((c) => c.resource)
    assert.deepEqual(
      creates.map((r) => r.type),
      [
        'paragraph--docs_layout_section',
        'paragraph--docs_text',
        'paragraph--docs_code',
        'paragraph--docs_layout_section',
        'paragraph--docs_diagram',
        'paragraph--docs_diagram',
        'paragraph--docs_layout_section',
        'paragraph--docs_callout',
        'node--doc_page',
      ]
    )
    // The section term was looked up by the name the backend gives it.
    assert.deepEqual(client.calls[0], {
      method: 'getCollection',
      type: 'taxonomy_term--documentation_section',
      query: {
        'filter[name]': 'How-to guides',
        'fields[taxonomy_term--documentation_section]': 'name',
      },
    })
    // Blocks sit in the section created before them: the text and code share one, the pair shares one.
    assert.equal(
      creates[1].attributes.behavior_settings.value.layout_paragraphs.parent_uuid,
      'uuid-1'
    )
    assert.equal(
      creates[2].attributes.behavior_settings.value.layout_paragraphs.parent_uuid,
      'uuid-1'
    )
    assert.equal(
      creates[4].attributes.behavior_settings.value.layout_paragraphs.parent_uuid,
      'uuid-4'
    )
    assert.equal(
      creates[5].attributes.behavior_settings.value.layout_paragraphs.parent_uuid,
      'uuid-4'
    )
    assert.equal(creates[5].attributes.behavior_settings.value.layout_paragraphs.region, 'second')
    // The page references every paragraph, in order, by the revision each create answered.
    const refs = creates[8].relationships.field_content.data
    assert.deepEqual(
      refs.map((r) => r.id),
      ['uuid-1', 'uuid-2', 'uuid-3', 'uuid-4', 'uuid-5', 'uuid-6', 'uuid-7', 'uuid-8']
    )
    assert.deepEqual(
      refs.map((r) => r.meta.target_revision_id),
      [101, 102, 103, 104, 105, 106, 107, 108]
    )
    assert.equal(creates[8].attributes.moderation_state, 'draft')
    assert.deepEqual(page, { type: 'node--doc_page', id: 'uuid-9', revision: 109 })
    assert.equal(created.length, 8)
  })

  test('an existing page is updated by uuid, with no section lookup', async () => {
    const client = fakeClient()
    await authorPage(client, { ...document, blocks: [text('Only')] }, { uuid: 'page-uuid' })
    assert.equal(
      client.calls.some((c) => c.method === 'getCollection'),
      false
    )
    const update = client.calls.find((c) => c.method === 'updateResource')
    assert.equal(update.resource.id, 'page-uuid')
    assert.equal(update.resource.relationships.field_content.data.length, 2)
  })

  test('a failed write stops before the page and names everything created so far', async () => {
    const client = fakeClient({ failOn: (resource) => resource.type === 'paragraph--docs_code' })
    await assert.rejects(
      () => authorPage(client, document),
      (error) => {
        assert.ok(error instanceof AuthoringError)
        assert.match(error.message, /Could not create paragraph--docs_code: 422/)
        assert.deepEqual(
          error.created.map((c) => `${c.type} ${c.id}`),
          ['paragraph--docs_layout_section uuid-1', 'paragraph--docs_text uuid-2']
        )
        return true
      }
    )
    assert.equal(
      client.calls.some((c) => c.resource && c.resource.type === 'node--doc_page'),
      false
    )
  })

  test('a block it cannot write is refused before the first write', async () => {
    const client = fakeClient()
    await assert.rejects(
      () =>
        authorPage(client, { ...document, blocks: [text('a'), { type: 'image', src: '/x.png' }] }),
      /media upload/
    )
    assert.equal(client.calls.length, 0)
  })

  test('an unknown section is refused', async () => {
    await assert.rejects(() => sectionTerm(fakeClient(), 'blog'), /not a documentation section/)
  })
})

// cspell:ignore Bjft FWFO Melhoa Haoe Sstw
describe('sign-in', () => {
  test('pkcePair derives the S256 challenge from the verifier', () => {
    const { verifier, challenge } = pkcePair('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')
    assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'))
    assert.equal(challenge, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
    assert.notEqual(pkcePair().verifier, pkcePair().verifier)
  })

  test('the authorize URL carries the code grant, the challenge and the listener', () => {
    const url = new URL(
      authorizeUrl({
        backend: 'https://cms.example.com',
        clientId: 'druxtjs_org',
        scope: 'editor',
        redirectUri: 'http://localhost:3939/callback',
        challenge: 'c',
        state: 's',
      })
    )
    assert.equal(url.origin + url.pathname, 'https://cms.example.com/oauth/authorize')
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      response_type: 'code',
      client_id: 'druxtjs_org',
      redirect_uri: 'http://localhost:3939/callback',
      scope: 'editor',
      state: 's',
      code_challenge: 'c',
      code_challenge_method: 'S256',
    })
  })

  test('parseArgs reads --name value pairs and refuses anything else', () => {
    assert.deepEqual(parseArgs(['--document', 'a.json', '--uuid', 'u']), {
      document: 'a.json',
      uuid: 'u',
    })
    assert.throws(() => parseArgs(['a.json']), /Unexpected argument/)
  })
})

// Sign-in opens a browser and waits for a person. A document that cannot be
// authored is rejected before that, not with a TypeError after it.
describe('assertDocument', () => {
  const good = {
    title: 'Configure CORS',
    section: 'how-to',
    url: '/how-to/cors',
    blocks: [{ type: 'text' }],
  }

  test('accepts a page that can be authored', () => {
    assert.doesNotThrow(() => assertDocument(good))
    // Revising an existing page takes its section and path from the page.
    assert.doesNotThrow(() =>
      assertDocument({ title: 'x', blocks: [{ type: 'text' }] }, { uuid: 'u-1' })
    )
  })

  test('names the missing field rather than failing inside the block walk', () => {
    assert.throws(() => assertDocument({ ...good, blocks: undefined }), /needs a "blocks" array/)
    assert.throws(() => assertDocument({ ...good, blocks: [] }), /no blocks to author/)
    assert.throws(() => assertDocument({ ...good, title: '  ' }), /needs a "title"/)
    assert.throws(() => assertDocument({ ...good, section: undefined }), /needs a "section"/)
    assert.throws(() => assertDocument({ ...good, url: undefined }), /needs a "url"/)
  })

  test('says so when the file is a whole IR rather than one of its pages', () => {
    assert.throws(() => assertDocument({ pages: [good] }), /whole IR: pass one of its pages/)
  })

  test('refuses what is not a document at all', () => {
    for (const value of [null, undefined, 'a string', 42, [good]]) {
      assert.throws(() => assertDocument(value), /must be a JSON object/, String(value))
    }
  })
})
