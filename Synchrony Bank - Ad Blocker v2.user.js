// ==UserScript==
// @name         Synchrony Bank - Ad Blocker v2
// @namespace    http://tampermonkey.net/
// @version      2
// @description  Remove promotional campaigns, ads, footer, language switcher, and greeting messages from Synchrony Bank dashboard with optimized performance
// @author       You
// @match        https://www.synchrony.com/*
// @match        https://*.synchrony.com/*
// @match        https://www.mysynchrony.com/*
// @match        https://*.mysynchrony.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Synchrony Ad Blocker v2] Script initialized');

    // Configuration
    const CONFIG = {
        CLEANUP_INTERVAL: 2000,
        DEBOUNCE_DELAY: 200,
        SELECTORS: {
            CAMPAIGN_CARDS: '[data-cy="dynamic-yield-card"], [data-test="dynamic-yield-card"]',
            CAMPAIGN_TITLES: '[data-cy="general-campaign-title"]',
            CAMPAIGN_SUBTITLES: '[data-cy="general-campaign-sub-title"]',
            CAMPAIGN_BUTTONS: '[data-cy="campaign-button"]',
            FOOTER: 'footer, [data-test="vista-footer"], [data-cy="vista-footer"]',
            LANGUAGE_BUTTON: '#language-button, button[aria-label*="Change Language"], button[data-reason="Español"]'
        }
    };

    // Cache for processed elements
    const processedElements = new WeakSet();
    let isProcessing = false;

    // Utility functions
    const utils = {
        debounce(func, delay) {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        },

        findParentContainer(element) {
            return element.closest('[data-cy="dynamic-yield-card"]') ||
                   element.closest('[data-test="dynamic-yield-card"]') ||
                   element.closest('.sc-hVMWWG, .cTkTpR') ||
                   element.closest('.sc-jJoQJp, .gtwjuY, .sc-gKdVsk, .fNaRDA') ||
                   element.closest('[class*="sc-"]');
        },

        removeElement(element, description) {
            if (!element || processedElements.has(element)) return false;

            console.log(`[Synchrony Ad Blocker] Removing: ${description}`);
            element.remove();
            processedElements.add(element);
            return true;
        }
    };

    // Cleanup modules
    const cleanupModules = {
        // Remove Dynamic Yield campaign cards
        removeCampaignCards() {
            let count = 0;
            document.querySelectorAll(CONFIG.SELECTORS.CAMPAIGN_CARDS).forEach(card => {
                if (utils.removeElement(card, 'Dynamic Yield campaign card')) {
                    count++;
                }
            });
            return count;
        },

        // Remove specific campaign by title
        removeCampaignByTitle() {
            let count = 0;
            const titles = document.querySelectorAll(CONFIG.SELECTORS.CAMPAIGN_TITLES);

            titles.forEach(title => {
                const text = title.textContent.trim();
                if (text.includes('Insights at Your Fingertips') ||
                    text.includes('Explore More') ||
                    text.includes('Learn More')) {
                    const container = utils.findParentContainer(title);
                    if (container && utils.removeElement(container, `Campaign: ${text}`)) {
                        count++;
                    }
                }
            });
            return count;
        },

        // Remove blog promotional content
        removeBlogPromotions() {
            let count = 0;
            const subtitles = document.querySelectorAll(CONFIG.SELECTORS.CAMPAIGN_SUBTITLES);

            subtitles.forEach(subtitle => {
                const text = subtitle.textContent.trim();
                if (text.includes('Synchrony blog') ||
                    text.includes('financing tips') ||
                    text.includes('industry updates')) {
                    const container = utils.findParentContainer(subtitle);
                    if (container && utils.removeElement(container, 'Blog promotional content')) {
                        count++;
                    }
                }
            });
            return count;
        },

        // Remove campaign buttons
        removeCampaignButtons() {
            let count = 0;
            const buttons = document.querySelectorAll(CONFIG.SELECTORS.CAMPAIGN_BUTTONS);

            buttons.forEach(button => {
                const href = button.getAttribute('href') || '';
                if (href.includes('synchrony.com/blog') ||
                    href.includes('explore') ||
                    button.textContent.includes('Explore More')) {
                    const container = utils.findParentContainer(button);
                    if (container && utils.removeElement(container, 'Campaign button')) {
                        count++;
                    }
                }
            });
            return count;
        },

        // Remove Dynamic Yield images
        removeDynamicYieldImages() {
            let count = 0;
            const images = document.querySelectorAll('img[src*="dynamicyield.com"], img[src*="cdn-dynamicyield"]');

            images.forEach(img => {
                const container = utils.findParentContainer(img);
                if (container && utils.removeElement(container, 'Dynamic Yield image')) {
                    count++;
                }
            });
            return count;
        },

        // Remove promotional divs with styled-components
        removeStyledComponentAds() {
            let count = 0;
            const divs = document.querySelectorAll('div[class*="sc-jJoQJp"], div[class*="gtwjuY"]');

            divs.forEach(div => {
                if (processedElements.has(div)) return;

                const hasExploreButton = div.querySelector('a[href*="/blog"]');
                const hasPromoText = div.textContent.includes('Insights') ||
                                    div.textContent.includes('Explore More') ||
                                    div.textContent.includes('Learn More');

                if (hasExploreButton || hasPromoText) {
                    const parent = utils.findParentContainer(div);
                    const elementToRemove = parent || div;
                    if (utils.removeElement(elementToRemove, 'Styled component ad')) {
                        count++;
                    }
                }
            });
            return count;
        },

        // Remove all footers
        removeFooters() {
            let count = 0;
            const footers = document.querySelectorAll(CONFIG.SELECTORS.FOOTER);

            footers.forEach(footer => {
                const text = footer.textContent;
                if (text.includes('Synchrony Bank Privacy Policy') ||
                    text.includes('Online Privacy Policy') ||
                    text.includes('Equal Housing Lender') ||
                    footer.tagName.toLowerCase() === 'footer') {
                    const container = footer.closest('[data-test="vista-footer-container"]') ||
                                    footer.closest('.sc-kKmZLX, .leSsVR') ||
                                    footer.closest('.sc-csKEFx, .lavXMx') ||
                                    footer;
                    if (utils.removeElement(container, 'Footer section')) {
                        count++;
                    }
                }
            });
            return count;
        },

        // Remove language switcher
        removeLanguageSwitcher() {
            let count = 0;
            const languageButtons = document.querySelectorAll(CONFIG.SELECTORS.LANGUAGE_BUTTON);

            languageButtons.forEach(button => {
                if (utils.removeElement(button, 'Language switcher button')) {
                    count++;
                }
            });

            // Backup: Remove by button text
            document.querySelectorAll('button').forEach(button => {
                const text = button.textContent.trim();
                if (text === 'Español' || text.includes('Change Language')) {
                    if (utils.removeElement(button, 'Language button (by text)')) {
                        count++;
                    }
                }
            });
            return count;
        },

        // Remove greeting messages
        removeGreetings() {
            let count = 0;
            const greetings = ['Good Morning', 'Good Afternoon', 'Good Evening', 'Good Night', 'Hello'];
            const headers = document.querySelectorAll('h1, h2');

            headers.forEach(header => {
                const text = header.textContent.trim();
                if (greetings.includes(text)) {
                    const container = header.closest('.sc-iFyFPf, .fFWLHz') ||
                                    header.closest('div[class*="sc-"]') ||
                                    header;
                    if (utils.removeElement(container, `Greeting: ${text}`)) {
                        count++;
                    }
                }
            });

            // Backup: Remove by specific greeting classes
            const greetingByClass = document.querySelector('.sc-cxpSdN.sc-gLutmO.eEaYKP.goZpCf');
            if (greetingByClass) {
                const container = greetingByClass.closest('.sc-iFyFPf') || greetingByClass;
                if (utils.removeElement(container, 'Greeting (by class)')) {
                    count++;
                }
            }
            return count;
        },

        // Remove promo banners and alerts
        removePromoBanners() {
            let count = 0;
            const banners = document.querySelectorAll('[role="alert"], [class*="banner"], [class*="promo"]');

            banners.forEach(banner => {
                const text = banner.textContent.toLowerCase();
                if (text.includes('promotion') ||
                    text.includes('special offer') ||
                    text.includes('limited time') ||
                    text.includes('explore') && text.includes('blog')) {
                    if (utils.removeElement(banner, 'Promotional banner')) {
                        count++;
                    }
                }
            });
            return count;
        }
    };

    // Main cleanup function
    function cleanupSynchronyPage() {
        if (isProcessing) return;
        isProcessing = true;

        try {
            let totalRemoved = 0;

            // Run all cleanup modules
            totalRemoved += cleanupModules.removeCampaignCards();
            totalRemoved += cleanupModules.removeCampaignByTitle();
            totalRemoved += cleanupModules.removeBlogPromotions();
            totalRemoved += cleanupModules.removeCampaignButtons();
            totalRemoved += cleanupModules.removeDynamicYieldImages();
            totalRemoved += cleanupModules.removeStyledComponentAds();
            totalRemoved += cleanupModules.removeFooters();
            totalRemoved += cleanupModules.removeLanguageSwitcher();
            totalRemoved += cleanupModules.removeGreetings();
            totalRemoved += cleanupModules.removePromoBanners();

            if (totalRemoved > 0) {
                console.log(`[Synchrony Ad Blocker] Cleanup complete: ${totalRemoved} element(s) removed`);
            }
        } catch (error) {
            console.error('[Synchrony Ad Blocker] Error during cleanup:', error);
        } finally {
            isProcessing = false;
        }
    }

    // Debounced cleanup for mutation observer
    const debouncedCleanup = utils.debounce(cleanupSynchronyPage, CONFIG.DEBOUNCE_DELAY);

    // Initialize
    console.log('[Synchrony Ad Blocker v2] Starting initial cleanup');
    cleanupSynchronyPage();

    // Watch for dynamic content changes with optimized observer
    const observer = new MutationObserver((mutations) => {
        // Only trigger if mutations contain relevant changes
        const hasRelevantChanges = mutations.some(mutation =>
            mutation.addedNodes.length > 0 ||
            mutation.type === 'childList'
        );

        if (hasRelevantChanges) {
            debouncedCleanup();
        }
    });

    // Start observing with optimized settings
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Periodic cleanup as backup
    setInterval(cleanupSynchronyPage, CONFIG.CLEANUP_INTERVAL);

    // Handle dynamic navigation (SPA behavior)
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            console.log('[Synchrony Ad Blocker v2] URL changed, running cleanup');
            setTimeout(cleanupSynchronyPage, 500);
        }
    });

    urlObserver.observe(document.body, { childList: true, subtree: true });

    console.log('[Synchrony Ad Blocker v2] Monitoring active - all cleanup modules enabled');
})();