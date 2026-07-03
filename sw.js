// Service Worker v3 - キャッシュ解除版
// バージョン: 20260703

function clearAllCaches(){
  return caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ return caches.delete(k); }));
  });
}

self.addEventListener('install', function(e){
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    clearAllCaches().then(function(){
      return self.clients.claim();
    }).then(function(){
      return self.registration.unregister();
    })
  );
});

// キャッシュを使わず常にネットワークから取得
self.addEventListener('fetch', function(e){
  e.respondWith(fetch(e.request, {cache: 'no-store'}));
});
