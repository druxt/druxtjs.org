import Prism from 'prismjs'
import 'prismjs/components/prism-bash.js'
import 'prismjs/components/prism-json.js'
import 'prismjs/components/prism-yaml.js'
import 'prismjs/components/prism-nginx.js'

/** The Prism grammar for each language a code block can declare. */
const GRAMMARS = {
  js: 'javascript',
  javascript: 'javascript',
  sh: 'bash',
  bash: 'bash',
  shell: 'bash',
  vue: 'markup',
  html: 'markup',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  nginx: 'nginx',
}

const escape = (code) => code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Highlights code into the token markup assets/css/code.css colours.
 *
 * @param {string} code - The source.
 * @param {string} language - The block's declared language.
 * @returns {string} HTML, escaped when the language has no grammar.
 */
export const highlight = (code, language) => {
  const name = GRAMMARS[language]
  const grammar = name && Prism.languages[name]
  return grammar ? Prism.highlight(code, grammar, name) : escape(code)
}

const FENCED = /<pre><code class="language-([\w-]+)">([\s\S]*?)<\/code><\/pre>/g

const unescape = (html) =>
  html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')

/**
 * Highlights the fenced code blocks in rendered markdown.
 *
 * @param {string} html - HTML, as a markdown filter renders it.
 * @returns {string} The HTML, with each block that names a language that has
 *   a grammar marked up as a code block's own would be.
 */
export const highlightHtml = (html) =>
  html.replace(FENCED, (block, language, code) =>
    GRAMMARS[language]
      ? `<pre class="language-${language}"><code class="language-${language}">${highlight(unescape(code), language)}</code></pre>`
      : block
  )
