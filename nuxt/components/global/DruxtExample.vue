<template>
  <div data-testid="druxt-example" class="not-prose my-8 border border-base-300 rounded-lg bg-base-200 overflow-hidden text-base-content">
    <!-- Header: live dot, component, backend. -->
    <div class="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
      <span class="relative flex h-[7px] w-[7px]" aria-hidden="true">
        <span v-if="!error && live" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
        <span class="relative inline-flex h-[7px] w-[7px] rounded-full" :class="error ? 'bg-error' : live ? 'bg-success' : 'bg-base-300'" />
      </span>
      <span class="text-[10.5px] font-semibold uppercase tracking-[0.08em]" :class="error ? 'text-error' : 'text-base-content/70'">
        {{ error ? 'Not live' : 'Live' }}
      </span>

      <code v-if="fixed || picker.length === 1" class="text-[13px] text-primary-focus">&lt;{{ name }}&gt;</code>
      <label v-else class="flex items-center gap-2 text-sm">
        <span class="sr-only sm:not-sr-only text-base-content/70">Component</span>
        <!-- Capped: the disabled options' reasons would otherwise set the width. -->
        <select v-model="name" data-testid="component" class="select select-sm select-bordered h-[30px] min-h-0 rounded-md w-[15rem] max-w-full text-base lg:text-sm">
          <option value="" disabled>Pick one</option>
          <optgroup v-for="g in pickerGroups" :key="g.pkg" :label="g.pkg">
            <option v-for="n in g.names" :key="n" :value="n">{{ n }}</option>
          </optgroup>
        </select>
      </label>

      <!-- Right on a wide band; left under the picker when the band wraps. -->
      <label v-if="live" class="sm:ml-auto flex items-center gap-2 text-sm">
        <span class="text-base-content/70">Backend</span>
        <select data-testid="backend" class="select select-sm select-bordered h-[30px] min-h-0 rounded-md text-base lg:text-sm" :value="customOpen ? 'other' : backend" @change="pickBackend($event.target.value)">
          <!-- Short, so the reason never widens the select on a phone; the reason is said below. -->
          <option v-for="(b, key) in backends" :key="key" :value="key" :disabled="!available(key)">
            {{ b.label }}{{ available(key) ? '' : ' (n/a)' }}
          </option>
          <option value="other">Your own Drupal</option>
        </select>
      </label>
    </div>

    <!-- A reader's Drupal: its origin, checked for what it offers before it is used. -->
    <form v-if="live && customOpen" class="flex flex-wrap items-center gap-2 px-3.5 pb-2.5 text-sm" data-testid="custom-backend" @submit.prevent="useCustom">
      <input v-model="customInput" type="url" aria-label="The origin of your Drupal" placeholder="https://drupal.example" class="input input-sm input-bordered h-[30px] min-h-0 rounded-md w-full sm:w-[260px] font-mono text-base lg:text-[12.5px]" :disabled="customBusy" />
      <button type="submit" class="btn btn-sm btn-outline h-[30px] min-h-0" :disabled="customBusy || !customInput">{{ customBusy ? 'Checking' : 'Use it' }}</button>
      <p class="basis-full text-[11.5px]" :class="customError ? 'text-error' : 'text-base-content/70'" role="status">
        {{ customError || 'The browser talks to it directly, so it has to allow this origin (CORS in its services.yml). What it lacks greys out the components that need it.' }}
      </p>
    </form>
    <!-- Why a backend is greyed out: the option's title, said in text. -->
    <p v-if="live && unavailable" class="px-3.5 pb-2 -mt-1 text-[11.5px] text-base-content/70">{{ unavailable }}</p>

    <!-- A component that is not live on its own: one line, and a way in. -->
    <div v-if="name && !live" class="border-t border-base-300 bg-base-100 px-3.5 py-3 text-sm">
      <template v-if="contextOnly">
        <span class="text-base-content/70">Rendered by its parent.</span>
        <NuxtLink v-if="contextOnly.parent && pageFor(contextOnly.parent)" :to="pageFor(contextOnly.parent)" class="text-primary-focus ml-1">See {{ contextOnly.parent }}</NuxtLink>
        <span v-else class="ml-1 text-base-content/70">{{ contextOnly.reason }}.</span>
      </template>
      <template v-else-if="shipped">
        <span class="text-base-content/70">Shown by</span>
        <NuxtLink v-if="pageFor(shipped.by)" :to="pageFor(shipped.by)" class="text-primary-focus mx-1">{{ shipped.by }}</NuxtLink>
        <span class="text-base-content/70">when {{ shipped.when }}.</span>
      </template>
    </div>

    <template v-if="live">
      <!-- Which wrapper Druxt chose; the `wrapper` prop row below turns it off. -->
      <div class="flex items-center gap-3 px-3.5 py-2 bg-base-100 border-t border-base-300">
        <span data-testid="matched" class="text-[11px] font-mono text-base-content/70 truncate">
          <template v-if="!wrapper">No wrapper: {{ name }} renders the data only</template>
          <template v-else-if="resolution.is && resolution.is !== 'DruxtWrapper'">{{ resolution.is }} matched</template>
          <template v-else-if="resolution.is">No component matched; Druxt used its own wrapper</template>
          <template v-else>resolving</template>
        </span>
      </div>

      <!-- The instance: the only band on base-100. Capped and scrolling, so nothing lies over the output. -->
      <div data-testid="preview" class="druxt-preview bg-base-100 border-t border-base-300 px-[18px] py-5 max-h-[380px] overflow-y-auto">
        <div v-if="error" class="text-sm">
          <p class="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-error">Backend not responding</p>
          <p class="mt-1 text-base-content/70">{{ backends[backend].label }} did not answer. The controls keep their values, so nothing is lost.</p>
          <p class="mt-2 font-mono text-[12px] text-base-content/70">{{ error }}</p>
          <button type="button" class="btn btn-sm btn-outline mt-3" @click="retry">Try again</button>
        </div>

        <template v-else>
          <!-- Raw and empty: Druxt rendered nothing, which is the point. -->
          <div v-if="!wrapper && rawEmpty" class="border border-dashed border-base-300 rounded-md px-[18px] py-4 text-sm mb-4">
            <p class="flex items-center gap-2">
              <span class="font-mono text-[11px] text-base-content/70">NOTHING RENDERED</span>
              <span class="text-[10.5px] font-semibold uppercase tracking-[0.08em] bg-base-200 rounded px-1.5 py-0.5">Expected</span>
            </p>
            <p class="mt-2 text-base-content/70">With the wrapper off, Druxt hands the data straight to the page and renders no markup of its own. This is what an unwrapped component looks like.</p>
            <a href="/explanation/component-resolution" class="text-primary-focus text-[12.5px]">How wrapper resolution works</a>
          </div>

          <!-- The real instance, wrapped or raw, mounted under a runtime for the chosen backend. Raw is Druxt's own output, only styled. -->
          <client-only>
            <div ref="stage" :class="wrapper ? '' : 'druxt-raw'" @click.capture="inert">
              <p v-if="!primed" class="text-sm text-base-content/70">loading</p>
              <!-- The runtime's root goes in here; nothing else does, so Vue leaves it alone. -->
              <div ref="mount" />
            </div>
          </client-only>
        </template>
      </div>

      <!-- Props panel: the props table, live. -->
      <div class="border-t border-base-300 px-[18px] pt-3 pb-4">
        <p class="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-base-content/70">
          Props <span class="normal-case tracking-normal font-normal text-[12px] ml-2">live: every change re-renders above</span>
        </p>

        <!-- Dependent chain, one row. -->
        <div v-if="schema.chain" class="druxt-props-row gap-x-4 gap-y-2 py-2.5 border-t border-base-300 mt-2">
          <div>
            <p class="font-mono text-[12.5px]" :class="dirtyChain ? 'font-medium' : ''">{{ schema.chain.label }}</p>
            <p class="text-[11.5px] text-base-content/70">{{ schema.chain.description }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <template v-for="(step, i) in schema.chain.steps">
              <span v-if="i" :key="step.name + ':sep'" class="text-base-content/50 hidden sm:inline">›</span>
              <select
                :key="step.name"
                :data-testid="'step-' + step.name"
                :aria-label="step.name"
                class="select select-sm select-bordered h-[30px] min-h-0 rounded-md font-mono text-base lg:text-[12.5px] w-full sm:w-auto sm:max-w-full"
                :value="values[step.name] || ''"
                :disabled="!stepEnabled(step)"
                @change="setStep(i, $event.target.value)"
              >
                <option v-if="!values[step.name]" value="" disabled>{{ loadingOf(step) ? 'loading' : 'choose' }}</option>
                <option v-for="o in optionsOf(step)" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </template>
          </div>
        </div>

        <!-- Plain rows: the component's own, then the shared DruxtModule props. -->
        <div v-for="prop in rows" :key="prop.name" class="druxt-props-row gap-x-4 gap-y-2 py-2.5 border-t border-base-300">
          <div>
            <p class="font-mono text-[12.5px]" :class="isDirty(prop) ? 'font-medium' : ''">{{ prop.name }}</p>
            <p class="text-[11.5px] text-base-content/70">{{ prop.type }}<template v-if="prop.default !== undefined && prop.default !== null">, {{ prop.default }}</template></p>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-sm">
            <span v-if="prop.control === 'code'" class="text-[12.5px] text-base-content/70 italic">set in code</span>
            <div v-else-if="prop.control === 'segmented'" class="flex h-[30px] rounded-md border border-base-300 bg-base-100 p-0.5 text-[12.5px]" role="group" :aria-label="prop.name">
              <button v-for="o in prop.options" :key="o" type="button" class="px-3 rounded" :class="(values[prop.name] || prop.default) === o ? 'bg-base-200 font-semibold' : 'text-base-content/70'" :disabled="fixedValues[prop.name] !== undefined" @click="setValue(prop.name, o)">
                {{ o.charAt(0).toUpperCase() + o.slice(1) }}
              </button>
            </div>
            <span v-else-if="prop.control === 'select' && !loading[prop.source] && !ungrouped(prop).length" class="text-[12.5px] text-base-content/70 italic">{{ prop.name === 'langcode' ? 'one language on this backend' : 'nothing to choose on this backend' }}</span>
            <select v-else-if="prop.control === 'select'" :data-testid="'prop-' + prop.name" :aria-label="prop.name" class="select select-sm select-bordered h-[30px] min-h-0 rounded-md w-full sm:w-[200px] font-mono text-base lg:text-[12.5px]" :value="values[prop.name] || ''" @change="setValue(prop.name, $event.target.value)">
              <option v-if="!values[prop.name]" value="" disabled>{{ loading[prop.source] ? 'loading' : 'choose' }}</option>
              <template v-if="grouped(prop).length">
                <optgroup v-for="g in grouped(prop)" :key="g.group" :label="g.group">
                  <option v-for="o in g.items" :key="o.value" :value="o.value">{{ o.label }}<template v-if="o.suffix"> {{ o.suffix }}</template></option>
                </optgroup>
              </template>
              <option v-for="o in ungrouped(prop)" v-else :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <label v-else-if="prop.control === 'toggle'" class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" class="toggle toggle-sm toggle-primary" :aria-label="prop.name" :checked="toggleValue(prop)" @change="setValue(prop.name, $event.target.checked)" />
              <span class="text-[12px]">{{ toggleValue(prop) ? 'on' : 'off' }}</span>
            </label>
            <input v-else-if="prop.control === 'number'" type="number" :aria-label="prop.name" class="input input-sm input-bordered h-[30px] min-h-0 rounded-md w-[72px] font-mono text-base lg:text-[12.5px]" :placeholder="prop.default == null ? '' : String(prop.default)" :value="values[prop.name] == null ? '' : values[prop.name]" @change="setValue(prop.name, $event.target.value === '' ? undefined : Number($event.target.value))" />
            <input v-else type="text" :aria-label="prop.name" class="input input-sm input-bordered h-[30px] min-h-0 rounded-md w-full font-mono text-base lg:text-[12.5px]" :placeholder="prop.default == null ? '' : String(prop.default)" :value="values[prop.name] || ''" @change="setValue(prop.name, $event.target.value || undefined)" />
            <span v-if="prop.note" class="text-[12px] text-base-content/70">{{ prop.note }}</span>
          </div>
        </div>

        <!-- Markup: always open, the site's own code block, one line. -->
        <div class="border-t border-base-300 pt-3 mt-1" data-testid="markup">
          <!-- The site's code styling keys on .prose, which a playground page lacks. The docs' copy button, from the template: this card re-renders, so nothing may move its nodes. -->
          <div class="prose max-w-none druxt-markup">
            <div class="docs-code">
              <DuiCodeBlock :code="snippet" language="vue" class="text-xs whitespace-pre-wrap break-all" tabindex="0" />
              <button type="button" class="docs-copy" aria-label="Copy code to clipboard" :data-state="copyState || null" @click="copy">
                <span>{{ copyState ? copyStates[copyState].label : 'Copy' }}</span>
              </button>
              <span class="sr-only" role="status" aria-live="polite">{{ copyState ? copyStates[copyState].announce : '' }}</span>
            </div>
          </div>
        </div>

        <!-- Resolution: closed, its answer; open, the list. -->
        <div class="pt-2.5" data-testid="resolution">
          <button type="button" class="flex items-center gap-2 min-h-[24px] text-left text-[12.5px] text-base-content/70" :aria-expanded="String(openResolution)" @click="openResolution = !openResolution">
            <span class="text-base-content/50 text-[10px]" aria-hidden="true">{{ openResolution ? '▾' : '▸' }}</span>
            <span>{{ resolutionLine }}</span>
          </button>
          <div v-if="openResolution" class="mt-2 pl-5 text-xs space-y-2">
            <ol class="font-mono space-y-0.5 list-none pl-0">
              <li v-for="(n, i) in resolution.options" :key="n" :class="n === resolution.is ? 'font-semibold' : 'text-base-content/70'">{{ i + 1 }}. {{ n }}</li>
            </ol>
            <a href="/explanation/component-resolution" class="text-primary-focus">How wrapper resolution works</a>
            <!-- Every request the instance made, as it made it. -->
            <p class="text-base-content/70">{{ requests.length ? 'Requests' : 'No requests: the data was already in the store.' }}</p>
            <ul v-if="requests.length" class="font-mono space-y-0.5 list-none pl-0 break-all" data-testid="requests">
              <li v-for="r in requests" :key="r" class="text-base-content/70">{{ r }}</li>
            </ul>
          </div>
        </div>

        <!-- From a module or reference page: this card, on its own page, as set here. -->
        <div v-if="placement !== 'playground'" class="pt-2.5 flex items-center gap-2 min-h-[20px] pl-5">
          <NuxtLink :to="{ path: '/playground', query: shareQuery }" class="text-primary-focus text-[12.5px] font-medium" @click.native="track('example_open_playground')">Open in the playground</NuxtLink>
        </div>

        <!-- Open in Storybook: follows the backend, absent where none exists. -->
        <div v-if="storybook" class="pt-2.5 flex items-center gap-2 min-h-[20px] pl-5">
          <a :href="storybook.href" target="_blank" rel="noopener" class="text-primary-focus text-[12.5px] font-medium inline-flex items-center gap-1" @click="track('example_storybook')">
            {{ storybook.label }}
            <AppIconExternal class="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </template>

    <div v-else-if="!name" data-testid="preview" class="bg-base-100 border-t border-base-300 px-[18px] py-5 text-sm text-base-content/70">
      Pick a component to render it against a live Drupal.
    </div>
  </div>
</template>

<script>
/**
 * A live Druxt component with its props as controls and its examples as presets.
 *
 * Lives in components/global/ because @nuxt/content v1 only resolves globally
 * registered components inside markdown. What it knows about each component
 * comes from utils/live-examples.js until docgen emits it per component.
 *
 * The Umami backend works by priming the store: a resource fetched without a
 * `fields` parameter is stored as complete and handed back untouched, so the
 * component never asks this site's Drupal for it.
 */
import Vue from 'vue'
import {
  BACKENDS,
  COMPONENTS,
  COMPONENT_NAMES,
  CONTEXT_ONLY,
  SHIPPED_WRAPPERS,
  SOURCES,
  WRAPPER_PROP,
  liveComponentsOf,
  packageOf,
  pageFor,
  parseOrigin,
  pickOption,
  probeBackend,
} from '~/utils/live-examples'
import { COPY_STATES, copyText } from '~/utils/copy-button'
import { createRuntime } from '~/utils/druxt-runtime'
import mutations from '~/store/mutations'

// The props every module component shares. `value` and `settings` are
// objects, so they are set in code rather than from a control.
const SHARED_PROPS = [
  { name: 'langcode', type: 'string', control: 'select', source: 'languages', description: 'The resource language code.' },
  { name: 'value', type: 'object', control: 'code', description: 'The v-model binding; supplies the data and skips the fetch.' },
]
const SETTINGS_PROP = { name: 'settings', type: 'object', control: 'code', description: 'Module settings overriding the site defaults.' }
const DECLARES_SETTINGS = ['DruxtEntity', 'DruxtEntityForm', 'DruxtView']

// Option lists are fetched once per backend and source and shared between
// mounts, because the component remounts when the markdown around it re-renders.
const cache = {}
const cached = (id, load) => {
  if (!cache[id]) {
    cache[id] = load().catch((e) => {
      delete cache[id]
      throw e
    })
  }
  return cache[id]
}

export default {
  name: 'DruxtExample',

  props: {
    /** Fixed on a component's own page; empty on the playground, which shows a picker. */
    component: { type: String, default: '' },
    /** On a module page: the picker offers that package's components only. */
    pkg: { type: String, default: '' },
  },

  data() {
    return {
      name: this.component || liveComponentsOf(this.pkg)[0] || '',
      backend: 'site',
      // A reader's own Drupal, once probed; and the form that asks for it.
      custom: null,
      customOpen: false,
      customInput: '',
      customBusy: false,
      customError: '',
      values: {},
      options: {},
      loading: {},
      wrapper: true,
      openResolution: false,
      copyState: null,
      error: null,
      requests: [],
      resolution: { is: '', options: [] },
      renderKey: 0,
      // Whether an instance is mounted under its runtime.
      primed: false,
      rawEmpty: false,
    }
  },

  computed: {
    backends: ({ custom }) => (custom ? { ...BACKENDS, custom } : BACKENDS),
    /** The backend in a URL: its key, or a reader's origin. */
    backendId: ({ backend, custom }) => (backend === 'custom' && custom ? custom.baseUrl : backend),
    copyStates: () => COPY_STATES,
    fixed: ({ component }) => !!component,
    live: ({ name }) => !!COMPONENTS[name],
    contextOnly: ({ name }) => CONTEXT_ONLY[name] || null,
    shipped: ({ name }) => SHIPPED_WRAPPERS[name] || null,
    schema: ({ name }) => COMPONENTS[name] || { props: [], examples: [] },
    fixedValues: ({ schema }) => schema.fixedValues || {},
    /** Where the card sits, for analytics. */
    placement: ({ component, pkg }) => (component ? 'api' : pkg ? 'module' : 'playground'),

    /** Only components that render on their own; the others have their own pages. */
    picker: ({ pkg }) => COMPONENT_NAMES.filter((n) => !pkg || packageOf(n) === pkg),

    /** The picker's components by package, the way the Modules list orders them. */
    pickerGroups: ({ picker }) => {
      const groups = {}
      for (const n of picker) (groups[packageOf(n)] = groups[packageOf(n)] || []).push(n)
      return Object.keys(groups).sort().map((pkg) => ({ pkg, names: groups[pkg].sort() }))
    },

    /** The card's state as a playground URL query, for sharing and for the link below. */
    shareQuery: ({ name, backendId, values, wrapper }) => {
      const query = { component: name, backend: backendId }
      for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '' && key !== 'wrapper') query[key] = String(value)
      if (!wrapper) query.wrapper = 'false'
      return query
    },

    /** Each backend that cannot serve the component, with its reason: the descriptor's, or the probe's. */
    unavailable: ({ backends, schema, name }) => Object.keys(backends)
      .map((key) => [key, key === 'custom' ? (backends.custom.reasons || {})[name] : schema.backends && schema.backends[key] !== true && schema.backends[key]])
      .filter(([, reason]) => reason)
      .map(([key, reason]) => `${backends[key].label}: ${reason}.`)
      .join(' '),

    rows: ({ schema, name }) => [
      ...(schema.props || []),
      ...SHARED_PROPS,
      ...(DECLARES_SETTINGS.includes(name) ? [SETTINGS_PROP] : []),
      WRAPPER_PROP,
    ],

    /** Props handed to the component: chain values composed, internal steps dropped, unset left out. */
    renderProps: ({ schema, values, fixedValues }) => {
      const out = {}
      const internal = new Set(((schema.chain || {}).steps || []).filter((s) => s.internal).map((s) => s.name))
      for (const [key, value] of Object.entries({ ...values, ...fixedValues })) {
        if (internal.has(key) || key === 'wrapper' || value === undefined || value === '') continue
        out[key] = value
      }
      if (schema.chain && schema.chain.compose) Object.assign(out, schema.chain.compose(values))
      return out
    },

    ready: ({ schema, values, live }) => {
      if (!live) return false
      for (const step of (schema.chain || {}).steps || []) if (step.required && !values[step.name]) return false
      for (const prop of schema.props || []) if (prop.required && !values[prop.name]) return false
      return true
    },

    snippet: ({ name, renderProps, wrapper }) => {
      const attrs = Object.entries(renderProps).map(([k, v]) =>
        typeof v === 'boolean' || typeof v === 'number' ? `:${k}="${v}"` : `${k}="${v}"`,
      )
      if (!wrapper) attrs.push(':wrapper="false"')
      return `<${name}${attrs.length ? ' ' + attrs.join(' ') : ''} />`
    },

    resolutionLine: ({ resolution }) => {
      if (!resolution.options.length) return 'Resolving the component.'
      const n = resolution.options.length
      const k = resolution.options.indexOf(resolution.is)
      const count = `Druxt looked for ${n} component${n === 1 ? '' : 's'}.`
      if (k < 0) return `${count} None matched; it used its own wrapper.`
      return `${count} The ${['1st', '2nd', '3rd'][k] || k + 1 + 'th'} matched.`
    },

    dirtyChain: ({ schema, values }) => ((schema.chain || {}).steps || []).some((s) => values[s.name]),

    /** Every option list the current backend has filled, flat: a value from another backend's list is not this card's. */
    backendOptions: ({ options, backendId }) => Object.entries(options)
      .filter(([key]) => key.startsWith(backendId + ':'))
      .map(([, list]) => list)
      .flat(),

    /**
     * The Umami Storybook link, to the story of the very instance shown: the
     * Druxt modules write one story per entity display, block, region, menu
     * and view, titled from their names.
     */
    storybook() {
      const b = this.backends[this.backend]
      // This site's Storybook lives at the environment's route; the demo's is fixed.
      const host = b.storybook || (this.backend === 'site' ? this.$config.storybookUrl : '')
      if (!host || !this.name) return null
      const slug = (...parts) => parts.filter(Boolean).join('/').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      const option = (value) => this.backendOptions.find((o) => o.value === value) || {}
      const v = this.values
      const label = (value) => (option(value).label || '').replace(/ \([^)]*\)$/, '')
      // Storybook reads only letters, digits, spaces, underscores and dashes from
      // a URL's args, so a path or a uuid with anything else stays behind.
      const encodable = (value) => /^[a-zA-Z0-9 _-]*$/.test(String(value))
      const argsOf = (values) => Object.entries(values).filter(([, v]) => encodable(v)).map(([k, v]) => `${k}:${v}`).join(';')
      const link = (id, args) => ({
        href: `${host.replace(/\/?$/, '/')}?path=/story/${id}${args ? '&args=' + encodeURIComponent(args) : ''}`,
        label: `Open this ${this.name} in ${b.storybookLabel} Storybook`,
      })
      switch (this.name) {
        case 'DruxtBlock': {
          const o = option(v.uuid)
          return o.value ? link(`${slug('druxt', 'blocks', o.group, o.suffix, o.label)}--default`) : null
        }
        case 'DruxtBlockRegion':
          return v.theme && v.name ? link(`${slug('druxt', 'blocks', v.theme, v.name)}--default`) : null
        case 'DruxtEntity':
        case 'DruxtEntityForm': {
          const type = this.name === 'DruxtEntityForm' ? 'form' : this.fixedValues.schemaType || v.schemaType || 'view'
          return v.entityType && v.bundle && v.mode ? link(`${slug('druxt', 'entity', v.entityType, v.bundle, `${type} displays`)}--${slug(v.mode)}`, v.uuid ? `uuid:${v.uuid}` : '') : null
        }
        case 'DruxtMenu':
          return v.name ? link(`${slug('druxt', 'menu', label(v.name))}--default`) : null
        case 'DruxtView':
          return v.viewId && v.displayId ? link(`${slug('druxt', 'views', label(v.viewId))}--${slug(v.displayId)}`) : null
        default:
          return this.schema.story ? link(this.schema.story, argsOf(this.renderProps)) : null
      }
    },
  },

  watch: {
    component(value) {
      this.name = value
    },
    name() {
      this.reset()
      if (this.name) this.track('example_component')
    },
    backend() {
      this.reset()
      this.track('example_backend')
    },
  },

  created() {
    // A Vue instance, kept off the reactive data.
    this.sandbox = null
    // The generation of the fill in flight: every await checks it, so a
    // reset that has been superseded stops instead of overwriting the newer one.
    this.resetKey = 0
    // What a shared playground URL asks for, applied on the first fill and then dropped.
    this.initial = {}
  },

  async mounted() {
    if (this.placement === 'playground') this.readUrl()
    if (this.customInput) {
      this.customOpen = true
      await this.useCustom()
      if (this.backend === 'custom') return
    }
    if (this.name) {
      this.reset()
      this.track('example_component')
    }
  },

  beforeDestroy() {
    this.unmount()
  },

  methods: {
    pageFor,

    /**
     * The playground's state in its URL, so a card can be shared: the
     * component and backend, every value chosen, and the wrapper when off.
     */
    readUrl() {
      const { component, backend, wrapper, ...rest } = this.$route.query || {}
      if (component && COMPONENTS[component]) this.name = component
      if (backend && BACKENDS[backend]) this.backend = backend
      // A reader's Drupal in a shared link: probed once the card is up.
      if (backend && /^https?:\/\//.test(backend)) this.customInput = backend
      this.initial = { ...rest, ...(wrapper === 'false' ? { wrapper: false } : {}) }
    },

    /** The backend select: a known one, or the form for a reader's own. */
    pickBackend(value) {
      if (value === 'other') {
        this.customOpen = true
        return
      }
      this.customOpen = false
      this.backend = value
    },

    /** Check the typed origin, and render against it if it answers. */
    async useCustom() {
      const { origin, error } = parseOrigin(this.customInput, window.location.protocol)
      if (error) {
        this.customError = error
        return
      }
      this.customBusy = true
      this.customError = ''
      try {
        const { backend } = await probeBackend(origin)
        this.custom = backend
        this.customOpen = false
        this.track('example_custom_backend')
        // The watcher renders; a change of origin on the same key must too.
        if (this.backend === 'custom') this.reset()
        else this.backend = 'custom'
      } catch (e) {
        this.customError = e.message
      } finally {
        this.customBusy = false
      }
    },

    writeUrl() {
      if (this.placement !== 'playground' || !this.name) return
      const query = this.shareQuery
      if (JSON.stringify(query) !== JSON.stringify(this.$route.query)) this.$router.replace({ query }).catch(() => {})
    },

    /** The markup line to the clipboard, the way the docs' button does it. */
    async copy() {
      clearTimeout(this.copyTimer)
      this.copyState = await copyText(this.snippet)
      if (this.copyState === 'copied') this.track('example_copy')
      this.copyTimer = setTimeout(() => { this.copyState = null }, 2000)
    },

    /** Whether a backend can serve the component; the reason it cannot is the descriptor's. */
    available(backend) {
      if (backend === 'custom') return !!this.custom && !(this.custom.reasons || {})[this.name]
      const only = this.schema.backends
      return !only || only[backend] === true
    },

    /** One GA4 event per interaction. gtag() exists only on production, so this is a no-op elsewhere. */
    track(event, params = {}) {
      window.gtag?.('event', event, { component: this.name, backend: this.backend, placement: this.placement, ...params })
    },

    /**
     * Read what the instance looked for and what it chose, and whether raw
     * output came to anything.
     *
     * DruxtModule keeps both on the instance, but sets them after its own
     * fetch, which never re-renders this component. So poll the ref, briefly.
     */
    readResolution(key) {
      let tries = 0
      const look = () => {
        if (key !== this.renderKey) return
        const c = (((this.sandbox || {}).$children || [])[0] || {}).component
        if (c && (c.options || []).length) {
          this.resolution = { is: c.is, options: [...c.options] }
          const stage = this.$refs.stage
          this.rawEmpty = !this.wrapper && !!stage && !stage.textContent.trim() && !stage.querySelector('img, svg, input, a')
          return
        }
        if (++tries < 40) setTimeout(look, 150)
      }
      this.$nextTick(look)
    },

    /** Only entity types and bundles this site holds display schemas for can render. */
    allowed(step, list) {
      const filter = (((this.$druxt || {}).settings || {}).schema || {}).filter || []
      if (!filter.length || this.backend !== 'site') return list
      if (step.name === 'entityType') {
        const types = new Set(filter.map((p) => p.split('--')[0]))
        return list.filter((o) => types.has(o.value)).sort((a, b) => (a.value === 'node' ? -1 : b.value === 'node' ? 1 : 0))
      }
      if (step.name === 'bundle') {
        const type = this.values.entityType
        return list.filter((o) => filter.some((p) => new RegExp('^' + p).test(`${type}--${o.value}--`)))
      }
      return list
    },

    /** Back to the component as documented: defaults, wrapper on. */
    async reset() {
      const key = ++this.resetKey
      if (!this.available(this.backend)) {
        // The watcher brings us back here.
        this.backend = Object.keys(this.backends).find((k) => this.available(k)) || 'site'
        return
      }
      this.error = null
      this.resolution = { is: '', options: [] }
      this.rawEmpty = false
      this.values = {}
      this.wrapper = true
      if (!this.live) return
      try {
        // Every select in the panel, the shared rows included.
        for (const prop of this.rows) if (prop.source) await this.loadOptions(prop.source, {}, key)
        if (key !== this.resetKey) return
        await this.autoFill(key)
      } catch (e) {
        if (key === this.resetKey) this.error = e.message
      }
    },

    /** Option lists are keyed per backend: a list from one backend never answers for another. */
    optionsKey(source, deps) {
      return this.backendId + ':' + source + JSON.stringify(deps)
    },

    async loadOptions(source, deps, key = this.resetKey) {
      const k = this.optionsKey(source, deps)
      this.$set(this.loading, source, true)
      try {
        const b = this.backends[this.backend]
        const list = await cached(k, () => SOURCES[source](b.api, deps, b))
        if (key === this.resetKey) this.$set(this.options, k, list)
        return list
      } finally {
        if (key === this.resetKey) this.$set(this.loading, source, false)
      }
    },

    depsOf(step) {
      const deps = {}
      for (const n of step.needs || []) deps[n] = this.values[n] || this.fixedValues[n] || (n === 'schemaType' ? 'view' : undefined)
      return deps
    },
    optionsOf(step) {
      return this.allowed(step, this.options[this.optionsKey(step.source, this.depsOf(step))] || [])
    },
    loadingOf(step) {
      return !!this.loading[step.source]
    },
    stepEnabled(step) {
      return (step.needs || []).every((n) => n === 'schemaType' || this.values[n])
    },

    async loadStep(key, i) {
      const step = ((this.schema.chain || {}).steps || [])[i]
      if (!step || !this.stepEnabled(step)) return []
      return this.loadOptions(step.source, this.depsOf(step), key)
    },

    /** What a select prefers on its own: `prefer` (a value, or a function of the card), else its documented default. */
    preferred(prop) {
      if (this.initial[prop.name] !== undefined) return this.initial[prop.name]
      const want = prop.prefer !== undefined ? prop.prefer : prop.default
      return typeof want === 'function' ? want(this) : want
    },

    /** The value a step should take on its own: what it prefers if offered, else the first option. */
    pickFor(step, list) {
      return pickOption(list, this.preferred(step))
    },

    /** Set one chain step, clear everything after it, and fill those steps in. */
    async setStep(i, value) {
      const steps = this.schema.chain.steps
      this.$set(this.values, steps[i].name, value || undefined)
      for (let j = i + 1; j < steps.length; j++) this.$set(this.values, steps[j].name, undefined)
      this.track('example_prop', { prop: steps[i].name })
      await this.fillFrom(this.resetKey, i + 1)
      this.rerender()
    },

    async fillFrom(key, start) {
      const steps = (this.schema.chain || {}).steps || []
      for (let i = start; i < steps.length; i++) {
        await this.loadStep(key, i)
        if (key !== this.resetKey) return
        const pick = this.pickFor(steps[i], this.optionsOf(steps[i]))
        if (!pick) break
        this.$set(this.values, steps[i].name, pick)
      }
    },

    /** First load: walk the chain, then give each select a value that renders something. */
    async autoFill(key) {
      await this.fillFrom(key, 0)
      if (key !== this.resetKey) return
      for (const prop of this.schema.props || []) {
        if (prop.source && !this.values[prop.name]) {
          const list = this.options[this.optionsKey(prop.source, {})] || []
          const value = pickOption(list, this.preferred(prop))
          if (value !== undefined) this.$set(this.values, prop.name, value)
        }
      }
      // The rest of a shared URL: plain props, the shared rows, the wrapper.
      // Values arrive as strings, so each goes back to its row's type.
      for (const [name, value] of Object.entries(this.initial)) {
        if (name === 'wrapper') this.wrapper = value !== false
        else if (this.values[name] === undefined) {
          const row = this.rows.find((r) => r.name === name)
          if (!row) continue
          const typed = row.type === 'number' ? Number(value) : row.type === 'boolean' ? value !== 'false' : value
          if (row.type !== 'number' || Number.isFinite(typed)) this.$set(this.values, name, typed)
        }
      }
      this.initial = {}
      if (key === this.resetKey) this.rerender()
    },

    async setValue(prop, value) {
      this.$set(this.values, prop, value)
      if (prop === 'wrapper') this.wrapper = value !== false
      this.track('example_prop', { prop })
      // Form swaps mode for form modes.
      if (prop === 'schemaType' && this.schema.chain) {
        const i = this.schema.chain.steps.findIndex((s) => s.name === 'mode')
        if (i >= 0) {
          this.$set(this.values, 'mode', undefined)
          await this.fillFrom(this.resetKey, i)
        }
      }
      this.rerender()
    },

    toggleValue(prop) {
      const v = this.values[prop.name]
      return v === undefined ? prop.default !== false : v !== false
    },

    isDirty(prop) {
      const v = this.values[prop.name]
      return v !== undefined && v !== prop.default
    },

    grouped(prop) {
      const list = this.options[this.optionsKey(prop.source, {})] || []
      if (!list.some((o) => o.group)) return []
      return [...new Set(list.map((o) => o.group))].map((group) => ({ group, items: list.filter((o) => o.group === group) }))
    },
    ungrouped(prop) {
      return this.options[this.optionsKey(prop.source, {})] || []
    },

    /**
     * Mount the component under a runtime of its own for the chosen backend.
     *
     * A fresh client and store every time, so what the disclosure lists is
     * every request a cold render makes. Nuxt resolves the injected `$`
     * options through the root, so a second root with its own carries the
     * whole subtree to that backend.
     */
    async rerender() {
      this.error = null
      this.primed = false
      this.rawEmpty = false
      this.resolution = { is: '', options: [] }
      this.unmount()
      if (!this.ready) return
      this.requests = []
      const b = this.backends[this.backend]
      const key = ++this.renderKey
      try {
        const settings = (this.$druxt || {}).settings || {}
        // This site's own state, minus the Druxt modules the runtime brings of its own.
        const own = new Set(['druxt', 'druxtRouter', 'druxtSchema', 'druxtMenu', 'druxtViews'])
        const state = Object.fromEntries(Object.entries(this.$store.state).filter(([k]) => !own.has(k)))
        const runtime = createRuntime({ baseUrl: b.baseUrl || settings.baseUrl || window.location.origin, proxyRoot: b.proxyRoot, settings, state, mutations })
        runtime.axios.interceptors.request.use((config) => {
          const url = /^https?:/.test(config.url || '') ? config.url : [config.baseURL || '', config.url || ''].map((part, i) => (i ? part.replace(/^\/+/, '') : part.replace(/\/+$/, ''))).filter(Boolean).join('/')
          this.requests.push(`${(config.method || 'get').toUpperCase()} /${url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '')}`)
          return config
        })
        this.primed = true
        await this.$nextTick()
        if (key !== this.renderKey || !this.$refs.mount) return
        const el = document.createElement('div')
        this.$refs.mount.appendChild(el)
        // Everything this site injects, except $nuxt: left out, the prototype getter falls back to the real one.
        const injected = Object.fromEntries(Object.entries(this.$root.$options).filter(([k]) => k.startsWith('$') && k !== '$nuxt'))
        const name = this.name
        const props = { ...this.renderProps, ...(this.wrapper ? {} : { wrapper: false }) }
        const card = this
        this.sandbox = new Vue({
          ...injected,
          $druxt: runtime.client,
          $druxtMenu: runtime.menu,
          $druxtRouter: runtime.router,
          store: runtime.store,
          router: this.$router,
          // A failure inside the instance is the card's to show, not the page's.
          errorCaptured(err) {
            if (key === card.renderKey) card.error = err.message
            return false
          },
          render: (h) => h(name, { props }),
        })
        this.sandbox.$mount(el)
        this.readResolution(key)
        this.writeUrl()
      } catch (e) {
        this.error = e.message
      }
    },

    /** Links and form buttons inside the preview do nothing: the page stays here, and nothing posts to a backend. */
    inert(event) {
      if (event.target.closest('a, button#submit, button#reset, input[type="submit"]')) {
        event.preventDefault()
        event.stopPropagation()
      }
    },

    /** Take the mounted instance down with its runtime. */
    unmount() {
      if (!this.sandbox) return
      const el = this.sandbox.$el
      this.sandbox.$destroy()
      if (el && el.parentNode) el.parentNode.removeChild(el)
      this.sandbox = null
    },

    retry() {
      this.reset()
    },

  },
}
</script>
