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
/* 해법 영단어 학부모 — 알림 일꾼(서비스 워커)
 * 내보낼 때 H:\haebeop-vocab\parent-sw.js 로 그대로 복사한다 (저장소 맨 위, 학생 앱의 sw.js 와 따로).
 * parent.html 이 범위를 「./parent.html」 로 좁혀 등록한다 — 학생 앱(index.html)의 알림 일꾼을 건드리지 않게.
 * 알림이 오면 깨어나서, 우리 아이 숙제가 몇 개 남았는지 물어본 뒤 띄운다.
 * 알림 안에 글을 실어 보내지 않으므로(빈 알림) 암호화가 필요 없다.
 * 묻는 것은 학부모보기(토큰, 알림만) — 이름과 안 낸 숙제 수만 받는다. 「본 때」 는 안 적힌다. */
var 칸이름 = '해법학부모-설정';
var 내정보칸 = '/__학부모정보';

function 내정보(){
  return caches.open(칸이름).then(function(c){
    return c.match(내정보칸);
  }).then(function(r){
    return r ? r.json() : null;
  }).catch(function(){ return null; });
}

self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
/* fetch 는 가로채지 않는다 — 늘 새 자료를 본다 (빈 fetch 손잡이는 오히려 느리게 한다) */

/* 화면이 「창구 · 토큰 · 주소」 를 알려 주면 적어 둔다 */
self.addEventListener('message', function(e){
  var d = e.data || {};
  if(d.무엇 !== '내정보') return;
  e.waitUntil(caches.open(칸이름).then(function(c){
    return c.put(내정보칸, new Response(JSON.stringify(d.값),
      { headers:{'Content-Type':'application/json'} }));
  }));
});

function 배지(n){
  try{
    if(!self.navigator || !('setAppBadge' in self.navigator)) return Promise.resolve();
    return (n ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge()).catch(function(){});
  }catch(e){ return Promise.resolve(); }
}

self.addEventListener('push', function(e){
  e.waitUntil(내정보().then(function(me){
    var 기본 = { 제목:'해법 영단어', 글:'아이의 학습 소식이 있어요.' };
    if(!me || !me.창구 || !me.토큰) return 띄우기(기본, me);
    return VocabApi.post(me.창구, '학부모보기', [me.토큰, true]).then(function(r){
      var v = r && r.ok && r.값;
      if(!v || !v.ok) return 띄우기(기본, me);
      var n = Number(v.안낸수) || 0;
      return 배지(n).then(function(){
        return 띄우기({ 제목: v.이름 + ' 학습 소식',
                       글: n ? '아직 안 낸 숙제가 ' + n + '개 있어요.' : '이번 주 숙제를 다 냈어요.' }, me);
      });
    }).catch(function(){ return 띄우기(기본, me); });
  }));
});

function 띄우기(x, me){
  return self.registration.showNotification(x.제목, {
    body: x.글,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: '해법학부모',
    renotify: true,
    data: { 열기: (me && me.주소) || './parent.html' }      /* 토큰이 든 주소로 연다 — 「./」 만 열면 토큰이 없다 */
  });
}

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var 갈곳 = (e.notification.data && e.notification.data.열기) || './parent.html';
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true })
    .then(function(창들){
      for(var i=0;i<창들.length;i++){
        if('focus' in 창들[i]) return 창들[i].focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow(갈곳);
    }));
});
