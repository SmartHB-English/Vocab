/* 첫 화면 네 칸 + 게임 세 가지 + 게임 순위 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');

/* 게임은 아래 탭바의 제 칸으로 돌아왔다 (2026-10-02b 재디자인) */
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

  console.log('— 첫 화면 —');
  확인('열면 바로 숙제 화면', await p.evaluate(() => document.getElementById('s-home').classList.contains('on')), true);
  /* #tabbar 에는 태블릿 왼쪽 메뉴용 「나가기」 도 들어 있어서 탭 단추([data-hbt])만 센다 */
  const 아래탭 = (await p.locator('#tabbar [data-hbt] span').allTextContents()).map(x => x.trim());
  console.log('  탭:', 아래탭.join(' / '));
  /* 외우기·시험은 같은 화면을 둘로 나눈 것이고, 순위는 게임 화면 안으로 들어갔다 */
  확인('네 칸', 아래탭, ['숙제', '외우기', '시험', '게임']);
  확인('숙제 개수가 붙는다', await p.locator('#tbHw').isVisible(), true);
  확인('불꽃도 맨 위에', await p.locator('#todayBox .tdcard').isVisible(), true);
  await p.screenshot({ path: 'p1_hub.png' });

  /* ---------- 연습 ---------- */
  await p.click('[data-hbt="mem"]');
  await p.waitForTimeout(500);
  확인('연습으로 들어간다', await p.evaluate(() => document.getElementById('s-study').classList.contains('on')), true);
  await p.click('[data-hbt="hw"]');
  await p.waitForTimeout(500);
  확인('숙제로 돌아온다', await p.evaluate(() => document.getElementById('s-home').classList.contains('on')), true);

  /* ---------- 짝 맞추기 ---------- */
  console.log('\n— 짝 맞추기 —');
  await 게임가기(p);
  await p.waitForTimeout(600);
  const 게임들 = (await p.locator('#gmList [data-gm] b, #gmList #hbTime b').allTextContents()).map(x => x.trim());
  console.log('  게임:', 게임들.join(' / '));
  확인('게임 세 가지', 게임들, ['짝 맞추기', '글자 퍼즐', '타임어택']);
  확인('내 최고 점수가 보인다', /최고/.test(await p.locator('#gmList').innerText()), true);

  await p.click('[data-gm="짝"]');
  await p.waitForTimeout(700);
  확인('판이 열린다', await p.evaluate(() => document.getElementById('s-match').classList.contains('on')), true);
  const 장 = await p.locator('.mtc').count();
  console.log('  카드 수:', 장);
  확인('카드가 짝수로 깔린다', 장 % 2, 0);
  확인('처음엔 다 뒤집혀 있다', await p.locator('.mtc.open').count(), 0);
  확인('진행 표시', (await p.locator('#mtPair').textContent()).trim(), '0 / ' + (장 / 2));

  /* 한 장 뒤집어 보기 */
  await p.locator('.mtc').first().click();
  await p.waitForTimeout(200);
  확인('누르면 열린다', await p.locator('.mtc.open').count(), 1);
  await p.screenshot({ path: 'p2_match.png' });

  /* 다시 누르면 도로 덮이는지 */
  await p.locator('.mtc').first().click();
  await p.waitForTimeout(250);
  확인('같은 카드를 또 누르면 덮인다', await p.locator('.mtc.open').count(), 0);

  /* 정답끼리 맞춰 끝까지 (짝 정보를 읽어서) */
  await p.evaluate(async () => {
    function 자(ms){ return new Promise(r => setTimeout(r, ms)); }
    const 칸 = document.querySelectorAll('[data-mt]');
    const 짝맵 = {};
    M.칸.forEach((c, i) => { (짝맵[c.짝] = 짝맵[c.짝] || []).push(i); });
    for (const k of Object.keys(짝맵)) {
      const [a, c] = 짝맵[k];
      칸[a].click(); await 자(60); 칸[c].click(); await 자(120);
    }
  });
  await p.waitForTimeout(1200);
  console.log('  맞춘 짝:', (await p.locator('#mtPair').textContent()).trim());
  확인('다 맞추면 결과가 뜬다', await p.locator('.gmend').isVisible(), true);
  const 점 = (await p.locator('.gmend .big').textContent()).trim();
  console.log('  점수:', 점);
  확인('점수가 숫자로 나온다', /^\d+$/.test(점), true);
  확인('한 판 더 단추', await p.locator('#mtAgain').isVisible(), true);
  await p.screenshot({ path: 'p3_match_end.png' });

  /* ---------- 글자 퍼즐 ---------- */
  console.log('\n— 글자 퍼즐 —');
  await p.click('#mtBack');
  await p.waitForTimeout(500);
  await p.click('[data-gm="퍼즐"]');
  await p.waitForTimeout(700);
  확인('퍼즐이 열린다', await p.evaluate(() => document.getElementById('s-puz').classList.contains('on')), true);
  확인('목숨 3개', (await p.locator('#pzLife').textContent()).trim(), '❤️❤️❤️');
  const 칸수 = await p.locator('.pzslot').count();
  const 자판 = await p.locator('.pzk').count();
  console.log('  빈칸', 칸수, '· 자판', 자판);
  확인('빈칸이 단어 길이만큼', 칸수 > 2, true);
  확인('자판이 빈칸보다 많다 (헷갈리게)', 자판 > 칸수, true);

  /* 한 글자 넣고 지우기 */
  await p.locator('.pzk').first().click();
  await p.waitForTimeout(200);
  확인('누르면 칸이 찬다', await p.locator('.pzslot.on').count(), 1);
  확인('쓴 자판은 흐려진다', await p.locator('.pzk.used').count(), 1);
  await p.click('#pzDel');
  await p.waitForTimeout(200);
  확인('지우면 되돌아온다', await p.locator('.pzslot.on').count(), 0);
  확인('자판도 살아난다', await p.locator('.pzk.used').count(), 0);
  await p.screenshot({ path: 'p4_puzzle.png' });

  /* 정답을 맞춰 보기 */
  const 맞았나 = await p.evaluate(async () => {
    function 자(ms){ return new Promise(r => setTimeout(r, ms)); }
    for (const ch of P.답.split('')) {
      const 키 = [...document.querySelectorAll('.pzk')]
        .find(k => !k.classList.contains('used') && k.textContent === ch);
      if (!키) return false;
      키.click(); await 자(40);
    }
    await 자(200);
    return document.getElementById('pzMsg').textContent.indexOf('좋아요') > -1;
  });
  확인('정답을 넣으면 맞다고 한다', 맞았나, true);
  await p.waitForTimeout(900);
  확인('점수가 올라간다', await p.evaluate(() => P.점수 > 0), true);

  /* ---------- 게임 순위 ---------- */
  console.log('\n— 순위 —');
  await p.click('#pzBack');
  await p.waitForTimeout(500);
  await p.click('#btnGmRank');
  await p.waitForTimeout(800);
  const 탭 = (await p.locator('#rkTabs .chip').allTextContents()).map(x => x.trim());
  console.log('  순위 칸:', 탭.join(' / '));
  확인('순위가 세 칸', 탭, ['불꽃', '이달의 점수', '게임']);
  const 게임탭 = (await p.locator('#skTabs .chip').allTextContents()).map(x => x.trim());
  console.log('  게임 칸:', 게임탭.join(' / '));
  확인('게임별로 나뉜다', 게임탭.slice(0, 2), ['짝 맞추기', '글자 퍼즐']);
  확인('반 고르개는 없앴다 — 학원 전체 하나', 게임탭.length, 2);
  확인('순위 줄이 있다', await p.locator('.skrow').count() > 0, true);
  확인('내 줄 표시', await p.locator('.skrow.me').count(), 1);
  확인('성적과 따로라고 알려 준다',
    (await p.locator('#skHelp').textContent()).indexOf('성적 평균이나 상에는') > -1, true);
  await p.screenshot({ path: 'p5_game_rank.png' });

  확인('반/전체 고르개는 없앴다', await p.locator('[data-gscope]').count(), 0);

  await p.click('[data-rk="불꽃"]');
  await p.waitForTimeout(400);
  확인('불꽃 칸도 그대로', await p.locator('.skrow.me').count(), 1);
  await p.click('[data-rk="이달의 점수"]');
  await p.waitForTimeout(400);
  확인('이달의 점수도 나온다', await p.locator('.skrow').count() > 0, true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
