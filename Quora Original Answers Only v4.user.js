// ==UserScript==
// @name         Quora Original Answers Only v4
// @namespace    Quora Original Answers Only v4
// @version      4
// @description  Optimized Quora default to Recent answers with enhanced detection, smart retry logic, and improved performance
// @author       ClaoDD (Optimized)
// @match        https://www.quora.com/*
// @grant        none
// @run-at       document-idle
// @downloadURL https://update.greasyfork.org/scripts/422208/quora%20original%20answers%20only.user.js
// @updateURL https://update.greasyfork.org/scripts/422208/quora%20original%20answers%20only.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // ========================================
    // CONFIGURATION
    // ========================================

    const CONFIG = {
        DEBUG: false, // Set to true for verbose logging
        MAX_ATTEMPTS: 5,
        TIMINGS: {
            INITIAL_DELAY: 1000,
            RECOMMENDED_TO_RECENT_DELAY: 1650,
            RETRY_BASE_DELAY: 2000,
            NAVIGATION_DELAY: 1500
        },
        OBSERVER: {
            THROTTLE_DELAY: 500
        },
        SELECTORS: {
            tabs: [
                'a[role="tab"]',
                'button[role="tab"]',
                '.qu-ellipsis',
                '.qu-tapHighlight--white',
                '.qu-dynamicFontSize--small'
            ],
            mainContent: [
                'main',
                '#root',
                '[role="main"]',
                '.q-box'
            ]
        },
        LABELS: {
            recommended: ['Recommended', 'Consigliati', 'Recommandé', 'Empfohlen'],
            recent: ['Recent', 'Recenti', 'Récent', 'Neueste']
        }
    };

    // ========================================
    // STATE MANAGEMENT
    // ========================================

    const state = {
        attemptCount: 0,
        lastUrl: location.href,
        clickedElements: new WeakSet(),
        isProcessing: false,
        observers: {
            navigation: null,
            content: null
        }
    };

    // ========================================
    // LOGGING UTILITY
    // ========================================

    const Logger = {
        prefix: '[Quora Recent v4]',

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

        debounce(func, delay) {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        },

        getRetryDelay() {
            // Exponential backoff: 2s, 4s, 8s, 16s, 32s
            return CONFIG.TIMINGS.RETRY_BASE_DELAY * Math.pow(2, Math.min(state.attemptCount, 4));
        },

        matchesLabel(text, labelArray) {
            if (!text) return false;
            const normalized = text.trim();
            return labelArray.some(label => normalized === label);
        }
    };

    // ========================================
    // TAB FINDER
    // ========================================

    const TabFinder = {
        findAllTabs() {
            const allTabs = [];

            CONFIG.SELECTORS.tabs.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                allTabs.push(...Array.from(elements));
            });

            return allTabs;
        },

        findRecommendedTab(tabs) {
            return tabs.find(tab =>
                !state.clickedElements.has(tab) &&
                Utils.matchesLabel(tab.textContent, CONFIG.LABELS.recommended)
            );
        },

        findRecentTab(tabs) {
            return tabs.find(tab =>
                !state.clickedElements.has(tab) &&
                Utils.matchesLabel(tab.textContent, CONFIG.LABELS.recent)
            );
        }
    };

    // ========================================
    // CLICK HANDLER
    // ========================================

    const ClickHandler = {
        clickElement(element, label) {
            if (!element || state.clickedElements.has(element)) {
                Logger.debug(`Skipped clicking ${label} - already processed`);
                return false;
            }

            try {
                element.click();
                state.clickedElements.add(element);
                Logger.info(`Clicked: ${label}`);
                return true;
            } catch (error) {
                Logger.error(`Failed to click ${label}:`, error);
                return false;
            }
        },

        async clickRecommendedThenRecent() {
            if (state.isProcessing) {
                Logger.debug('Already processing, skipping...');
                return;
            }

            state.isProcessing = true;
            const startTime = performance.now();

            try {
                const tabs = TabFinder.findAllTabs();

                if (tabs.length === 0) {
                    Logger.debug('No tabs found');
                    this.retry();
                    return;
                }

                // Step 1: Click Recommended
                const recommendedTab = TabFinder.findRecommendedTab(tabs);

                if (recommendedTab) {
                    this.clickElement(recommendedTab, 'Recommended');

                    // Step 2: Wait and click Recent
                    setTimeout(() => {
                        const tabs2 = TabFinder.findAllTabs();
                        const recentTab = TabFinder.findRecentTab(tabs2);

                        if (recentTab) {
                            this.clickElement(recentTab, 'Recent');
                            state.attemptCount = 0;
                            state.isProcessing = false;

                            const duration = (performance.now() - startTime).toFixed(2);
                            Logger.log(`Successfully switched to Recent view in ${duration}ms`);
                        } else {
                            Logger.debug('Recent tab not found after Recommended click');
                            state.isProcessing = false;
                            this.retry();
                        }
                    }, CONFIG.TIMINGS.RECOMMENDED_TO_RECENT_DELAY);
                } else {
                    Logger.debug('Recommended tab not found');
                    state.isProcessing = false;
                    this.retry();
                }
            } catch (error) {
                Logger.error('Click process error:', error);
                state.isProcessing = false;
                this.retry();
            }
        },

        retry() {
            state.attemptCount++;

            if (state.attemptCount < CONFIG.MAX_ATTEMPTS) {
                const delay = Utils.getRetryDelay();
                Logger.debug(`Retry attempt ${state.attemptCount}/${CONFIG.MAX_ATTEMPTS} in ${delay}ms`);

                setTimeout(() => {
                    this.clickRecommendedThenRecent();
                }, delay);
            } else {
                Logger.warn(`Max retry attempts (${CONFIG.MAX_ATTEMPTS}) reached`);
            }
        },

        reset() {
            state.attemptCount = 0;
            state.isProcessing = false;
            state.clickedElements = new WeakSet();
            Logger.debug('State reset');
        }
    };

    // ========================================
    // NAVIGATION DETECTOR
    // ========================================

    const NavigationDetector = {
        setup() {
            if (state.observers.navigation) {
                state.observers.navigation.disconnect();
            }

            const throttledCheck = Utils.throttle(() => {
                const currentUrl = location.href;

                if (currentUrl !== state.lastUrl) {
                    Logger.info('Navigation detected:', currentUrl);
                    state.lastUrl = currentUrl;
                    ClickHandler.reset();

                    setTimeout(() => {
                        ClickHandler.clickRecommendedThenRecent();
                    }, CONFIG.TIMINGS.NAVIGATION_DELAY);
                }
            }, CONFIG.OBSERVER.THROTTLE_DELAY);

            state.observers.navigation = new MutationObserver(throttledCheck);

            state.observers.navigation.observe(document.body, {
                childList: true,
                subtree: true
            });

            Logger.debug('Navigation observer started');
        },

        disconnect() {
            if (state.observers.navigation) {
                state.observers.navigation.disconnect();
                state.observers.navigation = null;
                Logger.debug('Navigation observer disconnected');
            }
        }
    };

    // ========================================
    // CONTENT OBSERVER
    // ========================================

    const ContentObserver = {
        setup() {
            if (state.observers.content) {
                state.observers.content.disconnect();
            }

            // Find main content container
            let targetNode = null;
            for (const selector of CONFIG.SELECTORS.mainContent) {
                targetNode = document.querySelector(selector);
                if (targetNode) break;
            }

            if (!targetNode) {
                Logger.warn('Main content container not found');
                return;
            }

            // Throttled callback for dynamic content
            const throttledClick = Utils.throttle(() => {
                if (state.attemptCount === 0 && !state.isProcessing) {
                    Logger.debug('Content change detected, attempting click...');
                    ClickHandler.clickRecommendedThenRecent();
                }
            }, CONFIG.OBSERVER.THROTTLE_DELAY);

            state.observers.content = new MutationObserver((mutations) => {
                // Filter relevant mutations
                const hasRelevantChanges = mutations.some(mutation => {
                    return mutation.addedNodes.length > 0 &&
                           Array.from(mutation.addedNodes).some(node => {
                               if (node.nodeType !== Node.ELEMENT_NODE) return false;

                               // Check if it's a tab or contains tabs
                               return node.matches('a[role="tab"], button[role="tab"]') ||
                                      node.querySelector('a[role="tab"], button[role="tab"]');
                           });
                });

                if (hasRelevantChanges) {
                    throttledClick();
                }
            });

            state.observers.content.observe(targetNode, {
                childList: true,
                subtree: true
            });

            Logger.debug('Content observer started on:', targetNode.tagName);
        },

        disconnect() {
            if (state.observers.content) {
                state.observers.content.disconnect();
                state.observers.content = null;
                Logger.debug('Content observer disconnected');
            }
        }
    };

    // ========================================
    // INITIALIZATION
    // ========================================

    function initialize() {
        try {
            Logger.log('Initializing...');

            // Initial click attempt
            setTimeout(() => {
                Logger.debug('Starting initial click attempt...');
                ClickHandler.clickRecommendedThenRecent();
            }, CONFIG.TIMINGS.INITIAL_DELAY);

            // Setup observers
            NavigationDetector.setup();
            ContentObserver.setup();

            Logger.log('Initialization complete');

            // Cleanup on page unload
            window.addEventListener('beforeunload', () => {
                NavigationDetector.disconnect();
                ContentObserver.disconnect();
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