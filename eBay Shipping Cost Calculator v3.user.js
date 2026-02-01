// ==UserScript==
// @name         eBay Shipping Cost Calculator v3
// @namespace    http://tampermonkey.net/
// @version      3
// @description  Adds shipping cost to item price in eBay search results (skips free shipping) - Optimized
// @author       none
// @match        https://www.ebay.com/sch/*
// @icon         https://www.ebay.com/favicon.ico
// @grant        none
// @downloadURL  https://update.greasyfork.org/scripts/513999/eBay%20Shipping%20Cost%20Calculator.user.js
// @updateURL    https://update.greasyfork.org/scripts/513999/eBay%20Shipping%20Cost%20Calculator.meta.js
// ==/UserScript==

(function() {
    'use strict';

    let processing = false;
    let debounceTimer;
    const processedItems = new WeakSet();

    // --- Settings ---
    let settings = {
        taxRate: parseFloat(localStorage.getItem('ebayTaxRate')) || 0,
        color: localStorage.getItem('ebayTotalColor') || '#e42648',
        fontSize: localStorage.getItem('ebayTotalFontSize') || '18'
    };

    // --- Settings UI ---
    function createSettingsButton() {
        const button = document.createElement('div');
        button.id = 'ebay-settings-button';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background-color: #e42648;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(button);
        button.addEventListener('click', toggleSettingsWindow);
    }

    function createSettingsWindow() {
        const settingsDiv = document.createElement('div');
        settingsDiv.id = 'ebay-shipping-settings';
        settingsDiv.style.cssText = `
            position: fixed;
            top: 40px;
            right: 20px;
            z-index: 2147483647;
            background: white;
            border: 1px solid #ccc;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            font-family: Arial, sans-serif;
            min-width: 220px;
            display: none;
        `;

        settingsDiv.innerHTML = `
            <strong>Shipping Calculator Settings</strong><br><br>
            <label>Tax Rate (%): <input type="number" id="ebay-tax-rate" min="0" max="100" step="0.01" value="${settings.taxRate}" style="width:60px"></label><br><br>
            <label>Text Color: <input type="color" id="ebay-total-color" value="${settings.color}"></label><br><br>
            <label>Text Size:
                <input type="range" id="ebay-total-fontsize" min="12" max="36" value="${settings.fontSize}" style="vertical-align:middle;">
                <span id="ebay-total-fontsize-value">${settings.fontSize}px</span>
            </label><br><br>
        `;

        document.body.appendChild(settingsDiv);

        // Click outside to close
        document.addEventListener('click', function(e) {
            const settingsDiv = document.getElementById('ebay-shipping-settings');
            const settingsButton = document.getElementById('ebay-settings-button');
            if (settingsDiv && settingsDiv.style.display === 'block') {
                if (!settingsDiv.contains(e.target) && !settingsButton.contains(e.target)) {
                    settingsDiv.style.display = 'none';
                }
            }
        });

        // Event listeners
        document.getElementById('ebay-tax-rate').addEventListener('input', function() {
            settings.taxRate = parseFloat(this.value) || 0;
            localStorage.setItem('ebayTaxRate', settings.taxRate);
            processedItems.clear();
            addShippingToPrices();
        });
        document.getElementById('ebay-total-color').addEventListener('input', function() {
            settings.color = this.value;
            localStorage.setItem('ebayTotalColor', settings.color);
            updateExistingTotals();
        });
        document.getElementById('ebay-total-fontsize').addEventListener('input', function() {
            settings.fontSize = this.value;
            localStorage.setItem('ebayTotalFontSize', settings.fontSize);
            document.getElementById('ebay-total-fontsize-value').textContent = `${settings.fontSize}px`;
            updateExistingTotals();
        });
    }

    function toggleSettingsWindow() {
        const settingsDiv = document.getElementById('ebay-shipping-settings');
        if (settingsDiv) {
            settingsDiv.style.display = settingsDiv.style.display === 'none' ? 'block' : 'none';
        }
    }

    // --- Main logic ---
    function addShippingToPrices() {
        if (processing) return;
        processing = true;

        const priceRows = document.querySelectorAll('.s-card__attribute-row');

        priceRows.forEach(priceRow => {
            if (processedItems.has(priceRow)) return;

            const priceEl = priceRow.querySelector('.s-card__price');
            if (!priceEl) return;

            let nextRow = priceRow.nextElementSibling;
            let shippingEl = null;

            while (nextRow) {
                if (nextRow.classList.contains('s-card__attribute-row')) {
                    shippingEl = Array.from(nextRow.querySelectorAll('span')).find(
                        el => el.textContent.toLowerCase().includes('delivery')
                    );
                    if (shippingEl) break;
                }
                nextRow = nextRow.nextElementSibling;
            }

            if (!shippingEl) return;

            const price = parsePrice(priceEl.textContent);
            const shipping = parseShipping(shippingEl.textContent);

            // Skip free shipping
            if (shipping === 0) {
                const old = priceRow.querySelector('.s-item__total');
                if (old) old.remove();
                processedItems.add(priceRow);
                return;
            }

            if (price !== null && shipping !== null && shipping > 0) {
                let total = price + shipping;
                if (settings.taxRate > 0) {
                    total += total * (settings.taxRate / 100);
                }

                let totalEl = priceRow.querySelector('.s-item__total');
                if (!totalEl) {
                    totalEl = document.createElement('div');
                    totalEl.className = 's-item__total';
                    priceEl.parentNode.insertBefore(totalEl, priceEl.nextSibling);
                }

                totalEl.textContent = `Total: $${total.toFixed(2)}`;
                totalEl.style.cssText = `
                    color: ${settings.color};
                    font-weight: bold;
                    font-size: ${settings.fontSize}px;
                `;
            }

            processedItems.add(priceRow);
        });

        processing = false;
    }

    function updateExistingTotals() {
        document.querySelectorAll('.s-item__total').forEach(totalEl => {
            totalEl.style.cssText = `
                color: ${settings.color};
                font-weight: bold;
                font-size: ${settings.fontSize}px;
            `;
        });
    }

    function parsePrice(text) {
        const match = text.match(/\$([\d,.]+)/);
        if (!match) return null;
        return parseFloat(match[1].replace(/,/g, ''));
    }

    function parseShipping(text) {
        if (/free/i.test(text)) return 0;
        const match = text.match(/\$([\d,.]+)\s+delivery/i);
        if (match) return parseFloat(match[1].replace(/,/g, ''));
        const fallback = text.match(/\$([\d,.]+)/);
        if (fallback) return parseFloat(fallback[1].replace(/,/g, ''));
        return null;
    }

    function handleMutations() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(addShippingToPrices, 300);
    }

    // --- Init ---
    createSettingsButton();
    createSettingsWindow();

    // Initial run after page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addShippingToPrices);
    } else {
        addShippingToPrices();
    }

    // Observer for dynamic content
    const container = document.querySelector('.srp-river-main');
    if (container) {
        const observer = new MutationObserver(handleMutations);
        observer.observe(container, {
            childList: true,
            subtree: false
        });
    }
})();