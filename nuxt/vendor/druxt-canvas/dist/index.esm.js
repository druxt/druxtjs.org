import { join } from 'path';

const DruxtCanvasComponentMixin = {
  inheritAttrs: false,
  /** */
  props: {
    /**
     * The component instance: `uuid`, `componentId`, `componentVersion`,
     * `label`, `inputs` (by their Canvas names) and `slots` (the slot names).
     *
     * @type {object}
     */
    canvas: {
      type: Object,
      default: () => ({})
    }
  }
};

const camelCase = (key) => (
  // The character after a separator run is optional, so a run with no letter
  // or digit after it matches as it is, and is kept. A required one would make
  // the match fail and be retried from every separator in the run.
  String(key).replace(
    /[_-]+([a-zA-Z0-9]?)/g,
    (run, c) => c ? c.toUpperCase() : run
  )
);
const getInputs = (item) => item.inputs_resolved && typeof item.inputs_resolved === "object" ? item.inputs_resolved : {};
const getProps = (inputs) => Object.keys(inputs || {}).reduce((props, key) => {
  props[camelCase(key)] = inputs[key];
  return props;
}, {});
const buildCanvasTree = (items, { warn } = {}) => {
  const report = typeof warn === "function" ? warn : () => {
  };
  const list = Array.isArray(items) ? items : [];
  const nodes = /* @__PURE__ */ new Map();
  const valid = [];
  for (const item of list) {
    if (!item || !item.uuid || !item.component_id) {
      report({ reason: "invalid", item });
      continue;
    }
    if (nodes.has(item.uuid)) {
      report({ reason: "duplicate", item });
      continue;
    }
    const inputs = getInputs(item);
    nodes.set(item.uuid, {
      uuid: item.uuid,
      componentId: item.component_id,
      componentVersion: item.component_version || null,
      label: item.label || null,
      inputs,
      props: getProps(inputs),
      slots: {}
    });
    valid.push(item);
  }
  const roots = [];
  const placed = [];
  for (const item of valid) {
    const node = nodes.get(item.uuid);
    if (!item.parent_uuid) {
      roots.push(node);
      continue;
    }
    const parent = nodes.get(item.parent_uuid);
    if (!parent) {
      report({ reason: "orphan", item });
      continue;
    }
    if (!item.slot) {
      report({ reason: "slot", item });
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(parent.slots, item.slot)) {
      Object.defineProperty(parent.slots, item.slot, {
        configurable: true,
        enumerable: true,
        value: [],
        writable: true
      });
    }
    parent.slots[item.slot].push(node);
    placed.push(item);
  }
  const reached = /* @__PURE__ */ new Set();
  const walk = (node) => {
    reached.add(node.uuid);
    for (const children of Object.values(node.slots)) children.forEach(walk);
  };
  roots.forEach(walk);
  for (const item of placed) {
    if (!reached.has(item.uuid)) report({ reason: "cycle", item });
  }
  return roots;
};
const getComponentParts = (componentId) => String(componentId || "").split(".").filter((part) => part);

const getHead = (metatag) => {
  const head = { meta: [], link: [] };
  for (const item of Array.isArray(metatag) ? metatag : []) {
    const { tag, attributes } = item || {};
    if (!attributes) continue;
    if (tag === "meta" && attributes.name === "title") {
      head.title = attributes.content;
    } else if (tag === "meta") {
      head.meta.push({
        hid: attributes.name || attributes.property || attributes["http-equiv"],
        ...attributes
      });
    } else if (tag === "link") {
      head.link.push({ hid: attributes.rel, ...attributes });
    }
  }
  return head;
};

const hasComponent = (vm, name) => !!((vm.$options || {}).components || {})[name];
const renderBlock = (h, { label, labelDisplay, content, uuid }) => h(
  "div",
  {
    attrs: { "data-canvas-uuid": uuid }
  },
  [
    labelDisplay === "visible" && label ? h("h2", [label]) : null,
    content
  ].filter((o) => o)
);
const renderDebug = (h, summary, uuid) => h("DruxtDebug", {
  attrs: uuid ? { "data-canvas-uuid": uuid } : void 0,
  props: { summary }
});

const extendComponent = (component) => ({ ...component, isAsync: false });
const blockMappings = {
  DruxtCanvasBlockSystemBreadcrumbBlock: "DruxtBreadcrumb",
  DruxtCanvasBlockSystemMenuBlock: "DruxtMenu",
  DruxtCanvasBlockViewsBlock: "DruxtView"
};
const DruxtCanvasNuxtModule = function(moduleOptions = {}) {
  this.nuxt.hook("components:dirs", (dirs) => {
    dirs.push({
      path: join(__dirname, "components"),
      pathPrefix: false,
      level: 1,
      extendComponent
    });
  });
  const own = join(__dirname, "components");
  this.nuxt.hook("components:extend", (components) => {
    const names = new Set(components.map((component) => component.pascalName));
    for (let index = components.length - 1; index >= 0; index--) {
      const { filePath, pascalName } = components[index];
      const needs = blockMappings[pascalName];
      if (needs && !names.has(needs) && String(filePath).startsWith(own)) {
        components.splice(index, 1);
      }
    }
  });
};

export { DruxtCanvasComponentMixin, blockMappings, buildCanvasTree, camelCase, DruxtCanvasNuxtModule as default, getComponentParts, getHead, hasComponent, renderBlock, renderDebug };
