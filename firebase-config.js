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
  // まずlocalStorageのデータを即座に表示（高速表示）
  try{
    var ls = localStorage.getItem(localKey);
    if(ls) callback(JSON.parse(ls));
    else if(fallback !== undefined) callback(fallback);
  }catch(e){}

  // Firebaseのリアルタイムデータで上書き
  onFirebaseReady(function(db){
    db.ref(path).on("value", function(snap){
      var val = snap.val();
      var data = (val !== null && val !== undefined) ? val : fallback;
      // localStorageにも同期保存
      try{ if(localKey) localStorage.setItem(localKey, JSON.stringify(data)); }catch(e){}
      callback(data);
    }, function(err){
      console.error("[SMC Portal] dbListen error:", path, err);
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
