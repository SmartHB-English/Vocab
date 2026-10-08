/* 시험지 뽑기 · 정답지 · 상장 인쇄 */
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
const { execSync } = require('child_process');
const fs = require('fs');
function 쪽수(파일){
  return require('./도구').쪽수세기(파일);
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
  /* window.print 를 가로채서 몇 번 불렸는지 센다 */
  await p.addInitScript(() => {
    window.__인쇄 = 0;
    window.print = function () { window.__인쇄++; };
  });
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw', '1234');
  await p.click('#btnTLogin');
  await p.waitForTimeout(1300);

  console.log('— 시험지 뽑기 화면 —');
  await 묶음열기(p, 'paper');
  확인('메뉴에 있다', await p.locator('[data-tab="paper"]').isVisible(), true);
  await 탭가기(p, 'paper');
  await p.waitForTimeout(1600);
  확인('단어장 고르개', await p.locator('#ppBook').isVisible(), true);
  확인('레슨 고르개', await p.locator('#ppLes option').count() > 0, true);
  확인('처음엔 레슨 1', await p.locator('#ppLes').inputValue(), '1|10');
  확인('첫·끝 단어도 보인다',
    (await p.locator('#ppLesWord').textContent()).replace(/\s+/g, ' ').trim(), 'acquire … compensate');
  확인('직접 정하기는 접혀 있다', await p.locator('#ppHand').isVisible(), false);
  확인('몇 문제 몇 장인지 알려 준다',
    (await p.locator('#ppCnt').textContent()).trim(), '10문제 · 1쪽 · 종이 1장 (양면)');

  console.log('\n— 미리보기 —');
  확인('종이가 한 장', await p.locator('#ppPrev .psheet').count(), 1);
  확인('문제가 10줄', await p.locator('#ppPrev .qtable tr').count(), 10);
  const 첫줄 = (await p.locator('#ppPrev .qtable tr').first().innerText()).replace(/\s+/g, ' ').trim();
  console.log('  1번:', 첫줄);
  확인('번호와 뜻이 있다', /^1\s/.test(첫줄), true);
  확인('영어는 안 보인다 (시험지니까)',
    (await p.locator('#ppPrev').innerText()).indexOf('acquire') > -1, false);
  확인('학원 이름이 머리에',
    (await p.locator('#ppPrev .pacademy').first().textContent()).trim(), '홍제인왕해법영어');
  확인('이름 칸만 둔다',
    (await p.locator('#ppPrev .pmeta').first().innerText()).replace(/\s+/g, ''), '이름________________________');
  const 안내글 = (await p.locator('#ppPrev .pnote').first().textContent()).trim();
  확인('푸는 방법을 알려 준다', 안내글.indexOf('뜻을 보고 영어 단어를 쓰세요.') === 0, true);
  확인('채점 칸도 알려 준다', 안내글.indexOf('채점 칸') > -1, true);
  확인('줄마다 채점 네모가 있다', await p.locator('#ppPrev .qtable .qx').count(), 10);
  await p.screenshot({ path: 't1_paper.png' });

  console.log('\n— 범위를 넓히면 장수가 는다 —');
  await p.selectOption('#ppLes', '1|25');
  await p.waitForTimeout(600);
  확인('25문제 2쪽', (await p.locator('#ppCnt').textContent()).trim(),
    '25문제 · 2쪽 · 종이 1장 (양면)');
  확인('종이가 두 장', await p.locator('#ppPrev .psheet').count(), 2);
  확인('둘째 장은 5문제',
    await p.locator('#ppPrev .psheet').nth(1).locator('.qtable tr').count(), 5);
  확인('쪽 번호가 붙는다',
    (await p.locator('#ppPrev .prange').first().textContent()).indexOf('1 / 2쪽') > -1, true);
  확인('둘째 장 첫 문제는 21번',
    (await p.locator('#ppPrev .psheet').nth(1).locator('.qn').first().textContent()).trim(), '21');

  /* 점수 칸은 넣지 않는다 — 쪽마다 쪼개진 만점이 생기지 않게 */
  const 머리칸 = (await p.locator('#ppPrev .pmeta').allInnerTexts())
    .map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  1쪽:', 머리칸[0]);
  console.log('  2쪽:', 머리칸[1]);
  확인('점수 칸은 없다', 머리칸.some(x => x.indexOf('점수') > -1), false);
  확인('날짜 칸도 없다', 머리칸.some(x => x.indexOf('날짜') > -1), false);
  확인('쪽마다 20/5 로 쪼개진 만점도 없다',
    머리칸.some(x => /\/ ?(20|5)\b/.test(x)), false);
  확인('이름 칸은 쪽마다 있다',
    머리칸.every(x => x.indexOf('이름') > -1), true);

  console.log('\n— 제목과 순서 —');
  await p.fill('#ppTitle', '9월 2주차 단어 시험');
  await p.waitForTimeout(400);
  확인('제목이 종이에 들어간다',
    (await p.locator('#ppPrev .ptitle').first().textContent()).trim(), '9월 2주차 단어 시험');
  const 순서전 = await p.locator('#ppPrev .qk').first().textContent();
  await p.locator('input[name=ppOrder][value="섞기"]').check();
  await p.waitForTimeout(400);
  const 목록 = await p.locator('#ppPrev .qk').allTextContents();
  확인('섞으면 문제 수는 그대로', 목록.length, 25);
  console.log('  섞기 전 1번:', 순서전.trim(), '/ 섞은 뒤 1번:', 목록[0].trim());
  await p.locator('input[name=ppOrder][value="번호"]').check();
  await p.waitForTimeout(400);
  확인('되돌리면 원래 순서', (await p.locator('#ppPrev .qk').first().textContent()).trim(), 순서전.trim());

  console.log('\n— 인쇄 —');
  await p.click('#btnPpPrint');
  await p.waitForTimeout(500);
  확인('인쇄 창을 부른다', await p.evaluate(() => window.__인쇄), 1);
  const 종이 = await p.evaluate(() => document.getElementById('printArea').innerText);
  확인('인쇄할 종이에 문제가 담긴다', 종이.indexOf('얻다, 습득하다') > -1, true);
  확인('시험지에는 정답이 없다', 종이.indexOf('acquire') > -1, false);
  확인('인쇄 영역은 화면에 안 보인다',
    await p.locator('#printArea').isVisible(), false);

  await p.click('#btnPpAns');
  await p.waitForTimeout(500);
  확인('정답지도 인쇄된다', await p.evaluate(() => window.__인쇄), 2);
  const 정답지 = await p.evaluate(() => document.getElementById('printArea').innerText);
  확인('정답지에는 영어가 있다', 정답지.indexOf('acquire') > -1, true);
  확인('정답지라고 적혀 있다', 정답지.indexOf('[정답지]') > -1, true);
  확인('정답지에는 이름 칸이 없다', 정답지.indexOf('이름') > -1, false);

  console.log('\n— 단어장을 바꾸면 —');
  await p.selectOption('#ppBook', '불규칙 동사 50');
  await p.waitForTimeout(900);
  확인('레슨 1 로 돌아온다', await p.locator('#ppLes').inputValue(), '1|5');
  확인('그 단어장 문제로 바뀐다', (await p.locator('#ppCnt').textContent()).trim(),
    '5문제 · 1쪽 · 종이 1장 (양면)');

  console.log('\n— 양면 —');
  await p.selectOption('#ppBook', '예시 단어장');
  await p.waitForTimeout(1000);
  확인('양면이 처음부터 켜져 있다', await p.locator('#ppDuplex').isChecked(), true);
  확인('종이 몇 장인지 알려 준다',
    (await p.locator('#ppCnt').textContent()).trim(), '10문제 · 1쪽 · 종이 1장 (양면)');
  확인('미리보기에도 양면 여백',
    await p.locator('#ppPrev').evaluate(e => e.classList.contains('duplex')), true);

  확인('한 장 채우기 단추가 있다', await p.locator('#btnPpFill').isVisible(), true);
  await p.click('#btnPpFill');
  await p.waitForTimeout(600);
  console.log('  한 장 채우기 뒤:', (await p.locator('#ppCnt').textContent()).trim());
  확인('25개짜리 단어장은 있는 만큼만',
    [await p.locator('#ppFrom').inputValue(), await p.locator('#ppTo').inputValue()], ['1', '25']);
  확인('25문제는 2쪽 종이 1장',
    (await p.locator('#ppCnt').textContent()).trim(), '25문제 · 2쪽 · 종이 1장 (양면)');
  await p.uncheck('#ppDuplex');
  await p.waitForTimeout(400);
  확인('양면을 끄면 종이 2장',
    (await p.locator('#ppCnt').textContent()).trim(), '25문제 · 2쪽 · 종이 2장');
  확인('여백도 원래대로',
    await p.locator('#ppPrev').evaluate(e => e.classList.contains('duplex')), false);
  await p.check('#ppDuplex');
  await p.waitForTimeout(400);

  /* 진짜 종이로 뽑아서 쪽수가 맞는지 — 한 쪽이 넘치면 여기서 걸린다 */
  console.log('\n— 진짜 A4 로 뽑아 보기 —');
  await p.click('#btnPpPrint');
  await p.waitForTimeout(500);
  await p.pdf({ path: require('./도구').임시('t40.pdf'), format: 'A4', printBackground: true,
    margin: { top: '14mm', bottom: '12mm', left: '14mm', right: '14mm' } });
  const n = 쪽수(require('./도구').임시('t40.pdf'));
  console.log('  25문제 →', n, '쪽');
  확인('20문제가 한 쪽에 다 들어간다 (2쪽)', n, 2);
  const 여백 = await p.locator('#printArea .psheet').evaluateAll(els => els.map(e => {
    const c = getComputedStyle(e);
    return [Math.round(parseFloat(c.paddingLeft)), Math.round(parseFloat(c.paddingRight))];
  }));
  console.log('  여백(좌,우):', JSON.stringify(여백));
  확인('앞면은 왼쪽에 묶는 여백', 여백[0][0] > 20 && 여백[0][1] === 0, true);
  확인('뒷면은 오른쪽에 묶는 여백', 여백[1][1] > 20 && 여백[1][0] === 0, true);

  console.log('\n— 상장 —');
  await 탭가기(p, 'award');
  await p.waitForTimeout(1500);
  확인('상장 인쇄 단추가 카드마다', await p.locator('[data-cert]').count() > 0, true);
  확인('모두 인쇄 단추도 있다', await p.locator('#btnAwCerts').isVisible(), true);
  const 전 = await p.evaluate(() => window.__인쇄);
  await p.locator('[data-cert]').first().click();
  await p.waitForTimeout(500);
  확인('상장도 인쇄된다', await p.evaluate(() => window.__인쇄), 전 + 1);
  const 상장 = await p.evaluate(() => document.getElementById('printArea').innerText);
  console.log('  상장:', 상장.replace(/\s+/g, ' ').trim().slice(0, 90));
  확인('상 장 이라고 적혀 있다', 상장.indexOf('상 장') > -1, true);
  확인('학원 이름이 들어간다', 상장.indexOf('홍제인왕해법영어') > -1, true);
  확인('받는 학생 이름이 들어간다', /홍길동|김영희|이철수/.test(상장), true);
  await p.evaluate(() => {
    document.getElementById('printArea').style.display = 'block';
    document.getElementById('printArea').style.background = '#fff';
  });
  await p.screenshot({ path: 't2_cert.png' });
  await p.evaluate(() => { document.getElementById('printArea').style.display = ''; });

  await p.click('#btnAwCerts');
  await p.waitForTimeout(600);
  확인('모두 인쇄하면 여러 장',
    await p.locator('#printArea .psheet').count() > 1, true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
