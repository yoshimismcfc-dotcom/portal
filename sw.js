// Service Worker - 自動更新対応版
// バージョン: 20260710201446

const CACHE_VERSION = '20260710201446';
const CACHE_NAME = 'smc-portal-' + CACHE_VERSION;

// インストール：新バージョンを即座にアクティベート
self.addEventListener('install', function(e){
  // skipWaitingで既存SWを即座に置き換え
  e.waitUntil(self.skipWaiting());
});

// アクティベート：古いキャッシュを全削除して全クライアントを制御
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){
      // 全ての開いているページを即座に制御下に置く
      return self.clients.claim();
    }).then(function(){
      // 全クライアントに更新を通知（PWAリロード用）
      return self.clients.matchAll({type:'window'}).then(function(clients){
        clients.forEach(function(client){
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION
          });
        });
      });
    })
  );
});

// フェッチ：常にネットワークから最新を取得
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  // chrome-extension等は無視
  if(!e.request.url.startsWith('http')) return;

  e.respondWith(
    fetch(e.request, {
      cache: 'no-store',
      headers: {'Cache-Control': 'no-cache'}
    }).catch(function(){
      return caches.match(e.request);
    })
  );
});

// メッセージ受信（外部からのキャッシュクリア要求）
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
