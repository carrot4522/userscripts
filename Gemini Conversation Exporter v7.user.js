// ==UserScript==
// @name         Gemini Conversation Exporter v7
// @namespace    http://tampermonkey.net/
// @version      7
// @description  Export Gemini conversations - Enhanced extraction with better role detection
// @author       John
// @match        https://gemini.google.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gemini.google.com
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // =============================================
    // CONSTANTS AND DEFAULT SETTINGS
    // =============================================

    const defaultSettings = {
        conversationTemplate: '[{timestamp}] {conversation_title}.md',
        dateFormat: 'YYYY-MM-DD_HH-MM-SS',
        includeImages: true,
        includeMetadata: true,
        userLabel: '👤 YOU ASKED',
        geminiLabel: '🤖 GEMINI REPLIED',
        useHeavySeparators: true,
        addRolePrefix: true,
        debugMode: false
    };

    // =============================================
    // SETTINGS MANAGEMENT
    // =============================================

    function loadSettings() {
        const settings = {};
        for (const [key, defaultValue] of Object.entries(defaultSettings)) {
            settings[key] = GM_getValue(key, defaultValue);
        }
        return settings;
    }

    function saveSettings(settings) {
        for (const [key, value] of Object.entries(settings)) {
            GM_setValue(key, value);
        }
    }

    // =============================================
    // UTILITY FUNCTIONS
    // =============================================

    function debugLog(message, data = null) {
        const settings = loadSettings();
        if (settings.debugMode) {
            if (data) {
                console.log(`[Gemini Exporter v7] ${message}`, data);
            } else {
                console.log(`[Gemini Exporter v7] ${message}`);
            }
        }
    }

    function sanitizeFileName(name) {
        return name.replace(/[\\/:*?"<>|]/g, '_')
                  .replace(/\s+/g, '_')
                  .replace(/__+/g, '_')
                  .replace(/^_+|_+$/g, '')
                  .slice(0, 100);
    }

    function formatTimestamp(date, format) {
        const d = date instanceof Date ? date : new Date();

        const components = {
            year: d.getFullYear(),
            month: String(d.getMonth() + 1).padStart(2, '0'),
            day: String(d.getDate()).padStart(2, '0'),
            hour: String(d.getHours()).padStart(2, '0'),
            minute: String(d.getMinutes()).padStart(2, '0'),
            second: String(d.getSeconds()).padStart(2, '0')
        };

        switch (format) {
            case 'YYYY-MM-DD_HH-MM-SS':
                return `${components.year}-${components.month}-${components.day}_${components.hour}-${components.minute}-${components.second}`;
            case 'ISO':
                return `${components.year}-${components.month}-${components.day}T${components.hour}-${components.minute}-${components.second}`;
            case 'YYYYMMDDHHMMSS':
            default:
                return `${components.year}${components.month}${components.day}${components.hour}${components.minute}${components.second}`;
        }
    }

    function generateFilename(title, settings) {
        const timestamp = formatTimestamp(new Date(), settings.dateFormat);
        const sanitizedTitle = sanitizeFileName(title || 'Gemini_Conversation');

        return settings.conversationTemplate
            .replace('{timestamp}', timestamp)
            .replace('{conversation_title}', sanitizedTitle);
    }

    function downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    function showNotification(message, type = 'info') {
        if (window !== window.top) return;

        document.querySelectorAll('.gemini-exporter-notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = 'gemini-exporter-notification';
        notification.setAttribute('data-gemini-exporter', 'true');

        const colors = {
            error: '#f44336',
            success: '#4CAF50',
            info: '#2196F3',
            warning: '#ff9800'
        };

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-family: 'Google Sans', system-ui, -apple-system, sans-serif;
            font-size: 14px;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            background-color: ${colors[type] || colors.info};
            animation: slideIn 0.3s ease-out;
        `;

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 4000);
    }

    // =============================================
    // CONVERSATION EXTRACTION - IMPROVED
    // =============================================

    function getConversationTitle() {
        let doc = document;
        if (window !== window.top) {
            try {
                doc = window.top.document;
            } catch (e) {
                debugLog('Cannot access parent document, using current');
            }
        }

        const titleSelectors = [
            'h1[data-test-id]',
            '.conversation-title',
            'h1.mat-mdc-card-title',
            '[role="heading"][aria-level="1"]',
            'h1'
        ];

        for (const selector of titleSelectors) {
            const element = doc.querySelector(selector);
            if (element && element.textContent.trim() && element.textContent.length < 200) {
                const title = element.textContent.trim();
                if (!title.includes('Gemini') && !title.includes('Google')) {
                    debugLog('Found title:', title);
                    return title;
                }
            }
        }

        const url = window.top ? window.top.location.href : window.location.href;
        const urlMatch = url.match(/\/chat\/([^/?]+)/);
        if (urlMatch) {
            return `Conversation_${urlMatch[1].substring(0, 8)}`;
        }

        return 'Gemini_Conversation';
    }

    function isOurElement(element) {
        if (element.hasAttribute('data-gemini-exporter')) return true;
        if (element.closest('[data-gemini-exporter]')) return true;
        if (element.closest('.gemini-exporter-notification')) return true;
        if (element.id === 'gemini-exporter-settings') return true;
        return false;
    }

    function isUIElement(text) {
        const uiPatterns = [
            'Export to Docs',
            'Share & export',
            'Extracting conversation',
            'Copy code',
            'Conversation with Gemini',
            'Google apps',
            'New chat',
            'More options',
            'Show drafts',
            'Run again',
            'Modify response'
        ];

        return uiPatterns.some(pattern =>
            text.includes(pattern) && text.length < 300
        );
    }

    function extractConversation() {
        const messages = [];

        debugLog('Starting extraction...');
        debugLog('Current URL:', window.location.href);
        debugLog('In iframe:', window !== window.top);

        let chatContainer = document.querySelector('chat-window') ||
                           document.querySelector('main[role="main"]') ||
                           document.querySelector('main') ||
                           document.body;

        debugLog('Chat container:', chatContainer.tagName);

        let messageElements = Array.from(chatContainer.querySelectorAll('message-content'));
        debugLog(`Found ${messageElements.length} message-content elements`);

        if (messageElements.length === 0) {
            messageElements = Array.from(chatContainer.querySelectorAll('[data-test-id*="conversation-turn"]'));
            debugLog(`Found ${messageElements.length} conversation-turn elements`);
        }

        if (messageElements.length === 0) {
            messageElements = Array.from(chatContainer.querySelectorAll('model-response, user-query'));
            debugLog(`Found ${messageElements.length} model-response/user-query elements`);
        }

        if (messageElements.length === 0) {
            const allElements = chatContainer.querySelectorAll('div[class*="conversation"], div[class*="message"], div[class*="turn"], p[class*="message"]');

            messageElements = Array.from(allElements).filter(el => {
                if (isOurElement(el)) return false;

                const text = el.textContent.trim();
                if (text.length < 50 || text.length > 100000) return false;
                if (el.closest('nav, header, footer, aside, button')) return false;

                const childDivs = el.querySelectorAll('div').length;
                if (childDivs > 20) return false;

                return !isUIElement(text);
            });

            debugLog(`Fallback found ${messageElements.length} text blocks`);
        }

        let lastRole = null;
        let messageIndex = 0;
        const seenContent = new Set();

        messageElements.forEach((element, idx) => {
            let content = element.textContent.trim();

            if (content.length < 50 || content.length > 100000) {
                debugLog(`Skipping element ${idx}: length ${content.length}`);
                return;
            }

            const contentKey = content.substring(0, 200);
            if (seenContent.has(contentKey)) {
                debugLog(`Skipping element ${idx}: duplicate`);
                return;
            }
            seenContent.add(contentKey);

            if (isOurElement(element) || isUIElement(content)) {
                debugLog(`Skipping element ${idx}: UI element`);
                return;
            }

            let role = 'Unknown';
            const elementHtml = element.outerHTML.toLowerCase();
            const classList = Array.from(element.classList).join(' ').toLowerCase();
            const tagName = element.tagName.toLowerCase();

            if (tagName === 'user-query' || elementHtml.includes('data-test-id="user') ||
                classList.includes('user-') || elementHtml.includes('role="user"')) {
                role = 'User';
            } else if (tagName === 'model-response' || elementHtml.includes('data-test-id="model') ||
                       classList.includes('model-') || classList.includes('gemini-') ||
                       elementHtml.includes('role="assistant"')) {
                role = 'Gemini';
            } else {
                let parent = element.parentElement;
                for (let i = 0; i < 5 && parent && role === 'Unknown'; i++) {
                    const parentClass = Array.from(parent.classList).join(' ').toLowerCase();
                    const parentTag = parent.tagName.toLowerCase();

                    if (parentTag === 'user-query' || parentClass.includes('user-')) {
                        role = 'User';
                    } else if (parentTag === 'model-response' || parentClass.includes('model-') ||
                               parentClass.includes('gemini-') || parentClass.includes('assistant-')) {
                        role = 'Gemini';
                    }
                    parent = parent.parentElement;
                }
            }

            if (role === 'Unknown') {
                role = (lastRole === null || lastRole === 'Gemini') ? 'User' : 'Gemini';
            }

            const images = [];
            const imgElements = element.querySelectorAll('img');
            imgElements.forEach(img => {
                if (img.src &&
                    !img.src.includes('icon') &&
                    !img.src.includes('avatar') &&
                    !img.src.includes('logo') &&
                    img.width > 50 && img.height > 50) {
                    images.push({
                        src: img.src,
                        alt: img.alt || 'Image'
                    });
                }
            });

            messageIndex++;
            messages.push({
                index: messageIndex,
                role: role,
                content: content,
                images: images
            });

            lastRole = role;

            debugLog(`Message ${messageIndex}: ${role} (${content.substring(0, 80).replace(/\n/g, ' ')}...)`);
        });

        const userCount = messages.filter(m => m.role === 'User').length;
        const geminiCount = messages.filter(m => m.role === 'Gemini').length;

        debugLog(`Extraction complete: ${messages.length} total (${userCount} User, ${geminiCount} Gemini)`);

        return messages;
    }

    // =============================================
    // MARKDOWN GENERATION
    // =============================================

    function generateMarkdown(messages, settings) {
        const sections = [];
        const title = getConversationTitle();
        const exportTime = new Date();

        const url = window.top ? window.top.location.href : window.location.href;

        if (settings.includeMetadata) {
            sections.push(`# ${title}`);
            sections.push('');
            sections.push('| 📊 **Export Information** | |');
            sections.push('|---------------------------|---------|');
            sections.push(`| **Exported** | ${exportTime.toLocaleString()} |`);
            sections.push(`| **URL** | ${url} |`);
            sections.push(`| **Total Messages** | ${messages.length} |`);

            const userCount = messages.filter(m => m.role === 'User').length;
            const geminiCount = messages.filter(m => m.role === 'Gemini').length;
            sections.push(`| **Your Messages** | ${userCount} |`);
            sections.push(`| **Gemini Messages** | ${geminiCount} |`);

            sections.push('');
            sections.push('---');
            sections.push('');
        }

        messages.forEach((message, idx) => {
            const isUser = message.role === 'User';

            if (settings.useHeavySeparators && idx > 0) {
                sections.push('');
                sections.push('═══════════════════════════════════════════════════════════════════');
                sections.push('');
            }

            if (isUser) {
                sections.push(`# ${settings.userLabel}`);
                sections.push('');
                sections.push(`**Message ${message.index}** | *You wrote:*`);
            } else {
                sections.push(`# ${settings.geminiLabel}`);
                sections.push('');
                sections.push(`**Message ${message.index}** | *Gemini responded:*`);
            }

            sections.push('');
            sections.push('---');
            sections.push('');

            if (settings.addRolePrefix) {
                const rolePrefix = isUser ? '**[YOU]**' : '**[GEMINI]**';
                const paragraphs = message.content.split('\n\n');

                paragraphs.forEach((para, pIdx) => {
                    if (pIdx === 0) {
                        sections.push(`${rolePrefix} ${para}`);
                    } else {
                        sections.push(para);
                    }
                    sections.push('');
                });
            } else {
                sections.push(message.content);
                sections.push('');
            }

            if (settings.includeImages && message.images.length > 0) {
                sections.push('');
                sections.push('**📷 Attached Images:**');
                sections.push('');
                sections.push('| # | Image | Description |');
                sections.push('|---|-------|-------------|');
                message.images.forEach((img, imgIdx) => {
                    sections.push(`| ${imgIdx + 1} | ![${img.alt}](${img.src}) | ${img.alt || `Image ${imgIdx + 1}`} |`);
                });
                sections.push('');
            }
        });

        sections.push('');
        sections.push('═══════════════════════════════════════════════════════════════════');
        sections.push('');
        sections.push('**🏁 End of Conversation**');
        sections.push('');
        sections.push(`*Total messages: ${messages.length} | Exported: ${exportTime.toLocaleString()}*`);

        return sections.join('\n');
    }

    // =============================================
    // EXPORT FUNCTION
    // =============================================

    async function exportConversation() {
        try {
            showNotification('Extracting conversation...', 'info');

            await new Promise(resolve => setTimeout(resolve, 100));

            const settings = loadSettings();
            const messages = extractConversation();

            if (messages.length === 0) {
                showNotification('⚠️ No messages found. Try scrolling through conversation first.', 'error');
                console.error('[Gemini Exporter v7] No messages extracted. Enable debug mode in settings for details.');
                return;
            }

            const userCount = messages.filter(m => m.role === 'User').length;
            const geminiCount = messages.filter(m => m.role === 'Gemini').length;

            if (userCount === 0) {
                showNotification('⚠️ Only found Gemini messages. Enable debug mode in settings.', 'warning');
            }

            const markdown = generateMarkdown(messages, settings);
            const title = getConversationTitle();
            const filename = generateFilename(title, settings);

            downloadFile(filename, markdown);

            if (userCount > 0 && geminiCount > 0) {
                showNotification(`✅ Exported ${messages.length} messages (${userCount} you, ${geminiCount} Gemini)`, 'success');
            } else {
                showNotification(`⚠️ Exported ${messages.length} messages. Check file for issues.`, 'warning');
            }

        } catch (error) {
            console.error('[Gemini Exporter v7] Export failed:', error);
            showNotification(`❌ Export failed: ${error.message}`, 'error');
        }
    }

    // =============================================
    // SETTINGS UI
    // =============================================

    function showSettingsUI() {
        document.getElementById('gemini-exporter-settings')?.remove();
        const currentSettings = loadSettings();

        const overlay = document.createElement('div');
        overlay.id = 'gemini-exporter-settings';
        overlay.innerHTML = `
            <div class="gemini-settings-overlay">
                <div class="gemini-settings-modal">
                    <div class="gemini-settings-header">
                        <h2>⚙️ Gemini Exporter Settings v7</h2>
                        <button class="gemini-settings-close" type="button">×</button>
                    </div>

                    <div class="gemini-settings-content">
                        <div class="gemini-settings-section">
                            <h3>📁 Filename Template</h3>
                            <div class="gemini-setting-group">
                                <label for="conversationTemplate">Template:</label>
                                <input type="text" id="conversationTemplate" value="${currentSettings.conversationTemplate}">
                                <p class="gemini-settings-help">Variables: {timestamp}, {conversation_title}</p>
                            </div>
                        </div>

                        <div class="gemini-settings-section">
                            <h3>📅 Date Format</h3>
                            <div class="gemini-setting-group">
                                <label for="dateFormat">Format:</label>
                                <select id="dateFormat">
                                    <option value="YYYYMMDDHHMMSS" ${currentSettings.dateFormat === 'YYYYMMDDHHMMSS' ? 'selected' : ''}>Compact (YYYYMMDDHHMMSS)</option>
                                    <option value="YYYY-MM-DD_HH-MM-SS" ${currentSettings.dateFormat === 'YYYY-MM-DD_HH-MM-SS' ? 'selected' : ''}>Readable (YYYY-MM-DD_HH-MM-SS)</option>
                                    <option value="ISO" ${currentSettings.dateFormat === 'ISO' ? 'selected' : ''}>ISO (YYYY-MM-DDTHH-MM-SS)</option>
                                </select>
                            </div>
                        </div>

                        <div class="gemini-settings-section">
                            <h3>👥 Role Labels</h3>
                            <div class="gemini-setting-group">
                                <label for="userLabel">Your Label:</label>
                                <input type="text" id="userLabel" value="${currentSettings.userLabel}">
                            </div>
                            <div class="gemini-setting-group">
                                <label for="geminiLabel">Gemini Label:</label>
                                <input type="text" id="geminiLabel" value="${currentSettings.geminiLabel}">
                            </div>
                        </div>

                        <div class="gemini-settings-section">
                            <h3>🎨 Visual Clarity</h3>
                            <div class="gemini-setting-group">
                                <div class="gemini-checkbox-group">
                                    <input type="checkbox" id="useHeavySeparators" ${currentSettings.useHeavySeparators ? 'checked' : ''}>
                                    <label for="useHeavySeparators">Heavy separators</label>
                                </div>
                            </div>
                            <div class="gemini-setting-group">
                                <div class="gemini-checkbox-group">
                                    <input type="checkbox" id="addRolePrefix" ${currentSettings.addRolePrefix ? 'checked' : ''}>
                                    <label for="addRolePrefix">Add [YOU]/[GEMINI] prefix</label>
                                </div>
                            </div>
                        </div>

                        <div class="gemini-settings-section">
                            <h3>📋 Export Options</h3>
                            <div class="gemini-setting-group">
                                <div class="gemini-checkbox-group">
                                    <input type="checkbox" id="includeMetadata" ${currentSettings.includeMetadata ? 'checked' : ''}>
                                    <label for="includeMetadata">Include metadata</label>
                                </div>
                            </div>
                            <div class="gemini-setting-group">
                                <div class="gemini-checkbox-group">
                                    <input type="checkbox" id="includeImages" ${currentSettings.includeImages ? 'checked' : ''}>
                                    <label for="includeImages">Include images</label>
                                </div>
                            </div>
                        </div>

                        <div class="gemini-settings-section">
                            <h3>🐛 Debug</h3>
                            <div class="gemini-setting-group">
                                <div class="gemini-checkbox-group">
                                    <input type="checkbox" id="debugMode" ${currentSettings.debugMode ? 'checked' : ''}>
                                    <label for="debugMode">Enable debug logging (check console F12)</label>
                                </div>
                                <p class="gemini-settings-help">Turn on to see detailed extraction info in browser console</p>
                            </div>
                        </div>
                    </div>

                    <div class="gemini-settings-footer">
                        <button class="gemini-btn gemini-btn-secondary" type="button" id="resetDefaults">🔄 Reset</button>
                        <div class="gemini-btn-group">
                            <button class="gemini-btn gemini-btn-secondary" type="button" id="cancelSettings">Cancel</button>
                            <button class="gemini-btn gemini-btn-primary" type="button" id="saveSettings">💾 Save</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.head.insertAdjacentHTML('beforeend', getSettingsStyles());
        document.body.appendChild(overlay);

        document.getElementById('saveSettings').addEventListener('click', () => {
            const newSettings = {
                conversationTemplate: document.getElementById('conversationTemplate').value,
                dateFormat: document.getElementById('dateFormat').value,
                includeMetadata: document.getElementById('includeMetadata').checked,
                includeImages: document.getElementById('includeImages').checked,
                userLabel: document.getElementById('userLabel').value || '👤 YOU ASKED',
                geminiLabel: document.getElementById('geminiLabel').value || '🤖 GEMINI REPLIED',
                useHeavySeparators: document.getElementById('useHeavySeparators').checked,
                addRolePrefix: document.getElementById('addRolePrefix').checked,
                debugMode: document.getElementById('debugMode').checked
            };
            saveSettings(newSettings);
            showNotification('Settings saved!', 'success');
            closeModal();
        });

        document.getElementById('resetDefaults').addEventListener('click', () => {
            if (confirm('Reset all settings to defaults?')) {
                Object.entries(defaultSettings).forEach(([key, value]) => {
                    const element = document.getElementById(key);
                    if (element) {
                        element.type === 'checkbox' ? element.checked = value : element.value = value;
                    }
                });
            }
        });

        document.getElementById('cancelSettings').addEventListener('click', closeModal);
        document.querySelector('.gemini-settings-close').addEventListener('click', closeModal);
        document.querySelector('.gemini-settings-overlay').addEventListener('click', (e) => {
            if (e.target.classList.contains('gemini-settings-overlay')) closeModal();
        });
    }

    function closeModal() {
        document.getElementById('gemini-exporter-settings')?.remove();
    }

    function getSettingsStyles() {
        return `<style id="gemini-exporter-styles">
            @keyframes slideIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}
            @keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(400px);opacity:0}}
            .gemini-settings-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:99999;font-family:'Google Sans',system-ui,-apple-system,sans-serif}
            .gemini-settings-modal{background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);width:90%;max-width:700px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column}
            .gemini-settings-header{background:linear-gradient(135deg,#4285f4 0%,#34a853 100%);color:white;padding:20px 24px;display:flex;align-items:center;justify-content:space-between}
            .gemini-settings-header h2{margin:0;font-size:20px;font-weight:600}
            .gemini-settings-close{background:none;border:none;color:white;font-size:24px;cursor:pointer;padding:0;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background-color 0.2s}
            .gemini-settings-close:hover{background:rgba(255,255,255,0.2)}
            .gemini-settings-content{flex:1;overflow-y:auto;padding:24px}
            .gemini-settings-section{margin-bottom:32px}
            .gemini-settings-section:last-child{margin-bottom:0}
            .gemini-settings-section h3{margin:0 0 16px 0;font-size:18px;font-weight:600;color:#202124}
            .gemini-setting-group{margin-bottom:20px}
            .gemini-setting-group:last-child{margin-bottom:0}
            .gemini-setting-group label{display:block;margin-bottom:8px;font-weight:500;color:#202124;font-size:14px}
            .gemini-setting-group input[type="text"],.gemini-setting-group select{width:100%;padding:10px 12px;border:2px solid #dadce0;border-radius:8px;font-size:14px;transition:border-color 0.2s;box-sizing:border-box;font-family:'Google Sans',system-ui}
            .gemini-setting-group input[type="text"]:focus,.gemini-setting-group select:focus{outline:none;border-color:#4285f4;box-shadow:0 0 0 3px rgba(66,133,244,0.1)}
            .gemini-checkbox-group{display:flex;align-items:center;gap:10px}
            .gemini-checkbox-group input[type="checkbox"]{width:auto;margin:0;transform:scale(1.2);cursor:pointer}
            .gemini-checkbox-group label{margin:0;cursor:pointer;font-weight:500}
            .gemini-settings-help{margin:8px 0 0 0;font-size:13px;color:#5f6368;line-height:1.4}
            .gemini-settings-footer{background:#f8f9fa;padding:20px 24px;border-top:1px solid #dadce0;display:flex;align-items:center;justify-content:space-between}
            .gemini-btn{padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;font-family:'Google Sans',system-ui}
            .gemini-btn-primary{background:#4285f4;color:white}
            .gemini-btn-primary:hover{background:#3367d6;box-shadow:0 2px 8px rgba(66,133,244,0.4)}
            .gemini-btn-secondary{background:#f1f3f4;color:#202124}
            .gemini-btn-secondary:hover{background:#e8eaed}
            .gemini-btn-group{display:flex;gap:12px}
        </style>`;
    }

    // =============================================
    // INITIALIZATION
    // =============================================

    function init() {
        console.log('[Gemini Exporter] v7 initialized!');
        console.log('[Gemini Exporter] URL:', window.location.href);
        console.log('[Gemini Exporter] In iframe:', window !== window.top);
        console.log('[Gemini Exporter] TIP: Scroll through conversation before exporting.');
        console.log('[Gemini Exporter] TIP: Enable debug mode in settings if having issues.');

        GM_registerMenuCommand('⚙️ Settings', showSettingsUI);
        GM_registerMenuCommand('📄 Export Conversation', exportConversation);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();