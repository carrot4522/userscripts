// ==UserScript==
// @name         Amazon price history
// @namespace    Eliminater74
// @version      2.0.0
// @description  Optimized Amazon enhancer with strict Monthly Payments detection, lazy loading, SPA support, and enhanced UI controls
// @author       Eliminater74
// @license      MIT
// @match        https://www.amazon.com/*
// @match        https://www.amazon.co.uk/*
// @match        https://www.amazon.de/*
// @match        https://www.amazon.fr/*
// @match        https://www.amazon.it/*
// @match        https://www.amazon.es/*
// @match        https://www.amazon.ca/*
// @match        https://smile.amazon.com/*
// @grant        GM_xmlhttpRequest
// @connect      reviewmeta.com
// @run-at       document-end
// @downloadURL https://update.greasyfork.org/scripts/538006/Amazon%20Enhancer.user.js
// @updateURL https://update.greasyfork.org/scripts/538006/Amazon%20Enhancer.meta.js
// ==/UserScript==

(function () {
  'use strict';

  // ========================================
  // CONSTANTS & CONFIGURATION
  // ========================================

  const SETTINGS_KEY = 'amazonEnhancerSettings';
  const GEAR_POS_KEY = 'amazonEnhancerGearPos';

  const DEFAULT_SETTINGS = {
    showReviewMeta: true,
    showCamel: true,
    showKeepa: true,
    theme: 'auto',
    highlightBestReviews: true,
    hideAds: true,
    showSoldBy: true,
    stickyPriceBox: true,
    autoSortReviews: true,
    expandReviewsQA: true,
    highlightMonthlyPayments: true,
    filterOnlyMonthly: false,
    hideFbtAndRecs: true,
    forceVerifiedPurchase: false,
    keyboardShortcut: true,
    primeOnlyFilter: false,
    debugMonthlyDetector: false
  };

  // Currency symbols by locale
  const CURRENCY_MAP = {
    us: '$', uk: '£', de: '€', fr: '€',
    es: '€', it: '€', ca: '$'
  };

  // Locale-specific CamelCamelCamel domains
  const CAMEL_DOMAINS = {
    us: 'camelcamelcamel.com',
    uk: 'uk.camelcamelcamel.com',
    de: 'de.camelcamelcamel.com',
    fr: 'fr.camelcamelcamel.com',
    es: 'es.camelcamelcamel.com',
    it: 'it.camelcamelcamel.com',
    ca: 'camelcamelcamel.com'
  };

  // Keepa domain codes
  const KEEPA_CODES = {
    us: '1', uk: '2', de: '3', fr: '4',
    es: '5', it: '8', ca: '9'
  };

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const onIdle = (fn) => (window.requestIdleCallback || setTimeout)(fn, 0);

  const debounce = (fn, ms = 200) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  };

  const throttle = (fn, ms = 200) => {
    let lastRun = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastRun >= ms) {
        lastRun = now;
        fn(...args);
      }
    };
  };

  // Local storage helpers with error handling
  function loadJSON(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn(`[Amazon Enhancer] Failed to load ${key}:`, error);
      return null;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`[Amazon Enhancer] Failed to save ${key}:`, error);
    }
  }

  // ========================================
  // LOCALE & ASIN DETECTION
  // ========================================

  function getLocale() {
    const hostname = location.hostname.toLowerCase();
    if (hostname.includes('.co.uk')) return 'uk';
    if (hostname.includes('.de')) return 'de';
    if (hostname.includes('.fr')) return 'fr';
    if (hostname.includes('.es')) return 'es';
    if (hostname.includes('.it')) return 'it';
    if (hostname.includes('.ca')) return 'ca';
    return 'us';
  }

  function detectASIN() {
    // Try URL pattern first
    const urlMatch = location.href.match(/\/([A-Z0-9]{10})(?:[/?]|$)/);
    if (urlMatch) return urlMatch[1];

    // Try input elements
    const asinInput = $('input#ASIN') || $('[name="ASIN.0"]') || $('[name="ASIN"]');
    if (asinInput?.value) return asinInput.value;

    // Try body attributes
    const bodyAsin = document.body.getAttribute('data-asin') ||
                     document.body.getAttribute('data-asin-candidate');
    if (bodyAsin && /^[A-Z0-9]{10}$/.test(bodyAsin)) return bodyAsin;

    // Try any element with data-asin
    const asinElement = $('[data-asin]');
    const elementAsin = asinElement?.getAttribute('data-asin');
    return elementAsin && /^[A-Z0-9]{10}$/.test(elementAsin) ? elementAsin : null;
  }

  // ========================================
  // SETTINGS MANAGEMENT
  // ========================================

  const settings = Object.assign({}, DEFAULT_SETTINGS, loadJSON(SETTINGS_KEY) || {});
  saveJSON(SETTINGS_KEY, settings);

  const locale = getLocale();
  let currentASIN = detectASIN();

  // ========================================
  // THEME MANAGEMENT
  // ========================================

  function applyTheme(mode) {
    const html = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode;

    html.setAttribute('data-enhancer-theme', theme);

    // Remove old style if exists
    $('#amazon-enhancer-theme-style')?.remove();

    const style = document.createElement('style');
    style.id = 'amazon-enhancer-theme-style';
    style.textContent = `
      /* Dark theme support */
      [data-enhancer-theme="dark"] .amazon-enhancer-box {
        background: #1d1d1d !important;
        color: #f0f0f0 !important;
        border-color: #555 !important;
      }
      [data-enhancer-theme="dark"] .amazon-enhancer-box a {
        color: #7dddf2 !important;
      }
      [data-enhancer-theme="dark"] .amazon-enhancer-panel {
        background: #2c2c2c !important;
        color: #eee !important;
        border-color: #555 !important;
      }

      /* Review highlighting */
      .highlighted-review {
        border: 2px solid #ffd700 !important;
        background: #fffbea !important;
        border-radius: 4px;
      }

      /* Monthly payment badge */
      .monthly-badge {
        position: absolute;
        top: 10px;
        left: 10px;
        background: #0099cc !important;
        color: #fff !important;
        padding: 4px 8px;
        font-weight: bold;
        font-size: 11px;
        border-radius: 4px;
        z-index: 2147483647 !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }

      /* Sticky price box enhancement */
      .sticky-price-enhanced {
        position: sticky !important;
        top: 0 !important;
        background: #fff !important;
        z-index: 9999 !important;
        border-bottom: 2px solid #ddd !important;
        padding: 10px !important;
      }
      [data-enhancer-theme="dark"] .sticky-price-enhanced {
        background: #1d1d1d !important;
        border-bottom-color: #555 !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize theme
  applyTheme(settings.theme);

  // ========================================
  // UI - GEAR BUTTON & SETTINGS PANEL
  // ========================================

  function createToggleUI() {
    // Create gear button
    const gear = document.createElement('div');
    gear.id = 'amazon-enhancer-gear';
    gear.innerHTML = '⚙️';
    gear.title = 'Amazon Enhancer Settings';
    gear.style.cssText = `
      position: fixed;
      width: 40px;
      height: 40px;
      font-size: 22px;
      background: #222;
      color: #fff;
      border: 2px solid #888;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: move;
      box-shadow: 0 0 12px rgba(0,0,0,0.8);
      z-index: 2147483647;
      user-select: none;
    `;

    restoreGearPosition(gear);

    // Create settings panel
    const panel = document.createElement('div');
    panel.className = 'amazon-enhancer-panel';
    panel.style.cssText = `
      position: fixed;
      border: 1px solid #ccc;
      padding: 12px;
      border-radius: 8px;
      z-index: 2147483646;
      background: #fff;
      display: none;
      right: 20px;
      bottom: 70px;
      max-width: 350px;
      max-height: 80vh;
      overflow-y: auto;
      font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    const settingsConfig = [
      { key: 'showReviewMeta', label: 'ReviewMeta Integration', section: 'data' },
      { key: 'showCamel', label: 'CamelCamelCamel Price History', section: 'data' },
      { key: 'showKeepa', label: 'Keepa Price History', section: 'data' },
      { key: 'highlightBestReviews', label: 'Highlight Most Helpful Reviews', section: 'reviews' },
      { key: 'autoSortReviews', label: 'Auto-Sort Reviews (Recent First)', section: 'reviews' },
      { key: 'forceVerifiedPurchase', label: 'Show Only Verified Purchase Reviews', section: 'reviews' },
      { key: 'expandReviewsQA', label: 'Auto-Expand Reviews & Q&A', section: 'reviews' },
      { key: 'highlightMonthlyPayments', label: 'Highlight Amazon Monthly Payments', section: 'search' },
      { key: 'filterOnlyMonthly', label: 'Filter: Show Only Monthly Payments', section: 'search' },
      { key: 'primeOnlyFilter', label: 'Filter: Prime Eligible Only', section: 'search' },
      { key: 'hideAds', label: 'Hide Sponsored Ads', section: 'ui' },
      { key: 'hideFbtAndRecs', label: 'Hide Recommendations & Bundles', section: 'ui' },
      { key: 'showSoldBy', label: 'Highlight "Sold By" Information', section: 'ui' },
      { key: 'stickyPriceBox', label: 'Sticky Price Box', section: 'ui' },
      { key: 'keyboardShortcut', label: 'Keyboard Shortcut (Alt+E)', section: 'advanced' },
      { key: 'debugMonthlyDetector', label: 'Debug: Log Monthly Payment Detection', section: 'advanced' }
    ];

    // Group settings by section
    const sections = {
      data: 'Data & Price History',
      reviews: 'Reviews & Ratings',
      search: 'Search Filters',
      ui: 'UI Enhancements',
      advanced: 'Advanced Options'
    };

    let panelHTML = '<div style="margin-bottom:10px;"><strong>Amazon Enhancer Settings</strong></div>';

    Object.entries(sections).forEach(([sectionKey, sectionLabel]) => {
      const sectionSettings = settingsConfig.filter(s => s.section === sectionKey);
      if (sectionSettings.length > 0) {
        panelHTML += `<div style="margin-top:12px;padding-top:8px;border-top:1px solid #ddd;">
          <div style="font-weight:600;margin-bottom:6px;color:#666;">${sectionLabel}</div>`;

        sectionSettings.forEach(({ key, label }) => {
          panelHTML += `
            <label style="display:block;margin:5px 0;cursor:pointer;">
              <input type="checkbox" id="${key}" ${settings[key] ? 'checked' : ''}
                     style="margin-right:6px;cursor:pointer;">
              ${label}
            </label>`;
        });

        panelHTML += '</div>';
      }
    });

    panelHTML += `
      <div style="margin-top:12px;padding-top:8px;border-top:1px solid #ddd;">
        <label style="display:block;margin-bottom:6px;font-weight:600;color:#666;">
          Theme
          <select id="themeSelect" style="margin-left:8px;padding:3px;cursor:pointer;">
            <option value="auto" ${settings.theme === 'auto' ? 'selected' : ''}>Auto</option>
            <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
          </select>
        </label>
      </div>

      <div style="margin-top:12px;">
        <button id="rescanMonthlyBtn"
                style="width:100%;padding:8px;background:#232f3e;color:#fff;border:none;
                       border-radius:4px;cursor:pointer;font-weight:600;">
          Rescan Monthly Payments Now
        </button>
      </div>

      <div style="margin-top:10px;font-size:11px;color:#666;text-align:center;">
        Version 2.0.0 | <a href="https://github.com" target="_blank" style="color:#0066c0;">Help</a>
      </div>
    `;

    panel.innerHTML = panelHTML;

    // Add event listeners for checkboxes
    settingsConfig.forEach(({ key }) => {
      const checkbox = panel.querySelector(`#${key}`);
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          settings[key] = e.target.checked;
          saveJSON(SETTINGS_KEY, settings);
          handleSettingChange(key);
        });
      }
    });

    // Theme selector
    panel.querySelector('#themeSelect').addEventListener('change', (e) => {
      settings.theme = e.target.value;
      saveJSON(SETTINGS_KEY, settings);
      applyTheme(settings.theme);
    });

    // Rescan button
    panel.querySelector('#rescanMonthlyBtn').addEventListener('click', () => {
      rescanMonthly.force();
    });

    // Drag functionality for gear button
    setupGearDrag(gear, panel);

    document.body.appendChild(gear);
    document.body.appendChild(panel);
  }

  function handleSettingChange(key) {
    switch(key) {
      case 'filterOnlyMonthly':
      case 'highlightMonthlyPayments':
      case 'debugMonthlyDetector':
        rescanMonthly.force();
        break;
      case 'primeOnlyFilter':
        if (settings.primeOnlyFilter) {
          primeOnlyFilter(true);
        } else {
          showAllResults();
        }
        break;
      case 'hideAds':
        hideSponsored();
        break;
      case 'hideFbtAndRecs':
        hideFbtAndRecs();
        break;
      case 'showReviewMeta':
      case 'showCamel':
      case 'showKeepa':
        renderDataBoxes();
        break;
      case 'stickyPriceBox':
        makeStickyPriceBox();
        break;
      case 'showSoldBy':
        showSoldByBox();
        break;
      case 'highlightBestReviews':
        highlightReviews();
        break;
      case 'autoSortReviews':
        autoSortReviews();
        break;
      case 'expandReviewsQA':
        expandSections();
        break;
      case 'forceVerifiedPurchase':
        forceVerifiedOnly();
        break;
    }
  }

  function setupGearDrag(gear, panel) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let hasMoved = false;

    gear.addEventListener('mousedown', (e) => {
      isDragging = true;
      hasMoved = false;
      const rect = gear.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      gear.style.left = `${e.clientX - startX}px`;
      gear.style.top = `${e.clientY - startY}px`;
      gear.style.right = 'auto';
      gear.style.bottom = 'auto';
      hasMoved = true;
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;

      if (hasMoved) {
        saveJSON(GEAR_POS_KEY, {
          left: gear.style.left,
          top: gear.style.top
        });
      }
    });

    gear.addEventListener('click', () => {
      if (hasMoved) return;
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    gear.ondragstart = () => false;

    // Keyboard shortcut
    if (settings.keyboardShortcut) {
      document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'e') {
          e.preventDefault();
          panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
      });
    }
  }

  function restoreGearPosition(gear) {
    const savedPos = loadJSON(GEAR_POS_KEY);
    if (savedPos?.left && savedPos?.top) {
      gear.style.left = savedPos.left;
      gear.style.top = savedPos.top;
      gear.style.right = 'auto';
      gear.style.bottom = 'auto';
    } else {
      gear.style.bottom = '20px';
      gear.style.right = '20px';
    }
  }

  // ========================================
  // DATA BOXES (LAZY LOADING)
  // ========================================

  function appendToTarget(element) {
    const targets = [
      '#unifiedPrice_feature_div',
      '#corePrice_feature_div',
      '#title'
    ];

    for (const selector of targets) {
      const target = $(selector);
      if (target) {
        const container = target.closest('.a-section') || target;
        container.appendChild(element);
        return true;
      }
    }
    return false;
  }

  function renderDataBoxes() {
    // Remove existing boxes
    $$('.amazon-enhancer-box').forEach(box => box.remove());

    const asin = currentASIN || detectASIN();
    if (!asin) return;

    if (settings.showReviewMeta) injectReviewMeta(asin);
    if (settings.showCamel) injectCamelLazy(asin);
    if (settings.showKeepa) injectKeepaLazy(asin);
  }

  function createDataBox(title) {
    const div = document.createElement('div');
    div.className = 'amazon-enhancer-box';
    div.style.cssText = `
      margin-top: 10px;
      padding: 12px;
      border: 1px solid #d5d9d9;
      border-radius: 8px;
      background: #f7fafa;
    `;
    return div;
  }

  function injectCamelLazy(asin) {
    const box = createDataBox('CamelCamelCamel');
    const domain = CAMEL_DOMAINS[locale] || CAMEL_DOMAINS.us;

    box.innerHTML = `
      <strong style="color:#232f3e;">📊 CamelCamelCamel Price History</strong>
      <div style="margin-top:8px;">
        <a href="https://${domain}/product/${asin}"
           target="_blank"
           rel="noopener noreferrer"
           style="color:#007185;text-decoration:none;">
          <img data-lazy-src="https://charts.camelcamelcamel.com/${locale}/${asin}/amazon-new-used.png?force=1&zero=0&w=600&h=340&desired=false&legend=1&ilt=1&tp=all&fo=0"
               alt="CamelCamelCamel price history chart"
               style="max-width:100%;height:auto;border-radius:4px;opacity:0.01;transition:opacity 0.3s;">
        </a>
        <div style="margin-top:6px;font-size:11px;color:#565959;">
          Click chart to view detailed price history
        </div>
      </div>
    `;

    if (appendToTarget(box)) {
      lazyLoadImage($('img[data-lazy-src]', box));
    }
  }

  function injectKeepaLazy(asin) {
    const box = createDataBox('Keepa');
    const domainCode = KEEPA_CODES[locale] || '1';

    box.innerHTML = `
      <strong style="color:#232f3e;">📈 Keepa Price History</strong>
      <div style="margin-top:8px;">
        <a href="https://keepa.com/#!product/${domainCode}-${asin}"
           target="_blank"
           rel="noopener noreferrer"
           style="color:#007185;text-decoration:none;">
          <img data-lazy-src="https://graph.keepa.com/pricehistory.png?used=1&amazon=1&new=1&domain=${locale}&asin=${asin}"
               alt="Keepa price history chart"
               style="max-width:100%;height:auto;border-radius:4px;opacity:0.01;transition:opacity 0.3s;">
        </a>
        <div style="margin-top:6px;font-size:11px;color:#565959;">
          Click chart to view detailed price history & alerts
        </div>
      </div>
    `;

    if (appendToTarget(box)) {
      lazyLoadImage($('img[data-lazy-src]', box));
    }
  }

  function lazyLoadImage(img) {
    if (!img) return;

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const src = img.getAttribute('data-lazy-src');
          if (src) {
            img.src = src;
            img.style.opacity = '1';
            img.removeAttribute('data-lazy-src');
          }
          obs.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '200px'
    });

    observer.observe(img);
  }

  function injectReviewMeta(asin) {
    const box = createDataBox('ReviewMeta');
    const reviewMetaLocale = locale === 'us' ? '' : `-${locale}`;
    const url = `https://reviewmeta.com/amazon${reviewMetaLocale}/${asin}`;

    box.innerHTML = `
      <strong style="color:#232f3e;">🔍 ReviewMeta Analysis</strong>
      <div style="margin-top:8px;color:#565959;">Loading review analysis...</div>
    `;

    appendToTarget(box);

    GM_xmlhttpRequest({
      method: 'GET',
      url: url,
      timeout: 10000,
      onload: (response) => {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(response.responseText, 'text/html');

          const adjustedRating = doc.querySelector('#adjusted-rating-large')?.textContent?.trim();
          const fakePercent = Array.from(doc.querySelectorAll('small'))
            .find(el => /potentially unnatural/i.test(el.textContent || ''))
            ?.querySelector('span span')?.textContent?.trim();

          if (adjustedRating) {
            box.innerHTML = `
              <strong style="color:#232f3e;">🔍 ReviewMeta Analysis</strong>
              <div style="margin-top:8px;">
                <div style="margin-bottom:6px;">
                  <strong>Adjusted Rating:</strong>
                  <span style="color:#c7511f;font-weight:600;">${adjustedRating}/5</span>
                </div>
                <div style="margin-bottom:8px;">
                  <strong>Potentially Fake Reviews:</strong>
                  <span style="color:#c7511f;font-weight:600;">${fakePercent || 'Not available'}</span>
                </div>
                <a href="${url}"
                   target="_blank"
                   rel="noopener noreferrer"
                   style="color:#007185;text-decoration:none;font-size:12px;">
                  View Full Analysis on ReviewMeta →
                </a>
              </div>
            `;
          } else {
            box.innerHTML = `
              <strong style="color:#232f3e;">🔍 ReviewMeta Analysis</strong>
              <div style="margin-top:8px;">
                <div style="color:#c7511f;margin-bottom:6px;">
                  No analysis data available for this product.
                </div>
                <a href="${url}"
                   target="_blank"
                   rel="noopener noreferrer"
                   style="color:#007185;text-decoration:none;font-size:12px;">
                  Submit Product for Analysis →
                </a>
              </div>
            `;
          }
        } catch (error) {
          console.error('[Amazon Enhancer] ReviewMeta parsing error:', error);
          box.innerHTML = `
            <strong style="color:#232f3e;">🔍 ReviewMeta Analysis</strong>
            <div style="margin-top:8px;">
              <div style="color:#c7511f;margin-bottom:6px;">
                Unable to load review analysis.
              </div>
              <a href="${url}"
                 target="_blank"
                 rel="noopener noreferrer"
                 style="color:#007185;text-decoration:none;font-size:12px;">
                View on ReviewMeta →
              </a>
            </div>
          `;
        }
      },
      onerror: () => {
        box.innerHTML = `
          <strong style="color:#232f3e;">🔍 ReviewMeta Analysis</strong>
          <div style="margin-top:8px;color:#c7511f;">
            Failed to load ReviewMeta data.
          </div>
        `;
      },
      ontimeout: () => {
        box.innerHTML = `
          <strong style="color:#232f3e;">🔍 ReviewMeta Analysis</strong>
          <div style="margin-top:8px;color:#c7511f;">
            Request timed out.
          </div>
        `;
      }
    });
  }

  // ========================================
  // PRODUCT PAGE ENHANCEMENTS
  // ========================================

  function highlightReviews() {
    if (!settings.highlightBestReviews) return;

    const reviews = $$('.review');
    if (reviews.length === 0) return;

    // Parse helpful count and sort
    const reviewsWithHelpful = reviews.map(review => {
      const helpfulText = review.innerText || review.textContent || '';
      const match = helpfulText.match(/(\d[\d,]*)\s+(?:people|person)\s+found\s+this\s+helpful/i);
      const helpfulCount = match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
      return { element: review, helpfulCount };
    });

    reviewsWithHelpful.sort((a, b) => b.helpfulCount - a.helpfulCount);

    // Highlight top 3 most helpful reviews
    reviewsWithHelpful.slice(0, 3).forEach(({ element }) => {
      element.classList.add('highlighted-review');
    });
  }

  function autoSortReviews() {
    if (!settings.autoSortReviews) return;

    const sortSelector = $('select[name="sortBy"]');
    if (sortSelector && sortSelector.value !== 'recent') {
      sortSelector.value = 'recent';
      sortSelector.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function forceVerifiedOnly() {
    if (!settings.forceVerifiedPurchase) return;

    // Try checkbox first
    const verifiedCheckbox = $('input[type="checkbox"]').find(input => {
      const label = input.closest('label');
      return label && /verified\s+purchase/i.test(label.textContent || '');
    });

    if (verifiedCheckbox && !verifiedCheckbox.checked) {
      verifiedCheckbox.click();
      return;
    }

    // Try link as fallback
    const verifiedLink = $('a').find(link =>
      /verified\s+purchase/i.test(link.textContent || '')
    );

    if (verifiedLink) {
      verifiedLink.click();
    }
  }

  function expandSections() {
    if (!settings.expandReviewsQA) return;

    // Expand various collapsible sections
    const expandSelectors = [
      '.a-expander-prompt',
      '.a-expander-prompt-content',
      '.a-expander-header',
      'span.a-expander-prompt',
      'button[aria-label*="See more" i]',
      'button[aria-label*="Show more" i]'
    ];

    expandSelectors.forEach(selector => {
      $(selector).forEach(element => {
        try {
          element.click();
        } catch (e) {
          // Ignore errors from elements that can't be clicked
        }
      });
    });
  }

  function makeStickyPriceBox() {
    if (!settings.stickyPriceBox) return;

    const priceBox = $('#corePrice_feature_div') || $('#unifiedPrice_feature_div');
    if (priceBox) {
      priceBox.classList.add('sticky-price-enhanced');
    }
  }

  function showSoldByBox() {
    if (!settings.showSoldBy) return;

    const merchantInfo = $('#merchant-info');
    if (merchantInfo) {
      merchantInfo.style.border = '2px dashed #ff9900';
      merchantInfo.style.padding = '8px';
      merchantInfo.style.borderRadius = '4px';
      merchantInfo.style.backgroundColor = '#fff9e6';
    }
  }

  // ========================================
  // MONTHLY PAYMENTS DETECTION (OPTIMIZED)
  // ========================================

  const CURRENCY_SYMBOL = CURRENCY_MAP[locale] || ';
  const CURRENCY_REGEX_ESCAPED = CURRENCY_SYMBOL.replace(/[.*+?^${}()|[\]\\]/g, '\\    reviewsWithHelpful.sort((a');

  // Normalize whitespace including non-breaking spaces
  const normalizeText = (text) => {
    return (text || '')
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F]/g, ' ')
      .replace(/\s+\/\s+/g, '/')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  // INCLUDE patterns for Amazon Monthly Payments
  const MONTHLY_PATTERNS = {
    // "$XX/month for N months" or "$XX per month for N months"
    standard: new RegExp(
      `${CURRENCY_REGEX_ESCAPED}\\s?\\d[\\d,]*(?:\\.\\d{2})?\\s*(?:\\/|per)\\s*(?:mo|month|monthly)\\.?\\s*(?:for|x|over)\\s*\\d+\\s*(?:months|mos)\\b`,
      'i'
    ),

    // "N monthly payments" or "N interest-free monthly payments"
    payments: /\b\d+\s+(?:interest[- ]?free\s+)?monthly\s+payments?\b/i,

    // Explicit "Amazon Monthly Payments" label
    amazonLabel: /\bamazon\s+monthly\s+payments?\b/i
  };

  // EXCLUDE third-party financing/credit services
  const EXCLUDED_SERVICES = /\b(affirm|klarna|afterpay|zip|quadpay|sezzle|prime\s*visa|store\s*card|credit\s*card|apr|financing|lease|subscription|installment\s*plan)\b/i;

  function extractResultText(result) {
    const textContent = result.textContent || '';
    const ariaLabels = Array.from(result.querySelectorAll('[aria-label]'))
      .map(el => el.getAttribute('aria-label') || '')
      .join(' ');

    return normalizeText(`${textContent} ${ariaLabels}`);
  }

  function hasAmazonMonthlyPayment(result) {
    const text = extractResultText(result);
    if (!text) return false;

    // Exclude third-party services first
    if (EXCLUDED_SERVICES.test(text)) {
      if (settings.debugMonthlyDetector) {
        const asin = result.getAttribute('data-asin') || 'unknown';
        console.log(`[Amazon Enhancer] Excluded result (${asin}):`, text);
      }
      return false;
    }

    // Check for Amazon monthly payment patterns
    const hasPattern = MONTHLY_PATTERNS.standard.test(text) ||
                       MONTHLY_PATTERNS.payments.test(text) ||
                       MONTHLY_PATTERNS.amazonLabel.test(text);

    if (settings.debugMonthlyDetector && hasPattern) {
      const asin = result.getAttribute('data-asin') || 'unknown';
      console.log(`[Amazon Enhancer] Matched result (${asin}):`, text);
    }

    return hasPattern;
  }

  const rescanMonthly = (() => {
    function scan() {
      const results = $('[data-component-type="s-search-result"], .s-result-item');
      if (results.length === 0) return;

      results.forEach(result => {
        // Remove existing badge
        const existingBadge = $('.monthly-badge', result);
        if (existingBadge) {
          existingBadge.remove();
        }

        const hasMonthly = hasAmazonMonthlyPayment(result);

        if (hasMonthly) {
          // Add badge if highlighting is enabled
          if (settings.highlightMonthlyPayments) {
            const badge = document.createElement('div');
            badge.className = 'monthly-badge';
            badge.textContent = '💳 Monthly';
            badge.title = 'Amazon Monthly Payments Available';

            // Ensure parent has relative positioning
            const computedStyle = getComputedStyle(result);
            if (computedStyle.position === 'static') {
              result.style.position = 'relative';
            }

            result.appendChild(badge);
          }

          // Show result
          result.style.removeProperty('display');
        } else if (settings.filterOnlyMonthly) {
          // Hide result if filtering is enabled
          result.style.display = 'none';
        } else {
          // Show result
          result.style.removeProperty('display');
        }
      });
    }

    const debouncedScan = debounce(scan, 150);

    return Object.assign(
      (immediate = false) => immediate ? scan() : debouncedScan(),
      { force: scan }
    );
  })();

  function showAllResults() {
    $('[data-component-type="s-search-result"], .s-result-item').forEach(result => {
      result.style.removeProperty('display');
    });
  }

  // ========================================
  // PRIME FILTER
  // ========================================

  function primeOnlyFilter(immediate = false) {
    const filter = () => {
      if (!settings.primeOnlyFilter) {
        showAllResults();
        return;
      }

      const results = $('[data-component-type="s-search-result"], .s-result-item');
      results.forEach(result => {
        const hasPrime = result.querySelector(
          'i[aria-label*="Prime" i], span[aria-label*="Prime" i], svg[aria-label*="Prime" i], .a-icon-prime'
        );

        result.style.display = hasPrime ? '' : 'none';
      });
    };

    return immediate ? filter() : onIdle(filter);
  }

  // ========================================
  // AD & RECOMMENDATION HIDING
  // ========================================

  function hideSponsored() {
    if (!settings.hideAds) return;

    const adSelectors = [
      '[data-component-type="sp-sponsored-result"]',
      '[data-cel-widget^="sp_"]',
      'div.AdHolder',
      'div[data-ad-feedback]',
      'div[data-ad-details]',
      '.s-sponsored-header',
      'div[aria-label*="Sponsored" i]'
    ];

    adSelectors.forEach(selector => {
      $(selector).forEach(ad => {
        ad.style.display = 'none';
      });
    });
  }

  function hideFbtAndRecs() {
    if (!settings.hideFbtAndRecs) return;

    const unwantedPhrases = [
      /frequently\s+bought\s+together/i,
      /customers\s+who\s+bought/i,
      /customers\s+who\s+viewed/i,
      /products\s+related\s+to\s+this\s+item/i,
      /inspired\s+by\s+your\s+browsing\s+history/i,
      /compare\s+with\s+similar\s+items/i,
      /sponsored\s+products\s+related/i
    ];

    $('h2, h3, h4').forEach(heading => {
      const text = heading.textContent || '';
      if (unwantedPhrases.some(pattern => pattern.test(text))) {
        const container = heading.closest('.a-section') ||
                         heading.closest('[data-component-type]') ||
                         heading.parentElement;
        if (container) {
          container.style.display = 'none';
        }
      }
    });
  }

  // ========================================
  // PAGE INITIALIZATION
  // ========================================

  function pageInit() {
    currentASIN = detectASIN();

    // Render data boxes for product pages
    renderDataBoxes();

    // Apply enhancements based on settings
    if (settings.highlightBestReviews) onIdle(highlightReviews);
    if (settings.hideAds) onIdle(hideSponsored);
    if (settings.showSoldBy) onIdle(showSoldByBox);
    if (settings.stickyPriceBox) onIdle(makeStickyPriceBox);
    if (settings.autoSortReviews) onIdle(autoSortReviews);
    if (settings.expandReviewsQA) onIdle(expandSections);
    if (settings.forceVerifiedPurchase) onIdle(forceVerifiedOnly);
    if (settings.hideFbtAndRecs) onIdle(hideFbtAndRecs);

    // Apply search filters
    if (settings.highlightMonthlyPayments || settings.filterOnlyMonthly) {
      rescanMonthly.force();
    }
    if (settings.primeOnlyFilter) {
      primeOnlyFilter(true);
    }
  }

  // ========================================
  // MUTATION OBSERVER & SPA SUPPORT
  // ========================================

  const rescanAll = throttle(() => {
    hideSponsored();
    hideFbtAndRecs();
    rescanMonthly();

    if (settings.primeOnlyFilter) {
      primeOnlyFilter(true);
    }
  }, 400);

  const mutationObserver = new MutationObserver(() => {
    rescanAll();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  // ========================================
  // HISTORY API HOOK (SPA NAVIGATION)
  // ========================================

  (function hookHistoryAPI() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      setTimeout(pageInit, 100);
      return result;
    };

    history.replaceState = function(...args) {
      const result = originalReplaceState.apply(this, args);
      setTimeout(pageInit, 100);
      return result;
    };

    window.addEventListener('popstate', () => {
      setTimeout(pageInit, 100);
    });
  })();

  // ========================================
  // INITIALIZATION
  // ========================================

  // Create UI on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createToggleUI);
  } else {
    createToggleUI();
  }

  // Initialize page enhancements
  pageInit();

  console.log('[Amazon Enhancer] Version 2.0.0 loaded successfully');
})();