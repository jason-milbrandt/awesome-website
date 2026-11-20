// Light/dark switch for the site header (hand-written, not generated).
// The saved choice is applied in <head> by an inline script, before first paint, to avoid a flash.
(() => {
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  const root = document.documentElement;
  const current = () => root.dataset.theme ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const label = () => {
    const dark = current() === 'dark';
    btn.textContent = dark ? '☀ Light mode' : '☾ Dark mode';
    btn.setAttribute('aria-pressed', String(dark));
  };
  btn.addEventListener('click', () => {
    root.dataset.theme = current() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) { /* storage blocked: choice lasts this page only */ }
    label();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', label);
  label();
})();
