import chalk from 'chalk';
import { DrupalJsonApiParams } from 'drupal-jsonapi-params';
import { join, resolve, normalize } from 'path';
import axios from 'axios';
import { stringify } from 'querystring';
import consola from 'consola';
import merge from 'deepmerge';
import md5 from 'md5';
import Vue from 'vue';

const SCOPES = Symbol.for("druxt.processCache");
const scopes = globalThis[SCOPES] || (globalThis[SCOPES] = new Map());
const GENERATION = Symbol.for("druxt.processCacheGeneration");
const generation = globalThis[GENERATION] || (globalThis[GENERATION] = { value: 0 });
const credentialed = new WeakSet();
const watched = new WeakMap();
const runtime = { isServer: () => typeof window === "undefined" };
const DRUPAL_SESSION_COOKIE = "S?SESS[0-9a-f]+";
const consumerId = (axios) => {
  const headers = ((axios || {}).defaults || {}).headers || {};
  for (const set of [headers, headers.common, headers.get]) {
    const match = Object.entries(set || {}).find(([name]) => name.toLowerCase() === "x-consumer-id");
    if (match && match[1])
      return String(match[1]);
  }
  return "";
};
const headersHaveCredentials = (headers, sessionCookie) => {
  const session = new RegExp(`(?:^|;\\s*)(?:${sessionCookie})=`, "i");
  return Object.entries(headers || {}).some(([name, value]) => {
    if (!value || typeof value === "object")
      return false;
    const header = name.toLowerCase();
    return header === "authorization" || header === "cookie" && session.test(String(value));
  });
};
const configHasCredentials = (config, sessionCookie = DRUPAL_SESSION_COOKIE) => {
  if (!config)
    return false;
  if (config.auth)
    return true;
  const headers = config.headers || {};
  return headersHaveCredentials(headers, sessionCookie) || headersHaveCredentials(headers.common, sessionCookie) || headersHaveCredentials(headers.get, sessionCookie);
};
const hasCredentials = (axios, sessionCookie = DRUPAL_SESSION_COOKIE) => {
  if (!axios)
    return false;
  if (credentialed.has(axios))
    return true;
  return configHasCredentials(axios.defaults, sessionCookie);
};
const watchCredentials = (axios, sessionCookie = DRUPAL_SESSION_COOKIE) => {
  const interceptors = ((axios || {}).interceptors || {}).response;
  if (!interceptors || typeof interceptors.use !== "function")
    return;
  const registered = watched.get(axios);
  if (registered) {
    registered.add(sessionCookie);
    return;
  }
  const patterns = new Set([sessionCookie]);
  watched.set(axios, patterns);
  const mark = (config) => {
    for (const pattern of patterns) {
      if (configHasCredentials(config, pattern)) {
        credentialed.add(axios);
        return;
      }
    }
  };
  interceptors.use((response) => {
    mark((response || {}).config);
    return response;
  }, (error) => {
    mark((error || {}).config);
    return Promise.reject(error);
  });
};
const parseCacheLifetime = (headers) => {
  const header = (name) => Object.entries(headers || {}).filter(([key]) => key.toLowerCase() === name).map(([, value]) => String(value)).join(", ");
  const directives = header("cache-control").toLowerCase().split(",").map((d) => d.trim());
  if (directives.some((d) => ["private", "no-store", "no-cache"].includes(d)))
    return 0;
  const vary = header("vary").toLowerCase().split(",").map((v) => v.trim()).filter(Boolean);
  if (vary.some((v) => !["cookie", "x-consumer-id", "accept-encoding"].includes(v)))
    return 0;
  const seconds = (name) => {
    const directive = directives.find((d) => d.startsWith(`${name}=`));
    const value = directive ? directive.slice(name.length + 1) : "";
    return /^\d+$/.test(value) ? Number(value) : NaN;
  };
  const lifetime = directives.some((d) => d.startsWith("s-maxage=")) ? seconds("s-maxage") : seconds("max-age");
  if (Number.isNaN(lifetime))
    return 0;
  const age = parseInt(header("age"), 10) || 0;
  return Math.max(0, lifetime - age);
};
const processCache = (scope, { axios, ttl, sessionCookie } = {}) => {
  if (!runtime.isServer() || hasCredentials(axios, sessionCookie))
    return null;
  if (!scopes.has(scope))
    scopes.set(scope, new Map());
  const consumers = scopes.get(scope);
  const consumer = consumerId(axios);
  if (!consumers.has(consumer))
    consumers.set(consumer, new Map());
  const entries = consumers.get(consumer);
  const cap = (seconds) => typeof ttl === "number" ? Math.min(seconds, ttl) : seconds;
  const taken = generation.value;
  return {
    generation: taken,
    get(key) {
      const entry = entries.get(key);
      if (!entry)
        return void 0;
      if (Date.now() - entry.created >= cap(entry.seconds) * 1e3)
        return void 0;
      return entry.value;
    },
    set(key, value, seconds, since) {
      if (since !== void 0 && since !== generation.value)
        return value;
      if (cap(seconds) > 0)
        entries.set(key, { value, seconds: cap(seconds), created: Date.now() });
      else
        entries.delete(key);
      return value;
    }
  };
};
const resetProcessCache = (scope) => {
  if (scope)
    scopes.delete(scope);
  else
    scopes.clear();
  generation.value += 1;
};

