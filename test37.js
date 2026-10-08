/* 게임 순위가 바로 반영되는지 — 한 판 하면 그 점수가 순위에 올라와야 한다 */
const { chromium } = require('playwright');
const { 순위가기 } = require('./도구');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');

/* 아래 탭바에서 '게임' 칸을 없앴다 — 연습 칸에서 '짝 맞추기 · 글자 퍼즐' 을 골라 시작한다 */
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
  await p.waitForTimeout(1200);
  await 알림닫기(p);

  /* ---------- 지금 순위 ---------- */
  console.log('— 한 판 하기 전 —');
  await 순위가기(p);   /* 순위 탭은 없어졌다 — 게임 화면의 「순위」 타일로 들어간다 */
  await p.waitForTimeout(700);
  await p.click('[data-rk="게임"]');
  await p.waitForTimeout(900);
  확인('게임 순위 칸이 열린다', (await p.locator('#skTabs').textContent()).indexOf('짝 맞추기') > -1, true);
  const 전 = (await p.locator('.skrow').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  ' + 전.join(' | '));
  const 전내점 = await p.evaluate(() => {
    const g = (S.게임.게임 || []).filter(x => x.키 === '짝')[0];
    return g ? g.내최고 : 0;
  });
  console.log('  내 최고:', 전내점);
  확인('내 점수가 올라와 있다', 전내점 > 0, true);

  /* ---------- 한 판 하고 점수를 올린다 ---------- */
  console.log('\n— 한 판 한 뒤 —');
  await p.evaluate(() => 게임점수저장('짝', 9999, '9초 / 8번'));
  await p.waitForTimeout(1200);
  const 후내점 = await p.evaluate(() => {
    const g = (S.게임.게임 || []).filter(x => x.키 === '짝')[0];
    return g ? g.내최고 : 0;
  });
  console.log('  내 최고:', 후내점);
  확인('새 점수가 반영된다', 후내점, 9999);

  /* 순위 화면을 보고 있었으니 그 자리에서 다시 그려져야 한다 */
  const 후 = (await p.locator('.skrow').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  ' + 후.join(' | '));
  확인('화면이 바로 다시 그려진다', 후[0].indexOf('9999점') > -1, true);
  확인('내가 1등이 된다', 후[0].indexOf('(나)') > -1, true);
  확인('금메달', 후[0].indexOf('🥇') > -1, true);
  await p.screenshot({ path: 's1_gamerank.png' });

  /* ---------- 다른 칸에 갔다 와도 최신이어야 한다 ---------- */
  console.log('\n— 다른 칸 갔다 오기 —');
  await p.click('[data-rk="불꽃"]');
  await p.waitForTimeout(400);
  await p.evaluate(() => 게임점수저장('퍼즐', 8888, '20단어 / 40초'));
  await p.waitForTimeout(900);
  await p.click('[data-rk="게임"]');
  await p.waitForTimeout(900);
  await p.click('[data-gr="퍼즐"]');
  await p.waitForTimeout(500);
  const 퍼 = (await p.locator('.skrow').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  ' + 퍼.join(' | '));
  확인('퍼즐 점수도 올라온다', 퍼[0].indexOf('8888점') > -1, true);

  /* ---------- 게임 화면의 '최고' 배지도 따라와야 한다 ---------- */
  console.log('\n— 게임 화면 최고 배지 —');
  await p.click('[data-hbt="hw"]');
  await p.waitForTimeout(400);
  await 게임가기(p);
  await p.waitForTimeout(1200);
  const 배지 = (await p.locator('[data-gm="짝"]').textContent()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 배지);
  확인('짝 맞추기 최고 점수가 보인다', 배지.indexOf('최고 9999') > -1, true);

  /* ---------- 저장이 실패하면 알려 줘야 한다 ---------- */
  console.log('\n— 저장이 안 될 때 —');
  await p.evaluate(() => { DEMO.게임저장 = function () { return { ok: false, 메시지: '시트가 없습니다' }; }; });
  await p.evaluate(() => 게임점수저장('짝', 10, '테스트'));
  await p.waitForTimeout(900);
  const 안내 = (await p.locator('.toast').textContent()).trim();
  console.log('  안내:', 안내);
  확인('왜 안 됐는지 알려 준다', 안내.indexOf('시트가 없습니다') > -1, true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
