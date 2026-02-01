// ==UserScript==
// @name           Amazon Enhanced v1
// @namespace      graphen
// @version        1
// @description    Combined script: Clean short URLs + Show absolute review numbers. Automatically cleans URLs, removes tracking parameters, and displays absolute review counts for each star rating. Enhanced performance and modern optimizations.
// @author         Graphen (combined and updated)
// @include        /^https?:\/\/(www|smile)\.amazon\.(cn|in|sg|ae|fr|de|pl|it|nl|es|ca|se|com(\.(mx|au|br|tr|be))?|co\.(uk|jp))\/.*(dp|gp\/(product|video)|exec\/obidos\/ASIN|o\/ASIN|product-reviews)\/.*$/
// @icon           https://www.amazon.com/favicon.ico
// @noframes
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_registerMenuCommand
// @grant          GM_unregisterMenuCommand
// @grant          GM_addStyle
// @license        MIT
// @run-at         document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        URL_CLEANER: {
            ASIN_LENGTH: 10,
            URL_CHECK_INTERVAL: 1000,
            ASIN_PATTERN: /^[A-Z0-9]{10}$/,
            SELECTORS: {
                ASIN_INPUT: '#ASIN',
                BUYBOX_PARENT: '#desktop_buybox',
                BUYBOX: '#buybox',
                CANONICAL_LINK: 'link[rel="canonical"]'
            },
            CANONICAL_PATTERNS: [
                /https?:\/\/www\.amazon\..*\/dp\/([\w]+)$/,
                /https?:\/\/www\.amazon\..*\/gp\/product\/([\w]+)/,
                /https?:\/\/www\.amazon\..*\/ASIN\/([\w]+)/
            ]
        },
        REVIEWS: {
            MAX_TOTAL_REVIEWS: 500000,
            SELECTORS: {
                TOTAL_REVIEWS: '[data-hook="total-review-count"]',
                HISTOGRAM_TABLE: '#histogramTable',
                PERCENTAGE_CELLS: '#histogramTable .a-text-right',
                HISTOGRAM_ROWS: '#histogramTable tr'
            }
        },
        STORAGE_KEYS: {
            // URL Cleaner
            AUTO_CLEAN: 'autoCleanEnabled',
            PRESERVE_REF: 'preserveRef',
            // Reviews
            SHOW_ABSOLUTE: 'showAbsoluteNumbers',
            SHOW_PERCENTAGE: 'showPercentage',
            ALIGNMENT: 'numberAlignment',
            // Global
            NOTIFY: 'notifyEnabled'
        },
        ALIGNMENTS: {
            RIGHT: 'right',
            LEFT: 'left',
            CENTER: 'center'
        }
    };

    // Utility Functions
    const Utils = {
        log(message, type = 'info') {
            if (!settings.isNotifyEnabled()) return;

            const prefix = '[Amazon Enhanced v1]';
            const styles = {
                info: 'color: #FF9900',
                success: 'color: #067D62',
                warning: 'color: #F08804',
                error: 'color: #C7511F'
            };
            console.log(`%c${prefix} ${message}`, styles[type] || styles.info);
        },

        isValidAsin(asin) {
            return asin &&
                   asin.length === CONFIG.URL_CLEANER.ASIN_LENGTH &&
                   CONFIG.URL_CLEANER.ASIN_PATTERN.test(asin);
        },

        sanitizeNumber(text) {
            if (!text) return null;
            const cleaned = text.replace(/\D/g, '');
            if (!cleaned) return null;
            const number = parseInt(cleaned, 10);
            return isNaN(number) ? null : number;
        },

        formatNumber(number) {
            return number.toLocaleString();
        },

        isValidReviewCount(count) {
            return count > 0 && count <= CONFIG.REVIEWS.MAX_TOTAL_REVIEWS;
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
        }
    };

    // ===== URL CLEANER COMPONENTS =====

    // ASIN Extractor
    class AsinExtractor {
        constructor() {
            this.lastAsin = null;
        }

        extract() {
            let asin = this.extractFromInput();
            if (asin) return asin;

            asin = this.extractFromCanonical();
            if (asin) return asin;

            asin = this.extractFromUrl();
            return asin;
        }

        extractFromInput() {
            const asinInput = document.querySelector(CONFIG.URL_CLEANER.SELECTORS.ASIN_INPUT);
            if (asinInput && Utils.isValidAsin(asinInput.value)) {
                return asinInput.value;
            }
            return null;
        }

        extractFromCanonical() {
            const canonical = document.querySelector(CONFIG.URL_CLEANER.SELECTORS.CANONICAL_LINK);
            if (!canonical) return null;

            const href = canonical.getAttribute('href');
            if (!href) return null;

            for (const pattern of CONFIG.URL_CLEANER.CANONICAL_PATTERNS) {
                const match = href.match(pattern);
                if (match && Utils.isValidAsin(match[1])) {
                    return match[1];
                }
            }
            return null;
        }

        extractFromUrl() {
            const url = window.location.href;
            const patterns = [
                /\/dp\/([A-Z0-9]{10})/,
                /\/gp\/product\/([A-Z0-9]{10})/,
                /\/ASIN\/([A-Z0-9]{10})/,
                /\/o\/ASIN\/([A-Z0-9]{10})/
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && Utils.isValidAsin(match[1])) {
                    return match[1];
                }
            }
            return null;
        }

        hasChanged(asin) {
            if (asin !== this.lastAsin) {
                this.lastAsin = asin;
                return true;
            }
            return false;
        }
    }

    // URL Cleaner
    class UrlCleaner {
        constructor(settings) {
            this.settings = settings;
            this.lastCleanedUrl = null;
            this.urlCheckInterval = null;
        }

        cleanUrl(asin) {
            if (!asin || !Utils.isValidAsin(asin)) {
                return false;
            }

            const currentPath = window.location.pathname;
            const newPath = `/dp/${asin}/`;

            if (currentPath === newPath && !window.location.search && !window.location.hash) {
                return false;
            }

            try {
                let search = '';
                if (this.settings.isPreserveRef()) {
                    const params = new URLSearchParams(window.location.search);
                    const ref = params.get('ref');
                    if (ref) {
                        search = `?ref=${encodeURIComponent(ref)}`;
                    }
                }

                const newUrl = newPath + search;

                if (this.lastCleanedUrl !== newUrl) {
                    history.replaceState(null, document.title, newUrl);
                    this.lastCleanedUrl = newUrl;
                    Utils.log(`URL cleaned: ${newUrl}`, 'success');
                    return true;
                }
            } catch (error) {
                Utils.log(`Failed to clean URL: ${error.message}`, 'error');
            }
            return false;
        }

        removeParameters() {
            if (window.location.search === '' && window.location.hash === '') {
                return false;
            }

            try {
                let newSearch = '';
                if (this.settings.isPreserveRef()) {
                    const params = new URLSearchParams(window.location.search);
                    const ref = params.get('ref');
                    if (ref) {
                        newSearch = `?ref=${encodeURIComponent(ref)}`;
                    }
                }

                const newUrl = window.location.origin + window.location.pathname + newSearch;

                if (window.location.href !== newUrl) {
                    history.replaceState(history.state, document.title, newUrl);
                    Utils.log('URL parameters cleaned', 'success');
                    return true;
                }
            } catch (error) {
                Utils.log(`Failed to remove parameters: ${error.message}`, 'error');
            }
            return false;
        }

        startParameterCleaning() {
            if (this.urlCheckInterval) return;
            this.urlCheckInterval = setInterval(() => {
                if (this.settings.isAutoCleanEnabled()) {
                    this.removeParameters();
                }
            }, CONFIG.URL_CLEANER.URL_CHECK_INTERVAL);
        }

        stopParameterCleaning() {
            if (this.urlCheckInterval) {
                clearInterval(this.urlCheckInterval);
                this.urlCheckInterval = null;
            }
        }
    }

    // Buybox Observer
    class BuyboxObserver {
        constructor(onVariationChange) {
            this.onVariationChange = onVariationChange;
            this.observer = null;
            this.setupObserver();
        }

        setupObserver() {
            const buyboxParent = document.querySelector(CONFIG.URL_CLEANER.SELECTORS.BUYBOX_PARENT);
            if (!buyboxParent) return;

            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.id === 'buybox') {
                            Utils.log('Buybox variation detected', 'info');
                            this.onVariationChange();
                        }
                    });
                });
            });

            this.observer.observe(buyboxParent, {
                childList: true,
                subtree: true
            });
        }

        disconnect() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
        }
    }

    // ===== REVIEW NUMBERS COMPONENTS =====

    // Review Calculator
    class ReviewCalculator {
        constructor() {
            this.totalReviews = null;
            this.percentages = [];
            this.absoluteNumbers = [];
        }

        extractTotalReviews() {
            const totalElement = document.querySelector(CONFIG.REVIEWS.SELECTORS.TOTAL_REVIEWS);
            if (!totalElement) return false;

            this.totalReviews = Utils.sanitizeNumber(totalElement.innerText);
            if (!this.totalReviews || !Utils.isValidReviewCount(this.totalReviews)) {
                return false;
            }

            Utils.log(`Total reviews: ${Utils.formatNumber(this.totalReviews)}`, 'success');
            return true;
        }

        extractPercentages() {
            const percentageElements = document.querySelectorAll(CONFIG.REVIEWS.SELECTORS.PERCENTAGE_CELLS);
            if (!percentageElements || percentageElements.length === 0) return false;

            this.percentages = [];
            percentageElements.forEach(element => {
                const percentage = Utils.sanitizeNumber(element.innerText);
                if (percentage !== null && percentage >= 0 && percentage <= 100) {
                    this.percentages.push({ element, percentage });
                }
            });

            return this.percentages.length > 0;
        }

        calculateAbsoluteNumbers() {
            if (!this.totalReviews || this.percentages.length === 0) return false;

            this.absoluteNumbers = [];
            for (const item of this.percentages) {
                const absolute = Math.round(item.percentage * this.totalReviews / 100);
                if (absolute < 0 || absolute > this.totalReviews) return false;

                this.absoluteNumbers.push({
                    element: item.element,
                    percentage: item.percentage,
                    absolute: absolute
                });
            }
            return true;
        }

        process() {
            return this.extractTotalReviews() &&
                   this.extractPercentages() &&
                   this.calculateAbsoluteNumbers();
        }

        getResults() {
            return {
                total: this.totalReviews,
                numbers: this.absoluteNumbers
            };
        }
    }

    // Display Manager
    class DisplayManager {
        constructor(settings) {
            this.settings = settings;
            this.processedElements = new WeakSet();
        }

        displayNumbers(results) {
            if (!results || !results.numbers || results.numbers.length === 0) return false;

            let displayed = 0;
            results.numbers.forEach(item => {
                if (!this.processedElements.has(item.element)) {
                    if (this.addNumberToElement(item)) {
                        this.processedElements.add(item.element);
                        displayed++;
                    }
                }
            });

            if (displayed > 0) {
                Utils.log(`Displayed ${displayed} review numbers`, 'success');
            }
            return displayed > 0;
        }

        addNumberToElement(item) {
            try {
                const existingSpan = item.element.querySelector('.review-absolute-number');
                if (existingSpan) existingSpan.remove();

                const span = document.createElement('span');
                span.className = 'review-absolute-number';

                let text = '';
                if (this.settings.isShowPercentage() && this.settings.isShowAbsolute()) {
                    text = ` (${item.percentage}% / ${Utils.formatNumber(item.absolute)})`;
                } else if (this.settings.isShowAbsolute()) {
                    text = ` (${Utils.formatNumber(item.absolute)})`;
                } else if (this.settings.isShowPercentage()) {
                    text = ` (${item.percentage}%)`;
                }

                span.textContent = text;
                item.element.appendChild(span);
                return true;
            } catch (error) {
                return false;
            }
        }

        applyStyles() {
            const alignment = this.settings.getAlignment();
            GM_addStyle(`
                #histogramTable td:last-of-type {
                    text-align: ${alignment} !important;
                }
                .review-absolute-number {
                    font-weight: normal;
                    color: #565959;
                }
            `);
        }
    }

    // ===== SETTINGS MANAGER =====

    class SettingsManager {
        constructor() {
            // URL Cleaner settings
            this.autoClean = GM_getValue(CONFIG.STORAGE_KEYS.AUTO_CLEAN, true);
            this.preserveRef = GM_getValue(CONFIG.STORAGE_KEYS.PRESERVE_REF, false);

            // Review settings
            this.showAbsolute = GM_getValue(CONFIG.STORAGE_KEYS.SHOW_ABSOLUTE, true);
            this.showPercentage = GM_getValue(CONFIG.STORAGE_KEYS.SHOW_PERCENTAGE, false);
            this.alignment = GM_getValue(CONFIG.STORAGE_KEYS.ALIGNMENT, CONFIG.ALIGNMENTS.RIGHT);

            // Global settings
            this.notify = GM_getValue(CONFIG.STORAGE_KEYS.NOTIFY, false);
        }

        // URL Cleaner settings
        isAutoCleanEnabled() { return this.autoClean; }
        toggleAutoClean() {
            this.autoClean = !this.autoClean;
            GM_setValue(CONFIG.STORAGE_KEYS.AUTO_CLEAN, this.autoClean);
            Utils.log(`Auto-clean ${this.autoClean ? 'enabled' : 'disabled'}`, 'success');
            return this.autoClean;
        }

        isPreserveRef() { return this.preserveRef; }
        togglePreserveRef() {
            this.preserveRef = !this.preserveRef;
            GM_setValue(CONFIG.STORAGE_KEYS.PRESERVE_REF, this.preserveRef);
            Utils.log(`Preserve ref ${this.preserveRef ? 'enabled' : 'disabled'}`, 'success');
            return this.preserveRef;
        }

        // Review settings
        isShowAbsolute() { return this.showAbsolute; }
        toggleShowAbsolute() {
            this.showAbsolute = !this.showAbsolute;
            GM_setValue(CONFIG.STORAGE_KEYS.SHOW_ABSOLUTE, this.showAbsolute);
            Utils.log(`Show absolute ${this.showAbsolute ? 'enabled' : 'disabled'}`, 'success');
            return this.showAbsolute;
        }

        isShowPercentage() { return this.showPercentage; }
        toggleShowPercentage() {
            this.showPercentage = !this.showPercentage;
            GM_setValue(CONFIG.STORAGE_KEYS.SHOW_PERCENTAGE, this.showPercentage);
            Utils.log(`Show percentage ${this.showPercentage ? 'enabled' : 'disabled'}`, 'success');
            return this.showPercentage;
        }

        getAlignment() { return this.alignment; }
        cycleAlignment() {
            const alignments = Object.values(CONFIG.ALIGNMENTS);
            const currentIndex = alignments.indexOf(this.alignment);
            const nextIndex = (currentIndex + 1) % alignments.length;
            this.alignment = alignments[nextIndex];
            GM_setValue(CONFIG.STORAGE_KEYS.ALIGNMENT, this.alignment);
            Utils.log(`Alignment: ${this.alignment}`, 'success');
            return this.alignment;
        }

        // Global settings
        isNotifyEnabled() { return this.notify; }
        toggleNotify() {
            this.notify = !this.notify;
            GM_setValue(CONFIG.STORAGE_KEYS.NOTIFY, this.notify);
            console.log(`[Amazon Enhanced v1] Notifications ${this.notify ? 'enabled' : 'disabled'}`);
            return this.notify;
        }
    }

    // ===== MENU MANAGER =====

    class MenuManager {
        constructor(app) {
            this.app = app;
            this.menuIds = {};
            this.registerCommands();
        }

        registerCommands() {
            // URL Cleaner commands
            this.menuIds.autoClean = GM_registerMenuCommand(
                `🧹 Auto-Clean URLs: ${this.app.settings.isAutoCleanEnabled() ? 'On ✓' : 'Off ✗'}`,
                () => this.handleAutoCleanToggle()
            );

            this.menuIds.preserveRef = GM_registerMenuCommand(
                `🔗 Preserve Ref: ${this.app.settings.isPreserveRef() ? 'Yes' : 'No'}`,
                () => this.handlePreserveRefToggle()
            );

            this.menuIds.cleanNow = GM_registerMenuCommand(
                '✨ Clean URL Now',
                () => this.handleCleanNow()
            );

            // Review commands
            this.menuIds.showAbsolute = GM_registerMenuCommand(
                `🔢 Show Absolute: ${this.app.settings.isShowAbsolute() ? 'Yes ✓' : 'No ✗'}`,
                () => this.handleShowAbsoluteToggle()
            );

            this.menuIds.showPercentage = GM_registerMenuCommand(
                `📊 Show Percentage: ${this.app.settings.isShowPercentage() ? 'Yes ✓' : 'No ✗'}`,
                () => this.handleShowPercentageToggle()
            );

            this.menuIds.alignment = GM_registerMenuCommand(
                `📐 Alignment: ${this.app.settings.getAlignment().toUpperCase()}`,
                () => this.handleAlignmentCycle()
            );

            this.menuIds.refreshReviews = GM_registerMenuCommand(
                '🔄 Refresh Reviews',
                () => this.handleRefreshReviews()
            );

            // Global commands
            this.menuIds.notify = GM_registerMenuCommand(
                `🔔 Notifications: ${this.app.settings.isNotifyEnabled() ? 'On' : 'Off'}`,
                () => this.handleNotifyToggle()
            );
        }

        handleAutoCleanToggle() {
            this.app.toggleAutoClean();
            this.updateCommands();
        }

        handlePreserveRefToggle() {
            this.app.settings.togglePreserveRef();
            this.updateCommands();
        }

        handleCleanNow() {
            this.app.processUrl();
        }

        handleShowAbsoluteToggle() {
            this.app.settings.toggleShowAbsolute();
            this.app.refreshReviews();
            this.updateCommands();
        }

        handleShowPercentageToggle() {
            this.app.settings.toggleShowPercentage();
            this.app.refreshReviews();
            this.updateCommands();
        }

        handleAlignmentCycle() {
            this.app.settings.cycleAlignment();
            this.app.reviewDisplayManager.applyStyles();
            this.updateCommands();
        }

        handleRefreshReviews() {
            this.app.processReviews();
        }

        handleNotifyToggle() {
            this.app.settings.toggleNotify();
            this.updateCommands();
        }

        updateCommands() {
            Object.values(this.menuIds).forEach(id => {
                try { GM_unregisterMenuCommand(id); } catch (e) {}
            });
            this.registerCommands();
        }

        cleanup() {
            Object.values(this.menuIds).forEach(id => {
                try { GM_unregisterMenuCommand(id); } catch (e) {}
            });
        }
    }

    // ===== MAIN APPLICATION =====

    class AmazonEnhanced {
        constructor() {
            this.settings = new SettingsManager();

            // URL Cleaner components
            this.asinExtractor = new AsinExtractor();
            this.urlCleaner = new UrlCleaner(this.settings);
            this.buyboxObserver = null;

            // Review components
            this.reviewCalculator = new ReviewCalculator();
            this.reviewDisplayManager = new DisplayManager(this.settings);
            this.reviewObserver = null;

            // Menu
            this.menuManager = null;
        }

        init() {
            Utils.log('Initializing...', 'info');

            // URL Cleaner initialization
            this.processUrl();
            this.buyboxObserver = new BuyboxObserver(() => this.processUrl());

            if (this.settings.isAutoCleanEnabled()) {
                this.urlCleaner.startParameterCleaning();
            }

            this.setupUrlMonitoring();

            // Review Numbers initialization
            this.reviewDisplayManager.applyStyles();
            this.processReviews();
            this.setupReviewObserver();

            // Menu
            this.menuManager = new MenuManager(this);

            Utils.log('Initialization complete', 'success');
        }

        // URL Cleaner methods
        processUrl() {
            const asin = this.asinExtractor.extract();
            if (!asin) return;

            if (this.asinExtractor.hasChanged(asin)) {
                Utils.log(`ASIN: ${asin}`, 'info');
            }
            this.urlCleaner.cleanUrl(asin);
        }

        setupUrlMonitoring() {
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            const self = this;

            history.pushState = function(...args) {
                originalPushState.apply(this, args);
                self.processUrl();
            };

            history.replaceState = function(...args) {
                originalReplaceState.apply(this, args);
                setTimeout(() => self.processUrl(), 100);
            };

            window.addEventListener('popstate', () => this.processUrl());
        }

        toggleAutoClean() {
            const enabled = this.settings.toggleAutoClean();
            if (enabled) {
                this.urlCleaner.startParameterCleaning();
            } else {
                this.urlCleaner.stopParameterCleaning();
            }
            return enabled;
        }

        // Review methods
        processReviews() {
            if (this.reviewCalculator.process()) {
                const results = this.reviewCalculator.getResults();
                this.reviewDisplayManager.displayNumbers(results);
            }
        }

        refreshReviews() {
            this.reviewDisplayManager.processedElements = new WeakSet();
            this.processReviews();
        }

        setupReviewObserver() {
            const histogramTable = document.querySelector(CONFIG.REVIEWS.SELECTORS.HISTOGRAM_TABLE);
            if (!histogramTable) return;

            this.reviewObserver = new MutationObserver(
                Utils.debounce(() => this.processReviews(), 500)
            );

            this.reviewObserver.observe(histogramTable, {
                childList: true,
                subtree: true
            });
        }

        // Cleanup
        destroy() {
            Utils.log('Cleaning up...', 'info');
            this.urlCleaner.stopParameterCleaning();
            this.buyboxObserver?.disconnect();
            this.reviewObserver?.disconnect();
            this.menuManager?.cleanup();
        }
    }

    // Initialize
    const settings = new SettingsManager();
    const app = new AmazonEnhanced();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => app.init());
    } else {
        app.init();
    }

    window.addEventListener('beforeunload', () => app.destroy());
    window.AmazonEnhanced = app;

})();