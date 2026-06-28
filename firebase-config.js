// ============================================================
// Firebase 設定ファイル - yoshimi-smc-portal
// 設定完了済み 2026/06/27
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

// Firebase SDKを動的ロード
var FIREBASE_READY = false;
var FIREBASE_DB = null;
var FIREBASE_CALLBACKS = [];

function onFirebaseReady(cb){
  if(FIREBASE_READY) cb(FIREBASE_DB);
  else FIREBASE_CALLBACKS.push(cb);
}

(function(){
  var scripts = [
    "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"
  ];
  var loaded = 0;
  scripts.forEach(function(src){
    var s = document.createElement("script");
    s.src = src;
    s.onload = function(){
      loaded++;
      if(loaded === scripts.length){
        firebase.initializeApp(FIREBASE_CONFIG);
        FIREBASE_DB = firebase.database();
        FIREBASE_READY = true;
        FIREBASE_CALLBACKS.forEach(function(cb){ cb(FIREBASE_DB); });
        FIREBASE_CALLBACKS = [];
        console.log("[SMC Portal] Firebase接続完了");
      }
    };
    s.onerror = function(){
      console.error("[SMC Portal] Firebase SDK読み込み失敗:", src);
    };
    document.head.appendChild(s);
  });
})();

// ============================================================
// 汎用DB操作ユーティリティ
// ============================================================

function dbListen(path, callback, localKey, fallback){
  // Firebaseが接続されていない場合はlocalStorage→fallbackの順で使用
  if(typeof FIREBASE_CONFIG === "undefined" || FIREBASE_CONFIG.apiKey === "YOUR_API_KEY"){
    try{
      var ls = localStorage.getItem(localKey);
      if(ls){
        var parsed = JSON.parse(ls);
        // 空オブジェクト・空配列チェック
        var isEmpty = parsed === null || parsed === undefined ||
          (Array.isArray(parsed) && parsed.length === 0) ||
          (typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length === 0);
        callback(isEmpty ? fallback : parsed);
      } else {
        callback(fallback);
      }
    }catch(e){ callback(fallback); }
    return;
  }

  // Firebaseのリアルタイムデータを取得
  onFirebaseReady(function(db){
    db.ref(path).on("value", function(snap){
      var val = snap.val();
      // nullまたは空の場合はfallbackを渡す（呼び出し元でINIT書き込みを行う）
      callback(val !== null && val !== undefined ? val : fallback);
    }, function(err){
      console.error("[SMC Portal] dbListen error:", path, err);
      // エラー時はlocalStorage→fallbackで対応
      try{
        var ls = localStorage.getItem(localKey);
        callback(ls ? JSON.parse(ls) : fallback);
      }catch(e){ callback(fallback); }
    });
  });
}

function dbSave(path, data, localKey, onSuccess){
  // localStorageに即座に保存（オフライン対応）
  try{ if(localKey) localStorage.setItem(localKey, JSON.stringify(data)); }catch(e){}

  onFirebaseReady(function(db){
    db.ref(path).set(data).then(function(){
      if(onSuccess) onSuccess();
    }).catch(function(err){
      console.error("[SMC Portal] dbSave error:", path, err);
      // クラウド保存失敗でもローカルには保存済みなのでエラーは出さない
      if(onSuccess) onSuccess();
    });
  });
}
