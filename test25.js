/* 학생을 교재(단어장)로 구분하기 */
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
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw', '1234');
  await p.click('#btnTLogin');
  await p.waitForTimeout(1200);

  /* ---------- 1. 학생 명단 ---------- */
  console.log('— 학생 명단 —');
  await 탭가기(p, 'roster');
  await p.waitForTimeout(800);
  const 명단표 = p.locator('.tb').first();
  const 머리 = (await 명단표.locator('thead th').allTextContents()).map(x => x.trim()).filter(Boolean);
  console.log('  표 머리:', 머리.join(' / '));
  확인('교재가 맨 앞', 머리[0], '교재');
  확인('이름이 그 다음', 머리[1], '이름');

  const 고르개 = await p.locator('#stFText option').allTextContents();
  console.log('  교재 고르개:', 고르개.map(x => x.trim()).join(' / '));
  확인('교재 없음도 고를 수 있다', 고르개.some(x => x.trim() === '교재 없음'), true);

  확인('처음엔 명단 전부', await 명단표.locator('tbody tr').count(),
    await p.evaluate(() => DEMO_배정.length));
  await p.selectOption('#stFText', '불규칙 동사 50');
  await p.waitForTimeout(500);
  /* 교재를 여러 권 배우면 여러 교재에 다 걸린다 (홍길동은 두 권) */
  확인('불규칙을 배우는 2명', await p.locator('.tb').first().locator('tbody tr').count(), 2);
  const 걸린 = (await p.locator('.tb').first().locator('tbody td.name').allTextContents())
    .map(x => x.trim());
  확인('두 권 배우는 학생도 걸린다', 걸린, ['홍길동', '이철수']);
  await p.selectOption('#stFText', '예시 단어장');
  await p.waitForTimeout(500);
  확인('다른 교재를 받은 학생만', await p.locator('.tb').first().locator('tbody tr').count(),
    await p.evaluate(() => DEMO_배정.filter(x => (x.교재||[]).indexOf('예시 단어장') > -1).length));
  const 두권 = (await p.locator('.tb').first().locator('tbody tr').first().innerText())
    .replace(/\s+/g, ' ').trim();
  console.log('  두 권 배우는 학생 줄:', 두권);
  확인('교재 칸에 두 권이 다 보인다',
    두권.indexOf('예시 단어장') > -1 && 두권.indexOf('불규칙 동사 50') > -1, true);
  await p.screenshot({ path: 'k1_roster_by_text.png' });

  /* 교재 바꾸기 */
  await p.selectOption('#stFText', '');
  await p.waitForTimeout(400);
  await p.locator('[data-sedit]').first().click();
  await p.waitForTimeout(400);
  확인('수정폼에 교재 체크박스가 단어장 수만큼 나온다', await p.locator('.sText').count(),
    await p.evaluate(() => DEMO.선생님요약().단어장목록.length));
  const 켜진 = await p.locator('.sText:checked').count();
  console.log('  첫 학생이 배우는 교재:', 켜진, '권');
  확인('여러 권이 켜져 있다', 켜진, 2);

  /* 한 권을 빼 본다 */
  await p.locator('.sText[value="불규칙 동사 50"]').uncheck();
  await p.locator('[data-ssave]').first().click();
  await p.waitForTimeout(1400);
  await p.selectOption('#stFText', '불규칙 동사 50');
  await p.waitForTimeout(500);
  확인('뺀 교재에서는 빠진다 (1명)', await p.locator('.tb').first().locator('tbody tr').count(), 1);

  /* 도로 두 권으로 */
  await p.selectOption('#stFText', '');
  await p.waitForTimeout(400);
  await p.locator('[data-sedit]').first().click();
  await p.waitForTimeout(400);
  await p.locator('.sText[value="불규칙 동사 50"]').check();
  await p.locator('[data-ssave]').first().click();
  await p.waitForTimeout(1400);
  await p.selectOption('#stFText', '불규칙 동사 50');
  await p.waitForTimeout(500);
  확인('다시 넣으면 도로 2명', await p.locator('.tb').first().locator('tbody tr').count(), 2);
  await p.selectOption('#stFText', '');
  await p.waitForTimeout(400);

  /* ---------- 2. 학생별 ---------- */
  console.log('\n— 학생별 —');
  await 탭가기(p, 'students');
  await p.waitForTimeout(700);
  const 머리2 = (await p.locator('.tb thead th').allTextContents()).map(x => x.trim()).filter(Boolean);
  console.log('  표 머리:', 머리2.join(' / '));
  확인('이름 다음이 교재', 머리2.slice(0, 2).join('/'), '이름/교재');
  확인('교재 고르개가 있다', await p.locator('#fText2').isVisible(), true);
  const 전 = await p.locator('.tb').first().locator('tbody tr').count();
  await p.selectOption('#fText2', '불규칙 동사 50');
  await p.waitForTimeout(600);
  const 후 = await p.locator('.tb').first().locator('tbody tr').count();
  console.log('  거르기 전', 전, '→ 후', 후);
  확인('교재로 줄어든다', 후 < 전, true);
  await p.selectOption('#fText2', '');
  await p.waitForTimeout(500);

  /* ---------- 3. 시험 결과 ---------- */
  console.log('\n— 시험 결과 —');
  await 탭가기(p, 'today');
  await p.waitForTimeout(700);
  const 머리3 = (await p.locator('.tb thead th').allTextContents()).map(x => x.trim()).filter(Boolean);
  console.log('  표 머리:', 머리3.join(' / '));
  확인('학생 다음이 교재', 머리3.slice(1, 3).join('/'), '학생/교재');
  확인('교재 고르개가 맨 앞', await p.locator('#fText').isVisible(), true);
  const 전3 = await p.locator('.tb tbody tr').count();
  await p.selectOption('#fText', '불규칙 동사 50');
  await p.waitForTimeout(600);
  const 후3 = await p.locator('.tb tbody tr').count();
  console.log('  거르기 전', 전3, '→ 후', 후3);
  확인('교재로 줄어든다', 후3 < 전3, true);
  await p.screenshot({ path: 'k2_results_by_text.png' });

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