const indexCache = new WeakMap();
const lifetimes = new WeakMap();
class DruxtClient {
  constructor(baseUrl, options = {}) {
    this.log = consola.create({ defaults: {
      tag: "DruxtClient"
    } });
    if (!baseUrl) {
      throw new Error("The 'baseUrl' parameter is required.");
    }
    this.axios = {};
    if (typeof options.axios === "function") {
      this.axios = options.axios;
    } else {
      this.axios = axios.create({
        ...options.axios || {},
        baseURL: baseUrl && !(options.proxy || {}).api ? baseUrl : void 0
      });
    }
    if (options.debug) {
      const log = this.log;
      this.axios.interceptors.request.use((config) => {
        log.info(config.url);
        return config;
      }, (error) => {
        log.error(error);
        return Promise.reject(error);
      });
    }
    this.options = {
      endpoint: "/jsonapi",
      jsonapiResourceConfig: "jsonapi_resource_config--jsonapi_resource_config",
      ...options
    };
    if (this.options.cache)
      watchCredentials(this.axios, this.options.cache.sessionCookie);
    const indexKey = JSON.stringify([baseUrl, this.options.endpoint, this.options.jsonapiResourceConfig]);
    this.indexKey = indexKey;
    if (!indexCache.has(this.axios))
      indexCache.set(this.axios, { index: {}, requests: {}, generation: 0 });
    const cache = indexCache.get(this.axios);
    this.indexCache = cache;
    this.indexRequests = cache.requests;
    this.index = cache.index[indexKey] || (cache.index[indexKey] = {});
    this.cacheGeneration = 0;
  }
  clearCache() {
    for (const prefix of Object.keys(this.index))
      delete this.index[prefix];
    for (const key of Object.keys(this.indexRequests))
      delete this.indexRequests[key];
    this.indexCache.generation += 1;
    resetProcessCache();
    this.cacheGeneration += 1;
  }
  processCache(scope) {
    if (!this.options.cache)
      return null;
    const { ttl, sessionCookie } = this.options.cache;
    return processCache(scope, { axios: this.axios, ttl, sessionCookie });
  }
  cacheLifetime(document) {
    const record = document && typeof document === "object" && lifetimes.get(document);
    if (!record)
      return 0;
    return Math.max(0, record.seconds - Math.floor((Date.now() - record.at) / 1e3));
  }
  addHeaders(headers) {
    if (typeof headers === "undefined") {
      return false;
    }
    for (const name in headers) {
      this.axios.defaults.headers.common[name] = headers[name];
    }
  }
  buildQueryUrl(url, query) {
    if (!query) {
      return url;
    }
    if (typeof query === "string") {
      return query.charAt(0) === "?" ? url + query : [url, query].join("?");
    }
    if (typeof query === "object" && typeof query.getQueryString === "function" && (query = query.getQueryString())) {
      return [url, query].join("?");
    }
    if (typeof query === "object" && Object.keys(query).length) {
      return [url, stringify(query)].join("?");
    }
    return url;
  }
  checkPermissions(res) {
    if (res.data.meta && res.data.meta.omitted) {
      const permissions = {};
      delete res.data.meta.omitted.links.help;
      for (const key in res.data.meta.omitted.links) {
        const link = res.data.meta.omitted.links[key];
        const match = link.meta.detail.match(/'(.*?)'/);
        if (match && match[1]) {
          permissions[match[1]] = true;
        }
      }
      if (Object.keys(permissions).length) {
        const err = {
          response: {
            statusText: res.data.meta.omitted.detail,
            data: {
              errors: [{ detail: `Required permissions:
 - ${Object.keys(permissions).join("\n - ")}` }]
            }
          }
        };
        throw err;
      }
    }
  }
  async createResource(resource, prefix = "") {
    if (resource.id) {
      return this.updateResource(resource, prefix);
    }
    const { href } = await this.getIndex(resource.type, prefix);
    if (!href) {
      return false;
    }
    let response;
    try {
      response = await this.axios.post(href, { data: resource }, {
        headers: {
          "Content-Type": "application/vnd.api+json"
        }
      });
    } catch (err) {
      this.error(err, { url: href });
    }
    return response;
  }
  error(err, context = {}) {
    let { url } = context;
    if (!url && ((err.response || {}).config || {}).url) {
      url = err.response.config.url;
    }
    const title = [
      (err.response || {}).status,
      (err.response || {}).statusText || err.message
    ].filter((s) => s).join(": ");
    const meta = { url: url && [this.options.baseUrl, url].join("") };
    let message = [title];
    if (Object.values(meta).filter((o) => o).length) {
      message.push(Object.entries(meta).filter(([, v]) => v).map(([key, value]) => `${key.toUpperCase()}: ${value}`).join("\n"));
    }
    if (((((err.response || {}).data || {}).errors || [])[0] || {}).detail) {
      message.push(err.response.data.errors[0].detail);
    }
    const error = Error(message.join("\n\n"));
    error.response = err.response;
    error.druxt = context;
    throw error;
  }
  async get(url, options) {
    try {
      const res = await this.axios.get(url, options);
      if (res && res.data && typeof res.data === "object")
        lifetimes.set(res.data, { seconds: parseCacheLifetime(res.headers), at: Date.now() });
      return res;
    } catch (err) {
      this.error(err, { url });
    }
  }
  async getCollection(type, query, prefix) {
    const { href } = await this.getIndex(type, prefix);
    if (!href) {
      return false;
    }
    const url = this.buildQueryUrl(href, query);
    const { data } = await this.get(url);
    return data;
  }
  async getCollectionAll(type, query, prefix) {
    const collections = [];
    let res = await this.getCollection(type, query, prefix);
    collections.push(res);
    while (((res.links || {}).next || {}).href) {
      query = res.links.next.href.split("?")[1];
      res = await this.getCollection(type, query, prefix);
      collections.push(res);
    }
    return collections;
  }
  async getIndex(resource, prefix) {
    if (!(this.index || {})[prefix]) {
      const shared = this.processCache("index");
      const sharedKey = [this.indexKey, prefix || ""].join(":");
      const stored = shared && shared.get(sharedKey);
      if (stored)
        this.index[prefix] = stored;
    }
    if (!(this.index || {})[prefix]) {
      const key = [this.indexKey, prefix || ""].join(":");
      const before = this.processCache("index");
      const since = before ? before.generation : void 0;
      const started = this.indexCache.generation;
      const request = this.indexRequests[key] || (this.indexRequests[key] = this.fetchIndex(prefix));
      let fetched;
      try {
        fetched = await request;
      } finally {
        if (this.indexRequests[key] === request)
          delete this.indexRequests[key];
      }
      if (started !== this.indexCache.generation) {
        return resource ? fetched.index[resource] || false : fetched.index;
      }
      this.index[prefix] = fetched.index;
      const shared = this.processCache("index");
      if (shared)
        shared.set(key, fetched.index, fetched.lifetime, since);
    }
    return resource ? this.index[prefix][resource] || false : this.index[prefix];
  }
  async fetchIndex(prefix) {
    const url = [prefix, this.options.endpoint].join("");
    const { data } = await this.get(url);
    let index = data.links;
    if (typeof index !== "object") {
      const err = { response: { statusText: "Invalid JSON:API endpoint" } };
      this.error(err, { url });
    }
    const baseUrl = this.options.baseUrl;
    index = Object.fromEntries(Object.entries(index).map(([key, value]) => {
      value.href = value.href.replace(baseUrl, "");
      return [key, value];
    }));
    const documents = [data];
    if (index[this.options.jsonapiResourceConfig]) {
      let resources = [];
      try {
        const config = (await this.get(index[this.options.jsonapiResourceConfig].href)).data;
        resources = config.data;
        documents.push(config);
      } catch (err) {
        this.log.warn(err.message);
      }
      for (const resourceType in resources) {
        const resource = resources[resourceType];
        const internal = resource.attributes.drupal_internal__id.split("--");
        const item = {
          resourceType: resource.attributes.resourceType,
          entityType: internal[0],
          bundle: internal[1],
          resourceFields: resource.attributes.resourceFields
        };
        const id = [item.entityType, item.bundle].join("--");
        index[id] = {
          ...item,
          ...index[id]
        };
      }
    }
    return { index, lifetime: Math.min(...documents.map((document) => this.cacheLifetime(document))) };
  }
  async getRelated(type, id, related, query, prefix = "") {
    if (!id || !type || !related) {
      return false;
    }
    let { href } = await this.getIndex(type, prefix);
    if (!href) {
      href = this.options.endpoint + "/" + type.replace("--", "/");
    }
    const url = this.buildQueryUrl(`${href}/${id}/${related}`, query);
    const { data } = await this.get(url);
    return data;
  }
  async getResource(type, id, query, prefix) {
    if (!id || !type) {
      return false;
    }
    let { href } = await this.getIndex(type, prefix);
    if (!href) {
      href = this.options.endpoint + "/" + type.replace("--", "/");
    }
    const url = this.buildQueryUrl([href, id].join("/"), query);
    const { data } = await this.get(url);
    return data;
  }
  async updateResource(resource, prefix) {
    const { href } = await this.getIndex(resource.type, prefix);
    if (!href) {
      return false;
    }
    const url = [href, resource.id].join("/");
    let response;
    try {
      response = await this.axios.patch(url, { data: resource }, {
        headers: {
          "Content-Type": "application/vnd.api+json"
        }
      });
    } catch (err) {
      this.error(err);
    }
    return response;
  }
}

