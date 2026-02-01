// ==UserScript==
// @name         One-Click Code Download v2
// @namespace    One-Click Code Download v2
// @version      2
// @description  Adds download buttons to code fields in ChatGPT, Z.Ai, Gemini, LMArena, Kimi, Le Chat, Meta AI, Copilot, and Grok for easy code file downloads.
// @author       OHAS
// @license      CC-BY-NC-ND-4.0
// @copyright    2025 OHAS. All Rights Reserved.
// @icon         https://cdn-icons-png.flaticon.com/512/8832/8832243.png
// @match        https://chatgpt.com/*
// @match        https://chat.z.ai/*
// @match        https://gemini.google.com/*
// @match        https://lmarena.ai/*
// @match        https://www.kimi.com/*
// @match        https://chat.mistral.ai/*
// @match        https://www.meta.ai/*
// @match        https://copilot.microsoft.com/*
// @match        https://grok.com/*
// @require      https://update.greasyfork.org/scripts/549920/Script%20Notifier.js
// @connect      gist.githubusercontent.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @downloadURL  https://update.greasyfork.org/scripts/550714/CodeDown.user.js
// @updateURL    https://update.greasyfork.org/scripts/550714/CodeDown.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // Prevent execution in iframes
    if (window.top !== window.self) return;

    // ===== Configuration =====
    const CONFIG = {
        notificationsUrl: 'https://gist.githubusercontent.com/0H4S/c89814228f65f9a48a26a8919cd13419/raw/codedown.notifications.json',
        scriptVersion: '2',
        checkInterval: 1000,
        labels: {
            download: 'Download',
            downloadCode: 'Download code'
        }
    };

    // Initialize script notifier
    const notifier = new ScriptNotifier(CONFIG);
    notifier.run();

    // ===== File Type Mappings =====
    const FILE_EXTENSIONS = {
        javascript: 'js',
        typescript: 'ts',
        html: 'html',
        css: 'css',
        json: 'json',
        python: 'py',
        java: 'java',
        c: 'c',
        cpp: 'cpp',
        'c++': 'cpp',
        'c#': 'cs',
        php: 'php',
        ruby: 'rb',
        go: 'go',
        rust: 'rs',
        swift: 'swift',
        kotlin: 'kt',
        scala: 'scala',
        shell: 'sh',
        bash: 'sh',
        sql: 'sql',
        markdown: 'md',
        yaml: 'yaml',
        xml: 'xml',
        text: 'txt',
        plain: 'txt',
        txt: 'txt'
    };

    const MIME_TYPES = {
        js: 'application/javascript',
        ts: 'application/typescript',
        html: 'text/html',
        css: 'text/css',
        json: 'application/json',
        py: 'text/x-python',
        java: 'text/x-java-source',
        c: 'text/x-csrc',
        cpp: 'text/x-c++src',
        cs: 'text/x-csharp',
        php: 'application/x-php',
        rb: 'application/x-ruby',
        go: 'text/x-go',
        rs: 'text/x-rust',
        swift: 'text/x-swift',
        kt: 'text/x-kotlin',
        scala: 'text/x-scala',
        sh: 'application/x-sh',
        sql: 'application/sql',
        md: 'text/markdown',
        yaml: 'application/x-yaml',
        xml: 'application/xml',
        txt: 'text/plain'
    };

    // ===== Utility Functions =====

    /**
     * Get MIME type for file extension
     * @param {string} ext - File extension
     * @returns {string} MIME type
     */
    function getMimeType(ext) {
        return MIME_TYPES[ext] || 'text/plain';
    }

    /**
     * Get file extension for language
     * @param {string} lang - Language name
     * @returns {string} File extension
     */
    function getExtension(lang) {
        return FILE_EXTENSIONS[lang.toLowerCase()] || 'txt';
    }

    /**
     * Generate filename with timestamp
     * @param {string} platform - Platform name
     * @param {string} fileType - File type/language
     * @param {string} ext - File extension
     * @returns {string} Generated filename
     */
    function generateFilename(platform, fileType, ext) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `CodeDown-${platform}-${fileType}-${timestamp}.${ext}`;
    }

    /**
     * Create and trigger file download
     * @param {string} fileName - Name for downloaded file
     * @param {string} content - File content
     * @param {string} mimeType - MIME type
     */
    function triggerDownload(fileName, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();

        setTimeout(() => {
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Create download SVG icon
     * @param {number} size - Icon size
     * @returns {SVGElement} SVG element
     */
    function createDownloadIcon(size = 20) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', '0 0 20 20');
        svg.setAttribute('fill', 'currentColor');
        svg.innerHTML = '<path d="M14.707 7.293a1 1 0 0 0-1.414 0L11 9.586V3a1 1 0 1 0-2 0v6.586L6.707 7.293a1 1 0 0 0-1.414 1.414l4 4a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0 0-1.414zM3 12a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3a1 1 0 1 1 2 0v3a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-3a1 1 0 0 1 1-1z"/>';
        return svg;
    }

    // ===== Platform Detection =====
    const PLATFORMS = {
        chatgpt: /chatgpt\.com/.test(location.hostname),
        zai: /chat\.z\.ai/.test(location.hostname),
        gemini: /gemini\.google\.com/.test(location.hostname),
        lmarena: /lmarena\.ai/.test(location.hostname),
        kimi: /kimi\.com/.test(location.hostname),
        mistral: /chat\.mistral\.ai/.test(location.hostname),
        metaai: /meta\.ai/.test(location.hostname),
        copilot: /copilot\.microsoft\.com/.test(location.hostname),
        grok: /grok\.com/.test(location.hostname)
    };

    // ===== ChatGPT Implementation =====
    if (PLATFORMS.chatgpt) {
        function createButtonChatGPT(container) {
            if (container.querySelector('.download-button-gpt')) return;

            const btn = document.createElement('button');
            btn.className = 'flex gap-1 items-center select-none py-1 download-button-gpt';
            btn.setAttribute('aria-label', CONFIG.labels.downloadCode);

            btn.appendChild(createDownloadIcon(20));
            btn.appendChild(document.createTextNode(CONFIG.labels.download));
            btn.addEventListener('click', downloadChatGPT);

            container.insertBefore(btn, container.firstChild);
        }

        function downloadChatGPT() {
            const block = this.closest('.contain-inline-size');
            if (!block) return;

            const typeEl = block.querySelector('.flex.items-center.text-token-text-secondary');
            const fileType = typeEl?.textContent.trim().toLowerCase() || 'txt';
            const ext = getExtension(fileType);
            const codeEl = block.querySelector('code');

            if (!codeEl) return;

            const fileName = generateFilename('ChatGPT', fileType, ext);
            triggerDownload(fileName, codeEl.textContent, getMimeType(ext));
        }

        const checkChatGPT = () => {
            document.querySelectorAll('.bg-token-bg-elevated-secondary.text-token-text-secondary.flex')
                .forEach(createButtonChatGPT);
        };

        setInterval(checkChatGPT, CONFIG.checkInterval);
        window.addEventListener('load', checkChatGPT);
    }

    // ===== Z.AI Implementation =====
    if (PLATFORMS.zai) {
        function createButtonZAI(copyBtn) {
            const container = copyBtn.parentElement;
            if (!container || container.querySelector('.download-button-zai')) return;

            const btn = document.createElement('button');
            btn.className = `${copyBtn.className} download-button-zai`;
            btn.setAttribute('aria-label', CONFIG.labels.downloadCode);

            const svg = createDownloadIcon(20);
            svg.classList.add('size-3');
            btn.appendChild(svg);
            btn.appendChild(document.createTextNode(CONFIG.labels.download));
            btn.addEventListener('click', downloadZAI);

            container.insertBefore(btn, copyBtn);
        }

        function downloadZAI() {
            const root = this.closest('.relative');
            if (!root) return;

            const contentEl = root.querySelector('.cm-content[data-language]');
            if (!contentEl) return;

            const lang = (contentEl.getAttribute('data-language') || 'txt').toLowerCase();
            const ext = getExtension(lang);
            const text = Array.from(contentEl.querySelectorAll('.cm-line'))
                .map(div => div.innerText.replace(/\u00a0/g, ' '))
                .join('\n');

            const fileName = generateFilename('ZAI', lang, ext);
            triggerDownload(fileName, text, getMimeType(ext));
        }

        const checkZAI = () => {
            document.querySelectorAll('button svg path[d^="M853.333333 298.666667"]').forEach(path => {
                const copyBtn = path.closest('button');
                if (copyBtn) createButtonZAI(copyBtn);
            });
        };

        setInterval(checkZAI, CONFIG.checkInterval);
        window.addEventListener('load', checkZAI);
    }

    // ===== Gemini Implementation =====
    if (PLATFORMS.gemini) {
        GM_addStyle(`
            #codedown-gemini-tooltip {
                position: fixed;
                background: white;
                color: black;
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 13px;
                font-family: sans-serif;
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition: opacity 0.2s, visibility 0.2s;
                z-index: 2147483647;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
        `);

        const tooltip = document.createElement('div');
        tooltip.id = 'codedown-gemini-tooltip';
        document.body.appendChild(tooltip);

        function createButtonGemini(copyBtn) {
            if (copyBtn.parentElement.querySelector('.download-button-gemini')) return;

            const btn = document.createElement('button');
            btn.className = copyBtn.className + ' download-button-gemini';
            btn.setAttribute('aria-label', CONFIG.labels.downloadCode);

            const matIcon = document.createElement('mat-icon');
            matIcon.className = copyBtn.querySelector('mat-icon').className;
            matIcon.setAttribute('role', 'img');
            matIcon.setAttribute('aria-hidden', 'true');
            matIcon.textContent = 'download';

            btn.appendChild(matIcon);
            btn.addEventListener('click', downloadGemini);

            btn.addEventListener('mouseover', (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                tooltip.textContent = CONFIG.labels.downloadCode;
                tooltip.style.opacity = '1';
                tooltip.style.visibility = 'visible';
                tooltip.style.top = `${rect.bottom + 8}px`;
                tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
            });

            btn.addEventListener('mouseout', () => {
                tooltip.style.opacity = '0';
                tooltip.style.visibility = 'hidden';
            });

            copyBtn.parentElement.insertBefore(btn, copyBtn);
        }

        function downloadGemini(event) {
            const header = event.currentTarget.closest('.buttons').parentElement;
            const spanType = header.querySelector('span');
            const fileType = spanType?.textContent.trim().toLowerCase() || 'txt';
            const ext = getExtension(fileType);

            const codeEl = event.currentTarget.closest('code-block').querySelector('code[data-test-id="code-content"]');
            if (!codeEl) return;

            const fileName = generateFilename('Gemini', fileType, ext);
            triggerDownload(fileName, codeEl.innerText, getMimeType(ext));
        }

        const checkGemini = () => {
            document.querySelectorAll('button.copy-button').forEach(createButtonGemini);
        };

        setInterval(checkGemini, CONFIG.checkInterval);
        window.addEventListener('load', checkGemini);
    }

    // ===== LMArena Implementation =====
    if (PLATFORMS.lmarena) {
        GM_addStyle(`
            .download-button-lmarena {
                position: relative;
            }
            .download-button-lmarena::before {
                content: attr(data-tooltip);
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                margin-top: 8px;
                background-color: white;
                color: black;
                padding: 5px 9px;
                border-radius: 5px;
                font-size: 13px;
                white-space: nowrap;
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition: opacity 0.2s, visibility 0.2s;
                z-index: 2147483647;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            .download-button-lmarena:hover::before {
                opacity: 1;
                visibility: visible;
            }
        `);

        function createButtonLMArena(copyBtn) {
            if (copyBtn.parentElement.classList.contains('code-down-buttons-wrapper')) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'flex items-center gap-2 code-down-buttons-wrapper';

            const btn = document.createElement('button');
            btn.className = copyBtn.className + ' download-button-lmarena';
            btn.setAttribute('aria-label', CONFIG.labels.downloadCode);
            btn.setAttribute('type', 'button');
            btn.setAttribute('data-tooltip', CONFIG.labels.downloadCode);

            const downloadSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            downloadSvg.setAttribute('width', '16');
            downloadSvg.setAttribute('height', '16');
            downloadSvg.setAttribute('viewBox', '0 0 24 24');
            downloadSvg.setAttribute('fill', 'none');
            downloadSvg.setAttribute('stroke', 'currentColor');
            downloadSvg.setAttribute('stroke-width', '2');
            downloadSvg.setAttribute('stroke-linecap', 'round');
            downloadSvg.setAttribute('stroke-linejoin', 'round');
            downloadSvg.innerHTML = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>';

            btn.appendChild(downloadSvg);
            btn.addEventListener('click', downloadLMArena);

            copyBtn.parentElement.insertBefore(wrapper, copyBtn);
            wrapper.appendChild(btn);
            wrapper.appendChild(copyBtn);
        }

        function downloadLMArena(event) {
            event.stopPropagation();
            const container = this.closest('[data-sentry-component="CodeBlock"]');
            if (!container) return;

            const langEl = container.querySelector('[data-sentry-component="CodeBlockGroup"] span');
            const fileType = langEl?.textContent.trim().toLowerCase() || 'txt';
            const ext = getExtension(fileType);

            const codeEl = container.querySelector('[data-sentry-element="CodeBlockCode"] code');
            if (!codeEl) return;

            const fileName = generateFilename('LMArena', fileType, ext);
            triggerDownload(fileName, codeEl.innerText, getMimeType(ext));
        }

        const checkLMArena = () => {
            document.querySelectorAll('[data-sentry-component="CodeBlock"] button[data-sentry-component="CopyButton"]')
                .forEach(createButtonLMArena);
        };

        setInterval(checkLMArena, CONFIG.checkInterval);
        window.addEventListener('load', checkLMArena);
    }

    // ===== Kimi Implementation =====
    if (PLATFORMS.kimi) {
        function createButtonKimi(copyBtn) {
            const headerContent = copyBtn.parentElement;
            if (!headerContent || headerContent.querySelector('.download-button-kimi')) return;

            const btn = copyBtn.cloneNode(true);
            btn.classList.add('download-button-kimi');
            btn.querySelector('span').textContent = CONFIG.labels.download;

            const svg = btn.querySelector('svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.innerHTML = '<path d="M5 20h14v-2H5v2zm14-9h-4V3H9v8H5l7 7l7-7z" fill="currentColor"></path>';

            btn.addEventListener('click', downloadKimi);

            if (!copyBtn.parentElement.classList.contains('codedown-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'codedown-wrapper';
                wrapper.style.display = 'flex';
                wrapper.style.gap = '8px';
                headerContent.replaceChild(wrapper, copyBtn);
                wrapper.appendChild(btn);
                wrapper.appendChild(copyBtn);
            }
        }

        function downloadKimi() {
            const codeBlock = this.closest('.segment-code');
            if (!codeBlock) return;

            const langEl = codeBlock.querySelector('.segment-code-lang');
            const fileType = langEl?.textContent.trim().toLowerCase() || 'txt';
            const ext = getExtension(fileType);

            const codeEl = codeBlock.querySelector('code');
            if (!codeEl) return;

            const fileName = generateFilename('Kimi', fileType, ext);
            triggerDownload(fileName, codeEl.innerText, getMimeType(ext));
        }

        const checkKimi = () => {
            document.querySelectorAll('.segment-code-header-content .simple-button').forEach(createButtonKimi);
        };

        setInterval(checkKimi, CONFIG.checkInterval);
        window.addEventListener('load', checkKimi);
    }

    // ===== Le Chat (Mistral) Implementation =====
    if (PLATFORMS.mistral) {
        function createButtonMistral(copyBtn) {
            const parent = copyBtn.parentElement;
            if (parent.querySelector('.download-button-mistral')) return;

            const btn = document.createElement('button');
            btn.className = copyBtn.className + ' download-button-mistral';
            btn.setAttribute('type', 'button');
            btn.setAttribute('aria-label', CONFIG.labels.downloadCode);

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            for (const attr of copyBtn.querySelector('svg').attributes) {
                svg.setAttribute(attr.name, attr.value);
            }
            svg.innerHTML = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>';

            btn.appendChild(svg);
            btn.appendChild(document.createTextNode(CONFIG.labels.download));
            btn.addEventListener('click', downloadMistral);

            parent.insertBefore(btn, copyBtn);
        }

        function downloadMistral() {
            const container = this.closest('.relative.rounded-md');
            if (!container) return;

            const codeEl = container.querySelector('code[class*="language-"]');
            if (!codeEl) return;

            const langMatch = Array.from(codeEl.classList).find(c => c.startsWith('language-'));
            const fileType = langMatch ? langMatch.replace('language-', '').toLowerCase() : 'txt';
            const ext = getExtension(fileType);

            const fileName = generateFilename('LeChat', fileType, ext);
            triggerDownload(fileName, codeEl.innerText, getMimeType(ext));
        }

        const checkMistral = () => {
            document.querySelectorAll('div[data-exclude-copy="true"] button svg.lucide-copy').forEach(svgEl => {
                const copyBtn = svgEl.closest('button');
                if (copyBtn) createButtonMistral(copyBtn);
            });
        };

        setInterval(checkMistral, CONFIG.checkInterval);
        window.addEventListener('load', checkMistral);
    }

    // ===== Meta AI Implementation =====
    if (PLATFORMS.metaai) {
        function createButtonMetaAI(copyBtn) {
            const parent = copyBtn.parentElement;
            if (!parent || parent.querySelector('.download-button-meta')) return;

            const btn = copyBtn.cloneNode(true);
            btn.classList.add('download-button-meta');
            btn.setAttribute('aria-label', CONFIG.labels.download);
            btn.removeAttribute('data-tooltip-content');

            const svg = btn.querySelector('svg');
            if (svg) {
                svg.innerHTML = '<path fill-rule="evenodd" clip-rule="evenodd" d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"></path>';
            }

            btn.addEventListener('click', downloadMetaAI);
            parent.insertBefore(btn, copyBtn);
        }

        function downloadMetaAI(event) {
            event.stopPropagation();
            const container = this.closest('.x78zum5.xdt5ytf.xfe5zq5');
            if (!container) return;

            const langEl = container.querySelector('div[class*="x6s0dn4"] > span');
            const fileType = langEl?.textContent.trim().toLowerCase() || 'txt';
            const ext = getExtension(fileType);

            const codeEl = container.querySelector('pre > code');
            if (!codeEl) return;

            const fileName = generateFilename('MetaAI', fileType, ext);
            triggerDownload(fileName, codeEl.innerText, getMimeType(ext));
        }

        const checkMetaAI = () => {
            const svgPathSelector = 'M5 14h1v2H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v1h-2V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1zm14 6h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1zm3-1a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8z';
            document.querySelectorAll(`svg path[d="${svgPathSelector}"]`).forEach(pathEl => {
                const copyBtn = pathEl.closest('div[role="button"]');
                if (copyBtn) {
                    const container = copyBtn.closest('.x78zum5.xdt5ytf.xfe5zq5');
                    if (container && container.querySelector('pre > code')) {
                        createButtonMetaAI(copyBtn);
                    }
                }
            });
        };

        setInterval(checkMetaAI, CONFIG.checkInterval);
        window.addEventListener('load', checkMetaAI);
    }

    // ===== Copilot Implementation =====
    if (PLATFORMS.copilot) {
        function createButtonCopilot(copyBtn) {
            const parent = copyBtn.parentElement;
            if (parent.querySelector('.download-button-copilot')) return;

            const btn = copyBtn.cloneNode(true);
            btn.classList.add('download-button-copilot');
            btn.setAttribute('title', CONFIG.labels.downloadCode);
            btn.removeAttribute('data-copy');

            const contentDiv = btn.querySelector('div');
            if (contentDiv) {
                contentDiv.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="w-5"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 19v-2h14v2H5z"></path></svg> ${CONFIG.labels.download}`;
            }

            btn.addEventListener('click', downloadCopilot);

            const wrapper = document.createElement('div');
            wrapper.className = 'flex items-center codedown-copilot-wrapper';
            wrapper.style.gap = '0.25rem';
            parent.insertBefore(wrapper, copyBtn);
            wrapper.appendChild(btn);
            wrapper.appendChild(copyBtn);
        }

        function downloadCopilot(event) {
            event.stopPropagation();
            const header = this.closest('.flex.justify-between.items-center');
            const container = header?.parentElement;
            if (!container) return;

            const langEl = container.querySelector('.capitalize');
            const fileType = langEl?.textContent.trim().toLowerCase() || 'txt';
            const ext = getExtension(fileType);

            const codeEl = container.querySelector('pre > code');
            if (!codeEl) return;

            const fileName = generateFilename('Copilot', fileType, ext);
            triggerDownload(fileName, codeEl.innerText, getMimeType(ext));
        }

        const checkCopilot = () => {
            const svgPathSelector = 'M8.5 2C7.39543 2 6.5 2.89543 6.5 4V14C6.5 15.1046 7.39543 16 8.5 16H14.5C15.6046 16 16.5 15.1046 16.5 14V4C16.5 2.89543 15.6046 2 14.5 2H8.5ZM7.5 4C7.5 3.44772 7.94772 3 8.5 3H14.5C15.0523 3 15.5 3.44772 15.5 4V14C15.5 14.5523 15.0523 15 14.5 15H8.5C7.94772 15 7.5 14.5523 7.5 14V4ZM4.5 6.00001C4.5 5.25973 4.9022 4.61339 5.5 4.26758V14.5C5.5 15.8807 6.61929 17 8 17H14.2324C13.8866 17.5978 13.2403 18 12.5 18H8C6.067 18 4.5 16.433 4.5 14.5V6.00001Z';
            document.querySelectorAll(`button svg mask path[d="${svgPathSelector}"]`).forEach(pathEl => {
                const copyBtn = pathEl.closest('button');
                if (copyBtn && !copyBtn.parentElement.classList.contains('codedown-copilot-wrapper')) {
                    createButtonCopilot(copyBtn);
                }
            });
        };

        setInterval(checkCopilot, CONFIG.checkInterval);
        window.addEventListener('load', checkCopilot);
    }

    // ===== Grok Implementation =====
    if (PLATFORMS.grok) {
        function createButtonGrok(collapseBtn) {
            const parent = collapseBtn.parentElement;
            if (parent.querySelector('.download-button-grok')) return;

            const btn = collapseBtn.cloneNode(true);
            btn.classList.add('download-button-grok');
            btn.setAttribute('aria-label', CONFIG.labels.downloadCode);

            const svg = btn.querySelector('svg');
            if (svg) {
                svg.innerHTML = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>';
                svg.setAttribute('viewBox', '0 0 24 24');
            }

            const span = btn.querySelector('span');
            if (span) {
                span.textContent = CONFIG.labels.download;
            }

            btn.addEventListener('click', downloadGrok);
            parent.insertBefore(btn, collapseBtn);
        }

        function downloadGrok(event) {
            event.stopPropagation();
            const container = this.closest('.relative.not-prose');
            if (!container) return;

            const langEl = container.querySelector('.flex.flex-row.px-4 span');
            const fileType = langEl?.textContent.trim().toLowerCase() || 'txt';
            const ext = getExtension(fileType);

            const codeEl = container.querySelector('pre.shiki > code');
            if (!codeEl) return;

            const codeText = Array.from(codeEl.querySelectorAll('.line'))
                .map(line => line.textContent)
                .join('\n');

            const fileName = generateFilename('Grok', fileType, ext);
            triggerDownload(fileName, codeText, getMimeType(ext));
        }

        const checkGrok = () => {
            document.querySelectorAll('button svg.lucide-chevrons-down-up').forEach(svgEl => {
                const collapseBtn = svgEl.closest('button');
                if (collapseBtn) createButtonGrok(collapseBtn);
            });
        };

        setInterval(checkGrok, CONFIG.checkInterval);
        window.addEventListener('load', checkGrok);
    }

    // ===== Initialization Complete =====
    console.log('[CodeDown] Initialized successfully for:', Object.keys(PLATFORMS).filter(k => PLATFORMS[k]).join(', '));

})();