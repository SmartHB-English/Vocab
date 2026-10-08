/* 기록 하나씩 빼기 + 시상 평균 항목 고르기 */
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
  const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw', '1234');
  await p.click('#btnTLogin');
  await p.waitForTimeout(1200);

  /* ---------- 1. 시험 결과에서 기록을 골라 빼기 ---------- */
  console.log('— 시험 결과 —');
  await 탭가기(p, 'today');
  await p.waitForTimeout(700);
  const 머리 = (await p.locator('.tb thead th').allTextContents()).map(x => x.trim()).filter(Boolean);
  console.log('  표 머리:', 머리.join(' / '));
  확인('집계 칸이 생겼다', 머리.indexOf('집계') > -1, true);
  확인('처음엔 다 넣음', await p.locator('.tb tbody .pill.off').count(), 0);
  확인('빼기 단추', await p.locator('#btnOut').isVisible(), true);
  확인('다시 넣기 단추', await p.locator('#btnIn').isVisible(), true);

  const 구분들 = (await p.locator('.tb tbody tr td:nth-child(9)').allTextContents()).map(x => x.trim());
  console.log('  구분 칩:', 구분들.join(' / '));
  확인('시험 칩이 보인다', 구분들.indexOf('시험') > -1, true);
  확인('보충/오답노트도 구분된다', 구분들.indexOf('오답노트') > -1, true);

  // 첫 줄을 골라 빼기
  await p.locator('.rowchk').first().check();
  await p.waitForTimeout(150);
  확인('고른 개수가 보인다', (await p.locator('#cleanCnt').textContent()).trim(), '1건 선택됨');
  await p.click('#btnOut');
  await p.waitForTimeout(1200);
  확인('한 줄이 빠졌다', await p.locator('.tb tbody .pill.off').count(), 1);
  확인('빠진 줄은 흐리게', await p.locator('.tb tbody tr.offrow').count(), 1);
  await p.screenshot({ path: 'j1_records_excluded.png' });

  // 다시 넣기
  await p.locator('tr.offrow .rowchk').first().check();
  await p.waitForTimeout(150);
  await p.click('#btnIn');
  await p.waitForTimeout(1200);
  확인('다시 넣으면 표시가 사라진다', await p.locator('.tb tbody .pill.off').count(), 0);

  /* ---------- 2. 시상 평균 항목 고르기 ---------- */
  console.log('\n— 이달의 시상 —');
  await 탭가기(p, 'award');
  await p.waitForTimeout(1100);
  const 고르개 = await p.locator('.awKind').evaluateAll(els => els.map(e => e.value).join(' / '));
  console.log('  고를 수 있는 항목:', 고르개);
  확인('항목 넷', 고르개, '숙제 / 시험 / 보충 / 오답노트');
  const 켜진것 = await p.locator('.awKind').evaluateAll(
    els => els.filter(e => e.checked).map(e => e.value).join(','));
  확인('처음엔 숙제만 켜짐', 켜진것, '숙제');
  확인('지금 기준을 글로 알려 준다',
    (await p.locator('.panel-b .sub').first().textContent()).indexOf('숙제') > -1, true);
  확인('제출률은 안 바뀐다고 알려 준다',
    (await p.locator('.panel-h .sub').first().textContent()).indexOf('제출률') > -1, true);

  // 시험을 켜고 적용
  await p.locator('.awKind[value="시험"]').check();
  await p.click('#btnKindSave');
  await p.waitForTimeout(1200);
  const 켜진것2 = await p.locator('.awKind').evaluateAll(
    els => els.filter(e => e.checked).map(e => e.value).join(','));
  console.log('  적용 뒤 켜진 항목:', 켜진것2);
  확인('시험이 켜진 채로 남는다', 켜진것2, '숙제,시험');
  확인('기준 글도 바뀐다',
    (await p.locator('.panel-b .sub').first().textContent()).indexOf('숙제 + 시험') > -1, true);
  await p.screenshot({ path: 'j2_award_kinds.png' });

  // 전부 끄면 막아야 한다
  await p.locator('.awKind[value="숙제"]').uncheck();
  await p.locator('.awKind[value="시험"]').uncheck();
  await p.click('#btnKindSave');
  await p.waitForTimeout(700);
  확인('전부 끄면 막는다', (await p.locator('.toast').textContent()).indexOf('한 가지는') > -1, true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