const safeEqual = (input, secret) => {
  let diff = input.length ^ secret.length;
  for (let i = 0; i < input.length; i++) {
    diff |= input.charCodeAt(i) ^ secret.charCodeAt(i % secret.length);
  }
  return diff === 0;
};
const cacheClearHandler = (secret) => (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end();
  }
  if (!safeEqual(String(req.headers["x-druxt-secret"] || ""), String(secret))) {
    res.statusCode = 401;
    return res.end();
  }
  resetProcessCache();
  res.statusCode = 204;
  res.end();
};

var name = "druxt";
var version = "0.24.0";
var description = "The Fully Decoupled Drupal Framework for Nuxt.js.";
var keywords = [
	"cms",
	"decoupled",
	"drupal",
	"druxt",
	"headless",
	"jsonapi",
	"json:api",
	"nuxt",
	"module",
	"vue"
];
var homepage = "https://druxtjs.org";
var bugs = {
	url: "https://github.com/druxt/druxt.js/issues"
};
var repository = {
	type: "git",
	url: "git+https://github.com/druxt/druxt.js",
	directory: "packages/druxt"
};
var license = "MIT";
var author = "Stuart Clark <stuart@druxtjs.org>";
var exports = {
	".": {
		require: "./dist/druxt.ssr.js",
		"import": "./dist/druxt.esm.js"
	},
	"./components/*": "./dist/components/*",
	"./dist/components/*": "./dist/components/*",
	"./plugins/*": "./dist/plugins/*",
	"./server-middleware/*": "./dist/server-middleware/*",
	"./dist/server-middleware/template.mjs": "./dist/server-middleware/template.mjs"
};
var main = "dist/druxt.ssr.js";
var module = "dist/druxt.esm.js";
var files = [
	"dist",
	"templates",
	"icon.svg",
	"banner.svg"
];
var dependencies = {
	"@nuxtjs/axios": "^5.13.6",
	"@nuxtjs/proxy": "^2.1.0",
	"@vue/devtools-api": "^6.6.4",
	chalk: "^4.1.2",
	deepmerge: "^4.3.1",
	"drupal-jsonapi-params": "^2.3.2",
	"express-rate-limit": "^7.5.1",
	"launch-editor": "^2.14.1",
	md5: "^2.3.0",
	querystring: "^0.2.1",
	scule: "^0.3.2"
};
var devDependencies = {
	"@storybook/addon-docs": "^6.5.16",
	"druxt-test-utils": "^0.2.15"
};
var peerDependencies = {
	axios: "0.28.0",
	consola: "*"
};
var optionalDependencies = {
	"core-js": "^3.50.0",
	vue: "^2.7.16",
	vuex: "^3.6.2"
};
var publishConfig = {
	access: "public"
};
var meta = {
	name: name,
	version: version,
	description: description,
	keywords: keywords,
	homepage: homepage,
	bugs: bugs,
	repository: repository,
	license: license,
	author: author,
	exports: exports,
	main: main,
	module: module,
	files: files,
	dependencies: dependencies,
	devDependencies: devDependencies,
	peerDependencies: peerDependencies,
	optionalDependencies: optionalDependencies,
	publishConfig: publishConfig
};

