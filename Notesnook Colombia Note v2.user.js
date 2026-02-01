// ==UserScript==
// @name         Notesnook Colombia Note v2
// @namespace    Notesnook Colombia Note v2
// @version      2
// @description  If a note titled "Lista Pendiente" exists: replace header with "Colombia", add Colombia flag at bottom, and highlight that note - Optimized
// @match        https://app.notesnook.com/notes*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    // Constants
    const CONFIG = {
        TARGET_NOTE: 'lista pendiente',
        HEADER_TEXT: 'Notesnook',
        REPLACEMENT_TEXT: 'Colombia',
        FLAG_URL: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Flag_of_Colombia.svg',
        CHECK_INTERVAL: 500,
        MAX_WAIT_TIME: 30000,
        COLORS: {
            GREEN: '#00a651',
            HIGHLIGHT_BG: '#e6fff2',
        },
        SELECTORS: {
            NOTE_SPANS: 'span[dir="auto"]',
            NAV_MENU: '#navigation-menu .ms-container',
            NOTE_CARD: 'div.css-12ae2au, div.css-jm60yb, div[role="button"]',
        },
        IDS: {
            FLAG: 'colombia-flag-logo',
            REPLACED: 'colombiaReplaced',
            HIGHLIGHT: 'colombia-highlight',
        },
    };

    const STYLES = {
        TITLE: {
            fontWeight: '900',
            color: CONFIG.COLORS.GREEN,
            fontSize: '18px',
        },
        FLAG: {
            marginTop: 'auto',
            padding: '18px',
            width: '64px',
            height: 'auto',
            display: 'block',
            marginLeft: 'auto',
            marginRight: 'auto',
        },
        NAV_CONTAINER: {
            display: 'flex',
            flexDirection: 'column',
        },
        HIGHLIGHT: {
            background: CONFIG.COLORS.HIGHLIGHT_BG,
            border: `2px solid ${CONFIG.COLORS.GREEN}`,
            borderRadius: '8px',
        },
    };

    // Utility functions
    const applyStyles = (element, styles) => {
        Object.assign(element.style, styles);
    };

    const normalizeText = (text) => text.trim().toLowerCase();

    const hasTargetNote = () => {
        return Array.from(document.querySelectorAll(CONFIG.SELECTORS.NOTE_SPANS))
            .some(span => normalizeText(span.textContent) === CONFIG.TARGET_NOTE);
    };

    // Main operations
    const replaceTitle = () => {
        const spans = document.querySelectorAll('span');

        for (const el of spans) {
            if (el.textContent.trim() === CONFIG.HEADER_TEXT && !el.dataset[CONFIG.IDS.REPLACED]) {
                el.textContent = CONFIG.REPLACEMENT_TEXT;
                applyStyles(el, STYLES.TITLE);
                el.dataset[CONFIG.IDS.REPLACED] = 'true';
            }
        }
    };

    const insertFlag = () => {
        if (document.getElementById(CONFIG.IDS.FLAG)) return;

        const navMenu = document.querySelector(CONFIG.SELECTORS.NAV_MENU);
        if (!navMenu) return;

        const img = document.createElement('img');
        img.id = CONFIG.IDS.FLAG;
        img.src = CONFIG.FLAG_URL;
        applyStyles(img, STYLES.FLAG);
        applyStyles(navMenu, STYLES.NAV_CONTAINER);
        navMenu.appendChild(img);
    };

    const highlightNote = () => {
        const spans = document.querySelectorAll(CONFIG.SELECTORS.NOTE_SPANS);

        for (const span of spans) {
            if (normalizeText(span.textContent) === CONFIG.TARGET_NOTE) {
                const noteCard = span.closest(CONFIG.SELECTORS.NOTE_CARD);

                if (noteCard && !noteCard.classList.contains(CONFIG.IDS.HIGHLIGHT)) {
                    noteCard.classList.add(CONFIG.IDS.HIGHLIGHT);
                    applyStyles(noteCard, STYLES.HIGHLIGHT);
                }
            }
        }
    };

    const runConditionalLogic = () => {
        if (hasTargetNote()) {
            replaceTitle();
            insertFlag();
            highlightNote();
        }
    };

    // Content detection
    const isContentReady = () => {
        const hasNotes = document.querySelectorAll(CONFIG.SELECTORS.NOTE_SPANS).length > 0;
        const hasNavMenu = document.querySelector('#navigation-menu');
        return hasNotes && hasNavMenu;
    };

    const waitForContent = () => {
        const checkInterval = setInterval(() => {
            if (isContentReady()) {
                clearInterval(checkInterval);
                runConditionalLogic();
                setupObserver();
            }
        }, CONFIG.CHECK_INTERVAL);

        // Safety timeout
        setTimeout(() => clearInterval(checkInterval), CONFIG.MAX_WAIT_TIME);
    };

    const setupObserver = () => {
        const observer = new MutationObserver(runConditionalLogic);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    };

    // Initialization
    const initialize = () => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitForContent);
        } else {
            waitForContent();
        }
    };

    initialize();
})();