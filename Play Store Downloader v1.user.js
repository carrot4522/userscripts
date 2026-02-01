// ==UserScript==
// @name         Play Store Downloader v1
// @name:it      Play Store Downloader v1
// @namespace    StephenP
// @version      1
// @description  Adds APK-DL, APKPure, APKCombo, APKPremier, APKMirror and Evozi download buttons to Google Play Store when browsing apps. Optimized with better performance, error handling, and modern code practices.
// @description:it Aggiunge i tasti di download di APK-DL, APKPure, APKCombo, APKPremier, APKMirror e Evozi al Google Play Store quando si naviga tra le applicazioni. Versione ottimizzata.
// @author       StephenP
// @icon         data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAM1BMVEX2ZXLgIkzxMUf6OkN9f5v7ZTAOpP8OxP4myPsU1LkU1P4k4oAr3vwk7H1U41v+ziz92jIMI6b6AAAAAXRSTlMAQObYZgAAAKtJREFUOMul0ssSgyAMQNGAtCgv/f+vLcVCSCLiTLPL3MPAAoAn4/0EbP6eWDsRaxEx3gG7xe+MAIo4ABPhiIjXoBeCOCEiB0IkDphI+3EwQETaM+iIYyL3AhpxVKT3OSgCEeaFACgowiyLBE241WgE7ZEBhdFaVwA9CNi1vgQB+wCE1kcg1A4DQO6n5uxKleMgO/x6nrKKDrXX/eINpstV9D+G9SLIruCP+QAbnhEp2bGFogAAAABJRU5ErkJggg==
// @match        https://play.google.com/*
// @match        http://play.google.com/*
// @match        http://apkfind.com/store/captcha?app=*
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @require      https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @connect      self
// @connect      apkpure.com
// @connect      apkfind.com
// @connect      apk-cloud.com
// @connect      winudf.com
// @connect      apkcombo.com
// @connect      down-apk.com
// @connect      play.googleapis.com
// @connect      gvt1.com
// @connect      apkpremier.com
// @connect      web-api.aptoide.com
// @connect      apk.support
// @contributionURL https://buymeacoffee.com/stephenp_greasyfork
// @downloadURL https://update.greasyfork.org/scripts/33005/Direct%20download%20from%20Google%20Play.user.js
// @updateURL https://update.greasyfork.org/scripts/33005/Direct%20download%20from%20Google%20Play.meta.js
// ==/UserScript==

