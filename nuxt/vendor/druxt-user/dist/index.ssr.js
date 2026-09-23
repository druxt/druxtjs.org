'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const path = require('path');

const nameOf = (user) => {
  const attributes = (user || {}).attributes || {};
  return attributes.display_name || attributes.name || "";
};
const initialsOf = (name) => {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words[words.length - 1][0]];
  return letters.join("").toUpperCase();
};
const pictureOf = (user, included = [], field = "user_picture") => {
  const reference = (((user || {}).relationships || {})[field] || {}).data;
  if (!reference || !reference.id) return null;
  const file = (included || []).find(
    (resource) => (resource || {}).id === reference.id
  );
  const url = (((file || {}).attributes || {}).uri || {}).url || ((file || {}).attributes || {}).url;
  return url || null;
};
const rolesOf = (user, included = []) => {
  const references = (((user || {}).relationships || {}).roles || {}).data || [];
  return references.filter(Boolean).map((reference) => {
    const role = (included || []).find(
      (resource) => (resource || {}).id === reference.id
    );
    const attributes = (role || {}).attributes || {};
    return {
      id: attributes.drupal_internal__id || reference.id,
      label: attributes.label || attributes.drupal_internal__id || reference.id
    };
  });
};
const sinceOf = (user) => ((user || {}).attributes || {}).created || null;
const GRAVATAR = "https://gravatar.com/avatar";
const gravatarUrl = (hash, { size = 96, fallback = "404" } = {}) => hash ? `${GRAVATAR}/${hash}?s=${size}&d=${fallback}` : null;
const emailHash = async (email, subtle) => {
  const address = String(email || "").trim().toLowerCase();
  if (!address || !subtle || !subtle.digest || typeof TextEncoder === "undefined")
    return null;
  const bytes = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(address)
  );
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const NuxtModule = function(moduleOptions = {}) {
  this.nuxt.hook("components:dirs", (dirs) => {
    dirs.push({ path: path.join(__dirname, "components") });
  });
};

exports["default"] = NuxtModule;
exports.emailHash = emailHash;
exports.gravatarUrl = gravatarUrl;
exports.initialsOf = initialsOf;
exports.nameOf = nameOf;
exports.pictureOf = pictureOf;
exports.rolesOf = rolesOf;
exports.sinceOf = sinceOf;
