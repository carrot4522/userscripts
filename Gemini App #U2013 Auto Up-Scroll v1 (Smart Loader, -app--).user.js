// ==UserScript==
// @name         Gemini App – Auto Up-Scroll v1 (Smart Loader, /app/*)
// @namespace    rps.autoscroll.gemini.app
// @version      1
// @description  Scroll to the actual beginning of a Gemini chat by paging up and waiting for lazy-loaded chunks until stable. Optimized with better performance, error handling, and UX improvements.
// @author       you
// @match        https://gemini.google.com/app/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---------- CONSTANTS ----------
  const CONFIG = {
    STEP_FRACTION_OF_VH: 0.9,        // page-up size: 0.9 ≈ PageUp
    STEP_INTERVAL_MS: 350,           // delay between scroll steps
    RENDER_IDLE_MS: 2500,            // ms of no new DOM additions before stable
    MAX_RUNTIME_MS: 15 * 60 * 1000,  // hard stop after 15 minutes
    LOG_ENABLED: true,
    TOP_THRESHOLD: 2,                // pixels considered "at top"
    MIN_SCROLL_DELTA: 100,           // minimum scroll amount in pixels
    UI_RECHECK_INTERVALS: [1500, 4000, 8000], // when to re-ensure UI exists
    BOOT_TIMEOUT: 12000,             // stop boot loop after this time
    BOOT_INTERVAL: 400,              // boot check interval
  };

  const SELECTORS = {
    BUTTON_ID: 'rpsUpBtn',
    STATUS_ID: 'rpsUpStat',
    SCROLL_CANDIDATES: ['main', 'c-wiz'],
  };

  const HOTKEY = {
    CTRL: true,
    SHIFT: true,
    KEY: 'u',
  };

  // ---------- STYLES ----------
  GM_addStyle(`
    #${SELECTORS.BUTTON_ID} {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 999999;
      padding: 10px 14px;
      border-radius: 10px;
      font-weight: 700;
      background: #22c55e;
      color: #04131b;
      border: 1px solid #16a34a;
      cursor: pointer;
      box-shadow: 0 6px 16px rgba(0,0,0,.25);
      font-family: system-ui, -apple-system, Inter, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.2s ease-in-out;
      user-select: none;
    }
    #${SELECTORS.BUTTON_ID}:hover:not([disabled]) {
      background: #16a34a;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0,0,0,.3);
    }
    #${SELECTORS.BUTTON_ID}:active:not([disabled]) {
      transform: translateY(0);
    }
    #${SELECTORS.BUTTON_ID}[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    #${SELECTORS.STATUS_ID} {
      position: fixed;
      right: 16px;
      bottom: 60px;
      z-index: 999998;
      padding: 6px 10px;
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.9);
      color: #e2e8f0;
      font: 12px/1.4 system-ui, -apple-system, Inter, 'Segoe UI', Roboto, sans-serif;
      border: 1px solid rgba(148, 163, 184, 0.3);
      max-width: 60vw;
      backdrop-filter: blur(4px);
      box-shadow: 0 4px 12px rgba(0,0,0,.2);
    }
    @media (max-width: 600px) {
      #${SELECTORS.BUTTON_ID} {
        right: 12px;
        bottom: 12px;
        padding: 8px 12px;
        font-size: 14px;
      }
      #${SELECTORS.STATUS_ID} {
        right: 12px;
        bottom: 52px;
        max-width: 80vw;
        font-size: 11px;
      }
    }
  `);

  // ---------- UTILITIES ----------
  const log = (...args) => {
    if (CONFIG.LOG_ENABLED) {
      console.log('[Gemini UpScroll]', ...args);
    }
  };

  const logError = (...args) => {
    console.error('[Gemini UpScroll]', ...args);
  };

  // ---------- DOM UTILITIES ----------
  function findScrollableContainer() {
    // Try specific known selectors first
    const specificCandidates = SELECTORS.SCROLL_CANDIDATES
      .map(sel => document.querySelector(sel))
      .filter(Boolean);

    // Add standard fallbacks
    const standardCandidates = [
      document.body,
      document.scrollingElement,
      document.documentElement,
    ].filter(Boolean);

    // Find all overflow containers
    const overflowCandidates = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        try {
          const cs = getComputedStyle(el);
          if (!cs) return false;
          const overflowY = cs.overflowY;
          const clientHeight = el.clientHeight || 0;
          const scrollHeight = el.scrollHeight || 0;
          return (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            scrollHeight - clientHeight > 200
          );
        } catch (e) {
          return false;
        }
      });

    // Combine all candidates
    const allCandidates = [
      ...specificCandidates,
      ...overflowCandidates,
      ...standardCandidates,
    ];

    // Find the one with the most scrollable content
    let bestElement = null;
    let bestScore = -1;

    for (const el of allCandidates) {
      try {
        const clientHeight = el.clientHeight || 0;
        const scrollHeight = el.scrollHeight || 0;
        const score = scrollHeight - clientHeight;

        if (score > bestScore) {
          bestScore = score;
          bestElement = el;
        }
      } catch (e) {
        continue;
      }
    }

    const result = bestElement || document.scrollingElement || document.documentElement;
    log('Selected scroller:', result);
    return result;
  }

  function isAtTop(scroller) {
    const scrollTop = scroller.scrollTop || 0;
    return scrollTop <= CONFIG.TOP_THRESHOLD;
  }

  function scrollPageUp(scroller) {
    const delta = Math.max(
      CONFIG.MIN_SCROLL_DELTA,
      Math.floor(window.innerHeight * CONFIG.STEP_FRACTION_OF_VH)
    );

    scroller.scrollBy({ top: -delta, behavior: 'instant' });

    // Trigger scroll events for lazy loading
    const scrollEvent = new Event('scroll', { bubbles: true, cancelable: true });
    window.dispatchEvent(scrollEvent);
    document.dispatchEvent(scrollEvent);
  }

  function createMutationObserver(onMutation) {
    const observer = new MutationObserver(mutations => {
      const hasAddedNodes = mutations.some(m => m.addedNodes?.length > 0);
      if (hasAddedNodes) {
        onMutation();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return observer;
  }

  // ---------- UI MANAGEMENT ----------
  let uiElements = null;

  function createUI() {
    const button = document.createElement('button');
    button.id = SELECTORS.BUTTON_ID;
    button.textContent = 'Start Up-Scroll';
    button.title = `Scroll to chat beginning (Ctrl+Shift+${HOTKEY.KEY.toUpperCase()})`;

    const status = document.createElement('div');
    status.id = SELECTORS.STATUS_ID;
    status.textContent = 'Ready to scroll';

    return { button, status };
  }

  function ensureUI() {
    // Check if UI already exists
    const existingButton = document.getElementById(SELECTORS.BUTTON_ID);
    if (existingButton) return;

    // Create new UI elements
    const { button, status } = createUI();

    // Append to document
    document.documentElement.append(button, status);

    // Store references
    uiElements = { button, status };

    // Attach event listeners
    button.addEventListener('click', handleButtonClick);

    log('UI elements created and attached');
  }

  function handleButtonClick() {
    if (uiElements?.button && !uiElements.button.disabled) {
      runUpScroll(uiElements.button, uiElements.status);
    }
  }

  function setupHotkey() {
    window.addEventListener('keydown', (e) => {
      const button = document.getElementById(SELECTORS.BUTTON_ID);
      if (!button || button.disabled) return;

      const isHotkeyPressed =
        e.ctrlKey === HOTKEY.CTRL &&
        e.shiftKey === HOTKEY.SHIFT &&
        e.key.toLowerCase() === HOTKEY.KEY;

      if (isHotkeyPressed) {
        e.preventDefault();
        handleButtonClick();
      }
    });
    log('Hotkey listener attached');
  }

  // ---------- MAIN LOGIC ----------
  async function runUpScroll(button, statusElement) {
    // Ensure UI exists (SPA might have wiped it)
    ensureUI();

    button.disabled = true;

    const updateStatus = (text) => {
      statusElement.textContent = text;
      log('Status:', text);
    };

    const scroller = findScrollableContainer();

    let lastMutationTime = Date.now();
    const observer = createMutationObserver(() => {
      lastMutationTime = Date.now();
    });

    const startTime = Date.now();
    let scrollAttempts = 0;

    updateStatus('Initializing… keep this tab visible');

    try {
      // Jump to top to trigger lazy loading
      scroller.scrollTo({ top: 0, behavior: 'instant' });
      lastMutationTime = Date.now();

      // Small delay to let initial render happen
      await new Promise(resolve => setTimeout(resolve, 500));

      while (true) {
        const elapsedTime = Date.now() - startTime;

        // Check for timeout
        if (elapsedTime > CONFIG.MAX_RUNTIME_MS) {
          updateStatus('⏱️ Stopped: maximum runtime reached');
          log('Maximum runtime exceeded');
          break;
        }

        // Perform scroll
        scrollPageUp(scroller);
        scrollAttempts++;

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, CONFIG.STEP_INTERVAL_MS));

        // Calculate idle time
        const idleTime = Date.now() - lastMutationTime;
        const atTop = isAtTop(scroller);
        const currentScroll = Math.round(scroller.scrollTop || 0);

        // Update status with detailed info
        updateStatus(
          `${atTop ? '✓ At top' : '⬆️ Scrolling'} • ` +
          `Idle: ${Math.round(idleTime / 1000)}s • ` +
          `Y: ${currentScroll}px • ` +
          `Attempts: ${scrollAttempts}`
        );

        // Check if we're done
        if (atTop && idleTime >= CONFIG.RENDER_IDLE_MS) {
          updateStatus('✅ Reached beginning (content stable)');
          log('Successfully reached top. Scroll attempts:', scrollAttempts);
          break;
        }
      }
    } catch (error) {
      logError('Error during scroll:', error);
      updateStatus('❌ Error occurred (see console)');
    } finally {
      observer.disconnect();
      button.disabled = false;
      button.textContent = 'Run Again';

      // Reset button text after delay
      setTimeout(() => {
        button.textContent = 'Start Up-Scroll';
      }, 3000);
    }
  }

  // ---------- INITIALIZATION ----------
  function initialize() {
    log('Initializing script...');

    // Set up hotkey listener (only once)
    setupHotkey();

    // Initial UI creation
    const checkAndCreateUI = () => {
      if (document.readyState === 'complete' || document.body) {
        ensureUI();

        // Re-check UI at intervals (SPA may re-render)
        CONFIG.UI_RECHECK_INTERVALS.forEach(delay => {
          setTimeout(ensureUI, delay);
        });

        return true;
      }
      return false;
    };

    // Boot loop to ensure UI is created
    const bootInterval = setInterval(() => {
      if (checkAndCreateUI()) {
        clearInterval(bootInterval);
        log('Initialization complete');
      }
    }, CONFIG.BOOT_INTERVAL);

    // Stop boot loop after timeout
    setTimeout(() => {
      clearInterval(bootInterval);
      log('Boot loop stopped');
    }, CONFIG.BOOT_TIMEOUT);
  }

  // Start the script
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();