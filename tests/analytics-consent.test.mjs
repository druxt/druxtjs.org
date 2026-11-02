// Opt-in means nothing from Google before the reader says yes, so the inline
// snippet runs here against a fake browser and the script tag is what's counted.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../nuxt/lib/analytics.js', import.meta.url), 'utf8')
const { analyticsSnippet, readConsent, setConsent } = await import(
  `data:text/javascript,${encodeURIComponent(source)}`
)

const ID = 'G-TEST'

const browser = ({ hostname = 'druxtjs.org', search = '', stored = {}, blocked = false } = {}) => {
  const items = { ...stored }
  const refuse = () => {
    throw new Error('blocked')
  }
  const scripts = []
  const win = {
    location: { hostname, search, pathname: '/how-to/proxy' },
    localStorage: blocked
      ? { getItem: refuse, setItem: refuse, removeItem: refuse }
      : {
          getItem: (key) => (key in items ? items[key] : null),
          setItem: (key, value) => {
            items[key] = String(value)
          },
          removeItem: (key) => {
            delete items[key]
          },
        },
    document: {
      cookie: '',
      createElement: () => ({}),
      head: { appendChild: (el) => scripts.push(el.src) },
    },
  }
  win.window = win
  const context = vm.createContext(win)
  const run = () => vm.runInContext(analyticsSnippet(ID, "'how-to'"), context)
  return { win, items, scripts, run }
}

const configs = (win) => (win.dataLayer || []).filter((args) => args[0] === 'config')

describe('the analytics snippet', () => {
  test('loads nothing from Google before a choice', () => {
    const { win, scripts, run } = browser()
    run()
    assert.deepEqual(scripts, [])
    assert.equal(win.gtag, undefined)
    assert.equal(win.dataLayer, undefined)
  })

  test('loads nothing after a decline', () => {
    const { win, scripts, run } = browser({ stored: { druxt_consent: 'denied' } })
    run()
    assert.deepEqual(scripts, [])
    assert.equal(win.gtag, undefined)
  })

  test('a corrupt stored choice counts as no choice', () => {
    const { win, scripts, run } = browser({ stored: { druxt_consent: 'yes' } })
    run()
    assert.deepEqual(scripts, [])
    assert.equal(readConsent(win), null)
  })

  test('loads the tag once and configures every page after a yes', () => {
    const { win, scripts, run } = browser({ stored: { druxt_consent: 'granted' } })
    run()
    run()
    assert.deepEqual(scripts, [`https://www.googletagmanager.com/gtag/js?id=${ID}`])
    assert.equal(configs(win).length, 2)
    assert.equal(configs(win)[0][2].doc_type, 'how-to')
  })

  test('a host that is not the site sends nothing, even after a yes', () => {
    const { scripts, run } = browser({
      hostname: 'nuxt.main.example.io',
      stored: { druxt_consent: 'granted' },
    })
    run()
    assert.deepEqual(scripts, [])
  })

  test('someone working on the site sends nothing, even after a yes', () => {
    const { scripts, run } = browser({ stored: { druxt_consent: 'granted', druxt_no_track: '1' } })
    run()
    assert.deepEqual(scripts, [])
  })
})

describe('setConsent', () => {
  test('a yes starts measuring this page straight away', () => {
    const { win, items, scripts, run } = browser()
    run()
    setConsent(win, 'granted', ID)
    assert.equal(items.druxt_consent, 'granted')
    assert.equal(scripts.length, 1)
    assert.equal(configs(win).length, 1)
    assert.equal(win[`ga-disable-${ID}`], false)
  })

  test('a yes holds for the visit when storage is blocked', () => {
    const { win, scripts, run } = browser({ blocked: true })
    run()
    setConsent(win, 'granted', ID)
    run()
    assert.equal(scripts.length, 1)
    assert.equal(configs(win).length, 2)
    assert.equal(readConsent(win), 'granted')
  })

  test('taking it back stops the tag and removes its cookies', () => {
    const { win, items, run } = browser({ stored: { druxt_consent: 'granted' } })
    run()
    const written = []
    Object.defineProperty(win.document, 'cookie', {
      get: () => '_ga=GA1.1.1; _ga_TEST=GS1; druxt-workspace=x',
      set: (value) => {
        written.push(value)
      },
    })
    setConsent(win, 'denied', ID)
    assert.equal(items.druxt_consent, 'denied')
    assert.equal(win[`ga-disable-${ID}`], true)
    assert.equal(win.gtag, undefined)
    assert.ok(written.some((c) => c.startsWith('_ga=;') && c.includes('domain=.druxtjs.org')))
    assert.ok(written.some((c) => c.startsWith('_ga_TEST=;')))
    assert.ok(!written.some((c) => c.startsWith('druxt-workspace')))
  })

  test('a no holds on this page and after a reload when its write fails', () => {
    const { win, items, scripts, run } = browser({ stored: { druxt_consent: 'granted' } })
    run()
    win.localStorage.setItem = () => {
      throw new Error('full')
    }
    setConsent(win, 'denied', ID)
    run()
    assert.equal(scripts.length, 1)
    assert.equal(win.gtag, undefined)
    assert.equal(items.druxt_consent, undefined)
  })

  test('a page view after taking it back sends nothing', () => {
    const { win, scripts, run } = browser({ stored: { druxt_consent: 'granted' } })
    run()
    setConsent(win, 'denied', ID)
    const before = win.dataLayer.length
    run()
    assert.equal(win.dataLayer.length, before)
    assert.equal(scripts.length, 1)
  })
})
