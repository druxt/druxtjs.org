/**
 * A read-only Model Context Protocol server over the documentation, at `/mcp`,
 * so an AI tool can look a page up rather than guess from what it remembers.
 *
 * It reads the same corpus as `llms.txt`, so a page published in Drupal appears
 * here when it appears there. Public, stateless and without sessions: every
 * answer comes from documents the site already serves to anyone, so a request
 * needs no credentials. It answers with JSON, which the Streamable HTTP
 * transport allows, and has nothing to push, so GET is refused.
 */

const { SECTION_ORDER, isChangelog, toAbsoluteUrls } = require('../lib/llms-full-txt')

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const MAX_BODY = 64 * 1024
const MAX_RESULTS = 10
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

/** Counts how often a word appears in some text. */
const count = (text, word) => String(text || '').toLowerCase().split(word).length - 1

/** Pages for a query, best first: a word in the title counts most, then the description. */
const searchDocs = (docs, query) => {
  const words = [...new Set(String(query).toLowerCase().split(/\s+/).filter(Boolean))]
  if (!words.length) return []
  return pagesOf(docs)
    .map((doc) => ({
      doc,
      score: words.reduce(
        (sum, word) => sum + count(doc.title, word) * 10 + count(doc.description, word) * 5 + count(doc.content, word),
        0
      ),
    }))
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

/** Reads a request body, or null past the limit. */
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size <= MAX_BODY) chunks.push(chunk)
    })
    req.on('end', () => resolve(size > MAX_BODY ? null : Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

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
  const body = await readBody(req)
  if (body === null) return rpcError(413, -32600, 'Request too large.')
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

module.exports = { createDocsMcp, searchDocs }
