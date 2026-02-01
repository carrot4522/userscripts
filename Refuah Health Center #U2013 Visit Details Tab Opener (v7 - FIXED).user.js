// ==UserScript==
// @name         Refuah Health Center – Visit Details Tab Opener (v7 - FIXED)
// @namespace    http://tampermonkey.net/
// @version      7
// @description  Opens Visit Summary and Visit Note links in new tabs (with proper session handling)
// @author       You
// @match        https://mycw23.eclinicalweb.com/*
// @match        https://*.eclinicalweb.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Check if we need to auto-execute a function on page load
    window.addEventListener('load', function() {
        const pendingAction = localStorage.getItem('rhc_pending_action');

        if (pendingAction) {
            console.log('Found pending action:', pendingAction);
            localStorage.removeItem('rhc_pending_action');

            try {
                const action = JSON.parse(pendingAction);

                if (action.type === 'showVisitSummary') {
                    console.log('Executing showVisitSummary with params:', action.params);

                    // Wait for the function to be available
                    const maxAttempts = 20;
                    let attempts = 0;

                    const executeFunction = setInterval(() => {
                        attempts++;

                        if (window.showVisitSummary && typeof window.showVisitSummary === 'function') {
                            console.log('Function found! Executing...');
                            clearInterval(executeFunction);
                            window.showVisitSummary(...action.params);
                        } else if (attempts >= maxAttempts) {
                            console.error('showVisitSummary function not found after', maxAttempts, 'attempts');
                            clearInterval(executeFunction);
                        } else {
                            console.log('Waiting for showVisitSummary function... attempt', attempts);
                        }
                    }, 500);
                } else if (action.type === 'showOpenNote') {
                    // NEW: Handle Visit Note opening
                    console.log('Executing showOpenNote with params:', action.params);

                    const maxAttempts = 20;
                    let attempts = 0;

                    const executeFunction = setInterval(() => {
                        attempts++;

                        if (window.showOpenNote && typeof window.showOpenNote === 'function') {
                            console.log('Function found! Executing showOpenNote...');
                            clearInterval(executeFunction);
                            window.showOpenNote(...action.params);
                        } else if (attempts >= maxAttempts) {
                            console.error('showOpenNote function not found after', maxAttempts, 'attempts');
                            clearInterval(executeFunction);
                        } else {
                            console.log('Waiting for showOpenNote function... attempt', attempts);
                        }
                    }, 500);
                }
            } catch (e) {
                console.error('Error executing pending action:', e);
            }
        }
    });

    // Function to intercept and modify the onclick behavior
    function interceptVisitLinks() {
        const listItems = document.querySelectorAll('li[onclick*="showVisitSummary"], li[onclick*="showOpenNote"]');

        listItems.forEach(li => {
            // Skip if already processed
            if (li.getAttribute('data-tab-opener') === 'true') return;

            const onclickAttr = li.getAttribute('onclick');
            if (!onclickAttr) return;

            console.log('Processing onclick:', onclickAttr);

            const match = onclickAttr.match(/(showVisitSummary|showOpenNote)\((.*?)\);?$/);

            if (match) {
                const funcName = match[1];
                const paramsString = match[2];

                // Parse parameters carefully
                const params = [];
                let currentParam = '';
                let inQuotes = false;

                for (let i = 0; i < paramsString.length; i++) {
                    const char = paramsString[i];

                    if (char === "'" || char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        params.push(currentParam.trim().replace(/^['"]|['"]$/g, ''));
                        currentParam = '';
                    } else {
                        currentParam += char;
                    }
                }
                params.push(currentParam.trim().replace(/^['"]|['"]$/g, ''));

                console.log('Parsed function:', funcName, 'with params:', params);

                // Remove the original onclick
                li.removeAttribute('onclick');

                // Add new click handler
                li.style.cursor = 'pointer';
                li.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    if (funcName === 'showVisitSummary') {
                        console.log('Storing Visit Summary params and opening new tab:', params);

                        localStorage.setItem('rhc_pending_action', JSON.stringify({
                            type: 'showVisitSummary',
                            params: params
                        }));

                        window.open(window.location.href, '_blank');

                    } else if (funcName === 'showOpenNote') {
                        // ✅ FIXED: Use the same approach as Visit Summary
                        console.log('Storing Visit Note params and opening new tab:', params);

                        localStorage.setItem('rhc_pending_action', JSON.stringify({
                            type: 'showOpenNote',
                            params: params
                        }));

                        // Open the same page in new tab - it will execute showOpenNote on load
                        window.open(window.location.href, '_blank');
                    }
                });

                li.setAttribute('data-tab-opener', 'true');
            }
        });
    }

    // Run the interceptor when the page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', interceptVisitLinks);
    } else {
        interceptVisitLinks();
    }

    // Observe for dynamic content
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length > 0) {
                interceptVisitLinks();
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('Refuah Health Center Visit Details Tab Opener v7 (FIXED) loaded');

})();