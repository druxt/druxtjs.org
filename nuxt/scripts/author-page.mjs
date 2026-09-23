#!/usr/bin/env node
// Authors a documentation page as a draft over JSON:API, through DruxtClient.
//
//   node nuxt/scripts/author-page.mjs --document <ir.json> [--uuid <page>]
//     [--backend <url>] [--client-id <id>] [--scope <scope>] [--port <n>]
//
// The document is one page from the intermediate representation that
// scripts/build-ir.mjs writes: its title, description, section, weight, url
// and typed blocks. Every block becomes a paragraph, every run of blocks a
// layout section, and the page references them by revision, in order, in
// the draft state. With --uuid the page exists: it gets a new draft revision
// and its published revision stays live.
//
// The script signs in as a person: the authorization code grant with PKCE
// through the site's consumer, the redirect caught on a local listener. It
// holds no secret. DRUXT_TOKEN carries a token in instead.
//
// JSON:API has no transactions. When a write fails the script stops, exits
// 1 and prints every entity it created, so cleanup is a list, not a search.

import { createRequire } from 'node:module'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import process from 'node:process'

/** The section terms, by the section's machine name, as the backend's Sections class names them. */
export const SECTION_NAMES = {
  tutorials: 'Tutorials',
  'how-to': 'How-to guides',
  explanation: 'Concepts',
  modules: 'Modules',
}

/** The paragraph type for each block type. */
export const BUNDLES = {
  text: 'docs_text',
  code: 'docs_code',
  diagram: 'docs_diagram',
  callout: 'docs_callout',
  image: 'docs_image',
}

/** The text format the imported pages use. */
const FORMAT = 'docs_markdown'

/** The layouts a section may use, by how many blocks stand side by side. */
const SINGLE = { layout: 'layout_onecol', regions: ['content'] }
const COLUMNS = {
  2: { layout: 'layout_twocol', regions: ['first', 'second'] },
  3: { layout: 'layout_threecol_33_34_33', regions: ['first', 'second', 'third'] },
}

/**
 * The page's layout sections, as the importer computes them: a run of
 * blocks sharing a group stands side by side, and a run of ungrouped
 * blocks shares one single-column section.
 *
 * @param {object[]} blocks - The document's blocks.
 * @returns {{ layout: string, blocks: { index: number, region: string }[] }[]} The sections.
 */
export const layoutSections = (blocks) => {
  const runs = []
  blocks.forEach((block, index) => {
    const group = block.group || null
    const last = runs[runs.length - 1]
    if (last && last.group === group) last.indexes.push(index)
    else runs.push({ group, indexes: [index] })
  })
  return runs.map(({ group, indexes }) => {
    const shape = group === null || indexes.length === 1 ? SINGLE : COLUMNS[indexes.length]
    if (!shape) throw new Error(`Group "${group}" has ${indexes.length} blocks, and no layout has that many columns.`)
    return {
      layout: shape.layout,
      blocks: indexes.map((index, i) => ({ index, region: shape.regions[i] || shape.regions[0] })),
    }
  })
}

/**
 * A paragraph's layout_paragraphs settings, as JSON:API writes them.
 *
 * The field is a serialized column: JSON:API refuses a string for it and
 * serializes an array given under `value` itself. Reads come back flattened,
 * with the object at the top of the attribute.
 */
const behaviorSettings = (layout_paragraphs) => ({ value: { layout_paragraphs } })

/** A section paragraph: its layout, and no parent. */
export const sectionResource = (layout) => ({
  type: 'paragraph--docs_layout_section',
  attributes: {
    behavior_settings: behaviorSettings({ layout, config: { label: '' }, parent_uuid: '', region: '' }),
  },
})

/**
 * A block's paragraph, placed in its section.
 *
 * @param {object} block - The block, as the IR has it.
 * @param {string} sectionUuid - The section paragraph it sits in.
 * @param {string} region - The region within that section.
 * @returns {object} The JSON:API resource to create.
 */
