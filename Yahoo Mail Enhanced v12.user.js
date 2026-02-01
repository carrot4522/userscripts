// ==UserScript==
// @name         Yahoo Mail Enhanced v12
// @namespace    Yahoo Mail Enhanced v12
// @version      12
// @description  Enhanced beautification, wider layout, active account highlight, ad removal, smooth draggable modals, improved smart search, refresh button, email analytics, and total unread counter across all accounts for Yahoo Mail
// @author       You
// @match        https://mail.yahoo.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=yahoo.com
// @grant        GM_addStyle
// @grant        GM_notification
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Yahoo Mail Ultimate v12] Initializing with total unread counter across all accounts...');

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        DEBOUNCE_DELAY: 150,
        RESIZE_DEBOUNCE: 200,
        CHECK_INTERVAL: 2000,
        UNREAD_CHECK_INTERVAL: 3000,
        FEATURES: {
            unreadCounter: true,
            quickArchive: true,
            keyboardShortcuts: true,
            autoRefresh: false,
            compactMode: false,
            darkModeToggle: true
        }
    };

    // ==================== STATE MANAGEMENT ====================
    const state = {
        unreadCount: 0,
        isDarkMode: localStorage.getItem('yahoo-dark-mode') === 'true',
        isCompactMode: localStorage.getItem('yahoo-compact-mode') === 'true',
        lastUnreadCount: -1,
        observers: new Set(),
        unreadObserver: null
    };

    // ==================== CORE BEAUTIFICATION STYLES ====================
    const applyBeautificationStyles = () => {
        GM_addStyle(`
            /* Banner and Navigation */
            [role="banner"] {
                height: 60px !important;
            }
            [role="navigation"] {
                display: none;
            }

            /* Scrollbar Styling */
            [data-test-id="left-rail-scrolling-container"],
            [data-test-id="virtual-list"] {
                scrollbar-color: rgba(0,0,0,0.5) transparent;
                scrollbar-width: thin;
            }

            /* Hide Unnecessary Elements */
            [data-test-id="right-rail-hidead-btn"],
            [data-test-id="settings-link-label"] {
                display: none !important;
            }

            /* Yahoo Logo Background */
            [data-test-id="mail-reader"][data-test-preview="1"] [data-test-id="virtual-list"] li:not(:has([data-test-id="message-list-item"], [data-test-id="time-chunk-separator"], [data-test-id="loading_indicator"])) {
                background: url(https://s.yimg.com/nq/nr/img/yahoo_mail_global_english_white_1x.png) no-repeat center rgba(0,0,0,0.2);
                height: 64px !important;
                margin-top: 4px;
            }

            /* Unread Counter Badge - Total across all accounts */
            #yahoo-unread-counter {
                position: fixed;
                top: 15px;
                right: 200px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 700;
                font-size: 14px;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                z-index: 9998;
                cursor: move;
                transition: box-shadow 0.3s ease, transform 0.1s ease;
                display: none;
                min-width: 80px;
                text-align: center;
                user-select: none;
            }
            #yahoo-unread-counter:hover {
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }
            #yahoo-unread-counter.dragging {
                transform: scale(1.05);
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.8);
            }
            #yahoo-unread-counter.show {
                display: block;
                animation: slideIn 0.3s ease;
            }
            #yahoo-unread-counter.has-new {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
            @keyframes slideIn {
                from {
                    transform: translateX(100px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            /* Quick Action Buttons */
            .yahoo-quick-actions {
                position: fixed;
                bottom: 80px;
                right: 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 9999;
            }
            .yahoo-quick-btn {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                border: none;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                font-size: 20px;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .yahoo-quick-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }
            .yahoo-quick-btn:active {
                transform: scale(0.95);
            }

            /* Compact Mode */
            body.compact-mode [data-test-id="message-list-item"] {
                padding: 4px 8px !important;
                min-height: 40px !important;
            }
            body.compact-mode [data-test-id="message-list-item"] * {
                font-size: 12px !important;
                line-height: 1.3 !important;
            }

            /* Dark Mode */
            body.dark-mode {
                background: #1a1a1a !important;
                color: #e0e0e0 !important;
            }
            body.dark-mode [data-test-id="mail-app-container"] {
                background: #2a2a2a !important;
                color: #e0e0e0 !important;
            }
            body.dark-mode [data-test-id="message-list-item"] {
                background: #2a2a2a !important;
                border-color: #3a3a3a !important;
            }
            body.dark-mode [data-test-id="message-list-item"]:hover {
                background: #3a3a3a !important;
            }

            /* Keyboard Shortcuts Helper */
            #keyboard-shortcuts-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                z-index: 10001;
                max-width: 500px;
                display: none;
            }
            #keyboard-shortcuts-modal.show {
                display: block;
                animation: fadeIn 0.3s ease;
            }
            body.dark-mode #keyboard-shortcuts-modal {
                background: #2a2a2a;
                color: #e0e0e0;
            }
            body.dark-mode #keyboard-shortcuts-modal .shortcut-item {
                border-bottom-color: #3a3a3a;
            }
            body.dark-mode #keyboard-shortcuts-modal .key {
                background: #3a3a3a;
                color: #e0e0e0;
            }
            #keyboard-shortcuts-modal h2 {
                margin: 0 0 20px 0;
                font-size: 24px;
                color: #667eea;
            }
            #keyboard-shortcuts-modal .shortcut-item {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid #eee;
            }
            #keyboard-shortcuts-modal .key {
                background: #f5f5f5;
                padding: 4px 8px;
                border-radius: 4px;
                font-family: monospace;
                font-weight: bold;
            }
            #keyboard-shortcuts-modal .close-btn {
                margin-top: 20px;
                text-align: center;
            }
            #keyboard-shortcuts-modal .close-btn button {
                background: #667eea;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s ease;
            }
            #keyboard-shortcuts-modal .close-btn button:hover {
                background: #5568d3;
                transform: translateY(-1px);
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translate(-50%, -48%); }
                to { opacity: 1; transform: translate(-50%, -50%); }
            }

            /* Notification Toast */
            .yahoo-toast {
                position: fixed;
                top: 80px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
                z-index: 10002;
                animation: slideIn 0.3s ease;
                font-weight: 600;
            }
            .yahoo-toast.new-mail {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
        `);
    };

    // ==================== WIDER LAYOUT STYLES ====================
    const applyWiderLayoutStyles = () => {
        const cssText = `
            #Atom .iy_FF { overflow-x: auto !important; }
            #Atom :is(.H_3DVPV, .H_tQ, .H_1HK53Y, .H_ZIFfAM) { height: auto !important; }
            #Atom :is(.W_3v3uk, .W_3nHoX, .W_7iGr) { width: auto !important; }
            div[class*="bg_png_mask"]:empty { min-height: auto !important; }

            #basic-mail-app-container {
                & td[class="V_GM W_3n93F p_R o_h G_e"]:has(> a[href^="/b/settings/"]) + td > #norrin-optin { display: inline-block !important; }
                & table:has(#messageListContainer > div > #gam-iframe-basic-mail > #gpt-iframe) { height: 100vh; }
                & td:has(> div > #gam-iframe-basic-mail > #gpt-iframe),
                & #messageListContainer > div:has(> #gam-iframe-basic-mail > #gpt-iframe),
                & #norrin-optin { display: none !important; }
            }

            #mail-app-container {
                #norrin-ybar-header:has(~ &) > #ybar {
                    height: auto !important;
                    & > #ybar-inner-wrap > div._yb_yuhdug { display: none !important; }
                }
                & a[data-test-id="redirect-to-full-view-right-rail-btn"] { position: static !important; }
                & div[data-test-id="epoch-schedule-list-container"]:has(div[data-test-id="event-list-in-day-view-container"]) { overflow-y: auto !important; }
                & .message-view[data-test-expanded="true"] { overflow-x: auto; }
                & span[data-test-id="more-less-label"] { margin-right: 16px; }

                & div[data-test-id="mail-right-rail"]:has(div[data-test-id="gam-iframe"]:only-child) div:has(> div[data-test-id="gam-iframe"] > #gpt-iframe),
                & #mail-app-component div:has(> div[data-test-id="gam-iframe"] > #gpt-iframe),
                & div[data-test-id="mail-right-rail"] > div:has(> div[data-test-id="right-rail-hidead-btn"]),
                & span[data-test-id="settings-link-label"],
                & div:has(> article > a[data-test-id="bottom-sticky-pencil-ad"]),
                & div[data-test-id="contact-card"] + div[data-test-id="gam-iframe"],
                & section[role="banner"] > div[role="navigation"]:has(ul[data-test-id="tab-list"][data-test-count="0"]) {
                    display: none !important;
                }

                & #mail-app-component:has(div > div[data-test-id="gam-iframe"] > #gpt-iframe) div.H_74JI:has(> span > span.D_X) { height: 100% !important; }
                & #mail-app-component:has(+ div[data-test-id="mail-right-rail"] div[data-test-id="gam-iframe"]:only-child) { border-right: none !important; }

                & #mail-app-component:has(div[data-test-id="message-toolbar"].I_ZkbNhI.m_Z14vXdP) + div[data-test-id="mail-right-rail"]:has(div[data-test-id="gam-iframe"]:only-child) div[data-test-id="comms-properties-bar"]:not(.I_ZkbNhI.m_Z14vXdP) {
                    background-color: #fff !important;
                    border-bottom: 1px solid #e0e4e9 !important;
                    & > div > div > div[data-test-id="popover-container"] > button.cdPFi_ZkbNhI.C_ZOHqTQ {
                        fill: inherit !important; color: inherit !important;
                    }
                    & > div[data-test-id="comms-properties"] > * { fill: #979ea8 !important; color: #fff !important; }
                }

                & div[data-test-id="mail-right-rail"]:has(div[data-test-id="gam-iframe"]:only-child) div[data-test-id="comms-properties-bar"] {
                    border-left: 1px solid #e0e4e9;
                    position: absolute;
                    right: 0;
                }

                & #mail-app-component:has(+ div[data-test-id="mail-right-rail"] div[data-test-id="gam-iframe"]:only-child) div:is([data-test-id="message-toolbar"], [data-test-id="search-header"]),
                & #mail-app-component:has(+ div[data-test-id="mail-right-rail"] div[data-test-id="gam-iframe"]:only-child) > div > div > div > .compose-header div:is([data-test-id="compose-header-top-bar"], [data-test-id="container-from"]) {
                    max-width: calc(100% - var(--ywm-comms-properties-bar-width));
                }

                @media only screen and (max-width: 1400px) {
                    & div[data-test-id="message-toolbar"] button span.t_l { display: none !important; }
                }
            }
        `;
        GM_addStyle(cssText);
    };

    // ==================== ACTIVE ACCOUNT HIGHLIGHT ====================
    const applyAccountHighlightStyles = () => {
        GM_addStyle(`
            div[data-test-id="account-list"] a[data-test-is-active="true"] {
                background-color: #F3FD5C !important;
                color: #FF0000 !important;
                border-left: 4px solid #F3FD5C !important;
                padding-left: calc(var(--MdsSpacing3, 16px) - 4px) !important;
                position: relative !important;
                z-index: 1;
                font-weight: 600 !important;
            }
            div[data-test-id="account-list"] a[data-test-is-active="true"] span { color: #FF0000 !important; }
            div.folder-list a[data-test-is-active="true"] {
                background-color: initial !important;
                border-left: none !important;
                padding-left: initial !important;
                color: initial !important;
            }
            div.folder-list a[data-test-is-active="true"] span { color: initial !important; }
            li:has(> a[data-test-is-active="true"]) { background-color: transparent !important; }
        `);
    };

    // ==================== IMPROVED UNREAD COUNTER - TOTAL ACROSS ALL ACCOUNTS ====================
    const unreadCounter = {
        badge: null,
        updateTimer: null,
        isDragging: false,
        dragOffset: { x: 0, y: 0 },

        init() {
            this.badge = document.createElement('div');
            this.badge.id = 'yahoo-unread-counter';
            this.badge.textContent = 'Loading...';

            const savedPosition = this.loadPosition();
            if (savedPosition) {
                this.badge.style.left = 'auto';
                this.badge.style.right = savedPosition.right + 'px';
                this.badge.style.top = savedPosition.top + 'px';
            }

            this.makeDraggable();
            document.body.appendChild(this.badge);

            this.setupObservers();
            this.startPolling();

            setTimeout(() => this.update(), 1000);
        },

        makeDraggable() {
            this.badge.addEventListener('mousedown', (e) => {
                if (e.shiftKey || e.ctrlKey || e.altKey) {
                    const inboxLink = document.querySelector('[data-test-folder-name="Inbox"]');
                    if (inboxLink) {
                        inboxLink.click();
                        this.showToast('Opening Inbox...');
                    }
                    return;
                }

                this.isDragging = true;
                this.badge.classList.add('dragging');

                const rect = this.badge.getBoundingClientRect();
                this.dragOffset.x = e.clientX - rect.left;
                this.dragOffset.y = e.clientY - rect.top;

                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!this.isDragging) return;

                e.preventDefault();

                const newX = e.clientX - this.dragOffset.x;
                const newY = e.clientY - this.dragOffset.y;

                const maxX = window.innerWidth - this.badge.offsetWidth;
                const maxY = window.innerHeight - this.badge.offsetHeight;

                const finalX = Math.max(0, Math.min(newX, maxX));
                const finalY = Math.max(0, Math.min(newY, maxY));

                const rightPos = window.innerWidth - finalX - this.badge.offsetWidth;

                this.badge.style.left = 'auto';
                this.badge.style.right = rightPos + 'px';
                this.badge.style.top = finalY + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (this.isDragging) {
                    this.isDragging = false;
                    this.badge.classList.remove('dragging');
                    this.savePosition();
                }
            });

            this.badge.title = 'Drag to move | Shift+Click to open Inbox';
        },

        savePosition() {
            const rect = this.badge.getBoundingClientRect();
            const position = {
                right: window.innerWidth - rect.right,
                top: rect.top
            };
            localStorage.setItem('yahoo-unread-position', JSON.stringify(position));
        },

        loadPosition() {
            const saved = localStorage.getItem('yahoo-unread-position');
            return saved ? JSON.parse(saved) : null;
        },

        setupObservers() {
            const observeAccountList = () => {
                const accountContainer = document.querySelector('[data-test-id="account-list"]');
                if (accountContainer && !state.unreadObserver) {
                    state.unreadObserver = new MutationObserver(() => {
                        this.update();
                    });
                    state.unreadObserver.observe(accountContainer, {
                        childList: true,
                        subtree: true,
                        characterData: true,
                        attributes: true,
                        attributeFilter: ['data-test-unread-count']
                    });
                    console.log('[Yahoo Mail v12] Account list observer set up');
                }
            };

            observeAccountList();
            setTimeout(observeAccountList, 2000);
            setTimeout(observeAccountList, 5000);
        },

        startPolling() {
            if (this.updateTimer) {
                clearInterval(this.updateTimer);
            }
            this.updateTimer = setInterval(() => {
                this.update();
            }, CONFIG.UNREAD_CHECK_INTERVAL);
        },

        update() {
            // Get all accounts from the account list
            const accountItems = document.querySelectorAll('[data-test-id="account-list-item"]');
            let totalUnread = 0;

            console.log('[Yahoo Mail v12] Found', accountItems.length, 'accounts');

            accountItems.forEach(account => {
                // Try to get unread count from data attribute
                const unreadAttr = account.getAttribute('data-test-unread-count');
                if (unreadAttr) {
                    const count = parseInt(unreadAttr) || 0;
                    totalUnread += count;
                    console.log('[Yahoo Mail v12] Account:', account.querySelector('span')?.textContent?.trim(), 'Unread:', count);
                } else {
                    // Fallback: try to find the displayed count badge
                    const badge = account.querySelector('[data-test-id="displayed-count"]');
                    if (badge) {
                        const count = parseInt(badge.textContent.trim()) || 0;
                        totalUnread += count;
                        console.log('[Yahoo Mail v12] Account badge count:', count);
                    }
                }
            });

            const previousCount = state.unreadCount;
            state.unreadCount = totalUnread;

            console.log(`[Yahoo Mail v12] Total unread across all accounts: ${totalUnread} (was ${previousCount})`);

            if (totalUnread > 0) {
                this.badge.textContent = `📧 ${totalUnread} unread`;
                this.badge.classList.add('show');
                document.title = `(${totalUnread}) Yahoo Mail`;

                if (state.lastUnreadCount >= 0 && totalUnread > state.lastUnreadCount) {
                    const diff = totalUnread - state.lastUnreadCount;
                    this.badge.classList.add('has-new');
                    this.showToast(`🆕 ${diff} new email${diff > 1 ? 's' : ''}!`, true);

                    setTimeout(() => {
                        this.badge.classList.remove('has-new');
                    }, 3000);
                }
            } else {
                this.badge.textContent = '✉️ No unread';
                this.badge.classList.add('show');
                document.title = 'Yahoo Mail';
            }

            state.lastUnreadCount = totalUnread;
        },

        showToast(message, isNewMail = false) {
            const toast = document.createElement('div');
            toast.className = isNewMail ? 'yahoo-toast new-mail' : 'yahoo-toast';
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => toast.remove(), 4000);
        }
    };

    // ==================== QUICK ACTIONS ====================
    const quickActions = {
        container: null,

        init() {
            this.container = document.createElement('div');
            this.container.className = 'yahoo-quick-actions';

            const refreshBtn = this.createButton('🔄', 'Refresh Page', () => {
                unreadCounter.showToast('Refreshing...');
                setTimeout(() => {
                    location.reload();
                }, 500);
            });

            const statsBtn = this.createButton('📊', 'Email Statistics', () => {
                emailStats.show();
            });

            const searchBtn = this.createButton('🔍', 'Quick Search', () => {
                this.activateSearch();
            });

            const helpBtn = this.createButton('❓', 'Keyboard Shortcuts', () => {
                keyboardShortcuts.showModal();
            });

            this.container.append(refreshBtn, statsBtn, searchBtn, helpBtn);
            document.body.appendChild(this.container);
        },

        activateSearch() {
            const searchIconSelectors = [
                '[data-test-id="search-button"]',
                'button[aria-label*="Search"]',
                'button[aria-label*="search"]',
                '[class*="search-button"]',
                '[class*="SearchButton"]',
                'button:has(svg[data-icon-name="search"])',
                'button:has([class*="search-icon"])'
            ];

            let searchIcon = null;
            for (const selector of searchIconSelectors) {
                searchIcon = document.querySelector(selector);
                if (searchIcon) {
                    console.log('[Yahoo Mail] Found search icon:', selector);
                    searchIcon.click();
                    unreadCounter.showToast('Opening search...');

                    setTimeout(() => {
                        this.focusSearchInput();
                    }, 300);
                    return;
                }
            }

            this.focusSearchInput();
        },

        focusSearchInput() {
            const searchSelectors = [
                '[data-test-id="search-input"]',
                'input[type="search"]',
                'input[placeholder*="Search"]',
                'input[placeholder*="search"]',
                'input[placeholder*="Search mail"]',
                'input[aria-label*="Search"]',
                '#ybar-sbq',
                '.search-input',
                '[name="p"]',
                'input[class*="search"]',
                'input[class*="Search"]'
            ];

            let searchInput = null;
            for (const selector of searchSelectors) {
                searchInput = document.querySelector(selector);
                if (searchInput) {
                    console.log('[Yahoo Mail] Found search input:', selector);
                    break;
                }
            }

            if (searchInput) {
                if (searchInput.offsetParent === null) {
                    console.log('[Yahoo Mail] Search input is hidden, trying to show it');
                    searchInput.style.display = 'block';
                    searchInput.style.visibility = 'visible';
                }

                searchInput.focus();
                searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                searchInput.click();

                const originalBorder = searchInput.style.border;
                const originalBoxShadow = searchInput.style.boxShadow;
                searchInput.style.border = '2px solid #667eea';
                searchInput.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.2)';

                setTimeout(() => {
                    searchInput.style.border = originalBorder;
                    searchInput.style.boxShadow = originalBoxShadow;
                }, 2000);

                unreadCounter.showToast('🔍 Search activated! Start typing...');
            } else {
                console.warn('[Yahoo Mail] Search input not found. Available inputs:',
                    Array.from(document.querySelectorAll('input')).map(i => ({
                        type: i.type,
                        placeholder: i.placeholder,
                        class: i.className,
                        id: i.id
                    }))
                );
                unreadCounter.showToast('Search box not found. Click the 🔍 icon at the top of the page.');
            }
        },

        createButton(icon, title, onClick) {
            const btn = document.createElement('button');
            btn.className = 'yahoo-quick-btn';
            btn.innerHTML = icon;
            btn.title = title;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            });
            return btn;
        }
    };

    // ==================== EMAIL STATISTICS ====================
    const emailStats = {
        modal: null,

        init() {
            this.createModal();
        },

        createModal() {
            this.modal = document.createElement('div');
            this.modal.id = 'keyboard-shortcuts-modal';
            this.modal.style.maxWidth = '600px';
            this.modal.style.left = '50%';
            this.modal.style.top = '50%';
            this.modal.style.transform = 'translate(-50%, -50%)';
            document.body.appendChild(this.modal);
        },

        show() {
            const stats = this.calculate();

            if (!this.modal) {
                this.createModal();
            }

            const avgPerDay = stats.todayEmails > 0 ? stats.todayEmails : 'N/A';
            const unreadPercent = stats.totalEmails > 0 ? Math.round((stats.unreadEmails / stats.totalEmails) * 100) : 0;

            this.modal.innerHTML = `
                <div class="modal-header">
                    <h2>📊 Your Email Analytics</h2>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; text-align: center;">
                        <div style="font-size: 36px; font-weight: bold; line-height: 1.2; margin-bottom: 8px;">${stats.totalEmails}</div>
                        <div style="font-size: 13px; opacity: 0.95; font-weight: 600;">Total Visible</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 10px; color: white; text-align: center;">
                        <div style="font-size: 36px; font-weight: bold; line-height: 1.2; margin-bottom: 8px;">${stats.unreadEmails}</div>
                        <div style="font-size: 13px; opacity: 0.95; font-weight: 600;">Total Unread (${unreadPercent}%)</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%); padding: 20px; border-radius: 10px; color: white; text-align: center;">
                        <div style="font-size: 36px; font-weight: bold; line-height: 1.2; margin-bottom: 8px;">${stats.todayEmails}</div>
                        <div style="font-size: 13px; opacity: 0.95; font-weight: 600;">Today's Emails</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 20px; border-radius: 10px; color: white; text-align: center;">
                        <div style="font-size: 36px; font-weight: bold; line-height: 1.2; margin-bottom: 8px;">${avgPerDay}</div>
                        <div style="font-size: 13px; opacity: 0.95; font-weight: 600;">Avg Today</div>
                    </div>
                </div>
                <div style="margin-bottom: 15px;">
                    <h3 style="margin: 0 0 10px 0; color: #667eea;">📁 Unread by Account</h3>
                    ${stats.accountBreakdown}
                </div>
                <div class="close-btn">
                    <button id="close-stats-modal">Close</button>
                </div>
            `;

            this.modal.style.left = '50%';
            this.modal.style.top = '50%';
            this.modal.style.transform = 'translate(-50%, -50%)';

            this.modal.classList.add('show');

            this.makeDraggable();

            setTimeout(() => {
                const closeBtn = document.getElementById('close-stats-modal');
                if (closeBtn) {
                    closeBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.modal.classList.remove('show');
                    });
                }
            }, 0);
        },

        makeDraggable() {
            const modal = this.modal;
            if (!modal) return;

            let isDragging = false;
            let startX = 0;
            let startY = 0;
            let modalX = 0;
            let modalY = 0;

            const dragStart = (e) => {
                if (e.target.tagName === 'BUTTON' ||
                    e.target.closest('button') ||
                    e.target.closest('.close-btn') ||
                    e.target.closest('[style*="overflow-y"]')) {
                    return;
                }

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                const rect = modal.getBoundingClientRect();
                modalX = rect.left;
                modalY = rect.top;

                modal.classList.add('dragging');
                document.body.classList.add('modal-dragging');

                e.preventDefault();
                e.stopPropagation();
            };

            const drag = (e) => {
                if (!isDragging) return;

                e.preventDefault();
                e.stopPropagation();

                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                modal.style.left = (modalX + deltaX) + 'px';
                modal.style.top = (modalY + deltaY) + 'px';
                modal.style.transform = 'none';
            };

            const dragEnd = (e) => {
                if (!isDragging) return;

                isDragging = false;
                modal.classList.remove('dragging');
                document.body.classList.remove('modal-dragging');

                e.preventDefault();
                e.stopPropagation();
            };

            modal.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);

            modal.addEventListener('dragstart', (e) => e.preventDefault());
        },

        calculate() {
            const messageItems = document.querySelectorAll('[data-test-id="message-list-item"]');
            const accountItems = document.querySelectorAll('[data-test-id="account-list-item"]');

            const today = new Date().toDateString();
            let todayCount = 0;
            messageItems.forEach(item => {
                const dateText = item.querySelector('[data-test-id="date-time"]')?.textContent || '';
                if (dateText.includes('Today') || dateText.includes(today)) {
                    todayCount++;
                }
            });

            let totalUnread = 0;
            let accountBreakdown = '<div style="max-height: 200px; overflow-y: auto;">';
            let hasUnread = false;

            accountItems.forEach(account => {
                const nameEl = account.querySelector('span[title]');
                const name = nameEl?.textContent?.trim() || 'Unknown';
                const unreadAttr = account.getAttribute('data-test-unread-count');
                const count = parseInt(unreadAttr) || 0;

                totalUnread += count;

                if (count > 0) {
                    hasUnread = true;
                    accountBreakdown += `
                        <div style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #eee;">
                            <span>${name}</span>
                            <span style="background: #667eea; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: bold;">${count}</span>
                        </div>
                    `;
                }
            });

            if (!hasUnread) {
                accountBreakdown += '<div style="text-align: center; padding: 20px; color: #999;">🎉 All caught up! No unread emails.</div>';
            }
            accountBreakdown += '</div>';

            return {
                totalEmails: messageItems.length,
                unreadEmails: totalUnread,
                todayEmails: todayCount,
                accountBreakdown: accountBreakdown
            };
        }
    };

    // ==================== KEYBOARD SHORTCUTS ====================
    const keyboardShortcuts = {
        modal: null,

        init() {
            this.createModal();
            this.setupListeners();
        },

        createModal() {
            this.modal = document.createElement('div');
            this.modal.id = 'keyboard-shortcuts-modal';
            this.modal.innerHTML = `
                <div class="modal-header">
                    <h2>⌨️ Keyboard Shortcuts</h2>
                </div>
                <div class="shortcut-item">
                    <span>Compose new email</span>
                    <span class="key">C</span>
                </div>
                <div class="shortcut-item">
                    <span>Search / Find</span>
                    <span class="key">F or /</span>
                </div>
                <div class="shortcut-item">
                    <span>Refresh Page</span>
                    <span class="key">Shift + R</span>
                </div>
                <div class="shortcut-item">
                    <span>Show Email Stats</span>
                    <span class="key">S</span>
                </div>
                <div class="shortcut-item">
                    <span>Go to Inbox</span>
                    <span class="key">I</span>
                </div>
                <div class="shortcut-item">
                    <span>Close Modal</span>
                    <span class="key">Esc</span>
                </div>
                <div class="shortcut-item">
                    <span>Show this help</span>
                    <span class="key">?</span>
                </div>
                <div class="close-btn">
                    <button id="close-shortcuts-modal">Close</button>
                </div>
            `;
            document.body.appendChild(this.modal);

            this.makeDraggable();

            this.modal.querySelector('#close-shortcuts-modal').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.modal.classList.remove('show');
            });
        },

        makeDraggable() {
            const modal = this.modal;
            if (!modal) return;

            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;

            modal.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);

            function dragStart(e) {
                if (e.target.tagName === 'BUTTON' ||
                    e.target.closest('button') ||
                    e.target.closest('.close-btn') ||
                    e.target.closest('[style*="overflow"]')) {
                    return;
                }

                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;

                if (e.target === modal || modal.contains(e.target)) {
                    isDragging = true;
                    modal.style.cursor = 'grabbing';
                }
            }

            function drag(e) {
                if (isDragging) {
                    e.preventDefault();

                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;

                    xOffset = currentX;
                    yOffset = currentY;

                    modal.style.left = currentX + 'px';
                    modal.style.top = currentY + 'px';
                    modal.style.transform = 'none';
                }
            }

            function dragEnd() {
                if (isDragging) {
                    initialX = currentX;
                    initialY = currentY;
                    isDragging = false;
                    modal.style.cursor = 'move';
                }
            }
        },

        setupListeners() {
            document.addEventListener('keydown', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

                switch(e.key.toLowerCase()) {
                    case 'c':
                        if (!e.shiftKey && !e.ctrlKey) {
                            e.preventDefault();
                            const composeBtn = document.querySelector('[data-test-id="compose-button"]');
                            composeBtn?.click();
                        }
                        break;
                    case 's':
                        if (!e.shiftKey && !e.ctrlKey) {
                            e.preventDefault();
                            emailStats.show();
                        }
                        break;
                    case 'i':
                        if (!e.shiftKey && !e.ctrlKey) {
                            e.preventDefault();
                            const inboxLink = document.querySelector('[data-test-folder-name="Inbox"]');
                            inboxLink?.click();
                        }
                        break;
                    case 'f':
                        if (!e.shiftKey && !e.ctrlKey) {
                            e.preventDefault();
                            quickActions.activateSearch();
                        }
                        break;
                    case 'r':
                        if (e.shiftKey && !e.ctrlKey) {
                            e.preventDefault();
                            unreadCounter.showToast('Refreshing...');
                            setTimeout(() => location.reload(), 500);
                        }
                        break;
                    case '/':
                        e.preventDefault();
                        quickActions.activateSearch();
                        break;
                    case '?':
                        e.preventDefault();
                        this.showModal();
                        break;
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.modal?.classList.remove('show');
                    emailStats.modal?.classList.remove('show');
                }
            });

            document.addEventListener('click', (e) => {
                if (e.target.id === 'keyboard-shortcuts-modal') {
                    this.modal?.classList.remove('show');
                }
            });
        },

        showModal() {
            this.modal?.classList.add('show');
        }
    };

    // ==================== BEAUTIFICATION LOGIC ====================
    let elementMap = new WeakMap();

    const debounce = (func, delay) => {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const clearBackground = (testId) => {
        const elem = document.querySelector(`[data-test-id="${testId}"]`);
        if (elem) elem.style.backgroundColor = 'transparent';
    };

    const collapseRightRail = () => {
        const rightRail = document.querySelector('[data-test-id="mail-right-rail"]');
        if (!rightRail) return;

        const appsBar = rightRail.querySelector('[data-test-id="comms-properties-bar"]');
        if (!appsBar) return;

        const apps = appsBar.querySelector('[data-test-id="comms-properties"]');
        if (!apps) return;

        let observer = elementMap.get(rightRail);
        if (observer instanceof ResizeObserver) {
            observer.disconnect();
            observer = new MutationObserver(debouncedCollapseRightRail);
            observer.observe(rightRail, { childList: true, subtree: true });
            elementMap.set(rightRail, observer);
        }

        const hasSpecialContent = rightRail.querySelector('[data-test-id="calendar-right-rail-pane"]') ||
                                 rightRail.querySelector('[data-test-id="contact-card"]') ||
                                 rightRail.querySelector('[data-test-id="contact-details"]') ||
                                 rightRail.querySelector('[data-test-id="contacts-pane-search"]');

        if (hasSpecialContent) {
            if (appsBar.firstChild !== apps) appsBar.insertBefore(apps, appsBar.firstChild);
            appsBar.style.flexDirection = 'row';
            apps.style.flexDirection = 'row';
            apps.style.marginTop = '0';
            Array.from(apps.children).forEach(app => app.style.margin = '0 14px 0 0');
        } else {
            if (appsBar.lastChild !== apps) appsBar.appendChild(apps);
            appsBar.style.flexDirection = 'column';
            apps.style.flexDirection = 'column';
            apps.style.marginTop = '14px';
            Array.from(apps.children).forEach(app => app.style.margin = '14px 0 0 0');
        }
    };

    const debouncedCollapseRightRail = debounce(collapseRightRail, CONFIG.RESIZE_DEBOUNCE);

    const setupBeautification = () => {
        const mainContainer = document.getElementById('mail-app-container');
        if (!mainContainer) return;

        if (!elementMap.has(mainContainer)) {
            const observer = new MutationObserver(setupBeautification);
            observer.observe(mainContainer, { childList: true });
            elementMap.set(mainContainer, observer);
        }

        const tabContainer = mainContainer.querySelector('[data-test-id="content-below-tabs"]');
        if (tabContainer && !elementMap.has(tabContainer)) {
            const observer = new MutationObserver(setupBeautification);
            observer.observe(tabContainer, { childList: true });
            elementMap.set(tabContainer, observer);

            const messageToolbar = mainContainer.querySelector('[data-test-id="message-toolbar"]');
            if (messageToolbar && getComputedStyle(messageToolbar).backgroundColor === "rgba(0, 0, 0, 0)") {
                clearBackground('content-area');
                clearBackground('mail-app-main-content');
                clearBackground('comms-properties-bar');
            }
        }

        const rightRail = tabContainer?.querySelector('[data-test-id="mail-right-rail"]');
        if (rightRail && !elementMap.has(rightRail)) {
            const observer = new ResizeObserver(debouncedCollapseRightRail);
            observer.observe(rightRail);
            elementMap.set(rightRail, observer);
        }
    };

    // ==================== WIDER LAYOUT LOGIC ====================
    const setupWiderLayout = async () => {
        const sel = `div[data-test-id="mail-right-rail"]:has(div[data-test-id="gam-iframe"]:only-child) div[data-test-id="comms-properties-bar"]`;
        const config = { childList: true, subtree: true };

        let styleEl = null;
        const addStyle = el => {
            const style = window.getComputedStyle(el);
            if (!styleEl) {
                styleEl = document.createElement("style");
                document.head.append(styleEl);
            }
            styleEl.textContent = `:root { --ywm-comms-properties-bar-width: ${style.width}; }`;
        };

        const observer = new MutationObserver(() => {
            const node = document.body.querySelector(sel);
            if (node) {
                observer.disconnect();
                observer._observing = false;
                addStyle(node);
            }
        });
        observer._observing = false;

        const run = () => {
            const container = document.getElementById("mail-app-container");
            if (container) {
                const node = container.querySelector(sel);
                if (node) {
                    addStyle(node);
                } else if (!observer._observing) {
                    observer.observe(container, config);
                    observer._observing = true;
                }
            }

            const wrap = document.getElementById("ybar-inner-wrap");
            if (wrap && !document.getElementById("ywm-style")) {
                const rect = wrap.getBoundingClientRect();
                const style = document.createElement("style");
                style.id = "ywm-style";
                style.textContent = `#app > section[role="banner"] > div.H_3n1j3 { height: ${rect.height}px !important; }`;
                document.head.append(style);
            }
        };

        if (document.readyState !== "loading") run();
        document.onreadystatechange = () => run();
    };

    // ==================== INITIALIZATION ====================
    const initialize = () => {
        console.log('[Yahoo Mail Ultimate v12] Applying enhancements with total unread counter across all accounts...');

        applyBeautificationStyles();
        applyWiderLayoutStyles();
        applyAccountHighlightStyles();

        if (state.isDarkMode) document.body.classList.add('dark-mode');
        if (state.isCompactMode) document.body.classList.add('compact-mode');

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setupBeautification();
                setupWiderLayout();
                if (CONFIG.FEATURES.unreadCounter) unreadCounter.init();
                if (CONFIG.FEATURES.quickArchive) quickActions.init();
                if (CONFIG.FEATURES.keyboardShortcuts) {
                    keyboardShortcuts.init();
                    emailStats.init();
                }
            });
        } else {
            setupBeautification();
            setupWiderLayout();
            if (CONFIG.FEATURES.unreadCounter) unreadCounter.init();
            if (CONFIG.FEATURES.quickArchive) quickActions.init();
            if (CONFIG.FEATURES.keyboardShortcuts) {
                keyboardShortcuts.init();
                emailStats.init();
            }
        }

        window.addEventListener('load', () => {
            setupBeautification();
            setTimeout(() => {
                collapseRightRail();
                unreadCounter.update();
            }, 1000);
        });

        console.log('[Yahoo Mail Ultimate v12] All features loaded successfully with total unread counter');
    };

    initialize();

})();