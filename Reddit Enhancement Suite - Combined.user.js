// ==UserScript==
// @name         Reddit Enhancement Suite - Combined
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Combined: Age Bypass, Sidebar Remover, and Login Requirement Remover
// @author       Combined Script
// @license      MIT
// @match        https://www.reddit.com/*
// @match        https://*.reddit.com/*
// @match        http://www.reddit.com/*
// @match        http://*.reddit.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @grant        GM_addStyle
// @grant        GM_cookie
// @run-at       document-start
// @downloadURL https://update.greasyfork.org/scripts/XXXXX/Reddit%20Enhancement%20Suite%20Combined.user.js
// @updateURL https://update.greasyfork.org/scripts/XXXXX/Reddit%20Enhancement%20Suite%20Combined.meta.js
// ==/UserScript==

// Use in Combination with this ublock filter (block this url: www.redditstatic.com/shreddit/*xpromo-nsfw-blocking-modal-*.js)
// www.redditstatic.com/shreddit*xpromo-nsfw-blocking-modal-*.js$script,domain=www.reddit.com

(function() {
    'use strict';

    // ===== VERIFY REDDIT DOMAIN =====
    const hostname = window.location.hostname;
    if (!hostname.includes('reddit.com')) {
        console.log("[Reddit Enhancement] Not on Reddit, script will not run.");
        return;
    }

    // ===== LOGGER UTILITY =====
    function log(text) {
        console.log("[Reddit Enhancement] " + text);
    }

    // ===== SCRIPT 1: AGE BYPASS =====
    function initAgeBypass() {
        function wait_and_remove() {
            clearInterval(wait_for_post);
            wait_for_post = setInterval(() => {
                log("Waiting for post");
                const icon = document.querySelector("span.flex.gap-xs.items-center.pr-xs.truncate > span > faceplate-tracker > a > div");
                if (icon !== null) {
                    clearInterval(wait_for_post);
                    log("Post found");
                    // check if the icon is nsfw -> post is nsfw
                    if (icon.querySelector("icon-nsfw") !== null) {
                        const blurs = document.querySelectorAll("xpromo-nsfw-blocking-container");
                        log(`Post is NSFW, removing ${blurs.length} blurs`);
                        blurs.forEach(blur_elem => blur_elem.shadowRoot.querySelector("div.prompt").remove());
                        log("Bypass successfull");
                    }
                }
            }, 500);
        }

        let wait_for_post;
        wait_and_remove();
        const wait_for_polyfill = setInterval(() => {
            if (window.navigation) {
                clearInterval(wait_for_polyfill);
                window.navigation.addEventListener("navigate", () => wait_and_remove());
            }
        }, 10);
    }

    // ===== SCRIPT 2: SIDEBAR REMOVER =====
    function initSidebarRemover() {
        // Function to remove the sidebar
        function removeSidebar() {
            // Target the aside element with the community information
            const sidebar = document.querySelector('aside[aria-label="Community information"]');
            if (sidebar) {
                sidebar.remove();
                return true;
            }
            // Alternative selector for the right rail container
            const rightRail = document.querySelector('faceplate-partial[id="subreddit-right-rail__partial"]');
            if (rightRail) {
                rightRail.remove();
                return true;
            }
            // Find by class patterns
            const sidebarContainer = document.querySelector('[class*="right-sidebar"]');
            if (sidebarContainer) {
                sidebarContainer.remove();
                return true;
            }
            return false;
        }

        // Try to remove immediately
        removeSidebar();

        // Use MutationObserver to catch dynamically loaded content
        const observer = new MutationObserver(() => {
            removeSidebar();
        });

        // Start observing when DOM is ready
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            });
        }

        // Also add CSS to hide it as a fallback
        const style = document.createElement('style');
        style.textContent = `
            aside[aria-label="Community information"],
            faceplate-partial[id="subreddit-right-rail__partial"],
            [class*="right-sidebar"] {
                display: none !important;
            }
        `;
        if (document.head) {
            document.head.appendChild(style);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.head.appendChild(style);
            });
        }
    }

    // ===== SCRIPT 3: LOGIN REQUIREMENT REMOVER =====
    function initLoginRemover() {
        const mainContent = document.querySelector('.sidebar-grid');
        mainContent?.setAttribute('style', mainContent.attributes?.getNamedItem('style')?.nodeValue?.replace(/filter: blur\(4px\);/g, ''));

        // Prevents fullscreen "are you sure" modals
        const domains = ['reddit.com', 'www.reddit.com'];
        domains.forEach(domain => {
            GM_cookie.set({
                name: 'over18',
                value: 'true',
                domain: domain,
                path: '/',
                httpOnly: false
            });
        });

        //Remove other elements
        const observerOptions = { subtree: true, childList: true };
        const mObserver = new MutationObserver(function() {
            // Disable scroll prevention
            const body = document.querySelector('body');
            body?.setAttribute('style', body.attributes?.getNamedItem('style')?.nodeValue?.replace(/pointer-events: none; overflow: hidden;/g, ''));

            const overlays = [
                document.querySelector('xpromo-nsfw-blocking-modal-desktop'),
                document.querySelector('xpromo-nsfw-bypassable-modal-desktop'),
                document.querySelector('xpromo-nsfw-blocking-container')?.shadowRoot?.querySelector('.prompt'),
                document.querySelector('#nsfw-qr-dialog'),
                document.querySelector('div[style*="position: fixed"][style*="inset: 0px"][style*="backdrop-filter: blur(4px)"]'), // blurred screen
                document.querySelector('faceplate-modal:has(> div.text-category-nsfw)') // mature content blocking modal
            ];

            // Remove visual overlays
            overlays
                .filter(o => o)
                .forEach(o => o?.remove());

            // Automatically deal with blurred containers
            document.querySelectorAll('shreddit-blurred-container')
                .forEach(container => {
                    if (!container?.isNsfwAllowed) container.isNsfwAllowed = true;
                    if (container?.handleClick) container.handleClick();
                });

            document.querySelectorAll('xpromo-nsfw-blocking-container')
                .forEach(container => {
                    if (!container.shadowRoot) return;
                    const prompt = container.shadowRoot.querySelector('div.prompt');
                    if (!prompt) return;
                    prompt.style = 'display: none !important';
                });
        });
        mObserver.observe(document, observerOptions);
    }

    // ===== INITIALIZE ALL SCRIPTS =====
    log("Initializing all Reddit enhancements...");
    initAgeBypass();
    initSidebarRemover();
    initLoginRemover();
    log("All enhancements loaded successfully!");
})();