(function () {
  'use strict';

  // ---------- CONSTANTS ----------
  const CONFIG = {
    CHECK_RELOAD_INTERVAL: 2000,
    WAIT_BUTTON_REMOVAL_INTERVAL: 1000,
    UNREDIRECT_INTERVAL: 100,
  };

  const SELECTORS = {
    MAIN_TITLE: '#main-title',
    INSTALL_BUTTON: '[data-item-id^="%.@."]',
    WISHLIST_BUTTON: '[data-p^="%.@.["]',
    SEARCH_SECTION: '#search-section',
    PRICE_META: 'meta[itemprop=price]',
  };

  const DOWNLOAD_SERVICES = [
    { name: 'APK-DL', color: '#009688', canDDL: true, hasExternal: false },
    { name: 'APKPure', color: '#24cd77', canDDL: true, hasExternal: false },
    { name: 'APKCombo', color: '#00875f', canDDL: true, hasExternal: true },
    { name: 'APKPremier', color: '#3740ff', canDDL: true, hasExternal: false },
    { name: 'Evozi', color: '#286090', canDDL: false, hasExternal: false },
    { name: 'APKMirror', color: '#FF8B14', canDDL: false, hasExternal: false },
    { name: 'Aptoide', color: '#fe6446', canDDL: true, hasExternal: false },
    { name: 'APKSupport', color: '#3740ff', canDDL: true, hasExternal: true },
  ];

  // ---------- STATE ----------
  const state = {
    ui: 0,
    pageURL: '',
    title: '',
    appCwiz: null,
    downloadStatus: [],
    useGoogleServers: false,
  };

  // ---------- UTILITIES ----------
  const log = (...args) => console.log('[Direct Download]', ...args);
  const logError = (...args) => console.error('[Direct Download]', ...args);

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return document.querySelectorAll(selector);
  }

  // ---------- STYLES ----------
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .ddlButton {
        font-family: "Google Sans", Roboto, Arial, sans-serif;
        font-size: 1rem;
        font-weight: 500;
        padding: 8px 16px;
        color: white;
        position: relative;
        z-index: 0;
        width: 100%;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease-in-out;
        text-align: left;
      }
      .ddlButton:hover {
        opacity: 0.8;
        filter: brightness(1.1);
      }
      .ddlButton:active {
        opacity: 0.6;
      }
      .ddlButton > a {
        color: white;
        text-decoration: none;
        display: block;
      }
      .ddlButton[disabled] {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .dropdown {
        background-color: #fff;
        width: min-content;
        min-width: 150px;
        border-radius: 8px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.7);
        padding: 8px;
        z-index: 1000;
      }
      #buttonDropdown > .ddlButton:first-child {
        border-radius: 8px 8px 0 0;
      }
      #buttonDropdown > .ddlButton:last-child {
        border-radius: 0 0 8px 8px;
      }
      #mainDownloadButton {
        background-color: #F55;
        border-radius: 8px;
        padding: 10px 14px;
        font-weight: 700;
        user-select: none;
      }
      #mainDownloadButton:hover {
        background-color: #E44;
      }
      @media (max-width: 600px) {
        #mainDownloadButton {
          font-size: 0.9rem;
          padding: 8px 12px;
        }
        .dropdown {
          min-width: 120px;
        }
        .ddlButton {
          font-size: 0.9rem;
          padding: 6px 12px;
        }
      }
    `;
    document.body.appendChild(style);
  }

  // ---------- URL BUILDERS ----------
  function buildDownloadURLs(packageId) {
    return {
      apkdl: `http://apkfind.com/store/download?id=${packageId}`,
      apkpure: `https://d.apkpure.com/b/APK/${packageId}?version=latest`,
      apkcombo: `https://apkcombo.com/genericApp/${packageId}/download/apk`,
      apkpremier: `https://apkpremier.com/download/${packageId.replace(/\./g, '-')}`,
      evozi: `https://apps.evozi.com/apk-downloader/?id=${packageId}`,
      apkmirror: `https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${packageId}`,
      aptoide: `https://web-api.aptoide.com/search?query=${packageId}`,
      apksupport: `https://apk.support/download-app/${packageId}`,
    };
  }

  // ---------- UI DETECTION ----------
  function detectUI() {
    try {
      if ($$('header').length > 0) {
        return 5; // 2022 UI
      }
      return 0; // Missing APK page
    } catch (err) {
      logError('UI detection error:', err);
      return 0;
    }
  }

  function getInstallButton() {
    let matchingElements = $$(SELECTORS.INSTALL_BUTTON);

    if (matchingElements.length === 0) {
      matchingElements = $$(SELECTORS.WISHLIST_BUTTON);
      for (const element of matchingElements) {
        if (
          element.querySelector('[fill-rule=evenodd]') &&
          element.getAttribute('data-p').includes('",7]]')
        ) {
          return element;
        }
      }
    }

    log('Found install buttons:', matchingElements.length);
    return matchingElements[0];
  }

  // ---------- BUTTON VISIBILITY ----------
  function areButtonsVisible() {
    const allButtons = $$('.ddlButton');

    if (allButtons.length === 0) {
      return !document.location.href.includes('play.google.com/store/apps/details');
    }

    for (const button of allButtons) {
      if (button.offsetParent !== null) {
        return true;
      }
    }

    return false;
  }

  // ---------- PAGE CHANGE DETECTION ----------
  function checkForPageChange() {
    if (state.pageURL !== location.href || !areButtonsVisible()) {
      waitForButtonRemoval();
    }
  }

  function waitForButtonRemoval() {
    const titleElement = $(SELECTORS.MAIN_TITLE);

    if (state.pageURL !== location.href || !areButtonsVisible()) {
      state.title = titleElement?.innerHTML || '';
      state.pageURL = location.href;

      if (
        location.href.includes('details?id=') ||
        location.href.includes('/store/search?q=')
      ) {
        if (state.ui > 0 && $$('.ddlButton').length > 0) {
          try {
            removePreviousElements();
          } catch (err) {
            log('Error removing buttons:', err);
          }
        }
        addDownloadButtons();
      }
    } else {
      setTimeout(waitForButtonRemoval, CONFIG.WAIT_BUTTON_REMOVAL_INTERVAL);
    }
  }

  function removePreviousElements() {
    if (state.appCwiz?.parentNode) {
      state.appCwiz.parentNode.removeChild(state.appCwiz);
    }
  }

  // ---------- UNREDIRECT (for apkfind.com) ----------
  function handleUnredirect() {
    const totalChildren = document.body.children.length - 1;
    const lastChild = document.body.children[totalChildren];

    if (!lastChild) return;

    const zIndex = parseInt(lastChild.style.zIndex, 10);

    if (zIndex > 2) {
      if (lastChild.id === '') {
        lastChild.style.zIndex = '1';
        document.body.children[totalChildren - 1].style.zIndex = '-1000';
      } else {
        lastChild.style.zIndex = '-1000';
      }
    }
  }

  // ---------- EXTRACT PACKAGE ID ----------
  function extractPackageId(installButton) {
    if (location.href.includes('details?id=')) {
      return location.search.match(/id=(.*)/)?.[1]?.split('&')[0];
    } else if (location.href.includes('/store/search?q=')) {
      const idAttr = installButton
        ?.querySelector('[data-item-id^="%.@."]')
        ?.getAttribute('data-item-id');
      const match = idAttr?.match(/%\.@\.".+"/)?.[0];
      return match?.replace('%.@."', '').replace('"', '');
    }
    return null;
  }

  // ---------- CREATE DOWNLOAD BUTTONS ----------
  function createOptionButton(service, url, packageId) {
    const button = document.createElement('button');
    button.className = 'ddlButton';
    button.style.backgroundColor = service.color;

    if (!service.canDDL || service.hasExternal) {
      const link = document.createElement('a');
      link.href = url;
      link.textContent = service.name;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      button.appendChild(link);
    } else {
      const span = document.createElement('span');
      span.textContent = service.name;
      button.appendChild(span);
    }

    if (service.canDDL) {
      button.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleDownload(button, url, packageId, service.name);
        return false;
      };
    } else {
      button.onclick = (e) => {
        e.stopPropagation();
        window.open(url, '_blank', 'noopener,noreferrer');
        return false;
      };
    }

    return button;
  }

  function createMainButton() {
    const mainButton = document.createElement('button');
    mainButton.id = 'mainDownloadButton';
    mainButton.className = 'ddlButton';
    mainButton.textContent = 'Download ▼';
    mainButton.title = 'Download APK from various sources';
    return mainButton;
  }

  function createDropdown(packageId, urls) {
    const dropdown = document.createElement('div');
    dropdown.id = 'buttonDropdown';
    dropdown.style.position = 'absolute';
    dropdown.style.display = 'none';
    dropdown.style.marginTop = '5px';
    dropdown.className = 'dropdown';

    const serviceMap = {
      'APK-DL': urls.apkdl,
      'APKPure': urls.apkpure,
      'APKCombo': urls.apkcombo,
      'APKPremier': urls.apkpremier,
      'Evozi': urls.evozi,
      'APKMirror': urls.apkmirror,
      'Aptoide': urls.aptoide,
      'APKSupport': urls.apksupport,
    };

    DOWNLOAD_SERVICES.forEach(service => {
      const url = serviceMap[service.name];
      if (url) {
        dropdown.appendChild(createOptionButton(service, url, packageId));
      }
    });

    return dropdown;
  }

  // ---------- ADD DOWNLOAD BUTTONS ----------
  function addDownloadButtons() {
    let price = -1;
    let installButton = null;

    if (state.ui > 0) {
      installButton = getInstallButton();
      if (!installButton) return;

      let currentNode = installButton;
      while (currentNode.tagName !== 'C-WIZ') {
        currentNode = currentNode.parentNode;
        if (currentNode.tagName === 'BODY') break;
      }

      try {
        price = currentNode.querySelector(SELECTORS.PRICE_META)?.content;
      } catch (err) {
        logError('Price not found:', err);
        price = 0;
      }

      // Find app C-WIZ for removal on page change
      currentNode = installButton.parentNode;
      do {
        if (currentNode.tagName === 'C-WIZ') {
          state.appCwiz = currentNode;
        }
        currentNode = currentNode.parentNode;
      } while (currentNode.tagName !== 'BODY');
    } else {
      // Handle missing application page
      handleMissingApp();
      installButton = $(SELECTORS.SEARCH_SECTION)?.lastChild;
      price = 0;
    }

    if (price === 0 || price === '0') {
      const packageId = extractPackageId(installButton);
      if (!packageId) {
        logError('Could not extract package ID');
        return;
      }

      const urls = buildDownloadURLs(packageId);
      const buttonsList = installButton?.parentNode;
      if (!buttonsList) return;

      const mainButton = createMainButton();
      const dropdown = createDropdown(packageId, urls);

      mainButton.onclick = (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
      };

      document.body.addEventListener('click', (event) => {
        if (!event.target.closest('#buttonDropdown') && event.target !== mainButton) {
          dropdown.style.display = 'none';
        }
      });

      buttonsList.appendChild(mainButton);
      buttonsList.appendChild(dropdown);
    }
  }

  // ---------- HANDLE MISSING APP PAGE ----------
  function handleMissingApp() {
    const searchSection = $(SELECTORS.SEARCH_SECTION);
    if (!searchSection) return;

    searchSection.lastChild?.remove();

    const packageId = location.search.match(/id=(.*)/)?.[1]?.split('&')[0];
    if (!packageId) return;

    const span1 = document.createElement('span');
    span1.style = 'margin-top: 32px; float: left';
    span1.textContent = 'or ';
    searchSection.appendChild(span1);

    const span2 = document.createElement('span');
    const link = document.createElement('a');
    link.style = 'background-color: #FF8B14; font-weight: bold; text-decoration: none; padding: 1em; margin: 17px; float: left; color: white; cursor: pointer;';
    link.textContent = 'Search on APKMirror';
    link.className = 'rounded';
    link.id = 'apkMirrorBtn';

    const apkmirrorURL = `https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${packageId}`;
    link.addEventListener('click', () => window.open(apkmirrorURL, '_blank', 'noopener,noreferrer'));

    span2.appendChild(link);
    searchSection.appendChild(span2);

    const clearDiv = document.createElement('div');
    clearDiv.style = 'clear:both';
    searchSection.appendChild(clearDiv);

    // Check APKMirror availability
    GM.xmlHttpRequest({
      method: 'GET',
      url: apkmirrorURL,
      timeout: 5000,
      onload: (response) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.responseText, 'text/html');
        const content = doc.getElementById('content');

        if (content?.getElementsByClassName('appRow').length > 0) {
          link.textContent = 'Available on APKMirror';
        } else {
          const unavailable = link.cloneNode(true);
          unavailable.textContent = 'Not available on APKMirror';
          unavailable.style.backgroundColor = '#CCCCCC';
          unavailable.style.cursor = 'not-allowed';
          link.parentNode.replaceChild(unavailable, link);
        }
      },
      onerror: () => {
        log('Failed to check APKMirror availability');
      }
    });
  }

  // ---------- DOWNLOAD HANDLERS ----------
  function updateButtonText(button, text) {
    if (button.firstChild) {
      button.firstChild.textContent = text;
    }
  }

  function buttonError(button, errorText) {
    updateButtonText(button, errorText);
    button.style.backgroundColor = '#CCCCCC';
    button.style.cursor = 'not-allowed';
    button.onclick = null;
  }

  function openLink(url) {
    window.open(url.replace('http://', 'https://'), '_self');
  }

  function handleDownload(button, url, packageId, serviceName) {
    updateButtonText(button, 'Loading...');

    const handlers = {
      'APK-DL': () => downloadFromAPKDL(button, url),
      'APKPure': () => downloadFromAPKPure(button, url),
      'APKCombo': () => downloadFromAPKCombo(button, url),
      'APKPremier': () => downloadFromAPKPremier(button, url),
      'Aptoide': () => downloadFromAptoide(button, url, packageId),
      'APKSupport': () => downloadFromAPKSupport(button, url, packageId),
    };

    const handler = handlers[serviceName];
    if (handler) {
      handler();
    } else {
      buttonError(button, 'Not implemented');
    }
  }

  // ---------- DOWNLOAD FROM APK-DL ----------
  function downloadFromAPKDL(button, url) {
    try {
      GM.xmlHttpRequest({
        method: 'GET',
        url: url,
        timeout: 10000,
        onload: (response) => {
          if (response.finalUrl.includes('/captcha?')) {
            button.addEventListener('click', () => window.open(response.finalUrl, '_blank'));
            updateButtonText(button, 'CAPTCHA');
            button.onclick = null;
          } else if (response.finalUrl.includes('app/removed')) {
            buttonError(button, 'Removed!');
          } else {
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(response.response, 'text/html');
              const linkElement = doc.getElementsByClassName('mdl-button')[0];
              const link = 'http:' + linkElement.getAttribute('href');
              updateButtonText(button, 'Ready!');
              openLink(link);
              button.onclick = () => openLink(link);
            } catch (err) {
              logError('APK-DL parsing error:', err);
              buttonError(button, 'Failed!');
            }
          }
        },
        onerror: () => buttonError(button, 'Offline!'),
        ontimeout: () => buttonError(button, 'Timeout!'),
      });
    } catch (err) {
      logError('APK-DL error:', err);
      buttonError(button, 'Failed!');
    }
  }

  // ---------- DOWNLOAD FROM APKPURE ----------
  function downloadFromAPKPure(button, url) {
    try {
      GM.xmlHttpRequest({
        method: 'GET',
        url: url,
        timeout: 10000,
        onprogress: (response) => {
          const finalUrl = response.finalUrl;
          if (
            finalUrl.includes('winudf.com') ||
            finalUrl.includes('down-apk.com') ||
            finalUrl.includes('/play-apps-download-default/')
          ) {
            window.open(finalUrl, '_self');
            button.onclick = () => openLink(finalUrl);
            updateButtonText(button, 'Ready!');
          }
        },
        onload: (response) => {
          if (response.status === 410) {
            buttonError(button, 'Removed!');
          } else if (response.status === 404) {
            buttonError(button, 'Not found!');
          } else {
            updateButtonText(button, 'Wait...');
          }
        },
        onerror: () => buttonError(button, 'Offline!'),
        ontimeout: () => buttonError(button, 'Timeout!'),
      });
    } catch (err) {
      logError('APKPure error:', err);
      buttonError(button, 'Failed!');
    }
  }

  // ---------- DOWNLOAD FROM APKCOMBO ----------
  function downloadFromAPKCombo(button, url) {
    try {
      GM.xmlHttpRequest({
        method: 'POST',
        url: 'https://apkcombo.com/checkin',
        headers: {
          Referer: url,
          Origin: 'https://apkcombo.com',
        },
        timeout: 10000,
        onload: (checkinResponse) => {
          const checkin = checkinResponse.responseText;

          GM.xmlHttpRequest({
            method: 'GET',
            url: url,
            timeout: 10000,
            onload: (response) => {
              if (response.status === 410) {
                buttonError(button, 'Removed!');
                return;
              }
              if (response.status === 404) {
                buttonError(button, 'Not found!');
                return;
              }

              try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');
                const fileList = doc.getElementsByClassName('file-list')[0];

                if (fileList) {
                  const links = fileList.getElementsByTagName('a');
                  for (const link of links) {
                    const fileLink = link.getAttribute('href');
                    if (fileLink.startsWith('/r2?u=')) {
                      try {
                        window.open(decodeURIComponent(fileLink).split('?u=')[1]);
                      } catch (e) {
                        logError('APKCombo redirect error:', e);
                        buttonError(button, 'Error!');
                      }
                    } else {
                      window.open(fileLink + '&' + checkin);
                    }
                  }
                  updateButtonText(button, 'APKCombo');
                } else {
                  buttonError(button, 'Failed!');
                }
              } catch (err) {
                logError('APKCombo parsing error:', err);
                buttonError(button, 'Failed!');
              }
            },
            onerror: () => buttonError(button, 'Offline!'),
            ontimeout: () => buttonError(button, 'Timeout!'),
          });
        },
        onerror: () => buttonError(button, 'Offline!'),
        ontimeout: () => buttonError(button, 'Timeout!'),
      });
    } catch (err) {
      logError('APKCombo error:', err);
      buttonError(button, 'Failed!');
    }
  }

  // ---------- DOWNLOAD FROM APKPREMIER ----------
  function downloadFromAPKPremier(button, url) {
    try {
      GM.xmlHttpRequest({
        method: 'POST',
        url: url,
        data: 'cmd=apk&gc=0',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
        onload: (response) => {
          if (response.status === 410) {
            buttonError(button, 'Removed!');
            return;
          }
          if (response.status === 404) {
            buttonError(button, 'Not found!');
            return;
          }

          if (response.responseText === 'error capchar') {
            button.addEventListener('click', () => window.open(url, '_blank'));
            updateButtonText(button, 'CAPTCHA');
            button.onclick = null;
            return;
          }

          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(response.responseText, 'text/html');
            const apkLinks = doc.getElementsByClassName('bdlinks');

            if (apkLinks.length > 0) {
              for (const linkElement of apkLinks) {
                const href = linkElement.firstElementChild?.getAttribute('href');
                if (href) {
                  window.open(href, '_self');
                }
              }
              updateButtonText(button, 'Ready!');
            } else {
              buttonError(button, 'Failed!');
            }
          } catch (err) {
            logError('APKPremier parsing error:', err);
            buttonError(button, 'Failed!');
          }
        },
        onerror: () => buttonError(button, 'Offline!'),
        ontimeout: () => buttonError(button, 'Timeout!'),
      });
    } catch (err) {
      logError('APKPremier error:', err);
      buttonError(button, 'Failed!');
    }
  }

  // ---------- DOWNLOAD FROM APTOIDE ----------
  function downloadFromAptoide(button, url, packageId) {
    try {
      GM.xmlHttpRequest({
        method: 'GET',
        url: url,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
        onload: (response) => {
          if (response.status === 410) {
            buttonError(button, 'Removed!');
            return;
          }
          if (response.status === 404) {
            buttonError(button, 'Not found!');
            return;
          }

          try {
            const searchResults = JSON.parse(response.responseText);

            if (searchResults.datalist?.total > 0) {
              for (const app of searchResults.datalist.list) {
                if (app.package === packageId) {
                  // Download splits and OBB if available
                  if (app.aab) {
                    for (const split of app.aab.splits) {
                      window.open(split.path);
                    }
                  }
                  if (app.obb) {
                    window.open(app.obb.main.path);
                  }

                  openLink(searchResults.datalist.list[0].file.path);
                  updateButtonText(button, 'Ready!');
                  return;
                }
              }
              buttonError(button, 'Not found!');
            } else {
              buttonError(button, 'Failed!');
            }
          } catch (err) {
            logError('Aptoide parsing error:', err);
            buttonError(button, 'Failed!');
          }
        },
        onerror: () => buttonError(button, 'Offline!'),
        ontimeout: () => buttonError(button, 'Timeout!'),
      });
    } catch (err) {
      logError('Aptoide error:', err);
      buttonError(button, 'Failed!');
    }
  }

  // ---------- DOWNLOAD FROM APKSUPPORT ----------
  function downloadFromAPKSupport(button, url, packageId) {
    try {
      GM.xmlHttpRequest({
        method: 'POST',
        url: url,
        data: `cmd=csapk&pkg=${packageId}&arch=default&tbi=default&device_id=&model=default&language=en&dpi=480&av=default`,
        headers: {
          Referer: url,
          Origin: 'https://apk.support',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
        onload: (response) => {
          if (!response.responseXML) {
            buttonError(button, 'Failed!');
            return;
          }

          try {
            let links = response.responseXML.querySelectorAll("[href*='.androidcontents.com/']");

            if (links.length === 0) {
              links = response.responseXML.querySelectorAll("[href*='.googleapis.com/download/']");
            }

            if (links.length > 0) {
              updateButtonText(button, 'Ready!');
              for (const link of links) {
                window.open(link.href);
              }
            } else {
              buttonError(button, 'Not found!');
            }
          } catch (err) {
            logError('APKSupport parsing error:', err);
            buttonError(button, 'Failed!');
          }
        },
        onerror: () => buttonError(button, 'Error!'),
        ontimeout: () => buttonError(button, 'Timeout!'),
      });
    } catch (err) {
      logError('APKSupport error:', err);
      buttonError(button, 'Failed!');
    }
  }

  // ---------- INITIALIZATION ----------
  async function initialize() {
    try {
      state.useGoogleServers = await GM.getValue('useGS', false);

      if (document.location.href.includes('apkfind')) {
        setInterval(handleUnredirect, CONFIG.UNREDIRECT_INTERVAL);
        return;
      }

      state.ui = detectUI();
      state.pageURL = location.href;

      if (state.ui > 0) {
        const titleElement = $(SELECTORS.MAIN_TITLE);
        if (titleElement) {
          state.title = titleElement.innerHTML;
        }
        injectStyles();
      }

      if (
        state.pageURL.includes('details?id=') ||
        state.pageURL.includes('/store/search?q=')
      ) {
        addDownloadButtons();
      }

      setInterval(checkForPageChange, CONFIG.CHECK_RELOAD_INTERVAL);

      log('Script initialized successfully');
    } catch (err) {
      logError('Initialization error:', err);
    }
  }

  // ---------- START ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();