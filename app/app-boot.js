/* 앱(Capacitor)에서만 동작. 「업데이트 확인 중」 화면을 띄우고 새 웹 번들이 있으면 받아서 갈아끼운다.
   hostname을 localhost가 아닌 값으로 둔 이유: index.html은 localhost면 데모 모드로 뜬다. */
(function () {
  'use strict';
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;

  var BUNDLE_VERSION = '__BUNDLE_VERSION__';   /* build-app.mjs가 파일 내용 해시로 채운다 */
  var VERSION_URL = 'https://smarthb-english.github.io/Vocab/app-update/version.json';
  var TIMEOUT_MS = 20000;

  /* 번들러 없이 붙는 스크립트라 registerPlugin 대신 브리지를 직접 부른다 */
  function updater(method, opts) { return C.nativePromise('CapacitorUpdater', method, opts || {}); }

  /* 이걸 안 부르면 capgo가 이 번들을 깨진 것으로 보고 이전 번들로 되돌린다 */
  updater('notifyAppReady');

  var box = document.createElement('div');
  box.setAttribute('role', 'status');
  box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#F6F4F1;display:flex;' +
    'flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:inherit;color:#1C1917';
  box.innerHTML = '<div style="font-size:30px;font-weight:800;letter-spacing:-.03em">해법 영단어</div>' +
    '<div id="abMsg" style="font-size:15px;color:#78716C">업데이트 확인 중…</div>' +
    '<div style="width:180px;height:4px;border-radius:2px;background:#E7E5E4;overflow:hidden">' +
    '<div id="abBar" style="width:0;height:100%;background:#FF9500;transition:width .2s"></div></div>';
  document.body.appendChild(box);
  var msg = box.querySelector('#abMsg'), bar = box.querySelector('#abBar');
  C.nativePromise('SplashScreen', 'hide', {});   /* 이제부터는 위 화면이 스플래시를 대신한다 */

  var done = false;
  function start() { if (!done) { done = true; box.remove(); } }
  setTimeout(start, TIMEOUT_MS);

  C.addListener('CapacitorUpdater', 'download', function (e) {
    var p = Math.round((e && e.percent) || 0);
    msg.textContent = '업데이트 중… ' + p + '%';
    bar.style.width = p + '%';
  });

  fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (v) {
      if (!v || !v.version || !v.url || !v.checksum || v.version === BUNDLE_VERSION) return start();
      msg.textContent = '업데이트 중… 0%';
      return updater('download', { url: v.url, version: v.version, checksum: v.checksum }).then(function (b) {
        if (done) return updater('next', { id: b.id });   /* 20초를 넘겼으면 다음 실행 때 적용 */
        msg.textContent = '업데이트 적용 중…';
        return updater('set', { id: b.id });               /* 새 번들로 다시 연다 */
      });
    })
    .catch(start);
})();
