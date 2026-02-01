// ==UserScript==
// @name         Reddit Age Bypass v2
// @namespace    http://tampermonkey.net/
// @version      2
// @description  Bypass the "open in app prompt" for NSFW posts with improved performance and modern optimizations. Works automatically on page navigation.
// @author       Bababoiiiii (updated)
// @license      MIT
// @match        https://www.reddit.com/*
// @match        https://old.reddit.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @grant        none
// @run-at       document-start
// ==/UserScript==

/**
 * RECOMMENDED: Use with uBlock Origin filter for best results:
 * www.redditstatic.com/shreddit/*xpromo-nsfw-blocking-modal-*.js$script,domain=www.reddit.com
 *
 * Alternative uBlock filter (hides prompt directly):
 * www.reddit.com##div.prompt
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        CHECK_INTERVAL: 500,
        MAX_RETRIES: 20,
        POLYFILL_CHECK_INTERVAL: 10,
        SELECTORS: {
            NSFW_ICON_CONTAINER: 'span.flex.gap-xs.items-center.pr-xs.truncate > span > faceplate-tracker > a > div',
            NSFW_ICON: 'icon-nsfw',
            BLUR_CONTAINER: 'xpromo-nsfw-blocking-container',
            PROMPT: 'div.prompt'
        }
    };

    // Utility Functions
    const Utils = {
        log(message, type = 'info') {
            const prefix = '[Reddit Age Bypass v2]';
            const styles = {
                info: 'color: #0079d3',
                success: 'color: #46d160',
                warning: 'color: #ff8717',
                error: 'color: #ea0027'
            };
            console.log(`%c${prefix} ${message}`, styles[type] || styles.info);
        },

        debounce(func, wait) {
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

        waitForElement(selector, callback, options = {}) {
            const { timeout = 10000, checkInterval = 100 } = options;
            const startTime = Date.now();

            const check = setInterval(() => {
                const element = document.querySelector(selector);

                if (element) {
                    clearInterval(check);
                    callback(element);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(check);
                    Utils.log(`Timeout waiting for element: ${selector}`, 'warning');
                }
            }, checkInterval);

            return check;
        }
    };

    // NSFW Post Detector
    class NSFWDetector {
        constructor() {
            this.checkInterval = null;
            this.retryCount = 0;
        }

        isNSFWPost() {
            const iconContainer = document.querySelector(CONFIG.SELECTORS.NSFW_ICON_CONTAINER);
            if (!iconContainer) return null;

            const nsfwIcon = iconContainer.querySelector(CONFIG.SELECTORS.NSFW_ICON);
            return nsfwIcon !== null;
        }

        waitForPost(callback) {
            this.retryCount = 0;

            this.checkInterval = setInterval(() => {
                this.retryCount++;

                if (this.retryCount > CONFIG.MAX_RETRIES) {
                    this.stop();
                    Utils.log('Max retries reached, stopping detection', 'warning');
                    return;
                }

                const iconContainer = document.querySelector(CONFIG.SELECTORS.NSFW_ICON_CONTAINER);

                if (iconContainer) {
                    this.stop();
                    Utils.log('Post detected', 'info');
                    callback(this.isNSFWPost());
                }
            }, CONFIG.CHECK_INTERVAL);
        }

        stop() {
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
        }
    }

    // Blur Remover
    class BlurRemover {
        removeBlurs() {
            const blurContainers = document.querySelectorAll(CONFIG.SELECTORS.BLUR_CONTAINER);

            if (blurContainers.length === 0) {
                Utils.log('No blur containers found', 'info');
                return 0;
            }

            let removedCount = 0;

            blurContainers.forEach(container => {
                try {
                    const shadowRoot = container.shadowRoot;
                    if (shadowRoot) {
                        const prompt = shadowRoot.querySelector(CONFIG.SELECTORS.PROMPT);
                        if (prompt) {
                            prompt.remove();
                            removedCount++;
                        }
                    }
                } catch (error) {
                    Utils.log(`Error removing blur: ${error.message}`, 'error');
                }
            });

            return removedCount;
        }

        removeWithRetry(maxRetries = 3) {
            let attempts = 0;

            const tryRemove = () => {
                attempts++;
                const removed = this.removeBlurs();

                if (removed > 0) {
                    Utils.log(`Successfully removed ${removed} blur(s)`, 'success');
                    return;
                }

                if (attempts < maxRetries) {
                    Utils.log(`Retry attempt ${attempts}/${maxRetries}`, 'info');
                    setTimeout(tryRemove, 500);
                } else {
                    Utils.log('No blurs found after retries', 'info');
                }
            };

            tryRemove();
        }
    }

    // Navigation Handler
    class NavigationHandler {
        constructor(onNavigate) {
            this.onNavigate = onNavigate;
            this.pollingInterval = null;
            this.setupNavigationListener();
        }

        setupNavigationListener() {
            // Check for Navigation API support
            if (window.navigation) {
                Utils.log('Using Navigation API', 'info');
                window.navigation.addEventListener('navigate', () => {
                    Utils.log('Navigation detected', 'info');
                    this.onNavigate();
                });
            } else {
                // Fallback: Poll for Navigation API availability
                this.pollForNavigationAPI();
            }

            // Additional fallback: Monitor URL changes
            this.setupURLMonitoring();
        }

        pollForNavigationAPI() {
            this.pollingInterval = setInterval(() => {
                if (window.navigation) {
                    clearInterval(this.pollingInterval);
                    Utils.log('Navigation API now available', 'info');
                    window.navigation.addEventListener('navigate', () => {
                        Utils.log('Navigation detected', 'info');
                        this.onNavigate();
                    });
                }
            }, CONFIG.POLYFILL_CHECK_INTERVAL);
        }

        setupURLMonitoring() {
            let lastUrl = location.href;

            const checkUrlChange = () => {
                const currentUrl = location.href;
                if (currentUrl !== lastUrl) {
                    lastUrl = currentUrl;
                    Utils.log('URL change detected', 'info');
                    this.onNavigate();
                }
            };

            // Monitor using MutationObserver as backup
            const observer = new MutationObserver(Utils.debounce(checkUrlChange, 300));
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Also monitor popstate events
            window.addEventListener('popstate', () => {
                Utils.log('Popstate event detected', 'info');
                this.onNavigate();
            });
        }

        destroy() {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
            }
        }
    }

    // Main Application
    class RedditAgeBypass {
        constructor() {
            this.detector = new NSFWDetector();
            this.remover = new BlurRemover();
            this.navigationHandler = null;
            this.isProcessing = false;
        }

        init() {
            Utils.log('Initializing...', 'info');

            // Initial check
            this.processPage();

            // Setup navigation handling
            this.navigationHandler = new NavigationHandler(() => this.processPage());

            Utils.log('Initialization complete', 'success');
        }

        processPage() {
            // Prevent multiple simultaneous processes
            if (this.isProcessing) {
                Utils.log('Already processing, skipping...', 'warning');
                return;
            }

            this.isProcessing = true;
            this.detector.stop(); // Stop any previous detection

            Utils.log('Processing page...', 'info');

            this.detector.waitForPost((isNSFW) => {
                if (isNSFW === null) {
                    Utils.log('Could not determine post type', 'warning');
                    this.isProcessing = false;
                    return;
                }

                if (isNSFW) {
                    Utils.log('NSFW post detected, removing blurs...', 'info');
                    this.remover.removeWithRetry();
                } else {
                    Utils.log('Post is not NSFW, no action needed', 'info');
                }

                this.isProcessing = false;
            });
        }

        destroy() {
            Utils.log('Cleaning up...', 'info');
            this.detector.stop();
            this.navigationHandler?.destroy();
        }
    }

    // Additional Protection: Prevent NSFW modal script from loading
    const blockNSFWModalScript = () => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.tagName === 'SCRIPT') {
                        const src = node.getAttribute('src');
                        if (src && src.includes('xpromo-nsfw-blocking-modal')) {
                            Utils.log('Blocked NSFW modal script', 'success');
                            node.remove();
                        }
                    }
                });
            });
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    };

    // Initialize
    const app = new RedditAgeBypass();

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            app.init();
            blockNSFWModalScript();
        });
    } else {
        app.init();
        blockNSFWModalScript();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => app.destroy());

    // Expose for debugging (optional)
    window.RedditAgeBypass = app;

})();