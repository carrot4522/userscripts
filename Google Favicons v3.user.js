// ==UserScript==
// @name         Google Favicons v3
// @namespace    Google Favicons v3
// @version      3
// @description  Optimized favicon display on Google Search with enhanced performance, smart caching, and improved compatibility
// @author       Webchantment (Optimized)
// @match        https://www.google.com/search?*
// @match        https://www.google.*/search?*
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
        ICON_SIZE: 16, // Use 16 or 24
        OBSERVER: {
            DEBOUNCE_DELAY: 300, // Delay for debouncing (ms)
        },
        SELECTORS: {
            searchContainer: ['#search', '#rso', '#rcnt'],
            organicResults: [
                '#search cite',
                '#rso cite',
                '.yuRUbf cite',
                '.g cite'
            ],
            topAds: [
                '#tads span[role="text"]',
                '.uEierd span[role="text"]',
                '.cu-container span[role="text"]'
            ],
            bottomAds: [
                '#tadsb span[role="text"]',
                '.commercial-unit span[role="text"]'
            ]
        }
    };

    // ========================================
    // STATE MANAGEMENT
    // ========================================

    const state = {
        processedElements: new WeakSet(),
        domainCache: new Map(),
        observer: null,
        totalFavicons: 0
    };

    // ========================================
    // LOGGING UTILITY
    // ========================================

    const Logger = {
        prefix: '[Google Favicon v3]',

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

        error(...args) {
            console.error(this.prefix, ...args);
        }
    };

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    const Utils = {
        debounce(func, delay) {
            let timeoutId;
            return function executedFunction(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        },

        throttle(func, delay) {
            let lastRun = 0;
            return function(...args) {
                const now = Date.now();
                if (now - lastRun >= delay) {
                    lastRun = now;
                    func.apply(this, args);
                }
            };
        },

        extractDomain(text) {
            if (!text) return null;

            // Try multiple patterns
            const patterns = [
                // Standard domain pattern
                /(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})/i,
                // Domain with path
                /([a-z0-9-]+\.)+[a-z]{2,}/i
            ];

            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    return match[1] || match[0];
                }
            }

            return null;
        },

        isValidDomain(domain) {
            if (!domain) return false;
            // Must contain at least one dot and be valid characters
            return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(domain);
        },

        getCachedDomain(text) {
            if (state.domainCache.has(text)) {
                return state.domainCache.get(text);
            }

            const domain = this.extractDomain(text);
            if (domain) {
                state.domainCache.set(text, domain);
            }

            return domain;
        }
    };

    // ========================================
    // FAVICON HANDLER
    // ========================================

    const FaviconHandler = {
        createFavicon(domain) {
            const favicon = document.createElement('img');
            favicon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=${CONFIG.ICON_SIZE}`;
            favicon.alt = '';
            favicon.setAttribute('data-favicon', 'true');
            favicon.style.cssText = 'vertical-align: middle; margin-right: 4px;';

            // Error handling for failed loads
            favicon.addEventListener('error', () => {
                favicon.style.display = 'none';
                Logger.debug(`Failed to load favicon for: ${domain}`);
            }, { once: true });

            // Success logging
            favicon.addEventListener('load', () => {
                Logger.debug(`Loaded favicon for: ${domain}`);
            }, { once: true });

            return favicon;
        },

        addToElement(element, domain, isAd = false) {
            // Skip if already processed
            if (state.processedElements.has(element)) {
                return false;
            }

            // Skip if element already has a favicon
            if (element.querySelector('img[data-favicon="true"]')) {
                state.processedElements.add(element);
                return false;
            }

            // Validate domain
            if (!Utils.isValidDomain(domain)) {
                Logger.debug(`Invalid domain skipped: ${domain}`);
                return false;
            }

            try {
                const favicon = this.createFavicon(domain);
                element.prepend(favicon);
                state.processedElements.add(element);
                state.totalFavicons++;

                Logger.debug(`Added favicon for ${domain} (${isAd ? 'Ad' : 'Organic'})`);
                return true;
            } catch (error) {
                Logger.error('Failed to add favicon:', error);
                return false;
            }
        }
    };

    // ========================================
    // RESULT PROCESSOR
    // ========================================

    const ResultProcessor = {
        processOrganicResults() {
            let count = 0;

            for (const selector of CONFIG.SELECTORS.organicResults) {
                const elements = document.querySelectorAll(selector);

                elements.forEach(element => {
                    if (state.processedElements.has(element)) return;

                    const text = element.textContent.trim();
                    // For cite elements, domain is usually the first part before '/'
                    const domain = text.split('/')[0] || Utils.getCachedDomain(text);

                    if (domain && FaviconHandler.addToElement(element, domain, false)) {
                        count++;
                    }
                });
            }

            return count;
        },

        processAds(selectors, type) {
            let count = 0;

            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);

                elements.forEach(element => {
                    if (state.processedElements.has(element)) return;

                    // Try data attribute first
                    let domain = element.getAttribute('data-dtld');

                    // Fallback to text extraction
                    if (!domain) {
                        const text = element.textContent.trim();
                        domain = Utils.getCachedDomain(text);
                    }

                    if (domain && FaviconHandler.addToElement(element, domain, true)) {
                        count++;
                    }
                });
            }

            return count;
        },

        processTopAds() {
            return this.processAds(CONFIG.SELECTORS.topAds, 'Top Ad');
        },

        processBottomAds() {
            return this.processAds(CONFIG.SELECTORS.bottomAds, 'Bottom Ad');
        },

        processAll() {
            const startTime = performance.now();

            // Check if any favicons already exist (quick exit)
            if (document.querySelector('#search img[data-favicon="true"]') &&
                state.processedElements.size > 0) {
                Logger.debug('Favicons already present, skipping...');
                return;
            }

            const organicCount = this.processOrganicResults();
            const topAdCount = this.processTopAds();
            const bottomAdCount = this.processBottomAds();

            const total = organicCount + topAdCount + bottomAdCount;
            const duration = (performance.now() - startTime).toFixed(2);

            if (total > 0) {
                Logger.log(`Added ${total} favicons in ${duration}ms (Organic: ${organicCount}, Ads: ${topAdCount + bottomAdCount})`);
            } else {
                Logger.debug(`Scan complete in ${duration}ms - no new favicons added`);
            }
        }
    };

    // ========================================
    // OBSERVER SETUP
    // ========================================

    const ObserverManager = {
        setup() {
            if (state.observer) {
                state.observer.disconnect();
            }

            // Find search container
            let searchContainer = null;
            for (const selector of CONFIG.SELECTORS.searchContainer) {
                searchContainer = document.querySelector(selector);
                if (searchContainer) break;
            }

            if (!searchContainer) {
                Logger.warn('Search container not found');
                return;
            }

            // Debounced callback
            const debouncedProcess = Utils.debounce(() => {
                ResultProcessor.processAll();
            }, CONFIG.OBSERVER.DEBOUNCE_DELAY);

            // Create observer
            state.observer = new MutationObserver((mutations) => {
                // Filter relevant mutations
                const hasRelevantChanges = mutations.some(mutation => {
                    // Only process if nodes were added
                    if (mutation.addedNodes.length === 0) return false;

                    // Check if added nodes contain result elements
                    return Array.from(mutation.addedNodes).some(node => {
                        if (node.nodeType !== Node.ELEMENT_NODE) return false;

                        // Check if it's a result container or contains cite/span elements
                        return node.matches('.g, .tads, cite, span[role="text"]') ||
                               node.querySelector('cite, span[role="text"]');
                    });
                });

                if (hasRelevantChanges) {
                    debouncedProcess();
                }
            });

            state.observer.observe(searchContainer, {
                childList: true,
                subtree: true
            });

            Logger.debug('MutationObserver started');
        },

        disconnect() {
            if (state.observer) {
                state.observer.disconnect();
                state.observer = null;
                Logger.debug('MutationObserver disconnected');
            }
        }
    };

    // ========================================
    // INITIALIZATION
    // ========================================

    function initialize() {
        try {
            Logger.log('Initializing...');

            // Initial processing
            ResultProcessor.processAll();

            // Setup observer for dynamic content
            ObserverManager.setup();

            Logger.log(`Initialized successfully - Total favicons: ${state.totalFavicons}`);

            // Cleanup on page unload
            window.addEventListener('beforeunload', () => {
                ObserverManager.disconnect();
                state.domainCache.clear();
                Logger.debug('Cleanup completed on unload');
            });

        } catch (error) {
            Logger.error('Initialization failed:', error);
        }
    }

    // Start the script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();