/* BEGIN GENERATED services/api-client.js */
/* Single owner of the legacy HTTP RPC protocol. No automatic write retries. */
(function (root) {
  'use strict';

  var legacyEndpoint = 'https://script.google.com/macros/s/AKfycbw1xf6qkK3wQCeGqu2EIdGwwrqbzO0PGauKqoBXQqdQBSmW2YxFK2z_hu2ZSllDn7mg/exec';

  var firestoreReady;
  function firestore() {
    if (!firestoreReady) firestoreReady = Promise.resolve().then(function () {
      if (typeof importScripts === 'function') importScripts('./services/firestore.bundle.js');
      else return import('./services/firestore.bundle.js');
    }).then(function () { return root.VocabFirestore; });
    return firestoreReady;
  }

  function post(endpoint, fn, args) {
    if (endpoint === 'firestore:v1') return firestore().then(function (service) { return service.call(fn, args); }).then(function (value) { return {ok:true, 값:value}; });
    return fetch(endpoint, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args })
    }).then(function (response) { return response.json(); });
  }

  function request(endpoint, fn, args, failureMessage) {
    return post(endpoint, fn, args).then(function (response) {
      if (response && response.ok) return response.값;
      throw new Error((response && response.메시지) || failureMessage || '서버가 답하지 않았습니다');
    });
  }

  root.VocabApi = { legacyEndpoint: legacyEndpoint, defaultEndpoint: 'firestore:v1', post: post, request: request };
})(typeof self !== 'undefined' ? self : globalThis);
/* END GENERATED services/api-client.js */
/* 영단어학습프로그램 — 알림 일꾼(서비스 워커)
 * 알림이 오면 깨어나서, 스프레드시트에 무슨 공지가 있는지 물어본 뒤 띄운다.
 * 알림 안에 글을 실어 보내지 않으므로(빈 알림) 암호화가 필요 없다. */
var 칸이름 = '영단어학습-설정';

/* 2026-10-08 앱 이름을 「영단어학습프로그램」 으로 바꾸면서 저장 칸 이름도 바꿨다 (옛칸이름 → 칸이름).
   이미 설치한 기기의 옛 칸에 적힌 것을 activate 때 한 번 새 칸으로 옮기고 옛 칸은 지운다.
   모든 기기가 한 번씩 깨어난 뒤(한참 뒤) 이 상수와 옛칸옮기기_ 를 지운다.
   여기서 터지면 알림이 통째로 죽는다 — 무슨 일이 있어도 넘어간다 */
var 옛칸이름 = '해법영단어-설정';
function 옛칸옮기기_(){
  try{
    return caches.has(옛칸이름).then(function(있다){
      if(!있다) return;
      return Promise.all([caches.open(옛칸이름), caches.open(칸이름)]).then(function(둘){
        var 옛 = 둘[0], 새 = 둘[1];
        return 옛.keys().then(function(요청들){
          return Promise.all(요청들.map(function(q){
            return Promise.all([옛.match(q), 새.match(q)]).then(function(r){
              return (r[0] && !r[1]) ? 새.put(q, r[0]) : null;     /* 새 칸에 이미 있으면 새것이 맞다 */
            });
          }));
        });
      }).then(function(){ return caches.delete(옛칸이름); });
    }).catch(function(){});
  }catch(e){ return Promise.resolve(); }
}
var 내정보칸 = '/__내정보';

function 내정보(){
  return caches.open(칸이름).then(function(c){
    return c.match(내정보칸);
  }).then(function(r){
    return r ? r.json() : null;
  }).catch(function(){ return null; });
}

self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(옛칸옮기기_().then(function(){ return self.clients.claim(); }));
});

/* 화면이 '나 누구야' 하고 알려 주면 적어 둔다 */
self.addEventListener('message', function(e){
  var d = e.data || {};
  if(d.무엇 !== '내정보') return;
  e.waitUntil(caches.open(칸이름).then(function(c){
    return c.put(내정보칸, new Response(JSON.stringify(d.값),
      { headers:{'Content-Type':'application/json'} }));
  }));
});

self.addEventListener('push', function(e){
  e.waitUntil(내정보().then(function(me){
    var 기본 = { 제목:'영단어학습프로그램', 글:'선생님이 알림을 보냈어요.' };
    if(!me || !me.창구) return 띄우기(기본);
    return VocabApi.post(me.창구, '공지가져오기', [me.반]).then(function(r){
      var 목록 = (r && r.ok && r.값) || [];
      if(!목록.length) return 띄우기(기본);
      var n = 목록[0];
      return 띄우기({ 제목: n.제목 || '선생님 말씀', 글: n.내용 || '' });
    }).catch(function(){ return 띄우기(기본); });
  }));
});

function 띄우기(x){
  return self.registration.showNotification(x.제목, {
    body: x.글,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: '영단어학습프로그램',
    renotify: true,
    data: { 열기: './' }
  });
}

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var 갈곳 = (e.notification.data && e.notification.data.열기) || './';
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true })
    .then(function(창들){
      for(var i=0;i<창들.length;i++){
        if('focus' in 창들[i]) return 창들[i].focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow(갈곳);
    }));
});
