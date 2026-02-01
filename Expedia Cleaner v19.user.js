// ==UserScript==
// @name         Expedia Cleaner v19
// @namespace    Expedia Cleaner v19
// @version      19
// @description  Optimized removal of footer and promotional content from Expedia.com with complete header preservation and enhanced performance
// @author       You
// @match        https://www.expedia.com/*
// @match        https://expedia.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ========================================
    // CONFIGURATION
    // ========================================

    const CONFIG = {
        DEBUG: false, // Set to true for verbose logging
        OBSERVER: {
            THROTTLE_DELAY: 500, // Delay between cleanup runs (ms)
            INITIAL_DELAYS: [500, 1000, 2000] // Initial cleanup delays
        },
        SELECTORS: {
            // Header (to preserve)
            header: 'header.global-navigation-site-header, .global-navigation-site-header',

            // Footer (to remove)
            footer: 'footer, .global-navigation-footer, footer.global-navigation-footer',
            footerCard: '.uitk-card-has-secondary-theme',

            // Promotional content
            carousel: '[class*="carousel"], [data-stid*="carousel"], .uitk-carousel-container, [data-stid="carousel-container"]',
            mojoCard: '[data-testid="mojo-card"]',
            tabPanel: '[role="tabpanel"], .uitk-tabs-pane, .uitk-tabs-content',

            // Images
            heroImage: 'figure.uitk-image, figure, div, section',

            // App links
            appLink: 'a[href*="expe.app.link"]'
        },
        KEYWORDS: {
            footer: ['Company', 'Expedia Group'],
            promotional: [
                'Bundle & Save',
                'Price Drop Protection',
                'OneKeyCash',
                'Save 25%',
                'Unlock sale deals',
                '25%+ off for members'
            ],
            images: ['travel-assets', 'Homepage', 'View of', 'skyline']
        },
        CSS: {
            INJECT_EARLY: true
        }
    };

    // ========================================
    // STATE MANAGEMENT
    // ========================================

    const state = {
        processedElements: new WeakSet(),
        totalRemoved: 0,
        cssInjected: false,
        observer: null,
        initialCleanupsComplete: 0
    };

    // ========================================
    // LOGGING UTILITY
    // ========================================

    const Logger = {
        prefix: '[Expedia Cleaner v3]',

        log(...args) {
            console.log(this.prefix, ...args);
        },

        debug(...args) {
            if (CONFIG.DEBUG) {
                console.log(this.prefix, '[DEBUG]', ...args);
            }
        },

        warn(...args) {
            console.warn(this.prefix, ...args);
        },

        info(...args) {
            console.info(this.prefix, ...args);
        }
    };

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    const Utils = {
        throttle(func, delay) {
            let timeoutId;
            let lastRun = 0;

            return function(...args) {
                const now = Date.now();

                clearTimeout(timeoutId);

                if (now - lastRun >= delay) {
                    func.apply(this, args);
                    lastRun = now;
                } else {
                    timeoutId = setTimeout(() => {
                        func.apply(this, args);
                        lastRun = Date.now();
                    }, delay - (now - lastRun));
                }
            };
        },

        isInHeader(element) {
            if (!element) return false;
            return element.closest(CONFIG.SELECTORS.header) !== null;
        },

        removeElement(element, reason = '') {
            if (!element || state.processedElements.has(element)) {
                return false;
            }

            // Critical: Never remove header or anything inside it
            if (this.isInHeader(element)) {
                Logger.debug('Skipped removal (inside header):', reason);
                return false;
            }

            try {
                state.processedElements.add(element);
                element.remove();
                state.totalRemoved++;

                if (reason) {
                    Logger.debug(`Removed: ${reason}`);
                }

                return true;
            } catch (error) {
                Logger.warn('Failed to remove element:', error);
                return false;
            }
        },

        containsKeyword(text, keywords, maxLength = Infinity) {
            if (!text || !keywords) return false;
            if (text.length > maxLength) return false;

            const normalizedText = text.toLowerCase().trim();
            return keywords.some(keyword =>
                normalizedText.includes(keyword.toLowerCase())
            );
        }
    };

    // ========================================
    // CSS INJECTION
    // ========================================

    const CSSInjector = {
        getStyles() {
            return `
                /* Hide footer - but NOT header */
                footer.global-navigation-footer,
                .global-navigation-footer:not(.global-navigation-site-header),
                .uitk-card-has-secondary-theme:has(footer) {
                    display: none !important;
                }

                /* Preserve header explicitly */
                header.global-navigation-site-header,
                .global-navigation-site-header,
                .global-navigation-site-header * {
                    display: revert !important;
                    visibility: visible !important;
                }

                /* Hide promotional cards and carousels */
                .uitk-carousel-container,
                [data-stid="carousel-container"],
                [data-testid="mojo-card"] {
                    display: none !important;
                }

                /* Hide tab panels with promotional content */
                .uitk-tabs-content:not(.global-navigation-site-header .uitk-tabs-content),
                .uitk-tabs-pane:not(.global-navigation-site-header .uitk-tabs-pane),
                [role="tabpanel"]:not(.global-navigation-site-header [role="tabpanel"]) {
                    display: none !important;
                }

                /* Hide hero images */
                figure.uitk-image img[src*="travel-assets"]:not(.global-navigation-site-header img),
                figure.uitk-image img[src*="Homepage"]:not(.global-navigation-site-header img),
                img[alt*="View of"]:not(.global-navigation-site-header img),
                img[alt*="skyline"]:not(.global-navigation-site-header img) {
                    display: none !important;
                }

                /* Hide Open App button - but preserve header buttons */
                a[href*="expe.app.link"]:not(.global-navigation-site-header a[href*="expe.app.link"]) {
                    display: none !important;
                }
            `;
        },

        inject() {
            if (state.cssInjected) return;

            try {
                const style = document.createElement('style');
                style.id = 'expedia-cleaner-styles';
                style.textContent = this.getStyles();

                if (document.head) {
                    document.head.appendChild(style);
                    state.cssInjected = true;
                    Logger.debug('CSS injected successfully');
                } else {
                    // Retry if head not available yet
                    setTimeout(() => this.inject(), 50);
                }
            } catch (error) {
                Logger.warn('CSS injection error:', error);
            }
        }
    };

    // ========================================
    // ELEMENT REMOVERS
    // ========================================

    const Removers = {
        removeFooter() {
            let count = 0;
            const footerSelectors = [
                CONFIG.SELECTORS.footer,
                CONFIG.SELECTORS.footerCard
            ];

            footerSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (state.processedElements.has(element)) return;

                    const text = element.textContent || '';
                    const isFooter = Utils.containsKeyword(text, CONFIG.KEYWORDS.footer);

                    if (isFooter && Utils.removeElement(element, 'Footer element')) {
                        count++;
                    }
                });
            });

            return count;
        },

        removeCarousels() {
            const carousels = document.querySelectorAll(CONFIG.SELECTORS.carousel);
            let count = 0;

            carousels.forEach(carousel => {
                if (Utils.removeElement(carousel, 'Carousel element')) {
                    count++;
                }
            });

            return count;
        },

        removeMojoCards() {
            const cards = document.querySelectorAll(CONFIG.SELECTORS.mojoCard);
            let count = 0;

            cards.forEach(card => {
                if (Utils.removeElement(card, 'Mojo card')) {
                    count++;
                }
            });

            return count;
        },

        removeTabPanels() {
            const panels = document.querySelectorAll(CONFIG.SELECTORS.tabPanel);
            let count = 0;

            panels.forEach(panel => {
                if (Utils.removeElement(panel, 'Tab panel')) {
                    count++;
                }
            });

            return count;
        },

        removePromotionalContent() {
            let count = 0;
            const elements = document.querySelectorAll('div, section');

            elements.forEach(element => {
                if (state.processedElements.has(element) || Utils.isInHeader(element)) {
                    return;
                }

                const text = element.textContent || '';

                // Check each promotional keyword with length constraints
                const checks = [
                    { keywords: ['Bundle & Save'], maxLength: 200 },
                    { keywords: ['Price Drop Protection'], maxLength: 200 },
                    { keywords: ['OneKeyCash'], maxLength: 200 },
                    { keywords: ['Save 25%'], maxLength: 500 },
                    { keywords: ['Unlock sale deals'], maxLength: Infinity },
                    { keywords: ['25%+ off for members'], maxLength: Infinity }
                ];

                const shouldRemove = checks.some(check =>
                    Utils.containsKeyword(text, check.keywords, check.maxLength)
                );

                if (shouldRemove && Utils.removeElement(element, 'Promotional content')) {
                    count++;
                }
            });

            return count;
        },

        removeHeroImages() {
            let count = 0;
            const images = document.querySelectorAll('img');

            images.forEach(img => {
                if (state.processedElements.has(img) || Utils.isInHeader(img)) {
                    return;
                }

                const shouldRemove = CONFIG.KEYWORDS.images.some(keyword => {
                    return img.src.includes(keyword) || (img.alt && img.alt.includes(keyword));
                });

                if (shouldRemove) {
                    const parent = img.closest(CONFIG.SELECTORS.heroImage);
                    if (parent && Utils.removeElement(parent, 'Hero image container')) {
                        count++;
                    }
                }
            });

            return count;
        },

        removeAppLinks() {
            const links = document.querySelectorAll(CONFIG.SELECTORS.appLink);
            let count = 0;

            links.forEach(link => {
                if (Utils.removeElement(link, 'App download link')) {
                    count++;
                }
            });

            return count;
        }
    };

    // ========================================
    // MAIN CLEANUP FUNCTION
    // ========================================

    function cleanupExpediaPage() {
        const startTime = performance.now();
        const initialCount = state.totalRemoved;

        try {
            // Run all removers
            Removers.removeFooter();
            Removers.removeCarousels();
            Removers.removeMojoCards();
            Removers.removeTabPanels();
            Removers.removePromotionalContent();
            Removers.removeHeroImages();
            Removers.removeAppLinks();

            const removed = state.totalRemoved - initialCount;
            const duration = (performance.now() - startTime).toFixed(2);

            if (removed > 0) {
                Logger.info(`Removed ${removed} element(s) in ${duration}ms (header preserved)`);
                Logger.info(`Total removed since load: ${state.totalRemoved}`);
            } else {
                Logger.debug(`Scan complete in ${duration}ms - no new elements removed`);
            }

        } catch (error) {
            Logger.warn('Cleanup error:', error);
        }
    }

    // Throttled version for observer
    const throttledCleanup = Utils.throttle(
        cleanupExpediaPage,
        CONFIG.OBSERVER.THROTTLE_DELAY
    );

    // ========================================
    // OBSERVER SETUP
    // ========================================

    function setupObserver() {
        if (state.observer) {
            state.observer.disconnect();
        }

        state.observer = new MutationObserver((mutations) => {
            // Check if mutations include relevant changes
            const hasRelevantChanges = mutations.some(mutation =>
                mutation.addedNodes.length > 0 ||
                mutation.type === 'childList'
            );

            if (hasRelevantChanges) {
                throttledCleanup();
            }
        });

        state.observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        Logger.debug('MutationObserver started');
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    function initialize() {
        try {
            Logger.log('Initializing...');

            // Inject CSS immediately
            if (CONFIG.CSS.INJECT_EARLY) {
                CSSInjector.inject();
            }

            // Run initial cleanup
            cleanupExpediaPage();

            // Setup observer
            setupObserver();

            // Run cleanup at scheduled intervals for initial page load
            CONFIG.OBSERVER.INITIAL_DELAYS.forEach((delay, index) => {
                setTimeout(() => {
                    Logger.debug(`Running scheduled cleanup ${index + 1}/${CONFIG.OBSERVER.INITIAL_DELAYS.length}`);
                    cleanupExpediaPage();
                    state.initialCleanupsComplete++;
                }, delay);
            });

            Logger.log('Active - promotional content will be removed, header preserved');

            // Cleanup on page unload
            window.addEventListener('beforeunload', () => {
                if (state.observer) {
                    state.observer.disconnect();
                }
                Logger.debug('Cleanup completed on unload');
            });

        } catch (error) {
            Logger.warn('Initialization error:', error);
        }
    }

    // Start the script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            CSSInjector.inject();
            initialize();
        });
    } else {
        CSSInjector.inject();
        initialize();
    }

    // Ensure CSS is injected as early as possible
    CSSInjector.inject();

})();