export const blockResource = (block, sectionUuid, region) => {
  const type = BUNDLES[block.type]
  if (!type) throw new Error(`No paragraph type for a "${block.type}" block.`)
  if (block.type === 'image') throw new Error('Image blocks need a media upload, which this script does not make yet.')
  const attributes = {
    text: { field_text: { value: block.markdown, format: FORMAT } },
    code: { field_code: block.code, field_language: block.language },
    callout: { field_callout: { value: block.markdown, format: FORMAT }, field_callout_type: block.callout },
    diagram: { field_diagram: block.source, field_syntax: block.syntax, field_group: block.group || null },
  }[block.type]
  return {
    type: `paragraph--${type}`,
    attributes: {
      ...attributes,
      behavior_settings: behaviorSettings({ layout: '', config: {}, parent_uuid: sectionUuid, region }),
    },
  }
}

/**
 * The page, referencing its paragraphs by revision, in reading order.
 *
 * A new page carries everything the importer gives one. An existing page,
 * named by uuid, gets only what a draft revision changes: the content, the
 * title and the description. Its section and alias stay.
 *
 * @param {object} document - The IR document.
 * @param {{ type: string, id: string, revision: number }[]} references - The paragraphs, in order.
 * @param {string} sectionTerm - The section term's uuid.
 * @param {string} [uuid] - The existing page's uuid.
 * @returns {object} The JSON:API resource to create or update.
 */
export const pageResource = (document, references, sectionTerm, uuid) => {
  const resource = {
    type: 'node--doc_page',
    attributes: {
      title: document.title,
      field_description: document.description || '',
      moderation_state: 'draft',
    },
    relationships: {
      field_content: {
        data: references.map(({ type, id, revision }) => ({ type, id, meta: { target_revision_id: revision } })),
      },
    },
  }
  if (uuid) return { id: uuid, ...resource }
  Object.assign(resource.attributes, {
    field_weight: document.weight || 0,
    field_is_landing: Boolean(document.isLanding),
    field_source_path: document.source,
    path: { alias: document.url },
  })
  resource.relationships.field_section = { data: { type: 'taxonomy_term--documentation_section', id: sectionTerm } }
  return resource
}

/** A failed write, carrying what was created before it. */
export class AuthoringError extends Error {
  constructor(message, created, cause) {
    super(message)
    this.name = 'AuthoringError'
    this.created = created
    this.cause = cause
  }
}

/** A failed request in one line: the status, and what Drupal said about it. */
const describe = (cause) => {
  const errors = (((cause.response || {}).data || {}).errors || []).map((e) => e.detail).filter(Boolean)
  return [cause.message.split('\n')[0], ...errors].join(' | ')
}

/** The written resource's identity. Nodes name their revision `vid`; paragraphs `revision_id`. */
const identity = (response) => {
  const { type, id, attributes } = response.data.data
  return { type, id, revision: attributes.drupal_internal__revision_id ?? attributes.drupal_internal__vid }
}

/**
 * Writes the page and its paragraphs as a draft.
 *
 * Sections first, then their blocks, then the page: each write needs the
 * ids the one before it returned. On any failure the error names every
 * resource created so far.
 *
 * @param {object} client - A DruxtClient, signed in.
 * @param {object} document - The IR document.
 * @param {object} [options] - Options.
 * @param {string} [options.uuid] - An existing page to give a draft revision.
 * @returns {Promise<{ page: object, created: object[] }>} The page's identity and everything created.
 */
