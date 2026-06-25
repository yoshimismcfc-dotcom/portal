// =====================================================
// 吉見SMC FC ポータル 共通スクリプト
// =====================================================

// タブ切り替え（ページ内の .tab-btn に適用）
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    const container = btn.closest("[role='tablist']").parentElement;

    container.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", String(b === btn));
    });
    container.querySelectorAll(".tab-content").forEach(p => {
      p.classList.toggle("active", p.id === "tab-" + target);
    });
  });
});