const extendComponent = (component) => ({ ...component, isAsync: false });
const DruxtNuxtModule = async function(moduleOptions = {}) {
  var _a;
  const options = {
    endpoint: "/jsonapi",
    ...moduleOptions,
    ...(this.options || {}).druxt
  };
  if (options.cache !== false) {
    options.cache = this.options.dev ? false : { ...options.cache };
  }
  const { secret, ...cache } = options.cache || {};
  if (options.cache)
    options.cache = cache;
  if (options.cache && secret) {
    this.addServerMiddleware({ path: "/_druxt/cache/clear", handler: cacheClearHandler(secret) });
  }
  this.options.baseUrl = options.baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl.slice(0, -1) : options.baseUrl;
  this.options.endpoint = options.endpoint = options.endpoint.startsWith("/") ? options.endpoint : `/${options.endpoint}`;
  const druxt = new DruxtClient(options.baseUrl, {
    ...options,
    proxy: { ...options.proxy || {}, api: false }
  });
  if (options.proxy) {
    const proxies = {};
    if ((options.proxy || {}).api) {
      proxies[options.endpoint] = options.baseUrl;
      const languageResourceType = "configurable_language--configurable_language";
      if ((await druxt.getIndex(languageResourceType) || {}).href) {
        const query = new DrupalJsonApiParams().addFields(languageResourceType, ["drupal_internal__id"]);
        const languages = (await druxt.getCollectionAll(languageResourceType, query) || []).map((o) => o.data).flat().filter((o) => !["und", "zxx"].includes(((o || {}).attributes || {}).drupal_internal__id)).map((o) => o.attributes.drupal_internal__id);
        for (const langcode of languages) {
          proxies[`/${langcode}${options.endpoint}`] = options.baseUrl;
        }
      }
      proxies["/router/translate-path"] = options.baseUrl;
    }
    if ((options.proxy || {}).files) {
      const filesPath = typeof options.proxy.files === "string" ? options.proxy.files : "default";
      proxies[`/sites/${filesPath}/files`] = options.baseUrl;
    }
    if (this.options.proxy) {
      if (Array.isArray(this.options.proxy)) {
        this.options.proxy = [
          ...this.options.proxy,
          ...Object.keys(proxies).map((path) => `${options.baseUrl}${path}`)
        ];
      } else {
        this.options.proxy = {
          ...this.options.proxy,
          ...proxies
        };
      }
    } else {
      this.options.proxy = proxies;
    }
    this.addModule("@nuxtjs/proxy");
  }
  if (!options.axios) {
    this.options.axios = {
      baseURL: options.baseUrl,
      proxy: !!(options.proxy || {}).api,
      ...this.options.axios
    };
    this.addModule("@nuxtjs/axios");
  }
  this.options.build = this.options.build || {};
  this.options.build.transpile = this.options.build.transpile || [];
  if (!this.options.build.transpile.includes("axios")) {
    this.options.build.transpile.push("axios");
  }
  this.nuxt.hook("components:dirs", (dirs) => {
    dirs.push({ path: join(__dirname, "components"), extendComponent });
  });
  this.addPlugin({
    src: resolve(__dirname, "../templates/plugin.js"),
    fileName: "druxt.js",
    options
  });
  const extendPlugins = this.options.extendPlugins;
  this.options.extendPlugins = (plugins) => {
    plugins = typeof extendPlugins === "function" ? extendPlugins(plugins) : plugins;
    const axiosIndex = plugins.findIndex(({ src }) => src === normalize(`${this.options.buildDir}/axios.js`));
    const axiosPlugin = plugins[axiosIndex];
    plugins.splice(axiosIndex, 1);
    const druxtIndex = plugins.findIndex(({ src }) => src === normalize(`${this.options.buildDir}/druxt.js`));
    const druxtPlugin = plugins[druxtIndex];
    plugins.splice(druxtIndex, 1);
    plugins = [axiosPlugin, druxtPlugin, ...plugins];
    return plugins;
  };
  this.addPlugin({
    src: resolve(__dirname, "../templates/store.js"),
    fileName: "store/druxt.js",
    options
  });
  this.options.store = true;
  this.options.components = (_a = this.options.components) != null ? _a : true;
  this.options.cli.badgeMessages.push(`${chalk.blue.bold("Druxt")} @ v${meta.version}`);
  this.options.cli.badgeMessages.push(`${chalk.bold("API:")} ${chalk.blue.underline(options.baseUrl + options.endpoint)}`);
  if (this.options.dev) {
    this.addServerMiddleware({
      path: "/_druxt/template",
      handler: "druxt/dist/server-middleware/template.mjs"
    });
    this.addPlugin({
      src: resolve(__dirname, "../dist/plugins/devtools.mjs"),
      fileName: "druxt-devtools.js"
    });
  }
  const self = this;
  this.nuxt.hook("storybook:config", async ({ stories }) => {
    self.addTemplate({
      src: resolve(__dirname, "../templates/stories/README.stories.mdx"),
      fileName: "stories/druxt-README.stories.mdx"
    });
    stories.push(resolve(self.options.buildDir, "./stories/druxt-README.stories.mdx"));
    self.addTemplate({
      src: resolve(__dirname, "../templates/stories/druxt-module.stories.mdx"),
      fileName: "stories/druxt-module.stories.mdx"
    });
    stories.push(resolve(self.options.buildDir, "./stories/druxt-module.stories.mdx"));
    self.addTemplate({
      src: resolve(__dirname, "../templates/stories/druxt-debug.stories.js"),
      fileName: "stories/druxt-debug.stories.js"
    });
    stories.push(resolve(self.options.buildDir, "./stories/druxt-debug.stories.js"));
  });
};

const getDrupalJsonApiParams = (query) => {
  return new DrupalJsonApiParams().initialize(query);
};

const dehydrateResources = ({ commit, queryObject, resources, prefix }) => {
  return (resources || []).map((data) => {
    const link = decodeURI(((data.links || {}).self || {}).href || "");
    const href = typeof (queryObject.fields || {})[data.type] === "string" ? [link.split("?")[0], `fields[${data.type}]=${queryObject.fields[data.type]}`].join("?") : link;
    commit("druxt/addResource", {
      prefix,
      resource: {
        data,
        links: { self: { href } }
      }
    });
    return { id: data.id, type: data.type };
  });
};
const collectionHash = (query) => {
  if (!query)
    return "_default";
  const queryObject = getDrupalJsonApiParams(query).getQueryObject();
  return md5(JSON.stringify({ ...queryObject, fields: {}, include: [] }));
};
const flush = (tree, key, keys, leaf) => {
  const byKey = tree[key];
  if (!byKey)
    return;
  if (!keys.length && leaf === void 0)
    return Vue.delete(tree, key);
  for (const k of keys.length ? keys : Object.keys(byKey)) {
    if (!byKey[k])
      continue;
    if (leaf !== void 0)
      Vue.delete(byKey[k], leaf);
    else
      Vue.delete(byKey, k);
  }
};
const DruxtStore = ({ store }) => {
  if (typeof store === "undefined") {
    throw new TypeError("Vuex store not found.");
  }
  const namespace = "druxt";
  const inFlight = new Map();
  const generation = { value: 0 };
  const flushInFlight = () => {
    inFlight.clear();
    generation.value += 1;
  };
  const share = (key, request) => {
    if (!inFlight.has(key)) {
      const promise = request();
      const clear = () => {
        if (inFlight.get(key) === promise)
          inFlight.delete(key);
      };
      inFlight.set(key, promise);
      promise.then(clear, clear);
    }
    return inFlight.get(key);
  };
  const module = {
    namespaced: true,
    state: () => ({
      collections: {},
      resources: {}
    }),
    mutations: {
      addCollection(state, { collection, type, hash, prefix }) {
        if (!state.collections[type])
          Vue.set(state.collections, type, {});
        if (!state.collections[type][hash])
          Vue.set(state.collections[type], hash, {});
        const link = decodeURI((((collection || {}).links || {}).self || {}).href || "");
        const query = link.split("?")[1] || "";
        const queryObject = getDrupalJsonApiParams(query).getQueryObject();
        collection.data = dehydrateResources({ commit: this.commit, prefix, queryObject, resources: collection.data });
        if (collection.included) {
          collection.included = dehydrateResources({ commit: this.commit, prefix, queryObject, resources: collection.included });
        }
        const hadIncluded = !!collection.included;
        collection = merge(state.collections[type][hash][prefix] || {}, collection, { arrayMerge: (dst, src) => src });
        if (!hadIncluded)
          delete collection.included;
        Vue.set(state.collections[type][hash], prefix, collection);
      },
      addResource(state, { prefix, resource, hash }) {
        if (hash) {
          console.warn("[druxt] The `hash` argument for `druxt/addResource` has been deprecated, see https://druxtjs.org/modules/druxt/deprecations#druxtstore-addresource-hash");
        }
        const { id, type } = (resource || {}).data || {};
        if (!id || !type) {
          return;
        }
        const link = decodeURI((((resource || {}).links || {}).self || {}).href || "");
        const query = link.split("?")[1] || "";
        const queryObject = getDrupalJsonApiParams(query).getQueryObject();
        const flag = typeof (queryObject.fields || {})[((resource || {}).data || {}).type] === "string" ? "_druxt_partial" : "_druxt_full";
        resource[flag] = Date.now();
        if (!state.resources[type])
          Vue.set(state.resources, type, {});
        if (!state.resources[type][id])
          Vue.set(state.resources[type], id, {});
        if (resource.included) {
          dehydrateResources({ commit: this.commit, prefix, queryObject, resources: resource.included });
          delete resource.included;
        }
        resource = merge(state.resources[type][id][prefix] || {}, resource, { arrayMerge: (dst, src) => src });
        Vue.set(state.resources[type][id], prefix, resource);
      },
      flushCollection(state, { type, hash, query, prefix } = {}) {
        flushInFlight();
        if (!type)
          return Vue.set(state, "collections", {});
        const key = hash !== void 0 ? hash : query !== void 0 ? collectionHash(query) : void 0;
        flush(state.collections, type, key !== void 0 ? [key] : [], prefix);
      },
      flushResource(state, { type, id, prefix } = {}) {
        flushInFlight();
        if (!type)
          return Vue.set(state, "resources", {});
        flush(state.resources, type, id !== void 0 ? [id] : [], prefix);
      }
    },
    actions: {
      clearCache({ commit }) {
        if (this.$druxt && typeof this.$druxt.clearCache === "function")
          this.$druxt.clearCache();
        commit("flushCollection", {});
        commit("flushResource", {});
        for (const mutation of ["druxt/views/flushResults", "druxtMenu/flushEntities", "druxtRouter/flushRoutes"]) {
          if (this._mutations[mutation])
            commit(mutation, {}, { root: true });
        }
      },
      async getCollection({ commit, state }, { type, query, prefix, bypassCache = false }) {
        const hash = collectionHash(query);
        if (!bypassCache && ((state.collections[type] || {})[hash] || {})[prefix]) {
          const cached = state.collections[type][hash][prefix];
          const hydrate = (o) => (((state.resources[o.type] || {})[o.id] || {})[prefix] || {}).data;
          const data = cached.data.map(hydrate);
          const included = cached.included ? cached.included.map(hydrate) : void 0;
          if (data.every((o) => o) && (included || []).every((o) => o)) {
            return {
              ...cached,
              data,
              ...included ? { included } : {}
            };
          }
        }
        const key = JSON.stringify(["collection", prefix, type, hash, getDrupalJsonApiParams(query).getQueryObject()]);
        return share(key, async () => {
          const since = generation.value;
          const collection = await this.$druxt.getCollection(type, query, prefix);
          if (since === generation.value)
            commit("addCollection", { collection: { ...collection }, type, hash, prefix });
          return collection;
        });
      },
      async getResource({ commit, dispatch, state }, { type, id, query, prefix, bypassCache = false }) {
        const storedResource = ((state.resources[type] || {})[id] || {})[prefix] ? { ...state.resources[type][id][prefix] } : null;
        const queryObject = getDrupalJsonApiParams(query).getQueryObject();
        queryObject.include = Array.isArray(queryObject.include) ? queryObject.include.join(",") : queryObject.include;
        if (queryObject.include && typeof (queryObject.fields || {})[type] === "string") {
          const fields2 = queryObject.fields[type].split(",").filter((s) => s);
          const includes = queryObject.include.split(",").filter((s) => s && !s.includes("."));
          queryObject.fields[type] = Array.from(new Set([...fields2, ...includes])).filter((s) => s).join(",");
        }
        let included = [];
        if (queryObject.include && storedResource && !bypassCache) {
          const resources = await Promise.all(queryObject.include.split(",").filter((s) => Object.keys(storedResource.data.relationships || {}).includes(s)).map((key) => {
            let { data } = storedResource.data.relationships[key];
            data = Array.isArray(data) ? data : [data];
            const include = queryObject.include.split(",").filter((s) => s.startsWith(`${key}.`)).map((s) => s.slice(key.length + 1)).join(",");
            return data.filter((o) => typeof o === "object" && o).map((o) => {
              return dispatch("getResource", {
                id: o.id,
                prefix,
                type: o.type,
                query: { ...queryObject, include }
              });
            });
          }).flat());
          for (const include of resources) {
            included = [...included, include.data, ...include.included || []];
          }
          storedResource.included = included;
        }
        if (!bypassCache && (storedResource || {})._druxt_full) {
          return storedResource;
        }
        const isFull = typeof (queryObject.fields || {})[type] !== "string";
        let fields = isFull ? true : (queryObject.fields || {})[type];
        if (storedResource && !isFull && fields && !bypassCache) {
          const queryFields = fields.split(",");
          const resourceFields = [
            ...Object.keys(((storedResource || {}).data || {}).attributes || {}),
            ...Object.keys(((storedResource || {}).data || {}).relationships || {})
          ];
          const missingFields = queryFields.filter((key) => !resourceFields.includes(key));
          fields = !!missingFields.length;
          queryObject.fields[type] = (missingFields || []).join(",") || void 0;
        }
        let resource;
        const since = generation.value;
        if (bypassCache || !storedResource || fields) {
          try {
            const key = JSON.stringify(["resource", prefix, type, id, queryObject]);
            resource = await share(key, async () => {
              const started = generation.value;
              const response = await this.$druxt.getResource(type, id, getDrupalJsonApiParams(queryObject), prefix);
              if (started === generation.value)
                commit("addResource", { prefix, resource: { ...response } });
              return response;
            });
          } catch (e) {
          }
        }
        const stored = ((state.resources[type] || {})[id] || {})[prefix];
        const result = { ...since === generation.value && stored ? stored : resource || stored };
        if (queryObject.include && ((resource || {}).included || (storedResource || {}).included)) {
          included = [
            ...(resource || {}).included || [],
            ...(storedResource || {}).included || []
          ];
          result.included = Array.from(new Set(included.filter((o) => (o || {}).id).map((o) => o.id))).map((id2) => included.find((o) => o.id === id2));
        }
        return result;
      }
    }
  };
  store.registerModule(namespace, module, {
    preserveState: Boolean(store.state[namespace])
  });
};

