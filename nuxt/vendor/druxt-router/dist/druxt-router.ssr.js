'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const druxt = require('druxt');
const Url = require('url-parse');
const Vue = require('vue');
const vuex = require('vuex');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

const Url__default = /*#__PURE__*/_interopDefaultLegacy(Url);
const Vue__default = /*#__PURE__*/_interopDefaultLegacy(Vue);

class DruxtRouter {
  constructor(baseUrl, options = {}) {
    this.options = {
      types: [
        {
          type: "entity",
          canonical: (route) => route.entity.canonical,
          component: "druxt-entity",
          property: "entity",
          props: (route) => ({
            langcode: route.entity.langcode,
            type: route.jsonapi.resourceName,
            uuid: route.entity.uuid
          })
        },
        {
          type: "views",
          canonical: (route) => route.resolved,
          component: "druxt-view",
          property: "view",
          props: (route) => ({
            displayId: route.view.display_id,
            langcode: route.view.langcode || void 0,
            type: route.jsonapi.resourceName,
            uuid: route.view.uuid,
            viewId: route.view.view_id
          })
        }
      ],
      ...options
    };
    this.druxt = options.druxtClient || new druxt.DruxtClient(baseUrl, this.options);
    this.axios = this.druxt.axios;
  }
  addHeaders(headers) {
    console.warn("[druxt-router] `addHeaders` is deprecated. See http://druxtjs.org/api/client.");
    if (typeof headers === "undefined") {
      return false;
    }
    this.druxt.addHeaders(headers);
  }
  buildQueryUrl(url, query) {
    console.warn("[druxt-router] `buildQueryUrl` is deprecated. See http://druxtjs.org/api/client.");
    return this.druxt.buildQueryUrl(url, query);
  }
  checkPermissions(res) {
    console.warn("[druxt-router] `checkPermissions` is deprecated. See http://druxtjs.org/api/client.");
    return this.druxt.checkPermissions(res);
  }
  async get(path) {
    const route = await this.getRoute(path);
    const redirect = this.getRedirect(path, route);
    return { redirect, route };
  }
  async getIndex(resource) {
    console.warn("[druxt-router] `getIndex` is deprecated. See http://druxtjs.org/api/client.");
    this.index = await this.druxt.getIndex(resource);
    return this.index;
  }
  getRedirect(path, route = {}) {
    const prefix = (route.props || {}).langcode || "";
    if (((route.redirect || [])[0] || {}).to) {
      return route.redirect[0].to;
    }
    const url = Url__default["default"](path);
    if (route.isHomePath) {
      const homePath = prefix ? `/${prefix}` : "/";
      if (!["/", homePath, `${homePath}/`].includes(url.pathname)) {
        return homePath;
      }
      return false;
    }
    if (typeof route.canonical === "string") {
      const canonicalUrl = new Url__default["default"](route.canonical);
      if (url.pathname !== canonicalUrl.pathname) {
        return canonicalUrl.pathname;
      }
    }
    return false;
  }
  async getResource(query = {}) {
    console.warn("[druxt-router] `getResource` is deprecated. See http://druxtjs.org/api/client.");
    const resource = await this.druxt.getResource(query.type, query.id);
    return resource.data || false;
  }
  async getResources(resource, query, options = {}) {
    console.warn("[druxt-router] `getResources` is deprecated. See http://druxtjs.org/api/client.");
    let resources = { data: [] };
    if (options.all) {
      const collections = await this.druxt.getCollectionAll(resource, query);
      collections.map((collection) => {
        (collection.data || []).map((resource2) => {
          resources.data.push(resource2);
        });
      });
    } else {
      resources = await this.druxt.getCollection(resource, query);
    }
    return resources.data || false;
  }
  async getResourceByRoute(route) {
    const resource = await this.druxt.getResource(route.jsonapi.resourceName, route.entity.uuid, route.prefix);
    return resource.data || false;
  }
  async getRoute(path = "/") {
    const url = `/router/translate-path?path=${path}`;
    const response = await this.druxt.get(url, {
      validateStatus: (status) => status < 500
    });
    const data = {
      isHomePath: false,
      jsonapi: {},
      label: false,
      redirect: false,
      ...response.data
    };
    let route = {
      error: false,
      type: false,
      canonical: false,
      component: false,
      isHomePath: data.isHomePath,
      jsonapi: data.jsonapi,
      label: data.label,
      props: false,
      redirect: data.redirect,
      resolvedPath: Url__default["default"](data.resolved).pathname,
      entity: data.entity
    };
    for (const key in this.options.types) {
      const type = {
        ...this.options.types[key]
      };
      if (typeof type.property !== "string" || typeof data[type.property] === "undefined") {
        continue;
      }
      delete type.property;
      if (typeof type.canonical === "function") {
        type.canonical = type.canonical(data);
      }
      if (typeof type.props === "function") {
        type.props = type.props(data);
      }
      route = {
        ...route,
        ...type
      };
      break;
    }
    if (!(response.status >= 200 && response.status < 300)) {
      if (response.status === 404) {
        if (typeof response.data !== "object") {
          response.data = { errors: [{
            detail: "Please ensure the Decoupled Router module is installed and configured correctly."
          }] };
        } else if (response.data.message || response.data.details) {
          response.data.errors = [{ detail: [response.data.message, response.data.details].filter((s) => s).join("\n") }];
        }
      }
      this.druxt.error({ response }, { url });
    }
    return route;
  }
}

