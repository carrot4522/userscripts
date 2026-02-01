// ==UserScript==
// @name                    YouTube Auto-Resume & Fullscreen v9
// @icon                    https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @author                  ElectroKnight22
// @namespace               electroknight22_youtube_auto_resume_namespace
// @version                 9
// @match                   *://www.youtube.com/*
// @match                   *://m.youtube.com/*
// @match                   *://www.youtube-nocookie.com/*
// @exclude                 *://music.youtube.com/*
// @exclude                 *://studio.youtube.com/*
// @exclude                 *://*.youtube.com/embed/*
// @exclude                 *://www.youtube.com/live_chat*
// @require                 https://update.greasyfork.org/scripts/549881/1670161/YouTube%20Helper%20API.js
// @grant                   GM.getValue
// @grant                   GM.setValue
// @grant                   GM.deleteValue
// @grant                   GM.listValues
// @grant                   GM_getValue
// @grant                   GM_setValue
// @grant                   GM_deleteValue
// @grant                   GM_listValues
// @run-at                  document-idle
// @inject-into             page
// @license                 MIT
// @description             Seamlessly continue any YouTube video where you left off with intelligent playlist handling and automatic progress saving. Double-click the video player to toggle fullscreen without pausing or playing. Old data is cleaned up automatically. [DEBUG VERSION with console logging]
// @homepage                https://greasyfork.org/scripts/526798-youtube-auto-resume
// @downloadURL https://update.greasyfork.org/scripts/526798/YouTube%20Auto-Resume.user.js
// @updateURL https://update.greasyfork.org/scripts/526798/YouTube%20Auto-Resume.meta.js
// ==/UserScript==

/*jshint esversion: 11 */

