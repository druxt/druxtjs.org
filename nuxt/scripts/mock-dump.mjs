/**
 * Writes each mock into static/_mock/<preset>/: the preset's dump as one
 * JSON file, and its public files where the dump's file URLs point. The
 * playground's mocked backends load them in the browser
 * (utils/mock-backend.js).
 *
 * A preset is skipped when its files already match its installed version.
 *
 * Usage: node scripts/mock-dump.mjs <static dir>
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { MOCK_PRESETS } from '../utils/mock-backend.js'

const require = createRequire(import.meta.url)
const root = path.join(process.argv[2] || 'static', '_mock')

for (const preset of MOCK_PRESETS) {
  const name = `decoupled-drupal-mock-${preset}`
  const { dir, load } = await import(name)
  const { version } = require(`${name}/package.json`)
  const out = path.join(root, preset)
  const stamp = path.join(out, 'version.txt')

  if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === version) {
    console.log(`${preset} mock ${version} already in ${out}`)
    continue
  }
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'dump.json'), JSON.stringify(load()))
  fs.cpSync(path.join(dir, 'files'), path.join(out, 'sites', 'default', 'files'), { recursive: true })
  fs.writeFileSync(stamp, version)
  console.log(`${preset} mock ${version} written to ${out}`)
}
