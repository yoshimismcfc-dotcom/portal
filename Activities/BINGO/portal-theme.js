// ポータルと同じテーマ設定を使用。ゲームの保存・抽選には触れない。
(function () {
  const key = 'smc-portal-theme';
  const toggle = document.querySelector('.theme-toggle');
  function apply(theme) {
    document.body.dataset.theme = theme;
    toggle.setAttribute('aria-label', theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え');
    toggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀' : '☾';
  }
  let theme = 'dark';
  try { if (localStorage.getItem(key) === 'light') theme = 'light'; } catch {}
  apply(theme);
  toggle.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(key, next); } catch {}
  });
})();
