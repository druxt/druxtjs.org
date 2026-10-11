<template>
  <li class="wsr-item" data-testid="workspace-row">
    <div class="wsr-row">
      <div class="wsr-row-text">
        <div class="wsr-tags">
          <span class="wsr-kind" :class="page.status" data-testid="workspace-row-status">{{ statusLabel }}</span>
          <span class="wsr-section">{{ page.sectionLabel }}</span>
          <span v-if="when">{{ when }}</span>
        </div>
        <NuxtLink v-if="page.href" :to="page.href" class="wsr-title">{{ page.title }}</NuxtLink>
        <span v-else class="wsr-title">{{ page.title }}</span>
        <div class="wsr-meta">
          <span v-if="page.path" class="wsr-path">{{ page.path }}</span>
          <span v-else class="wsr-path none">No path yet</span>
          <span v-if="page.author" class="wsr-who">
            <span class="wsr-avatar" :class="{ ai: page.ai }" aria-hidden="true">{{ page.initials }}</span>
            {{ page.ai ? `${page.author}, with AI` : page.author }}
          </span>
        </div>
      </div>

      <div class="wsr-actions">
        <NuxtLink v-if="diffHref" :to="diffHref" class="wsr-btn" :aria-label="`Diff of ${page.title}`" data-testid="workspace-row-diff">
          <svg class="wsr-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v8M8 8h8M8 20h8" /></svg>
          Diff
        </NuxtLink>
        <a v-if="editHref" :href="editHref" target="_self" class="wsr-btn" :aria-label="`Edit ${page.title}`" data-testid="workspace-row-edit">
          <svg class="wsr-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /></svg>
          Edit
        </a>
      </div>
    </div>
  </li>
</template>

<script>
import { STATUSES, whenOf } from '~/lib/workspace-review'

/**
 * One page a workspace changed: what it is, who changed it, and what to do
 * with it.
 */
export default {
  name: 'AppWorkspaceRow',

  props: {
    /** A row from lib/workspace-review's changesFrom(). */
    page: { type: Object, required: true },
    /** Drupal's edit form for the page, coming back to this review. */
    editHref: { type: String, default: null },
  },

  computed: {
    statusLabel: ({ page }) => STATUSES[page.status],
    when: ({ page }) => whenOf(page.changed),
    // A new page has no live version, so its diff shows the whole page as
    // added, which still finds the blocks moved in from elsewhere.
    diffHref: ({ page }) => (page.href ? `${page.href}?diff=1` : null),
  },
}
</script>

<style scoped>
.wsr-item {
  container-type: inline-size;
}
.wsr-row {
  border: 1px solid hsl(var(--b3));
  border-radius: 12px;
  background: hsl(var(--b1));
  padding: 16px 18px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px 24px;
  align-items: center;
  transition: border-color var(--motion-fast) var(--motion-ease);
}
.wsr-row:hover,
.wsr-row:focus-within {
  border-color: hsl(var(--p));
}
.wsr-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12.5px;
  color: var(--wsr-mut);
}
.wsr-kind {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 5px;
  padding: 2px 7px;
}
.wsr-kind.new {
  background: var(--wsr-addbg);
  color: var(--wsr-addfg);
}
.wsr-kind.changed {
  background: var(--wsr-warnbg);
  color: var(--wsr-warn);
}
.wsr-section {
  border: 1px solid hsl(var(--b3));
  border-radius: 999px;
  padding: 1px 9px;
  font-size: 12px;
  color: hsl(var(--bc));
}
.wsr-title {
  display: block;
  margin: 8px 0 6px;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
  color: hsl(var(--bc));
  text-wrap: pretty;
  overflow-wrap: anywhere;
}
a.wsr-title:hover {
  text-decoration: underline;
}
.wsr-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  font-size: 13px;
  color: var(--wsr-mut);
}
.wsr-path {
  font: 12.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: hsl(var(--bc));
  overflow-wrap: anywhere;
}
.wsr-path.none {
  font: italic 13px ui-sans-serif, system-ui, sans-serif;
  color: var(--wsr-mut);
}
.wsr-who {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.wsr-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 9.5px;
  font-weight: 700;
  background: var(--wsr-ptint);
  color: hsl(var(--pf));
  flex: none;
}
.wsr-avatar.ai {
  border-radius: 6px;
  background: var(--wsr-aibg);
  color: var(--wsr-ai);
}
.wsr-actions {
  display: flex;
  gap: 6px;
}
.wsr-btn {
  height: 44px;
  min-width: 44px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid hsl(var(--b3));
  background: hsl(var(--b1));
  color: hsl(var(--bc));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-weight: 600;
  font-size: 13.5px;
  white-space: nowrap;
  transition: border-color var(--motion-fast) var(--motion-ease), background-color var(--motion-fast) var(--motion-ease);
}
.wsr-btn:hover {
  border-color: hsl(var(--p));
}
.wsr-btn:focus-visible,
.wsr-title:focus-visible {
  outline: 2px solid hsl(var(--pf));
  outline-offset: 2px;
}
.wsr-ic {
  width: 16px;
  height: 16px;
  stroke: var(--wsr-mut);
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex: none;
}

/* The row's own width decides: actions go under the text before the title
   would have to squeeze, and share the width evenly on a phone. */
@container (max-width: 820px) {
  .wsr-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
@container (max-width: 480px) {
  .wsr-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
@supports not (container-type: inline-size) {
  @media (max-width: 860px) {
    .wsr-row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
