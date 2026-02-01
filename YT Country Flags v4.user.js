// ==UserScript==
// @name         YT Country Flags v4
// @description  Reveal Country Flag with optimized performance and enhanced features
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciICB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgd2lkdGg9IjEwMHB4IiBoZWlnaHQ9IjEwMHB4IiBiYXNlUHJvZmlsZT0iYmFzaWMiPjxwYXRoIGZpbGw9IiNkZTMzM2IiIGQ9Ik04OS40MzcsMzkuMjNjLTAuODQxLTAuNzk0LTIuMTEzLTAuOTk2LTMuMjUzLTEuMzAzYy02LjMyNi0xLjcwNC0xMC42NTQtOC44MS05LjI2Ni0xNS4yMTMJYzAuMjYzLTEuMjEyLDAuNjk5LTIuNDgxLDAuMzA1LTMuNjU3Yy0wLjI2OS0wLjgwMi0wLjg5LTEuNDMxLTEuNTE4LTEuOTk4Yy0yLjMwMi0yLjA4LTQuOTY5LTMuNzU2LTcuODQyLTQuOTI3CWMtMS4wMDQtMC40MDktMi4wNzEtMC43NjMtMy4xNTItMC42NzFjLTIuMTgsMC4xODUtMy43NjEsMi4wNTQtNS41MywzLjM0MmMtMy4xNjUsMi4zMDUtNy41MzksMi44MzYtMTEuMTY0LDEuMzU1CWMtMi43ODUtMS4xMzgtNS4wODktMy4zNDUtNy45OTItNC4xMzVjLTUuOTctMS42MjQtMTIuMDI5LDMuNTYzLTEyLjUyOCw5LjM3MWMtMC4yMjgsMi42NTUsMC4xMDgsNS4zNjgtMC40ODksNy45NjUJYy0wLjkxOCwzLjk5Ni00LjE4LDcuMzYyLTguMTQ1LDguNDA1Yy0xLjMwOSwwLjM0NC0yLjc2NSwwLjQ5Ni0zLjc0OCwxLjQyN2MtMC45NDQsMC44OTQtMS4yLDIuMjgxLTEuMzUyLDMuNTczCWMtMC4zNjQsMy4xMDktMC40MTMsNi4yNTYtMC4xNDUsOS4zNzVjMC4wNjYsMC43NzIsMC4xNjIsMS41NzMsMC41NzUsMi4yMjhjMC44ODYsMS40MDcsMi43OTYsMS42MTYsNC40MDgsMi4wMjIJYzYuMjQ4LDEuNTcyLDEwLjQzNyw4Ljc5Myw4LjcwMSwxNC45OTdjLTAuNDUsMS42MDctMS4yNCwzLjI0NC0wLjg1Miw0Ljg2N2MwLjM1NiwxLjQ4OSwxLjYyMywyLjU2NiwyLjg3NywzLjQ0NAljMi4xMzMsMS40OTQsNC40NDUsMi43MzQsNi44NjksMy42ODVjNC44MTMsMS44ODksNy4zNDEtMy43MzQsMTEuMzA3LTUuMTk4YzMuNDU1LTEuMjc1LDcuNTE3LTEuMDM2LDEwLjcyNiwwLjgwOQljNC4wMTMsMi4zMDcsNS42Nyw3LjA2LDEwLjk1OSw0Ljg2MmMzLjA2MS0xLjI3Miw4Ljg4Ny01LjE3NSw4LjQzLTkuMTI0Yy0wLjUzMi00LjU5LTEuNTU3LTcuODUxLDAuODYyLTEyLjIxMgljMS44NDctMy4zMyw1LTYuMDA2LDguNzYyLTYuODRjMC45ODQtMC4yMTgsMi4wNDQtMC4zNSwyLjgyMy0wLjk4OWMxLjA0OC0wLjg2MSwxLjI2My0yLjM2MiwxLjMyMi0zLjcxNwljMC4xNC0zLjE4LTAuMTU5LTYuMzgtMC44ODUtOS40NzljLTAuMTctMC43MjYtMC4zNzctMS40NzQtMC44NTgtMi4wNDNDODkuNTgsMzkuMzcyLDg5LjUxLDM5LjI5OSw4OS40MzcsMzkuMjN6Ii8+PC9zdmc+
// @version      3
// @author       exyezed
// @namespace    https://github.com/exyezed/youtube-enhancer/
// @supportURL   https://github.com/exyezed/youtube-enhancer/issues
// @license      MIT
// @match        https://youtube.com/*
// @match        https://www.youtube.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @downloadURL https://update.greasyfork.org/scripts/515505/YouTube%20Enhancer%20v3.user.js
// @updateURL https://update.greasyfork.org/scripts/515505/YouTube%20Enhancer%20v3.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // ========================================
    // CONFIGURATION
    // ========================================

    const CONFIG = {
        FLAG: {
            BASE_URL: 'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/flags/4x3/',
            SIZES: {
                channel: '28px',
                video: '22px',
                shorts: '20px'
            },
            MARGINS: {
                channel: '12px',
                video: '10px',
                shorts: '8px'
            }
        },
        CACHE: {
            PREFIX: 'yt_enhancer_v3_',
            EXPIRATION: 7 * 24 * 60 * 60 * 1000, // 7 days
            MAX_ENTRIES: 500
        },
        API: {
            BASE_URL: 'https://channel-info.pages.dev/api/flag',
            TIMEOUT: 10000
        },
        WAIT: {
            TIMEOUT: 8000,
            INTERVAL: 150
        },
        DEBOUNCE_DELAY: 500
    };

    // ========================================
    // STATE MANAGEMENT
    // ========================================

    const state = {
        processedElements: new WeakSet(),
        channelAgeElement: null,
        observer: null,
        pendingRequests: new Map()
    };

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    const Utils = {
        getCacheKey(type, id) {
            return `${CONFIG.CACHE.PREFIX}${type}_${id}`;
        },

        getFromCache(type, id) {
            try {
                const cacheKey = this.getCacheKey(type, id);
                const cachedData = GM_getValue(cacheKey);

                if (!cachedData) return null;

                const parsed = JSON.parse(cachedData);
                const { value, timestamp } = parsed;

                // Check expiration
                if (Date.now() - timestamp > CONFIG.CACHE.EXPIRATION) {
                    GM_setValue(cacheKey, null);
                    return null;
                }

                // Recalculate channel age if creation date exists
                if (value?.creationDate) {
                    value.channelAge = ChannelAge.calculate(value.creationDate);
                }

                return value;
            } catch (error) {
                console.error('[YouTube Enhancer] Cache read error:', error);
                return null;
            }
        },

        setToCache(type, id, value) {
            try {
                const cacheKey = this.getCacheKey(type, id);
                const cacheData = {
                    value,
                    timestamp: Date.now()
                };
                GM_setValue(cacheKey, JSON.stringify(cacheData));

                // Cleanup old cache entries periodically
                this.cleanupCache();
            } catch (error) {
                console.error('[YouTube Enhancer] Cache write error:', error);
            }
        },

        cleanupCache() {
            try {
                const allKeys = GM_getValue('cacheKeys', '[]');
                const keys = JSON.parse(allKeys);

                if (keys.length > CONFIG.CACHE.MAX_ENTRIES) {
                    const sortedKeys = keys.sort((a, b) => {
                        const dataA = GM_getValue(a);
                        const dataB = GM_getValue(b);
                        if (!dataA || !dataB) return 0;
                        return JSON.parse(dataA).timestamp - JSON.parse(dataB).timestamp;
                    });

                    const toDelete = sortedKeys.slice(0, keys.length - CONFIG.CACHE.MAX_ENTRIES);
                    toDelete.forEach(key => GM_setValue(key, null));
                }
            } catch (error) {
                console.error('[YouTube Enhancer] Cache cleanup error:', error);
            }
        },

        waitFor(checkFn, options = {}) {
            const timeout = options.timeout || CONFIG.WAIT.TIMEOUT;
            const interval = options.interval || CONFIG.WAIT.INTERVAL;

            return new Promise(resolve => {
                const startTime = performance.now();

                const check = () => {
                    try {
                        if (checkFn()) {
                            return resolve(true);
                        }
                    } catch (error) {
                        console.error('[YouTube Enhancer] Wait check error:', error);
                    }

                    if (performance.now() - startTime >= timeout) {
                        return resolve(false);
                    }

                    setTimeout(check, interval);
                };

                check();
            });
        },

        debounce(func, delay = CONFIG.DEBOUNCE_DELAY) {
            let timeoutId;
            return function (...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        }
    };

    // ========================================
    // API FUNCTIONS
    // ========================================

    const API = {
        async fetchCountryData(type, id) {
            // Check cache first
            const cachedData = Utils.getFromCache(type, id);
            if (cachedData) {
                return cachedData;
            }

            // Check if request is already pending
            const requestKey = `${type}_${id}`;
            if (state.pendingRequests.has(requestKey)) {
                return state.pendingRequests.get(requestKey);
            }

            // Create new request
            const requestPromise = new Promise((resolve) => {
                const url = `${CONFIG.API.BASE_URL}/${type}/${id}`;

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: CONFIG.API.TIMEOUT,
                    onload: (response) => {
                        state.pendingRequests.delete(requestKey);

                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const result = JSON.parse(response.responseText);
                                const data = result.data || result;

                                const countryData = {
                                    code: (data.country || '').toLowerCase(),
                                    name: data.countryName || '',
                                    creationDate: data.creationDate || '',
                                    channelAge: data.creationDate
                                        ? ChannelAge.calculate(data.creationDate)
                                        : (data.channelAge || '')
                                };

                                Utils.setToCache(type, id, countryData);
                                resolve(countryData);
                            } catch (error) {
                                console.error('[YouTube Enhancer] JSON parse error:', error);
                                resolve(null);
                            }
                        } else {
                            console.warn('[YouTube Enhancer] API request failed:', response.status);
                            resolve(null);
                        }
                    },
                    onerror: (error) => {
                        state.pendingRequests.delete(requestKey);
                        console.error('[YouTube Enhancer] API request error:', error);
                        resolve(null);
                    },
                    ontimeout: () => {
                        state.pendingRequests.delete(requestKey);
                        console.warn('[YouTube Enhancer] API request timeout');
                        resolve(null);
                    }
                });
            });

            state.pendingRequests.set(requestKey, requestPromise);
            return requestPromise;
        }
    };

    // ========================================
    // CHANNEL AGE CALCULATOR
    // ========================================

    const ChannelAge = {
        calculate(creationDateStr) {
            try {
                const creationDate = new Date(creationDateStr);
                const now = new Date();

                if (isNaN(creationDate.getTime())) {
                    return '';
                }

                let current = new Date(creationDate);
                let years = 0, months = 0, days = 0, hours = 0, minutes = 0;

                const addTime = (date, unit, value) => {
                    const result = new Date(date);
                    switch (unit) {
                        case 'years':
                            result.setFullYear(result.getFullYear() + value);
                            break;
                        case 'months':
                            result.setMonth(result.getMonth() + value);
                            break;
                        case 'days':
                            result.setDate(result.getDate() + value);
                            break;
                        case 'hours':
                            result.setHours(result.getHours() + value);
                            break;
                        case 'minutes':
                            result.setMinutes(result.getMinutes() + value);
                            break;
                    }
                    return result;
                };

                while (addTime(current, 'years', 1) <= now) {
                    current = addTime(current, 'years', 1);
                    years++;
                }
                while (addTime(current, 'months', 1) <= now) {
                    current = addTime(current, 'months', 1);
                    months++;
                }
                while (addTime(current, 'days', 1) <= now) {
                    current = addTime(current, 'days', 1);
                    days++;
                }
                while (addTime(current, 'hours', 1) <= now) {
                    current = addTime(current, 'hours', 1);
                    hours++;
                }
                while (addTime(current, 'minutes', 1) <= now) {
                    current = addTime(current, 'minutes', 1);
                    minutes++;
                }

                let ageString = '';

                if (years > 0) {
                    ageString = `${years}y`;
                    if (months > 0) ageString += ` ${months}m`;
                } else if (months > 0) {
                    ageString = `${months}m`;
                    if (days > 0) ageString += ` ${days}d`;
                } else if (days > 0) {
                    ageString = `${days}d`;
                    if (hours > 0) ageString += ` ${hours}h`;
                } else if (hours > 0) {
                    ageString = `${hours}h`;
                    if (minutes > 0) ageString += ` ${minutes}m`;
                } else if (minutes > 0) {
                    ageString = `${minutes}m`;
                } else {
                    ageString = '<1m';
                }

                return ageString + ' ago';
            } catch (error) {
                console.error('[YouTube Enhancer] Age calculation error:', error);
                return '';
            }
        }
    };

    // ========================================
    // DOM MANIPULATION
    // ========================================

    const DOM = {
        createFlag(size, margin, className, countryData) {
            const flag = document.createElement('img');
            flag.src = `${CONFIG.FLAG.BASE_URL}${countryData.code}.svg`;
            flag.className = `country-flag ${className}`;
            flag.alt = countryData.name || 'Country Flag';
            flag.title = countryData.name || '';

            Object.assign(flag.style, {
                width: size,
                height: 'auto',
                marginLeft: margin,
                verticalAlign: 'middle',
                cursor: 'pointer',
                display: 'inline-block'
            });

            return flag;
        },

        removeExistingFlags(element) {
            if (!element) return;
            element.querySelectorAll('.country-flag').forEach(flag => flag.remove());
        },

        removeExistingChannelAge() {
            document.querySelectorAll('.channel-age-element').forEach(el => el.remove());
            document.querySelectorAll('.channel-age-delimiter').forEach(el => el.remove());
            state.channelAgeElement = null;
        },

        findMetadataRows() {
            let rows = document.querySelectorAll('.yt-content-metadata-view-model__metadata-row');
            if (rows && rows.length) return rows;

            rows = document.querySelectorAll('.yt-content-metadata-view-model-wiz__metadata-row');
            return rows || [];
        },

        getPreferredMetadataRow(rows) {
            if (!rows || !rows.length) return null;

            // Prefer row with video link
            for (const row of rows) {
                if (row.querySelector('a[href*="/videos"]')) {
                    return row;
                }
            }

            // Fallback to row containing "video" text
            const byText = Array.from(rows).find(row =>
                (row.textContent || '').toLowerCase().includes('video')
            );

            return byText || rows[0];
        },

        async waitForMetadataRow() {
            const success = await Utils.waitFor(() => {
                const rows = this.findMetadataRows();
                if (!rows.length) return false;

                const targetRow = this.getPreferredMetadataRow(rows);
                if (!targetRow) return false;

                // Ensure row has original content
                const hasOriginalContent = Array.from(targetRow.children).some(child =>
                    !child.classList?.contains('channel-age-element') &&
                    !child.classList?.contains('channel-age-delimiter')
                );

                return hasOriginalContent;
            });

            if (!success) return null;

            const rows = this.findMetadataRows();
            return this.getPreferredMetadataRow(rows);
        },

        async ensureChannelAgePlaceholder() {
            const targetRow = await this.waitForMetadataRow();
            if (!targetRow) return null;

            // Remove duplicate age elements
            const allAgeElements = document.querySelectorAll('.channel-age-element');
            if (allAgeElements.length > 1) {
                Array.from(allAgeElements).slice(0, -1).forEach(el => el.remove());
            }

            let ageElement = targetRow.querySelector('.channel-age-element');

            if (!ageElement) {
                const isNewLayout = targetRow.classList.contains('yt-content-metadata-view-model__metadata-row');

                const baseClass = isNewLayout
                    ? 'yt-content-metadata-view-model'
                    : 'yt-content-metadata-view-model-wiz';

                // Create delimiter
                const delimiter = document.createElement('span');
                delimiter.className = `${baseClass}__delimiter channel-age-delimiter`;
                delimiter.setAttribute('aria-hidden', 'true');
                delimiter.textContent = '•';

                // Create age element
                ageElement = document.createElement('span');
                ageElement.className = `yt-core-attributed-string ${baseClass}__metadata-text yt-core-attributed-string--white-space-pre-wrap yt-core-attributed-string--link-inherit-color channel-age-element`;
                ageElement.setAttribute('dir', 'auto');
                ageElement.setAttribute('role', 'text');

                const innerSpan = document.createElement('span');
                innerSpan.setAttribute('dir', 'auto');
                innerSpan.textContent = ' Calculating...';

                ageElement.appendChild(innerSpan);
                targetRow.appendChild(delimiter);
                targetRow.appendChild(ageElement);
            }

            state.channelAgeElement = ageElement;
            return ageElement;
        },

        setChannelAgeText(text) {
            const element = state.channelAgeElement ||
                           document.querySelector('.channel-age-element');

            if (!element) return;

            const innerSpan = element.querySelector('span[dir="auto"]') || element;
            innerSpan.textContent = ' ' + (text?.trim() || '—');
        },

        async addChannelAge(countryData) {
            if (!state.channelAgeElement) {
                await this.ensureChannelAgePlaceholder();
            }

            const ageText = countryData?.channelAge || '—';
            this.setChannelAgeText(ageText);
        }
    };

    // ========================================
    // MAIN FLAG HANDLER
    // ========================================

    const FlagHandler = {
        async processChannelPage() {
            const channelElement = document.querySelector('h1.dynamicTextViewModelH1 > span.yt-core-attributed-string') ||
                                  document.querySelector('#channel-name #text') ||
                                  document.querySelector('yt-formatted-string.style-scope.ytd-channel-name');

            if (!channelElement || state.processedElements.has(channelElement)) {
                return;
            }

            DOM.removeExistingFlags(channelElement.parentElement || channelElement);
            state.processedElements.add(channelElement);

            const channelId = this.extractChannelId();
            if (!channelId) return;

            await DOM.ensureChannelAgePlaceholder();

            const countryData = await API.fetchCountryData('channel', channelId);

            if (countryData?.code) {
                const flag = DOM.createFlag(
                    CONFIG.FLAG.SIZES.channel,
                    CONFIG.FLAG.MARGINS.channel,
                    'channel-flag',
                    countryData
                );
                channelElement.appendChild(flag);
            }

            await DOM.addChannelAge(countryData);
        },

        async processVideoPage() {
            const videoElement = document.querySelector('#title yt-formatted-string');

            if (!videoElement || state.processedElements.has(videoElement)) {
                return;
            }

            const videoParent = videoElement.closest('#title h1');
            if (!videoParent) return;

            DOM.removeExistingFlags(videoParent);
            state.processedElements.add(videoElement);

            const videoId = new URLSearchParams(window.location.search).get('v');
            if (!videoId) return;

            const countryData = await API.fetchCountryData('video', videoId);

            if (countryData?.code) {
                Object.assign(videoParent.style, {
                    display: 'flex',
                    alignItems: 'center'
                });

                const flag = DOM.createFlag(
                    CONFIG.FLAG.SIZES.video,
                    CONFIG.FLAG.MARGINS.video,
                    'video-flag',
                    countryData
                );
                videoParent.appendChild(flag);
            }
        },

        async processShortsPage() {
            const shortsElements = document.querySelectorAll('.ytReelChannelBarViewModelChannelName');

            for (const element of shortsElements) {
                if (state.processedElements.has(element)) {
                    continue;
                }

                DOM.removeExistingFlags(element);
                state.processedElements.add(element);

                const shortsId = window.location.pathname.split('/').pop();
                if (!shortsId) continue;

                const countryData = await API.fetchCountryData('video', shortsId);

                if (countryData?.code) {
                    const flag = DOM.createFlag(
                        CONFIG.FLAG.SIZES.shorts,
                        CONFIG.FLAG.MARGINS.shorts,
                        'shorts-flag',
                        countryData
                    );
                    element.appendChild(flag);
                }
            }
        },

        extractChannelId() {
            const pathname = window.location.pathname;

            // Handle @username format
            if (pathname.includes('@')) {
                return pathname.split('@')[1].split('/')[0];
            }

            // Handle /channel/ID format
            if (pathname.includes('/channel/')) {
                return pathname.split('/channel/')[1].split('/')[0];
            }

            // Fallback to canonical link
            const canonicalLink = document.querySelector('link[rel="canonical"]');
            if (canonicalLink?.href.includes('/channel/')) {
                return canonicalLink.href.split('/channel/')[1].split('/')[0];
            }

            return null;
        },

        async processAll() {
            await Promise.all([
                this.processChannelPage(),
                this.processVideoPage(),
                this.processShortsPage()
            ]);
        }
    };

    // ========================================
    // OBSERVER SETUP
    // ========================================

    const Observer = {
        debouncedProcess: Utils.debounce(() => FlagHandler.processAll()),

        start() {
            if (state.observer) {
                state.observer.disconnect();
            }

            const targetNode = document.querySelector('ytd-watch-flexy') ||
                              document.querySelector('ytd-browse') ||
                              document.querySelector('#content') ||
                              document.body;

            state.observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length || mutation.type === 'childList') {
                        this.debouncedProcess();
                        break;
                    }
                }
            });

            state.observer.observe(targetNode, {
                childList: true,
                subtree: true
            });
        },

        stop() {
            if (state.observer) {
                state.observer.disconnect();
                state.observer = null;
            }
        }
    };

    // ========================================
    // INITIALIZATION
    // ========================================

    async function initialize() {
        try {
            // Small delay to ensure DOM is ready
            await new Promise(resolve => setTimeout(resolve, 150));

            // Reset state
            state.processedElements = new WeakSet();
            DOM.removeExistingChannelAge();

            // Start observer
            Observer.start();

            // Process current page
            await FlagHandler.processAll();

            // Handle YouTube navigation
            window.addEventListener('yt-navigate-finish', async () => {
                Observer.stop();
                state.processedElements = new WeakSet();
                DOM.removeExistingChannelAge();
                Observer.start();
                await FlagHandler.processAll();
            });

            console.log('[YouTube Enhancer] v3 initialized successfully');
        } catch (error) {
            console.error('[YouTube Enhancer] Initialization error:', error);
        }
    }

    // Start the script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        Observer.stop();
    });

})();