class DruxtClass {
  constructor() {
  }
  getComponents(vm, options, all = false, prefix) {
    const results = [];
    const unique = {};
    options.filter((item) => Array.isArray(item)).map((item) => {
      const variants = [];
      item.map((string) => {
        const parts = variants.length ? [...variants[0].parts] : [];
        parts.push(string);
        const clone = [...parts];
        if (typeof prefix !== "string" && (prefix !== false || typeof prefix === "undefined") && ((vm || {}).$options || {}).name) {
          prefix = vm.$options.name.match(/[A-Z][a-z]+/g).map((word) => word.toLowerCase()).join("-");
        }
        if (prefix) {
          clone.unshift(prefix);
        }
        const kebab = clone.map((string2) => string2.toLowerCase().replace(/--|_/g, "-")).join("-");
        const pascal = kebab.replace(/((\b|[^a-zA-Z0-9]+)[a-zA-Z0-9])/gi, (match, p1, p2) => match.toUpperCase().replace(p2, ""));
        let global = false;
        for (const name of [kebab, pascal]) {
          if (typeof (((vm || {}).$options || {}).components || {})[name] !== "undefined") {
            global = true;
            break;
          }
        }
        variants.unshift({ global, kebab, parts, pascal, prefix });
      });
      variants.map((variant) => {
        if (unique[variant.pascal]) {
          return;
        }
        unique[variant.pascal] = true;
        results.push(variant);
      });
    });
    return results.filter((option) => option.global || !!all).sort((a, b) => b.parts.length - a.parts.length);
  }
  async getModuleData(vm) {
    if (typeof ((vm || {}).$options || {}).druxt !== "function") {
      return false;
    }
    const moduleData = await vm.$options.druxt({ vm });
    if ((vm.$options || {}).name) {
      moduleData.name = vm.$options.name.match(/[A-Z][a-z]+/g).map((word) => word.toLowerCase()).join("-");
    }
    return moduleData;
  }
}

DruxtNuxtModule.meta = require("../package.json");

export { DruxtClass, DruxtClient, DruxtStore, DruxtNuxtModule as default };
