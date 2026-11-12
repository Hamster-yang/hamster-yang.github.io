'use strict';
const clockDisplay = document.getElementById('clock-display');
function updateClock() {
    const now = new Date();
    clockDisplay.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()].map(value => String(value).padStart(2, '0')).join(':');
    clockDisplay.setAttribute('aria-label', `現在時間 ${now.getHours()} 時 ${now.getMinutes()} 分 ${now.getSeconds()} 秒`);
    const zone = document.getElementById('timezone-label');
    if (zone) zone.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || '本機時間';
}
updateClock();
const clockInterval = setInterval(updateClock, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateClock(); });
window.addEventListener('pageshow', updateClock);
window.addEventListener('pagehide', event => { if (!event.persisted) clearInterval(clockInterval); });
window.createClockFace({
    display: clockDisplay,
    content: document.querySelector('.time-content'),
    windowElement: document.querySelector('.time-window'),
    panel: document.getElementById('settings-panel'),
    settingsButton: document.getElementById('settings-btn'),
    scaleSlider: document.getElementById('font-scale-slider'),
    scaleValue: document.getElementById('font-scale-value'),
    resetButton: document.getElementById('reset-btn'),
    fullscreenButton: document.getElementById('fullscreen-btn')
});
