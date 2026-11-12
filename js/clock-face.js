/* Shared clock display controls. No timer state or notification permissions live here. */
(() => {
    'use strict';
    window.createClockFace = function createClockFace(options) {
        const { display, content, panel, settingsButton, scaleSlider, scaleValue, resetButton, fullscreenButton, windowElement } = options;
        let offset = { x: 0, y: 0 };
        let drag = null;
        let frame = null;
        let disposed = false;
        let controlsTimer = null;
        let fallbackFullscreen = false;
        let fullscreenPending = false;
        let previousOverflow = '';
        let previousFocus = null;
        const fullscreenControls = windowElement.querySelector('.fullscreen-controls');
        const mirroredControls = fullscreenControls ? [...fullscreenControls.querySelectorAll('[data-clock-target]')] : [];
        const exitFullscreenButton = fullscreenControls?.querySelector('[data-exit-fullscreen]');
        const isFullscreen = () => document.fullscreenElement === windowElement || fallbackFullscreen;
        function syncFullscreenControls() {
            mirroredControls.forEach(button => {
                const original = document.getElementById(button.dataset.clockTarget);
                if (!original) return;
                button.hidden = original.hidden;
                button.disabled = original.disabled;
                button.textContent = original.textContent;
            });
        }
        window.syncClockControls = syncFullscreenControls;
        function showFullscreenControls() {
            if (!fullscreenControls || !isFullscreen()) return;
            fullscreenControls.hidden = false;
            if (controlsTimer !== null) clearTimeout(controlsTimer);
            controlsTimer = setTimeout(() => {
                controlsTimer = null;
                if (!fullscreenControls.contains(document.activeElement)) fullscreenControls.hidden = true;
            }, 2500);
        }
        mirroredControls.forEach(button => button.addEventListener('click', () => {
            document.getElementById(button.dataset.clockTarget)?.click();
            syncFullscreenControls();
            showFullscreenControls();
        }));
        windowElement.addEventListener('pointermove', showFullscreenControls);
        windowElement.addEventListener('pointerdown', showFullscreenControls);
        windowElement.addEventListener('focusin', showFullscreenControls);
        fullscreenControls?.addEventListener('focusout', showFullscreenControls);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && fallbackFullscreen) {
                event.preventDefault();
                setFallbackFullscreen(false);
            } else if (event.key !== 'Escape') showFullscreenControls();
        });
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const setColor = color => {
            display.style.setProperty('--clock-color', color);
            document.querySelectorAll('.theme-btn').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === color)));
        };
        function place() {
            const padding = 12;
            const maxX = Math.max(0, (content.clientWidth - display.offsetWidth) / 2 - padding);
            const maxY = Math.max(0, (content.clientHeight - display.offsetHeight) / 2 - padding);
            offset.x = clamp(offset.x, -maxX, maxX);
            offset.y = clamp(offset.y, -maxY, maxY);
            display.style.transform = `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`;
        }
        function fit() {
            if (disposed) return;
            const percent = clamp(Number(scaleSlider.value) || 80, 25, 100);
            const width = Math.max(1, content.clientWidth - 24);
            const height = Math.max(1, content.clientHeight - 24);
            // Measure the actual loaded font; fallback and DSEG have different metrics.
            display.style.fontSize = '100px';
            const measuredWidth = Math.max(1, display.offsetWidth);
            const measuredHeight = Math.max(1, display.offsetHeight);
            const size = Math.max(1, Math.min(width / measuredWidth, height / measuredHeight) * 100 * percent / 100);
            display.style.fontSize = `${size}px`;
            scaleValue.textContent = `${percent}%`;
            place();
        }
        function scheduleFit() {
            if (disposed) return;
            if (frame !== null) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => { frame = null; fit(); });
        }
        function center() { offset = { x: 0, y: 0 }; place(); }
        function setSettings(open, restoreFocus = false) {
            panel.hidden = !open;
            settingsButton.setAttribute('aria-expanded', String(open));
            if (open) panel.querySelector('input, button')?.focus();
            else if (restoreFocus) settingsButton.focus();
        }
        settingsButton.addEventListener('click', () => setSettings(panel.hidden));
        panel.querySelector('[data-close-settings]')?.addEventListener('click', () => setSettings(false, true));
        document.addEventListener('pointerdown', event => {
            if (!panel.hidden && !panel.contains(event.target) && !settingsButton.contains(event.target)) setSettings(false);
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); setSettings(false, true); }
        });
        scaleSlider.addEventListener('input', fit);
        resetButton.addEventListener('click', () => { scaleSlider.value = '80'; center(); fit(); });
        document.querySelectorAll('.theme-btn').forEach(button => button.addEventListener('click', () => setColor(button.dataset.color)));
        document.querySelectorAll('.bg-btn').forEach(button => button.addEventListener('click', () => {
            content.style.backgroundColor = button.dataset.bg;
            content.dataset.lightBackground = String(button.dataset.bg.toLowerCase() === '#ffffff');
            document.querySelectorAll('.bg-btn').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
        }));
        display.addEventListener('pointerdown', event => {
            if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
            event.preventDefault();
            display.focus({ preventScroll: true });
            drag = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
            display.setPointerCapture(event.pointerId);
            display.classList.add('dragging');
        });
        display.addEventListener('pointermove', event => {
            if (!drag || event.pointerId !== drag.id) return;
            offset = { x: drag.offsetX + event.clientX - drag.x, y: drag.offsetY + event.clientY - drag.y };
            place();
        });
        function endDrag(event) {
            if (!drag || event.pointerId !== drag.id) return;
            drag = null;
            display.classList.remove('dragging');
        }
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => display.addEventListener(type, endDrag));
        display.addEventListener('dblclick', center);
        display.addEventListener('keydown', event => {
            const step = event.shiftKey ? 30 : 5;
            const movement = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
            if (event.key === 'Home') { event.preventDefault(); center(); }
            else if (movement) { event.preventDefault(); offset.x += movement[0]; offset.y += movement[1]; place(); }
        });
        function updateFullscreenUI() {
            if (controlsTimer !== null) clearTimeout(controlsTimer);
            const active = isFullscreen();
            if (fullscreenControls) fullscreenControls.hidden = !active;
            if (active) { setSettings(false); syncFullscreenControls(); showFullscreenControls(); }
            fullscreenButton.textContent = active ? (fallbackFullscreen ? '離開滿版' : '離開全螢幕') : '全螢幕';
            fullscreenButton.setAttribute('aria-pressed', String(active));
            if (exitFullscreenButton) exitFullscreenButton.textContent = fallbackFullscreen ? '離開滿版 · Esc' : '離開全螢幕';
            scheduleFit();
        }
        function setFallbackFullscreen(active) {
            if (active === fallbackFullscreen) return;
            if (active) {
                previousOverflow = document.body.style.overflow || '';
                previousFocus = document.activeElement;
                document.body.style.overflow = 'hidden';
            }
            fallbackFullscreen = active;
            windowElement.classList.toggle('is-fullscreen', active);
            document.body.classList.toggle('clock-presentation', active);
            if (!active) document.body.style.overflow = previousOverflow;
            updateFullscreenUI();
            if (active) display.focus({ preventScroll: true });
            else {
                const target = previousFocus && previousFocus.isConnected !== false ? previousFocus : fullscreenButton;
                target.focus({ preventScroll: true });
            }
        }
        // Browser fullscreen is preferred. Embedded or unsupported browsers can
        // still fill their page viewport without requesting OS fullscreen access.
        fullscreenButton.hidden = false;
        fullscreenButton.title = '全螢幕；瀏覽器不支援時改用頁面滿版顯示';
        async function toggleFullscreen() {
            if (fullscreenPending) return;
            if (fallbackFullscreen) { setFallbackFullscreen(false); return; }
            fullscreenPending = true;
            try {
                if (document.fullscreenElement === windowElement) {
                    await document.exitFullscreen();
                    updateFullscreenUI();
                    fullscreenButton.focus({ preventScroll: true });
                } else if (typeof windowElement.requestFullscreen === 'function' && document.fullscreenEnabled !== false) {
                    try {
                        await windowElement.requestFullscreen();
                        if (document.fullscreenElement !== windowElement) setFallbackFullscreen(true);
                        else updateFullscreenUI();
                    } catch {
                        if (!disposed) setFallbackFullscreen(true);
                    }
                } else setFallbackFullscreen(true);
            } catch {
                const status = document.getElementById('display-status');
                if (status) status.textContent = '請按 Esc 離開全螢幕。';
            } finally { fullscreenPending = false; }
        }
        fullscreenButton.addEventListener('click', toggleFullscreen);
        exitFullscreenButton?.addEventListener('click', toggleFullscreen);
        document.addEventListener('fullscreenchange', updateFullscreenUI);
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleFit) : null;
        observer?.observe(content);
        window.addEventListener('resize', scheduleFit);
        window.addEventListener('pagehide', event => {
            if (event.persisted) return;
            disposed = true;
            observer?.disconnect();
            if (frame !== null) cancelAnimationFrame(frame);
            if (controlsTimer !== null) clearTimeout(controlsTimer);
        });
        document.fonts?.ready.then(scheduleFit);
        syncFullscreenControls();
        setColor('#a7c995');
        fit();
        return { fit, center, setColor, isFullscreen };
    };
})();
