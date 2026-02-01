// ==UserScript==
// @name         Amazon Clean v2
// @namespace   Amazon Clean v2
// @version      2
// @description  Remove Sponsored/Ad results from Amazon search pages and make coupon badges pop. Optimized for 2025.
// @match        https://www.amazon.com/*
// @match        https://smile.amazon.com/*
// @match        https://www.amazon.*/*
// @match        https://smile.amazon.*/*
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript==
(function () {
  'use strict';
  // Enhanced coupon styling with better visibility
  GM_addStyle(`
    .rps-coupon-badge {
      background: #22c55e !important;
      color: #04131b !important;
      padding: 3px 8px !important;
      border-radius: 6px !important;
      font-weight: 700 !important;
      display: inline-block !important;
      box-shadow: 0 2px 4px rgba(34, 197, 94, 0.3) !important;
    }
  `);
  // Cached selectors for performance
  const SELECTORS = {
    searchResults: '[data-component-type="s-search-result"]',
    sponsoredLabels: '[aria-label*="Sponsored" i], [data-component-type="sp-sponsored-result"]',
    adCarousels: [
      '[data-component-type="s-searchgrid-carousel"]',
      'div[cel_widget_id*="s-ads"]',
      'div[cel_widget_id*="Sponsored"]',
      'div[data-component-type="serp-creative"]',
      '[data-component-type*="ad-"]'
    ].join(', '),
    coupons: '[aria-label*="coupon" i], .s-coupon-unclipped, .s-coupon-clip-button, [data-csa-c-type="widget"] [aria-label*="coupon" i], .savingPillVerticalMargin'
  };
  // Optimized sponsored detection with WeakSet to avoid reprocessing
  const processedCards = new WeakSet();
  const isSponsoredCard = (card) => {
    // Quick DOM check for sponsored elements
    if (card.querySelector(SELECTORS.sponsoredLabels)) return true;
    // Optimized text search - only scan visible text nodes
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null);
    let node;
    while (node = walker.nextNode()) {
      const txt = node.textContent.trim().toLowerCase();
      if (txt === 'sponsored' || /\b(ad|advertisement)\b/.test(txt)) return true;
    }
    return false;
  };
  const processSearch = () => {
    // Process search result cards
    document.querySelectorAll(SELECTORS.searchResults).forEach(card => {
      if (processedCards.has(card)) return;
      processedCards.add(card);
      // Hide sponsored results
      if (isSponsoredCard(card)) {
        card.style.display = 'none';
        return;
      }
      // Highlight coupons on legitimate results
      const couponEl = card.querySelector(SELECTORS.coupons);
      if (couponEl && !couponEl.classList.contains('rps-coupon-badge')) {
        couponEl.classList.add('rps-coupon-badge');
      }
    });
    // Hide sponsored carousels and ad blocks
    document.querySelectorAll(SELECTORS.adCarousels).forEach(el => {
      if (!processedCards.has(el)) {
        el.style.display = 'none';
        processedCards.add(el);
      }
    });
  };
  // Debounced observer for better performance on dynamic content
  let debounceTimer;
  const debouncedProcess = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processSearch, 150);
  };
  // Watch for dynamic loads with optimized observer
  const mo = new MutationObserver(debouncedProcess);
  mo.observe(document.body, {
    childList: true,
    subtree: true,
    // Only watch for additions, not attribute changes
    attributes: false
  });
  // Initial run
  processSearch();
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    mo.disconnect();
    clearTimeout(debounceTimer);
  });
})();