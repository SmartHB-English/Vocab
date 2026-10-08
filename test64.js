/* 명단 넣기 — 넣자마자 바로 보이고, 반 칸이 비어도 사라지지 않는다 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
async function 묶음열기(p, 이름) {
  await p.evaluate(t => {
    var b = document.querySelector('[data-tab="' + t + '"]');
    var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]');
    if (g) g.click();
  }, 이름);
  await p.waitForTimeout(250);
}
async function 탭가기(p, 이름) {
  await 묶음열기(p, 이름);
  await p.click('[data-tab="' + 이름 + '"]');
  await p.waitForTimeout(1400);
}
const 명단글 = p => p.locator('#tBody').innerText();

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const t = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = [];
  t.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  t.on('dialog', d => d.accept());

  await t.goto(앱주소);
  await t.waitForTimeout(400);
  await t.click('#btnTeacherGo');
  await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  await 탭가기(t, 'roster');

  const 처음 = await t.evaluate(() => (T.명단 || []).length);
  console.log('— 처음 ' + 처음 + '명 —');

  console.log('\n— 명단 넣기를 누르면 바로 보인다 —');
  /* 명단을 다시 부르러 가는지 엿본다 — 다시 부르면 그만큼 느려진다 */
  await t.evaluate(() => {
    window.__부른것 = [];
    const 원래 = window.api;
    window.api = function (이름) { window.__부른것.push(이름); return 원래.apply(null, arguments); };
  });
  await t.fill('#stText', '연휴신입\n연휴신입둘 5678');
  await t.click('#btnSt');
  await t.waitForTimeout(1200);

  확인('두 명이 늘었다', await t.evaluate(() => (T.명단 || []).length), 처음 + 2);
  확인('표에 바로 뜬다', /연휴신입/.test(await 명단글(t)), true);
  확인('두 번째도 뜬다', /연휴신입둘/.test(await 명단글(t)), true);
  확인('명단을 다시 부르지 않는다',
    await t.evaluate(() => window.__부른것.filter(x => x === '명단가져오기').length), 0);
  확인('요약도 다시 안 부른다',
    await t.evaluate(() => window.__부른것.filter(x => x === '선생님요약').length), 0);
  확인('넣기 한 번만 부른다', await t.evaluate(() => window.__부른것), ['학생붙여넣기']);
  확인('적어 준 비밀번호가 들어간다',
    await t.evaluate(() => (T.명단.filter(x => x.이름 === '연휴신입둘')[0] || {}).비밀번호), '5678');
  await t.screenshot({ path: 'ro1_added.png' });

  console.log('\n— 다시 불러와도 안 사라진다 —');
  await t.evaluate(() => { T.명단 = null; });
  await t.click('[data-tab="roster"]');
  await t.waitForTimeout(1600);
  확인('그대로 있다', /연휴신입/.test(await 명단글(t)), true);
  확인('수는 그대로', await t.evaluate(() => (T.명단 || []).length), 처음 + 2);

  console.log('\n— 넣은 학생이 바로 로그인된다 —');
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  p.on('pageerror', e => errs.push('PAGEERROR(학생): ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    DEMO.학생붙여넣기('1234', '연휴신입', '1234', '초중등', '초5', '인왕초');
  });
  await p.fill('#inPw', '1234'); await p.fill('#inName', '연휴신입');
  await p.click('#btnLogin');
  await p.waitForTimeout(2200);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }
  확인('학생 화면으로 들어간다', await p.evaluate(() => 지금화면_()), 'home');

  console.log('\n— 같은 이름은 막는다 —');
  await t.fill('#stText', '연휴신입');
  await t.click('#btnSt');
  await t.waitForTimeout(900);
  확인('수가 안 늘어난다', await t.evaluate(() => (T.명단 || []).length), 처음 + 2);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
