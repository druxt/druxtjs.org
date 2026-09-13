import axios from 'axios'
import Vuex from 'vuex'
import { DruxtClient, DruxtStore } from 'druxt'
import { DruxtRouter, DruxtRouterStore } from 'druxt-router'
import { DruxtSchema, DruxtSchemaStore } from 'druxt-schema'
import { DruxtMenu, DruxtMenuStore } from 'druxt-menu'
import { DruxtViewsStore } from 'druxt-views'
import { rerouteFiles, schemaImporter } from '~/utils/runtime-rules'

/**
 * A Druxt runtime of its own for one backend: a client, a store and the
 * services the modules inject. A component mounted under it renders against
 * that backend the way it would on a site built for it, sharing nothing
 * with this site's own.
 *
 * Display schemas are built from the backend's own configuration on demand,
 * where a site builds them once when it builds.
 *
 * @param {object} backend
 * @param {string} backend.baseUrl - The backend's own origin, as its JSON:API links name it.
 * @param {string} [backend.proxyRoot] - Where requests go on this origin instead; '' for this site's own proxy.
 * @param {object} [backend.settings] - The Druxt module settings to carry over.
 * @param {object} [backend.state] - This site's own store state, which its wrappers read.
 * @param {object} [backend.mutations] - This site's own store mutations, for the same reason.
 */
export function createRuntime({ baseUrl, proxyRoot = '', settings = {}, state = {}, mutations = {} }) {
  // One axios for everything, sent through the proxy; the client strips
  // `baseUrl` from the links the backend hands back, so they stay relative.
  const http = axios.create({ baseURL: proxyRoot || undefined })
  // Files too: a file entity names its URL on the backend's own origin.
  if (proxyRoot) http.interceptors.response.use(rerouteFiles(proxyRoot))
  const options = { ...settings, baseUrl, endpoint: '/jsonapi', proxy: { api: false, files: false }, axios: http }
  const client = new DruxtClient(baseUrl, options)
  client.settings = options

  // This site's own store too, so its wrappers find what they read there. A
  // copy: this site's store is strict, and would object to a wrapper
  // committing here into an object it also holds.
  const store = new Vuex.Store({ state: JSON.parse(JSON.stringify(state)), mutations })
  for (const install of [DruxtStore, DruxtRouterStore, DruxtSchemaStore, DruxtMenuStore, DruxtViewsStore]) install({ store })
  store.$druxt = client
  // The router store reaches its siblings through the app.
  store.app = { store, context: {} }

  // What the modules' plugins inject, for the store and the root alike.
  const menu = new DruxtMenu(baseUrl, options)
  const router = new DruxtRouter(baseUrl, options)
  store.$druxtMenu = menu
  store.$druxtRouter = () => router

  store.$druxtSchema = { import: schemaImporter(new DruxtSchema(baseUrl, { ...options, schema: { filter: [] } })) }

  return { axios: http, client, store, menu, router: store.$druxtRouter }
}
