// ==UserScript==
// @name         ChatGPT UI Enhancer v2
// @description  Adds colorful icons to ChatGPT buttons, optimizes interface layout, hides unnecessary elements, and enhances visual experience. Based on Tim Macy's Read Aloud Speedster script.
// @author       schweigen (Based on Tim Macy's original work)
// @license      AGPL-3.0-or-later
// @version      2
// @namespace    schweigen.ChatGPTButtonColors
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chatgpt.com
// @match        https://chatgpt.com
// @match        https://chatgpt.com/?model=*
// @match        https://chatgpt.com/?temporary-chat=*
// @match        https://chatgpt.com/c/*
// @match        https://chatgpt.com/g/*
// @match        https://chatgpt.com/share/*
// @run-at       document-start
// @downloadURL https://update.greasyfork.org/scripts/546164/ChatGPT%20UI%20Enhancer.user.js
// @updateURL https://update.greasyfork.org/scripts/546164/ChatGPT%20UI%20Enhancer.meta.js
// ==/UserScript==

/************************************************************************
*                                                                       *
*                    Original © 2025 Tim Macy                           *
*                    Modified © 2025 schweigen                          *
*                    GNU Affero General Public License v3.0             *
*                                                                       *
*             Based on Tim Macy Read Aloud Speedster script             *
*             Original work: https://github.com/TimMacy                 *
*                                                                       *
*             ===== VERSION 2 OPTIMIZATIONS =====                       *
*             - Improved performance with cached selectors              *
*             - Better error handling and console logging               *
*             - Optimized style injection                               *
*             - Enhanced keyboard shortcut handling                     *
*             - Cleaner code structure and comments                     *
*             - Reduced DOM queries                                     *
*                                                                       *
************************************************************************/

