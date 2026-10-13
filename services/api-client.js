/* Single owner of the legacy HTTP RPC protocol.
   쓰기 재시도는 Firestore 쪽에서만, 저장소가 「다시 보내도 됨」 표시를 붙인 실패(쓰기 거래가 밀림 · 잠깐 끊김)에만 한다.
   한 번의 request 동안 요청번호가 같다 — journal 영수증이 있으니 먼저 것이 실은 들어갔어도 두 번 저장되지 않는다.
   읽기 실패 · 거절({ok:false} 답) · 예전 HTTP 창구는 다시 보내지 않는다. */
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

  function post(endpoint, fn, args, number, again) {
    if (endpoint === 'firestore:v1') return firestore().then(function (service) { return service.call(fn, args, {요청번호: number, 다시보냄: !!again}); }).then(function (value) { return {ok:true, 값:value}; });
    return fetch(endpoint, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args })
    }).then(function (response) { return response.json(); });
  }

  function newRequestNumber() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
  }

  // 0.5초 → 1.5초 → 3초, 세 번까지. 다 같이 다시 보내면 또 몰리므로 ±30% 를 섞는다.
  var retryDelays = [500, 1500, 3000];
  function retryable(error) { return !!(error && error.다시보내도됨 === true); }

  function request(endpoint, fn, args, failureMessage, number) {
    var firestore = endpoint === 'firestore:v1';
    if (firestore && !number) number = newRequestNumber();
    var tries = 0;
    function attempt() {
      return post(endpoint, fn, args, number, tries > 0).then(function (response) {
        if (response && response.ok) return response.값;
        throw new Error((response && response.메시지) || failureMessage || '서버가 답하지 않았습니다');
      }, function (error) {
        if (!firestore || !retryable(error) || tries >= retryDelays.length) throw error;
        var wait = Math.round(retryDelays[tries++] * (0.7 + Math.random() * 0.6));
        return new Promise(function (resolve) { root.setTimeout(resolve, wait); }).then(attempt);
      });
    }
    return attempt();
  }

  root.VocabApi = { legacyEndpoint: legacyEndpoint, defaultEndpoint: 'firestore:v1', post: post, request: request, newRequestNumber: newRequestNumber, retryDelays: retryDelays };
})(typeof self !== 'undefined' ? self : globalThis);
