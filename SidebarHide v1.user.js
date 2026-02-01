// ==UserScript==
// @name         SidebarHide v1
// @namespace    SidebarHide v1
// @version      1.2
// @description  Add privacy controls to hide chat names in Claude and ChatGPT sidebars
// @author       Will Ness (https://x.com/N3sOnline, https://willness.dev)
// @match        https://claude.ai/*
// @match        https://chatgpt.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // CSS styles for the privacy toggle and hide effects
    const styles = `
        /* Hide Claude sidebar initially to prevent flash of visible content */
        .flex.flex-col.align-center.h-full.overflow-hidden {
            visibility: hidden;
        }

        /* Hide ChatGPT sidebar initially */
        #history {
            visibility: hidden;
        }

        /* Show sidebars once privacy is applied */
        .flex.flex-col.align-center.h-full.overflow-hidden.privacy-ready,
        #history.privacy-ready {
            visibility: visible;
        }

        .privacy-toggle-container {
            padding: 8px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            margin-bottom: 8px;
        }

        .privacy-toggle {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: rgb(var(--text-300));
        }

        .privacy-switch {
            position: relative;
            display: inline-block;
            width: 40px;
            height: 20px;
        }

        .privacy-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .privacy-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            border-radius: 20px;
            transition: .4s;
        }

        .privacy-slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            border-radius: 50%;
            transition: .4s;
        }

        input:checked + .privacy-slider {
            background-color: #2196F3;
        }

        input:checked + .privacy-slider:before {
            transform: translateX(20px);
        }

        /* Hide chat names completely */
        .chat-name-hidden {
            visibility: hidden !important;
        }

        .chat-item-container {
            position: relative;
        }
    `;

    // Add styles to the page
    function addStyles() {
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    // Create the privacy toggle UI
    function createPrivacyToggle() {
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'privacy-toggle-container';

        toggleContainer.innerHTML = `
            <div class="privacy-toggle">
                <span>Privacy Mode</span>
                <label class="privacy-switch">
                    <input type="checkbox" id="privacy-toggle-input" checked>
                    <span class="privacy-slider"></span>
                </label>
            </div>
        `;

        return toggleContainer;
    }

    // Detect which platform we're on
    function getPlatform() {
        return window.location.hostname.includes('claude.ai') ? 'claude' : 'chatgpt';
    }

    // Apply/remove invisibility to chat names
    function applyChatNameVisibility(shouldHide) {
        const platform = getPlatform();

        // Remove all existing hidden classes
        document.querySelectorAll('.chat-name-hidden').forEach(el => {
            el.classList.remove('chat-name-hidden');
        });

        if (!shouldHide) return;

        if (platform === 'claude') {
            // Claude-specific logic
            const chatLinks = document.querySelectorAll('a[href^="/chat/"], a[href^="/project/"]');

            chatLinks.forEach(linkEl => {
                const chatNameSpan = linkEl.querySelector('span.truncate.text-sm.whitespace-nowrap.w-full');
                if (!chatNameSpan) return;

                // Skip user account info
                if (chatNameSpan.textContent.includes('n3s') || chatNameSpan.textContent.includes('Pro plan')) {
                    return;
                }

                // Hide the chat name span
                chatNameSpan.classList.add('chat-name-hidden');
            });
        } else if (platform === 'chatgpt') {
            // ChatGPT-specific logic
            const chatLinks = document.querySelectorAll('a[href^="/c/"]');

            chatLinks.forEach(linkEl => {
                const chatNameSpan = linkEl.querySelector('span[dir="auto"]');
                if (!chatNameSpan) return;

                // Hide the chat name span
                chatNameSpan.classList.add('chat-name-hidden');
            });
        }
    }

    // Initialize the privacy toggle
    function initPrivacyToggle() {
        const platform = getPlatform();

        // Apply early hiding if privacy should be enabled by default
        const savedPreference = localStorage.getItem('claude-privacy-mode');
        const shouldEnablePrivacy = savedPreference !== null ? savedPreference === 'true' : true;

        if (shouldEnablePrivacy) {
            // Apply hiding immediately to any chat links that already exist
            applyChatNameVisibility(true);
        }

        let sidebar, insertionPoint;

        if (platform === 'claude') {
            // Claude-specific selectors
            sidebar = document.querySelector('.flex.flex-col.align-center.h-full.overflow-hidden');
            if (!sidebar) {
                console.log('Claude sidebar not found, retrying...');
                setTimeout(initPrivacyToggle, 500);
                return;
            }
            insertionPoint = sidebar.querySelector('.flex.flex-col.px-2.pt-1.gap-px.mb-6');
        } else if (platform === 'chatgpt') {
            // ChatGPT-specific selectors
            sidebar = document.querySelector('#history');
            if (!sidebar) {
                console.log('ChatGPT sidebar not found, retrying...');
                setTimeout(initPrivacyToggle, 500);
                return;
            }
            // For ChatGPT, insert at the beginning of the history div
            insertionPoint = sidebar.firstElementChild;
        }

        // Check if toggle already exists
        if (document.querySelector('.privacy-toggle-container')) {
            return;
        }

        if (!insertionPoint && platform === 'claude') {
            console.log('Claude insertion point not found, retrying...');
            setTimeout(initPrivacyToggle, 500);
            return;
        }

        // Create and insert the privacy toggle
        const privacyToggle = createPrivacyToggle();

        if (platform === 'claude') {
            insertionPoint.parentNode.insertBefore(privacyToggle, insertionPoint.nextSibling);
        } else if (platform === 'chatgpt') {
            sidebar.insertBefore(privacyToggle, insertionPoint);
        }

        // Add event listener for toggle
        const toggleInput = document.getElementById('privacy-toggle-input');
        if (toggleInput) {
            toggleInput.addEventListener('change', function() {
                // Set flag to prevent observer interference
                window.privacyToggling = true;

                applyChatNameVisibility(this.checked);

                // Store preference in localStorage
                localStorage.setItem('claude-privacy-mode', this.checked);

                // Clear flag after a delay
                setTimeout(() => {
                    window.privacyToggling = false;
                }, 500);
            });

            // Load saved preference or default to true (privacy on)
            const savedPreference = localStorage.getItem('claude-privacy-mode');
            const defaultPrivacyMode = savedPreference !== null ? savedPreference === 'true' : true;
            toggleInput.checked = defaultPrivacyMode;

            // Apply initial visibility state immediately
            applyChatNameVisibility(defaultPrivacyMode);

            // Show the sidebar now that privacy controls are applied
            sidebar.classList.add('privacy-ready');
        }
    }

    // Observer to handle dynamic content changes
    function setupObserver() {
        const platform = getPlatform();

        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    // Only re-apply hiding when new chat items are added AND we're not currently toggling
                    const toggleInput = document.getElementById('privacy-toggle-input');
                    if (toggleInput && toggleInput.checked && !window.privacyToggling) {
                        // Check if new chat links were actually added
                        const addedChatLinks = Array.from(mutation.addedNodes).some(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (platform === 'claude') {
                                    return node.querySelector && node.querySelector('a[href^="/chat/"], a[href^="/project/"]');
                                } else if (platform === 'chatgpt') {
                                    return node.querySelector && node.querySelector('a[href^="/c/"]');
                                }
                            }
                            return false;
                        });

                        if (addedChatLinks) {
                            setTimeout(() => applyChatNameVisibility(true), 100);
                        }
                    }
                }
            });
        });

        // Observe changes in the appropriate container
        let chatContainer;
        if (platform === 'claude') {
            chatContainer = document.querySelector('.flex.flex-grow.flex-col.overflow-y-auto');
        } else if (platform === 'chatgpt') {
            chatContainer = document.querySelector('#history');
        }

        if (chatContainer) {
            observer.observe(chatContainer, { childList: true, subtree: true });
        }
    }

    // Initialize when page loads
    function init() {
        addStyles();

        // Wait for the page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(initPrivacyToggle, 1000);
                setTimeout(setupObserver, 2000);
            });
        } else {
            setTimeout(initPrivacyToggle, 1000);
            setTimeout(setupObserver, 2000);
        }
    }

    // Start the script
    init();

})();