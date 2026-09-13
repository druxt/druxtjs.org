// Every page Drupal holds renders through the frontend: 200, its title as
// the page heading, and a heading for each table of contents entry.
//
//   node tests/frontend-smoke.mjs [frontend] [backend]
//
// Defaults to the local servers: the frontend on 3000, Drupal on 8899.

import http from 'node:http'
import https from 'node:https'

const frontend = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
const backend = (process.argv[3] || 'http://127.0.0.1:8899').replace(/\/$/, '')

// Node 16, which Nuxt 2 needs, has no global fetch.
const fetch = (url, { headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http
    client
      .get(url, { headers }, (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () =>
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => body,
            json: async () => JSON.parse(body),
          }),
        )
      })
      .on('error', reject)
  })

const decode = (text) =>
  text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")

const pages = async () => {
  const found = []
  let url = `${backend}/jsonapi/node/doc_page?fields[node--doc_page]=title,path,field_toc&page[limit]=50`
  while (url) {
    const response = await fetch(url, { headers: { Accept: 'application/vnd.api+json' } })
    if (!response.ok) throw new Error(`${url}: ${response.status}`)
    const body = await response.json()
    for (const { attributes } of body.data) {
      found.push({ title: attributes.title, path: attributes.path.alias, toc: attributes.field_toc || [] })
    }
    url = body.links?.next?.href
  }
  return found
}

const failures = []
const all = await pages()
for (const page of all) {
  // Modules pages still render from docgen's markdown.
  if (page.path.startsWith('/modules')) continue
  const response = await fetch(frontend + page.path, { redirect: 'manual' })
  const html = await response.text()
  const problems = []
  if (response.status !== 200) problems.push(`status ${response.status}`)
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  const heading = h1 ? decode(h1[1].replace(/<[^>]+>/g, '').trim()) : null
  if (heading !== page.title) problems.push(`h1 ${JSON.stringify(heading)}, expected ${JSON.stringify(page.title)}`)
  const missing = page.toc.filter((entry) => !html.includes(`id="${entry.id}"`)).map((entry) => entry.id)
  if (missing.length) problems.push(`no heading for ${missing.join(', ')}`)
  if (problems.length) failures.push(`${page.path}: ${problems.join('; ')}`)
}

const checked = all.filter((page) => !page.path.startsWith('/modules')).length
console.log(`${checked - failures.length}/${checked} pages render`)
for (const failure of failures) console.log(`FAIL ${failure}`)
process.exit(failures.length ? 1 : 0)
