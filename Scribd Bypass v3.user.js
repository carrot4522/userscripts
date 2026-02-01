// ==UserScript==
// @name         Scribd Bypass v3
// @description  Adds an optimized toolbar button that rewrites Scribd URL to scribd.vdownloaders.com and navigates there
// @author       573dave
// @version      3
// @license      MIT
// @match        *://*.scribd.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// @noframes
// @namespace    https://greasyfork.org/users/1294930
// @downloadURL  https://update.greasyfork.org/scripts/552066/Scribd%20Bypass%20v3.user.js
// @updateURL    https://update.greasyfork.org/scripts/552066/Scribd%20Bypass%20v3.meta.js
// ==/UserScript==

(function () {
  'use strict';

  console.log('[Scribd Bypass v3] Script initialized');

  // ----- Configuration -----
  const CONFIG = {
    DEBOUNCE_DELAY: 200,
    TARGET_DOMAIN: 'scribd.vdownloaders.com',
    DOC_PATTERN: /(\/(doc|document|presentation|book|read)\/\d+\/?)|(^\/read\/\d+)/i
  };

  // ----- Enhanced Styles -----
  GM_addStyle(`
    .sb-bar {
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 8px;
      z-index: 2147483646;
      background: rgba(255, 255, 255, 0.95);
      padding: 8px 12px;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
      backdrop-filter: saturate(120%) blur(6px);
      transition: transform 0.3s ease, opacity 0.3s ease;
    }
    .sb-bar.sb-hidden {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
      pointer-events: none;
    }
    .sb-btn {
      font: 600 13px/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      padding: 8px 14px;
      background: #FFC017;
      color: #111;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .sb-btn:hover {
      filter: brightness(0.92);
      transform: translateY(-1px);
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
    }
    .sb-btn:active {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    .sb-btn-secondary {
      background: #6C757D;
      color: #fff;
    }
    .sb-btn-secondary:hover {
      background: #5A6268;
    }
    @media (max-width: 768px) {
      .sb-bar {
        padding: 6px 10px;
        gap: 6px;
      }
      .sb-btn {
        font-size: 12px;
        padding: 6px 10px;
      }
    }
  `);

  // ----- Utility Functions -----
  const utils = {
    byId: (id) => document.getElementById(id),

    create: (tag, props = {}, kids = []) => {
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(props)) {
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') {
          el.addEventListener(k.slice(2), v);
        } else {
          el.setAttribute(k, v);
        }
      }
      for (const kid of kids) el.appendChild(kid);
      return el;
    },

    waitDOM: () =>
      new Promise((resolve) => {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        } else {
          resolve();
        }
      }),

    debounce: (func, delay) => {
      let timeoutId;
      return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
      };
    },

    isDocumentPage: (path = location.pathname) => {
      return CONFIG.DOC_PATTERN.test(path);
    },

    buildDownloadURL: () => {
      const u = new URL(location.href);
      u.protocol = 'https:';
      u.hostname = CONFIG.TARGET_DOMAIN;
      // Optional: Clean up marketing parameters
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
      paramsToRemove.forEach(param => u.searchParams.delete(param));
      return u.toString();
    }
  };

  // ----- Toolbar Management -----
  const toolbar = {
    current: null,

    remove: () => {
      if (toolbar.current) {
        toolbar.current.classList.add('sb-hidden');
        setTimeout(() => {
          toolbar.current?.remove();
          toolbar.current = null;
        }, 300);
      }
    },

    mount: () => {
      // Prevent duplicate mounting
      if (utils.byId('sb-bar')) return;

      // Only show on document-like pages
      if (!utils.isDocumentPage()) {
        console.log('[Scribd Bypass] Not a document page, skipping toolbar');
        return;
      }

      console.log('[Scribd Bypass] Mounting toolbar');

      const bar = utils.create('div', { id: 'sb-bar', class: 'sb-bar' });

      // Download button
      const dlBtn = utils.create('button', {
        class: 'sb-btn',
        text: '📥 Download Document',
        title: 'Switch to download domain',
        onclick: () => {
          const downloadURL = utils.buildDownloadURL();
          console.log('[Scribd Bypass] Navigating to:', downloadURL);
          location.assign(downloadURL);
        },
      });

      // Optional: Copy URL button
      const copyBtn = utils.create('button', {
        class: 'sb-btn sb-btn-secondary',
        text: '📋 Copy Link',
        title: 'Copy download link to clipboard',
        onclick: async () => {
          const downloadURL = utils.buildDownloadURL();
          try {
            await navigator.clipboard.writeText(downloadURL);
            copyBtn.textContent = '✓ Copied!';
            setTimeout(() => {
              copyBtn.textContent = '📋 Copy Link';
            }, 2000);
          } catch (err) {
            console.error('[Scribd Bypass] Failed to copy:', err);
            copyBtn.textContent = '✗ Failed';
            setTimeout(() => {
              copyBtn.textContent = '📋 Copy Link';
            }, 2000);
          }
        },
      });

      bar.append(dlBtn, copyBtn);
      document.documentElement.appendChild(bar);
      toolbar.current = bar;

      // Animate in
      requestAnimationFrame(() => {
        bar.style.opacity = '1';
      });
    },

    remount: () => {
      toolbar.remove();
      setTimeout(() => toolbar.mount(), 350);
    }
  };

  // ----- URL Change Detection -----
  const urlWatcher = {
    lastURL: location.href,
    mutationObserver: null,

    handleChange: utils.debounce(() => {
      const currentURL = location.href;
      if (currentURL !== urlWatcher.lastURL) {
        urlWatcher.lastURL = currentURL;
        console.log('[Scribd Bypass] URL changed:', currentURL);
        toolbar.remount();
      }
    }, CONFIG.DEBOUNCE_DELAY),

    init: () => {
      // Intercept history methods
      const wrapHistory = (method) => {
        const original = history[method];
        return function(...args) {
          const result = original.apply(this, args);
          urlWatcher.handleChange();
          return result;
        };
      };

      history.pushState = wrapHistory('pushState');
      history.replaceState = wrapHistory('replaceState');
      window.addEventListener('popstate', urlWatcher.handleChange);

      // Lightweight MutationObserver for SPA navigation
      urlWatcher.mutationObserver = new MutationObserver(urlWatcher.handleChange);
      urlWatcher.mutationObserver.observe(document.documentElement, {
        subtree: true,
        childList: true
      });

      console.log('[Scribd Bypass] URL watcher initialized');
    },

    destroy: () => {
      if (urlWatcher.mutationObserver) {
        urlWatcher.mutationObserver.disconnect();
        urlWatcher.mutationObserver = null;
      }
    }
  };

  // ----- Keyboard Shortcuts -----
  const shortcuts = {
    init: () => {
      document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Shift + D = Download
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
          e.preventDefault();
          if (utils.isDocumentPage()) {
            location.assign(utils.buildDownloadURL());
          }
        }
      });
      console.log('[Scribd Bypass] Keyboard shortcuts enabled (Ctrl+Shift+D)');
    }
  };

  // ----- Initialization -----
  const init = async () => {
    try {
      console.log('[Scribd Bypass] Starting initialization');

      await utils.waitDOM();

      // Mount toolbar if on document page
      toolbar.mount();

      // Initialize URL watcher for SPA navigation
      urlWatcher.init();

      // Initialize keyboard shortcuts
      shortcuts.init();

      console.log('[Scribd Bypass v3] Initialization complete');
    } catch (error) {
      console.error('[Scribd Bypass] Initialization error:', error);
    }
  };

  // ----- Cleanup on unload -----
  window.addEventListener('beforeunload', () => {
    urlWatcher.destroy();
  });

  // Start the script
  init();
})();