'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const path = require('path');
const drupalJsonapiParams = require('drupal-jsonapi-params');
const druxt = require('druxt');

const titleFn = (parts) => parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, " ")).join("/");
async function DruxtBlocksStorybook({ stories }) {
  const { addTemplate, options } = this;
  const druxt$1 = new druxt.DruxtClient(options.druxt.baseUrl, { ...options.druxt, proxy: { api: false } });
  const query = new drupalJsonapiParams.DrupalJsonApiParams().addFilter("status", true);
  const blocks = (await druxt$1.getCollectionAll("block--block", query)).map((collection) => collection.data).flat();
  const themes = Array.from(new Set(blocks.map((o) => o.attributes.theme)));
  addTemplate({
    src: path.resolve(__dirname, `../templates/druxt-block.stories.js`),
    fileName: `stories/druxt-block.stories.js`,
    options: { blocks }
  });
  blocks.forEach((block) => {
    addTemplate({
      src: path.resolve(__dirname, `../templates/druxt-block.instance.stories.js`),
      fileName: `stories/druxt-block.${block.attributes.drupal_internal__id}.stories.js`,
      options: {
        block,
        title: titleFn(["Druxt", "Blocks", block.attributes.theme, block.attributes.region, block.attributes.drupal_internal__id])
      }
    });
  });
  addTemplate({
    src: path.resolve(__dirname, `../templates/druxt-block-region.stories.js`),
    fileName: `stories/druxt-block-region.stories.js`,
    options: {
      regions: Array.from(new Set(blocks.map((o) => o.attributes.region))),
      themes
    }
  });
  themes.forEach((theme) => {
    const regions = Array.from(new Set(blocks.filter((o) => o.attributes.theme === theme).map((o) => o.attributes.region)));
    regions.forEach((region) => {
      addTemplate({
        src: path.resolve(__dirname, `../templates/druxt-block-region.instance.stories.js`),
        fileName: `stories/druxt-block-region.${theme}.${region}.stories.js`,
        options: {
          region,
          title: titleFn(["Druxt", "Blocks", theme, region]),
          theme
        }
      });
    });
  });
  stories.push(path.resolve(options.buildDir, `./stories/druxt-block.stories.js`));
  stories.push(path.resolve(options.buildDir, `./stories/druxt-block-region.stories.js`));
  stories.push(path.resolve(options.buildDir, `./stories/druxt-block.*.stories.js`));
  stories.push(path.resolve(options.buildDir, `./stories/druxt-block-region.*.stories.js`));
}

const extendComponent = (component) => ({ ...component, isAsync: false });
const DruxtBlocksNuxtModule = async function(moduleOptions = {}) {
  const options = {
    baseUrl: moduleOptions.baseUrl,
    ...(this.options || {}).druxt || {},
    blocks: {
      query: {},
      ...((this.options || {}).druxt || {}).site,
      ...moduleOptions
    }
  };
  await this.addModule(["druxt", options]);
  this.nuxt.hook("components:dirs", (dirs) => {
    dirs.push({ path: path.join(__dirname, "components"), extendComponent });
    dirs.push({ path: path.join(__dirname, "components/blocks"), extendComponent });
  });
  this.nuxt.hook("storybook:config", async ({ stories }) => {
    await DruxtBlocksStorybook.call(this, { stories });
  });
};
DruxtBlocksNuxtModule.meta = require("../package.json");

const DruxtBlocksBlockMixin = {
  props: {
    block: {
      type: Object,
      require: true
    },
    langcode: {
      type: String,
      default: void 0
    }
  },
  computed: {
    settings() {
      return this.block.attributes.settings;
    }
  }
};

const DruxtBlocksRegionMixin = {
  props: {
    blocks: {
      type: Array,
      required: true
    },
    langcode: {
      type: String,
      default: void 0
    },
    name: {
      type: String,
      default: "content"
    },
    theme: {
      type: String,
      required: true
    }
  }
};

exports.DruxtBlocksBlockMixin = DruxtBlocksBlockMixin;
exports.DruxtBlocksRegionMixin = DruxtBlocksRegionMixin;
exports["default"] = DruxtBlocksNuxtModule;
