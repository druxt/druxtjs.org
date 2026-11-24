/**
 * The mocks: Drupal sites answered in the browser by decoupled-drupal-mock,
 * with no backend at all. One per preset: Drupal's Umami demo, and Drupal
 * CMS's Dashi, Haven and Mercury site templates.
 *
 * The build writes each preset's dump and public files under its root
 * (scripts/mock-dump.mjs). Nothing loads until a reader picks a mock, and
 * then the engine and that preset's dump load once and serve every card on
 * the page.
 */

/** The presets, by the name each one's package ends with. */
export const MOCK_PRESETS = ['umami', 'dashi', 'haven', 'mercury']

/** The origin a preset answers for, written into its links. It never reaches the network. */
export const mockOrigin = (preset) => `https://${preset}.mock.invalid`

/** Where the build puts a preset's dump and files, on this site. */
export const mockRoot = (preset) => `/_mock/${preset}`

/** The Umami mock's origin and root, the first mock the playground had. */
export const MOCK_ORIGIN = mockOrigin('umami')
export const MOCK_ROOT = mockRoot('umami')

const loading = {}

// The engine, in the browser only. Nuxt makes `process.server` a constant, so
// the server bundle never parses the engine, whose numeric separators webpack
// 4's parser cannot read.
const engine = () =>
  process.server
    ? Promise.reject(new Error('The mocks run in the browser.'))
    : import(/* webpackChunkName: "drupal-mock" */ 'decoupled-drupal-mock')

/**
 * The engine over a preset's dump, loaded on first use.
 *
 * @param {string} [preset] - The preset, `umami` when unset.
 * @returns {Promise<object>} The mock Drupal: `fetch`, `handle` and the rest.
 */
export const loadMock = (preset = 'umami') => {
  if (!MOCK_PRESETS.includes(preset)) return Promise.reject(new Error(`No mock named ${preset}.`))
  if (!loading[preset]) {
    const root = mockRoot(preset)
    loading[preset] = (async () => {
      const [{ createDrupal }, dump] = await Promise.all([
        engine(),
        fetch(`${root}/dump.json`).then((response) => {
          if (!response.ok) throw new Error(`${response.status} from ${root}/dump.json`)
          return response.json()
        }),
      ])
      return createDrupal(dump, { baseUrl: mockOrigin(preset) })
    })()
    // A failed load is retried on the next use, not cached.
    loading[preset].catch(() => {
      delete loading[preset]
    })
  }
  return loading[preset]
}

/** The preset a URL belongs to, or null for a URL no mock answers. */
export const mockPresetOf = (url) => {
  const match = String(url).match(/^https:\/\/([a-z]+)\.mock\.invalid(?=[/?#]|$)/)
  return match && MOCK_PRESETS.includes(match[1]) ? match[1] : null
}

/** Whether a URL is one a mock answers. */
export const isMockUrl = (url) => !!mockPresetOf(url)

/** `fetch`, answered by the mock the URL names. */
export const mockFetch = async (url, init) => (await loadMock(mockPresetOf(url))).fetch(url, init)

/**
 * An axios adapter answered by a mock, for a runtime's own axios instance.
 *
 * @param {string} [preset] - The preset, `umami` when unset.
 * @returns {Promise<Function>} The adapter.
 */
export const mockAdapter = async (preset = 'umami') => {
  const [{ axiosAdapter }, drupal] = await Promise.all([
    engine(),
    loadMock(preset),
  ])
  return axiosAdapter(drupal, mockOrigin(preset))
}
