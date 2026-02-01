// ==UserScript==
// @name         Auto Read Aloud v3
// @namespace    Auto Read Aloud v3
// @version      3
// @description  Automatically detects and clicks "More actions" buttons on ChatGPT, then triggers "Read aloud" functionality. Simulates real user interactions with full mouse event sequences.
// @author       You
// @match        https://chatgpt.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chatgpt.com
// @grant        none
// @license      MIT
// @downloadURL  https://update.greasyfork.org/scripts/549539/Auto%20Read%20Aloud%20ChatGPT.user.js
// @updateURL    https://update.greasyfork.org/scripts/549539/Auto%20Read%20Aloud%20ChatGPT.meta.js
// ==/UserScript==

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    menuDelay: 200,           // Delay to wait for menu to appear (ms)
    moreActionsLabel: 'More actions',
    readAloudLabel: 'Read aloud'
  };

  // Track processed buttons to avoid duplicate clicks
  const processedButtons = new WeakSet();

  /**
   * Simulates a complete user click with all relevant mouse events
   * @param {HTMLElement} element - The element to click
   */
  function simulateFullClick(element) {
    if (!element) return;

    const eventTypes = [
      'pointerover',
      'pointerenter',
      'mouseover',
      'mouseenter',
      'mousemove',
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click'
    ];

    const rect = element.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    eventTypes.forEach(type => {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: clientX,
        clientY: clientY,
        button: 0
      });
      element.dispatchEvent(event);
    });
  }

  /**
   * Handles a newly detected "More actions" button
   * @param {HTMLElement} button - The "More actions" button element
   */
  function handleMoreActionsButton(button) {
    // Avoid processing the same button multiple times
    if (processedButtons.has(button)) return;
    processedButtons.add(button);

    console.log('New "More actions" button detected:', button);

    // Click the "More actions" button
    simulateFullClick(button);

    // Wait for the menu to appear, then click "Read aloud"
    setTimeout(() => {
      const readAloudButton = document.querySelector(`[aria-label="${CONFIG.readAloudLabel}"]`);

      if (readAloudButton) {
        simulateFullClick(readAloudButton);
        console.log('"Read aloud" button clicked successfully!');
      } else {
        console.log('"Read aloud" button not found in menu.');
      }
    }, CONFIG.menuDelay);
  }

  /**
   * Checks if an element or its descendants contain "More actions" buttons
   * @param {Node} node - The node to check
   */
  function checkForMoreActionsButtons(node) {
    if (node.nodeType !== 1) return; // Only process element nodes

    const selector = `button[aria-label="${CONFIG.moreActionsLabel}"]`;

    // Check if the node itself is a "More actions" button
    if (node.matches && node.matches(selector)) {
      handleMoreActionsButton(node);
    }

    // Check for "More actions" buttons in descendants
    if (node.querySelectorAll) {
      node.querySelectorAll(selector).forEach(button => {
        handleMoreActionsButton(button);
      });
    }
  }

  /**
   * Initializes the mutation observer to watch for new buttons
   */
  function initializeObserver() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          checkForMoreActionsButtons(node);
        });
      });
    });

    // Start observing the document body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('Auto Read Aloud: Watching for new "More actions" buttons...');
  }

  /**
   * Processes any existing "More actions" buttons on page load
   */
  function processExistingButtons() {
    const existingButtons = document.querySelectorAll(`button[aria-label="${CONFIG.moreActionsLabel}"]`);
    existingButtons.forEach(button => {
      handleMoreActionsButton(button);
    });
  }

  // Initialize the script
  function init() {
    // Process any buttons already on the page
    processExistingButtons();

    // Start watching for new buttons
    initializeObserver();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();