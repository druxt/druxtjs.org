/**
 * Whether a Drupal purge changed what the open page shows.
 *
 * CommonJS so the tests and the plugin can both require it.
 */

/** A menu's configuration or links: the header, sidebar and footer show them. */
const MENUS = /^(config:system\.menu\.|menu_link_content(_list)?(:|$))/

/**
 * Whether the purged tags touch the page.
 *
 * A save also purges list tags such as `node_list`, which every page would
 * otherwise hear about. Only an entity the page loaded, a menu, or a purge
 * naming nothing in particular counts.
 *
 * @param {string[]} tags - The purged cache tags. None means everything.
 * @param {(tags: string[]) => { entities: object[] }} affected - Maps tags to the stored entities they name.
 * @returns {boolean} True when the page shows something the purge changed.
 */
const touchesPage = (tags, affected) => {
  if (!tags || !tags.length) return true
  if (tags.some((tag) => MENUS.test(tag))) return true
  return affected(tags).entities.length > 0
}

module.exports = { MENUS, touchesPage }
