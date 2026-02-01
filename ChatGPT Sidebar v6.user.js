// ==UserScript==
// @name               ChatGPT Sidebar v6
// @namespace          ChatGPT Sidebar v6
// @version            5
// @author             okokdi
// @description        Enhanced question sidebar for ChatGPT with optimized performance, modern UI, and smart navigation. Automatically collects questions from the current chat and displays them in a sidebar for quick navigation.
// @license            GPL-3.0-or-later
// @source             https://github.com/JianJroh/chatgpt-question-navigator.git
// @supportURL         https://github.com/JianJroh/chatgpt-question-navigator/issues
// @match              https://chatgpt.com/*
// @match              https://chat.openai.com/*
// @grant              none
// @run-at             document-idle
// ==/UserScript==

(function() {
  'use strict';

  console.log('[ChatGPT Navigator v5] Initializing...');

  // ---------- Configuration ----------
  const CONFIG = {
    DOM_MARK: 'data-chatgpt-question-directory',
    APP_WIDTH: '12vw',
    MAX_LIST_HEIGHT: '50vh',
    SCROLL_MARGIN_TOP: 0,
    CHECK_INTERVAL: 600,
    DEBOUNCE_SCROLL: 100,
    DEBOUNCE_UPDATE: 150,
    SELECTORS: {
      CHAT_CONTAINER: '.flex.flex-col.text-sm',
      MESSAGE_AUTHOR: '[data-message-author-role]',
      MAIN: 'main'
    }
  };

  // ---------- Utility Functions ----------
  const Utils = {
    queryChatContainer() {
      const main = document.querySelector(CONFIG.SELECTORS.MAIN);
      return main?.querySelector(CONFIG.SELECTORS.CHAT_CONTAINER);
    },

    queryQuestionElements() {
      const container = this.queryChatContainer();
      if (!container) return [];

      return Array.from(container.children)
        .filter(child => child.hasAttribute('data-testid'))
        .filter((_, index) => index % 2 === 0);
    },

    extractQuestionText(element) {
      const authorElement = element.querySelector(CONFIG.SELECTORS.MESSAGE_AUTHOR);
      return authorElement?.innerText?.trim() || '';
    },

    isSharePage() {
      return location.pathname.startsWith('/share/');
    },

    getConversationId() {
      const match = location.pathname.match(/\/c\/(.*)/);
      return match?.[1] ?? null;
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
    },

    throttle(func, limit) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }
  };

  // ---------- State Management ----------
  class AppState {
    constructor() {
      this.conversationId = null;
      this.loaded = false;
      this.shadowRoot = null;
      this.questions = [];
      this.activeIndex = null;
      this.isOpen = true;
      this.isHovering = false;
    }

    reset() {
      this.loaded = false;
      this.questions = [];
      this.activeIndex = null;
      console.log('[ChatGPT Navigator] State reset');
    }

    shouldReload(newConversationId, hasQuestions) {
      return this.conversationId !== newConversationId || !hasQuestions;
    }

    updateActiveIndex(index) {
      if (index !== this.activeIndex) {
        this.activeIndex = index;
        return true;
      }
      return false;
    }
  }

  // ---------- Component Manager ----------
  class ComponentManager {
    constructor(state) {
      this.state = state;
      this.containerElement = null;
      this.listElement = null;
      this.toggleBtnElement = null;
      this.observers = [];
      this.updateQuestionsDebounced = Utils.debounce(
        this.updateQuestions.bind(this),
        CONFIG.DEBOUNCE_UPDATE
      );
    }

    createShadowDOM() {
      const container = document.createElement('div');
      container.setAttribute(CONFIG.DOM_MARK, '');
      container.attachShadow({ mode: 'open' });

      const shadowRoot = container.shadowRoot;
      this.injectStyles(shadowRoot);
      this.createUI(shadowRoot);

      return container;
    }

    injectStyles(shadowRoot) {
      const style = document.createElement('style');
      style.textContent = `
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :host {
          --app-width: ${CONFIG.APP_WIDTH};
          --max-height: ${CONFIG.MAX_LIST_HEIGHT};
          --primary-color: #19C37D;
          --text-primary: #374151;
          --text-secondary: #6B7280;
          --bg-white: rgba(255, 255, 255, 0.95);
          --shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          position: fixed;
          top: 10vh;
          right: 16px;
          padding: 8px 8px 0;
          border-radius: 8px;
          background: var(--bg-white);
          backdrop-filter: blur(10px);
          box-shadow: var(--shadow);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 9999;
        }

        :host(:hover) {
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        }

        .container {
          width: var(--app-width);
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .container.collapsed {
          width: 22px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 8px;
          user-select: none;
        }

        .title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          overflow: hidden;
          white-space: nowrap;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .toggle-btn {
          cursor: pointer;
          opacity: 1;
          transition: all 0.2s ease;
          font-size: 18px;
          line-height: 1;
        }

        .toggle-btn:hover {
          transform: scale(1.15);
        }

        .toggle-btn:active {
          transform: scale(0.95);
        }

        .toggle-btn.hidden {
          opacity: 0.5;
          filter: grayscale(1);
        }

        .list-wrapper {
          position: relative;
        }

        .list-wrapper::after {
          content: '';
          position: absolute;
          bottom: 0;
          right: 4px;
          width: 100%;
          height: 0.7em;
          background: linear-gradient(to top, var(--bg-white) 10%, rgba(255,255,255,0.2));
          pointer-events: none;
          transition: opacity 0.2s;
        }

        .question-list {
          max-height: var(--max-height);
          overflow-y: auto;
          list-style: disc inside;
          padding: 0;
          scrollbar-width: thin;
        }

        .question-list::-webkit-scrollbar {
          width: 4px;
        }

        .question-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .question-list::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .question-list:hover::-webkit-scrollbar-thumb {
          background: rgba(209, 213, 219, 0.8);
        }

        .question-list::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.9);
        }

        .question-item {
          font-size: 12px;
          line-height: 1.4;
          padding: 6px 8px 6px 0;
          cursor: pointer;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          color: var(--text-secondary);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .question-item:hover {
          color: var(--primary-color);
          background: rgba(25, 195, 125, 0.05);
          padding-left: 4px;
          transform: translateX(2px);
        }

        .question-item:active {
          transform: translateX(0);
        }

        .question-item.active {
          color: var(--primary-color);
          font-weight: 600;
        }

        .question-item:last-of-type {
          padding-bottom: 0.7em;
        }

        .collapsed .question-item {
          padding-left: 8px;
        }

        .count-badge {
          display: inline-block;
          margin-left: 6px;
          padding: 2px 6px;
          background: var(--primary-color);
          color: white;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
          line-height: 1;
        }
      `;
      shadowRoot.appendChild(style);
    }

    createUI(shadowRoot) {
      this.containerElement = document.createElement('div');
      this.containerElement.className = 'container';

      const header = document.createElement('div');
      header.className = 'header';

      const title = document.createElement('div');
      title.className = 'title';
      title.innerHTML = '📄 Questions <span class="count-badge" id="count">0</span>';

      this.toggleBtnElement = document.createElement('div');
      this.toggleBtnElement.className = 'toggle-btn';
      this.toggleBtnElement.textContent = '👁️';
      this.toggleBtnElement.title = 'Toggle visibility';
      this.toggleBtnElement.addEventListener('click', () => this.toggleVisibility());

      header.appendChild(title);
      header.appendChild(this.toggleBtnElement);

      const listWrapper = document.createElement('div');
      listWrapper.className = 'list-wrapper';

      this.listElement = document.createElement('ul');
      this.listElement.className = 'question-list';
      this.listElement.addEventListener('click', (e) => this.handleQuestionClick(e));

      listWrapper.appendChild(this.listElement);
      this.containerElement.appendChild(header);
      this.containerElement.appendChild(listWrapper);

      shadowRoot.appendChild(this.containerElement);
      this.state.shadowRoot = shadowRoot;
    }

    toggleVisibility() {
      this.state.isOpen = !this.state.isOpen;
      this.updateUI();
      console.log('[ChatGPT Navigator] Visibility toggled:', this.state.isOpen);
    }

    handleQuestionClick(event) {
      if (event.target.tagName === 'LI') {
        const index = parseInt(event.target.dataset.index);
        const questionElements = Utils.queryQuestionElements();
        const targetElement = questionElements[index];

        if (targetElement) {
          // Set scroll margin for smooth scrolling
          if (!Utils.isSharePage()) {
            questionElements.forEach(el => {
              el.style.scrollMarginTop = '56px';
            });
          }

          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });

          console.log('[ChatGPT Navigator] Navigated to question:', index);
        }
      }
    }

    updateQuestions() {
      const questionElements = Utils.queryQuestionElements();
      const newQuestions = questionElements
        .map(el => Utils.extractQuestionText(el))
        .filter(text => text.length > 0);

      // Only update if questions changed
      if (JSON.stringify(newQuestions) !== JSON.stringify(this.state.questions)) {
        this.state.questions = newQuestions;
        this.renderQuestions();
        this.setupScrollObserver();
        this.updateCountBadge();
        console.log('[ChatGPT Navigator] Questions updated:', newQuestions.length);
      }
    }

    updateCountBadge() {
      const countBadge = this.state.shadowRoot?.getElementById('count');
      if (countBadge) {
        countBadge.textContent = this.state.questions.length;
      }
    }

    renderQuestions() {
      if (!this.listElement) return;

      this.listElement.innerHTML = '';

      this.state.questions.forEach((question, index) => {
        const li = document.createElement('li');
        li.className = 'question-item';
        li.textContent = question;
        li.dataset.index = index;
        li.title = question; // Show full text on hover

        if (index === this.state.activeIndex) {
          li.classList.add('active');
        }

        this.listElement.appendChild(li);
      });
    }

    setupScrollObserver() {
      this.cleanupObservers();

      const chatContainer = Utils.queryChatContainer();
      const scrollContainer = chatContainer?.parentElement;

      if (!scrollContainer) return;

      const updateActiveIndex = Utils.debounce(() => {
        const questionElements = Utils.queryQuestionElements();
        const topThreshold = Utils.isSharePage() ? CONFIG.SCROLL_MARGIN_TOP : 0;

        const index = questionElements.findIndex(
          el => el.getBoundingClientRect().top >= topThreshold
        );

        if (index > -1 && this.state.updateActiveIndex(index)) {
          this.renderQuestions();
        }
      }, CONFIG.DEBOUNCE_SCROLL);

      scrollContainer.addEventListener('scroll', updateActiveIndex, { passive: true });
      this.observers.push(() => {
        scrollContainer.removeEventListener('scroll', updateActiveIndex);
      });

      // Initial active index update
      updateActiveIndex();
    }

    updateUI() {
      if (!this.containerElement) return;

      const isVisible = this.state.isOpen || this.state.isHovering;
      this.containerElement.classList.toggle('collapsed', !isVisible);

      if (this.toggleBtnElement) {
        this.toggleBtnElement.classList.toggle('hidden', !isVisible);
      }
    }

    cleanupObservers() {
      this.observers.forEach(cleanup => cleanup());
      this.observers = [];
    }

    destroy() {
      this.cleanupObservers();
      const element = document.querySelector(`[${CONFIG.DOM_MARK}]`);
      element?.remove();
      console.log('[ChatGPT Navigator] Component destroyed');
    }
  }

  // ---------- Main Application ----------
  class QuestionNavigator {
    constructor() {
      this.state = new AppState();
      this.manager = null;
      this.checkInterval = null;
    }

    init() {
      this.checkInterval = setInterval(() => this.check(), CONFIG.CHECK_INTERVAL);
      console.log('[ChatGPT Navigator v5] Initialized successfully');
    }

    check() {
      const currentConversationId = Utils.getConversationId();
      const questionElements = Utils.queryQuestionElements();
      const hasQuestions = questionElements.length > 0;

      // Check if we need to reload (new conversation or no questions)
      if (this.state.shouldReload(currentConversationId, hasQuestions)) {
        this.state.conversationId = currentConversationId;
        this.unload();
        this.state.reset();
      }

      // Load if we have questions and haven't loaded yet
      if (!this.state.loaded && hasQuestions) {
        this.load();
        this.state.loaded = true;

        // Set scroll margins for share pages
        if (Utils.isSharePage()) {
          questionElements.forEach(el => {
            el.style.scrollMarginTop = `${CONFIG.SCROLL_MARGIN_TOP}px`;
          });
        }
      }

      // Update questions if already loaded
      if (this.state.loaded && hasQuestions) {
        this.manager?.updateQuestionsDebounced();
      }
    }

    load() {
      // Prevent duplicate loading
      if (document.querySelector(`[${CONFIG.DOM_MARK}]`)) {
        console.log('[ChatGPT Navigator] Already loaded, skipping...');
        return;
      }

      this.manager = new ComponentManager(this.state);
      const container = this.manager.createShadowDOM();
      document.body.appendChild(container);

      this.manager.updateQuestions();
      console.log('[ChatGPT Navigator] Component loaded');
    }

    unload() {
      this.manager?.destroy();
      this.manager = null;
    }

    destroy() {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      this.unload();
      console.log('[ChatGPT Navigator] Application destroyed');
    }
  }

  // ---------- Initialization ----------
  const app = new QuestionNavigator();
  app.init();

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => app.destroy());

  console.log('[ChatGPT Navigator v5] Ready');

})();