// ==UserScript==
// @name         Gateway Pundit – Remove Secondary Navigation (v1)
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Removes the secondary navigation bar from The Gateway Pundit website
// @author       Solomon
// @match        https://www.thegatewaypundit.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Function to remove the secondary navigation
    function removeSecondaryNav() {
        const secondaryNav = document.querySelector('#secondary-navigation');
        if (secondaryNav) {
            secondaryNav.remove();
            console.log('Gateway Pundit: Secondary navigation removed');
        }
    }

    // Run immediately when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', removeSecondaryNav);
    } else {
        removeSecondaryNav();
    }

    // Also observe for dynamic content loading
    const observer = new MutationObserver(function(mutations) {
        const secondaryNav = document.querySelector('#secondary-navigation');
        if (secondaryNav) {
            secondaryNav.remove();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();