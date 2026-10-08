/* 앱(Capacitor)에서만 동작. 스플래시를 띄운 채 새 웹 번들이 있는지 확인하고, 있으면 갈아끼운다.
   hostname을 localhost가 아닌 값으로 둔 이유: index.html은 localhost면 데모 모드로 뜬다. */
(function () {
  'use strict';
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;

  var VERSION_URL = 'https://smarthb-english.github.io/Vocab/app-update/version.json';
  var TIMEOUT_MS = 20000;
  /* 번들러 없이 붙는 스크립트라 registerPlugin 대신 브리지를 직접 부른다 */
  function updater(method, opts) { return C.nativePromise('CapacitorUpdater', method, opts || {}); }

  /* 이걸 안 부르면 capgo가 이 번들을 깨진 것으로 보고 이전 번들로 되돌린다 */
  updater('notifyAppReady');

  var done = false;
  function start() { if (!done) { done = true; C.nativePromise('SplashScreen', 'hide', {}); } }
  setTimeout(start, TIMEOUT_MS);

  fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (v) {
      if (!v || !v.version || !v.url || v.version === window.앱버전) return start();
      return updater('download', { url: v.url, version: v.version }).then(function (b) {
        /* 20초를 넘겨 이미 시작했으면 다음 실행 때 적용 */
        return updater(done ? 'next' : 'set', { id: b.id });
      });
    })
    .catch(start);
})();
