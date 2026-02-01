// ==UserScript==
// @name         RPS HTML Backup v3
// @namespace    RPS HTML Backup v3
// @version      3
// @description  Save all sections with SSI includes or full HTML into a single ZIP file. Automatically splits page sections and generates master index files.
// @match        https://rocklandpropertysolutions.com/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @downloadURL  https://update.greasyfork.org/scripts/RPS-HTML-Section-Splitter.user.js
// @updateURL    https://update.greasyfork.org/scripts/RPS-HTML-Section-Splitter.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // ===== Configuration =====
    const CONFIG = {
        selectors: {
            sections: 'section, div[id]',
            headings: 'h1, h2, h3, h4, h5, h6'
        },
        modes: {
            SSI: 'SSI',
            FULL: 'FULL'
        },
        colors: {
            primary: '#0a5ea8',
            secondary: '#25D366'
        },
        buttonPosition: {
            right: '15px',
            top: {
                first: '15px',
                second: '55px'
            },
            gap: '6px'
        }
    };

    // ===== Utility Functions =====

    /**
     * Generate timestamp for filenames
     * @returns {string} Formatted timestamp (YYYY-MM-DD_HH-MM)
     */
    function getTimestamp() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');

        const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;

        return `${date}_${time}`;
    }

    /**
     * Clean and extract HTML from a node
     * @param {HTMLElement} node - DOM node to extract HTML from
     * @returns {string} Cleaned HTML string
     */
    function cleanHTML(node) {
        return node.outerHTML.trim();
    }

    /**
     * Generate smart filename from section content
     * @param {HTMLElement} section - Section element
     * @param {number} index - Section index
     * @returns {string} Generated filename
     */
    function getSmartName(section, index) {
        // Check for ID attribute first
        if (section.id) {
            return section.id;
        }

        // Try to get heading text
        const heading = section.querySelector(CONFIG.selectors.headings);
        if (heading && heading.textContent.trim()) {
            let name = heading.textContent.trim().toLowerCase();

            // Remove special characters
            name = name.replace(/[^a-z0-9\s]/g, '');

            // Replace spaces with underscores
            name = name.replace(/\s+/g, '_');

            return name;
        }

        // Fallback to generic name
        return `section_${index}`;
    }

    /**
     * Create master HTML file header
     * @param {string} mode - Mode type (SSI or FULL)
     * @returns {string} HTML header
     */
    function createMasterHeader(mode) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website Master – ${mode} Mode</title>
</head>
<body>
`;
    }

    /**
     * Create master HTML file footer
     * @returns {string} HTML footer
     */
    function createMasterFooter() {
        return `
</body>
</html>`;
    }

    /**
     * Generate manifest as plain text
     * @param {Array} manifest - Manifest array
     * @returns {string} Plain text manifest
     */
    function generateManifestText(manifest) {
        return manifest.map(item => `${item.order}. ${item.filename}`).join('\n');
    }

    // ===== Core Functionality =====

    /**
     * Process sections and create ZIP archive
     * @param {string} mode - Mode type (SSI or FULL)
     */
    async function splitSections(mode) {
        // Find all sections
        const sections = document.querySelectorAll(CONFIG.selectors.sections);

        if (!sections.length) {
            alert('⚠️ No sections found! Make sure the page has <section> or <div id="..."> elements.');
            return;
        }

        const timestamp = getTimestamp();
        const zip = new JSZip();
        const manifest = [];

        // Start building master index
        let masterIndex = createMasterHeader(mode);

        // Process each section
        sections.forEach((section, index) => {
            const name = getSmartName(section, index + 1);
            const filename = `${name}_${timestamp}.html`;
            const html = cleanHTML(section);

            // Add section file to ZIP
            zip.file(filename, html);

            // Add to master index based on mode
            if (mode === CONFIG.modes.SSI) {
                masterIndex += `  <!--#include file="${filename}" -->\n`;
            } else if (mode === CONFIG.modes.FULL) {
                masterIndex += `  ${html}\n\n`;
            }

            // Add to manifest
            manifest.push({
                order: index + 1,
                name: name,
                filename: filename
            });
        });

        // Complete master index
        masterIndex += createMasterFooter();

        // Determine output filename
        const masterFilename = mode === CONFIG.modes.SSI
            ? `index_split_${timestamp}.html`
            : `index_full_${timestamp}.html`;

        // Add master file to ZIP
        zip.file(masterFilename, masterIndex);

        // Add manifest files
        zip.file(`sections_manifest_${timestamp}.json`, JSON.stringify(manifest, null, 2));
        zip.file(`sections_manifest_${timestamp}.txt`, generateManifestText(manifest));

        // Generate and download ZIP
        try {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const downloadLink = document.createElement('a');
            const zipFilename = `website_backup_${timestamp}.zip`;

            downloadLink.href = URL.createObjectURL(zipBlob);
            downloadLink.download = zipFilename;
            downloadLink.click();

            // Clean up
            setTimeout(() => URL.revokeObjectURL(downloadLink.href), 100);

            alert(`✅ Backup complete!\n\nDownloaded: ${zipFilename}\nSections processed: ${sections.length}`);
        } catch (error) {
            console.error('[RPS HTML Splitter] Error generating ZIP:', error);
            alert('❌ Error creating backup. Check console for details.');
        }
    }

    // ===== UI Functions =====

    /**
     * Create button element with styling
     * @param {string} text - Button text
     * @param {string} top - Top position
     * @param {string} color - Button color
     * @param {Function} onClick - Click handler
     * @returns {HTMLButtonElement} Button element
     */
    function createButton(text, top, color, onClick) {
        const button = document.createElement('button');
        button.textContent = text;

        Object.assign(button.style, {
            position: 'fixed',
            right: CONFIG.buttonPosition.right,
            top: top,
            zIndex: '999999',
            padding: '8px 12px',
            marginBottom: CONFIG.buttonPosition.gap,
            background: color,
            color: '#fff',
            fontSize: '14px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 3px 8px rgba(0,0,0,.25)',
            transition: 'transform 0.2s, box-shadow 0.2s'
        });

        // Hover effects
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 5px 12px rgba(0,0,0,.35)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 3px 8px rgba(0,0,0,.25)';
        });

        button.addEventListener('click', onClick);

        return button;
    }

    /**
     * Add control buttons to page
     */
    function addButtons() {
        // SSI Mode button
        const buttonSSI = createButton(
            '💾 Split HTML (SSI)',
            CONFIG.buttonPosition.top.first,
            CONFIG.colors.primary,
            () => splitSections(CONFIG.modes.SSI)
        );

        // Full Copy Mode button
        const buttonFull = createButton(
            '💾 Split HTML (Full Copy)',
            CONFIG.buttonPosition.top.second,
            CONFIG.colors.secondary,
            () => splitSections(CONFIG.modes.FULL)
        );

        // Add buttons to page
        document.body.appendChild(buttonSSI);
        document.body.appendChild(buttonFull);

        console.log('[RPS HTML Splitter] Buttons added successfully');
    }

    // ===== Initialization =====

    /**
     * Initialize the script
     */
    function init() {
        // Wait for page to load
        if (document.readyState === 'loading') {
            window.addEventListener('load', addButtons);
        } else {
            addButtons();
        }

        console.log('[RPS HTML Splitter] Script initialized');
    }

    // Start the script
    init();

})();