// ==UserScript==
// @name         Apple Bank Dashboard v1
// @namespace    AppleBankDashboard
// @version      1
// @description  Spending tracker for Apple Bank. Fixed vertical drag. Alt+Shift+X to toggle.
// @match        https://*.applebank.com/*
// @match        https://applebank.com/*
// @match        https://online.applebank.com/*
// @match        https://secure.applebank.com/*
// @match        https://secure.applebankdirectonline.com/*
// @match        https://*.applebankdirectonline.com/*
// @match        https://applebankdirectonline.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/**
 * APPLE BANK DASHBOARD v1
 *
 * CHANGELOG v1:
 * ✅ FIXED: Full drag movement - can now drag anywhere on screen (up, down, left, right)
 * ✅ Panel only stops when 50px from edge (keeps it grabbable)
 *
 * v12 Features:
 * ✅ Uses actual DOM structure from Q2 banking platform
 * ✅ Targets .datatable-row elements directly
 * ✅ Uses .currency-negative class to detect debits
 * ✅ Extracts date from .col-date, description from .col-desc, amount from .col-amount
 */

(() => {
  'use strict';

  const CONFIG = {
    ACCOUNT_ID: '1097508',
    STORAGE_KEY: 'appleBankDash_v1_pos',
    SETTINGS_KEY: 'appleBankDash_v1_settings',
    TOGGLE_KEY: 'appleBankDash_v1_enabled',
    DAY_OPTIONS: [7, 14, 30, 32],
    DEFAULT_DAYS: 7,
    CHECK_INTERVAL: 1500
  };

  console.log('[AppleBank v1] 🚀 Script loaded');

  const state = {
    enabled: true,
    visible: false,
    selectedDays: CONFIG.DEFAULT_DAYS,
    transactions: []
  };

  try {
    const toggle = localStorage.getItem(CONFIG.TOGGLE_KEY);
    if (toggle !== null) state.enabled = JSON.parse(toggle);
    const settings = localStorage.getItem(CONFIG.SETTINGS_KEY);
    if (settings) state.selectedDays = JSON.parse(settings).days || CONFIG.DEFAULT_DAYS;
  } catch (e) {}

  const saveSettings = () => {
    try { localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify({ days: state.selectedDays })); } catch (e) {}
  };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const formatMoney = (num) => {
    if (!num || isNaN(num)) return '$0.00';
    return '$' + Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Parse date from "Jan 23 2026" or "Pending" format
  const parseDate = (str) => {
    if (!str) return null;
    const text = str.trim().toLowerCase();

    if (text === 'pending') return new Date();

    // "Jan 23 2026" format
    const match = str.match(/([A-Z]{3})\s+(\d{1,2})\s+(\d{4})/i);
    if (match) {
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const idx = months.indexOf(match[1].toLowerCase());
      if (idx !== -1) {
        return new Date(parseInt(match[3]), idx, parseInt(match[2]));
      }
    }

    // "1/23/2026" format
    const slashMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      return new Date(parseInt(slashMatch[3]), parseInt(slashMatch[1]) - 1, parseInt(slashMatch[2]));
    }

    return null;
  };

  // Parse amount from "– $540.78" or "$540.78"
  const parseAmount = (str) => {
    if (!str) return 0;
    // Remove en-dash, em-dash, minus, spaces
    const cleaned = str.replace(/[–—-\s]/g, '').replace(/[$,]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const isOnTransactionPage = () => {
    const url = location.href.toLowerCase();
    return url.includes('/account/') && url.includes('transaction') && !url.includes('/login');
  };

  // ========================================
  // STYLES
  // ========================================
  const injectStyles = () => {
    if ($('#abd-v1-styles')) return;
    const style = document.createElement('style');
    style.id = 'abd-v1-styles';
    style.textContent = `
      #apple-bank-dashboard-v1 {
        position: fixed !important; top: 80px; right: 15px;
        width: 280px !important; max-height: calc(100vh - 100px) !important;
        background: #ffffff !important; border: 2px solid #c62828 !important;
        border-radius: 12px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.2) !important;
        z-index: 2147483647 !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        overflow: hidden !important; display: none !important;
      }
      #apple-bank-dashboard-v1.visible { display: block !important; }
      #apple-bank-dashboard-v1.dragging { box-shadow: 0 12px 48px rgba(0,0,0,0.35) !important; }
      #apple-bank-dashboard-v1 * { box-sizing: border-box !important; }
      #apple-bank-dashboard-v1 .abd-header {
        display: flex !important; align-items: center !important; justify-content: space-between !important;
        padding: 10px 12px !important; background: linear-gradient(135deg, #c62828, #b71c1c) !important;
        color: white !important; cursor: grab !important; user-select: none !important;
      }
      #apple-bank-dashboard-v1 .abd-header:active { cursor: grabbing !important; }
      #apple-bank-dashboard-v1 .abd-title { font-weight: 700 !important; font-size: 13px !important; }
      #apple-bank-dashboard-v1 .abd-btns { display: flex !important; gap: 4px !important; }
      #apple-bank-dashboard-v1 .abd-btn {
        background: rgba(255,255,255,0.2) !important; border: none !important; color: white !important;
        width: 24px !important; height: 24px !important; border-radius: 5px !important;
        cursor: pointer !important; font-size: 11px !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
      }
      #apple-bank-dashboard-v1 .abd-btn:hover { background: rgba(255,255,255,0.35) !important; }
      #apple-bank-dashboard-v1 .abd-body { padding: 10px !important; overflow-y: auto !important; max-height: calc(100vh - 180px) !important; }
      #apple-bank-dashboard-v1 .abd-time { display: flex !important; gap: 5px !important; margin-bottom: 10px !important; justify-content: center !important; }
      #apple-bank-dashboard-v1 .abd-time-btn {
        padding: 5px 10px !important; border: 1px solid #ddd !important; background: white !important;
        border-radius: 5px !important; font-size: 11px !important; font-weight: 600 !important;
        cursor: pointer !important; color: #333 !important;
      }
      #apple-bank-dashboard-v1 .abd-time-btn:hover { background: #f5f5f5 !important; }
      #apple-bank-dashboard-v1 .abd-time-btn.active {
        background: linear-gradient(135deg, #c62828, #b71c1c) !important;
        color: white !important; border-color: #c62828 !important;
      }
      #apple-bank-dashboard-v1 .abd-card {
        background: #fafafa !important; border: 1px solid #e0e0e0 !important;
        border-radius: 8px !important; margin-bottom: 8px !important; overflow: hidden !important;
      }
      #apple-bank-dashboard-v1 .abd-card-head {
        display: flex !important; align-items: center !important; justify-content: space-between !important;
        padding: 8px 10px !important; background: #f5f5f5 !important; cursor: pointer !important;
      }
      #apple-bank-dashboard-v1 .abd-card-head:hover { background: #eee !important; }
      #apple-bank-dashboard-v1 .abd-card-title { font-size: 11px !important; font-weight: 600 !important; color: #333 !important; }
      #apple-bank-dashboard-v1 .abd-toggle { font-size: 9px !important; color: #666 !important; transition: transform 0.2s !important; }
      #apple-bank-dashboard-v1 .abd-card.collapsed .abd-toggle { transform: rotate(-90deg) !important; }
      #apple-bank-dashboard-v1 .abd-card-body { padding: 8px 10px !important; font-size: 11px !important; background: white !important; }
      #apple-bank-dashboard-v1 .abd-card.collapsed .abd-card-body { display: none !important; }
      #apple-bank-dashboard-v1 .abd-row { display: flex !important; justify-content: space-between !important; padding: 4px 0 !important; border-bottom: 1px solid #f0f0f0 !important; }
      #apple-bank-dashboard-v1 .abd-row:last-child { border-bottom: none !important; }
      #apple-bank-dashboard-v1 .abd-label { color: #666 !important; font-size: 10px !important; }
      #apple-bank-dashboard-v1 .abd-value { font-weight: 600 !important; font-size: 11px !important; }
      #apple-bank-dashboard-v1 .abd-value.pos { color: #2e7d32 !important; }
      #apple-bank-dashboard-v1 .abd-value.neg { color: #c62828 !important; }
      #apple-bank-dashboard-v1 .abd-merch-name { font-size: 10px !important; color: #444 !important; max-width: 150px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
      #apple-bank-dashboard-v1 .abd-merch-amt { font-weight: 600 !important; color: #c62828 !important; font-size: 10px !important; }
      #apple-bank-dashboard-v1 .abd-actions { display: flex !important; gap: 6px !important; padding: 8px 10px !important; border-top: 1px solid #e0e0e0 !important; background: #fafafa !important; }
      #apple-bank-dashboard-v1 .abd-action { flex: 1 !important; padding: 6px !important; border: 1px solid #ddd !important; background: white !important; border-radius: 5px !important; font-size: 11px !important; cursor: pointer !important; color: #333 !important; font-weight: 500 !important; }
      #apple-bank-dashboard-v1 .abd-action:hover { background: #f5f5f5 !important; }
      #apple-bank-dashboard-v1 .abd-footer { padding: 6px 10px !important; text-align: center !important; font-size: 9px !important; color: #999 !important; border-top: 1px solid #e0e0e0 !important; background: #fafafa !important; }
      #apple-bank-dashboard-v1 .abd-empty { text-align: center !important; padding: 8px !important; color: #999 !important; font-size: 11px !important; }
    `;
    document.head.appendChild(style);
  };

  // ========================================
  // DASHBOARD
  // ========================================
  let panel = null;

  const createDashboard = () => {
    if (panel) return;
    const el = document.createElement('div');
    el.id = 'apple-bank-dashboard-v1';
    el.innerHTML = `
      <div class="abd-header">
        <div class="abd-title">🍎 Apple Bank Dashboard</div>
        <div class="abd-btns">
          <button class="abd-btn" id="abd-left" title="Dock Left">◀</button>
          <button class="abd-btn" id="abd-right" title="Dock Right">▶</button>
        </div>
      </div>
      <div class="abd-body">
        <div class="abd-time">
          ${CONFIG.DAY_OPTIONS.map(d => `<button class="abd-time-btn ${d === state.selectedDays ? 'active' : ''}" data-d="${d}">${d}d</button>`).join('')}
        </div>
        <div class="abd-card">
          <div class="abd-card-head"><span class="abd-card-title">📊 Spending Summary</span><span class="abd-toggle">▼</span></div>
          <div class="abd-card-body" id="abd-spending"><div class="abd-empty">Scanning...</div></div>
        </div>
        <div class="abd-card collapsed">
          <div class="abd-card-head"><span class="abd-card-title">🏪 Top Merchants</span><span class="abd-toggle">▼</span></div>
          <div class="abd-card-body" id="abd-merchants"><div class="abd-empty">Loading...</div></div>
        </div>
        <div class="abd-card collapsed">
          <div class="abd-card-head"><span class="abd-card-title">🔥 Largest</span><span class="abd-toggle">▼</span></div>
          <div class="abd-card-body" id="abd-largest"><div class="abd-empty">Loading...</div></div>
        </div>
      </div>
      <div class="abd-actions">
        <button class="abd-action" id="abd-refresh">🔄 Refresh</button>
        <button class="abd-action" id="abd-export">📥 Export</button>
      </div>
      <div class="abd-footer" id="abd-footer">Ready</div>
    `;
    document.body.appendChild(el);
    panel = el;
    setupListeners();
    loadPosition();
  };

  const setupListeners = () => {
    $('#abd-left', panel)?.addEventListener('click', () => dock('left'));
    $('#abd-right', panel)?.addEventListener('click', () => dock('right'));
    $$('.abd-time-btn', panel).forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedDays = parseInt(btn.dataset.d);
        saveSettings();
        $$('.abd-time-btn', panel).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateDisplay();
      });
    });
    $$('.abd-card-head', panel).forEach(h => h.addEventListener('click', () => h.closest('.abd-card')?.classList.toggle('collapsed')));
    $('#abd-refresh', panel)?.addEventListener('click', () => { scan(); updateDisplay(); });
    $('#abd-export', panel)?.addEventListener('click', exportCSV);
    setupDrag();
  };

  const setupDrag = () => {
    const header = $('.abd-header', panel);
    let dragging = false, offsetX = 0, offsetY = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.abd-btn')) return;
      dragging = true;
      panel.classList.add('dragging');
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      panel.style.right = 'auto';
      panel.style.left = rect.left + 'px';
      panel.style.top = rect.top + 'px';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      // Allow full movement - only prevent going completely off screen
      const panelWidth = panel.offsetWidth || 280;
      const panelHeight = panel.offsetHeight || 400;
      const newX = e.clientX - offsetX;
      const newY = e.clientY - offsetY;
      // Keep at least 50px visible on each edge
      panel.style.left = Math.max(-panelWidth + 50, Math.min(window.innerWidth - 50, newX)) + 'px';
      panel.style.top = Math.max(0, Math.min(window.innerHeight - 50, newY)) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        panel.classList.remove('dragging');
        document.body.style.userSelect = '';
        savePosition();
      }
    });
  };

  const loadPosition = () => {
    try { const p = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)); if (p?.left != null) { panel.style.left = p.left + 'px'; panel.style.top = p.top + 'px'; panel.style.right = 'auto'; } } catch (e) {}
  };

  const savePosition = () => {
    try { const r = panel.getBoundingClientRect(); localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ left: r.left, top: r.top })); } catch (e) {}
  };

  const dock = (side) => {
    const top = panel.getBoundingClientRect().top;
    panel.style.left = side === 'left' ? '15px' : (window.innerWidth - 295) + 'px';
    panel.style.right = 'auto'; panel.style.top = top + 'px'; savePosition();
  };

  // ========================================
  // TRANSACTION SCANNING - DOM BASED
  // ========================================
  const scan = () => {
    console.log('[AppleBank v1] 🔍 Scanning using DOM structure...');
    state.transactions = [];

    // Find all transaction rows using the actual class structure
    const rows = $$('.datatable-row');
    console.log('[AppleBank v1] Found', rows.length, '.datatable-row elements');

    if (rows.length === 0) {
      // Fallback: try other selectors
      const altRows = $$('[class*="transaction"], [class*="history-item"], tr');
      console.log('[AppleBank v1] Fallback: found', altRows.length, 'alternative rows');
    }

    const seen = new Set();

    rows.forEach((row, idx) => {
      try {
        // Get date from .col-date
        const dateEl = $('.col-date', row);
        const dateText = dateEl?.textContent?.trim() || '';
        const date = parseDate(dateText);

        // Get description from .col-desc .description-text
        const descEl = $('.col-desc .description-text', row) || $('.col-desc', row);
        const description = descEl?.textContent?.trim() || 'Unknown';

        // Get amount from .col-amount
        const amountEl = $('.col-amount', row);
        const amountSpan = $('.amount', amountEl) || $('[test-id="lblAmount"]', amountEl);

        // Check if it's a debit or credit using class names
        const isDebit = amountSpan?.classList?.contains('debit') ||
                        amountSpan?.classList?.contains('currency-negative') ||
                        amountEl?.querySelector('.currency-negative') !== null;

        const isCredit = amountSpan?.classList?.contains('credit') ||
                         amountSpan?.classList?.contains('currency-positive') ||
                         (amountEl?.querySelector('.currency-positive') !== null && !amountEl?.querySelector('.account-balance-text'));

        // Get the amount value - look for .numAmount span but NOT in .account-balance-text
        let amountText = '';
        const numAmounts = $$('.numAmount', amountEl);
        for (const numAmt of numAmounts) {
          // Skip if it's inside account-balance-text (running balance)
          if (numAmt.closest('.account-balance-text')) continue;
          amountText = numAmt.textContent?.trim() || '';
          break;
        }

        const amount = parseAmount(amountText);

        // Skip if no valid amount
        if (!amount || amount <= 0) {
          return;
        }

        // Skip running balances (very high amounts that aren't transactions)
        // Skip duplicates
        const key = `${description}|${amount}|${isDebit}`;
        if (seen.has(key)) return;
        seen.add(key);

        const transaction = {
          date: date || new Date(),
          description,
          amount,
          isDebit
        };

        state.transactions.push(transaction);

        console.log('[AppleBank v1] ✅ Transaction:', {
          date: transaction.date.toLocaleDateString(),
          desc: description.substring(0, 30),
          amount,
          type: isDebit ? 'DEBIT' : 'CREDIT'
        });

      } catch (err) {
        console.log('[AppleBank v1] Error parsing row', idx, err);
      }
    });

    console.log('[AppleBank v1] ==================');
    console.log('[AppleBank v1] Total:', state.transactions.length);
    console.log('[AppleBank v1] Debits:', state.transactions.filter(t => t.isDebit).length);
    console.log('[AppleBank v1] Credits:', state.transactions.filter(t => !t.isDebit).length);
  };

  // ========================================
  // CALCULATIONS
  // ========================================
  const calc = (days) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const items = state.transactions.filter(t => t.date >= cutoff);

    let credits = 0, debits = 0, cCnt = 0, dCnt = 0;
    const merchants = {};
    let bigCredit = { amt: 0 }, bigDebit = { amt: 0 };

    items.forEach(t => {
      if (t.isDebit) {
        debits += t.amount;
        dCnt++;
        const m = cleanMerch(t.description);
        merchants[m] = (merchants[m] || 0) + t.amount;
        if (t.amount > bigDebit.amt) bigDebit = { amt: t.amount, desc: t.description };
      } else {
        credits += t.amount;
        cCnt++;
        if (t.amount > bigCredit.amt) bigCredit = { amt: t.amount, desc: t.description };
      }
    });

    const top5 = Object.entries(merchants).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { credits, debits, net: credits - debits, cCnt, dCnt, daily: days ? debits / days : 0, top5, bigCredit, bigDebit, total: items.length };
  };

  const cleanMerch = (s) => {
    return s.replace(/PREAUTHORIZED\s*(WD|CREDIT)?\s*/gi, '')
            .replace(/PwP\s*/gi, '')
            .replace(/\d{6,}/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .slice(0, 2)
            .join(' ')
            .toUpperCase() || 'UNKNOWN';
  };

  // ========================================
  // UPDATE DISPLAY
  // ========================================
  const updateDisplay = () => {
    if (!panel) return;
    const s = calc(state.selectedDays);

    $('#abd-spending', panel).innerHTML = `
      <div class="abd-row"><span class="abd-label">💵 Credits</span><span class="abd-value pos">${formatMoney(s.credits)}</span></div>
      <div class="abd-row"><span class="abd-label">🔴 Debits</span><span class="abd-value neg">${formatMoney(s.debits)}</span></div>
      <div class="abd-row"><span class="abd-label">📈 Net</span><span class="abd-value ${s.net >= 0 ? 'pos' : 'neg'}">${s.net >= 0 ? '+' : '-'}${formatMoney(Math.abs(s.net))}</span></div>
      <div class="abd-row"><span class="abd-label">📊 Daily</span><span class="abd-value">${formatMoney(s.daily)}/d</span></div>
    `;

    $('#abd-merchants', panel).innerHTML = s.top5.length ? s.top5.map(([n, a]) => `
      <div class="abd-row"><span class="abd-merch-name">${n}</span><span class="abd-merch-amt">${formatMoney(a)}</span></div>
    `).join('') : '<div class="abd-empty">No merchants</div>';

    $('#abd-largest', panel).innerHTML = `
      <div class="abd-row"><span class="abd-label">↑ Credit</span><span class="abd-value pos">${formatMoney(s.bigCredit.amt)}</span></div>
      <div class="abd-row"><span class="abd-label">↓ Debit</span><span class="abd-value neg">${formatMoney(s.bigDebit.amt)}</span></div>
    `;

    $('#abd-footer', panel).textContent = `${s.cCnt} credits | ${s.dCnt} debits in ${state.selectedDays}d`;
  };

  // ========================================
  // EXPORT
  // ========================================
  const exportCSV = () => {
    if (!state.transactions.length) return alert('No data');
    let csv = 'Date,Description,Amount,Type\n';
    state.transactions.forEach(t => {
      csv += `${t.date.toLocaleDateString()},"${t.description.replace(/"/g, "'")}",${t.amount.toFixed(2)},${t.isDebit ? 'Debit' : 'Credit'}\n`;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `apple-bank-${state.selectedDays}d.csv`;
    a.click();
  };

  // ========================================
  // VISIBILITY
  // ========================================
  const show = () => {
    if (panel && state.enabled) {
      panel.classList.add('visible');
      state.visible = true;
      setTimeout(() => { scan(); updateDisplay(); }, 500);
    }
  };

  const hide = () => { if (panel) { panel.classList.remove('visible'); state.visible = false; } };

  let lastUrl = '';
  const checkPage = () => {
    const currentUrl = location.href;
    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;
    if (!state.enabled) { hide(); return; }
    if (isOnTransactionPage()) { if (!state.visible) show(); }
    else { if (state.visible) hide(); }
  };

  // ========================================
  // KEYBOARD
  // ========================================
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      state.enabled = !state.enabled;
      localStorage.setItem(CONFIG.TOGGLE_KEY, JSON.stringify(state.enabled));
      state.enabled ? checkPage() : hide();
      console.log('[AppleBank v1]', state.enabled ? '✅ ENABLED' : '⏸️ DISABLED');
    }
  });

  // ========================================
  // INIT
  // ========================================
  const init = () => {
    injectStyles();
    createDashboard();
    setTimeout(checkPage, 300);
    let checks = 0;
    const watcher = setInterval(() => { checkPage(); if (++checks > 10) { clearInterval(watcher); setInterval(checkPage, CONFIG.CHECK_INTERVAL); } }, 200);
    window.addEventListener('hashchange', () => setTimeout(checkPage, 300));
  };

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();

})();