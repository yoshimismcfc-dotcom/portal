// =====================================================
// Yoshimi SMC FC Portal shared interactions
// =====================================================
(function () {
  const LOGO_SRC = "assets/yoshimi-smc-logo.jpeg";
  const TEAM_NAME = "吉見SMCサッカースポーツ少年団";
  const PORTAL_NAME = "SMART PORTAL";
  const THEME_KEY = "smc-portal-theme";

  function storageAvailable() {
    try {
      const key = "__smctest__";
      localStorage.setItem(key, "1");
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  const canStore = storageAvailable();

  function getSavedTheme() {
    if (!canStore) return "dark";
    return localStorage.getItem(THEME_KEY) || "dark";
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    const button = document.querySelector(".theme-toggle");
    if (!button) return;
    const isDark = theme === "dark";
    button.setAttribute("aria-label", isDark ? "ライトモードに切り替え" : "ダークモードに切り替え");
    button.querySelector(".theme-icon").textContent = isDark ? "☀" : "☾";
  }

  function buildLoader() {
    if (document.querySelector(".portal-loader")) return;
    document.body.classList.add("is-loading");
    const loader = document.createElement("div");
    loader.className = "portal-loader";
    loader.setAttribute("aria-live", "polite");
    loader.innerHTML = `
      <div class="loader-card">
        <img class="loader-logo" src="${LOGO_SRC}" alt="">
        <div class="loader-ring" aria-hidden="true"></div>
        <div class="loader-text">YOSHIMI SMC FC</div>
      </div>
    `;
    document.body.prepend(loader);
    window.addEventListener("load", () => {
      window.setTimeout(() => {
        loader.classList.add("is-hidden");
        document.body.classList.remove("is-loading");
      }, 180);
    });
    window.setTimeout(() => {
      loader.classList.add("is-hidden");
      document.body.classList.remove("is-loading");
    }, 1200);
  }

  function refreshHeader() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    header.innerHTML = `
      <div class="header-inner">
        <a class="header-logo" href="index.html" aria-label="${TEAM_NAME} ホーム">
          <span class="logo-mark"><img src="${LOGO_SRC}" alt="${TEAM_NAME} ロゴ"></span>
          <span>
            <span class="logo-name">${TEAM_NAME}</span>
            <span class="logo-sub">YOSHIMI SMC FC · ${PORTAL_NAME}</span>
          </span>
        </a>
        <span class="header-spacer"></span>
        <button class="header-action theme-toggle" type="button">
          <span class="theme-icon" aria-hidden="true">☀</span>
        </button>
      </div>
    `;
    const toggle = header.querySelector(".theme-toggle");
    toggle.addEventListener("click", () => {
      const next = document.body.dataset.theme === "dark" ? "light" : "dark";
      if (canStore) localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  }

  function refreshFooter() {
    document.querySelectorAll(".site-footer").forEach((footer) => {
      footer.innerHTML = `
        <div class="footer-brand">
          <img class="footer-logo" src="${LOGO_SRC}" alt="">
          <span>${TEAM_NAME}</span>
        </div>
        <div class="footer-sub">YOSHIMI SMC FC · ${PORTAL_NAME}</div>
      `;
    });
  }

  function refreshCoachFolderLabels() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script,style") || !node.nodeValue.includes("運営メニュー")) continue;
      node.nodeValue = node.nodeValue.replace(/運営メニュー/g, "コーチ専用フォルダ");
    }
    document.title = document.title.replace(/運営メニュー/g, "コーチ専用フォルダ");
    const coachCard = document.querySelector('a.menu-card[href="coach.html"]');
    if (coachCard) {
      const icon = coachCard.querySelector(".card-icon");
      const description = coachCard.querySelector(".card-desc");
      if (icon) icon.textContent = "📁";
      if (description) description.textContent = "Coach Folder";
    }
  }

  function enhanceGameAdjustMobile() {
    const table = document.getElementById("adj-table");
    const wrapper = table?.closest(".adj-wrap");
    if (!table || !wrapper) return;

    document.body.classList.add("game-adjust-enhanced");

    const legend = document.querySelector(".legend");
    if (legend) {
      legend.innerHTML = `
        <span class="game-adjust-legend-intro">タップで切り替え →</span>
        <span class="game-adjust-legend-item"><span class="status-btn s-ok">OK</span><span class="game-adjust-legend-label">参加可</span></span>
        <span class="game-adjust-legend-item"><span class="status-btn s-ng">NG</span><span class="game-adjust-legend-label">不可</span></span>
        <span class="game-adjust-legend-item"><span class="status-btn s-kakun">確認中</span><span class="game-adjust-legend-label">返答待ち</span></span>
        <span class="game-adjust-legend-item"><span class="status-btn s-none">－</span><span class="game-adjust-legend-label">未打診</span></span>
      `;
    }

    if (!document.getElementById("game-adjust-mobile-style")) {
      const style = document.createElement("style");
      style.id = "game-adjust-mobile-style";
      style.textContent = `
        body[data-theme="light"].game-adjust-enhanced .adj-table tbody tr:not(.tr-count):not(.tr-nokori):not(.tr-biko) td{background:#fff!important;color:#17243a!important}
        body[data-theme="light"].game-adjust-enhanced .adj-table tbody tr:nth-child(even):not(.tr-count):not(.tr-nokori):not(.tr-biko) td{background:#e7eef7!important}
        body[data-theme="light"].game-adjust-enhanced .adj-table tbody tr:not(.tr-count):not(.tr-nokori):not(.tr-biko) > :first-child{background:#d6e4f1!important;color:#10213a!important;border-right-color:#247d9e!important}
        body[data-theme="light"].game-adjust-enhanced .adj-table tbody tr:nth-child(even):not(.tr-count):not(.tr-nokori):not(.tr-biko) > :first-child{background:#c5d7e8!important}
        body[data-theme="light"].game-adjust-enhanced .adj-table .tantou-input{background:#fff!important;color:#18314b!important;border-color:#8db2c8!important}
        body[data-theme="light"].game-adjust-enhanced .adj-table .status-btn.s-ok{background:#d7f5e4!important;color:#08743d!important;border-color:#16975a!important}
        body[data-theme="light"].game-adjust-enhanced .adj-table .status-btn.s-ng{background:#ffe0e7!important;color:#a01339!important;border-color:#cf315c!important}
        body[data-theme="light"].game-adjust-enhanced .adj-table .status-btn.s-kakun{background:#fff1bd!important;color:#775800!important;border-color:#b88c00!important}
        body[data-theme="light"].game-adjust-enhanced .adj-table .status-btn.s-none{background:#e5edf5!important;color:#31536c!important;border-color:#789bb1!important}
        .game-adjust-date-nav{display:none}
        .ga-mobile-summary{display:none}
        body.game-adjust-enhanced .adj-table .full-badge{display:none!important}
        @media (max-width:760px){
          body.game-adjust-enhanced .page-wrap{padding-left:10px!important;padding-right:10px!important}
          body.game-adjust-enhanced .ctrl-bar{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px!important}
          body.game-adjust-enhanced .ctrl-bar > *{width:100%!important;min-width:0!important;margin:0!important;justify-content:center}
          body.game-adjust-enhanced .legend{display:grid!important;grid-template-columns:1fr;gap:7px!important;align-items:stretch!important}
          body.game-adjust-enhanced .legend .game-adjust-legend-intro{margin-bottom:2px;color:var(--ink-3)}
          body.game-adjust-enhanced .legend .game-adjust-legend-item{display:grid!important;grid-template-columns:minmax(118px,1fr) minmax(90px,.8fr);align-items:center;gap:12px;width:100%}
          body.game-adjust-enhanced .legend .game-adjust-legend-item .status-btn{width:100%!important;min-width:0!important;box-sizing:border-box}
          body.game-adjust-enhanced .legend .game-adjust-legend-label{font-size:.78rem;color:var(--ink-3);font-weight:800;text-align:left}
          .game-adjust-date-nav{display:grid;grid-template-columns:46px minmax(0,1fr) 46px;gap:9px;align-items:end;margin:12px 0;padding:11px;border:2px solid rgba(35,190,235,.72);border-radius:16px;background:linear-gradient(135deg,rgba(14,118,170,.2),rgba(25,180,220,.08));box-shadow:0 6px 20px rgba(0,0,0,.2)}
          .game-adjust-date-nav label{font-size:.78rem;font-weight:900;color:#73dcff;letter-spacing:.02em}
          body[data-theme="light"].game-adjust-enhanced .game-adjust-date-nav{background:linear-gradient(135deg,#d7f3ff,#f7fcff);border-color:#1689b4;box-shadow:0 6px 18px rgba(17,91,126,.16)}
          body[data-theme="light"].game-adjust-enhanced .game-adjust-date-nav label{color:#075d84}
          .game-adjust-date-nav select,.game-adjust-date-nav button{min-height:46px;border-radius:12px;font:inherit;font-weight:900}
          .game-adjust-date-nav select{width:100%;margin-top:6px;padding:8px 10px;background:var(--panel);color:var(--ink);border:2px solid var(--cyan);font-size:.88rem}
          .game-adjust-date-nav button{border:2px solid var(--cyan);background:rgba(25,180,220,.16);color:#72dcff;font-size:1.4rem}
          body[data-theme="light"].game-adjust-enhanced .game-adjust-date-nav button{color:#075d84;background:#fff}
          body.game-adjust-enhanced .adj-wrap{width:100%!important;max-height:none!important;overflow-x:hidden!important;overflow-y:visible!important;-webkit-overflow-scrolling:auto!important}
          body.game-adjust-enhanced .adj-table{width:100%!important;min-width:0!important;table-layout:fixed!important}
          body.game-adjust-enhanced .adj-table tr > *{min-width:0!important;box-sizing:border-box!important;padding-left:7px!important;padding-right:7px!important}
          body.game-adjust-enhanced .adj-table tr > :first-child{position:static!important;left:auto!important;width:40%!important;max-width:none!important;white-space:normal!important}
          body.game-adjust-enhanced .adj-table tr > :last-child{width:25%!important;max-width:none!important}
          body.game-adjust-enhanced .adj-table .ga-date-column{display:none!important}
          body.game-adjust-enhanced .adj-table .ga-date-column.ga-date-active{display:table-cell!important;width:35%!important}
          body.game-adjust-enhanced .adj-table .status-btn{width:100%!important;min-width:0!important;padding:10px 3px!important;font-size:.82rem!important}
          body.game-adjust-enhanced .adj-table .tantou-input{width:100%!important;min-width:0!important;padding:8px 4px!important;text-align:center}
          body.game-adjust-enhanced .adj-table tbody td:first-child{font-size:.78rem!important;font-weight:900!important;overflow-wrap:anywhere}
          body.game-adjust-enhanced .adj-table .tr-count,body.game-adjust-enhanced .adj-table .tr-nokori{display:none!important}
          body.game-adjust-enhanced .adj-table .ga-mobile-summary{display:grid;gap:4px;margin-top:8px;padding-top:7px;border-top:1px solid rgba(106,172,204,.35);font-size:.68rem;font-weight:900;color:#d8efff}
          body[data-theme="light"].game-adjust-enhanced .adj-table .ga-mobile-summary{color:#173d5a;border-top-color:#8ba9bd}
          body.game-adjust-enhanced .adj-table .ga-mobile-summary strong{color:#00e889}
          body[data-theme="light"].game-adjust-enhanced .adj-table .ga-mobile-summary strong{color:#08743d}
          body.game-adjust-enhanced .desktop-scroll-help{font-size:.68rem!important}
        }
      `;
      document.head.appendChild(style);
    }

    let activeDateIndex = 1;
    let syncing = false;
    const nav = document.createElement("div");
    nav.className = "game-adjust-date-nav";
    nav.setAttribute("aria-label", "表示する日程の切り替え");
    nav.innerHTML = '<button type="button" data-move="-1" aria-label="前の日程">‹</button><label>📅 表示する日程・カテゴリー<select aria-label="表示する日程とカテゴリー"></select></label><button type="button" data-move="1" aria-label="次の日程">›</button>';
    wrapper.before(nav);
    const select = nav.querySelector("select");

    function cleanHeaderLabel(cell) {
      const copy = cell.cloneNode(true);
      copy.querySelectorAll("button").forEach((button) => button.remove());
      return copy.textContent.replace(/\s+/g, " ").trim() || "日程";
    }

    function cleanCategoryLabel(cell) {
      if (!cell) return "未設定";
      const copy = cell.cloneNode(true);
      copy.querySelectorAll("span,br,button,.ga-mobile-summary").forEach((element) => element.remove());
      return copy.textContent.replace(/\s+/g, " ").trim() || "未設定";
    }

    function syncDateColumns() {
      if (syncing) return;
      syncing = true;
      const headerCells = Array.from(table.querySelectorAll("thead tr:first-child > th"));
      const categoryCells = Array.from(table.querySelectorAll("thead tr:nth-child(2) > th"));
      const dateCount = Math.max(0, headerCells.length - 2);
      if (!dateCount) {
        select.innerHTML = '<option>日程なし</option>';
        select.disabled = true;
        syncing = false;
        return;
      }
      activeDateIndex = Math.min(Math.max(activeDateIndex, 1), dateCount);
      select.disabled = false;
      select.replaceChildren(...headerCells.slice(1, -1).map((cell, index) => {
        const option = document.createElement("option");
        option.value = String(index + 1);
        option.textContent = `${cleanHeaderLabel(cell)}｜${cleanCategoryLabel(categoryCells[index + 1])}`;
        return option;
      }));
      select.value = String(activeDateIndex);
      table.querySelectorAll("tr").forEach((row) => {
        const cells = Array.from(row.children);
        cells.forEach((cell, index) => {
          const isDate = index > 0 && index < cells.length - 1;
          cell.classList.toggle("ga-date-column", isDate);
          cell.classList.toggle("ga-date-active", isDate && index === activeDateIndex);
        });
      });
      const categoryCell = categoryCells[activeDateIndex];
      if (categoryCell) {
        let summary = categoryCell.querySelector(".ga-mobile-summary");
        if (!summary) {
          summary = document.createElement("span");
          summary.className = "ga-mobile-summary";
          summary.innerHTML = '<span>参加チーム数：<strong data-summary="count"></strong></span><span>残りチーム数：<strong data-summary="remaining"></strong></span>';
          categoryCell.appendChild(summary);
        }
        const countCell = table.querySelector(".tr-count")?.children[activeDateIndex];
        const remainingCell = table.querySelector(".tr-nokori")?.children[activeDateIndex];
        const countValue = countCell?.textContent.trim() || "0";
        const remainingValue = remainingCell?.textContent.trim() || "0";
        const countOutput = summary.querySelector('[data-summary="count"]');
        const remainingOutput = summary.querySelector('[data-summary="remaining"]');
        if (countOutput.textContent !== countValue) countOutput.textContent = countValue;
        if (remainingOutput.textContent !== remainingValue) remainingOutput.textContent = remainingValue;
      }
      syncing = false;
    }

    select.addEventListener("change", () => {
      activeDateIndex = Number(select.value) || 1;
      syncDateColumns();
    });
    nav.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const count = select.options.length;
        if (!count || select.disabled) return;
        activeDateIndex = ((activeDateIndex - 1 + Number(button.dataset.move) + count) % count) + 1;
        syncDateColumns();
      });
    });
    new MutationObserver(() => window.requestAnimationFrame(syncDateColumns))
      .observe(table, { childList: true, subtree: true });
    syncDateColumns();
  }

  function enhanceTournamentPrinting() {
    const preview = document.getElementById("taisen-preview");
    if (!preview) return;

    document.body.classList.add("tournament-print-enhanced");
    if (!document.getElementById("tournament-print-enhanced-style")) {
      const style = document.createElement("style");
      style.id = "tournament-print-enhanced-style";
      style.textContent = `
        body.tournament-print-enhanced #doc-taisen .fg1,body.tournament-print-enhanced #doc-taisen .fg1 > .form-group{width:100%;min-width:0;max-width:100%;box-sizing:border-box}
        body.tournament-print-enhanced #doc-taisen #t-date{display:block;width:100%!important;min-width:0!important;max-width:100%!important;inline-size:100%!important;min-inline-size:0!important;box-sizing:border-box!important}
        body.tournament-print-enhanced #doc-taisen #t-date::-webkit-date-and-time-value{min-width:0;text-align:left}
        body.tournament-print-enhanced #taisen-preview .tai-sheet{border:1px solid #b8c3d1;background:#fff;color:#172033}
        body.tournament-print-enhanced #taisen-preview .tai-title{color:#173b66;border-bottom:3px solid #ea6b24;padding-bottom:6px;margin-bottom:4px}
        body.tournament-print-enhanced #taisen-preview .tai-sub{color:#475569;font-weight:700}
        body.tournament-print-enhanced #taisen-preview .block-hd{background:#173b66;color:#fff}
        body.tournament-print-enhanced #taisen-preview .st .sched-th{background:#173b66;color:#fff;border-color:#355a82}
        body.tournament-print-enhanced #taisen-preview .st td,body.tournament-print-enhanced #taisen-preview .rt td,body.tournament-print-enhanced #taisen-preview .rct td{border-color:#8793a3;color:#172033}
        body.tournament-print-enhanced #taisen-preview .st .tr-break-td{background:#fff0c7;color:#684600;border:2px solid #d79a16;font-weight:900}
        body.tournament-print-enhanced #taisen-preview .st .tr-closing-td{background:#fde3d4;color:#8a3100;border:2px solid #e67838;font-weight:900}
        body.tournament-print-enhanced #taisen-preview .st .td-score,body.tournament-print-enhanced #taisen-preview .rct .td-score{background:#fff8d8}
        body.tournament-print-enhanced #taisen-preview .rt .rank-th{background:#285943;color:#fff;border-color:#3e7560}
        body.tournament-print-enhanced #taisen-preview .rct .round-th-h{background:#344054;color:#fff}
        body.tournament-print-enhanced #taisen-preview .rct .round-th-t{background:#526174;color:#fff}
        @media print{
          body[data-print-target="tournament-schedule"] #taisen-preview{display:block!important;overflow:visible!important;margin:0!important}
          body[data-print-target="tournament-schedule"] #taisen-preview > *{min-width:0!important}
          body[data-print-target="tournament-schedule"] .tai-sheet{width:100%!important;max-width:none!important;padding:0!important;margin:0!important;border:0!important;box-shadow:none!important;overflow:visible!important;font-size:8.5pt!important;line-height:1.28!important}
          body[data-print-target="tournament-schedule"] .tai-title{font-size:16pt!important;color:#173b66!important;border-bottom:2.5pt solid #ea6b24!important;padding-bottom:4mm!important;margin-bottom:2mm!important}
          body[data-print-target="tournament-schedule"] .tai-sub{font-size:9.5pt!important;color:#334155!important;margin-bottom:3mm!important}
          body[data-print-target="tournament-schedule"] .courts-row,body[data-print-target="tournament-schedule"] .blocks-row{gap:5mm!important;grid-template-columns:1fr 1fr!important}
          body[data-print-target="tournament-schedule"] .block-hd{display:block!important;width:auto!important;margin:3mm 0 1.5mm!important;padding:1.5mm 2.5mm!important;border-radius:1mm!important;background:#173b66!important;color:#fff!important;font-size:9pt!important;break-after:avoid-page;page-break-after:avoid}
          body[data-print-target="tournament-schedule"] table{width:100%!important;margin-bottom:3mm!important;border-collapse:collapse!important}
          body[data-print-target="tournament-schedule"] thead{display:table-header-group}
          body[data-print-target="tournament-schedule"] tr{break-inside:avoid-page;page-break-inside:avoid}
          body[data-print-target="tournament-schedule"] .st .sched-th{padding:1.3mm 1mm!important;background:#173b66!important;color:#fff!important;border:1px solid #355a82!important;font-size:7.5pt!important}
          body[data-print-target="tournament-schedule"] .st td{padding:1.5mm 1.2mm!important;border:1px solid #667085!important;background:#fff!important;color:#111827!important;font-size:8pt!important}
          body[data-print-target="tournament-schedule"] .st .tr-alt-bg td{background:#eef3f8!important}
          body[data-print-target="tournament-schedule"] .st .td-score{background:#fff3b0!important}
          body[data-print-target="tournament-schedule"] .st .td-vs{background:#e5e7eb!important;color:#475569!important}
          body[data-print-target="tournament-schedule"] .st .tr-break-td{background:#fff0c7!important;color:#5d3d00!important;border:2px solid #c88a08!important;font-size:9pt!important;padding:2mm!important}
          body[data-print-target="tournament-schedule"] .st .tr-closing-td{background:#fde3d4!important;color:#7c2d00!important;border:2px solid #dc6b2f!important;font-size:9pt!important;padding:2mm!important}
          body[data-print-target="tournament-schedule"] .rt .rank-th{background:#285943!important;color:#fff!important;border:1px solid #3e7560!important;font-size:7.2pt!important;padding:1.2mm .8mm!important}
          body[data-print-target="tournament-schedule"] .rt td{border:1px solid #667085!important;background:#fff!important;color:#111827!important;font-size:7.6pt!important;padding:1.2mm .8mm!important}
          body[data-print-target="tournament-schedule"] .rt .rank-alt{background:#edf7f1!important}
          body[data-print-target="tournament-schedule"] .rct th,body[data-print-target="tournament-schedule"] .rct td{border:1px solid #667085!important;font-size:7.2pt!important;padding:1mm .8mm!important}
          body[data-print-target="tournament-schedule"] .rct .round-th-h{background:#344054!important;color:#fff!important}
          body[data-print-target="tournament-schedule"] .rct .round-th-t{background:#526174!important;color:#fff!important}
          body[data-print-target="tournament-schedule"] .rct .td-self{background:#d8dee7!important;color:#344054!important}
          body[data-print-target="tournament-schedule"] .rct .td-score{background:#fff3b0!important}
        }
      `;
      document.head.appendChild(style);
    }

    const lunchFieldIds = ["lunch-enable", "lunch-start", "lunch-min", "lunch-label"];
    if (Array.isArray(window.TAISEN_FIELDS)) {
      lunchFieldIds.forEach((id) => {
        if (!window.TAISEN_FIELDS.includes(id)) window.TAISEN_FIELDS.push(id);
      });
    }

    if (typeof window.collectFields === "function" && !window.collectFields.__lunchFixed) {
      const originalCollectFields = window.collectFields;
      const enhancedCollectFields = function(fields) {
        const result = originalCollectFields(fields);
        (fields || []).forEach((id) => {
          const element = document.getElementById(id);
          if (element?.type === "checkbox") result[id] = element.checked;
        });
        return result;
      };
      enhancedCollectFields.__lunchFixed = true;
      window.collectFields = enhancedCollectFields;
    }

    if (typeof window.applyFields === "function" && !window.applyFields.__lunchFixed) {
      const originalApplyFields = window.applyFields;
      const enhancedApplyFields = function(data) {
        originalApplyFields(data || {});
        Object.keys(data || {}).forEach((id) => {
          const element = document.getElementById(id);
          if (element?.type === "checkbox") element.checked = data[id] === true || data[id] === "true" || data[id] === "on";
        });
        if (typeof window.toggleLunch === "function") window.toggleLunch();
      };
      enhancedApplyFields.__lunchFixed = true;
      window.applyFields = enhancedApplyFields;
    }

    function addMinutes(time, minutes) {
      const parts = String(time || "00:00").split(":");
      const total = ((Number(parts[0]) * 60 + Number(parts[1]) + Number(minutes)) % 1440 + 1440) % 1440;
      return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
    }

    function timeToMinutes(time) {
      const parts = String(time || "00:00").split(":");
      return Number(parts[0]) * 60 + Number(parts[1]);
    }

    function minutesToTime(total) {
      const normalized = ((Number(total) % 1440) + 1440) % 1440;
      return String(Math.floor(normalized / 60)).padStart(2, "0") + ":" + String(normalized % 60).padStart(2, "0");
    }

    function ensureLunchBreakRows() {
      const enabled = document.getElementById("lunch-enable")?.checked;
      const sheet = preview.querySelector(".tai-sheet");
      if (!sheet) return;
      const requestedStart = document.getElementById("lunch-start")?.value || "12:00";
      const minutes = Math.max(10, Number(document.getElementById("lunch-min")?.value) || 60);
      const label = document.getElementById("lunch-label")?.value.trim() || "🍱 昼食休憩";
      const gameMinutes = Math.max(1, Number(document.getElementById("t-min")?.value) || 40);
      const tournamentStart = document.getElementById("t-start")?.value || "08:30";
      let scheduleTables = Array.from(sheet.querySelectorAll(".courts-row > div > table.st"));
      if (!scheduleTables.length) {
        const firstSchedule = sheet.querySelector("table.st");
        if (firstSchedule) scheduleTables = [firstSchedule];
      }

      scheduleTables.forEach((table) => {
        Array.from(table.querySelectorAll("tr")).forEach((row) => {
          const breakCell = row.querySelector(".tr-break-td");
          if (row.classList.contains("lunch-break-row") || breakCell?.textContent.includes(label) || breakCell?.textContent.includes("昼食休憩")) row.remove();
        });
      });

      const timedRowsByTable = scheduleTables.map((table) =>
        Array.from(table.tBodies[0]?.rows || []).filter((candidate) => /^\d{1,2}:\d{2}$/.test(candidate.cells[1]?.textContent.trim() || ""))
      );
      const roundCount = Math.max(0, ...timedRowsByTable.map((rows) => rows.length));
      const requestedStartMinutes = timeToMinutes(requestedStart);
      let cursor = timeToMinutes(tournamentStart);
      let lunchBeforeRound = -1;
      let actualLunchStart = requestedStartMinutes;
      const adjustedRoundTimes = [];

      for (let round = 0; round < roundCount; round++) {
        if (enabled && lunchBeforeRound < 0 && (cursor >= requestedStartMinutes || cursor + gameMinutes > requestedStartMinutes)) {
          lunchBeforeRound = round;
          actualLunchStart = Math.max(cursor, requestedStartMinutes);
          cursor = actualLunchStart + minutes;
        }
        adjustedRoundTimes.push(minutesToTime(cursor));
        cursor += gameMinutes;
      }
      if (enabled && lunchBeforeRound < 0) {
        lunchBeforeRound = roundCount;
        actualLunchStart = Math.max(cursor, requestedStartMinutes);
        cursor = actualLunchStart + minutes;
      }
      const actualLunchEnd = actualLunchStart + minutes;

      scheduleTables.forEach((table) => {
        const timedRows = Array.from(table.tBodies[0]?.rows || []).filter((candidate) => /^\d{1,2}:\d{2}$/.test(candidate.cells[1]?.textContent.trim() || ""));
        timedRows.forEach((row, index) => {
          if (adjustedRoundTimes[index]) row.cells[1].textContent = adjustedRoundTimes[index];
        });
        if (enabled) {
          const row = document.createElement("tr");
          row.className = "lunch-break-row";
          const cell = document.createElement("td");
          cell.className = "tr-break-td";
          cell.colSpan = Math.max(1, table.querySelectorAll("thead th").length);
          cell.textContent = `${label}　（${minutes}分）　${minutesToTime(actualLunchStart)}〜${minutesToTime(actualLunchEnd)}`;
          row.appendChild(cell);
          const body = table.tBodies[0] || table.createTBody();
          const insertBefore = timedRows[lunchBeforeRound];
          if (insertBefore) body.insertBefore(row, insertBefore);
          else body.appendChild(row);
        }
      });

      const allScheduleTables = Array.from(sheet.querySelectorAll("table.st"));
      const finalsTable = allScheduleTables.find((table) =>
        !scheduleTables.includes(table) && Array.from(table.querySelectorAll("tbody tr")).some((row) => row.cells[2]?.textContent.trim() === "順位戦")
      );
      const finalsStart = cursor;
      if (finalsTable) {
        finalsTable.querySelectorAll(".tr-break-td").forEach((cell) => cell.closest("tr")?.remove());
        const finalsRows = Array.from(finalsTable.tBodies[0]?.rows || []).filter((row) => row.cells[2]?.textContent.trim() === "順位戦");
        finalsRows.forEach((row, index) => {
          row.cells[1].textContent = minutesToTime(finalsStart + (index >= 2 ? gameMinutes : 0));
        });
      }
      const closingTime = minutesToTime(finalsStart + gameMinutes * 2);
      sheet.querySelectorAll(".tr-closing-td").forEach((cell) => {
        cell.textContent = cell.textContent.replace(/\d{1,2}:\d{2}(?=～)/, closingTime);
      });
    }

    if (typeof window.buildTaisen === "function" && !window.buildTaisen.__lunchFixed) {
      const originalBuildTaisen = window.buildTaisen;
      const enhancedBuildTaisen = function() {
        const result = originalBuildTaisen.apply(this, arguments);
        ensureLunchBreakRows();
        return result;
      };
      enhancedBuildTaisen.__lunchFixed = true;
      window.buildTaisen = enhancedBuildTaisen;
    }
  }

