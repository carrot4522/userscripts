// ==UserScript==
// @name         Quora Expand All v6
// @namespace    Quora Expand All v6
// @version      6
// @description  Automatically expand "more" buttons on Quora with optimized performance, better detection, and multiple language support
// @author       ClaoDD
// @match        https://www.quora.com/*
// @match        https://*.quora.com/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://update.greasyfork.org/scripts/422209/Quora%20expand%20all%20more%20buttons%20v5.user.js
// @updateURL    https://update.greasyfork.org/scripts/422209/Quora%20expand%20all%20more%20buttons%20v5.meta.js
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Quora Expand v5] Initializing...');

    // ---------- Configuration ----------
    const CONFIG = {
        DEBOUNCE_SCROLL: 300,
        DEBOUNCE_MUTATION: 500,
        PROCESSING_DELAY: 100,
        INITIAL_DELAYS: [1500, 3000],
        SPA_DELAY: 1500,
        SELECTORS: [
            '.qu-fontFamily--sans',
            'button[aria-label*="more"]',
            'button[aria-label*="More"]',
            'span[role="button"]',
            'div[role="button"]',
            'a[role="button"]',
            'button.qu-hover',
            '[class*="more"]'
        ],
        KEYWORDS: {
            text: [
                '(more)',
                'view more',
                'see more',
                'show more',
                'read more',
                'continua a leggere', // Italian
                'ver más',            // Spanish
                'voir plus',          // French
                'mehr anzeigen',      // German
                'もっと見る',         // Japanese
                '더 보기'             // Korean
            ],
            aria: [
                'more',
                'expand',
                'show',
                'view'
            ]
        }
    };

    // ---------- State Management ----------
    const state = {
        clickedButtons: new WeakSet(),
        isProcessing: false,
        lastUrl: location.href,
        expandCount: 0,
        observers: new Set()
    };

    // ---------- Utility Functions ----------
    const utils = {
        debounce: (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        shouldClickElement: (element) => {
            if (!element) return false;

            const text = element.textContent.trim().toLowerCase();
            const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
            const className = (element.className || '').toLowerCase();

            // Check text content
            for (const keyword of CONFIG.KEYWORDS.text) {
                if (text === keyword.toLowerCase() || text.includes(keyword.toLowerCase())) {
                    return true;
                }
            }

            // Check aria-label
            for (const keyword of CONFIG.KEYWORDS.aria) {
                if (ariaLabel.includes(keyword)) {
                    return true;
                }
            }

            // Check class names for "more" related classes
            if (className.includes('more') && className.includes('button')) {
                return true;
            }

            return false;
        },

        safeClick: (element) => {
            try {
                if (element.click && typeof element.click === 'function') {
                    element.click();
                    return true;
                }
            } catch (e) {
                console.warn('[Quora Expand] Click failed:', e);
            }
            return false;
        }
    };

    // ---------- Expansion Logic ----------
    const expander = {
        expand: () => {
            if (state.isProcessing) {
                console.log('[Quora Expand] Already processing, skipping...');
                return;
            }

            state.isProcessing = true;

            setTimeout(() => {
                try {
                    const elements = Array.from(document.querySelectorAll(CONFIG.SELECTORS.join(', ')));
                    let clickedThisRound = 0;

                    elements.forEach((element) => {
                        // Skip if already clicked
                        if (state.clickedButtons.has(element)) return;

                        // Check if element is visible
                        const rect = element.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0;
                        if (!isVisible) return;

                        // Check if should click
                        if (utils.shouldClickElement(element)) {
                            state.clickedButtons.add(element);
                            if (utils.safeClick(element)) {
                                clickedThisRound++;
                                state.expandCount++;
                            }
                        }
                    });

                    if (clickedThisRound > 0) {
                        console.log(`[Quora Expand] Expanded ${clickedThisRound} buttons (total: ${state.expandCount})`);
                    }
                } catch (error) {
                    console.error('[Quora Expand] Error during expansion:', error);
                } finally {
                    state.isProcessing = false;
                }
            }, CONFIG.PROCESSING_DELAY);
        }
    };

    // ---------- Scroll Handler ----------
    const scrollHandler = {
        init: () => {
            const debouncedExpand = utils.debounce(expander.expand, CONFIG.DEBOUNCE_SCROLL);
            window.addEventListener('scroll', debouncedExpand, { passive: true });
            console.log('[Quora Expand] Scroll handler initialized');
        }
    };

    // ---------- Mutation Observer ----------
    const observerManager = {
        init: () => {
            const debouncedExpand = utils.debounce(expander.expand, CONFIG.DEBOUNCE_MUTATION);

            const contentObserver = new MutationObserver((mutations) => {
                // Only process if there are actual changes
                const hasRelevantChanges = mutations.some(m => m.addedNodes.length > 0);
                if (hasRelevantChanges) {
                    debouncedExpand();
                }
            });

            const targetNode = document.querySelector('main, #root, [role="main"]') || document.body;
            contentObserver.observe(targetNode, {
                childList: true,
                subtree: true
            });

            state.observers.add(contentObserver);
            console.log('[Quora Expand] Content observer initialized');
        },

        destroy: () => {
            state.observers.forEach(obs => obs.disconnect());
            state.observers.clear();
            console.log('[Quora Expand] Observers destroyed');
        }
    };

    // ---------- SPA Navigation Handler ----------
    const navigationHandler = {
        init: () => {
            const checkUrlChange = utils.debounce(() => {
                const currentUrl = location.href;
                if (currentUrl !== state.lastUrl) {
                    state.lastUrl = currentUrl;
                    console.log('[Quora Expand] URL changed, resetting...');

                    // Clear clicked buttons for new page
                    state.clickedButtons = new WeakSet();

                    // Trigger expansion after delay
                    setTimeout(() => expander.expand(), CONFIG.SPA_DELAY);
                }
            }, 100);

            const navObserver = new MutationObserver(checkUrlChange);
            navObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

            state.observers.add(navObserver);
            console.log('[Quora Expand] Navigation handler initialized');
        }
    };

    // ---------- Initial Load Handler ----------
    const initialLoadHandler = {
        init: () => {
            CONFIG.INITIAL_DELAYS.forEach((delay, index) => {
                setTimeout(() => {
                    console.log(`[Quora Expand] Initial expansion ${index + 1}/${CONFIG.INITIAL_DELAYS.length}`);
                    expander.expand();
                }, delay);
            });
        }
    };

    // ---------- Keyboard Shortcut (Optional) ----------
    const keyboardHandler = {
        init: () => {
            window.addEventListener('keydown', (e) => {
                // Ctrl+Shift+E to manually trigger expansion
                if (e.ctrlKey && e.shiftKey && e.key === 'E') {
                    e.preventDefault();
                    console.log('[Quora Expand] Manual expansion triggered');
                    expander.expand();
                }
            });
            console.log('[Quora Expand] Keyboard shortcuts initialized (Ctrl+Shift+E)');
        }
    };

    // ---------- Performance Monitor ----------
    const performanceMonitor = {
        logStats: () => {
            console.log(`[Quora Expand] Stats - Total expanded: ${state.expandCount}, URL: ${location.href}`);
        },

        init: () => {
            // Log stats every 30 seconds
            setInterval(() => {
                if (state.expandCount > 0) {
                    performanceMonitor.logStats();
                }
            }, 30000);
        }
    };

    // ---------- Initialization ----------
    const init = () => {
        console.log('[Quora Expand v5] Starting initialization');

        try {
            scrollHandler.init();
            observerManager.init();
            navigationHandler.init();
            initialLoadHandler.init();
            keyboardHandler.init();
            performanceMonitor.init();

            console.log('[Quora Expand v5] Initialization complete');
        } catch (error) {
            console.error('[Quora Expand v5] Initialization error:', error);
        }
    };

    // ---------- Cleanup on Unload ----------
    window.addEventListener('beforeunload', () => {
        observerManager.destroy();
    });

    // Start the script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

})();