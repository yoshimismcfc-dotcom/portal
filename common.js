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
        <span class="game-adjust-legend-item"><span class="status-btn s-sent">要項送付済</span><span class="game-adjust-legend-label">参加確定・送付済み</span></span>
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
        body[data-theme="light"].game-adjust-enhanced .adj-table .status-btn.s-sent{background:#deecff!important;color:#135b9f!important;border-color:#4d8fcf!important}
        body[data-theme="light"].game-adjust-enhanced .adj-table .status-btn.s-ng{background:#ffe0e7!important;color:#a01339!important;border-color:#cf315c!important}
        body[data-theme="light"].game-adjust-enhanced .adj-table .status-btn.s-kakun{background:#fff1bd!important;color:#775800!important;border-color:#b88c00!important}
        body[data-theme="light"].game-adjust-enhanced .adj-table .status-btn.s-none{background:#e5edf5!important;color:#31536c!important;border-color:#789bb1!important}
        .game-adjust-date-nav{display:none}
        .ga-mobile-summary{display:none}
        .ga-mobile-summary-note[hidden]{display:none!important}
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
          body.game-adjust-enhanced .legend .game-adjust-legend-intro{grid-column:1/-1}
          body.game-adjust-enhanced .legend .game-adjust-legend-item{grid-template-columns:minmax(0,1fr)!important;gap:4px!important;min-width:0!important}
          body.game-adjust-enhanced .legend .game-adjust-legend-label{text-align:center!important;font-size:.7rem!important;line-height:1.35!important;overflow-wrap:anywhere}
          .game-adjust-date-nav{display:grid;grid-template-columns:46px minmax(0,1fr) 46px;gap:9px;align-items:center;margin:12px 0;padding:11px;border:2px solid rgba(35,190,235,.72);border-radius:16px;background:linear-gradient(135deg,rgba(14,118,170,.2),rgba(25,180,220,.08));box-shadow:0 6px 20px rgba(0,0,0,.2)}
          .game-adjust-date-controls{display:grid;gap:9px;min-width:0}
          .game-adjust-date-nav label{display:block;font-size:.78rem;font-weight:900;color:#73dcff;letter-spacing:.02em}
          .game-adjust-category-label{padding-top:8px;border-top:1px solid rgba(115,220,255,.32)}
          body[data-theme="light"].game-adjust-enhanced .game-adjust-date-nav{background:linear-gradient(135deg,#d7f3ff,#f7fcff);border-color:#1689b4;box-shadow:0 6px 18px rgba(17,91,126,.16)}
          body[data-theme="light"].game-adjust-enhanced .game-adjust-date-nav label{color:#075d84}
          body[data-theme="light"].game-adjust-enhanced .game-adjust-category-label{border-top-color:rgba(7,93,132,.28)}
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
          body.game-adjust-enhanced .adj-table .date-note{display:none!important}
          body.game-adjust-enhanced .adj-table .ga-mobile-summary{display:grid;gap:4px;margin-top:8px;padding-top:7px;border-top:1px solid rgba(106,172,204,.35);font-size:.68rem;font-weight:900;color:#d8efff}
          body[data-theme="light"].game-adjust-enhanced .adj-table .ga-mobile-summary{color:#173d5a;border-top-color:#8ba9bd}
          body.game-adjust-enhanced .adj-table .ga-mobile-summary strong{color:#00e889}
          body[data-theme="light"].game-adjust-enhanced .adj-table .ga-mobile-summary strong{color:#08743d}
          body.game-adjust-enhanced .desktop-scroll-help{font-size:.68rem!important}
        }
      `;
      document.head.appendChild(style);
    }
  
    const ACTIVE_DATE_KEY = "smc_game_adjust_active_date_v1";
    let activeDateIndex = 1;
    let activeDateId = "";
    try { activeDateId = sessionStorage.getItem(ACTIVE_DATE_KEY) || ""; } catch (error) {}
    let syncing = false;
    let pendingTeamSort = true;

    function rememberActiveDate(dateId) {
      activeDateId = String(dateId || "");
      try {
        if (activeDateId) sessionStorage.setItem(ACTIVE_DATE_KEY, activeDateId);
        else sessionStorage.removeItem(ACTIVE_DATE_KEY);
      } catch (error) {}
    }
    const nav = document.createElement("div");
    nav.className = "game-adjust-date-nav";
    nav.setAttribute("aria-label", "表示する日程の切り替えとカテゴリー絞り込み");
    nav.innerHTML = '<button type="button" data-move="-1" aria-label="前の日程">‹</button><div class="game-adjust-date-controls"><label>📅 表示する日程<select class="game-adjust-date-select" aria-label="表示する日程"></select></label><label class="game-adjust-category-label">🔎 カテゴリーで絞り込み<select class="game-adjust-category-filter" aria-label="カテゴリーで絞り込み"></select></label></div><button type="button" data-move="1" aria-label="次の日程">›</button>';
    wrapper.before(nav);
    const select = nav.querySelector(".game-adjust-date-select");
    const categoryFilter = nav.querySelector(".game-adjust-category-filter");
  
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
  
    function categoryKey(label) {
      const normalized = String(label || "").normalize("NFKC").trim();
      const underMatch = normalized.match(/U\s*[-ー]?\s*(\d{1,2})/i);
      if (underMatch) return `U${Number(underMatch[1])}`;
      return normalized.split(/[／/・,、\s]/)[0] || "未設定";
    }
  
    function dateSortValue(dateIso, label) {
      const isoMatch = String(dateIso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const normalized = String(label || "").normalize("NFKC");
      const slashMatch = normalized.match(/(?:(\d{4})\s*[\/.\-]\s*)?(\d{1,2})\s*[\/.\-]\s*(\d{1,2})/);
      const japaneseMatch = normalized.match(/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
      const match = isoMatch || slashMatch || japaneseMatch;
      if (!match) return Number.MAX_SAFE_INTEGER;
      const hasYear = Boolean(match[1]);
      const year = hasYear ? Number(match[1]) : 0;
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (month < 1 || month > 12 || day < 1 || day > 31) return Number.MAX_SAFE_INTEGER;
      // 年をまたいでも、各年度を4月→翌年3月の順で並べる。
      const fiscalYear = hasYear ? (month >= 4 ? year : year - 1) : 0;
      const fiscalMonthIndex = month >= 4 ? month - 4 : month + 8;
      return fiscalYear * 10000 + fiscalMonthIndex * 100 + day;
    }

    function optionDateLabel(entry) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.dateIso || "")) return entry.dateLabel;
      const parts = entry.dateIso.split("-");
      const suffix = entry.dateLabel.replace(/^\d{1,2}\s*\/\s*\d{1,2}/, "").trim();
      return parts[0] + "/" + Number(parts[1]) + "/" + Number(parts[2]) + (suffix ? " " + suffix : "");
    }

    function categorySortValue(value) {
      const match = String(value).match(/^U(\d+)$/);
      return match ? Number(match[1]) : 1000;
    }
  
    const TEAM_NAME_READINGS = new Map([
      ["田間宮", "たまみや"],
      ["ネクサス", "ねくさす"],
      ["鴻巣ドルフィンズ", "こうのすどるふぃんず"],
      ["熊谷東", "くまがやひがし"],
      ["川里", "かわさと"],
      ["滑川", "なめがわ"],
      ["川越笠幡", "かわごえかさはた"],
      ["川越岡田", "かわごえおかだ"],
      ["川越イーグルF", "かわごえいーぐるえふ"],
      ["熊谷リリーズ", "くまがやりりーず"],
      ["熊谷リーズ", "くまがやりーず"],
      ["唐子", "からこ"],
      ["川越芳野", "かわごえよしの"],
      ["本庄ホッパーズ", "ほんじょうほっぱーず"],
      ["川島", "かわじま"],
      ["東松山南", "ひがしまつやまみなみ"],
      ["宮原", "みやはら"],
      ["羽生SSS", "はにゅうえすえすえす"]
    ]);

    function teamNameForSort(row) {
      const cell = row?.children?.[0];
      if (!cell) return "";
      const copy = cell.cloneNode(true);
      copy.querySelectorAll("button").forEach((button) => button.remove());
      return copy.textContent.replace(/\s+/g, " ").trim();
    }

    function teamReadingForSort(row) {
      const name = teamNameForSort(row).normalize("NFKC");
      const compactName = name.replace(/[\s　]+/g, "");
      return TEAM_NAME_READINGS.get(compactName) || compactName;
    }

    function sortTeamRowsForActiveDate() {
      const tbody = table.tBodies[0];
      if (!tbody) return false;
      const rows = Array.from(tbody.rows).filter((row) => row.querySelector("button.status-btn"));
      if (rows.length < 2) return rows.length === 1;
      const statusOrder = { "要項送付済": 0, "OK": 1, "確認中": 2, "－": 3, "NG": 4 };
      const nameCollator = new Intl.Collator("ja", { numeric: true, sensitivity: "base", ignorePunctuation: true });
      const sorted = rows.slice().sort((rowA, rowB) => {
        const statusA = rowA.children[activeDateIndex]?.querySelector("button.status-btn")?.textContent.trim() || "－";
        const statusB = rowB.children[activeDateIndex]?.querySelector("button.status-btn")?.textContent.trim() || "－";
        const statusDifference = (statusOrder[statusA] ?? 3) - (statusOrder[statusB] ?? 3);
        if (statusDifference) return statusDifference;
        return nameCollator.compare(teamReadingForSort(rowA), teamReadingForSort(rowB));
      });
      if (rows.every((row, index) => row === sorted[index])) return true;
      const anchorRow = rows[rows.length - 1].nextSibling;
      sorted.forEach((row) => tbody.insertBefore(row, anchorRow));
      return true;
    }

    function syncDateColumns() {
      if (syncing) return;
      syncing = true;
      const headerCells = Array.from(table.querySelectorAll("thead tr:first-child > th"));
      const categoryCells = Array.from(table.querySelectorAll("thead tr:nth-child(2) > th"));
      const dateEntries = headerCells.slice(1, -1).map((cell, index) => {
        const categoryLabel = cleanCategoryLabel(categoryCells[index + 1]);
        return {
          columnIndex: index + 1,
          dateId: cell.dataset.dateId || cell.id.replace(/^hdr-/, "") || String(index + 1),
          dateIso: cell.dataset.dateIso || "",
          dateLabel: cleanHeaderLabel(cell),
          categoryLabel,
          category: categoryKey(categoryLabel)
        };
      });
  
      if (!dateEntries.length) {
        const ready = table.dataset.dataReady === "true";
        select.innerHTML = ready ? '<option>日程なし</option>' : '<option>データ更新中…</option>';
        categoryFilter.innerHTML = ready ? '<option>カテゴリーなし</option>' : '<option>更新待ち</option>';
        select.disabled = true;
        categoryFilter.disabled = true;
        syncing = false;
        return;
      }
  
      const previousCategory = categoryFilter.value || "all";
      const categories = [...new Set(dateEntries.map((entry) => entry.category))]
        .sort((a, b) => categorySortValue(a) - categorySortValue(b) || a.localeCompare(b, "ja", { numeric: true }));
      const allOption = document.createElement("option");
      allOption.value = "all";
      allOption.textContent = "すべてのカテゴリー";
      const categoryOptions = categories.map((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        return option;
      });
      categoryFilter.replaceChildren(allOption, ...categoryOptions);
      categoryFilter.value = categories.includes(previousCategory) ? previousCategory : "all";
  
      const visibleEntries = dateEntries
        .filter((entry) => categoryFilter.value === "all" || entry.category === categoryFilter.value)
        .sort((a, b) =>
          dateSortValue(a.dateIso, a.dateLabel) - dateSortValue(b.dateIso, b.dateLabel)
          || categorySortValue(a.category) - categorySortValue(b.category)
          || a.category.localeCompare(b.category, "ja", { numeric: true })
          || a.columnIndex - b.columnIndex
        );
  
      const selectedEntry = visibleEntries.find((entry) => entry.dateId === activeDateId);
      if (selectedEntry) {
        activeDateIndex = selectedEntry.columnIndex;
      } else {
        activeDateIndex = visibleEntries[0].columnIndex;
        rememberActiveDate(visibleEntries[0].dateId);
      }
  
      select.disabled = false;
      categoryFilter.disabled = false;
      select.replaceChildren(...visibleEntries.map((entry) => {
        const option = document.createElement("option");
        option.value = entry.dateId;
        option.textContent = `${optionDateLabel(entry)}｜${entry.categoryLabel}`;
        return option;
      }));
      select.value = activeDateId;
      if (pendingTeamSort && sortTeamRowsForActiveDate()) pendingTeamSort = false;
  
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
          summary.innerHTML = '<span>参加チーム数：<strong data-summary="count"></strong></span><span>残りチーム数：<strong data-summary="remaining"></strong></span><span class="ga-mobile-summary-note" data-summary-row="note" hidden>📝 備考：<strong data-summary="note"></strong></span>';
          categoryCell.appendChild(summary);
        }
        const countCell = table.querySelector(".tr-count")?.children[activeDateIndex];
        const remainingCell = table.querySelector(".tr-nokori")?.children[activeDateIndex];
        const noteCell = table.querySelector(".tr-biko")?.children[activeDateIndex];
        const countValue = countCell?.textContent.trim() || "0";
        const remainingValue = remainingCell?.textContent.trim() || "0";
        const noteValue = noteCell?.querySelector(".biko-input")?.value.trim() || "";
        const countOutput = summary.querySelector('[data-summary="count"]');
        const remainingOutput = summary.querySelector('[data-summary="remaining"]');
        const noteOutput = summary.querySelector('[data-summary="note"]');
        const noteRow = summary.querySelector('[data-summary-row="note"]');
        if (countOutput.textContent !== countValue) countOutput.textContent = countValue;
        if (remainingOutput.textContent !== remainingValue) remainingOutput.textContent = remainingValue;
        if (noteOutput.textContent !== noteValue) noteOutput.textContent = noteValue;
        noteRow.hidden = !noteValue;
      }
      syncing = false;
    }
  
    select.addEventListener("change", () => {
      pendingTeamSort = true;
      rememberActiveDate(select.value);
      syncDateColumns();
    });
    categoryFilter.addEventListener("change", () => {
      pendingTeamSort = true;
      const selectedCategory = categoryFilter.value;
      const headerCells = Array.from(table.querySelectorAll("thead tr:first-child > th"));
      const categoryCells = Array.from(table.querySelectorAll("thead tr:nth-child(2) > th"));
      const firstMatching = headerCells.slice(1, -1)
        .map((cell, index) => ({
          columnIndex: index + 1,
          dateId: cell.dataset.dateId || cell.id.replace(/^hdr-/, "") || String(index + 1),
          dateIso: cell.dataset.dateIso || "",
          dateLabel: cleanHeaderLabel(cell),
          category: categoryKey(cleanCategoryLabel(categoryCells[index + 1]))
        }))
        .filter((entry) => selectedCategory === "all" || entry.category === selectedCategory)
        .sort((a, b) => dateSortValue(a.dateIso, a.dateLabel) - dateSortValue(b.dateIso, b.dateLabel) || a.columnIndex - b.columnIndex)[0];
      if (firstMatching) {
        activeDateIndex = firstMatching.columnIndex;
        rememberActiveDate(firstMatching.dateId);
      }
      syncDateColumns();
    });
    nav.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        pendingTeamSort = true;
        const dateIds = Array.from(select.options).map((option) => option.value).filter(Boolean);
        if (!dateIds.length || select.disabled) return;
        const currentPosition = Math.max(0, dateIds.indexOf(activeDateId));
        const nextPosition = (currentPosition + Number(button.dataset.move) + dateIds.length) % dateIds.length;
        rememberActiveDate(dateIds[nextPosition]);
        syncDateColumns();
      });
    });
    new MutationObserver(() => window.requestAnimationFrame(syncDateColumns))
      .observe(table, { childList: true, subtree: true });
    document.addEventListener("smc:game-adjust-data-rendered", () => {
      pendingTeamSort = true;
      window.requestAnimationFrame(syncDateColumns);
    });
    table.addEventListener("input", (event) => {
      if (event.target.classList.contains("biko-input")) window.requestAnimationFrame(syncDateColumns);
    });
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
        body.tournament-print-enhanced #taisen-preview .ceremony-opening{background:#e7f5ff;color:#075985;border-color:#38a7d7}
        body.tournament-print-enhanced #taisen-preview .ceremony-closing{background:#fde3d4;color:#8a3100;border-color:#e67838}
        body.tournament-print-enhanced #taisen-preview .st .td-score,body.tournament-print-enhanced #taisen-preview .rct .td-score{background:#fff8d8}
        body.tournament-print-enhanced #taisen-preview .rt .rank-th{background:#285943;color:#fff;border-color:#3e7560}
        body.tournament-print-enhanced #taisen-preview .rct .round-th-h{background:#344054;color:#fff}
        body.tournament-print-enhanced #taisen-preview .rct .round-th-t{background:#526174;color:#fff}
        @media print{
          body[data-print-target="tournament-guidelines"] #youkou-preview{display:block!important;overflow:visible!important;margin:0!important}
          body[data-print-target="tournament-guidelines"] #youkou-preview > *{min-width:0!important}
          body[data-print-target="tournament-guidelines"] .req-sheet{width:100%!important;max-width:none!important;padding:0!important;margin:0!important;border:0!important;box-shadow:none!important;font-size:8.2pt!important;line-height:1.28!important;overflow:visible!important}
          body[data-print-target="tournament-guidelines"] .req-title{font-size:14pt!important;margin-bottom:2.5mm!important;padding-bottom:2mm!important}
          body[data-print-target="tournament-guidelines"] .req-info{margin-bottom:2mm!important}
          body[data-print-target="tournament-guidelines"] .req-info th,body[data-print-target="tournament-guidelines"] .req-info td{padding:1.1mm 2mm!important;font-size:8pt!important}
          body[data-print-target="tournament-guidelines"] .req-num{font-size:8.6pt!important;margin:1.3mm 0 .3mm!important;line-height:1.2!important}
          body[data-print-target="tournament-guidelines"] .req-num::before{height:3mm!important}
          body[data-print-target="tournament-guidelines"] .req-li{font-size:8pt!important;line-height:1.38!important;margin-top:0!important;margin-bottom:0!important;padding-left:1.3em!important}
          body[data-print-target="tournament-guidelines"] .req-li li{margin-bottom:0!important}
          body[data-print-target="tournament-guidelines"] .req-contact{padding:1.5mm 2mm!important;margin-top:2mm!important;font-size:7.8pt!important}
          body[data-print-target="tournament-schedule"] #taisen-preview{display:block!important;overflow:visible!important;margin:0!important}
          body[data-print-target="tournament-schedule"] #taisen-preview > *{min-width:0!important}
          body[data-print-target="tournament-schedule"] .tai-sheet{width:111.12%!important;max-width:none!important;padding:0!important;margin:0!important;border:0!important;box-shadow:none!important;overflow:visible!important;font-size:7.8pt!important;line-height:1.18!important;zoom:.9}
          body[data-print-target="tournament-schedule"] .tai-title{font-size:16pt!important;color:#173b66!important;border-bottom:2.5pt solid #ea6b24!important;padding-bottom:4mm!important;margin-bottom:2mm!important}
          body[data-print-target="tournament-schedule"] .tai-sub{font-size:9.5pt!important;color:#334155!important;margin-bottom:3mm!important}
          body[data-print-target="tournament-schedule"] .courts-row,body[data-print-target="tournament-schedule"] .blocks-row{gap:5mm!important;grid-template-columns:1fr 1fr!important}
          body[data-print-target="tournament-schedule"] .block-hd{display:block!important;width:auto!important;margin:1.5mm 0 .8mm!important;padding:1mm 2mm!important;border-radius:1mm!important;background:#173b66!important;color:#fff!important;font-size:8pt!important;break-after:avoid-page;page-break-after:avoid}
          body[data-print-target="tournament-schedule"] table{width:100%!important;margin-bottom:1.5mm!important;border-collapse:collapse!important}
          body[data-print-target="tournament-schedule"] thead{display:table-header-group}
          body[data-print-target="tournament-schedule"] tr{break-inside:avoid-page;page-break-inside:avoid}
          body[data-print-target="tournament-schedule"] .st .sched-th{padding:1.3mm 1mm!important;background:#173b66!important;color:#fff!important;border:1px solid #355a82!important;font-size:7.5pt!important}
          body[data-print-target="tournament-schedule"] .st td{padding:1mm .8mm!important;border:1px solid #667085!important;background:#fff!important;color:#111827!important;font-size:7.4pt!important}
          body[data-print-target="tournament-schedule"] .st .tr-alt-bg td{background:#eef3f8!important}
          body[data-print-target="tournament-schedule"] .st .td-score{background:#fff3b0!important}
          body[data-print-target="tournament-schedule"] .st .td-vs{background:#e5e7eb!important;color:#475569!important}
          body[data-print-target="tournament-schedule"] .st .tr-break-td{background:#fff0c7!important;color:#5d3d00!important;border:2px solid #c88a08!important;font-size:9pt!important;padding:2mm!important}
          body[data-print-target="tournament-schedule"] .st .tr-closing-td{background:#fde3d4!important;color:#7c2d00!important;border:2px solid #dc6b2f!important;font-size:9pt!important;padding:2mm!important}
          body[data-print-target="tournament-schedule"] .ceremony-banner{margin:1.5mm 0!important;padding:2mm!important;font-size:9pt!important;break-inside:avoid-page;page-break-inside:avoid}
          body[data-print-target="tournament-schedule"] .ceremony-opening{background:#e7f5ff!important;color:#075985!important;border-color:#268bb9!important}
          body[data-print-target="tournament-schedule"] .ceremony-closing{background:#fde3d4!important;color:#7c2d00!important;border-color:#dc6b2f!important}
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
      const closingTime = minutesToTime(finalsTable ? finalsStart + gameMinutes * 2 : cursor);
      sheet.querySelectorAll(".tr-closing-td").forEach((cell) => {
        cell.textContent = cell.textContent.replace(/\d{1,2}:\d{2}(?=～)/, closingTime);
      });
      if (!document.getElementById("closing-start")?.value) {
        sheet.querySelectorAll(".ceremony-closing .ceremony-time").forEach((time) => {
          const duration = Math.max(1, Number(time.dataset.duration) || Number(document.getElementById("closing-min")?.value) || 20);
          time.textContent = `${closingTime}〜${addMinutes(closingTime, duration)}（${duration}分）・自動`;
        });
      }
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
    const matchPicker = document.getElementById("calendar-match-dialog");
    const isCalendarPage = Boolean(calendarFrame && calendarWrap);
    if ((!isCalendarPage && !matchPicker) || (isCalendarPage && document.getElementById("calendar-upcoming-agenda"))) return;

    const PUBLIC_CALENDAR_KEY = ["AIzaSyDRH2RymQBOFCcXIDDjJc", "EbBdyuVmfXLnQ"].join("");
    const CACHE_KEY = "smc-calendar-upcoming-v8";
    const UPCOMING_DAYS = 90;
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
    const HOLIDAYS = { id: "ja.japanese#holiday@group.v.calendar.google.com", color: "#586575", label: "祝日" };
    const calendarDateFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", dateStyle: "short" });

    function eventDate(value) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : calendarDateFormat.format(date);
    }

    function detailHref(date, event) {
      const query = new URLSearchParams({ date });
      if (event?.sourceId) query.set("event", "calendar_" + encodeURIComponent(event.sourceId));
      return "calendar.html?" + query;
    }

    function externalDetailLink(text, href) {
      const link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "calendar-detail-link";
      link.textContent = text;
      return link;
    }

    function placeLink(place) {
      const href = new URL("https://www.google.com/maps/search/");
      href.search = new URLSearchParams({ api: "1", query: place.trim() });
      return externalDetailLink(place, href);
    }

    if (matchPicker && !isCalendarPage) {
      matchPicker.dataset.calendarReady = "true";
      matchPicker.addEventListener("smc-calendar-request", async ({detail}) => {
        const start = new Date();
        const today = detail?.from || eventDate(start);
        const from = new Date(today + "T00:00:00+09:00");
        const end = new Date(detail?.through ? detail.through + "T00:00:00+09:00" : start);
        // Google Calendar's upper bound is exclusive. Include the full last day in Japan.
        end.setUTCDate(end.getUTCDate() + (detail?.through ? 1 : UPCOMING_DAYS));
        const groups = CALENDARS.filter((calendar) => calendar.label === "全体" || /^U(?:[7-9]|1[0-2])$/.test(calendar.label));
        const results = await Promise.allSettled(groups.map((calendar) =>
          fetchCalendar(calendar, from.toISOString(), end.toISOString(), 250, true, true)
        ));
        const events = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
        const failed = results.flatMap((result, index) =>
          result.status === "rejected" ? [groups[index].label] : []
        );
        matchPicker.dispatchEvent(new CustomEvent("smc-calendar-result", { detail: { events, failed } }));
      });
      return;
    }

    const selectedDayPanel = isCalendarPage ? document.getElementById("calendar-selected-day") : null;
    const params = new URLSearchParams(location.search);
    const selectedDate = params.get("date") || "";
    const selectedStart = new Date(selectedDate + "T00:00:00+09:00");
    const explicitDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) && eventDate(selectedStart) === selectedDate;
    const selectedDateFormat = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short"
    });
    if (isCalendarPage) {
      setupCalendarMonth(explicitDate ? selectedDate : eventDate(new Date()));
      if (selectedDayPanel) {
        if (explicitDate) renderSelectedDay(selectedDayPanel, selectedStart, params.get("event") || "");
        else prepareSelectedDay(selectedDayPanel, "今日の予定");
      }
    }

    function setupCalendarMonth(initialDate) {
      const panel = document.getElementById("calendar-month");
      if (!panel) return;
      const title = document.getElementById("calendar-month-title");
      const status = document.getElementById("calendar-month-status");
      const grid = document.getElementById("calendar-month-grid");
      const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
      const dayMs = 86400000;
      const [year, month] = initialDate.split("-").map(Number);
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      let request = 0;

      function paint(first, monthIndex, monthEvents) {
        const nodes = weekdays.map((day) => {
          const label = document.createElement("span");
          label.className = "calendar-weekday";
          label.textContent = day;
          return label;
        });
        const today = eventDate(new Date());
        const ranges = monthEvents.map((event) => {
          const start = eventDate(event.start);
          const endDate = new Date(event.allDay ? event.end + "T00:00:00+09:00" : event.end);
          const last = Number.isNaN(endDate.getTime()) ? start : eventDate(new Date(endDate.getTime() - 1));
          return { event, start, last: last > start ? last : start };
        });
        for (let index = 0; index < 42; index++) {
          const day = new Date(first + index * dayMs);
          const iso = day.toISOString().slice(0, 10);
          const cell = document.createElement("div");
          cell.className = "calendar-month-day";
          if (day.getUTCMonth() !== monthIndex) cell.classList.add("is-other-month");
          if (iso === today) cell.classList.add("is-today");
          const dateLink = document.createElement("a");
          dateLink.className = "calendar-month-date";
          dateLink.href = detailHref(iso);
          dateLink.textContent = String(day.getUTCDate());
          dateLink.setAttribute("aria-label", iso + "の予定");
          cell.append(dateLink);
          const entries = ranges.filter(({ start, last }) => start && start <= iso && last >= iso);
          for (const { event } of entries) {
            const link = document.createElement("a");
            link.className = "calendar-month-event";
            link.style.setProperty("--event-color", event.color);
            link.href = detailHref(iso, event);
            link.title = event.title;
            const name = document.createElement("span");
            name.className = "calendar-month-event-title";
            name.textContent = event.title;
            link.append(name);
            if (!event.allDay) {
              const time = document.createElement("span");
              time.className = "calendar-month-event-time";
              time.textContent = formatTime(event).split("〜")[0];
              link.append(time);
            }
            cell.append(link);
          }
          nodes.push(cell);
        }
        grid.replaceChildren(...nodes);
      }

      async function loadMonth() {
        const version = ++request;
        const index = monthStart.getUTCMonth();
        const first = monthStart.getTime() - monthStart.getUTCDay() * dayMs;
        title.textContent = monthStart.getUTCFullYear() + "年 " + (index + 1) + "月";
        status.textContent = "予定を読み込んでいます…";
        delete calendarWrap.dataset.monthFallback;
        paint(first, index, []);
        const jstOffset = 9 * 3600000;
        const results = await Promise.allSettled([...CALENDARS, HOLIDAYS].map((calendar) =>
          fetchCalendar(calendar, new Date(first - jstOffset).toISOString(),
            new Date(first + 42 * dayMs - jstOffset).toISOString(), 250, false, true)
        ));
        if (version !== request) return;
        if (results.slice(0, CALENDARS.length).every((result) => result.status === "rejected")) {
          calendarWrap.dataset.monthFallback = "";
          grid.replaceChildren();
          const end = new Date(Date.UTC(monthStart.getUTCFullYear(), index + 1, 1));
          const dateRange = monthStart.toISOString().slice(0, 10) + "/" + end.toISOString().slice(0, 10);
          if (typeof window.focusedCalendarSrc === "function") {
            const url = new URL(window.focusedCalendarSrc("month"));
            url.searchParams.set("dates", dateRange.replace(/-/g, ""));
            calendarWrap.dataset.monthFallback = url.href;
            if (calendarWrap.dataset.view === "month") calendarFrame.src = url;
          }
          status.textContent = "予定を読み込めなかったため、Google カレンダーを表示しています。";
          return;
        }
        status.textContent = results.some((result) => result.status === "rejected") ? "一部の予定を取得できませんでした。" : "";
        paint(first, index, results.flatMap((result) => result.status === "fulfilled" ? result.value : [])
          .sort((left, right) => left.start.localeCompare(right.start)));
      }

      document.getElementById("calendar-month-prev").addEventListener("click", () => {
        monthStart.setUTCMonth(monthStart.getUTCMonth() - 1);
        loadMonth();
      });
      document.getElementById("calendar-month-next").addEventListener("click", () => {
        monthStart.setUTCMonth(monthStart.getUTCMonth() + 1);
        loadMonth();
      });
      loadMonth();
    }

    function prepareSelectedDay(panel, label) {
      panel.querySelector("h2").textContent = label;
      panel.hidden = false;
    }

    function renderInitialDay(events, failedLabels = [], unavailable = false, today = eventDate(new Date())) {
      const panel = selectedDayPanel;
      if (!panel || explicitDate) return;
      const local = localCalendarEvents(failedLabels, events);
      const overview = window.SMCCalendarAttendance.initialCalendarDay(events.concat(local), today);
      const showToday = overview.todaysEvents.length > 0;
      const start = new Date((showToday || !overview.nextDate ? today : overview.nextDate) + "T00:00:00+09:00");
      const label = showToday || !overview.nextDate ? "今日の予定" : "次の試合・行事";
      prepareSelectedDay(panel, label + "（" + selectedDateFormat.format(start) + "）");
      panel.querySelector(".calendar-selected-next").replaceChildren();
      const status = panel.querySelector("[role=status]");
      if (unavailable) status.textContent = "予定を取得できませんでした。通信状態を確認し、もう一度お試しください。";
      else if (failedLabels.length) status.textContent = "一部のカレンダーを取得できませんでした。取得できた予定を表示しています。";
      else if (!showToday && !overview.nextDate) status.textContent = "今後" + UPCOMING_DAYS + "日以内に次の試合・行事は登録されていません。";
      else status.textContent = "";
      paintSelectedEvents(panel, showToday ? overview.todaysEvents : overview.nextEvents, "", false);
      setTodayNotice(overview.todaysEvents, unavailable || failedLabels.length > 0);

      if (overview.practiceOnly && overview.nextDate) {
        const next = document.createElement("a");
        next.href = detailHref(overview.nextDate);
        const first = overview.nextEvents[0];
        const more = overview.nextEvents.length - 1;
        const date = new Date(overview.nextDate + "T00:00:00+09:00");
        next.textContent = "次の試合・行事　" + selectedDateFormat.format(date) + "　" + first.title + (more ? " ほか" + more + "件" : "");
        panel.querySelector(".calendar-selected-next").append(next);
      }
    }

    function localCalendarEvents(failedLabels, events, date) {
      try {
        const local = JSON.parse(localStorage.getItem("yoshimi_smc_attendance_prototype_v1") || "{}");
        const knownIds = new Set(events.map((event) => event.sourceId && "calendar_" + encodeURIComponent(event.sourceId)));
        return (Array.isArray(local.events) ? local.events : []).filter((event) =>
          event?.id && event.date && (!date || event.date === date) && !event.hidden && !event.calendarInactive &&
          !knownIds.has(event.id) && (!event.id.startsWith("calendar_") || failedLabels.includes(event.category))
        ).map((event) => ({
          attendanceId: event.id, title: event.title, location: event.place, kind: event.kind,
          label: event.category || (event.kind === "match" ? "試合" : "練習"),
          descriptionTime: event.startTime, allDay: true, start: event.date
        }));
      } catch {
        return [];
      }
    }

    async function renderSelectedDay(panel, start, selectedId) {
      const heading = panel.querySelector("h2");
      const status = panel.querySelector("[role=status]");
      prepareSelectedDay(panel, selectedDateFormat.format(start) + "の予定");
      heading.focus({ preventScroll: true });
      panel.scrollIntoView({ block: "start", behavior: "instant" });
      const end = new Date(start.getTime() + 86400000);
      const results = await Promise.allSettled([...CALENDARS, HOLIDAYS].map((calendar) =>
        fetchCalendar(calendar, start.toISOString(), end.toISOString(), 250, true)
      ));
      const events = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      const failedLabels = CALENDARS.filter((_, index) => results[index].status === "rejected").map((calendar) => calendar.label);
      const matches = events.concat(localCalendarEvents(failedLabels, events, eventDate(start)));
      const warnings = [];
      if (results.some((result) => result.status === "rejected")) warnings.push("一部のカレンダーを取得できませんでした。");
      if (selectedId && !matches.some((event) => selectedId === attendanceEventId(event))) warnings.push("指定の試合が見つかりませんでした。");
      if (!matches.length) warnings.push("表示できる予定がありません。");
      status.textContent = warnings.join(" ");
      paintSelectedEvents(panel, matches, selectedId, true);
    }

    function attendanceEventId(event) {
      return event.attendanceId || (event.sourceId ? "calendar_" + encodeURIComponent(event.sourceId) : "");
    }

    function paintSelectedEvents(panel, events, selectedId, focus) {
      const list = panel.querySelector(".calendar-selected-events");
      const matches = events.slice().sort((a, b) =>
        Number(Boolean(selectedId) && attendanceEventId(b) === selectedId) -
        Number(Boolean(selectedId) && attendanceEventId(a) === selectedId) || a.start.localeCompare(b.start));
      const previousOpen = new Map(Array.from(list.children, (item) => [item.dataset.eventKey, item.open]));
      const openEvent = selectedId ? matches.find((event) => attendanceEventId(event) === selectedId)
        : matches.length === 1 ? matches[0] : null;
      let destination = null;
      const cards = [];
      for (const event of matches) {
        const details = document.createElement("details");
        details.dataset.eventKey = event.id || attendanceEventId(event);
        details.open = previousOpen.get(details.dataset.eventKey) ?? (openEvent === event);
        const summary = document.createElement("summary");
        summary.textContent = event.label + " · " + event.title;
        details.append(summary);
        if (details.open) destination = details;
        const timeFormat = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
        const time = event.allDay ? event.descriptionTime : [event.start, event.end]
          .filter((value) => value && !Number.isNaN(Date.parse(value))).map((value) => timeFormat.format(new Date(value))).join("〜");
        if (time) {
          const line = document.createElement("p");
          line.textContent = time;
          details.append(line);
        }
        const attendanceId = attendanceEventId(event);
        const attendanceKind = window.SMCCalendarAttendance?.upcomingKind(event);
        const date = eventDate(event.start);
        const eventName = event.title.normalize("NFKC");
        const teamMarathon = event.label === "全体" && /スポ(?:少|ーツ少年団)\s*(?:の\s*)?マラソン/.test(eventName);
        const meeting = /会議|総会|説明会|保護者会|審判講習/.test(eventName);
        if (attendanceId && date && event.label !== "祝日" && attendanceKind !== "cancelled" && !meeting &&
          (event.attendanceId || teamMarathon || attendanceKind === "practice" || attendanceKind === "highlight" ||
            /^U(?:[7-9]|1[0-2])$/.test(event.label))) {
          const button = document.createElement("button");
          button.className = "calendar-attendance-open";
          button.type = "button";
          const icon = document.createElement("span");
          icon.className = "calendar-attendance-open-icon";
          icon.setAttribute("aria-hidden", "true");
          icon.textContent = "☷";
          button.append(icon, "出欠一覧を見る");
          button.setAttribute("aria-haspopup", "dialog");
          button.onclick = () => {
            const dialog = document.getElementById("calendar-attendance-dialog");
            const frame = dialog.querySelector("iframe");
            const title = dialog.querySelector("#calendar-attendance-dialog-title");
            const dateLine = dialog.querySelector("#calendar-attendance-dialog-date");
            const query = new URLSearchParams({ "calendar-attendance": attendanceId, date });
            if (title && dateLine) {
              title.textContent = event.title + "の出欠一覧";
              dateLine.textContent = selectedDateFormat.format(new Date(date + "T00:00:00+09:00"));
              query.set("calendar-dialog", "1");
            }
            dialog.addEventListener("close", () => button.focus({ preventScroll: true }), { once: true });
            frame.src = "attendance-preview.html?" + query;
            dialog.showModal();
          };
          details.append(button);
        }
        if (event.location?.trim()) {
          const line = document.createElement("p");
          line.append(placeLink(event.location.trim()));
          details.append(line);
        }
        if (event.description) {
          const description = document.createElement("p");
          const parts = window.SMCCalendarAttendance?.descriptionLinks?.(event.description);
          for (const part of parts || [{text:event.description}]) {
            if (part.href) {
              description.append(externalDetailLink(part.text, part.href));
            } else {
              for (const line of part.text.split(/(?<=\n)/)) {
                const address = line.match(/^(\s*【(?:会場|住所|場所)】[ \t　]*)([^\n]+)(\n?)$/);
                if (address && address[2].trim()) {
                  description.append(document.createTextNode(address[1]), placeLink(address[2].trim()),
                    document.createTextNode(address[3]));
                } else {
                  description.append(document.createTextNode(line));
                }
              }
            }
          }
          details.append(description);
        }
        cards.push(details);
      }
      list.replaceChildren(...cards);
      if (destination && focus) {
        requestAnimationFrame(() => {
          const header = document.querySelector(".site-header");
          const headerHeight = header?.getBoundingClientRect().height || 0;
          destination.style.scrollMarginTop = Math.ceil(headerHeight + 8) + "px";
          destination.querySelector("summary").focus({ preventScroll: true });
          destination.scrollIntoView({ block: "start", behavior: "instant" });
        });
      }
    }

    if (!document.getElementById("calendar-upcoming-style")) {
      const style = document.createElement("style");
      style.id = "calendar-upcoming-style";
      style.textContent = `
        .calendar-upcoming{margin-top:24px}
        .calendar-upcoming-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}\n        .calendar-upcoming-actions{display:flex;align-items:center;gap:7px}\n        .calendar-upcoming-title{display:flex;align-items:center;gap:8px;margin:0;color:#78ddff;font-size:1.12rem;font-weight:950;letter-spacing:.02em}
        .calendar-upcoming-badge{padding:4px 9px;border:1px solid rgba(45,190,230,.45);border-radius:999px;background:rgba(45,190,230,.08);color:#a8eaff;font-size:.64rem;font-weight:900;white-space:nowrap}\n        .calendar-upcoming-refresh{min-height:34px;padding:5px 10px;border:1px solid rgba(45,190,230,.55);border-radius:999px;background:rgba(45,190,230,.12);color:#b9efff;font:inherit;font-size:.68rem;font-weight:900;cursor:pointer}\n        .calendar-upcoming-refresh:disabled{opacity:.5;cursor:wait}\n        .calendar-upcoming-list{display:grid;gap:9px}
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
        .calendar-attendance-gateway{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;margin-top:18px;padding:14px 16px;border:1px solid rgba(0,212,255,.45);border-radius:14px;background:linear-gradient(145deg,rgba(0,48,95,.78),rgba(10,35,72,.88));color:#fff;text-decoration:none}
        .calendar-attendance-gateway[hidden]{display:none}
        .calendar-attendance-gateway:hover,.calendar-attendance-gateway:focus-visible{border-color:#7be8ff;outline:none;box-shadow:0 0 0 3px rgba(0,212,255,.18)}
        .calendar-attendance-gateway-icon{font-size:1.45rem}
        .calendar-attendance-gateway-title{display:block;color:#8ce7ff;font-size:.9rem;font-weight:950;line-height:1.45}
        .calendar-attendance-gateway-help{display:block;margin-top:2px;color:#b8d9ec;font-size:.68rem;line-height:1.5}
        .calendar-attendance-gateway-arrow{color:#8ce7ff;font-size:.78rem;font-weight:950;white-space:nowrap}
        .calendar-attendance{margin-top:18px;padding:16px;border:1px solid rgba(0,212,255,.45);border-radius:16px;background:linear-gradient(145deg,rgba(0,48,95,.78),rgba(10,35,72,.88))}
        .calendar-attendance[hidden]{display:none}
        .calendar-attendance-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
        .calendar-attendance-title{margin:0;color:#8ce7ff;font-size:1rem;font-weight:950}
        .calendar-attendance-help{margin:3px 0 0;color:#b8d9ec;font-size:.68rem;line-height:1.55}
        .calendar-attendance-tools{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:end;gap:8px;margin:2px 0 8px}
        .calendar-attendance-category-label{display:grid;gap:4px;color:#b8d9ec;font-size:.68rem;font-weight:900}
        .calendar-attendance-category-label select{min-height:44px;width:100%;padding:8px 34px 8px 10px;border:1px solid rgba(94,139,188,.65);border-radius:10px;background:#08264d;color:#fff;font:inherit;font-size:.8rem;font-weight:800}
        .calendar-attendance-tool-button{min-height:44px;padding:8px 12px;border:1px solid rgba(0,212,255,.48);border-radius:10px;background:rgba(0,93,148,.3);color:#bdefff;font:inherit;font-size:.72rem;font-weight:900;cursor:pointer}
        .calendar-attendance-tool-button:disabled,.calendar-attendance-category-label select:disabled{opacity:.5;cursor:not-allowed}
        .calendar-attendance-selection-summary{margin:0 0 8px;color:#ffd36d;font-size:.72rem;font-weight:900}
        .calendar-attendance-list{display:grid;gap:8px}
        .calendar-attendance-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 10px;padding:11px 12px;border:1px solid rgba(94,139,188,.45);border-radius:12px;background:rgba(5,29,61,.72);cursor:pointer}
        .calendar-attendance-item.is-selected{border-color:rgba(0,212,255,.72);background:rgba(4,47,84,.9)}
        .calendar-attendance-check{grid-row:1/3;align-self:center;width:22px;height:22px;margin:0;accent-color:#00c86f;cursor:pointer}
        .calendar-attendance-name{display:flex;align-items:center;gap:7px;min-width:0;color:#fff;font-size:.84rem;font-weight:900;line-height:1.45;overflow-wrap:anywhere}
        .calendar-attendance-category{flex-shrink:0;padding:2px 7px;border:1px solid rgba(0,212,255,.45);border-radius:999px;color:#8ce7ff;font-size:.58rem;font-weight:900}
        .calendar-attendance-date{color:#ffd36d;font-size:.72rem;font-weight:900;white-space:nowrap}
        .calendar-attendance-url{grid-column:2/-1;color:#78ddff;font-size:.68rem;font-weight:700;overflow-wrap:anywhere;text-decoration:underline}
        .calendar-attendance-copy{width:100%;min-height:48px;margin-top:12px;border:1px solid #00c86f;border-radius:12px;background:linear-gradient(135deg,#00a94f,#00c86f);color:#fff;font:inherit;font-size:.86rem;font-weight:950;cursor:pointer;box-shadow:0 6px 18px rgba(0,150,78,.24)}
        .calendar-attendance-copy:focus-visible{outline:3px solid #fff;outline-offset:2px}
        .calendar-attendance-status{min-height:1.5em;margin:7px 0 0;color:#a8f5ca;font-size:.7rem;font-weight:800;text-align:center}
        body[data-theme="light"] .calendar-upcoming-title{color:#075d84}
        body[data-theme="light"] .calendar-upcoming-badge{border-color:#4b91aa;background:#e9f7fb;color:#075d84}\n        body[data-theme="light"] .calendar-upcoming-refresh{border-color:#147ca2;background:#e5f5fa;color:#075d84}\n        body[data-theme="light"] .calendar-event-card{border-color:#8fa9c5;background:linear-gradient(135deg,#f4f8ff,#e9f1fb);box-shadow:0 7px 18px rgba(31,64,92,.14);color:#102944}
        body[data-theme="light"] .calendar-event-card:hover,body[data-theme="light"] .calendar-event-card:focus-visible{border-color:#147ca2;box-shadow:0 9px 20px rgba(31,64,92,.2)}
        body[data-theme="light"] .calendar-event-date{border-right-color:#c7d6e5}
        body[data-theme="light"] .calendar-event-month{color:#246985}
        body[data-theme="light"] .calendar-event-day,body[data-theme="light"] .calendar-event-title{color:#102944}
        body[data-theme="light"] .calendar-event-dow{color:#385873}
        body[data-theme="light"] .calendar-event-meta{color:#4c647c}
        body[data-theme="light"] .calendar-event-arrow{color:#147ca2}
        body[data-theme="light"] .calendar-upcoming-state{border-color:#8fa9c5;background:#edf4fb;color:#36546d}
        body[data-theme="light"] .calendar-upcoming-retry{border-color:#147ca2;background:#e5f5fa;color:#075d84}
        body[data-theme="light"] .calendar-attendance-gateway{border-color:#2285a7;background:linear-gradient(145deg,#f3f9ff,#e7f3fb);color:#102944}
        body[data-theme="light"] .calendar-attendance-gateway-title,body[data-theme="light"] .calendar-attendance-gateway-arrow{color:#075d84}
        body[data-theme="light"] .calendar-attendance-gateway-help{color:#385873}
        body[data-theme="light"] .calendar-attendance{border-color:#2285a7;background:linear-gradient(145deg,#f3f9ff,#e7f3fb)}
        body[data-theme="light"] .calendar-attendance-title{color:#075d84}
        body[data-theme="light"] .calendar-attendance-help{color:#385873}
        body[data-theme="light"] .calendar-attendance-category-label{color:#385873}
        body[data-theme="light"] .calendar-attendance-category-label select{border-color:#8fa9c5;background:#fff;color:#102944}
        body[data-theme="light"] .calendar-attendance-tool-button{border-color:#3785a5;background:#e5f5fa;color:#075d84}
        body[data-theme="light"] .calendar-attendance-selection-summary{color:#8a5100}
        body[data-theme="light"] .calendar-attendance-item{border-color:#9cb4cb;background:#fff}
        body[data-theme="light"] .calendar-attendance-item.is-selected{border-color:#2285a7;background:#eefaff}
        body[data-theme="light"] .calendar-attendance-category{border-color:#3785a5;color:#075d84}
        body[data-theme="light"] .calendar-attendance-name{color:#102944}
        body[data-theme="light"] .calendar-attendance-date{color:#8a5100}
        body[data-theme="light"] .calendar-attendance-url{color:#075d84}
        body[data-theme="light"] .calendar-attendance-status{color:#08713f}
        @media(max-width:600px){
          .calendar-upcoming{margin-top:20px}
          .calendar-upcoming-title{font-size:1rem}
          .calendar-event-card{grid-template-columns:54px 4px minmax(0,1fr) 16px;gap:10px;min-height:90px;padding:10px 10px 10px 7px}
          .calendar-event-date{min-height:64px}.calendar-event-day{font-size:1.55rem}.calendar-event-title{font-size:.86rem}.calendar-event-meta{font-size:.66rem}
          .calendar-attendance-gateway{grid-template-columns:auto minmax(0,1fr);padding:13px 12px}.calendar-attendance-gateway-arrow{grid-column:2}
          .calendar-attendance{padding:14px 12px}.calendar-attendance-head{display:block}.calendar-attendance-tools{grid-template-columns:1fr 1fr}.calendar-attendance-category-label{grid-column:1/-1}.calendar-attendance-tool-button{width:100%}.calendar-attendance-item{grid-template-columns:auto minmax(0,1fr)}.calendar-attendance-check{grid-row:1/4}.calendar-attendance-date,.calendar-attendance-url{grid-column:2}
        }
      `;
      document.head.appendChild(style);
    }

    let section = null;
    if (isCalendarPage) {
      section = document.createElement("section");
      section.className = "calendar-upcoming";
      section.id = "calendar-upcoming-agenda";
      section.setAttribute("aria-labelledby", "calendar-upcoming-title");
      section.innerHTML = `
        <div class="calendar-upcoming-heading">
          <h2 class="calendar-upcoming-title" id="calendar-upcoming-title">📋 今後の予定</h2>
          <div class="calendar-upcoming-actions">
            <span class="calendar-upcoming-badge" id="calendar-upcoming-badge">自動更新</span>
            <button class="calendar-upcoming-refresh" id="calendar-upcoming-refresh" type="button" aria-label="今後の予定を最新状態に更新">↻ 更新</button>
          </div>
        </div>
        <div class="calendar-upcoming-list" id="calendar-upcoming-list" aria-live="polite" aria-busy="true">
          <div class="calendar-upcoming-skeleton"></div>
          <div class="calendar-upcoming-skeleton"></div>
          <div class="calendar-upcoming-skeleton"></div>
        </div>
        <p class="calendar-upcoming-note">Googleカレンダーの今後${UPCOMING_DAYS}日間を日付順に表示します。予定をタップするとGoogleカレンダーで詳細を確認できます。</p>
        <a class="calendar-attendance-gateway" id="calendar-attendance-gateway" href="attendance-preview.html?line-invite=1">
          <span class="calendar-attendance-gateway-icon" aria-hidden="true">📣</span>
          <span>
            <span class="calendar-attendance-gateway-title">保護者向け・試合参加のご案内</span>
            <span class="calendar-attendance-gateway-help">試合を選んでLINE案内文を作成できます</span>
          </span>
          <span class="calendar-attendance-gateway-arrow">案内を開く ›</span>
        </a>
      `;
      calendarWrap.after(section);
    }

    const list = section?.querySelector("#calendar-upcoming-list");
    const badge = section?.querySelector("#calendar-upcoming-badge");
    const refreshButton = section?.querySelector("#calendar-upcoming-refresh");
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    let requestInFlight = false;
    let lastLoadedAt = 0;

    function parseStart(event) {
      if (event.allDay) {
        const parts = event.start.split("-").map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
      return new Date(event.start);
    }

    function extractDescriptionTime(description) {
          const plain = String(description || "")
            .normalize("NFKC")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<[^>]*>/g, " ")
            .replace(/&nbsp;/gi, " ");
          const ranges = [];
          const colonRange = /(?:^|[^\d])([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)\s*(?:[〜～~－—-]|から)\s*([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)(?!\d)/gm;
          const japaneseRange = /(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*(?:([0-5]?\d)\s*分)?\s*(?:[〜～~－—-]|から)\s*([01]?\d|2[0-3])\s*時\s*(?:([0-5]?\d)\s*分)?(?!\d)/gm;
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

    function setTodayNotice(todaysEvents, incomplete) {
      const target = document.getElementById("tn-info");
      if (!target) return;
      const dot = document.createElement("span");
      dot.className = "tn-dot";
      dot.style.background = todaysEvents[0]?.color || "var(--cyan)";
      const text = document.createElement("span");
      text.textContent = todaysEvents.length
        ? `${todaysEvents[0].title}${todaysEvents.length > 1 ? ` ほか${todaysEvents.length - 1}件` : ""}`
        : incomplete ? "今日の予定を確認できませんでした" : "今日の登録予定はありません";
      target.replaceChildren(dot, text);
    }

    function renderEvents(events, cached) {
      if (!isCalendarPage) return;
      list.replaceChildren();
      list.setAttribute("aria-busy", "false");
      badge.textContent = cached ? "保存データ" : "自動更新";


      if (!events.length) {
        const empty = document.createElement("div");
        empty.className = "calendar-upcoming-state";
        empty.textContent = `今後${UPCOMING_DAYS}日間に登録されている予定はありません。`;
        list.appendChild(empty);
        return;
      }

      events.slice(0, 18).forEach((event) => {
        const iso = eventDate(event.start);
        const href = iso ? detailHref(iso, event) : "";
        const card = document.createElement(href ? "a" : "div");
        card.className = "calendar-event-card";
        if (href) {
          card.href = href;
          card.setAttribute("aria-label", `${event.title}の詳細を開く`);
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
      if (!isCalendarPage) return;
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

    async function fetchCalendar(calendar, timeMin, timeMax, limit = 40, includeDescription = false, requireComplete = false) {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`);
      url.searchParams.set("key", PUBLIC_CALENDAR_KEY);
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", String(limit));
      const response = await fetch(url.toString(), { referrerPolicy: "strict-origin-when-cross-origin" });
      if (!response.ok) throw new Error(`Calendar API ${response.status}`);
      const data = await response.json();
      if (requireComplete && data.nextPageToken) throw new Error("Incomplete calendar response");
      return (data.items || []).map((event) => ({
        id: `${calendar.id}:${event.id || event.iCalUID || ""}:${event.start?.dateTime || event.start?.date || ""}`,
        sourceId: event.id ? `${calendar.id}:${event.id}` : "",
        title: event.summary || "（タイトル未設定）",
        ...(isCalendarPage || matchPicker ? { status: event.status,
          kind: event.extendedProperties?.shared?.kind || event.extendedProperties?.private?.kind } : {}),
        start: event.start?.dateTime || event.start?.date || "",
        end: event.end?.dateTime || event.end?.date || "",
        allDay: !event.start?.dateTime,
        ...(includeDescription ? { description: event.description || "" } : {}),
        descriptionTime: !event.start?.dateTime ? extractDescriptionTime(event.description) : "",
        location: event.location || "",
        url: event.htmlLink || "",
        attendanceUrl: window.SMCCalendarAttendance?.extractChouseisanUrl(
          event.description,
          event.location,
          event.source?.url,
          ...(event.attachments || []).map((attachment) => attachment.fileUrl),
          ...Object.values(event.extendedProperties?.private || {}),
          ...Object.values(event.extendedProperties?.shared || {})
        ) || "",
        color: calendar.color,
        label: calendar.label
      })).filter((event) => event.start);
    }

    async function loadEvents(force) {
      if (requestInFlight) return;
      const cache = readCache();
      if (!force && cache?.events) {
        renderEvents(cache.events, true);
        if (isCalendarPage) {
          list.setAttribute("aria-busy", "true");
          badge.textContent = "更新中";
        }
      } else if (isCalendarPage) {
        list.setAttribute("aria-busy", "true");
        list.innerHTML = '<div class="calendar-upcoming-skeleton"></div><div class="calendar-upcoming-skeleton"></div>';
        badge.textContent = "読込中";
      }
      requestInFlight = true;
      if (refreshButton) refreshButton.disabled = true;
      const now = new Date();
      const today = eventDate(now);
      const agendaStart = isCalendarPage ? new Date(today + "T00:00:00+09:00") : now;
      const end = new Date(now);
      end.setDate(end.getDate() + UPCOMING_DAYS);
      try {
        const results = await Promise.allSettled(CALENDARS.map((calendar) =>
          fetchCalendar(calendar, agendaStart.toISOString(), end.toISOString(), isCalendarPage ? 250 : 40, isCalendarPage, isCalendarPage)
        ));
        const successful = results.filter((result) => result.status === "fulfilled");
        if (!successful.length) throw new Error("All calendar requests failed");
        const seen = new Set();
        const events = successful.flatMap((result) => result.value)
          .sort((left, right) => left.start.localeCompare(right.start))
          .filter((event) => !seen.has(event.id) && seen.add(event.id));
        if (isCalendarPage) {
          const failedLabels = CALENDARS.filter((_, index) => results[index].status === "rejected").map((calendar) => calendar.label);
          if (explicitDate) {
            const todayEvents = window.SMCCalendarAttendance.initialCalendarDay(events, today).todaysEvents;
            setTodayNotice(todayEvents, failedLabels.length > 0);
          } else {
            renderInitialDay(events, failedLabels, false, today);
          }
        }
        writeCache(events);
        lastLoadedAt = Date.now();
        renderEvents(events, false);
      } catch (error) {
        if (isCalendarPage && explicitDate) setTodayNotice([], true);
        else if (isCalendarPage) renderInitialDay([], CALENDARS.map((calendar) => calendar.label), true, today);
        if (cache?.events?.length) renderEvents(cache.events, true);
        else renderError();
      } finally {
        requestInFlight = false;
        if (refreshButton) refreshButton.disabled = false;
      }
    }

    if (refreshButton) refreshButton.addEventListener("click", () => loadEvents(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoadedAt > 60 * 1000) {
        loadEvents(false);
      }
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) loadEvents(false);
    });
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

/* ===== 個人情報を保存しない匿名の機能別カウンター =====
   月・機能キー・回数だけをFirebaseへ保存する。実装本体を分離し、
   Firebase未使用ページでは必要なSDKを遅延読み込みして表示速度への影響を抑える。 */
(function(){
  if(typeof document === "undefined" || document.querySelector('script[src$="usage-counter.js"]')) return;
  var script = document.createElement("script");
  script.src = "usage-counter.js";
  script.defer = true;
  document.head.appendChild(script);
})();

/* ===== Service Worker 登録（安全な自動更新） ===== */
(function(){
  if(!('serviceWorker' in navigator)) return;

  var SW_PATH = location.pathname.replace(/\/[^\/]*$/, '/') + 'sw.js';
  var hadController = Boolean(navigator.serviceWorker.controller);
  var reloadPending = false;
  var pendingInput = false;
  var reloadStarted = false;

  function isEditingField(){
    var active = document.activeElement;
    return Boolean(active && active.matches && active.matches('input,textarea,select,[contenteditable="true"]'));
  }

  function reloadWhenSafe(){
    if(!reloadPending || reloadStarted || pendingInput || isEditingField()) return;
    reloadStarted = true;
    window.location.replace(window.location.href);
  }

  // 利用者が入力した内容は、保存完了前の自動更新で消さない。
  document.addEventListener('input', function(event){
    if(event.isTrusted) pendingInput = true;
  }, true);
  document.addEventListener('change', function(event){
    if(event.isTrusted) pendingInput = true;
  }, true);
  document.addEventListener('focusout', function(){
    window.setTimeout(reloadWhenSafe, 0);
  }, true);
  window.addEventListener('smc:save-status', function(event){
    var detail = event.detail || {};
    if(detail.cloudSaved || detail.localSaved){
      pendingInput = false;
      window.setTimeout(reloadWhenSafe, 100);
    }
  });

  // 初回インストールでは再読込せず、既存アプリの更新時だけ自動で最新版へ切り替える。
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    try{ window.dispatchEvent(new CustomEvent('smc:app-updated')); }catch(e){}
    if(!hadController){
      hadController = true;
      return;
    }
    reloadPending = true;
    reloadWhenSafe();
  });

  navigator.serviceWorker.register(SW_PATH).then(function(reg){
    function checkForUpdate(){
      reg.update().catch(function(){});
    }
    checkForUpdate();
    reg.addEventListener('updatefound', function(){
      var newWorker = reg.installing;
      if(!newWorker) return;
      newWorker.addEventListener('statechange', function(){
        if(newWorker.state === 'installed'){
          newWorker.postMessage({type:'SKIP_WAITING'});
        }
      });
    });

    // アプリを開いたままでも定期的に更新を確認し、画面復帰時はすぐ再確認する。
    window.setInterval(function(){
      if(document.visibilityState === 'visible') checkForUpdate();
    }, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', function(){
      if(document.visibilityState === 'visible') checkForUpdate();
    });
  }).catch(function(err){
    console.log('SW登録エラー:', err);
  });

  // iPhoneの戻る操作でも、表示を壊さず最新版の有無を確認する。
  window.addEventListener('pageshow', function(event){
    if(!event.persisted) return;
    navigator.serviceWorker.getRegistration(SW_PATH).then(function(reg){
      if(reg) reg.update();
    }).catch(function(){});
  });
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
    if(d.saving){
      message = "💾 保存中…";
      state = "saving";
    }else if(d.cloudSaved){
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
    if(!d.saving)hideTimer = window.setTimeout(function(){ toast.classList.remove("show"); }, 3600);
  });
})();

/* ===== 全サブページ共通：安全な「一つ前へ戻る」 ===== */
(function(){
  var PREVIOUS_KEY="smc-portal-previous-url-v1";
  var pendingPaths=new Map(),failedPaths=new Set(),pendingNavigation=null,dirtyInput=false;

  function portalBasePath(){
    var path=location.pathname||"/";return path.slice(0,path.lastIndexOf("/")+1);
  }
  function safePortalUrl(value){
    if(!value)return null;
    try{
      var url=new URL(value,location.href),base=portalBasePath();
      if(url.origin!==location.origin||url.pathname.indexOf(base)!==0)return null;
      if(!/\.html$/i.test(url.pathname)&&!url.pathname.endsWith("/"))return null;
      return url;
    }catch(error){return null;}
  }
  function relativePortalUrl(url){return url.pathname+url.search+url.hash;}
  function validEventId(value){return /^[A-Za-z0-9_-]{1,100}$/.test(String(value||""))?String(value):"";}
  function tournamentProgressFallback(){
    var file=(location.pathname.split("/").pop()||"").toLowerCase();
    if(!["game_adjust.html","duty_match.html","tournament.html","accounting.html"].includes(file))return null;
    var id=validEventId(new URLSearchParams(location.search).get("dateId"));
    if(!id)return null;
    var url=new URL("coach.html",location.href);url.searchParams.set("eventId",id);url.hash="coach-match";return url;
  }
  function storedPreviousUrl(){
    try{
      var url=safePortalUrl(sessionStorage.getItem(PREVIOUS_KEY));
      if(url&&relativePortalUrl(url)!==location.pathname+location.search+location.hash)return url;
    }catch(error){}
    return null;
  }
  function internalReferrer(){
    var url=safePortalUrl(document.referrer);
    return url&&relativePortalUrl(url)!==location.pathname+location.search+location.hash?url:null;
  }
  function defaultFallback(){
    var tournament=tournamentProgressFallback();if(tournament)return tournament;
    return new URL("index.html",location.href);
  }
  function performBackNavigation(){
    var referrer=internalReferrer();
    if(referrer&&history.length>1){history.back();return;}
    var previous=storedPreviousUrl();
    if(previous){location.href=relativePortalUrl(previous);return;}
    location.href=relativePortalUrl(defaultFallback());
  }
  function requestBackNavigation(button){
    function proceed(){pendingNavigation=null;performBackNavigation();}
    if(pendingPaths.size){
      pendingNavigation={run:proceed,button:button};
      if(button){button.disabled=true;button.textContent="保存完了後に戻ります…";}
      var toast=document.getElementById("smc-save-toast");if(toast){toast.textContent="💾 保存が完了してから戻ります";toast.dataset.state="saving";toast.classList.add("show");}
      return;
    }
    if(failedPaths.size||dirtyInput){
      if(!window.confirm("保存できていない変更がある可能性があります。戻りますか？"))return;
    }
    proceed();
  }
  function normalizeExistingDestination(link){
    if(!link)return;
    var target=safePortalUrl(link.getAttribute("href"));if(!target)return;
    var file=(target.pathname.split("/").pop()||"index.html").toLowerCase();
    link.classList.add("smc-page-destination");
    var customLabel=String(link.getAttribute("data-nav-label")||"").trim();
    if(customLabel)link.textContent=customLabel;
    else if(file==="index.html"||!file)link.textContent="⌂ ホーム";
    else if(file==="coach.html")link.textContent="📁 コーチ専用";
  }
  function installBackButton(){
    var file=(location.pathname.split("/").pop()||"index.html").toLowerCase();
    if(file==="index.html"||file==="offline.html"||document.querySelector(".smc-page-nav"))return;
    var main=document.querySelector("main");if(!main)return;
    var existing=main.querySelector(".back-btn"),row=document.createElement("nav"),button=document.createElement("button");
    row.className="smc-page-nav no-print";row.setAttribute("aria-label","ページ移動");
    button.type="button";button.className="smc-smart-back";button.textContent="← 前の画面";
    button.addEventListener("click",function(){requestBackNavigation(button);});
    row.appendChild(button);
    if(existing){normalizeExistingDestination(existing);existing.before(row);row.appendChild(existing);}
    else{
      var home=document.createElement("a");home.className="back-btn smc-page-destination";home.href="index.html";home.textContent="⌂ ホーム";row.appendChild(home);main.insertBefore(row,main.firstChild);
    }
  }
  document.addEventListener("click",function(event){
    var link=event.target.closest&&event.target.closest("a[href]");if(!link||link.target==="_blank"||link.hasAttribute("download"))return;
    var target=safePortalUrl(link.getAttribute("href"));if(!target)return;
    if(target.pathname===location.pathname&&target.search===location.search)return;
    try{sessionStorage.setItem(PREVIOUS_KEY,location.pathname+location.search+location.hash);}catch(error){}
  },true);
  document.addEventListener("input",function(event){
    if(!event.isTrusted||!event.target.matches||event.target.matches('input[type="search"],[data-no-save-guard]'))return;
    if(event.target.matches("input,textarea,[contenteditable=true]"))dirtyInput=true;
  },true);
  window.addEventListener("smc:save-status",function(event){
    var detail=event.detail||{},path=String(detail.path||"unknown");
    if(detail.saving){pendingPaths.set(path,(pendingPaths.get(path)||0)+1);failedPaths.delete(path);return;}
    var remaining=Math.max(0,(pendingPaths.get(path)||1)-1);
    if(remaining)pendingPaths.set(path,remaining);else pendingPaths.delete(path);
    if(detail.ok||detail.cloudSaved||(detail.localOnly&&detail.localSaved)){failedPaths.delete(path);dirtyInput=false;}
    else failedPaths.add(path);
    if(pendingNavigation&&!pendingPaths.size){
      var pending=pendingNavigation;pendingNavigation=null;
      if(failedPaths.size&&!window.confirm("保存に失敗した変更があります。保存せず戻りますか？")){
        if(pending.button){pending.button.disabled=false;pending.button.textContent="← 前の画面";}
        return;
      }
      pending.run();
    }
  });
  document.addEventListener("DOMContentLoaded",installBackButton);
  window.SMCNavigation={safePortalUrl:safePortalUrl,requestBack:requestBackNavigation};
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
  function clearAlertStatus(){
    var status=document.getElementById("auto-alert-status");
    if(status)status.remove();
  }
  function setAlertStatus(){
    // 確認中・対象外・正常・通信エラーは画面に常設しない。
    // 雨またはWBGTが設定基準に該当したときだけ、既存の警告枠を表示する。
    clearAlertStatus();
  }
  function dateTimeLabel(date,includeTime){
    var days=["日","月","火","水","木","金","土"];
    var label=(date.getMonth()+1)+"/"+date.getDate()+"（"+days[date.getDay()]+"）";
    if(includeTime)label+=" "+String(date.getHours()).padStart(2,"0")+":"+String(date.getMinutes()).padStart(2,"0");
    return label;
  }
  function practiceLabel(practice){
    return dateTimeLabel(practice.date,false)+" "+(practice.schedule.start||"")+"〜"+(practice.schedule.end||"");
  }
  function findNextOutdoorPractice(){
    var now=new Date(),schedules=cfg.schedules||DEFAULT_SCHEDULES;
    var startHour=cfg.alertStartHour!==undefined?Number(cfg.alertStartHour):12;
    var daysBefore=cfg.alertDaysBefore!==undefined?Number(cfg.alertDaysBefore):1;
    if(!isFinite(daysBefore)||daysBefore<0)daysBefore=1;
    if(!isFinite(startHour)||startHour<0||startHour>23)startHour=12;
    // 週1回の屋外練習でも必ず次回を見つけられるよう、今日を含む8日間を検索。
    for(var offset=0;offset<8;offset++){
      var date=new Date(now);date.setDate(date.getDate()+offset);
      for(var i=0;i<schedules.length;i++){
        var schedule=schedules[i];
        if(schedule.indoor)continue;
        if(Number(schedule.day)!==date.getDay())continue;
        if(offset===0){
          var endParts=String(schedule.end||"23:59").split(":");
          var endTime=new Date(date);endTime.setHours(Number(endParts[0]),Number(endParts[1]||0),0,0);
          if(now>endTime)continue;
        }
        var alertTime=new Date(date);
        alertTime.setDate(alertTime.getDate()-daysBefore);
        alertTime.setHours(startHour,0,0,0);
        return{schedule:schedule,date:date,offset:offset,alertTime:alertTime,eligible:now>=alertTime};
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
    if(!practice){
      setAlertStatus(heatEl,"屋外練習が登録されていません。コーチ専用フォルダの「自動アラート設定」を確認してください。","waiting");
      return;
    }
    if(!practice.eligible){
      setAlertStatus(heatEl,"次回の屋外練習："+practiceLabel(practice)+"\n予報確認開始："+dateTimeLabel(practice.alertTime,true)+"から","waiting");
      return;
    }
    setAlertStatus(heatEl,"次回の屋外練習："+practiceLabel(practice)+"\n最新の雨・WBGT予報を確認しています…","checking");

    function fetchForecast(lat,lon,sourceName,isFallback){
      var url="https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon
        +"&hourly=temperature_2m,relative_humidity_2m,weather_code,precipitation_probability"
        +"&timezone=Asia/Tokyo&forecast_days=8";
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
            +"・雨天時の会場："+venue+(rainSchedule?"\n・"+rainSchedule:"")+"\n"
            +"※練習時間や場所を変更する場合は、グループLINEでご連絡します。参加前に最新の連絡をご確認ください。";
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
        var warnings=[];
        if(hasRain)warnings.push("雨アラート");
        if(wbgtMax>=heatThreshold)warnings.push("熱中症アラート");
        if(warnings.length){
          setAlertStatus(heatEl,"次回の屋外練習："+practiceLabel(practice)+"\n予報確認済み："+warnings.join("・")+"を表示しています。","waiting");
        }else{
          setAlertStatus(heatEl,"次回の屋外練習："+practiceLabel(practice)+"\n現在アラートはありません（最大降水確率 "+rainMax+"%／予想WBGT "+wbgtMax.toFixed(1)+"℃）","safe");
        }
      }).catch(function(error){
        console.error("auto alert fetch error:",error);
        if(runId!==checkSeq)return;
        if(!isFallback){
          setAlertStatus(heatEl,"現在地の予報を取得できなかったため、吉見町の予報で再確認しています…","checking");
          fetchForecast(36.0,139.5,"吉見町",true);
          return;
        }
        setAlertStatus(heatEl,"予報を取得できませんでした。通信状態を確認し、画面を開き直してください。","error");
      });
    }
    function useYoshimi(){if(runId===checkSeq)fetchForecast(36.0,139.5,"吉見町",true);}
    if(!navigator.geolocation){useYoshimi();return;}
    navigator.geolocation.getCurrentPosition(function(position){
      if(runId===checkSeq)fetchForecast(position.coords.latitude,position.coords.longitude,"現在地",false);
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
  document.addEventListener("visibilitychange",function(){
    if(document.visibilityState==="visible")scheduleCheck();
  });
})();
