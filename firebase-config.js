// ============================================================
// Firebase config - yoshimi-smc-portal
// ============================================================

var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyJtjC40Duw2z07yg4KR6TqILE8S_jNm",
  authDomain:        "yoshimi-smc-portal.firebaseapp.com",
  databaseURL:       "https://yoshimi-smc-portal-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "yoshimi-smc-portal",
  storageBucket:     "yoshimi-smc-portal.firebasestorage.app",
  messagingSenderId: "1065203351299",
  appId:             "1:1065203351299:web:72d49675b0243684922828"
};

var FIREBASE_READY = false;
var FIREBASE_DB = null;
var FIREBASE_AUTH = null;
var FIREBASE_CALLBACKS = [];
var FIREBASE_FAILED = false;
var FIREBASE_SAVE_TIMEOUT = 8000;
var FIREBASE_LISTENERS = [];
var FIREBASE_REFRESH_TIMER = null;
var FIREBASE_LAST_REFRESH_AT = 0;

function onFirebaseReady(cb){
  if(FIREBASE_READY) cb(FIREBASE_DB);
  else FIREBASE_CALLBACKS.push(cb);
}

(function(){
  var scripts = [
    "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js",
    "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"
  ];
  var loaded = 0;

  scripts.forEach(function(src){
    var s = document.createElement("script");
    s.src = src;
    s.onload = function(){
      loaded++;
      if(loaded === scripts.length){
        try{
          firebase.initializeApp(FIREBASE_CONFIG);
          FIREBASE_DB = firebase.database();
          FIREBASE_AUTH = firebase.auth();
          FIREBASE_READY = true;
          FIREBASE_CALLBACKS.forEach(function(cb){ cb(FIREBASE_DB); });
          FIREBASE_CALLBACKS = [];
          console.log("[SMC Portal] Firebase ready");
        }catch(e){
          FIREBASE_FAILED = true;
          console.error("[SMC Portal] Firebase init error:", e);
        }
      }
    };
    s.onerror = function(){
      FIREBASE_FAILED = true;
      console.error("[SMC Portal] Firebase SDK load error:", src);
    };
    document.head.appendChild(s);
  });
})();

function readLocalResult(localKey, fallback){
  try{
    if(!localKey) return { has: false, value: fallback };
    var raw = localStorage.getItem(localKey);
    if(!raw) return { has: false, value: fallback };
    var parsed = JSON.parse(raw);
    var isEmpty = parsed === null || parsed === undefined ||
      (Array.isArray(parsed) && parsed.length === 0) ||
      (typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length === 0);
    return { has: !isEmpty, value: isEmpty ? fallback : parsed };
  }catch(e){
    return { has: false, value: fallback };
  }
}

function firebaseValueSignature(value){
  try{ return JSON.stringify(value); }
  catch(e){ return String(value); }
}

function deliverFirebaseCloudValue(record, val, reason){
  var latest = (val !== null && val !== undefined) ? val : record.fallback;
  var signature = firebaseValueSignature(latest);
  if(record.lastCloudSignature === signature) return false;
  record.lastCloudSignature = signature;

  try{
    if(record.localKey) localStorage.setItem(record.localKey, JSON.stringify(latest));
  }catch(cacheError){
    console.warn("[SMC Portal] latest cache update error:", record.localKey, cacheError);
  }

  record.callback(latest, {
    source:"cloud",
    authoritative:true,
    empty:val === null || val === undefined,
    refreshReason:reason || "listener"
  });
  try{
    window.dispatchEvent(new CustomEvent("smc:data-refreshed", {
      detail:{path:record.path, reason:reason || "listener"}
    }));
  }catch(eventError){}
  return true;
}

function dbListen(path, callback, localKey, fallback){
  var deliveredLocal = false;
  var record = {
    path:path,
    callback:callback,
    localKey:localKey,
    fallback:fallback,
    lastCloudSignature:null,
    applyCloud:null
  };
  FIREBASE_LISTENERS.push(record);

  function deliverLocal(){
    if(deliveredLocal) return;
    var local = readLocalResult(localKey, fallback);
    if(!local.has) return;
    deliveredLocal = true;
    callback(local.value, {source:"local", authoritative:false});
  }

  // 保存済みデータを先に表示し、クラウドの最新値が届いた時だけ差し替える。
  deliverLocal();

  if(typeof FIREBASE_CONFIG === "undefined" || FIREBASE_CONFIG.apiKey === "YOUR_API_KEY"){
    if(!deliveredLocal) callback(fallback, {source:"fallback", authoritative:false});
    return;
  }

  window.setTimeout(function(){
    if(!deliveredLocal && !FIREBASE_READY){
      callback(fallback, {source:"fallback", authoritative:false});
    }
  }, 3500);

  onFirebaseReady(function(db){
    record.applyCloud = function(val, reason){
      return deliverFirebaseCloudValue(record, val, reason);
    };
    db.ref(path).on("value", function(snap){
      record.applyCloud(snap.val(), "listener");
    }, function(err){
      console.error("[SMC Portal] dbListen error:", path, err);
      var local = readLocalResult(localKey, fallback);
      callback(local.has ? local.value : fallback, {source:local.has ? "local-error" : "error", authoritative:false});
    });
  });
}

