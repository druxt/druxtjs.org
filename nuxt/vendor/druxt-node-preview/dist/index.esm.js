import { resolve } from 'path';

const only = (list, pattern) => (Array.isArray(list) ? list : []).filter((item) => typeof item === "string" && pattern.test(item));
const toOrigins = (urls) => [...new Set(urls.flatMap((url) => {
  try {
    const { origin, protocol } = new URL(url);
    return ["http:", "https:"].includes(protocol) ? [origin] : [];
  } catch (e) {
    return [];
  }
}))];
const toInclude = (value) => {
  const paths = /^[A-Za-z0-9_.-]+$/;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).filter(([type]) => /^[A-Za-z0-9_]+--[A-Za-z0-9_]+$/.test(type)).map(([type, list]) => [type, only(list, paths)]));
  }
  return only(value, paths);
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
    src: resolve(__dirname, "../templates/DruxtNodePreview.vue"),
    fileName: "components/druxt-node-preview.vue"
  });
  const { dst } = this.addTemplate({
    src: resolve(__dirname, "../templates/DruxtNodePreviewPage.vue"),
    fileName: "components/druxt-node-preview-page.vue"
  });
  this.extendRoutes((routes, resolveRoute) => {
    routes.unshift({
      name: "druxt-node-preview",
      path: options.path,
      component: resolveRoute(this.options.buildDir, dst)
    });
  });
  this.addPlugin({
    src: resolve(__dirname, "../templates/plugin.js"),
    fileName: "druxt-node-preview.js",
    options: {
      include: toInclude(options.include),
      // The page fetches a preview only from its own origin, Druxt's Drupal
      // site, or an origin the site lists.
      origins: toOrigins([druxt.baseUrl, ...Array.isArray(options.origins) ? options.origins : []]),
      layouts: only(options.layouts, /^[A-Za-z0-9_-]+$/)
    }
  });
};

export { NuxtModule as default };
