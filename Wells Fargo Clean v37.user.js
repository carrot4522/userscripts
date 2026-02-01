// ==UserScript==
// @name         Wells Fargo Clean v37
// @namespace    Wells Fargo Clean v37
// @version      37
// @description  FIXED: Collapsible sections expanded by default. Comprehensive dashboard with time toggle, top merchants, largest transactions, weekly breakdown, export CSV.
// @author       You
// @match        *://*.wellsfargo.com/*
// @match        *://wellsfargo.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ========================================
    // CONFIGURATION
    // ========================================

    const CONFIG = {
        DEBUG: true,
        STORAGE_KEY: 'wf_sidebar_position',
        SETTINGS_KEY: 'wf_sidebar_settings',
        OBSERVER: {
            THROTTLE_DELAY: 500,
            INITIAL_DELAYS: [1000, 3000],
            CONTINUOUS_INTERVAL: 5000
        },
        SIDEBAR: {
            DEFAULT_TOP: 100,
            DEFAULT_RIGHT: 20,
            DEFAULT_LEFT: null,
            MINIMIZED_WIDTH: 150,
            EXPANDED_WIDTH: 320,
            STARTS_MINIMIZED: false,
            DEFAULT_DAYS: 32,
            DAY_OPTIONS: [7, 14, 30, 32]
        },
        PENDING: {
            BORDER_COLOR: '#7C3AED',
            BORDER_WIDTH: '4px',
            BACKGROUND_COLOR: '#FFFFFF',
            SQUARE_SIZE: '18px'
        },
        COLORS: {
            CREDIT_BACKGROUND: '#ffffcc',
            DEBIT_TEXT: '#d32f2f',
            POSITIVE_FLOW: '#059669',
            NEGATIVE_FLOW: '#dc2626'
        },
        SELECTORS: {
            deals: [
                '[data-testid="deals-section"]',
                '.WellsFargoDeals__deals-tile-wrapper___EjLde',
                'div[class*="WellsFargoDeals__deals-tile-wrapper"]',
                'div[class*="deals-tile"]',
                '[data-testid*="deals"]'
            ],
            disclosures: [
                '[data-testid="account-disclosures"]',
                '.AccountDisclosures__disclosure-list___PmtNX',
                'div[class*="AccountDisclosures__disclosure-list"]',
                'div[class*="disclosure-list"]',
                '[data-testid*="disclosures"]'
            ],
            promos: [
                '[data-testid*="promo"]',
                '[data-testid*="offer"]',
                '[data-testid*="banner"]',
                'div[class*="promo"]',
                'div[class*="offer"]',
                'div[class*="banner"]',
                'div[class*="marketing"]'
            ],
            footer: [
                '#core-footer-container',
                '[data-page-footer]',
                '.Footer__footerDesktop___M7Z1F',
                'div[role="contentinfo"]',
                '.FooterLinks__gutter___dVQKs',
                '.FooterLinks__desktop___THcBX'
            ],
            qrCode: [
                '[data-testid="qr-phone-image"]',
                '.MobileQR__phone___Gfscv',
                'img[src*="qrcode"]',
                'img[src*="QR"]',
                'img[alt*="Scan the QR code"]',
                'img[alt*="QR code"]',
                'img[alt*="mobile app"]',
                'div[class*="MobileQR"]'
            ],
            transactionRow: 'tr[role="row"]',
            switchAccount: '.SwitchAccounts__label___Qsi_E, [class*="SwitchAccounts__label"]',
            balance: '.AccountTile__balance___fNGYy, [class*="balance"], .balance'
        }
    };

    // ========================================
    // STATE MANAGEMENT
    // ========================================

    const state = {
        processedElements: new WeakSet(),
        processedTransactions: new WeakSet(),
        sidebar: null,
        sidebarVisible: false,
        lastCalculation: null,
        allTransactions: [], // Store all parsed transactions
        observer: null,
        throttleTimeout: null,
        continuousInterval: null,
        dockedSide: 'right',
        selectedDays: CONFIG.SIDEBAR.DEFAULT_DAYS,
        currentBalance: null,
        expandedSections: {
            merchants: true,
            largest: true,
            weekly: true
        },
        dragState: {
            isDragging: false,
            startX: 0,
            startY: 0,
            initialX: 0,
            initialY: 0
        }
    };

    // ========================================
    // LOGGING UTILITY
    // ========================================

    const Logger = {
        prefix: '[Wells Fargo v37]',

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
        },

        info(...args) {
            console.info(this.prefix, ...args);
        }
    };

    // ========================================
    // STORAGE UTILITY
    // ========================================

    const Storage = {
        save(key, data) {
            try {
                localStorage.setItem(key, JSON.stringify(data));
            } catch (e) {
                Logger.warn('Failed to save:', e);
            }
        },

        load(key) {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                Logger.warn('Failed to load:', e);
                return null;
            }
        },

        clear(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                Logger.warn('Failed to clear:', e);
            }
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
                return true;
            } catch (error) {
                return false;
            }
        },

        parseAmount(text) {
            if (!text) return 0;
            const cleaned = text.replace(/[$,]/g, '').trim();
            const amount = parseFloat(cleaned);
            return isNaN(amount) ? 0 : amount;
        },

        parseDate(dateText) {
            const cleaned = dateText.trim();
            const dateParts = cleaned.split('/');

            if (dateParts.length !== 3) return null;

            const month = parseInt(dateParts[0], 10) - 1;
            const day = parseInt(dateParts[1], 10);
            let year = parseInt(dateParts[2], 10);

            if (year < 100) {
                year = year < 50 ? 2000 + year : 1900 + year;
            }

            const date = new Date(year, month, day);
            return isNaN(date.getTime()) ? null : date;
        },

        formatCurrency(amount) {
            return '$' + Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        },

        formatCurrencyWithSign(amount) {
            const prefix = amount >= 0 ? '+' : '-';
            return prefix + '$' + Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        },

        extractMerchant(description) {
            if (!description) return 'Unknown';

            // Clean up common patterns
            let merchant = description
                .replace(/PURCHASE AUTHORIZED ON \d{2}\/\d{2}/, '')
                .replace(/CARD \d+/, '')
                .replace(/P\d+/, '')
                .replace(/DEBIT CARD PURCHASE/, '')
                .replace(/POS PURCHASE/, '')
                .replace(/CHECKCARD \d+/, '')
                .replace(/\d{10,}/, '')
                .replace(/\s{2,}/g, ' ')
                .trim();

            // Extract main merchant name (usually first few words)
            const words = merchant.split(' ').filter(w => w.length > 0);
            if (words.length > 3) {
                merchant = words.slice(0, 3).join(' ');
            }

            return merchant || 'Unknown';
        },

        getWeekNumber(date) {
            const startOfYear = new Date(date.getFullYear(), 0, 1);
            const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
            return Math.ceil((days + startOfYear.getDay() + 1) / 7);
        }
    };

    // ========================================
    // AD REMOVER
    // ========================================

    const AdRemover = {
        removeBySelectors(selectorList, reason) {
            let count = 0;
            selectorList.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (Utils.removeElement(element, reason)) {
                        count++;
                    }
                });
            });
            return count;
        },

        removeAll() {
            let totalRemoved = 0;
            totalRemoved += this.removeBySelectors(CONFIG.SELECTORS.deals, 'Deals');
            totalRemoved += this.removeBySelectors(CONFIG.SELECTORS.disclosures, 'Disclosures');
            totalRemoved += this.removeBySelectors(CONFIG.SELECTORS.promos, 'Promos');
            totalRemoved += this.removeBySelectors(CONFIG.SELECTORS.footer, 'Footer');
            totalRemoved += this.removeBySelectors(CONFIG.SELECTORS.qrCode, 'QR');

            // Remove by headings
            const unwantedHeadings = ['Wells Fargo Deals', 'My Wells Fargo Deals', 'Account Disclosures'];
            document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
                if (state.processedElements.has(heading)) return;
                const text = heading.textContent.trim();
                if (unwantedHeadings.some(kw => text.includes(kw))) {
                    const container = heading.closest('section') || heading.closest('div[class*="tile"]');
                    if (Utils.removeElement(container || heading)) totalRemoved++;
                }
            });

            return totalRemoved;
        }
    };

    // ========================================
    // PENDING TRANSACTIONS STYLER
    // ========================================

    const PendingTransactions = {
        markPending() {
            const allRows = document.querySelectorAll('tr[role="row"]');
            let pendingHeaderRow = null;
            let pendingRows = [];
            let isPendingSection = false;

            allRows.forEach(row => {
                const rowText = row.textContent.toLowerCase();

                if (rowText.includes('pending')) {
                    isPendingSection = true;
                    pendingHeaderRow = row;
                    return;
                }

                if (rowText.includes('posted')) {
                    isPendingSection = false;
                    return;
                }

                if (isPendingSection && row.querySelectorAll('td').length > 3) {
                    pendingRows.push(row);
                }
            });

            if (pendingHeaderRow && pendingRows.length > 0) {
                // Add square marker
                const pendingCell = Array.from(pendingHeaderRow.querySelectorAll('th')).find(th =>
                    th.textContent.toLowerCase().includes('pending')
                );

                if (pendingCell && !pendingCell.querySelector('#pending-square-marker')) {
                    const marker = document.createElement('div');
                    marker.id = 'pending-square-marker';
                    marker.style.cssText = `
                        display: inline-block;
                        width: 18px; height: 18px;
                        background-color: ${CONFIG.PENDING.BORDER_COLOR};
                        border: 2px solid #5B21B6;
                        margin-right: 10px;
                        vertical-align: middle;
                    `;
                    pendingCell.insertBefore(marker, pendingCell.firstChild);
                }

                // Style rows
                if (!pendingHeaderRow.hasAttribute('data-pending-styled')) {
                    pendingHeaderRow.style.borderTop = `${CONFIG.PENDING.BORDER_WIDTH} solid ${CONFIG.PENDING.BORDER_COLOR}`;
                    pendingHeaderRow.style.borderLeft = `${CONFIG.PENDING.BORDER_WIDTH} solid ${CONFIG.PENDING.BORDER_COLOR}`;
                    pendingHeaderRow.style.borderRight = `${CONFIG.PENDING.BORDER_WIDTH} solid ${CONFIG.PENDING.BORDER_COLOR}`;
                    pendingHeaderRow.setAttribute('data-pending-styled', 'true');
                }

                pendingRows.forEach((row, index) => {
                    if (!row.hasAttribute('data-pending-styled')) {
                        row.style.borderLeft = `${CONFIG.PENDING.BORDER_WIDTH} solid ${CONFIG.PENDING.BORDER_COLOR}`;
                        row.style.borderRight = `${CONFIG.PENDING.BORDER_WIDTH} solid ${CONFIG.PENDING.BORDER_COLOR}`;
                        if (index === pendingRows.length - 1) {
                            row.style.borderBottom = `${CONFIG.PENDING.BORDER_WIDTH} solid ${CONFIG.PENDING.BORDER_COLOR}`;
                        }
                        row.setAttribute('data-pending-styled', 'true');
                    }
                });
            }
        }
    };

    // ========================================
    // TRANSACTION PROCESSOR
    // ========================================

    const TransactionProcessor = {
        process() {
            const allRows = document.querySelectorAll('tr[role="row"]');

            allRows.forEach(row => {
                if (state.processedTransactions.has(row)) return;

                const cells = row.querySelectorAll('td');
                if (cells.length < 3) return;

                // Highlight credits
                const creditCell = cells[3];
                if (creditCell && creditCell.classList.contains('TransactionsRow__deposits_or_credits___WRgUG')) {
                    const text = creditCell.textContent.trim();
                    if (text.match(/^\$[\d,]+\.\d{2}$/)) {
                        row.style.backgroundColor = CONFIG.COLORS.CREDIT_BACKGROUND;
                        row.style.transition = 'background-color 0.3s ease';
                    }
                }

                // Color debits red
                const debitCell = cells[4];
                if (debitCell && debitCell.classList.contains('TransactionsRow__withdrawals_or_debits___z95J7')) {
                    const text = debitCell.textContent.trim();
                    if (text.match(/^\$[\d,]+\.\d{2}$/)) {
                        const amountSpan = debitCell.querySelector('span') || debitCell;
                        amountSpan.style.color = CONFIG.COLORS.DEBIT_TEXT;
                        amountSpan.style.fontWeight = '500';
                    }
                }

                state.processedTransactions.add(row);
            });
        }
    };

    // ========================================
    // COMPREHENSIVE CALCULATOR
    // ========================================

    const Calculator = {
        parseAllTransactions() {
            const allRows = document.querySelectorAll('tr[role="row"]');
            const transactions = [];
            let isPendingSection = false;

            allRows.forEach((row) => {
                const rowText = row.textContent.toLowerCase();

                if (rowText.includes('pending transactions') || rowText.includes('authorized transactions')) {
                    isPendingSection = true;
                    return;
                }
                if (rowText.includes('posted transactions')) {
                    isPendingSection = false;
                    return;
                }

                const cells = row.querySelectorAll('td');
                if (cells.length < 5) return;

                // Find date
                let dateText = '';
                for (let i = 0; i < Math.min(3, cells.length); i++) {
                    const cellText = cells[i].textContent.trim();
                    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cellText)) {
                        dateText = cellText;
                        break;
                    }
                }

                if (!dateText) return;

                const date = Utils.parseDate(dateText);
                if (!date) return;

                // Get description
                const descCell = cells[1] || cells[2];
                const description = descCell ? descCell.textContent.trim() : '';
                const merchant = Utils.extractMerchant(description);

                // Check for credit
                const creditCell = cells[3];
                let creditAmount = 0;
                if (creditCell && creditCell.classList.contains('TransactionsRow__deposits_or_credits___WRgUG')) {
                    const text = creditCell.textContent.trim();
                    if (text.match(/^\$[\d,]+\.\d{2}$/)) {
                        creditAmount = Utils.parseAmount(text);
                    }
                }

                // Check for debit
                const debitCell = cells[4];
                let debitAmount = 0;
                if (debitCell && debitCell.classList.contains('TransactionsRow__withdrawals_or_debits___z95J7')) {
                    const text = debitCell.textContent.trim();
                    if (text.match(/^\$[\d,]+\.\d{2}$/)) {
                        debitAmount = Utils.parseAmount(text);
                    }
                }

                if (creditAmount > 0 || debitAmount > 0) {
                    transactions.push({
                        date,
                        dateText,
                        description,
                        merchant,
                        credit: creditAmount,
                        debit: debitAmount,
                        isPending: isPendingSection,
                        week: Utils.getWeekNumber(date)
                    });
                }
            });

            state.allTransactions = transactions;
            return transactions;
        },

        calculate(days = state.selectedDays) {
            const transactions = this.parseAllTransactions();

            const currentDate = new Date();
            currentDate.setHours(23, 59, 59, 999);

            const cutoffDate = new Date();
            cutoffDate.setDate(currentDate.getDate() - days);
            cutoffDate.setHours(0, 0, 0, 0);

            // Filter transactions in range
            const inRange = transactions.filter(t => t.date >= cutoffDate && t.date <= currentDate);

            // Basic totals
            let postedCredits = 0, postedDebits = 0, pendingCredits = 0, pendingDebits = 0;
            let postedCreditCount = 0, postedDebitCount = 0, pendingCreditCount = 0, pendingDebitCount = 0;

            // Merchant tracking
            const merchantDebits = {};
            const merchantCredits = {};

            // Largest transactions
            let largestCredit = { amount: 0, description: '', date: '' };
            let largestDebit = { amount: 0, description: '', date: '' };

            // Weekly breakdown
            const weeklyData = {};

            inRange.forEach(t => {
                if (t.isPending) {
                    if (t.credit > 0) { pendingCredits += t.credit; pendingCreditCount++; }
                    if (t.debit > 0) { pendingDebits += t.debit; pendingDebitCount++; }
                } else {
                    if (t.credit > 0) { postedCredits += t.credit; postedCreditCount++; }
                    if (t.debit > 0) { postedDebits += t.debit; postedDebitCount++; }
                }

                // Merchant tracking
                if (t.debit > 0) {
                    merchantDebits[t.merchant] = (merchantDebits[t.merchant] || 0) + t.debit;
                }
                if (t.credit > 0) {
                    merchantCredits[t.merchant] = (merchantCredits[t.merchant] || 0) + t.credit;
                }

                // Largest transactions
                if (t.credit > largestCredit.amount) {
                    largestCredit = { amount: t.credit, description: t.description.substring(0, 30), date: t.dateText };
                }
                if (t.debit > largestDebit.amount) {
                    largestDebit = { amount: t.debit, description: t.description.substring(0, 30), date: t.dateText };
                }

                // Weekly breakdown
                const weekKey = `W${t.week}`;
                if (!weeklyData[weekKey]) {
                    weeklyData[weekKey] = { credits: 0, debits: 0 };
                }
                weeklyData[weekKey].credits += t.credit;
                weeklyData[weekKey].debits += t.debit;
            });

            // Sort merchants by amount
            const topMerchants = Object.entries(merchantDebits)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            const topCreditSources = Object.entries(merchantCredits)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            // Calculate totals
            const totalCredits = postedCredits + pendingCredits;
            const totalDebits = postedDebits + pendingDebits;
            const netFlow = totalCredits - totalDebits;

            const result = {
                days,
                posted: {
                    credits: { total: postedCredits, count: postedCreditCount },
                    debits: { total: postedDebits, count: postedDebitCount }
                },
                pending: {
                    credits: { total: pendingCredits, count: pendingCreditCount },
                    debits: { total: pendingDebits, count: pendingDebitCount }
                },
                totals: {
                    credits: totalCredits,
                    debits: totalDebits,
                    netFlow,
                    creditCount: postedCreditCount + pendingCreditCount,
                    debitCount: postedDebitCount + pendingDebitCount
                },
                averages: {
                    dailyCredits: totalCredits / days,
                    dailyDebits: totalDebits / days,
                    dailyNet: netFlow / days
                },
                topMerchants,
                topCreditSources,
                largestCredit,
                largestDebit,
                weeklyData,
                transactions: inRange
            };

            state.lastCalculation = result;
            return result;
        },

        getBalance() {
            // Try to find balance on page
            const balanceSelectors = [
                '.AccountTile__balance___fNGYy',
                '[class*="AccountTile__balance"]',
                '[class*="balance"]',
                '.available-balance',
                '[data-testid*="balance"]'
            ];

            for (const selector of balanceSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                    const text = el.textContent;
                    const match = text.match(/\$[\d,]+\.\d{2}/);
                    if (match) {
                        state.currentBalance = Utils.parseAmount(match[0]);
                        return state.currentBalance;
                    }
                }
            }

            return null;
        },

        exportCSV() {
            const transactions = state.allTransactions;
            if (transactions.length === 0) {
                alert('No transactions to export');
                return;
            }

            let csv = 'Date,Description,Merchant,Credit,Debit,Pending\n';
            transactions.forEach(t => {
                const desc = t.description.replace(/,/g, ';').replace(/"/g, "'");
                csv += `${t.dateText},"${desc}","${t.merchant}",${t.credit || ''},${t.debit || ''},${t.isPending ? 'Yes' : 'No'}\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `wells-fargo-transactions-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Logger.info('CSV exported with ' + transactions.length + ' transactions');
        }
    };

    // ========================================
    // SIDEBAR MANAGER
    // ========================================

    const SidebarManager = {
        isVisible() {
            const switchAccount = document.querySelectorAll(CONFIG.SELECTORS.switchAccount);
            if (switchAccount.length > 0) return true;
            return document.body.textContent.includes('Switch Account');
        },

        create() {
            if (state.sidebar) return;

            // Load saved settings
            const savedSettings = Storage.load(CONFIG.SETTINGS_KEY);
            if (savedSettings) {
                state.selectedDays = savedSettings.days || CONFIG.SIDEBAR.DEFAULT_DAYS;
                state.expandedSections = savedSettings.expandedSections || state.expandedSections;
            }

            const savedPosition = Storage.load(CONFIG.STORAGE_KEY);

            const sidebar = document.createElement('div');
            sidebar.id = 'wf-credit-sidebar';

            let positionStyle = savedPosition
                ? `top: ${savedPosition.top}px; ${savedPosition.side === 'left' ? 'left' : 'right'}: ${savedPosition.offset}px; ${savedPosition.side === 'left' ? 'right: auto;' : 'left: auto;'}`
                : `top: ${CONFIG.SIDEBAR.DEFAULT_TOP}px; right: ${CONFIG.SIDEBAR.DEFAULT_RIGHT}px;`;

            if (savedPosition) state.dockedSide = savedPosition.side || 'right';

            sidebar.style.cssText = `
                position: fixed;
                ${positionStyle}
                width: ${CONFIG.SIDEBAR.EXPANDED_WIDTH}px;
                max-height: 85vh;
                overflow-y: auto;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: 2px solid #5a67d8;
                border-radius: 12px;
                padding: 12px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                cursor: move;
                font-family: Arial, sans-serif;
                color: white;
                user-select: none;
            `;

            sidebar.innerHTML = this.buildHTML();
            document.body.appendChild(sidebar);
            state.sidebar = sidebar;

            this.setupEventListeners();
            this.setupDragging(sidebar);

            Logger.log('Comprehensive sidebar created (v35)');
        },

        buildHTML() {
            const days = state.selectedDays;
            return `
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid rgba(255,255,255,0.3);">
                    <span style="font-size: 14px; font-weight: bold;">💰 Financial Dashboard</span>
                    <div style="display: flex; gap: 4px;">
                        <button id="wf-dock-left" title="Dock Left" style="width: 22px; height: 22px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; color: white; cursor: pointer; font-size: 10px;">◀</button>
                        <button id="wf-dock-right" title="Dock Right" style="width: 22px; height: 22px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; color: white; cursor: pointer; font-size: 10px;">▶</button>
                    </div>
                </div>

                <!-- Time Period Toggle -->
                <div style="display: flex; gap: 4px; margin-bottom: 10px; justify-content: center;">
                    ${CONFIG.SIDEBAR.DAY_OPTIONS.map(d => `
                        <button class="wf-day-btn" data-days="${d}" style="padding: 4px 8px; background: ${d === days ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)'}; color: ${d === days ? '#333' : 'white'}; border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: ${d === days ? 'bold' : 'normal'};">${d}d</button>
                    `).join('')}
                </div>

                <!-- Balance (if available) -->
                <div id="wf-balance-section" style="background: rgba(255,255,255,0.9); border-radius: 8px; padding: 8px; margin-bottom: 8px; display: none;">
                    <div style="font-size: 10px; color: #333; font-weight: 600;">🏦 Current Balance</div>
                    <div id="wf-balance" style="font-size: 20px; font-weight: bold; color: #1e40af;">$0.00</div>
                </div>

                <!-- Credits -->
                <div style="background: rgba(255,255,255,0.9); border-radius: 8px; padding: 8px; margin-bottom: 8px;">
                    <div style="font-size: 10px; color: #333; font-weight: 600;">💵 Credits</div>
                    <div id="wf-credit-total" style="font-size: 20px; font-weight: bold; color: #059669;">$0.00</div>
                    <div id="wf-credit-breakdown" style="font-size: 9px; color: #666;">Posted: $0 | Pending: $0</div>
                    <div style="font-size: 10px; color: #555;">Avg: <span id="wf-daily-credit" style="color: #059669; font-weight: 600;">$0</span>/day</div>
                </div>

                <!-- Debits -->
                <div style="background: rgba(255,255,255,0.9); border-radius: 8px; padding: 8px; margin-bottom: 8px;">
                    <div style="font-size: 10px; color: #333; font-weight: 600;">🔴 Debits</div>
                    <div id="wf-debit-total" style="font-size: 20px; font-weight: bold; color: #dc2626;">$0.00</div>
                    <div id="wf-debit-breakdown" style="font-size: 9px; color: #666;">Posted: $0 | Pending: $0</div>
                    <div style="font-size: 10px; color: #555;">Avg: <span id="wf-daily-debit" style="color: #dc2626; font-weight: 600;">$0</span>/day</div>
                </div>

                <!-- Net Flow -->
                <div style="background: rgba(255,255,255,0.95); border-radius: 8px; padding: 8px; margin-bottom: 8px; border: 2px solid rgba(100,100,100,0.2);">
                    <div style="font-size: 10px; color: #333; font-weight: 600;">📈 Net Flow</div>
                    <div id="wf-net-flow" style="font-size: 20px; font-weight: bold;">$0.00</div>
                    <div style="font-size: 10px; color: #555;">Avg: <span id="wf-daily-net" style="font-weight: 600;">$0</span>/day</div>
                </div>

                <!-- Collapsible: Top Merchants -->
                <div style="background: rgba(255,255,255,0.9); border-radius: 8px; margin-bottom: 8px; overflow: hidden;">
                    <div id="wf-merchants-header" style="padding: 10px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 12px; color: #333; font-weight: 600;">🏪 Top Spending</span>
                        <span id="wf-merchants-arrow" style="font-size: 12px; color: #666;">${state.expandedSections.merchants ? '▼' : '▶'}</span>
                    </div>
                    <div id="wf-merchants-content" style="padding: 0 10px 10px 10px; display: ${state.expandedSections.merchants ? 'block' : 'none'}; font-size: 12px; color: #333;"></div>
                </div>

                <!-- Collapsible: Largest Transactions -->
                <div style="background: rgba(255,255,255,0.9); border-radius: 8px; margin-bottom: 8px; overflow: hidden;">
                    <div id="wf-largest-header" style="padding: 10px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 12px; color: #333; font-weight: 600;">🔥 Largest Transactions</span>
                        <span id="wf-largest-arrow" style="font-size: 12px; color: #666;">${state.expandedSections.largest ? '▼' : '▶'}</span>
                    </div>
                    <div id="wf-largest-content" style="padding: 0 10px 10px 10px; display: ${state.expandedSections.largest ? 'block' : 'none'}; font-size: 12px; color: #333;"></div>
                </div>

                <!-- Collapsible: Weekly Breakdown -->
                <div style="background: rgba(255,255,255,0.9); border-radius: 8px; margin-bottom: 8px; overflow: hidden;">
                    <div id="wf-weekly-header" style="padding: 10px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 12px; color: #333; font-weight: 600;">📅 Weekly Breakdown</span>
                        <span id="wf-weekly-arrow" style="font-size: 12px; color: #666;">${state.expandedSections.weekly ? '▼' : '▶'}</span>
                    </div>
                    <div id="wf-weekly-content" style="padding: 0 10px 10px 10px; display: ${state.expandedSections.weekly ? 'block' : 'none'}; font-size: 12px; color: #333;"></div>
                </div>

                <!-- Transaction Count -->
                <div id="wf-txn-count" style="font-size: 9px; text-align: center; color: #fff; margin-bottom: 8px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
                    0 transactions
                </div>

                <!-- Buttons -->
                <div style="display: flex; gap: 4px;">
                    <button id="wf-refresh-btn" style="flex: 1; padding: 6px; background: rgba(255,255,255,0.9); border: 1px solid rgba(100,100,100,0.3); border-radius: 6px; color: #333; font-weight: bold; cursor: pointer; font-size: 11px;">🔄 Refresh</button>
                    <button id="wf-export-btn" style="padding: 6px 10px; background: rgba(255,255,255,0.9); border: 1px solid rgba(100,100,100,0.3); border-radius: 6px; color: #333; cursor: pointer; font-size: 11px;" title="Export CSV">📥</button>
                    <button id="wf-reset-btn" style="padding: 6px 10px; background: rgba(255,255,255,0.9); border: 1px solid rgba(100,100,100,0.3); border-radius: 6px; color: #333; cursor: pointer; font-size: 11px;" title="Reset Position">📍</button>
                </div>
            `;
        },

        setupEventListeners() {
            // Day toggle buttons
            document.querySelectorAll('.wf-day-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const days = parseInt(btn.dataset.days);
                    state.selectedDays = days;

                    // Update button styles
                    document.querySelectorAll('.wf-day-btn').forEach(b => {
                        b.style.background = 'rgba(255,255,255,0.2)';
                        b.style.color = 'white';
                        b.style.fontWeight = 'normal';
                    });
                    btn.style.background = 'rgba(255,255,255,0.9)';
                    btn.style.color = '#333';
                    btn.style.fontWeight = 'bold';

                    this.saveSettings();
                    this.updateDisplay();
                });
            });

            // Dock buttons
            document.getElementById('wf-dock-left')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dockToSide('left');
            });

            document.getElementById('wf-dock-right')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dockToSide('right');
            });

            // Collapsible sections
            ['merchants', 'largest', 'weekly'].forEach(section => {
                document.getElementById(`wf-${section}-header`)?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    state.expandedSections[section] = !state.expandedSections[section];
                    const content = document.getElementById(`wf-${section}-content`);
                    const arrow = document.getElementById(`wf-${section}-arrow`);
                    if (content) content.style.display = state.expandedSections[section] ? 'block' : 'none';
                    if (arrow) arrow.textContent = state.expandedSections[section] ? '▼' : '▶';
                    this.saveSettings();
                });
            });

            // Refresh button
            document.getElementById('wf-refresh-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.updateDisplay();
            });

            // Export button
            document.getElementById('wf-export-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                Calculator.exportCSV();
            });

            // Reset position button
            document.getElementById('wf-reset-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                Storage.clear(CONFIG.STORAGE_KEY);
                state.sidebar.style.transition = 'all 0.3s ease';
                state.sidebar.style.top = CONFIG.SIDEBAR.DEFAULT_TOP + 'px';
                state.sidebar.style.right = CONFIG.SIDEBAR.DEFAULT_RIGHT + 'px';
                state.sidebar.style.left = 'auto';
                state.dockedSide = 'right';
                setTimeout(() => { state.sidebar.style.transition = 'none'; }, 300);
            });
        },

        dockToSide(side) {
            if (!state.sidebar) return;
            state.dockedSide = side;
            state.sidebar.style.transition = 'all 0.3s ease';

            if (side === 'left') {
                state.sidebar.style.left = '20px';
                state.sidebar.style.right = 'auto';
            } else {
                state.sidebar.style.right = '20px';
                state.sidebar.style.left = 'auto';
            }

            this.savePosition();
            setTimeout(() => { state.sidebar.style.transition = 'none'; }, 300);
        },

        savePosition() {
            if (!state.sidebar) return;
            const rect = state.sidebar.getBoundingClientRect();
            Storage.save(CONFIG.STORAGE_KEY, {
                top: rect.top,
                side: state.dockedSide,
                offset: state.dockedSide === 'left' ? rect.left : (window.innerWidth - rect.right)
            });
        },

        saveSettings() {
            Storage.save(CONFIG.SETTINGS_KEY, {
                days: state.selectedDays,
                expandedSections: state.expandedSections
            });
        },

        setupDragging(sidebar) {
            const drag = state.dragState;

            const onMouseDown = (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

                drag.isDragging = true;
                drag.startX = e.clientX;
                drag.startY = e.clientY;

                const rect = sidebar.getBoundingClientRect();
                drag.initialX = rect.left;
                drag.initialY = rect.top;

                sidebar.style.cursor = 'grabbing';
                sidebar.style.transition = 'none';
                e.preventDefault();
            };

            const onMouseMove = (e) => {
                if (!drag.isDragging) return;
                e.preventDefault();

                const deltaX = e.clientX - drag.startX;
                const deltaY = e.clientY - drag.startY;

                const newX = Math.max(10, Math.min(drag.initialX + deltaX, window.innerWidth - sidebar.offsetWidth - 10));
                const newY = Math.max(10, Math.min(drag.initialY + deltaY, window.innerHeight - sidebar.offsetHeight - 10));

                sidebar.style.left = newX + 'px';
                sidebar.style.top = newY + 'px';
                sidebar.style.right = 'auto';

                state.dockedSide = newX < window.innerWidth / 2 ? 'left' : 'right';
            };

            const onMouseUp = () => {
                if (drag.isDragging) {
                    drag.isDragging = false;
                    sidebar.style.cursor = 'move';
                    this.savePosition();
                }
            };

            sidebar.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        },

        updateDisplay() {
            const result = Calculator.calculate(state.selectedDays);

            // Balance
            const balance = Calculator.getBalance();
            const balanceSection = document.getElementById('wf-balance-section');
            const balanceEl = document.getElementById('wf-balance');
            if (balance !== null && balanceSection && balanceEl) {
                balanceSection.style.display = 'block';
                balanceEl.textContent = Utils.formatCurrency(balance);
            }

            // Credits
            document.getElementById('wf-credit-total').textContent = Utils.formatCurrency(result.totals.credits);
            document.getElementById('wf-credit-breakdown').textContent = `Posted: ${Utils.formatCurrency(result.posted.credits.total)} | Pending: ${Utils.formatCurrency(result.pending.credits.total)}`;
            document.getElementById('wf-daily-credit').textContent = Utils.formatCurrency(result.averages.dailyCredits);

            // Debits
            document.getElementById('wf-debit-total').textContent = Utils.formatCurrency(result.totals.debits);
            document.getElementById('wf-debit-breakdown').textContent = `Posted: ${Utils.formatCurrency(result.posted.debits.total)} | Pending: ${Utils.formatCurrency(result.pending.debits.total)}`;
            document.getElementById('wf-daily-debit').textContent = Utils.formatCurrency(result.averages.dailyDebits);

            // Net Flow
            const netFlowEl = document.getElementById('wf-net-flow');
            const dailyNetEl = document.getElementById('wf-daily-net');
            netFlowEl.textContent = Utils.formatCurrencyWithSign(result.totals.netFlow);
            netFlowEl.style.color = result.totals.netFlow >= 0 ? CONFIG.COLORS.POSITIVE_FLOW : CONFIG.COLORS.NEGATIVE_FLOW;
            dailyNetEl.textContent = Utils.formatCurrencyWithSign(result.averages.dailyNet);
            dailyNetEl.style.color = result.averages.dailyNet >= 0 ? CONFIG.COLORS.POSITIVE_FLOW : CONFIG.COLORS.NEGATIVE_FLOW;

            // Top Merchants
            const merchantsContent = document.getElementById('wf-merchants-content');
            if (merchantsContent) {
                if (result.topMerchants.length > 0) {
                    merchantsContent.innerHTML = result.topMerchants.map((m, i) =>
                        `<div style="display: flex; justify-content: space-between; padding: 4px 0; ${i > 0 ? 'border-top: 1px solid #eee;' : ''}">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; font-size: 12px;">${m[0]}</span>
                            <span style="color: #dc2626; font-weight: 600; font-size: 12px;">${Utils.formatCurrency(m[1])}</span>
                        </div>`
                    ).join('');
                } else {
                    merchantsContent.innerHTML = '<div style="color: #666; font-size: 12px;">No spending data</div>';
                }
            }

            // Largest Transactions
            const largestContent = document.getElementById('wf-largest-content');
            if (largestContent) {
                let html = '';
                if (result.largestCredit.amount > 0) {
                    html += `<div style="padding: 4px 0;">
                        <div style="color: #059669; font-weight: 600; font-size: 13px;">↑ Largest Credit: ${Utils.formatCurrency(result.largestCredit.amount)}</div>
                        <div style="font-size: 11px; color: #666; margin-top: 2px;">${result.largestCredit.date} - ${result.largestCredit.description}...</div>
                    </div>`;
                }
                if (result.largestDebit.amount > 0) {
                    html += `<div style="padding: 4px 0; ${result.largestCredit.amount > 0 ? 'border-top: 1px solid #eee; margin-top: 6px; padding-top: 6px;' : ''}">
                        <div style="color: #dc2626; font-weight: 600; font-size: 13px;">↓ Largest Debit: ${Utils.formatCurrency(result.largestDebit.amount)}</div>
                        <div style="font-size: 11px; color: #666; margin-top: 2px;">${result.largestDebit.date} - ${result.largestDebit.description}...</div>
                    </div>`;
                }
                largestContent.innerHTML = html || '<div style="color: #666; font-size: 12px;">No transaction data</div>';
            }

            // Weekly Breakdown
            const weeklyContent = document.getElementById('wf-weekly-content');
            if (weeklyContent) {
                const weeks = Object.entries(result.weeklyData).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4);
                if (weeks.length > 0) {
                    weeklyContent.innerHTML = weeks.map((w, i) =>
                        `<div style="display: flex; justify-content: space-between; padding: 5px 0; ${i > 0 ? 'border-top: 1px solid #eee;' : ''}">
                            <span style="font-size: 12px; font-weight: 500;">${w[0]}</span>
                            <span style="font-size: 12px;"><span style="color: #059669; font-weight: 600;">+${Utils.formatCurrency(w[1].credits)}</span> / <span style="color: #dc2626; font-weight: 600;">-${Utils.formatCurrency(w[1].debits)}</span></span>
                        </div>`
                    ).join('');
                } else {
                    weeklyContent.innerHTML = '<div style="color: #666; font-size: 12px;">No weekly data</div>';
                }
            }

            // Transaction count
            document.getElementById('wf-txn-count').textContent = `${result.totals.creditCount} credits | ${result.totals.debitCount} debits in ${result.days} days`;

            Logger.info('Display updated');
        },

        manageVisibility() {
            if (this.isVisible()) {
                if (!state.sidebar) {
                    this.create();
                    this.updateDisplay();
                    state.sidebarVisible = true;
                } else if (state.sidebar.style.display === 'none') {
                    state.sidebar.style.display = 'block';
                    state.sidebarVisible = true;
                    this.updateDisplay();
                }
            }
        }
    };

    // ========================================
    // MAIN EXECUTION
    // ========================================

    function runAll() {
        try {
            AdRemover.removeAll();
            PendingTransactions.markPending();
            TransactionProcessor.process();
            SidebarManager.manageVisibility();

            if (state.sidebarVisible && state.sidebar && state.sidebar.style.display !== 'none') {
                SidebarManager.updateDisplay();
            }
        } catch (error) {
            Logger.error('Execution error:', error);
        }
    }

    const throttledRunAll = Utils.throttle(runAll, CONFIG.OBSERVER.THROTTLE_DELAY);

    // ========================================
    // OBSERVER SETUP
    // ========================================

    function setupObserver() {
        if (state.observer) state.observer.disconnect();

        state.observer = new MutationObserver((mutations) => {
            const hasRelevantChanges = mutations.some(m => m.addedNodes.length > 0 || m.type === 'childList');
            if (hasRelevantChanges) throttledRunAll();
        });

        state.observer.observe(document.body, { childList: true, subtree: true });
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    function initialize() {
        try {
            Logger.log('========================================');
            Logger.log('Wells Fargo Clean v37 LOADED');
            Logger.log('FIXED: Sections expanded by default');
            Logger.log('FEATURES:');
            Logger.log('  ✅ Time period toggle (7/14/30/32 days)');
            Logger.log('  ✅ Current balance display');
            Logger.log('  ✅ Top merchants / spending categories');
            Logger.log('  ✅ Largest transactions');
            Logger.log('  ✅ Weekly breakdown comparison');
            Logger.log('  ✅ Export to CSV');
            Logger.log('  ✅ Position & settings memory');
            Logger.log('========================================');

            CONFIG.OBSERVER.INITIAL_DELAYS.forEach((delay, index) => {
                setTimeout(() => runAll(), delay);
            });

            setupObserver();

            state.continuousInterval = setInterval(() => runAll(), CONFIG.OBSERVER.CONTINUOUS_INTERVAL);

            window.addEventListener('beforeunload', () => {
                if (state.observer) state.observer.disconnect();
                if (state.continuousInterval) clearInterval(state.continuousInterval);
            });

        } catch (error) {
            Logger.error('Initialization failed:', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();