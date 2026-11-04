/**
 * The Umami mock: Drupal's Umami demo answered in the browser by
 * decoupled-drupal-mock, with no backend at all.
 *
 * The build writes the preset's dump and public files under `MOCK_ROOT`
 * (lib/mock-dump.js). Nothing loads until a reader picks the mock, and then
 * the engine and the dump load once and serve every card on the page.
 */

/** The origin the mock answers for, written into its links. It never reaches the network. */
export const MOCK_ORIGIN = 'https://umami.mock.invalid'

/** Where the build puts the dump and the files, on this site. */
export const MOCK_ROOT = '/_mock/umami'

let loading = null

// The engine, in the browser only. Nuxt makes `process.server` a constant, so
// the server bundle never parses the engine, whose numeric separators webpack
// 4's parser cannot read.
const engine = () =>
  process.server
    ? Promise.reject(new Error('The Umami mock runs in the browser.'))
    : import(/* webpackChunkName: "umami-mock" */ 'decoupled-drupal-mock')

/**
 * The engine over the Umami dump, loaded on first use.
 *
 * @returns {Promise<object>} The mock Drupal: `fetch`, `handle` and the rest.
 */
export const loadMock = () => {
  if (!loading) {
    loading = (async () => {
      const [{ createDrupal }, dump] = await Promise.all([
        engine(),
        fetch(`${MOCK_ROOT}/dump.json`).then((response) => {
          if (!response.ok) throw new Error(`${response.status} from ${MOCK_ROOT}/dump.json`)
          return response.json()
        }),
      ])
      return createDrupal(dump, { baseUrl: MOCK_ORIGIN })
    })()
    // A failed load is retried on the next use, not cached.
    loading.catch(() => {
      loading = null
    })
  }
  return loading
}

/** Whether a URL is one the mock answers. */
export const isMockUrl = (url) => String(url).startsWith(MOCK_ORIGIN)

/** `fetch`, answered by the mock. */
export const mockFetch = async (url, init) => (await loadMock()).fetch(url, init)

/** An axios adapter answered by the mock, for a runtime's own axios instance. */
export const mockAdapter = async () => {
  const [{ axiosAdapter }, drupal] = await Promise.all([
    engine(),
    loadMock(),
  ])
  return axiosAdapter(drupal, MOCK_ORIGIN)
}
