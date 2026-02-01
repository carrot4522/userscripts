// ==UserScript==
// @name         Privacy.com Spending Calculator v47
// @namespace    Privacy.com Spending Calculator v47
// @version      47
// @description  SETTLING INCLUDED - Now counts SETTLED + SETTLING transactions in total
// @match        https://app.privacy.com/*
// @run-at       document-idle
// @inject-into  page
// @grant        none
// ==/UserScript==

/**
 * ============================================
 * CHANGELOG v47 - SETTLING INCLUDED IN TOTAL
 * ============================================
 *
 * 🔴 USER REQUEST: SETTLING transactions should count in total
 *    SETTLING = money is basically spent, just processing
 *
 * v47 CHANGES:
 * ✅ SETTLING now has its own category (not grouped with PENDING)
 * ✅ Main total = SETTLED + SETTLING - REFUNDS
 * ✅ Display shows both SETTLED and SETTLING counts/amounts
 * ✅ Subtitle updated: "SETTLED + SETTLING transactions counted"
 * ✅ Math display updated to show: (Settled + Settling) - Refunds = Net
 *
 * Previous v46 fixes preserved:
 * ✅ Ghost element filtering (translateY < 0)
 * ✅ All status breakdowns
 * ✅ Draggable panel with localStorage
 * ✅ Alt+S keyboard toggle
 *
 * ============================================
 */

