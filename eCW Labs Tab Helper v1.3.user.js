// ==UserScript==
// @name         eCW Labs Tab Helper v1.3
// @namespace   eCW Labs Tab Helper v1.3
// @version      1.3
// @description  Make the Name column right-clickable and add an "open in new tab" POST button
// @match        https://mycw23.eclinicalweb.com/portal1851/jsp/jspnew/lab_reports.jsp*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // --------- Settings / selectors ----------
  const GRID_SEL = '#jqGridLabReport';
  const NAME_CELL_SEL = 'td[aria-describedby="jqGridLabReport_strLabName"]';
  const NAME_SPAN_SEL = `${NAME_CELL_SEL} .labLinkStyle`;

  // The server expects a POST to this path; the page already has frmMain and showlab(labId)
  const POST_ACTION = 'getLabDetails.jsp';
  const STATIC_GET = { mainNav: 'MedRecords', ldpage: 'getLabDetails', pgId: 'lab_reports' };

  // --------- Unblock the native context menu ----------
  // Some portals hook contextmenu to suppress the browser menu. We stop that.
  window.addEventListener(
    'contextmenu',
    (e) => {
      // cancel any site handler running in bubble phase
      e.stopPropagation();
    },
    true // capture early
  );

  // Also strip inline oncontextmenu attributes if present (defensive)
  function stripInlineContextBlocks(root = document) {
    root.querySelectorAll('[oncontextmenu]').forEach((el) => el.removeAttribute('oncontextmenu'));
  }
  stripInlineContextBlocks();

  // --------- Helpers ----------
  function qs(sel, node = document) { return node.querySelector(sel); }
  function qsa(sel, node = document) { return Array.from(node.querySelectorAll(sel)); }

  function buildHashHref(payload) {
    // This makes a *real* <a> so right-click works. When opened in a new tab,
    // we auto-POST using the hash (handled below).
    const here = location.origin + location.pathname + location.search;
    return here + '#openLab=' + encodeURIComponent(JSON.stringify(payload));
  }

  // Auto-POST in any tab that contains our hash payload
  function maybeAutoPostFromHash() {
    const h = location.hash;
    const marker = '#openLab=';
    if (!h || !h.startsWith(marker)) return;

    // remove hash from the URL bar to avoid re-trigger on refresh
    history.replaceState(null, '', location.pathname + location.search);

    let payload;
    try { payload = JSON.parse(decodeURIComponent(h.slice(marker.length))); } catch { return; }
    if (!payload || !payload.labId) return;

    // Build a form and submit via POST to getLabDetails.jsp (same host/path prefix)
    const form = document.createElement('form');
    form.method = 'POST';
    // Use same directory as current page (jsp/jspnew/)
    const base = location.href.replace(/\/[^\/]*$/, '/'); // trim to folder
    form.action = base + POST_ACTION;
    form.style.display = 'none';

    // Static GET params are also accepted as POST body safely (server reads parameters agnostically)
    const entries = {
      ...STATIC_GET,
      labId: payload.labId || '',
      reason: payload.reason || '',
      result: payload.result || ''
    };

    Object.entries(entries).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  }
  maybeAutoPostFromHash();

  function extractRowPayload(tr) {
    // Columns: [0]=Result Date, [1]=Order Date, [2]=Name, [3]=Reason, [4]=Result
    const tds = tr.querySelectorAll('td');
    return {
      labId: tr.id || '',
      reason: (tds[3]?.textContent || '').trim(),
      result: (tds[4]?.textContent || '').trim()
    };
  }

  function addOpenInNewTabButton(cell, payload) {
    if (cell.querySelector('.ecw-open-tab')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ecw-open-tab';
    btn.title = 'Open lab in a new tab';
    btn.textContent = '↗'; // small icon
    btn.style.cssText = 'margin-left:6px;padding:0 6px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Build and submit a POST form targeted to a NEW TAB (no reliance on right-click)
      const form = document.createElement('form');
      form.method = 'POST';
      form.target = '_blank';
      const base = location.href.replace(/\/[^\/]*$/, '/');
      form.action = base + POST_ACTION;
      form.style.display = 'none';

      const entries = {
        ...STATIC_GET,
        labId: payload.labId || '',
        reason: payload.reason || '',
        result: payload.result || ''
      };
      Object.entries(entries).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      form.remove();
    });

    // place after the text span/anchor
    cell.appendChild(btn);
  }

  function linkifyRow(tr) {
    if (!tr || tr.dataset.ecwLinked === '1') return;

    const nameCell = tr.querySelector(NAME_CELL_SEL);
    if (!nameCell) return;

    // Get the inner span (original clickable)
    const span = nameCell.querySelector('.labLinkStyle');
    if (!span) return;

    const payload = extractRowPayload(tr);

    // Build a REAL anchor so the browser shows "Open link in new tab"
    const a = document.createElement('a');
    a.textContent = span.textContent;
    a.className = span.className;
    a.style.cssText = span.style.cssText;
    a.href = buildHashHref(payload);
    a.target = '_blank';
    a.rel = 'noopener';

    // Preserve original left-click behavior (open in same tab via portal JS)
    a.addEventListener('click', (e) => {
      // pure left-click without modifiers -> behave like existing site
      if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (typeof window.showlab === 'function') {
          window.showlab(payload.labId);
        } else {
          // fallback: open via POST in same tab
          const form = document.createElement('form');
          form.method = 'POST';
          const base = location.href.replace(/\/[^\/]*$/, '/');
          form.action = base + POST_ACTION;
          form.style.display = 'none';
          const entries = { ...STATIC_GET, ...payload };
          Object.entries(entries).forEach(([name, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = value;
            form.appendChild(input);
          });
          document.body.appendChild(form);
