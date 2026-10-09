/**
 * @file
 * Fits the JSON:API preview tab's iframe to the viewport.
 *
 * The tab module renders a 600px iframe inside the page. This marks it, and
 * preview-frame.css pins it to the viewport inside the edges Drupal.displace
 * reserves for the toolbar. The top edge is set here: the admin theme's top
 * bar, where "Back to site" lives, is fixed on a wide screen and in the flow
 * on a narrow one, so the frame starts below whichever edge is lower.
 */

(function (Drupal, $, once) {
  const FRAME = '.region-content iframe, .page-content iframe, main iframe';
  const TOP_BAR = '.top-bar, .gin-secondary-toolbar';

  /**
   * Sets the frame's top edge below the toolbar and the top bar.
   *
   * @param {HTMLIFrameElement} frame
   *   The preview iframe.
   */
  function fit(frame) {
    let top = Drupal.displace.offsets.top;
    document.querySelectorAll(TOP_BAR).forEach((bar) => {
      top = Math.max(top, Math.round(bar.getBoundingClientRect().bottom));
    });
    frame.style.setProperty('--druxtjsorg-preview-top', `${Math.max(0, top)}px`);
  }

  Drupal.behaviors.druxtjsorgPreviewFrame = {
    attach(context) {
      once('druxtjsorg-preview-frame', FRAME, context).forEach((frame) => {
        frame.classList.add('druxtjsorg-preview-frame');
        fit(frame);
        // Core announces the offsets through jQuery, so the listener is too.
        $(document).on('drupalViewportOffsetChange', () => fit(frame));
        window.addEventListener('resize', () => fit(frame));
      });
    },
  };
})(Drupal, jQuery, once);
