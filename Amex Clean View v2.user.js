// ==UserScript==
// @name         Amex Clean View v2
// @namespace    Amex Clean View v2
// @version      2
// @description  Optimized complete ad blocker: removes ALL promotional content from American Express with enhanced performance and smart detection
// @author       You
// @match        https://www.americanexpress.com/*
// @match        https://*.americanexpress.com/*
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
            // Product tiles
            productTile: '[data-testid="product-tile"]',

            // Sections to remove
            memberOffers: '[data-testid="overview-member-offers"]',
            loanOffer: '[data-testid="axp-overview-revenue-offer"]',
            membershipOffer: '[data-testid="axp-overview-membership-offer"]',
            exploreButton: '[data-testid="exploreMoreEntryPoint"]',

            // Footer
            footer: '[data-module-name="axp-footer"], footer[role="contentinfo"]',

            // Modules
            referralModule: '[data-module-name="axp-member-referral"]',
            usefulLinksModule: '[data-module-name="axp-useful-links"]',
            offersModule: '[data-module-name="axp-offers"]',

            // Tools section
            toolsHeading: '._toolsHeading_12oft_1',
            toolsTileWrapper: '._toolsTileWrapper_12oft_5',

            // Generic containers
            card: '._card_nwk0k_10',
            layoutSlot: '.layout-mapper-slot',
            sectionContainer: '.section-container',
            scrollAwareLoad: '[data-testid="scroll-aware-load"]'
        },
        KEYWORDS: {
            remove: [
                'Personal Loan',
                'FICO® Score and Insights',
                'MyCredit Guide',
                'American Express® Personal Loans',
                'Loans That Fit Your Lifestyle',
                'Amex Offers & Benefits',
                'Useful Links',
                "You're pre-approved",
                'pre-approved for a Personal Loan',
                'max APR',
                'Canceled: Payment not required'
            ]
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
        prefix: '[AMEX Ad Blocker v2]',

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

        containsKeyword(text, keywords = CONFIG.KEYWORDS.remove) {
            if (!text) return false;
            const normalizedText = text.toLowerCase().trim();
            return keywords.some(keyword =>
                normalizedText.includes(keyword.toLowerCase())
            );
        },

        findClosestContainer(element, selectors) {
            if (!element) return null;

            for (const selector of selectors) {
                const container = element.closest(selector);
                if (container) return container;
            }

            return null;
        }
    };

    // ========================================
    // ELEMENT REMOVERS
    // ========================================

    const Removers = {
        // Remove canceled personal loan tiles
        removeCanceledLoanTiles() {
            const tiles = document.querySelectorAll(CONFIG.SELECTORS.productTile);
            let count = 0;

            tiles.forEach(tile => {
                if (state.processedElements.has(tile)) return;

                const loanTitle = tile.querySelector('[data-locator-id="credo_financing_name"]');
                const canceledIndicator = tile.querySelector('[data-testid="payment-indicator"]');
                const canceledText = canceledIndicator?.textContent || '';

                const isPersonalLoan = loanTitle?.textContent.trim() === 'Personal Loan';
                const isCanceled = canceledText.includes('Canceled: Payment not required');

                if (isPersonalLoan && isCanceled) {
                    if (Utils.removeElement(tile, 'Canceled Personal Loan tile')) {
                        count++;
                    }
                }
            });

            return count;
        },

        // Remove member offers section
        removeMemberOffers() {
            const section = document.querySelector(CONFIG.SELECTORS.memberOffers);
            return section ? Utils.removeElement(section, 'Member Offers section') : false;
        },

        // Remove individual offer cards
        removeOfferCards() {
            let count = 0;

            const loanOffer = document.querySelector(CONFIG.SELECTORS.loanOffer);
            if (loanOffer) {
                const container = Utils.findClosestContainer(loanOffer, ['.col-sm-12', '.col-md-6']);
                if (Utils.removeElement(container || loanOffer, 'Personal Loan offer card')) {
                    count++;
                }
            }

            const membershipOffer = document.querySelector(CONFIG.SELECTORS.membershipOffer);
            if (membershipOffer) {
                const container = Utils.findClosestContainer(membershipOffer, ['.col-sm-12', '.col-md-6']);
                if (Utils.removeElement(container || membershipOffer, 'Membership offer card')) {
                    count++;
                }
            }

            return count;
        },

        // Remove tools section (FICO Score)
        removeToolsSection() {
            let count = 0;

            const toolsHeading = document.querySelector(CONFIG.SELECTORS.toolsHeading);
            if (toolsHeading) {
                const container = Utils.findClosestContainer(toolsHeading, [
                    CONFIG.SELECTORS.sectionContainer,
                    CONFIG.SELECTORS.layoutSlot
                ]);

                if (Utils.removeElement(container || toolsHeading, 'Tools section')) {
                    count++;
                }
            }

            // Remove FICO tiles
            const tiles = document.querySelectorAll(CONFIG.SELECTORS.productTile);
            tiles.forEach(tile => {
                if (state.processedElements.has(tile)) return;

                const text = tile.textContent || '';
                const isFico = text.includes('FICO® Score and Insights') ||
                              text.includes('MyCredit Guide');

                if (isFico) {
                    const wrapper = Utils.findClosestContainer(tile, [
                        CONFIG.SELECTORS.layoutSlot,
                        CONFIG.SELECTORS.sectionContainer,
                        CONFIG.SELECTORS.toolsTileWrapper
                    ]);

                    if (Utils.removeElement(wrapper || tile, 'FICO Score tile')) {
                        count++;
                    }
                }
            });

            return count;
        },

        // Remove footer
        removeFooter() {
            const footers = document.querySelectorAll(CONFIG.SELECTORS.footer);
            let count = 0;

            footers.forEach(footer => {
                if (Utils.removeElement(footer, 'Footer')) {
                    count++;
                }
            });

            return count;
        },

        // Remove explore products button
        removeExploreButton() {
            const button = document.querySelector(CONFIG.SELECTORS.exploreButton);
            if (!button) return false;

            const container = button.closest('.pad-1');
            return Utils.removeElement(container || button, 'Explore products button');
        },

        // Remove promotional modules
        removePromotionalModules() {
            let count = 0;

            const referral = document.querySelector(CONFIG.SELECTORS.referralModule);
            if (referral) {
                const container = Utils.findClosestContainer(referral, [
                    CONFIG.SELECTORS.scrollAwareLoad
                ]);
                if (Utils.removeElement(container || referral, 'Personal Loans promo')) {
                    count++;
                }
            }

            const usefulLinks = document.querySelector(CONFIG.SELECTORS.usefulLinksModule);
            if (usefulLinks) {
                if (Utils.removeElement(usefulLinks, 'Useful Links section')) {
                    count++;
                }
            }

            const offersModule = document.querySelector(CONFIG.SELECTORS.offersModule);
            if (offersModule) {
                const container = Utils.findClosestContainer(offersModule, [
                    CONFIG.SELECTORS.card
                ]);
                if (Utils.removeElement(container || offersModule, 'Amex Offers section')) {
                    count++;
                }
            }

            // Backup: offers section by ID
            const offersSection = document.querySelector('#offers');
            if (offersSection) {
                const container = Utils.findClosestContainer(offersSection, [
                    CONFIG.SELECTORS.card
                ]);
                if (Utils.removeElement(container || offersSection, 'Offers section (ID)')) {
                    count++;
                }
            }

            return count;
        },

        // Remove sections by heading text
        removeSectionsByHeading() {
            let count = 0;
            const headings = document.querySelectorAll('h1, h2, h3');

            headings.forEach(heading => {
                if (state.processedElements.has(heading)) return;

                const text = heading.textContent.trim();

                if (Utils.containsKeyword(text)) {
                    const container = Utils.findClosestContainer(heading, [
                        CONFIG.SELECTORS.card,
                        '[data-module-name]',
                        CONFIG.SELECTORS.scrollAwareLoad
                    ]);

                    if (Utils.removeElement(container, `Section with heading: "${text}"`)) {
                        count++;
                    }
                }
            });

            // Backup: Useful Links by specific heading
            const usefulLinksHeading = Array.from(document.querySelectorAll('h2'))
                .find(h => h.textContent.trim() === 'Useful Links');

            if (usefulLinksHeading && !state.processedElements.has(usefulLinksHeading)) {
                const container = Utils.findClosestContainer(usefulLinksHeading, [
                    CONFIG.SELECTORS.card,
                    CONFIG.SELECTORS.usefulLinksModule
                ]);
                if (Utils.removeElement(container, 'Useful Links (backup)')) {
                    count++;
                }
            }

            return count;
        },

        // Remove pre-approval messages
        removePreApprovalMessages() {
            let count = 0;
            const textElements = document.querySelectorAll('span, p, div');

            textElements.forEach(element => {
                if (state.processedElements.has(element)) return;

                const text = element.textContent || '';
                const hasPreApproval = text.includes("You're pre-approved") ||
                                      text.includes("pre-approved for a Personal Loan") ||
                                      text.includes("max APR");

                if (hasPreApproval) {
                    const container = Utils.findClosestContainer(element, [
                        '._colorBgLightBlue_1hkpf_1',
                        '.useful-links',
                        CONFIG.SELECTORS.card
                    ]);

                    if (Utils.removeElement(container || element, 'Pre-approval message')) {
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

    function cleanupAmexPage() {
        const startTime = performance.now();
        const initialCount = state.totalRemoved;

        try {
            // Run all removers
            Removers.removeCanceledLoanTiles();
            Removers.removeMemberOffers();
            Removers.removeOfferCards();
            Removers.removeToolsSection();
            Removers.removeFooter();
            Removers.removeExploreButton();
            Removers.removePromotionalModules();
            Removers.removeSectionsByHeading();
            Removers.removePreApprovalMessages();

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
        cleanupAmexPage,
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
                cleanupAmexPage();
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
            cleanupAmexPage();

            // Setup observers and intervals
            setupObserver();
            setupBackupInterval();

            Logger.log('Fully active - monitoring for promotional content');

            // Cleanup on page unload
            window.addEventListener('beforeunload', () => {
                if (state.observer) {
                    state.observer.disconnect();
                }
                if (state.backupInterval) {
                    clearInterval(state.backupInterval);
                }
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