// ホーム画面アプリの画面復帰・戻る操作では、ページを強制再読込せず、
// 登録済みのFirebaseデータだけを再確認する。
function refreshFirebaseListeners(reason){
  if(FIREBASE_REFRESH_TIMER) window.clearTimeout(FIREBASE_REFRESH_TIMER);
  FIREBASE_REFRESH_TIMER = window.setTimeout(function(){
    FIREBASE_REFRESH_TIMER = null;
    var now = Date.now();
    if(now - FIREBASE_LAST_REFRESH_AT < 600) return;
    FIREBASE_LAST_REFRESH_AT = now;

    onFirebaseReady(function(db){
      try{ if(typeof db.goOnline === "function") db.goOnline(); }catch(onlineError){}
      FIREBASE_LISTENERS.forEach(function(record){
        db.ref(record.path).once("value").then(function(snap){
          if(record.applyCloud) record.applyCloud(snap.val(), reason || "resume");
        }).catch(function(error){
          console.warn("[SMC Portal] resume refresh error:", record.path, error);
        });
      });
    });
  }, 900);
}

(function setupFirebaseResumeRefresh(){
  if(typeof window.addEventListener !== "function" || typeof document.addEventListener !== "function") return;
  function refresh(reason){ refreshFirebaseListeners(reason); }
  window.addEventListener("pageshow", function(event){
    refresh(event && event.persisted ? "back-forward-cache" : "page-show");
  });
  window.addEventListener("focus", function(){ refresh("window-focus"); });
  window.addEventListener("online", function(){ refresh("online"); });
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "visible") refresh("app-visible");
  });
})();

function emitSaveStatus(detail){
  try{
    window.dispatchEvent(new CustomEvent("smc:save-status", {detail:detail}));
  }catch(e){
    console.log("[SMC Portal] save status:", detail);
  }
}

function dbSave(path, data, localKey, onSuccess, onError){
  var localSaved = true;
  try{
    if(localKey) localStorage.setItem(localKey, JSON.stringify(data));
  }catch(e){
    localSaved = false;
    console.error("[SMC Portal] localStorage save error:", e);
  }

  if(typeof FIREBASE_CONFIG === "undefined" || FIREBASE_CONFIG.apiKey === "YOUR_API_KEY"){
    var localResult = {
      ok: localSaved,
      path: path,
      localSaved: localSaved,
      cloudSaved: false,
      localOnly: true,
      queued: false,
      error: localSaved ? null : "端末への保存に失敗しました"
    };
    emitSaveStatus(localResult);
    if(localSaved && onSuccess) onSuccess(localResult);
    if(!localSaved && onError) onError(localResult);
    return Promise.resolve(localResult);
  }

  return new Promise(function(resolve){
    var settled = false;
    var waitingNoticeSent = false;

    function settle(result){
      if(settled) return;
      settled = true;
      emitSaveStatus(result);
      if(result.ok){
        if(onSuccess) onSuccess(result);
      }else if(onError){
        onError(result);
      }
      resolve(result);
    }

    var timer = window.setTimeout(function(){
      waitingNoticeSent = true;
      settle({
        ok: false,
        path: path,
        localSaved: localSaved,
        cloudSaved: false,
        localOnly: false,
        queued: localSaved,
        error: "クラウド接続がタイムアウトしました"
      });
    }, FIREBASE_SAVE_TIMEOUT);

    onFirebaseReady(function(db){
      db.ref(path).set(data).then(function(){
        window.clearTimeout(timer);
        var result = {
          ok: true,
          path: path,
          localSaved: localSaved,
          cloudSaved: true,
          localOnly: false,
          queued: false,
          error: null,
          syncedAfterTimeout: waitingNoticeSent
        };
        if(settled){
          emitSaveStatus(result);
          return;
        }
        settle(result);
      }).catch(function(err){
        window.clearTimeout(timer);
        console.error("[SMC Portal] dbSave error:", path, err);
        settle({
          ok: false,
          path: path,
          localSaved: localSaved,
          cloudSaved: false,
          localOnly: false,
          queued: localSaved,
          error: err && err.message ? err.message : "クラウド保存に失敗しました"
        });
      });
    });
  });
}

/* ===== 共通の文字列・URL安全化 ===== */
function escapeHtml(value){
  return String(value == null ? "" : value)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function normalizeExternalUrl(value){
  var raw = String(value || "").trim();
  if(!raw) return "";
  try{
    var parsed = new URL(raw, window.location.href);
    if(parsed.protocol !== "https:") return "";
    return parsed.href;
  }catch(e){
    return "";
  }
}

// 既存のインラインイベントへ値を渡す場合の安全な1引数表現。
// JSON文字列化した後にHTML属性用エスケープを行う。
function inlineJsArg(value){
  return escapeHtml(JSON.stringify(String(value == null ? "" : value)));
}
