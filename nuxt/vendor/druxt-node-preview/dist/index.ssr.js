'use strict';

const path = require('path');

const toOrigin = (url) => {
  try {
    const { origin, protocol } = new URL(url);
    return ["http:", "https:"].includes(protocol) ? origin : null;
  } catch (e) {
    return null;
  }
};
const warn = (message) => console.warn("[druxt-node-preview] " + message);
const toInclude = (value) => {
  const paths = (list, where) => {
    if (!Array.isArray(list)) {
      warn(`Ignored the include option${where}. Use a list of paths, such as ['field_content.field_media'].`);
      return [];
    }
    return list.filter((path) => {
      if (typeof path === "string" && /^[A-Za-z0-9_.-]+$/.test(path)) return true;
      warn(`Ignored the include path ${JSON.stringify(path)}${where}. Use field names joined by dots, such as "field_content.field_media".`);
      return false;
    });
  };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).filter(([type]) => {
      if (/^[A-Za-z0-9_]+--[A-Za-z0-9_]+$/.test(type)) return true;
      warn(`Ignored the include key "${type}". Key paths by JSON:API type, such as "node--page".`);
      return false;
    }).map(([type, list]) => [type, paths(list, ` for ${type}`)]));
  }
  return paths(value, "");
};
const toLayouts = (value) => {
  if (!Array.isArray(value)) {
    warn("Ignored the layouts option. Use a list of layout names, such as ['preview'].");
    return [];
  }
  return value.filter((name) => {
    if (typeof name === "string" && /^[A-Za-z0-9_-]+$/.test(name)) return true;
    warn(`Ignored the layout ${JSON.stringify(name)}. Use the name of a file in layouts/, such as "preview". A layout in a subfolder cannot be listed.`);
    return false;
  });
};
const NuxtModule = function(moduleOptions = {}) {
  const druxt = (this.options || {}).druxt || {};
  const options = {
    path: "/druxt/node/preview",
    include: [],
    origins: [],
    layouts: [],
    ...druxt.nodePreview || {},
    ...moduleOptions
  };
  this.options.store = true;
  this.addTemplate({
    src: path.resolve(__dirname, "../templates/DruxtNodePreview.vue"),
    fileName: "components/druxt-node-preview.vue"
  });
  const { dst } = this.addTemplate({
    src: path.resolve(__dirname, "../templates/DruxtNodePreviewPage.vue"),
    fileName: "components/druxt-node-preview-page.vue"
  });
  this.extendRoutes((routes, resolveRoute) => {
    routes.unshift({
      name: "druxt-node-preview",
      path: options.path,
      component: resolveRoute(this.options.buildDir, dst)
    });
  });
  if (!Array.isArray(options.origins)) {
    warn("Ignored the origins option. Use a list of full http(s) URLs, such as ['https://cms.example.com'].");
  }
  const listed = (Array.isArray(options.origins) ? options.origins : []).filter((url) => {
    if (toOrigin(url)) return true;
    warn(`Ignored the origin "${url}". Use a full http(s) URL, such as "https://cms.example.com".`);
    return false;
  });
  const pluginOptions = {
    include: toInclude(options.include),
    origins: [],
    layouts: toLayouts(options.layouts)
  };
  const setOrigins = () => {
    const baseUrl = ((this.options || {}).druxt || {}).baseUrl;
    pluginOptions.origins = [...new Set([baseUrl, ...listed].map(toOrigin).filter(Boolean))];
  };
  setOrigins();
  if (this.nuxt) this.nuxt.hook("modules:done", setOrigins);
  this.addPlugin({
    src: path.resolve(__dirname, "../templates/plugin.js"),
    fileName: "druxt-node-preview.js",
    options: pluginOptions
  });
};

module.exports = NuxtModule;
