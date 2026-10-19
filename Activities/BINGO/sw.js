/* Bump CACHE when shipping a new release. Only this app's scope is cached. */
const CACHE='smc-bingo-v1';
const FILES=['./','./index.html','./style.css','./core.js','./app.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('smc-bingo-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).catch(()=>{if(event.request.mode==='navigate')return caches.match('./index.html');return Response.error();})));});
