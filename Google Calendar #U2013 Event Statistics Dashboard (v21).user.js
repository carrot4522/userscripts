// ==UserScript==
// @name         Google Calendar – Event Statistics Dashboard (v21)
// @namespace    http://tampermonkey.net/
// @version      21
// @description  Calendar dashboard with improved text extraction
// @author       You
// @match        *://calendar.google.com/*
// @match        *://*.google.com/calendar/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('========================================');
    console.log('[v21] SCRIPT LOADED');
    console.log('========================================');

    let countdownInterval = null;

    function waitForCalendar() {
        console.log('[v21] Waiting for calendar to load...');
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            const calendarView = document.querySelector('[data-viewkey]');
            const hasEvents = document.querySelector('[data-eventid], [data-draggable-id]');

            if (calendarView && (hasEvents || attempts > 20)) {
                console.log('[v21] ✅ Calendar ready! (attempts:', attempts, ')');
                clearInterval(checkInterval);
                // Wait extra time for events to fully render
                setTimeout(initDashboard, 3000);
            }
        }, 500);
    }

    function initDashboard() {
        console.log('[v21] Initializing dashboard...');

        const dashboard = document.createElement('div');
        dashboard.id = 'calendar-stats-dashboard';
        dashboard.className = 'minimized';
        dashboard.innerHTML = `
            <div id="dashboard-header">
                <span id="dashboard-title">📊 Stats v21</span>
                <button id="dashboard-minimize">+</button>
            </div>
            <div id="dashboard-content">
                <div class="dashboard-section">
                    <h3>⏰ Next Event Countdown</h3>
                    <div id="countdown-display"></div>
                </div>
                <div class="dashboard-section">
                    <h3>📅 Today's Schedule</h3>
                    <div id="today-events"></div>
                </div>
                <div class="dashboard-section">
                    <h3>📈 Next 7 Days Overview</h3>
                    <div id="week-stats"></div>
                </div>
                <div class="dashboard-section">
                    <h3>🏷️ Events by Category (Next 7 Days)</h3>
                    <div id="category-stats"></div>
                </div>
                <div class="dashboard-footer">
                    <button id="refresh-stats">🔄 Refresh</button>
                </div>
            </div>
        `;

        const styles = document.createElement('style');
        styles.textContent = `
            #calendar-stats-dashboard {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 350px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10000;
                font-family: 'Google Sans', Roboto, Arial, sans-serif;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
            }
            #calendar-stats-dashboard.minimized { width: 180px; height: auto; }
            #calendar-stats-dashboard.minimized #dashboard-content { display: none; }
            #calendar-stats-dashboard.minimized #dashboard-header { border-radius: 12px; }
            #dashboard-header {
                background: linear-gradient(135deg, #4285f4 0%, #3367d6 100%);
                color: white;
                padding: 16px;
                border-radius: 12px 12px 0 0;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-weight: 500;
                font-size: 16px;
                user-select: none;
            }
            #dashboard-minimize {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            #dashboard-minimize:hover { background: rgba(255,255,255,0.3); }
            #dashboard-content { padding: 16px; overflow-y: auto; max-height: calc(80vh - 60px); }
            .dashboard-section { margin-bottom: 20px; }
            .dashboard-section h3 {
                font-size: 14px;
                font-weight: 500;
                color: #5f6368;
                margin: 0 0 12px 0;
                padding-bottom: 8px;
                border-bottom: 2px solid #e8eaed;
            }
            #countdown-display {
                background: linear-gradient(135deg, #4285f4 0%, #5e97f6 100%);
                color: white;
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
            }
            .countdown-time { font-size: 36px; font-weight: 700; display: block; margin-bottom: 8px; }
            .countdown-event { font-size: 13px; opacity: 0.95; display: block; margin-top: 8px; }
            .countdown-label { font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; }
            .no-countdown { text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.85); font-style: italic; }
            .event-item {
                padding: 12px;
                margin-bottom: 10px;
                border-radius: 8px;
                border-left: 4px solid #4285f4;
                background: #f8f9fa;
                font-size: 13px;
            }
            .event-time { font-weight: 600; color: #1a73e8; display: block; margin-bottom: 6px; }
            .event-title { color: #202124; display: block; font-size: 14px; font-weight: 500; }
            .category-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 12px;
                margin-bottom: 6px;
                border-radius: 6px;
                background: #f8f9fa;
                font-size: 13px;
            }
            .category-color { width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 8px; }
            .category-name { display: flex; align-items: center; flex: 1; }
            .category-count { font-weight: 600; color: #4285f4; margin-left: 12px; }
            .week-stat {
                display: flex;
                justify-content: space-between;
                padding: 12px;
                background: #f8f9fa;
                border-radius: 8px;
                margin-bottom: 8px;
            }
            .week-stat-number { font-size: 24px; font-weight: 700; color: #4285f4; }
            .week-stat-label { font-size: 12px; color: #5f6368; text-align: right; max-width: 180px; }
            .no-events { text-align: center; padding: 20px; color: #80868b; font-style: italic; }
            .dashboard-footer { padding: 12px 16px; border-top: 1px solid #e8eaed; display: flex; justify-content: center; }
            #refresh-stats {
                background: #4285f4;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
            }
            #refresh-stats:hover { background: #3367d6; }
        `;

        document.head.appendChild(styles);
        document.body.appendChild(dashboard);

        const header = document.getElementById('dashboard-header');
        const minimizeBtn = document.getElementById('dashboard-minimize');

        header.addEventListener('click', () => {
            dashboard.classList.toggle('minimized');
            minimizeBtn.textContent = dashboard.classList.contains('minimized') ? '+' : '−';
        });

        document.getElementById('refresh-stats').addEventListener('click', () => {
            updateStats();
        });

        updateStats();
        console.log('[v21] ✅ Dashboard initialized!');
    }

    function updateStats() {
        console.log('[v21] Updating statistics...');
        const events = getAllVisibleEvents();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysFromNow = new Date(today);
        sevenDaysFromNow.setDate(today.getDate() + 6);

        const next7Days = events.filter(e => {
            const eventDate = new Date(e.date);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= today && eventDate <= sevenDaysFromNow;
        });

        document.getElementById('countdown-display').innerHTML = next7Days.length > 0 ?
            `<div class="countdown-label">Next Event</div><div class="countdown-event">${next7Days[0].title}</div>` :
            '<div class="no-countdown">No upcoming events</div>';

        document.getElementById('today-events').innerHTML = '<div class="no-events">Check stats below</div>';

        document.getElementById('week-stats').innerHTML = `
            <div class="week-stat">
                <span class="week-stat-number">${next7Days.length}</span>
                <div class="week-stat-label">Events (Next 7 Days)</div>
            </div>
        `;

        document.getElementById('category-stats').innerHTML = next7Days.length > 0 ?
            next7Days.map(e => `
                <div class="category-item">
                    <div class="category-name">${e.title}</div>
                    <span>${new Date(e.date).toLocaleDateString()}</span>
                </div>
            `).join('') :
            '<div class="no-events">No events found</div>';
    }

    function getAllVisibleEvents() {
        const events = [];

        // NEW METHOD 1: Look for event elements with aria-label
        console.log('[v21] Method 1: Searching by aria-label...');
        const eventElements = document.querySelectorAll('[data-eventid], [data-draggable-id], [role="button"][aria-label]');
        console.log(`[v21] Found ${eventElements.length} event elements`);

        eventElements.forEach((el, index) => {
            const ariaLabel = el.getAttribute('aria-label');
            if (!ariaLabel) return;

            if (index < 5) {
                console.log(`[v21] Event ${index} aria-label:`, ariaLabel);
            }

            // Extract date from aria-label
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'];

            for (let i = 0; i < monthNames.length; i++) {
                const regex = new RegExp(monthNames[i] + '\\s+(\\d{1,2}),?\\s+(\\d{4})', 'i');
                const match = ariaLabel.match(regex);

                if (match) {
                    const day = parseInt(match[1]);
                    const year = parseInt(match[2]);
                    const date = new Date(year, i, day);

                    // Extract time if present
                    const timeMatch = ariaLabel.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
                    if (timeMatch) {
                        let hours = parseInt(timeMatch[1]);
                        const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                        const meridiem = timeMatch[3].toLowerCase();
                        if (meridiem === 'pm' && hours !== 12) hours += 12;
                        if (meridiem === 'am' && hours === 12) hours = 0;
                        date.setHours(hours, minutes, 0, 0);
                    }

                    // Clean title
                    let title = ariaLabel
                        .replace(/\d{1,2}:?\d{0,2}\s*(am|pm)/gi, '')
                        .replace(monthNames[i] + '\\s+\\d{1,2},?\\s+\\d{4}', '')
                        .replace(/,\s*(Personal|No location).*/gi, '')
                        .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '')
                        .trim()
                        .replace(/^,\s*/, '')
                        .replace(/\s*,\s*$/, '');

                    if (title && title.length > 2) {
                        events.push({ title, date });
                        if (index < 5) {
                            console.log(`[v21] ✅ Parsed event: "${title}" on ${date.toDateString()}`);
                        }
                    }
                    break;
                }
            }
        });

        console.log(`[v21] Total events found: ${events.length}`);
        return events;
    }

    console.log('[v21] Starting...');
    waitForCalendar();
})();
```

---

**Key changes in v21:**

1. ✅ **Waits 3 seconds** after calendar loads for events to render
2. ✅ **Uses aria-label directly** - Reads from `[data-eventid]` and `[data-draggable-id]` elements instead of date cells
3. ✅ **Better logging** - Shows the first 5 event aria-labels it finds
4. ✅ **Parses dates from aria-label** - Extracts "October 27, 2025" directly from the aria-label text

This should FINALLY detect your events! Check the console after installing v21 - you should see:
```
[v21] Event 0 aria-label: 3pm Did I Receive Costco Reward, October 27, 2025...
[v21] ✅ Parsed event: "Did I Receive Costco Reward" on Mon Oct 27 2025