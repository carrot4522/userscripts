// ==UserScript==
// @name         Gemini Sidebar v2
// @namespace    Gemini Sidebar v2
// @version      2
// @description  Displays a floating sidebar with all your messages in the current Gemini conversation for easy navigation and reference.
// @author       Bui Quoc Dung
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @license      MIT
// @downloadURL  https://update.greasyfork.org/scripts/545782/Gemini%20Conversation%20Navigator.user.js
// @updateURL    https://update.greasyfork.org/scripts/545782/Gemini%20Conversation%20Navigator.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // ===== Configuration =====
    const CONFIG = {
        containerId: 'gemini-message-nav',
        contentId: 'gemini-message-nav-content',
        storageKey: 'geminiMessageNavCollapsed',
        containerWidth: {
            expanded: '250px',
            collapsed: '130px'
        },
        styles: {
            position: 'fixed',
            top: '55px',
            right: '20px',
            maxHeight: '90vh',
            background: '#fff',
            color: '#000',
            borderRadius: '5px',
            boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)',
            fontSize: '14px',
            fontFamily: 'Calibri, sans-serif',
            zIndex: '9999'
        },
        selectors: {
            main: 'main',
            userMessage: 'user-query span.user-query-bubble-with-background',
            chatContainer: '.chat-history-scroll-container'
        },
        previewLength: 80,
        checkInterval: 500
    };

    // ===== State Management =====
    let userMessageCounter = 0;
    let lastUrl = location.href;

    // ===== Inject Styles =====
    const layoutStyles = `
        body.navigator-expanded .chat-history-scroll-container {
            margin-left: 0 !important;
            margin-right: 300px !important;
            max-width: calc(100% - 300px) !important;
            transition: margin-right 0.3s ease;
        }
    `;
    GM_addStyle(layoutStyles);

    // ===== Utility Functions =====

    /**
     * Update body class based on navigator visibility
     */
    function updateBodyClassForLayout() {
        const container = document.getElementById(CONFIG.containerId);
        const content = document.getElementById(CONFIG.contentId);

        const isExpanded = container &&
                          container.style.display !== 'none' &&
                          content &&
                          content.style.display !== 'none';

        document.body.classList.toggle('navigator-expanded', isExpanded);
    }

    /**
     * Assign unique ID to message element
     * @param {HTMLElement} msgElem - Message element
     */
    function assignMessageId(msgElem) {
        if (!msgElem.id) {
            userMessageCounter++;
            msgElem.id = `user-msg-${userMessageCounter}`;
            msgElem.dataset.index = userMessageCounter;
        }
    }

    /**
     * Create preview text for message
     * @param {string} text - Full message text
     * @returns {string} Preview text
     */
    function createPreviewText(text) {
        const trimmedText = text.trim();
        return trimmedText.length > CONFIG.previewLength
            ? `${trimmedText.slice(0, CONFIG.previewLength)}...`
            : trimmedText;
    }

    /**
     * Create list item for navigation
     * @param {HTMLElement} msgElem - Message element
     * @returns {HTMLElement} List item element
     */
    function createListItem(msgElem) {
        const index = msgElem.dataset.index || '?';
        const preview = createPreviewText(msgElem.innerText);

        const listItem = document.createElement('li');
        listItem.textContent = `${index}. ${preview}`;

        // Apply styles
        Object.assign(listItem.style, {
            cursor: 'pointer',
            padding: '5px 10px',
            borderBottom: '1px solid #ccc',
            transition: 'background 0.2s ease'
        });

        // Hover effects
        listItem.addEventListener('mouseenter', () => {
            listItem.style.background = '#eee';
        });
        listItem.addEventListener('mouseleave', () => {
            listItem.style.background = 'transparent';
        });

        // Click to scroll
        listItem.addEventListener('click', () => {
            msgElem.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });

        return listItem;
    }

    /**
     * Create toggle button for container
     * @returns {HTMLElement} Toggle button
     */
    function createToggleButton() {
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '⯈';

        Object.assign(toggleBtn.style, {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px'
        });

        return toggleBtn;
    }

    /**
     * Create header for navigation container
     * @param {HTMLElement} toggleBtn - Toggle button element
     * @returns {HTMLElement} Header element
     */
    function createHeader(toggleBtn) {
        const header = document.createElement('div');
        header.textContent = 'Your Prompts';

        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '5px',
            cursor: 'pointer',
            fontWeight: 'bold'
        });

        header.appendChild(toggleBtn);
        return header;
    }

    /**
     * Create content container
     * @returns {HTMLElement} Content element
     */
    function createContent() {
        const content = document.createElement('div');
        content.id = CONFIG.contentId;
        content.style.padding = '5px';
        return content;
    }

    /**
     * Create and initialize navigation container
     * @returns {HTMLElement} Container element
     */
    function createContainer() {
        let container = document.getElementById(CONFIG.containerId);

        if (container) {
            return container;
        }

        // Create new container
        container = document.createElement('div');
        container.id = CONFIG.containerId;

        // Apply base styles
        Object.assign(container.style, CONFIG.styles);
        container.style.width = CONFIG.containerWidth.expanded;
        container.style.transition = 'width 0.3s, padding 0.3s';
        container.style.overflowY = 'auto';

        // Create elements
        const toggleBtn = createToggleButton();
        const header = createHeader(toggleBtn);
        const content = createContent();

        // Assemble container
        container.appendChild(header);
        container.appendChild(content);
        document.body.appendChild(container);

        // Restore collapsed state from storage
        const isCollapsed = GM_getValue(CONFIG.storageKey, false);
        if (isCollapsed) {
            content.style.display = 'none';
            container.style.width = CONFIG.containerWidth.collapsed;
            toggleBtn.textContent = '⯆';
        }

        // Setup toggle functionality
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleContainer(container, content, toggleBtn);
        });

        updateBodyClassForLayout();
        return container;
    }

    /**
     * Toggle container expanded/collapsed state
     * @param {HTMLElement} container - Container element
     * @param {HTMLElement} content - Content element
     * @param {HTMLElement} toggleBtn - Toggle button element
     */
    function toggleContainer(container, content, toggleBtn) {
        const isCollapsed = content.style.display === 'none';

        if (isCollapsed) {
            // Expand
            content.style.display = 'block';
            container.style.width = CONFIG.containerWidth.expanded;
            toggleBtn.textContent = '⯈';
            GM_setValue(CONFIG.storageKey, false);
        } else {
            // Collapse
            content.style.display = 'none';
            container.style.width = CONFIG.containerWidth.collapsed;
            toggleBtn.textContent = '⯆';
            GM_setValue(CONFIG.storageKey, true);
        }

        updateBodyClassForLayout();
    }

    /**
     * Get or create message list element
     * @param {HTMLElement} content - Content container
     * @returns {HTMLElement} List element
     */
    function getMessageList(content) {
        let list = content.querySelector('ul');

        if (!list) {
            list = document.createElement('ul');
            Object.assign(list.style, {
                padding: '0',
                margin: '0',
                listStyle: 'none'
            });
            content.appendChild(list);
        }

        return list;
    }

    /**
     * Update the navigation list with current messages
     */
    function updateMessageList() {
        const container = createContainer();
        const content = document.getElementById(CONFIG.contentId);

        if (!content) return;

        const list = getMessageList(content);
        const userMessages = document.querySelectorAll(CONFIG.selectors.userMessage);
        const existingListItems = list.querySelectorAll('li');

        // Clear list if messages were deleted
        if (userMessages.length < existingListItems.length) {
            list.innerHTML = '';
        }

        // Add new messages to list
        if (userMessages.length > existingListItems.length) {
            for (let i = existingListItems.length; i < userMessages.length; i++) {
                const msgElem = userMessages[i];
                assignMessageId(msgElem);
                const listItem = createListItem(msgElem);
                list.appendChild(listItem);
            }
        }
    }

    /**
     * Setup mutation observer for conversation changes
     */
    function observeConversation() {
        const mainElem = document.querySelector(CONFIG.selectors.main);
        if (!mainElem) return;

        const observer = new MutationObserver(() => {
            updateMessageList();
        });

        observer.observe(mainElem, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Reset message counter and list
     */
    function resetMessageList() {
        userMessageCounter = 0;
        const content = document.getElementById(CONFIG.contentId);

        if (content) {
            const list = content.querySelector('ul');
            if (list) {
                list.innerHTML = '';
            }
        }
    }

    /**
     * Wait for chat to load before initializing
     */
    function waitForChatToLoad() {
        const interval = setInterval(() => {
            const mainElem = document.querySelector(CONFIG.selectors.main);
            const userMessage = document.querySelector(CONFIG.selectors.userMessage);

            if (mainElem && userMessage) {
                clearInterval(interval);
                resetMessageList();
                updateMessageList();
                observeConversation();
                console.log('[Gemini Navigator] Initialized successfully');
            }
        }, CONFIG.checkInterval);
    }

    /**
     * Monitor URL changes for navigation
     */
    function observeUrlChanges() {
        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                console.log('[Gemini Navigator] URL changed, reinitializing...');
                waitForChatToLoad();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ===== Initialization =====
    function init() {
        waitForChatToLoad();
        observeUrlChanges();
        console.log('[Gemini Navigator] Script loaded');
    }

    // Start the script
    init();

})();