// A signed-in editor's browser has to stop sending hits however the sign-in
// finishes, including a refresh of the page it started on, where no route changes.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// The module is an ES module in a CommonJS package, which Node 16 can't import
// by its own name.
const source = fs.readFileSync(new URL('../nuxt/lib/analytics.js', import.meta.url), 'utf8')
const { isOptedOut, optOutEditors } = await import(
  `data:text/javascript,${encodeURIComponent(source)}`
)

const fakeWindow = () => {
  const items = {}
  return {
    location: { search: '' },
    localStorage: {
      getItem: (key) => (key in items ? items[key] : null),
      setItem: (key, value) => {
        items[key] = value
      },
      removeItem: (key) => {
        delete items[key]
      },
    },
  }
}

const fakeAuth = (loggedIn) => {
  let notify
  return {
    loggedIn,
    $storage: {
      watchState: (key, fn) => {
        assert.equal(key, 'loggedIn')
        notify = fn
      },
    },
    change: (value) => notify(value),
  }
}

describe('optOutEditors', () => {
  test('an editor already signed in stops sending hits', () => {
    const win = fakeWindow()
    optOutEditors(fakeAuth(true), win, 'G-TEST')
    assert.equal(win['ga-disable-G-TEST'], true)
    assert.equal(isOptedOut(win), true)
  })

  test('a sign-in with no navigation stops them too', () => {
    const win = fakeWindow()
    const auth = fakeAuth(false)
    optOutEditors(auth, win, 'G-TEST')
    assert.equal(isOptedOut(win), false)
    auth.change(true)
    assert.equal(win['ga-disable-G-TEST'], true)
    assert.equal(isOptedOut(win), true)
  })

  test('a visitor who never signs in keeps sending them', () => {
    const win = fakeWindow()
    const auth = fakeAuth(false)
    optOutEditors(auth, win, 'G-TEST')
    auth.change(false)
    assert.equal(win['ga-disable-G-TEST'], undefined)
  })

  test('a site without the auth module is left alone', () => {
    const win = fakeWindow()
    optOutEditors(undefined, win, 'G-TEST')
    assert.equal(isOptedOut(win), false)
  })
})
