// ==UserScript==
// @name         Reddit Enhancement Suite v4
// @namespace    Reddit Enhancement Suite v4
// @version      4
// @description  Ultimate Reddit enhancement: Auto-unblur NSFW, remove login prompts, fix scroll, auto-expand replies, remove sidebar/highlights/games, optimized performance
// @author       Enhanced & Optimized
// @license      MIT
// @match        http://*.reddit.com/*
// @match        https://*.reddit.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @grant        GM_addStyle
// @grant        GM_cookie
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ---------- CONFIGURATION ----------
    const CONFIG = {
        // Core Settings
        COOKIE_DOMAINS: ['reddit.com', 'www.reddit.com'],
        CHECK_INTERVAL: 100,
        BATCH_SIZE: 20,
        MAX_RETRIES: 3,

        // Reply Expander Settings
        REPLY_SELECTORS: [
            '.showreplies',
            'button[aria-label*="replies"]',
            '[data-testid="comment-show-replies"]'
        ],
        OBSERVER_DEBOUNCE_MS: 300,
        MAX_CLICKS_PER_RUN: 50,
        CLICK_DELAY_MS: 30,
        PERIODIC_CHECK_INTERVAL: 5000,

        // Storage Keys
        STORAGE_KEYS: {
            AUTO_UNBLUR: 'ultimate_autoUnblurEnabled',
            REMOVE_PROMPTS: 'ultimate_removePromptsEnabled',
            FIX_SCROLL: 'ultimate_fixScrollEnabled',
            AUTO_EXPAND_REPLIES: 'ultimate_autoExpandRepliesEnabled',
            REMOVE_SIDEBAR: 'ultimate_removeSidebarEnabled',
            REMOVE_GAMES: 'ultimate_removeGamesEnabled',
            NOTIFY: 'ultimate_notifyEnabled',
            AGGRESSIVE_MODE: 'ultimate_aggressiveMode'
        },

        // Selectors - Optimized and expanded
        SELECTORS: {
            // Main content
            MAIN_CONTENT: '.sidebar-grid',
            BODY: 'body',

            // NSFW & Login elements
            NSFW_ELEMENTS: [
                'xpromo-nsfw-blocking-modal-desktop',
                'xpromo-nsfw-bypassable-modal-desktop',
                'xpromo-nsfw-blocking-container',
                '#nsfw-qr-dialog',
                'faceplate-modal:has(> div.text-category-nsfw)',
                'shreddit-blurred-container',
                'div[style*="backdrop-filter: blur"]',
                '[data-testid="nsfw-modal"]',
                '.nsfw-interstitial'
            ],

            // Sidebar elements
            SIDEBAR: [
                '#right-sidebar-container',
                '#right-sidebar-contents',
                'aside[aria-label="Community information"]',
                'faceplate-partial[id="subreddit-right-rail__partial"]',
                '[class*="right-sidebar"]',
                '.sidebar-grid aside',
                'community-highlight-carousel',
                '.legal-links',
                '[data-testid="sidebar"]',
                '.sidebar'
            ],

            // Games section elements
            GAMES: [
                'games-section-badge-wrapper',
                '[featured-game-slug]',
                '[class*="games-section"]',
                '[data-testid*="game"]',
                '.games-carousel',
                'rpl-badge[appearance="alert"]',
                '[href*="/games/"]',
                '.gaming-widget'
            ],

            // Promotional elements
            PROMO: [
                '[data-testid="premium-banner"]',
                '.premium-banner-outer',
                '[href*="reddit.com/premium"]',
                '.reddit-premium-banner'
            ],

            // Layout targets
            LAYOUT: {
                FEED: '.main-container',
                CONTENT_WRAPPER: '#shreddit-app > div > div:nth-child(2) > div > div',
                GRID: '.sidebar-grid'
            }
        }
    };

    // ---------- UTILITIES ----------
    const Utils = {
        log(message, type = 'info', feature = 'General') {
            if (!settings?.isNotifyEnabled()) return;
            const prefix = `[RES Ultimate v4 - ${feature}]`;
            const styles = {
                info: 'color: #FF4500',
                success: 'color: #24A0ED',
                warning: 'color: #FF8717',
                error: 'color: #EA0027'
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

        throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        batchProcess(items, processor, batchSize = CONFIG.BATCH_SIZE) {
            const batches = [];
            for (let i = 0; i < items.length; i += batchSize) {
                batches.push(items.slice(i, i + batchSize));
            }
            return batches.reduce((promise, batch) =>
                promise.then(() => Promise.all(batch.map(processor))),
                Promise.resolve()
            );
        },

        isVisible(element) {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 &&
                   rect.top < window.innerHeight && rect.bottom > 0;
        },

        safeQuerySelectorAll(selectors) {
            const elements = new Set();
            const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

            selectorArray.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => elements.add(el));
                } catch (e) {
                    // Invalid selector, skip
                }
            });

            return Array.from(elements);
        }
    };

    // ---------- COOKIE MANAGER ----------
    class CookieManager {
        constructor() {
            this.cookiesSet = false;
        }

        setOver18Cookie() {
            if (this.cookiesSet || typeof GM_cookie === 'undefined') return;

            CONFIG.COOKIE_DOMAINS.forEach(domain => {
                try {
                    GM_cookie.set({
                        name: 'over18',
                        value: 'true',
                        domain: domain,
                        path: '/',
                        httpOnly: false,
                        secure: true,
                        sameSite: 'Lax'
                    });
                    Utils.log(`Cookie set for ${domain}`, 'success', 'Cookie');
                } catch (error) {
                    Utils.log(`Cookie error: ${error.message}`, 'error', 'Cookie');
                }
            });
            this.cookiesSet = true;
        }

        init() {
            this.setOver18Cookie();
        }
    }

    // ---------- ENHANCED BLUR REMOVER ----------
    class EnhancedBlurRemover {
        constructor() {
            this.processedElements = new WeakSet();
            this.stats = { processed: 0, failed: 0 };
        }

        removeAllBlurs() {
            // Remove blur from any element with blur styles
            const blurredElements = document.querySelectorAll('[style*="blur"]');
            let count = 0;

            blurredElements.forEach(element => {
                if (this.processedElements.has(element)) return;

                const style = element.getAttribute('style');
                if (style) {
                    const newStyle = style
                        .replace(/filter:\s*blur\([^)]+\)/gi, '')
                        .replace(/backdrop-filter:\s*blur\([^)]+\)/gi, '');
                    element.setAttribute('style', newStyle);
                    this.processedElements.add(element);
                    count++;
                }
            });

            // Handle blurred containers
            const containers = Utils.safeQuerySelectorAll(CONFIG.SELECTORS.NSFW_ELEMENTS);
            containers.forEach(container => {
                if (this.processedElements.has(container)) return;

                // Try multiple unblur methods
                if (container.isNsfwAllowed !== undefined) {
                    container.isNsfwAllowed = true;
                }

                if (container.handleClick && typeof container.handleClick === 'function') {
                    try {
                        container.handleClick();
                    } catch (e) {}
                }

                // Force display changes
                if (container.style) {
                    container.style.display = 'none';
                }

                // Remove element if it's a modal/overlay
                if (container.tagName && container.tagName.includes('MODAL')) {
                    container.remove();
                }

                this.processedElements.add(container);
                count++;
            });

            if (count > 0) {
                this.stats.processed += count;
                Utils.log(`Processed ${count} blurred elements (total: ${this.stats.processed})`, 'success', 'Blur');
            }

            return count;
        }

        getStats() {
            return { ...this.stats };
        }
    }

    // ---------- ENHANCED OVERLAY REMOVER ----------
    class EnhancedOverlayRemover {
        constructor() {
            this.removedElements = new WeakSet();
            this.stats = { removed: 0 };
        }

        removeAllOverlays() {
            const overlays = Utils.safeQuerySelectorAll([
                ...CONFIG.SELECTORS.NSFW_ELEMENTS,
                ...CONFIG.SELECTORS.PROMO,
                '[role="dialog"]',
                '.modal-backdrop',
                '[class*="modal"][class*="overlay"]'
            ]);

            let count = 0;
            overlays.forEach(overlay => {
                if (this.removedElements.has(overlay)) return;

                overlay.remove();
                this.removedElements.add(overlay);
                count++;
            });

            if (count > 0) {
                this.stats.removed += count;
                Utils.log(`Removed ${count} overlays (total: ${this.stats.removed})`, 'success', 'Overlay');
            }

            return count;
        }

        getStats() {
            return { ...this.stats };
        }
    }

    // ---------- GAMES SECTION REMOVER ----------
    class GamesSectionRemover {
        constructor() {
            this.removed = false;
        }

        removeGames() {
            const gameElements = Utils.safeQuerySelectorAll(CONFIG.SELECTORS.GAMES);
            let count = 0;

            gameElements.forEach(element => {
                element.style.display = 'none';
                element.remove();
                count++;
            });

            if (count > 0) {
                Utils.log(`Removed ${count} games elements`, 'success', 'Games');
                this.removed = true;
            }

            return count;
        }

        injectStyles() {
            const styleId = 'ultimate-games-style';
            if (document.getElementById(styleId)) return;

            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                ${CONFIG.SELECTORS.GAMES.join(', ')} {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    overflow: hidden !important;
                }
            `;

            (document.head || document.documentElement).appendChild(style);
            Utils.log('Games removal styles injected', 'info', 'Games');
        }

        init() {
            this.injectStyles();
            this.removeGames();
        }
    }

    // ---------- ENHANCED SIDEBAR REMOVER ----------
    class EnhancedSidebarRemover {
        constructor() {
            this.observer = null;
        }

        removeSidebar() {
            const elements = Utils.safeQuerySelectorAll(CONFIG.SELECTORS.SIDEBAR);
            elements.forEach(element => {
                element.style.display = 'none';
                element.remove();
            });
            return elements.length;
        }

        injectStyles() {
            const styleId = 'ultimate-sidebar-style';
            if (document.getElementById(styleId)) return;

            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                ${CONFIG.SELECTORS.SIDEBAR.join(', ')} {
                    display: none !important;
                    visibility: hidden !important;
                }

                ${CONFIG.SELECTORS.LAYOUT.FEED},
                ${CONFIG.SELECTORS.LAYOUT.CONTENT_WRAPPER} {
                    grid-template-columns: 1fr !important;
                    width: 100% !important;
                    max-width: 100% !important;
                }

                .main-container .main-content {
                    width: 100% !important;
                    max-width: 100% !important;
                }

                /* Full width for content area */
                [class*="col-span"] {
                    max-width: 100% !important;
                    flex-basis: 100% !important;
                }
            `;

            (document.head || document.documentElement).appendChild(style);
        }

        setupObserver() {
            this.observer = new MutationObserver(Utils.throttle(() => this.removeSidebar(), 500));

            const startObserving = () => {
                if (document.body) {
                    this.observer.observe(document.body, { childList: true, subtree: true });
                } else {
                    setTimeout(startObserving, 50);
                }
            };
            startObserving();
        }

        init() {
            this.injectStyles();
            this.removeSidebar();
            this.setupObserver();
        }

        destroy() {
            this.observer?.disconnect();
        }
    }

    // ---------- ENHANCED REPLY EXPANDER ----------
    class EnhancedReplyExpander {
        constructor() {
            this.processedButtons = new WeakSet();
            this.isProcessing = false;
            this.stats = { clicked: 0 };
            this.observer = null;
        }

        findShowRepliesButtons() {
            const buttons = new Set();

            // Find by selectors
            CONFIG.REPLY_SELECTORS.forEach(selector => {
                Utils.safeQuerySelectorAll(selector).forEach(el => buttons.add(el));
            });

            // Find by text content
            document.querySelectorAll('button, a').forEach(btn => {
                const text = (btn.textContent || '').toLowerCase();
                if ((text.includes('show') && text.includes('repl')) ||
                    text.includes('view more') ||
                    text.includes('load more')) {
                    if (!this.processedButtons.has(btn)) {
                        buttons.add(btn);
                    }
                }
            });

            return Array.from(buttons).filter(btn => Utils.isVisible(btn));
        }

        async clickButton(button) {
            if (!button || this.processedButtons.has(button)) return false;

            try {
                this.processedButtons.add(button);
                button.scrollIntoView({ behavior: 'instant', block: 'center' });
                button.click();
                this.stats.clicked++;
                return true;
            } catch (err) {
                return false;
            }
        }

        async expandAllReplies() {
            if (this.isProcessing) return;
            this.isProcessing = true;

            try {
                const buttons = this.findShowRepliesButtons();
                let clickCount = 0;

                for (const button of buttons) {
                    if (clickCount >= CONFIG.MAX_CLICKS_PER_RUN) break;

                    if (await this.clickButton(button)) {
                        clickCount++;
                        if (CONFIG.CLICK_DELAY_MS > 0) {
                            await new Promise(resolve => setTimeout(resolve, CONFIG.CLICK_DELAY_MS));
                        }
                    }
                }

                if (clickCount > 0) {
                    Utils.log(`Clicked ${clickCount} buttons (total: ${this.stats.clicked})`, 'success', 'Replies');
                }
            } finally {
                this.isProcessing = false;
            }
        }

        setupObserver() {
            const debouncedExpand = Utils.debounce(() => this.expandAllReplies(), CONFIG.OBSERVER_DEBOUNCE_MS);

            this.observer = new MutationObserver(mutations => {
                if (mutations.some(m => m.addedNodes.length > 0)) {
                    debouncedExpand();
                }
            });

            this.observer.observe(document.body, { childList: true, subtree: true });
        }

        init() {
            this.expandAllReplies();
            this.setupObserver();

            // Periodic check
            setInterval(() => {
                if (!this.isProcessing) this.expandAllReplies();
            }, CONFIG.PERIODIC_CHECK_INTERVAL);
        }

        destroy() {
            this.observer?.disconnect();
        }

        getStats() {
            return { ...this.stats };
        }
    }

    // ---------- SCROLL FIXER ----------
    class ScrollFixer {
        fix() {
            const body = document.body;
            if (!body) return;

            // Remove scroll blocking styles
            const style = body.getAttribute('style');
            if (style) {
                const newStyle = style
                    .replace(/overflow:\s*hidden/gi, '')
                    .replace(/pointer-events:\s*none/gi, '')
                    .replace(/position:\s*fixed/gi, '');
                body.setAttribute('style', newStyle);
            }

            // Ensure scrolling is enabled
            body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
        }
    }

    // ---------- SETTINGS MANAGER ----------
    class SettingsManager {
        constructor() {
            this.settings = {
                autoUnblur: GM_getValue(CONFIG.STORAGE_KEYS.AUTO_UNBLUR, true),
                removePrompts: GM_getValue(CONFIG.STORAGE_KEYS.REMOVE_PROMPTS, true),
                fixScroll: GM_getValue(CONFIG.STORAGE_KEYS.FIX_SCROLL, true),
                autoExpandReplies: GM_getValue(CONFIG.STORAGE_KEYS.AUTO_EXPAND_REPLIES, true),
                removeSidebar: GM_getValue(CONFIG.STORAGE_KEYS.REMOVE_SIDEBAR, true),
                removeGames: GM_getValue(CONFIG.STORAGE_KEYS.REMOVE_GAMES, true),
                notify: GM_getValue(CONFIG.STORAGE_KEYS.NOTIFY, false),
                aggressiveMode: GM_getValue(CONFIG.STORAGE_KEYS.AGGRESSIVE_MODE, true)
            };
        }

        get(key) {
            return this.settings[key];
        }

        toggle(key) {
            this.settings[key] = !this.settings[key];
            const storageKey = Object.entries(CONFIG.STORAGE_KEYS)
                .find(([k, v]) => k.toLowerCase().replace(/_/g, '') === key.toLowerCase())?.[1];
            if (storageKey) {
                GM_setValue(storageKey, this.settings[key]);
            }
            return this.settings[key];
        }

        isAutoUnblurEnabled() { return this.settings.autoUnblur; }
        isRemovePromptsEnabled() { return this.settings.removePrompts; }
        isFixScrollEnabled() { return this.settings.fixScroll; }
        isAutoExpandRepliesEnabled() { return this.settings.autoExpandReplies; }
        isRemoveSidebarEnabled() { return this.settings.removeSidebar; }
        isRemoveGamesEnabled() { return this.settings.removeGames; }
        isNotifyEnabled() { return this.settings.notify; }
        isAggressiveModeEnabled() { return this.settings.aggressiveMode; }
    }

    // ---------- MENU MANAGER ----------
    class MenuManager {
        constructor(app) {
            this.app = app;
            this.menuIds = {};
            this.registerCommands();
        }

        registerCommands() {
            // Clear existing commands
            Object.values(this.menuIds).forEach(id => {
                try { GM_unregisterMenuCommand(id); } catch (e) {}
            });
            this.menuIds = {};

            const s = this.app.settings;

            // Feature toggles
            this.registerToggle('🔓 Auto-Unblur', 'autoUnblur');
            this.registerToggle('🚫 Remove Prompts', 'removePrompts');
            this.registerToggle('📜 Fix Scroll', 'fixScroll');
            this.registerToggle('💬 Auto-Expand Replies', 'autoExpandReplies');
            this.registerToggle('🧱 Remove Sidebar', 'removeSidebar');
            this.registerToggle('🎮 Remove Games Section', 'removeGames');
            this.registerToggle('⚡ Aggressive Mode', 'aggressiveMode');
            this.registerToggle('🔔 Notifications', 'notify');

            GM_registerMenuCommand('───────────────', () => {});

            // Actions
            this.menuIds.processNow = GM_registerMenuCommand(
                '▶️ Process Page Now',
                () => this.app.processPage(true)
            );

            this.menuIds.stats = GM_registerMenuCommand(
                '📊 Show Statistics',
                () => this.showStats()
            );
        }

        registerToggle(label, key) {
            const isEnabled = this.app.settings.get(key);
            this.menuIds[key] = GM_registerMenuCommand(
                `${label}: ${isEnabled ? 'ON ✓' : 'OFF ✗'}`,
                () => {
                    this.app.settings.toggle(key);
                    this.registerCommands();
                    Utils.log(`${label} ${this.app.settings.get(key) ? 'enabled' : 'disabled'}`, 'success', 'Settings');
                    if (key !== 'notify') {
                        this.app.processPage(true);
                    }
                }
            );
        }

        showStats() {
            const stats = {
                blur: this.app.blurRemover.getStats(),
                overlay: this.app.overlayRemover.getStats(),
                replies: this.app.replyExpander.getStats()
            };

            alert(`Reddit Enhancement Suite Ultimate v4 Statistics:\n\n` +
                  `Blurred Elements Processed: ${stats.blur.processed}\n` +
                  `Overlays Removed: ${stats.overlay.removed}\n` +
                  `Reply Buttons Clicked: ${stats.replies.clicked}\n\n` +
                  `Active Features:\n` +
                  `${Object.entries(this.app.settings.settings)
                    .map(([k, v]) => `• ${k}: ${v ? 'ON' : 'OFF'}`)
                    .join('\n')}`);
        }
    }

    // ---------- MAIN APPLICATION ----------
    class RedditEnhancementSuite {
        constructor() {
            this.settings = new SettingsManager();
            this.cookieManager = new CookieManager();
            this.blurRemover = new EnhancedBlurRemover();
            this.overlayRemover = new EnhancedOverlayRemover();
            this.scrollFixer = new ScrollFixer();
            this.replyExpander = new EnhancedReplyExpander();
            this.sidebarRemover = new EnhancedSidebarRemover();
            this.gamesRemover = new GamesSectionRemover();
            this.menuManager = null;
            this.observer = null;
            this.processCount = 0;
        }

        init() {
            Utils.log('Initializing v4...', 'info', 'Main');

            // Initialize components
            this.cookieManager.init();

            if (this.settings.isRemoveSidebarEnabled()) {
                this.sidebarRemover.init();
            }

            if (this.settings.isRemoveGamesEnabled()) {
                this.gamesRemover.init();
            }

            // Initial processing
            this.processPage();

            // Setup observers
            this.setupObserver();

            // Initialize reply expander after DOM ready
            if (this.settings.isAutoExpandRepliesEnabled()) {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => this.replyExpander.init());
                } else {
                    this.replyExpander.init();
                }
            }

            // Setup menu
            this.menuManager = new MenuManager(this);

            Utils.log('Initialization complete', 'success', 'Main');
        }

        setupObserver() {
            const processDebounced = Utils.debounce(() => this.processPage(), CONFIG.CHECK_INTERVAL);

            this.observer = new MutationObserver(mutations => {
                // Quick check for relevant changes
                const hasRelevantChanges = mutations.some(m =>
                    m.addedNodes.length > 0 ||
                    (m.type === 'attributes' && m.attributeName === 'style')
                );

                if (hasRelevantChanges) {
                    processDebounced();
                }
            });

            const startObserving = () => {
                const target = document.body || document.documentElement;
                if (target) {
                    this.observer.observe(target, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['style', 'class']
                    });
                } else {
                    setTimeout(startObserving, 50);
                }
            };

            startObserving();
        }

        processPage(force = false) {
            this.processCount++;

            // Batch processing for better performance
            const tasks = [];

            if (this.settings.isFixScrollEnabled()) {
                tasks.push(() => this.scrollFixer.fix());
            }

            if (this.settings.isAutoUnblurEnabled()) {
                tasks.push(() => this.blurRemover.removeAllBlurs());
            }

            if (this.settings.isRemovePromptsEnabled()) {
                tasks.push(() => this.overlayRemover.removeAllOverlays());
            }

            if (this.settings.isRemoveSidebarEnabled()) {
                tasks.push(() => this.sidebarRemover.removeSidebar());
            }

            if (this.settings.isRemoveGamesEnabled()) {
                tasks.push(() => this.gamesRemover.removeGames());
            }

            // Execute tasks
            if (this.settings.isAggressiveModeEnabled() || force) {
                tasks.forEach(task => task());
            } else {
                // Throttled execution in non-aggressive mode
                tasks.forEach((task, index) => {
                    setTimeout(task, index * 10);
                });
            }
        }

        destroy() {
            Utils.log('Shutting down...', 'info', 'Main');
            this.observer?.disconnect();
            this.replyExpander?.destroy();
            this.sidebarRemover?.destroy();
        }
    }

    // ---------- INITIALIZATION ----------
    let settings = null;
    const app = new RedditEnhancementSuite();
    settings = app.settings;

    // Initialize on appropriate timing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => app.init());
    } else {
        app.init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => app.destroy());

    // Expose for debugging
    window.RedditEnhancementSuiteV4 = app;

})();