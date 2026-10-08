/* 학생 명단 — 교재를 한꺼번에 주기 (한 명씩 안 고쳐도 되게) */
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
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw', '1234');
  await p.click('#btnTLogin');
  await p.waitForTimeout(1400);
  await 탭가기(p, 'roster');
  await p.waitForTimeout(1100);

  const 표 = () => p.locator('.tb').nth(0);
  const 줄들 = async () => (await 표().locator('tbody tr').allInnerTexts())
    .map(x => x.replace(/\s+/g, ' ').trim());
  const 교재of = async (이름) => (await 줄들()).filter(x => x.indexOf(이름) > -1)[0] || '';

  console.log('— 칸이 생겼나 —');
  확인('한꺼번에 주기 칸', await p.locator('[data-bulktx]').count(), 3);
  const 단추 = (await p.locator('[data-bulktx]').allTextContents()).map(x => x.trim());
  console.log('  ' + 단추.join(' / '));
  확인('추가·빼기·덮어쓰기', 단추.map(x => x.replace(/^[＋−]\s*/, '')),
    ['추가하기', '빼기', '이대로 덮어쓰기']);
  확인('교재 고르개가 칩으로 (단어장 수만큼)', await p.locator('.bkText').count(),
    await p.evaluate(() => DEMO.선생님요약().단어장목록.length));
  const 인원 = await p.evaluate(() => DEMO_배정.length);
  확인('줄마다 네모칸', await p.locator('.stPick').count(), 인원);
  확인('머리에 전체 선택', await p.locator('#stPickAll').isVisible(), true);

  const 처음 = (await p.locator('.panel-b .sub').first().innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 처음);
  확인('아무것도 안 고르면 보이는 학생 전부',
    new RegExp('보이는 ' + 인원 + '명 전부').test(처음), true);

  console.log('\n— 반으로 걸러 한 번에 주기 —');
  await p.selectOption('#stFClass', '초중등부');
  await p.waitForTimeout(600);
  확인('중2 A반 두 명만 보인다', (await 줄들()).length, 2);
  const 대상글 = (await p.locator('.panel-b .sub').first().innerText()).replace(/\s+/g, ' ').trim();
  확인('대상도 2명으로 줄어든다', /보이는 2명 전부/.test(대상글), true);

  await p.locator('.bkText[value="불규칙 동사 50"]').check();
  await p.click('[data-bulktx="추가"]');
  await p.waitForTimeout(1500);
  확인('김영희에게 불규칙이 붙는다',
    (await 교재of('김영희')).indexOf('불규칙 동사 50') > -1, true);
  확인('원래 있던 예시 단어장은 그대로',
    (await 교재of('김영희')).indexOf('예시 단어장') > -1, true);
  await p.screenshot({ path: 'g1_bulk.png' });

  await p.selectOption('#stFClass', '');
  await p.waitForTimeout(600);
  확인('다른 반 학생은 안 건드린다',
    (await 교재of('이철수')).indexOf('예시 단어장') > -1, false);

  console.log('\n— 고른 학생에게만 —');
  const 김줄 = 표().locator('tbody tr').filter({ hasText: '김영희' });
  await 김줄.locator('.stPick').check();
  await p.waitForTimeout(500);
  const 고른글 = (await p.locator('.panel-b .sub').first().innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 고른글);
  확인('고른 학생 수가 뜬다', /고른 학생 1명/.test(고른글), true);
  확인('고른 것 풀기 단추', await p.locator('#btnStPickNone').isVisible(), true);

  await p.locator('.bkText[value="예시 단어장"]').check();
  await p.click('[data-bulktx="빼기"]');
  await p.waitForTimeout(1500);
  확인('김영희에게서 예시가 빠진다',
    (await 교재of('김영희')).indexOf('예시 단어장') > -1, false);
  확인('불규칙은 남는다', (await 교재of('김영희')).indexOf('불규칙 동사 50') > -1, true);
  확인('홍길동은 그대로', (await 교재of('홍길동')).indexOf('예시 단어장') > -1, true);
  확인('끝나면 고른 것이 풀린다', await p.locator('.stPick:checked').count(), 0);

  console.log('\n— 전부 골라 덮어쓰기 —');
  await p.locator('#stPickAll').check();
  await p.waitForTimeout(500);
  확인('보이는 학생이 다 골라진다', await p.locator('.stPick:checked').count(), 인원);
  await p.locator('.bkText[value="예시 단어장"]').check();
  await p.click('[data-bulktx="덮어쓰기"]');
  await p.waitForTimeout(1500);
  const 전부 = await 줄들();
  console.log('  ' + 전부.map(x => x.slice(0, 40)).join(' | '));
  확인('모두 예시 단어장 하나로',
    전부.every(x => x.indexOf('예시 단어장') > -1 && x.indexOf('불규칙 동사 50') < 0), true);
  await p.screenshot({ path: 'g2_bulk_all.png' });

  console.log('\n— 막아야 할 것 —');
  await p.click('[data-bulktx="추가"]');          // 교재를 안 골랐다
  await p.waitForTimeout(700);
  확인('교재를 안 고르면 알려 준다',
    (await p.locator('.toast').textContent()).indexOf('교재를 골라') > -1, true);

  console.log('\n— 한 명만 고치는 것도 그대로 —');
  await p.locator('[data-sedit]').first().click();
  await p.waitForTimeout(600);
  확인('수정폼의 체크박스 (단어장 수만큼)', await p.locator('.sText').count(),
    await p.evaluate(() => DEMO.선생님요약().단어장목록.length));
  await p.locator('.sText[value="불규칙 동사 50"]').check();
  await p.locator('[data-ssave]').first().click();
  await p.waitForTimeout(1500);
  확인('한 명만 두 권이 된다',
    (await 교재of('홍길동')).indexOf('불규칙 동사 50') > -1, true);
  확인('다른 학생은 그대로',
    (await 교재of('김영희')).indexOf('불규칙 동사 50') > -1, false);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
