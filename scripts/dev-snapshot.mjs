#!/usr/bin/env node
// Points the site at the latest Druxt development snapshot.
//
// Reads the `dev` dist-tag of every Druxt package, which must all name one
// build, and the druxt.js commit that build was published from, then writes
// both into the checkout: the packages into nuxt/package.json, the commit
// into docs-source.json as the API reference's `docgenRef`. The workflow
// that runs this relocks and pushes the result to the `dev-snapshot` branch.
//
// Usage: node scripts/dev-snapshot.mjs [--check]
//   --check  print the snapshot and change nothing.

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const PACKAGES = [
  'druxt',
  'druxt-blocks',
  'druxt-breadcrumb',
  'druxt-entity',
  'druxt-menu',
  'druxt-router',
  'druxt-schema',
  'druxt-site',
  'druxt-views',
]

/** One copy of Vue, or the build fails: taking `@dev` unfreezes the lockfile. */
const VUE = { vue: '2.7.16', 'vue-server-renderer': '2.7.16', 'vue-template-compiler': '2.7.16' }

const STAMP = /-dev\.(\d{14})$/

/**
 * The build the packages' `dev` tags share.
 *
 * @param {Record<string, string|undefined>} tags - Each package's `dev` version.
 * @returns {{ stamp: string, versions: Record<string, string> }} The build.
 */
export const snapshotOf = (tags) => {
  const missing = PACKAGES.filter((name) => !tags[name])
  if (missing.length) throw new Error(`No dev release of ${missing.join(', ')}`)
  const stamps = new Set(PACKAGES.map((name) => (STAMP.exec(tags[name]) || [])[1]))
  if (stamps.size !== 1 || stamps.has(undefined)) {
    throw new Error(
      `The dev tags are not all from the same build: ${PACKAGES.map((n) => tags[n]).join(', ')}`
    )
  }
  return {
    stamp: [...stamps][0],
    versions: Object.fromEntries(PACKAGES.map((name) => [name, tags[name]])),
  }
}

/**
 * nuxt/package.json with every Druxt package at the snapshot, one copy each.
 *
 * @param {object} pkg - The parsed package.json.
 * @param {Record<string, string>} versions - The snapshot's versions.
 * @returns {object} The updated package.json.
 */
export const applySnapshot = (pkg, versions) => ({
  ...pkg,
  dependencies: { ...pkg.dependencies, ...versions },
  resolutions: { ...pkg.resolutions, ...VUE, ...versions },
})

/**
 * docs-source.json generating the API reference at the snapshot's commit.
 *
 * `snapshot` has docgen run `changeset version --snapshot dev` first, so the
 * release notes include the changes not yet released, headed with the
 * version the site installs.
 *
 * @param {object} source - The parsed docs-source.json.
 * @param {string} sha - The druxt.js commit the snapshot was published from.
 * @param {string} stamp - The snapshot's build time, `YYYYMMDDhhmmss`.
 * @returns {object} The updated docs-source.json.
 */
export const applyDocs = (source, sha, stamp) => {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`Expected a full commit sha, got "${sha}"`)
  return { ...source, docgenRef: sha, snapshot: stamp }
}

/**
 * The druxt.js Release run that published a build, which names its commit.
 *
 * The run must have been going when the build was stamped, or it published
 * something else and its commit would be the wrong one.
 *
 * @param {Array<object>} runs - Successful Release runs on develop, newest first.
 * @param {string} stamp - The build's UTC timestamp, `YYYYMMDDhhmmss`.
 * @returns {string} The commit.
 */
export const commitFor = (runs, stamp) => {
  const at = Date.UTC(
    stamp.slice(0, 4),
    stamp.slice(4, 6) - 1,
    stamp.slice(6, 8),
    stamp.slice(8, 10),
    stamp.slice(10, 12),
    stamp.slice(12, 14)
  )
  const run = runs.find((r) => Date.parse(r.run_started_at) <= at && at <= Date.parse(r.updated_at))
  if (!run) throw new Error(`No druxt.js Release run was publishing at ${stamp}`)
  return run.head_sha
}

const getJson = async (url, headers = {}) => {
  const response = await fetch(url, { headers: { Accept: 'application/json', ...headers } })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.json()
}

/** The real sources: the npm registry and the GitHub API. */
export const sources = {
  devTag: async (name) =>
    (await getJson(`https://registry.npmjs.org/-/package/${name}/dist-tags`)).dev,
  releaseRuns: async () => {
    const token = process.env.GITHUB_TOKEN
    const runs = await getJson(
      'https://api.github.com/repos/druxt/druxt.js/actions/workflows/release.yml/runs?branch=develop&event=push&status=success&per_page=20',
      token ? { Authorization: `Bearer ${token}` } : {}
    )
    return runs.workflow_runs
  },
}

/**
 * Reads the snapshot and, unless checking, writes it into the checkout.
 *
 * @param {object} options - Options.
 * @param {string} options.root - The repository root.
 * @param {boolean} [options.check] - Change nothing.
 * @param {object} [options.from] - Where to read the snapshot, for tests.
 * @returns {Promise<{ stamp: string, sha: string, versions: Record<string, string> }>} The snapshot.
 */
export const main = async ({ root, check = false, from = sources }) => {
  const tags = Object.fromEntries(
    await Promise.all(PACKAGES.map(async (name) => [name, await from.devTag(name)]))
  )
  const { stamp, versions } = snapshotOf(tags)
  const sha = commitFor(await from.releaseRuns(), stamp)
  if (!check) {
    const pkgFile = `${root}/nuxt/package.json`
    const docsFile = `${root}/docs-source.json`
    const write = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
    write(pkgFile, applySnapshot(JSON.parse(readFileSync(pkgFile, 'utf8')), versions))
    write(docsFile, applyDocs(JSON.parse(readFileSync(docsFile, 'utf8')), sha, stamp))
  }
  return { stamp, sha, versions }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
  main({ root, check: process.argv.includes('--check') })
    .then(({ stamp, sha }) => console.log(`${stamp} ${sha}`))
    .catch((error) => {
      console.error(error.message)
      process.exit(1)
    })
}
