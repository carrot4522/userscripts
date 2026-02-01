// ==UserScript==
// @name         GEICO - Ad Blocker v2
// @namespace    http://tampermonkey.net/
// @version      2
// @description  Optimized ad blocker: removes footer and promotional content from GEICO dashboard with enhanced performance and smart detection
// @author       You
// @match        https://www.geico.com/*
// @match        https://*.geico.com/*
// @match        https://service.geico.com/*
// @match        https://my.geico.com/*
// @grant        none
// @run-at       document-idle
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
            BACKUP_INTERVAL: 3000 // Fallback interval check (ms)
        },
        SELECTORS: {
            // Footer elements
            asdFooter: 'asd-footer',
            gdsFooter: 'gds-footer',
            gdsFooterAuth: 'gds-footer[auth]',
            footerFeedback: '#footerFeedback',
            genericFooter: 'footer',

            // Promotional content
            promoData: '[data-testid*="promo"], [data-testid*="offer"], [data-testid*="banner"], [data-testid*="advertisement"]',
            promoClass: 'div[class*="promo"], div[class*="offer"], div[class*="banner"], div[class*="marketing"], div[class*="campaign"], div[class*="advertisement"], div[class*="ad-"]',

            // Generic containers
            section: 'section',
            card: 'div[class*="card"]'
        },
        KEYWORDS: {
            footerLinks: ['Privacy', 'Personal Data Request & Notice', 'Legal & Security', 'Legal', 'Security'],
            promotional: ['offer', 'deal', 'save', 'discount', 'promotion', 'special'],
            headings: ['Save Money', 'Get a Quote', 'Bundle and Save', 'Special Offer', 'Discount']
        }
    };

    // ========================================
    // STATE MANAGEMENT
    // ========================================

    const state = {
        processedElements: new WeakSet(),
        totalRemoved: 0,
        lastCleanupTime: 0,
        observer: null,
        backupInterval: null
    };

    // ========================================
    // LOGGING UTILITY
    // ========================================

    const Logger = {
        prefix: '[GEICO Ad Blocker v2]',

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

        removeElement(element, reason = '') {
            if (!element || state.processedElements.has(element)) {
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

        containsKeyword(text, keywords) {
            if (!text || !keywords) return false;
            const normalizedText = text.toLowerCase().trim();
            return keywords.some(keyword =>
                normalizedText.includes(keyword.toLowerCase())
            );
        },

        containsAllKeywords(text, keywords) {
            if (!text || !keywords) return false;
            const normalizedText = text.toLowerCase().trim();
            return keywords.every(keyword =>
                normalizedText.includes(keyword.toLowerCase())
            );
        },

        findClosestContainer(element, selectors) {
            if (!element) return null;

            for (const selector of selectors) {
                const container = element.closest(selector);
                if (container && container.tagName.toLowerCase() !== 'body') {
                    return container;
                }
            }

            return null;
        }
    };

    // ========================================
    // ELEMENT REMOVERS
    // ========================================

    const Removers = {
        // Remove asd-footer elements
        removeAsdFooters() {
            const footers = document.querySelectorAll(CONFIG.SELECTORS.asdFooter);
            let count = 0;

            footers.forEach(footer => {
                if (Utils.removeElement(footer, 'asd-footer element')) {
                    count++;
                }
            });

            return count;
        },

        // Remove gds-footer elements
        removeGdsFooters() {
            const footers = document.querySelectorAll(CONFIG.SELECTORS.gdsFooter);
            let count = 0;

            footers.forEach(footer => {
                if (state.processedElements.has(footer)) return;

                const container = footer.closest(CONFIG.SELECTORS.asdFooter);
                if (Utils.removeElement(container || footer, 'gds-footer element')) {
                    count++;
                }
            });

            return count;
        },

        // Remove footer with auth attribute
        removeAuthFooters() {
            const footers = document.querySelectorAll(CONFIG.SELECTORS.gdsFooterAuth);
            let count = 0;

            footers.forEach(footer => {
                if (state.processedElements.has(footer)) return;

                const container = footer.closest(CONFIG.SELECTORS.asdFooter);
                if (Utils.removeElement(container || footer, 'auth footer element')) {
                    count++;
                }
            });

            return count;
        },

        // Remove footer links by text content
        removeFooterLinks() {
            const links = document.querySelectorAll('a');
            let count = 0;

            links.forEach(link => {
                if (state.processedElements.has(link)) return;

                const text = link.textContent.trim();
                const isFooterLink = CONFIG.KEYWORDS.footerLinks.some(keyword => {
                    if (keyword === 'Legal & Security') {
                        return text.includes('Legal') && text.includes('Security');
                    }
                    return text === keyword;
                });

                if (isFooterLink) {
                    const container = Utils.findClosestContainer(link, [
                        CONFIG.SELECTORS.asdFooter,
                        CONFIG.SELECTORS.gdsFooter,
                        CONFIG.SELECTORS.genericFooter,
                        'ul',
                        'li'
                    ]);

                    const toRemove = container || link.closest('li') || link;
                    if (Utils.removeElement(toRemove, `Footer link: ${text}`)) {
                        count++;
                    }
                }
            });

            return count;
        },

        // Remove footer feedback section
        removeFooterFeedback() {
            const feedback = document.querySelector(CONFIG.SELECTORS.footerFeedback);
            if (!feedback) return false;

            const container = Utils.findClosestContainer(feedback, [
                CONFIG.SELECTORS.asdFooter,
                CONFIG.SELECTORS.gdsFooter,
                CONFIG.SELECTORS.genericFooter
            ]);

            return Utils.removeElement(container || feedback, 'Footer feedback section');
        },

        // Remove generic footer elements
        removeGenericFooters() {
            const footers = document.querySelectorAll(CONFIG.SELECTORS.genericFooter);
            let count = 0;

            footers.forEach(footer => {
                if (state.processedElements.has(footer)) return;

                const text = footer.textContent || '';
                const hasPrivacy = text.includes('Privacy');
                const hasLegalOrSecurity = text.includes('Legal') || text.includes('Security');

                if (hasPrivacy && hasLegalOrSecurity) {
                    if (Utils.removeElement(footer, 'Generic footer element')) {
                        count++;
                    }
                }
            });

            return count;
        },

        // Remove promotional content by data attributes
        removePromoByDataAttributes() {
            const elements = document.querySelectorAll(CONFIG.SELECTORS.promoData);
            let count = 0;

            elements.forEach(element => {
                if (state.processedElements.has(element)) return;

                const text = (element.textContent || '').toLowerCase();
                const hasPromoKeyword = Utils.containsKeyword(text, CONFIG.KEYWORDS.promotional);

                if (hasPromoKeyword) {
                    if (Utils.removeElement(element, 'Promotional content (data attr)')) {
                        count++;
                    }
                }
            });

            return count;
        },

        // Remove promotional content by class names
        removePromoByClass() {
            const elements = document.querySelectorAll(CONFIG.SELECTORS.promoClass);
            let count = 0;

            elements.forEach(element => {
                if (state.processedElements.has(element)) return;

                const text = (element.textContent || '').toLowerCase();
                const hasPromoKeyword = Utils.containsKeyword(text, CONFIG.KEYWORDS.promotional);

                if (hasPromoKeyword) {
                    if (Utils.removeElement(element, 'Promotional content (class)')) {
                        count++;
                    }
                }
            });

            return count;
        },

        // Remove promotional sections by heading text
        removePromoByHeadings() {
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            let count = 0;

            headings.forEach(heading => {
                if (state.processedElements.has(heading)) return;

                const text = heading.textContent.trim();
                const isPromoHeading = CONFIG.KEYWORDS.headings.some(keyword =>
                    text.includes(keyword)
                );

                if (isPromoHeading) {
                    const container = Utils.findClosestContainer(heading, [
                        CONFIG.SELECTORS.section,
                        'div[class*="promo"]',
                        'div[class*="offer"]',
                        CONFIG.SELECTORS.card
                    ]);

                    const toRemove = container || heading;
                    if (Utils.removeElement(toRemove, `Promotional heading: ${text}`)) {
                        count++;
                    }
                }
            });

            return count;
        }
    };

    // ========================================
    // MAIN CLEANUP FUNCTION
    // ========================================

    function cleanupGeicoPage() {
        const startTime = performance.now();
        const initialCount = state.totalRemoved;

        try {
            // Run all removers
            Removers.removeAsdFooters();
            Removers.removeGdsFooters();
            Removers.removeAuthFooters();
            Removers.removeFooterLinks();
            Removers.removeFooterFeedback();
            Removers.removeGenericFooters();
            Removers.removePromoByDataAttributes();
            Removers.removePromoByClass();
            Removers.removePromoByHeadings();

            const removed = state.totalRemoved - initialCount;
            const duration = (performance.now() - startTime).toFixed(2);

            if (removed > 0) {
                Logger.info(`Removed ${removed} element(s) in ${duration}ms`);
                Logger.info(`Total removed since load: ${state.totalRemoved}`);
            } else {
                Logger.debug(`Scan complete in ${duration}ms - no new elements removed`);
            }

            state.lastCleanupTime = Date.now();

        } catch (error) {
            Logger.warn('Cleanup error:', error);
        }
    }

    // Throttled version for observer
    const throttledCleanup = Utils.throttle(
        cleanupGeicoPage,
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

        state.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        Logger.debug('MutationObserver started');
    }

    // ========================================
    // BACKUP INTERVAL
    // ========================================

    function setupBackupInterval() {
        if (state.backupInterval) {
            clearInterval(state.backupInterval);
        }

        state.backupInterval = setInterval(() => {
            const timeSinceLastCleanup = Date.now() - state.lastCleanupTime;

            // Only run if enough time has passed
            if (timeSinceLastCleanup >= CONFIG.OBSERVER.BACKUP_INTERVAL) {
                Logger.debug('Running backup interval cleanup');
                cleanupGeicoPage();
            }
        }, CONFIG.OBSERVER.BACKUP_INTERVAL);

        Logger.debug('Backup interval started');
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    function initialize() {
        try {
            Logger.log('Initializing...');

            // Run initial cleanup
            cleanupGeicoPage();

            // Setup observers and intervals
            setupObserver();
            setupBackupInterval();

            Logger.log('Monitoring active - blocking footer and promotional content');

            // Cleanup on page unload
            window.addEventListener('beforeunload', () => {
                if (state.observer) {
                    state.observer.disconnect();
                }
                if (state.backupInterval) {
                    clearInterval(state.backupInterval);
                }
                Logger.debug('Cleanup completed on unload');
            });

        } catch (error) {
            Logger.warn('Initialization error:', error);
        }
    }

    // Start the script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();