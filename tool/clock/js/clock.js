const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const hoursInput = document.getElementById('hours-input');
const minutesInput = document.getElementById('minutes-input');
const secondsInput = document.getElementById('seconds-input');
const presetButtons = document.querySelectorAll('.preset-btn');
const themeButtons = document.querySelectorAll('.theme-btn');
const bgButtons = document.querySelectorAll('.bg-btn');
const soundCheckbox = document.getElementById('sound-checkbox');
const fontScaleSlider = document.getElementById('font-scale-slider');
const fontScaleValue = document.getElementById('font-scale-value');
const clockContent = document.querySelector('.clock-content');

let totalSeconds = 300; // Default 5 minutes
let remainingSeconds = totalSeconds;
let timerInterval = null;
let isRunning = false;
let currentColor = '#0a84ff';
let soundEnabled = true;
let baseFontSize = 140;

// Dragging variables
let isDragging = false;
let startX, startY, initialX = 0, initialY = 0;

// Format time display
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateDisplay() {
    timerDisplay.textContent = formatTime(remainingSeconds);

    // Change color based on remaining time
    timerDisplay.classList.remove('warning', 'danger');
    if (remainingSeconds <= 10 && remainingSeconds > 0) {
        timerDisplay.classList.add('danger');
    } else if (remainingSeconds <= 60 && remainingSeconds > 10) {
        timerDisplay.classList.add('warning');
    }
}

// Start timer
function startTimer() {
    if (remainingSeconds <= 0) return;

    isRunning = true;
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'flex';

    timerInterval = setInterval(() => {
        remainingSeconds--;
        updateDisplay();

        if (remainingSeconds <= 0) {
            stopTimer();
            playSound();
            showNotification();
        }
    }, 1000);
}

// Pause timer
function pauseTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    startBtn.style.display = 'flex';
    pauseBtn.style.display = 'none';
}

// Stop timer
function stopTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    startBtn.style.display = 'flex';
    pauseBtn.style.display = 'none';
}

// Reset timer
function resetTimer() {
    stopTimer();
    remainingSeconds = totalSeconds;
    updateDisplay();
}

// Play sound
function playSound() {
    if (!soundEnabled) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// Show notification
function showNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('倒數計時結束！', {
            body: '時間到了',
            icon: '../../assets/favicon.ico'
        });
    }
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Event listeners
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

// Settings toggle
let settingsOpen = false;
settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsOpen = !settingsOpen;
    settingsPanel.classList.toggle('show', settingsOpen);
    settingsBtn.classList.toggle('active', settingsOpen);
});

document.addEventListener('click', (e) => {
    if (settingsOpen && !settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
        settingsOpen = false;
        settingsPanel.classList.remove('show');
        settingsBtn.classList.remove('active');
    }
});

// Input validation and instant update
[hoursInput, minutesInput, secondsInput].forEach(input => {
    input.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) || 0;
        const max = parseInt(e.target.max);
        if (value > max) e.target.value = max;
        if (value < 0) e.target.value = 0;

        // Instantly update timer when not running
        if (!isRunning) {
            const h = parseInt(hoursInput.value) || 0;
            const m = parseInt(minutesInput.value) || 0;
            const s = parseInt(secondsInput.value) || 0;

            totalSeconds = h * 3600 + m * 60 + s;
            if (totalSeconds <= 0) {
                totalSeconds = 60;
            }
            remainingSeconds = totalSeconds;
            updateDisplay();
        }
    });
});

// Preset buttons - now also instantly updates
presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (isRunning) return; // Don't change time while running

        const seconds = parseInt(btn.dataset.seconds);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        hoursInput.value = h;
        minutesInput.value = m;
        secondsInput.value = s;

        // Trigger instant update
        totalSeconds = seconds;
        remainingSeconds = totalSeconds;
        updateDisplay();
    });
});

// Theme buttons (text color)
themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        themeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentColor = btn.dataset.color;
        timerDisplay.style.color = currentColor;
        timerDisplay.style.textShadow = `0 0 20px ${currentColor}80`;
    });
});

// Background color buttons
bgButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        bgButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const bgColor = btn.dataset.bg;
        clockContent.style.backgroundColor = bgColor;
    });
});

// Font scale slider (0.1x to 20x)
fontScaleSlider.addEventListener('input', (e) => {
    const scale = parseFloat(e.target.value);
    timerDisplay.style.fontSize = (baseFontSize * scale) + 'px';
    fontScaleValue.textContent = scale.toFixed(1) + 'x';
});

// Sound checkbox
soundCheckbox.addEventListener('change', (e) => {
    soundEnabled = e.target.checked;
});

// Dragging functionality - optimized
timerDisplay.addEventListener('mousedown', handleDragStart);
timerDisplay.addEventListener('touchstart', handleDragStart, { passive: false });

document.addEventListener('mousemove', handleDragMove);
document.addEventListener('touchmove', handleDragMove, { passive: false });

document.addEventListener('mouseup', handleDragEnd);
document.addEventListener('touchend', handleDragEnd);

function handleDragStart(e) {
    isDragging = true;
    startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    timerDisplay.style.cursor = 'grabbing';
}

function handleDragMove(e) {
    if (!isDragging) return;
    e.preventDefault(); // Prevent scrolling on touch

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;
    const newX = initialX + dx;
    const newY = initialY + dy;
    timerDisplay.style.transform = `translate(${newX}px, ${newY}px)`;
    timerDisplay.style.left = '50%';
    timerDisplay.style.top = '50%';
}

function handleDragEnd() {
    if (isDragging) {
        const transform = timerDisplay.style.transform;
        const match = transform.match(/translate\((-?\d+)px, (-?\d+)px\)/);
        if (match) {
            initialX = parseInt(match[1]);
            initialY = parseInt(match[2]);
        }
        isDragging = false;
        timerDisplay.style.cursor = 'move';
    }
}

// Initialize
updateDisplay();

// Update inputs from default time
const h = Math.floor(totalSeconds / 3600);
const m = Math.floor((totalSeconds % 3600) / 60);
const s = totalSeconds % 60;
hoursInput.value = h;
minutesInput.value = m;
secondsInput.value = s;
