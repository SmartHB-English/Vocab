/* 알림 보내기 — 표(JWT)는 브라우저가 만들고, 보내는 일은 서버가 한다 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
const fs = require('fs'), vm = require('vm');
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

/* ===== 1. 서버쪽 푸시전송 ===== */
console.log('— 서버가 보낸다 (Code.gs) —');
const src = fs.readFileSync(require('path').join(__dirname, 'Code.gs'), 'utf8');
let 받은요청 = null;
const ctx = {
  console,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => null }) },
  Utilities: { formatDate: () => '' },
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  UrlFetchApp: {
    fetchAll(요청) {
      받은요청 = 요청;
      return 요청.map((r, i) => ({
        getResponseCode: () => (i === 0 ? 201 : 410),
        getContentText: () => (i === 0 ? '' : 'gone')
      }));
    }
  }
};
vm.createContext(ctx);
vm.runInContext(src, ctx);
ctx.선생님확인_ = (pw) => pw === '1234';

let r = ctx.푸시전송('1234', [
  { 주소: 'https://fcm.googleapis.com/fcm/send/AAA', 표: 'JWT1', 공개키: 'KEY' },
  { 주소: 'https://web.push.apple.com/BBB',           표: 'JWT2', 공개키: 'KEY' }
]);
확인('두 건 다 답이 온다', r.줄.length, 2);
확인('성공은 201', r.줄[0].상태, 201);
확인('끝난 구독은 410', r.줄[1].상태, 410);
확인('POST 로 보낸다', 받은요청[0].method, 'post');
확인('TTL 을 붙인다', 받은요청[0].headers.TTL, '86400');
확인('표와 열쇠를 인증에 싣는다', 받은요청[0].headers.Authorization, 'vapid t=JWT1, k=KEY');
확인('몸통은 비운다 (글 없는 알림)', 받은요청[0].payload, '');
확인('오류도 답으로 받는다 (멈추지 않게)', 받은요청[0].muteHttpExceptions, true);
확인('비밀번호가 틀리면 막는다', ctx.푸시전송('x', [{주소:'a'}]).ok, false);
확인('보낼 게 없으면 조용히', ctx.푸시전송('1234', []).줄, []);
확인('열린기능에 올라가 있다', typeof ctx.열린기능_.푸시전송, 'function');

/* ===== 2. 브라우저가 만든 표(JWT) ===== */
(async () => {
  console.log('\n— 표(JWT)는 브라우저가 만든다 —');
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(앱주소);
  await p.waitForTimeout(600);

  const v = await p.evaluate(async () => {
    /* 열쇠 한 쌍 만들고, 그 비밀키로 표를 만든다 */
    const 쌍 = await crypto.subtle.generateKey({name:'ECDSA', namedCurve:'P-256'}, true, ['sign','verify']);
    const jwk = await crypto.subtle.exportKey('jwk', 쌍.privateKey);
    const 표 = await 알림표_(JSON.stringify(jwk), 'https://fcm.googleapis.com');
    const 쪽 = 표.split('.');
    const 풀기 = t => JSON.parse(atob(t.replace(/-/g,'+').replace(/_/g,'/')));
    /* 서명이 진짜 맞는지 공개키로 확인 */
    const sig = (function(t){
      const p='='.repeat((4-t.length%4)%4);
      const raw=atob((t+p).replace(/-/g,'+').replace(/_/g,'/'));
      const a=new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++) a[i]=raw.charCodeAt(i);
      return a;
    })(쪽[2]);
    const 맞나 = await crypto.subtle.verify({name:'ECDSA', hash:'SHA-256'}, 쌍.publicKey, sig,
      new TextEncoder().encode(쪽[0]+'.'+쪽[1]));
    return { 쪽수:쪽.length, 머리:풀기(쪽[0]), 속:풀기(쪽[1]), 서명길이:sig.length, 맞나:맞나 };
  });
  확인('점 두 개로 나뉜 표', v.쪽수, 3);
  확인('ES256 으로 서명', [v.머리.typ, v.머리.alg], ['JWT','ES256']);
  확인('받는 곳은 알림 서버 주소', v.속.aud, 'https://fcm.googleapis.com');
  확인('기한이 붙는다', v.속.exp > Math.floor(Date.now()/1000), true);
  확인('하루를 넘지 않는다', v.속.exp - Math.floor(Date.now()/1000) <= 86400, true);
  확인('연락처가 붙는다', /^mailto:/.test(v.속.sub), true);
  확인('서명은 64바이트 (r+s)', v.서명길이, 64);
  확인('공개키로 서명이 검증된다', v.맞나, true);

  console.log('\n— 같은 알림 서버면 표를 한 번만 만든다 —');
  const 묶 = await p.evaluate(async () => {
    const 보냄 = [];
    const 원래 = window.api;
    window.T = window.T || {}; window.T.pw = '1234';
    window.api = function(fn, pw, 값){
      if(fn==='푸시전송'){ 보냄.push(값); return Promise.resolve({ok:true,
        줄: 값.map(()=>({상태:201, 글:''}))}); }
      return 원래.apply(null, arguments);
    };
    const 쌍 = await crypto.subtle.generateKey({name:'ECDSA', namedCurve:'P-256'}, true, ['sign']);
    const jwk = await crypto.subtle.exportKey('jwk', 쌍.privateKey);
    await 알림쏘기([
      {주소:'https://fcm.googleapis.com/fcm/send/A', 이름:'홍길동', 기기:'Android'},
      {주소:'https://fcm.googleapis.com/fcm/send/B', 이름:'김영희', 기기:'Android'},
      {주소:'https://web.push.apple.com/C',          이름:'이철수', 기기:'iPhone'}
    ], {공개키:'PUB', 비밀키:JSON.stringify(jwk)});
    window.api = 원래;
    const 것 = 보냄[0];
    return { 건수:것.length, 표들:것.map(x=>x.표) };
  });
  확인('세 건 모두 보낸다', 묶.건수, 3);
  확인('같은 서버 둘은 같은 표', 묶.표들[0] === 묶.표들[1], true);
  확인('다른 서버는 다른 표', 묶.표들[0] === 묶.표들[2], false);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
