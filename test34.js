/* 레슨 — 단어장을 10단어씩 끊어서 고르기 (학생 / 게임 / 선생님) */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
const { 탭, 방법, 칸열기, 칸닫기, 게임칸열기, 책고르기, 범위정하기 } = require('./도구');
/* 칩 글자로 단어장 이름 찾기 */
async function 책이름(p, 조각){
  await 칸열기(p);
  const 것 = await p.locator('#bookChips [data-bk]').evaluateAll(es => es.map(e => e.dataset.bk));
  await 칸닫기(p);
  return 것.filter(x => x.indexOf(조각) > -1)[0] || 것[0];
}

/* 아래 탭바에서 '게임' 칸을 없앴다 — 연습 칸에서 '짝 맞추기 · 글자 퍼즐' 을 골라 시작한다 */
async function 게임가기(p){
  await p.click('[data-hbt="game"]');   /* 게임은 아래 탭으로 갔다 */
  await p.waitForTimeout(900);
}

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
/* 로그인하면 알림 팝업이 뜬다 — 눌러서 닫고 시작한다 (실제 학생도 그렇게 합니다) */
async function 알림닫기(p){
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(350); }
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

  /* ============ 1) 학생 단어 화면 ============ */
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234');
  await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1000);
  await 알림닫기(p);
  await p.click('[data-hbt="mem"]');
  await p.waitForTimeout(700);

  console.log('— 학생 단어 화면 —');
  await 칸열기(p);
  const 칩 = (await p.locator('#lesSel option').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  레슨 목록:', 칩.join(' | '));
  확인('레슨 3개 + 전체', 칩.length, 4);
  확인('레슨 1 이 1~10', 칩[0], '레슨 1 · 1~10번');
  확인('마지막 레슨은 21~25', 칩[2], '레슨 3 · 21~25번');
  확인('전체도 고를 수 있다', 칩[3], '전체 · 1~25번');
  확인('첫 단어와 끝 단어를 보여 준다',
    (await p.locator('#lesWord').textContent()).replace(/\s+/g, ' ').trim(), 'acquire … compensate');
  확인('몇 단어씩인지 알려 준다',
    (await p.locator('#lessonLab').textContent()).trim(), '레슨 (10단어씩)');

  /* 처음 들어오면 레슨 1 이 골라져 있어야 한다 */
  확인('처음엔 레슨 1', await p.locator('#lesSel').inputValue(), '1|10');
  확인('시작 칸이 1', await p.locator('#inFrom').inputValue(), '1');
  확인('끝 칸이 10', await p.locator('#inTo').inputValue(), '10');

  /* 직접 정하기는 접혀 있다 */
  확인('직접 정하기는 접혀 있다', await p.locator('#handRange').isVisible(), false);
  await 칸열기(p); await p.click('#btnHandRange');
  await p.waitForTimeout(250);
  확인('누르면 펼쳐진다', await p.locator('#handRange').isVisible(), true);
  확인('단추 글자가 바뀐다', (await p.locator('#btnHandRange').textContent()).indexOf('－') > -1, true);
  await p.screenshot({ path: 'r1_lesson_home.png' });

  /* 레슨 2 를 고르면 숫자 칸과 단어도 따라온다 */
  await 칸열기(p), await p.selectOption('#lesSel', '11|20');
  await p.waitForTimeout(200);
  확인('레슨 2 → 시작 11', await p.locator('#inFrom').inputValue(), '11');
  확인('레슨 2 → 끝 20', await p.locator('#inTo').inputValue(), '20');
  확인('단어도 레슨 2 것으로 바뀐다',
    (await p.locator('#lesWord').textContent()).indexOf('…') > -1, true);
  const 낱말2 = (await p.locator('#lesWord').textContent()).trim();
  console.log('  레슨 2 단어:', 낱말2);

  /* 직접 적으면 드롭다운이 따라온다 */
  await 범위정하기(p, 21, 25); 
  await p.waitForTimeout(200);
  확인('21~25 를 적으면 레슨 3 으로 맞춰진다', await p.locator('#lesSel').inputValue(), '21|25');
  await 범위정하기(p, 3, 7); 
  await p.waitForTimeout(200);
  확인('레슨에 없는 범위면 직접 정한 범위로 나온다', await p.locator('#lesSel').inputValue(), '');
  확인('직접 정한 범위라고 알려 준다',
    (await p.locator('#lesSel option').first().textContent()).trim(), '직접 정한 범위 · 3~7번');
  확인('그 범위 단어도 보여 준다',
    (await p.locator('#lesWord').textContent()).trim().length > 0, true);

  /* 레슨 3 으로 실제 시험을 봐도 되는지 */
  await 칸열기(p), await p.selectOption('#lesSel', '21|25');
  await p.waitForTimeout(150);
  await 방법(p, 'spell');
  await p.waitForTimeout(700);
  확인('레슨 3 은 5문제', await p.locator('.qrow').count(), 5);
  await p.click('#shBack');
  await p.waitForTimeout(500);

  /* 단어장을 바꾸면 그 단어장의 묶음(5)을 쓴다 */
  await 책고르기(p, '불규칙 동사 50');
  await p.waitForTimeout(800);
  확인('다른 단어장은 5단어씩',
    (await p.locator('#lessonLab').textContent()).trim(), '레슨 (5단어씩)');
  const 칩2 = (await p.locator('#lesSel option').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  3단변화 단어장:', 칩2.join(' | '));
  확인('레슨 하나뿐이면 전체 칸은 없다', 칩2, ['레슨 1 · 1~5번']);

  /* ============ 2) 게임 화면 ============ */
  console.log('\n— 게임 화면 —');
  await 게임가기(p);
  await p.waitForTimeout(900);
  await 게임칸열기(p); await p.selectOption('#gmBook', '예시 단어장');
  await p.waitForTimeout(900);
  const 게임칩 = (await p.locator('#gmLes option').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  게임 레슨 목록:', 게임칩.join(' | '));
  확인('게임에도 레슨 고르개', 게임칩.length, 4);
  확인('처음엔 레슨 1', await p.locator('#gmLes').inputValue(), '1|10');
  확인('게임에도 첫·끝 단어가 보인다',
    (await p.locator('#gmLesWord').textContent()).replace(/\s+/g, ' ').trim(), 'acquire … compensate');
  확인('고른 개수를 알려 준다',
    (await p.locator('#gmCnt').textContent()).indexOf('10개') > -1, true);
  확인('게임도 직접 정하기는 접혀 있다', await p.locator('#gmHand').isVisible(), false);
  await p.screenshot({ path: 'r2_lesson_game.png' });

  /* 10개면 짝 맞추기를 할 수 있다 */
  확인('레슨 1(10개)로 게임을 할 수 있다',
    await p.locator('[data-gm="짝"]').isDisabled(), false);
  await p.selectOption('#gmLes', '21|25');             // 레슨 3 = 21~25 (5개)
  await p.waitForTimeout(300);
  확인('5개뿐이면 게임을 막는다', await p.locator('[data-gm="짝"]').isDisabled(), true);
  확인('왜 막는지 알려 준다', await p.locator('#gmFew').isVisible(), true);
  await p.selectOption('#gmLes', '1|25');              // 전체
  await p.waitForTimeout(300);
  확인('전체로 넓히면 다시 된다', await p.locator('[data-gm="짝"]').isDisabled(), false);
  확인('전체는 25개', (await p.locator('#gmCnt').textContent()).indexOf('25개') > -1, true);

  /* 직접 정하기로 넓혀도 단추가 따라온다 */
  await p.click('#btnGmHand');
  await p.waitForTimeout(200);
  await p.fill('#gmTo', '10');
  await p.waitForTimeout(300);
  확인('직접 적으면 레슨 1 로 맞춰진다', await p.locator('#gmLes').inputValue(), '1|10');

  /* ============ 3) 선생님 화면 ============ */
  console.log('\n— 선생님 화면 —');
  const t = await b.newPage({ viewport: { width: 1500, height: 950 } });
  t.on('pageerror', e => errs.push('ERR(선생님) ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소);
  await t.waitForTimeout(400);
  await t.click('#btnTeacherGo');
  await t.fill('#tPw', '1234');
  await t.click('#btnTLogin');
  await t.waitForTimeout(1200);

  /* 단어장 탭에서 묶음을 정한다 */
  await 탭가기(t, 'book');
  await t.waitForTimeout(800);
  확인('레슨 묶음 칸이 있다', await t.locator('#bkLesson').isVisible(), true);
  확인('지금은 10단어씩', await t.locator('#bkLesson').inputValue(), '10');
  const 안내 = (await t.locator('#bkLesHint').textContent()).replace(/\s+/g, ' ').trim();
  console.log('  안내:', 안내);
  확인('몇 개로 나뉘는지 알려 준다', 안내.indexOf('레슨 3개로 나뉩니다') > -1, true);
  await t.fill('#bkLesson', '5');
  await t.waitForTimeout(250);
  확인('숫자를 바꾸면 미리 알려 준다',
    (await t.locator('#bkLesHint').textContent()).indexOf('레슨 5개로 나뉩니다') > -1, true);
  await t.screenshot({ path: 'r3_lesson_book.png' });
  await t.click('#bkLesSave');
  await t.waitForTimeout(900);
  확인('저장했다고 알려 준다',
    (await t.locator('.toast').textContent()).indexOf('5단어씩') > -1, true);
  확인('저장한 값이 남아 있다', await t.locator('#bkLesson').inputValue(), '5');

  /* 숙제 내기에서 레슨으로 고른다 */
  await 탭가기(t, 'hw');
  await t.waitForTimeout(900);
  확인('숙제 내기에도 레슨 고르개', await t.locator('#hwLes option').count() > 0, true);
  const 숙칩 = (await t.locator('#hwLes option').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  숙제 레슨 목록:', 숙칩.join(' | '));
  확인('아까 정한 5단어씩이 반영된다', 숙칩[0], '레슨 1 · 1~5번');
  확인('선생님 화면에도 첫·끝 단어',
    (await t.locator('#hwLesWord').textContent()).replace(/\s+/g, ' ').trim(), 'acquire … analyze');
  확인('묶음을 제목에 알려 준다',
    (await t.locator('#hwLesWrap label').textContent()).trim(), '레슨 (5단어씩)');
  확인('기본은 레슨 1', await t.locator('#hwTo').inputValue(), '5');
  확인('선생님도 직접 정하기는 접혀 있다', await t.locator('#hwHand').isVisible(), false);

  await t.selectOption('#hwLes', '6|10');
  await t.waitForTimeout(200);
  확인('레슨 2 → 6~10',
    [await t.locator('#hwFrom').inputValue(), await t.locator('#hwTo').inputValue()], ['6', '10']);
  await t.screenshot({ path: 'r4_lesson_give.png' });

  /* 단어장을 바꾸면 범위가 다시 레슨 1 로 */
  await t.selectOption('#hwBook', '불규칙 동사 50');
  await t.waitForTimeout(400);
  확인('단어장을 바꾸면 레슨 1 로 돌아온다',
    [await t.locator('#hwFrom').inputValue(), await t.locator('#hwTo').inputValue()], ['1', '5']);

  /* 실제로 숙제가 나가는지 */
  await t.selectOption('#hwBook', '예시 단어장');
  await t.waitForTimeout(400);
  await t.selectOption('#hwLes', '11|15');
  await t.waitForTimeout(200);
  const 전 = await t.evaluate(() => T.data.숙제목록.length);
  await t.click('#btnHwAdd');
  await t.waitForTimeout(1200);
  const 후 = await t.evaluate(() => T.data.숙제목록.length);
  확인('레슨으로 고른 숙제가 등록된다', 후 > 전, true);
  const 새숙제 = await t.evaluate(() => T.data.숙제목록[T.data.숙제목록.length - 1]);
  console.log('  등록된 숙제:', 새숙제.단어장, 새숙제.시작 + '~' + 새숙제.끝);
  확인('범위가 레슨 3 (11~15)', [String(새숙제.시작), String(새숙제.끝)], ['11', '15']);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
