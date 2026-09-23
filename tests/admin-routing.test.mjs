// Drupal's own screens are reached through the frontend's proxy, and the
// redirect module can take them away from an editor.
//
// `page.front` is `/admin/content`, because that is where an editor lands on
// the backend. The redirect module's route normalizer rewrites a request to
// its route's canonical URL, and for the front page that URL is `/`, which
// this site serves from Nuxt. So a signed-in editor asking for
// `/admin/content` was answered with a 301 to the documentation home page,
// and the administration screens were unreachable.
//
// `ignore_admin_path` stops the normalizer, and every other redirect, on a
// route marked `_admin_route`.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const settings = readFileSync(
  new URL('../drupal/config/sync/redirect.settings.yml', import.meta.url),
  'utf8'
)
const site = readFileSync(new URL('../drupal/config/sync/system.site.yml', import.meta.url), 'utf8')

/** One top-level key's value, from a flat configuration file. */
const valueOf = (yaml, key) => {
  const line = yaml.split('\n').find((l) => l.startsWith(`${key}:`))
  return line ? line.slice(key.length + 1).trim() : undefined
}

describe('the administration screens an editor reaches through the site', () => {
  test('the redirect module leaves admin paths alone', () => {
    assert.equal(valueOf(settings, 'ignore_admin_path'), 'true')
  })

  // The two settings are only a problem together, so the test says so: if
  // the front page moves off an admin path, this is worth revisiting rather
  // than being a rule nobody can explain.
  test('the front page is the admin path this protects', () => {
    const front = site.split('\n').find((l) => l.trim().startsWith('front:'))
    assert.match(front, /\/admin\//)
  })
})
