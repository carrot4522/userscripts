// ==UserScript==
// @name         Fox News Ad-Free v9
// @namespace    Fox News Ad-Free v9
// @version      9
// @description  Remove the ad blocker warning overlay, network navigation, and footer from Fox News
// @author       You
// @match        https://www.foxnews.com/*
// @match        https://*.foxnews.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Inject CSS immediately to hide elements before they render
    const hideStyle = document.createElement('style');
    hideStyle.id = 'tampermonkey-instant-hide';
    hideStyle.textContent = `
        /* Hide network navigation */
        div.network-wrapper,
        nav.network-nav,
        .network-wrapper,
        .network-nav {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
        }

        /* Hide footer */
        footer.site-footer {
            display: none !important;
        }

        /* Hide ad blocker warnings */
        div[style*="position: fixed"][style*="bottom: 0"][style*="z-index: 214748"] {
            display: none !important;
        }
        div[style*="position: fixed"][style*="background-color: rgb(249, 243, 221)"],
        div[style*="position: fixed"][style*="background-color: rgb(252, 246, 220)"] {
            display: none !important;
        }
    `;

    // Insert at the very beginning of head
    if (document.head) {
        document.head.insertBefore(hideStyle, document.head.firstChild);
    } else {
        // If head doesn't exist yet, wait for it
        const observer = new MutationObserver((mutations, obs) => {
            if (document.head) {
                document.head.insertBefore(hideStyle, document.head.firstChild);
                obs.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    }

    // Function to remove the warning overlay
    function removeWarning() {
        let removed = false;

        // Method 1: Target ANY fixed position div at the bottom with high z-index
        const allDivs = document.querySelectorAll('div');
        allDivs.forEach(div => {
            const style = div.getAttribute('style');
            if (style) {
                const hasFixed = style.includes('position: fixed') || style.includes('position:fixed');
                const hasBottom = style.includes('bottom: 0') || style.includes('bottom:0');
                const hasHighZIndex = /z-index:\s*214748\d{4}/.test(style);
                const hasBeigeBg = style.includes('rgb(249, 243, 221)') ||
                                   style.includes('rgb(252, 246, 220)') ||
                                   style.includes('background-color: rgb(24');

                if (hasFixed && hasBottom && (hasHighZIndex || hasBeigeBg)) {
                    div.remove();
                    removed = true;
                    console.log('Fox News warning removed (Method 1 - Style match)');
                }
            }
        });

        // Method 2: Find by the warning message text
        document.querySelectorAll('div').forEach(div => {
            const text = div.textContent;
            if (text.includes('You are seeing this message because ad or script blocking software is interfering') &&
                text.includes('Disable any ad or script blocking software')) {
                // Remove the topmost parent that's fixed
                let parent = div;
                while (parent.parentElement) {
                    const parentStyle = parent.parentElement.getAttribute('style');
                    if (parentStyle && parentStyle.includes('position: fixed')) {
                        parent = parent.parentElement;
                    } else {
                        break;
                    }
                }
                parent.remove();
                removed = true;
                console.log('Fox News warning removed (Method 2 - Text match)');
            }
        });

        // Method 3: Target by the Google warning icon
        document.querySelectorAll('img[src*="gstatic.com/images/icons/material/system"][src*="warning"]').forEach(img => {
            let container = img;
            // Traverse up to find the fixed container
            for (let i = 0; i < 10; i++) {
                if (container.parentElement) {
                    const style = container.parentElement.getAttribute('style');
                    if (style && style.includes('position: fixed') && style.includes('bottom: 0')) {
                        container.parentElement.remove();
                        removed = true;
                        console.log('Fox News warning removed (Method 3 - Icon match)');
                        break;
                    }
                    container = container.parentElement;
                }
            }
        });

        // Method 4: Nuclear option - CSS hide
        let style = document.getElementById('tampermonkey-hide-warning');
        if (!style) {
            style = document.createElement('style');
            style.id = 'tampermonkey-hide-warning';
            style.textContent = `
                div[style*="position: fixed"][style*="bottom: 0"][style*="z-index: 214748"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
                div[style*="position: fixed"][style*="background-color: rgb(249, 243, 221)"] {
                    display: none !important;
                }
                div[style*="position: fixed"][style*="background-color: rgb(252, 246, 220)"] {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Re-enable scrolling
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

        if (removed) {
            console.log('Fox News ad blocker warning successfully removed!');
        }
    }

    // Function to remove the network navigation bar
    function removeNetworkNav() {
        // Remove all instances
        document.querySelectorAll('div.network-wrapper, .network-wrapper').forEach(el => {
            el.remove();
            console.log('Network wrapper removed');
        });

        document.querySelectorAll('nav.network-nav, .network-nav').forEach(el => {
            el.remove();
            console.log('Network navigation removed');
        });
    }

    // Function to remove the footer
    function removeFooter() {
        document.querySelectorAll('footer.site-footer, .site-footer').forEach(el => {
            el.remove();
            console.log('Site footer removed');
        });
    }

    // Run immediately
    removeWarning();
    removeNetworkNav();
    removeFooter();

    // Run after DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            removeWarning();
            removeNetworkNav();
            removeFooter();
        });
    }

    // Use MutationObserver to catch dynamically added warnings
    const observer = new MutationObserver(function(mutations) {
        removeWarning();
        removeNetworkNav();
        removeFooter();
    });

    // Start observing
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Also check periodically for the first 10 seconds
    let checkCount = 0;
    const intervalId = setInterval(() => {
        removeWarning();
        removeNetworkNav();
        removeFooter();
        checkCount++;
        if (checkCount >= 20) {
            clearInterval(intervalId);
        }
    }, 500);

})();