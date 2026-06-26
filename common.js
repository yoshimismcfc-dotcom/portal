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

// ===== localStorage 利用可能チェック =====
function storageAvailable(){
  try{
    var k='__smctest__';
    localStorage.setItem(k,'1');
    localStorage.removeItem(k);
    return true;
  }catch(e){return false;}
}

// ページ読み込み時にlocalStorageが使えるか確認
window.addEventListener('DOMContentLoaded', function(){
  if(!storageAvailable()){
    var b=document.createElement('div');
    b.style.cssText='position:fixed;top:0;left:0;right:0;background:#bc002d;color:#fff;text-align:center;padding:8px;font-size:.85rem;font-weight:700;z-index:9999';
    b.textContent='⚠️ このブラウザではデータの保存ができません。Safariの「プライベートブラウズ」モードをオフにするか、Chromeをお試しください。';
    document.body.prepend(b);
  }
});
