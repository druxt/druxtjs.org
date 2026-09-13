/**
 * @file
 * Tabs, preview widths and the JSON:API document on the node preview page.
 */
((Drupal, once) => {
  const key = (name) => `druxt_docs.preview.${name}`;

  // Storage can be blocked; the page works without it.
  const recall = (name) => {
    try {
      return window.localStorage.getItem(key(name));
    } catch {
      return null;
    }
  };
  const remember = (name, value) => {
    try {
      window.localStorage.setItem(key(name), value);
    } catch {
      // Not remembered.
    }
  };

  /**
   * Fetches the preview document with the editor's session and prints it.
   */
  async function loadDocument(output) {
    const code = output.querySelector('code');
    try {
      const response = await fetch(output.dataset.druxtPreviewJsonapi, {
        credentials: 'same-origin',
        headers: { Accept: 'application/vnd.api+json' },
      });
      const text = await response.text();
      let body = text;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // Not JSON: shown as it came.
      }
      code.textContent = response.ok
        ? body
        : `${response.status} ${response.statusText}\n\n${body}`;
    } catch (error) {
      code.textContent = Drupal.t('The document could not be loaded: @message', {
        '@message': error.message,
      });
    }
  }

  function init(preview) {
    const tabs = Array.from(preview.querySelectorAll('[role="tab"]'));
    const output = preview.querySelector('[data-druxt-preview-jsonapi]');
    let loaded = false;

    // Only a tab the editor picks is remembered, not the page's default.
    const select = (tab, picked = true) => {
      tabs.forEach((each) => {
        const selected = each === tab;
        each.setAttribute('aria-selected', selected ? 'true' : 'false');
        each.tabIndex = selected ? 0 : -1;
        each.classList.toggle('is-active', selected);
        each.parentElement.classList.toggle('is-active', selected);
        document.getElementById(each.getAttribute('aria-controls')).hidden =
          !selected;
      });
      if (picked) {
        remember('tab', tab.dataset.druxtPreviewTab);
      }
      if (output && !loaded && !output.closest('[role="tabpanel"]').hidden) {
        loaded = true;
        loadDocument(output);
      }
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', (event) => {
        event.preventDefault();
        select(tab);
      });
      // Arrow keys, Home and End move between tabs, as ARIA tabs expect.
      tab.addEventListener('keydown', (event) => {
        const next = {
          ArrowLeft: index - 1,
          ArrowRight: index + 1,
          Home: 0,
          End: tabs.length - 1,
        }[event.key];
        if (next === undefined) {
          return;
        }
        event.preventDefault();
        const target = tabs[(next + tabs.length) % tabs.length];
        select(target);
        target.focus();
      });
    });

    select(
      tabs.find((tab) => tab.dataset.druxtPreviewTab === recall('tab')) ||
        tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ||
        tabs[0],
      false,
    );

    const viewport = preview.querySelector('[data-druxt-preview-viewport]');
    const widths = Array.from(
      preview.querySelectorAll('[data-druxt-preview-width]'),
    );
    const resize = (button) => {
      widths.forEach((each) => {
        const pressed = each === button;
        each.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        each.classList.toggle('button--primary', pressed);
      });
      viewport.style.setProperty(
        '--druxt-preview-width',
        button.dataset.druxtPreviewWidth,
      );
      remember('width', button.dataset.druxtPreviewWidth);
    };
    widths.forEach((button) =>
      button.addEventListener('click', () => resize(button)),
    );
    const width = widths.find(
      (button) => button.dataset.druxtPreviewWidth === recall('width'),
    );
    if (width) {
      resize(width);
    }

    // A new tab keeps the preview, so core's leave-preview dialog is skipped.
    preview.querySelectorAll('a[target="_blank"]').forEach((link) => {
      link.addEventListener('click', (event) => event.stopPropagation());
    });
  }

  Drupal.behaviors.druxtDocsNodePreview = {
    attach(context) {
      once('druxt-docs-node-preview', '[data-druxt-preview]', context).forEach(
        init,
      );
    },
  };
})(Drupal, once);
