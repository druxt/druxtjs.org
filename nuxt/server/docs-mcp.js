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
 *
 * It answers the current revision, 2026-07-28, where a request carries its own
 * version and no handshake opens the exchange, and it still answers the three
 * revisions that do open with one.
 */

const crypto = require('crypto')

const { SECTION_ORDER, isChangelog, toAbsoluteUrls } = require('../lib/llms-full-txt')

/**
 * The revisions this server answers, newest first.
 *
 * 2026-07-28 took the handshake out. A request states its own version in
 * `_meta`, repeats that version, its method and a tool's name in headers, and
 * `server/discover` says what `initialize` used to. The three older revisions
 * still negotiate with `initialize`, so both ways in are kept.
 */
const PROTOCOL_VERSIONS = ['2026-07-28', '2025-06-18', '2025-03-26', '2024-11-05']
const CURRENT_VERSION = PROTOCOL_VERSIONS[0]
/** The revisions with a handshake. The first is the one `initialize` agrees on. */
const HANDSHAKE_VERSIONS = PROTOCOL_VERSIONS.slice(1)
/**
 * What a request stating no version is read as: the transport lets a server
 * that still answers clients older than the version header assume this one.
 */
const UNSTATED_VERSION = '2025-03-26'
/** The `_meta` keys the current revision carries a request and a result by. */
const META_VERSION = 'io.modelcontextprotocol/protocolVersion'
const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo'
const META_CAPABILITIES = 'io.modelcontextprotocol/clientCapabilities'
/** The headers and the body disagree, or a required header is missing. */
const HEADER_MISMATCH = -32020
const UNSUPPORTED_VERSION = -32022
const INVALID_PARAMS = -32602
const METHOD_NOT_FOUND = -32601
/**
 * How long a list may be held, and by whom. These answers are the documents the
 * site publishes to anyone, and they change when it deploys, so an hour in a
 * shared cache is the same hour the discovery documents ask for.
 */
const CACHEABLE = { ttlMs: 60 * 60 * 1000, cacheScope: 'public' }
const INSTRUCTIONS = 'Documentation for Druxt, the fully decoupled Drupal and Nuxt framework.'
/** The server's one name: at runtime, on its card and in server.json. */
const SERVER_NAME = 'org.druxtjs/docs'
/** Raise it with server.json, which is what publishes it to the registry. */
const SERVER_VERSION = '1.1.0'
const SERVER_INFO = { name: SERVER_NAME, version: SERVER_VERSION }
const MAX_BODY = 64 * 1024
const MAX_RESULTS = 10
const MAX_QUERY_WORDS = 20
const SNIPPET = 200

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // Mcp-Session-Id is allowed through for a browser client of an older
  // revision; this server has never minted one and ignores it.
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id',
}

const TOOLS = [
  {
    name: 'search_docs',
    title: 'Search the docs',
    description: 'Search the Druxt documentation and API reference. Returns matching pages with their paths.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The words to search for.' } },
      required: ['query'],
    },
    annotations: { title: 'Search the docs', readOnlyHint: true },
  },
  {
    name: 'list_docs',
    title: 'List the docs',
    description: 'List Druxt documentation pages, optionally for one section.',
    inputSchema: {
      type: 'object',
      properties: { section: { type: 'string', enum: SECTION_ORDER } },
    },
    annotations: { title: 'List the docs', readOnlyHint: true },
  },
  {
    name: 'get_doc',
    title: 'Read a docs page',
    description: 'Read one Druxt documentation page as markdown, by its path, such as /how-to/proxy.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'The page path.' } },
      required: ['path'],
    },
    annotations: { title: 'Read a docs page', readOnlyHint: true },
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
  // Every result says what kind it is and who answered, which the current
  // revision asks for and an older client passes over.
  const result = (value) => ({
    jsonrpc: '2.0',
    id,
    result: { resultType: 'complete', ...value, _meta: { [META_SERVER_INFO]: SERVER_INFO } },
  })
  const failure = (code, reason) => ({ jsonrpc: '2.0', id, error: { code, message: reason } })

  if (method === 'server/discover') {
    return result({
      supportedVersions: PROTOCOL_VERSIONS,
      capabilities: { tools: {} },
      instructions: INSTRUCTIONS,
      ...CACHEABLE,
    })
  }
  if (method === 'initialize') {
    // A handshake belongs to the revisions that have one, so it is answered
    // with the newest of those rather than with the version above them.
    return result({
      protocolVersion: HANDSHAKE_VERSIONS.includes(params.protocolVersion)
        ? params.protocolVersion
        : HANDSHAKE_VERSIONS[0],
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions: INSTRUCTIONS,
    })
  }
  // Dropped in the current revision, kept for a client that still sends it.
  if (method === 'ping') return result({})
  // The tools come back in the same order every time, so a client may cache them.
  if (method === 'tools/list') return result({ tools: TOOLS, ...CACHEABLE })
  if (method === 'tools/call') {
    if (!TOOLS.some((tool) => tool.name === params.name)) {
      return failure(INVALID_PARAMS, `Unknown tool: ${params.name}`)
    }
    return result(callTool(await corpus(), origin, params.name, params.arguments))
  }
  return failure(METHOD_NOT_FOUND, `Unknown method: ${method}`)
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

