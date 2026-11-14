// The layouts a `layout` query parameter may name: the page alone, or the
// page in the site's own layout.
const LAYOUTS = { page: 'canvas-headless', site: 'default' }

/**
 * A page's layout. Framed, as Canvas's editor shows it, the page stands
 * alone. Anywhere else it has the site around it. `?layout=site` or
 * `?layout=page` picks either.
 */
export default function layout({ query, req }) {
  if (LAYOUTS[query.layout]) return LAYOUTS[query.layout]
  const framed = req ? req.headers['sec-fetch-dest'] === 'iframe' : window.self !== window.top
  return framed ? LAYOUTS.page : LAYOUTS.site
}
