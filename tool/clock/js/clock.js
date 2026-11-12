'use strict';
const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const hoursInput = document.getElementById('hours-input');
const minutesInput = document.getElementById('minutes-input');
const secondsInput = document.getElementById('seconds-input');
const presetButtons = document.querySelectorAll('.preset-btn');
const soundCheckbox = document.getElementById('sound-checkbox');
const timerStatus = document.getElementById('timer-status');
const soundStatus = document.getElementById('sound-status');
const soundTestButton = document.getElementById('sound-test-btn');
const inputs = [hoursInput, minutesInput, secondsInput];
let totalSeconds = 300;
let remainingSeconds = totalSeconds;
let timerInterval = null;
let isRunning = false;
let deadline = null;
let pausedRemainingMs = null;
let soundEnabled = true;
let audioContext = null;
let soundPrepared = false;
function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    return [Math.floor(safe / 3600), Math.floor((safe % 3600) / 60), safe % 60].map(value => String(value).padStart(2, '0')).join(':');
}
function updateDisplay() {
    timerDisplay.textContent = formatTime(remainingSeconds);
    timerDisplay.setAttribute?.('aria-label', `剩餘 ${Math.floor(remainingSeconds / 3600)} 小時 ${Math.floor(remainingSeconds % 3600 / 60)} 分 ${remainingSeconds % 60} 秒`);
    timerDisplay.classList.toggle('warning', remainingSeconds > 10 && remainingSeconds <= 60);
    timerDisplay.classList.toggle('danger', remainingSeconds > 0 && remainingSeconds <= 10);
    startBtn.disabled = remainingSeconds <= 0;
}
function setStatus(message) { if (timerStatus) timerStatus.textContent = message; }
function updateControls() {
    startBtn.hidden = isRunning;
    pauseBtn.hidden = !isRunning;
    inputs.forEach(input => { input.disabled = isRunning; });
    presetButtons.forEach(button => { button.disabled = isRunning; });
    startBtn.textContent = pausedRemainingMs !== null ? '繼續' : '開始';
    window.syncClockControls?.();
}
// The wall-clock deadline catches up after a background tab throttles callbacks.
function syncTimer() {
    if (!isRunning) return;
    remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    updateDisplay();
    if (remainingSeconds === 0) {
        stopTimer();
        setStatus('時間到了。按「重設」可再計時一次。');
        playSound();
    }
}
function prepareSound() {
    if (!soundEnabled) return Promise.resolve(false);
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
        if (soundStatus) soundStatus.textContent = '此瀏覽器不支援提示音；計時結束仍會顯示訊息。';
        return Promise.resolve(false);
    }
    try {
        if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextClass();
        const ready = audioContext.state === 'suspended' ? audioContext.resume() : Promise.resolve();
        return Promise.resolve(ready).then(() => {
            soundPrepared = audioContext.state === 'running';
            return soundPrepared;
        }).catch(() => { soundPrepared = false; if (soundStatus) soundStatus.textContent = '提示音未能啟用，請再按「測試提示音」。'; return false; });
    } catch {
        soundPrepared = false;
        if (soundStatus) soundStatus.textContent = '提示音未能啟用，計時仍可使用。';
        return Promise.resolve(false);
    }
}
function playSound() {
    if (!soundEnabled || !soundPrepared || !audioContext || audioContext.state !== 'running') return;
    try {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        const now = audioContext.currentTime;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(now);
        oscillator.stop(now + 0.7);
    } catch { if (soundStatus) soundStatus.textContent = '無法播放提示音，請確認瀏覽器音訊設定。'; }
}
function startTimer() {
    if (isRunning || remainingSeconds <= 0) return;
    // Unlock Web Audio from the user's start gesture, not when the timer expires.
    prepareSound();
    deadline = Date.now() + (pausedRemainingMs ?? remainingSeconds * 1000);
    pausedRemainingMs = null;
    isRunning = true;
    updateControls();
    setStatus('計時中');
    timerInterval = setInterval(syncTimer, 250);
    syncTimer();
}
function pauseTimer() {
    if (!isRunning) return;
    syncTimer();
    if (!isRunning) return;
    pausedRemainingMs = Math.max(0, deadline - Date.now());
    isRunning = false;
    deadline = null;
    clearInterval(timerInterval);
    timerInterval = null;
    updateControls();
    setStatus('已暫停');
}
function stopTimer() {
    isRunning = false;
    deadline = null;
    pausedRemainingMs = null;
    clearInterval(timerInterval);
    timerInterval = null;
    updateControls();
}
function writeInputs() {
    hoursInput.value = Math.floor(totalSeconds / 3600);
    minutesInput.value = Math.floor((totalSeconds % 3600) / 60);
    secondsInput.value = totalSeconds % 60;
}
function resetTimer() {
    stopTimer();
    remainingSeconds = totalSeconds;
    writeInputs();
    updateDisplay();
    setStatus(totalSeconds ? '已重設' : '請先設定大於 0 秒的時間');
}
function applyDuration(seconds) {
    if (isRunning) return;
    totalSeconds = Math.min(86399, Math.max(0, Math.floor(Number(seconds) || 0)));
    remainingSeconds = totalSeconds;
    pausedRemainingMs = null;
    updateDisplay();
    updateControls();
    setStatus(totalSeconds ? '準備就緒' : '請先設定大於 0 秒的時間');
}
function readInputs() {
    if (isRunning) { writeInputs(); return; }
    const values = inputs.map((input, index) => {
        const parsed = Number(input.value);
        const value = Math.min(index === 0 ? 23 : 59, Math.max(0, Number.isFinite(parsed) ? Math.floor(parsed) : 0));
        if (input.value !== '') input.value = value;
        return value;
    });
    applyDuration(values[0] * 3600 + values[1] * 60 + values[2]);
}
inputs.forEach(input => {
    input.addEventListener('input', readInputs);
    input.addEventListener('change', () => { readInputs(); writeInputs(); });
});
presetButtons.forEach(button => button.addEventListener('click', () => {
    if (isRunning) return;
    applyDuration(button.dataset.seconds);
    writeInputs();
}));
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);
soundCheckbox.addEventListener('change', () => {
    soundEnabled = soundCheckbox.checked;
    soundTestButton.disabled = !soundEnabled;
    if (soundEnabled) prepareSound();
});
soundTestButton.addEventListener('click', async () => {
    if (await prepareSound()) { playSound(); if (soundStatus) soundStatus.textContent = '已播放測試提示音。'; }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncTimer(); });
window.addEventListener?.('pageshow', syncTimer);
window.addEventListener?.('pagehide', event => {
    if (event.persisted) return;
    stopTimer();
    if (audioContext && audioContext.state !== 'closed') Promise.resolve(audioContext.close()).catch(() => {});
});
writeInputs();
updateDisplay();
updateControls();
window.createClockFace?.({
    display: timerDisplay,
    content: document.querySelector('.clock-content'),
    windowElement: document.querySelector('.clock-window'),
    panel: document.getElementById('settings-panel'),
    settingsButton: document.getElementById('settings-btn'),
    scaleSlider: document.getElementById('font-scale-slider'),
    scaleValue: document.getElementById('font-scale-value'),
    resetButton: document.getElementById('position-reset-btn'),
    fullscreenButton: document.getElementById('fullscreen-btn')
});
