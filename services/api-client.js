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
