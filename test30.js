/* 마감 지나도록 안 낸 숙제 — 목록이 길어지지 않게 */
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

  await 탭가기(p, 'miss');
  await p.waitForTimeout(800);

  console.log('— 안 한 학생 —');
  const 패널 = (await p.locator('.panel-h').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  패널:', 패널.join(' | ').slice(0, 160));
  const 지난패널 = 패널.find(x => x.indexOf('마감 지나도록') > -1);
  확인('마감 지난 패널이 있다', !!지난패널, true);
  확인('몇 건인지 제목에 나온다', /마감 지나도록 안 낸 숙제 \d+건/.test(지난패널), true);
  확인('몇 명인지도 알려 준다', /학생 \d+명/.test(지난패널), true);

  /* 기본은 접혀 있어야 한다 */
  확인('기본은 접혀 있다', await p.locator('#btnMisOld').textContent().then(t => t.indexOf('펼치기') > -1), true);
  const 표수 = await p.locator('.tb').count();
  console.log('  펼치기 전 표 수:', 표수);
  await p.screenshot({ path: 'q1_miss_folded.png' });

  /* 펼치기 */
  await p.click('#btnMisOld');
  await p.waitForTimeout(500);
  확인('펼치면 접기로 바뀐다', (await p.locator('#btnMisOld').textContent()).trim(), '접기');
  const 표수2 = await p.locator('.tb').count();
  console.log('  펼친 뒤 표 수:', 표수2);
  확인('표가 하나 늘어난다', 표수2, 표수 + 1);

  /* 기간 고르개 — 2주가 기본, 넓히면 줄이 는다 */
  확인('기간 고르개가 있다', await p.locator('#misOld').isVisible(), true);
  확인('기본은 최근 2주', await p.locator('#misOld').inputValue(), '14');
  const 지난표 = p.locator('.cols > div').first().locator('.tb').nth(1);
  const 줄2주 = await 지난표.locator('tbody tr').count();
  console.log('  최근 2주:', 줄2주, '줄');
  await p.selectOption('#misOld', '0');
  await p.waitForTimeout(500);
  const 줄전체 = await p.locator('.cols > div').first().locator('.tb').nth(1)
    .locator('tbody tr').count();
  console.log('  전체:', 줄전체, '줄');
  확인('전체로 넓히면 줄이 는다', 줄전체 > 줄2주, true);
  await p.selectOption('#misOld', '30');
  await p.waitForTimeout(500);
  const 줄한달 = await p.locator('.cols > div').first().locator('.tb').nth(1)
    .locator('tbody tr').count();
  console.log('  최근 한 달:', 줄한달, '줄');
  확인('한 달은 2주보다 많고 전체보다 적다', 줄2주 <= 줄한달 && 줄한달 < 줄전체, true);
  await p.screenshot({ path: 'q2_miss_open.png' });

  /* 학생별 표에 지난 것 칸 */
  await p.selectOption('#misOld', '14');
  await p.waitForTimeout(500);
  const 오른쪽 = p.locator('.cols > div').nth(1);
  const 첫학생 = (await 오른쪽.locator('.mcard').first().innerText()).replace(/\s+/g, ' ').trim();
  console.log('  오른쪽 학생별:', 첫학생);
  확인('학생 카드로 나온다', await 오른쪽.locator('.mcard').count() > 0, true);
  확인('밀린 건수가 보인다', /\d+건 밀림/.test(첫학생), true);
  확인('지난 것 표시가 보인다', 첫학생.indexOf('마감 지난 것') > -1, true);
  확인('여기서 바로 보충을 낸다', await 오른쪽.locator('[data-bochung]').count() > 0, true);

  /* 오래된 것 지우기 */
  console.log('\n— 오래된 것 지우기 —');
  확인('지우기 단추가 있다', await p.locator('#btnOldClean').isVisible(), true);
  const 전건수 = await p.evaluate(() => T.data.숙제목록.length);
  await p.click('#btnOldClean');
  await p.waitForTimeout(1400);
  const 후건수 = await p.evaluate(() => T.data.숙제목록.length);
  console.log('  숙제 건수:', 전건수, '→', 후건수);
  확인('30일 지난 것이 지워진다', 후건수 < 전건수, true);
  const 안내 = (await p.locator('.toast').textContent()).trim();
  console.log('  안내:', 안내);
  확인('몇 건 지웠는지 알려 준다', /\d+건을 지웠습니다/.test(안내), true);

  /* 최근 것은 남아 있어야 한다 */
  const 남은지난 = await p.evaluate(() => T.data.숙제목록.filter(h => h.지남).length);
  console.log('  남은 지난 숙제:', 남은지난);
  확인('최근 지난 것은 안 지워진다', 남은지난 > 0, true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
