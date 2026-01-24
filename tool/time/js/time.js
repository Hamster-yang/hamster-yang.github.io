const clockDisplay = document.getElementById('clock-display');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const fontScaleSlider = document.getElementById('font-scale-slider');
const fontScaleValue = document.getElementById('font-scale-value');
const themeButtons = document.querySelectorAll('.theme-btn');
const bgButtons = document.querySelectorAll('.bg-btn');
const resetBtn = document.getElementById('reset-btn');
const timeContent = document.querySelector('.time-content');

let currentColor = '#0a84ff';
let baseFontSize = 120;

// Update clock
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    clockDisplay.textContent = `${hours}:${minutes}:${seconds}`;
}

updateClock();
setInterval(updateClock, 1000);

// Settings toggle
let settingsOpen = false;
settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsOpen = !settingsOpen;
    settingsPanel.classList.toggle('show', settingsOpen);
    settingsBtn.classList.toggle('active', settingsOpen);
});

// Close settings when clicking outside
document.addEventListener('click', (e) => {
    if (settingsOpen && !settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
        settingsOpen = false;
        settingsPanel.classList.remove('show');
        settingsBtn.classList.remove('active');
    }
});

// Font scale slider (0.1x to 20x)
fontScaleSlider.addEventListener('input', (e) => {
    const scale = parseFloat(e.target.value);
    clockDisplay.style.fontSize = (baseFontSize * scale) + 'px';
    fontScaleValue.textContent = scale.toFixed(1) + 'x';
});

// Text color theme buttons
themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        themeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentColor = btn.dataset.color;
        clockDisplay.style.color = currentColor;
        clockDisplay.style.textShadow = `0 0 20px ${currentColor}80`;
    });
});

// Background color buttons
bgButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        bgButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const bgColor = btn.dataset.bg;
        timeContent.style.backgroundColor = bgColor;
    });
});

// Dragging
let isDragging = false;
let startX, startY, initialX = 0, initialY = 0;

function handleDragStart(e) {
    isDragging = true;
    startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    // Read current position from computed style (handles both CSS % and inline px)
    const style = window.getComputedStyle(clockDisplay);
    const matrix = new DOMMatrix(style.transform);
    initialX = matrix.m41;
    initialY = matrix.m42;

    clockDisplay.style.cursor = 'grabbing';
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
    clockDisplay.style.transform = `translate(${newX}px, ${newY}px)`;
    clockDisplay.style.left = '50%';
    clockDisplay.style.top = '50%';
}

function handleDragEnd() {
    isDragging = false;
    clockDisplay.style.cursor = 'move';
}

clockDisplay.addEventListener('mousedown', handleDragStart);
clockDisplay.addEventListener('touchstart', handleDragStart, { passive: false });

document.addEventListener('mousemove', handleDragMove);
document.addEventListener('touchmove', handleDragMove, { passive: false });

document.addEventListener('mouseup', handleDragEnd);
document.addEventListener('touchend', handleDragEnd);

// Reset position and scale
resetBtn.addEventListener('click', () => {
    // Clear inline transform to revert to CSS default (centered)
    clockDisplay.style.transform = '';
    clockDisplay.style.left = '50%';
    clockDisplay.style.top = '50%';
    fontScaleSlider.value = 1;
    clockDisplay.style.fontSize = baseFontSize + 'px';
    fontScaleValue.textContent = '1.0x';
});
