// ==UserScript==
// @name         Gemini Start Menu (v5)
// @namespace    https://greasyfork.org
// @version      5
// @description  Gemini Logo Replacement with Dropdown - Menu with Google Live, ChatGPT, and Claude AI
// @author       Wesley King
// @match        *://gemini.google.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // PREVIOUS FEATURES (v1-v4):
    // - Replace Gemini logo with dropdown menu
    // - Theme-adaptive styling (dark/light mode)
    // - Menu with Google AI Studio Live, ChatGPT, and Claude AI
    // - MutationObserver for dynamic loading
    // - All comments and messages in English
    //
    // NEW IN v5:
    // - Changed label from "Google AI Studio Live" to "Google Live"
    // ============================================

    // 1. Selector: Locate the "Gemini" text element
    const LOGO_SELECTOR = '[data-test-id="bard-text"]';

    // 2. Custom dropdown menu options configuration (UPDATED IN v5: Label changed to "Google Live")
    const menuOptions = [
        { label: 'Google Live', url: 'https://aistudio.google.com/live' },
        { label: 'ChatGPT', url: 'https://chatgpt.com/' },
        { label: 'Claude AI', url: 'https://claude.ai/' }
    ];

    /**
     * Create custom dropdown menu HTML element
     * @returns {HTMLElement} Dropdown menu DOM element
     */
    function createCustomDropdown() {
        const select = document.createElement('select');
        select.id = 'custom-gemini-menu';

        // Basic styling: ensure it blends into the original interface
        select.style.padding = '0 8px';
        select.style.cursor = 'pointer';
        select.style.border = 'none';

        // Key theme adaptation: transparent background to inherit parent element color
        select.style.backgroundColor = 'transparent';

        // Key theme adaptation: use Gemini interface text color variable
        // This variable changes its corresponding value with theme switching
        select.style.color = 'var(--gm-fill-color-dark-on-surface)';

        select.style.fontWeight = 'bold';
        select.style.height = '100%';
        select.style.appearance = 'none';
        select.style.direction = 'rtl';

        // Font requirements
        select.style.fontSize = '20px';
        select.style.fontFamily = 'Google Sans Flex, Google Sans, Helvetica Neue, sans-serif';

        // Define color variables for dropdown menu options (these variables change with theme switching)
        const optionTextColor = 'var(--gm-fill-color-dark-on-surface)';
        const optionBackgroundColor = 'var(--gm-surface-background-color)';

        // Helper function: create option element and apply theme styles
        const createOption = (label, value, isDefault = false) => {
            const option = document.createElement('option');
            option.textContent = label;
            option.value = value;
            if (isDefault) {
                option.disabled = true;
                option.selected = true;
            }

            // Set theme-adaptive background and text color for options
            option.style.backgroundColor = optionBackgroundColor;
            option.style.color = optionTextColor;

            // Option font style (usually slightly smaller)
            option.style.fontSize = '16px';
            option.style.fontFamily = 'Google Sans Flex, Google Sans, Helvetica Neue, sans-serif';

            return option;
        };

        // Add default option (no navigation, just acts as title)
        select.appendChild(createOption('Gemini', '#', true));

        // Add configured options (v5: Google Live, ChatGPT, and Claude AI)
        menuOptions.forEach(config => {
            select.appendChild(createOption(config.label, config.url));
        });

        // Listen for dropdown menu change events
        select.addEventListener('change', (event) => {
            const selectedUrl = event.target.value;
            if (selectedUrl && selectedUrl !== '#') {
                window.open(selectedUrl, '_blank');
                event.target.value = '#'; // Reset selection
            }
        });

        return select;
    }

    /**
     * Find and replace Logo element
     */
    function replaceLogoWithDropdown() {
        const logoElement = document.querySelector(LOGO_SELECTOR);

        if (logoElement) {
            console.log("Found Gemini text element, starting replacement...");
            const dropdown = createCustomDropdown();

            // Clear original "Gemini" text
            logoElement.innerHTML = '';

            // Insert custom dropdown menu
            logoElement.appendChild(dropdown);

        } else {
            console.warn("Gemini text element not found, please check if selector is correct:", LOGO_SELECTOR);
        }
    }

    // Use MutationObserver to ensure replacement is executed immediately after element loads
    const observer = new MutationObserver((mutationsList, observer) => {
        const logoElement = document.querySelector(LOGO_SELECTOR);
        if (logoElement) {
            observer.disconnect();
            replaceLogoWithDropdown();
        }
    });

    // Start observing child element changes in the entire document
    observer.observe(document.body, { childList: true, subtree: true });

    // Add a safety net
    if (document.querySelector(LOGO_SELECTOR)) {
        replaceLogoWithDropdown();
    }
})();