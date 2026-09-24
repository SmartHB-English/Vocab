/* 해법 영단어 — 알림 일꾼(서비스 워커)
 * 알림이 오면 깨어나서, 스프레드시트에 무슨 공지가 있는지 물어본 뒤 띄운다.
 * 알림 안에 글을 실어 보내지 않으므로(빈 알림) 암호화가 필요 없다. */
var 칸이름 = '해법영단어-설정';
var 내정보칸 = '/__내정보';

function 내정보(){
  return caches.open(칸이름).then(function(c){
    return c.match(내정보칸);
  }).then(function(r){
    return r ? r.json() : null;
  }).catch(function(){ return null; });
}

self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

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
    var 기본 = { 제목:'해법 영단어', 글:'선생님이 알림을 보냈어요.' };
    if(!me || !me.창구) return 띄우기(기본);
    return fetch(me.창구, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({ fn:'공지가져오기', args:[me.반] })
    }).then(function(r){ return r.json(); }).then(function(r){
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
    tag: '해법영단어',
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
