/**
 * @file
 * Fits the JSON:API preview tab's iframe to the viewport.
 *
 * The tab module renders a 600px iframe inside the page. Here it is pinned
 * to the viewport instead, inside the edges Drupal.displace reserves for the
 * toolbar, so the preview fills the screen and follows the toolbar when it
 * collapses, moves to the side or shows Gin's vertical bar.
 */

(function (Drupal, $, once) {
  const FRAME = '.region-content iframe, .page-content iframe, main iframe';

  /**
   * Pins the frame to the viewport inside the displaced edges.
   *
   * @param {HTMLIFrameElement} frame
   *   The preview iframe.
   * @param {object} offsets
   *   Drupal.displace's offsets: top, right, bottom and left, in pixels.
   */
  function fit(frame, offsets) {
    const left = `var(--ginVerticalToolbarOffset, ${offsets.left}px)`;
    frame.style.top = `${offsets.top}px`;
    frame.style.right = `${offsets.right}px`;
    frame.style.bottom = `${offsets.bottom}px`;
    frame.style.left = left;
    frame.style.height = `calc(100vh - ${offsets.top}px - ${offsets.bottom}px)`;
    frame.style.width = `calc(100vw - ${left} - ${offsets.right}px)`;
  }

  Drupal.behaviors.druxtjsorgPreviewFrame = {
    attach(context) {
      once('druxtjsorg-preview-frame', FRAME, context).forEach((frame) => {
        frame.classList.add('druxtjsorg-preview-frame');
        fit(frame, Drupal.displace.offsets);
        // Core announces the offsets through jQuery, so the listener is too.
        $(document).on('drupalViewportOffsetChange', (event, offsets) => fit(frame, offsets));
      });
    },
  };
})(Drupal, jQuery, once);
