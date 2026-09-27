import consola from 'consola';
import { resolve } from 'path';
import { DrupalJsonApiParams } from 'drupal-jsonapi-params';
import { DruxtClient } from 'druxt';
import { mapActions } from 'vuex';

const resourceCache = new WeakMap();
class Schema {
  constructor(config, { druxtSchema, data }) {
    if (config.resourceFields) {
      this.resourceFields = config.resourceFields;
      delete config.resourceFields;
    }
    this.config = {
      entityType: "node",
      bundle: null,
      mode: "default",
      schemaType: "view",
      filter: [],
      ...config
    };
    if (!this.id && this.config.resourceType) {
      this.id = [this.config.resourceType, this.config.mode, this.config.schemaType].join("--");
    }
    if (!this.id && this.config.bundle) {
      this.id = [this.config.entityType, this.config.bundle, this.config.mode, this.config.schemaType].join("--");
    }
    this.isValid = true;
    if ((this.config.filter || []).length > 0) {
      this.isValid = false;
      for (const filter of this.config.filter) {
        const match = this.id.match(filter);
        if (match) {
          this.isValid = true;
          break;
        }
      }
    }
    this.displayId = [this.config.entityType, this.config.bundle, this.config.mode].join(".");
    this.resourceType = [this.config.entityType, this.config.bundle].join("--");
    this.data = {};
    if (typeof data !== "undefined") {
      this.data[data.type] = data;
    }
    this.fields = {};
    this.druxtSchema = druxtSchema;
  }
  async generate() {
    return this[this.config.schemaType]();
  }
  async getResources(resource, query) {
    if (this.data[resource])
      return this.data[resource];
    const client = this.druxtSchema.druxt;
    if (!resourceCache.has(client))
      resourceCache.set(client, new Map());
    const cache = resourceCache.get(client);
    const cacheKey = JSON.stringify([resource, query]);
    if (!cache.has(cacheKey)) {
      const request = client.getCollection(resource, query);
      cache.set(cacheKey, request);
      request.catch(() => cache.delete(cacheKey));
    }
    return cache.get(cacheKey);
  }
  async form() {
    const entityFormDisplay = await this.getResources("entity_form_display--entity_form_display", { "filter[drupal_internal__id]": this.displayId }).then((res) => Array.isArray(res.data) ? res.data[0] : res);
    if (!entityFormDisplay)
      return false;
    const fieldConfig = await this.getResources("field_config--field_config", { "filter[entity_type]": this.config.entityType, "filter[bundle]": this.config.bundle });
    if (!fieldConfig)
      return false;
    const fieldStorageConfig = await this.getResources("field_storage_config--field_storage_config", { "filter[entity_type]": this.config.entityType });
    if (!fieldStorageConfig)
      return false;
    for (const field in entityFormDisplay.attributes.content) {
      const display = {
        id: null,
        label: null,
        type: null,
        weight: null,
        settings: {},
        third_party_settings: {},
        ...entityFormDisplay.attributes.content[field]
      };
      let config = { attributes: {}, ...fieldConfig.data.find((element) => element.attributes.field_name === field) };
      config = {
        description: null,
        label: null,
        required: false,
        settings: {},
        ...config.attributes
      };
      let storage = { attributes: {}, ...fieldStorageConfig.data.find((element) => element.attributes.field_name === field) };
      storage = {
        cardinality: null,
        settings: {},
        ...storage.attributes
      };
      let fieldName = field;
      if (this.resourceFields && this.resourceFields[field] && this.resourceFields[field].publicName !== field) {
        fieldName = this.resourceFields[field].publicName;
      }
      this.fields[fieldName] = {
        id: fieldName,
        description: config.description,
        label: {
          text: config.label,
          position: display.label
        },
        cardinality: storage.cardinality,
        required: config.required,
        type: display.type,
        weight: display.weight,
        settings: {
          config: config.settings,
          display: display.settings,
          storage: storage.settings
        },
        thirdPartySettings: display.third_party_settings
      };
    }
    this.schema = {
      id: this.id,
      resourceType: this.resourceType,
      fields: Object.values(this.fields).sort((a, b) => a.weight - b.weight),
      groups: [],
      config: this.config
    };
    return this.schema;
  }
  async view() {
    const entityViewDisplay = await this.getResources("entity_view_display--entity_view_display", { "filter[drupal_internal__id]": this.displayId }).then((res) => Array.isArray(res.data) ? res.data[0] : res);
    if (!entityViewDisplay)
      return false;
    const fieldConfig = await this.getResources("field_config--field_config", { "filter[entity_type]": this.config.entityType, "filter[bundle]": this.config.bundle });
    if (!fieldConfig)
      return false;
    for (const field in entityViewDisplay.attributes.content) {
      const display = {
        id: null,
        label: null,
        type: null,
        weight: null,
        settings: {},
        third_party_settings: {},
        ...entityViewDisplay.attributes.content[field]
      };
      let config = { attributes: {}, ...fieldConfig.data.find((element) => element.attributes.field_name === field) };
      config = {
        description: null,
        label: null,
        required: false,
        settings: {},
        ...config.attributes
      };
      let fieldName = field;
      if (this.resourceFields && this.resourceFields[field] && this.resourceFields[field].publicName !== field) {
        fieldName = this.resourceFields[field].publicName;
      }
      this.fields[fieldName] = {
        id: fieldName,
        description: config.description,
        label: {
          text: config.label,
          position: display.label
        },
        required: config.required,
        type: display.type,
        weight: display.weight,
        settings: {
          config: config.settings,
          display: display.settings
        },
        thirdPartySettings: display.third_party_settings
      };
    }
    this.schema = {
      id: this.id,
      resourceType: this.resourceType,
      fields: Object.values(this.fields).sort((a, b) => a.weight - b.weight),
      groups: [],
      config: this.config
    };
    return this.schema;
  }
}

