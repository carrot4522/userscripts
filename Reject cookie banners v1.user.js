// ==UserScript==
// @name         Reject cookie banners v1
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Automatically rejects cookies and legitimate interest. Optimized with better performance, error handling, and modern code practices.
// @author       https://greasyfork.org/en/users/85040-d-a-n (optimized)
// @license      MIT
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/519050/Reject%20cookie%20banners.user.js
// @updateURL https://update.greasyfork.org/scripts/519050/Reject%20cookie%20banners.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // ---------- CONFIGURATION ----------
    const CONFIG = {
        CHECK_INTERVAL_MS: 200,
        ACTIVE_DURATION_MS: 30000, // Stop checking after 30 seconds
        TOGGLE_WAIT_MS: 2000,
        ELEMENT_WAIT_MS: 10,
        MAX_RETRIES: 3,
        LOG_ENABLED: false,
    };

    // ---------- STATE ----------
    const state = {
        bannerSeenCount: new Map(),
        endTime: Date.now() + CONFIG.ACTIVE_DURATION_MS,
        isActive: true,
        processedBanners: new WeakSet(),
        stats: {
            bannersFound: 0,
            bannersRejected: 0,
            bannersRemoved: 0,
        }
    };

    // ---------- UTILITIES ----------
    const log = (...args) => {
        if (CONFIG.LOG_ENABLED) {
            console.log('[Cookie Rejector v1]', ...args);
        }
    };

    const logError = (...args) => {
        console.error('[Cookie Rejector v1]', ...args);
    };

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function getShadowRootOrElement(element) {
        return element?.shadowRoot || element;
    }

    // ---------- BANNER DEFINITIONS ----------
    const BANNER_RULES = [
        // Common - Fundingchoices (Google)
        {
            name: 'Fundingchoices',
            banner: 'body > .fc-consent-root',
            btn: 'button[aria-label^="Manage"] > p',
            onBtnFound: (btn) => btn.innerHTML.match(/^Manage options$/) && btn,
            toggles: '.fc-preference-slider input[aria-label^="Consent"]:checked, .fc-preference-slider input[aria-label^="Legitimate interest"]:checked',
            confirm: 'button[aria-label^="Confirm"] p',
            onConfirmFound: (btn) => btn.innerHTML.match(/^Confirm choices$/) && btn,
        },

        // Quantcast
        {
            name: 'Quantcast',
            banner: 'body > .qc-cmp2-container',
            btn: '.qc-cmp2-summary-buttons > button[mode="secondary"][size="large"] > span',
            onBtnFound: (btn) => btn.innerHTML.match(/^MORE OPTIONS$/) && btn,
            toggles: [
                {query: '.qc-cmp2-header-links > button[mode="link"][size="small"]', htmlMatch: /^REJECT ALL$/},
                {query: '.qc-cmp2-footer-links > button[mode="link"][size="small"]', htmlMatch: /^LEGITIMATE INTEREST$/},
                {query: '.qc-cmp2-header-links > button[mode="link"][size="small"]', htmlMatch: /^OBJECT ALL$/}
            ],
            confirm: '.qc-cmp2-footer-links + .qc-cmp2-buttons-desktop button[mode="primary"][size="large"]',
            onConfirmFound: (btn) => btn.innerHTML.match(/^SAVE &amp; EXIT$/) && btn,
        },

        // OneTrust (StackExchange sites)
        {
            name: 'OneTrust',
            banner: 'body > #onetrust-consent-sdk',
            btn: '[aria-label="Cookie banner"] #onetrust-reject-all-handler',
        },

        // Fandom
        {
            name: 'Fandom',
            banner: 'body > div:has(div[data-tracking-opt-in-overlay])',
            btn: 'div[data-tracking-opt-in-learn-more]',
            onBtnFound: (btn) => btn.innerHTML.match(/^LEARN MORE$/) && btn,
            toggles: [
                {query: 'div[class]', htmlMatch: /^\s*Show Preferences\s*<svg\s+/, queryAll: true},
                {
                    query: 'input[id^="switch"][type="checkbox"]:checked',
                    htmlMatch: /(^$|.)/,
                    queryAll: true,
                    onToggleFound: (toggle) => {
                        while (toggle.checked) {
                            toggle.click();
                        }
                    }
                }
            ],
            confirm: 'div[data-tracking-opt-in-save]',
            onConfirmFound: (btn) => btn.innerHTML.match(/^Save And Close$/) && btn,
        },

        // Ubuntu Forums
        {
            name: 'Ubuntu',
            banner: 'body > dialog.cookie-policy[open="true"]',
            btn: '#cookie-policy-content button',
            onBtnFound: (btn) => btn.innerHTML.match(/^Manage your tracker settings$/) && btn,
            toggles: '#controls input[type="checkbox"]:checked',
            confirm: 'button',
            onConfirmFound: (btn) => btn.innerHTML.match(/^Save preferences$/) && btn,
        },

        // BBC
        {
            name: 'BBC',
            banner: 'section[aria-labelledby="consent-banner-title"]',
            btn: 'div[class*="Options"] button',
            onBtnFound: (btn) => btn.innerHTML.match(/^Reject additional cookies$/) && btn,
        },

        // Weather sites
        {
            name: 'Weather Generic',
            banner: 'body > div#ccc[aria-label="Cookie preferences"]',
            toggles: [
                {query: 'input[type="checkbox"]:checked', htmlMatch: /(^$|.)/, queryAll: true}
            ],
            confirm: 'button#ccc-dismiss-button span',
            onConfirmFound: (btn) => btn.innerHTML.match(/^Save Preferences and Exit$/) && btn,
        },
        {
            name: 'Weather CMP',
            banner: 'body > .cmpwrapper',
            btn: 'div#cmpbox > div.cmpboxinner > div.cmpboxbtns > div.cmpmore > a.cmpmorelink.cmptxt_btn_custom',
            toggles: null,
            confirm: 'div#cmpbox > div.cmpboxinner > div.cmpboxbtnscustomchoices > a.cmpboxbtn.cmpboxbtnreject.cmpboxbtnrejectcustomchoices.cmptxt_btn_no',
        },

        // Facebook
        {
            name: 'Facebook',
            banner: 'body > div:has(> div + div[role="dialog"][aria-labelledby="manage_cookies_title"])',
            btn: 'div[aria-label="Decline optional cookies"][role="button"]',
        },

        // Streaming services
        {
            name: '4od/UKTV',
            banner: 'body > #cookie-consent-banner',
            btn: 'button[aria-label="Manage which purposes to accept cookies for."]',
            toggles: [
                {
                    query: '[class$="cc-popup-absolute"] > [class$="__component"] > [class$="__header"] + [class*="__content-area"] > [class$="cc-accordion-container"] [class$="cc-accordion-item--header"] [role="switch"][aria-checked="true"]',
                    htmlMatch: /(^$|.)/,
                    queryAll: true
                }
            ],
            confirm: 'button[aria-label="Save cookie preferences and continue"]',
        },
        {
            name: 'ITV',
            banner: 'body > [class*="cookie-widget"][role="dialog"]:has([aria-label="Cookie Preferences"])',
            btn: '.cassie-pre-banner button#cassie-cookie-modal-manage-button',
            toggles: '.cassie-cookie-modal[role="dialog region"][aria-modal="true"] #cassie_consent_tab_cookies .cassie-cookie-modal--group-head-container .cassie-toggle-switch[role="switch"][aria-checked="true"]',
            confirm: 'button[aria-label="Save & close"]',
        },

        // UK Supermarkets - Tesco
        {
            name: 'Tesco Banner',
            banner: 'body div[data-mfe="mfe-header"] div[class*="mfe-header"]',
            btn: 'div[class*="consent-banner__buttons-container"] button',
            onBtnFound: (btn) => btn.innerHTML.match(/[>]\s*Reject all<\/span>$/) && btn,
        },
        {
            name: 'Tesco Manage',
            banner: 'body > #__tealiumGDPRecModal:has(.privacy_prompt_fadeout + .privacy_prompt_centre .privacy_prompt_footer)',
            btn: '#privacy-more-information.button',
            onBtnFound: (btn) => btn.innerHTML.match(/[>]\s*Manage Cookies<\/span>\s*$/) && btn,
        },
        {
            name: 'Tesco Preferences',
            banner: 'body > #__tealiumGDPRcpPrefs:has(.privacy_prompt_fadeout + .categories_centre .consent_preferences .privacy_prompt_content)',
            toggles: '.table-wrapper table tr input.toggle[type="checkbox"]:checked',
            confirm: '#preferences_prompt_submit.button',
            onConfirmFound: (btn) => btn.innerHTML.match(/[>]\s*Save preferences<\/span>\s*$/) && btn,
        }
    ];

    // ---------- BANNER HANDLER ----------
    class BannerHandler {
        constructor(rule) {
            this.rule = rule;
        }

        getBanner() {
            try {
                const banner = document.querySelector(this.rule.banner);

                if (typeof this.rule.onBannerFound === 'function') {
                    return this.rule.onBannerFound(banner);
                }

                return banner;
            } catch (error) {
                logError(`Error getting banner for ${this.rule.name}:`, error);
                return null;
            }
        }

        async getButton() {
            const fakeBtn = { click: () => {} };

            if (!this.rule.btn) {
                return fakeBtn;
            }

            const banner = this.getBanner();
            if (!banner) {
                return fakeBtn;
            }

            try {
                const shadowOrBanner = getShadowRootOrElement(banner);

                if (typeof this.rule.onBtnFound === 'function') {
                    const btns = shadowOrBanner.querySelectorAll(this.rule.btn);
                    for (const btn of btns) {
                        const result = this.rule.onBtnFound(btn);
                        if (result) return result;
                    }
                } else {
                    const btn = shadowOrBanner.querySelector(this.rule.btn);
                    if (btn) return btn;
                }

                await sleep(CONFIG.ELEMENT_WAIT_MS);
                return await this.getButton();
            } catch (error) {
                logError(`Error getting button for ${this.rule.name}:`, error);
                return fakeBtn;
            }
        }

        async clickToggle(toggleItemNo = 0) {
            if (!Array.isArray(this.rule.toggles) || toggleItemNo >= this.rule.toggles.length) {
                return;
            }

            const toggleItem = this.rule.toggles[toggleItemNo];
            let banner = this.getBanner();

            if (!banner) return;

            try {
                if (toggleItem.htmlMatch) {
                    if (toggleItem.queryAll) {
                        await sleep(CONFIG.TOGGLE_WAIT_MS);
                        banner = this.getBanner();
                    }

                    const shadowOrBanner = getShadowRootOrElement(banner);
                    const toggles = shadowOrBanner.querySelectorAll(toggleItem.query);

                    for (const toggle of toggles) {
                        if (toggle.innerHTML.match(toggleItem.htmlMatch)) {
                            if (typeof toggleItem.onToggleFound === 'function') {
                                await toggleItem.onToggleFound(toggle, this.rule, toggleItemNo);
                            } else {
                                toggle.click();
                            }

                            if (!toggleItem.queryAll) break;
                        }
                    }

                    return await this.clickToggle(toggleItemNo + 1);
                } else {
                    const shadowOrBanner = getShadowRootOrElement(banner);
                    const toggle = shadowOrBanner.querySelector(toggleItem.query);

                    if (toggle) {
                        toggle.click();
                        return await this.clickToggle(toggleItemNo + 1);
                    }
                }

                await sleep(CONFIG.ELEMENT_WAIT_MS);
                await this.clickToggle(toggleItemNo);
            } catch (error) {
                logError(`Error clicking toggle for ${this.rule.name}:`, error);
            }
        }

        async getConfirmButton() {
            const banner = this.getBanner();
            if (!banner) return null;

            try {
                const shadowOrBanner = getShadowRootOrElement(banner);

                if (typeof this.rule.onConfirmFound === 'function') {
                    const btns = shadowOrBanner.querySelectorAll(this.rule.confirm);
                    for (const btn of btns) {
                        const result = this.rule.onConfirmFound(btn);
                        if (result) return result;
                    }
                } else {
                    const btn = shadowOrBanner.querySelector(this.rule.confirm);
                    if (btn) return btn;
                }

                if (typeof this.rule.toggles === 'string') {
                    await this.clickToggle(0);
                }

                await sleep(CONFIG.ELEMENT_WAIT_MS);
                return await this.getConfirmButton();
            } catch (error) {
                logError(`Error getting confirm button for ${this.rule.name}:`, error);
                return null;
            }
        }

        async process() {
            const banner = this.getBanner();
            if (!banner) return;

            // Track how many times we've seen this banner
            const bannerKey = this.rule.banner;
            const seenCount = state.bannerSeenCount.get(bannerKey) || 0;

            if (seenCount > CONFIG.MAX_RETRIES) {
                log(`Removing persistent banner: ${this.rule.name}`);
                banner.remove();
                state.stats.bannersRemoved++;
                return;
            }

            state.bannerSeenCount.set(bannerKey, seenCount + 1);

            try {
                log(`Processing banner: ${this.rule.name}`);
                state.stats.bannersFound++;

                const btn = await this.getButton();
                const togglesIsString = typeof this.rule.toggles === 'string';
                const togglesIsArray = Array.isArray(this.rule.toggles);

                if (this.rule.toggles === null || togglesIsString || togglesIsArray) {
                    btn.click();

                    if (togglesIsString) {
                        const shadowOrBanner = getShadowRootOrElement(banner);
                        shadowOrBanner.querySelectorAll(this.rule.toggles).forEach(toggle => {
                            toggle.click();
                        });
                    } else if (togglesIsArray) {
                        await this.clickToggle(0);
                    }

                    if (!this.rule.DONT_CLOSE) {
                        const confirmBtn = await this.getConfirmButton();
                        if (confirmBtn) {
                            confirmBtn.click();
                        }
                    }
                } else {
                    if (document.cookie) {
                        btn.click();
                    }

                    if (!this.rule.DONT_CLOSE) {
                        const currentBanner = this.getBanner();
                        if (currentBanner) {
                            currentBanner.outerHTML = '';
                        }
                    }
                }

                state.stats.bannersRejected++;
                log(`Successfully processed: ${this.rule.name}`);
            } catch (error) {
                logError(`Error processing ${this.rule.name}:`, error);
            }
        }
    }

    // ---------- MAIN PROCESSOR ----------
    class CookieRejector {
        constructor() {
            this.handlers = BANNER_RULES.map(rule => new BannerHandler(rule));
            this.checkTimer = null;
        }

        async processAll() {
            if (!state.isActive || Date.now() > state.endTime) {
                this.stop();
                return;
            }

            for (const handler of this.handlers) {
                try {
                    await handler.process();
                } catch (error) {
                    logError('Error processing handler:', error);
                }
            }

            this.checkTimer = setTimeout(() => this.processAll(), CONFIG.CHECK_INTERVAL_MS);
        }

        start() {
            log('Cookie rejector started');
            this.processAll();
        }

        stop() {
            if (this.checkTimer) {
                clearTimeout(this.checkTimer);
                this.checkTimer = null;
            }
            state.isActive = false;
            log('Cookie rejector stopped', state.stats);
        }
    }

    // ---------- INITIALIZATION ----------
    const rejector = new CookieRejector();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => rejector.start());
    } else {
        rejector.start();
    }

    // Auto-stop after configured duration
    setTimeout(() => rejector.stop(), CONFIG.ACTIVE_DURATION_MS);

    // Expose for debugging
    if (CONFIG.LOG_ENABLED) {
        window.CookieRejector = {
            stats: state.stats,
            stop: () => rejector.stop(),
            start: () => rejector.start(),
        };
    }

})();