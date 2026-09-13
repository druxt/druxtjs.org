// Unit tests for the earlier versions each page carries into the IR.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { Defects, buildBlocks } from '../scripts/lib/blocks.mjs'
import { tokenize } from '../scripts/lib/corpus.mjs'
import { rebuilds, revision, revisions } from '../scripts/lib/revisions.mjs'

const SHA = 'ad2ea458ca4c'.padEnd(40, '0')
const FRONTMATTER = '---\ntitle: Proxy\ndescription: Route API calls through Nuxt.\n---\n'
const NO_IMAGES = new Map()

const version = (content, extra = {}) => ({
  sha: SHA,
  date: '2026-09-04T11:09:08+00:00',
  subject: 'docs(how-to): rewrite the proxy guide (#807)',
  path: 'docs/nuxt/content/how-to/proxy.md',
  content,
  ...extra,
})

/** What the current version's parser makes of a body. */
const current = (body, defects = new Defects()) =>
  buildBlocks({ file: 'x.md', blocks: tokenize(body).blocks }, defects)

describe('revision', () => {
  test('carries the commit, the title, the description and the blocks', () => {
    const body = '# Proxy\n\nSee below.\n\n```js\nexport default { proxy: true }\n```\n'
    const built = revision(version(FRONTMATTER + body), NO_IMAGES, 'Later')
    assert.deepEqual(built.revision, {
      sha: SHA,
      date: '2026-09-04T11:09:08+00:00',
      subject: 'docs(how-to): rewrite the proxy guide (#807)',
      path: 'docs/nuxt/content/how-to/proxy.md',
      title: 'Proxy',
      description: 'Route API calls through Nuxt.',
      blocks: [
        { type: 'text', markdown: '# Proxy\n\nSee below.' },
        { type: 'code', language: 'js', code: 'export default { proxy: true }' },
      ],
    })
    assert.equal(built.rebuilds, true)
    assert.deepEqual(built.notes, [])
  })

  test('a clean version gets exactly the blocks the current parser gives it', () => {
    const body =
      '# Deploy\n\n> **Before you start:** build it.\n\n```sh\nnpm run build\n```\n\n![A diagram](/images/a.png)\n\n```mermaid\nflowchart TB\n```\n\nDone.\n'
    const images = new Map([['/images/a.png', 'A diagram']])
    assert.deepEqual(
      revision(version(FRONTMATTER + body), images, 'Later').revision.blocks,
      current(body).blocks
    )
  })

  test("the title is the frontmatter's, then the first level-one heading, then the next version's", () => {
    assert.equal(
      revision(version(`${FRONTMATTER}# Heading\n`), NO_IMAGES, 'Later').revision.title,
      'Proxy'
    )
    assert.equal(
      revision(version('# DruxtClient\n\nThe client.\n'), NO_IMAGES, 'Later').revision.title,
      'DruxtClient'
    )
    assert.equal(
      revision(version('```sh\n# not a heading\n```\n\n## Nor this\n'), NO_IMAGES, 'Later').revision
        .title,
      'Later'
    )
  })

  test('a version with no description has none, rather than an empty one', () => {
    assert.equal(
      revision(version('# DruxtClient\n'), NO_IMAGES, 'Later').revision.description,
      null
    )
  })

  test('a fence the model refuses is kept, verbatim, in the prose around it', () => {
    const body = 'Wrap the component:\n\n```jsx\n<DruxtEntity />\n```\n\nThen build.\n'
    const built = revision(version(FRONTMATTER + body), NO_IMAGES, 'Later')
    assert.deepEqual(built.revision.blocks, [
      {
        type: 'text',
        markdown: 'Wrap the component:\n\n```jsx\n<DruxtEntity />\n```\n\nThen build.',
      },
    ])
    assert.equal(built.rebuilds, true)
    assert.equal(built.notes.length, 1)
    assert.equal(built.notes[0].file, 'docs/nuxt/content/how-to/proxy.md@ad2ea458ca4c')
    assert.match(built.notes[0].message, /fence language "jsx"/)
  })

  test('the current version still drops that fence and fails', () => {
    const defects = new Defects()
    const { blocks } = current('Wrap the component:\n\n```jsx\n<DruxtEntity />\n```\n', defects)
    assert.equal(defects.failed, true)
    assert.equal(JSON.stringify(blocks).includes('DruxtEntity'), false)
  })

  describe('images', () => {
    const images = new Map([
      ['/images/vuejs-devtools.png', 'Vue.js Devtools showing the DruxtJS integration'],
    ])

    test("one today's corpus migrates with the same alt text stays an image", () => {
      const body =
        '![Vue.js Devtools showing the DruxtJS integration](/images/vuejs-devtools.png)\n'
      assert.deepEqual(revision(version(FRONTMATTER + body), images, 'Later').revision.blocks, [
        {
          type: 'image',
          src: '/images/vuejs-devtools.png',
          alt: 'Vue.js Devtools showing the DruxtJS integration',
        },
      ])
    })

    test('one whose alt text has since changed stays in the prose, as written', () => {
      const body =
        'Open the devtools.\n\n![Vue.js Devtools integration](/images/vuejs-devtools.png)\n'
      const built = revision(version(FRONTMATTER + body), images, 'Later')
      assert.deepEqual(built.revision.blocks, [
        {
          type: 'text',
          markdown:
            'Open the devtools.\n\n![Vue.js Devtools integration](/images/vuejs-devtools.png)',
        },
      ])
      assert.equal(built.rebuilds, true)
      assert.match(built.notes[0].message, /kept as markdown: \/images\/vuejs-devtools\.png/)
    })

    test("one today's corpus does not migrate stays in the prose, as written", () => {
      const body = '![DruxtBlocks Storybook integration](/images/druxt-block-storybook.png)\n'
      assert.deepEqual(revision(version(FRONTMATTER + body), images, 'Later').revision.blocks, [
        {
          type: 'text',
          markdown: '![DruxtBlocks Storybook integration](/images/druxt-block-storybook.png)',
        },
      ])
    })
  })
})

describe('rebuilds', () => {
  test('forgives the blank line an earlier version left out above a fence', () => {
    const body = '_Get a page._\n```js\ndruxt.getResource()\n```\n'
    const { blocks, presentation } = current(body)
    assert.equal(rebuilds(body, blocks, presentation), true)
  })

  test('does not forgive a changed line', () => {
    assert.equal(
      rebuilds('One.\n\nTwo.\n', [{ type: 'text', markdown: 'One.\n\nToo.' }], []),
      false
    )
  })

  test('does not forgive a lost line', () => {
    assert.equal(rebuilds('One.\n\nTwo.\n', [{ type: 'text', markdown: 'One.' }], []), false)
  })
})

describe('revisions', () => {
  test('oldest first, and a version with no title takes the one after it', () => {
    const built = revisions(
      [
        version('Deprecated.\n', { sha: '1'.repeat(40) }),
        version('# Deprecations\n\nDeprecated.\n', { sha: '2'.repeat(40) }),
        version('Still deprecated.\n', { sha: '3'.repeat(40) }),
      ],
      NO_IMAGES,
      'Entity deprecations'
    )
    assert.deepEqual(
      built.map((entry) => entry.revision.sha[0]),
      ['1', '2', '3']
    )
    assert.deepEqual(
      built.map((entry) => entry.revision.title),
      ['Deprecations', 'Deprecations', 'Entity deprecations']
    )
  })
})
