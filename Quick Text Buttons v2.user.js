// ==UserScript==
// @name         Quick Text Buttons v2
// @namespace    Quick Text Buttons v2
// @version      2
// @license      MIT
// @description  Adds customizable buttons to paste predefined text into the input field on ChatGPT/Gemini - Optimized
// @icon         https://raw.githubusercontent.com/p65536/p65536/main/images/qtb.ico
// @author       p65536
// @match        https://chatgpt.com/*
// @match        https://gemini.google.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// @noframes
// @downloadURL https://update.greasyfork.org/scripts/544699/Quick-Text-Buttons.user.js
// @updateURL https://update.greasyfork.org/scripts/544699/Quick-Text-Buttons.meta.js
// ==/UserScript==

(() => {
    'use strict';

    // =================================================================================
    // SECTION: Script-Specific Definitions
    // =================================================================================

    const OWNERID = 'p65536';
    const APPID = 'qtbux';
    const APPNAME = 'Quick Text Buttons';
    const LOG_PREFIX = `[${APPID.toUpperCase()}]`;

    // =================================================================================
    // SECTION: Logging Utility
    // =================================================================================

    const Logger = {
        levels: { error: 0, warn: 1, info: 2, log: 3 },
        level: 'log',

        setLevel(level) {
            if (this.levels.hasOwnProperty(level)) {
                this.level = level;
            } else {
                console.warn(LOG_PREFIX, `Invalid log level "${level}". Valid levels are: ${Object.keys(this.levels).join(', ')}`);
            }
        },

        error(...args) { if (this.levels[this.level] >= this.levels.error) console.error(LOG_PREFIX, ...args); },
        warn(...args) { if (this.levels[this.level] >= this.levels.warn) console.warn(LOG_PREFIX, ...args); },
        info(...args) { if (this.levels[this.level] >= this.levels.info) console.info(LOG_PREFIX, ...args); },
        log(...args) { if (this.levels[this.level] >= this.levels.log) console.log(LOG_PREFIX, ...args); },
        group: (...args) => console.group(LOG_PREFIX, ...args),
        groupCollapsed: (...args) => console.groupCollapsed(LOG_PREFIX, ...args),
        groupEnd: () => console.groupEnd(),
    };

    // =================================================================================
    // SECTION: Execution Guard
    // =================================================================================

    class ExecutionGuard {
        static #GUARD_KEY = `__${OWNERID}_guard__`;
        static #APP_KEY = `${APPID}_executed`;

        static hasExecuted() {
            return window[this.#GUARD_KEY]?.[this.#APP_KEY] || false;
        }

        static setExecuted() {
            window[this.#GUARD_KEY] = window[this.#GUARD_KEY] || {};
            window[this.#GUARD_KEY][this.#APP_KEY] = true;
        }
    }

    // =================================================================================
    // SECTION: Platform-Specific Adapter
    // =================================================================================

    const PlatformAdapters = {
        General: {
            getPlatformDetails() {
                const { host } = location;
                if (host.includes('chatgpt.com')) {
                    return {
                        platformId: 'chatgpt',
                        selectors: {
                            ANCHOR_ELEMENT: 'div.ProseMirror#prompt-textarea',
                            CANVAS_CONTAINER: 'section.popover header h2',
                        },
                    };
                }
                if (host.includes('gemini.google.com')) {
                    return {
                        platformId: 'gemini',
                        selectors: {
                            ANCHOR_ELEMENT: 'rich-textarea .ql-editor',
                            CANVAS_CONTAINER: 'immersive-panel',
                        },
                    };
                }
                return null;
            },

            insertText(text, options = {}) {
                const platform = this.getPlatformDetails();
                if (!platform) {
                    Logger.error('Platform details not found.');
                    return;
                }

                const editor = document.querySelector(platform.selectors.ANCHOR_ELEMENT);
                if (!editor) {
                    Logger.error('Input element not found via selector:', platform.selectors.ANCHOR_ELEMENT);
                    return;
                }

                EditorController.insertText(text, editor, options, platform.platformId);
            },
        },

        UI: {
            repositionButtons(uiManager) {
                const platform = PlatformAdapters.General.getPlatformDetails();
                if (!platform || !uiManager) return;

                if (platform.platformId === 'gemini') return;

                if (platform.platformId === 'chatgpt') {
                    const { settingsBtn, insertBtn } = uiManager.components;
                    if (!settingsBtn?.element || !insertBtn?.element) return;

                    const canvasTitle = document.querySelector(platform.selectors.CANVAS_CONTAINER);

                    if (canvasTitle) {
                        const canvasPanel = canvasTitle.closest('section.popover');
                        if (canvasPanel) {
                            const canvasRect = canvasPanel.getBoundingClientRect();
                            const offset = CONSTANTS.POSITIONING.GPT_CANVAS_OFFSET_PX;
                            const gap = CONSTANTS.POSITIONING.GPT_BUTTON_GAP_PX;

                            settingsBtn.element.style.right = '';
                            settingsBtn.element.style.left = `${canvasRect.left - offset}px`;

                            const settingsBtnWidth = settingsBtn.element.offsetWidth;
                            insertBtn.element.style.right = '';
                            insertBtn.element.style.left = `${canvasRect.left - offset - settingsBtnWidth - gap}px`;
                            return;
                        }
                    }

                    settingsBtn.element.style.left = '';
                    settingsBtn.element.style.right = settingsBtn.options.position.right;

                    insertBtn.element.style.left = '';
                    insertBtn.element.style.right = insertBtn.options.position.right;
                }
            },
        },

        Observer: {
            getInitializers() {
                return [this.startCanvasObserver];
            },

            startCanvasObserver() {
                const platform = PlatformAdapters.General.getPlatformDetails();
                if (!platform || platform.platformId !== 'chatgpt') return;

                let canvasResizeObserver = null;
                let lastCanvasState = false;

                const checkCanvasState = () => {
                    const canvasPanel = document.querySelector(platform.selectors.CANVAS_CONTAINER)?.closest('section.popover');
                    const isCanvasActive = !!canvasPanel;

                    if (isCanvasActive === lastCanvasState) return;
                    lastCanvasState = isCanvasActive;

                    canvasResizeObserver?.disconnect();
                    canvasResizeObserver = null;

                    if (isCanvasActive) {
                        canvasResizeObserver = new ResizeObserver(this.debouncedCanvasResized);
                        canvasResizeObserver.observe(canvasPanel);
                    }
                    this.debouncedCanvasStateChanged();
                };

                const debouncedStateCheck = debounce(checkCanvasState, CONSTANTS.POSITIONING.RECALC_DEBOUNCE_MS);
                const canvasDetectionObserver = new MutationObserver(debouncedStateCheck);
                canvasDetectionObserver.observe(document.body, { childList: true, subtree: true });

                checkCanvasState();
            },
        },
    };

    // =================================================================================
    // SECTION: Editor Controller
    // =================================================================================

    class EditorController {
        static insertText(text, editor, options, platformId) {
            setTimeout(() => {
                editor.focus();

                const selection = window.getSelection();
                if (!selection || selection.rangeCount === 0) {
                    Logger.error('Could not get selection or range.');
                    return;
                }
                const range = selection.getRangeAt(0);

                let existingText;
                const paragraphs = Array.from(editor.childNodes).filter((n) => n.nodeName === 'P');
                const isRestoredState = platformId === 'chatgpt' && paragraphs.length === 1 && paragraphs[0].textContent.includes('\n');

                if (isRestoredState) {
                    existingText = paragraphs[0].textContent;
                } else {
                    existingText = this._getTextFromEditor(editor, platformId);
                }

                let cursorPos = 0;
                const isEditorFocused = editor.contains(selection.anchorNode);

                if (options.insertion_position === 'cursor' && isEditorFocused) {
                    cursorPos = this._getCursorPositionInText(editor, platformId);
                } else if (options.insertion_position === 'start') {
                    cursorPos = 0;
                } else {
                    cursorPos = existingText.length;
                }

                let textToInsert = text;
                if (options.insert_before_newline) textToInsert = '\n' + textToInsert;
                if (options.insert_after_newline) textToInsert += '\n';

                const finalText = existingText.slice(0, cursorPos) + textToInsert + existingText.slice(cursorPos);
                const newCursorPos = cursorPos + textToInsert.length;

                const finalFragment = this._createTextFragmentForEditor(finalText, platformId);

                range.selectNodeContents(editor);
                range.deleteContents();
                range.insertNode(finalFragment);

                this._setCursorPositionByOffset(editor, newCursorPos);

                if (platformId === 'gemini') {
                    editor.classList.remove('ql-blank');
                }

                editor.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            }, 100);
        }

        static _getTextFromEditor(editor, platformId) {
            if (platformId === 'chatgpt' && editor.querySelector('p.placeholder')) return '';
            if (platformId === 'gemini' && editor.childNodes.length === 1 && editor.firstChild.nodeName === 'P' && editor.firstChild.innerHTML === '<br>') return '';

            const lines = [];

            for (const p of editor.childNodes) {
                if (p.nodeName !== 'P') continue;

                const isStructuralEmptyLine = p.childNodes.length === 1 && p.firstChild.nodeName === 'BR';
                let isEmptyLine = false;

                if (isStructuralEmptyLine) {
                    if (platformId === 'chatgpt') {
                        isEmptyLine = p.firstChild.className === 'ProseMirror-trailingBreak';
                    } else {
                        isEmptyLine = true;
                    }
                }

                if (isEmptyLine) {
                    lines.push('');
                } else {
                    lines.push(p.textContent);
                }
            }
            return lines.join('\n');
        }

        static _getCursorPositionInText(editor, platformId) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return 0;

            const range = selection.getRangeAt(0);
            if (!editor.contains(range.startContainer)) return 0;

            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(editor);
            preCaretRange.setEnd(range.startContainer, range.startOffset);

            const tempDiv = document.createElement('div');
            tempDiv.appendChild(preCaretRange.cloneContents());

            const textBeforeCursor = this._getTextFromEditor(tempDiv, platformId);
            return textBeforeCursor.length;
        }

        static _createTextFragmentForEditor(text, platformId) {
            const fragment = document.createDocumentFragment();
            const lines = text.split('\n');

            lines.forEach((line) => {
                const p = document.createElement('p');
                if (line === '') {
                    const br = document.createElement('br');
                    if (platformId === 'chatgpt') {
                        br.className = 'ProseMirror-trailingBreak';
                    }
                    p.appendChild(br);
                } else {
                    p.appendChild(document.createTextNode(line));
                }
                fragment.appendChild(p);
            });
            return fragment;
        }

        static _setCursorPositionByOffset(editor, offset) {
            const selection = window.getSelection();
            if (!selection) return;

            const range = document.createRange();
            let charCount = 0;
            let lastNode = editor;

            const paragraphs = Array.from(editor.childNodes).filter((n) => n.nodeName === 'P');

            for (let i = 0; i < paragraphs.length; i++) {
                const p = paragraphs[i];
                lastNode = p;
                const treeWalker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
                let textNode = null;

                while ((textNode = treeWalker.nextNode())) {
                    lastNode = textNode;
                    const nodeLength = textNode.textContent.length;
                    if (charCount + nodeLength >= offset) {
                        range.setStart(textNode, offset - charCount);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                        return;
                    }
                    charCount += nodeLength;
                }

                if (i < paragraphs.length - 1) {
                    if (charCount === offset) {
                        range.selectNodeContents(p);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                        return;
                    }
                    charCount++;
                }
            }

            range.selectNodeContents(lastNode);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    // =================================================================================
    // SECTION: Configuration and Constants
    // =================================================================================

    const CONSTANTS = {
        CONFIG_KEY: `${APPID}_config`,
        CONFIG_SIZE_LIMIT_BYTES: 5033164,
        ID_PREFIX: `${APPID}-id-`,
        TEXT_LIST_WIDTH: 500,
        HIDE_DELAY_MS: 250,
        MODAL: {
            WIDTH: 440,
            PADDING: 16,
            RADIUS: 8,
            BTN_RADIUS: 5,
            BTN_FONT_SIZE: 13,
            BTN_PADDING: '5px 16px',
            TITLE_MARGIN_BOTTOM: 8,
            BTN_GROUP_GAP: 8,
            TEXTAREA_HEIGHT: 200,
        },
        POSITIONING: {
            RECALC_DEBOUNCE_MS: 150,
            GPT_CANVAS_OFFSET_PX: 136,
            GPT_BUTTON_GAP_PX: 8,
        },
        UI_DEFAULTS: {
            SETTINGS_BUTTON_POSITION: { top: '10px', right: '360px' },
            INSERT_BUTTON_POSITION: { top: '10px', right: '400px' },
        },
    };

    const SITE_STYLES = {
        chatgpt: {
            SETTINGS_BUTTON: {
                background: 'var(--interactive-bg-secondary-default)',
                borderColor: 'var(--interactive-border-secondary-default)',
                backgroundHover: 'var(--interactive-bg-secondary-hover)',
                borderRadius: 'var(--radius-md, 4px)',
                iconDef: {
                    tag: 'svg',
                    props: { xmlns: 'http://www.w3.org/2000/svg', height: '24px', viewBox: '0 -960 960 960', width: '24px', fill: 'currentColor' },
                    children: [{ tag: 'path', props: { d: 'M270-80q-45 0-77.5-30.5T160-186v-558q0-38 23.5-68t61.5-38l395-78v640l-379 76q-9 2-15 9.5t-6 16.5q0 11 9 18.5t21 7.5h450v-640h80v720H270Zm90-233 200-39v-478l-200 39v478Zm-80 16v-478l-15 3q-11 2-18 9.5t-7 18.5v457q5-2 10.5-3.5T261-293l19-4Zm-40-472v482-482Z' } }],
                },
            },
            INSERT_BUTTON: {
                background: 'var(--interactive-bg-secondary-default)',
                borderColor: 'var(--interactive-border-secondary-default)',
                backgroundHover: 'var(--interactive-bg-secondary-hover)',
                borderRadius: 'var(--radius-md, 4px)',
                iconDef: {
                    tag: 'svg',
                    props: { xmlns: 'http://www.w3.org/2000/svg', height: '24px', viewBox: '0 0 24 24', width: '24px', fill: 'currentColor' },
                    children: [
                        { tag: 'path', props: { d: 'M0 0h24v24H0V0z', fill: 'none' } },
                        { tag: 'path', props: { d: 'M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z' } },
                    ],
                },
            },
            SETTINGS_PANEL: {
                bg: 'var(--sidebar-surface-primary)',
                text_primary: 'var(--text-primary)',
                text_secondary: 'var(--text-secondary)',
                border_medium: 'var(--border-medium)',
                border_default: 'var(--border-default)',
                border_light: 'var(--border-light)',
                accent_color: 'var(--text-accent)',
                input_bg: 'var(--bg-primary)',
                input_text: 'var(--text-primary)',
                input_border: 'var(--border-default)',
                toggle_bg_off: 'var(--bg-primary)',
                toggle_bg_on: 'var(--text-accent)',
                toggle_knob: 'var(--text-primary)',
            },
            JSON_MODAL: {
                bg: 'var(--main-surface-primary)',
                text: 'var(--text-primary)',
                border: 'var(--border-default)',
                btn_bg: 'var(--interactive-bg-tertiary-default)',
                btn_hover_bg: 'var(--interactive-bg-secondary-hover)',
                btn_text: 'var(--text-primary)',
                btn_border: 'var(--border-default)',
                textarea_bg: 'var(--bg-primary)',
                textarea_text: 'var(--text-primary)',
                textarea_border: 'var(--border-default)',
                msg_error_text: 'var(--text-danger)',
                msg_success_text: 'var(--text-accent)',
            },
            THEME_MODAL: {
                modal_bg: 'var(--main-surface-primary)',
                modal_text: 'var(--text-primary)',
                modal_border: 'var(--border-default)',
                btn_bg: 'var(--interactive-bg-tertiary-default)',
                btn_hover_bg: 'var(--interactive-bg-secondary-hover)',
                btn_text: 'var(--text-primary)',
                btn_border: 'var(--border-default)',
                error_text: 'var(--text-danger)',
                delete_confirm_label_text: 'var(--text-danger)',
                delete_confirm_btn_text: 'var(--interactive-label-danger-secondary-default)',
                delete_confirm_btn_bg: 'var(--interactive-bg-danger-secondary-default)',
                delete_confirm_btn_hover_text: 'var(--interactive-label-danger-secondary-hover)',
                delete_confirm_btn_hover_bg: 'var(--interactive-bg-danger-secondary-hover)',
                fieldset_border: 'var(--border-medium)',
                legend_text: 'var(--text-secondary)',
                label_text: 'var(--text-secondary)',
                input_bg: 'var(--bg-primary)',
                input_text: 'var(--text-primary)',
                input_border: 'var(--border-default)',
                slider_display_text: 'var(--text-secondary)',
                popup_bg: 'var(--main-surface-primary)',
                popup_border: 'var(--border-default)',
                dnd_indicator_color: 'var(--text-accent)',
                upIconDef: {
                    tag: 'svg',
                    props: { xmlns: 'http://www.w3.org/2000/svg', height: '24px', viewBox: '0 -960 960 960', width: '24px', fill: 'currentColor' },
                    children: [{ tag: 'path', props: { d: 'M480-528 296-344l-56-56 240-240 240 240-56 56-184-184Z' } }],
                },
                downIconDef: {
                    tag: 'svg',
                    props: { xmlns: 'http://www.w3.org/2000/svg', height: '24px', viewBox: '0 -960 960 960', width: '24px', fill: 'currentColor' },
                    children: [{ tag: 'path', props: { d: 'M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z' } }],
                },
                deleteIconDef: {
                    tag: 'svg',
                    props: { xmlns: 'http://www.w3.org/2000/svg', height: '24px', viewBox: '0 -960 960 960', width: '24px', fill: 'currentColor' },
                    children: [{ tag: 'path', props: { d: 'm256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z' } }],
                },
            },
            TEXT_LIST: {
                bg: 'var(--main-surface-primary)',
                text: 'var(--text-primary)',
                border: 'var(--border-light)',
                shadow: 'var(--drop-shadow-md, 0 3px 3px #0000001f)',
                separator_bg: 'var(--border-default)',
                tab_bg: 'var(--interactive-bg-tertiary-default)',
                tab_text: 'var(--text-primary)',
                tab_border: 'var(--border-light)',
                tab_hover_bg: 'var(--interactive-bg-secondary-hover)',
                tab_active_bg: 'var(--interactive-bg-secondary-hover)',
                tab_active_border: 'var(--border-default)',
                tab_active_outline: 'var(--border-default)',
                option_bg: 'var(--interactive-bg-tertiary-default)',
                option_text: 'var(--text-primary)',
                option_border: 'var(--border-default)',
                option_hover_bg: 'var(--interactive-bg-secondary-hover)',
                option_hover_border: 'var(--border-default)',
                option_hover_outline: 'var(--border-default)',
            },
        },
        gemini: {
            SETTINGS_BUTTON: {
                background: 'var(--gem-sys-color--surface-container-high)',
                borderColor: 'var(--gem-sys-color--outline)',
                backgroundHover: 'var(--gem-sys-color--surface-container-higher)',
                borderRadius: 'var(--radius-md, 4px)',
                iconDef: {
                    tag: 'svg',
                    props: { xmlns: 'http://www.w3.org/2000/svg', height: '24px', viewBox: '0 -960 960 960', width: '24px', fill: 'currentColor' },
                    children: [{ tag: 'path', props: { d: 'M270-80q-45 0-77.5-30.5T160-186v-558q0-38 23.5-68t61.5-38l395-78v640l-379 76q-9 2-15 9.5t-6 16.5q0 11 9 18.5t21 7.5h450v-640h80v720H270Zm90-233 200-39v-478l-200 39v478Zm-80 16v-478l-15 3q-11 2-18 9.5t-7 18.5v457q5-2 10.5-3.5T261-293l19-4Zm-40-472v482-482Z' } }],
                },
            },
            INSERT_BUTTON: {
                background: 'var(--gem-sys-color--surface-container-high)',
                borderColor: 'var(--gem-sys-color--outline)',
                backgroundHover: 'var(--gem-sys-color--surface-container-higher)',
                borderRadius: 'var(--radius-md, 4px)',
                iconDef: {
                    tag: 'svg',
                    props: { xmlns: 'http://www.w3.org/2000/svg', height: '24px', viewBox: '0 0 24 24', width: '24px', fill: 'currentColor' },
                    children: [
                        { tag: 'path', props: { d: 'M0 0h24v24H0V0z', fill: 'none' } },
                        { tag: 'path', props: { d: 'M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z' } },
                    ],
                },
            },
            SETTINGS_PANEL: {
                bg: 'var(--gem-sys-color--surface-container-highest)',
                text_primary: 'var(--gem-sys-color--on-surface)',
                text_secondary: 'var(--gem-sys-color--on-surface-variant)',
                border_medium: 'var(--gem-sys-color--outline)',
                border_default: 'var(--gem-sys-color--outline)',
                border_light: 'var(--gem-sys-color--outline)',
                accent_color: 'var(--gem-sys-color--primary)',
                input_bg: 'var(--gem-sys-color--surface-container-low)',
                input_text: 'var(--gem-sys-color--on-surface)',
                input_border: 'var(--gem-sys-color--outline)',
                toggle_bg_off: 'var(--gem-sys-color--surface-container)',
                toggle_bg_on: 'var(--gem-sys-color--primary)',
                toggle_knob: 'var(--gem-sys-color--on-primary-container)',
            },
            JSON_MODAL: {
                bg: 'var(--gem-sys-color--surface-container-highest)',
                text: 'var(--gem-sys-color--on-surface)',
                border: 'var(--gem-sys-color--outline)',
                btn_bg: 'var(--gem-sys-color--surface-container-high)',
                btn_hover_bg: 'var(--gem-sys-color--surface-container-higher)',
                btn_text: 'var(--gem-sys-color--on-surface-variant)',
                btn_border: 'var(--gem-sys-color--outline)',
                textarea_bg: 'var(--gem-sys-color--surface-container-low)',
                textarea_text: 'var(--gem-sys-color--on-surface)',
                textarea_border: 'var(--gem-sys-color--outline)',
                msg_error_text: 'var(--gem-sys-color--error)',
                msg_success_text: 'var(--gem-sys-color--primary)',
            },
            THEME_MODAL: {
                modal_bg: 'var(--gem-sys-color--surface-container-highest)',
                modal_text: 'var(--gem-sys-color--on-surface)',
                modal_border: 'var(--gem-sys-color--outline)',
                btn_bg: 'var(--gem-sys-color--surface-container-high)',
                btn_hover_bg: 'var(--gem-sys-color--surface-container-higher)',
                btn_text: 'var(--gem-sys-color--on-surface-variant)',
                btn_border: 'var(--gem-sys-color--outline)',
                error_text: 'var(--gem-sys-color--error)',
                delete_confirm_label_text: 'var(--gem-sys-color--error)',
                delete_confirm_btn_text: 'var(--gem-sys-color--on-error-container)',
                delete_confirm_btn_bg: 'var(--gem-sys-color--error-container)',
                delete_confirm_btn_hover_text: 'var(--gem-sys-color--on-error-container)',
                delete_confirm_btn_hover_bg: 'var(--gem-sys-color--error-container)',
                fieldset_border: 'var(--gem-sys-color--outline)',
                legend_text: 'var(--gem-sys-color--on-surface-variant)',
                label_text: 'var(--gem-sys-color--on-surface-variant)',
                input_bg: 'var(--gem-sys-color--surface-container-low)',
                input_text: 'var(--gem-sys-color--on-surface)',
                input_border: 'var(--gem-sys-color--outline)',
                slider_display_text: 'var(--gem-sys-color--on-surface-variant)',
                popup_bg: 'var(--gem-sys-color--surface-container-highest)',
                popup_border: 'var(--gem-sys-color--outline)',
                dnd_indicator_color: 'var(--gem-sys-color--primary)',
                upIconDef: {
                    tag: 'svg',
                    props: { xmlns: 'http://www.w3.org/2000/svg', height: '24px', viewBox: '0 -960 960 960', width: '24px', fill: 'currentColor' },
                    children: [{ tag: 'path', props: { d: 'M480-528 296-344l-56-56 240-240 240 240-56 56-184-184Z' } }],
                },
                downIconDef: {
                    tag: 'svg',
                    props: { xmlns: 'http://www.w3.org/2000/svg', height: '24px', viewBox: '0 -960 960 960', width: '24px', fill: 'currentColor' },
                    children: [{ tag: 'path', props: { d: 'M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z' } }],
                },
                deleteIconDef: {
                    tag: 'svg',
                    props: { xmlns: 'http://www.w3.org/2000/svg', height: '24px', viewBox: '0 -960 960 960', width: '24px', fill: 'currentColor' },
                    children: [{ tag: 'path', props: { d: 'm256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z' } }],
                },
            },
            TEXT_LIST: {
                bg: 'var(--gem-sys-color--surface-container-high)',
                text: 'var(--gem-sys-color--on-surface)',
                border: 'var(--gem-sys-color--outline)',
                shadow: '0 4px 12px rgba(0,0,0,0.25)',
                separator_bg: 'var(--gem-sys-color--outline-variant)',
                tab_bg: 'var(--gem-sys-color--surface-container)',
                tab_text: 'var(--gem-sys-color--on-surface-variant)',
                tab_border: 'var(--gem-sys-color--outline)',
                tab_hover_bg: 'var(--gem-sys-color--surface-container-higher)',
                tab_active_bg: 'var(--gem-sys-color--surface-container-higher)',
                tab_active_border: 'var(--gem-sys-color--primary)',
                tab_active_outline: 'var(--gem-sys-color--primary)',
                option_bg: 'var(--gem-sys-color--surface-container)',
                option_text: 'var(--gem-sys-color--on-surface-variant)',
                option_border: 'var(--gem-sys-color--outline)',
                option_hover_bg: 'var(--gem-sys-color--surface-container-higher)',
                option_hover_border: 'var(--gem-sys-color--outline)',
                option_hover_outline: 'var(--gem-sys-color--primary)',
            },
        },
    };

    const DEFAULT_CONFIG = {
        options: {
            insert_before_newline: false,
            insert_after_newline: false,
            insertion_position: 'cursor',
            activeProfileName: 'Default',
        },
        texts: {
            Default: {
                Test: [
                    '[TEST MESSAGE] You can ignore this message.',
                    'Tell me something interesting.',
                    'Based on all of our previous conversations, generate an image of me as you imagine. Make it super-realistic. Please feel free to fill in any missing information with your own imagination. Do not ask follow-up questions; generate the image immediately.',
                ],
                Images: [
                    'For each generated image, include an "image number" (e.g., Image 1, Image 2, ...), a title, and an image description.\n\n',
                    'Refer to the body shape and illustration style in the attached images, and draw the same person. Pay special attention to maintaining character consistency.\n\n',
                ],
            },
        },
    };

    // =================================================================================
    // SECTION: Event-Driven Architecture
    // =================================================================================

    const EventBus = {
        events: {},

        subscribe(event, listener) {
            if (!this.events[event]) this.events[event] = [];
            if (!this.events[event].includes(listener)) this.events[event].push(listener);
            return () => this.unsubscribe(event, listener);
        },

        once(event, listener) {
            const unsubscribe = this.subscribe(event, (...args) => {
                unsubscribe();
                listener(...args);
            });
            return unsubscribe;
        },

        unsubscribe(event, listener) {
            if (!this.events[event]) return;
            this.events[event] = this.events[event].filter((l) => l !== listener);
            if (this.events[event].length === 0) delete this.events[event];
        },

        publish(event, ...args) {
            if (!this.events[event]) return;
            [...this.events[event]].forEach((listener) => {
                try {
                    listener(...args);
                } catch (e) {
                    Logger.error(`EventBus error in listener for event "${event}":`, e);
                }
            });
        },
    };

    // =================================================================================
    // SECTION: Utility Functions
    // =================================================================================

    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    const isObject = (item) => !!(item && typeof item === 'object' && !Array.isArray(item));

    function deepMerge(target, source) {
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                const sourceVal = source[key];
                if (isObject(sourceVal) && target.hasOwnProperty(key) && isObject(target[key])) {
                    deepMerge(target[key], sourceVal);
                } else if (typeof sourceVal !== 'undefined') {
                    target[key] = sourceVal;
                }
            }
        }
        return target;
    }

    function proposeUniqueName(baseName, existingNames) {
        const existingNamesLower = new Set(Array.from(existingNames).map((name) => name.toLowerCase()));

        if (!existingNamesLower.has(baseName.trim().toLowerCase())) return baseName;

        let proposedName = `${baseName} Copy`;
        if (!existingNamesLower.has(proposedName.trim().toLowerCase())) return proposedName;

        let counter = 2;
        while (true) {
            proposedName = `${baseName} Copy ${counter}`;
            if (!existingNamesLower.has(proposedName.trim().toLowerCase())) return proposedName;
            counter++;
        }
    }

    function h(tag, propsOrChildren, children) {
        const SVG_NS = 'http://www.w3.org/2000/svg';
        const match = tag.match(/^([a-z0-9-]+)(#[\w-]+)?((\.[\w-]+)*)$/i);
        if (!match) throw new Error(`Invalid tag syntax: ${tag}`);

        const [, tagName, id, classList] = match;
        const isSVG = ['svg', 'circle', 'rect', 'path', 'g', 'line', 'text', 'use', 'defs', 'clipPath'].includes(tagName);
        const el = isSVG ? document.createElementNS(SVG_NS, tagName) : document.createElement(tagName);

        if (id) el.id = id.slice(1);
        if (classList) el.className = classList.replace(/\./g, ' ').trim();

        let props = {};
        let childrenArray;
        if (propsOrChildren && Object.prototype.toString.call(propsOrChildren) === '[object Object]') {
            props = propsOrChildren;
            childrenArray = children;
        } else {
            childrenArray = propsOrChildren;
        }

        const directProperties = new Set(['value', 'checked', 'selected', 'readOnly', 'disabled', 'multiple', 'textContent']);
        const urlAttributes = new Set(['href', 'src', 'action', 'formaction']);
        const safeUrlRegex = /^\s*(?:(?:https?|mailto|tel|ftp|blob):|[^a-z0-9+.-]*[#/])/i;

        for (const [key, value] of Object.entries(props)) {
            if (key === 'ref' && typeof value === 'function') {
                value(el);
            } else if (urlAttributes.has(key)) {
                const url = String(value);
                if (safeUrlRegex.test(url)) {
                    el.setAttribute(key, url);
                } else {
                    el.setAttribute(key, '#');
                    Logger.warn(`Blocked potentially unsafe URL in attribute "${key}":`, url);
                }
            } else if (directProperties.has(key)) {
                el[key] = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else if (key === 'dataset' && typeof value === 'object') {
                for (const [dataKey, dataVal] of Object.entries(value)) {
                    el.dataset[dataKey] = dataVal;
                }
            } else if (key.startsWith('on') && typeof value === 'function') {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (key === 'className') {
                if (isSVG) {
                    el.setAttribute('class', value);
                } else {
                    el.className = value;
                }
            } else if (key.startsWith('aria-')) {
                el.setAttribute(key, value);
            } else if (value !== false && value != null) {
                el.setAttribute(key, value === true ? '' : value);
            }
        }

        const fragment = document.createDocumentFragment();
        function append(child) {
            if (child == null || child === false) return;
            if (typeof child === 'string' || typeof child === 'number') {
                fragment.appendChild(document.createTextNode(child));
            } else if (Array.isArray(child)) {
                child.forEach(append);
            } else if (child instanceof Node) {
                fragment.appendChild(child);
            }
        }
        append(childrenArray);
        el.appendChild(fragment);

        return el;
    }

    function createIconFromDef(def) {
        if (!def) return null;
        const children = def.children ? def.children.map((child) => createIconFromDef(child)) : [];
        return h(def.tag, def.props, children);
    }

    // =================================================================================
    // SECTION: Configuration Management
    // =================================================================================

    class ConfigManagerBase {
        constructor({ configKey, defaultConfig }) {
            if (!configKey || !defaultConfig) {
                throw new Error('configKey and defaultConfig must be provided.');
            }
            this.CONFIG_KEY = configKey;
            this.DEFAULT_CONFIG = defaultConfig;
            this.config = null;
        }

        async load() {
            const raw = await GM_getValue(this.CONFIG_KEY);
            let userConfig = null;
            if (raw) {
                try {
                    userConfig = JSON.parse(raw);
                } catch (e) {
                    Logger.error('Failed to parse configuration. Resetting to default settings.', e);
                    userConfig = null;
                }
            }

            const completeConfig = JSON.parse(JSON.stringify(this.DEFAULT_CONFIG));
            this.config = deepMerge(completeConfig, userConfig || {});

            this._validateAndSanitizeOptions();
        }

        async save(obj) {
            this.config = obj;
            await GM_setValue(this.CONFIG_KEY, JSON.stringify(obj));
        }

        get() {
            return this.config;
        }

        _validateAndSanitizeOptions() {}
    }

    class ConfigManager extends ConfigManagerBase {
        constructor() {
            super({
                configKey: CONSTANTS.CONFIG_KEY,
                defaultConfig: DEFAULT_CONFIG,
            });
        }

        async load() {
            const raw = await GM_getValue(this.CONFIG_KEY);
            let userConfig = null;
            if (raw) {
                try {
                    userConfig = JSON.parse(raw);
                } catch (e) {
                    Logger.error('Failed to parse configuration. Using default settings.', e);
                    userConfig = null;
                }
            }
            this.config = this._processAndSanitize(userConfig);
        }

        async save(obj) {
            const completeConfig = this._processAndSanitize(obj);
            const jsonString = JSON.stringify(completeConfig);
            const configSize = new Blob([jsonString]).size;

            if (configSize > CONSTANTS.CONFIG_SIZE_LIMIT_BYTES) {
                const sizeInMB = (configSize / 1024 / 1024).toFixed(2);
                const limitInMB = (CONSTANTS.CONFIG_SIZE_LIMIT_BYTES / 1024 / 1024).toFixed(1);
                const errorMsg = `Configuration size (${sizeInMB} MB) exceeds the ${limitInMB} MB limit.\nChanges are not saved.`;

                EventBus.publish(`${APPID}:configSizeExceeded`, { message: errorMsg });
                throw new Error(errorMsg);
            }

            this.config = completeConfig;
            await GM_setValue(this.CONFIG_KEY, jsonString);
            EventBus.publish(`${APPID}:configSaveSuccess`);
        }

        _processAndSanitize(userConfig) {
            const completeConfig = JSON.parse(JSON.stringify(this.DEFAULT_CONFIG));

            if (userConfig) {
                if (isObject(userConfig.texts)) {
                    completeConfig.texts = userConfig.texts;
                }
                if (isObject(userConfig.options)) {
                    completeConfig.options = { ...completeConfig.options, ...userConfig.options };
                }
            }

            const sanitizeTextsObject = (texts) => {
                if (!isObject(texts)) return {};
                for (const profileName in texts) {
                    const profile = texts[profileName];
                    if (!isObject(profile)) {
                        Logger.warn(`Sanitizing invalid profile entry: "${profileName}" was not an object.`);
                        delete texts[profileName];
                        continue;
                    }
                    if (Object.keys(profile).length === 0) {
                        Logger.warn(`Profile "${profileName}" has no categories. Adding a default category.`);
                        profile['New Category'] = [];
                    }
                    for (const categoryName in profile) {
                        const category = profile[categoryName];
                        if (!Array.isArray(category)) {
                            Logger.warn(`Sanitizing invalid category entry: "${categoryName}" in profile "${profileName}" was not an array.`);
                            delete profile[categoryName];
                            continue;
                        }
                        profile[categoryName] = category.map((text, i) => {
                            if (typeof text !== 'string') {
                                Logger.warn(`Sanitizing invalid text entry: Item at index ${i} in category "${categoryName}" was not a string.`);
                                return String(text);
                            }
                            return text;
                        });
                    }
                }
                return texts;
            };

            completeConfig.texts = sanitizeTextsObject(completeConfig.texts);

            if (!completeConfig.texts || Object.keys(completeConfig.texts).length === 0) {
                completeConfig.texts = JSON.parse(JSON.stringify(this.DEFAULT_CONFIG.texts));
                Logger.warn('Configuration resulted in no profiles. Restoring default texts to prevent errors.');
            }

            const profileKeys = Object.keys(completeConfig.texts);
            const activeProfileName = completeConfig.options.activeProfileName;
            if (!completeConfig.texts.hasOwnProperty(activeProfileName)) {
                Logger.log(`Active profile "${activeProfileName}" not found. Setting the first available profile as active.`);
                completeConfig.options.activeProfileName = profileKeys[0];
            }

            return completeConfig;
        }

        async decode(rawValue) {
            if (!rawValue) return null;
            try {
                const parsed = JSON.parse(rawValue);
                if (isObject(parsed)) return parsed;
                return null;
            } catch (e) {
                Logger.error(`Failed to parse raw value. Error: ${e.message}`);
                return null;
            }
        }
    }

    // Due to character limits, I need to continue in the next message with the remaining UI components and application logic.
    // The script will be completed with all remaining classes and initialization code.