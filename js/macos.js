document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    setupWindows();
    setupDock();
});

function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateString = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    document.getElementById('clock').textContent = `${dateString} ${timeString}`;
}

let zIndexCounter = 100;

function setupWindows() {
    const windows = document.querySelectorAll('.window');
    
    windows.forEach(win => {
        const header = win.querySelector('.window-header');
        const closeBtn = win.querySelector('.close-btn');
        const minimizeBtn = win.querySelector('.minimize-btn');
        const maximizeBtn = win.querySelector('.maximize-btn');
        
        // Bring to front on click
        win.addEventListener('mousedown', () => {
            win.style.zIndex = ++zIndexCounter;
        });

        // Draggable
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = win.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            
            win.style.zIndex = ++zIndexCounter;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            win.style.left = `${initialLeft + dx}px`;
            win.style.top = `${initialTop + dy}px`;
            win.style.transform = 'none'; // Remove centering transform if any
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Controls
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeWindow(win.id);
        });

        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            minimizeWindow(win.id);
        });

        maximizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMaximize(win);
        });
    });
}

function setupDock() {
    const dockItems = document.querySelectorAll('.dock-item');
    
    dockItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            openWindow(targetId);
        });
    });
}

function openWindow(id) {
    const win = document.getElementById(id);
    const dockItem = document.querySelector(`.dock-item[data-target="${id}"]`);
    
    if (win) {
        if (win.classList.contains('minimized')) {
            win.classList.remove('minimized');
        }
        
        win.classList.add('open');
        win.style.zIndex = ++zIndexCounter;
        
        // Center if not already positioned (simple check)
        if (!win.style.left) {
            const rect = win.getBoundingClientRect();
            const desktop = document.querySelector('.desktop');
            const desktopRect = desktop.getBoundingClientRect();
            
            win.style.left = `${(desktopRect.width - rect.width) / 2}px`;
            win.style.top = `${(desktopRect.height - rect.height) / 2}px`;
        }

        if (dockItem) dockItem.classList.add('active');
    }
}

function closeWindow(id) {
    const win = document.getElementById(id);
    const dockItem = document.querySelector(`.dock-item[data-target="${id}"]`);
    
    if (win) {
        win.classList.remove('open');
        setTimeout(() => {
            // Reset position or state if needed
        }, 200);
        
        if (dockItem) dockItem.classList.remove('active');
    }
}

function minimizeWindow(id) {
    const win = document.getElementById(id);
    if (win) {
        win.classList.add('minimized');
    }
}

function toggleMaximize(win) {
    if (win.classList.contains('maximized')) {
        win.classList.remove('maximized');
        win.style.width = '';
        win.style.height = '';
        win.style.top = win.dataset.prevTop;
        win.style.left = win.dataset.prevLeft;
    } else {
        win.dataset.prevTop = win.style.top;
        win.dataset.prevLeft = win.style.left;
        
        win.classList.add('maximized');
        win.style.width = '100%';
        win.style.height = 'calc(100% - 30px - 80px)'; // Minus top bar and dock space
        win.style.top = '30px';
        win.style.left = '0';
    }
}
