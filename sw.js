// Yoshimi SMC FC Portal Service Worker
const APP_VERSION = "20260809-15";
const CACHE_PREFIX = "smc-portal-";
const CACHE_NAME = CACHE_PREFIX + APP_VERSION;

// 公開ページと共通アセットだけを事前保存する。
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./offline.html",
  "./common.css",
  "./common.js",
  "./usage-counter.js",
  "./event-links.js",
  "./tournament-scheduler.js",
  "./tournament-guidelines.js",
  "./firebase-config.js",
  "./manifest.json",
  "./favicon.png",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon.svg",
  "./assets/yoshimi-smc-logo.jpeg",
  "./attendance.html",
  "./calendar.html",
  "./guide.html",
  "./join.html",
  "./orders.html",
  "./pitch.html",
  "./referee.html",
  "./weather.html"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){ return cache.addAll(PRECACHE_URLS); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys
        .filter(function(key){ return key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME; })
        .map(function(key){ return caches.delete(key); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function networkFirst(request){
  return fetch(request, {cache:"no-store"}).then(function(response){
    if(response && response.ok){
      var copy = response.clone();
      caches.open(CACHE_NAME).then(function(cache){ cache.put(request, copy); });
    }
    return response;
  }).catch(function(){
    return caches.match(request).then(function(cached){
      return cached || caches.match("./offline.html");
    });
  });
}

function staleWhileRevalidate(request){
  return caches.match(request).then(function(cached){
    var update = fetch(request).then(function(response){
      if(response && response.ok){
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(request, copy); });
      }
      return response;
    }).catch(function(){ return cached; });
    return cached || update;
  });
}

self.addEventListener("fetch", function(event){
  var request = event.request;
  if(request.method !== "GET") return;

  var url = new URL(request.url);
  if(url.origin !== self.location.origin) return;

  if(request.mode === "navigate"){
    event.respondWith(networkFirst(request));
    return;
  }

  // JavaScriptとCSSは起動時にネットワークを優先し、常に最新版を確認する。
  if(["style","script"].indexOf(request.destination) !== -1){
    event.respondWith(networkFirst(request));
    return;
  }

  // 画像とフォントだけは表示速度を優先し、裏側で更新する。
  if(["image","font"].indexOf(request.destination) !== -1){
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("message", function(event){
  if(event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
