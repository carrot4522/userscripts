// ==UserScript==
// @name         Amazon Order Israel House
// @namespace    http://tampermonkey.net/
// @version      2
// @description  Keep total amount horizontal; remove "Total" label; show a house icon if Ship-to contains "Israel" placed in the middle gap.
// @match        https://www.amazon.com/gp/css/order-history*
// @match        https://www.amazon.com/orders*
// @include      *://www.amazon.*/*order-history*
// @include      *://www.amazon.*/*orders*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ====== Tweakables ====== */
  const FONT_SIZE = '1.3rem';
  const COLOR = 'red';
  const FONT_WEIGHT = '700';
  const BG_COLOR = '#f3f3f3';
  const PADDING = '2px 8px';
  const BORDER_RADIUS = '6px';

  // Alignment inside the total column: 'left' or 'right'
  const ALIGN = 'left';

  // House icon position relative to the order header box
  const HOUSE_LEFT_PCT = 58;   // percentage from the left edge
  const HOUSE_TOP_PCT = 46;    // percentage from the top edge
  const HOUSE_SIZE_PX = 24;    // icon size in pixels

  function injectStyle() {
    if (document.getElementById('tm-amz-total-style')) return;

    const style = document.createElement('style');
    style.id = 'tm-amz-total-style';
    style.textContent = `
      /* Keep the total LI horizontal and non-wrapping */
      .tm-total-li {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        flex-wrap: nowrap !important;
        white-space: nowrap !important;
      }
      .tm-total-li .a-row.a-size-mini {
        display: none !important;
      }
      .tm-total-li .a-row {
        display: inline-block !important;
        margin: 0 !important;
      }

      /* Give the "Total" column room and don't let it squeeze */
      .tm-total-col {
        text-align: ${ALIGN} !important;
        box-sizing: border-box !important;
        white-space: nowrap !important;
        flex: 0 0 auto !important;
        min-width: max-content !important;
      }

      /* Push Ship-to to the right */
      .tm-shipto-col {
        padding-left: 60px !important;
        box-sizing: border-box !important;
      }

      /* The badge styling */
      .tm-total-amount {
        color: ${COLOR} !important;
        font-size: ${FONT_SIZE} !important;
        font-weight: ${FONT_WEIGHT} !important;
        background: ${BG_COLOR} !important;
        padding: ${PADDING} !important;
        border-radius: ${BORDER_RADIUS} !important;
        border: 1px solid ${COLOR} !important;
        display: inline-flex !important;
        align-items: center !important;
        white-space: nowrap !important;
        word-break: keep-all !important;
        overflow-wrap: normal !important;
        width: auto !important;
        min-width: max-content !important;
        max-width: none !important;
        flex: 0 0 auto !important;
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: "tnum" 1, "lnum" 1;
      }

      /* Prevent Amazon from forcing word breaks */
      .aok-break-word,
      .aok-break-word * {
        word-break: normal !important;
        overflow-wrap: normal !important;
      }

      /* Positioning context for icons */
      .tm-header-pos-rel {
        position: relative !important;
      }

      /* House icon styling */
      .tm-house-icon {
        position: absolute !important;
        left: ${HOUSE_LEFT_PCT}%;
        top: ${HOUSE_TOP_PCT}%;
        transform: translate(-50%, -50%);
        width: ${HOUSE_SIZE_PX}px;
        height: ${HOUSE_SIZE_PX}px;
        pointer-events: none;
        filter: drop-shadow(0 1px 1px rgba(0,0,0,0.15));
        z-index: 2;
      }
      .tm-house-icon svg {
        width: 100%;
        height: 100%;
        display: block;
      }
    `;
    document.head.appendChild(style);
  }

  // Create house icon SVG
  function makeHouseIcon() {
    const wrapper = document.createElement('div');
    wrapper.className = 'tm-house-icon';
    wrapper.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5z"
              fill="none" stroke="${COLOR}" stroke-width="2" stroke-linejoin="round" />
      </svg>
    `;
    return wrapper;
  }

  function styleHeader(root) {
    // Mark the outer header container as positioning context
    const headerBox = root.closest('.a-box') ||
                      root.closest('.order-header') ||
                      root;

    if (headerBox) {
      headerBox.classList.add('tm-header-pos-rel');
    }

    // Style columns
    const totalCol = root.querySelector('.a-column.a-span2');
    const shipToCol = root.querySelector('.a-column.a-span7');

    if (totalCol) totalCol.classList.add('tm-total-col');
    if (shipToCol) shipToCol.classList.add('tm-shipto-col');

    // Style totals (remove "Total" label, keep amount horizontal)
    root.querySelectorAll('li.order-header__header-list-item').forEach((li) => {
      const labelEl = li.querySelector('.a-text-caps');
      if (!labelEl) return;

      const label = (labelEl.textContent || '').trim().toLowerCase();
      if (label !== 'total') return;

      li.classList.add('tm-total-li');
      labelEl.remove();

      const amountRow = Array.from(li.querySelectorAll('.a-row'))
        .find((row) => !row.classList.contains('a-size-mini'));

      if (!amountRow) return;

      const amountSpan = amountRow.querySelector('span');
      if (!amountSpan) return;

      amountSpan.classList.remove('aok-break-word');
      amountSpan.classList.add('tm-total-amount');
    });

    // Add house icon if Ship-to contains "Israel"
    if (shipToCol) {
      const shipToText = (shipToCol.textContent || '').toLowerCase();
      const hasIsrael = shipToText.includes('israel');

      if (hasIsrael && !headerBox.querySelector('.tm-house-icon')) {
        headerBox.appendChild(makeHouseIcon());
      }
    }
  }

  function styleAll() {
    injectStyle();

    // Style typical header containers
    const selectors = [
      '.a-box.order-header',
      '.order-header',
      '.order-card',
      '.a-box.order'
    ];

    document.querySelectorAll(selectors.join(', ')).forEach((box) => {
      const header = box.querySelector('.order-header__header-list') ||
                     box.querySelector('.order-header') ||
                     box.querySelector('.a-box-inner') ||
                     box;

      if (header) styleHeader(header);
    });

    // Fallback: any stray header lists
    document.querySelectorAll('.order-header__header-list').forEach((ul) => {
      const container = ul.closest('.a-box') || ul;
      styleHeader(container);
    });
  }

  function init() {
    styleAll();

    // Watch for dynamic content changes
    const observer = new MutationObserver(styleAll);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Multiple delayed runs to catch Amazon's lazy loading
    setTimeout(styleAll, 600);
    setTimeout(styleAll, 1500);
    setTimeout(styleAll, 3000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();