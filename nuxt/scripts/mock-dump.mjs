/**
 * Writes the Umami mock into static/_mock/umami/: the preset's dump as one
 * JSON file, and its public files where the dump's file URLs point. The
 * playground's "Umami mock" backend loads them in the browser
 * (utils/mock-backend.js).
 *
 * Skipped when the files already match the installed preset's version.
 *
 * Usage: node scripts/mock-dump.mjs <static dir>
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { dir, load } from 'decoupled-drupal-mock-umami'

const require = createRequire(import.meta.url)
const { version } = require('decoupled-drupal-mock-umami/package.json')

const out = path.join(process.argv[2] || 'static', '_mock', 'umami')
const stamp = path.join(out, 'version.txt')

if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === version) {
  console.log(`Umami mock ${version} already in ${out}`)
} else {
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'dump.json'), JSON.stringify(load()))
  fs.cpSync(path.join(dir, 'files'), path.join(out, 'sites', 'default', 'files'), { recursive: true })
  fs.writeFileSync(stamp, version)
  console.log(`Umami mock ${version} written to ${out}`)
}
