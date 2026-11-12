(() => {
  'use strict';

  const desktop = document.querySelector('.desktop');
  const windows = [...document.querySelectorAll('[data-window]')];
  const byId = new Map(windows.map(win => [win.id, win]));
  const mobile = window.matchMedia('(max-width: 760px)');
  const input = document.getElementById('terminal-input');
  const output = document.getElementById('terminal-output');
  const intro = document.getElementById('terminal-intro');
  const terminalScroll = document.getElementById('terminal-scroll');
  const announcement = document.getElementById('desktop-announcement');
  const openers = new Map();
  const history = [];
  let historyIndex = 0;
  let draft = '';
  let layer = 10;
  let drag = null;

  if (!desktop || !input || !output) return;

  function updateDock() {
    document.querySelectorAll('.dock-item[data-open]').forEach(item => {
      const win = byId.get(item.dataset.open);
      item.dataset.running = String(win.dataset.state !== 'closed');
      if (win.classList.contains('is-focused') && !win.hidden) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
  }

  function bringForward(win) {
    windows.forEach(item => item.classList.toggle('is-focused', item === win));
    win.style.zIndex = String(++layer);
    document.getElementById('active-app').textContent = win.dataset.title;
    updateDock();
  }

  function openWindow(id, { focus = true, opener = null } = {}) {
    const win = byId.get(id);
    if (!win) return;
    document.dispatchEvent(new Event('desktop:window-open'));
    if (opener) openers.set(id, opener);
    win.hidden = false;
    win.dataset.state = 'open';
    bringForward(win);
    if (focus) {
      if (mobile.matches) win.scrollIntoView({ block: 'start', behavior: 'instant' });
      (id === 'terminal' ? input : win).focus({ preventScroll: true });
    }
    announcement.textContent = `已開啟 ${win.dataset.title}`;
  }

  function hideWindow(win, state) {
    win.hidden = true;
    win.dataset.state = state;
    win.classList.remove('is-focused');
    const next = windows.filter(item => !item.hidden).sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
    if (next) bringForward(next);
    else document.getElementById('active-app').textContent = 'Workspace';
    updateDock();
    // A dock icon is always outside the window being hidden.
    const opener = document.querySelector(`.dock-item[data-open="${win.id}"]`) || openers.get(win.id);
    opener?.focus({ preventScroll: true });
    announcement.textContent = `${win.dataset.title} 已${state === 'closed' ? '關閉' : '最小化'}，可由 Dock 重新開啟`;
  }

  function maximize(win) {
    const active = win.classList.toggle('is-maximized');
    win.querySelector('[data-action="maximize"]').setAttribute('aria-pressed', String(active));
    bringForward(win);
  }

  function resetWindows() {
    windows.forEach(win => {
      for (const property of ['left', 'top', 'right', 'z-index']) win.style.removeProperty(property);
      win.classList.remove('is-maximized');
      win.querySelector('[data-action="maximize"]').setAttribute('aria-pressed', 'false');
      win.hidden = win.hasAttribute('data-start-closed');
      win.dataset.state = win.hidden ? 'closed' : 'open';
    });
    intro.hidden = false;
    output.replaceChildren();
    openWindow('terminal');
  }

  function clampPosition(win, left, top) {
    return {
      left: Math.max(8, Math.min(left, desktop.clientWidth - win.offsetWidth - 8)),
      top: Math.max(8, Math.min(top, desktop.clientHeight - win.offsetHeight - 105))
    };
  }

  windows.forEach(win => {
    win.dataset.state = win.hasAttribute('data-start-closed') ? 'closed' : 'open';
    win.hidden = win.dataset.state === 'closed';
    win.querySelector('.traffic-lights').hidden = false;
    win.addEventListener('pointerdown', () => bringForward(win));
    win.addEventListener('focusin', () => bringForward(win));
    win.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', () => {
        if (button.dataset.action === 'maximize') maximize(win);
        else hideWindow(win, button.dataset.action === 'close' ? 'closed' : 'minimized');
      });
    });
    const handle = win.querySelector('[data-drag-handle]');
    handle.addEventListener('dblclick', event => {
      if (!mobile.matches && !event.target.closest('button')) maximize(win);
    });
    handle.addEventListener('pointerdown', event => {
      if (mobile.matches || event.button !== 0 || win.classList.contains('is-maximized') || event.target.closest('button')) return;
      const rect = win.getBoundingClientRect();
      const bounds = desktop.getBoundingClientRect();
      drag = { win, handle, pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left - bounds.left, top: rect.top - bounds.top };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || drag.handle !== handle || drag.pointerId !== event.pointerId) return;
      const point = clampPosition(win, drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
      win.style.left = `${point.left}px`;
      win.style.top = `${point.top}px`;
      win.style.right = 'auto';
    });
    const endDrag = () => { if (drag?.handle === handle) drag = null; };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('lostpointercapture', endDrag);
  });

  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-open]');
    if (!opener || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openWindow(opener.dataset.open, { opener });
    document.querySelector('.window-menu').open = false;
  });
  document.getElementById('reset-windows').addEventListener('click', () => {
    resetWindows();
    document.querySelector('.window-menu').open = false;
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openWindow('terminal');
    }
    if (event.key === 'Escape') {
      const menu = document.querySelector('.window-menu');
      const restoreFocus = menu.open && menu.contains(document.activeElement);
      menu.open = false;
      if (restoreFocus) menu.querySelector('summary').focus();
    }
  });
  window.addEventListener('hashchange', () => {
    openWindow(location.hash.slice(1));
  });
  window.addEventListener('resize', () => {
    drag = null;
    if (mobile.matches) return;
    windows.filter(win => !win.hidden && !win.classList.contains('is-maximized')).forEach(win => {
      const rect = win.getBoundingClientRect();
      const bounds = desktop.getBoundingClientRect();
      if (rect.right <= bounds.right && rect.left >= bounds.left && rect.bottom <= bounds.bottom - 90) return;
      const point = clampPosition(win, rect.left - bounds.left, rect.top - bounds.top);
      win.style.left = `${point.left}px`;
      win.style.top = `${point.top}px`;
      win.style.right = 'auto';
    });
  });

  function printText(container, text) {
    const result = document.createElement('pre');
    result.className = 'command-result';
    result.textContent = text;
    container.append(result);
  }

  function printLinks(container, links) {
    const list = document.createElement('div');
    list.className = 'command-result';
    links.forEach(([label, href]) => {
      const line = document.createElement('div');
      const a = document.createElement('a');
      a.textContent = label;
      a.href = href;
      if (href.startsWith('#') && byId.has(href.slice(1))) a.dataset.open = href.slice(1);
      if (href.startsWith('https://')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      line.append(a);
      list.append(line);
    });
    container.append(list);
  }

  function runCommand(raw) {
    const command = raw.trim();
    if (!command) return;
    history.push(command);
    if (history.length > 100) history.shift();
    historyIndex = history.length;
    draft = '';
    input.value = '';
    const normalized = command.toLowerCase().replace(/\s+/g, ' ');
    if (normalized === 'clear' || normalized === 'reset') {
      output.replaceChildren();
      intro.hidden = normalized === 'clear';
      if (normalized === 'reset') resetWindows();
      return;
    }
    const group = document.createElement('div');
    const echo = document.createElement('p');
    echo.className = 'command-line';
    const prefix = document.createElement('span');
    prefix.className = 'prompt-user';
    prefix.textContent = 'hamster ~ ❯ ';
    echo.append(prefix, document.createTextNode(command));
    group.append(echo);
    output.append(group);
    while (output.children.length > 30) output.firstElementChild.remove();

    switch (normalized) {
      case 'help':
        printText(group, '站內指令\n\n  whoami     個人介紹\n  about      開啟 about.md\n  research   開啟研究方向\n  skills     常用技術\n  tools      開啟工具資料夾\n  contact    聯絡方式\n  ls         列出檔案\n  date       目前時間\n  pwd        目前路徑\n  clear      清空終端機\n  reset      重設桌面\n\n也支援 cat about.md / research.md / contact.txt。\n↑ ↓ 瀏覽歷史指令；Ctrl+L 清空。');
        break;
      case 'ls':
        printLinks(group, [['about.md', '#about'], ['research/', '#research'], ['tools/', '#files'], ['contact.txt ↗', 'contact.html']]);
        break;
      case 'whoami':
        printText(group, '楊上賢 / Hamster Yang\n陽明交大生醫光電研究所博士班（2026.09 入學）\n艾登星執行長暨技術長（2026 起）\n腦血管分割 · 腦動脈瘤分割 · 肺部動靜脈分割\nPython / PyTorch / C++ / OpenCV');
        break;
      case 'about': case 'cat about.md': case 'open about.md':
        printText(group, 'Opening ~/hamsteryang/about.md');
        openWindow('about');
        break;
      case 'research': case 'cat research.md': case 'open research': case 'cd research': case 'cd research/':
        printText(group, 'Opening ~/hamsteryang/research.md');
        openWindow('research');
        break;
      case 'skills': case 'cat skills.txt':
        printText(group, 'Research      腦血管 / 腦動脈瘤 / 肺部動靜脈分割\nDevelopment   Python / PyTorch / C++ / OpenCV\nSystems       Linux / Shell / Git / Docker\nOthers        CTF / 競技程式設計 / 軟硬體整合');
        break;
      case 'tools': case 'projects': case 'open tools': case 'cd tools': case 'cd tools/':
        printText(group, 'Opening ~/hamsteryang/tools/');
        printLinks(group, [['所有工具 → projects.html', 'projects.html']]);
        openWindow('files');
        break;
      case 'contact': case 'cat contact.txt':
        printLinks(group, [['Telegram / @Hamster_yang ↗', 'https://t.me/Hamster_yang'], ['GitHub / Hamster-yang ↗', 'https://github.com/Hamster-yang'], ['Instagram / ysh.6201 ↗', 'https://www.instagram.com/ysh.6201/']]);
        break;
      case 'date':
        printText(group, new Date().toLocaleString('zh-TW', { dateStyle: 'full', timeStyle: 'long' }));
        break;
      case 'pwd':
        printText(group, '/home/hamsteryang');
        break;
      default:
        printText(group, `找不到站內指令：${command}\n輸入 help 查看可用指令。`);
    }
    terminalScroll.scrollTop = terminalScroll.scrollHeight;
  }

  document.getElementById('terminal-form').addEventListener('submit', event => {
    event.preventDefault();
    runCommand(input.value);
  });
  document.querySelectorAll('[data-command]').forEach(button => {
    button.addEventListener('click', () => { runCommand(button.dataset.command); if (byId.get('terminal').classList.contains('is-focused')) input.focus({ preventScroll: true }); });
  });
  input.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      output.replaceChildren();
      intro.hidden = true;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex === history.length) draft = input.value;
      historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
      input.value = historyIndex === history.length ? draft : history[historyIndex];
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  function updateClock() {
    const now = new Date();
    const clock = document.getElementById('desktop-clock');
    clock.dateTime = now.toISOString();
    clock.textContent = now.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  function syncMobileControls() {
    windows.forEach(win => { win.querySelector('[data-action="maximize"]').disabled = mobile.matches; });
  }
  mobile.addEventListener('change', syncMobileControls);
  syncMobileControls();
  document.documentElement.classList.add('desktop-ready');
  document.getElementById('reset-windows').hidden = false;
  document.getElementById('terminal-form').hidden = false;
  document.getElementById('terminal-hints').hidden = false;
  document.querySelector('.command-shortcut').hidden = false;
  updateClock();
  setInterval(updateClock, 30000);
  bringForward(byId.get('terminal'));
  const initial = byId.get(location.hash.slice(1));
  if (initial) openWindow(initial.id, { focus: false });
})();
