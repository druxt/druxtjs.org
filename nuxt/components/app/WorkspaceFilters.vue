<template>
  <div class="wsf" role="search" data-testid="workspace-filters">
    <label class="wsf-search">
      <svg class="wsf-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
      <span class="sr-only">Search the changed pages by title or path</span>
      <input
        id="workspace-search"
        type="search"
        :value="value.text"
        placeholder="Search title or path"
        autocomplete="off"
        @input="set('text', $event.target.value)"
      />
    </label>

    <!-- Wide: every filter in the row. -->
    <div class="wsf-wide">
      <div class="wsf-seg" role="radiogroup" aria-label="Status">
        <button
          v-for="choice of facets.status"
          :key="choice.value || 'all'"
          type="button"
          role="radio"
          :aria-checked="String(value.status === choice.value)"
          :class="{ on: value.status === choice.value, zero: !choice.count }"
          @click="set('status', choice.value)"
        >
          {{ choice.label }} <span class="wsf-n">{{ choice.count }}</span>
        </button>
      </div>
      <label class="wsf-sel">
        <span class="wsf-lb">Section</span>
        <select :value="value.section" @change="set('section', $event.target.value)">
          <option v-for="choice of facets.sections" :key="choice.value || 'all'" :value="choice.value">
            {{ choice.label }} · {{ choice.count }}
          </option>
        </select>
      </label>
      <label v-if="hasAuthors" class="wsf-sel">
        <span class="wsf-lb">Changed by</span>
        <select :value="value.author" @change="set('author', $event.target.value)">
          <option v-for="choice of facets.authors" :key="choice.value || 'anyone'" :value="choice.value">
            {{ choice.label }} · {{ choice.count }}
          </option>
        </select>
      </label>
      <label class="wsf-sel">
        <span class="wsf-lb">Order</span>
        <select :value="value.sort" @change="set('sort', $event.target.value)">
          <option v-for="(order, key) of sorts" :key="key" :value="key">{{ order.label }}</option>
        </select>
      </label>
    </div>

    <!-- Narrow: the filters fold into a sheet. -->
    <button
      ref="opener"
      type="button"
      class="wsf-open"
      :class="{ on: active }"
      aria-haspopup="dialog"
      data-testid="workspace-filters-open"
      @click="open = true"
    >
      <svg class="wsf-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
      Filters
      <span v-if="active" class="wsf-badge">{{ active }}</span>
    </button>

    <transition name="wsf-fade">
      <div v-if="open" class="wsf-scrim" @click="close" />
    </transition>
    <transition name="wsf-rise">
      <div
        v-if="open"
        ref="sheet"
        class="wsf-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        data-testid="workspace-filters-sheet"
        @keydown.esc.prevent="close"
        @keydown.tab="onTab"
      >
        <div class="wsf-grab" aria-hidden="true" />
        <div class="wsf-sheet-head">
          <h2>Filters</h2>
          <button type="button" class="wsf-x" aria-label="Close filters" @click="close">
            <svg class="wsf-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div class="wsf-sheet-body">
          <fieldset>
            <legend>Status</legend>
            <div class="wsf-chips">
              <button
                v-for="choice of facets.status"
                :key="choice.value || 'all'"
                type="button"
                class="wsf-chip"
                :class="{ on: value.status === choice.value, zero: !choice.count }"
                :aria-pressed="String(value.status === choice.value)"
                @click="set('status', choice.value)"
              >
                {{ choice.label }} <span class="wsf-n">{{ choice.count }}</span>
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>Section</legend>
            <div class="wsf-chips">
              <button
                v-for="choice of facets.sections"
                :key="choice.value || 'all'"
                type="button"
                class="wsf-chip"
                :class="{ on: value.section === choice.value, zero: !choice.count }"
                :aria-pressed="String(value.section === choice.value)"
                @click="set('section', choice.value)"
              >
                {{ choice.short || choice.label }} <span class="wsf-n">{{ choice.count }}</span>
              </button>
            </div>
          </fieldset>
          <fieldset v-if="hasAuthors">
            <legend>Changed by</legend>
            <div class="wsf-chips">
              <button
                v-for="choice of facets.authors"
                :key="choice.value || 'anyone'"
                type="button"
                class="wsf-chip"
                :class="{ on: value.author === choice.value, zero: !choice.count }"
                :aria-pressed="String(value.author === choice.value)"
                @click="set('author', choice.value)"
              >
                <span v-if="choice.initials" class="wsf-avatar" :class="{ ai: choice.ai }" aria-hidden="true">{{ choice.initials }}</span>
                {{ choice.label }} <span class="wsf-n">{{ choice.count }}</span>
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>Order</legend>
            <div class="wsf-seg wsf-seg-full" role="radiogroup" aria-label="Order">
              <button
                v-for="(order, key) of sorts"
                :key="key"
                type="button"
                role="radio"
                :aria-checked="String(value.sort === key)"
                :class="{ on: value.sort === key }"
                @click="set('sort', key)"
              >
                {{ order.short }}
              </button>
            </div>
          </fieldset>
        </div>
        <div class="wsf-sheet-foot">
          <button type="button" class="wsf-btn" @click="$emit('clear')">Clear filters</button>
          <button type="button" class="wsf-btn wsf-primary" data-testid="workspace-filters-show" @click="close">
            Show {{ shown === 1 ? '1 page' : `${shown} pages` }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { SORTS, activeFilters } from '~/lib/workspace-review'
import { focusable, trapTab } from '~/utils/focus'

/**
 * The review's search, filters and order: one row when there is room, and a
 * sheet behind a Filters button on a phone. The list updates as each choice
 * is made, under the sheet too.
 */
export default {
  name: 'AppWorkspaceFilters',

  props: {
    /** The active filters, as lib/workspace-review names them. */
    value: { type: Object, required: true },
    /** The choices, from facetsOf(). */
    facets: { type: Object, required: true },
    /** How many rows the filters leave. */
    shown: { type: Number, required: true },
  },

  data: () => ({ open: false, sorts: SORTS }),

  computed: {
    active: ({ value }) => activeFilters(value),
    // "Anyone" and one name is no choice at all.
    hasAuthors: ({ facets }) => facets.authors.length > 2,
  },

  watch: {
    open(open) {
      if (open) {
        this.$nextTick(() => {
          const first = focusable(this.$refs.sheet)[0]
          if (first) first.focus()
        })
      } else if (this.$refs.opener) {
        this.$refs.opener.focus()
      }
    },
  },

  methods: {
    set(key, value) {
      this.$emit('input', { ...this.value, [key]: value })
    },

    close() {
      this.open = false
    },

    onTab(event) {
      trapTab(this.$refs.sheet, event)
    },
  },
}
</script>

<style scoped>
.wsf {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 24px 0 16px;
}
.wsf-search {
  flex: 1 1 220px;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid hsl(var(--b3));
  border-radius: 8px;
  background: hsl(var(--b1));
}
.wsf-search:focus-within {
  outline: 2px solid hsl(var(--pf));
  outline-offset: 2px;
}
.wsf-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: hsl(var(--bc));
  font-size: 16px;
  outline: none;
}
.wsf-wide {
  display: contents;
}
.wsf-seg {
  display: inline-flex;
  height: 44px;
  border: 1px solid hsl(var(--b3));
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
  background: hsl(var(--b2));
}
.wsf-seg button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border-radius: 6px;
  color: var(--wsr-mut);
  font-weight: 500;
  white-space: nowrap;
}
.wsf-seg button.on {
  background: hsl(var(--b1));
  color: hsl(var(--bc));
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
.wsf-seg-full {
  display: flex;
}
.wsf-seg-full button {
  flex: 1;
  justify-content: center;
}
.wsf-sel {
  height: 44px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px 0 12px;
  border: 1px solid hsl(var(--b3));
  border-radius: 8px;
  background: hsl(var(--b1));
  white-space: nowrap;
}
.wsf-sel:focus-within {
  outline: 2px solid hsl(var(--pf));
  outline-offset: 2px;
}
.wsf-lb {
  color: var(--wsr-mut);
}
.wsf-sel select {
  height: 100%;
  border: 0;
  background: transparent;
  color: hsl(var(--bc));
  font-weight: 500;
  outline: none;
  cursor: pointer;
}
.wsf-n {
  font: 600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--wsr-faint);
}
.zero {
  color: var(--wsr-faint);
}
.wsf-open {
  display: none;
  height: 44px;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border: 1px solid hsl(var(--b3));
  border-radius: 8px;
  background: hsl(var(--b1));
  font-weight: 600;
}
.wsf-open.on {
  border-color: hsl(var(--pf));
  color: hsl(var(--pf));
}
.wsf-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: hsl(var(--pf));
  color: hsl(var(--b1));
  font-size: 11px;
  display: grid;
  place-items: center;
}
.wsf-ic {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex: none;
  color: var(--wsr-mut);
}
.wsf-open .wsf-ic,
.wsf-x .wsf-ic {
  color: inherit;
}
button:focus-visible {
  outline: 2px solid hsl(var(--pf));
  outline-offset: 2px;
}

