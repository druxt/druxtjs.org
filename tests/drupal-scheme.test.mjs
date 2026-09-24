// The sign-in scheme's ordering. `Oauth2Scheme.login()` ends in
// `window.location.replace()`, so the authorize step is a navigation and
// nothing after it runs. Anything the sign-in must decide has to be decided
// before it is called, and these tests assert that it was not called at all
// when the sign-in is refused. A check placed after it is dead code that
// still reads like a fix.
//
// The scheme imports `~auth/runtime`, a webpack alias with no meaning to Node,
// so the module is loaded here with that import pointed at a stub.
//
//   node --test "tests/*.test.mjs"

import { describe, test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** The scheme, loaded with a stand-in for the auth-next runtime. */
const loadScheme = async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'drupal-scheme-'))
  writeFileSync(
    path.join(dir, 'runtime.mjs'),
    `export class Oauth2Scheme {
      constructor ($auth, options, ...defaults) {
        this.$auth = $auth
        this.options = Object.assign({}, ...defaults.reverse(), options)
        this.authorizeCalls = []
        this.logoutCalls = 0
      }
      get name () { return this.options.name }
      // The real one navigates away and never returns.
      async login (opts) { this.authorizeCalls.push(opts) }
      async logout () { this.logoutCalls += 1 }
    }`
  )
  const source = readFileSync(
    new URL('../nuxt/modules/druxt-auth/drupal-scheme.js', import.meta.url),
    'utf8'
  ).replace("from '~auth/runtime'", "from './runtime.mjs'")
  const file = path.join(dir, 'scheme.mjs')
  writeFileSync(file, source)
  const mod = await import(pathToFileURL(file).href)
  return { DrupalScheme: mod.default, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

const { DrupalScheme, cleanup } = await loadScheme()
process.on('exit', cleanup)

/** Drupal's answer to a JSON login, as axios reports it. */
const refusal = (status, message) => {
  const error = new Error(message)
  error.response = { status, data: { message } }
  return error
}

const OPEN_SESSION = refusal(403, 'This route can only be accessed by anonymous users.')
const WRONG = refusal(400, 'Sorry, unrecognized username or password.')

let store
let scheme

/** A scheme whose Drupal login answers however the test says. */
const schemeWhere = (answer) => {
  store = {}
  const $auth = {
    request: async () => {
      if (answer instanceof Error) throw answer
      return { data: answer }
    },
    $storage: {
      setUniversal: (key, value) => {
        store[key] = value
      },
      getUniversal: (key) => store[key],
      removeUniversal: (key) => delete store[key],
    },
  }
  return new DrupalScheme($auth, { name: 'drupal' })
}

beforeEach(() => {
  scheme = null
})

describe('signing in with credentials', () => {
  test('a session nobody else holds signs in, then goes to authorize', async () => {
    scheme = schemeWhere({ logout_token: 'lt-1' })
    await scheme.login({ credentials: { name: 'editor', pass: 'x' } })

    assert.equal(scheme.authorizeCalls.length, 1, 'the authorize step runs')
    assert.equal(store['drupal.logout_token'], 'lt-1', 'and the logout token is kept')
  })

  // The bug this file exists for: Drupal will not replace an open session, so
  // reusing it authorizes whoever left it there. The refusal has to come
  // before the redirect, because there is no after.
  test('a session somebody else left open is refused, and never authorized', async () => {
    scheme = schemeWhere(OPEN_SESSION)

    await assert.rejects(
      () => scheme.login({ credentials: { name: 'editor', pass: 'x' } }),
      (error) => {
        assert.equal(error.sessionInUse, true, 'the form can tell this apart')
        assert.match(error.message, /Sign out, then sign in again/)
        return true
      }
    )

    assert.equal(scheme.authorizeCalls.length, 0, 'no token is ever asked for')
  })

  test('a password Drupal rejects never reaches authorize either', async () => {
    scheme = schemeWhere(WRONG)
    await assert.rejects(() => scheme.login({ credentials: { name: 'editor', pass: 'no' } }))
    assert.equal(scheme.authorizeCalls.length, 0)
  })
})

describe('signing in without credentials', () => {
  test('is oauth2 on its own, with no Drupal login first', async () => {
    scheme = schemeWhere(OPEN_SESSION)
    await scheme.login()
    await scheme.login({ params: { prompt: 'login' } })

    assert.equal(scheme.authorizeCalls.length, 2, 'an open session is no obstacle here')
    assert.deepEqual(scheme.authorizeCalls[1], { params: { prompt: 'login' } })
  })
})

describe('drupalLogin', () => {
  test('says whether it reused a session rather than starting one', async () => {
    assert.equal(await schemeWhere({ logout_token: 'lt' }).drupalLogin({}), false)
    assert.equal(await schemeWhere(OPEN_SESSION).drupalLogin({}), true)
  })

  test('passes on a refusal that is not an open session', async () => {
    await assert.rejects(() => schemeWhere(WRONG).drupalLogin({}), /unrecognized username/)
  })
})
