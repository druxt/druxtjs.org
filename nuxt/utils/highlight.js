import Prism from 'prismjs'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-nginx'

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