@media (max-width: 639px) {
  .wsf-wide {
    display: none;
  }
  .wsf-open {
    display: inline-flex;
  }
}

.wsf-scrim {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: var(--wsr-scrim);
}
.wsf-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 81;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: hsl(var(--b1));
  border-radius: 16px 16px 0 0;
  box-shadow: var(--wsr-shadow);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.wsf-grab {
  width: 36px;
  height: 4px;
  border-radius: 4px;
  background: hsl(var(--b3));
  margin: 8px auto 0;
}
.wsf-sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 6px 16px;
}
.wsf-sheet-head h2 {
  font-size: 16px;
  font-weight: 700;
}
.wsf-x {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 8px;
}
.wsf-sheet-body {
  overflow-y: auto;
  padding: 4px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.wsf-sheet-body legend {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--wsr-mut);
  margin-bottom: 8px;
}
.wsf-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.wsf-chip {
  height: 44px;
  padding: 0 14px;
  border: 1px solid hsl(var(--b3));
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-weight: 500;
  background: hsl(var(--b1));
  white-space: nowrap;
}
.wsf-chip.on {
  border-color: hsl(var(--pf));
  color: hsl(var(--pf));
  background: var(--wsr-ptint);
}
.wsf-chip.on .wsf-n {
  color: hsl(var(--pf));
}
.wsf-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 9px;
  font-weight: 700;
  background: var(--wsr-ptint);
  color: hsl(var(--pf));
}
.wsf-avatar.ai {
  border-radius: 6px;
  background: var(--wsr-aibg);
  color: var(--wsr-ai);
}
.wsf-sheet-foot {
  display: flex;
  gap: 8px;
  padding: 12px 16px 20px;
  border-top: 1px solid hsl(var(--b3));
}
.wsf-btn {
  flex: 1;
  height: 44px;
  border: 1px solid hsl(var(--b3));
  border-radius: 8px;
  font-weight: 600;
  background: hsl(var(--b1));
}
.wsf-primary {
  flex: 1.5;
  background: var(--wsr-pfill);
  border-color: var(--wsr-pfill);
  color: var(--wsr-pc);
}

.wsf-fade-enter-active,
.wsf-fade-leave-active {
  transition: opacity var(--motion-base) var(--motion-ease);
}
.wsf-fade-enter,
.wsf-fade-leave-to {
  opacity: 0;
}
.wsf-rise-enter-active,
.wsf-rise-leave-active {
  transition: transform var(--motion-base) var(--motion-ease-out);
}
.wsf-rise-enter,
.wsf-rise-leave-to {
  transform: translateY(100%);
}
@media (prefers-reduced-motion: reduce) {
  .wsf-fade-enter-active,
  .wsf-fade-leave-active,
  .wsf-rise-enter-active,
  .wsf-rise-leave-active {
    transition: none;
  }
}
</style>