function enhanceCalendarUpcomingAgenda() {
    const calendarFrame = document.getElementById("gcal-iframe");
    const calendarWrap = calendarFrame?.closest(".gcal-wrap");
    if (!calendarFrame || !calendarWrap || document.getElementById("calendar-upcoming-agenda")) return;

    const PUBLIC_CALENDAR_KEY = ["AIzaSyDRH2RymQBOFCcXIDDjJc", "EbBdyuVmfXLnQ"].join("");
    const CACHE_KEY = "smc-calendar-upcoming-v4";
    const CACHE_TTL = 15 * 60 * 1000;
    const CALENDARS = [
      { id: "yoshimi.smc.fc@gmail.com", color: "#616161", label: "全体" },
      { id: "fceff821382e14ab8c504a20e126273e4fc5883bf387a7ae30262ca6e8c9ec05@group.calendar.google.com", color: "#f09300", label: "U10" },
      { id: "b90bd81001cd0963551c8cd44eb53531d1587f3ab8759318e8023da65b7b08ee@group.calendar.google.com", color: "#d50000", label: "U11" },
      { id: "1e5a7d7fd91ca84987b1980a6576d7034f431e79067fe2c8e1a38feb06fe2292@group.calendar.google.com", color: "#8e24aa", label: "U12" },
      { id: "f858f43317baa1ffb0ce1110b03c6ecac3bf10a5d5367424a0b9fc538b50efcf@group.calendar.google.com", color: "#0b8043", label: "U7" },
      { id: "73b735bde5b9d22f273c480e5721885d51e19fedade71df07c521e99f6d53f3a@group.calendar.google.com", color: "#7cb342", label: "U8" },
      { id: "01d22b708d632098f45dd7bc1be0cae88eff00e4d2e4b9f077c8d70bcca46de0@group.calendar.google.com", color: "#e4c441", label: "U9" },
      { id: "ccd8330bb3b6efb8f90a36e1655ac0459ddbe047155325367bb0feddd1eae83d@group.calendar.google.com", color: "#4285f4", label: "その他" }
    ];

    if (!document.getElementById("calendar-upcoming-style")) {
      const style = document.createElement("style");
      style.id = "calendar-upcoming-style";
      style.textContent = `
        .calendar-upcoming{margin-top:24px}
        .calendar-upcoming-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
        .calendar-upcoming-title{display:flex;align-items:center;gap:8px;margin:0;color:#78ddff;font-size:1.12rem;font-weight:950;letter-spacing:.02em}
        .calendar-upcoming-badge{padding:4px 9px;border:1px solid rgba(45,190,230,.45);border-radius:999px;background:rgba(45,190,230,.08);color:#a8eaff;font-size:.64rem;font-weight:900;white-space:nowrap}
        .calendar-upcoming-list{display:grid;gap:9px}
        .calendar-event-card{display:grid;grid-template-columns:64px 5px minmax(0,1fr) 20px;align-items:center;gap:13px;min-height:96px;padding:12px 14px 12px 10px;border:1px solid rgba(94,139,188,.42);border-radius:14px;background:linear-gradient(135deg,rgba(20,53,105,.97),rgba(14,42,82,.97));box-shadow:0 8px 20px rgba(0,12,35,.22);color:#fff;text-decoration:none;transition:transform .15s,border-color .15s,box-shadow .15s}
        .calendar-event-card:hover,.calendar-event-card:focus-visible{transform:translateY(-1px);border-color:#6fddff;box-shadow:0 10px 24px rgba(0,25,65,.32);outline:none}
        .calendar-event-date{display:grid;place-items:center;align-content:center;min-height:68px;text-align:center;border-right:1px solid rgba(255,255,255,.12)}
        .calendar-event-month{font-size:.63rem;font-weight:800;color:#9fdff6}
        .calendar-event-day{font-size:1.75rem;font-weight:950;line-height:1.05;color:#fff}
        .calendar-event-dow{font-size:.7rem;font-weight:900;color:#c8e8f5}
        .calendar-event-dow.is-sun{color:#ff9aa9}.calendar-event-dow.is-sat{color:#83c8ff}
        .calendar-event-bar{width:5px;height:58px;border-radius:99px}
        .calendar-event-body{min-width:0}
        .calendar-event-category{display:inline-flex;align-items:center;margin-bottom:5px;padding:2px 7px;border:1px solid currentColor;border-radius:999px;font-size:.59rem;font-weight:900;line-height:1.35}
        .calendar-event-title{overflow-wrap:anywhere;font-size:.92rem;font-weight:950;line-height:1.45;color:#fff}
        .calendar-event-meta{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:5px;color:#c3daef;font-size:.7rem;font-weight:700;line-height:1.45}
        .calendar-event-meta span{display:inline-flex;align-items:center;gap:4px}
        .calendar-event-arrow{color:#86dfff;font-size:1.25rem;font-weight:900}
        .calendar-upcoming-state{display:grid;place-items:center;gap:10px;min-height:130px;padding:22px;border:1px dashed rgba(94,139,188,.55);border-radius:14px;background:rgba(10,35,72,.6);color:#c3daef;text-align:center;font-size:.78rem;font-weight:800;line-height:1.7}
        .calendar-upcoming-skeleton{height:96px;border-radius:14px;background:linear-gradient(100deg,rgba(41,72,119,.55) 20%,rgba(78,119,168,.72) 38%,rgba(41,72,119,.55) 56%);background-size:250% 100%;animation:calendarSkeleton 1.2s ease-in-out infinite}
        @keyframes calendarSkeleton{to{background-position-x:-250%}}
        .calendar-upcoming-retry{min-height:40px;padding:8px 16px;border:1px solid #58ccef;border-radius:999px;background:rgba(45,190,230,.12);color:#b9efff;font:inherit;font-size:.75rem;font-weight:900;cursor:pointer}
        .calendar-upcoming-note{margin:9px 2px 0;color:var(--ink-3);font-size:.69rem;line-height:1.6}
        body[data-theme="light"] .calendar-upcoming-title{color:#075d84}
        body[data-theme="light"] .calendar-upcoming-badge{border-color:#4b91aa;background:#e9f7fb;color:#075d84}
        body[data-theme="light"] .calendar-event-card{border-color:#8fa9c5;background:linear-gradient(135deg,#f4f8ff,#e9f1fb);box-shadow:0 7px 18px rgba(31,64,92,.14);color:#102944}
        body[data-theme="light"] .calendar-event-card:hover,body[data-theme="light"] .calendar-event-card:focus-visible{border-color:#147ca2;box-shadow:0 9px 20px rgba(31,64,92,.2)}
        body[data-theme="light"] .calendar-event-date{border-right-color:#c7d6e5}
        body[data-theme="light"] .calendar-event-month{color:#246985}
        body[data-theme="light"] .calendar-event-day,body[data-theme="light"] .calendar-event-title{color:#102944}
        body[data-theme="light"] .calendar-event-dow{color:#385873}
        body[data-theme="light"] .calendar-event-meta{color:#4c647c}
        body[data-theme="light"] .calendar-event-arrow{color:#147ca2}
        body[data-theme="light"] .calendar-upcoming-state{border-color:#8fa9c5;background:#edf4fb;color:#36546d}
        body[data-theme="light"] .calendar-upcoming-retry{border-color:#147ca2;background:#e5f5fa;color:#075d84}
        @media(max-width:600px){
          .calendar-upcoming{margin-top:20px}
          .calendar-upcoming-title{font-size:1rem}
          .calendar-event-card{grid-template-columns:54px 4px minmax(0,1fr) 16px;gap:10px;min-height:90px;padding:10px 10px 10px 7px}
          .calendar-event-date{min-height:64px}.calendar-event-day{font-size:1.55rem}.calendar-event-title{font-size:.86rem}.calendar-event-meta{font-size:.66rem}
        }
      `;
      document.head.appendChild(style);
    }

    const section = document.createElement("section");
    section.className = "calendar-upcoming";
    section.id = "calendar-upcoming-agenda";
    section.setAttribute("aria-labelledby", "calendar-upcoming-title");
    section.innerHTML = `
      <div class="calendar-upcoming-heading">
        <h2 class="calendar-upcoming-title" id="calendar-upcoming-title">📋 今後の予定</h2>
        <span class="calendar-upcoming-badge" id="calendar-upcoming-badge">自動更新</span>
      </div>
      <div class="calendar-upcoming-list" id="calendar-upcoming-list" aria-live="polite" aria-busy="true">
        <div class="calendar-upcoming-skeleton"></div>
        <div class="calendar-upcoming-skeleton"></div>
        <div class="calendar-upcoming-skeleton"></div>
      </div>
      <p class="calendar-upcoming-note">Googleカレンダーの今後45日間を日付順に表示します。予定をタップするとGoogleカレンダーで詳細を確認できます。</p>
    `;
    calendarWrap.after(section);

    const list = section.querySelector("#calendar-upcoming-list");
    const badge = section.querySelector("#calendar-upcoming-badge");
    const days = ["日", "月", "火", "水", "木", "金", "土"];

    function parseStart(event) {
      if (event.allDay) {
        const parts = event.start.split("-").map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
      return new Date(event.start);
    }

    function extractDescriptionTime(description) {
          const plain = String(description || "")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<[^>]*>/g, " ")
            .replace(/&nbsp;/gi, " ");
          const ranges = [];
          const colonRange = /(?:^|\s)([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)\s*(?:[〜～~－—-]|から)\s*([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)(?=\s|$)/gm;
          const japaneseRange = /(?:^|\s)([01]?\d|2[0-3])\s*時\s*(?:([0-5]?\d)\s*分)?\s*(?:[〜～~－—-]|から)\s*([01]?\d|2[0-3])\s*時\s*(?:([0-5]?\d)\s*分)?(?=\s|$)/gm;
          let match;
          while ((match = colonRange.exec(plain))) {
            ranges.push([match[1], match[2], match[3], match[4]]);
          }
          while ((match = japaneseRange.exec(plain))) {
            ranges.push([match[1], match[2] || "0", match[3], match[4] || "0"]);
          }
          if (ranges.length !== 1) return "";
          const [startHour, startMinute, endHour, endMinute] = ranges[0];
          const pad = (value) => String(value).padStart(2, "0");
          return `${pad(startHour)}:${pad(startMinute)}〜${pad(endHour)}:${pad(endMinute)}`;
        }

    function formatTime(event) {
      if (event.descriptionTime) return event.descriptionTime;
      if (event.allDay) return "終日";
      const formatter = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });
      return `${formatter.format(new Date(event.start))}〜${formatter.format(new Date(event.end))}`;
    }

    function safeEventUrl(value) {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname.endsWith("google.com") ? url.href : "";
      } catch (error) {
        return "";
      }
    }

    function setTodayNotice(events) {
      const target = document.getElementById("tn-info");
      if (!target) return;
      const today = new Date();
      const todaysEvents = events.filter((event) => {
        const date = parseStart(event);
        return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
      });
      target.replaceChildren();
      const dot = document.createElement("span");
      dot.className = "tn-dot";
      dot.style.background = todaysEvents[0]?.color || "var(--cyan)";
      const text = document.createElement("span");
      text.textContent = todaysEvents.length
        ? `${todaysEvents[0].title}${todaysEvents.length > 1 ? ` ほか${todaysEvents.length - 1}件` : ""}`
        : "今日の登録予定はありません";
      target.append(dot, text);
    }

    function renderEvents(events, cached) {
      list.replaceChildren();
      list.setAttribute("aria-busy", "false");
      badge.textContent = cached ? "保存データ" : "自動更新";
      setTodayNotice(events);

      if (!events.length) {
        const empty = document.createElement("div");
        empty.className = "calendar-upcoming-state";
        empty.textContent = "今後45日間に登録されている予定はありません。";
        list.appendChild(empty);
        return;
      }

      events.slice(0, 18).forEach((event) => {
        const href = safeEventUrl(event.url);
        const card = document.createElement(href ? "a" : "div");
        card.className = "calendar-event-card";
        if (href) {
          card.href = href;
          card.target = "_blank";
          card.rel = "noopener noreferrer";
          card.setAttribute("aria-label", `${event.title}の詳細をGoogleカレンダーで開く`);
        }

        const date = parseStart(event);
        const dateBox = document.createElement("div");
        dateBox.className = "calendar-event-date";
        const month = document.createElement("div");
        month.className = "calendar-event-month";
        month.textContent = `${date.getMonth() + 1}月`;
        const day = document.createElement("div");
        day.className = "calendar-event-day";
        day.textContent = String(date.getDate());
        const dow = document.createElement("div");
        dow.className = `calendar-event-dow${date.getDay() === 0 ? " is-sun" : date.getDay() === 6 ? " is-sat" : ""}`;
        dow.textContent = days[date.getDay()];
        dateBox.append(month, day, dow);

        const bar = document.createElement("div");
        bar.className = "calendar-event-bar";
        bar.style.background = event.color;

        const body = document.createElement("div");
        body.className = "calendar-event-body";
        const category = document.createElement("span");
        category.className = "calendar-event-category";
        category.style.color = event.color;
        category.textContent = event.label;
        const title = document.createElement("div");
        title.className = "calendar-event-title";
        title.textContent = event.title;
        const meta = document.createElement("div");
        meta.className = "calendar-event-meta";
        const time = document.createElement("span");
        time.textContent = `🕒 ${formatTime(event)}`;
        meta.appendChild(time);
        if (event.location) {
          const location = document.createElement("span");
          location.textContent = `📍 ${event.location}`;
          meta.appendChild(location);
        }
        body.append(category, title, meta);

        const arrow = document.createElement("span");
        arrow.className = "calendar-event-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = href ? "›" : "";
        card.append(dateBox, bar, body, arrow);
        list.appendChild(card);
      });
    }

    function renderError() {
      list.replaceChildren();
      list.setAttribute("aria-busy", "false");
      badge.textContent = "取得エラー";
      const state = document.createElement("div");
      state.className = "calendar-upcoming-state";
      const text = document.createElement("span");
      text.textContent = "予定を取得できませんでした。通信環境を確認して、もう一度お試しください。";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "calendar-upcoming-retry";
      retry.textContent = "もう一度読み込む";
      retry.addEventListener("click", () => loadEvents(true));
      state.append(text, retry);
      list.appendChild(state);
    }

    function readCache() {
      if (!canStore) return null;
      try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        return cache && Array.isArray(cache.events) ? cache : null;
      } catch (error) {
        return null;
      }
    }

    function writeCache(events) {
      if (!canStore) return;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), events }));
      } catch (error) {
        // Storage is optional; live calendar display remains available.
      }
    }

    async function fetchCalendar(calendar, timeMin, timeMax) {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`);
      url.searchParams.set("key", PUBLIC_CALENDAR_KEY);
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "40");
      const response = await fetch(url.toString(), { referrerPolicy: "strict-origin-when-cross-origin" });
      if (!response.ok) throw new Error(`Calendar API ${response.status}`);
      const data = await response.json();
      return (data.items || []).map((event) => ({
        id: `${calendar.id}:${event.id || event.iCalUID || ""}:${event.start?.dateTime || event.start?.date || ""}`,
        title: event.summary || "（タイトル未設定）",
        start: event.start?.dateTime || event.start?.date || "",
        end: event.end?.dateTime || event.end?.date || "",
        allDay: !event.start?.dateTime,
        descriptionTime: !event.start?.dateTime ? extractDescriptionTime(event.description) : "",
        location: event.location || "",
        url: event.htmlLink || "",
        color: calendar.color,
        label: calendar.label
      })).filter((event) => event.start);
    }

    async function loadEvents(force) {
      const cache = readCache();
      if (!force && cache && Date.now() - cache.savedAt < CACHE_TTL) {
        renderEvents(cache.events, false);
        return;
      }
      if (force) {
        list.setAttribute("aria-busy", "true");
        list.innerHTML = '<div class="calendar-upcoming-skeleton"></div><div class="calendar-upcoming-skeleton"></div>';
        badge.textContent = "読込中";
      }
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + 45);
      try {
        const results = await Promise.allSettled(CALENDARS.map((calendar) => fetchCalendar(calendar, now.toISOString(), end.toISOString())));
        const successful = results.filter((result) => result.status === "fulfilled");
        if (!successful.length) throw new Error("All calendar requests failed");
        const seen = new Set();
        const events = successful.flatMap((result) => result.value)
          .sort((left, right) => left.start.localeCompare(right.start))
          .filter((event) => !seen.has(event.id) && seen.add(event.id));
        writeCache(events);
        renderEvents(events, false);
      } catch (error) {
        if (cache?.events?.length) renderEvents(cache.events, true);
        else renderError();
      }
    }

    loadEvents(false);
  }

  function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.tab;
        const root = button.closest("[role='tablist']")?.parentElement || button.closest(".panel") || document;

        root.querySelectorAll(".tab-btn").forEach((item) => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-selected", String(active));
        });
        root.querySelectorAll(".tab-content").forEach((panel) => {
          panel.classList.toggle("active", panel.id === "tab-" + target);
        });
      });
    });
  }

  function setupDisclosureAccessibility() {
    document.querySelectorAll(".acc-hdr[onclick]").forEach((header) => {
      const panel = header.nextElementSibling;
      if (!panel) return;
      header.setAttribute("role", "button");
      header.setAttribute("tabindex", "0");
      header.setAttribute("aria-expanded", String(panel.classList.contains("open")));
      header.addEventListener("click", () => {
        window.setTimeout(() => {
          header.setAttribute("aria-expanded", String(panel.classList.contains("open")));
        }, 0);
      });
      header.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        header.click();
      });
    });
  }

  function labelResponsiveTable(table) {
    const headers = Array.from(table.querySelectorAll("thead th")).map((header) => header.textContent.trim());
    if (!headers.length) return;
    table.querySelectorAll("tbody tr").forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (cell.tagName !== "TD" || cell.hasAttribute("data-label")) return;
        cell.setAttribute("data-label", headers[index] || "");
      });
    });
  }

  function setupResponsiveTables() {
    document.querySelectorAll("table.mobile-stack").forEach((table) => {
      labelResponsiveTable(table);
      const observer = new MutationObserver(() => labelResponsiveTable(table));
      observer.observe(table, { childList: true, subtree: true });
    });
    document.querySelectorAll(".table-wrap,.acc-table-wrap,.acct-table-wrap,.ledger-sheet-wrap,.roster-wrap,.list-wrap,.adj-wrap,.duty-table-wrap").forEach((wrapper) => {
      if (!wrapper.hasAttribute("tabindex")) wrapper.setAttribute("tabindex", "0");
      wrapper.setAttribute("role", "region");
      if (!wrapper.hasAttribute("aria-label")) wrapper.setAttribute("aria-label", "横にスクロールできる表");
    });
  }

  function showStorageWarning() {
    if (canStore) return;
    const banner = document.createElement("div");
    banner.className = "notice-bar red";
    banner.style.cssText = "position:fixed;top:70px;left:12px;right:12px;z-index:9998";
    banner.textContent = "このブラウザではデータ保存が使えません。Safariのプライベートブラウズをオフにするか、Chromeでお試しください。";
    document.body.prepend(banner);
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildLoader();
    refreshHeader();
    applyTheme(getSavedTheme());
    refreshFooter();
    refreshCoachFolderLabels();
    enhanceGameAdjustMobile();
    enhanceTournamentPrinting();
    enhanceCalendarUpcomingAgenda();
    setupTabs();
    setupDisclosureAccessibility();
    setupResponsiveTables();
    showStorageWarning();
  });
})();

/* ===== Service Worker 登録（リロードなし・点滅防止） ===== */
(function(){
  if(!('serviceWorker' in navigator)) return;

  var SW_PATH = location.pathname.replace(/\/[^\/]*$/, '/') + 'sw.js';

  // SWを登録して更新チェックのみ行う。ページ遷移はネットワーク優先、
  // 共通アセットはキャッシュを先に表示してバックグラウンド更新する。
  navigator.serviceWorker.register(SW_PATH).then(function(reg){
    reg.update();
    reg.addEventListener('updatefound', function(){
      var newWorker = reg.installing;
      if(!newWorker) return;
      newWorker.addEventListener('statechange', function(){
        if(newWorker.state === 'installed'){
          newWorker.postMessage({type:'SKIP_WAITING'});
        }
      });
    });
  }).catch(function(err){
    console.log('SW登録エラー:', err);
  });
  // 注意：window.location.reload() は絶対に呼ばない（点滅・無限リロードの原因）
})();

/* ===== 保存状態の共通表示 ===== */
(function(){
  var hideTimer = null;
  function getToast(){
    var toast = document.getElementById("smc-save-toast");
    if(toast) return toast;
    toast = document.createElement("div");
    toast.id = "smc-save-toast";
    toast.className = "save-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
    return toast;
  }
  window.addEventListener("smc:save-status", function(event){
    var d = event.detail || {};
    var toast = getToast();
    var message = "";
    var state = "ok";
    if(d.cloudSaved){
      message = d.syncedAfterTimeout ? "☁️ クラウドへ再同期しました" : "✅ クラウドに保存しました";
    }else if(d.localOnly && d.localSaved){
      message = "📱 この端末に保存しました";
      state = "local";
    }else if(d.queued && d.localSaved){
      message = "⚠️ 端末に保存しました。クラウド保存は完了していません";
      state = "warn";
    }else{
      message = "❌ 保存できませんでした。通信状態をご確認ください";
      state = "error";
    }
    toast.textContent = message;
    toast.dataset.state = state;
    toast.classList.add("show");
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(function(){ toast.classList.remove("show"); }, 3600);
  });
})();

/* ===== 共通印刷（描画完了待ち・用紙方向・後片付け） ===== */
(function(){
  var printing = false;
  function setPageStyle(orientation, requestedMargin){
    var style = document.getElementById("smc-print-page-style");
    if(!style){
      style = document.createElement("style");
      style.id = "smc-print-page-style";
      document.head.appendChild(style);
    }
    var size = orientation === "landscape" ? "A4 landscape" : "A4 portrait";
    var margin = requestedMargin || (orientation === "landscape" ? "8mm 10mm" : "10mm 12mm");
    style.textContent = "@page{size:" + size + ";margin:" + margin + "}";
  }
  function cleanupPrint(){
    printing = false;
    document.body.classList.remove("is-printing");
    document.body.removeAttribute("data-print-target");
  }
  window.smcPrint = function(options){
    options = options || {};
    if(printing) return;
    printing = true;
    if(typeof options.before === "function") options.before();
    setPageStyle(options.orientation || "portrait", options.margin);
    if(options.target) document.body.dataset.printTarget = options.target;
    document.body.classList.add("is-printing");
    window.addEventListener("afterprint", cleanupPrint, {once:true});
    window.requestAnimationFrame(function(){
      window.requestAnimationFrame(function(){
        window.setTimeout(function(){
          window.print();
          window.setTimeout(cleanupPrint, 1200);
        }, 80);
      });
    });
  };
})();

/* ===== 端末内エラーログ（個人情報を外部送信しない） ===== */
(function(){
  var ERROR_KEY = "smc_client_errors_v1";
  function recordError(type, message, source, line){
    try{
      var errors = JSON.parse(localStorage.getItem(ERROR_KEY) || "[]");
      errors.push({
        at: new Date().toISOString(),
        page: location.pathname.split("/").pop() || "index.html",
        type: type,
        message: String(message || "不明なエラー").slice(0, 500),
        source: String(source || "").split("/").pop(),
        line: Number(line) || 0
      });
      localStorage.setItem(ERROR_KEY, JSON.stringify(errors.slice(-20)));
    }catch(e){
      console.warn("client error log failed", e);
    }
  }
  window.addEventListener("error", function(event){
    recordError("error", event.message, event.filename, event.lineno);
  });
  window.addEventListener("unhandledrejection", function(event){
    var reason = event.reason;
    recordError("promise", reason && reason.message ? reason.message : reason, "", 0);
  });
})();


/* ===== 雨・WBGT 自動アラート（ホーム／カレンダー／出欠確認 共通） ===== */
(function(){
  var targetPages=["","index.html","calendar.html","attendance.html"];
  var pageName=location.pathname.split("/").pop();
  if(targetPages.indexOf(pageName)===-1)return;
  var ALERT_KEY="smc_alert_settings_v1";
  var DEFAULT_SCHEDULES=[
    {day:3,start:"19:00",end:"21:00",indoor:true},
    {day:4,start:"18:30",end:"20:30",indoor:true},
    {day:6,start:"08:00",end:"10:30",indoor:false},
    {day:0,start:"08:00",end:"10:30",indoor:false}
  ];
  var DEFAULT_CFG={
    schedules:DEFAULT_SCHEDULES,alertStartHour:12,alertDaysBefore:1,rainThreshold:30,heatThreshold:25,
    rainVenue:"北小体育館",
    rainOdd:"奇数月：6〜4年 8:00〜10:00 ／ 3年〜年長 10:00〜12:00",
    rainEven:"偶数月：3年〜年長 8:00〜10:00 ／ 6〜4年 10:00〜12:00"
  };
  var cfg=DEFAULT_CFG,checkTimer=null,checkSeq=0;
  try{var saved=localStorage.getItem(ALERT_KEY);if(saved)cfg=JSON.parse(saved);}
  catch(e){console.warn("auto alert local settings error:",e);}

  function calcWbgt(temp,humidity){return 0.735*temp+0.0374*humidity+0.00292*temp*humidity-4.064;}
  function findNextOutdoorPractice(){
    var now=new Date(),schedules=cfg.schedules||DEFAULT_SCHEDULES;
    var startHour=cfg.alertStartHour!==undefined?Number(cfg.alertStartHour):0;
    var daysBefore=cfg.alertDaysBefore!==undefined?Number(cfg.alertDaysBefore):1;
    if(!isFinite(daysBefore)||daysBefore<0)daysBefore=1;
    for(var offset=0;offset<4;offset++){
      var date=new Date(now);date.setDate(date.getDate()+offset);
      for(var i=0;i<schedules.length;i++){
        var schedule=schedules[i];
        if(schedule.indoor)continue; // 屋外練習のみ対象（屋内はスキップして先の屋外を探す）
        if(Number(schedule.day)!==date.getDay())continue;
        // 当日練習が終了済みならスキップ
        if(offset===0){
          var endParts=String(schedule.end||"23:59").split(":");
          var endTime=new Date(date);endTime.setHours(Number(endParts[0]),Number(endParts[1]||0),0,0);
          if(now>endTime)continue;
        }
        // 表示開始 = 練習日の daysBefore 日前の startHour 時から
        var alertTime=new Date(date);
        alertTime.setDate(alertTime.getDate()-daysBefore);
        alertTime.setHours(startHour,0,0,0);
        if(now>=alertTime)return{schedule:schedule,date:date,offset:offset};
      }
    }
    return null;
  }
  function scheduleCheck(){
    if(document.readyState==="loading")return;
    clearTimeout(checkTimer);
    checkTimer=setTimeout(checkAlerts,0);
  }
  function checkAlerts(){
    var runId=++checkSeq;
    var rainEl=document.getElementById("auto-rain"),heatEl=document.getElementById("auto-heat");
    if(!rainEl||!heatEl)return;
    rainEl.classList.remove("show");heatEl.classList.remove("show");
    var practice=findNextOutdoorPractice();
    if(!practice||practice.schedule.indoor)return;

    function fetchForecast(lat,lon,sourceName){
      var url="https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon
        +"&hourly=temperature_2m,relative_humidity_2m,weather_code,precipitation_probability"
        +"&timezone=Asia/Tokyo&forecast_days=4";
      fetch(url,{cache:"no-store"}).then(function(response){
        if(!response.ok)throw new Error("Open-Meteo HTTP "+response.status);
        return response.json();
      }).then(function(data){
        if(runId!==checkSeq)return;
        var hourly=data&&data.hourly;
        if(!hourly||!Array.isArray(hourly.time)||!Array.isArray(hourly.weather_code))throw new Error("気象データの形式が不正です");
        var date=practice.date;
        var dateText=date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
        var startParts=String(practice.schedule.start||"00:00").split(":");
        var endParts=String(practice.schedule.end||"23:59").split(":");
        var startMins=Number(startParts[0])*60+Number(startParts[1]||0);
        var endMins=Number(endParts[0])*60+Number(endParts[1]||0);
        var rainThreshold=Number(cfg.rainThreshold),heatThreshold=Number(cfg.heatThreshold);
        if(!isFinite(rainThreshold))rainThreshold=30;
        if(!isFinite(heatThreshold))heatThreshold=25;
        var rainMax=0,wbgtMax=-Infinity,hasRain=false,checkedHours=0;
        hourly.time.forEach(function(time,index){
          if(!String(time).startsWith(dateText))return;
          var hour=Number(String(time).slice(11,13)),minute=Number(String(time).slice(14,16))||0;
          var mins=hour*60+minute;
          if(mins<startMins||mins>endMins)return;
          var temp=Number(hourly.temperature_2m[index]),humidity=Number(hourly.relative_humidity_2m[index]);
          if(!isFinite(temp)||!isFinite(humidity))return;
          checkedHours++;
          var probability=Number(hourly.precipitation_probability[index])||0;
          var weatherCode=Number(hourly.weather_code[index])||0;
          var predictedWbgt=calcWbgt(temp,humidity);
          if(probability>=rainThreshold||weatherCode>=51)hasRain=true;
          if(probability>rainMax)rainMax=probability;
          if(predictedWbgt>wbgtMax)wbgtMax=predictedWbgt;
        });
        if(!checkedHours)throw new Error("練習時間帯の予報がありません");
        var month=date.getMonth()+1,isOddMonth=month%2===1;
        var dayName=["日","月","火","水","木","金","土"][date.getDay()];
        var dayLabel=practice.offset===0?"本日":practice.offset===1?"明日（"+dayName+"）":month+"/"+date.getDate()+"（"+dayName+"）";
        var timeLabel=(practice.schedule.start||"")+"〜"+(practice.schedule.end||"");
        var sourceLabel="（"+sourceName+"の予報）";
        if(hasRain){
          var venue=cfg.rainVenue||"北小体育館";
          var rainSchedule=isOddMonth?(cfg.rainOdd||""):(cfg.rainEven||"");
          document.getElementById("auto-rain-body").textContent=
            dayLabel+" "+timeLabel+"の屋外練習に雨の予報があります。"+sourceLabel+"\n"
            +"・最大降水確率："+rainMax+"%（設定基準 "+rainThreshold+"%）\n"
            +"・室内用シューズをご用意ください\n"
            +"・雨天時の会場："+venue+(rainSchedule?"\n・"+rainSchedule:"");
          rainEl.classList.add("show");
        }
        if(wbgtMax>=heatThreshold){
          var level=wbgtMax>=31?"危険":wbgtMax>=28?"厳重警戒":"警戒";
          document.getElementById("auto-heat-body").textContent=
            dayLabel+" "+timeLabel+"の屋外練習は、予想WBGT "+wbgtMax.toFixed(1)+"℃（"+level+"）です。"+sourceLabel+"\n"
            +"・帽子を必ず着用してください\n"
            +"・水筒は2本（水＋スポーツドリンク）持参してください\n"
            +"・保冷剤・タオルをご用意ください"+(wbgtMax>=31?"\n⛔ WBGT31℃以上は活動中止基準です":"");
          heatEl.classList.add("show");
        }
      }).catch(function(error){console.error("auto alert fetch error:",error);});
    }
    function useYoshimi(){if(runId===checkSeq)fetchForecast(36.0,139.5,"吉見町");}
    if(!navigator.geolocation){useYoshimi();return;}
    navigator.geolocation.getCurrentPosition(function(position){
      if(runId===checkSeq)fetchForecast(position.coords.latitude,position.coords.longitude,"現在地");
    },function(error){
      console.warn("auto alert geolocation fallback:",error&&error.message?error.message:error);
      useYoshimi();
    },{timeout:5000,enableHighAccuracy:false,maximumAge:1800000});
  }
  window.copyAlert=function(type){
    var body=document.getElementById("auto-"+type+"-body");
    if(!body||!body.textContent.trim()){alert("現在表示中のアラートはありません");return;}
    var heading=type==="rain"?"【自動アラート・雨の予報】":"【自動アラート・熱中症注意】";
    var text=heading+"\n"+body.textContent;
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){alert("コピーしました！LINEに貼り付けてください。");})
      .catch(function(){alert("コピーできませんでした。");});
    }else{alert("このブラウザではコピー機能を利用できません。");}
  };
  if(typeof dbListen==="function"){
    dbListen("alert_settings",function(value){
      if(value&&value.schedules)cfg=value;
      else{try{var local=localStorage.getItem(ALERT_KEY);if(local)cfg=JSON.parse(local);}
      catch(e){console.warn("auto alert settings error:",e);}}
      scheduleCheck();
    },ALERT_KEY,null);
  }
  window.addEventListener("DOMContentLoaded",scheduleCheck);
})();
