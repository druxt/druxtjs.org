'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const fs = require('fs');
const path = require('path');
const drupalJsonapiParams = require('drupal-jsonapi-params');
const druxt = require('druxt');

const extendComponent = (component) => ({ ...component, isAsync: false });
const DruxtRouterNuxtModule = async function(moduleOptions = {}) {
  const options = {
    baseUrl: moduleOptions.baseUrl,
    ...(this.options || {}).druxt || {},
    router: {
      pages: await fs.existsSync(path.resolve(this.options.srcDir, this.options.dir.pages)),
      wildcard: true,
      ...((this.options || {}).druxt || {}).router,
      ...moduleOptions
    }
  };
  await this.addModule(["druxt", options]);
  this.nuxt.hook("components:dirs", (dirs) => {
    dirs.push({ path: path.join(__dirname, "../dist/components"), extendComponent });
  });
  if (options.router.wildcard) {
    if (!options.router.pages) {
      this.nuxt.hook("build:before", () => this.nuxt.options.build.createRoutes = () => []);
    }
    this.addTemplate({
      src: path.resolve(__dirname, "../templates/component.js"),
      fileName: "components/druxt-router.js",
      options
    });
    let languages = [];
    const druxt$1 = new druxt.DruxtClient(options.baseUrl, {
      ...options,
      proxy: { ...options.proxy || {}, api: false }
    });
    const languageResourceType = "configurable_language--configurable_language";
    if ((await druxt$1.getIndex(languageResourceType) || {}).href) {
      const query = new drupalJsonapiParams.DrupalJsonApiParams().addFields(languageResourceType, ["drupal_internal__id"]);
      languages = (await druxt$1.getCollectionAll(languageResourceType, query) || []).map((o) => o.data).flat().filter((o) => !["und", "zxx"].includes(((o || {}).attributes || {}).drupal_internal__id));
    }
    this.extendRoutes((routes) => {
      languages.filter((o) => o).forEach((o) => {
        routes.push({
          name: `druxt-router__${o.attributes.drupal_internal__id}`,
          path: `/${o.attributes.drupal_internal__id}*`,
          component: path.resolve(this.options.buildDir, "components/druxt-router.js"),
          chunkName: "druxt-router",
          meta: { langcode: o.attributes.drupal_internal__id }
        });
      });
      routes.push({
        name: "druxt-router",
        path: "*",
        component: path.resolve(this.options.buildDir, "components/druxt-router.js"),
        chunkName: "druxt-router"
      });
    });
  }
  this.addPlugin({
    src: path.resolve(__dirname, "../templates/plugin.js"),
    fileName: "druxt-router.js",
    options
  });
  this.addPlugin({
    src: path.resolve(__dirname, "../templates/store.js"),
    fileName: "store/druxt-router.js",
    options
  });
  this.nuxt.hook("storybook:config", async ({ stories }) => {
    this.addTemplate({
      src: path.resolve(__dirname, "../templates/druxt-router.stories.js"),
      fileName: "stories/druxt-router.stories.js",
      options: {}
    });
    stories.push(path.resolve(this.options.buildDir, "./stories/druxt-router.stories.js"));
  });
};
DruxtRouterNuxtModule.meta = require("../package.json");

exports["default"] = DruxtRouterNuxtModule;
