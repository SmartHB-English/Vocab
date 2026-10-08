/* 불규칙 동사 3단변화 전용 시험지 — 자동 전환 · 칸 구성 · 정답지 */
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
  await p.waitForTimeout(1300);
  await 탭가기(p, 'paper');
  await p.waitForTimeout(1500);

  console.log('— 나누기부터 —');
  const 쪼갠것 = await p.evaluate(() => [
    삼단쪼개기_('go - went - gone'),
    삼단쪼개기_('be - was / were - been'),
    삼단쪼개기_('get - got - got / gotten'),
    삼단쪼개기_('cut - cut - cut'),
    삼단쪼개기_('apple')
  ]);
  확인('보통 것', 쪼갠것[0], ['go', 'went', 'gone']);
  확인('빗금은 한 칸에 둔다', 쪼갠것[1], ['be', 'was / were', 'been']);
  확인('뒤쪽 빗금도 그대로', 쪼갠것[2], ['get', 'got', 'got / gotten']);
  확인('세 개가 같아도 된다', 쪼갠것[3], ['cut', 'cut', 'cut']);
  확인('하나뿐이면 나머지는 빈칸', 쪼갠것[4], ['apple', '', '']);

  console.log('\n— 보통 단어장은 예전 그대로 —');
  확인('처음엔 예시 단어장', await p.locator('#ppBook').inputValue(), '예시 단어장');
  확인('보통 표가 나온다', await p.locator('#ppPrev .qtable').count() > 0, true);
  확인('3단변화 표는 없다', await p.locator('#ppPrev .vtable').count(), 0);
  const 안내1 = (await p.locator('#ppKind').innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 안내1);
  확인('뜻을 보고 쓴다고 알려 준다', /뜻을 보고/.test(안내1), true);
  확인('한 쪽 20문제', /20문제/.test(안내1), true);

  console.log('\n— 3단변화 단어장을 고르면 저절로 바뀐다 —');
  await p.selectOption('#ppBook', '불규칙 동사 50');
  await p.waitForTimeout(1400);
  확인('전용 표로 바뀐다', await p.locator('#ppPrev .vtable').count() > 0, true);
  확인('보통 표는 사라진다', await p.locator('#ppPrev .qtable').count(), 0);
  const 안내2 = (await p.locator('#ppKind').innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 안내2);
  확인('전용 시험지라고 알려 준다', /불규칙 동사 전용/.test(안내2), true);
  확인('한 쪽 25문제라고 알려 준다', /25문제/.test(안내2), true);
  확인('한 장 채우기가 50문제로 바뀐다',
    (await p.locator('#btnPpFill').textContent()).indexOf('50문제') > -1, true);

  console.log('\n— 칸 구성 —');
  const 머리 = (await p.locator('#ppPrev .vtable tr.vhead').innerText())
    .replace(/\s+/g, ' ').trim();
  console.log('  머리줄: ' + 머리);
  확인('뜻·원형·과거·과거분사', 머리, '뜻 원형 과거 과거분사');

  const 첫줄 = await p.locator('#ppPrev .vtable tr').nth(1);
  확인('뜻이 보인다', (await 첫줄.locator('.vk').innerText()).trim(), '가다');
  확인('원형은 주어져 있다', (await 첫줄.locator('.v1').innerText()).trim(), 'go');
  const 빈칸 = await 첫줄.locator('.vb').allInnerTexts();
  확인('빈칸이 두 개', 빈칸.length, 2);
  확인('두 칸 다 비어 있다', 빈칸.map(x => x.trim()), ['', '']);
  확인('채점 네모가 있다', await 첫줄.locator('.qx i').count(), 1);
  확인('정답 칸이 아니다', await 첫줄.locator('.vb.ans').count(), 0);

  const 안내글 = (await p.locator('#ppPrev .pnote').first().innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 안내글);
  확인('무엇을 쓰라는지 적혀 있다', /과거형과 과거분사/.test(안내글), true);
  await p.screenshot({ path: 'v1_paper.png' });

  console.log('\n— 정답지 —');
  const 답 = await p.evaluate(() => {
    var 말 = T.책단어['불규칙 동사 50'] || [];
    return 불규칙시험지종이(말, { 제목: '시험', 범위글: '1~5번' }, true);
  });
  const t = await p.evaluate(h => { var e = document.createElement('div'); e.innerHTML = h; document.body.appendChild(e);
    var r = e.querySelectorAll('.vtable tr')[1];
    return { 셀: [].map.call(r.children, c => c.textContent.trim()),
             채점: e.querySelectorAll('.vtable .qx').length,
             정답칸: e.querySelectorAll('.vtable .vb.ans').length }; }, 답);
  console.log('  첫 줄: ' + JSON.stringify(t.셀));
  확인('정답이 다 찍힌다', t.셀.filter(String), ['1', '가다', 'go', 'went', 'gone']);
  확인('정답지엔 채점 네모가 없다', t.채점, 0);
  확인('정답 칸으로 표시된다', t.정답칸 > 0, true);

  console.log('\n— 한 쪽 25문제로 나뉜다 —');
  const 쪽 = await p.evaluate(() => {
    var 가짜 = [];
    for (var i = 1; i <= 60; i++) 가짜.push({ no: i, en: 'go - went - gone', ko: '가다' });
    var h = 불규칙시험지종이(가짜, { 제목: '시험', 범위글: '1~60번' });
    var e = document.createElement('div'); e.innerHTML = h;
    return { 쪽수: e.querySelectorAll('.psheet').length,
             첫쪽: e.querySelectorAll('.psheet')[0].querySelectorAll('.vtable tr').length - 1,
             끝쪽: e.querySelectorAll('.psheet')[2].querySelectorAll('.vtable tr').length - 1 };
  });
  console.log('  ' + JSON.stringify(쪽));
  확인('60문제면 3쪽', 쪽.쪽수, 3);
  확인('첫 쪽은 25문제', 쪽.첫쪽, 25);
  확인('마지막 쪽은 10문제', 쪽.끝쪽, 10);

  console.log('\n— 보통 단어장으로 되돌아온다 —');
  await p.selectOption('#ppBook', '예시 단어장');
  await p.waitForTimeout(1400);
  확인('다시 보통 표', await p.locator('#ppPrev .qtable').count() > 0, true);
  확인('전용 표는 없다', await p.locator('#ppPrev .vtable').count(), 0);
  확인('한 장 채우기도 40문제로',
    (await p.locator('#btnPpFill').textContent()).indexOf('40문제') > -1, true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
