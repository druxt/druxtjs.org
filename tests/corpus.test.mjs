// Unit tests for the corpus reader the IR builder and the survey share.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calloutType,
  classify,
  extractImages,
  extractLinks,
  isGeneratedPath,
  routeFor,
  splitFrontmatter,
  tokenize,
} from '../scripts/lib/corpus.mjs'

const block = (text) => tokenize(text).blocks[0]

describe('splitFrontmatter', () => {
  test('reads the flat scalar keys the corpus uses', () => {
    const { frontmatter, body } = splitFrontmatter('---\ntitle: Theming\nweight: -5\n---\nBody.\n')
    assert.deepEqual(frontmatter, { title: 'Theming', weight: -5 })
    assert.equal(body, 'Body.\n')
  })

  test('reports a key it does not understand rather than dropping it', () => {
    const { frontmatter, unparsed } = splitFrontmatter('---\ntitle: A\nnested:\n  - one\n---\n')
    assert.equal(frontmatter.title, 'A')
    assert.ok(unparsed.includes('  - one'))
  })

  test('a document with no frontmatter keeps its whole body', () => {
    assert.equal(splitFrontmatter('# Just a heading\n').body, '# Just a heading\n')
  })
})

describe('tokenize', () => {
  test('a fence is captured whole, blank lines and all', () => {
    const { blocks } = tokenize('```js\nconst a = 1\n\nconst b = 2\n```\n')
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0].kind, 'fence')
    assert.equal(blocks[0].code, 'const a = 1\n\nconst b = 2')
  })

  // The list item and its example are one structure. Lifting the fence into a
  // sibling code block would destroy the numbered steps around it, so an
  // indented fence is recorded but never promoted. The blocks it spans are
  // all prose, so they rejoin as one text block downstream, which the corpus
  // round-trip proves end to end.
  test('an indented fence is recorded, never promoted to a code block', () => {
    const source = '1. Do this:\n\n   ```sh\n   npm run setup\n   ```\n\n2. Then this.\n'
    const { blocks, nested } = tokenize(source)

    assert.equal(nested.length, 1)
    assert.equal(nested[0].lang, 'sh')
    assert.equal(nested[0].closed, true)
    assert.equal(blocks.filter((block) => block.kind === 'fence').length, 0)
    assert.ok(
      blocks
        .map((block) => block.lines.join('\n'))
        .join('\n')
        .includes('npm run setup')
    )
  })

  test('a fence at column zero is promoted', () => {
    const { blocks, nested } = tokenize('Prose.\n\n```sh\nnpm run setup\n```\n')
    assert.equal(nested.length, 0)
    assert.equal(blocks.filter((block) => block.kind === 'fence').length, 1)
  })

  test('a heading inside a fence is not a heading', () => {
    const { blocks } = tokenize('```sh\n# .env\nBASE_URL=x\n```\n')
    assert.equal(classify(blocks[0]), 'code')
  })

  test('an unclosed fence is reported, not swallowed', () => {
    assert.equal(tokenize('```js\nconst a = 1\n').blocks[0].closed, false)
  })
})

describe('classify', () => {
  for (const [source, expected] of [
    ['# Title', 'heading'],
    ['Just prose.', 'paragraph'],
    ['- one\n- two', 'list'],
    ['| a | b |\n| - | - |', 'table'],
    ['![Alt text](/images/a.png)', 'image'],
    ['> **Before you start:** read this.', 'callout'],
    ['> [druxt] Use `DruxtModule` instead.', 'output'],
    ['> An authored aside.', 'blockquote'],
    ['<div class="docs-diagram-row">', 'html'],
  ]) {
    test(source, () => {
      assert.equal(classify(block(source)), expected)
    })
  }

  test('mermaid is a diagram, not code', () => {
    assert.equal(classify(block('```mermaid\nflowchart TB\n```')), 'diagram')
  })

  test('an image inside a sentence is not an image block', () => {
    assert.equal(classify(block('See ![a](/images/a.png) above.')), 'paragraph')
  })
})

describe('calloutType', () => {
  test('the corpus convention maps to the prerequisite type', () => {
    assert.equal(calloutType(block('> **Before you start:** read this.')), 'prerequisite')
  })

  test('an unknown lead is reported rather than guessed', () => {
    assert.equal(calloutType(block('> **Warning:** something.')), null)
  })
})

describe('routeFor', () => {
  for (const [file, route] of [
    ['docs/nuxt/content/how-to/theming.md', '/how-to/theming'],
    ['docs/nuxt/content/how-to/README.md', '/how-to'],
    ['docs/nuxt/content/modules/druxt/deprecations.md', '/modules/druxt/deprecations'],
  ]) {
    test(`${file} -> ${route}`, () => {
      assert.equal(routeFor(file), route)
    })
  }
})

describe('isGeneratedPath', () => {
  for (const [target, expected] of [
    ['/api/packages/entity/index', true],
    ['/modules/entity', true],
    ['/how-to/contributing', true],
    ['/how-to/theming', false],
    ['/tutorials/getting-started', false],
  ]) {
    test(`${target} -> ${expected}`, () => {
      assert.equal(isGeneratedPath(target), expected)
    })
  }
})

describe('extractLinks', () => {
  test('classifies by shape', () => {
    const links = extractLinks('[a](/how-to/x) [b](https://example.com) [c](#anchor) [d](./rel)')
    assert.deepEqual(
      links.map((l) => l.kind),
      ['internal', 'external', 'anchor', 'relative']
    )
  })

  // Counting image references as links is what inflated the figures this
  // migration was first scoped against.
  test('an image reference is not a link', () => {
    assert.equal(extractLinks('![Alt](/images/a.png)').length, 0)
  })
})

describe('extractImages', () => {
  test('keeps the authored alt text whole', () => {
    const [image] = extractImages('![A long descriptive sentence about the thing](/images/a.png)')
    assert.equal(image.alt, 'A long descriptive sentence about the thing')
    assert.equal(image.src, '/images/a.png')
  })
})