(function() {
    'use strict';

    // ===== CONSTANTS =====
    const SCRIPT_NAME = 'ChatGPT UI Enhancer';
    const NEW_CHAT_SELECTORS = [
        'button[aria-label="New chat"]',
        'a[aria-label="New chat"]',
        '#sidebar-header a[href="/"]'
    ];

    // ===== UTILITY FUNCTIONS =====
    const log = (message, type = 'info') => {
        const prefix = `[${SCRIPT_NAME}]`;
        const styles = {
            info: 'color: #00ad00',
            warn: 'color: #ff8717',
            error: 'color: #ea0027'
        };
        console[type === 'error' ? 'error' : 'log'](
            `%c${prefix} ${message}`,
            styles[type] || styles.info
        );
    };

    // ===== STYLE INJECTION =====
    function injectStyles() {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'chatgpt-ui-enhancer-styles';
        styleSheet.textContent = `
            /* ===== BUTTON COLORS ===== */

            /* Copy button - Orange */
            button[aria-label="Copy"],
            div[role="menuitem"]:has(path[d^="M12 7.1a"]),
            header button:has(path[d^="M12.668 10.667C12"]),
            button.surface-nav-element:has(svg path[d^="M12 7.1a"]),
            button[data-testid="copy-turn-action-button"] svg {
                color: darkorange !important;
                opacity: .9;
            }

            /* Copy success - Green */
            button:has(svg path[d^="M15.483"]) {
                color: springgreen !important;
            }

            .light button:has(svg path[d^="M15.483"]) {
                color: limegreen !important;
            }

            /* Good response button - Green */
            button[aria-label="Good response"],
            button .icon-md path[d^="M12.1318"],
            button svg path[d^="M10.9153"],
            div[role="menuitem"]:has(path[d^="m4.5 4.944"]),
            button[data-testid="good-response-turn-action-button"] svg {
                color: #00ad00 !important;
                opacity: .9;
            }

            /* Bad response button - Red */
            button[aria-label="Bad response"],
            button .icon-md path[d^="M11.8727"],
            button svg path[d^="M12.6687"],
            button.surface-nav-element:has(svg path[d^="M11.868 21"]),
            button[data-testid="bad-response-turn-action-button"] svg {
                color: crimson !important;
                opacity: .9;
            }

            /* Edit button - Yellow (dark) / Indigo (light) */
            button[aria-label="Edit message"],
            button[aria-label="Edit in canvas"],
            button:has(svg path[d^="M12.0303 4.11328"]) {
                color: yellow !important;
                opacity: .8;
            }

            .light button[aria-label="Edit message"],
            .light button[aria-label="Edit in canvas"],
            .light button:has(svg path[d^="M12.0303 4.11328"]) {
                color: indigo !important;
                opacity: .8;
            }

            /* Model selector - Gray */
            main .flex.justify-start button[aria-haspopup="menu"][data-state="closed"] > div {
                color: gray !important;
            }

            .light main .flex.justify-start button[aria-haspopup="menu"][data-state="closed"] > div {
                color: dimgray !important;
            }

            /* Read aloud button - Sky blue */
            button[aria-label="Read aloud"],
            div[role="menuitem"]:has(path[d^="M9 6.25v5.5"]),
            button[data-testid="voice-play-turn-action-button"] svg {
                color: deepskyblue !important;
                opacity: .9;
            }

            /* Stop button - Sky blue */
            button[aria-label="Stop"] {
                color: deepskyblue !important;
            }

            /* Share button - Reduced opacity */
            article button[aria-label="Share"] {
                opacity: .8;
            }

            /* Star button - Gold */
            a:has(svg path[d^="M9.822 2.077c"]),
            div.pointer-events-none path[d^="M10.258"],
            button.surface-nav-element path[d^="M10.258"],
            div[role="menuitem"]:has(path[d^="M9.822 2.077c"]),
            button.surface-nav-element path[d^="M9.822 2.077c"],
            div[role="menuitem"]:has(path[d^="M10.258 1.555c"]) {
                color: gold !important;
            }

            /* Delete button - Red */
            .text-token-text-destructive,
            button:has(path[d^="m10 11.5 4"]),
            [data-testid="delete-chat-menu-item"],
            div[role="menuitem"]:has(path[d^="M10.556 4a1 1 0"]) {
                color: #e02e2a !important;
            }

            /* Delete button hover effect */
            .text-token-text-destructive:hover,
            button:has(path[d^="m10 11.5 4"]):hover,
            [data-testid="delete-chat-menu-item"]:hover,
            div[role="menuitem"]:has(path[d^="M10.556 4a1 1 0"]):hover {
                color: white !important;
                background: rgba(255, 0, 0, .5) !important;
            }

            /* Restore button hover effect - Green background */
            div[role="menuitem"]:has(path[d^="m4.5 4.944"]):hover {
                color: white !important;
                background: rgba(0, 255, 0, .5) !important;
            }

            /* Button hover opacity */
            :is(
                button[aria-label="Copy"],
                button[data-testid="copy-turn-action-button"] svg,
                button[aria-label="Good response"],
                button[data-testid="good-response-turn-action-button"] svg,
                button[aria-label="Bad response"],
                button[data-testid="bad-response-turn-action-button"] svg,
                button[aria-label="Edit message"],
                button[aria-label="Edit in canvas"],
                button[aria-label="Read aloud"],
                button[data-testid="voice-play-turn-action-button"] svg,
                article button[aria-label="Share"]
            ):hover {
                opacity: 1 !important;
            }

            /* Bold text highlight in responses */
            .markdown strong {
                color: springgreen !important;
            }

            .light .markdown strong {
                color: darkviolet !important;
            }

            /* ===== INTERFACE OPTIMIZATIONS ===== */

            /* Hide "View plans" and "Get Plus" buttons */
            #page-header div:has(path[d^="M17.665 10C17"]),
            div.__menu-item:has(svg path[d^="M8.44824"]) {
                display: none !important;
            }

            /* Hide "Get Pro" button */
            main .flex > button.btn-primary:first-child:last-child {
                display: none;
            }

            /* Hide "ChatGPT can make mistakes" disclaimer */
            div.text-token-text-secondary[class*="md:px-"] {
                display: none;
            }

            .xl\\:px-5, main form {
                padding-bottom: 1rem;
            }

            /* Codex and Sora buttons side by side */
            nav > aside > a.group.__menu-item#sora,
            nav > aside > a.group.__menu-item[href="/codex"] {
                width: calc(50% - 6px);
            }

            nav > aside > a.group.__menu-item#sora {
                transform: translate(100%, -100%);
                margin-bottom: -32px;
            }

            /* "New project" and "View more" buttons side by side */
            nav #snorlax-heading {
                display: flex;
                flex-direction: column;
            }

            nav > #snorlax-heading > div:first-child,
            nav > #snorlax-heading > div:last-child {
                width: calc(50% - 6px);
            }

            nav > #snorlax-heading > div:last-child {
                position: absolute;
                transform: translateX(100%);
                flex-direction: row-reverse;
                padding: 8px 10px 8px 20px;
                order: -1;
            }

            /* Compact search and library buttons */
            nav > aside > a:has(svg path[d^="M2.6687"]),
            #stage-slideover-sidebar nav > aside div.absolute.inset-0,
            nav > aside > div:has(svg path[d^="M14.0857"]) div.text-token-text-tertiary,
            nav > aside > a:has(svg path[d^="M9.38759"]) div.text-token-text-tertiary {
                display: none;
            }

            .tall\\:top-header-height,
            nav > aside.last\\:mb-5.mt-\\(--sidebar-section-first-margin-top\\) {
                height: 0;
                padding: 0;
                margin-bottom: -8px;
            }

            nav > aside > a:has(svg path[d^="M9.38759"]),
            nav > aside > div:has(svg path[d^="M14.0857"]) {
                margin: 0;
                z-index: 31;
                color: var(--text-tertiary);
            }

            nav > aside > div:has(svg path[d^="M14.0857"]) {
                transform: translate(45.5px, -44px);
                width: 40px;
            }

            nav > aside > a:has(svg path[d^="M9.38759"]) {
                transform: translate(86.5px, -80px);
                width: 92px;
            }

            nav > aside > div:has(svg path[d^="M14.0857"]):hover,
            nav > aside > a:has(svg path[d^="M9.38759"]):hover,
            nav button:has(svg path[d^="M6.83496"]):hover {
                color: var(--text-primary);
            }

            #stage-slideover-sidebar nav > div.sticky.top-0.z-30,
            #stage-slideover-sidebar div.bg-token-bg-elevated-secondary.top-0 {
                z-index: 17;
            }

            /* Compact sidebar with dividers */
            nav .__menu-item:not(:has(svg path[d^="M14.0857"])):not(:has(svg path[d^="M9.38759"])),
            nav .__menu-item-trailing-btn {
                min-height: calc(var(--spacing)*8);
                max-height: 32px;
            }

            nav .__menu-item-trailing-btn,
            .self-stretch {
                align-self: center;
            }

            nav .__menu-item-trailing-btn:hover {
                background: rgba(255, 255, 255, .1);
            }

            nav .light .__menu-item-trailing-btn:hover {
                background: rgba(1, 1, 1, .1);
            }

            nav .mt-\\(--sidebar-section-first-margin-top\\),
            nav .pt-\\(--sidebar-section-first-margin-top\\),
            nav .mt-\\(--sidebar-section-margin-top\\),
            nav .pt-\\(--sidebar-section-margin-top\\) {
                margin-top: 10px!important;
                padding: 0!important;
            }

            nav .mt-\\(--sidebar-section-first-margin-top\\)::before,
            nav .pt-\\(--sidebar-section-first-margin-top\\)::before,
            nav .mt-\\(--sidebar-section-margin-top\\)::before,
            nav .pt-\\(--sidebar-section-margin-top\\)::before {
                content: '';
                position: absolute;
                width: 100%;
                height: 1px;
                background-color: color(srgb 1 1 1 / 0.17);
                display: block;
                transform: translateY(-5px);
            }

            nav .light .mt-\\(--sidebar-section-first-margin-top\\)::before,
            nav .light .pt-\\(--sidebar-section-first-margin-top\\)::before,
            nav .light .mt-\\(--sidebar-section-margin-top\\)::before,
            nav .light .pt-\\(--sidebar-section-margin-top\\)::before {
                background-color: color(srgb 0 0 0 / 0.17);
            }

            nav .tall\\:top-header-height {
                margin-top: 0!important;
            }

            nav .tall\\:top-header-height::before {
                background-color: transparent;
            }

            .tall\\:top-header-height,
            nav > aside.last\\:mb-5.mt-\\(--sidebar-section-first-margin-top\\) {
                margin-bottom: -10px!important;
            }

            nav > #history > aside > h2 {
                padding: 3px 10px 0 10px;
            }

            /* Swap sidebar header button positions */
            #sidebar-header {
                flex-direction: row-reverse;
            }

            /* Replace Home button icon with New Chat icon */
            #sidebar-header a[href="/"] svg {
                display: none;
            }

            #sidebar-header a[href="/"]::after {
                content: "";
                display: inline-block;
                width: 20px;
                height: 20px;
                background-image: url('data:image/svg+xml;utf8,<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon" aria-hidden="false" aria-label="New chat"><path d="M2.6687 11.333V8.66699C2.6687 7.74455 2.66841 7.01205 2.71655 6.42285C2.76533 5.82612 2.86699 5.31731 3.10425 4.85156L3.25854 4.57617C3.64272 3.94975 4.19392 3.43995 4.85229 3.10449L5.02905 3.02149C5.44666 2.84233 5.90133 2.75849 6.42358 2.71582C7.01272 2.66769 7.74445 2.66797 8.66675 2.66797H9.16675C9.53393 2.66797 9.83165 2.96586 9.83179 3.33301C9.83179 3.70028 9.53402 3.99805 9.16675 3.99805H8.66675C7.7226 3.99805 7.05438 3.99834 6.53198 4.04102C6.14611 4.07254 5.87277 4.12568 5.65601 4.20313L5.45581 4.28906C5.01645 4.51293 4.64872 4.85345 4.39233 5.27149L4.28979 5.45508C4.16388 5.7022 4.08381 6.01663 4.04175 6.53125C3.99906 7.05373 3.99878 7.7226 3.99878 8.66699V11.333C3.99878 12.2774 3.99906 12.9463 4.04175 13.4688C4.08381 13.9833 4.16389 14.2978 4.28979 14.5449L4.39233 14.7285C4.64871 15.1465 5.01648 15.4871 5.45581 15.7109L5.65601 15.7969C5.87276 15.8743 6.14614 15.9265 6.53198 15.958C7.05439 16.0007 7.72256 16.002 8.66675 16.002H11.3337C12.2779 16.002 12.9461 16.0007 13.4685 15.958C13.9829 15.916 14.2976 15.8367 14.5447 15.7109L14.7292 15.6074C15.147 15.3511 15.4879 14.9841 15.7117 14.5449L15.7976 14.3447C15.8751 14.128 15.9272 13.8546 15.9587 13.4688C16.0014 12.9463 16.0017 12.2774 16.0017 11.333V10.833C16.0018 10.466 16.2997 10.1681 16.6667 10.168C17.0339 10.168 17.3316 10.4659 17.3318 10.833V11.333C17.3318 12.2555 17.3331 12.9879 17.2849 13.5771C17.2422 14.0993 17.1584 14.5541 16.9792 14.9717L16.8962 15.1484C16.5609 15.8066 16.0507 16.3571 15.4246 16.7412L15.1492 16.8955C14.6833 17.1329 14.1739 17.2354 13.5769 17.2842C12.9878 17.3323 12.256 17.332 11.3337 17.332H8.66675C7.74446 17.332 7.01271 17.3323 6.42358 17.2842C5.90135 17.2415 5.44665 17.1577 5.02905 16.9785L4.85229 16.8955C4.19396 16.5601 3.64271 16.0502 3.25854 15.4238L3.10425 15.1484C2.86697 14.6827 2.76534 14.1739 2.71655 13.5771C2.66841 12.9879 2.6687 12.2555 2.6687 11.333ZM13.4646 3.11328C14.4201 2.334 15.8288 2.38969 16.7195 3.28027L16.8865 3.46485C17.6141 4.35685 17.6143 5.64423 16.8865 6.53613L16.7195 6.7207L11.6726 11.7686C11.1373 12.3039 10.4624 12.6746 9.72827 12.8408L9.41089 12.8994L7.59351 13.1582C7.38637 13.1877 7.17701 13.1187 7.02905 12.9707C6.88112 12.8227 6.81199 12.6134 6.84155 12.4063L7.10132 10.5898L7.15991 10.2715C7.3262 9.53749 7.69692 8.86241 8.23218 8.32715L13.2791 3.28027L13.4646 3.11328ZM15.7791 4.2207C15.3753 3.81702 14.7366 3.79124 14.3035 4.14453L14.2195 4.2207L9.17261 9.26856C8.81541 9.62578 8.56774 10.0756 8.45679 10.5654L8.41772 10.7773L8.28296 11.7158L9.22241 11.582L9.43433 11.543C9.92426 11.432 10.3749 11.1844 10.7322 10.8271L15.7791 5.78027L15.8552 5.69629C16.185 5.29194 16.1852 4.708 15.8552 4.30371L15.7791 4.2207Z"></path></svg>');
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
            }
        `;

        return styleSheet;
    }

    // ===== STYLE INJECTION WITH ERROR HANDLING =====
    function addStylesToPage() {
        const addStyles = (head) => {
            try {
                if (!head) {
                    log('Head element not found, using fallback', 'warn');
                    document.documentElement.appendChild(injectStyles());
                    return;
                }

                // Check if styles already exist
                if (document.getElementById('chatgpt-ui-enhancer-styles')) {
                    log('Styles already injected, skipping', 'info');
                    return;
                }

                head.appendChild(injectStyles());
                log('Styles injected successfully', 'info');
            } catch (error) {
                log(`Error injecting styles: ${error.message}`, 'error');
            }
        };

        // Wait for head to be available
        if (document.head) {
            addStyles(document.head);
        } else {
            const waitForHead = new Promise(resolve => {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => resolve(document.head), {once: true});
                } else {
                    resolve(document.head);
                }
            });

            waitForHead.then(addStyles);
        }
    }

    // ===== NEW CHAT KEYBOARD SHORTCUT =====
    function setupKeyboardShortcut() {
        // Cache for found element
        let cachedNewChatButton = null;
        let lastCheckTime = 0;
        const CACHE_DURATION = 1000; // Cache for 1 second

        const findNewChatButton = () => {
            const now = Date.now();

            // Return cached element if still valid
            if (cachedNewChatButton && (now - lastCheckTime) < CACHE_DURATION) {
                return cachedNewChatButton;
            }

            // Find new chat button
            for (const selector of NEW_CHAT_SELECTORS) {
                const element = document.querySelector(selector);
                if (element) {
                    cachedNewChatButton = element;
                    lastCheckTime = now;
                    return element;
                }
            }

            cachedNewChatButton = null;
            return null;
        };

        const handleNewChatShortcut = (event) => {
            // Ignore if already handled or repeating
            if (event.defaultPrevented || event.repeat) {
                return;
            }

            // Check for Ctrl+J or Cmd+J (Mac)
            const isCorrectKey = event.key.toLowerCase() === 'j';
            const hasModifier = event.metaKey || event.ctrlKey;
            const hasNoExtraModifiers = !event.altKey && !event.shiftKey;

            if (!isCorrectKey || !hasModifier || !hasNoExtraModifiers) {
                return;
            }

            const newChatButton = findNewChatButton();
            if (newChatButton) {
                try {
                    newChatButton.dispatchEvent(new MouseEvent('click', {bubbles: true}));
                    event.preventDefault();
                    log('New chat triggered via keyboard shortcut', 'info');
                } catch (error) {
                    log(`Error triggering new chat: ${error.message}`, 'error');
                }
            }
        };

        document.addEventListener('keydown', handleNewChatShortcut, true);
        log('Keyboard shortcut (Ctrl/Cmd+J) registered', 'info');
    }

    // ===== INITIALIZATION =====
    function initialize() {
        try {
            log('Initializing...', 'info');

            // Inject styles
            addStylesToPage();

            // Setup keyboard shortcuts
            setupKeyboardShortcut();

            log('Initialization complete', 'info');
        } catch (error) {
            log(`Initialization error: ${error.message}`, 'error');
        }
    }

    // Start the script
    initialize();

})();