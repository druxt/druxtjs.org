import { resolve, join } from 'path';
import { DrupalJsonApiParams } from 'drupal-jsonapi-params';
import { DruxtClient } from 'druxt';

const titleFn = (parts) => parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, " ")).join("/");
async function DruxtEntityStorybook({ stories }) {
  const { addTemplate, options } = this;
  const druxt = new DruxtClient(options.druxt.baseUrl, { ...options.druxt, proxy: { api: false } });
  const [view, form] = (await Promise.all(["view", "form"].map(async (type) => await druxt.getCollectionAll(`entity_${type}_display--entity_${type}_display`, new DrupalJsonApiParams().addFilter("status", 1).addFields(`entity_${type}_display--entity_${type}_display`, [
    "bundle",
    "mode",
    "targetEntityType"
  ]))))).map((schema) => schema.map((collection) => collection.data.map((o) => o)).flat());
  const schemas = [...view, ...form];
  const entityTypes = Array.from(new Set(schemas.map((o) => o.attributes.targetEntityType))).map((entity) => ({
    entity,
    bundles: Array.from(new Set(schemas.filter((o) => o.attributes.targetEntityType === entity).map((o) => o.attributes.bundle)))
  }));
  const entities = await Promise.all([
    ...entityTypes.map(({ entity, bundles }) => bundles.map(async (bundle) => {
      try {
        return {
          resourceType: `${entity}--${bundle}`,
          entities: (await druxt.getCollection(`${entity}--${bundle}`, new DrupalJsonApiParams().addFilter("status", 1).addFields(`${entity}--${bundle}`, ["id", "title", "name", "info"]))).data.map((o) => ({
            id: o.id,
            title: (o.attributes || {}).title || (o.attributes || {}).name || (o.attributes || {}).info || o.id
          }))
        };
      } catch (e) {
        return {
          resourceType: `${entity}--${bundle}`,
          entities: []
        };
      }
    })).flat()
  ]);
  addTemplate({
    src: resolve(__dirname, `../templates/druxt-entity.stories.js`),
    fileName: `stories/druxt-entity.stories.js`,
    options: { entityTypes }
  });
  stories.push(resolve(options.buildDir, `./stories/druxt-entity.stories.js`));
  addTemplate({
    src: resolve(__dirname, `../templates/druxt-entity-form.stories.js`),
    fileName: `stories/druxt-entity-form.stories.js`,
    options: { entityTypes }
  });
  stories.push(resolve(options.buildDir, `./stories/druxt-entity-form.stories.js`));
  entityTypes.forEach(({ entity, bundles }) => bundles.map((bundle) => {
    Object.entries({ view, form }).forEach(([type, schemas2]) => {
      const displays = Array.from(new Set(schemas2.filter((o) => o.attributes.targetEntityType === entity && o.attributes.bundle === bundle).map((o) => o.attributes.mode).sort((a) => a === "default" ? -1 : 0)));
      if (displays) {
        const resourceType = `${entity}--${bundle}`;
        const component = type === "view" ? "druxt-entity" : "druxt-entity-form";
        addTemplate({
          src: resolve(__dirname, `../templates/${component}.instance.stories.js`),
          fileName: `stories/${component}.${resourceType}.stories.js`,
          options: {
            displays,
            entities: entities.find((o) => o.resourceType === resourceType).entities,
            resourceType,
            title: titleFn(["Druxt", "Entity", entity, bundle, `${type} displays`])
          }
        });
        stories.push(resolve(options.buildDir, `./stories/${component}.${resourceType}.stories.js`));
      }
    });
  }));
}

const extendComponent = (component) => ({ ...component, isAsync: false });
const DruxtEntityNuxtModule = async function(moduleOptions = {}) {
  const options = {
    baseUrl: moduleOptions.baseUrl,
    ...(this.options || {}).druxt || {},
    entity: {
      query: {},
      ...((this.options || {}).druxt || {}).entity,
      ...moduleOptions,
      components: {
        fields: false,
        ...(((this.options || {}).druxt || {}).entity || {}).components,
        ...moduleOptions.components
      }
    }
  };
  await this.addModule(["druxt", options]);
  await this.addModule(["druxt-schema", { baseUrl: options.baseUrl }]);
  this.nuxt.hook("components:dirs", (dirs) => {
    dirs.push({
      path: join(__dirname, "components"),
      ignore: ["fields"],
      extendComponent
    });
    if (options.entity.components.fields) {
      dirs.push({ path: join(__dirname, "components/fields"), extendComponent });
    }
  });
  this.nuxt.hook("storybook:config", async ({ stories }) => {
    await DruxtEntityStorybook.call(this, { stories });
  });
};
DruxtEntityNuxtModule.meta = require("../package.json");

