/**
 * What the live example's form widgets show, worked out from a field's
 * schema. Pure, so the components stay thin and this stays testable.
 */

/** The one value a field holds, whatever its cardinality. */
export const single = (value) => (Array.isArray(value) ? value[0] : value)

/**
 * The integers a number widget offers: its configured range, widened to hold
 * the current value. Null when the span is too broad to pick from, and the
 * widget takes a typed value instead.
 */
export function numberRange(schema, value) {
  const config = ((schema || {}).settings || {}).config || {}
  const current = Number(single(value)) || 0
  const lo = Number(config.min ?? -10)
  const hi = Number(config.max ?? 10)
  if (Math.max(hi, current) - Math.min(lo, current) > 500) return null
  const range = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  return current >= lo && current <= hi ? range : [...range, current].sort((a, b) => a - b)
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

/**
 * Whether a reference field allows every bundle of its target type: Drupal
 * reads null or absent `target_bundles` as unrestricted, while an empty array
 * or map allows none.
 */
export function unrestrictedReference(schema) {
  const s = (schema || {}).settings || {}
  const settings = (s.config || {}).handler_settings || {}
  return !!(s.storage || {}).target_type && settings.target_bundles == null
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
