import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PREVIEW_INCLUDE, previewRequest, previewRoute } = require('../nuxt/lib/node-preview.js')
const { HEADER } = require('../nuxt/lib/workspace.js')

describe('previewRoute', () => {
  it("puts the site's page on the module's route, and leaves every other route alone", () => {
    const routes = [
      { name: 'how-to-slug', path: '/how-to/:slug', component: 'pages/how-to/_.vue' },
      {
        name: 'druxt-node-preview',
        path: '/druxt/node/preview',
        component: '.nuxt/components/druxt-node-preview-page.vue',
      },
    ]
    const result = previewRoute(routes, '~/components/app/NodePreviewPage.vue')
    assert.equal(result, routes)
    assert.equal(routes[1].component, '~/components/app/NodePreviewPage.vue')
    assert.equal(routes[1].path, '/druxt/node/preview')
    assert.equal(routes[0].component, 'pages/how-to/_.vue')
  })

  it('does nothing without the module', () => {
    const routes = [{ name: 'index', path: '/', component: 'pages/index.vue' }]
    assert.deepEqual(previewRoute(routes, 'x'), [
      { name: 'index', path: '/', component: 'pages/index.vue' },
    ])
  })
})

describe('previewRequest', () => {
  const endpoint = '/jsonapi/node/doc_page/0039a826-1e00-43ad-aa6a-6bbf4c6b6fba/preview'

  it('asks for the document with the session, and the includes the site renders', () => {
    const { url, init } = previewRequest(endpoint, {
      include: ['field_content', 'field_content.field_media'],
    })
    assert.equal(url, endpoint + '?include=field_content,field_content.field_media')
    assert.equal(init.credentials, 'include')
    assert.equal(init.headers.Accept, 'application/vnd.api+json')
    assert.equal(HEADER in init.headers, false)
  })

  it('appends the includes to a query the endpoint already has', () => {
    const { url } = previewRequest(endpoint + '?resourceVersion=id%3A1', {
      include: ['field_content'],
    })
    assert.equal(url, endpoint + '?resourceVersion=id%3A1&include=field_content')
  })

  it('carries the editor workspace as the header the interceptor would send', () => {
    const { init } = previewRequest(endpoint, { workspace: 'stage' })
    assert.equal(init.headers[HEADER], 'stage')
  })

  it('includes what the site renders, paragraphs and their media', () => {
    assert.deepEqual(PREVIEW_INCLUDE, ['field_content', 'field_content.field_media'])
  })

  it('sends no header without a workspace, or for a value that is not one', () => {
    for (const workspace of [null, '', 'Not A Workspace']) {
      const { init } = previewRequest(endpoint, { workspace })
      assert.equal(HEADER in init.headers, false, String(workspace))
    }
  })
})
