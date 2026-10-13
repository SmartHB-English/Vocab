/* 선생님 화면(teacher.html)의 일꾼 — 홈 화면에 설치하려고 둔다. 푸시는 없다.
   범위는 ./teacher.html 하나다 (teacher.html 이 {scope:'./teacher.html'} 로 띄운다) —
   학생 sw.js(./) · 학부모 parent-sw.js(./parent.html) 의 화면은 맡지 않는다.
   캐시는 「teacher-」 로 시작하는 것만 만들고 지운다 (캐시 칸은 같은 주소의 세 일꾼이 같이 쓴다).
   늘 새 판을 먼저 받는다 — 인터넷이 끊겼을 때만 마지막으로 받은 화면을 보여 준다. */
var 칸이름 = 'teacher-화면-1';

self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(이름들){
    return Promise.all(이름들.filter(function(n){ return n.indexOf('teacher-') === 0 && n !== 칸이름; })
      .map(function(n){ return caches.delete(n); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  var 요청 = e.request;
  if(요청.method !== 'GET' || 요청.mode !== 'navigate') return;
  var 주소 = new URL(요청.url);
  if(주소.origin !== self.location.origin || !/\/teacher\.html$/.test(주소.pathname)) return;
  e.respondWith(fetch(요청).then(function(답){
    if(답 && 답.ok){ var 사본 = 답.clone(); caches.open(칸이름).then(function(c){ return c.put('teacher.html', 사본); }); }
    return 답;
  }).catch(function(){
    return caches.open(칸이름).then(function(c){ return c.match('teacher.html'); })
      .then(function(있음){ return 있음 || Response.error(); });
  }));
});
