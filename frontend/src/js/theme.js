const STORAGE_KEY = 'theme';

function getPreferred() {
  return (
    localStorage.getItem(STORAGE_KEY) ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
}

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.btn-theme-toggle').forEach(updateButtonIcon);
}

function updateButtonIcon(btn) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  btn.innerHTML = isDark ? sunIcon() : moonIcon();
}

export function initTheme() {
  apply(getPreferred());
  document.querySelectorAll('.btn-theme-toggle').forEach((btn) => {
    btn.addEventListener('click', toggleTheme);
  });
}

export function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  apply(next);
  localStorage.setItem(STORAGE_KEY, next);
  window.dispatchEvent(new CustomEvent('themechange'));
}

function moonIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>`;
}

function sunIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>`;
}
