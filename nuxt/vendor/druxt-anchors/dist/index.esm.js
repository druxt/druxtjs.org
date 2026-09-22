const ENTITY = "data-druxt-entity";
const TYPE = "data-druxt-type";
const FIELD = "data-druxt-field";
const DELTA = "data-druxt-delta";
const entityAnchors = (type, id) => {
  if (!id)
    return {};
  return type ? { [ENTITY]: id, [TYPE]: type } : { [ENTITY]: id };
};
const fieldAnchors = (name, delta) => {
  if (!name)
    return {};
  const anchors = { [FIELD]: name };
  if (typeof delta === "number")
    anchors[DELTA] = String(delta);
  return anchors;
};
const escapeValue = (value) => String(value).replace(/["\\]/g, "\\$&");
const findAnchor = (root, { entity, type, field, delta } = {}) => {
  if (!root || typeof root.querySelector !== "function")
    return null;
  const parts = [];
  if (entity)
    parts.push(`[${ENTITY}="${escapeValue(entity)}"]`);
  if (type)
    parts.push(`[${TYPE}="${escapeValue(type)}"]`);
  if (field)
    parts.push(`[${FIELD}="${escapeValue(field)}"]`);
  if (typeof delta === "number")
    parts.push(`[${DELTA}="${escapeValue(delta)}"]`);
  if (!parts.length)
    return null;
  return root.querySelector(parts.join(""));
};

export { DELTA, ENTITY, FIELD, TYPE, entityAnchors, escapeValue, fieldAnchors, findAnchor };
