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
    setupTabs();
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
