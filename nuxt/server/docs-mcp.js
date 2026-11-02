/**
 * A read-only Model Context Protocol server over the documentation, at `/mcp`,
 * so an AI tool can look a page up rather than guess from what it remembers.
 *
 * It reads the same corpus as `llms.txt`, so a page published in Drupal appears
 * here when it appears there. Public, stateless and without sessions: every
 * answer comes from documents the site already serves to anyone, so a request
 * needs no credentials. It answers with JSON, which the Streamable HTTP
 * transport allows, and has nothing to push, so a client's GET is refused.
 * The same path is also a page: a browser's GET goes on to it.
 */

const { SECTION_ORDER, isChangelog, toAbsoluteUrls } = require('../lib/llms-full-txt')

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const MAX_BODY = 64 * 1024
const MAX_RESULTS = 10
const MAX_QUERY_WORDS = 20
const SNIPPET = 200

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id',
}

const TOOLS = [
  {
    name: 'search_docs',
    description: 'Search the Druxt documentation and API reference. Returns matching pages with their paths.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The words to search for.' } },
      required: ['query'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_docs',
    description: 'List Druxt documentation pages, optionally for one section.',
    inputSchema: {
      type: 'object',
      properties: { section: { type: 'string', enum: SECTION_ORDER } },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_doc',
    description: 'Read one Druxt documentation page as markdown, by its path, such as /how-to/proxy.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'The page path.' } },
      required: ['path'],
    },
    annotations: { readOnlyHint: true },
  },
]

/** The pages on offer: guide and reference pages with a body, as in llms-full.txt. */
const pagesOf = (docs) =>
  docs.filter((doc) => SECTION_ORDER.includes(doc.section) && (doc.content || '').trim() && !isChangelog(doc.route))

/** Words a question is made of, which say nothing about the page it wants. */
const STOP_WORDS = new Set(
  'a an and are can do does for from how i in is it my of on or the to use using what when where which with you your'.split(' ')
)

/** The lowercase words in some text, keeping dots and hyphens inside a word. */
const wordsIn = (value) => String(value || '').toLowerCase().match(/[\p{L}\p{N}]+(?:[.-][\p{L}\p{N}]+)*/gu) || []

/**
 * A word without its common English endings, so "theming" finds "Theme" and
 * "caching" finds "Cache".
 */
const stem = (word) => {
  const bare = word.replace(/(?:ing|ed|es|s)$/, '').replace(/e$/, '')
  return bare.length >= 3 ? bare : word
}

/** How often a word is in a page's text, in any of its forms. */
const countIn = (words, word) => {
  const wanted = stem(word)
  return words.filter((candidate) => candidate === word || stem(candidate) === wanted).length
}

/**
 * Pages for a query, best first.
 *
 * A guide's title is the strongest signal. A page matching more of the query
 * beats one repeating a single word, and repeats count less each time, so a
 * long reference page can't win by length.
 */
const searchDocs = (docs, query) => {
  const all = wordsIn(query)
  // A search walks every page for every word, on the server's only thread.
  const words = [...new Set(all.filter((word) => !STOP_WORDS.has(word)))].slice(0, MAX_QUERY_WORDS)
  if (!words.length) return []
  return pagesOf(docs)
    .map((doc) => {
      const title = wordsIn(doc.title)
      const description = wordsIn(doc.description)
      const content = wordsIn(doc.content)
      let score = 0
      let matched = 0
      for (const word of words) {
        const inTitle = countIn(title, word)
        const inDescription = countIn(description, word)
        const inContent = countIn(content, word)
        if (inTitle + inDescription + inContent) matched += 1
        score += inTitle * 10 + inDescription * 4 + Math.log2(1 + inContent)
      }
      // Guides answer questions. Reference pages rank behind them on a tie.
      const guide = doc.section === 'api' ? 1 : 1.5
      return { doc, score: score * guide * (matched / words.length) ** 2 }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ doc }) => doc)
}

const summary = (doc) =>
  `- ${doc.route}: ${doc.title}${doc.description ? `. ${String(doc.description).slice(0, SNIPPET)}` : ''}`

const text = (value, isError = false) => ({
  content: [{ type: 'text', text: value }],
  ...(isError ? { isError: true } : {}),
})

