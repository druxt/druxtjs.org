/**
 * @file
 * Opens one paragraph's edit dialog in the page form's builder.
 *
 * The frontend's Edit on a block links here with the paragraph's uuid, so the
 * editor lands on that block, ready to change it, and saves the page as usual.
 */
((Drupal, drupalSettings) => {
  /** How long to wait for the builder to bind its links, in milliseconds. */
  const PATIENCE = 5000;

  /**
   * The paragraph's own edit link, once Drupal's AJAX has bound it.
   *
   * The builder renders its components again after it loads, so the link is
   * looked up each time rather than held.
   */
  const editLink = (uuid) => {
    const component = document.querySelector(
      `.js-lpb-component[data-uuid="${CSS.escape(uuid)}"]`,
    );
    if (!component) {
      return null;
    }
    const link = [...component.querySelectorAll('a.lpb-edit')].find(
      (candidate) => candidate.closest('.js-lpb-component') === component,
    );
    return link && /\bajax\b/.test(link.dataset.once || '') ? link : null;
  };

  Drupal.behaviors.druxtjsorgEditParagraph = {
    attach() {
      const uuid = (drupalSettings.druxtjsorg || {}).editParagraph;
      if (!uuid || this.started) {
        return;
      }
      this.started = true;
      const until = Date.now() + PATIENCE;
      const open = () => {
        const link = editLink(uuid);
        if (link) {
          link.closest('.js-lpb-component').scrollIntoView({ block: 'center' });
          link.click();
        } else if (Date.now() < until) {
          setTimeout(open, 100);
        }
      };
      setTimeout(open, 0);
    },
  };
})(Drupal, drupalSettings);
