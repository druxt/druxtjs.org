import { resolve, join } from 'path';
import { DrupalJsonApiParams } from 'drupal-jsonapi-params';
import { DruxtClient } from 'druxt';
import Vue from 'vue';

const titleFn = (parts) => parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, " ")).join("/");
async function DruxtMenuStorybook({ stories }) {
  const { addTemplate, options } = this;
  const druxt = new DruxtClient(options.druxt.baseUrl, { ...options.druxt, proxy: { api: false } });
  const resourceType = "menu--menu";
  const query = new DrupalJsonApiParams().addFilter("status", 1).addFields(resourceType, ["description", "drupal_internal__id", "label"]);
  const menus = (await druxt.getCollectionAll(resourceType, query)).map((collection) => collection.data).flat();
  addTemplate({
    src: resolve(__dirname, `../templates/druxt-menu.stories.js`),
    fileName: `stories/druxt-menu.stories.js`,
    options: { menus }
  });
  stories.push(resolve(options.buildDir, "./stories/druxt-menu.stories.js"));
  menus.forEach((menu) => {
    const name = menu.attributes.drupal_internal__id;
    const { description, label } = menu.attributes;
    const title = titleFn(["Druxt", "Menu", label]);
    addTemplate({
      src: resolve(__dirname, "../templates/druxt-menu.instance.stories.js"),
      fileName: `stories/druxt-menu.${name}.stories.js`,
      options: { description, label, name, title }
    });
  });
  stories.push(resolve(options.buildDir, "./stories/druxt-menu.*.stories.js"));
}

const extendComponent = (component) => ({ ...component, isAsync: false });
const DruxtMenuNuxtModule = async function(moduleOptions = {}) {
  const options = {
    baseUrl: moduleOptions.baseUrl,
    ...(this.options || {}).druxt || {},
    menu: {
      jsonApiMenuItems: true,
      ...((this.options || {}).druxt || {}).menu,
      ...moduleOptions
    }
  };
  await this.addModule(["druxt", options]);
  this.nuxt.hook("components:dirs", (dirs) => {
    dirs.push({ path: join(__dirname, "components"), extendComponent });
    dirs.push({ path: join(__dirname, "components/blocks"), extendComponent });
  });
  this.addPlugin({
    src: resolve(__dirname, "../templates/plugin.js"),
    fileName: "druxt-menu.js",
    options
  });
  this.addPlugin({
    src: resolve(__dirname, "../templates/store.js"),
    fileName: "store/druxt-menu.js",
    options
  });
  this.nuxt.hook("storybook:config", async ({ stories }) => {
    await DruxtMenuStorybook.call(this, { stories });
  });
};
DruxtMenuNuxtModule.meta = require("../package.json");