export const authorPage = async (client, document, { uuid } = {}) => {
  const sections = layoutSections(document.blocks)
  // Every block is checked before anything is written.
  sections.forEach(({ blocks }) => blocks.forEach(({ index, region }) => blockResource(document.blocks[index], '', region)))
  const term = uuid ? null : await sectionTerm(client, document.section)

  const created = []
  const write = async (resource) => {
    let response
    try {
      response = await client.createResource(resource)
    } catch (cause) {
      throw new AuthoringError(`Could not create ${resource.type}: ${describe(cause)}`, created, cause)
    }
    const made = identity(response)
    created.push(made)
    return made
  }

  const references = []
  for (const section of sections) {
    const made = await write(sectionResource(section.layout))
    references.push(made)
    for (const { index, region } of section.blocks) {
      references.push(await write(blockResource(document.blocks[index], made.id, region)))
    }
  }

  const resource = pageResource(document, references, term, uuid)
  let response
  try {
    response = uuid ? await client.updateResource(resource) : await client.createResource(resource)
  } catch (cause) {
    throw new AuthoringError(`Could not ${uuid ? 'update' : 'create'} the page: ${describe(cause)}`, created, cause)
  }
  return { page: identity(response), created }
}

/**
 * The documentation section's term, by the section's machine name.
 *
 * @param {object} client - A DruxtClient.
 * @param {string} section - The machine name, as the IR carries it.
 * @returns {Promise<string>} The term's uuid.
 */
export const sectionTerm = async (client, section) => {
  const name = SECTION_NAMES[section]
  if (!name) throw new Error(`"${section}" is not a documentation section.`)
  const collection = await client.getCollection('taxonomy_term--documentation_section', {
    'filter[name]': name,
    'fields[taxonomy_term--documentation_section]': 'name',
  })
  const term = (collection.data || [])[0]
  if (!term) throw new Error(`The backend has no "${name}" section term.`)
  return term.id
}

/** A PKCE verifier and its S256 challenge, base64url. */
export const pkcePair = (verifier = randomBytes(48).toString('base64url')) => ({
  verifier,
  challenge: createHash('sha256').update(verifier).digest('base64url'),
})

/**
 * The authorization URL, with the challenge and state.
 *
 * @param {object} options - Options.
 * @param {string} options.backend - The origin a browser reaches Drupal on.
 * @param {string} options.clientId - The consumer's client id.
 * @param {string} options.scope - The scope to request.
 * @param {string} options.redirectUri - The listener's registered redirect URI.
 * @param {string} options.challenge - The PKCE challenge.
 * @param {string} options.state - The state to echo.
 * @returns {string} The URL to open.
 */
export const authorizeUrl = ({ backend, clientId, scope, redirectUri, challenge, state }) =>
  `${backend}/oauth/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })}`

/**
 * Waits on the listener for the authorization redirect.
 *
 * @param {number} port - The port the registered redirect URI names.
 * @param {string} state - The state the redirect must echo.
 * @returns {Promise<string>} The authorization code.
 */
export const awaitCode = (port, state) =>
  new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`)
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const failure = url.searchParams.get('error')
      const code = url.searchParams.get('code')
      const ok = !failure && code && url.searchParams.get('state') === state
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(ok ? 'Signed in. You can close this tab.' : `Sign-in failed: ${failure || 'bad state'}`)
      server.close()
      if (ok) resolve(code)
      else reject(new Error(`The authorization redirect carried ${failure || 'a state that did not match'}.`))
    })
    server.on('error', reject)
    server.listen(port, '127.0.0.1')
  })

/**
 * Signs the client in as a person: opens the browser for the authorize
 * step, catches the redirect, exchanges the code, and sets the bearer on
 * the client. Whatever DRUXT_TOKEN holds is used instead.
 *
 * @param {object} client - A DruxtClient.
 * @param {object} options - Options.
 * @param {string} options.backend - The origin a browser reaches Drupal on.
 * @param {string} options.clientId - The consumer's client id.
 * @param {string} options.scope - The scope to request.
 * @param {number} options.port - The listener's port.
 * @param {Function} [options.log] - Logs a line.
 * @param {string} [options.token] - A token to use as is.
 * @returns {Promise<void>} Resolves once the client carries a token.
 */
export const signIn = async (client, { backend, clientId, scope, port, log = () => {}, token }) => {
  if (!token) {
    const { verifier, challenge } = pkcePair()
    const state = randomBytes(12).toString('base64url')
    const redirectUri = `http://localhost:${port}/callback`
    const url = authorizeUrl({ backend, clientId, scope, redirectUri, challenge, state })
    const waiting = awaitCode(port, state)
    log(`Sign in at: ${url}`)
    openBrowser(url)
    const code = await waiting
    const response = await client.axios.post(
      '/oauth/token',
      new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirectUri, code, code_verifier: verifier }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )
    token = response.data.access_token
  }
  client.addHeaders({ Authorization: `Bearer ${token}` })
}

