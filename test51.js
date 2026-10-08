/* 선생님이 열쇠를 새로 만들어도, 아이가 앱을 열면 앱이 알아서 맞춘다 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(앱주소);
  await p.waitForTimeout(600);

  console.log('— 열쇠가 같은지 알아본다 —');
  const r = await p.evaluate(() => {
    const 키를버퍼로 = s => {
      const pad = '='.repeat((4 - s.length % 4) % 4);
      const raw = atob((s + pad).replace(/-/g,'+').replace(/_/g,'/'));
      const a = new Uint8Array(raw.length);
      for (let i=0;i<raw.length;i++) a[i] = raw.charCodeAt(i);
      return a.buffer;
    };
    const 열쇠A = 'BE'+'A'.repeat(85);
    const 열쇠B = 'BE'+'B'.repeat(85);
    return {
      같으면_참: 열쇠같나_({options:{applicationServerKey:키를버퍼로(열쇠A)}}, 열쇠A),
      다르면_거짓: 열쇠같나_({options:{applicationServerKey:키를버퍼로(열쇠A)}}, 열쇠B),
      모르면_건드리지않음: 열쇠같나_({options:{}}, 열쇠A),
      옵션없어도_안터짐: 열쇠같나_({}, 열쇠A)
    };
  });
  확인('같은 열쇠면 그대로 둔다', r.같으면_참, true);
  확인('열쇠가 바뀌면 다시 맞춘다', r.다르면_거짓, false);
  확인('알 수 없으면 건드리지 않는다', r.모르면_건드리지않음, true);
  확인('정보가 없어도 안 터진다', r.옵션없어도_안터짐, true);

  console.log('\n— 바뀌었으면 옛것을 끄고 새로 켠다 —');
  const w = await p.evaluate(async () => {
    const 한일 = [];
    const 키를버퍼로 = s => {
      const pad = '='.repeat((4 - s.length % 4) % 4);
      const raw = atob((s + pad).replace(/-/g,'+').replace(/_/g,'/'));
      const a = new Uint8Array(raw.length);
      for (let i=0;i<raw.length;i++) a[i] = raw.charCodeAt(i);
      return a.buffer;
    };
    const 새열쇠 = 'BE'+'C'.repeat(85);
    window.알림 = window.알림 || {}; 알림.공개키 = 새열쇠;
    window.S = window.S || {}; S.학생 = {이름:'홍길동'};
    const 원래 = window.api;
    window.api = function(fn, a1){ 한일.push(fn + (fn==='구독해제' ? ':' + a1 : '')); 
      return Promise.resolve({ok:true}); };
    const 예전 = { endpoint:'https://fcm.example/OLD',
      options:{applicationServerKey:키를버퍼로('BE'+'D'.repeat(85))},
      unsubscribe: () => { 한일.push('예전끄기'); return Promise.resolve(true); } };
    const 일꾼 = { pushManager: { subscribe: () => { 한일.push('새로켜기');
      return Promise.resolve({ endpoint:'https://fcm.example/NEW',
        toJSON: () => ({keys:{p256dh:'P', auth:'A'}}) }); } } };
    const 결과 = await 열쇠다시맞추기_(일꾼, 예전);
    window.api = 원래;
    return { 한일, 새주소: 결과 && 결과.endpoint };
  });
  console.log('  한 일:', w.한일.join(' → '));
  확인('예전 것을 먼저 끈다', w.한일[0], '예전끄기');
  확인('새 열쇠로 다시 켠다', w.한일[1], '새로켜기');
  확인('시트에서 옛 주소를 지운다', w.한일.indexOf('구독해제:https://fcm.example/OLD') > -1, true);
  확인('새 주소를 시트에 적는다', w.한일.indexOf('구독등록') > -1, true);
  확인('새 구독을 돌려준다', w.새주소, 'https://fcm.example/NEW');

  console.log('\n— 표(JWT)의 sub 는 진짜 주소여야 한다 —');
  const v = await p.evaluate(async () => {
    const 쌍 = await crypto.subtle.generateKey({name:'ECDSA', namedCurve:'P-256'}, true, ['sign']);
    const jwk = await crypto.subtle.exportKey('jwk', 쌍.privateKey);
    const 표 = await 알림표_(JSON.stringify(jwk), 'https://fcm.googleapis.com');
    const 속 = JSON.parse(atob(표.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return 속.sub;
  });
  console.log('  sub:', v);
  확인('http(s) 나 mailto 로 시작한다', /^(https?:|mailto:)/.test(v), true);
  확인('가짜 .local 도메인은 안 쓴다', /\.local/.test(v), false);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
