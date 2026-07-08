// Service Worker - 自動キャッシュ無効化
// バージョン: 20260708235728

const CACHE_VERSION = '20260708235728';

// インストール：即座にアクティベート
self.addEventListener('install', function(e){
  self.skipWaiting();
});

// アクティベート：全キャッシュを削除して即座に制御を取得
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return caches.delete(k);
      }));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

// フェッチ：常にネットワークから最新を取得（キャッシュ使わない）
self.addEventListener('fetch', function(e){
  // GETリクエストのみ処理
  if(e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request, {
      cache: 'no-store',
      headers: {'Cache-Control': 'no-cache'}
    }).catch(function(){
      // オフライン時のみキャッシュから返す
      return caches.match(e.request);
    })
  );
});
