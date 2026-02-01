// ==UserScript==
// @name         ChatGPT / Claude / Copilot / Gemini AI Chat Exporter by RevivalStack v4
// @namespace    https://github.com/revivalstack/chatgpt-exporter
// @version      4
// @description  Export your ChatGPT, Claude, Copilot or Gemini chat into a properly and elegantly formatted Markdown or JSON. Settings menu integrated into extension UI.
// @author       Mic Mejia (Refactored by Google Gemini, Optimized by Claude)
// @homepage     https://github.com/micmejia
// @license      MIT License
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://copilot.microsoft.com/*
// @match        https://gemini.google.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @downloadURL https://update.greasyfork.org/scripts/541051/ChatGPT%20%20Claude%20%20Copilot%20%20Gemini%20AI%20Chat%20Exporter%20by%20RevivalStack.user.js
// @updateURL https://update.greasyfork.org/scripts/541051/ChatGPT%20%20Claude%20%20Copilot%20%20Gemini%20AI%20Chat%20Exporter%20by%20RevivalStack.meta.js
// ==/UserScript==

(function () {
  "use strict";

  // --- Global Constants ---
  const EXPORTER_VERSION = "4";
  const EXPORT_CONTAINER_ID = "export-controls-container";
  const OUTLINE_CONTAINER_ID = "export-outline-container";
  const SETTINGS_MENU_ID = "export-settings-menu";
  const DOM_READY_TIMEOUT = 1000;
  const EXPORT_BUTTON_TITLE_PREFIX = `AI Chat Exporter v${EXPORTER_VERSION}`;
  const ALERT_CONTAINER_ID = "exporter-alert-container";
  const HIDE_ALERT_FLAG = "exporter_hide_scroll_alert";
  const ALERT_AUTO_CLOSE_DURATION = 30000;
  const OUTLINE_COLLAPSED_STATE_KEY = "outline_is_collapsed";
  const AUTOSCROLL_INITIAL_DELAY = 2000;
  const OUTLINE_TITLE_ID = "ai-chat-exporter-outline-title";
  const OUTPUT_FILE_FORMAT_DEFAULT = "{platform}_{title}_{timestampLocal}";
  const GM_OUTPUT_FILE_FORMAT = "aiChatExporter_fileFormat";

  // Performance optimization: Debounce delay for frequently called functions
  const DEBOUNCE_DELAY = 250;
  const SCROLL_DEBOUNCE_DELAY = 500;

  // Font Stack for UI Elements
  const FONT_STACK = `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`;

  // Common styles for the container and buttons
  const COMMON_CONTROL_PROPS = {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "9999",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    fontSize: "14px",
    cursor: "pointer",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    fontFamily: FONT_STACK,
  };

  const SETTINGS_MENU_PROPS = {
    position: "fixed",
    bottom: "70px",
    right: "20px",
    zIndex: "10000",
    backgroundColor: "#fff",
    color: "#333",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    borderRadius: "8px",
    padding: "20px",
    width: "400px",
    maxWidth: "90vw",
    fontFamily: FONT_STACK,
    fontSize: "14px",
    display: "none",
  };

  const OUTLINE_CONTAINER_PROPS = {
    position: "fixed",
    bottom: "70px",
    right: "20px",
    zIndex: "9998",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    fontSize: "12px",
    borderRadius: "8px",
    backgroundColor: "#fff",
    color: "#333",
    maxHeight: "350px",
    width: "300px",
    padding: "10px",
    border: "1px solid #ddd",
    fontFamily: FONT_STACK,
    display: "flex",
    flexDirection: "column",
    transition: "max-height 0.3s ease-in-out, padding 0.3s ease-in-out, opacity 0.3s ease-in-out",
    opacity: "1",
    transformOrigin: "bottom right",
  };

  const OUTLINE_CONTAINER_COLLAPSED_PROPS = {
    maxHeight: "30px",
    padding: "5px 10px",
    overflow: "hidden",
    opacity: "0.9",
  };

  const OUTLINE_HEADER_PROPS = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "5px",
    paddingBottom: "5px",
    borderBottom: "1px solid #eee",
    fontWeight: "bold",
    cursor: "pointer",
  };

  const OUTLINE_TITLE_PROPS = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "5px",
    paddingBottom: "5px",
    borderBottom: "1px solid #eee",
    wordWrap: "break-word",
  };

  const SELECT_ALL_CONTAINER_PROPS = {
    display: "flex",
    alignItems: "center",
    padding: "5px 0",
    marginBottom: "5px",
    borderBottom: "1px solid #eee",
  };

  const SEARCH_INPUT_PROPS = {
    width: "calc(100% - 20px)",
    padding: "6px 10px",
    margin: "5px 0 10px 0",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "12px",
    fontFamily: FONT_STACK,
  };

  const NO_MATCH_MESSAGE_PROPS = {
    textAlign: "center",
    fontStyle: "italic",
    fontWeight: "bold",
    color: "#666",
    padding: "10px 0",
  };

  const OUTLINE_ITEM_PROPS = {
    display: "flex",
    alignItems: "center",
    marginBottom: "3px",
    lineHeight: "1.3",
  };

  const OUTLINE_CHECKBOX_PROPS = {
    marginRight: "5px",
    cursor: "pointer",
  };

  const OUTLINE_TOGGLE_BUTTON_PROPS = {
    background: "none",
    border: "none",
    fontSize: "16px",
    cursor: "pointer",
    padding: "0 5px",
    color: "#5b3f87",
  };

  const BUTTON_BASE_PROPS = {
    padding: "10px 14px",
    backgroundColor: "#5b3f87",
    color: "white",
    border: "none",
    cursor: "pointer",
    borderRadius: "8px",
  };

  const BUTTON_SPACING_PROPS = {
    marginLeft: "8px",
  };

  const ALERT_PROPS = {
    position: "fixed",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "10000",
    backgroundColor: "rgba(91, 63, 135, 0.9)",
    color: "white",
    padding: "15px 20px",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "flex-start",
    fontSize: "14px",
    opacity: "1",
    transition: "opacity 0.5s ease-in-out",
    fontFamily: FONT_STACK,
  };

  const ALERT_MESSAGE_ROW_PROPS = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: "10px",
  };

  const ALERT_CLOSE_BUTTON_PROPS = {
    background: "none",
    border: "none",
    color: "white",
    fontSize: "20px",
    cursor: "pointer",
    marginLeft: "15px",
    lineHeight: "1",
  };

  const ALERT_CHECKBOX_CONTAINER_PROPS = {
    display: "flex",
    alignItems: "center",
    width: "100%",
  };

  const ALERT_CHECKBOX_PROPS = {
    marginRight: "5px",
  };

  // Hostname-Specific Selectors & Identifiers
  const CHATGPT = "chatgpt";
  const CHATGPT_HOSTNAMES = ["chat.openai.com", "chatgpt.com"];
  const CHATGPT_TITLE_REPLACE_TEXT = " - ChatGPT";
  const CHATGPT_ARTICLE_SELECTOR = "article";
  const CHATGPT_HEADER_SELECTOR = "h5";
  const CHATGPT_TEXT_DIV_SELECTOR = "div.text-base";
  const CHATGPT_USER_MESSAGE_INDICATOR = "you said";
  const CHATGPT_POPUP_DIV_CLASS = "popover";
  const CHATGPT_BUTTON_SPECIFIC_CLASS = "text-sm";

  const GEMINI = "gemini";
  const GEMINI_HOSTNAMES = ["gemini.google.com"];
  const GEMINI_TITLE_REPLACE_TEXT = "Gemini - ";
  const GEMINI_MESSAGE_ITEM_SELECTOR = "user-query, model-response";
  const GEMINI_SIDEBAR_ACTIVE_CHAT_SELECTOR = 'div[data-test-id="conversation"].selected .conversation-title';

  const CLAUDE = "claude";
  const CLAUDE_HOSTNAMES = ["claude.ai"];
  const CLAUDE_MESSAGE_SELECTOR = ".font-claude-message:not(#markdown-artifact), .font-user-message";
  const CLAUDE_USER_MESSAGE_CLASS = "font-user-message";
  const CLAUDE_THINKING_BLOCK_CLASS = "transition-all";
  const CLAUDE_ARTIFACT_BLOCK_CELL = ".artifact-block-cell";

  const COPILOT = "copilot";
  const COPILOT_HOSTNAMES = ["copilot.microsoft.com"];
  const COPILOT_MESSAGE_SELECTOR = '[data-content="user-message"], [data-content="ai-message"]';
  const COPILOT_USER_MESSAGE_SELECTOR = '[data-content="user-message"]';
  const COPILOT_BOT_MESSAGE_SELECTOR = '[data-content="ai-message"]';

  const HOSTNAME = window.location.hostname;
  const CURRENT_PLATFORM = (() => {
    if (CHATGPT_HOSTNAMES.some((host) => HOSTNAME.includes(host))) return CHATGPT;
    if (CLAUDE_HOSTNAMES.some((host) => HOSTNAME.includes(host))) return CLAUDE;
    if (COPILOT_HOSTNAMES.some((host) => HOSTNAME.includes(host))) return COPILOT;
    if (GEMINI_HOSTNAMES.some((host) => HOSTNAME.includes(host))) return GEMINI;
    return "unknown";
  })();

  // Markdown Formatting Constants
  const DEFAULT_CHAT_TITLE = "chat";
  const MARKDOWN_TOC_PLACEHOLDER_LINK = "#table-of-contents";
  const MARKDOWN_BACK_TO_TOP_LINK = `___\n###### [top](${MARKDOWN_TOC_PLACEHOLDER_LINK})\n`;
  const PARAGRAPH_FILTER_PARENT_NODES = ["TH", "TR"];

  const MESSAGE_LIST_PROPS = {
    overflowY: "auto",
    flexGrow: "1",
    paddingRight: "5px",
  };

  // --- Utility Functions ---
  const Utils = {
    // Performance: Debounce function to limit rapid calls
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

    // Cache for compiled regex patterns
    _regexCache: new Map(),

    // Get or create cached regex
    getCachedRegex(pattern, flags = 'i') {
      const key = `${pattern}_${flags}`;
      if (!this._regexCache.has(key)) {
        try {
          this._regexCache.set(key, new RegExp(pattern, flags));
        } catch (e) {
          return null;
        }
      }
      return this._regexCache.get(key);
    },

    // Clear regex cache if it gets too large
    clearRegexCache() {
      if (this._regexCache.size > 50) {
        this._regexCache.clear();
      }
    },

    slugify(str, toLowerCase = true, maxLength = 120) {
      if (typeof str !== "string") return "invalid-filename";
      if (toLowerCase) str = str.toLocaleLowerCase();
      return str
        .replace(/[^a-zA-Z0-9\-_.+]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .replace(/^$/, "invalid-filename")
        .slice(0, maxLength);
    },

    formatLocalTime(d) {
      const pad = (n) => String(n).padStart(2, "0");
      const tzOffsetMin = -d.getTimezoneOffset();
      const sign = tzOffsetMin >= 0 ? "+" : "-";
      const absOffset = Math.abs(tzOffsetMin);
      const offsetHours = pad(Math.floor(absOffset / 60));
      const offsetMinutes = pad(absOffset % 60);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}${sign}${offsetHours}${offsetMinutes}`;
    },

    truncate(str, len = 70) {
      return str.length <= len ? str : str.slice(0, len).trim() + "…";
    },

    escapeMd(text) {
      return text.replace(/[|\\`*_{}\[\]()#+\-!>]/g, "\\$&");
    },

    downloadFile(filename, text, mimeType = "text/plain;charset=utf-8") {
      const blob = new Blob([text], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },

    applyStyles(element, styles) {
      Object.assign(element.style, styles);
    },

    formatFileName(format, title, tags, ext) {
      const tagsArray = Array.isArray(tags) ? tags : [];
      const replacements = {
        "{exporter}": EXPORTER_VERSION,
        "{platform}": CURRENT_PLATFORM,
        "{title}": title.slice(0, 70).toLocaleLowerCase(),
        "{timestamp}": new Date().toISOString(),
        "{timestampLocal}": Utils.formatLocalTime(new Date()),
        "{tags}": tagsArray.join("-").toLocaleLowerCase(),
      };

      for (let i = 0; i < 9; i++) {
        replacements[`{tag${i + 1}}`] = tagsArray[i] ? tagsArray[i].toLocaleLowerCase() : "";
      }

      let formattedFilename = format;
      for (const [placeholder, value] of Object.entries(replacements)) {
        formattedFilename = formattedFilename.split(placeholder).join(value);
      }

      return Utils.slugify(`${formattedFilename}.${ext}`, false);
    },

    parseChatTitleAndTags(rawTitle) {
      const tags = [];
      let cleanedTitle = rawTitle.trim();
      const tagRegex = /(^|\s+)#(\S+)/g;
      let match;

      while ((match = tagRegex.exec(cleanedTitle)) !== null) {
        const tagName = match[2];
        if (!/^\d+$/.test(tagName)) {
          tags.push(tagName);
        }
      }

      cleanedTitle = cleanedTitle.replace(/(^|\s+)#\S+/g, " ").trim();
      cleanedTitle = cleanedTitle.replace(/\s+/g, " ").trim();

      return { title: cleanedTitle, tags: tags };
    },
  };

  // --- Inlined Turndown.js (Optimized) ---
  class TurndownService {
    constructor(options = {}) {
      this.rules = [];
      this.options = {
        headingStyle: "atx",
        hr: "___",
        bulletListMarker: "-",
        codeBlockStyle: "fenced",
        ...options,
      };
    }

    addRule(key, rule) {
      this.rules.push({ key, ...rule });
    }

    turndown(rootNode) {
      const process = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
        if (node.nodeType !== Node.ELEMENT_NODE) return "";

        const rule = this.rules.find((r) => {
          if (typeof r.filter === "string") return r.filter === node.nodeName.toLowerCase();
          if (Array.isArray(r.filter)) return r.filter.includes(node.nodeName.toLowerCase());
          if (typeof r.filter === "function") return r.filter(node);
          return false;
        });

        const content = Array.from(node.childNodes).map((n) => process(n)).join("");
        return rule ? rule.replacement(content, node, this.options) : content;
      };

      let parsedRootNode = rootNode;
      if (typeof rootNode === "string") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rootNode, "text/html");
        parsedRootNode = doc.body || doc.documentElement;
      }

      const output = Array.from(parsedRootNode.childNodes).map((n) => process(n)).join("");
      return output.trim().replace(/\n{3,}/g, "\n\n");
    }
  }

  // --- Core Export Logic ---
  const ChatExporter = {
    _currentChatData: null,
    _selectedMessageIds: new Set(),
    _turndownService: null,

    // Initialize turndown service once and reuse
    getTurndownService() {
      if (!this._turndownService) {
        this._turndownService = new TurndownService();
        this.setupTurndownRules(this._turndownService);
      }
      return this._turndownService;
    },

    extractChatGPTChatData(doc) {
      const articles = [...doc.querySelectorAll(CHATGPT_ARTICLE_SELECTOR)];
      if (articles.length === 0) return null;

      let title = doc.title.replace(CHATGPT_TITLE_REPLACE_TEXT, "").trim() || DEFAULT_CHAT_TITLE;
      const messages = [];
      let chatIndex = 1;

      for (const article of articles) {
        const seenDivs = new Set();
        const header = article.querySelector(CHATGPT_HEADER_SELECTOR)?.textContent?.trim() || "";
        const textDivs = article.querySelectorAll(CHATGPT_TEXT_DIV_SELECTOR);
        const textParts = [];

        textDivs.forEach((div) => {
          const key = div.innerText.trim();
          if (key && !seenDivs.has(key)) {
            seenDivs.add(key);
            textParts.push(key);
          }
        });

        const fullText = textParts.join("\n");
        if (!fullText.trim()) continue;

        const isUser = header.toLowerCase().includes(CHATGPT_USER_MESSAGE_INDICATOR);
        const author = isUser ? "user" : "ai";
        const messageId = `${author}-${chatIndex}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        messages.push({
          id: messageId,
          author: author,
          contentHtml: article,
          contentText: fullText.trim(),
          timestamp: new Date(),
          originalIndex: chatIndex,
        });

        if (!isUser) chatIndex++;
      }

      const _parsedTitle = Utils.parseChatTitleAndTags(title);

      return {
        _raw_title: title,
        title: _parsedTitle.title,
        tags: _parsedTitle.tags,
        author: CURRENT_PLATFORM,
        messages: messages,
        messageCount: messages.filter((m) => m.author === "user").length,
        exportedAt: new Date(),
        exporterVersion: EXPORTER_VERSION,
        threadUrl: window.location.href,
      };
    },

    extractClaudeChatData(doc) {
      const messageItems = [...doc.querySelectorAll(CLAUDE_MESSAGE_SELECTOR)];
      if (messageItems.length === 0) return null;

      const messages = [];
      let chatIndex = 1;
      const chatTitle = doc.title || DEFAULT_CHAT_TITLE;

      messageItems.forEach((item) => {
        const isUser = item.classList.contains(CLAUDE_USER_MESSAGE_CLASS);
        const author = isUser ? "user" : "ai";
        let messageContentHtml = null;
        let messageContentText = "";

        if (isUser) {
          messageContentHtml = item;
          messageContentText = item.innerText.trim();
        } else {
          const claudeResponseContent = document.createElement("div");
          Array.from(item.children).forEach((child) => {
            const isThinkingBlock = child.className.includes(CLAUDE_THINKING_BLOCK_CLASS);
            const isArtifactBlock =
              (child.className.includes("pt-3") && child.className.includes("pb-3")) ||
              child.querySelector(CLAUDE_ARTIFACT_BLOCK_CELL);

            if (!isThinkingBlock && !isArtifactBlock) {
              const contentGrid = child.querySelector(".grid-cols-1");
              if (contentGrid) {
                claudeResponseContent.appendChild(contentGrid.cloneNode(true));
              }
            }
          });
          messageContentHtml = claudeResponseContent;
          messageContentText = claudeResponseContent.innerText.trim();
        }

        if (messageContentText) {
          const messageId = `${author}-${chatIndex}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

          messages.push({
            id: messageId,
            author: author,
            contentHtml: messageContentHtml,
            contentText: messageContentText,
            timestamp: new Date(),
            originalIndex: chatIndex,
          });

          if (!isUser) chatIndex++;
        }
      });

      const _parsedTitle = Utils.parseChatTitleAndTags(chatTitle);

      return {
        _raw_title: chatTitle,
        title: _parsedTitle.title,
        tags: _parsedTitle.tags,
        author: CURRENT_PLATFORM,
        messages: messages,
        messageCount: messages.filter((m) => m.author === "user").length,
        exportedAt: new Date(),
        exporterVersion: EXPORTER_VERSION,
        threadUrl: window.location.href,
      };
    },

    extractCopilotChatData(doc) {
      const messageItems = [...doc.querySelectorAll(COPILOT_MESSAGE_SELECTOR)];
      if (messageItems.length === 0) return null;

      const messages = [];
      let chatIndex = 1;
      let rawTitle = "";

      const selected = doc.querySelector('[role="option"][aria-selected="true"]');
      if (selected) {
        rawTitle =
          selected.querySelector("p")?.textContent.trim() ||
          (selected.getAttribute("aria-label") || "").split(",").slice(1).join(",").trim();
      }
      if (!rawTitle) {
        rawTitle = (doc.title || "")
          .replace(/^\s*Microsoft[_\s-]*Copilot.*$/i, "")
          .replace(/\s*[-–|]\s*Copilot.*$/i, "")
          .trim();
      }
      if (!rawTitle) rawTitle = "Copilot Conversation";

      for (const item of messageItems) {
        const isUser = item.matches(COPILOT_USER_MESSAGE_SELECTOR);
        const author = isUser ? "user" : "ai";
        const messageContentElem = isUser
          ? item.querySelector("div")
          : item.querySelector(":scope > div:nth-child(2)");

        if (!messageContentElem) continue;

        const messageId = `${author}-${chatIndex}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        messages.push({
          id: messageId,
          author: author,
          contentHtml: messageContentElem.cloneNode(true),
          contentText: messageContentElem.innerText.trim(),
          timestamp: new Date(),
          originalIndex: chatIndex,
        });

        if (author === "ai") chatIndex++;
      }

      const _parsedTitle = Utils.parseChatTitleAndTags(rawTitle);

      return {
        _raw_title: rawTitle,
        title: _parsedTitle.title,
        tags: _parsedTitle.tags,
        author: COPILOT,
        messages: messages,
        messageCount: messages.filter((m) => m.author === "user").length,
        exportedAt: new Date(),
        exporterVersion: EXPORTER_VERSION,
        threadUrl: window.location.href,
      };
    },

    extractGeminiChatData(doc) {
      const messageItems = [...doc.querySelectorAll(GEMINI_MESSAGE_ITEM_SELECTOR)];
      if (messageItems.length === 0) return null;

      let title = DEFAULT_CHAT_TITLE;
      const sidebarActiveChatItem = doc.querySelector(GEMINI_SIDEBAR_ACTIVE_CHAT_SELECTOR);

      if (sidebarActiveChatItem && sidebarActiveChatItem.textContent.trim()) {
        title = sidebarActiveChatItem.textContent.trim();
      } else {
        title = doc.title;
      }

      if (title.startsWith(GEMINI_TITLE_REPLACE_TEXT)) {
        title = title.replace(GEMINI_TITLE_REPLACE_TEXT, "").trim();
      }

      const messages = [];
      let chatIndex = 1;

      for (const item of messageItems) {
        const tagName = item.tagName.toLowerCase();
        let author = "";
        let messageContentElem = null;

        if (tagName === "user-query") {
          author = "user";
          messageContentElem = item.querySelector("div.query-content");
        } else if (tagName === "model-response") {
          author = "ai";
          messageContentElem = item.querySelector("message-content");
        }

        if (!messageContentElem) continue;

        const messageId = `${author}-${chatIndex}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        messages.push({
          id: messageId,
          author: author,
          contentHtml: messageContentElem,
          contentText: messageContentElem.innerText.trim(),
          timestamp: new Date(),
          originalIndex: chatIndex,
        });

        if (author === "ai") chatIndex++;
      }

      if (title === DEFAULT_CHAT_TITLE && messages.length > 0 && messages[0].author === "user") {
        const firstUserMessage = messages[0].contentText;
        const words = firstUserMessage.split(/\s+/).filter((word) => word.length > 0);

        if (words.length > 0) {
          let generatedTitle = words.slice(0, 7).join(" ");
          generatedTitle = generatedTitle.replace(/[,.;:!?\-+]$/, "").trim();

          if (generatedTitle.length < 5 && words.length > 1) {
            generatedTitle = words.slice(0, Math.min(words.length, 10)).join(" ");
            generatedTitle = generatedTitle.replace(/[,.;:!?\-+]$/, "").trim();
          }

          title = generatedTitle || DEFAULT_CHAT_TITLE;
        }
      }

      const _parsedTitle = Utils.parseChatTitleAndTags(title);

      return {
        _raw_title: title,
        title: _parsedTitle.title,
        tags: _parsedTitle.tags,
        author: CURRENT_PLATFORM,
        messages: messages,
        messageCount: messages.filter((m) => m.author === "user").length,
        exportedAt: new Date(),
        exporterVersion: EXPORTER_VERSION,
        threadUrl: window.location.href,
      };
    },

    formatToMarkdown(chatData, turndownServiceInstance) {
      const tocParts = [];
      const contentParts = [];
      let exportChatIndex = 0;

      chatData.messages.forEach((msg) => {
        if (msg.author === "user") {
          exportChatIndex++;
          const preview = Utils.truncate(msg.contentText.replace(/\s+/g, " "), 70);
          tocParts.push(`- [${exportChatIndex}: ${Utils.escapeMd(preview)}](#chat-${exportChatIndex})`);
          contentParts.push(`### chat-${exportChatIndex}\n\n> ${msg.contentText.replace(/\n/g, "\n> ")}\n\n`);
        } else {
          try {
            const markdownContent = turndownServiceInstance.turndown(msg.contentHtml);
            contentParts.push(markdownContent + "\n\n" + MARKDOWN_BACK_TO_TOP_LINK);
          } catch (e) {
            console.error(`Error converting AI message ${msg.id} to Markdown:`, e);
            contentParts.push(`[CONVERSION ERROR: Failed to render this section. Original content below]\n\n\`\`\`\n${msg.contentText}\n\`\`\`\n`);
          }
        }
      });

      const localTime = Utils.formatLocalTime(chatData.exportedAt);
      const yaml = `---\ntitle: ${chatData.title}\ntags: [${chatData.tags.join(", ")}]\nauthor: ${chatData.author}\ncount: ${chatData.messageCount}\nexporter: ${EXPORTER_VERSION}\ndate: ${localTime}\nurl: ${chatData.threadUrl}\n---\n`;
      const tocBlock = `## Table of Contents\n\n${tocParts.join("\n")}\n\n`;
      const finalOutput = yaml + `\n# ${chatData.title}\n\n` + tocBlock + contentParts.join("") + "\n\n";

      const fileName = Utils.formatFileName(
        GM_getValue(GM_OUTPUT_FILE_FORMAT, OUTPUT_FILE_FORMAT_DEFAULT),
        chatData.title,
        chatData.tags,
        "md"
      );

      return { output: finalOutput, fileName: fileName };
    },

    formatToJSON(chatData, turndownServiceInstance) {
      const processMessageContent = (msg) => {
        if (msg.author === "user") return msg.contentText;

        try {
          return turndownServiceInstance.turndown(msg.contentHtml);
        } catch (e) {
          console.error(`Error converting AI message ${msg.id} to Markdown:`, e);
          return `[CONVERSION ERROR: Failed to render this section.]: ${msg.contentText}`;
        }
      };

      const jsonOutput = {
        title: chatData.title,
        tags: chatData.tags,
        author: chatData.author,
        count: chatData.messageCount,
        exporter: EXPORTER_VERSION,
        date: chatData.exportedAt.toISOString(),
        url: chatData.threadUrl,
        messages: chatData.messages.map((msg) => ({
          id: msg.id.split("-").slice(0, 2).join("-"),
          author: msg.author,
          content: processMessageContent(msg),
        })),
      };

      const fileName = Utils.formatFileName(
        GM_getValue(GM_OUTPUT_FILE_FORMAT, OUTPUT_FILE_FORMAT_DEFAULT),
        chatData.title,
        chatData.tags,
        "json"
      );

      return {
        output: JSON.stringify(jsonOutput, null, 2),
        fileName: fileName,
      };
    },

    setupTurndownRules(turndownServiceInstance) {
      if (CURRENT_PLATFORM === CHATGPT) {
        turndownServiceInstance.addRule("chatgptRemoveReactions", {
          filter: (node) =>
            node.nodeName === "DIV" &&
            node.querySelector(':scope > div:nth-child(1) > button[data-testid="copy-turn-action-button"]'),
          replacement: () => "",
        });

        turndownServiceInstance.addRule("chatgptRemoveH6ChatGPTSaid", {
          filter: (node) =>
            node.nodeName === "H6" &&
            node.classList.contains("sr-only") &&
            node.textContent.trim().toLowerCase().startsWith("chatgpt said"),
          replacement: () => "",
        });
      }

      if (CURRENT_PLATFORM === COPILOT) {
        turndownServiceInstance.addRule("copilotRemoveReactions", {
          filter: (node) => node.matches('[data-testid="message-item-reactions"]'),
          replacement: () => "",
        });

        turndownServiceInstance.addRule("copilotCodeBlock", {
          filter: (node) =>
            node.nodeName === "DIV" &&
            node.querySelector(":scope > div:nth-child(1) > span") &&
            node.querySelector(":scope > div:nth-child(2) > div > pre"),
          replacement: (content, node) => {
            const languageNode = node.querySelector(":scope > div:nth-child(1) > span");
            const language = languageNode ? languageNode.textContent.trim().toLowerCase() : "";
            const codeNode = node.querySelector(":scope > div:nth-child(2) > div > pre > code");

            if (!codeNode) return "";
            const codeText = codeNode.textContent || "";
            return "\n\n```" + language + "\n" + codeText + "\n```\n\n";
          },
        });

        turndownServiceInstance.addRule("copilotFooterLinks", {
          filter: (node) =>
            node.nodeName === "A" &&
            node.querySelector(":scope > span:nth-child(1)") &&
            node.querySelector(":scope > img:nth-child(2)") &&
            node.querySelector(":scope > span:nth-child(3)"),
          replacement: (content, node) => {
            const lastSpan = node.querySelector(":scope > span:nth-child(3)");
            const linkText = lastSpan ? lastSpan.textContent.trim() : node.getAttribute("href");
            return `[${linkText}](${node.getAttribute("href")}) `;
          },
        });
      }

      turndownServiceInstance.addRule("lineBreak", {
        filter: "br",
        replacement: () => "  \n",
      });

      turndownServiceInstance.addRule("heading", {
        filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
        replacement: (content, node) => {
          const hLevel = Number(node.nodeName.charAt(1));
          return `\n\n${"#".repeat(hLevel)} ${content}\n\n`;
        },
      });

      turndownServiceInstance.addRule("customLi", {
        filter: "li",
        replacement: function (content, node) {
          let processedContent = content.trim();

          if (processedContent.length > 0) {
            const lines = processedContent.split("\n");
            if (lines.length > 1 && /^\s*[-*+]|^[0-9]+\./.test(lines[1])) {
              processedContent = lines.join("\n\n").trim();
            }
          }

          let listItemMarkdown;
          if (node.parentNode.nodeName === "UL") {
            let indent = "";
            let liAncestorCount = 0;
            let parent = node.parentNode;

            while (parent) {
              if (parent.nodeName === "LI") liAncestorCount++;
              parent = parent.parentNode;
            }

            indent = "    ".repeat(liAncestorCount);
            listItemMarkdown = `${indent}${turndownServiceInstance.options.bulletListMarker} ${processedContent}`;
          } else if (node.parentNode.nodeName === "OL") {
            const siblings = Array.from(node.parentNode.children).filter((child) => child.nodeName === "LI");
            const index = siblings.indexOf(node);
            listItemMarkdown = `${index + 1}. ${processedContent}`;
          } else {
            listItemMarkdown = processedContent;
          }

          return listItemMarkdown + "\n";
        }.bind(turndownServiceInstance),
      });

      if (CURRENT_PLATFORM === CLAUDE) {
        turndownServiceInstance.addRule("claudeCodeBlock", {
          filter: (node) =>
            node.nodeName === "DIV" &&
            node.querySelector(":scope > div:nth-child(2)") &&
            node.querySelector(":scope > div:nth-child(3) > pre > code"),
          replacement: (content, node) => {
            const languageNode = node.querySelector(":scope > div:nth-child(2)");
            const language = languageNode ? languageNode.textContent.trim().toLowerCase() : "";
            const codeNode = node.querySelector(":scope > div:nth-child(3) > pre > code");

            if (!codeNode) return "";
            const codeText = codeNode.textContent || "";
            return "\n\n```" + language + "\n" + codeText + "\n```\n\n";
          },
        });
      }

      turndownServiceInstance.addRule("code", {
        filter: "code",
        replacement: (content, node) => {
          if (node.parentNode.nodeName === "PRE") return content;
          return `\`${content}\``;
        },
      });

      turndownServiceInstance.addRule("pre", {
        filter: "pre",
        replacement: (content, node) => {
          let lang = "";
          const geminiCodeBlockParent = node.closest(".code-block");

          if (geminiCodeBlockParent) {
            const geminiLanguageSpan = geminiCodeBlockParent.querySelector(".code-block-decoration span");
            if (geminiLanguageSpan && geminiLanguageSpan.textContent.trim()) {
              lang = geminiLanguageSpan.textContent.trim();
            }
          }

          if (!lang) {
            const chatgptLanguageDiv = node.querySelector(".flex.items-center.text-token-text-secondary");
            if (chatgptLanguageDiv) {
              lang = chatgptLanguageDiv.textContent.trim();
            }
          }

          const codeElement = node.querySelector("code");
          if (!codeElement) return content;
          const codeText = codeElement.textContent.trim();

          let prefix = "\n";
          const prevSibling = node.previousElementSibling;

          if (prevSibling && prevSibling.nodeName === "P") {
            const parentLi = prevSibling.closest("li");
            if (parentLi && parentLi.contains(node)) {
              prefix = "\n\n";
            }
          }

          return `${prefix}\`\`\`${lang}\n${codeText}\n\`\`\`\n`;
        },
      });

      turndownServiceInstance.addRule("strong", {
        filter: ["strong", "b"],
        replacement: (content) => `**${content}**`,
      });

      turndownServiceInstance.addRule("em", {
        filter: ["em", "i"],
        replacement: (content) => `_${content}_`,
      });

      turndownServiceInstance.addRule("blockQuote", {
        filter: "blockquote",
        replacement: (content) =>
          content.trim().split("\n").map((l) => `> ${l}`).join("\n"),
      });

      turndownServiceInstance.addRule("link", {
        filter: "a",
        replacement: (content, node) => `[${content}](${node.getAttribute("href")})`,
      });

      turndownServiceInstance.addRule("strikethrough", {
        filter: (node) => node.nodeName === "DEL",
        replacement: (content) => `~~${content}~~`,
      });

      turndownServiceInstance.addRule("table", {
        filter: "table",
        replacement: (content, node) => {
          const headerRows = Array.from(node.querySelectorAll("thead tr"));
          const bodyRows = Array.from(node.querySelectorAll("tbody tr"));
          const footerRows = Array.from(node.querySelectorAll("tfoot tr"));

          const allRowsContent = [];

          const getRowCellsContent = (rowElement) => {
            const cells = Array.from(rowElement.querySelectorAll("th, td"));
            return cells.map((cell) => cell.textContent.replace(/\s+/g, " ").trim());
          };

          if (headerRows.length > 0) allRowsContent.push(getRowCellsContent(headerRows[0]));
          bodyRows.forEach((row) => allRowsContent.push(getRowCellsContent(row)));
          footerRows.forEach((row) => allRowsContent.push(getRowCellsContent(row)));

          if (allRowsContent.length === 0) return "";

          const isFirstRowAHeader = headerRows.length > 0;
          const maxCols = Math.max(...allRowsContent.map((row) => row.length));

          const paddedRows = allRowsContent.map((row) => {
            const paddedRow = [...row];
            while (paddedRow.length < maxCols) paddedRow.push("");
            return paddedRow;
          });

          const markdownParts = [];

          if (isFirstRowAHeader) {
            markdownParts.push("| " + paddedRows[0].join(" | ") + " |");
            markdownParts.push("|" + Array(maxCols).fill("---").join("|") + "|");
            for (let i = 1; i < paddedRows.length; i++) {
              markdownParts.push("| " + paddedRows[i].join(" | ") + " |");
            }
          } else {
            for (let i = 0; i < paddedRows.length; i++) {
              markdownParts.push("| " + paddedRows[i].join(" | ") + " |");
              if (i === 0) {
                markdownParts.push("|" + Array(maxCols).fill("---").join("|") + "|");
              }
            }
          }

          return markdownParts.join("\n");
        },
      });

      turndownServiceInstance.addRule("paragraph", {
        filter: "p",
        replacement: (content, node) => {
          if (!content.trim()) return "";

          let currentNode = node.parentNode;
          while (currentNode) {
            if (PARAGRAPH_FILTER_PARENT_NODES.includes(currentNode.nodeName)) return content;
            if (currentNode.nodeName === "LI") return content + "\n";
            currentNode = currentNode.parentNode;
          }

          return `\n\n${content}\n\n`;
        },
      });

      if (CURRENT_PLATFORM === CHATGPT) {
        turndownServiceInstance.addRule("popup-div", {
          filter: (node) =>
            node.nodeName === "DIV" && node.classList.contains(CHATGPT_POPUP_DIV_CLASS),
          replacement: (content) => {
            const textWithLineBreaks = content
              .replace(/<br\s*\/?>/gi, "\n")
              .replace(/<\/(p|div|h[1-6]|ul|ol|li)>/gi, "\n")
              .replace(/<(?:p|div|h[1-6]|ul|ol|li)[^>]*>/gi, "\n")
              .replace(/<\/?[^>]+(>|$)/g, "")
              .replace(/\n+/g, "\n");
            return "\n```\n" + textWithLineBreaks + "\n```\n";
          },
        });

        turndownServiceInstance.addRule("buttonWithSpecificClass", {
          filter: (node) =>
            node.nodeName === "BUTTON" && node.classList.contains(CHATGPT_BUTTON_SPECIFIC_CLASS),
          replacement: (content) => (content.trim() ? `__${content}__\n\n` : ""),
        });
      }

      if (CURRENT_PLATFORM === GEMINI) {
        turndownServiceInstance.addRule("geminiCodeLanguageLabel", {
          filter: (node) =>
            node.nodeName === "SPAN" &&
            node.closest(".code-block-decoration") &&
            node.textContent.trim().length > 0,
          replacement: () => "",
        });
      }

      turndownServiceInstance.addRule("images", {
        filter: (node) => node.nodeName === "IMG",
        replacement: (content, node) => {
          const src = node.getAttribute("src") || "";
          const alt = node.alt || "";
          return src ? `![${alt}](${src})` : "";
        },
      });
    },

    initiateExport(format) {
      const rawChatData = ChatExporter._currentChatData;

      if (!rawChatData || rawChatData.messages.length === 0) {
        alert("No messages found to export.");
        return;
      }

      ChatExporter._selectedMessageIds.clear();
      const outlineContainer = document.querySelector(`#${OUTLINE_CONTAINER_ID}`);

      if (outlineContainer) {
        const checkedVisibleCheckboxes = outlineContainer.querySelectorAll(".outline-item-checkbox:checked");
        const visibleUserMessageIds = new Set();

        checkedVisibleCheckboxes.forEach((cb) => {
          const parentItemDiv = cb.closest("div");
          if (parentItemDiv && window.getComputedStyle(parentItemDiv).display !== "none" && cb.dataset.messageId) {
            ChatExporter._selectedMessageIds.add(cb.dataset.messageId);
            visibleUserMessageIds.add(cb.dataset.messageId);
          }
        });

        rawChatData.messages.forEach((msg, index) => {
          if (msg.author === "ai") {
            let prevUserMessageId = null;
            for (let i = index - 1; i >= 0; i--) {
              if (rawChatData.messages[i].author === "user") {
                prevUserMessageId = rawChatData.messages[i].id;
                break;
              }
            }
            if (prevUserMessageId && visibleUserMessageIds.has(prevUserMessageId)) {
              ChatExporter._selectedMessageIds.add(msg.id);
            }
          }
        });
      }

      const filteredMessages = rawChatData.messages.filter((msg) =>
        ChatExporter._selectedMessageIds.has(msg.id)
      );

      if (filteredMessages.length === 0) {
        alert("No messages selected or visible for export. Please check at least one question in the outline or clear your search filter.");
        return;
      }

      const chatDataForExport = {
        ...rawChatData,
        messages: filteredMessages,
        messageCount: filteredMessages.filter((m) => m.author === "user").length,
        exportedAt: new Date(),
      };

      const turndownServiceInstance = ChatExporter.getTurndownService();
      let fileOutput = null;
      let fileName = null;
      let mimeType = "";

      if (format === "markdown") {
        const markdownResult = ChatExporter.formatToMarkdown(chatDataForExport, turndownServiceInstance);
        fileOutput = markdownResult.output;
        fileName = markdownResult.fileName;
        mimeType = "text/markdown;charset=utf-8";
      } else if (format === "json") {
        const jsonResult = ChatExporter.formatToJSON(chatDataForExport, turndownServiceInstance);
        fileOutput = jsonResult.output;
        fileName = jsonResult.fileName;
        mimeType = "application/json;charset=utf-8";
      } else {
        alert("Invalid export format selected.");
        return;
      }

      if (fileOutput && fileName) {
        Utils.downloadFile(fileName, fileOutput, mimeType);
      }
    },
  };

  // --- Injected CSS for Theme Overrides ---
  function injectThemeOverrideStyles() {
    if (document.getElementById("ai-chat-exporter-theme-overrides")) return;

    const styleElement = document.createElement("style");
    styleElement.id = "ai-chat-exporter-theme-overrides";
    styleElement.textContent = `
      #${OUTLINE_CONTAINER_ID} {
        background-color: #fff !important;
        color: #333 !important;
      }
      #${OUTLINE_CONTAINER_ID} #outline-search-input {
        background-color: #fff !important;
        color: #333 !important;
        border: 1px solid #ddd !important;
      }
      .dark-theme #${OUTLINE_CONTAINER_ID} #outline-search-input {
        background-color: #fff !important;
        color: #333 !important;
      }
      #${OUTLINE_CONTAINER_ID} ::-webkit-scrollbar {
        width: 8px;
        background-color: #f1f1f1;
      }
      #${OUTLINE_CONTAINER_ID} ::-webkit-scrollbar-thumb {
        background-color: #c1c1c1;
        border-radius: 4px;
      }
      #${OUTLINE_CONTAINER_ID} {
        scrollbar-color: #c1c1c1 #f1f1f1 !important;
        scrollbar-width: thin !important;
      }
      #${SETTINGS_MENU_ID} {
        background-color: #fff !important;
        color: #333 !important;
      }
      #${SETTINGS_MENU_ID} input[type="text"] {
        background-color: #fff !important;
        color: #333 !important;
      }
    `;
    document.head.appendChild(styleElement);
  }

  // --- UI Management ---
  const UIManager = {
    alertTimeoutId: null,
    _outlineIsCollapsed: false,
    _lastProcessedChatUrl: null,
    _initialListenersAttached: false,
    _mutationObserver: null,
    _scrollTimeout: null,

    // Cleanup function for proper resource management
    cleanup() {
      if (this._mutationObserver) {
        this._mutationObserver.disconnect();
        this._mutationObserver = null;
      }
      if (this._scrollTimeout) {
        clearTimeout(this._scrollTimeout);
        this._scrollTimeout = null;
      }
      if (this.alertTimeoutId) {
        clearTimeout(this.alertTimeoutId);
        this.alertTimeoutId = null;
      }
    },

    getTargetContentWidth() {
      let targetElement = null;

      if (CURRENT_PLATFORM === CHATGPT) {
        targetElement = document.querySelector("form > div.relative.flex.h-full.max-w-full.flex-1.flex-col") ||
          document.querySelector("div.w-full.md\\:max-w-2xl.lg\\:max-w-3xl.xl\\:max-w-4xl.flex-shrink-0.px-4");
      } else if (CURRENT_PLATFORM === GEMINI) {
        targetElement = document.querySelector("gb-chat-input-textarea-container") ||
          document.querySelector("div.flex.flex-col.w-full.relative.max-w-3xl.m-auto");
      }

      let width = targetElement ? targetElement.offsetWidth : 600;
      if (width < 350) width = 350;
      if (width > 900) width = 900;

      return `${width}px`;
    },

    showSettingsMenu() {
      let settingsMenu = document.querySelector(`#${SETTINGS_MENU_ID}`);

      if (settingsMenu) {
        settingsMenu.style.display = settingsMenu.style.display === "none" ? "block" : "none";
        return;
      }

      // Create settings menu
      settingsMenu = document.createElement("div");
      settingsMenu.id = SETTINGS_MENU_ID;
      Utils.applyStyles(settingsMenu, SETTINGS_MENU_PROPS);

      // Header
      const header = document.createElement("div");
      header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #5b3f87;";

      const title = document.createElement("h3");
      title.textContent = `⚙️ AI Chat Exporter v${EXPORTER_VERSION} Settings`;
      title.style.cssText = "margin: 0; font-size: 16px; font-weight: bold; color: #5b3f87;";
      header.appendChild(title);

      const closeBtn = document.createElement("button");
      closeBtn.textContent = "×";
      closeBtn.style.cssText = "background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 0; line-height: 1;";
      closeBtn.onclick = () => { settingsMenu.style.display = "none"; };
      header.appendChild(closeBtn);

      settingsMenu.appendChild(header);

      // Filename Format Section
      const formatSection = document.createElement("div");
      formatSection.style.cssText = "margin-bottom: 20px;";

      const formatLabel = document.createElement("label");
      formatLabel.textContent = "Filename Format:";
      formatLabel.style.cssText = "display: block; margin-bottom: 8px; font-weight: bold; color: #5b3f87;";
      formatSection.appendChild(formatLabel);

      const formatInput = document.createElement("input");
      formatInput.type = "text";
      formatInput.id = "settings-filename-format";
      formatInput.value = GM_getValue(GM_OUTPUT_FILE_FORMAT, OUTPUT_FILE_FORMAT_DEFAULT);
      formatInput.style.cssText = "width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; font-family: monospace; box-sizing: border-box;";
      formatSection.appendChild(formatInput);

      // Help text
      const helpText = document.createElement("div");
      helpText.style.cssText = "margin-top: 10px; font-size: 12px; color: #666; line-height: 1.5;";
      helpText.innerHTML = `
        <strong>Available placeholders:</strong><br>
        <code>{platform}</code> - e.g. chatgpt, claude, gemini, copilot<br>
        <code>{title}</code> - Chat title (tags removed)<br>
        <code>{timestamp}</code> - UTC: YYYY-MM-DDTHH-mm-ss.sssZ<br>
        <code>{timestampLocal}</code> - Local: YYYY-MM-DDTHH-mm-ss±HHMM<br>
        <code>{tags}</code> - All tags (hyphen-separated)<br>
        <code>{tag1}</code> to <code>{tag9}</code> - Individual tags<br>
        <code>{exporter}</code> - Exporter version number<br><br>
        <strong>Examples:</strong><br>
        • <code>{platform}_{title}_{timestampLocal}</code><br>
        • <code>{tag1}__{title}-v{exporter}</code><br>
        • <code>export_{platform}_{timestamp}</code>
      `;
      helpText.querySelectorAll("code").forEach(code => {
        code.style.cssText = "background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 11px;";
      });
      formatSection.appendChild(helpText);

      settingsMenu.appendChild(formatSection);

      // Buttons
      const buttonContainer = document.createElement("div");
      buttonContainer.style.cssText = "display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;";

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save";
      saveBtn.style.cssText = "padding: 8px 20px; background-color: #5b3f87; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;";
      saveBtn.onclick = () => {
        const newFormat = formatInput.value.trim();
        if (newFormat) {
          GM_setValue(GM_OUTPUT_FILE_FORMAT, newFormat);
          alert("✓ Settings saved successfully!");
          settingsMenu.style.display = "none";
        } else {
          alert("⚠ Filename format cannot be empty!");
        }
      };
      buttonContainer.appendChild(saveBtn);

      const resetBtn = document.createElement("button");
      resetBtn.textContent = "Reset to Default";
      resetBtn.style.cssText = "padding: 8px 20px; background-color: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;";
      resetBtn.onclick = () => {
        formatInput.value = OUTPUT_FILE_FORMAT_DEFAULT;
      };
      buttonContainer.appendChild(resetBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = "padding: 8px 20px; background-color: #ccc; color: #333; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;";
      cancelBtn.onclick = () => { settingsMenu.style.display = "none"; };
      buttonContainer.appendChild(cancelBtn);

      settingsMenu.appendChild(buttonContainer);

      document.body.appendChild(settingsMenu);
      settingsMenu.style.display = "block";
    },

    addExportControls() {
      if (document.querySelector(`#${EXPORT_CONTAINER_ID}`)) return;

      const container = document.createElement("div");
      container.id = EXPORT_CONTAINER_ID;
      Utils.applyStyles(container, COMMON_CONTROL_PROPS);

      const markdownButton = document.createElement("button");
      markdownButton.id = "export-markdown-btn";
      markdownButton.textContent = "⬇ Export MD";
      markdownButton.title = `${EXPORT_BUTTON_TITLE_PREFIX}: Export to Markdown`;
      Utils.applyStyles(markdownButton, BUTTON_BASE_PROPS);
      markdownButton.onclick = () => ChatExporter.initiateExport("markdown");
      container.appendChild(markdownButton);

      const jsonButton = document.createElement("button");
      jsonButton.id = "export-json-btn";
      jsonButton.textContent = "⬇ JSON";
      jsonButton.title = `${EXPORT_BUTTON_TITLE_PREFIX}: Export to JSON`;
      Utils.applyStyles(jsonButton, { ...BUTTON_BASE_PROPS, ...BUTTON_SPACING_PROPS });
      jsonButton.onclick = () => ChatExporter.initiateExport("json");
      container.appendChild(jsonButton);

      const settingsButton = document.createElement("button");
      settingsButton.className = "export-button-settings";
      settingsButton.textContent = "⚙️";
      settingsButton.title = `${EXPORT_BUTTON_TITLE_PREFIX}: Settings`;
      Utils.applyStyles(settingsButton, { ...BUTTON_BASE_PROPS, ...BUTTON_SPACING_PROPS });
      settingsButton.onclick = () => UIManager.showSettingsMenu();
      container.appendChild(settingsButton);

      document.body.appendChild(container);
    },

    addOutlineControls() {
      let outlineContainer = document.querySelector(`#${OUTLINE_CONTAINER_ID}`);
      if (!outlineContainer) {
        outlineContainer = document.createElement("div");
        outlineContainer.id = OUTLINE_CONTAINER_ID;
        document.body.appendChild(outlineContainer);
      }

      Utils.applyStyles(outlineContainer, OUTLINE_CONTAINER_PROPS);

      if (UIManager._outlineIsCollapsed) {
        Utils.applyStyles(outlineContainer, OUTLINE_CONTAINER_COLLAPSED_PROPS);
      }

      UIManager.generateOutlineContent();
    },

    generateOutlineContent() {
      const outlineContainer = document.querySelector(`#${OUTLINE_CONTAINER_ID}`);
      if (!outlineContainer) return;

      let freshChatData = null;
      switch (CURRENT_PLATFORM) {
        case CHATGPT:
          freshChatData = ChatExporter.extractChatGPTChatData(document);
          break;
        case CLAUDE:
          freshChatData = ChatExporter.extractClaudeChatData(document);
          break;
        case COPILOT:
          freshChatData = ChatExporter.extractCopilotChatData(document);
          break;
        case GEMINI:
          freshChatData = ChatExporter.extractGeminiChatData(document);
          break;
        default:
          outlineContainer.style.display = "none";
          return;
      }

      const hasDataChanged =
        !ChatExporter._currentChatData ||
        !freshChatData ||
        freshChatData._raw_title !== ChatExporter._currentChatData._raw_title ||
        freshChatData.messages.length !== ChatExporter._currentChatData.messages.length ||
        (freshChatData.messages.length > 0 &&
          ChatExporter._currentChatData.messages.length > 0 &&
          freshChatData.messages[freshChatData.messages.length - 1].contentText !==
            ChatExporter._currentChatData.messages[ChatExporter._currentChatData.messages.length - 1].contentText);

      if (!hasDataChanged) {
        outlineContainer.style.display = freshChatData && freshChatData.messages.length > 0 ? "flex" : "none";
        return;
      }

      ChatExporter._currentChatData = freshChatData;

      if (!ChatExporter._currentChatData || ChatExporter._currentChatData.messages.length === 0) {
        outlineContainer.style.display = "none";
        return;
      }

      outlineContainer.style.display = "flex";

      while (outlineContainer.firstChild) {
        outlineContainer.removeChild(outlineContainer.firstChild);
      }

      ChatExporter._selectedMessageIds.clear();

      const headerDiv = document.createElement("div");
      Utils.applyStyles(headerDiv, OUTLINE_HEADER_PROPS);
      headerDiv.title = `AI Chat Exporter v${EXPORTER_VERSION}`;
      headerDiv.onclick = UIManager.toggleOutlineCollapse;

      const headerSpan = document.createElement("span");
      headerSpan.textContent = "AI Chat Exporter: Chat Outline";
      headerDiv.appendChild(headerSpan);

      const toggleButton = document.createElement("button");
      toggleButton.id = "outline-toggle-btn";
      toggleButton.textContent = UIManager._outlineIsCollapsed ? "▲" : "▼";
      Utils.applyStyles(toggleButton, OUTLINE_TOGGLE_BUTTON_PROPS);
      headerDiv.appendChild(toggleButton);

      outlineContainer.appendChild(headerDiv);

      const titleDiv = document.createElement("div");
      Utils.applyStyles(titleDiv, OUTLINE_TITLE_PROPS);
      titleDiv.textContent = freshChatData.title || DEFAULT_CHAT_TITLE;
      titleDiv.title = "tags: " + freshChatData.tags.join(", ");
      titleDiv.id = OUTLINE_TITLE_ID;
      outlineContainer.appendChild(titleDiv);

      const selectAllContainer = document.createElement("div");
      Utils.applyStyles(selectAllContainer, SELECT_ALL_CONTAINER_PROPS);
      selectAllContainer.id = "outline-select-all-container";

      const masterCheckbox = document.createElement("input");
      masterCheckbox.type = "checkbox";
      masterCheckbox.id = "outline-select-all";
      masterCheckbox.checked = true;
      Utils.applyStyles(masterCheckbox, OUTLINE_CHECKBOX_PROPS);
      selectAllContainer.appendChild(masterCheckbox);

      const selectAllLabel = document.createElement("span");
      selectAllContainer.appendChild(selectAllLabel);
      outlineContainer.appendChild(selectAllContainer);

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.id = "outline-search-input";
      searchInput.placeholder = "Search text or regex in user queries & AI responses.";
      Utils.applyStyles(searchInput, SEARCH_INPUT_PROPS);
      outlineContainer.appendChild(searchInput);

      const noMatchMessage = document.createElement("div");
      noMatchMessage.id = "outline-no-match-message";
      noMatchMessage.textContent = "Your search text didn't match any items";
      Utils.applyStyles(noMatchMessage, NO_MATCH_MESSAGE_PROPS);
      noMatchMessage.style.display = "none";
      outlineContainer.appendChild(noMatchMessage);

      const hr = document.createElement("hr");
      hr.style.cssText = "border: none; border-top: 1px solid #eee; margin: 5px 0;";
      outlineContainer.appendChild(hr);

      const messageListDiv = document.createElement("div");
      messageListDiv.id = "outline-message-list";
      Utils.applyStyles(messageListDiv, MESSAGE_LIST_PROPS);

      let userQuestionCount = 0;

      const updateSelectedCountDisplay = () => {
        const totalUserMessages = userQuestionCount;
        let selectedAndVisibleMessages = 0;

        if (!UIManager._outlineIsCollapsed) {
          const allCheckboxes = outlineContainer.querySelectorAll(".outline-item-checkbox");
          allCheckboxes.forEach((checkbox) => {
            const parentItemDiv = checkbox.closest("div");
            if (checkbox.checked && parentItemDiv && window.getComputedStyle(parentItemDiv).display !== "none") {
              selectedAndVisibleMessages++;
            }
          });
        }

        while (selectAllLabel.firstChild) {
          selectAllLabel.removeChild(selectAllLabel.firstChild);
        }

        const strongElement = document.createElement("strong");
        strongElement.textContent = `Items to export:  ${selectedAndVisibleMessages} out of ${totalUserMessages}`;
        selectAllLabel.appendChild(strongElement);
      };

      const outlineItemElements = new Map();

      ChatExporter._currentChatData.messages.forEach((msg) => {
        if (msg.author === "user") {
          userQuestionCount++;
          const itemDiv = document.createElement("div");
          Utils.applyStyles(itemDiv, OUTLINE_ITEM_PROPS);
          itemDiv.dataset.userMessageId = msg.id;

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = true;
          checkbox.className = "outline-item-checkbox";
          checkbox.dataset.messageId = msg.id;
          Utils.applyStyles(checkbox, OUTLINE_CHECKBOX_PROPS);
          checkbox.onchange = () => {
            const allVisibleCheckboxes = Array.from(
              outlineContainer.querySelectorAll(".outline-item-checkbox:not([style*='display: none'])")
            );
            masterCheckbox.checked = allVisibleCheckboxes.every((cb) => cb.checked);
            updateSelectedCountDisplay();
          };
          itemDiv.appendChild(checkbox);

          const itemText = document.createElement("span");
          itemText.textContent = `${userQuestionCount}: ${Utils.truncate(msg.contentText, 40)}`;
          itemText.style.cursor = "pointer";
          itemText.style.textDecoration = "none";
          itemText.title = `${userQuestionCount}: ${Utils.truncate(msg.contentText.replace(/\n+/g, "\n"), 140)}`;

          itemText.onmouseover = () => {
            itemText.style.backgroundColor = "#f0f0f0";
            itemText.style.color = "#5b3f87";
          };
          itemText.onmouseout = () => {
            itemText.style.backgroundColor = "transparent";
            itemText.style.color = "#333";
          };

          itemText.onclick = () => {
            const messageElement = ChatExporter._currentChatData.messages.find((m) => m.id === msg.id)?.contentHtml;
            if (messageElement) {
              messageElement.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          };
          itemDiv.appendChild(itemText);

          messageListDiv.appendChild(itemDiv);
          outlineItemElements.set(msg.id, itemDiv);
          ChatExporter._selectedMessageIds.add(msg.id);
        } else {
          const prevUserMessage = ChatExporter._currentChatData.messages.find(
            (m, i) => i < ChatExporter._currentChatData.messages.indexOf(msg) && m.author === "user"
          );
          if (prevUserMessage && ChatExporter._selectedMessageIds.has(prevUserMessage.id)) {
            ChatExporter._selectedMessageIds.add(msg.id);
          }
        }
      });

      masterCheckbox.onchange = (e) => {
        const isChecked = e.target.checked;
        const visibleCheckboxes = outlineContainer.querySelectorAll(
          ".outline-item-checkbox:not([style*='display: none'])"
        );
        visibleCheckboxes.forEach((cb) => {
          cb.checked = isChecked;
        });
        updateSelectedCountDisplay();
      };

      outlineContainer.appendChild(messageListDiv);
      updateSelectedCountDisplay();

      // Debounced search handler for better performance
      const debouncedSearch = Utils.debounce(() => {
        const searchText = searchInput.value.trim();
        let anyMatchFound = false;
        let searchRegex = null;
        let regexError = false;

        noMatchMessage.textContent = "Your search text didn't match any items";
        noMatchMessage.style.color = "#7e7e7e";

        if (searchText !== "") {
          searchRegex = Utils.getCachedRegex(searchText, 'i');
          if (!searchRegex) {
            regexError = true;
            noMatchMessage.textContent = "Invalid regex pattern";
            noMatchMessage.style.color = "red";
            noMatchMessage.style.display = "block";
            messageListDiv.style.display = "none";

            outlineItemElements.forEach((itemDiv) => {
              itemDiv.style.display = "none";
            });
            masterCheckbox.checked = false;
            updateSelectedCountDisplay();
            return;
          }
        }

        const messages = ChatExporter._currentChatData.messages;
        const userMessageMap = new Map();

        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (msg.author === "user") {
            const aiMsg = (i + 1 < messages.length && messages[i + 1].author === "ai") ? messages[i + 1] : null;
            userMessageMap.set(msg.id, { user: msg, ai: aiMsg });
          }
        }

        outlineItemElements.forEach((itemDiv, userMsgId) => {
          const userAiPair = userMessageMap.get(userMsgId);
          let match = false;

          if (userAiPair) {
            if (searchText === "") {
              match = true;
            } else if (searchRegex) {
              const userContent = userAiPair.user.contentText;
              const aiContent = userAiPair.ai ? userAiPair.ai.contentText : "";
              match = searchRegex.test(userContent) || searchRegex.test(aiContent);
            }
          }

          itemDiv.style.display = match ? "flex" : "none";
          if (match) anyMatchFound = true;
        });

        if (searchText !== "" && !anyMatchFound && !regexError) {
          noMatchMessage.style.display = "block";
          messageListDiv.style.display = "none";
        } else if (searchText === "" || anyMatchFound) {
          noMatchMessage.style.display = "none";
          if (!UIManager._outlineIsCollapsed) {
            messageListDiv.style.display = "block";
          }
        }

        const visibleCheckboxes = outlineContainer.querySelectorAll(
          ".outline-item-checkbox:not([style*='display: none'])"
        );
        masterCheckbox.checked = visibleCheckboxes.length > 0 && Array.from(visibleCheckboxes).every((cb) => cb.checked);
        updateSelectedCountDisplay();
      }, DEBOUNCE_DELAY);

      searchInput.oninput = debouncedSearch;

      if (UIManager._outlineIsCollapsed) {
        titleDiv.style.display = "none";
        selectAllContainer.style.display = "none";
        searchInput.style.display = "none";
        noMatchMessage.style.display = "none";
        hr.style.display = "none";
        messageListDiv.style.display = "none";
      } else {
        titleDiv.style.display = "flex";
        selectAllContainer.style.display = "flex";
        searchInput.style.display = "block";
        hr.style.display = "block";
      }
    },

    toggleOutlineCollapse() {
      UIManager._outlineIsCollapsed = !UIManager._outlineIsCollapsed;
      localStorage.setItem(OUTLINE_COLLAPSED_STATE_KEY, UIManager._outlineIsCollapsed.toString());

      const outlineContainer = document.querySelector(`#${OUTLINE_CONTAINER_ID}`);
      const titleDiv = document.querySelector(`#${OUTLINE_TITLE_ID}`);
      const selectAllContainer = document.querySelector("#outline-select-all-container");
      const searchInput = document.querySelector("#outline-search-input");
      const noMatchMessage = document.querySelector("#outline-no-match-message");
      const hr = outlineContainer?.querySelector("hr");
      const messageListDiv = document.querySelector("#outline-message-list");
      const toggleButton = document.querySelector("#outline-toggle-btn");

      if (UIManager._outlineIsCollapsed) {
        if (outlineContainer) {
          Utils.applyStyles(outlineContainer, { ...OUTLINE_CONTAINER_PROPS, ...OUTLINE_CONTAINER_COLLAPSED_PROPS });
        }
        if (titleDiv) titleDiv.style.display = "none";
        if (selectAllContainer) selectAllContainer.style.display = "none";
        if (searchInput) searchInput.style.display = "none";
        if (noMatchMessage) noMatchMessage.style.display = "none";
        if (hr) hr.style.display = "none";
        if (messageListDiv) messageListDiv.style.display = "none";
        if (toggleButton) toggleButton.textContent = "▲";
      } else {
        if (outlineContainer) Utils.applyStyles(outlineContainer, OUTLINE_CONTAINER_PROPS);
        if (titleDiv) titleDiv.style.display = "flex";
        if (selectAllContainer) selectAllContainer.style.display = "flex";
        if (searchInput) searchInput.style.display = "block";
        if (hr) hr.style.display = "block";

        const currentSearchText = searchInput ? searchInput.value.toLowerCase().trim() : "";
        if (currentSearchText !== "") {
          if (searchInput) searchInput.dispatchEvent(new Event("input"));
        } else {
          if (messageListDiv) messageListDiv.style.display = "block";
          if (outlineContainer) {
            const allItems = outlineContainer.querySelectorAll(".outline-item-checkbox");
            allItems.forEach((cb) => {
              const parentDiv = cb.closest("div");
              if (parentDiv) parentDiv.style.display = "flex";
            });
          }
          if (noMatchMessage) noMatchMessage.style.display = "none";
        }
        if (toggleButton) toggleButton.textContent = "▼";
      }
    },

    showAlert(message) {
      if (this.alertTimeoutId) {
        clearTimeout(this.alertTimeoutId);
        this.alertTimeoutId = null;
      }

      if (localStorage.getItem(HIDE_ALERT_FLAG) === "true") return;

      let alertContainer = document.querySelector(`#${ALERT_CONTAINER_ID}`);
      if (alertContainer) alertContainer.remove();

      alertContainer = document.createElement("div");
      alertContainer.id = ALERT_CONTAINER_ID;
      Utils.applyStyles(alertContainer, ALERT_PROPS);
      alertContainer.style.maxWidth = this.getTargetContentWidth();

      const titleElement = document.createElement("strong");
      titleElement.textContent = EXPORT_BUTTON_TITLE_PREFIX;
      titleElement.style.display = "block";
      titleElement.style.marginBottom = "8px";
      titleElement.style.fontSize = "16px";
      titleElement.style.width = "100%";
      titleElement.style.textAlign = "center";
      alertContainer.appendChild(titleElement);

      const messageRow = document.createElement("div");
      Utils.applyStyles(messageRow, ALERT_MESSAGE_ROW_PROPS);

      const messageSpan = document.createElement("span");
      messageSpan.textContent = message;
      messageRow.appendChild(messageSpan);

      const closeButton = document.createElement("button");
      closeButton.textContent = "×";
      Utils.applyStyles(closeButton, ALERT_CLOSE_BUTTON_PROPS);
      messageRow.appendChild(closeButton);
      alertContainer.appendChild(messageRow);

      const checkboxContainer = document.createElement("div");
      Utils.applyStyles(checkboxContainer, ALERT_CHECKBOX_CONTAINER_PROPS);

      const hideCheckbox = document.createElement("input");
      hideCheckbox.type = "checkbox";
      hideCheckbox.id = "hide-exporter-alert";
      Utils.applyStyles(hideCheckbox, ALERT_CHECKBOX_PROPS);
      checkboxContainer.appendChild(hideCheckbox);

      const label = document.createElement("label");
      label.htmlFor = "hide-exporter-alert";
      label.textContent = "Don't show this again";
      checkboxContainer.appendChild(label);
      alertContainer.appendChild(checkboxContainer);

      document.body.appendChild(alertContainer);

      const hideAndRemoveAlert = () => {
        alertContainer.style.opacity = "0";
        setTimeout(() => {
          if (alertContainer && alertContainer.parentNode) {
            alertContainer.remove();
          }
          this.alertTimeoutId = null;
        }, 500);
      };

      closeButton.onclick = () => {
        if (hideCheckbox.checked) {
          localStorage.setItem(HIDE_ALERT_FLAG, "true");
        }
        hideAndRemoveAlert();
      };

      this.alertTimeoutId = setTimeout(() => {
        if (alertContainer && alertContainer.parentNode && !hideCheckbox.checked) {
          hideAndRemoveAlert();
        } else {
          this.alertTimeoutId = null;
        }
      }, ALERT_AUTO_CLOSE_DURATION);
    },

    autoScrollToTop: async function () {
      if (CURRENT_PLATFORM !== GEMINI) return;

      const currentUrl = window.location.href;
      if (UIManager._lastProcessedChatUrl === currentUrl) {
        console.log("Auto-scroll already initiated or completed for this URL. Skipping.");
        return;
      }

      const scrollableElement =
        document.querySelector('[data-test-id="chat-history-container"]') ||
        document.querySelector("#chat-history") ||
        document.querySelector("main") ||
        document.documentElement;

      if (!scrollableElement) return;

      const AUTOSCROLL_MAT_PROGRESS_BAR_POLL_INTERVAL = 50;
      const AUTOSCROLL_MAT_PROGRESS_BAR_APPEAR_TIMEOUT = 3000;
      const AUTOSCROLL_MAT_PROGRESS_BAR_DISAPPEAR_TIMEOUT = 5000;
      const AUTOSCROLL_REPEAT_DELAY = 500;
      const AUTOSCROLL_MAX_RETRY = 3;
      const MESSAGE_ELEMENT_APPEAR_TIMEOUT = 5000;

      let previousMessageCount = -1;
      let retriesForProgressBar = 0;

      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const waitForElementToAppear = async (selector, timeoutMs, checkInterval = AUTOSCROLL_MAT_PROGRESS_BAR_POLL_INTERVAL) => {
        const startTime = Date.now();
        return new Promise((resolve) => {
          const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
              clearInterval(interval);
              resolve(element);
            } else if (Date.now() - startTime > timeoutMs) {
              clearInterval(interval);
              resolve(null);
            }
          }, checkInterval);
        });
      };

      const waitForElementToDisappear = async (selector, timeoutMs, checkInterval = AUTOSCROLL_MAT_PROGRESS_BAR_POLL_INTERVAL) => {
        const startTime = Date.now();
        return new Promise((resolve) => {
          const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (!element || (element.offsetWidth === 0 && element.offsetHeight === 0)) {
              clearInterval(interval);
              resolve(true);
            } else if (Date.now() - startTime > timeoutMs) {
              clearInterval(interval);
              console.warn(`waitForElementToDisappear: Timeout waiting for '${selector}' to disappear.`);
              resolve(false);
            }
          }, checkInterval);
        });
      };

      const initialMessageElement = await waitForElementToAppear(GEMINI_MESSAGE_ITEM_SELECTOR, MESSAGE_ELEMENT_APPEAR_TIMEOUT);

      if (!initialMessageElement) {
        console.error("Initial chat message elements did not appear within timeout.");
        UIManager._lastProcessedChatUrl = null;
        return;
      }

      UIManager._lastProcessedChatUrl = currentUrl;

      if (!UIManager._initialListenersAttached) {
        UIManager.initUrlChangeObserver();
        UIManager._initialListenersAttached = true;
      }

      while (true) {
        scrollableElement.scrollTop = 0;
        await delay(50);

        const progressBarElement = await waitForElementToAppear(
          "mat-progress-bar.mdc-linear-progress--indeterminate",
          AUTOSCROLL_MAT_PROGRESS_BAR_APPEAR_TIMEOUT
        );

        if (progressBarElement) {
          retriesForProgressBar = 0;
          const disappeared = await waitForElementToDisappear(
            "mat-progress-bar.mdc-linear-progress--indeterminate",
            AUTOSCROLL_MAT_PROGRESS_BAR_DISAPPEAR_TIMEOUT
          );
          if (!disappeared) {
            console.warn("autoScrollToTop: mat-progress-bar did not disappear within expected time.");
          }
        } else {
          retriesForProgressBar++;
          if (retriesForProgressBar > AUTOSCROLL_MAX_RETRY) break;
          await delay(AUTOSCROLL_REPEAT_DELAY);
          continue;
        }

        const currentChatData = ChatExporter.extractGeminiChatData(document);
        const currentMessageCount = currentChatData ? currentChatData.messages.length : 0;

        if (currentMessageCount > previousMessageCount) {
          previousMessageCount = currentMessageCount;
          retriesForProgressBar = 0;
        } else {
          if (previousMessageCount !== -1) break;
        }

        await delay(AUTOSCROLL_REPEAT_DELAY);
      }

      UIManager.addOutlineControls();
    },

    handleUrlChange: function () {
      const newUrl = window.location.href;
      const isGeminiChatUrl = GEMINI_HOSTNAMES.some((host) => newUrl.includes(host)) && newUrl.includes("/app");

      if (isGeminiChatUrl) {
        UIManager._lastProcessedChatUrl = null;
        setTimeout(() => {
          UIManager.autoScrollToTop();
        }, 100);
      } else {
        console.log("URL is not a Gemini chat URL. Skipping auto-scroll for:", newUrl);
      }
    },

    // Debounced mutation observer callback
    _debouncedMutationCallback: null,

    initObserver() {
      this._debouncedMutationCallback = Utils.debounce(() => {
        if (!document.querySelector(`#${EXPORT_CONTAINER_ID}`)) {
          UIManager.addExportControls();
        }
        UIManager.addOutlineControls();
      }, DEBOUNCE_DELAY);

      let targetNode = null;
      switch (CURRENT_PLATFORM) {
        case COPILOT:
          targetNode = document.querySelector('[data-content="conversation"]') || document.body;
          break;
        case GEMINI:
          targetNode = document.querySelector("#__next") || document.body;
          break;
        default:
          targetNode = document.querySelector("main") || document.body;
      }

      this._mutationObserver = new MutationObserver(this._debouncedMutationCallback);
      this._mutationObserver.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: false,
      });

      if (CURRENT_PLATFORM === GEMINI) {
        const debouncedScrollHandler = Utils.debounce(() => {
          const newChatData = ChatExporter.extractGeminiChatData(document);
          if (
            newChatData &&
            ChatExporter._currentChatData &&
            (newChatData._raw_title !== ChatExporter._currentChatData._raw_title ||
              newChatData.messages.length > ChatExporter._currentChatData.messages.length)
          ) {
            UIManager.addOutlineControls();
          }
        }, SCROLL_DEBOUNCE_DELAY);

        window.addEventListener("scroll", debouncedScrollHandler, true);
      }
    },

    initUrlChangeObserver: function () {
      window.addEventListener("popstate", UIManager.handleUrlChange);

      (function (history) {
        const pushState = history.pushState;
        history.pushState = function (state) {
          if (typeof history.onpushstate == "function") {
            history.onpushstate({ state: state });
          }
          window.dispatchEvent(new Event("customHistoryChange"));
          return pushState.apply(history, arguments);
        };

        const replaceState = history.replaceState;
        history.replaceState = function (state) {
          if (typeof history.onreplacestate == "function") {
            history.onreplacestate({ state: state });
          }
          window.dispatchEvent(new Event("customHistoryChange"));
          return replaceState.apply(history, arguments);
        };
      })(window.history);

      window.addEventListener("customHistoryChange", UIManager.handleUrlChange);
    },

    init() {
      const storedCollapsedState = localStorage.getItem(OUTLINE_COLLAPSED_STATE_KEY);
      UIManager._outlineIsCollapsed = storedCollapsedState === "true";

      const initControls = () => {
        UIManager.addExportControls();
        UIManager.addOutlineControls();

        if (CURRENT_PLATFORM === GEMINI) {
          setTimeout(() => {
            UIManager.autoScrollToTop();
          }, AUTOSCROLL_INITIAL_DELAY);
        }
      };

      if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(initControls, DOM_READY_TIMEOUT);
      } else {
        window.addEventListener("DOMContentLoaded", () => setTimeout(initControls, DOM_READY_TIMEOUT));
      }

      UIManager.initObserver();
      injectThemeOverrideStyles();
    },
  };

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    UIManager.cleanup();
    Utils.clearRegexCache();
  });

  UIManager.init();
})();