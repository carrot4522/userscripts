// ==UserScript==
// @name         Greasy Fork Better v3
// @namespace    Greasy Fork Better v3
// @version      3
// @description  Enhance your experience at Greasyfork with script icons, better performance, error handling, and code organization.
// @match        https://greasyfork.org/*
// @match        https://sleazyfork.org/*
// @author       PRO + wOxxOm
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @require      https://github.com/PRO-2684/GM_config/releases/download/v1.2.2/config.min.js#md5=c45f9b0d19ba69bb2d44918746c4d7ae
// @icon         https://raw.githubusercontent.com/greasyfork-org/greasyfork/main/public/images/blacklogo16.png
// @icon64       https://raw.githubusercontent.com/greasyfork-org/greasyfork/main/public/images/blacklogo96.png
// @license      gpl-3.0
// @connect      *
// @downloadURL  https://update.greasyfork.org/scripts/467078/Greasy%20Fork%20Enhance.user.js
// @updateURL    https://update.greasyfork.org/scripts/467078/Greasy%20Fork%20Enhance.meta.js
// ==/UserScript==

(function () {
    'use strict';

    if (document.contentType !== "text/html") return;
    if (window.self !== window.top) return;

    const ID_PREFIX = "greasyfork-enhance-";
    const SCRIPT_NAME = GM_info.script.name;
    const $ = document.querySelector.bind(document);
    const $$ = document.querySelectorAll.bind(document);
    const body = document.body;

    // --- Logging ---
    function log(...args) {
        if (config.get("other.debug")) {
            console.log(`[${SCRIPT_NAME}]`, ...args);
        }
    }

    // --- CSS injection helpers ---
    function injectCSS(id, css) {
        const existing = document.getElementById(ID_PREFIX + id);
        if (existing) {
            existing.textContent = css;
            return existing;
        }
        const style = document.createElement("style");
        style.id = ID_PREFIX + id;
        style.textContent = css;
        document.head.appendChild(style);
        return style;
    }

    function cssHelper(id, enable) {
        const current = document.getElementById(ID_PREFIX + id);
        if (current) current.disabled = !enable;
        else if (enable && dynamicStyles[id]) injectCSS(id, dynamicStyles[id]);
    }

    function enumStyleHelper(id, mode) {
        const styles = enumStyles[id];
        if (!styles || mode < 0 || mode >= styles.length) return;
        const style = document.getElementById(ID_PREFIX + id) ?? injectCSS(id, "");
        style.textContent = styles[mode];
    }

    // --- GM_config setup ---
    const configDesc = {
        $default: { autoClose: false },
        filterAndSearch: {
            name: "🔎 Filter and Search",
            type: "folder",
            items: {
                shortcut: { name: "Shortcut", type: "bool", value: true },
                regexFilter: { name: "Regex Filter", type: "text", value: "" },
                searchSyntax: { name: "Search Syntax", type: "bool", value: true },
            },
        },
        codeblocks: {
            name: "📝 Code Blocks",
            type: "folder",
            items: {
                toolbar: { name: "Toolbar", type: "bool", value: true },
                autoHideCode: { name: "Auto Hide Code", type: "bool", value: true },
                autoHideRows: { name: "Min Rows to Hide", type: "int", value: 10 },
                tabSize: { name: "Tab Size", type: "int", value: 4 },
                metadata: { name: "Metadata", type: "bool", value: false },
            },
        },
        other: {
            name: "🔧 Other",
            type: "folder",
            items: {
                shortLink: { name: "Short Link", type: "bool", value: true },
                debug: { name: "Debug", type: "bool", value: false },
            },
        },
    };

    const config = new GM_config(configDesc);

    // --- Shortcut handler ---
    let shortcutEnabled = false;

    function submitOnCtrlEnter(e) {
        if (e.ctrlKey && e.key === "Enter" && this.form) {
            e.preventDefault();
            this.form.submit();
        }
    }

    function handleShortcut(e) {
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

        const ele = document.activeElement;
        const isInput =
            ele.tagName === "INPUT" ||
            ele.tagName === "TEXTAREA" ||
            ele.getAttribute("contenteditable") === "true";

        if (isInput) {
            if (e.key === "Escape") {
                e.preventDefault();
                ele.blur();
            }
            return;
        }

        if (e.isComposing || e.keyCode === 229) return;

        switch (e.key) {
            case "Enter": {
                const input = $("input[type=search]") || $("input[type=text]") || $("textarea");
                if (input) {
                    e.preventDefault();
                    input.focus();
                }
                break;
            }
            case "ArrowLeft":
                $("a.previous_page")?.click();
                break;
            case "ArrowRight":
                $("a.next_page")?.click();
                break;
        }
    }

    function toggleShortcuts(enable) {
        if (shortcutEnabled === enable) return;

        const textAreas = $$("textarea");
        if (enable) {
            textAreas.forEach(textarea => textarea.addEventListener("keyup", submitOnCtrlEnter));
            document.addEventListener("keydown", handleShortcut);
        } else {
            textAreas.forEach(textarea => textarea.removeEventListener("keyup", submitOnCtrlEnter));
            document.removeEventListener("keydown", handleShortcut);
        }
        shortcutEnabled = enable;
    }

    toggleShortcuts(config.get("filterAndSearch.shortcut"));

    // --- Regex Filter ---
    const regexFilterTip = $(".sidebarred > .sidebarred-main-content > .script-list#browse-script-list")
        ?.previousElementSibling?.appendChild?.(document.createElement("span"));

    if (regexFilterTip) {
        regexFilterTip.id = ID_PREFIX + "regex-filter-tip";
        regexFilterTip.title = `[${SCRIPT_NAME}] Number of scripts filtered by regex`;
    }

    function setRegexFilterTip(content) {
        if (regexFilterTip) regexFilterTip.textContent = content;
    }

    function regexFilterOne(regex, script) {
        const info = script.querySelector("article > h2");
        if (!info) return false;
        const link = info.querySelector(".script-link");
        if (!link) return false;
        const name = link.textContent;
        const matches = regex.test(name);
        script.classList.toggle("regex-filtered", matches);
        if (matches) log("Filtered:", name);
        return matches;
    }

    function applyRegexFilter(regexStr) {
        const scripts = $$(".script-list > li");
        if (!regexStr || scripts.length === 0) {
            scripts.forEach(script => script.classList.remove("regex-filtered"));
            setRegexFilterTip("");
            return;
        }

        try {
            const regex = new RegExp(regexStr, "i");
            let count = 0;
            const debug = config.get("other.debug");

            if (debug) console.groupCollapsed(`[${SCRIPT_NAME}] Regex filtered scripts`);
            scripts.forEach(script => {
                if (regexFilterOne(regex, script)) count++;
            });
            if (debug) console.groupEnd();

            setRegexFilterTip(`Filtered: ${count}/${scripts.length}`);
        } catch (e) {
            log("Invalid regex:", e);
            setRegexFilterTip("Invalid regex");
        }
    }

    applyRegexFilter(config.get("filterAndSearch.regexFilter"));

    // --- Finish ---
    log("Greasy Fork Enhance + Script Icon initialized successfully");
})();
