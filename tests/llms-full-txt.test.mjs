// llms-full.txt is the guide as one document, so the properties that matter are
// that it carries the body text, that it does so in reading order, and that
// nothing in it resolves against the site it was read away from.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

const { buildLlmsFullTxt, toAbsoluteUrls, isChangelog } = await import(
  '../nuxt/lib/llms-full-txt.js'
)

const doc = (over) => ({
  route: '/how-to/theming',
  title: 'Theming',
  description: 'How to theme.',
  weight: 0,
  section: 'how-to',
  content: 'Wrapper components override output.',
  ...over,
})

const options = { origin: 'https://example.test' }

describe('buildLlmsFullTxt', () => {
  test('opens with the H1 and blockquote, and points back at the index file', () => {
    const out = buildLlmsFullTxt([doc()], options)
    const lines = out.split('\n')

    assert.equal(lines[0], '# DruxtJS')
    assert.equal(lines[2].startsWith('> '), true)
    assert.ok(out.includes('https://example.test/llms.txt'))
  })

  test('carries the document body, which is the whole point of the file', () => {
    assert.ok(buildLlmsFullTxt([doc()], options).includes('Wrapper components override output.'))
  })

  test('cites each document source so a quote can be attributed to a page', () => {
    assert.ok(
      buildLlmsFullTxt([doc()], options).includes('Source: https://example.test/how-to/theming')
    )
  })

  test('orders by weight, not alphabetically, because weight is the reading order', () => {
    const out = buildLlmsFullTxt(
      [
        doc({ route: '/how-to/aaa', title: 'Last', weight: 10, content: 'Last body.' }),
        doc({ route: '/how-to/zzz', title: 'First', weight: -10, content: 'First body.' }),
      ],
      options
    )

    assert.ok(out.indexOf('First body.') < out.indexOf('Last body.'))
  })

  test('groups documents under their section, in guide order', () => {
    const out = buildLlmsFullTxt(
      [
        doc({
          route: '/explanation/architecture',
          title: 'Architecture',
          section: 'explanation',
          content: 'Concept body.',
        }),
        doc({
          route: '/tutorials/getting-started',
          title: 'Getting started',
          section: 'tutorials',
          content: 'Tutorial body.',
        }),
      ],
      options
    )

    assert.ok(out.indexOf('Tutorial body.') < out.indexOf('Concept body.'))
    assert.ok(out.includes('# Tutorials'))
    assert.ok(out.includes('# Concepts'))
  })

  test('includes the API reference, which is what a caller asking about props needs', () => {
    const out = buildLlmsFullTxt(
      [
        doc(),
        doc({
          route: '/api/packages/blocks',
          title: 'Blocks API',
          section: 'api',
          content: 'Generated signature.',
        }),
      ],
      options
    )

    assert.ok(out.includes('Generated signature.'))
  })

  test('puts the reference after the guide, because it is reference', () => {
    const out = buildLlmsFullTxt(
      [
        doc({ route: '/api/packages/blocks', section: 'api', content: 'Reference body.' }),
        doc({ route: '/tutorials/start', section: 'tutorials', content: 'Tutorial body.' }),
      ],
      options
    )

    assert.ok(out.indexOf('Tutorial body.') < out.indexOf('Reference body.'))
  })

  test('drops per-package changelogs, the largest and least useful pages', () => {
    const out = buildLlmsFullTxt(
      [
        doc({
          route: '/api/packages/blocks/CHANGELOG',
          title: 'Changelog',
          section: 'api',
          content: 'Release history.',
        }),
        doc({
          route: '/api/packages/blocks',
          title: 'Blocks API',
          section: 'api',
          content: 'Generated signature.',
        }),
      ],
      options
    )

    assert.ok(!out.includes('Release history.'))
    assert.ok(out.includes('Generated signature.'))
  })

  test('skips documents with no body rather than emitting an empty heading', () => {
    const out = buildLlmsFullTxt([doc({ title: 'Empty', content: '   ' })], options)

    assert.ok(!out.includes('## Empty'))
  })
})

describe('toAbsoluteUrls', () => {
  test('rewrites root-relative links, which resolve to nothing outside the site', () => {
    assert.equal(
      toAbsoluteUrls('See [proxy](/how-to/proxy).', 'https://example.test'),
      'See [proxy](https://example.test/how-to/proxy).'
    )
  })

  test('leaves absolute and protocol-relative URLs alone', () => {
    const input = '[a](https://drupal.org) [b](//cdn.example/x) [c](#anchor)'

    assert.equal(toAbsoluteUrls(input, 'https://example.test'), input)
  })

  test('rewrites every link in a document, not just the first', () => {
    assert.equal(
      toAbsoluteUrls('[a](/one) then [b](/two)', 'https://example.test'),
      '[a](https://example.test/one) then [b](https://example.test/two)'
    )
  })
})

describe('isChangelog', () => {
  test('matches a package changelog route and nothing adjacent to it', () => {
    assert.equal(isChangelog('/api/packages/blocks/CHANGELOG'), true)
    assert.equal(isChangelog('/api/packages/blocks'), false)
    assert.equal(isChangelog('/how-to/changelog-conventions'), false)
  })
})