class DruxtSchema {
  constructor(baseUrl, options = {}) {
    if (!baseUrl)
      throw new Error("The 'baseUrl' parameter is required.");
    this.options = {
      auth: {
        type: false
      },
      schema: {
        filter: []
      },
      ...options
    };
    this.druxt = new DruxtClient(baseUrl, this.options);
  }
  async get() {
    const index = await this.druxt.getIndex();
    const displays = (await Promise.all([
      ...["view", "form"].map(async (schemaType) => {
        const resourceType = `entity_${schemaType}_display--entity_${schemaType}_display`;
        const query = new DrupalJsonApiParams().addSort("drupal_internal__id");
        const result = await this.druxt.getCollectionAll(resourceType, query);
        try {
          result.forEach((collection) => this.druxt.checkPermissions({ data: collection }));
        } catch (err) {
          this.druxt.error(err);
        }
        return result.map((collection) => collection.data.filter((data) => !!data.attributes.status).map((data) => ({
          entityType: data.attributes.targetEntityType,
          bundle: data.attributes.bundle,
          mode: data.attributes.mode,
          schemaType,
          filter: this.options.schema.filter,
          ...index[[data.attributes.targetEntityType, data.attributes.bundle].join("--")]
        })));
      })
    ])).flat(2);
    const schemas = Object.fromEntries((await Promise.all(displays.map((config) => this.getSchema(config)))).filter((o) => o).map((schema) => [schema.id, schema.schema]));
    return { index, schemas };
  }
  async getSchema(config, options = {}) {
    const schema = new Schema(config, { druxtSchema: this, ...options });
    if (!schema.isValid) {
      return false;
    }
    await schema.generate();
    return schema;
  }
}

const DruxtSchemaNuxtModule = function(moduleOptions = {}) {
  const options = {
    baseUrl: moduleOptions.baseUrl,
    ...(this.options || {}).druxt || {},
    schema: {
      ...((this.options || {}).druxt || {}).schema || {},
      ...moduleOptions
    }
  };
  this.addPlugin({
    src: resolve(__dirname, "../templates/plugin.js"),
    fileName: "druxt-schema.js",
    options
  });
  this.options.store = true;
  this.addPlugin({
    src: resolve(__dirname, "../templates/store.js"),
    fileName: "store/druxt-schema.js",
    options
  });
  this.nuxt.hook("builder:prepared", async () => {
    const druxtSchema = new DruxtSchema(options.baseUrl, {
      ...options,
      proxy: { ...options.proxy || {}, api: false }
    });
    const { schemas } = await druxtSchema.get();
    if (!Object.entries(schemas).length) {
      throw new Error("No Druxt Schema files generated.\n Have you created any content types yet?");
    }
    for (const name in schemas) {
      const schema = schemas[name];
      if (typeof schema === "undefined")
        continue;
      this.addTemplate({
        src: resolve(__dirname, "../templates/schema.json"),
        fileName: `schemas/${name}.json`,
        options: { schema }
      });
    }
    consola.success("Druxt schema files generated");
  });
};
DruxtSchemaNuxtModule.meta = require("../package.json");

const DruxtSchemaMixin = {
  props: {
    mode: {
      type: String,
      default: "default"
    },
    schemaType: {
      type: String,
      default: void 0
    },
    type: {
      type: String,
      required: true
    }
  },
  async fetch() {
    this.schema = await this.getSchema({
      resourceType: this.type,
      mode: this.mode,
      schemaType: this.schemaType || "view"
    });
  },
  data: () => ({
    schema: false
  }),
  methods: {
    ...mapActions({
      getSchema: "druxtSchema/get"
    })
  }
};

const DruxtSchemaStore = ({ store }) => {
  if (typeof store === "undefined") {
    throw new TypeError("Vuex store not found.");
  }
  const namespace = "druxtSchema";
  const module = {
    namespaced: true,
    state: () => ({
      schemas: {}
    }),
    mutations: {
      addSchema(state, { id, schema }) {
        state.schemas[id] = schema;
      }
    },
    actions: {
      async get({ state, commit }, resource = {}) {
        resource = {
          id: null,
          resourceType: null,
          entityType: "node",
          bundle: null,
          mode: "default",
          schemaType: "view",
          ...resource
        };
        if (!resource.id && resource.resourceType) {
          resource.id = [resource.resourceType, resource.mode, resource.schemaType].join("--");
        }
        if (!resource.id && resource.bundle) {
          resource.id = [resource.entityType, resource.bundle, resource.mode, resource.schemaType].join("--");
        }
        if (!resource.id) {
          return false;
        }
        if (!state.schemas[resource.id]) {
          const schema = await this.$druxtSchema.import(resource.id);
          commit("addSchema", { id: resource.id, schema });
        }
        return state.schemas[resource.id];
      }
    }
  };
  store.registerModule(namespace, module, {
    preserveState: Boolean(store.state[namespace])
  });
};

export { DruxtSchema, DruxtSchemaMixin, DruxtSchemaStore, DruxtSchemaNuxtModule as default };
