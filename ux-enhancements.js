// =====================================================
// Yoshimi SMC FC Portal - 共通UI/UX補助
// 秘密情報を含めず、既存機能やFirebaseデータ形式を変更しない。
// =====================================================
(function () {
  "use strict";

  function setupGlobalUsability() {
    var main = document.querySelector("main");
    if (main) {
      if (!main.id) main.id = "main-content";
      main.setAttribute("tabindex", "-1");
      if (!document.querySelector(".skip-link")) {
        var skip = document.createElement("a");
        skip.className = "skip-link";
        skip.href = "#" + main.id;
        skip.textContent = "本文へ移動";
        document.body.prepend(skip);
      }
    }

    var currentPage = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("a[href]").forEach(function (link) {
      var rawHref = link.getAttribute("href") || "";
      if (!rawHref || rawHref.indexOf("#") === 0 || rawHref.indexOf("javascript:") === 0) return;
      try {
        var target = new URL(rawHref, location.href);
        var targetPage = target.pathname.split("/").pop() || "index.html";
        if (target.origin === location.origin && targetPage === currentPage) {
          link.setAttribute("aria-current", "page");
        }
        if (target.origin !== location.origin) {
          var label = link.getAttribute("aria-label") || link.textContent.trim();
          if (label && label.indexOf("新しいタブ") === -1) {
            link.setAttribute("aria-label", label + "（新しいタブで開きます）");
          }
        }
      } catch (error) {}
    });

    document.querySelectorAll("button").forEach(function (button) {
      if (!button.hasAttribute("type") && !button.closest("form")) button.type = "button";
      if (!button.getAttribute("aria-label") && !button.textContent.trim() && button.title) {
        button.setAttribute("aria-label", button.title);
      }
    });

    document.querySelectorAll(".modal,.edit-modal,[class*='modal-overlay']").forEach(function (modal) {
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
    });
  }

  function setupAccessibleTabs() {
    document.querySelectorAll(".tab-btn").forEach(function (button) {
      button.setAttribute("role", "tab");
      button.setAttribute("tabindex", button.classList.contains("active") ? "0" : "-1");
      button.addEventListener("click", function () {
        var group = button.parentElement;
        if (!group) return;
        group.querySelectorAll(".tab-btn").forEach(function (item) {
          var active = item === button;
          item.setAttribute("aria-selected", String(active));
          item.setAttribute("tabindex", active ? "0" : "-1");
        });
      });
      button.addEventListener("keydown", function (event) {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) === -1) return;
        var tabs = Array.from(button.parentElement.querySelectorAll(".tab-btn"));
        if (tabs.length < 2) return;
        event.preventDefault();
        var index = tabs.indexOf(button);
        if (event.key === "Home") index = 0;
        else if (event.key === "End") index = tabs.length - 1;
        else index = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        tabs[index].focus();
        tabs[index].click();
      });
    });
  }

  function setupConnectionStatus() {
    var timer = 0;
    var banner = null;
    function show(message, state, autoHide) {
      if (!banner) {
        banner = document.createElement("div");
        banner.className = "connection-banner";
        banner.setAttribute("role", "status");
        banner.setAttribute("aria-live", "polite");
        document.body.appendChild(banner);
      }
      window.clearTimeout(timer);
      banner.textContent = message;
      banner.dataset.state = state;
      banner.hidden = false;
      if (autoHide) timer = window.setTimeout(function () { banner.hidden = true; }, 2600);
    }
    function update() {
      if (navigator.onLine) {
        if (banner && !banner.hidden) show("通信が戻りました。最新データを確認します", "online", true);
      } else {
        show("オフラインです。入力内容は端末に保持し、通信復旧後に同期します", "offline", false);
      }
    }
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if (!navigator.onLine) update();
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupGlobalUsability();
    setupAccessibleTabs();
    setupConnectionStatus();
  });
})();
