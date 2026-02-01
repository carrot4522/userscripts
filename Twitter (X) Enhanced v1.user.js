// ==UserScript==
// @name               Twitter (X) Enhanced v1
// @name:fr            Twitter (X) Amélioré v1
// @name:es            Twitter (X) Mejorado v1
// @name:de            Twitter (X) Erweitert v1
// @name:it            Twitter (X) Migliorato v1
// @name:zh-CN         Twitter (X) 增强版 v1
// @namespace          https://greasyfork.org/users/1259797
// @version            1
// @description        Combined script: Auto-refresh timeline + Auto-unmute videos. Automatically refreshes timeline with configurable intervals and unmutes all videos. Enhanced performance and modern optimizations.
// @description:fr     Script combiné : Actualisation automatique + Réactivation audio des vidéos. Actualise automatiquement la timeline et réactive le son des vidéos.
// @description:es     Script combinado: Actualización automática + Activar audio de videos. Actualiza automáticamente la línea de tiempo y activa el audio de los videos.
// @description:de     Kombiniertes Skript: Automatische Aktualisierung + Video-Ton aktivieren. Aktualisiert automatisch die Timeline und aktiviert den Ton von Videos.
// @description:it     Script combinato: Aggiornamento automatico + Riattivazione audio video. Aggiorna automaticamente la timeline e riattiva l'audio dei video.
// @description:zh-CN  组合脚本：自动刷新时间轴 + 自动取消视频静音。自动刷新时间轴并取消所有视频的静音。
// @author             4lrick + PsychopathicKiller77 (combined and updated)
// @match              https://x.com/*
// @match              https://twitter.com/*
// @icon               https://www.google.com/s2/favicons?sz=64&domain=twitter.com
// @grant              GM_getValue
// @grant              GM_setValue
// @grant              GM_registerMenuCommand
// @grant              GM_unregisterMenuCommand
// @license            MIT
// @run-at             document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        REFRESH: {
            DEFAULT_INTERVAL: 5,
            MIN_INTERVAL: 1,
            MAX_INTERVAL: 300,
            SCROLL_THRESHOLD: 1,
            IDLE_TIMEOUT: 2000
        },
        VIDEO: {
            CHECK_INTERVAL: 100,
            MAX_VOLUME: 1.0,
            DEFAULT_VOLUME: 0.5
        },
        STORAGE_KEYS: {
            REFRESH_INTERVAL: 'refreshInterval',
            REFRESH_ENABLED: 'autoRefreshEnabled',
            PAUSE_ON_SCROLL: 'pauseOnScroll',
            UNMUTE_ENABLED: 'autoUnmuteEnabled',
            DEFAULT_VOLUME: 'defaultVolume'
        },
        SELECTORS: {
            HOME_TAB: '[role="tab"][href="/home"]',
            TIMELINE: 'main [role="region"]',
            REFRESH_BUTTON: '[href="/home"]'
        }
    };

    // Utility Functions
    const Utils = {
        log(message, type = 'info') {
            const prefix = '[Twitter Enhanced v1]';
            const styles = {
                info: 'color: #1DA1F2',
                success: 'color: #17bf63',
                warning: 'color: #ffad1f',
                error: 'color: #f91880'
            };
            console.log(`%c${prefix} ${message}`, styles[type] || styles.info);
        },

        isValidInterval(value) {
            const parsed = parseInt(value);
            return !isNaN(parsed) && parsed >= CONFIG.REFRESH.MIN_INTERVAL && parsed <= CONFIG.REFRESH.MAX_INTERVAL;
        },

        isValidVolume(value) {
            const parsed = parseFloat(value);
            return !isNaN(parsed) && parsed >= 0 && parsed <= 1;
        },

        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    };

    // Page State Manager
    class PageStateManager {
        constructor() {
            this.isUserScrolling = false;
            this.scrollTimeout = null;
            this.setupScrollDetection();
        }

        setupScrollDetection() {
            const handleScroll = () => {
                this.isUserScrolling = true;
                clearTimeout(this.scrollTimeout);

                this.scrollTimeout = setTimeout(() => {
                    this.isUserScrolling = false;
                }, CONFIG.REFRESH.IDLE_TIMEOUT);
            };

            window.addEventListener('scroll', Utils.debounce(handleScroll, 100), { passive: true });
            window.addEventListener('wheel', handleScroll, { passive: true });
            window.addEventListener('touchmove', handleScroll, { passive: true });
        }

        isAtTopOfPage() {
            const tablist = document.querySelector(CONFIG.SELECTORS.HOME_TAB);
            const timeline = document.querySelector(CONFIG.SELECTORS.TIMELINE);

            if (tablist && timeline) {
                const tablistBottom = tablist.getBoundingClientRect().bottom;
                const timelineTop = timeline.getBoundingClientRect().top;
                return tablistBottom <= timelineTop + CONFIG.REFRESH.SCROLL_THRESHOLD;
            }

            return false;
        }

        isOnHomePage() {
            return window.location.pathname === '/home' ||
                   window.location.href.includes('x.com/home') ||
                   window.location.href.includes('twitter.com/home');
        }

        shouldRefresh(pauseOnScroll) {
            if (!this.isOnHomePage()) return false;
            if (!this.isAtTopOfPage()) return false;
            if (pauseOnScroll && this.isUserScrolling) return false;
            return true;
        }

        cleanup() {
            if (this.scrollTimeout) {
                clearTimeout(this.scrollTimeout);
            }
        }
    }

    // Timeline Refresher
    class TimelineRefresher {
        constructor() {
            this.lastRefreshTime = 0;
            this.refreshCount = 0;
        }

        refresh() {
            const refreshButton = document.querySelector(CONFIG.SELECTORS.REFRESH_BUTTON);

            if (!refreshButton) {
                return false;
            }

            try {
                refreshButton.click();

                if (window.scrollY !== 0) {
                    window.scrollTo({ top: 0, behavior: 'instant' });
                }

                this.lastRefreshTime = Date.now();
                this.refreshCount++;

                Utils.log(`Timeline refreshed (count: ${this.refreshCount})`, 'success');
                return true;
            } catch (error) {
                Utils.log(`Refresh failed: ${error.message}`, 'error');
                return false;
            }
        }

        getStats() {
            return {
                count: this.refreshCount,
                lastRefresh: this.lastRefreshTime
            };
        }
    }

    // Video Unmuter
    class VideoUnmuter {
        constructor() {
            this.unmuteCount = 0;
            this.processedVideos = new WeakSet();
        }

        unmuteVideos(defaultVolume) {
            const videos = document.querySelectorAll('video');
            let unmuted = 0;

            videos.forEach(video => {
                if (this.shouldUnmute(video)) {
                    this.unmuteVideo(video, defaultVolume);
                    unmuted++;
                }
            });

            return unmuted;
        }

        shouldUnmute(video) {
            return video &&
                   !video.paused &&
                   video.muted &&
                   !this.processedVideos.has(video);
        }

        unmuteVideo(video, volume) {
            try {
                video.muted = false;
                video.volume = volume;
                this.processedVideos.add(video);
                this.unmuteCount++;
            } catch (error) {
                Utils.log(`Failed to unmute video: ${error.message}`, 'error');
            }
        }

        getStats() {
            return {
                count: this.unmuteCount
            };
        }

        reset() {
            this.processedVideos = new WeakSet();
        }
    }

    // Settings Manager
    class SettingsManager {
        constructor() {
            this.refreshInterval = GM_getValue(CONFIG.STORAGE_KEYS.REFRESH_INTERVAL, CONFIG.REFRESH.DEFAULT_INTERVAL);
            this.refreshEnabled = GM_getValue(CONFIG.STORAGE_KEYS.REFRESH_ENABLED, true);
            this.pauseOnScroll = GM_getValue(CONFIG.STORAGE_KEYS.PAUSE_ON_SCROLL, true);
            this.unmuteEnabled = GM_getValue(CONFIG.STORAGE_KEYS.UNMUTE_ENABLED, true);
            this.defaultVolume = GM_getValue(CONFIG.STORAGE_KEYS.DEFAULT_VOLUME, CONFIG.VIDEO.DEFAULT_VOLUME);
        }

        // Refresh settings
        getRefreshInterval() {
            return this.refreshInterval;
        }

        setRefreshInterval(value) {
            if (Utils.isValidInterval(value)) {
                this.refreshInterval = parseInt(value);
                GM_setValue(CONFIG.STORAGE_KEYS.REFRESH_INTERVAL, this.refreshInterval);
                Utils.log(`Refresh interval updated to ${this.refreshInterval}s`, 'success');
                return true;
            }
            return false;
        }

        isRefreshEnabled() {
            return this.refreshEnabled;
        }

        toggleRefresh() {
            this.refreshEnabled = !this.refreshEnabled;
            GM_setValue(CONFIG.STORAGE_KEYS.REFRESH_ENABLED, this.refreshEnabled);
            Utils.log(`Auto-refresh ${this.refreshEnabled ? 'enabled' : 'disabled'}`, 'success');
            return this.refreshEnabled;
        }

        isPauseOnScroll() {
            return this.pauseOnScroll;
        }

        togglePauseOnScroll() {
            this.pauseOnScroll = !this.pauseOnScroll;
            GM_setValue(CONFIG.STORAGE_KEYS.PAUSE_ON_SCROLL, this.pauseOnScroll);
            Utils.log(`Pause on scroll ${this.pauseOnScroll ? 'enabled' : 'disabled'}`, 'success');
            return this.pauseOnScroll;
        }

        // Video settings
        isUnmuteEnabled() {
            return this.unmuteEnabled;
        }

        toggleUnmute() {
            this.unmuteEnabled = !this.unmuteEnabled;
            GM_setValue(CONFIG.STORAGE_KEYS.UNMUTE_ENABLED, this.unmuteEnabled);
            Utils.log(`Auto-unmute ${this.unmuteEnabled ? 'enabled' : 'disabled'}`, 'success');
            return this.unmuteEnabled;
        }

        getDefaultVolume() {
            return this.defaultVolume;
        }

        setDefaultVolume(value) {
            if (Utils.isValidVolume(value)) {
                this.defaultVolume = parseFloat(value);
                GM_setValue(CONFIG.STORAGE_KEYS.DEFAULT_VOLUME, this.defaultVolume);
                Utils.log(`Default volume updated to ${(this.defaultVolume * 100).toFixed(0)}%`, 'success');
                return true;
            }
            return false;
        }

        // Dialogs
        showRefreshIntervalDialog() {
            const message = `Enter refresh interval in seconds:\n(Min: ${CONFIG.REFRESH.MIN_INTERVAL}, Max: ${CONFIG.REFRESH.MAX_INTERVAL}, Current: ${this.refreshInterval}s)`;
            const newInterval = prompt(message, this.refreshInterval);

            if (newInterval === null) return false;

            if (this.setRefreshInterval(newInterval)) {
                alert(`Refresh interval set to ${newInterval} seconds.`);
                return true;
            } else {
                alert(`Invalid interval. Please enter a number between ${CONFIG.REFRESH.MIN_INTERVAL} and ${CONFIG.REFRESH.MAX_INTERVAL}.`);
                return false;
            }
        }

        showVolumeDialog() {
            const currentPercent = (this.defaultVolume * 100).toFixed(0);
            const message = `Enter default volume percentage:\n(0-100, Current: ${currentPercent}%)`;
            const newVolume = prompt(message, currentPercent);

            if (newVolume === null) return false;

            const volumeDecimal = parseFloat(newVolume) / 100;

            if (this.setDefaultVolume(volumeDecimal)) {
                alert(`Default volume set to ${newVolume}%.`);
                return true;
            } else {
                alert('Invalid volume. Please enter a number between 0 and 100.');
                return false;
            }
        }

        showStatsDialog(refreshStats, videoStats) {
            const uptime = this.formatUptime(Date.now() - refreshStats.lastRefresh);
            const message = `Twitter Enhanced Statistics:\n\n` +
                          `=== AUTO REFRESH ===\n` +
                          `Total Refreshes: ${refreshStats.count}\n` +
                          `Time Since Last: ${uptime}\n` +
                          `Interval: ${this.refreshInterval}s\n` +
                          `Status: ${this.refreshEnabled ? 'Enabled' : 'Disabled'}\n` +
                          `Pause on Scroll: ${this.pauseOnScroll ? 'Yes' : 'No'}\n\n` +
                          `=== AUTO UNMUTE ===\n` +
                          `Videos Unmuted: ${videoStats.count}\n` +
                          `Default Volume: ${(this.defaultVolume * 100).toFixed(0)}%\n` +
                          `Status: ${this.unmuteEnabled ? 'Enabled' : 'Disabled'}`;
            alert(message);
        }

        formatUptime(ms) {
            const seconds = Math.floor(ms / 1000);
            if (seconds < 60) return `${seconds}s`;
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
            const hours = Math.floor(minutes / 60);
            return `${hours}h ${minutes % 60}m`;
        }
    }

    // Menu Manager
    class MenuManager {
        constructor(app) {
            this.app = app;
            this.menuIds = {};
            this.registerCommands();
        }

        registerCommands() {
            // Refresh controls
            this.menuIds.refreshToggle = GM_registerMenuCommand(
                `🔄 Auto-Refresh: ${this.app.settings.isRefreshEnabled() ? 'Enabled ✓' : 'Disabled ✗'}`,
                () => this.handleRefreshToggle()
            );

            this.menuIds.refreshInterval = GM_registerMenuCommand(
                `⏱️ Refresh Interval (${this.app.settings.getRefreshInterval()}s)`,
                () => this.handleRefreshIntervalChange()
            );

            this.menuIds.pauseOnScroll = GM_registerMenuCommand(
                `⏸️ Pause on Scroll: ${this.app.settings.isPauseOnScroll() ? 'On' : 'Off'}`,
                () => this.handlePauseOnScrollToggle()
            );

            // Video controls
            this.menuIds.unmuteToggle = GM_registerMenuCommand(
                `🔊 Auto-Unmute: ${this.app.settings.isUnmuteEnabled() ? 'Enabled ✓' : 'Disabled ✗'}`,
                () => this.handleUnmuteToggle()
            );

            this.menuIds.volume = GM_registerMenuCommand(
                `🎚️ Default Volume (${(this.app.settings.getDefaultVolume() * 100).toFixed(0)}%)`,
                () => this.handleVolumeChange()
            );

            // Stats
            this.menuIds.stats = GM_registerMenuCommand(
                '📊 Show Statistics',
                () => this.handleShowStats()
            );
        }

        handleRefreshToggle() {
            this.app.toggleAutoRefresh();
            this.updateCommands();
        }

        handleRefreshIntervalChange() {
            if (this.app.settings.showRefreshIntervalDialog()) {
                this.app.restartAutoRefresh();
                this.updateCommands();
            }
        }

        handlePauseOnScrollToggle() {
            this.app.settings.togglePauseOnScroll();
            this.updateCommands();
        }

        handleUnmuteToggle() {
            this.app.toggleAutoUnmute();
            this.updateCommands();
        }

        handleVolumeChange() {
            if (this.app.settings.showVolumeDialog()) {
                this.updateCommands();
            }
        }

        handleShowStats() {
            const refreshStats = this.app.refresher.getStats();
            const videoStats = this.app.unmuter.getStats();
            this.app.settings.showStatsDialog(refreshStats, videoStats);
        }

        updateCommands() {
            Object.values(this.menuIds).forEach(id => {
                try {
                    GM_unregisterMenuCommand(id);
                } catch (e) {}
            });
            this.registerCommands();
        }

        cleanup() {
            Object.values(this.menuIds).forEach(id => {
                try {
                    GM_unregisterMenuCommand(id);
                } catch (e) {}
            });
        }
    }

    // Main Application
    class TwitterEnhanced {
        constructor() {
            this.settings = new SettingsManager();
            this.pageState = new PageStateManager();
            this.refresher = new TimelineRefresher();
            this.unmuter = new VideoUnmuter();
            this.menuManager = null;
            this.refreshIntervalId = null;
            this.unmuteIntervalId = null;
        }

        init() {
            Utils.log('Initializing...', 'info');

            this.menuManager = new MenuManager(this);

            if (this.settings.isRefreshEnabled()) {
                this.startAutoRefresh();
            }

            if (this.settings.isUnmuteEnabled()) {
                this.startAutoUnmute();
            }

            this.setupVisibilityHandling();

            Utils.log('Initialization complete', 'success');
        }

        setupVisibilityHandling() {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.stopAutoRefresh();
                    this.stopAutoUnmute();
                } else {
                    if (this.settings.isRefreshEnabled()) {
                        this.startAutoRefresh();
                    }
                    if (this.settings.isUnmuteEnabled()) {
                        this.startAutoUnmute();
                    }
                }
            });
        }

        // Auto-refresh methods
        startAutoRefresh() {
            if (this.refreshIntervalId) return;

            const interval = this.settings.getRefreshInterval() * 1000;
            this.refreshIntervalId = setInterval(() => {
                if (this.pageState.shouldRefresh(this.settings.isPauseOnScroll())) {
                    this.refresher.refresh();
                }
            }, interval);

            Utils.log(`Auto-refresh started (${this.settings.getRefreshInterval()}s)`, 'success');
        }

        stopAutoRefresh() {
            if (this.refreshIntervalId) {
                clearInterval(this.refreshIntervalId);
                this.refreshIntervalId = null;
            }
        }

        restartAutoRefresh() {
            this.stopAutoRefresh();
            if (this.settings.isRefreshEnabled()) {
                this.startAutoRefresh();
            }
        }

        toggleAutoRefresh() {
            const enabled = this.settings.toggleRefresh();
            if (enabled) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
            return enabled;
        }

        // Auto-unmute methods
        startAutoUnmute() {
            if (this.unmuteIntervalId) return;

            this.unmuteIntervalId = setInterval(() => {
                this.unmuter.unmuteVideos(this.settings.getDefaultVolume());
            }, CONFIG.VIDEO.CHECK_INTERVAL);

            Utils.log('Auto-unmute started', 'success');
        }

        stopAutoUnmute() {
            if (this.unmuteIntervalId) {
                clearInterval(this.unmuteIntervalId);
                this.unmuteIntervalId = null;
            }
        }

        toggleAutoUnmute() {
            const enabled = this.settings.toggleUnmute();
            if (enabled) {
                this.startAutoUnmute();
            } else {
                this.stopAutoUnmute();
            }
            return enabled;
        }

        destroy() {
            Utils.log('Cleaning up...', 'info');
            this.stopAutoRefresh();
            this.stopAutoUnmute();
            this.pageState.cleanup();
            this.menuManager?.cleanup();
        }
    }

    // Initialize
    const app = new TwitterEnhanced();
    app.init();

    window.addEventListener('beforeunload', () => app.destroy());
    window.TwitterEnhanced = app;

})();