(() => {
    'use strict';

    // Debug logging (v8+)
    const DEBUG = true;
    const log = (...args) => {
        if (DEBUG) console.log('%c[YT Auto-Resume]', 'color: #00ff00; font-weight: bold;', ...args);
    };
    const error = (...args) => {
        console.error('%c[YT Auto-Resume ERROR]', 'color: #ff0000; font-weight: bold;', ...args);
    };

    // Constants
    const CONFIG = {
        DAYS_TO_REMEMBER: 30,
        DAYS_TO_REMEMBER_SHORTS: 1,
        DAYS_TO_REMEMBER_PREVIEWS: 10 / (24 * 60), // 10 minutes
        MIN_REMEMBER_THRESHOLD: 1.5, // seconds
        STATIC_FINISH_SECONDS: 15,
        CLEANUP_INTERVAL_MS: 300000, // 5 minutes
        STORAGE_PREFIX: 'YT_AUTO_RESUME_',
        FOCUS_LOCK_KEY: 'focusLock',
        LAST_CLEANUP_KEY: 'lastCleanupTimestamp',
        MS_PER_DAY: 86400 * 1000,
        PLAYLIST_POLL_INTERVAL: 100,
        PLAYLIST_MAX_ATTEMPTS: 50,
        PLAYLIST_INITIAL_WAIT: 1000,
        DOUBLE_CLICK_DELAY: 300,
    };

    const VIDEO_TYPES = {
        SHORTS: 'short',
        REGULAR: 'regular',
        PREVIEW: 'preview',
        PLAYLIST: 'playlist',
    };

    const PAGE_TYPES = {
        SHORTS: 'shorts',
        WATCH: 'watch',
    };

    const TAB_ID = crypto.randomUUID();
    log('Tab ID:', TAB_ID);

    let activeCleanup = null;
    let lastPlaylistId = null;
    let currentVideoContext = { storageKey: null, timeupdateHandler: null };

    // Double-click tracking
    let lastClickTime = 0;
    let singleClickTimer = null;
    let isDoubleClick = false;

    // Storage Manager - Optimized with caching
    const StorageManager = (() => {
        const cache = new Map();
        const pendingWrites = new Map();
        let writeDebounceTimer = null;

        const flushPendingWrites = async () => {
            if (pendingWrites.size === 0) return;

            const writes = Array.from(pendingWrites.entries());
            pendingWrites.clear();

            log('Flushing', writes.length, 'pending writes...');

            await Promise.all(
                writes.map(async ([key, value]) => {
                    try {
                        await window.youtubeHelperApi.saveToStorage(CONFIG.STORAGE_PREFIX + key, value);
                        cache.set(key, value);
                        log('✓ Saved:', key, '→', value);
                    } catch (err) {
                        error('Failed to write storage key', key, err);
                    }
                })
            );
        };

        return {
            async getValue(key) {
                if (cache.has(key)) {
                    log('Cache hit:', key);
                    return cache.get(key);
                }

                try {
                    const value = await window.youtubeHelperApi.loadFromStorage(CONFIG.STORAGE_PREFIX + key);
                    cache.set(key, value);
                    log('Loaded from storage:', key, '→', value);
                    return value;
                } catch (err) {
                    error('Failed to parse storage key', key, err);
                    return null;
                }
            },

            async setValue(key, value) {
                cache.set(key, value);
                pendingWrites.set(key, value);

                clearTimeout(writeDebounceTimer);
                writeDebounceTimer = setTimeout(flushPendingWrites, 100);
            },

            async deleteValue(key) {
                cache.delete(key);
                pendingWrites.delete(key);
                await window.youtubeHelperApi.deleteFromStorage(CONFIG.STORAGE_PREFIX + key);
                log('Deleted:', key);
            },

            async listValues() {
                const fullList = await window.youtubeHelperApi.listFromStorage();
                return fullList
                    .filter((key) => key.startsWith(CONFIG.STORAGE_PREFIX))
                    .map((key) => key.substring(CONFIG.STORAGE_PREFIX.length));
            },

            async flush() {
                clearTimeout(writeDebounceTimer);
                await flushPendingWrites();
            },

            clearCache() {
                cache.clear();
            }
        };
    })();

    // Focus management
    const claimFocus = async () => {
        if (currentVideoContext.storageKey) {
            await StorageManager.setValue(CONFIG.FOCUS_LOCK_KEY, {
                tabId: TAB_ID,
                key: currentVideoContext.storageKey,
                lastFocused: Date.now(),
            });
            log('Focus claimed for:', currentVideoContext.storageKey);
        }
    };

    const hasWritePermission = async () => {
        if (!currentVideoContext.storageKey) return false;
        const focusLock = await StorageManager.getValue(CONFIG.FOCUS_LOCK_KEY);
        if (!focusLock) return true;
        const hasPermission = focusLock.key === currentVideoContext.storageKey && focusLock.tabId === TAB_ID;
        log('Write permission:', hasPermission);
        return hasPermission;
    };

    // Double-click handler
    const handleVideoClick = (event) => {
        const currentTime = Date.now();
        const timeSinceLastClick = currentTime - lastClickTime;

        if (timeSinceLastClick < CONFIG.DOUBLE_CLICK_DELAY && lastClickTime !== 0) {
            isDoubleClick = true;

            if (singleClickTimer) {
                clearTimeout(singleClickTimer);
                singleClickTimer = null;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const player = document.querySelector('.html5-video-player');
            if (player) {
                if (!document.fullscreenElement) {
                    if (player.requestFullscreen) {
                        player.requestFullscreen();
                    } else if (player.webkitRequestFullscreen) {
                        player.webkitRequestFullscreen();
                    } else if (player.mozRequestFullScreen) {
                        player.mozRequestFullScreen();
                    } else if (player.msRequestFullscreen) {
                        player.msRequestFullscreen();
                    }
                    log('Entering fullscreen');
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    }
                    log('Exiting fullscreen');
                }
            }

            lastClickTime = 0;
            isDoubleClick = false;

            return false;
        } else {
            lastClickTime = currentTime;
            isDoubleClick = false;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            if (singleClickTimer) {
                clearTimeout(singleClickTimer);
            }

            singleClickTimer = setTimeout(() => {
                if (!isDoubleClick) {
                    const video = document.querySelector('video');
                    if (video) {
                        if (video.paused) {
                            video.play();
                        } else {
                            video.pause();
                        }
                    }
                }
                lastClickTime = 0;
                singleClickTimer = null;
            }, CONFIG.DOUBLE_CLICK_DELAY);

            return false;
        }
    };

    // Playback functions
    const applySeek = async (playerApi, timeToSeek) => {
        if (!playerApi || isNaN(timeToSeek) || timeToSeek < CONFIG.MIN_REMEMBER_THRESHOLD) return;
        playerApi.seekTo(timeToSeek, true);
        log('✓ SEEKED to', timeToSeek.toFixed(2), 'seconds');
    };

    const getVideoType = (pageType) => {
        return pageType === PAGE_TYPES.SHORTS ? VIDEO_TYPES.SHORTS :
               pageType === PAGE_TYPES.WATCH ? VIDEO_TYPES.REGULAR :
               VIDEO_TYPES.PREVIEW;
    };

    const isPlayerReady = (playerApi) => {
        const playerSize = playerApi.getPlayerSize();
        const ready = playerSize.width > 0 && playerSize.height > 0;
        log('Player ready:', ready, playerSize);
        return ready;
    };

    const resumePlayback = async (navigatedFromPlaylistId = null) => {
        try {
            log('=== RESUME PLAYBACK ATTEMPT ===');
            const playerApi = window.youtubeHelperApi.apiProxy;
            const { playlistId, id: videoId } = window.youtubeHelperApi.video;
            const inPlaylist = !!playlistId;

            log('Video ID:', videoId);
            log('Playlist ID:', playlistId);
            log('In playlist:', inPlaylist);

            if (!isPlayerReady(playerApi)) {
                log('Player not ready yet, skipping resume');
                return;
            }

            const keyToFetch = inPlaylist ? playlistId : videoId;
            log('Fetching saved data for key:', keyToFetch);

            const playbackStatus = await StorageManager.getValue(keyToFetch);

            if (!playbackStatus) {
                log('No saved playback data found');
                return;
            }

            log('Found saved data:', playbackStatus);

            let lastPlaybackTime;
            let videoToResumeId = videoId;

            if (inPlaylist) {
                if (!playbackStatus.videos) {
                    log('Playlist data has no videos');
                    return;
                }

                const lastWatchedFromStorage = playbackStatus.lastWatchedVideoId;
                if (playlistId !== navigatedFromPlaylistId && lastWatchedFromStorage && videoId !== lastWatchedFromStorage) {
                    videoToResumeId = lastWatchedFromStorage;
                    log('Will resume different video in playlist:', videoToResumeId);
                }

                lastPlaybackTime = playbackStatus.videos?.[videoToResumeId]?.timestamp;
            } else {
                lastPlaybackTime = playbackStatus.timestamp;
            }

            log('Last playback time:', lastPlaybackTime);

            if (!lastPlaybackTime) {
                log('No timestamp found');
                return;
            }

            if (inPlaylist && videoId !== videoToResumeId) {
                const playlist = await getPlaylistWhenReady(playerApi);
                const index = playlist.indexOf(videoToResumeId);
                if (index !== -1) {
                    log('Playing video at index:', index);
                    playerApi.playVideoAt(index);
                }
            } else {
                await applySeek(playerApi, lastPlaybackTime);
            }
        } catch (err) {
            error('Failed to resume playback:', err);
        }
    };

    const updatePlaybackStatus = async (videoType, playlistId = '') => {
        try {
            if (!(await hasWritePermission())) {
                log('No write permission, skipping update');
                return;
            }

            const liveVideoId = window.youtubeHelperApi.video.id;
            if (!liveVideoId) return;

            const videoDuration = window.youtubeHelperApi.video.lengthSeconds;
            const currentPlaybackTime = window.youtubeHelperApi.video.realCurrentProgress;

            if (isNaN(videoDuration) || isNaN(currentPlaybackTime) || currentPlaybackTime < CONFIG.MIN_REMEMBER_THRESHOLD) {
                return;
            }

            log('Updating playback:', liveVideoId, '→', currentPlaybackTime.toFixed(2), '/', videoDuration.toFixed(2));

            const finishThreshold = Math.min(1 + videoDuration * 0.01, CONFIG.STATIC_FINISH_SECONDS);
            const isFinished = videoDuration - currentPlaybackTime < finishThreshold;

            if (isFinished) {
                log('Video finished, will delete saved position');
            }

            if (playlistId) {
                await updatePlaylistStatus(playlistId, liveVideoId, currentPlaybackTime, isFinished, videoType);
            } else {
                await updateVideoStatus(liveVideoId, currentPlaybackTime, isFinished, videoType);
            }
        } catch (err) {
            error('Failed to update playback status:', err);
        }
    };

    const updatePlaylistStatus = async (playlistId, videoId, currentTime, isFinished, videoType) => {
        const playlistData = (await StorageManager.getValue(playlistId)) || { lastWatchedVideoId: '', videos: {} };

        if (isFinished) {
            if (playlistData.videos?.[videoId]) {
                delete playlistData.videos[videoId];
                await StorageManager.setValue(playlistId, playlistData);
            }
        } else {
            playlistData.videos = playlistData.videos || {};
            playlistData.videos[videoId] = {
                timestamp: currentTime,
                lastUpdated: Date.now(),
                videoType: VIDEO_TYPES.PLAYLIST,
            };
            playlistData.lastWatchedVideoId = videoId;
            await StorageManager.setValue(playlistId, playlistData);
        }
    };

    const updateVideoStatus = async (videoId, currentTime, isFinished, videoType) => {
        if (isFinished) {
            await StorageManager.deleteValue(videoId);
        } else {
            await StorageManager.setValue(videoId, {
                timestamp: currentTime,
                lastUpdated: Date.now(),
                videoType: videoType,
            });
        }
    };

    const processVideo = async () => {
        log('=== PROCESS VIDEO START ===');

        if (activeCleanup) activeCleanup();

        const videoElement = window.youtubeHelperApi.player.videoElement;
        const { id: videoId, playlistId, isCurrentlyLive } = window.youtubeHelperApi.video;

        log('Video element:', videoElement);
        log('Video ID:', videoId);
        log('Is live:', isCurrentlyLive);

        if (!videoId) {
            log('No video ID, aborting');
            return;
        }

        const effectivePlaylistId = playlistId === 'WL' ? null : playlistId;
        currentVideoContext = { storageKey: effectivePlaylistId || videoId };

        await claimFocus();

        // Attach double-click handler
        if (videoElement && !videoElement.dataset.doubleClickHandlerAttached) {
            const videoContainer = videoElement.closest('.html5-video-container');
            if (videoContainer) {
                videoContainer.addEventListener('click', handleVideoClick, { capture: true });
                videoElement.dataset.doubleClickHandlerAttached = 'true';
                log('Double-click handler attached');
            }
        }

        // NEW v9: Removed isTimeSpecified check - only skip for live videos
        if (isCurrentlyLive) {
            log('Skipping resume: live video');
            lastPlaylistId = playlistId;
            return;
        }

        const videoType = getVideoType(window.youtubeHelperApi.page.type);
        log('Video type:', videoType);

        let hasAttemptedResume = false;

        currentVideoContext.timeupdateHandler = () => {
            if (!hasAttemptedResume) {
                hasAttemptedResume = true;
                log('First timeupdate - attempting resume');

                if (videoType === VIDEO_TYPES.PREVIEW) {
                    videoElement.addEventListener('timeupdate', () => resumePlayback(lastPlaylistId), { once: true });
                } else {
                    resumePlayback(lastPlaylistId);
                }
            } else {
                updatePlaybackStatus(videoType, effectivePlaylistId);
            }
        };

        videoElement.removeEventListener('timeupdate', currentVideoContext.timeupdateHandler);
        videoElement.addEventListener('timeupdate', currentVideoContext.timeupdateHandler);
        log('Timeupdate handler attached');

        activeCleanup = () => {
            log('Cleanup called');
            if (videoElement) {
                const videoContainer = videoElement.closest('.html5-video-container');
                if (videoContainer) {
                    videoContainer.removeEventListener('click', handleVideoClick, { capture: true });
                }
                delete videoElement.dataset.doubleClickHandlerAttached;
            }
            if (singleClickTimer) {
                clearTimeout(singleClickTimer);
                singleClickTimer = null;
            }
            lastClickTime = 0;
            currentVideoContext = { storageKey: null, timeupdateHandler: null };
        };
        lastPlaylistId = effectivePlaylistId;
    };

    // Cleanup functions
    const handleCleanupCycle = async () => {
        const lastCleanupTime = (await StorageManager.getValue(CONFIG.LAST_CLEANUP_KEY)) || 0;
        const now = Date.now();

        if (now - lastCleanupTime < CONFIG.CLEANUP_INTERVAL_MS) return;

        await StorageManager.setValue(CONFIG.LAST_CLEANUP_KEY, now);
        log('Running cleanup cycle...');
        await cleanUpExpiredStatuses();
    };

    const isExpired = (statusObject) => {
        if (!statusObject?.lastUpdated || isNaN(statusObject.lastUpdated)) return true;

        const daysToExpire = statusObject.videoType === VIDEO_TYPES.SHORTS ? CONFIG.DAYS_TO_REMEMBER_SHORTS :
                             statusObject.videoType === VIDEO_TYPES.PREVIEW ? CONFIG.DAYS_TO_REMEMBER_PREVIEWS :
                             CONFIG.DAYS_TO_REMEMBER;

        return Date.now() - statusObject.lastUpdated > daysToExpire * CONFIG.MS_PER_DAY;
    };

    const cleanUpExpiredStatuses = async () => {
        try {
            const keys = await StorageManager.listValues();
            const deletePromises = [];
            let deletedCount = 0;

            for (const key of keys) {
                if (key === CONFIG.LAST_CLEANUP_KEY || key === CONFIG.FOCUS_LOCK_KEY) continue;

                const storedData = await StorageManager.getValue(key);
                if (!storedData) continue;

                if (storedData.videos) {
                    let hasChanged = false;
                    const videosToKeep = {};

                    for (const videoId in storedData.videos) {
                        if (!isExpired(storedData.videos[videoId])) {
                            videosToKeep[videoId] = storedData.videos[videoId];
                        } else {
                            hasChanged = true;
                            deletedCount++;
                        }
                    }

                    if (Object.keys(videosToKeep).length === 0) {
                        deletePromises.push(StorageManager.deleteValue(key));
                        deletedCount++;
                    } else if (hasChanged) {
                        storedData.videos = videosToKeep;
                        await StorageManager.setValue(key, storedData);
                    }
                } else {
                    if (isExpired(storedData)) {
                        deletePromises.push(StorageManager.deleteValue(key));
                        deletedCount++;
                    }
                }
            }

            await Promise.all(deletePromises);
            log('Cleanup complete. Deleted', deletedCount, 'expired items');
        } catch (err) {
            error('Failed to clean up:', err);
        }
    };

    // Playlist helper
    const getPlaylistWhenReady = (playerApi) => {
        return new Promise((resolve, reject) => {
            const initialPlaylist = playerApi.getPlaylist();
            if (initialPlaylist?.length > 0) return resolve(initialPlaylist);

            let hasResolved = false;
            let pollerInterval = null;

            const cleanup = () => {
                document.removeEventListener('yt-playlist-data-updated', startPolling);
                if (pollerInterval) clearInterval(pollerInterval);
            };

            const startPolling = () => {
                if (hasResolved) return;

                let attempts = 0;
                pollerInterval = setInterval(() => {
                    const playlist = playerApi.getPlaylist();
                    if (playlist?.length > 0) {
                        hasResolved = true;
                        cleanup();
                        resolve(playlist);
                    } else if (++attempts >= CONFIG.PLAYLIST_MAX_ATTEMPTS) {
                        hasResolved = true;
                        cleanup();
                        reject(new Error('Playlist not found after 5s.'));
                    }
                }, CONFIG.PLAYLIST_POLL_INTERVAL);
            };

            document.addEventListener('yt-playlist-data-updated', startPolling, { once: true });
            setTimeout(() => {
                if (!hasResolved) startPolling();
            }, CONFIG.PLAYLIST_INITIAL_WAIT);
        });
    };

    // Setup and initialization
    const setupCleanup = async () => {
        window.addEventListener('pagehide', async () => {
            if (activeCleanup) activeCleanup();
            await StorageManager.flush();
            log('Page hidden - flushed storage');
        });

        document.addEventListener('yt-autonav-pause-player-ended', async () => {
            if (activeCleanup) activeCleanup();
            await StorageManager.deleteValue(window.youtubeHelperApi.video.id);
            log('Video ended via autonav');
        });

        await handleCleanupCycle();
        setInterval(handleCleanupCycle, CONFIG.CLEANUP_INTERVAL_MS);
    };

    const initialize = () => {
        try {
            log('=== INITIALIZING ===');
            setupCleanup();
            window.addEventListener('focus', claimFocus);
            window.youtubeHelperApi.eventTarget.addEventListener('yt-helper-api-ready', processVideo);
            log('Initialization complete');
        } catch (err) {
            error('Initialization failed:', err);
        }
    };

    initialize();
})();