/** One header, which Node hands over as a list when it arrives twice. */
const headerOf = (req, name) => {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

/** A header value a client had to encode because it is not plain ASCII. */
const decodeHeaderValue = (value) => {
  const encoded = /^=\?base64\?([A-Za-z0-9+/]*={0,2})\?=$/.exec(value)
  return encoded ? Buffer.from(encoded[1], 'base64').toString('utf8') : value
}

/**
 * The revision a request speaks, or the error that turns it away.
 *
 * The current revision repeats the version, the method and a tool's name in
 * headers so that a proxy can route a request without reading its body. A
 * server has to hold the two to each other: if a gateway acts on the header
 * and the server acts on the body, a request that says one thing in each gets
 * one decision from each. A request stating no version at all comes from a
 * client older than the header and is read as the revision that brought in
 * this transport.
 *
 * @param {object} req - The request, for its headers.
 * @param {object} message - The parsed JSON-RPC request.
 * @returns {object} Either the version, or the error to answer with.
 */
const negotiate = (req, message) => {
  const meta = (message.params && message.params._meta) || {}
  const stated = meta[META_VERSION]
  const sent = headerOf(req, 'mcp-protocol-version')
  const invalid = (reason) => ({ error: { code: INVALID_PARAMS, message: reason } })
  // A version has to be a string to be compared with one, and a value such as
  // `{ "toString": null }` has no string at all: reading one out of it throws.
  if (stated !== undefined && typeof stated !== 'string') {
    return invalid(`_meta ${META_VERSION} must be a string.`)
  }
  if (!stated && !sent) return { version: UNSTATED_VERSION }
  const version = stated || sent
  if (!PROTOCOL_VERSIONS.includes(version)) {
    return {
      error: {
        code: UNSUPPORTED_VERSION,
        message: `This server does not speak ${version}.`,
        data: { requested: version, supported: PROTOCOL_VERSIONS },
      },
    }
  }
  const mismatch = (reason) => ({ error: { code: HEADER_MISMATCH, message: reason } })
  if (version !== CURRENT_VERSION) {
    // An older client sends the version as a header, after its handshake.
    return stated && sent && stated !== sent
      ? mismatch('The version in MCP-Protocol-Version and the one in _meta differ.')
      : { version }
  }
  if (sent !== version) {
    return mismatch('MCP-Protocol-Version is required, and must match the version in _meta.')
  }
  // The header is for whoever routes the request; the body is what this server
  // reads. A request that states its version only in the header has told the
  // proxy and not the server, and the field is required of it either way.
  if (!stated) return invalid(`_meta is missing ${META_VERSION}.`)
  if (headerOf(req, 'mcp-method') !== message.method) {
    return mismatch('Mcp-Method is required, and must match the method in the body.')
  }
  if (message.method === 'tools/call') {
    const name = headerOf(req, 'mcp-name')
    if (name === undefined || decodeHeaderValue(name) !== (message.params || {}).name) {
      return mismatch("Mcp-Name is required for tools/call, and must match the tool's name.")
    }
  }
  // The revision has a client state its capabilities on every request, as `{}`
  // when it has none. This server reads none of them, but a request without
  // the field is not one the revision describes.
  const capabilities = meta[META_CAPABILITIES]
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    return invalid(`_meta ${META_CAPABILITIES} is required, as {} for a client with none.`)
  }
  return { version }
}

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
    // Reading the request is inside the try with answering it, so that a
    // malformed one cannot throw past the handler, where the rejection would
    // take the process down and leave the request unanswered.
    if (message.id !== undefined) {
      const { error } = negotiate(req, message)
      // A client of the current revision probes with a current request and
      // reads the body of a 400 before it falls back: a protocol error in it
      // says the server is current and the request wrong, not the server old.
      if (error) return send(400, { jsonrpc: '2.0', id: message.id, error })
    }
    const answer = await respond(message, { corpus, origin })
    if (!answer) return send(202)
    // A method this server does not have answers 404, so a client can tell it
    // from a path that is no MCP endpoint at all.
    const missing = answer.error && answer.error.code === METHOD_NOT_FOUND
    return send(missing ? 404 : 200, answer)
  } catch (error) {
    log(`docs-mcp: ${error.message}`)
    return send(200, { jsonrpc: '2.0', id: message.id, error: { code: -32603, message: 'The documentation is not available right now.' } })
  }
}