const runtime = { isServer: () => typeof window === "undefined" };
const menuCache = new WeakMap();
const lifetimes = new WeakMap();
class DruxtMenu {
  constructor(baseUrl, options = {}) {
    if (!baseUrl) {
      throw new Error("The 'baseUrl' parameter is required.");
    }
    this.options = {
      menu: {
        jsonApiMenuItems: false
      },
      ...options
    };
    this.druxt = options.druxtClient || new DruxtClient(baseUrl, options);
  }
  buildQuery(resource, menuName, requiredFields, settings) {
    const query = new DrupalJsonApiParams().addFilter("enabled", "1").addFilter("menu_name", menuName);
    let fields = [];
    if ((settings || {}).requiredOnly) {
      fields = [...requiredFields];
    }
    if (Array.isArray((settings || {}).fields)) {
      fields = [...settings.fields, ...requiredFields];
    }
    if (fields.length) {
      query.addFields(resource, fields);
    }
    return query;
  }
  buildMenuLinkContentQuery(menuName, settings) {
    const requiredFields = ["bundle", "link", "menu_name", "parent", "title", "weight"];
    return this.buildQuery("menu_link_content--menu_link_content", menuName, requiredFields, settings);
  }
  buildJsonApiMenuItemsQuery(menuName, settings) {
    const requiredFields = ["menu_name", "parent", "title", "url", "weight"];
    const query = this.buildQuery("menu_link_content--menu_link_content", menuName, requiredFields, settings);
    if ((settings || {}).max_depth) {
      query.addFilter("max_depth", parseInt(settings.max_depth));
    }
    if ((settings || {}).min_depth) {
      query.addFilter("min_depth", parseInt(settings.min_depth));
    }
    if ((settings || {}).parent) {
      query.addFilter("parent", settings.parent);
    }
    return query;
  }
  async get(menuName, settings, prefix) {
    if (!menuCache.has(this.druxt))
      menuCache.set(this.druxt, new Map());
    const cache = menuCache.get(this.druxt);
    const generation = this.druxt.cacheGeneration || 0;
    if (cache.generation !== generation) {
      cache.clear();
      cache.generation = generation;
    }
    const jsonApiMenuItems = !!this.options.menu.jsonApiMenuItems;
    const query = jsonApiMenuItems ? this.buildJsonApiMenuItemsQuery(menuName, settings) : this.buildMenuLinkContentQuery(menuName, settings);
    const cacheKey = JSON.stringify([prefix || "", menuName, jsonApiMenuItems, query.getQueryString()]);
    if (!cache.has(cacheKey)) {
      const processCache = (scope) => typeof this.druxt.processCache === "function" ? this.druxt.processCache(scope) : null;
      const sharedKey = JSON.stringify([this.druxt.indexKey, cacheKey]);
      const shared = processCache("menu");
      const stored = shared && shared.get(sharedKey);
      const since = shared ? shared.generation : void 0;
      const request = stored ? Promise.resolve(stored) : (jsonApiMenuItems ? this.getJsonApiMenuItems(menuName, settings, prefix) : this.getMenuLinkContent(menuName, settings, prefix)).then((result) => {
        const after = processCache("menu");
        if (after)
          after.set(sharedKey, result, lifetimes.get(result) || 0, since);
        return result;
      });
      cache.set(cacheKey, request);
      request.catch(() => cache.delete(cacheKey));
      if (!runtime.isServer()) {
        const drop = () => {
          if (cache.get(cacheKey) === request)
            cache.delete(cacheKey);
        };
        request.then(drop, drop);
      }
    }
    return cache.get(cacheKey);
  }
  withLifetime(result, collections) {
    const lifetime = (collection) => typeof this.druxt.cacheLifetime === "function" ? this.druxt.cacheLifetime(collection) : 0;
    lifetimes.set(result, collections.length ? Math.min(...collections.map(lifetime)) : 0);
    return result;
  }
  async getMenuLinkContent(menuName, settings, prefix) {
    const resource = "menu_link_content--menu_link_content";
    const query = this.buildMenuLinkContentQuery(menuName, settings);
    const entities = [];
    const collections = await this.druxt.getCollectionAll(resource, query, prefix);
    for (const collection of collections) {
      for (const entity of collection.data) {
        entities.push(entity);
      }
    }
    return this.withLifetime({ entities }, collections);
  }
  async getJsonApiMenuItems(menuName, settings, prefix) {
    const menuItemsResource = `menu_items--${menuName}`;
    await this.druxt.getIndex(void 0, prefix);
    if (!(this.druxt.index[prefix][menuItemsResource] || {}).href) {
      this.druxt.index[prefix][menuItemsResource] = { href: `${prefix || ""}${this.druxt.options.endpoint}/menu_items/${menuName}` };
    }
    const query = this.buildJsonApiMenuItemsQuery(menuName, settings);
    const entities = [];
    let collections = [];
    try {
      collections = await this.druxt.getCollectionAll(menuItemsResource, query, prefix);
    } catch (e) {
      return { entities };
    }
    for (const collection of collections) {
      for (const entity of collection.data) {
        entities.push({
          ...entity,
          attributes: {
            ...entity.attributes,
            link: {
              uri: `internal:${entity.attributes.url}`
            },
            parent: entity.attributes.parent || null
          }
        });
      }
    }
    return this.withLifetime({ entities }, collections);
  }
}

const DruxtMenuStore = ({ store }) => {
  if (typeof store === "undefined") {
    throw new TypeError("Vuex store not found.");
  }
  const namespace = "druxtMenu";
  const module = {
    namespaced: true,
    state: () => ({
      entities: {}
    }),
    mutations: {
      addEntities(state, { entities, prefix }) {
        if (!state.entities[prefix])
          Vue.set(state.entities, prefix, {});
        for (const index in entities) {
          const entity = entities[index];
          Vue.set(state.entities[prefix], entity.id, entity);
        }
      },
      flushEntities(state, { prefix }) {
        if (!prefix || typeof state.entities !== "object")
          Vue.set(state, "entities", {});
        if (prefix)
          Vue.set(state.entities, prefix, {});
      }
    },
    actions: {
      async get({ commit }, context) {
        const { name, settings, prefix } = typeof context === "object" ? context : { name: context };
        const { entities } = await this.$druxtMenu.get(name, settings, prefix) || {};
        commit("addEntities", { entities, prefix });
      }
    },
    getters: {
      getEntitiesByFilter: (state) => ({ filter, prefix }) => {
        const keys = Object.keys((state.entities || {})[prefix]).filter((key) => filter(key));
        if (!keys.length)
          return {};
        return Object.assign(...keys.map((key) => ({ [key]: state.entities[prefix][key] })));
      }
    }
  };
  store.registerModule(namespace, module, {
    preserveState: Boolean(store.state[namespace])
  });
};

const DruxtMenuMixin = {
  props: {
    items: {
      type: Array,
      required: true
    },
    langcode: {
      type: String,
      default: void 0
    },
    parentId: {
      type: String,
      default: null
    }
  }
};

export { DruxtMenu, DruxtMenuMixin, DruxtMenuStore, DruxtMenuNuxtModule as default };
