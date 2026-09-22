# @druxt-contrib/anchors

The shared DOM anchor contract for Druxt. It is how a rendered entity and field
name themselves in the DOM, so a later pass, a diff view, an inline editor
(ICE), or a canvas, can find the same element again.

The contract is four data attributes:

| Attribute           | Holds                                          |
| ------------------- | ---------------------------------------------- |
| `data-druxt-entity` | the entity id, exactly as JSON:API returned it |
| `data-druxt-type`   | the resource type, e.g. `node--doc_page`       |
| `data-druxt-field`  | the public field name                          |
| `data-druxt-delta`  | the item index on a multi-value field          |

The strings are frozen. Every consumer depends on this package rather than
hard-coding them, and a test here asserts the four literals so a change fails a
build instead of a query.

## Use

```js
import { entityAnchors, fieldAnchors, findAnchor } from '@druxt-contrib/anchors'

// Spread onto the rendered element.
const attrs = { ...entityAnchors('node--doc_page', id), ...fieldAnchors('field_text', 0) }

// Find it again.
const el = findAnchor(document, { entity: id, field: 'field_text', delta: 0 })
```

`entityAnchors` returns nothing without an id, because an anchor that cannot be
addressed is worse than none. `fieldAnchors` writes the delta only when it is a
number (zero included). `findAnchor` returns `null` for an empty descriptor
rather than matching the whole page, and escapes values by hand because
`CSS.escape` is absent in Node 16 and jsdom.

## Consumers

- `@druxt-contrib/diff` — reads anchors to place its inline marks and overlays.
- ICE (the inline content editor) — writes anchors on its editable wrappers.
