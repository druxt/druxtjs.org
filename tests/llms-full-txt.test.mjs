// llms-full.txt is the guide as one document, so the properties that matter are
// that it carries the body text, that it does so in reading order, and that
// nothing in it resolves against the site it was read away from.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

const { buildLlmsFullTxt, outlineProblems, scanFences, toAbsoluteUrls, isChangelog } = await import(
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

describe('outlineProblems', () => {
  const shell = '```sh\n# .env\nBASE_URL=https://cms.example.com\n# NUXT_TARGET=static\n```'
  const problems = (docs) => outlineProblems(docs, buildLlmsFullTxt(docs, options))
  const outline = (content) => problems([doc({ content })])

  test('accepts the title and section headings, with shell comments inside fences', () => {
    assert.deepEqual(outline(shell), [])
  })

  test('accepts every section heading the builder can emit', () => {
    const sections = ['tutorials', 'how-to', 'explanation', 'modules', 'api']
    const docs = sections.map((section) => doc({ route: '/' + section + '/page', section }))

    assert.deepEqual(problems(docs), [])
  })

  test('reports a fence that never closes, which hides the rest of the file', () => {
    const found = outline('```sh\n# .env\nBASE_URL=x')

    assert.equal(found.length, 2)
    assert.match(found[0], /^\/how-to\/theming line 1: code fence never closes/)
    assert.match(found[1], /code fence never closes/)
  })

  test('names the page whose fence the next page closes, which the file alone hides', () => {
    const found = problems([
      doc({ route: '/how-to/a', weight: 1, content: '```sh\n# .env' }),
      doc({ route: '/how-to/b', weight: 2, content: '```sh\nls\n```' }),
    ])

    assert.deepEqual(found, ['/how-to/a line 1: code fence never closes'])
  })

  test('reports a heading in a body, which claims the sections after it', () => {
    const found = outline('# NUXT_TARGET=static')

    assert.deepEqual(found, [
      '/how-to/theming line 1: top-level heading "# NUXT_TARGET=static" in a page body',
    ])
  })

  test('reports a body heading that reads like a section heading, which the file alone accepts', () => {
    const found = outline('Intro.\n\n# Tutorials\n\nMore.')

    assert.deepEqual(found, [
      '/how-to/theming line 3: top-level heading "# Tutorials" in a page body',
    ])
  })

  test('reports a setext heading, which a CommonMark reader takes as an H1', () => {
    const found = outline('Overview\n========\n\nText.')

    assert.deepEqual(found, ['/how-to/theming line 1: top-level heading "Overview" in a page body'])
  })

  test('ignores a page the file drops, such as a changelog with a fence left open', () => {
    const found = problems([
      doc(),
      doc({ route: '/api/packages/druxt/CHANGELOG', section: 'api', content: '```sh\n# .env' }),
      doc({ route: '/playground', section: 'playground', content: '```sh\n# .env' }),
    ])

    assert.deepEqual(found, [])
  })

  test('closes a fence only on a matching marker at least as long', () => {
    assert.deepEqual(outline('````md\n```js\n# inner\n```\n````'), [])
    assert.deepEqual(outline('~~~\n```\n# inner\n~~~'), [])
    assert.match(outline('````\n# inner\n```')[0], /code fence never closes/)
  })

  test('treats inline code at the start of a line as text, not a fence', () => {
    assert.deepEqual(outline('```inline``` then prose'), [])
  })

  test('follows a fence opened inside a list item, whose closer is indented to the item', () => {
    assert.deepEqual(
      outline('- Set the file:\n\n  ```sh\n  # .env\n  BASE_URL=x\n  ```\n- Then run it.'),
      []
    )
    assert.deepEqual(outline('1. ```sh\n   # .env\n   ```'), [])
    assert.deepEqual(outline('- ```sh\n  # .env\n  ```\n\n# Loose'), [
      '/how-to/theming line 5: top-level heading "# Loose" in a page body',
    ])
  })

  test('closes a fence in a list item whose content column is four or more', () => {
    assert.deepEqual(outline('*   ```sh\n    # .env\n    ```\n\nText.'), [])
    assert.deepEqual(outline('1.  ```sh\n    # .env\n    ```'), [])
    assert.deepEqual(outline('1. Step\n   - ```sh\n     # .env\n     ```\n   - Next'), [])
    // A column-0 marker ends the item, closing its fence, and opens one of its own.
    assert.match(outline('*   ```sh\n    # .env\n```')[0], /line 3: code fence never closes/)
  })

  test('leaves a list item as a list item under an underline, not a setext heading', () => {
    assert.deepEqual(outline('- Overview\n===\n\nText.'), [])
  })

  test('keeps a raw-text element open to its closing tag, blank lines and all', () => {
    assert.deepEqual(outline('<pre>\n# not a heading\n\n```\n# nor this\n</pre>\n\nText.'), [])
    assert.deepEqual(outline('<script>\n// # x\n</script>\n\n# After'), [
      '/how-to/theming line 5: top-level heading "# After" in a page body',
    ])
  })

  test('lets a block tag interrupt a paragraph, as CommonMark does', () => {
    assert.deepEqual(outline('Text\n<div>\n# raw\n</div>\n\n# After'), [
      '/how-to/theming line 6: top-level heading "# After" in a page body',
    ])
  })

  test('lets a tag follow paragraph text without opening an HTML block', () => {
    assert.deepEqual(outline('Text\n<span>x</span>\n# Loose'), [
      '/how-to/theming line 3: top-level heading "# Loose" in a page body',
    ])
  })

  test('reads an unindented marker after a list-item fence as a new fence, not the closer', () => {
    const found = outline('- ```sh\n  # .env\n```\n## Next')

    assert.equal(found.length, 2)
    assert.match(found[0], /^\/how-to\/theming line 3: code fence never closes/)
  })

  test('leaves a # inside an HTML comment or block as text, which is what it is', () => {
    assert.deepEqual(outline('<!--\n# not a heading\n-->\n\nText.'), [])
    assert.deepEqual(outline('<!-- # inline --> text\n\n# Loose'), [
      '/how-to/theming line 3: top-level heading "# Loose" in a page body',
    ])
    assert.deepEqual(outline('<div>\n# raw\n</div>\n\n# After'), [
      '/how-to/theming line 5: top-level heading "# After" in a page body',
    ])
  })

  test('takes a setext underline only under paragraph text, not under a closing fence', () => {
    assert.deepEqual(outline('```sh\nls\n```\n===\n\nText.'), [])
    assert.deepEqual(outline('# Title\n===\n'), [
      '/how-to/theming line 1: top-level heading "# Title" in a page body',
    ])
  })
})

describe('scanFences', () => {
  test('lists headings outside fences by line and level, which is what a parity split reads', () => {
    assert.deepEqual(scanFences('# Guide\n\n```md\n# .env\n## Example\n```\n## Page\n#hashtag'), {
      headings: [
        { line: 1, level: 1, text: '# Guide' },
        { line: 7, level: 2, text: '## Page' },
      ],
      open: null,
    })
  })

  test('reads setext headings at the level their underline gives them', () => {
    assert.deepEqual(scanFences('Guide\n=====\n\nPage\n----\n\n---\n\n```\nx\n===\n```').headings, [
      { line: 1, level: 1, text: 'Guide' },
      { line: 4, level: 2, text: 'Page' },
    ])
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
