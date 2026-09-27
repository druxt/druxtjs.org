'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const path = require('path');

const extendComponent = (component) => ({ ...component, isAsync: false });
const DruxtBreadcrumbModule = async function(moduleOptions = {}) {
  const options = {
    baseUrl: moduleOptions.baseUrl,
    ...(this.options || {}).druxt || {},
    breadcrumb: {
      ...((this.options || {}).druxt || {}).breadcrumb,
      ...moduleOptions
    }
  };
  await this.addModule(["druxt", options]);
  await this.addModule(["druxt-router/nuxt", options]);
  this.nuxt.hook("components:dirs", (dirs) => {
    dirs.push({ path: path.join(__dirname, "components"), extendComponent });
    dirs.push({ path: path.join(__dirname, "components/blocks"), extendComponent });
  });
  this.nuxt.hook("storybook:config", ({ stories }) => {
    this.addTemplate({
      src: path.resolve(__dirname, "../templates/druxt-breadcrumb.stories.js"),
      fileName: "stories/druxt-breadcrumb.stories.js"
    });
    stories.push(path.resolve(this.options.buildDir, "./stories/druxt-breadcrumb.stories.js"));
  });
};
DruxtBreadcrumbModule.meta = require("../package.json");

const DruxtBreadcrumbMixin = {
  props: {
    crumbs: {
      type: Array,
      require: true
    },
    langcode: {
      type: String,
      default: void 0
    }
  }
};

exports.DruxtBreadcrumbMixin = DruxtBreadcrumbMixin;
exports["default"] = DruxtBreadcrumbModule;
