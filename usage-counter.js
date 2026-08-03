/* ============================================================
   吉見SMC 匿名利用カウンター

   Firebaseへ送るのは「月」と「機能キー」と「回数」だけです。
   氏名・入力内容・URLパラメータ・端末ID・IPアドレス・ユーザーIDは
   アプリ側では収集・保存しません。
   ============================================================ */
(function(root, factory){
  var api = factory(root);
  if(typeof module !== "undefined" && module.exports){
    module.exports = api;
    return;
  }
  root.SMCUsageCounter = api;
  api.start();
})(typeof window !== "undefined" ? window : {}, function(root){
  "use strict";

  var STORAGE_ROOT = "usage_stats_v1";
  var SESSION_PREFIX = "smc_usage_seen_v1_";
  var started = false;
  var firebaseLoaderStarted = false;
  var firebaseCallbacks = [];
  var pending = {};
  var recentActions = {};

  /* 保存できる機能キーを固定し、任意の文字列や入力内容を送信させない。 */
  var FEATURE_LABELS = {
    home: "ホーム",
    calendar: "カレンダー",
    attendance: "出欠確認",
    game_adjust: "試合調整",
    coach: "コーチ専用フォルダ",
    duty_match: "大会任務分担",
    tournament: "大会要綱・対戦表",
    accounting: "会計・決算書",
    referee: "審判資料",
    members: "団員名簿",
    album: "写真",
    todo: "やることリスト",
    finance: "立替・購入相談",
    diary: "活動日誌",
    duty: "当番表",
    uniform: "ユニフォーム管理",
    join: "入団案内",
    orders: "注文・外部リンク",
    pitch: "グラウンド案内",
    weather: "天気",
    heat: "熱中症対策",
    coach_guidance: "お知らせ設定",
    coach_alert: "アラート設定",
    coach_menu: "練習メニュー",
    staff: "スタッフ管理",
    accounts: "アカウント一覧",
    line_copy: "LINEコピー",
    schedule_auto_create: "対戦表の自動作成",
    schedule_optimize: "対戦表の最適化",
    line_invite_create: "LINE案内の作成"
  };

  var PAGE_FEATURES = {
    "": "home",
    "index.html": "home",
    "calendar.html": "calendar",
    "attendance.html": "attendance",
    "game_adjust.html": "game_adjust",
    "coach.html": "coach",
    "duty_match.html": "duty_match",
    "tournament.html": "tournament",
    "accounting.html": "accounting",
    "referee.html": "referee",
    "members.html": "members",
    "album.html": "album",
    "todo.html": "todo",
    "finance.html": "finance",
    "diary.html": "diary",
    "duty.html": "duty",
    "uniform.html": "uniform",
    "join.html": "join",
    "orders.html": "orders",
    "pitch.html": "pitch",
    "weather.html": "weather",
    "heat.html": "heat",
    "coach_guidance.html": "coach_guidance",
    "coach_alert.html": "coach_alert",
    "coach_menu.html": "coach_menu",
    "staff.html": "staff",
    "accounts.html": "accounts"
  };

  function twoDigits(value){ return value < 10 ? "0" + value : String(value); }

  function monthKey(date){
    var value = date instanceof Date ? date : new Date(date || Date.now());
    if(isNaN(value.getTime())) value = new Date();
    return value.getFullYear() + "-" + twoDigits(value.getMonth() + 1);
  }

  function pageName(pathname){
    var clean = String(pathname || "").split("?")[0].split("#")[0];
    return clean.split("/").pop() || "";
  }

  function pageFeature(pathname){
    return PAGE_FEATURES[pageName(pathname)] || "";
  }

  function isAllowedFeature(feature){
    return Object.prototype.hasOwnProperty.call(FEATURE_LABELS, feature);
  }

  function sessionHas(feature, month){
    try{
      var raw = root.sessionStorage && root.sessionStorage.getItem(SESSION_PREFIX + month);
      var seen = raw ? JSON.parse(raw) : [];
      return Array.isArray(seen) && seen.indexOf(feature) !== -1;
    }catch(error){
      return false;
    }
  }

  function markSession(feature, month){
    try{
      if(!root.sessionStorage) return;
      var key = SESSION_PREFIX + month;
      var raw = root.sessionStorage.getItem(key);
      var seen = raw ? JSON.parse(raw) : [];
      if(!Array.isArray(seen)) seen = [];
      if(seen.indexOf(feature) === -1) seen.push(feature);
      root.sessionStorage.setItem(key, JSON.stringify(seen));
    }catch(error){
      /* sessionStorageが使えない端末でも、画面の機能は止めない。 */
    }
  }

  function ensureFirebase(callback){
    if(typeof root.onFirebaseReady === "function"){
      root.onFirebaseReady(callback);
      return;
    }
    firebaseCallbacks.push(callback);
    if(firebaseLoaderStarted) return;
    firebaseLoaderStarted = true;
    if(!root.document) return;
    var script = root.document.createElement("script");
    script.src = "firebase-config.js";
    script.onload = function(){
      var callbacks = firebaseCallbacks.slice();
      firebaseCallbacks = [];
      if(typeof root.onFirebaseReady === "function"){
        callbacks.forEach(function(item){ root.onFirebaseReady(item); });
      }
    };
    script.onerror = function(){
      firebaseLoaderStarted = false;
      firebaseCallbacks = [];
    };
    root.document.head.appendChild(script);
  }

  function increment(feature, options){
    options = options || {};
    if(!isAllowedFeature(feature) || pending[feature]) return Promise.resolve(false);
    var month = monthKey(new Date());
    if(options.oncePerSession && sessionHas(feature, month)) return Promise.resolve(false);
    pending[feature] = true;

    return new Promise(function(resolve){
      var finished = false;
      var timer = root.setTimeout ? root.setTimeout(function(){
        if(finished) return;
        finished = true;
        pending[feature] = false;
        resolve(false);
      }, 9000) : null;

      ensureFirebase(function(db){
        if(!db || !db.ref){
          if(timer && root.clearTimeout) root.clearTimeout(timer);
          pending[feature] = false;
          if(!finished){ finished = true; resolve(false); }
          return;
        }
        var path = STORAGE_ROOT + "/" + month + "/" + feature;
        db.ref(path).transaction(function(current){
          var count = Number(current);
          return (isFinite(count) && count >= 0 ? Math.floor(count) : 0) + 1;
        }, function(error, committed){
          if(timer && root.clearTimeout) root.clearTimeout(timer);
          pending[feature] = false;
          if(!error && committed && options.oncePerSession) markSession(feature, month);
          if(!finished){ finished = true; resolve(!error && committed); }
        }, false);
      });
    });
  }

  function actionFeature(target){
    if(!target || !target.closest) return "";
    var button = target.closest("button, a");
    if(!button) return "";
    if(button.classList && button.classList.contains("btn-line-copy")) return "line_copy";
    var handler = String(button.getAttribute("onclick") || "");
    if(handler.indexOf("buildTaisen(") !== -1) return "schedule_auto_create";
    if(handler.indexOf("optimizeCurrentSchedule(") !== -1) return "schedule_optimize";
    if(handler.indexOf("openLineInvite(") !== -1) return "line_invite_create";
    return String(button.getAttribute("data-usage-event") || "");
  }

  function onAction(event){
    var feature = actionFeature(event.target);
    if(!isAllowedFeature(feature)) return;
    var now = Date.now();
    if(recentActions[feature] && now - recentActions[feature] < 2000) return;
    recentActions[feature] = now;
    increment(feature, {oncePerSession:false});
  }

  function start(){
    if(started || !root.document || !root.location) return;
    started = true;
    var begin = function(){
      var feature = pageFeature(root.location.pathname);
      if(feature) increment(feature, {oncePerSession:true});
      root.document.addEventListener("click", onAction, false);
    };
    if(root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", begin, {once:true});
    else begin();
  }

  return {
    STORAGE_ROOT: STORAGE_ROOT,
    FEATURE_LABELS: FEATURE_LABELS,
    PAGE_FEATURES: PAGE_FEATURES,
    monthKey: monthKey,
    pageFeature: pageFeature,
    isAllowedFeature: isAllowedFeature,
    actionFeature: actionFeature,
    increment: increment,
    start: start
  };
});
