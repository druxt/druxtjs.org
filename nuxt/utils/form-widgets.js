/**
 * What the live example's form widgets show, worked out from a field's
 * schema. Pure, so the components stay thin and this stays testable.
 */

/** The one value a field holds, whatever its cardinality. */
export const single = (value) => (Array.isArray(value) ? value[0] : value)

/** The integers a number widget offers: its configured range, widened to hold the current value. */
export function numberRange(schema, value) {
  const config = ((schema || {}).settings || {}).config || {}
  const current = Number(single(value)) || 0
  const min = Math.min(Number(config.min ?? -10), current)
  const max = Math.max(Number(config.max ?? 10), current)
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}

/** A list field's allowed values as options, from a list of { value, label } or a map of value to label. */
export function allowedOptions(schema) {
  const s = (schema || {}).settings || {}
  const allowed = (s.storage || {}).allowed_values || (s.config || {}).allowed_values || []
  return Array.isArray(allowed) ? allowed : Object.entries(allowed).map(([value, label]) => ({ value, label }))
}

/** The resource types a reference field can point at, from its handler settings. */
export function referenceTypes(schema) {
  const s = (schema || {}).settings || {}
  const type = (s.storage || {}).target_type
  const bundles = Object.keys(((s.config || {}).handler_settings || {}).target_bundles || {})
  return type ? bundles.map((bundle) => `${type}--${bundle}`) : []
}

/** Entities as options: their label, and the type a reference needs back. */
export const entityOptions = (entities) =>
  entities.map((o) => ({ value: o.id, label: (o.attributes || {}).name || (o.attributes || {}).title || (o.attributes || {}).label || o.id, type: o.type }))

/** A reference value's id, whether it arrives as relationship data or a bare id. */
export function referenceId(value) {
  const item = single(value)
  if (item && typeof item === 'object') return (item.data && single(item.data) ? single(item.data).id : item.id) || ''
  return item || ''
}

/** Every reference a value holds, as { type, id }, whether relationship data, a list, or one item. */
export function referenceItems(value) {
  const data = value && typeof value === 'object' && !Array.isArray(value) && 'data' in value ? value.data : value
  return [].concat(data || []).filter((o) => o && typeof o === 'object' && o.id)
}
