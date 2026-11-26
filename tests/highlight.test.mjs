// Code highlighting: a code block's own, the fenced blocks inside the HTML
// Drupal renders from a text block's markdown, and the site tools Prism's
// bash grammar does not know on its own.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const { highlight, highlightHtml } = await import('../nuxt/utils/highlight.js')

describe('highlight', () => {
  test('marks up a language it has a grammar for', () => {
    assert.match(
      highlight('<DruxtEntity type="node--article" />', 'vue'),
      /<span class="token tag">/
    )
  })

  test('escapes a language it has none for', () => {
    assert.equal(highlight('<b> & </b>', 'text'), '&lt;b&gt; &amp; &lt;/b&gt;')
  })
})

describe('the language names a block can carry in its class', () => {
  const Prism = createRequire(new URL('../nuxt/package.json', import.meta.url))('prismjs')

  for (const name of [
    'js',
    'javascript',
    'sh',
    'bash',
    'shell',
    'vue',
    'html',
    'json',
    'yaml',
    'yml',
    'nginx',
    'php',
  ]) {
    test(`${name} is a grammar Prism finds when it scans the page`, () => {
      assert.ok(Prism.languages[name], `Prism has no grammar named ${name}`)
    })
  }
})

describe('the site tools and PHP', () => {
  const tool = (name) => `<span class="token tool function">${name}</span>`

  test('colours drush and the other site tools as commands', () => {
    for (const name of ['drush', 'ddev', 'lagoon', 'npx']) {
      assert.ok(highlight(`${name} status`, 'sh').startsWith(tool(name)), name)
    }
  })

  test('colours a tool after a pipe or a separator', () => {
    assert.ok(highlight('ddev start && drush cr', 'sh').includes(tool('drush')))
  })

  test('leaves a tool name inside another word alone', () => {
    assert.ok(!highlight('cd my-drush-docs', 'sh').includes('token tool'))
  })

  test('highlights PHP', () => {
    assert.match(highlight("$config['x'] = getenv('Y');", 'php'), /token variable/)
  })
})

describe('highlightHtml', () => {
  const fenced =
    '<ol><li><p>Render it:</p><pre><code class="language-vue">&lt;Druxt module=&quot;entity&quot; :props-data=&quot;{ a: &#039;b&#039; }&quot; /&gt;\n</code></pre></li></ol>'

  test('highlights a fenced block, and names the language on the pre', () => {
    const html = highlightHtml(fenced)
    assert.match(
      html,
      /<pre class="language-vue"><code class="language-vue"><span class="token tag">/
    )
    assert.match(html, /^<ol><li><p>Render it:<\/p>/)
    assert.match(html, /<\/code><\/pre><\/li><\/ol>$/)
  })

  test('highlights the code itself, not its escaped form', () => {
    const html = highlightHtml(fenced)
    assert.doesNotMatch(html, /&amp;(lt|quot|#039);/)
    assert.match(html, /<span class="token attr-name">module<\/span>/)
  })

  test('keeps the text of the code as it was', () => {
    const text = (html) =>
      html
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&gt;/g, '>')
    assert.equal(text(highlightHtml(fenced)), text(fenced))
  })

  test('leaves a block with no grammar, or no language, as it was', () => {
    for (const html of [
      '<pre><code class="language-text">a &lt; b</code></pre>',
      '<pre><code>a &lt; b</code></pre>',
      '<p>No code.</p>',
    ]) {
      assert.equal(highlightHtml(html), html)
    }
  })

  test('highlights each block by its own language', () => {
    const html = highlightHtml(
      '<pre><code class="language-sh">npm run dev</code></pre><p>then</p><pre><code class="language-json">{"a": 1}</code></pre>'
    )
    assert.match(html, /<pre class="language-sh">/)
    assert.match(
      html,
      /<pre class="language-json"><code class="language-json"><span class="token punctuation">\{/
    )
  })
})
