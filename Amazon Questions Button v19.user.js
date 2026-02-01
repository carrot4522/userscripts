// ==UserScript==
// @name         Amazon Questions Button v19
// @author       u/iNeedAProperAccount (optimized)
// @description  Optimized: Creates a "Show Questions" button for Amazon product pages with enhanced performance and smart detection
// @version      2
// @license      MIT
// @match        *://*.amazon.com/*
// @match        *://*.amazon.ca/*
// @match        *://*.amazon.com.mx/*
// @match        *://*.amazon.co.uk/*
// @match        *://*.amazon.fr/*
// @match        *://*.amazon.de/*
// @match        *://*.amazon.es/*
// @match        *://*.amazon.it/*
// @match        *://*.amazon.nl/*
// @match        *://*.amazon.se/*
// @match        *://*.amazon.pl/*
// @match        *://*.amazon.com.tr/*
// @match        *://*.amazon.ae/*
// @match        *://*.amazon.sa/*
// @match        *://*.amazon.co.jp/*
// @match        *://*.amazon.in/*
// @match        *://*.amazon.sg/*
// @match        *://*.amazon.com.au/*
// @match        *://*.amazon.com.br/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazon.com
// @grant        GM_registerMenuCommand
// @namespace    https://greasyfork.org/users/877912
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
            THROTTLE_DELAY: 500
        },
        BUTTON: {
            TEXT: 'Show Questions',
            CLASS: 'amazon-questions-btn',
            STYLES: {
                margin: '8px 0',
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#FFD814',
                border: '1px solid #FCD200',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'background-color 0.2s'
            },
            HOVER_COLOR: '#F7CA00',
            DEFAULT_COLOR: '#FFD814'
        },
        SELECTORS: {
            title: [
                'span#productTitle',
                'h1#title span',
                'h1.product-title-word-break',
                '[data-feature-name="title"] h1',
                '#title',
                '.product-title',
                '[id*="productTitle"]'
            ],
            titleObserver: 'title'
        },
        PATTERNS: {
            asinUrl: /^(https?:\/\/[^/]+)\/(?:.+?\/)?(?:dp|gp\/product|asin)\/(?:.+?\/)?([A-Z0-9]{10})(?:[/?]|$)/i,
            asinPath: /\/([A-Z0-9]{10})(?:[/?]|$)/
        }
    };

    // ========================================
    // STATE MANAGEMENT
    // ========================================

    const state = {
        buttonAdded: false,
        processedContainers: new WeakSet(),
        currentASIN: null,
        lastUrl: window.location.href,
        observers: {
            content: null,
            navigation: null
        }
    };

    // ========================================
    // LOGGING UTILITY
    // ========================================

    const Logger = {
        prefix: '[Amazon Questions v2]',

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

        applyStyles(element, styles) {
            Object.entries(styles).forEach(([key, value]) => {
                element.style[key] = value;
            });
        }
    };

    // ========================================
    // ASIN EXTRACTOR
    // ========================================

    const ASINExtractor = {
        extract(url = window.location.href) {
            // Try primary pattern
            const matches = url.match(CONFIG.PATTERNS.asinUrl);
            if (matches) {
                return {
                    baseUrl: matches[1],
                    asin: matches[2]
                };
            }

            // Fallback: try to find ASIN in URL path
            const asinMatch = url.match(CONFIG.PATTERNS.asinPath);
            if (asinMatch) {
                return {
                    baseUrl: window.location.origin,
                    asin: asinMatch[1]
                };
            }

            // Additional fallback: check meta tags
            const asinMeta = document.querySelector('meta[name="asin"]');
            if (asinMeta?.content) {
                return {
                    baseUrl: window.location.origin,
                    asin: asinMeta.content
                };
            }

            return null;
        },

        getQuestionsUrl() {
            const extracted = this.extract();
            if (extracted) {
                state.currentASIN = extracted.asin;
                return `${extracted.baseUrl}/ask/questions/asin/${extracted.asin}`;
            }
            return null;
        }
    };

    // ========================================
    // TITLE FINDER
    // ========================================

    const TitleFinder = {
        find() {
            for (const selector of CONFIG.SELECTORS.title) {
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null) {
                    Logger.debug(`Found title with selector: ${selector}`);
                    return element;
                }
            }
            Logger.debug('No visible title element found');
            return null;
        },

        getContainer(titleElement) {
            if (!titleElement) return null;

            // Try to find a suitable container
            let container = titleElement.closest('[data-feature-name="title"]');
            if (!container) {
                container = titleElement.parentElement;
            }

            return container;
        }
    };

    // ========================================
    // BUTTON MANAGER
    // ========================================

    const ButtonManager = {
        create() {
            const button = document.createElement('button');
            button.textContent = CONFIG.BUTTON.TEXT;
            button.className = CONFIG.BUTTON.CLASS;

            Utils.applyStyles(button, CONFIG.BUTTON.STYLES);

            // Hover effects
            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = CONFIG.BUTTON.HOVER_COLOR;
            });

            button.addEventListener('mouseleave', () => {
                button.style.backgroundColor = CONFIG.BUTTON.DEFAULT_COLOR;
            });

            // Click handler
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.openQuestionsTab();
            });

            return button;
        },

        openQuestionsTab() {
            const questionsUrl = ASINExtractor.getQuestionsUrl();
            if (questionsUrl) {
                window.open(questionsUrl, '_blank', 'noopener,noreferrer');
                Logger.log('Opened questions tab for ASIN:', state.currentASIN);
            } else {
                Logger.warn('Could not extract ASIN from current URL');
            }
        },

        addToPage() {
            if (state.buttonAdded) {
                Logger.debug('Button already added, skipping...');
                return false;
            }

            const questionsUrl = ASINExtractor.getQuestionsUrl();
            if (!questionsUrl) {
                Logger.debug('No valid ASIN found, cannot add button');
                return false;
            }

            const titleElement = TitleFinder.find();
            if (!titleElement) {
                Logger.debug('Product title not found');
                return false;
            }

            const container = TitleFinder.getContainer(titleElement);
            if (!container) {
                Logger.debug('Could not find container for button');
                return false;
            }

            // Check if already processed
            if (state.processedContainers.has(container)) {
                Logger.debug('Container already processed');
                return false;
            }

            // Check if button already exists
            if (container.querySelector(`.${CONFIG.BUTTON.CLASS}`)) {
                Logger.debug('Button already exists in container');
                state.buttonAdded = true;
                state.processedContainers.add(container);
                return false;
            }

            try {
                const button = this.create();

                // Create wrapper
                const wrapper = document.createElement('div');
                wrapper.style.marginTop = '8px';
                wrapper.appendChild(button);

                // Insert after title element
                if (titleElement.nextSibling) {
                    container.insertBefore(wrapper, titleElement.nextSibling);
                } else {
                    container.appendChild(wrapper);
                }

                state.buttonAdded = true;
                state.processedContainers.add(container);

                Logger.log('Button added successfully for ASIN:', state.currentASIN);
                return true;

            } catch (error) {
                Logger.error('Failed to add button:', error);
                return false;
            }
        },

        reset() {
            state.buttonAdded = false;
            state.processedContainers = new WeakSet();
            state.currentASIN = null;
            Logger.debug('Button state reset');
        }
    };

    // ========================================
    // OBSERVER MANAGER
    // ========================================

    const ObserverManager = {
        setupContentObserver() {
            if (state.observers.content) {
                state.observers.content.disconnect();
            }

            const throttledAdd = Utils.throttle(() => {
                if (!state.buttonAdded) {
                    Logger.debug('Content change detected, attempting to add button...');
                    ButtonManager.addToPage();
                }
            }, CONFIG.OBSERVER.THROTTLE_DELAY);

            state.observers.content = new MutationObserver((mutations) => {
                // Filter relevant mutations
                const hasRelevantChanges = mutations.some(mutation => {
                    return mutation.addedNodes.length > 0 &&
                           Array.from(mutation.addedNodes).some(node => {
                               if (node.nodeType !== Node.ELEMENT_NODE) return false;

                               // Check if it's a title element or contains one
                               return CONFIG.SELECTORS.title.some(selector =>
                                   node.matches?.(selector) || node.querySelector?.(selector)
                               );
                           });
                });

                if (hasRelevantChanges) {
                    throttledAdd();
                }
            });

            state.observers.content.observe(document.body, {
                childList: true,
                subtree: true
            });

            Logger.debug('Content observer started');
        },

        setupNavigationObserver() {
            if (state.observers.navigation) {
                state.observers.navigation.disconnect();
            }

            const titleElement = document.querySelector(CONFIG.SELECTORS.titleObserver);
            if (!titleElement) {
                Logger.debug('Title element not found for navigation observer');
                return;
            }

            const throttledCheck = Utils.throttle(() => {
                const currentUrl = window.location.href;

                if (currentUrl !== state.lastUrl) {
                    Logger.log('Navigation detected:', currentUrl);
                    state.lastUrl = currentUrl;
                    ButtonManager.reset();

                    setTimeout(() => {
                        ButtonManager.addToPage();
                    }, 500);
                }
            }, CONFIG.OBSERVER.THROTTLE_DELAY);

            state.observers.navigation = new MutationObserver(throttledCheck);

            state.observers.navigation.observe(titleElement, {
                childList: true,
                subtree: true
            });

            Logger.debug('Navigation observer started');
        },

        disconnectAll() {
            if (state.observers.content) {
                state.observers.content.disconnect();
                state.observers.content = null;
            }
            if (state.observers.navigation) {
                state.observers.navigation.disconnect();
                state.observers.navigation = null;
            }
            Logger.debug('All observers disconnected');
        }
    };

    // ========================================
    // CONTEXT MENU
    // ========================================

    const ContextMenu = {
        register() {
            try {
                GM_registerMenuCommand('Open Questions Tab', () => {
                    ButtonManager.openQuestionsTab();
                });
                Logger.debug('Context menu command registered');
            } catch (error) {
                Logger.warn('Could not register context menu:', error);
            }
        }
    };

    // ========================================
    // INITIALIZATION
    // ========================================

    function initialize() {
        try {
            Logger.log('Initializing...');

            // Register context menu
            ContextMenu.register();

            // Try to add button immediately
            ButtonManager.addToPage();

            // Setup observers
            ObserverManager.setupContentObserver();
            ObserverManager.setupNavigationObserver();

            Logger.log('Initialization complete');

            // Cleanup on page unload
            window.addEventListener('beforeunload', () => {
                ObserverManager.disconnectAll();
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