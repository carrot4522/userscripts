// ==UserScript==
// @name         Express Scripts Hide Footer v3
// @namespace    Express Scripts Hide Footer v3
// @version      3
// @description  Remove footer from Express Scripts pages with optimized performance and multiple detection methods
// @author       You
// @match        https://*.express-scripts.com/*
// @match        https://www.express-scripts.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=express-scripts.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Express Scripts Footer Remover v3] Script initialized');

    // Configuration
    const CONFIG = {
        DEBOUNCE_DELAY: 150,
        CHECK_INTERVAL: 2000,
        SELECTORS: {
            FOOTER_PRIMARY: 'footer.footer__footer___cssmodW2dAR',
            FOOTER_GENERIC: 'footer',
            FOOTER_BY_CLASS: '[class*="footer__footer"]',
            FOOTER_CONTAINER: '[class*="footer"][class*="container"]'
        }
    };

    // Cache for processed elements
    const processedElements = new WeakSet();
    let isProcessing = false;
    let footerRemovalCount = 0;

    // Utility functions
    const utils = {
        debounce(func, delay) {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        },

        removeElement(element, description) {
            if (!element || processedElements.has(element)) return false;

            console.log(`[Express Scripts] Removing: ${description}`);
            element.remove();
            processedElements.add(element);
            footerRemovalCount++;
            return true;
        },

        isFooterElement(element) {
            if (!element) return false;

            const tagName = element.tagName?.toLowerCase();
            const className = element.className?.toString() || '';
            const textContent = element.textContent?.toLowerCase() || '';

            // Check if it's a footer element
            if (tagName === 'footer') return true;

            // Check if class name contains footer-related keywords
            if (className.includes('footer')) return true;

            // Check if content includes typical footer text
            if (textContent.includes('privacy policy') &&
                textContent.includes('terms') &&
                textContent.includes('copyright')) {
                return true;
            }

            return false;
        }
    };

    // Footer removal strategies
    const removalStrategies = {
        // Strategy 1: Remove by specific class
        removeBySpecificClass() {
            const footer = document.querySelector(CONFIG.SELECTORS.FOOTER_PRIMARY);
            if (footer) {
                return utils.removeElement(footer, 'Footer (specific class)');
            }
            return false;
        },

        // Strategy 2: Remove by generic footer tag
        removeByFooterTag() {
            const footers = document.querySelectorAll(CONFIG.SELECTORS.FOOTER_GENERIC);
            let removed = false;

            footers.forEach(footer => {
                if (utils.removeElement(footer, 'Footer (generic tag)')) {
                    removed = true;
                }
            });
            return removed;
        },

        // Strategy 3: Remove by class pattern matching
        removeByClassPattern() {
            const footers = document.querySelectorAll(CONFIG.SELECTORS.FOOTER_BY_CLASS);
            let removed = false;

            footers.forEach(footer => {
                if (utils.removeElement(footer, 'Footer (class pattern)')) {
                    removed = true;
                }
            });
            return removed;
        },

        // Strategy 4: Remove footer containers
        removeFooterContainers() {
            const containers = document.querySelectorAll(CONFIG.SELECTORS.FOOTER_CONTAINER);
            let removed = false;

            containers.forEach(container => {
                if (utils.isFooterElement(container)) {
                    if (utils.removeElement(container, 'Footer container')) {
                        removed = true;
                    }
                }
            });
            return removed;
        },

        // Strategy 5: Remove by content analysis (backup method)
        removeByContentAnalysis() {
            const allDivs = document.querySelectorAll('div, section, aside');
            let removed = false;

            allDivs.forEach(div => {
                const text = div.textContent?.toLowerCase() || '';
                const hasFooterContent =
                    text.includes('privacy policy') &&
                    text.includes('terms of use') &&
                    text.includes('express scripts') &&
                    (text.includes('copyright') || text.includes('©'));

                if (hasFooterContent && div.children.length < 20) {
                    // Likely a footer if it has footer text and isn't too complex
                    const isAtBottom = div.getBoundingClientRect().top > window.innerHeight * 0.7;
                    if (isAtBottom || text.length < 2000) {
                        if (utils.removeElement(div, 'Footer (content analysis)')) {
                            removed = true;
                        }
                    }
                }
            });
            return removed;
        }
    };

    // Main removal function
    function removeFooter() {
        if (isProcessing) return;
        isProcessing = true;

        try {
            let removed = false;

            // Try each strategy in order
            removed = removalStrategies.removeBySpecificClass() || removed;
            removed = removalStrategies.removeByFooterTag() || removed;
            removed = removalStrategies.removeByClassPattern() || removed;
            removed = removalStrategies.removeFooterContainers() || removed;
            removed = removalStrategies.removeByContentAnalysis() || removed;

            if (removed && footerRemovalCount <= 5) {
                console.log(`[Express Scripts] Footer removal successful (Total: ${footerRemovalCount})`);
            }
        } catch (error) {
            console.error('[Express Scripts] Error during footer removal:', error);
        } finally {
            isProcessing = false;
        }
    }

    // Debounced version for mutation observer
    const debouncedRemoval = utils.debounce(removeFooter, CONFIG.DEBOUNCE_DELAY);

    // Initialize
    console.log('[Express Scripts] Running initial footer removal');
    removeFooter();

    // Watch for dynamic content with optimized observer
    const observer = new MutationObserver((mutations) => {
        // Only trigger if there are added nodes
        const hasAddedNodes = mutations.some(mutation => mutation.addedNodes.length > 0);

        if (hasAddedNodes) {
            debouncedRemoval();
        }
    });

    // Start observing with optimized settings
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Periodic check as backup
    setInterval(removeFooter, CONFIG.CHECK_INTERVAL);

    // Handle SPA navigation
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            console.log('[Express Scripts] URL changed, checking for footer');
            setTimeout(removeFooter, 300);
        }
    });

    urlObserver.observe(document.body, { childList: true, subtree: true });

    // Add CSS to hide footer immediately while script processes
    const style = document.createElement('style');
    style.id = 'express-scripts-footer-hider';
    style.textContent = `
        footer.footer__footer___cssmodW2dAR,
        footer[class*="footer__footer"],
        footer {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
        }
    `;
    document.head.appendChild(style);

    console.log('[Express Scripts] Footer removal active - all strategies enabled');
})();