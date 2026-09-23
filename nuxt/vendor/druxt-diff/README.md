# @druxt-contrib/diff

A decoupled diff for Druxt. It has two faces:

- a **backend-backed revision diff** over a `jsonapi_diff` document, turned into
  an ordered list of blocks with honest counts, rebuilt-draft re-pairing, and
  removed-block placement, and
- a **no-backend word diff**, `wordDiff(old, new)`, for comparing a staged value
  against the value it was staged from.

It renders inline through a field the host already rendered (the `v-diff`
directive), or as an old/new view in a panel (`DiffField`). It never reaches
into a store. What a host provides to drive a panel or overlay is an adapter,
described below.

## Engine

```js
import { normaliseDiff, wordDiff, groupRuns, condenseRuns } from '@druxt-contrib/diff'

const view = normaliseDiff(jsonapiDiffDocument)
// { blocks, summary, rebuilt, rootFields, meta }
```

- `normaliseDiff(document)` walks the tree, counts as it goes (the payload's own
  `summary` covers only the root's fields), re-pairs a rebuilt draft so an edit
  shows where it happened, and anchors each removed block to a surviving
  sibling.
- `anchorUuid(block, side)` is the uuid to look for in the page. A diff has two
  sides and a page renders one of them, and the two are not always the same
  entity: a backend that matches children by position pairs the blocks of a site
  that rebuilds its paragraphs on every import, where each revision has its own
  uuids. Every block carries `uuids: { left, right }`, and a removed block
  carries its neighbour's pair as `placeUuids`.
- `wordDiff(left, right)` is an LCS word diff with a semantic cleanup: a short
  common word wedged between two changes folds into the rewrite, and each token
  carries its trailing whitespace so grouping keeps spacing.
- `groupRuns(runs)` reorders a change region to all removals then all additions.
- `condenseRuns(runs, context)` trims long unchanged runs to a little context
  each side of a change.

The engine is framework-agnostic CommonJS and depends on nothing.

## `v-diff` directive

A decorator, not an overlay: it marks the change inside the element a field
wrapper already rendered, so the page keeps its formatting.

```js
import diff from '@druxt-contrib/diff/directive'
Vue.directive('diff', diff)
```

```vue
<p v-diff="fieldDiff">…the rendered field…</p>
```

Added words are wrapped in `<ins class="v-diff-ins">` where they are, and
removed words are struck as `<del class="v-diff-del">` before the word that
followed them. Words removed from the end of a field have no word after them,
so they are appended as `<del class="v-diff-del v-diff-del--trailing">`, which a
site can style as a block.

Bound to `{ left, right }` it wraps added words in `<ins>`, groups a rewritten
run into one strike then one addition, spans punctuation and edge whitespace so
the mark meets an adjacent inline element, and inserts removed words as `<del>`
where they were. A null value is a no-op, so the same binding covers "not
comparing" and "this field did not change". It is the primitive a diff wrapper
resolves to, the same seam an ICE editable registers at.

## `DiffField` component

```vue
<AppDiffField :field="field" :condense="true" :context="60" />
```

Renders a field's old/new word diff (grouped, Okabe-Ito, with a non-colour
channel), condensed to the changes and a little context unless `condense` is
false.

## The adapter (the injection seam)

The orchestration a full panel and overlay need — the current diff, whether a
comparison is on, fetching a diff for an entity, resolving a block to its
rendered element — is **not** owned here, because a library must not reach into
a host's store or grab the single field-wrapper name the Druxt cascade resolves
(two libraries claiming it collide, and the loser silently does not render).

Instead the host provides an adapter, and a feature that needs a method it does
not have is simply absent, never broken:

| Method              | Returns / does                              |
| ------------------- | ------------------------------------------- |
| `getDiff()`         | the current `normaliseDiff` result, or null |
| `isComparing()`     | whether a comparison is active              |
| `fetchDiff(entity)` | fetch a `jsonapi_diff` document and set it  |
| `findBlock(uuid)`   | the block for a rendered entity id          |

This mirrors ICE's adapter/feature negotiation: declare `findBlock` (and the
rest) as adapter methods, and the diff controls gate themselves through the same
mechanism as every other capability. A standalone consumer passes an object with
those methods and nothing else.

## Anchors

Reading and writing the DOM anchors (`data-druxt-*`) is
[`@druxt-contrib/anchors`](https://www.npmjs.com/package/@druxt-contrib/anchors),
a peer the overlay and the host's wrappers share with ICE.
