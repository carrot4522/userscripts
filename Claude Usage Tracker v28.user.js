// ==UserScript==
// @name         Claude Usage Tracker v28
// @namespace    usage-and-quick-settings-of-claude
// @author       Yalums
// @version      28
// @description  Floating panel to track Claude usage limits and reset times. Drag anywhere to move. Minimized by default.
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-idle
// @license      GNU General Public License v3.0
// ==/UserScript==

(function() {
    'use strict';

    // v28: Made minimized widget smaller (40px instead of 60px)

    const storedMinimized = localStorage.getItem('claudePanel_minimized');
    let panelState = {
        isMinimized: storedMinimized !== 'false',
        position: JSON.parse(localStorage.getItem('claudePanel_position') || '{"left":"80px","top":"310px"}')
    };

    function checkForTargetSVG() {
        const svgs = document.querySelectorAll('svg[width="16"][height="16"][viewBox="0 0 20 20"]');
        for (const svg of svgs) {
            const path = svg.querySelector('path[d*="M10 3C10.4142 3"]');
            if (path && path.getAttribute('d').includes('M10 3C10.4142 3')) {
                return true;
            }
        }
        return false;
    }

    async function getUsageData() {
        try {
            const orgsResponse = await fetch('/api/organizations', { credentials: 'include' });
            const orgs = await orgsResponse.json();
            const orgId = orgs[0]?.uuid;
            if (!orgId) return null;
            const usageResponse = await fetch(`/api/organizations/${orgId}/usage`, { credentials: 'include' });
            return await usageResponse.json();
        } catch (err) {
            return null;
        }
    }

    function formatResetTime(isoTime) {
        if (!isoTime) return 'N/A';
        const diff = new Date(isoTime) - new Date();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 1) return 'Soon';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        return `${days}d`;
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #claude-control-panel {
                position: fixed;
                z-index: 9999;
                background: linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%);
                border: 2px solid #e0e8ff;
                border-radius: 14px;
                box-shadow: 0 12px 40px rgba(99, 102, 241, 0.2);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: #1a1a2e;
                max-width: 200px;
                max-height: 90vh;
                overflow: hidden;
                transition: width 0.3s ease, height 0.3s ease;
            }

            #claude-control-panel.dragging {
                cursor: grabbing !important;
                box-shadow: 0 16px 50px rgba(99, 102, 241, 0.35);
            }

            #claude-control-panel.minimized {
                width: 40px !important;
                height: 40px !important;
                cursor: pointer;
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                border: 2px solid #8b5cf6;
                border-radius: 10px;
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
            }

            #claude-control-panel.minimized:hover {
                box-shadow: 0 6px 16px rgba(99, 102, 241, 0.5);
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            }

            .panel-header {
                padding: 10px 12px;
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                cursor: pointer;
                user-select: none;
                border-radius: 12px 12px 0 0;
                min-height: 40px;
            }

            .minimized .panel-header {
                border-radius: 8px;
                background: transparent;
                padding: 0;
                width: 40px;
                height: 40px;
                min-height: unset;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .panel-header:hover {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            }

            .minimized .panel-header:hover {
                background: transparent;
            }

            .panel-header h3 {
                margin: 0;
                font-size: 12px;
                font-weight: 700;
                display: flex;
                align-items: center;
                gap: 6px;
                color: #ffffff;
            }

            .minimized .panel-header h3 {
                font-size: 18px;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .minimized .panel-header h3 span:last-child {
                display: none !important;
            }

            .panel-controls {
                display: flex;
                gap: 5px;
                align-items: center;
            }

            .minimized .panel-controls {
                display: none;
            }

            .panel-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                border-radius: 4px;
                width: 24px;
                height: 24px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                font-weight: 600;
                font-size: 14px;
            }

            .panel-btn:hover {
                background: rgba(255, 255, 255, 0.35);
            }

            .panel-content {
                max-height: calc(90vh - 44px);
                overflow-y: auto;
                padding: 8px;
            }

            .minimized .panel-content {
                display: none;
            }

            .loading {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                font-size: 11px;
                color: #6366f1;
            }

            .section-title {
                font-size: 9px;
                font-weight: 700;
                margin-bottom: 6px;
                color: #4f46e5;
                text-transform: uppercase;
            }

            .usage-item {
                margin-bottom: 8px;
                padding: 6px;
                background: rgba(255, 255, 255, 0.9);
                border-radius: 6px;
                border: 1px solid rgba(99, 102, 241, 0.1);
            }

            .usage-label {
                display: flex;
                justify-content: space-between;
                margin-bottom: 4px;
            }

            .usage-label-text {
                font-size: 10px;
                font-weight: 600;
                color: #1a1a2e;
            }

            .usage-label-time {
                font-size: 8px;
                font-weight: 600;
                color: #8b5cf6;
                background: rgba(139, 92, 246, 0.1);
                padding: 1px 4px;
                border-radius: 3px;
            }

            .usage-bar {
                width: 100%;
                height: 5px;
                background: rgba(99, 102, 241, 0.1);
                border-radius: 3px;
                overflow: hidden;
                margin-bottom: 3px;
            }

            .usage-bar-fill {
                height: 100%;
                background: linear-gradient(90deg, #6366f1, #8b5cf6);
                border-radius: 3px;
                transition: width 0.5s;
            }

            .usage-bar-fill.warning {
                background: linear-gradient(90deg, #f59e0b, #f97316);
            }

            .usage-bar-fill.danger {
                background: linear-gradient(90deg, #ef4444, #dc2626);
            }

            .usage-percent {
                font-size: 9px;
                font-weight: 600;
                color: #6366f1;
                text-align: right;
            }

            .refresh-btn {
                width: 100%;
                padding: 6px;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                border: none;
                border-radius: 6px;
                color: white;
                font-weight: 600;
                font-size: 10px;
                cursor: pointer;
            }

            .refresh-btn:hover {
                background: linear-gradient(135deg, #4f46e5, #7c3aed);
            }

            body.panel-dragging {
                user-select: none !important;
            }

            body.panel-dragging * {
                cursor: grabbing !important;
            }
        `;
        document.head.appendChild(style);
    }

    function togglePanel(panel) {
        panel.classList.toggle('minimized');
        panelState.isMinimized = panel.classList.contains('minimized');
        localStorage.setItem('claudePanel_minimized', panelState.isMinimized ? 'true' : 'false');
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'claude-control-panel';
        panel.className = panelState.isMinimized ? 'minimized' : '';

        panel.innerHTML = `
            <div class="panel-header">
                <h3><span>📊</span><span>Usage</span></h3>
                <div class="panel-controls">
                    <button class="panel-btn" id="toggle-btn">−</button>
                </div>
            </div>
            <div class="panel-content">
                <div class="loading">Loading...</div>
            </div>
        `;

        if (panelState.position.left !== undefined) {
            panel.style.left = panelState.position.left;
            panel.style.top = panelState.position.top || '310px';
        } else {
            panel.style.right = panelState.position.right;
            panel.style.top = panelState.position.top || '310px';
        }

        document.body.appendChild(panel);

        const toggleBtn = panel.querySelector('#toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePanel(panel);
                toggleBtn.textContent = panel.classList.contains('minimized') ? '+' : '−';
            });
            toggleBtn.textContent = panelState.isMinimized ? '+' : '−';
        }

        makeDraggable(panel);
        return panel;
    }

    async function updatePanelContent(panel) {
        const content = panel.querySelector('.panel-content');
        if (!content) return;

        const usageData = await getUsageData();

        if (!usageData) {
            content.innerHTML = '<div class="loading">❌ Failed</div>';
            return;
        }

        let html = '<div class="section-title">📊 Usage</div>';

        if (usageData.five_hour) {
            const percent = usageData.five_hour.utilization || 0;
            const barClass = percent > 80 ? 'danger' : percent > 60 ? 'warning' : '';
            html += `
                <div class="usage-item">
                    <div class="usage-label">
                        <span class="usage-label-text">Session</span>
                        <span class="usage-label-time">${formatResetTime(usageData.five_hour.resets_at)}</span>
                    </div>
                    <div class="usage-bar"><div class="usage-bar-fill ${barClass}" style="width: ${percent}%"></div></div>
                    <div class="usage-percent">${percent}%</div>
                </div>
            `;
        }

        if (usageData.seven_day) {
            const percent = usageData.seven_day.utilization || 0;
            const barClass = percent > 80 ? 'danger' : percent > 60 ? 'warning' : '';
            html += `
                <div class="usage-item">
                    <div class="usage-label">
                        <span class="usage-label-text">Weekly</span>
                        <span class="usage-label-time">${formatResetTime(usageData.seven_day.resets_at)}</span>
                    </div>
                    <div class="usage-bar"><div class="usage-bar-fill ${barClass}" style="width: ${percent}%"></div></div>
                    <div class="usage-percent">${percent}%</div>
                </div>
            `;
        }

        if (usageData.seven_day_opus) {
            const percent = usageData.seven_day_opus.utilization || 0;
            const barClass = percent > 80 ? 'danger' : percent > 60 ? 'warning' : '';
            html += `
                <div class="usage-item">
                    <div class="usage-label">
                        <span class="usage-label-text">Opus</span>
                        <span class="usage-label-time">${formatResetTime(usageData.seven_day_opus.resets_at)}</span>
                    </div>
                    <div class="usage-bar"><div class="usage-bar-fill ${barClass}" style="width: ${percent}%"></div></div>
                    <div class="usage-percent">${percent}%</div>
                </div>
            `;
        }

        html += '<button class="refresh-btn" id="refresh-panel">🔄 Refresh</button>';
        content.innerHTML = html;

        content.querySelector('#refresh-panel')?.addEventListener('click', () => {
            content.innerHTML = '<div class="loading">Refreshing...</div>';
            setTimeout(() => updatePanelContent(panel), 500);
        });
    }

    function makeDraggable(element) {
        let isDragging = false;
        let hasMoved = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = 0, yOffset = 0;
        let startX = 0, startY = 0;

        function dragStart(e) {
            if (e.target.closest('.panel-btn') || e.target.closest('.refresh-btn')) return;

            const rect = element.getBoundingClientRect();
            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - rect.left;
                initialY = e.touches[0].clientY - rect.top;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            } else {
                initialX = e.clientX - rect.left;
                initialY = e.clientY - rect.top;
                startX = e.clientX;
                startY = e.clientY;
            }

            isDragging = true;
            hasMoved = false;
            element.classList.add('dragging');
            document.body.classList.add('panel-dragging');

            xOffset = rect.left;
            yOffset = rect.top;
            element.style.left = '0px';
            element.style.top = '0px';
            element.style.right = 'auto';
            element.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
        }

        function drag(e) {
            if (!isDragging) return;
            e.preventDefault();

            let clientX, clientY;
            if (e.type === "touchmove") {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            currentX = clientX - initialX;
            currentY = clientY - initialY;

            if (Math.abs(clientX - startX) > 5 || Math.abs(clientY - startY) > 5) {
                hasMoved = true;
            }

            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            xOffset = Math.max(0, Math.min(currentX, maxX));
            yOffset = Math.max(0, Math.min(currentY, maxY));

            element.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
        }

        function dragEnd() {
            if (!isDragging) return;

            isDragging = false;
            element.classList.remove('dragging');
            document.body.classList.remove('panel-dragging');

            element.style.left = xOffset + 'px';
            element.style.top = yOffset + 'px';
            element.style.transform = '';

            panelState.position = { left: element.style.left, top: element.style.top };
            localStorage.setItem('claudePanel_position', JSON.stringify(panelState.position));

            if (!hasMoved) {
                setTimeout(() => {
                    togglePanel(element);
                    const toggleBtn = element.querySelector('#toggle-btn');
                    if (toggleBtn) toggleBtn.textContent = element.classList.contains('minimized') ? '+' : '−';
                }, 10);
            }
            hasMoved = false;
        }

        element.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        element.addEventListener('touchstart', dragStart, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', dragEnd);
    }

    function init() {
        if (!checkForTargetSVG()) return;
        injectStyles();
        const panel = createPanel();
        updatePanelContent(panel);
        setInterval(() => updatePanelContent(panel), 60000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();