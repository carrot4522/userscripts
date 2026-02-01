// ==UserScript==
// @name         Claude Scroll Fix v2
// @version      2
// @match        https://claude.ai/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(() => {
    console.log('🔴 Claude Scroll v2: Starting with activation check...');

    let mainScrollContainer = null;
    let autoScrollInterval = null;
    let activeAutoScrollButton = null;
    let progressBar = null;
    let scrollTimeout = null;
    let isActivated = false;
    let activationCheckInterval = null;

    // Configuration
    const CONFIG = {
        scrollUpAmount: 800,
        scrollDownAmount: 1000,
        smoothDuration: 600,
        autoScrollSpeed: 2,
        autoScrollInterval: 20,
    };

    // Check if the required element exists on the page
    function checkActivationElement() {
        const selector = 'div.w-6.h-6.flex.items-center.justify-center.group-active\\:\\!scale-\\[0\\.98\\].group-active\\:\\!shadow-none.group-active\\:bg-accent-main-200.group-hover\\:-rotate-3.group-hover\\:scale-110.group-active\\:rotate-6.rounded-full.transition-all.ease-in-out.bg-accent-main-000.group-hover\\:shadow-md';

        const element = document.querySelector(selector);

        if (element) {
            console.log('🔴 Claude Scroll v2: Activation element found! Script will activate.');
            return true;
        }

        console.log('🔴 Claude Scroll v2: Activation element not found. Script remains inactive.');
        return false;
    }

    // Initialize the script
    function initializeScript() {
        if (isActivated) return;

        isActivated = true;
        console.log('🔴 Claude Scroll v2: Activating script...');

        createProgressBar();
        addButtons();
        initScrollListener();
        updateProgressBar();

        console.log('🔴 Claude Scroll v2: Ready with red progress bar!');
    }

    // Deactivate the script
    function deactivateScript() {
        if (!isActivated) return;

        isActivated = false;
        console.log('🔴 Claude Scroll v2: Deactivating script...');

        stopAutoScroll();

        // Remove buttons
        const buttonContainer = document.querySelector('[data-scroll-container-claude-v2]');
        if (buttonContainer) {
            buttonContainer.remove();
        }

        // Remove progress bar
        if (progressBar) {
            progressBar.remove();
            progressBar = null;
        }

        // Remove style
        const style = document.getElementById('progress-animation-style-v2');
        if (style) {
            style.remove();
        }

        console.log('🔴 Claude Scroll v2: Script deactivated.');
    }

    // Find the main scroll container
    function findMainScrollContainer() {
        if (mainScrollContainer && document.contains(mainScrollContainer)) {
            return mainScrollContainer;
        }

        const scrollables = [];
        document.querySelectorAll('*').forEach(el => {
            if (el.scrollHeight > el.clientHeight + 100) {
                const rect = el.getBoundingClientRect();
                if (rect.height > 300 && rect.width > 300) {
                    scrollables.push({
                        element: el,
                        scrollHeight: el.scrollHeight,
                        clientHeight: el.clientHeight
                    });
                }
            }
        });

        scrollables.sort((a, b) =>
            (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight)
        );

        if (scrollables.length > 0) {
            mainScrollContainer = scrollables[0].element;
            return mainScrollContainer;
        }

        return null;
    }

    // Create red progress bar
    function createProgressBar() {
        if (progressBar) return progressBar;

        progressBar = document.createElement('div');
        progressBar.id = 'claude-progress-v2';
        progressBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            width: 0%;
            background: #ef4444;
            z-index: 999999998;
            transition: width 0.15s ease-out, opacity 0.3s ease;
            opacity: 0.5;
        `;

        // Add glow effect when scrolling
        const style = document.createElement('style');
        style.id = 'progress-animation-style-v2';
        style.textContent = `
            .progress-scrolling {
                opacity: 0.8 !important;
                box-shadow: 0 0 8px rgba(239, 68, 68, 0.6) !important;
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(progressBar);
        console.log('🔴 Claude Scroll v2: Red progress bar created');
        return progressBar;
    }

    // Start glow effect
    function startProgressAnimation() {
        if (progressBar) {
            progressBar.classList.add('progress-scrolling');
        }
    }

    // Stop glow effect
    function stopProgressAnimation() {
        if (progressBar) {
            progressBar.classList.remove('progress-scrolling');
        }
    }

    // Update progress bar
    function updateProgressBar() {
        if (!progressBar) return;

        startProgressAnimation();

        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }

        scrollTimeout = setTimeout(() => {
            stopProgressAnimation();
        }, 500);

        const container = findMainScrollContainer();
        if (container) {
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            const maxScroll = scrollHeight - clientHeight;
            const scrollPercent = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;

            progressBar.style.width = scrollPercent + '%';
        } else {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight;
            const clientHeight = document.documentElement.clientHeight;
            const maxScroll = scrollHeight - clientHeight;
            const scrollPercent = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;

            progressBar.style.width = scrollPercent + '%';
        }
    }

    // Smooth scroll to a position
    function smoothScrollTo(container, targetPosition) {
        if (!container) return;

        const startPosition = container.scrollTop;
        const distance = targetPosition - startPosition;
        const duration = CONFIG.smoothDuration;
        let startTime = null;

        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);

            const easeProgress = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            container.scrollTop = startPosition + (distance * easeProgress);
            updateProgressBar();

            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        }

        requestAnimationFrame(animation);
    }

    // Stop all auto-scrolling
    function stopAutoScroll() {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
        activeAutoScrollButton = null;
    }

    // Reset all buttons to inactive state
    function resetAllButtons() {
        const btnAutoUp = document.querySelector('[data-scroll-btn-claude-v2="auto-up"]');
        const btnAutoDown = document.querySelector('[data-scroll-btn-claude-v2="auto-down"]');

        if (btnAutoUp) {
            btnAutoUp.style.background = 'rgba(99, 102, 241, 0.12)';
            btnAutoUp.style.borderColor = 'rgba(99, 102, 241, 0.4)';
            btnAutoUp.querySelector('.icon').style.color = '#6366f1';
            btnAutoUp.querySelector('.label').textContent = 'AUTO';
            btnAutoUp.querySelector('.label').style.color = '#6366f1';
        }
        if (btnAutoDown) {
            btnAutoDown.style.background = 'rgba(236, 72, 153, 0.12)';
            btnAutoDown.style.borderColor = 'rgba(236, 72, 153, 0.4)';
            btnAutoDown.querySelector('.icon').style.color = '#ec4899';
            btnAutoDown.querySelector('.label').textContent = 'AUTO';
            btnAutoDown.querySelector('.label').style.color = '#ec4899';
        }
    }

    // Toggle auto-scroll UP
    function toggleAutoScrollUp(button) {
        if (activeAutoScrollButton === 'up') {
            stopAutoScroll();
            resetAllButtons();
            console.log('🔴 Claude Scroll v2: Auto-scroll UP stopped');
            return;
        }

        stopAutoScroll();
        resetAllButtons();

        activeAutoScrollButton = 'up';
        button.style.background = 'rgba(239, 68, 68, 0.2)';
        button.style.borderColor = 'rgba(239, 68, 68, 0.6)';
        button.querySelector('.icon').style.color = '#ef4444';
        button.querySelector('.label').textContent = 'STOP';
        button.querySelector('.label').style.color = '#ef4444';

        autoScrollInterval = setInterval(() => {
            const container = findMainScrollContainer();
            if (container) {
                container.scrollTop -= CONFIG.autoScrollSpeed;
                updateProgressBar();
            } else {
                window.scrollBy(0, -CONFIG.autoScrollSpeed);
                updateProgressBar();
            }
        }, CONFIG.autoScrollInterval);

        console.log('🔴 Claude Scroll v2: Auto-scroll UP started');
    }

    // Toggle auto-scroll DOWN
    function toggleAutoScrollDown(button) {
        if (activeAutoScrollButton === 'down') {
            stopAutoScroll();
            resetAllButtons();
            console.log('🔴 Claude Scroll v2: Auto-scroll DOWN stopped');
            return;
        }

        stopAutoScroll();
        resetAllButtons();

        activeAutoScrollButton = 'down';
        button.style.background = 'rgba(239, 68, 68, 0.2)';
        button.style.borderColor = 'rgba(239, 68, 68, 0.6)';
        button.querySelector('.icon').style.color = '#ef4444';
        button.querySelector('.label').textContent = 'STOP';
        button.querySelector('.label').style.color = '#ef4444';

        autoScrollInterval = setInterval(() => {
            const container = findMainScrollContainer();
            if (container) {
                container.scrollTop += CONFIG.autoScrollSpeed;
                updateProgressBar();
            } else {
                window.scrollBy(0, CONFIG.autoScrollSpeed);
                updateProgressBar();
            }
        }, CONFIG.autoScrollInterval);

        console.log('🔴 Claude Scroll v2: Auto-scroll DOWN started');
    }

    // Scroll up function
    function scrollUp() {
        stopAutoScroll();
        resetAllButtons();

        const container = findMainScrollContainer();
        if (container) {
            const targetPosition = Math.max(0, container.scrollTop - CONFIG.scrollUpAmount);
            smoothScrollTo(container, targetPosition);
        } else {
            window.scrollBy({
                top: -CONFIG.scrollUpAmount,
                behavior: 'smooth'
            });
        }
        console.log('🔴 Claude Scroll v2: Jumped UP 800px');
    }

    // Scroll down function
    function scrollDown() {
        stopAutoScroll();
        resetAllButtons();

        const container = findMainScrollContainer();
        if (container) {
            const maxScroll = container.scrollHeight - container.clientHeight;
            const targetPosition = Math.min(maxScroll, container.scrollTop + CONFIG.scrollDownAmount);
            smoothScrollTo(container, targetPosition);
        } else {
            window.scrollBy({
                top: CONFIG.scrollDownAmount,
                behavior: 'smooth'
            });
        }
        console.log('🔴 Claude Scroll v2: Jumped DOWN 1000px');
    }

    // Add floating buttons
    function addButtons() {
        if (document.querySelector('[data-scroll-container-claude-v2]')) return;

        const container = document.createElement('div');
        container.setAttribute('data-scroll-container-claude-v2', 'true');
        container.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 999999999;
        `;

        const buttonBaseStyle = `
            color: white;
            border: 2px solid;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;

        // Row 1: Auto-scroll UP
        const row1 = document.createElement('div');
        row1.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

        const btnAutoUp = document.createElement('button');
        btnAutoUp.setAttribute('data-scroll-btn-claude-v2', 'auto-up');
        btnAutoUp.innerHTML = `
            <div class="icon" style="font-size: 24px; line-height: 1; transition: color 0.25s;">▲</div>
            <div class="label" style="font-size: 12px; font-weight: 700; margin-top: 4px; letter-spacing: 0.5px; transition: all 0.25s; color: #6366f1;">AUTO</div>
        `;
        btnAutoUp.title = 'Toggle auto-scroll UP';
        btnAutoUp.style.cssText = buttonBaseStyle + `
            width: 64px;
            height: 64px;
            background: rgba(99, 102, 241, 0.12);
            border-color: rgba(99, 102, 241, 0.4);
            border-radius: 16px;
        `;
        btnAutoUp.querySelector('.icon').style.color = '#6366f1';

        btnAutoUp.onmouseenter = () => {
            if (activeAutoScrollButton !== 'up') {
                btnAutoUp.style.transform = 'translateY(-2px)';
                btnAutoUp.style.background = 'rgba(99, 102, 241, 0.18)';
                btnAutoUp.style.borderColor = 'rgba(99, 102, 241, 0.6)';
            }
        };
        btnAutoUp.onmouseleave = () => {
            if (activeAutoScrollButton !== 'up') {
                btnAutoUp.style.transform = 'translateY(0)';
                btnAutoUp.style.background = 'rgba(99, 102, 241, 0.12)';
                btnAutoUp.style.borderColor = 'rgba(99, 102, 241, 0.4)';
            }
        };
        btnAutoUp.onclick = () => toggleAutoScrollUp(btnAutoUp);

        row1.appendChild(btnAutoUp);

        // Row 2: Jump buttons
        const row2 = document.createElement('div');
        row2.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

        const btnJumpUp = document.createElement('button');
        btnJumpUp.setAttribute('data-scroll-btn-claude-v2', 'jump-up');
        btnJumpUp.innerHTML = '<div style="font-size: 22px; line-height: 1;">⬆</div>';
        btnJumpUp.title = 'Jump up 800px (Page Up)';
        btnJumpUp.style.cssText = buttonBaseStyle + `
            width: 50px;
            height: 50px;
            background: rgba(14, 165, 233, 0.12);
            border-color: rgba(14, 165, 233, 0.4);
            border-radius: 14px;
            color: #0ea5e9;
        `;

        btnJumpUp.onmouseenter = () => {
            btnJumpUp.style.transform = 'translateY(-2px)';
            btnJumpUp.style.background = 'rgba(14, 165, 233, 0.18)';
            btnJumpUp.style.borderColor = 'rgba(14, 165, 233, 0.6)';
        };
        btnJumpUp.onmouseleave = () => {
            btnJumpUp.style.transform = 'translateY(0)';
            btnJumpUp.style.background = 'rgba(14, 165, 233, 0.12)';
            btnJumpUp.style.borderColor = 'rgba(14, 165, 233, 0.4)';
        };
        btnJumpUp.onclick = scrollUp;

        const btnJumpDown = document.createElement('button');
        btnJumpDown.setAttribute('data-scroll-btn-claude-v2', 'jump-down');
        btnJumpDown.innerHTML = '<div style="font-size: 22px; line-height: 1;">⬇</div>';
        btnJumpDown.title = 'Jump down 1000px (Page Down)';
        btnJumpDown.style.cssText = buttonBaseStyle + `
            width: 50px;
            height: 50px;
            background: rgba(249, 115, 22, 0.12);
            border-color: rgba(249, 115, 22, 0.4);
            border-radius: 14px;
            color: #f97316;
        `;

        btnJumpDown.onmouseenter = () => {
            btnJumpDown.style.transform = 'translateY(-2px)';
            btnJumpDown.style.background = 'rgba(249, 115, 22, 0.18)';
            btnJumpDown.style.borderColor = 'rgba(249, 115, 22, 0.6)';
        };
        btnJumpDown.onmouseleave = () => {
            btnJumpDown.style.transform = 'translateY(0)';
            btnJumpDown.style.background = 'rgba(249, 115, 22, 0.12)';
            btnJumpDown.style.borderColor = 'rgba(249, 115, 22, 0.4)';
        };
        btnJumpDown.onclick = scrollDown;

        row2.appendChild(btnJumpUp);
        row2.appendChild(btnJumpDown);

        // Row 3: Auto-scroll DOWN
        const row3 = document.createElement('div');
        row3.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

        const btnAutoDown = document.createElement('button');
        btnAutoDown.setAttribute('data-scroll-btn-claude-v2', 'auto-down');
        btnAutoDown.innerHTML = `
            <div class="icon" style="font-size: 24px; line-height: 1; transition: color 0.25s;">▼</div>
            <div class="label" style="font-size: 12px; font-weight: 700; margin-top: 4px; letter-spacing: 0.5px; transition: all 0.25s; color: #ec4899;">AUTO</div>
        `;
        btnAutoDown.title = 'Toggle auto-scroll DOWN';
        btnAutoDown.style.cssText = buttonBaseStyle + `
            width: 64px;
            height: 64px;
            background: rgba(236, 72, 153, 0.12);
            border-color: rgba(236, 72, 153, 0.4);
            border-radius: 16px;
        `;
        btnAutoDown.querySelector('.icon').style.color = '#ec4899';

        btnAutoDown.onmouseenter = () => {
            if (activeAutoScrollButton !== 'down') {
                btnAutoDown.style.transform = 'translateY(-2px)';
                btnAutoDown.style.background = 'rgba(236, 72, 153, 0.18)';
                btnAutoDown.style.borderColor = 'rgba(236, 72, 153, 0.6)';
            }
        };
        btnAutoDown.onmouseleave = () => {
            if (activeAutoScrollButton !== 'down') {
                btnAutoDown.style.transform = 'translateY(0)';
                btnAutoDown.style.background = 'rgba(236, 72, 153, 0.12)';
                btnAutoDown.style.borderColor = 'rgba(236, 72, 153, 0.4)';
            }
        };
        btnAutoDown.onclick = () => toggleAutoScrollDown(btnAutoDown);

        row3.appendChild(btnAutoDown);

        // Add all rows to container
        container.appendChild(row1);
        container.appendChild(row2);
        container.appendChild(row3);

        document.body.appendChild(container);
        console.log('🔴 Claude Scroll v2: Buttons added');
    }

    // Initialize scroll listener for progress bar
    function initScrollListener() {
        const container = findMainScrollContainer();

        if (container) {
            container.addEventListener('scroll', updateProgressBar, { passive: true });
        } else {
            window.addEventListener('scroll', updateProgressBar, { passive: true });
        }
    }

    // Check activation status periodically
    function checkActivationStatus() {
        const shouldBeActive = checkActivationElement();

        if (shouldBeActive && !isActivated) {
            initializeScript();
        } else if (!shouldBeActive && isActivated) {
            deactivateScript();
        }
    }

    // Wait for page to load, then start checking
    setTimeout(() => {
        checkActivationStatus();

        // Continue checking every 3 seconds
        activationCheckInterval = setInterval(() => {
            checkActivationStatus();

            // Keep buttons alive if activated
            if (isActivated) {
                if (!document.querySelector('[data-scroll-btn-claude-v2]')) {
                    addButtons();
                }
                if (!document.getElementById('claude-progress-v2')) {
                    createProgressBar();
                    updateProgressBar();
                }
            }
        }, 3000);
    }, 1500);

    // Keyboard shortcuts (only work when activated)
    document.addEventListener('keydown', (e) => {
        if (!isActivated) return;
        if (e.target.matches('input, textarea, [contenteditable="true"]')) return;

        if (e.key === 'PageUp') {
            e.preventDefault();
            scrollUp();
        }

        if (e.key === 'PageDown') {
            e.preventDefault();
            scrollDown();
        }

        if (e.key === 'Escape') {
            stopAutoScroll();
            resetAllButtons();
        }
    });

    console.log('🔴 Claude Scroll v2: Script loaded with activation check!');
})();