(function () {
  'use strict';

  console.log('[Privacy Summary v47] 💰 SETTLING INCLUDED MODE');

  const CONFIG = {
    MAX_TXN_CENTS: 200_000_00,
    DRAG_THRESHOLD: 5,
    HIGHLIGHT_INTERVAL: 500,
    HARVEST_STEP_MIN: 220,
    HARVEST_DELAY_DOWN: 18,
    HARVEST_DELAY_CONVERGE: 14,
    INITIAL_WAIT: 1500,
    LS_MIN: 'tmSum.min',
    LS_POS: 'tmSum.pos',
    DEBUG_LOGGING: true
  };

  const MONTHS = {
    jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
    jul:6, aug:7, sep:8, sept:8, oct:9, nov:10, dec:11
  };

  const state = {
    cache: new Map(),
    isRunning: false,
    lastHighlight: 0,
    ghostsSkipped: 0
  };

  const utils = {
    sleep: (ms) => new Promise(r => setTimeout(r, ms)),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    fmtUSD: (c) => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toFixed(2)}`,
    uuidFromHref: (href) => {
      const m = /transaction=([0-9a-f-]{36})/i.exec(href || '');
      return m ? m[1] : null;
    },
    centsFromText: (txt) => {
      if (!txt) return null;
      if (!txt.includes('$') && !/\d+\.\d{1,2}/.test(txt)) return null;
      const n = parseFloat(txt.replace(/[^\d.\-]/g, ''));
      if (Number.isNaN(n)) return null;
      const c = Math.round(n * 100);
      return Math.abs(c) > CONFIG.MAX_TXN_CENTS ? null : c;
    },
    yearHint: () => {
      const s = new URL(location.href).searchParams.get('startDate');
      const y = s ? new Date(s).getFullYear() : (new Date()).getFullYear();
      return Number.isFinite(y) ? y : (new Date()).getFullYear();
    },
    fmtDate: (ms) => {
      if (ms == null) return '—';
      const d = new Date(ms);
      const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
      return `${mon} ${d.getDate()}`;
    }
  };

  const storage = {
    getMin: () => {
      const val = localStorage.getItem(CONFIG.LS_MIN);
      return val === null ? true : val !== '0';
    },
    setMin: (b) => localStorage.setItem(CONFIG.LS_MIN, b ? '1' : '0'),
    getPos: () => {
      try {
        const val = localStorage.getItem(CONFIG.LS_POS);
        return val ? JSON.parse(val) : null;
      } catch {
        return null;
      }
    },
    setPos: (left, top) => {
      try {
        localStorage.setItem(CONFIG.LS_POS, JSON.stringify({ left, top }));
      } catch {}
    }
  };

  const dateParser = {
    parse: (text) => {
      if (!text) return null;
      const str = text.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();
      let m;

      m = str.match(/^([a-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?\s*,?\s*(\d{1,2}:\d{2})?\s*(am|pm)?/i);
      if (m) {
        const mon = MONTHS[m[1].substring(0, 3).toLowerCase()];
        if (mon === undefined) return null;
        const day = parseInt(m[2], 10);
        let year = m[3] ? parseInt(m[3], 10) : utils.yearHint();
        let hour = 0, min = 0;
        if (m[4]) {
          [hour, min] = m[4].split(':').map(Number);
          if (m[5]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
          if (m[5]?.toLowerCase() === 'am' && hour === 12) hour = 0;
        }
        const d = new Date(year, mon, day, hour, min);
        const t = d.getTime();
        return Number.isNaN(t) ? null : t;
      }

      m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (m) {
        let year = parseInt(m[3], 10);
        if (year < 100) year += 2000;
        const d = new Date(year, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
        const t = d.getTime();
        return Number.isNaN(t) ? null : t;
      }

      const t = Date.parse(str);
      return Number.isNaN(t) ? null : t;
    },
    getRange: () => {
      const u = new URL(location.href);
      return {
        start: u.searchParams.get('startDate'),
        end: u.searchParams.get('endDate')
      };
    },
    withinRange: (ms, startIso, endIso) => {
      if (ms == null) return true;
      const s = startIso ? Date.parse(startIso) : null;
      const e = endIso ? Date.parse(endIso) : null;
      if (s && ms < s) return false;
      if (e && ms > e + 24 * 3600 * 1000 - 1) return false;
      return true;
    }
  };

  const domUtils = {
    deepQSA: (sel, root = document) => {
      const out = [];
      (function dive(n) {
        try {
          if (n.querySelectorAll) out.push(...n.querySelectorAll(sel));
          if (n.shadowRoot) dive(n.shadowRoot);
          if (n.tagName === 'IFRAME') {
            try {
              if (n.contentDocument) dive(n.contentDocument);
            } catch {}
          }
        } catch {}
      })(root);
      return out;
    },
    findScroller: () => {
      const sc = domUtils.deepQSA('.vue-recycle-scroller.txn-list, .vue-recycle-scroller.direction-vertical')[0];
      if (sc) return sc;
      const a = domUtils.deepQSA('a[href*="/transactions?transaction="]')[0];
      let p = a && a.parentElement;
      while (p && p !== document.body) {
        try {
          const cs = getComputedStyle(p);
          if ((/auto|scroll/i.test(cs.overflowY) || p.scrollHeight > p.clientHeight)) return p;
        } catch {}
        p = p.parentElement;
      }
      return null;
    },
    itemWrapper: (sc) => sc.querySelector('.vue-recycle-scroller__item-wrapper') || sc.querySelector('[class*="item-wrapper"]') || sc,

    /**
     * v46+ CRITICAL FIX: Check if an item-view is a hidden "ghost" element
     * Vue's virtual scroller hides recycled elements at translateY(-9999px)
     */
    isGhostElement: (viewEl) => {
      let itemView = viewEl;
      while (itemView && !itemView.classList?.contains('vue-recycle-scroller__item-view')) {
        itemView = itemView.parentElement;
      }

      if (!itemView) return false;

      const style = itemView.getAttribute('style') || '';
      const transformMatch = style.match(/translateY\(\s*(-?\d+)/i);

      if (transformMatch) {
        const translateY = parseInt(transformMatch[1], 10);
        if (translateY < 0) {
          return true;
        }
      }

      return false;
    },

    hasTransactions: () => {
      return document.querySelectorAll('a[href*="/transactions?transaction="]').length > 0;
    },

    isPageLoading: () => {
      const loadingIndicators = document.querySelectorAll(
        '[class*="loading"], [class*="spinner"], [class*="skeleton"], .loading'
      );
      return loadingIndicators.length > 0;
    }
  };

  const rowParser = {
    parse: (viewEl) => {
      // v46+: First check if this is a ghost element
      if (domUtils.isGhostElement(viewEl)) {
        state.ghostsSkipped++;
        if (CONFIG.DEBUG_LOGGING) {
          const descriptor = viewEl.querySelector('.descriptor')?.textContent?.trim() || 'Unknown';
          console.log(`[v47] 👻 SKIPPED GHOST: ${descriptor}`);
        }
        return null;
      }

      const a = viewEl.querySelector('a[href*="/transactions?transaction="]');
      const id = utils.uuidFromHref(a && a.getAttribute('href'));
      if (!id) return null;

      const descriptor = viewEl.querySelector('.descriptor')?.textContent?.trim() || 'Unknown';

      const badge = viewEl.querySelector('.status-badge, [class*="status-badge"], .badge');
      const badgeText = (badge?.textContent || '').trim().toUpperCase();
      const badgeClasses = (badge?.className || '').toLowerCase();

      const amountContainer = viewEl.querySelector('.amount');
      const amtSpan = amountContainer?.querySelector('span') || amountContainer;
      const amtClasses = (amtSpan?.className || '').toLowerCase();
      const amountText = (amtSpan?.textContent || '').trim();
      const cents = utils.centsFromText(amountText);

      let category = 'UNKNOWN';

      // Check for ANY red/danger indicator
      const hasRedAmount = amtClasses.includes('danger') ||
                           amtClasses.includes('text-color-danger') ||
                           amtClasses.includes('red');
      const hasRedBadge = badgeClasses.includes('danger') ||
                          badgeClasses.includes('red');

      if (badgeText === 'DECLINED' || hasRedAmount || hasRedBadge) {
        category = 'DECLINED';
      }
      else if (badgeText === 'SETTLED' ||
               (badgeClasses.includes('success') && !badgeText.includes('AUTHORIZED') && !badgeText.includes('SETTLING'))) {
        category = 'SETTLED';
      }
      // v47: SETTLING is now its own category (counts in total)
      else if (badgeText === 'SETTLING') {
        category = 'SETTLING';
      }
      else if (badgeText === 'AUTHORIZED' || badgeText === 'AUTH') {
        category = 'AUTHORIZED';
      }
      else if (badgeText === 'PENDING') {
        category = 'PENDING';
      }
      else if (badgeText.includes('REFUND') ||
               badgeText.includes('CREDIT') ||
               amtClasses.includes('affirmative') ||
               (amtClasses.includes('success') && !hasRedAmount) ||
               amountText.includes('+')) {
        category = 'CREDIT';
      }
      else if (badgeText === 'VOIDED' || badgeText === 'VOID') {
        category = 'VOIDED';
      }

      let dateText = '';
      const dateEl = viewEl.querySelector('.details .date, .date, [class*="date"]');
      if (dateEl) {
        dateText = (dateEl.textContent || '').trim();
      }
      const ts = dateParser.parse(dateText);

      if (CONFIG.DEBUG_LOGGING) {
        const emoji = {
          'SETTLED': '💰',
          'SETTLING': '⏳💰',  // v47: Special emoji for settling
          'DECLINED': '❌',
          'AUTHORIZED': '⏳',
          'PENDING': '⏳',
          'CREDIT': '💚',
          'VOIDED': '🚫',
          'UNKNOWN': '❓'
        }[category] || '❓';

        console.log(`[v47] ${emoji} ${category.padEnd(10)} | ${descriptor.substring(0, 25).padEnd(25)} | Badge: "${badgeText}"`);
      }

      return {
        id,
        category,
        badgeText,
        cents,
        ts,
        dateText,
        descriptor,
        hasRedAmount
      };
    }
  };

  const harvester = {
    async harvestAll(statusCallback) {
      const sc = domUtils.findScroller();
      if (!sc) throw new Error('Could not find the transactions list');

      // Reset ghost counter
      state.ghostsSkipped = 0;

      // v46+: Initial wait for page to settle
      statusCallback('⏳ Waiting for page data...');
      await utils.sleep(CONFIG.INITIAL_WAIT);

      // Wait for loading indicators
      let waitCount = 0;
      while (domUtils.isPageLoading() && waitCount < 20) {
        statusCallback('⏳ Page still loading...');
        await utils.sleep(200);
        waitCount++;
      }

      statusCallback('📊 Scanning transactions...');

      const wrap = domUtils.itemWrapper(sc);
      const originalScrollTop = sc.scrollTop;
      const step = Math.max(CONFIG.HARVEST_STEP_MIN, Math.floor(sc.clientHeight * 0.8));
      const seen = new Set();
      let stable = 0, last = -1;

      const harvest = () => {
        const views = wrap.querySelectorAll('.vue-recycle-scroller__item-view,[data-index],[class*="item-view"]');
        for (const v of views) {
          const a = v.querySelector('a[href*="/transactions?transaction="]');
          if (!a) continue;
          const href = a.getAttribute('href');
          if (!href || seen.has(href)) continue;
          const row = rowParser.parse(v);
          if (!row) continue; // v46+: null means ghost or invalid
          seen.add(href);
          state.cache.set(row.id, row);
        }
      };

      sc.scrollTop = 0;
      sc.dispatchEvent(new Event('scroll'));
      await utils.sleep(30);
      harvest();

      for (let i = 0; i < 4000; i++) {
        const before = sc.scrollTop;
        sc.scrollTop = Math.min(before + step, sc.scrollHeight);
        sc.dispatchEvent(new Event('scroll'));
        await utils.sleep(CONFIG.HARVEST_DELAY_DOWN);
        harvest();
        if (sc.scrollTop === before) break;
      }

      // Convergence pass
      for (let j = 0; j < 3; j++) {
        sc.scrollTop = 0;
        sc.dispatchEvent(new Event('scroll'));
        await utils.sleep(30);
        harvest();
        for (let i = 0; i < 4000; i++) {
          const before = sc.scrollTop;
          sc.scrollTop = Math.min(before + step, sc.scrollHeight);
          sc.dispatchEvent(new Event('scroll'));
          await utils.sleep(CONFIG.HARVEST_DELAY_CONVERGE);
          harvest();
          if (sc.scrollTop === before) break;
        }

        const now = state.cache.size;
        if (now === last) {
          if (++stable >= 2) break;
        } else {
          stable = 0;
          last = now;
        }
      }

      sc.scrollTop = originalScrollTop;
      sc.dispatchEvent(new Event('scroll'));

      console.log(`[v47] 👻 Skipped ${state.ghostsSkipped} ghost elements`);

      return state.cache.size;
    }
  };

  const calculator = {
    summarize: () => {
      const { start, end } = dateParser.getRange();
      console.log(`\n[Calculator v47] 📅 Date range: ${start || 'none'} to ${end || 'none'}`);
      console.log(`[Calculator v47] 💰 MODE: Counting SETTLED + SETTLING transactions\n`);

      const buckets = {
        SETTLED: [],
        SETTLING: [],  // v47: Separate bucket for SETTLING
        DECLINED: [],
        AUTHORIZED: [],
        PENDING: [],
        CREDIT: [],
        VOIDED: [],
        UNKNOWN: []
      };

      let scannedTotal = 0;

      for (const r of state.cache.values()) {
        if (!dateParser.withinRange(r.ts, start, end)) continue;
        scannedTotal++;

        const cat = r.category || 'UNKNOWN';
        if (buckets[cat]) {
          buckets[cat].push(r);
        } else {
          buckets.UNKNOWN.push(r);
        }
      }

      const sum = arr => arr.reduce((s, r) => s + (r.cents || 0), 0);

      const settledTotal = sum(buckets.SETTLED);
      const settlingTotal = sum(buckets.SETTLING);  // v47: New
      const refundedTotal = sum(buckets.CREDIT);
      const authorizedTotal = sum(buckets.AUTHORIZED);
      const pendingTotal = sum(buckets.PENDING);
      const declinedTotal = sum(buckets.DECLINED);

      // v47: Net now includes SETTLING
      const spendingTotal = settledTotal + settlingTotal;
      const net = spendingTotal - refundedTotal;

      // Combine SETTLED and SETTLING for date range calculation
      const allCompleted = [...buckets.SETTLED, ...buckets.SETTLING];
      allCompleted.sort((a, b) => (a.ts || 0) - (b.ts || 0));
      const firstTs = allCompleted[0]?.ts ?? null;
      const lastTs = allCompleted[allCompleted.length - 1]?.ts ?? null;

      console.log(`[Calculator v47] 📊 STATUS BREAKDOWN:`);
      console.log(`  💰 SETTLED:    ${buckets.SETTLED.length} transactions = ${utils.fmtUSD(settledTotal)} ← COUNTED`);
      console.log(`  ⏳💰 SETTLING:  ${buckets.SETTLING.length} transactions = ${utils.fmtUSD(settlingTotal)} ← COUNTED (v47)`);
      console.log(`  ❌ DECLINED:   ${buckets.DECLINED.length} transactions = ${utils.fmtUSD(declinedTotal)} (not charged)`);
      console.log(`  ⏳ AUTHORIZED: ${buckets.AUTHORIZED.length} transactions = ${utils.fmtUSD(authorizedTotal)} (pending hold)`);
      console.log(`  ⏳ PENDING:    ${buckets.PENDING.length} transactions = ${utils.fmtUSD(pendingTotal)} (processing)`);
      console.log(`  💚 CREDITS:    ${buckets.CREDIT.length} transactions = ${utils.fmtUSD(refundedTotal)} (refunded)`);
      console.log(`  🚫 VOIDED:     ${buckets.VOIDED.length} transactions`);
      console.log(`  ❓ UNKNOWN:    ${buckets.UNKNOWN.length} transactions`);
      console.log(`\n  📋 Total scanned: ${scannedTotal}`);
      console.log(`  👻 Ghost elements skipped: ${state.ghostsSkipped}`);
      console.log(`  💰 SPENDING (Settled + Settling): ${utils.fmtUSD(spendingTotal)}`);
      console.log(`  💚 REFUNDS: ${utils.fmtUSD(refundedTotal)}`);
      console.log(`  📊 NET SPENDING: ${utils.fmtUSD(net)}`);

      return {
        settledTotal,
        settlingTotal,  // v47: New
        spendingTotal,  // v47: New (settled + settling)
        refundedTotal,
        authorizedTotal,
        pendingTotal,
        net,
        settledCount: buckets.SETTLED.length,
        settlingCount: buckets.SETTLING.length,  // v47: New
        declinedCount: buckets.DECLINED.length,
        authorizedCount: buckets.AUTHORIZED.length,
        pendingCount: buckets.PENDING.length,
        refundCount: buckets.CREDIT.length,
        scanned: scannedTotal,
        firstTs,
        lastTs
      };
    }
  };

  const highlighter = {
    highlight: () => {
      const now = Date.now();
      if (now - state.lastHighlight < CONFIG.HIGHLIGHT_INTERVAL) return;
      state.lastHighlight = now;
      const links = domUtils.deepQSA('a[href*="/transactions?transaction="]');
      links.forEach(link => {
        const descriptor = link.querySelector('.descriptor');
        if (descriptor) {
          const text = (descriptor.textContent || '').toLowerCase();
          link.classList.remove('tm-mobileware-highlight');
          if (text.includes('mobileware')) {
            link.classList.add('tm-mobileware-highlight');
          }
        }
      });
    },
    init: () => {
      setInterval(() => highlighter.highlight(), CONFIG.HIGHLIGHT_INTERVAL);
    }
  };

  const styleManager = {
    inject: () => {
      // Clean up old versions
      for (let i = 17; i <= 46; i++) {
        document.getElementById(`tm-sum-css-v${i}`)?.remove();
      }
      document.getElementById('tm-sum-css-v47')?.remove();

      const style = document.createElement('style');
      style.id = 'tm-sum-css-v47';
      style.textContent = `
        #tm-summary-panel {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 2147483647;
          width: 280px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }
        #tm-summary-panel .tm-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          color: white;
          font-weight: 700;
          cursor: grab;
          user-select: none;
        }
        #tm-summary-panel .tm-header:active { cursor: grabbing; }
        #tm-summary-panel .tm-body {
          padding: 16px;
        }
        #tm-summary-panel.tm-minimized .tm-body { display: none; }
        #tm-summary-panel .tm-big {
          font-size: 28px;
          font-weight: 800;
          color: #059669;
          margin-bottom: 4px;
        }
        #tm-summary-panel .tm-subtitle {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 8px;
        }
        #tm-summary-panel .tm-math {
          font-size: 12px;
          color: #475569;
          margin-bottom: 12px;
          padding: 6px 8px;
          background: #f8fafc;
          border-radius: 6px;
          font-family: 'Monaco', 'Menlo', monospace;
        }
        #tm-summary-panel .tm-math .green { color: #059669; font-weight: 600; }
        #tm-summary-panel .tm-math .amber { color: #d97706; font-weight: 600; }
        #tm-summary-panel .tm-math .blue { color: #2563eb; font-weight: 600; }
        #tm-summary-panel .tm-math .settling { color: #7c3aed; font-weight: 600; }
        #tm-summary-panel table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
          font-size: 12px;
        }
        #tm-summary-panel th {
          text-align: left;
          padding: 6px 4px;
          border-bottom: 2px solid #e2e8f0;
          font-weight: 600;
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
        }
        #tm-summary-panel td {
          padding: 6px 4px;
          border-bottom: 1px solid #f1f5f9;
        }
        #tm-summary-panel tr.counted td { color: #059669; font-weight: 600; }
        #tm-summary-panel tr.settling td { color: #7c3aed; font-weight: 600; }
        #tm-summary-panel tr.declined td { color: #dc2626; }
        #tm-summary-panel tr.authorized td { color: #d97706; }
        #tm-summary-panel tr.pending td { color: #d97706; }
        #tm-summary-panel tr.refund td { color: #059669; }
        #tm-summary-panel .tm-status {
          margin-top: 8px;
          padding: 8px;
          background: #f1f5f9;
          border-radius: 6px;
          font-size: 11px;
          color: #64748b;
          text-align: center;
        }
        #tm-summary-panel .tm-status.ready { background: #dcfce7; color: #166534; }
        #tm-summary-panel .tm-status.warning { background: #fef3c7; color: #92400e; }
        #tm-summary-panel .tm-btn {
          display: block;
          width: 100%;
          margin-top: 10px;
          padding: 10px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        #tm-summary-panel .tm-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }
        #tm-summary-panel .tm-footer {
          margin-top: 10px;
          font-size: 10px;
          color: #94a3b8;
          text-align: center;
        }
        .tm-mobileware-highlight {
          background: linear-gradient(90deg, #fef3c7 0%, #fde68a 100%) !important;
          border-left: 3px solid #f59e0b !important;
        }
      `;
      document.head.appendChild(style);
    }
  };

  const ui = {
    panel: null,
    create: () => {
      ui.remove();
      styleManager.inject();

      const panel = document.createElement('div');
      panel.id = 'tm-summary-panel';

      const isMin = storage.getMin();
      if (isMin) panel.classList.add('tm-minimized');

      // v47: Updated panel with SETTLING row
      panel.innerHTML = `
        <div class="tm-header">
          <span>💰 SPENDING SUMMARY</span>
          <span class="tm-toggle" style="cursor:pointer;font-size:16px;">${isMin ? '▼' : '▲'}</span>
        </div>
        <div class="tm-body">
          <div class="tm-big" id="tm-total">$0.00</div>
          <div class="tm-subtitle">SETTLED + SETTLING transactions counted</div>
          <div class="tm-math" id="tm-math">—</div>
          <table id="tm-details">
            <tr><th>STATUS</th><th>COUNT</th><th>AMOUNT</th></tr>
            <tr class="counted"><td>💰 Settled</td><td id="tm-settled-count">—</td><td id="tm-settled-amt">—</td></tr>
            <tr class="settling"><td>⏳💰 Settling</td><td id="tm-settling-count">—</td><td id="tm-settling-amt">—</td></tr>
            <tr class="declined"><td>❌ Declined</td><td id="tm-declined-count">—</td><td>—</td></tr>
            <tr class="authorized"><td>⏳ Authorized</td><td id="tm-auth-count">—</td><td id="tm-auth-amt">—</td></tr>
            <tr class="pending"><td>⏳ Pending</td><td id="tm-pending-count">—</td><td id="tm-pending-amt">—</td></tr>
            <tr class="refund"><td>💚 Refunds</td><td id="tm-refund-count">—</td><td id="tm-refund-amt">—</td></tr>
          </table>
          <div style="margin-top:8px;font-size:11px;color:#64748b;">
            <span id="tm-range">—</span> • <span id="tm-scanned">—</span> scanned
          </div>
          <div class="tm-status" id="tm-status">Ready to calculate</div>
          <button class="tm-btn" id="tm-btn">Calculate Spending</button>
          <div class="tm-footer">v47 • Alt+S toggle • Dbl-click minimize</div>
        </div>
      `;
      document.body.appendChild(panel);
      ui.panel = panel;

      // Position
      const savedPos = storage.getPos();
      if (savedPos) {
        const maxLeft = window.innerWidth - panel.offsetWidth - 10;
        const maxTop = window.innerHeight - panel.offsetHeight - 10;
        panel.style.left = Math.min(Math.max(0, savedPos.left), maxLeft) + 'px';
        panel.style.top = Math.min(Math.max(0, savedPos.top), maxTop) + 'px';
        panel.style.right = 'auto';
      }

      // Events
      const header = panel.querySelector('.tm-header');
      const toggle = panel.querySelector('.tm-toggle');
      const btn = panel.querySelector('#tm-btn');

      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const min = panel.classList.toggle('tm-minimized');
        toggle.textContent = min ? '▼' : '▲';
        storage.setMin(min);
      });

      header.addEventListener('dblclick', () => {
        const min = panel.classList.toggle('tm-minimized');
        toggle.textContent = min ? '▼' : '▲';
        storage.setMin(min);
      });

      btn.addEventListener('click', () => ui.run());

      // Dragging
      let isDragging = false, startX, startY, startLeft, startTop, moved = false;

      header.addEventListener('mousedown', (e) => {
        if (e.target === toggle) return;
        isDragging = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > CONFIG.DRAG_THRESHOLD || Math.abs(dy) > CONFIG.DRAG_THRESHOLD) {
          moved = true;
        }
        const newLeft = utils.clamp(startLeft + dx, 0, window.innerWidth - panel.offsetWidth - 10);
        const newTop = utils.clamp(startTop + dy, 0, window.innerHeight - panel.offsetHeight - 10);
        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
        panel.style.right = 'auto';
      });

      document.addEventListener('mouseup', () => {
        if (isDragging && moved) {
          storage.setPos(parseInt(panel.style.left), parseInt(panel.style.top));
        }
        isDragging = false;
      });

      // Keyboard shortcut
      document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          panel.style.display = panel.style.display === 'none' ? '' : 'none';
        }
      });
    },
    remove: () => {
      document.getElementById('tm-summary-panel')?.remove();
    },

    updateDisplay: (data) => {
      const {
        settledTotal, settlingTotal, spendingTotal, refundedTotal, authorizedTotal, pendingTotal, net,
        settledCount, settlingCount, declinedCount, authorizedCount, pendingCount, refundCount,
        scanned, firstTs, lastTs
      } = data;

      document.getElementById('tm-total').textContent = utils.fmtUSD(net);

      // v47: Updated math display to show (Settled + Settling) - Refunds = Net
      let mathHtml = '';
      if (settlingTotal > 0) {
        mathHtml = `(<span class="green">${utils.fmtUSD(settledTotal)}</span> + ` +
                   `<span class="settling">${utils.fmtUSD(settlingTotal)}</span>) − ` +
                   `<span class="amber">${utils.fmtUSD(refundedTotal)}</span> = ` +
                   `<span class="blue">${utils.fmtUSD(net)}</span>`;
      } else {
        mathHtml = `<span class="green">${utils.fmtUSD(settledTotal)}</span> − ` +
                   `<span class="amber">${utils.fmtUSD(refundedTotal)}</span> = ` +
                   `<span class="blue">${utils.fmtUSD(net)}</span>`;
      }
      document.getElementById('tm-math').innerHTML = mathHtml;

      document.getElementById('tm-settled-count').textContent = settledCount;
      document.getElementById('tm-settled-amt').textContent = utils.fmtUSD(settledTotal);
      document.getElementById('tm-settling-count').textContent = settlingCount;  // v47: New
      document.getElementById('tm-settling-amt').textContent = utils.fmtUSD(settlingTotal);  // v47: New
      document.getElementById('tm-declined-count').textContent = declinedCount;
      document.getElementById('tm-auth-count').textContent = authorizedCount;
      document.getElementById('tm-auth-amt').textContent = utils.fmtUSD(authorizedTotal);
      document.getElementById('tm-pending-count').textContent = pendingCount;
      document.getElementById('tm-pending-amt').textContent = utils.fmtUSD(pendingTotal);
      document.getElementById('tm-refund-count').textContent = refundCount;
      document.getElementById('tm-refund-amt').textContent = utils.fmtUSD(refundedTotal);

      document.getElementById('tm-scanned').textContent = scanned;

      const rangeStr = (firstTs && lastTs)
        ? `${utils.fmtDate(firstTs)} — ${utils.fmtDate(lastTs)}`
        : 'No completed transactions';
      document.getElementById('tm-range').textContent = rangeStr;
    },
    setStatus: (msg, isReady = false, isWarning = false) => {
      const el = document.getElementById('tm-status');
      if (el) {
        el.textContent = msg;
        el.classList.remove('ready', 'warning');
        if (isReady) el.classList.add('ready');
        if (isWarning) el.classList.add('warning');
      }
    },
    setButtonEnabled: (enabled) => {
      const btn = document.getElementById('tm-btn');
      if (btn) btn.disabled = !enabled;
    },
    run: async () => {
      if (state.isRunning) return;
      state.isRunning = true;

      try {
        ui.setButtonEnabled(false);
        state.cache.clear();

        await harvester.harvestAll((msg) => ui.setStatus(msg));

        const data = calculator.summarize();
        ui.updateDisplay(data);

        const totalCounted = data.settledCount + data.settlingCount;
        ui.setStatus(`✓ Complete! ${totalCounted} settled/settling, ${data.declinedCount} declined.`, true);
      } catch (err) {
        console.error('[Privacy Summary v47]', err);
        ui.setStatus(`Error: ${err.message}`, false, true);
      } finally {
        state.isRunning = false;
        ui.setButtonEnabled(true);
      }
    }
  };

  const init = () => {
    if (document.getElementById('tm-summary-panel')) return;
    ui.create();
    highlighter.init();
    console.log('[Privacy Summary v47] ✅ Panel initialized');
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

  let attempts = 0;
  const checkId = setInterval(() => {
    attempts++;
    if (document.getElementById('tm-summary-panel')) {
      clearInterval(checkId);
      return;
    }
    if (attempts > 20) {
      clearInterval(checkId);
      init();
    }
  }, 500);
})();