/* 게임에서 단어장 고르기 */
const { chromium } = require('playwright');
const { 게임칸열기, 게임칸닫기 } = require('./도구');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');

/* 게임은 아래 탭바의 「게임」 칸이다. 단어장은 그 화면의 알약(#hbGBook)을 눌러 올라오는 칸에서 고른다 */
async function 게임가기(p){
  await p.click('[data-hbt="game"]');   /* 게임은 아래 탭으로 갔다 */
  await p.waitForTimeout(900);
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
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(500);
  await p.fill('#inPw', '1234');
  await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1300);
  await 알림닫기(p);

  console.log('— 게임 화면 —');
  await 게임가기(p);
  await p.waitForTimeout(1200);
  await 게임칸열기(p);
  확인('단어장 고르개가 있다', await p.locator('#gmBook').isVisible(), true);
  const 책들 = (await p.locator('#gmBook option').allTextContents()).map(x => x.trim());
  console.log('  고를 수 있는 단어장:', 책들.join(' / '));
  확인('단어장이 여럿', 책들.length > 1, true);
  확인('레슨 고르개가 있다', await p.locator('#gmLes option').count() > 0, true);
  확인('직접 정하기는 접혀 있다', await p.locator('#gmHand').isVisible(), false);

  const 안내 = (await p.locator('#gmPick .sub').last().textContent()).replace(/\s+/g, ' ').trim();
  console.log('  안내:', 안내);
  확인('몇 개인지 알려 준다', /\d+개 · 지금 고른 범위에 \d+개/.test(안내), true);
  await p.screenshot({ path: 's1_game_pick.png' });

  const 첫책 = await p.evaluate(() => S.게임책이름);
  const 첫수 = await p.evaluate(() => S.게임책.length);
  console.log('  지금 단어장:', 첫책, '·', 첫수, '개');

  /* 범위 줄이기 */
  await p.evaluate(()=>{var e=document.getElementById('gmHand'); if(e) e.classList.remove('hide');});
  await p.fill('#gmTo', '10');
  await p.locator('#gmTo').dispatchEvent('input');
  await p.waitForTimeout(500);
  확인('범위를 줄이면 반영된다', await p.evaluate(() => 게임범위단어().length), 10);
  const 안내2 = (await p.locator('#gmPick .sub').last().textContent()).replace(/\s+/g, ' ').trim();
  확인('안내도 바뀐다', 안내2.indexOf('범위에 10개') > -1, true);

  /* 그 범위로 게임이 열린다 — 단어장 칸이 덮고 있으니 먼저 닫는다 */
  await 게임칸닫기(p);
  await p.click('[data-gm="짝"]');
  await p.waitForTimeout(800);
  확인('짝 맞추기가 열린다', await p.evaluate(() => document.getElementById('s-match').classList.contains('on')), true);
  const 짝수 = await p.evaluate(() => M.총);
  console.log('  짝 수:', 짝수);
  확인('고른 범위 안에서 낸다', 짝수 <= 10, true);
  const 안범위 = await p.evaluate(() => {
    const 안 = 게임범위단어().map(w => w.en);
    return M.문제 ? true : M.칸.every(c => c.영어 ? 안.indexOf(c.글) > -1 : true);
  });
  확인('범위 밖 단어가 안 나온다', 안범위, true);

  /* 단어장 바꾸기 */
  await p.click('#mtBack');
  await p.waitForTimeout(600);
  const 다른책 = 책들.find(x => x !== 첫책);
  await 게임칸열기(p); await p.selectOption('#gmBook', 다른책);
  await p.waitForTimeout(1300);
  console.log('  바꾼 단어장:', await p.evaluate(() => S.게임책이름));
  확인('단어장이 바뀐다', await p.evaluate(() => S.게임책이름), 다른책);
  확인('범위가 새 단어장의 레슨 1 로 되돌아온다',
    await p.evaluate(() => S.게임시작 === 1 &&
      S.게임끝 === Math.min(레슨크기(S.게임책이름, 내책들()), S.게임책.length)), true);

  /* 단어가 모자라면 못 열게 */
  await 게임칸열기(p); await p.selectOption('#gmBook', 첫책);
  await p.waitForTimeout(1200);
  await p.evaluate(()=>{var e=document.getElementById('gmHand'); if(e) e.classList.remove('hide');});
  await p.fill('#gmTo', '3');
  await p.locator('#gmTo').dispatchEvent('input');
  await p.waitForTimeout(500);
  const 본문 = await p.locator('#s-games').innerText();
  확인('모자라면 알려 준다', 본문.indexOf('8개보다 적어서') > -1, true);
  확인('모자라면 단추가 잠긴다', await p.locator('[data-gm="짝"]').isDisabled(), true);
  확인('퍼즐 단추도 잠긴다', await p.locator('[data-gm="퍼즐"]').isDisabled(), true);
  await p.screenshot({ path: 's2_game_toofew.png' });

  /* 되돌리고 퍼즐도 확인 */
  await p.fill('#gmTo', '20');
  await p.locator('#gmTo').dispatchEvent('input');
  await p.waitForTimeout(500);
  await 게임칸닫기(p);
  await p.click('[data-gm="퍼즐"]');
  await p.waitForTimeout(800);
  확인('퍼즐도 고른 단어장으로', await p.evaluate(() => document.getElementById('s-puz').classList.contains('on')), true);
  확인('퍼즐 단어가 범위 안', await p.evaluate(() => {
    const 안 = 게임범위단어().map(w => w.en.replace(/[^a-zA-Z]/g, '').toLowerCase());
    return P.낱말.every(w => 안.indexOf(w.en.replace(/[^a-zA-Z]/g, '').toLowerCase()) > -1);
  }), true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
