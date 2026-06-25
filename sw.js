var CACHE = "smc-portal-v1";
var URLS = [
  "/portal/","/portal/index.html","/portal/common.css","/portal/common.js",
  "/portal/heat.html","/portal/attendance.html","/portal/calendar.html",
  "/portal/coach.html","/portal/referee.html","/portal/pitch.html",
  "/portal/duty.html","/portal/members.html","/portal/album.html",
  "/portal/game_adjust.html","/portal/diary.html","/portal/uniform.html",
  "/portal/weather.html","/portal/orders.html","/portal/join.html"
];
self.addEventListener("install",function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(URLS);}));
  self.skipWaiting();
});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }));
  self.clients.claim();
});
self.addEventListener("fetch",function(e){
  e.respondWith(
    caches.match(e.request).then(function(r){
      return r||fetch(e.request).then(function(res){
        var rc=res.clone();
        caches.open(CACHE).then(function(c){c.put(e.request,rc);});
        return res;
      });
    }).catch(function(){return caches.match("/portal/index.html");})
  );
});