const DruxtEntityContextMixin = {
  props: {
    context: {
      type: Object,
      default: function() {
        return { ...this.$parent.context };
      }
    }
  }
};

const DruxtEntityComponentSuggestionMixin = {
  computed: {
    component() {
      for (const suggestion of this.suggestions) {
        if (typeof this.$options.components[suggestion] !== "undefined") {
          return suggestion;
        }
      }
      return "div";
    },
    suggestions() {
      const suggestions = [];
      for (const rule of this.suggestionRules) {
        let result = false;
        switch (typeof rule.value) {
          case "function":
            result = rule.value(this.tokenContext);
            if (result) {
              suggestions.push(result);
            }
            break;
          case "string":
            suggestions.push(rule.value);
            break;
        }
      }
      return suggestions;
    },
    suggestionRules() {
      const rules = [];
      if (this.$druxtEntity && Array.isArray(this.$druxtEntity.options.entity.suggestions)) {
        this.$druxtEntity.options.entity.suggestions.map((item) => {
          if (item.type === this.tokenType) {
            rules.push(item);
          }
        });
      }
      if (typeof this.suggestionDefaults !== "undefined") {
        this.suggestionDefaults.map((item) => {
          rules.push(item);
        });
      }
      return rules;
    },
    tokenContext() {
      return {
        route: this.$store.state.druxtRouter.route,
        tokens: this.tokens,
        ...this.props
      };
    },
    tokenType: () => false
  },
  methods: {
    suggest: (string) => typeof string === "string" ? string.replace(/((\b|[^a-zA-Z0-9]+)[a-zA-Z0-9])/gi, (match, p1, p2) => match.toUpperCase().replace(p2, "")) : false
  }
};

const DruxtEntityMixin = {
  mixins: [DruxtEntityContextMixin],
  props: {
    entity: {
      type: Object,
      require: true
    },
    fields: {
      type: [Object, Boolean],
      default: void 0
    },
    langcode: {
      type: String,
      default: void 0
    },
    schema: {
      type: Object,
      default: void 0
    },
    value: {
      type: Object,
      default: void 0
    }
  },
  data: ({ value }) => ({
    model: value
  }),
  computed: {
    classes: ({ schema }) => schema && [
      schema.id,
      schema.resourceType,
      schema.config.entityType,
      schema.config.bundle,
      schema.config.mode,
      schema.config.schemaType
    ].join(" ")
  }
};

const DruxtFieldMixin = {
  mixins: [
    DruxtEntityContextMixin
  ],
  props: {
    errors: {
      type: Array,
      default: () => []
    },
    langcode: {
      type: String,
      default: void 0
    },
    inner: {
      type: Object,
      default: () => ({
        component: "div",
        props: {}
      })
    },
    relationship: {
      type: Boolean,
      default: false
    },
    schema: {
      type: Object,
      required: true
    },
    value: {
      type: [Array, Boolean, Number, String, Object],
      default: void 0
    },
    wrapper: {
      type: Object,
      default: () => ({
        component: "div",
        props: {}
      })
    }
  },
  data: ({ value }) => ({
    model: value
  }),
  computed: {
    items: ({ model, relationship, schema }) => {
      if (typeof model === "undefined" || model === null)
        return [];
      if (relationship) {
        const items = Array.isArray(model.data) ? [...model.data] : [{ ...model.data }];
        return items.map((item) => ({
          type: item.type || (item.data || {}).type,
          uuid: item.id || (item.data || {}).id,
          mode: ((schema.settings || {}).display || {}).view_mode || "default"
        }));
      }
      return Array.isArray(model) ? [...model] : [model];
    }
  },
  watch: {
    model() {
      if (this.model !== this.value) {
        this.$emit("input", this.model);
      }
    },
    value() {
      if (this.model !== this.value) {
        this.model = this.value;
      }
    }
  }
};

export { DruxtEntityComponentSuggestionMixin, DruxtEntityContextMixin, DruxtEntityMixin, DruxtFieldMixin, DruxtEntityNuxtModule as default };