/**
 * The server's discovery documents, for clients that find it before connecting.
 *
 * Public, read-only metadata, so any origin may read them and caches may keep
 * them for an hour. Tools are left out, as the Server Card extension requires.
 *
 * @param {string} origin - The origin the server answers on.
 * @returns {object} Which paths this serves, and the listener for them.
 */
const createMcpDiscovery = (origin) => {
  const card = `${origin}/mcp/server-card`
  const hostname = new URL(origin).hostname
  const documents = {
    '/mcp/server-card': {
      type: 'application/mcp-server-card+json',
      body: {
        $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
        name: SERVER_NAME,
        version: SERVER_VERSION,
        title: 'Druxt docs',
        description: 'Search and read the Druxt docs and API reference: Drupal and Nuxt, fully decoupled.',
        websiteUrl: `${origin}/mcp`,
        repository: { url: 'https://github.com/druxt/druxtjs.org', source: 'github', subfolder: 'nuxt/server' },
        icons: [{ src: `${origin}/icon.png`, mimeType: 'image/png', sizes: ['480x480'] }],
        remotes: [{ type: 'streamable-http', url: `${origin}/mcp`, supportedProtocolVersions: PROTOCOL_VERSIONS }],
      },
    },
    '/.well-known/ai-catalog.json': {
      type: 'application/ai-catalog+json',
      body: {
        specVersion: '1.0',
        entries: [
          { identifier: `urn:air:${hostname}:mcp:docs`, type: 'application/mcp-server-card+json', url: card },
        ],
      },
    },
  }
  const prepared = Object.fromEntries(
    Object.entries(documents).map(([path, { type, body }]) => {
      const text = JSON.stringify(body, null, 2)
      return [path, { type, text, etag: `"${crypto.createHash('sha1').update(text).digest('hex')}"` }]
    })
  )

  return {
    name: SERVER_NAME,
    serves: (method, pathname) =>
      ['GET', 'HEAD', 'OPTIONS'].includes(method) && Object.prototype.hasOwnProperty.call(prepared, pathname),
    handle: (req, res, pathname) => {
      const { type, text, etag } = prepared[pathname]
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
        'Access-Control-Expose-Headers': 'ETag',
        'Cache-Control': 'public, max-age=3600',
        ETag: etag,
      }
      // A browser's preflight, for a request that sends If-None-Match.
      if (req.method === 'OPTIONS') {
        res.writeHead(204, headers)
        return res.end()
      }
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, headers)
        return res.end()
      }
      res.writeHead(200, { ...headers, 'Content-Type': type })
      return res.end(req.method === 'HEAD' ? undefined : text)
    },
  }
}

module.exports = { SERVER_VERSION, createDocsMcp, createMcpDiscovery, isMcpRequest, searchDocs }
