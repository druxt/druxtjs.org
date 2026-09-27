/**
 * The Nuxt.js module function.
 *
 * - Extends the Vue router, adding the Druxt wildcard route.
 * - Adds the Druxt router plugin.
 * - Adds the Druxt router Vuex store.
 *
 * The module function should not be used directly, but rather installed via your Nuxt configuration file.
 *
 * Options are set on the root level `druxt` Nuxt config object.
 *
 * A Nuxt module configures the Nuxt application, and is unrelated to a Drupal module.
 *
 * @see https://druxtjs.org/modules/router
 * @see https://druxtjs.org/explanation/nuxt-for-drupal-developers
 *
 * @example @lang js
 * // `nuxt.config.js`
 * module.exports = {
 *   buildModules: ['druxt-router/nuxt'],
 *   druxt: {
 *     baseUrl: 'https://api.umami.demo.druxtjs.org'
 *   }
 * }
 *
 * @param {object} moduleOptions - The Nuxt.js module options.
 * @property {object} options.druxt - Druxt root level options.
 * @property {string} options.druxt.baseUrl - Base URL of the Drupal JSON:API backend.
 * @property {string} [options.druxt.endpoint=/jsonapi] - The Drupal JSON:API endpoint path.
 * @property {object} [options.druxt.axios] - Axios settings for the DruxtRouter client.
 * @property {boolean} [options.druxt.proxy.api] - Proxy JSON:API requests on the client side.
 * @property {string} [options.druxt.router.render] - Name of the component used to render the
 *   resolved route.
 */
declare function DruxtRouterNuxtModule(moduleOptions?: object): Promise<void>;
declare namespace DruxtRouterNuxtModule {
    const meta: any;
}

export { DruxtRouterNuxtModule as default };
