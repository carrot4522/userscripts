// ==UserScript==
// @name                    Script Finder v2
// @namespace               Script Finder v2
// @version                 2
// @description             Script Finder allows you to find userscripts from Greasyfork on any website. Optimized version with enhanced performance, better error handling, and improved UI responsiveness.
// @author                  shiquda & People's Service Worker <toniaiwanowskiskr47@gmail.com>
// @namespace               https://github.com/shiquda/shiquda_UserScript
// @supportURL              https://github.com/shiquda/shiquda_UserScript/issues
// @match                   *://*/*
// @connect                 greasyfork.org
// @icon                    data:image/jpeg;base64,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
// @grant                   GM_xmlhttpRequest
// @grant                   GM_addStyle
// @license                 AGPL-3.0
// @downloadURL https://update.greasyfork.org/scripts/498904/Script%20Finder%20v2.user.js
// @updateURL https://update.greasyfork.org/scripts/498904/Script%20Finder%20v2.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // Application state management
    const STATE = {
        domainParts: window.location.hostname.split('.').slice(-2),
        domain: null,
        neverLoadedScripts: true,
        collapsed: true,
        loadedPages: 0,
        isLoading: false,
        requestCache: new Map()
    };

    STATE.domain = STATE.domainParts.join('.');

    // Constants
    const CONSTANTS = {
        ERROR_MESSAGE: "Failed to retrieve script information or there are no available scripts for this domain.",
        GREASYFORK_BASE: 'https://greasyfork.org',
        REQUEST_TIMEOUT: 10000,
        SEARCH_DEBOUNCE: 300,
        BUTTON_HOVER_DELAY: 500
    };

    // Fetch scripts with improved error handling and caching
    function getScriptsInfo(domain, page = 1) {
        if (STATE.isLoading) return;

        const cacheKey = `${domain}-${page}`;
        if (STATE.requestCache.has(cacheKey)) {
            handleCachedResponse(cacheKey);
            return;
        }

        STATE.isLoading = true;
        const url = `${CONSTANTS.GREASYFORK_BASE}/scripts/by-site/${domain}?filter_locale=0&page=${page}`;

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            timeout: CONSTANTS.REQUEST_TIMEOUT,
            onload: (response) => {
                STATE.isLoading = false;
                STATE.requestCache.set(cacheKey, response.responseText);
                handleScriptsResponse(response, domain);
            },
            onerror: () => {
                STATE.isLoading = false;
                console.error("Failed to fetch scripts from:", url);
                handleError();
            },
            ontimeout: () => {
                STATE.isLoading = false;
                console.error("Request timeout for:", url);
                handleError();
            }
        });
    }

    // Handle cached responses
    function handleCachedResponse(cacheKey) {
        const cachedData = STATE.requestCache.get(cacheKey);
        const mockResponse = { responseText: cachedData };
        handleScriptsResponse(mockResponse, STATE.domain);
    }

    // Process script response
    function handleScriptsResponse(response, domain) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.responseText, "text/html");
        const scripts = doc.querySelector("#browse-script-list")?.querySelectorAll('[data-script-id]');
        const loadMoreButton = document.querySelector('.load-more');
        const waitLoading = document.querySelector('.wait-loading');

        if (!scripts || scripts.length === 0) {
            appendScriptsInfo(CONSTANTS.ERROR_MESSAGE);
            updateButtonState(loadMoreButton, true, 'No scripts available');
        } else {
            const scriptsInfo = Array.from(scripts).map(parseScriptInfo);
            appendScriptsInfo(scriptsInfo);

            const nextPage = doc.querySelector('.next_page');
            const hasMorePages = nextPage && nextPage.getAttribute('aria-disabled') !== 'true';

            if (!hasMorePages) {
                STATE.loadedPages = 'max';
                updateButtonState(loadMoreButton, true, 'All scripts loaded');
            } else {
                updateButtonState(loadMoreButton, false, 'Load more');
            }
        }

        if (waitLoading) waitLoading.style.display = 'none';
        if (loadMoreButton) loadMoreButton.style.display = 'block';
        updateMatches();

        if (typeof STATE.loadedPages === 'number') {
            STATE.loadedPages += 1;
        }
    }

    // Update button state helper
    function updateButtonState(button, disabled, text) {
        if (!button) return;
        button.disabled = disabled;
        button.textContent = text;
    }

    // Error handling
    function handleError() {
        const waitLoading = document.querySelector('.wait-loading');
        const loadMoreButton = document.querySelector('.load-more');

        if (waitLoading) waitLoading.style.display = 'none';
        updateButtonState(loadMoreButton, true, 'Error loading scripts');

        if (STATE.loadedPages === 0) {
            appendScriptsInfo(CONSTANTS.ERROR_MESSAGE);
        }
    }

    // Parse script information from DOM element
    function parseScriptInfo(script) {
        return {
            id: script.getAttribute('data-script-id'),
            name: script.getAttribute('data-script-name') || 'Unknown',
            author: script.querySelector("dd.script-list-author")?.textContent?.trim() || 'Unknown',
            description: script.querySelector(".script-description")?.textContent?.trim() || 'No description',
            version: script.getAttribute('data-script-version') || '1.0',
            url: `${CONSTANTS.GREASYFORK_BASE}/scripts/${script.getAttribute('data-script-id')}`,
            createDate: script.getAttribute('data-script-created-date') || 'N/A',
            updateDate: script.getAttribute('data-script-updated-date') || 'N/A',
            installs: script.getAttribute('data-script-total-installs') || '0',
            dailyInstalls: script.getAttribute('data-script-daily-installs') || '0',
            ratingScore: script.getAttribute('data-script-rating-score') || 'N/A'
        };
    }

    // Append scripts to UI
    function appendScriptsInfo(scriptsInfo) {
        const infoList = document.querySelector('.info-list');
        if (!infoList) return;

        if (scriptsInfo === CONSTANTS.ERROR_MESSAGE) {
            updateButtonState(document.querySelector('.load-more'), true, scriptsInfo);
            return;
        }

        const fragment = document.createDocumentFragment();
        scriptsInfo.forEach(script => {
            fragment.appendChild(createScriptElement(script));
        });

        infoList.appendChild(fragment);
    }

    // Create script DOM element
    function createScriptElement(script) {
        const listItem = document.createElement('li');
        listItem.className = 'info-item';
        listItem.setAttribute('data-script-id', script.id);

        const scriptContainer = document.createElement('div');
        scriptContainer.className = 'script-container';

        const nameElement = document.createElement('a');
        nameElement.className = 'mscript-link';
        nameElement.textContent = script.name;
        nameElement.href = script.url;
        nameElement.target = '_blank';
        nameElement.rel = 'noopener noreferrer';

        const descriptionElement = document.createElement('p');
        descriptionElement.className = 'script-description';
        descriptionElement.textContent = script.description;

        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'details-container';

        const details = [
            { key: 'Author', value: script.author },
            { key: 'Installs', value: script.installs },
            { key: 'Daily', value: script.dailyInstalls },
            { key: 'Created', value: script.createDate },
            { key: 'Updated', value: script.updateDate },
            { key: 'Rating', value: script.ratingScore }
        ];

        details.forEach(detail => {
            const spanElement = document.createElement('span');
            spanElement.className = 'script-details';
            spanElement.textContent = `${detail.key}: ${detail.value}`;
            detailsContainer.appendChild(spanElement);
        });

        const installButton = document.createElement('a');
        installButton.className = 'install-button';
        installButton.textContent = `Install ${script.version}`;
        installButton.href = `${CONSTANTS.GREASYFORK_BASE}/scripts/${script.id}/code/script.user.js`;
        installButton.rel = 'noopener noreferrer';

        scriptContainer.appendChild(nameElement);
        scriptContainer.appendChild(descriptionElement);
        scriptContainer.appendChild(detailsContainer);
        scriptContainer.appendChild(installButton);
        listItem.appendChild(scriptContainer);

        return listItem;
    }

    // Setup UI and styles
    function setupUI() {
        GM_addStyle(`
    button.script-button {
        position: fixed;
        bottom: 20%;
        right: -50px;
        transform: translateY(50%);
        padding: 20px;
        font-size: 16px;
        border: none;
        border-radius: 4px;
        background-color: #1e90ff;
        color: #ffffff;
        cursor: pointer;
        transition: right 0.3s ease;
        z-index: 9999999999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    button.script-button:hover {
        background-color: #1c7ed6;
    }
    div.info-container {
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 650px;
        padding: 12px;
        background-color: #ffffff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: 9999;
        max-height: 80vh;
        overflow-y: auto;
    }
    ul.info-list {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    li.info-item {
        margin-bottom: 15px;
        padding: 12px;
        padding-bottom: 22px;
        display: flex;
        flex-direction: column;
        border: 1px solid #1e90ff;
        border-radius: 5px;
        transition: transform 0.2s ease;
    }
    li.info-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(30, 144, 255, 0.3);
    }
    div.script-container {
        display: flex;
        flex-direction: column;
    }
    a.mscript-link {
        font-size: 18px !important;
        font-weight: bold !important;
        margin-bottom: 5px !important;
        color: #1e90ff !important;
        text-decoration: none !important;
    }
    a.mscript-link:hover {
        text-decoration: underline !important;
    }
    p.script-description {
        color: black !important;
        margin-top: 2px;
        margin-bottom: 5px;
        font-size: 16px;
        line-height: 1.4;
    }
    div.details-container {
        font-size: 13px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        margin-bottom: 15px;
        flex-wrap: wrap;
    }
    span.script-details {
        color: black !important;
        flex-grow: 1 !important;
        text-align: center !important;
        border: 1px solid #1e90ff !important;
        border-radius: 5px !important;
        margin: 4px !important;
        padding: 4px !important;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    div.table-header {
        color: #1e90ff !important;
        font-size: 25px;
        font-weight: bold;
        margin-bottom: 10px;
    }
    input.script-search-input {
        width: 96% !important;
        padding: 10px !important;
        font-size: 18px !important;
        border: 1px solid #1e90ff !important;
        border-radius: 4px !important;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3) !important;
        margin-bottom: 15px !important;
        margin-top: 20px !important;
    }
    a.install-button {
        font-size: 20px;
        background-color: green;
        color: white !important;
        padding: 12px;
        text-align: center;
        text-decoration: none;
        border-radius: 4px;
        transition: background-color 0.2s ease;
    }
    a.install-button:hover {
        background-color: #008000;
    }
    button.to-greasyfork {
        position: absolute;
        top: 12px;
        right: 12px;
        border-radius: 4px;
        padding: 8px;
        font-size: