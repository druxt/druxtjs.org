// The layouts a `layout` query parameter may name: the page alone, or the
// page in the site's own layout.
const LAYOUTS = { page: 'canvas-headless', site: 'default' }

// Canvas's read-only preview, as against its editor.
const PREVIEW = /^\/canvas\/preview(\/|$)/

const pathOf = (url) => {
  try {
    return new URL(url).pathname
  } catch (error) {
    return ''
  }
}

/**
 * The path of the page that frames this one. Canvas is reached through the
 * site, so the browser names it: in the request's referrer on the server,
 * and as the parent window in the browser.
 */
const framedBy = (req) => {
  if (req) return pathOf(req.headers.referer)
  try {
    return window.parent.location.pathname
  } catch (error) {
    return pathOf(document.referrer)
  }
}

/**
 * A page's layout. Framed by Canvas's editor, the page stands alone, so the
 * editor's outlines are the page's own. Framed by Canvas's preview, and
 * anywhere else, it has the site around it. `?layout=site` or `?layout=page`
 * picks either.
 */
export default function layout({ query, req }) {
  if (LAYOUTS[query.layout]) return LAYOUTS[query.layout]
  const framed = req ? req.headers['sec-fetch-dest'] === 'iframe' : window.self !== window.top
  return framed && !PREVIEW.test(framedBy(req)) ? LAYOUTS.page : LAYOUTS.site
}
