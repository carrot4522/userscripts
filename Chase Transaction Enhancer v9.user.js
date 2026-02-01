// ==UserScript==
// @name         Chase Transaction Enhancer v9
// @namespace    solomon.chase.transactions
// @version      9
// @description  Enhanced transaction management for Chase with color coding, smart classification, auto-loading, and draggable HUD for tracking expenses.
// @match        https://*.chase.com/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://update.greasyfork.org/scripts/Chase-Transaction-Enhancer.user.js
// @updateURL    https://update.greasyfork.org/scripts/Chase-Transaction-Enhancer.meta.js
// ==/UserScript==

(() => {
    'use strict';

    // ===== Configuration =====
    const CONFIG = {
        daysThreshold: 40,
        signId: 'tmk-totals-hud',
        storageKey: 'tmk-gas-sign-position',
        maxRows: 2500,
        scanIntervalMs: 1500,
        throttleMs: 120,
        autoLoadDelay: 3000,
        autoLoadWaitTime: 800,
        autoLoadMaxAttempts: 50,

        selectors: {
            table: '#ACTIVITY-dataTableId-mds-diy-data-table.mds-activity-table',
            row: 'tbody > tr.mds-activity-table__row',
            descColumn: 'td[id$="column1"], td[data-column="1"]',
            amountColumn: 'td[id$="column3"]',
            seeMoreButton: [
                '#see-more-button_id',
                '[data-testid="see-more-button_id"]',
                'mds-button[data-name="SEE_MORE"]'
            ]
        },

        classes: {
            highlight: {
                privacy: 'tmk-hi-privacy',
                fee: 'tmk-hi-fee',
                gas: 'tmk-hi-gas',
                gas76: 'tmk-hi-76gas',
                income: 'tmk-hi-income',
                zelle: 'tmk-hi-zelle',
                luisa: 'tmk-hi-luisa',
                erika: 'tmk-hi-erika',
                fiverr: 'tmk-hi-fiverr',
                costco: 'tmk-hi-costco',
                express: 'tmk-hi-express',
                ebay: 'tmk-hi-ebay',
                amazon: 'tmk-hi-amazon'
            },
            special: {
                signLeft: 'tmk-sign-left',
                feeCell: 'tmk-fee-cell',
                gasCell: 'tmk-gas-cell'
            }
        }
    };

    // ===== Patterns =====
    const PATTERNS = {
        cleanup: {
            amex: /american\s*express/i,
            wegmans: /wegmans/i,
            moneygram: /moneygram/i
        },
        tech: {
            ebay: /\bebay\b/i,
            amazon: /\bamazon\b|amzn/i
        },
        personal: {
            luisa: /luisa|murcia-tr|trivino/i,
            erika: /erika|gamero/i,
            fiverr: /fiverr/i
        },
        merchants: {
            gas76: /\b76\s+gas\b|\bunited\s+oil\b/i,
            costco: /costco|whse/i,
            expressScripts: /express\s+scripts/i
        },
        financial: {
            privacy: /privacy(?:\.com)?/i,
            zelle: /\bzelle\b/i,
            deposit: /online\s+deposit/i,
            fee: /monthly\s+service\s+fee/i,
            synchrony: /synchrony\s+bank\s+paymen[t]?/i,
            citiAutopay: /citi\s+autopay\s+payment/i,
            m1: /m1\s+finance/i,
            westernUnion: /weste?r?n?\s+union/i,
            william: /\bwilliam\b/i,
            creditGeneral: /deposit|credit/i
        }
    };

    // ===== Classification Rules =====
    const RULES = [
        // Cleanup rules (highest priority)
        { test: PATTERNS.cleanup.amex, action: (tr, cell) => setSlim(cell, 'American Express') },
        { test: PATTERNS.cleanup.wegmans, action: (tr, cell) => setSlim(cell, 'Wegmans Montvale') },
        { test: PATTERNS.cleanup.moneygram, action: (tr, cell) => setSlim(cell, 'MoneyGram') },

        // Tech vendors
        { test: PATTERNS.tech.ebay, highlight: 'ebay', action: (tr, cell) => setSlim(cell, 'eBay Purchase') },
        { test: PATTERNS.tech.amazon, highlight: 'amazon', action: (tr, cell) => setSlim(cell, 'Amazon/Tech Vendor') },

        // Personal transactions
        { test: PATTERNS.personal.luisa, highlight: 'luisa', action: (tr, cell) => setSlim(cell, 'Zelle: Luisa') },
        { test: PATTERNS.personal.erika, highlight: 'erika', action: (tr, cell) => setSlim(cell, 'Zelle: Erika (Mail/Favor)') },
        { test: PATTERNS.personal.fiverr, highlight: 'fiverr', action: (tr, cell) => setSlim(cell, 'Fiverr (Biz Expense)') },

        // Merchants
        { test: PATTERNS.merchants.gas76, highlight: 'gas76', action: (tr, cell) => setSlim(cell, '76 Gas Purchase ⛽️') },
        { test: PATTERNS.merchants.costco, highlight: 'costco', action: (tr, cell) => setSlim(cell, 'Costco (Membership/Tires)') },
        { test: PATTERNS.merchants.expressScripts, highlight: 'express', action: (tr, cell) => setSlim(cell, 'Express Scripts (Meds)') },

        // Financial (with special handling)
        {
            test: PATTERNS.financial.fee,
            highlight: 'fee',
            action: (tr, cell) => {
                const firstCell = tr.querySelector('th, td');
                if (firstCell) {
                    firstCell.classList.add(CONFIG.classes.special.signLeft, CONFIG.classes.special.feeCell);
                }
            }
        },
        {
            test: PATTERNS.financial.synchrony,
            highlight: 'gas',
            action: (tr, cell) => {
                const firstCell = tr.querySelector('th, td');
                if (firstCell) {
                    firstCell.classList.add(CONFIG.classes.special.signLeft, CONFIG.classes.special.gasCell);
                }
                setSlim(cell, '76 Gas Payment (Synchrony)');
            }
        },
        { test: PATTERNS.financial.privacy, highlight: 'privacy', action: (tr, cell) => setSlim(cell, 'Privacy') },
        { test: PATTERNS.financial.zelle, highlight: 'zelle' },
        { test: PATTERNS.financial.citiAutopay, action: (tr, cell) => setSlim(cell, 'Citi Autopay') },
        { test: PATTERNS.financial.m1, action: (tr, cell) => setSlim(cell, 'M1 Finance') },
        { test: PATTERNS.financial.westernUnion, action: (tr, cell) => setSlim(cell, 'Western Union') },
        { test: PATTERNS.financial.william, action: (tr, cell) => setSlim(cell, 'Life Insurance (William)') }
    ];

    // ===== Styles =====
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Hide unwanted sections */
            #external-accounts-custom-accordion,
            .marketing-container,
            .merchandise-zone-container,
            #widget-rewards,
            #widget-chase-travel,
            #widget-hybrid-credit-journey,
            #widget-chase-myhome,
            #widget-chase-myauto,
            #widget-spending-and-budgeting,
            #widget-pay-in-four,
            #help-and-support-widget,
            div[data-testid="ad-container-ad-placement"],
            div[data-testid="ad-container-mktui-tile-ad"],
            div[data-testid="bc__disclosure-component"] {
                display: none !important;
            }

            /* Hide credit cards section */
            div[data-testid="accounts-group-container"] #CARD_ACCOUNTS,
            div[data-testid="accounts-group-container"] #CARD_ACCOUNTS ~ div {
                display: none !important;
            }

            /* Disable scroll animations */
            body { scroll-behavior: auto !important; }

            /* Highlight colors */
            .${CONFIG.classes.highlight.privacy} { background: rgba(255,245,157,.28) !important; }
            .${CONFIG.classes.highlight.fee} { background: rgba(255,235,238,.55) !important; }
            .${CONFIG.classes.highlight.gas} { background: rgba(255,244,244,.50) !important; }
            .${CONFIG.classes.highlight.gas76} { background: rgba(255,204,0,0.45) !important; }
            .${CONFIG.classes.highlight.income} { background: rgba(255,192,203,0.40) !important; }
            .${CONFIG.classes.highlight.zelle},
            .${CONFIG.classes.highlight.luisa},
            .${CONFIG.classes.highlight.erika} { background: transparent !important; }
            .${CONFIG.classes.highlight.fiverr} { background: rgba(144,238,144,0.4) !important; }
            .${CONFIG.classes.highlight.costco} { background: rgba(173,216,230,0.4) !important; }
            .${CONFIG.classes.highlight.express} { background: rgba(255,204,153,0.4) !important; }
            .${CONFIG.classes.highlight.ebay} { background: rgba(184,134,11,0.25) !important; }
            .${CONFIG.classes.highlight.amazon} { background: rgba(176,196,222,0.25) !important; }

            /* Apply colors to cells */
            ${generateCellColorRules()}

            /* Number styling reset */
            #ACTIVITY-dataTableId-mds-diy-data-table td[id$="column3"] .mds-activity-table__row-value--text--amount--positive,
            #ACTIVITY-dataTableId-mds-diy-data-table td[id$="column3"] .mds-activity-table__row-value--text--amount--positive *,
            #ACTIVITY-dataTableId-mds-diy-data-table td[id$="column4"] .mds-activity-table__row-value--text,
            #ACTIVITY-dataTableId-mds-diy-data-table td[id$="column3"] .mds-activity-table__row-value--text--amount,
            #ACTIVITY-dataTableId-mds-diy-data-table td[id$="column3"] .negative {
                font-weight: initial !important;
                color: initial !important;
            }

            /* HUD Styles */
            #${CONFIG.signId} {
                position: fixed !important;
                z-index: 99999999 !important;
                display: flex !important;
                flex-direction: column;
                align-items: flex-start;
                width: 250px;
                padding: 15px;
                font-family: system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                border-radius: 8px;
                background: #ffffff;
                color: #0f171f;
                border: 1px solid #bdc0c2;
                box-shadow: 0 4px 12px rgba(0,0,0,.15);
                cursor: grab;
                transition: box-shadow 0.2s;
                user-select: none;
            }
            #${CONFIG.signId}:active { cursor: grabbing; }
            #${CONFIG.signId}:hover { box-shadow: 0 6px 16px rgba(0,0,0,.25); }

            #${CONFIG.signId} .tmk-total-line {
                display: flex;
                justify-content: space-between;
                width: 100%;
                padding: 4px 0;
                align-items: center;
            }
            #${CONFIG.signId} .tmk-total-line:first-child {
                border-bottom: 1px solid #f0f0f0;
                margin-bottom: 8px;
                padding-bottom: 8px;
            }
            #${CONFIG.signId} .tmk-label {
                font-size: 14px;
                font-weight: 500;
                color: #5b6c7b;
                display: flex;
                align-items: center;
                letter-spacing: 0.1px;
            }
            #${CONFIG.signId} .tmk-amount {
                font-size: 20px;
                font-weight: 700;
            }
            #${CONFIG.signId} .gas-amount { color: #005eb8; }
            #${CONFIG.signId} .fee-amount { color: #c62828; }
            #${CONFIG.signId} .gas-icon,
            #${CONFIG.signId} .fee-icon {
                font-size: 18px;
                margin-right: 8px;
            }
            #${CONFIG.signId} .gas-icon { color: #005eb8; }
            #${CONFIG.signId} .fee-icon { color: #c62828; }
        `;
        document.documentElement.appendChild(style);
    }

    function generateCellColorRules() {
        const classes = Object.values(CONFIG.classes.highlight);
        return classes.map(cls => `
            .${cls} th, .${cls} td { background: inherit !important; }
            .mds-activity-table__row--activated.${cls} th,
            .mds-activity-table__row--activated.${cls} td { background: inherit !important; }
        `).join('\n');
    }

    // ===== Utility Functions =====
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const getTable = () => document.querySelector(CONFIG.selectors.table);
    const getDescCell = (tr) => tr.querySelector(CONFIG.selectors.descColumn);

    const hashText = (text) => {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = (hash * 31 + text.charCodeAt(i)) | 0;
        }
        return String(hash);
    };

    const log = (message, ...args) => console.log(`[Chase Enhancer] ${message}`, ...args);

    // ===== Data Parsing =====
    function parseDateFromRow(tr) {
        const dataValues = tr.getAttribute('data-values');
        if (!dataValues) return null;

        const dateString = dataValues.split(',')[0]?.trim();
        const match = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(dateString);

        if (match) {
            const date = new Date(`${match[1]}/${match[2]}/${match[3]}`);
            return isNaN(date) ? null : date;
        }
        return null;
    }

    function parseAmountFromRow(tr) {
        const dataValues = tr.getAttribute('data-values');
        if (!dataValues) return 0;

        const amountString = dataValues.split(',')[3]?.trim();
        if (!amountString) return 0;

        const cleanText = amountString
            .replace(/[$,]/g, '')
            .replace(/\((.*)\)/, '-$1');

        return parseFloat(cleanText) || 0;
    }

    function isPositiveAmount(tr) {
        const amountCell = tr.querySelector(CONFIG.selectors.amountColumn);
        if (!amountCell) return false;

        if (amountCell.querySelector('.amount--positive')) return true;

        const amountString = (amountCell.textContent || '').trim();
        return !amountCell.querySelector('.negative') && !amountString.startsWith('-');
    }

    // ===== Classification =====
    function clearMarks(tr) {
        tr.className = tr.className
            .split(' ')
            .filter(c => !c.startsWith('tmk-hi-'))
            .join(' ');

        const firstCell = tr.querySelector('th, td');
        if (firstCell) {
            Object.values(CONFIG.classes.special).forEach(cls => {
                firstCell.classList.remove(cls);
            });
        }
    }

    function applyHighlight(tr, key) {
        const className = CONFIG.classes.highlight[key];
        if (className) {
            tr.classList.add(className);
        }
    }

    function setSlim(cell, label) {
        if (!cell) return;

        const currentText = cell.textContent.trim();
        if (cell.querySelector('.tmk-slim-desc')) return;

        if (currentText !== label) {
            cell.textContent = '';
            const div = document.createElement('div');
            div.className = 'tmk-slim-desc';
            div.textContent = label;
            div.title = currentText;
            cell.appendChild(div);
        }
    }

    function classify(tr) {
        const descCell = getDescCell(tr);
        const text = (descCell?.textContent || '').trim();
        const key = hashText(text);

        if (tr.dataset.tmkKey === key) return;

        clearMarks(tr);
        const isCredit = isPositiveAmount(tr);

        // Handle income highlighting for credits
        if (isCredit && (PATTERNS.financial.deposit.test(text) || PATTERNS.financial.creditGeneral.test(text))) {
            if (!PATTERNS.financial.zelle.test(text)) {
                applyHighlight(tr, 'income');
                tr.dataset.tmkKey = key;
                return;
            }
        }

        // Apply rules in priority order
        for (const rule of RULES) {
            if (rule.test.test(text)) {
                if (rule.highlight) {
                    applyHighlight(tr, rule.highlight);
                }
                if (rule.action) {
                    rule.action(tr, descCell);
                }
                tr.dataset.tmkKey = key;
                return;
            }
        }

        tr.dataset.tmkKey = key;
    }

    // ===== Totals Calculation =====
    function calculateTotals(rows) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const threshold = today.getTime() - (CONFIG.daysThreshold * 24 * 60 * 60 * 1000);

        let gasTotal = 0;
        let feeTotal = 0;

        for (const tr of rows) {
            const date = parseDateFromRow(tr);
            if (!date || date.getTime() < threshold) continue;

            const dataValues = tr.getAttribute('data-values');
            if (!dataValues) continue;

            const desc = dataValues.split(',')[1]?.trim();
            const amount = parseAmountFromRow(tr);

            if (amount < 0) {
                if (PATTERNS.financial.synchrony.test(desc)) {
                    gasTotal += Math.abs(amount);
                }
                if (PATTERNS.financial.fee.test(desc)) {
                    feeTotal += Math.abs(amount);
                }
            }
        }

        return { gasTotal, feeTotal };
    }

    // ===== HUD Manager =====
    class HUDManager {
        constructor() {
            this.element = null;
            this.isDragging = false;
            this.offsetX = 0;
            this.offsetY = 0;
            this.initDragListeners();
        }

        initDragListeners() {
            if (document.tmkDragListenersAttached) return;

            document.addEventListener('mousedown', (e) => {
                const target = e.target.closest(`#${CONFIG.signId}`);
                if (target && e.button === 0) {
                    this.element = target;
                    this.element.style.cursor = 'grabbing';
                    this.isDragging = true;
                    this.offsetX = e.clientX - this.element.getBoundingClientRect().left;
                    this.offsetY = e.clientY - this.element.getBoundingClientRect().top;
                    document.body.style.userSelect = 'none';
                    e.preventDefault();
                }
            });

            document.addEventListener('mousemove', (e) => {
                if (!this.isDragging || !this.element) return;

                const newX = e.clientX - this.offsetX;
                const newY = e.clientY - this.offsetY;

                this.element.style.left = newX + 'px';
                this.element.style.top = newY + 'px';
                this.element.style.right = 'unset';
            });

            document.addEventListener('mouseup', () => {
                if (this.isDragging && this.element) {
                    this.element.style.cursor = 'grab';
                    this.isDragging = false;
                    document.body.style.userSelect = 'auto';
                    this.savePosition();
                    this.element = null;
                }
            });

            document.tmkDragListenersAttached = true;
        }

        savePosition() {
            if (!this.element) return;
            const rect = this.element.getBoundingClientRect();
            const position = { left: rect.left, top: rect.top };
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(position));
        }

        loadPosition(element) {
            const saved = localStorage.getItem(CONFIG.storageKey);
            if (saved) {
                try {
                    const pos = JSON.parse(saved);
                    if (pos.left !== undefined && pos.top !== undefined) {
                        element.style.left = pos.left + 'px';
                        element.style.top = pos.top + 'px';
                        element.style.right = 'unset';
                        element.style.bottom = 'unset';
                        return;
                    }
                } catch (e) {
                    log('Failed to load saved position:', e);
                }
            }
            // Default position
            element.style.top = '10px';
            element.style.right = '10px';
        }

        update(gasTotal, feeTotal) {
            let sign = document.getElementById(CONFIG.signId);

            if (!sign) {
                sign = document.createElement('div');
                sign.id = CONFIG.signId;
                document.body.appendChild(sign);
                this.loadPosition(sign);
            }

            const formatCurrency = (amount) => amount.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD'
            });

            sign.innerHTML = `
                <div class="tmk-total-line">
                    <span class="tmk-label">
                        <span class="fee-icon">❗</span>
                        Monthly Service Fee (${CONFIG.daysThreshold} Days)
                    </span>
                    <span class="tmk-amount fee-amount">${formatCurrency(feeTotal)}</span>
                </div>
                <div class="tmk-total-line">
                    <span class="tmk-label">
                        <span class="gas-icon">⛽</span>
                        76 Gas Payment (${CONFIG.daysThreshold} Days)
                    </span>
                    <span class="tmk-amount gas-amount">${formatCurrency(gasTotal)}</span>
                </div>
            `;

            sign.style.display = 'flex';
        }
    }

    // ===== Transaction Loader =====
    class TransactionLoader {
        constructor() {
            this.isLoading = false;
            this.loadAttempts = 0;
        }

        async loadMoreTransactions() {
            if (this.isLoading || this.loadAttempts >= CONFIG.autoLoadMaxAttempts) return;

            const button = this.findSeeMoreButton();
            if (!button || button.hasAttribute('inactive') || button.disabled) {
                log('No more transactions to load');
                return;
            }

            this.isLoading = true;
            this.loadAttempts++;

            log(`Loading more transactions (attempt ${this.loadAttempts})...`);

            try {
                button.click();
                await this.waitForNewContent();

                const oldestDate = this.getOldestTransactionDate();
                const shouldContinue = this.shouldLoadMore(oldestDate);

                this.isLoading = false;

                if (shouldContinue) {
                    await this.delay(CONFIG.autoLoadWaitTime);
                    return this.loadMoreTransactions();
                } else {
                    log('Reached threshold, load complete');
                }
            } catch (e) {
                log('Error loading transactions:', e);
                this.isLoading = false;
            }
        }

        findSeeMoreButton() {
            for (const selector of CONFIG.selectors.seeMoreButton) {
                const button = document.querySelector(selector);
                if (button) return button;
            }

            const buttons = document.querySelectorAll('mds-button, button, [role="button"]');
            for (const btn of buttons) {
                const text = btn.textContent.trim().toLowerCase();
                if (text.includes('see more') && text.includes('activity')) {
                    return btn;
                }
            }
            return null;
        }

        async waitForNewContent() {
            return new Promise((resolve) => {
                let attempts = 0;
                const checkInterval = setInterval(() => {
                    attempts++;
                    const isLoading = document.querySelector('[is-loading="true"], [aria-busy="true"]');

                    if (!isLoading || attempts >= 30) {
                        clearInterval(checkInterval);
                        setTimeout(resolve, 300);
                    }
                }, 200);
            });
        }

        getOldestTransactionDate() {
            const table = getTable();
            if (!table) return null;

            const rows = $$(CONFIG.selectors.row, table);
            if (rows.length === 0) return null;

            return parseDateFromRow(rows[rows.length - 1]);
        }

        shouldLoadMore(oldestDate) {
            if (!oldestDate) return false;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const threshold = today.getTime() - (CONFIG.daysThreshold * 24 * 60 * 60 * 1000);

            return oldestDate.getTime() > threshold;
        }

        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async start() {
            await this.delay(CONFIG.autoLoadDelay);
            log('Starting auto-load...');
            await this.loadMoreTransactions();
            log(`Auto-load complete (${this.loadAttempts} attempts)`);
        }
    }

    // ===== Scanner =====
    class TransactionScanner {
        constructor() {
            this.observer = null;
            this.queued = false;
            this.lastRun = 0;
            this.hudManager = new HUDManager();
        }

        schedule() {
            if (this.queued) return;

            this.queued = true;
            const elapsed = performance.now() - this.lastRun;
            const delay = Math.max(0, CONFIG.throttleMs - elapsed);

            setTimeout(() => {
                this.queued = false;
                this.scan();
            }, delay);
        }

        scan() {
            this.lastRun = performance.now();
            const table = getTable();
            if (!table) return;

            this.observer?.disconnect();

            const rows = $$(CONFIG.selectors.row, table).slice(0, CONFIG.maxRows);

            try {
                rows.forEach(classify);
            } catch (e) {
                log('Classification error:', e);
            }

            try {
                const { gasTotal, feeTotal } = calculateTotals(rows);
                this.hudManager.update(gasTotal, feeTotal);
            } catch (e) {
                log('Totals calculation error:', e);
                this.hudManager.update(0, 0);
            }

            this.observe();
        }

        observe() {
            if (!this.observer) {
                this.observer = new MutationObserver(() => this.schedule());
            }

            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['is-loading', 'disabled']
            });
        }

        start() {
            this.scan();
            this.observe();

            addEventListener('hashchange', () => this.schedule());
            addEventListener('popstate', () => this.schedule());
            setInterval(() => this.schedule(), CONFIG.scanIntervalMs);
        }
    }

    // ===== Initialization =====
    function init() {
        injectStyles();

        const transactionLoader = new TransactionLoader();
        transactionLoader.start();

        const scanner = new TransactionScanner();
        scanner.start();

        log('Initialized successfully');
    }

    init();

})();