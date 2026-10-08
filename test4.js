/* 학생 명단에 여러 명 한꺼번에 넣기 (반 없이 이름만) */
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
  const p = await b.newPage({ viewport: { width: 1500, height: 1050 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw', '1234'); await p.click('#btnTLogin');
  await p.waitForTimeout(1200);
  await 탭가기(p, 'roster');
  await p.waitForTimeout(1100);

  console.log('— 반 고르는 칸은 사라졌다 —');
  확인('반 고르개 없음', await p.locator('#stClass').count(), 0);
  확인('새 반 만들기 칸도 없음', await p.locator('#stNewWrap').count(), 0);
  확인('반 관리 칸도 없음', await p.locator('[data-cren]').count(), 0);
  확인('이름 목록 칸은 있다', await p.locator('#stText').isVisible(), true);
  확인('학년·학교는 그대로', await p.locator('#stGrade').isVisible(), true);

  const 처음 = await p.locator('.tb tbody tr').count();
  console.log('  지금 학생:', 처음, '명');
  await p.screenshot({ path: 'r1_roster.png' });

  console.log('\n— 이름만 적어 넣기 —');
  await p.fill('#stGrade', '중3');
  await p.fill('#stSchool', '인왕중');
  await p.fill('#stText', '박지훈\n최수아 5678');
  await p.click('#btnSt');
  await p.waitForTimeout(1600);
  const 나중 = await p.locator('.tb tbody tr').count();
  console.log('  넣은 뒤:', 나중, '명');
  확인('두 명이 늘어난다', 나중, 처음 + 2);
  const 글 = (await p.locator('.tb tbody').innerText()).replace(/\s+/g, ' ');
  확인('박지훈이 들어왔다', 글.indexOf('박지훈') > -1, true);
  확인('최수아도 들어왔다', 글.indexOf('최수아') > -1, true);
  확인('뒤에 적은 비밀번호가 들어간다', 글.indexOf('5678') > -1, true);
  await p.screenshot({ path: 'r2_added.png' });

  console.log('\n— 같은 이름은 막는다 —');
  await p.fill('#stText', '박지훈');
  await p.click('#btnSt');
  await p.waitForTimeout(1400);
  확인('학생 수가 안 늘어난다', await p.locator('.tb tbody tr').count(), 나중);
  const 말 = (await p.locator('.toast').textContent()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 말);
  확인('이미 있는 이름이라고 알려 준다', /이미 있는 이름/.test(말), true);

  console.log('\n— 빈 칸이면 막는다 —');
  await p.fill('#stText', '');
  await p.click('#btnSt');
  await p.waitForTimeout(700);
  확인('이름을 적으라고 한다',
    (await p.locator('.toast').textContent()).indexOf('이름을 적어') > -1, true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