const DruxtRouterStore = ({ store }) => {
  if (typeof store === "undefined") {
    throw new TypeError("Vuex store not found.");
  }
  const namespace = "druxtRouter";
  const module = {
    namespaced: true,
    state: () => ({
      entities: {},
      redirect: false,
      route: {},
      routes: {}
    }),
    mutations: {
      addEntity(state, entity) {
        console.warn("[druxt-router] `druxtRouter/addEntity` is deprecated. See https://druxtjs.org/api/packages/druxt/stores/druxt");
        if (!entity || typeof entity.id === "undefined") {
          return;
        }
        state.entities[entity.id] = entity;
      },
      setRedirect(state, redirect) {
        state.redirect = redirect;
      },
      addRoute(state, { path, route }) {
        if (typeof path !== "string" || typeof route === "undefined") {
          return;
        }
        Vue__default["default"].set(state.routes, path, route);
      },
      flushRoutes(state, { path } = {}) {
        if (path)
          Vue__default["default"].delete(state.routes, path);
        else
          Vue__default["default"].set(state, "routes", {});
      },
      setRoute(state, path) {
        if (typeof path !== "string" || typeof state.routes[path] === "undefined") {
          return;
        }
        state.route = state.routes[path];
      }
    },
    actions: {
      async get({ commit, dispatch }, path) {
        const route = await dispatch("getRoute", path);
        if (route.error && typeof route.error.statusCode !== "undefined") {
          return { error: route.error, route };
        }
        commit("setRoute", path);
        const redirect = this.$druxtRouter().getRedirect(path, route);
        commit("setRedirect", redirect);
        return { redirect, route };
      },
      async getEntity({ commit, state }, query) {
        console.warn("[druxt-router] `druxtRouter/getEntity` is deprecated. See https://druxtjs.org/api/packages/druxt/stores/druxt");
        if (typeof state.entities[query.id] !== "undefined") {
          return state.entities[query.id];
        }
        const entity = await this.app.store.dispatch("druxt/getResource", query);
        commit("addEntity", entity.data);
        return entity.data;
      },
      async getResources(app, { resource, query }) {
        console.warn("[druxt-router] `druxtRouter/getResources` is deprecated. See https://druxtjs.org/api/packages/druxt/stores/druxt");
        const collection = await this.app.store.dispatch("druxt/getCollection", { type: resource, query });
        return collection.data || false;
      },
      async getRoute({ commit, state }, path) {
        if (typeof state.routes[path] !== "undefined") {
          return state.routes[path];
        }
        let route;
        try {
          route = await this.$druxtRouter().getRoute(path);
        } catch (err) {
          const statusCode = (err.response || {}).status || 500;
          const message = ((err.response || {}).data || {}).message || err.message;
          route = { error: { statusCode, message } };
          if (statusCode < 400 || statusCode >= 500 || !err.response)
            return route;
        }
        commit("addRoute", { path, route });
        return route;
      }
    }
  };
  store.registerModule(namespace, module, {
    preserveState: Boolean(store.state[namespace])
  });
};

const DruxtRouterEntityMixin = {
  props: {
    mode: {
      type: String,
      default: "default"
    },
    type: {
      type: String,
      required: true
    },
    uuid: {
      type: String,
      required: true
    }
  },
  async fetch() {
    if (typeof this.entities[this.uuid] !== "undefined") {
      this.entity = this.entities[this.uuid];
      return;
    }
    if (!this.entity && this.uuid && this.type) {
      const resource = await this.getResource({ id: this.uuid, type: this.type });
      this.entity = resource.data;
      this.loading = false;
    }
  },
  data: () => ({
    entity: false,
    loading: true
  }),
  computed: {
    ...vuex.mapState({
      entities: (state) => state.druxt.resources
    })
  },
  methods: {
    ...vuex.mapActions({
      getEntity: "druxtRouter/getEntity",
      getResource: "druxt/getResource"
    })
  }
};

const DruxtRouterMixin = {
  props: {
    langcode: {
      type: String,
      default: void 0
    },
    path: {
      type: String,
      default: void 0
    },
    route: {
      type: Object,
      required: true
    }
  }
};

exports.DruxtRouter = DruxtRouter;
exports.DruxtRouterEntityMixin = DruxtRouterEntityMixin;
exports.DruxtRouterMixin = DruxtRouterMixin;
exports.DruxtRouterStore = DruxtRouterStore;
