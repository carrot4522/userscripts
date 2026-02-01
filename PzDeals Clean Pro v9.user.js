// ==UserScript==
// @name         PzDeals Clean Pro v9
// @namespace    PzDeals Clean Pro v9
// @version      9
// @description  Removes header/hero/sidebars/banners/footer/disclaimers/follow-us etc., removes expired deals, cleans up repetitive styles, auto-fills grid layout, and adds a ShadowDOM-scoped Home button (Top-Left) - Optimized
// @match        https://www.pzdeals.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // --------- CSS: hide unwanted stuff & spacing ----------
  GM_addStyle(`
    header.site-header,
    .mobile-header,
    .header-main,
    #mobile-search,
    #search-box,
    .site-header-nav,
    nav .main-nav,
    #shopify-section-hero,
    .hero-wrap,
    .hero-wrap-mob,
    a[href*="/pages/landing"] img[src*="pz-deals-app"],
    img[src*="pz-deals-app"],
    .col-md-3.index-sidebar,
    .index-sidebar,
    .ad-box,
    .featured-sidebar,
    .credit-cards-sidebar,
    .featured-box,
    .followcustom_icon,
    .alert-box,
    .main-sticky,
    ins.adsbygoogle,
    .row.featured-deals,
    .featureddeals,
    .featuredslider-alt,
    .featureddeal-item,
    .reward-banner-content,
    footer.site-footer,
    .footer-lower,
    .social-block-row,
    .cstmsocial_icon,
    .cstm_icon_its,
    .cstm_icon_its_desktop,
    .cstm_icon_its_mobile,
    .disclaim.desk,
    .followuson.follownorm,
    .fuo_wrap,
    .twitterx { display: none !important; }

    /* Grid spacing - strict alignment */
    ul.grid.clearfix {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 15px !important;
      padding: 15px !important;
      margin: 0 !important;
      list-style: none !important;
      width: 100% !important;
    }

    ul.grid li {
      flex: 0 1 calc(20% - 12px) !important;
      min-width: 140px !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
      height: auto !important;
    }

    ul.grid li .prod-inner {
      margin: 0 !important;
      padding: 0 !important;
    }

    ul.grid li .prod-image-wrap {
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Ensure removed items don't display */
    ul.grid li[style*="display"] { display: none !important; }
  `);

  // --------- Dynamic removals ----------
  const TARGET_SELECTORS = [
    'header.site-header', '.mobile-header', '.header-main',
    '#mobile-search', '#search-box', '.site-header-nav', 'nav .main-nav',
    '#shopify-section-hero', '.hero-wrap', '.hero-wrap-mob',
    'a[href*="/pages/landing"] img[src*="pz-deals-app"]', 'img[src*="pz-deals-app"]',
    '.col-md-3.index-sidebar', '.index-sidebar', '.ad-box',
    '.white-box.alert-box.featured-sidebar.credit-cards-sidebar',
    '.white-box.featured-box', '.followcustom_icon', '.alert-box', '.main-sticky',
    'ins.adsbygoogle', '.row.featured-deals', '.featureddeals', '.featuredslider-alt',
    '.featureddeal-item', '.featured-deals .orangehead',
    '.featured-deals .slick-list', '.featured-deals .slick-track',
    '.reward-banner-content',
    'footer.site-footer', '.footer-lower', '.social-block-row',
    '.cstmsocial_icon', '.cstm_icon_its', '.cstm_icon_its_desktop', '.cstm_icon_its_mobile',
    '.disclaim.desk', '.followuson.follownorm', '.fuo_wrap', '.twitterx',
    '.tm-home-btn',
    '.product-ad-box'
  ];

  const AD_PATTERNS = /googlesyndication|doubleclick|adservice|adsystem/i;
  const FOLLOW_PATTERNS = /\.followuson|\.(?:twitterx|fuo)\b/i;

  const isAdScript = node =>
    node?.tagName === 'SCRIPT' &&
    (AD_PATTERNS.test(node.src || '') || /adsbygoogle\s*=/.test(node.textContent || ''));

  const isFollowStyle = node =>
    node?.tagName === 'STYLE' &&
    FOLLOW_PATTERNS.test(node.textContent || '');

  const isAdIframe = node =>
    node?.tagName === 'IFRAME' &&
    AD_PATTERNS.test((node.src || '') + (node.dataset?.src || ''));

  const isExpiredDeal = node => {
    if (node?.tagName !== 'LI') return false;

    const hasContent = node.querySelector('.prod-image-wrap img') ||
                      node.querySelector('.prod-caption') ||
                      node.textContent.trim().length > 20;

    return !hasContent ||
           node.classList.contains('sold-out') ||
           node.textContent.includes('Expired') ||
           node.textContent.includes('EXPIRED');
  };

  // Batch removal with fragment
  function removeTargets(root = document) {
    const toRemove = [];

    // Collect all elements to remove
    TARGET_SELECTORS.forEach(sel => {
      try {
        root.querySelectorAll(sel).forEach(el => toRemove.push(el));
      } catch (e) {
        // Invalid selector, skip
      }
    });

    root.querySelectorAll('script').forEach(s => {
      if (isAdScript(s)) toRemove.push(s);
    });

    root.querySelectorAll('iframe').forEach(ifr => {
      if (isAdIframe(ifr)) toRemove.push(ifr);
    });

    root.querySelectorAll('style').forEach(st => {
      if (isFollowStyle(st) || /\.sd2\s*{\s*height:\s*60px;\s*}/.test(st.textContent || '')) {
        toRemove.push(st);
      }
    });

    // Remove expired/empty deals - check ALL list items
    root.querySelectorAll('ul.grid.clearfix li').forEach(li => {
      if (isExpiredDeal(li)) toRemove.push(li);
    });

    // Also check other potential list items
    root.querySelectorAll('li[data-count]').forEach(li => {
      if (isExpiredDeal(li)) toRemove.push(li);
    });

    // Deduplicate and remove
    const seen = new Set();
    toRemove.forEach(el => {
      if (!seen.has(el)) {
        seen.add(el);
        el.remove();
      }
    });
  }

  // --------- ShadowDOM Home Button (immune to site CSS) ----------
  function addShadowHome() {
    if (document.getElementById('tm-home-host')) return;

    const host = document.createElement('div');
    host.id = 'tm-home-host';
    host.style.cssText = `
      position: fixed;
      top: max(14px, env(safe-area-inset-top));
      left: max(14px, env(safe-area-inset-left));
      z-index: 2147483647;
      pointer-events: none;
    `;
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>
        :host, * { box-sizing: border-box; }
        .wrap {
          all: initial;
          position: relative;
          display: inline-flex;
          pointer-events: auto;
        }
        .btn {
          all: initial;
          width: 44px; height: 44px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(32,35,39,0.84);
          color: white;
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: 0 4px 12px rgba(0,0,0,.28);
          cursor: pointer;
          text-decoration: none;
          transition: transform .15s ease, background .25s ease;
        }
        .btn:hover {
          transform: translateY(-1px);
          background: rgba(42,82,190,0.96);
        }
        .icon {
          all: initial;
          width: 22px; height: 22px;
          display: inline-block;
        }
        .icon path {
          stroke: currentColor;
          stroke-width: 2.2;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        @media (prefers-color-scheme: light) {
          .btn {
            background: rgba(255,255,255,0.92);
            color: #1f2937;
            border-color: rgba(0,0,0,0.10);
          }
        }
        @media (max-width: 480px) {
          .btn { width: 40px; height: 40px; border-radius: 9px; }
          .icon { width: 20px; height: 20px; }
        }
      </style>
      <div class="wrap">
        <a class="btn" id="goHome" title="Home" role="button" aria-label="Go Home">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 10.5L12 3l9 7.5M5 10.5V20a2 2 0 0 0 2 2h4v-6h2v6h4a2 2 0 0 0 2-2v-9.5"/>
          </svg>
        </a>
      </div>
    `;

    const btn = shadow.getElementById('goHome');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.assign('/');
    }, { capture: true });
  }

  // --------- Init + observe with immediate and batch cleanup ----------
  let debounceTimer;
  let isRunning = false;

  const debouncedCleanup = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!isRunning) {
        isRunning = true;
        removeTargets();
        addShadowHome();
        isRunning = false;
      }
    }, 50); // Faster debounce for quicker response
  };

  const start = () => {
    if (!isRunning) {
      isRunning = true;
      removeTargets();
      addShadowHome();
      isRunning = false;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  // Very responsive observer - catches grid changes immediately
  const observer = new MutationObserver(debouncedCleanup);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });
})();