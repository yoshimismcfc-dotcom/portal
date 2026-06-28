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
var FIREBASE_CALLBACKS = [];
var FIREBASE_FAILED = false;

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
        try{
          firebase.initializeApp(FIREBASE_CONFIG);
          FIREBASE_DB = firebase.database();
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

function dbListen(path, callback, localKey, fallback){
  var deliveredLocal = false;
  function deliverLocal(){
    if(deliveredLocal) return;
    var local = readLocalResult(localKey, fallback);
    if(!local.has) return;
    deliveredLocal = true;
    callback(local.value);
  }

  // Show saved device data immediately when it exists, but do not invent empty fallback data
  // before Firebase has had a chance to answer.
  deliverLocal();

  if(typeof FIREBASE_CONFIG === "undefined" || FIREBASE_CONFIG.apiKey === "YOUR_API_KEY"){
    if(!deliveredLocal) callback(fallback);
    return;
  }

  window.setTimeout(function(){
    if(!deliveredLocal && !FIREBASE_READY){
      callback(fallback);
    }
  }, 3500);

  onFirebaseReady(function(db){
    db.ref(path).on("value", function(snap){
      var val = snap.val();
      if(val !== null && val !== undefined){
        callback(val);
        return;
      }
      var local = readLocalResult(localKey, fallback);
      callback(local.has ? local.value : fallback);
    }, function(err){
      console.error("[SMC Portal] dbListen error:", path, err);
      var local = readLocalResult(localKey, fallback);
      callback(local.has ? local.value : fallback);
    });
  });
}

function dbSave(path, data, localKey, onSuccess){
  try{
    if(localKey) localStorage.setItem(localKey, JSON.stringify(data));
  }catch(e){
    console.error("[SMC Portal] localStorage save error:", e);
  }

  var done = false;
  function successOnce(){
    if(done) return;
    done = true;
    if(onSuccess) onSuccess();
  }

  successOnce();

  if(typeof FIREBASE_CONFIG === "undefined" || FIREBASE_CONFIG.apiKey === "YOUR_API_KEY"){
    return;
  }

  onFirebaseReady(function(db){
    db.ref(path).set(data).then(function(){
      successOnce();
    }).catch(function(err){
      console.error("[SMC Portal] dbSave error:", path, err);
      successOnce();
    });
  });
}
