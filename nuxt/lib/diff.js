// The diff engine lives in @druxt-contrib/diff. Re-exported here so the
// site's components keep importing from '~/lib/diff'.
//
// ES modules, because the package is one: it declares `type: module`, so a
// `require` of it from Node fails. The app never noticed, since webpack
// resolves either, and the tests did.
export * from '@druxt-contrib/diff'
