// ==UserScript==
// @name         eCW Lab Reports – Background TAB (stay on current)
// @namespace    solomon.ecw.labreports
// @version      2.4
// @description  Open lab details in a background tab using the site form; keep focus on current tab
// @match        https://mycw23.eclinicalweb.com/portal1851/jsp/jspnew/lab_reports.jsp*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const ACTION =
    'https://mycw23.eclinicalweb.com/portal1851/jsp/jspnew/getLabDetails.jsp?mainNav=MedRecords&ldpage=getLabDetails&pgId=lab_reports';

  // Small round green check button
  const css = `
    .tmx-open-btn {
      display:inline-flex; align-items:center; justify-content:center;
      width: 20px; height: 20px; margin-left: 10px;
      border-radius: 9999px; border: 1px solid #16a34a;
      background: #22c55e; color: #fff; font-weight: 900; line-height: 1;
      cursor: pointer; user-select: none; text-decoration:none;
      box-shadow: 0 2px 6px rgba(0,0,0,.18);
      transition: transform .08s ease, box-shadow .18s ease, filter .15s ease;
    }
    .tmx-open-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,.22); filter: brightness(1.02); }
    .tmx-open-btn:active { transform: translateY(0); }
    .tmx-open-btn svg { width: 12px; height: 12px; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.documentElement.appendChild(style);

  const getText = (el) => (el ? el.textContent.trim() : '');

  function openInBackgroundTab({ labId, reason, result }) {
    const form = document.querySelector('#frmMain');
    if (!form) return alert('Could not find frmMain form.');

    // fill the portal’s own POST fields (keeps session)
    const set = (sel, val) => { const i = form.querySelector(sel); if (i) i.value = val ?? ''; };
    set('input[name="labId"]', labId);
    set('input[name="reason"]', reason);
    set('input[name="result"]', result);

    form.method = 'post';
    form.action = ACTION;

    // Named target: browsers usually open this as a TAB (subject to your settings)
    const targetName = 'ecw_tab_' + labId + '_' + Date.now();

    // Create the target ahead of time (no size/features -> prefers tab)
    // If your settings force windows, this will still be a window.
    const newCtx = window.open('', targetName);
    if (!newCtx) return alert('Please allow pop-ups for this site.');

    // Submit into the named tab
    const prevTarget = form.target;
    form.target = targetName;
    form.submit();
    form.target = prevTarget || '';

    // Keep focus here so you stay on this tab
    setTimeout(() => { try { window.focus(); } catch {} }, 0);
  }

  function enhance() {
    const rows = document.querySelectorAll('#jqGridLabReport tr.jqgrow');
    rows.forEach((tr) => {
      if (tr.dataset.tmxEnhanced === '1') return;

      const labId = tr.id;
      const tds = tr.querySelectorAll('td');
      if (!labId || tds.length < 5) return;

      const nameCell = tds[2];
      const nameSpan = nameCell.querySelector('.labLinkStyle');
      if (!nameSpan) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tmx-open-btn';
      btn.title = 'Open details in a background tab';
      btn.setAttribute('aria-label', 'Open details in a background tab');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
        </svg>`;

      nameSpan.insertAdjacentElement('afterend', btn);
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        openInBackgroundTab({
          labId,
          reason: getText(tds[3]),
          result: getText(tds[4]),
        });
      }, { capture: true });

      tr.dataset.tmxEnhanced = '1';
    });
  }

  function bootstrap() {
    enhance();
    const grid = document.querySelector('#jqGridLabReport');
    if (grid) new MutationObserver(enhance).observe(grid, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
