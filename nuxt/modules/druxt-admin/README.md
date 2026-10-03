# druxt-admin, the path test only

`proxy.js` and `lib/admin.js` are copied unchanged from `@druxt-contrib/admin`
at 7d3287d, until it is released. The site uses only `shouldProxy()`, which
says which paths are Drupal's: the proxying itself is done by the
`@nuxtjs/proxy` entry in `nuxt.config.js`, beside the site's other backend
paths, rather than by the package's own middleware.
