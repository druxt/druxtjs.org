#!/usr/bin/env node
// Makes the repository's GitHub Environments mirror Lagoon: one environment
// per Lagoon environment, pointing at its route, and nothing else. Lagoon
// never writes deployments to GitHub itself, so without this the Deployments
// panel fills with every branch an old workflow ever deployed.
//
//   lagoon raw --raw "$(node scripts/sync-environments.mjs --query druxtjs-org)" > lagoon.json
//   node scripts/sync-environments.mjs --lagoon lagoon.json --repo druxt/druxtjs.org [--dry-run]
//
// GITHUB_TOKEN creates deployments. Deleting an environment needs a token
// with repository administration; a token without it leaves the deletions
// listed and the exit code non-zero, so the gap shows.

import fs from 'node:fs'

const args = process.argv.slice(2)
const option = (name) => {
  const at = args.indexOf(name)
  return at === -1 ? null : args[at + 1]
}

if (option('--query')) {
  process.stdout.write(query(option('--query')))
  process.exit(0)
}

const repo = option('--repo')
const source = option('--lagoon')
const dryRun = args.includes('--dry-run')
if (!repo || !source) {
  console.error('usage: sync-environments.mjs --lagoon <file.json> --repo <owner/name> [--dry-run]')
  process.exit(2)
}
const token = process.env.GITHUB_TOKEN
if (!token) {
  console.error('GITHUB_TOKEN is not set')
  process.exit(2)
}

const lagoon = environmentsIn(JSON.parse(fs.readFileSync(source, 'utf8')))
const api = github(repo, token)

const existing = await api.list('environments', (page) => page.environments)
const wanted = new Map(lagoon.map((environment) => [environment.name, environment]))
const summary = []
let failed = 0

for (const environment of existing) {
  if (wanted.has(environment.name)) continue
  summary.push(['delete', environment.name, ''])
  if (dryRun) continue
  const response = await api.request(
    'DELETE',
    `environments/${encodeURIComponent(environment.name)}`
  )
  if (!response.ok) {
    failed += 1
    summary[summary.length - 1][2] =
      `failed: ${response.status} (an administration token is needed to delete)`
  }
}

for (const environment of lagoon) {
  const branch = await api.request('GET', `branches/${encodeURIComponent(environment.name)}`)
  if (!branch.ok) {
    summary.push(['skip', environment.name, 'no branch of that name on GitHub'])
    continue
  }
  if (!environment.url) {
    summary.push(['skip', environment.name, 'no route on Lagoon yet'])
    continue
  }
  const sha = branch.body.commit.sha
  const latest = await api.request(
    'GET',
    `deployments?environment=${encodeURIComponent(environment.name)}&per_page=1`
  )
  const current = latest.ok && latest.body[0]
  if (current && current.sha === sha && (await api.currentUrl(current.id)) === environment.url) {
    summary.push(['keep', environment.name, environment.url])
    continue
  }
  summary.push([
    current ? 'update' : 'create',
    environment.name,
    `${environment.url} at ${sha.slice(0, 8)}`,
  ])
  if (dryRun) continue
  const deployment = await api.request('POST', 'deployments', {
    ref: sha,
    environment: environment.name,
    description: 'Lagoon',
    auto_merge: false,
    required_contexts: [],
    transient_environment: !environment.production,
    production_environment: environment.production,
  })
  if (!deployment.ok) {
    failed += 1
    summary[summary.length - 1][2] =
      `failed: ${deployment.status} ${JSON.stringify(deployment.body.message || '')}`
    continue
  }
  const status = await api.request('POST', `deployments/${deployment.body.id}/statuses`, {
    state: 'success',
    environment_url: environment.url,
    description: 'Deployed by Lagoon',
    auto_inactive: true,
  })
  if (!status.ok) {
    failed += 1
    summary[summary.length - 1][2] =
      `failed: ${status.status} ${JSON.stringify(status.body.message || '')}`
  }
}

const width = Math.max(...summary.map(([, name]) => name.length), 4)
for (const [action, name, note] of summary) {
  console.log(`${action.padEnd(6)} ${name.padEnd(width)} ${note}`)
}
console.log(
  dryRun
    ? `dry run: nothing changed on ${repo}`
    : `${repo}: ${summary.length} environments considered, ${failed} failed`
)
process.exit(failed ? 1 : 0)

// The GraphQL query the Lagoon CLI runs. `routes` carries every route, the
// primary first; the frontend's is the one a GitHub environment should open.
function query(project) {
  return `query { projectByName(name: "${project}") { environments { name deployType environmentType routes } } }`
}

// Lagoon's answer, as `lagoon raw` prints it (the data object) or as the
// GraphQL envelope, to one list of { name, url, production }.
function environmentsIn(document) {
  const data = document.data || document
  const environments = (data.projectByName || data).environments
  if (!Array.isArray(environments)) throw new Error('No environments in the Lagoon document')
  return environments.map((environment) => ({
    name: environment.name,
    production: environment.environmentType === 'production',
    url: frontendRoute(environment.routes),
  }))
}

function frontendRoute(routes) {
  // A route that is not yet provisioned is listed as the string "undefined".
  const list = String(routes || '')
    .split(',')
    .map((route) => route.trim())
    .filter((route) => URL.canParse(route))
  const host = (route) => new URL(route).hostname
  return (
    list.find((route) => host(route).startsWith('nuxt.')) ||
    list.find((route) => !host(route).startsWith('nginx.') && !host(route).startsWith('api.')) ||
    list[0] ||
    null
  )
}

function github(repository, bearer) {
  const base = `https://api.github.com/repos/${repository}/`
  const headers = {
    Authorization: `Bearer ${bearer}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
  const request = async (method, path, body) => {
    const response = await fetch(base + path, {
      method,
      headers,
      body: body && JSON.stringify(body),
    })
    const text = await response.text()
    let parsed = {}
    try {
      parsed = text ? JSON.parse(text) : {}
    } catch {
      parsed = { message: text }
    }
    return { ok: response.ok, status: response.status, body: parsed }
  }
  const list = async (path, pick) => {
    const items = []
    for (let page = 1; page < 20; page += 1) {
      const response = await request('GET', `${path}?per_page=100&page=${page}`)
      if (!response.ok)
        throw new Error(`GET ${path}: ${response.status} ${response.body.message || ''}`)
      const batch = pick(response.body)
      items.push(...batch)
      if (batch.length < 100) break
    }
    return items
  }
  const currentUrl = async (deploymentId) => {
    const response = await request('GET', `deployments/${deploymentId}/statuses?per_page=1`)
    return response.ok && response.body[0] ? response.body[0].environment_url : null
  }
  return { request, list, currentUrl }
}