const callTool = (docs, origin, name, args = {}) => {
  if (name === 'search_docs') {
    const found = searchDocs(docs, args.query || '')
    return text(found.length ? found.map(summary).join('\n') : 'No pages match.')
  }
  if (name === 'list_docs') {
    const pages = pagesOf(docs).filter((doc) => !args.section || doc.section === args.section)
    return text(pages.map(summary).join('\n') || 'No pages in that section.')
  }
  const wanted = `/${String(args.path || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/+|\/+$/g, '')}`
  const doc = pagesOf(docs).find((page) => page.route === wanted)
  if (!doc) return text(`No page at ${wanted}. Use search_docs to find one.`, true)
  return text(`# ${doc.title}\n\nSource: ${origin}${doc.route}\n\n${toAbsoluteUrls(doc.content, origin)}`)
}

/**
 * Answer one JSON-RPC message.
 *
 * @param {object} message - The request.
 * @param {object} options - Options.
 * @param {Function} options.corpus - Resolves to the documents.
 * @param {string} options.origin - The origin links are written against.
 * @returns {Promise<object|null>} The response, or null for a notification.
 */
const respond = async (message, { corpus, origin }) => {
  const { id, method, params = {} } = message
  if (id === undefined) return null
  const result = (value) => ({ jsonrpc: '2.0', id, result: value })
  const failure = (code, reason) => ({ jsonrpc: '2.0', id, error: { code, message: reason } })

  if (method === 'initialize') {
    return result({
      protocolVersion: PROTOCOL_VERSIONS.includes(params.protocolVersion)
        ? params.protocolVersion
        : PROTOCOL_VERSIONS[0],
      capabilities: { tools: {} },
      serverInfo: { name: 'druxt-docs', version: '1.0.0' },
      instructions: 'Documentation for Druxt, the fully decoupled Drupal and Nuxt framework.',
    })
  }
  if (method === 'ping') return result({})
  if (method === 'tools/list') return result({ tools: TOOLS })
  if (method === 'tools/call') {
    if (!TOOLS.some((tool) => tool.name === params.name)) return failure(-32602, `Unknown tool: ${params.name}`)
    return result(callTool(await corpus(), origin, params.name, params.arguments))
  }
  return failure(-32601, `Unknown method: ${method}`)
}

/**
 * Reads a request body, or null as soon as it passes the limit.
 *
 * Rejects when the client aborts. Past the limit it stops collecting, and what
 * still arrives is discarded while the answer goes out.
 */
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) resolve(null)
      else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
    req.on('aborted', () => reject(new Error('The client aborted the request.')))
  })

/**
 * Whether a request is for the server, not the page at the same path.
 *
 * @param {object} req - The request.
 * @returns {boolean} False for a GET or HEAD that isn't asking for an event stream.
 */
const isMcpRequest = (req) =>
  !['GET', 'HEAD'].includes(req.method) || /text\/event-stream/i.test(String(req.headers.accept || ''))

/**
 * The request handler for `/mcp`.
 *
 * @param {object} options - Options.
 * @param {Function} options.corpus - Resolves to the documents.
 * @param {string} options.origin - The origin links are written against.
 * @param {Function} [options.log] - Logs a failure.
 * @returns {Function} An HTTP request listener.
 */
const createDocsMcp = ({ corpus, origin, log = () => {} }) => async (req, res) => {
  const send = (status, body) => {
    const payload = body === undefined ? undefined : JSON.stringify(body)
    res.writeHead(status, {
      ...CORS,
      'Cache-Control': 'no-store',
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    })
    res.end(payload)
  }
  const rpcError = (status, code, reason) => send(status, { jsonrpc: '2.0', id: null, error: { code, message: reason } })

  if (req.method === 'OPTIONS') return send(204)
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return rpcError(405, -32000, 'This server answers POST only.')
  }
  let body
  try {
    body = await readBody(req)
  } catch (error) {
    // Nobody is left to answer.
    log(`docs-mcp: ${error.message}`)
    return res.destroy()
  }
  if (body === null) {
    res.setHeader('Connection', 'close')
    return rpcError(413, -32600, 'Request too large.')
  }
  let message
  try {
    message = JSON.parse(body)
  } catch (e) {
    return rpcError(400, -32700, 'Not JSON.')
  }
  if (!message || Array.isArray(message) || message.jsonrpc !== '2.0') {
    return rpcError(400, -32600, 'Send one JSON-RPC 2.0 message.')
  }
  try {
    const answer = await respond(message, { corpus, origin })
    return answer ? send(200, answer) : send(202)
  } catch (error) {
    log(`docs-mcp: ${error.message}`)
    return send(200, { jsonrpc: '2.0', id: message.id, error: { code: -32603, message: 'The documentation is not available right now.' } })
  }
}

module.exports = { createDocsMcp, isMcpRequest, searchDocs }
