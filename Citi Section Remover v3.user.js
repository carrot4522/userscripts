// ==UserScript==
// @name         Citi Section Remover v3
// @namespace    http://tampermonkey.net/
// @version      3
// @description  Aggressively removes unwanted sections from Citi online banking dashboard for a cleaner interface.
// @author       You
// @match        https://online.citi.com/US/*
// @grant        none
// @run-at       document-start
// @downloadURL  https://update.greasyfork.org/scripts/Citi-Section-Remover.user.js
// @updateURL    https://update.greasyfork.org/scripts/Citi-Section-Remover.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // ===== Configuration =====
    const CONFIG = {
        debug: false, // Set to true for detailed logging
        intervals: {
            continuous: 500,
            delays: [100, 500, 1000, 2000, 3000, 5000]
        },
        observer: {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        }
    };

    // ===== Selectors to Remove =====
    const SELECTORS = {
        products: [
            'dashboard-account-other-offers',
            '.nba-tile-container',
            '.account-other',
            '.product-offers-wrapper',
            'dashboard-account-next-best'
        ],
        fico: [
            '.fico-wrapper',
            '.fico-tile-left-panel',
            'dashboard-fico-score-tile',
            '.fico-score-tile'
        ],
        spending: [
            '.spend-summary-wrapper',
            '.spend-summary-tile',
            'ums-spend-summary-tile',
            '.summary-tile-body'
        ],
        security: [
            '.security-tile',
            '.security-tile-full',
            'cds-tile.security-tile-full'
        ],
        offers: [
            '.merchant-offers-wrapper',
            'merchant-offers-tile'
        ],
        linking: [
            'app-linking-tile',
            'single-click-linking-tile'
        ],
        footer: [
            'citi-footer',
            'citi-footer-navigation',
            'citi-social-media',
            'citi-footer-sub-navigation',
            'citi-footer-disclaimer',
            'citi-sub-footer',
            '.footer[role="contentinfo"]'
        ],
        chat: [
            '.chat-fixed-button',
            'button.chat-fixed-button'
        ]
    };

    // ===== Text Patterns to Match =====
    const TEXT_PATTERNS = [
        'Explore Products',
        'YOUR CREDIT SCORE',
        'Your FICO',
        'CITI PRODUCTS & OFFERS',
        'View All Citi Offers',
        'MANAGE YOUR FINANCES',
        'Your Spending for',
        'Security Tip',
        'Account Protection',
        'Use Citi Mobile',
        'Do More With Citi'
    ];

    // ===== Parent Selectors to Search =====
    const PARENT_SELECTORS = [
        '.tile-wrapper',
        '.cds-tile-wrapper',
        'cds-tile',
        '.fico-wrapper',
        '.product-offers-wrapper',
        '.spend-summary-wrapper',
        '.ng-star-inserted'
    ];

    // ===== State Management =====
    let removalCount = 0;
    let observer = null;
    let intervalId = null;

    // ===== Utility Functions =====
    const log = (message, ...args) => {
        if (CONFIG.debug) {
            console.log(`[Citi Remover] ${message}`, ...args);
        }
    };

    const logRemoval = (selector) => {
        removalCount++;
        log(`Removed: ${selector}`);
    };

    // ===== Removal Functions =====

    /**
     * Remove elements by CSS selector
     * @returns {boolean} True if any elements were removed
     */
    function removeBySelector() {
        let removed = false;

        // Flatten all selector arrays into one
        const allSelectors = Object.values(SELECTORS).flat();

        allSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element && element.parentNode) {
                    element.remove();
                    logRemoval(selector);
                    removed = true;
                }
            });
        });

        return removed;
    }

    /**
     * Find closest parent element from list of selectors
     * @param {HTMLElement} element - Starting element
     * @returns {HTMLElement|null} Found parent or null
     */
    function findClosestParent(element) {
        for (const selector of PARENT_SELECTORS) {
            const parent = element.closest(selector);
            if (parent) return parent;
        }
        return null;
    }

    /**
     * Remove elements by text content in headings
     * @returns {boolean} True if any elements were removed
     */
    function removeByTextContent() {
        let removed = false;

        const headings = document.querySelectorAll('h1, h2, h3, h4, .tile-header, .header-text-full');

        headings.forEach(heading => {
            TEXT_PATTERNS.forEach(pattern => {
                if (heading.textContent.includes(pattern)) {
                    const parent = findClosestParent(heading);
                    if (parent && parent.parentNode) {
                        parent.remove();
                        logRemoval(`Text: ${pattern}`);
                        removed = true;
                    }
                }
            });
        });

        return removed;
    }

    /**
     * Remove elements by link patterns
     * @returns {boolean} True if any elements were removed
     */
    function removeByLinks() {
        let removed = false;

        const linkPatterns = [
            'citioffersforyou',
            'security-center',
            'citibank-location-finder'
        ];

        const links = document.querySelectorAll('a');
        links.forEach(link => {
            const href = link.getAttribute('href') || '';
            const id = link.getAttribute('id') || '';

            const matchesPattern = linkPatterns.some(pattern => href.includes(pattern));
            const isATMLink = id === 'atmLink';

            if (matchesPattern || isATMLink) {
                const parent = findClosestParent(link) ||
                             link.closest('.nba-tile-container') ||
                             link.parentElement;

                if (parent && parent.parentNode) {
                    parent.remove();
                    logRemoval('Link: ' + (href || id));
                    removed = true;
                }
            }
        });

        return removed;
    }

    /**
     * Clean up empty tile wrappers
     * @returns {boolean} True if any elements were hidden
     */
    function cleanEmptyTiles() {
        let removed = false;

        const tileWrappers = document.querySelectorAll('.tile-wrapper');
        tileWrappers.forEach(wrapper => {
            const isEmpty = wrapper.children.length === 0;
            const hasMinimalContent = wrapper.textContent.trim().length < 10;

            if (isEmpty || hasMinimalContent) {
                wrapper.style.display = 'none';
                logRemoval('Empty tile');
                removed = true;
            }
        });

        return removed;
    }

    /**
     * Main removal function - orchestrates all removal methods
     */
    function removeSections() {
        let removed = false;

        try {
            removed = removeBySelector() || removed;
            removed = removeByTextContent() || removed;
            removed = removeByLinks() || removed;
            removed = cleanEmptyTiles() || removed;

            if (removed) {
                log(`Removal cycle completed (total removals: ${removalCount})`);
            }
        } catch (e) {
            console.error('[Citi Remover] Error during removal:', e);
        }
    }

    // ===== Observer Management =====

    /**
     * Initialize and start MutationObserver
     */
    function startObserver() {
        if (!document.body) {
            setTimeout(startObserver, 100);
            return;
        }

        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(() => {
            removeSections();
        });

        observer.observe(document.body, CONFIG.observer);
        log('Observer started');
    }

    /**
     * Stop the observer
     */
    function stopObserver() {
        if (observer) {
            observer.disconnect();
            log('Observer stopped');
        }
    }

    // ===== Interval Management =====

    /**
     * Start continuous removal interval
     */
    function startContinuousRemoval() {
        if (intervalId) {
            clearInterval(intervalId);
        }

        intervalId = setInterval(removeSections, CONFIG.intervals.continuous);
        log('Continuous removal started');
    }

    /**
     * Stop continuous removal interval
     */
    function stopContinuousRemoval() {
        if (intervalId) {
            clearInterval(intervalId);
            log('Continuous removal stopped');
        }
    }

    /**
     * Schedule delayed removals
     */
    function scheduleDelayedRemovals() {
        CONFIG.intervals.delays.forEach(delay => {
            setTimeout(() => {
                log(`Delayed removal at ${delay}ms`);
                removeSections();
            }, delay);
        });
    }

    // ===== Initialization =====

    /**
     * Initialize the script
     */
    function init() {
        log('Initializing Citi Section Remover v3...');

        // Run initial removal
        removeSections();

        // Start observer
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                removeSections();
                startObserver();
            });
        } else {
            startObserver();
        }

        // Start continuous removal
        startContinuousRemoval();

        // Schedule delayed removals
        scheduleDelayedRemovals();

        console.log('[Citi Remover] v3 initialized - Aggressive mode active');
    }

    // ===== Cleanup on Page Unload =====
    window.addEventListener('beforeunload', () => {
        stopObserver();
        stopContinuousRemoval();
    });

    // Start the script
    init();

})();