/* Bump CACHE when shipping a new release. Only this app's scope is cached. */
const CACHE='smc-bingo-v4';
const FILES=['./','./index.html','./style.css','./portal-theme.js','./core.js','./cloud.js','./app.js','../../common.css','../../common-current.css','../../common-base.css','../../semantic-light.css','../../assets/yoshimi-smc-logo.jpeg'];
const ASSETS=new Set(FILES.map(file=>new URL(file,self.registration.scope).href));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('smc-bingo-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||(!url.href.startsWith(self.registration.scope)&&!ASSETS.has(url.href)))return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).catch(()=>{if(event.request.mode==='navigate')return caches.match('./index.html');return Response.error();})));});
