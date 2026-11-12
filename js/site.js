(() => {
  'use strict';
  const button = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-nav');
  if (!button || !nav) return;
  const mobile = window.matchMedia('(max-width: 800px)');
  document.documentElement.classList.add('js');
  const closeMenu = () => {
    button.setAttribute('aria-expanded', 'false');
    nav.hidden = mobile.matches;
  };
  button.hidden = false;
  closeMenu();
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    nav.hidden = !open;
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a') && mobile.matches) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobile.matches && !nav.hidden) {
      closeMenu();
      button.focus();
    }
  });
  mobile.addEventListener('change', closeMenu);
})();
