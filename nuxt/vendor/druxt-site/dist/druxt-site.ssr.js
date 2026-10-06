'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const fs = require('fs');
const path = require('path');
const drupalJsonapiParams = require('drupal-jsonapi-params');
const druxt = require('druxt');

const titleFn = (parts) => parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, " ")).join("/");
async function DruxtSiteStorybook({ options, stories }) {
  const { addTemplate } = this;
  const druxt$1 = new druxt.DruxtClient(options.baseUrl, { ...options, proxy: { api: false } });
  const type = "block--block";
  const query = new drupalJsonapiParams.DrupalJsonApiParams().addFields(type, ["theme"]);
  const resources = (await druxt$1.getCollectionAll(type, query)).map((collection) => collection.data).flat();
  const themes = [...new Set(resources.map((o) => o.attributes.theme))].sort();
  addTemplate({
    src: path.resolve(__dirname, `../templates/druxt-site.stories.js`),
    fileName: `stories/druxt-site.stories.js`,
    options: { themes }
  });
  themes.forEach((theme) => {
    addTemplate({
      src: path.resolve(__dirname, "../templates/druxt-site.instance.stories.js"),
      fileName: `stories/druxt-site.${theme}.stories.js`,
      options: {
        theme,
        title: titleFn(["Druxt", "Site", "Themes", theme])
      }
    });
  });
  stories.push(path.resolve(this.options.buildDir, "./stories/druxt-site.stories.js"));
  stories.push(path.resolve(this.options.buildDir, "./stories/druxt-site.*.stories.js"));
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
    dirs.push({ path: path.join(__dirname, "components"), extendComponent });
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
  if (!await fs.existsSync(path.resolve(this.options.srcDir, this.options.dir.layouts)) && options.site.layout) {
    this.addLayout(path.resolve(__dirname, "./layouts/default.vue"), "default");
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

exports.DruxtSiteMixin = DruxtSiteMixin;
exports["default"] = DruxtSiteNuxtModule;
