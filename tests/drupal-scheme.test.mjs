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

/**
 * A scheme whose Drupal endpoints answer however the test says.
 *
 * `login` and `logout` each take one answer, or a list read in turn so a
 * second attempt can differ from the first. An Error is thrown rather than
 * returned. `token` seeds a stored logout token, which is what a sign-in this
 * browser started leaves behind.
 */
const schemeWith = ({ login, logout = {}, token } = {}) => {
  store = token ? { 'drupal.logout_token': token } : {}
  const queues = { login: [].concat(login), logout: [].concat(logout) }
  const calls = []
  const $auth = {
    request: async ({ url }) => {
      const kind = String(url).includes('login') ? 'login' : 'logout'
      calls.push(kind)
      const queue = queues[kind]
      const answer = queue.length > 1 ? queue.shift() : queue[0]
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
  const scheme = new DrupalScheme($auth, { name: 'drupal' })
  scheme.calls = calls
  return scheme
}

/** A scheme whose Drupal login answers however the test says. */
const schemeWhere = (login) => schemeWith({ login })

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

// Refusing every open session locked people out of their own: a sign-in that
// reached Drupal and then abandoned the authorize redirect leaves a session
// behind, and every later attempt met the refusal with no way to clear it.
// The logout token tells the two apart, because Drupal issues one only at
// login, so holding it means this browser started the session.
describe('a session this browser started itself', () => {
  test('is ended and signed in again, rather than locking the sign-in out', async () => {
    const scheme = schemeWith({
      token: 'lt-1',
      login: [OPEN_SESSION, { logout_token: 'lt-2' }],
    })

    await scheme.login({ credentials: { name: 'editor', pass: 'x' } })

    assert.deepEqual(scheme.calls, ['login', 'logout', 'login'], 'ended, then signed in again')
    assert.equal(scheme.authorizeCalls.length, 1, 'and the authorize step runs')
    assert.equal(store['drupal.logout_token'], 'lt-2', 'on the new session’s token')
  })

  test('is told apart from a stranger’s by the token, not by the answer', async () => {
    const scheme = schemeWith({ login: OPEN_SESSION })

    await assert.rejects(
      () => scheme.login({ credentials: { name: 'editor', pass: 'x' } }),
      (error) => error.sessionInUse === true
    )
    assert.deepEqual(scheme.calls, ['login'], 'a session that is not ours is never ended')
    assert.equal(scheme.authorizeCalls.length, 0)
  })

  test('is refused, not retried forever, when it will not end', async () => {
    const scheme = schemeWith({ token: 'lt-1', login: OPEN_SESSION })

    await assert.rejects(
      () => scheme.login({ credentials: { name: 'editor', pass: 'x' } }),
      (error) => error.sessionInUse === true
    )
    assert.equal(scheme.authorizeCalls.length, 0, 'still nobody is authorized')
  })
})

// A token thrown away after a failure that never reached Drupal made the
// session look like a stranger's on the next attempt, which is the lockout
// again by another route.
describe('ending the Drupal session', () => {
  test('keeps the token when nothing answered', async () => {
    const scheme = schemeWith({ token: 'lt-1', logout: new Error('Network Error') })
    assert.equal(await scheme.drupalLogout(), false)
    assert.equal(store['drupal.logout_token'], 'lt-1', 'kept for another attempt')
  })

  test('drops the token once Drupal has answered, whatever it said', async () => {
    const ok = schemeWith({ token: 'lt-1' })
    assert.equal(await ok.drupalLogout(), true)
    assert.equal(store['drupal.logout_token'], undefined)

    const gone = schemeWith({ token: 'lt-1', logout: refusal(403, 'Not authenticated.') })
    assert.equal(await gone.drupalLogout(), true, 'an answer means the session is not there')
    assert.equal(store['drupal.logout_token'], undefined)
  })

  test('does nothing when there is no token to use', async () => {
    const scheme = schemeWith({ token: null })
    assert.equal(await scheme.drupalLogout(), false)
    assert.deepEqual(scheme.calls, [])
  })
})
