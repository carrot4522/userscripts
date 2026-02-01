// ==UserScript==
// @name        ChatGPT Date Groups v3
// @version     3
// @author      tiramifue
// @description Brings back the date grouping on chatgpt.com - Optimized
// @match       https://chatgpt.com/*
// @run-at      document-end
// @namespace   https://greasyfork.org/users/570213
// @license     Apache-2.0
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @noframes
// @downloadURL https://update.greasyfork.org/scripts/538829/ChatGPT%20bring%20back%20date%20grouping.user.js
// @updateURL https://update.greasyfork.org/scripts/538829/ChatGPT%20bring%20back%20date%20grouping.meta.js
// ==/UserScript==

(() => {
    'use strict';

    // Constants
    const MS_IN_DAY = 24 * 60 * 60 * 1000;
    const RENDER_DELAY = 200;
    const DATE_THRESHOLDS = {
        TODAY: 0,
        YESTERDAY: 1,
        WEEK: 6,
        TWO_WEEKS: 13,
        THREE_WEEKS: 20,
        MONTH: 31,
        YEAR: 11,
    };

    const STYLES = {
        HEADER: `
            font-weight: normal;
            padding: 6px 10px;
            font-size: 0.85rem;
            color: #999;
            margin-top: 0;
        `,
        HEADER_NOT_FIRST: `margin-top: 12px;`,
        DATE_LABEL: `
            position: absolute;
            top: 0;
            right: 12px;
            font-size: 0.7rem;
            color: #888;
            pointer-events: none;
            background-color: transparent;
            line-height: 1;
            text-shadow: 0 0 2px rgba(0,0,0,0.5);
        `,
        TIMESTAMP: `
            position: absolute;
            right: 8px;
            top: -1px;
            font-size: 0.7rem;
            color: #999;
            pointer-events: none;
        `,
        BUTTON: `
            font-size: 0.75rem;
            background-color: #2a2b32;
            border: 1px solid #444;
            border-radius: 999px;
            padding: 3px 10px;
            color: #ccc;
            cursor: pointer;
            transition: background-color 0.2s;
        `,
        BUTTON_HOVER: `background-color: #3a3b42;`,
        WRAPPER: `
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
        `,
        BUTTON_GROUP: `
            display: flex;
            gap: 6px;
            margin-left: auto;
        `,
    };

    let groupBy = GM_getValue('groupBy', 'updated');
    const seenIds = new Set();
    const chatList = [];
    let renderTimer = null;
    let lastAside = null;

    // Inject styles
    GM_addStyle(`
        .__chat-group-header {
            ${STYLES.HEADER}
        }
        .__chat-group-header:not(:first-of-type) {
            ${STYLES.HEADER_NOT_FIRST}
        }
        .__chat-date-label {
            ${STYLES.DATE_LABEL}
        }
        .__chat-timestamp {
            ${STYLES.TIMESTAMP}
        }
        .__hide-timestamps .__chat-timestamp {
            display: none;
        }
        .__timestamp-icon {
            position: relative;
            display: inline-block;
            opacity: 1;
            transition: opacity 0.2s;
        }
        .__timestamp-icon.__disabled {
            opacity: 0.5;
        }
        .__timestamp-icon.__disabled::after {
            content: "";
            position: absolute;
            top: 50%;
            left: 50%;
            width: 110%;
            height: 0;
            border-top: 2px solid #fff;
            transform: translate(-50%, -50%) rotate(-45deg);
            transform-origin: center;
            pointer-events: none;
        }
    `);

    // Utility functions
    const getDateGroupLabel = (isoString) => {
        const date = new Date(isoString);
        const now = new Date();
        const daysAgo = Math.floor((now - date) / MS_IN_DAY);
        const monthsAgo = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());

        if (daysAgo <= DATE_THRESHOLDS.TODAY) return 'Today';
        if (daysAgo === DATE_THRESHOLDS.YESTERDAY) return 'Yesterday';
        if (daysAgo <= DATE_THRESHOLDS.WEEK) return `${daysAgo} days ago`;
        if (daysAgo <= DATE_THRESHOLDS.TWO_WEEKS) return 'Last week';
        if (daysAgo <= DATE_THRESHOLDS.THREE_WEEKS) return '2 weeks ago';
        if (daysAgo <= DATE_THRESHOLDS.MONTH) return 'Last month';
        if (monthsAgo <= DATE_THRESHOLDS.YEAR) return `${monthsAgo} months ago`;
        return 'Last year';
    };

    const getReactFiber = (dom) => {
        for (const key in dom) {
            if (key.startsWith('__reactFiber$')) return dom[key];
        }
        return null;
    };

    const extractChatInfo = (fiber) => {
        const c = fiber.memoizedProps?.conversation;
        return c ? {
            id: c.id,
            title: c.title,
            created: c.create_time,
            updated: c.update_time,
            node: fiber.stateNode
        } : null;
    };

    const findConversationFiber = (fiber) => {
        let current = fiber;
        while (current && !current.memoizedProps?.conversation) {
            current = current.return;
        }
        return current?.memoizedProps?.conversation ? current : null;
    };

    const sortByDate = (a, b) => new Date(b[groupBy]) - new Date(a[groupBy]);

    const queueRender = () => {
        if (renderTimer) clearTimeout(renderTimer);
        renderTimer = setTimeout(() => {
            const aside = document.querySelector('#history aside');
            if (aside) renderGroupedChats(aside);
        }, RENDER_DELAY);
    };

    // Chat processing
    const processNewChatNode = (node) => {
        const fiber = getReactFiber(node);
        if (!fiber) return;

        const conversationFiber = findConversationFiber(fiber);
        if (!conversationFiber) return;

        const chat = extractChatInfo(conversationFiber);
        if (chat && !seenIds.has(chat.id)) {
            seenIds.add(chat.id);
            chat.node = node;
            chatList.push(chat);
            queueRender();
        }
    };

    const groupChatsByGroupName = () => {
        const groups = new Map();

        chatList.forEach(chat => {
            chat.group = getDateGroupLabel(chat[groupBy]);
            if (!groups.has(chat.group)) groups.set(chat.group, []);
            groups.get(chat.group).push(chat);
        });

        return [...groups.entries()].sort((a, b) =>
            new Date(b[1][0][groupBy]) - new Date(a[1][0][groupBy])
        );
    };

    const clearGroupedChats = (aside) => {
        aside.querySelectorAll('a[href^="/c/"], .__chat-group-header').forEach(el => el.remove());
    };

    const createTimestamp = (chat) => {
        const existing = chat.node.querySelector('.__chat-timestamp');
        if (existing) existing.remove();

        const timestamp = document.createElement('div');
        timestamp.className = '__chat-timestamp';
        timestamp.textContent = new Date(chat[groupBy]).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        chat.node.style.position = 'relative';
        chat.node.appendChild(timestamp);
    };

    const renderGroupedChats = (aside) => {
        const observer = aside.__chatObserver;
        if (observer) observer.disconnect();

        clearGroupedChats(aside);
        const groups = groupChatsByGroupName();

        groups.forEach(([label, chats]) => {
            const header = document.createElement('div');
            header.className = '__chat-group-header';
            header.textContent = label;
            aside.appendChild(header);

            chats.sort(sortByDate).forEach(chat => {
                createTimestamp(chat);
                aside.appendChild(chat.node);
            });
        });

        if (observer) observer.observe(aside, { childList: true, subtree: true });
    };

    // Observer setup
    const observeChatList = (aside) => {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches('a[href^="/c/"]')) {
                        processNewChatNode(node);
                    }
                });

                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches('a[href^="/c/"]')) {
                        const index = chatList.findIndex(c => c.node === node);
                        if (index !== -1) {
                            const removed = chatList.splice(index, 1)[0];
                            seenIds.delete(removed.id);
                            queueRender();
                        }
                    }
                });
            });
        });

        observer.observe(aside, { childList: true, subtree: true });
        aside.__chatObserver = observer;
        aside.querySelectorAll('a[href^="/c/"]').forEach(processNewChatNode);
    };

    // UI creation
    const createButton = (text, title, onClick) => {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.title = title;
        btn.style.cssText = STYLES.BUTTON;

        btn.addEventListener('mouseenter', () => btn.style.cssText = STYLES.BUTTON + STYLES.BUTTON_HOVER);
        btn.addEventListener('mouseleave', () => btn.style.cssText = STYLES.BUTTON);
        btn.addEventListener('click', onClick);

        return btn;
    };

    const createToggleButton = () => {
        const icon = '⇅';
        return createButton(
            `${icon} By ${groupBy}`,
            'Click to toggle sorting mode',
            () => {
                groupBy = groupBy === 'updated' ? 'created' : 'updated';
                GM_setValue('groupBy', groupBy);
                const btn = document.querySelector('.__group-toggle');
                if (btn) btn.textContent = `${icon} By ${groupBy}`;
                queueRender();
            }
        );
    };

    const createTimestampButton = () => {
        const btn = document.createElement('button');
        btn.className = '__toggle-timestamps';
        btn.style.cssText = `${STYLES.BUTTON}display: flex; align-items: center;`;
        btn.title = 'Toggle timestamps';

        const icon = document.createElement('span');
        icon.className = '__timestamp-icon';
        icon.textContent = '🕒';

        const updateIcon = (state) => icon.classList.toggle('__disabled', !state);
        updateIcon(GM_getValue('showTimestamps', true));

        btn.appendChild(icon);

        btn.addEventListener('mouseenter', () => btn.style.cssText += STYLES.BUTTON_HOVER);
        btn.addEventListener('mouseleave', () => btn.style.cssText = `${STYLES.BUTTON}display: flex; align-items: center;`);
        btn.addEventListener('click', () => {
            const current = GM_getValue('showTimestamps', true);
            const next = !current;
            GM_setValue('showTimestamps', next);
            updateIcon(next);
            const aside = document.querySelector('#history aside');
            if (aside) aside.classList.toggle('__hide-timestamps', !next);
        });

        return btn;
    };

    const insertToggleButton = (aside) => {
        const header = aside.querySelector('h2');
        if (!header || header.querySelector('.__group-toggle')) return;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = STYLES.WRAPPER;

        while (header.firstChild) {
            wrapper.appendChild(header.firstChild);
        }
        header.appendChild(wrapper);

        const buttonGroup = document.createElement('div');
        buttonGroup.style.cssText = STYLES.BUTTON_GROUP;

        const toggleBtn = createToggleButton();
        toggleBtn.className = '__group-toggle';

        buttonGroup.appendChild(toggleBtn);
        buttonGroup.appendChild(createTimestampButton());
        wrapper.appendChild(buttonGroup);
    };

    // Sidebar watcher
    const setup = (aside) => {
        if (!aside || aside === lastAside) return;
        lastAside = aside;

        aside.classList.toggle('__hide-timestamps', !GM_getValue('showTimestamps', true));

        insertToggleButton(aside);
        observeChatList(aside);
        renderGroupedChats(aside);
        console.log('ChatGPT grouping: sidebar attached.');
    };

    const watchSidebar = () => {
        const rootObserver = new MutationObserver(() => {
            const history = document.querySelector('#history');
            if (!history) return;

            const aside = history.querySelector('aside');
            if (aside && aside !== lastAside) setup(aside);
        });

        rootObserver.observe(document.body, { childList: true, subtree: true });

        const asideNow = document.querySelector('#history aside');
        if (asideNow) setup(asideNow);
    };

    watchSidebar();
})();