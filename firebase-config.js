// ============================================================
// Firebase 設定ファイル
// ============================================================
// 【設定手順】
// 1. https://console.firebase.google.com/ にアクセス
// 2. Googleアカウント（yoshimi.smc.fc@gmail.com）でログイン
// 3. 「プロジェクトを追加」→ 名前「yoshimi-smc-portal」
// 4. 「Realtime Database」→「データベースを作成」→「テストモード」
// 5. 「プロジェクトの設定」→「マイアプリ」→「</>」→アプリ登録
// 6. 下記の YOUR_*** の部分を実際の値に書き換える
// ============================================================

var FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
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
  // 設定が未入力の場合はlocalStorageのみで動作
  if(FIREBASE_CONFIG.apiKey === "YOUR_API_KEY"){
    console.warn("[SMC Portal] Firebase未設定 - localStorageのみで動作");
    return;
  }
  // Firebase SDK ロード
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
    document.head.appendChild(s);
  });
})();

// ============================================================
// 汎用DB操作ユーティリティ
// ============================================================

/**
 * クラウドからデータを読み込む（リアルタイム監視）
 * @param {string} path - DBパス (例: "members", "todo")
 * @param {function} callback - データ受信時のコールバック(data)
 * @param {*} fallback - Firebase未設定時のlocalStorage fallback値
 */
function dbListen(path, callback, localKey, fallback){
  if(!FIREBASE_READY || FIREBASE_CONFIG.apiKey === "YOUR_API_KEY"){
    // localStorageフォールバック
    try{
      var s = localStorage.getItem(localKey);
      callback(s ? JSON.parse(s) : fallback);
    }catch(e){ callback(fallback); }
    return;
  }
  onFirebaseReady(function(db){
    db.ref(path).on("value", function(snap){
      var val = snap.val();
      callback(val !== null ? val : fallback);
    });
  });
}

/**
 * クラウドにデータを保存
 * @param {string} path - DBパス
 * @param {*} data - 保存するデータ
 * @param {string} localKey - localStorageのキー（フォールバック用）
 * @param {function} onSuccess - 成功時コールバック
 */
function dbSave(path, data, localKey, onSuccess){
  // 常にlocalStorageにも保存（オフライン対応）
  try{ localStorage.setItem(localKey, JSON.stringify(data)); }catch(e){}

  if(!FIREBASE_READY || FIREBASE_CONFIG.apiKey === "YOUR_API_KEY"){
    if(onSuccess) onSuccess();
    return;
  }
  onFirebaseReady(function(db){
    db.ref(path).set(data).then(function(){
      if(onSuccess) onSuccess();
    }).catch(function(err){
      console.error("[SMC Portal] 保存エラー:", err);
      alert("クラウド保存に失敗しました。ネットワークを確認してください。\n（ローカルには保存済みです）");
    });
  });
}
