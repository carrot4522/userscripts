// ==UserScript==
// @name         PZDeals – Block Auto Tab Opening (v1)
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Prevents automatic tab opening when copying coupon codes on pzdeals.com while keeping copy functionality
// @author       You
// @match        https://www.pzdeals.com/*
// @match        https://pzdeals.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Override window.open to prevent new tabs from opening
    const originalOpen = window.open;
    window.open = function(...args) {
        console.log('PZDeals Script: Blocked automatic tab opening');
        return null; // Block the tab from opening
    };

    // Also intercept any click events that might trigger tab opening
    document.addEventListener('click', function(e) {
        // Check if the click is on or near a coupon code element
        const target = e.target;
        const couponElement = target.closest('.deal_coupon_code') ||
                             target.closest('[id*="copy"]') ||
                             target.querySelector('.deal_coupon_code');

        if (couponElement) {
            // Allow the copy functionality but prevent default link behavior
            const links = target.closest('a');
            if (links && links.target === '_blank') {
                e.preventDefault();
                e.stopPropagation();
                console.log('PZDeals Script: Prevented new tab from coupon code click');
            }
        }
    }, true); // Use capture phase to intercept early

    console.log('PZDeals – Block Auto Tab Opening (v1) loaded successfully');
})();