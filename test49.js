/* 휴대폰 알림 — 선생님 준비/현황 · 공지 올릴 때 같이 보내기 · 학생 켜기 줄 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');

/* 선생님 화면 탭은 묶음(오늘/숙제/학생/자료) 아래로 숨어 있다 — 묶음을 먼저 펼쳐야 보인다 */
async function 묶음열기(p, 이름){
  await p.evaluate(t => {
    var b = document.querySelector('[data-tab="' + t + '"]');
    var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]');
    if (g) g.click();
  }, 이름);
  await p.waitForTimeout(250);
}
async function 탭가기(p, 이름){
  await 묶음열기(p, 이름);
  await p.click('[data-tab="' + 이름 + '"]');
}
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const errs = [];

  /* ================= 선생님 ================= */
  const t = await b.newPage({ viewport: { width: 1500, height: 1050 } });
  t.on('pageerror', e => errs.push('ERR(선생님) ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소);
  await t.waitForTimeout(400);
  await t.click('#btnTeacherGo');
  await t.fill('#tPw', '1234');
  await t.click('#btnTLogin');
  await t.waitForTimeout(1400);
  await 탭가기(t, 'notice');
  await t.waitForTimeout(1300);

  console.log('— 아직 준비 안 했을 때 —');
  확인('준비하기 단추가 있다', await t.locator('#btnPushKey').isVisible(), true);
  확인('처음엔 「알림 준비하기」',
    (await t.locator('#btnPushKey').textContent()).trim(), '알림 준비하기');
  확인('체크는 잠겨 있다', await t.locator('#ncPush').isDisabled(), true);
  const 안내 = (await t.locator('.pushline').innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 안내);
  확인('먼저 준비하라고 알려 준다', 안내.indexOf('알림 준비하기') > -1, true);
  await t.screenshot({ path: 'y1_push_before.png' });

  console.log('\n— 열쇠 만들기 —');
  await t.click('#btnPushKey');
  await t.waitForTimeout(2200);
  확인('준비했다고 알려 준다',
    (await t.locator('.toast').textContent()).indexOf('알림을 준비했습니다') > -1, true);
  const 열쇠 = await t.evaluate(() => DEMO_열쇠.공개키);
  console.log('  공개키 길이:', 열쇠.length);
  확인('공개키가 저장된다', 열쇠.length > 80, true);
  확인('압축 안 한 P-256 공개키(65바이트)', [열쇠.length, 열쇠[0]], [87, 'B']);

  console.log('\n— 켠 학생 수가 보인다 —');
  await t.waitForTimeout(600);
  const 큰수 = (await t.locator('.bigno').innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 큰수);
  확인('몇 / 몇 명 켬', 큰수,
    '2 / ' + (await t.evaluate(() => DEMO_배정.length)) + '명 켬');
  확인('막대가 찬다',
    await t.locator('.pbar i').first().evaluate(e => e.getBoundingClientRect().width > 0), true);
  확인('반별 줄은 없앴다', await t.locator('.prow').count(), 0);

  const 안켠 = (await t.locator('.nochip').allInnerTexts()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  안 켠 학생:', 안켠.join(' / '));
  확인('안 켠 학생을 이름으로 보여 준다', 안켠.length,
    (await t.evaluate(() => DEMO_배정.length)) - 2);
  확인('누군지 알 수 있다', 안켠[0].indexOf('이철수') > -1, true);
  확인('단추가 「다시 준비하기」로 바뀐다',
    (await t.locator('#btnPushKey').textContent()).trim(), '알림 다시 준비하기');
  await t.screenshot({ path: 'y2_push_after.png' });

  console.log('\n— 공지에 같이 보내기 —');
  확인('체크가 풀린다', await t.locator('#ncPush').isDisabled(), false);
  확인('기본으로 켜져 있다', await t.locator('#ncPush').isChecked(), true);
  const 안내2 = (await t.locator('.pushline').innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 안내2);
  확인('몇 명에게 갈지 알려 준다', /2명/.test(안내2), true);

  await t.fill('#ncTitle', '오늘 숙제 꼭 하기');
  await t.fill('#ncBody', '자기 전에 꼭 끝내 주세요.');
  const 전 = await t.locator('.tb tbody tr').count();
  await t.click('#btnNcAdd');
  await t.waitForTimeout(2200);
  const 말 = (await t.locator('.toast').textContent()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 말);
  확인('목록에 올라간다', await t.locator('.tb tbody tr').count(), 전 + 1);
  확인('몇 명에게 보냈는지 알려 준다', /2명에게 알림을 보냈습니다/.test(말), true);

  console.log('\n— 체크를 풀면 알림은 안 간다 —');
  await t.uncheck('#ncPush');
  await t.fill('#ncTitle', '조용한 공지');
  await t.click('#btnNcAdd');
  await t.waitForTimeout(1600);
  const 말2 = (await t.locator('.toast').textContent()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 말2);
  확인('알림 얘기는 없다', 말2.indexOf('알림') > -1, false);
  확인('앱을 열면 뜬다고만', 말2.indexOf('앱을 열면') > -1, true);

  /* ================= 학생 ================= */
  console.log('\n— 학생 화면의 알림 켜기 줄 —');
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errs.push('ERR(학생) ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234');
  await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }

  확인('알림 칸이 홈에 있다', await p.locator('#bellBox').count(), 1);
  const 벨 = await p.locator('.bellbar').count();
  console.log('  알림 줄:', 벨, '개');
  확인('브라우저가 받쳐 주면 줄이 뜬다', 벨 <= 1, true);
  if (벨) {
    const 글 = (await p.locator('.bellbar').innerText()).replace(/\s+/g, ' ').trim();
    console.log('  ' + 글);
    확인('무엇을 하는 줄인지 적혀 있다', /알림/.test(글), true);
  }
  await p.screenshot({ path: 'y3_bell.png' });

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
