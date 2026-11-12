(() => {
  'use strict';
  const clock = document.getElementById('clock');
  if (!clock) return;
  function update() {
    const now = new Date();
    clock.textContent = now.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    if (clock.tagName === 'TIME') clock.dateTime = now.toISOString();
  }
  update();
  setInterval(update, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
})();