/** Opens a URL in the person's browser, when there is one; the URL is printed either way. */
const openBrowser = (url) => {
  const opener = { darwin: 'open', win32: 'start' }[process.platform] || 'xdg-open'
  try {
    spawn(opener, [url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref()
  } catch (e) {
    // No browser here: the printed URL is the way in.
  }
}

/**
 * Checks a document has what authoring reads from it, and says what is missing.
 *
 * Sign-in opens a browser and waits for a person, so a document that cannot be
 * authored is rejected before that rather than after it, where the failure was
 * a TypeError from somewhere inside the block walk.
 *
 * @param {object} document - The parsed document.
 * @param {object} [options] - `{ uuid }`, set when revising an existing page.
 * @throws {Error} When a required field is missing or the wrong shape.
 */
export const assertDocument = (document, { uuid } = {}) => {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('The document must be a JSON object describing one page.')
  }
  if (!Array.isArray(document.blocks)) {
    // A whole intermediate representation is the near miss: it holds pages.
    const hint = Array.isArray(document.pages) ? ' This looks like a whole IR: pass one of its pages.' : ''
    throw new Error(`The document needs a "blocks" array.${hint}`)
  }
  if (!document.blocks.length) throw new Error('The document has no blocks to author.')
  if (typeof document.title !== 'string' || !document.title.trim()) {
    throw new Error('The document needs a "title".')
  }
  // A new page is filed under a section and lives at a path; a revision of an
  // existing page keeps both from the page it revises.
  if (!uuid) {
    for (const field of ['section', 'url']) {
      if (typeof document[field] !== 'string' || !document[field].trim()) {
        throw new Error(`A new page needs a "${field}". Pass --uuid to revise an existing page.`)
      }
    }
  }
}

/** The command line, as `--name value` pairs. */
export const parseArgs = (argv) => {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`)
    args[arg.slice(2)] = argv[i + 1]
    i += 1
  }
  return args
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (!args.document) throw new Error('--document <ir.json> is required.')
  const document = JSON.parse(readFileSync(args.document, 'utf8'))
  // Before the browser opens, so a bad document costs nobody a sign-in.
  assertDocument(document, { uuid: args.uuid })
  const backend = (args.backend || process.env.DRUXT_BASE_URL || 'http://127.0.0.1:8888').replace(/\/+$/, '')
  // druxt is the frontend's dependency: loaded here, so the pure parts above need nothing installed.
  const { DruxtClient } = createRequire(import.meta.url)('druxt')
  const client = new DruxtClient(backend)
  await signIn(client, {
    backend,
    clientId: args['client-id'] || process.env.DRUXT_CONSUMER_ID || 'druxtjs_org',
    scope: args.scope || 'editor',
    port: Number(args.port || 3939),
    token: process.env.DRUXT_TOKEN,
    log: (line) => console.log(line),
  })
  const { page, created } = await authorPage(client, document, { uuid: args.uuid })
  console.log(`${args.uuid ? 'Drafted a new revision of' : 'Created'} ${page.type} ${page.id} (revision ${page.revision}) with ${created.length} paragraphs, as a draft.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    if (error instanceof AuthoringError && error.created.length) {
      console.error('Created before the failure:')
      for (const { type, id } of error.created) console.error(`  ${type} ${id}`)
    }
    process.exit(1)
  })
}
