import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { DrupalJsonApiParams } from 'drupal-jsonapi-params';
import { DruxtClient } from 'druxt';

const titleFn = (parts) => parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, " ")).join("/");
async function DruxtSiteStorybook({ options, stories }) {
  const { addTemplate } = this;
  const druxt = new DruxtClient(options.baseUrl, { ...options, proxy: { api: false } });
  const type = "block--block";
  const query = new DrupalJsonApiParams().addFields(type, ["theme"]);
  const resources = (await druxt.getCollectionAll(type, query)).map((collection) => collection.data).flat();
  const themes = [...new Set(resources.map((o) => o.attributes.theme))].sort();
  addTemplate({
    src: resolve(__dirname, `../templates/druxt-site.stories.js`),
    fileName: `stories/druxt-site.stories.js`,
    options: { themes }
  });
  themes.forEach((theme) => {
    addTemplate({
      src: resolve(__dirname, "../templates/druxt-site.instance.stories.js"),
      fileName: `stories/druxt-site.${theme}.stories.js`,
      options: {
        theme,
        title: titleFn(["Druxt", "Site", "Themes", theme])
      }
    });
  });
  stories.push(resolve(this.options.buildDir, "./stories/druxt-site.stories.js"));
  stories.push(resolve(this.options.buildDir, "./stories/druxt-site.*.stories.js"));
}

const extendComponent = (component) => ({ ...component, isAsync: false });
const DruxtSiteNuxtModule = async function(moduleOptions = {}) {
  const options = {
    baseUrl: moduleOptions.baseUrl,
    ...(this.options || {}).druxt || {},
    proxy: {
      api: false,
      files: true,
      ...((this.options || {}).druxt || {}).proxy
    },
    site: {
      layout: true,
      ...((this.options || {}).druxt || {}).site,
      ...moduleOptions
    }
  };
  this.options.druxt = options;
  this.nuxt.hook("components:dirs", (dirs) => {
    dirs.push({ path: join(__dirname, "components"), extendComponent });
  });
  const druxtModules = [
    "druxt",
    "druxt-blocks",
    "druxt-breadcrumb",
    "druxt-entity",
    "druxt-menu",
    "druxt-router/nuxt",
    "druxt-schema",
    "druxt-views"
  ];
  for (const module of druxtModules) {
    await this.addModule(module);
  }
  if (!await existsSync(resolve(this.options.srcDir, this.options.dir.layouts)) && options.site.layout) {
    this.addLayout(resolve(__dirname, "./layouts/default.vue"), "default");
  }
  this.nuxt.hook("storybook:config", async ({ stories }) => {
    await DruxtSiteStorybook.call(this, { options, stories });
  });
};
DruxtSiteNuxtModule.meta = require("../package.json");

const DruxtSiteMixin = {
  props: {
    langcode: {
      type: String,
      default: void 0
    },
    props: {
      type: Object,
      default: () => ({})
    },
    regions: {
      type: Array,
      default: () => []
    },
    theme: {
      type: String,
      required: true
    }
  }
};

export { DruxtSiteMixin, DruxtSiteNuxtModule as default };
