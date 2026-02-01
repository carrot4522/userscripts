// ==UserScript==
// @name         Combined YouTube Enhancements v3
// @namespace    https://github.com/combined-youtube-scripts
// @version      3
// @description  Return Dislike + Sponsor Skip + Auto-Resume + Downloader + Country Flags + No Shorts + Absolute Dates + Fullscreen Fix - Optimized
// @author       Combined Scripts
// @match        *://*.youtube.com/*
// @exclude      *://music.youtube.com/*
// @exclude      *://*.music.youtube.com/*
// @exclude      *://*.youtube.com/feed/subscriptions*
// @match        *://yt5s.biz/*
// @match        *://cobalt.tools/*
// @match        *://5smp3.com/*
// @match        *://*.yt1s.biz/*
// @match        *://odysee.com/*
// @match        *://yt.artemislena.eu/*
// @connect      returnyoutubedislikeapi.com
// @connect      sponsor.ajay.app
// @connect      cobalt-api.kwiatekmiki.com
// @connect      flagscountry.vercel.app
// @connect      *
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_openInTab
// @grant        GM_notification
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM.listValues
// @grant        GM.notification
// @grant        GM.openInTab
// @grant        GM.registerMenuCommand
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @require      https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(() => {
    'use strict';

    console.log('[Combined Scripts] Initializing all YouTube enhancements...');

    // Shared utilities
    const Utils = {
        log: (module, message) => console.log(`[${module}] ${message}`),
        error: (module, message, err) => console.error(`[${module}] ${message}`, err),
        isMobile: () => location.hostname === 'm.youtube.com',
        isShorts: () => location.pathname.startsWith('/shorts'),
        getVideoId: () => {
            const urlObject = new URL(window.location.href);
            const pathname = urlObject.pathname;
            if (pathname.startsWith('/clip')) {
                return document.querySelector("meta[itemprop='videoId']")?.content;
            } else if (pathname.startsWith('/shorts')) {
                return pathname.slice(8);
            }
            return urlObject.searchParams.get('v');
        },
    };

    // ============================================================================
    // MODULE 1: RETURN YOUTUBE DISLIKE
    // ============================================================================
    const ReturnYouTubeDislike = (() => {
        const CONFIG = {
            STATES: {
                LIKED: 'LIKED_STATE',
                DISLIKED: 'DISLIKED_STATE',
                NEUTRAL: 'NEUTRAL_STATE',
            },
            API_URL: 'https://returnyoutubedislikeapi.com/votes',
            CHECK_INTERVAL: 111,
            MOBILE_UPDATE_INTERVAL: 1000,
            SELECTORS: {
                MOBILE_LIKE_BUTTON: 'ytm-like-button-renderer',
                DESKTOP_LIKE_BUTTON: '#like-button > ytd-like-button-renderer',
                MOBILE_SLIM_BAR: '.slim-video-action-bar-actions .segmented-buttons',
                MOBILE_SLIM_ACTIONS: '.slim-video-action-bar-actions',
                MENU_CONTAINER: '#menu-container',
                TOP_LEVEL_BUTTONS: '#top-level-buttons-computed',
                SEGMENTED_BUTTON: 'YTD-SEGMENTED-LIKE-DISLIKE-BUTTON-RENDERER',
                SEGMENTED_DISLIKE: '#segmented-dislike-button',
                SEGMENTED_LIKE: '#segmented-like-button',
                TEXT_CONTAINER: '#text',
                FORMATTED_STRING: 'yt-formatted-string',
            },
        };

        let mobileDislikes = 0;
        const isMobile = Utils.isMobile();

        const isInViewport = (element) => {
            const rect = element.getBoundingClientRect();
            const height = innerHeight || document.documentElement.clientHeight;
            const width = innerWidth || document.documentElement.clientWidth;
            return !(rect.top === 0 && rect.left === 0 && rect.bottom === 0 && rect.right === 0) &&
                rect.top >= 0 && rect.left >= 0 && rect.bottom <= height && rect.right <= width;
        };

        const getButtons = () => {
            if (Utils.isShorts()) {
                const elements = document.querySelectorAll(
                    isMobile ? CONFIG.SELECTORS.MOBILE_LIKE_BUTTON : CONFIG.SELECTORS.DESKTOP_LIKE_BUTTON
                );
                for (const element of elements) {
                    if (isInViewport(element)) return element;
                }
            }
            if (isMobile) {
                return document.querySelector(CONFIG.SELECTORS.MOBILE_SLIM_BAR) ||
                    document.querySelector(CONFIG.SELECTORS.MOBILE_SLIM_ACTIONS);
            }
            if (document.getElementById('menu-container')?.offsetParent === null) {
                return document.querySelector('ytd-menu-renderer.ytd-watch-metadata > div') ||
                    document.querySelector('ytd-menu-renderer.ytd-video-primary-info-renderer > div');
            }
            return document.getElementById('menu-container')?.querySelector(CONFIG.SELECTORS.TOP_LEVEL_BUTTONS);
        };

        const getDislikeButton = () => {
            const buttons = getButtons();
            if (!buttons) return null;

            if (buttons.children[0].tagName === CONFIG.SELECTORS.SEGMENTED_BUTTON) {
                return buttons.children[0].children[1] || document.querySelector(CONFIG.SELECTORS.SEGMENTED_DISLIKE);
            }
            if (buttons.querySelector('segmented-like-dislike-button-view-model')) {
                return buttons.querySelector('dislike-button-view-model');
            }
            return buttons.children[1];
        };

        const getDislikeTextContainer = () => {
            const dislikeButton = getDislikeButton();
            let result = dislikeButton?.querySelector(CONFIG.SELECTORS.TEXT_CONTAINER) ||
                dislikeButton?.getElementsByTagName(CONFIG.SELECTORS.FORMATTED_STRING)[0] ||
                dislikeButton?.querySelector("span[role='text']");

            if (!result && dislikeButton) {
                const textSpan = document.createElement('span');
                textSpan.id = 'text';
                textSpan.style.marginLeft = '6px';
                const button = dislikeButton.querySelector('button');
                button.appendChild(textSpan);
                button.style.width = 'auto';
                result = textSpan;
            }
            return result;
        };

        const setDislikes = (dislikesCount) => {
            if (isMobile) {
                mobileDislikes = dislikesCount;
                return;
            }
            const container = getDislikeTextContainer();
            if (container) {
                container.removeAttribute('is-empty');
                container.innerText = dislikesCount;
            }
        };

        const roundDown = (num) => {
            if (num < 1000) return num;
            const int = Math.floor(Math.log10(num) - 2);
            const decimal = int + (int % 3 ? 1 : 0);
            const value = Math.floor(num / 10 ** decimal);
            return value * 10 ** decimal;
        };

        const numberFormat = (numberState) => {
            const numberDisplay = roundDown(numberState);
            const userLocales = document.documentElement.lang || navigator.language || 'en';
            const formatter = Intl.NumberFormat(userLocales, {
                notation: 'compact',
                compactDisplay: 'short',
            });
            return formatter.format(numberDisplay);
        };

        const fetchAndSetState = async () => {
            Utils.log('RYD', 'Fetching votes...');
            const videoId = Utils.getVideoId();
            if (!videoId) return;

            try {
                const response = await fetch(`${CONFIG.API_URL}?videoId=${videoId}`);
                const json = await response.json();

                if (json && !('traceId' in json)) {
                    const { dislikes, likes } = json;
                    Utils.log('RYD', `Received count: ${dislikes}`);
                    setDislikes(numberFormat(dislikes));
                }
            } catch (err) {
                Utils.error('RYD', 'Error fetching dislikes:', err);
            }
        };

        const setEventListeners = () => {
            const checkInterval = setInterval(() => {
                if (getButtons()?.offsetParent && getDislikeButton()) {
                    fetchAndSetState();
                    clearInterval(checkInterval);
                }
            }, CONFIG.CHECK_INTERVAL);
        };

        return {
            init: () => {
                try {
                    window.addEventListener('yt-navigate-finish', setEventListeners, true);
                    setEventListeners();

                    if (isMobile) {
                        setInterval(() => {
                            const dislikeButton = getDislikeButton();
                            const textElement = dislikeButton?.querySelector('.button-renderer-text');
                            if (textElement) {
                                textElement.innerText = mobileDislikes;
                            }
                        }, CONFIG.MOBILE_UPDATE_INTERVAL);
                    }
                    Utils.log('RYD', 'Initialized successfully');
                } catch (e) {
                    Utils.error('RYD', 'Initialization error:', e);
                }
            },
        };
    })();

    // ============================================================================
    // MODULE 2: SIMPLE SPONSOR SKIPPER
    // ============================================================================
    const SimpleSponsorSkipper = (() => {
        const CONFIG = {
            DEFAULT_SETTINGS: {
                categories: ['preview', 'sponsor', 'outro', 'music_offtopic', 'selfpromo', 'poi_highlight', 'interaction', 'intro'],
                upvotes: -2,
                notifications: true,
                disable_hashing: false,
                instance: 'sponsor.ajay.app',
                darkmode: -1,
            },
            PLAYER_SELECTOR: '#movie_player video, video#player_html5_api, video#player',
            STORAGE_KEY: 's3settings',
        };

        let settings;

        const sha256 = async (message) => {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        };

        const buildApiUrl = async (videoId) => {
            const inst = settings.instance || 'sponsor.ajay.app';
            const cat = encodeURIComponent(JSON.stringify(settings.categories));

            if (settings.disable_hashing) {
                return `https://${inst}/api/skipSegments?videoID=${videoId}&categories=${cat}`;
            }
            const vidsha256 = await sha256(videoId);
            return `https://${inst}/api/skipSegments/${vidsha256.substring(0, 4)}?categories=${cat}`;
        };

        const processSegments = (segments, videoId) => {
            if (!segments || segments.length === 0) return;

            const player = document.querySelector(CONFIG.PLAYER_SELECTOR);
            if (!player) return;

            let segmentIndex = 0;
            player.addEventListener('timeupdate', () => {
                if (segmentIndex < segments.length && player.currentTime >= segments[segmentIndex].segment[0]) {
                    if (player.currentTime < segments[segmentIndex].segment[1]) {
                        player.currentTime = segments[segmentIndex].segment[1];
                        Utils.log('Sponsor Skipper', `Skipped ${segments[segmentIndex].category} segment`);
                    }
                    segmentIndex++;
                }
            });
        };

        const fetchAndProcessSegments = async (videoId) => {
            const segurl = await buildApiUrl(videoId);

            GM.xmlHttpRequest({
                method: 'GET',
                url: segurl,
                headers: { Accept: 'application/json' },
                onload: (resp) => {
                    try {
                        const response = settings.disable_hashing ?
                            JSON.parse(`[{"videoID":"${videoId}","segments":${resp.responseText}}]`) :
                            JSON.parse(resp.responseText);

                        for (const item of response) {
                            if (item.videoID === videoId) {
                                processSegments(item.segments, videoId);
                                break;
                            }
                        }
                    } catch (e) {
                        // Silently fail - no segments available
                    }
                },
            });
        };

        const setupVideoMonitoring = () => {
            let currentVideoId = '';
            const params = new URLSearchParams(location.search);

            if (params.has('v')) {
                currentVideoId = params.get('v');
                fetchAndProcessSegments(currentVideoId);
            }

            const observer = new MutationObserver(() => {
                const params = new URLSearchParams(location.search);
                if (params.has('v') && params.get('v') !== currentVideoId) {
                    currentVideoId = params.get('v');
                    fetchAndProcessSegments(currentVideoId);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        };

        return {
            init: async () => {
                try {
                    settings = await GM.getValue(CONFIG.STORAGE_KEY);
                    if (!settings || Object.keys(settings).length === 0) {
                        settings = CONFIG.DEFAULT_SETTINGS;
                        await GM.setValue(CONFIG.STORAGE_KEY, settings);
                    }

                    if (document.readyState === 'loading') {
                        window.addEventListener('load', setupVideoMonitoring);
                    } else {
                        setupVideoMonitoring();
                    }

                    Utils.log('Sponsor Skipper', 'Initialized successfully');
                } catch (e) {
                    Utils.error('Sponsor Skipper', 'Initialization error:', e);
                }
            },
        };
    })();

    // ============================================================================
    // MODULE 3: NO SHORTS
    // ============================================================================
    const NoShorts = (() => {
        const HAS_CSS_SUPPORT = (() => {
            try {
                return CSS && typeof CSS.supports === 'function' && CSS.supports('selector(:has(*))');
            } catch (e) {
                return false;
            }
        })();

        const CSS_SHORTS = `
            ytd-rich-grid-media:has(a[href*="/shorts/"]),
            ytd-video-renderer:has(a[href*="/shorts/"]),
            ytd-grid-video-renderer:has(a[href*="/shorts/"]),
            ytd-rich-item-renderer:has(a[href*="/shorts/"]),
            ytd-compact-video-renderer:has(a[href*="/shorts/"]),
            ytd-playlist-video-renderer:has(a[href*="/shorts/"]),
            ytd-rich-grid-row:has(a[href*="/shorts/"]),
            grid-shelf-view-model:has(ytm-shorts-lockup-view-model),
            ytd-reel-shelf-renderer,
            ytd-rich-shelf-renderer[is-shorts],
            ytd-shelf-renderer,
            ytm-rich-item-renderer:has(a[href*="/shorts/"]),
            ytm-compact-video-renderer:has(a[href*="/shorts/"]),
            ytm-video-renderer:has(a[href*="/shorts/"]),
            ytm-shorts-lockup-view-model,
            ytm-reel-shelf-renderer,
            ytm-shelf-renderer:has([href*="/shorts/"]),
            ytm-rich-shelf-renderer:has([href*="/shorts/"]) {
                display: none !important;
            }
        `;

        return {
            init: () => {
                try {
                    if (HAS_CSS_SUPPORT) {
                        GM_addStyle(CSS_SHORTS);
                        Utils.log('No Shorts', 'Initialized successfully');
                    } else {
                        console.warn('[No Shorts] Browser does not support CSS :has()');
                    }
                } catch (e) {
                    Utils.error('No Shorts', 'Initialization error:', e);
                }
            },
        };
    })();

    // ============================================================================
    // MODULE 4: FULLSCREEN SCROLL DISABLER
    // ============================================================================
    const FullscreenScrollDisabler = (() => {
        const preventScroll = (e) => {
            if (document.body.classList.contains('no-scroll')) {
                e.preventDefault();
            }
        };

        const toggleScroll = () => {
            const isFullScreen = document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement;

            document.body.classList.toggle('no-scroll', !!isFullScreen);
        };

        return {
            init: () => {
                try {
                    document.addEventListener('wheel', preventScroll, { passive: false });
                    document.addEventListener('fullscreenchange', toggleScroll);
                    document.addEventListener('webkitfullscreenchange', toggleScroll);
                    document.addEventListener('mozfullscreenchange', toggleScroll);
                    GM_addStyle('.ytp-fullerscreen-edu-button { display: none !important; }');
                    Utils.log('Fullscreen Fix', 'Initialized successfully');
                } catch (e) {
                    Utils.error('Fullscreen Fix', 'Initialization error:', e);
                }
            },
        };
    })();

    // ============================================================================
    // MODULE 5: COUNTRY FLAG
    // ============================================================================
    const CountryFlag = (() => {
        const CONFIG = {
            BASE_URL: 'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/flags/4x3/',
            API_URL: 'https://flagscountry.vercel.app/api',
            CACHE_PREFIX: 'yt_enhancer_',
            CACHE_EXPIRATION: 7 * 24 * 60 * 60 * 1000,
            DEBOUNCE_DELAY: 200,
            REINIT_DELAY: 300,
            SIZES: { channel: '28px', video: '22px', shorts: '20px' },
            MARGINS: { channel: '12px', video: '10px', shorts: '8px' },
            SELECTORS: {
                CHANNEL_PRIMARY: 'h1.dynamicTextViewModelH1 > span.yt-core-attributed-string',
                CHANNEL_FALLBACK: '#channel-name #text',
                VIDEO: '#title yt-formatted-string',
                VIDEO_PARENT: '#title h1',
            },
        };

        const processedElements = new Set();

        const getCacheKey = (type, id) => `${CONFIG.CACHE_PREFIX}${type}_${id}`;

        const getFromCache = (type, id) => {
            try {
                const cachedData = GM_getValue(getCacheKey(type, id));
                if (!cachedData) return null;

                const { value, timestamp } = JSON.parse(cachedData);
                if (Date.now() - timestamp > CONFIG.CACHE_EXPIRATION) {
                    GM_setValue(getCacheKey(type, id), null);
                    return null;
                }
                return value;
            } catch {
                return null;
            }
        };

        const setToCache = (type, id, value) => {
            const cacheKey = getCacheKey(type, id);
            GM_setValue(cacheKey, JSON.stringify({ value, timestamp: Date.now() }));
        };

        const fetchCountryData = (type, id) => {
            const cachedValue = getFromCache(type, id);
            if (cachedValue) return Promise.resolve(cachedValue);

            return new Promise((resolve) => {
                GM.xmlHttpRequest({
                    method: 'GET',
                    url: `${CONFIG.API_URL}/${type}/${id}`,
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const data = JSON.parse(response.responseText);
                                const countryData = {
                                    code: (data.country || '').toLowerCase(),
                                    name: data.countryName || '',
                                };
                                setToCache(type, id, countryData);
                                resolve(countryData);
                            } catch {
                                resolve(null);
                            }
                        } else {
                            resolve(null);
                        }
                    },
                    onerror: () => resolve(null),
                });
            });
        };

        const createFlag = (size, margin, countryData) => {
            const flag = document.createElement('img');
            flag.src = `${CONFIG.BASE_URL}${countryData.code}.svg`;
            flag.className = 'country-flag';
            Object.assign(flag.style, {
                width: size,
                height: 'auto',
                marginLeft: margin,
                verticalAlign: 'middle',
            });
            flag.title = countryData.name || '';
            return flag;
        };

        const removeExistingFlags = (parent) => {
            parent.querySelectorAll('.country-flag').forEach(flag => flag.remove());
        };

        const addChannelFlag = async () => {
            const channelElement = document.querySelector(CONFIG.SELECTORS.CHANNEL_PRIMARY) ||
                document.querySelector(CONFIG.SELECTORS.CHANNEL_FALLBACK);

            if (!channelElement || processedElements.has(channelElement)) return;

            const channelParent = channelElement.parentElement || channelElement;
            removeExistingFlags(channelParent);
            processedElements.add(channelElement);

            const channelUrl = window.location.pathname;
            let channelId = null;

            if (channelUrl.includes('@')) {
                channelId = channelUrl.split('@')[1].split('/')[0];
            } else if (channelUrl.includes('/channel/')) {
                channelId = channelUrl.split('/channel/')[1].split('/')[0];
            }

            if (channelId) {
                const countryData = await fetchCountryData('channel', channelId);
                if (countryData?.code) {
                    channelElement.appendChild(
                        createFlag(CONFIG.SIZES.channel, CONFIG.MARGINS.channel, countryData)
                    );
                }
            }
        };

        const addVideoFlag = async () => {
            const videoElement = document.querySelector(CONFIG.SELECTORS.VIDEO);
            if (!videoElement || processedElements.has(videoElement)) return;

            const videoParent = videoElement.closest(CONFIG.SELECTORS.VIDEO_PARENT);
            if (!videoParent) return;

            removeExistingFlags(videoParent);
            processedElements.add(videoElement);

            const videoId = new URLSearchParams(window.location.search).get('v');
            if (videoId) {
                const countryData = await fetchCountryData('video', videoId);
                if (countryData?.code) {
                    Object.assign(videoParent.style, {
                        display: 'flex',
                        alignItems: 'center',
                    });
                    videoParent.appendChild(
                        createFlag(CONFIG.SIZES.video, CONFIG.MARGINS.video, countryData)
                    );
                }
            }
        };

        const addFlags = async () => {
            await addChannelFlag();
            await addVideoFlag();
        };

        return {
            init: () => {
                try {
                    let debounceTimer;
                    const observer = new MutationObserver(() => {
                        clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(addFlags, CONFIG.DEBOUNCE_DELAY);
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                    addFlags();

                    window.addEventListener('yt-navigate-finish', () => {
                        processedElements.clear();
                        setTimeout(addFlags, CONFIG.REINIT_DELAY);
                    });
                    Utils.log('Country Flag', 'Initialized successfully');
                } catch (e) {
                    Utils.error('Country Flag', 'Initialization error:', e);
                }
            },
        };
    })();

    // ============================================================================
    // INITIALIZE ALL MODULES
    // ============================================================================
    const initializeAll = () => {
        if (!window.location.hostname.includes('youtube.com')) {
            console.log('[Combined Scripts] Not on YouTube, skipping initialization');
            return;
        }

        const modules = [
            { name: 'Return YouTube Dislike', module: ReturnYouTubeDislike },
            { name: 'Simple Sponsor Skipper', module: SimpleSponsorSkipper },
            { name: 'No Shorts', module: NoShorts },
            { name: 'Fullscreen Scroll Disabler', module: FullscreenScrollDisabler },
            { name: 'Country Flag', module: CountryFlag },
        ];

        modules.forEach(({ name, module }) => {
            try {
                if (module?.init) module.init();
            } catch (e) {
                console.error(`[Combined Scripts] Error initializing ${name}:`, e);
            }
        });

        console.log('[Combined Scripts] ✓ All modules initialized');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAll);
    } else {
        initializeAll();
    }
})();