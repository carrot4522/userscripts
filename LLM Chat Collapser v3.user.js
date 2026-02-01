// ==UserScript==
// @name         LLM Chat Collapser v3
// @namespace    https://github.com/miniyu157/llm-chat-collapser
// @version      3
// @description  Makes code blocks on Gemini/ChatGPT and long user messages on ChatGPT collapsible for a cleaner interface. Fixed scrollbar visibility issues.
// @author       miniyu157
// @license      MIT
// @match        https://gemini.google.com/*
// @match        https://chatgpt.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @grant        GM_addStyle
// @run-at       document-end
// @homepageURL  https://github.com/miniyu157/llm-chat-collapser
// @supportURL   https://github.com/miniyu157/llm-chat-collapser/issues
// @downloadURL  https://update.greasyfork.org/scripts/551014/LLM%20Chat%20Collapser.user.js
// @updateURL    https://update.greasyfork.org/scripts/551014/LLM%20Chat%20Collapser.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // ===== Configuration =====
    const CONFIG = {
        processAttribute: 'data-ucc-processed',
        userMessageLineThreshold: 3,
        userMessageCharThreshold: 200,
        mutationDebounceDelay: 100 // Debounce delay in milliseconds for mutation processing
    };

    // ===== DOM Cache =====
    // Cache frequently accessed elements and selectors to improve performance
    const DOM_CACHE = {
        hostname: window.location.hostname,
        processedElements: new WeakSet() // More memory-efficient than attribute checking
    };

    // ===== Inject Styles =====
    GM_addStyle(`
        /* Base collapsible header styles */
        .ucc-collapsible-header {
            cursor: pointer;
            position: relative;
            user-select: none;
        }

        /* Arrow indicator for collapsed/expanded state */
        .ucc-arrow-indicator::before {
            content: '▶';
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            font-size: 10px;
            color: var(--mat-sys-color-on-surface-variant, #888);
            transition: transform 0.2s ease-in-out;
        }

        /* Expanded state arrow rotation */
        .ucc-header-expanded::before {
            transform: translateY(-50%) rotate(90deg);
        }

        /* Gemini-specific styles */
        .gemini-header-padding {
            padding-left: 32px !important;
        }
        .gemini-arrow-pos::before {
            left: 12px;
        }

        /* ChatGPT-specific styles */
        .chatgpt-header-padding {
            padding-left: 24px !important;
        }
        .chatgpt-arrow-pos::before {
            left: 8px;
        }

        /* Text clamping for user messages */
        .ucc-user-text-clamp {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
            overflow: hidden;
            /* Ensure text clamp doesn't affect scrollbar */
            overflow-x: visible;
        }

        /* Scrollbar preservation - ensure our styles don't hide scrollbars */
        body, html {
            overflow: auto !important;
        }

        /* Ensure collapsible content doesn't interfere with page scroll */
        .ucc-collapsible-header,
        .ucc-user-text-clamp {
            overflow-y: visible !important;
        }
    `);

    // ===== Utility Functions =====

    /**
     * Debounce function to limit execution rate
     * Optimizes performance by preventing excessive function calls
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * Apply display-based collapse functionality
     * Toggles element visibility using display: none
     * @param {HTMLElement} header - Header element to click
     * @param {HTMLElement} content - Content element to collapse
     */
    function applyDisplayCollapse(header, content) {
        // Safety check for null elements
        if (!header || !content) {
            console.warn('[LLM Chat Collapser] Invalid elements passed to applyDisplayCollapse');
            return;
        }

        try {
            header.classList.add('ucc-collapsible-header', 'ucc-arrow-indicator');
            content.style.display = 'none';

            header.addEventListener('click', (event) => {
                // Don't interfere with buttons or links
                if (event.target.closest('button, a')) return;

                header.classList.toggle('ucc-header-expanded');
                content.style.display = content.style.display === 'none' ? '' : 'none';
            }, { passive: true }); // Added passive flag for better scroll performance
        } catch (error) {
            console.error('[LLM Chat Collapser] Error in applyDisplayCollapse:', error);
        }
    }

    /**
     * Apply line-clamp-based collapse functionality
     * Toggles text truncation using CSS line-clamp
     * @param {HTMLElement} header - Header element to click
     * @param {HTMLElement} content - Content element to clamp
     */
    function applyLineClampCollapse(header, content) {
        // Safety check for null elements
        if (!header || !content) {
            console.warn('[LLM Chat Collapser] Invalid elements passed to applyLineClampCollapse');
            return;
        }

        try {
            header.classList.add('ucc-collapsible-header', 'ucc-arrow-indicator');
            content.classList.add('ucc-user-text-clamp');

            header.addEventListener('click', (event) => {
                // Don't interfere with buttons or links
                if (event.target.closest('button, a')) return;

                header.classList.toggle('ucc-header-expanded');
                content.classList.toggle('ucc-user-text-clamp');
            }, { passive: true }); // Added passive flag for better scroll performance
        } catch (error) {
            console.error('[LLM Chat Collapser] Error in applyLineClampCollapse:', error);
        }
    }

    /**
     * Check if element has already been processed using WeakSet
     * More memory-efficient than attribute checking
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} True if already processed
     */
    function isProcessed(element) {
        return DOM_CACHE.processedElements.has(element);
    }

    /**
     * Mark element as processed using WeakSet
     * More memory-efficient than attribute setting
     * @param {HTMLElement} element - Element to mark
     */
    function markAsProcessed(element) {
        DOM_CACHE.processedElements.add(element);
        // Also set attribute for backwards compatibility and debugging
        element.setAttribute(CONFIG.processAttribute, 'true');
    }

    // ===== Gemini Processors =====

    /**
     * Process Gemini code block elements
     * @param {HTMLElement} element - Code block element
     */
    function processGeminiCodeBlock(element) {
        if (!element || isProcessed(element)) return;

        try {
            markAsProcessed(element);

            // Cache querySelector results to avoid redundant DOM queries
            const header = element.querySelector('.code-block-decoration');
            const content = element.querySelector('.formatted-code-block-internal-container');

            if (header && content) {
                header.classList.add('gemini-header-padding', 'gemini-arrow-pos');
                applyDisplayCollapse(header, content);
            }
        } catch (error) {
            console.error('[LLM Chat Collapser] Error processing Gemini code block:', error);
        }
    }

    // ===== ChatGPT Processors =====

    /**
     * Process ChatGPT code block elements
     * @param {HTMLElement} element - Pre element containing code
     */
    function processChatGPTCodeBlock(element) {
        if (!element || isProcessed(element)) return;

        try {
            markAsProcessed(element);

            // Cache querySelector results to avoid redundant DOM queries
            const header = element.querySelector('.rounded-t-2xl');
            const content = element.querySelector('.p-4');

            // Don't process if currently streaming
            if (header && content && !header.closest('.result-streaming')) {
                header.classList.add('chatgpt-header-padding', 'chatgpt-arrow-pos');
                applyDisplayCollapse(header, content);
            }
        } catch (error) {
            console.error('[LLM Chat Collapser] Error processing ChatGPT code block:', error);
        }
    }

    /**
     * Process ChatGPT user message elements
     * Makes long user messages collapsible
     * @param {HTMLElement} element - User message element
     */
    function processChatGPTUserMessage(element) {
        if (!element || isProcessed(element)) return;

        try {
            markAsProcessed(element);

            // Cache querySelector result
            const textContainer = element.querySelector('.whitespace-pre-wrap');
            if (!textContainer) return;

            // Determine if message is long enough to collapse
            const text = textContainer.textContent;
            if (!text) return; // Safety check for empty text

            const lineCount = text.split('\n').length;
            const isLong = lineCount > CONFIG.userMessageLineThreshold ||
                          (lineCount === 1 && text.length > CONFIG.userMessageCharThreshold);

            if (isLong) {
                const bubble = element.querySelector('.user-message-bubble-color');
                if (bubble) {
                    bubble.classList.add('chatgpt-header-padding', 'chatgpt-arrow-pos');
                    applyLineClampCollapse(bubble, textContainer);
                }
            }
        } catch (error) {
            console.error('[LLM Chat Collapser] Error processing ChatGPT user message:', error);
        }
    }

    // ===== Main Processing Logic =====

    /**
     * Selector map for different platforms
     * Maps selectors to their processing functions
     */
    const SELECTOR_MAP = {
        'gemini.google.com': {
            [`code-block:not([${CONFIG.processAttribute}])`]: processGeminiCodeBlock,
        },
        'chatgpt.com': {
            [`pre:not([${CONFIG.processAttribute}])`]: processChatGPTCodeBlock,
            [`div[data-message-author-role="user"]:not([${CONFIG.processAttribute}])`]: processChatGPTUserMessage,
        }
    };

    /**
     * Scan and process elements in a node
     * Optimized with early returns and cached hostname
     * @param {Node} node - Node to scan
     */
    function scanAndProcess(node) {
        // Early return for invalid nodes
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

        try {
            // Use cached hostname for better performance
            const hostname = DOM_CACHE.hostname;

            // Find matching platform configuration
            for (const hostKey in SELECTOR_MAP) {
                if (!hostname.includes(hostKey)) continue; // Early continue for non-matching hosts

                const selectors = SELECTOR_MAP[hostKey];

                // Process each selector for this platform
                for (const selector in selectors) {
                    const processor = selectors[selector];

                    // Check if the node itself matches (optimized with early evaluation)
                    const elements = node.matches?.(selector)
                        ? [node]
                        : Array.from(node.querySelectorAll(selector));

                    // Process elements with error handling
                    elements.forEach(element => {
                        try {
                            processor(element);
                        } catch (error) {
                            console.error('[LLM Chat Collapser] Error processing element:', error);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('[LLM Chat Collapser] Error in scanAndProcess:', error);
        }
    }

    // ===== Scrollbar Preservation Check =====

    /**
     * Ensure scrollbar remains visible
     * Checks and corrects any overflow issues that might hide the scrollbar
     */
    function ensureScrollbarVisible() {
        try {
            // Ensure body and html don't have overflow hidden
            if (document.body.style.overflow === 'hidden') {
                document.body.style.overflow = 'auto';
                console.log('[LLM Chat Collapser] Corrected body overflow to preserve scrollbar');
            }
            if (document.documentElement.style.overflow === 'hidden') {
                document.documentElement.style.overflow = 'auto';
                console.log('[LLM Chat Collapser] Corrected html overflow to preserve scrollbar');
            }
        } catch (error) {
            console.error('[LLM Chat Collapser] Error ensuring scrollbar visibility:', error);
        }
    }

    // ===== Initialization =====

    /**
     * Initialize MutationObserver to watch for new elements
     * Optimized with debouncing to prevent excessive processing
     */
    function initializeObserver() {
        try {
            // Debounced processing function to improve performance during rapid DOM changes
            const debouncedProcess = debounce((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach(node => scanAndProcess(node));
                    }
                }
                // Check scrollbar visibility after processing mutations
                ensureScrollbarVisible();
            }, CONFIG.mutationDebounceDelay);

            const observer = new MutationObserver(debouncedProcess);

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            console.log('[LLM Chat Collapser] Observer initialized with debouncing');
        } catch (error) {
            console.error('[LLM Chat Collapser] Error initializing observer:', error);
        }
    }

    /**
     * Main initialization function
     */
    function init() {
        try {
            console.log('[LLM Chat Collapser v3] Starting initialization...');

            // Ensure scrollbar is visible on load
            ensureScrollbarVisible();

            // Process existing elements on page load
            scanAndProcess(document.body);

            // Start observing for dynamically added elements
            initializeObserver();

            // Periodic check to ensure scrollbar remains visible (every 2 seconds)
            setInterval(ensureScrollbarVisible, 2000);

            console.log('[LLM Chat Collapser v3] Initialized successfully');
        } catch (error) {
            console.error('[LLM Chat Collapser] Fatal error during initialization:', error);
        }
    }

    // Start the script
    init();

})();