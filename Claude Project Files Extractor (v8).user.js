// ==UserScript==
// @name         Claude Project Files Extractor (v8)
// @namespace    http://tampermonkey.net/
// @version      8
// @description  Download selected files OR all files from Claude projects - Fixed with exact DOM structure
// @author       sharmanhall + Solomon improvements
// @match        https://claude.ai/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=claude.ai
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================
    // CHANGELOG v8
    // ============================================================
    // - Based on EXACT DOM structure from Claude's HTML
    // - File cards are <button> inside [data-testid="file-thumbnail"]
    // - Selection uses bg-accent-secondary-000 class
    // - Must DESELECT before clicking to open (selection mode blocks open)
    // - Uses direct fetch via API instead of modal scraping
    // ============================================================

    const CONFIG = {
        SCROLL_WAIT_MS: 1200,
        MODAL_WAIT_MS: 3000,
        MODAL_CONTENT_WAIT_MS: 1500,
        BETWEEN_FILES_MS: 800,
        MAX_SCROLL_ATTEMPTS: 15,
        MIN_CONTENT_LENGTH: 10
    };

    const LOG_PREFIX = '[Claude Exporter v8]';
    const log = {
        info: (msg, ...args) => console.log(`${LOG_PREFIX} ℹ️ ${msg}`, ...args),
        success: (msg, ...args) => console.log(`${LOG_PREFIX} ✅ ${msg}`, ...args),
        warn: (msg, ...args) => console.warn(`${LOG_PREFIX} ⚠️ ${msg}`, ...args),
        error: (msg, ...args) => console.error(`${LOG_PREFIX} ❌ ${msg}`, ...args),
        debug: (msg, ...args) => console.log(`${LOG_PREFIX} 🔍 ${msg}`, ...args)
    };

    // ============================================================
    // UTILITIES
    // ============================================================

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function normalizeFilename(rawName) {
        if (!rawName || typeof rawName !== 'string') return 'unnamed_file';
        let name = rawName.trim()
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/[\x00-\x1F]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/[. ]+$/, '')
            .replace(/^[. ]+/, '');

        const exts = ['md', 'txt', 'csv', 'json', 'xml', 'pdf', 'docx', 'html', 'js', 'py', 'ts'];
        for (const ext of exts) {
            const pattern = new RegExp(`(\\.${ext})+$`, 'gi');
            name = name.replace(pattern, `.${ext}`);
        }
        return name || 'unnamed_file';
    }

    function getExtension(filename) {
        const match = filename.match(/\.([a-zA-Z0-9]+)$/);
        return match ? match[1].toLowerCase() : null;
    }

    function ensureExtension(filename, type) {
        if (getExtension(filename)) return filename;
        const map = { md: 'md', txt: 'txt', text: 'txt', csv: 'csv', pdf: 'pdf', json: 'json', html: 'html' };
        return `${filename}.${map[type?.toLowerCase()] || 'txt'}`;
    }

    function handleCollision(filename, usedNames) {
        if (!usedNames.has(filename.toLowerCase())) {
            usedNames.add(filename.toLowerCase());
            return filename;
        }
        const ext = getExtension(filename);
        const base = ext ? filename.slice(0, -(ext.length + 1)) : filename;
        let counter = 2;
        let newName;
        do {
            newName = ext ? `${base}__${counter}.${ext}` : `${base}__${counter}`;
            counter++;
        } while (usedNames.has(newName.toLowerCase()));
        usedNames.add(newName.toLowerCase());
        return newName;
    }

    // ============================================================
    // NOTIFICATIONS
    // ============================================================

    function showNotification(msg, type = 'info', duration = 4000) {
        const existing = document.querySelector('.claude-export-notif');
        if (existing) existing.remove();

        const colors = {
            info: '#1e88e5',
            success: '#43a047',
            error: '#e53935',
            warning: '#ff9800'
        };

        const el = document.createElement('div');
        el.className = 'claude-export-notif';
        el.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 12px 18px;
            border-radius: 8px; color: #fff; font-family: system-ui; font-size: 13px;
            z-index: 10001; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            background: ${colors[type] || colors.info}; max-width: 400px;
        `;
        el.textContent = msg;
        document.body.appendChild(el);
        if (duration > 0) setTimeout(() => el.remove(), duration);
        return el;
    }

    // ============================================================
    // JSZIP LOADER
    // ============================================================

    function loadJSZip() {
        return new Promise((resolve, reject) => {
            if (typeof JSZip !== 'undefined') {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => setTimeout(() => {
                typeof JSZip !== 'undefined' ? resolve() : reject(new Error('JSZip not available'));
            }, 200);
            script.onerror = () => reject(new Error('Failed to load JSZip'));
            document.head.appendChild(script);
        });
    }

    // ============================================================
    // FILE DETECTION - EXACT DOM STRUCTURE
    // ============================================================

    function getFileGrid() {
        return document.querySelector('ul.grid');
    }

    function getAllFileCards() {
        const grid = getFileGrid();
        if (!grid) return [];

        // Each file is in a <div> child of the grid
        // Inside is [data-testid="file-thumbnail"] containing a <button>
        return Array.from(grid.querySelectorAll('[data-testid="file-thumbnail"]'));
    }

    function getSelectedFileCards() {
        const allCards = getAllFileCards();
        const selected = [];

        for (const card of allCards) {
            // The checkbox has class bg-accent-secondary-000 when checked
            // Look for the SVG checkmark inside the label
            const checkboxDiv = card.querySelector('label div.bg-accent-secondary-000');
            const hasSvgCheck = card.querySelector('label svg path[d*="M2 6.5"]');

            if (checkboxDiv || hasSvgCheck) {
                selected.push(card);
                const h3 = card.querySelector('h3');
                log.debug('Selected:', h3?.textContent);
            }
        }

        log.info(`Found ${selected.length} selected files`);
        return selected;
    }

    function extractFileInfo(card) {
        // Check if it's a PDF (has data-testid ending in .pdf)
        const pdfContainer = card.closest('[data-testid$=".pdf"]');
        if (pdfContainer) {
            const filename = pdfContainer.getAttribute('data-testid');
            return { domFilename: filename, type: 'pdf', isPdf: true };
        }

        // Check for PDF via img alt
        const pdfImg = card.querySelector('img[alt$=".pdf"]');
        if (pdfImg) {
            return { domFilename: pdfImg.alt, type: 'pdf', isPdf: true };
        }

        // Regular text file - find h3
        const h3 = card.querySelector('h3');
        const typeBadge = card.querySelector('p.uppercase');

        if (h3) {
            return {
                domFilename: h3.textContent.trim(),
                type: typeBadge?.textContent?.trim()?.toLowerCase() || 'txt',
                isPdf: false
            };
        }

        return null;
    }

    // ============================================================
    // MODAL HANDLING
    // ============================================================

    async function waitForModal(timeout = CONFIG.MODAL_WAIT_MS) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const modal = document.querySelector('[role="dialog"]');
            if (modal && modal.offsetHeight > 0) {
                log.debug('Modal appeared');
                await sleep(CONFIG.MODAL_CONTENT_WAIT_MS);
                return modal;
            }
            await sleep(100);
        }
        return null;
    }

    async function closeModal() {
        // Try ESC key multiple times
        for (let i = 0; i < 3; i++) {
            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                bubbles: true
            }));
            await sleep(200);
            if (!document.querySelector('[role="dialog"]')) {
                return true;
            }
        }

        // Click close button
        const closeBtn = document.querySelector('[role="dialog"] button');
        if (closeBtn) {
            closeBtn.click();
            await sleep(300);
        }

        return !document.querySelector('[role="dialog"]');
    }

    // ============================================================
    // CLEAR SELECTION MODE
    // ============================================================

    async function clearSelectionMode() {
        // Click the X button to exit selection mode
        const cancelBtn = document.querySelector('button[aria-label="Cancel"]');
        if (cancelBtn) {
            log.debug('Clearing selection mode...');
            cancelBtn.click();
            await sleep(300);
            return true;
        }
        return false;
    }

    // ============================================================
    // OPEN FILE - HANDLE SELECTION MODE
    // ============================================================

    async function openFile(card) {
        // The main button inside the card opens the file
        const btn = card.querySelector('button');
        if (!btn) {
            log.error('No button found in card');
            return null;
        }

        // Scroll into view
        btn.scrollIntoView({ behavior: 'instant', block: 'center' });
        await sleep(200);

        // Click the button
        log.debug('Clicking file button...');
        btn.click();
        await sleep(300);

        // Wait for modal
        const modal = await waitForModal(CONFIG.MODAL_WAIT_MS);
        if (modal) {
            log.debug('Modal opened successfully');
            return modal;
        }

        log.warn('Modal did not open on first try');
        return null;
    }

    // ============================================================
    // CONTENT EXTRACTION
    // ============================================================

    function extractTextContent(modal) {
        // Look for code/pre content
        const codeEl = modal.querySelector('pre code') || modal.querySelector('pre');
        if (codeEl && codeEl.textContent.length > CONFIG.MIN_CONTENT_LENGTH) {
            return codeEl.textContent;
        }

        // Look for whitespace-pre-wrap (used for markdown)
        const preWrap = modal.querySelector('.whitespace-pre-wrap');
        if (preWrap && preWrap.textContent.length > CONFIG.MIN_CONTENT_LENGTH) {
            return preWrap.textContent;
        }

        // Look for any scrollable content area
        const scrollArea = modal.querySelector('.overflow-auto, .overflow-y-auto');
        if (scrollArea && scrollArea.textContent.length > CONFIG.MIN_CONTENT_LENGTH) {
            // Filter out UI elements
            const text = scrollArea.textContent;
            const filtered = text.split('\n')
                .filter(l => l.trim().length > 2)
                .filter(l => !l.match(/^(Close|Download|Export|Edit|Delete|\d+\s*lines?|MD|TXT|PDF)$/i))
                .join('\n');
            if (filtered.length > CONFIG.MIN_CONTENT_LENGTH) {
                return filtered;
            }
        }

        return null;
    }

    function extractPdfUrl(modal) {
        const link = modal.querySelector('a[href*="/files/"]') ||
                    modal.querySelector('a[download]');
        return link?.href || null;
    }

    // ============================================================
    // SINGLE FILE EXPORT
    // ============================================================

    async function exportSingleFile(card, usedNames = new Set()) {
        const fileInfo = extractFileInfo(card);
        if (!fileInfo) {
            throw new Error('Could not extract file info');
        }

        log.info(`Processing: ${fileInfo.domFilename}`);

        let filename = normalizeFilename(fileInfo.domFilename);
        filename = ensureExtension(filename, fileInfo.type);
        filename = handleCollision(filename, usedNames);

        // Open the file
        const modal = await openFile(card);
        if (!modal) {
            throw new Error('Modal did not open');
        }

        let content = null;
        let blob = null;

        try {
            if (fileInfo.isPdf || fileInfo.type === 'pdf') {
                const pdfUrl = extractPdfUrl(modal);
                if (!pdfUrl) throw new Error('PDF URL not found');
                const resp = await fetch(pdfUrl, { credentials: 'include' });
                if (!resp.ok) throw new Error(`PDF fetch failed: ${resp.status}`);
                blob = await resp.blob();
                log.success(`PDF: ${filename}`);
            } else {
                content = extractTextContent(modal);
                if (!content || content.length < CONFIG.MIN_CONTENT_LENGTH) {
                    throw new Error(`Content too short (${content?.length || 0} chars)`);
                }
                log.success(`Text: ${filename} (${content.length} chars)`);
            }
        } finally {
            await closeModal();
            await sleep(400);
        }

        return { filename, content, blob, fileInfo };
    }

    // ============================================================
    // DOWNLOAD FUNCTIONS
    // ============================================================

    function downloadFile(filename, content) {
        const blob = content instanceof Blob ? content : new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function downloadAsZip(files, projectName) {
        await loadJSZip();
        const zip = new JSZip();

        for (const { filename, content, blob } of files) {
            if (blob) {
                zip.file(filename, blob);
            } else if (content) {
                zip.file(filename, content);
            }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
        const safeName = projectName.replace(/[^a-zA-Z0-9]/g, '_');
        const zipFilename = `${safeName}_${timestamp}.zip`;

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        downloadFile(zipFilename, zipBlob);
        return zipFilename;
    }

    // ============================================================
    // MAIN EXPORT - SELECTED FILES
    // ============================================================

    async function exportSelected() {
        // First, get the selected files info BEFORE clearing selection
        const selectedCards = getSelectedFileCards();

        if (selectedCards.length === 0) {
            showNotification('❌ No files selected! Check the boxes first.', 'warning', 5000);
            return;
        }

        // Store file info and card references
        const filesToExport = selectedCards.map(card => ({
            card,
            fileInfo: extractFileInfo(card)
        })).filter(f => f.fileInfo);

        log.info(`Will export ${filesToExport.length} files`);

        // IMPORTANT: Clear selection mode first so clicks open files, not toggle selection
        await clearSelectionMode();
        await sleep(500);

        const notif = showNotification(`📥 Exporting ${filesToExport.length} file(s)...`, 'info', 0);
        const usedNames = new Set();
        const exported = [];
        const failed = [];

        try {
            // Re-find cards after clearing selection (DOM may have changed)
            const allCards = getAllFileCards();

            for (let i = 0; i < filesToExport.length; i++) {
                const { fileInfo } = filesToExport[i];
                const displayName = fileInfo.domFilename;
                notif.textContent = `📥 ${i + 1}/${filesToExport.length}: ${displayName}`;

                // Find this file in current DOM by matching filename
                const card = allCards.find(c => {
                    const h3 = c.querySelector('h3');
                    const pdfImg = c.querySelector('img[alt$=".pdf"]');
                    const name = h3?.textContent?.trim() || pdfImg?.alt || '';
                    return name === fileInfo.domFilename;
                });

                if (!card) {
                    log.error(`Could not find card for: ${displayName}`);
                    failed.push({ name: displayName, error: 'Card not found after deselect' });
                    continue;
                }

                try {
                    const result = await exportSingleFile(card, usedNames);
                    exported.push(result);
                } catch (err) {
                    log.error(`Failed: ${displayName} -`, err.message);
                    failed.push({ name: displayName, error: err.message });
                }

                await sleep(CONFIG.BETWEEN_FILES_MS);
            }

            notif.remove();

            if (exported.length === 0) {
                showNotification(`❌ Export failed for all files. ${failed[0]?.error}`, 'error', 6000);
                return;
            }

            if (exported.length === 1) {
                const { filename, content, blob } = exported[0];
                downloadFile(filename, blob || content);
                showNotification(`✅ Downloaded: ${filename}`, 'success');
            } else {
                const projectName = getProjectTitle();
                const zipName = await downloadAsZip(exported, projectName);
                const msg = failed.length > 0
                    ? `✅ ${exported.length} files (${failed.length} failed)`
                    : `✅ ${exported.length} files`;
                showNotification(`${msg} → ${zipName}`, 'success', 5000);
            }

        } catch (error) {
            notif.remove();
            log.error('Export failed:', error);
            showNotification(`❌ Export failed: ${error.message}`, 'error');
        }
    }

    // ============================================================
    // MAIN EXPORT - ALL FILES
    // ============================================================

    async function exportAll() {
        // Clear any selection first
        await clearSelectionMode();
        await sleep(300);

        const notif = showNotification('📦 Scanning files...', 'info', 0);

        try {
            const grid = getFileGrid();
            if (!grid) {
                notif.remove();
                showNotification('❌ File grid not found', 'error');
                return;
            }

            // Scroll to load all files
            let lastCount = 0, stable = 0;
            for (let i = 0; i < CONFIG.MAX_SCROLL_ATTEMPTS && stable < 3; i++) {
                grid.scrollTop = grid.scrollHeight;
                await sleep(CONFIG.SCROLL_WAIT_MS);
                const count = getAllFileCards().length;
                if (count === lastCount) stable++;
                else stable = 0;
                lastCount = count;
            }

            const allCards = getAllFileCards();
            if (allCards.length === 0) {
                notif.remove();
                showNotification('❌ No files found', 'error');
                return;
            }

            notif.textContent = `📦 Found ${allCards.length} files...`;

            const usedNames = new Set();
            const exported = [];
            let failCount = 0;

            for (let i = 0; i < allCards.length; i++) {
                const fileInfo = extractFileInfo(allCards[i]);
                notif.textContent = `📦 ${i + 1}/${allCards.length}: ${fileInfo?.domFilename || 'file'}`;

                try {
                    const result = await exportSingleFile(allCards[i], usedNames);
                    exported.push(result);
                } catch (e) {
                    log.warn(`Failed:`, e.message);
                    failCount++;
                }
                await sleep(CONFIG.BETWEEN_FILES_MS);
            }

            notif.remove();

            if (exported.length === 0) {
                showNotification('❌ No files exported', 'error');
                return;
            }

            const projectName = getProjectTitle();
            const zipName = await downloadAsZip(exported, projectName);

            const msg = failCount > 0
                ? `✅ ${exported.length}/${allCards.length} (${failCount} failed)`
                : `✅ All ${exported.length} files`;
            showNotification(`${msg} → ${zipName}`, 'success', 6000);

        } catch (error) {
            notif.remove();
            showNotification(`❌ Export failed: ${error.message}`, 'error');
        }
    }

    function getProjectTitle() {
        const h1 = document.querySelector('h1');
        if (h1?.textContent?.trim() && !['Claude', 'Projects'].includes(h1.textContent.trim())) {
            return h1.textContent.trim();
        }
        return 'Claude_Project';
    }

    // ============================================================
    // UI
    // ============================================================

    function createUI() {
        const existing = document.querySelector('#claude-export-container');
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.id = 'claude-export-container';
        container.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 10000;
            display: flex; flex-direction: column; gap: 8px;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        const btnStyle = `
            padding: 10px 16px; border: none; border-radius: 8px;
            color: white; font-size: 13px; font-weight: 600;
            cursor: pointer; transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            min-width: 130px; text-align: center;
        `;

        const btnSelected = document.createElement('button');
        btnSelected.innerHTML = '📥 Selected';
        btnSelected.style.cssText = btnStyle + 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);';
        btnSelected.title = 'Export checked files (will clear selection first)';
        btnSelected.onclick = exportSelected;

        const btnAll = document.createElement('button');
        btnAll.innerHTML = '📦 All as ZIP';
        btnAll.style.cssText = btnStyle + 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);';
        btnAll.onclick = exportAll;

        [btnSelected, btnAll].forEach(btn => {
            btn.onmouseenter = () => btn.style.transform = 'translateY(-2px)';
            btn.onmouseleave = () => btn.style.transform = 'translateY(0)';
        });

        container.appendChild(btnSelected);
        container.appendChild(btnAll);
        document.body.appendChild(container);
        log.success('UI v8 ready');
    }

    // ============================================================
    // INIT
    // ============================================================

    function init() {
        log.info('Claude Project Files Extractor v8');

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createUI);
        } else {
            createUI();
        }

        let currentUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== currentUrl) {
                currentUrl = location.href;
                setTimeout(createUI, 1000);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    init();

})();