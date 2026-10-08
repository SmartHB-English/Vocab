/* 연속 기록 (🔥) — 학생 화면 배지와 순위 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
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

  console.log('— 첫 화면 —');
  확인('불꽃 줄이 숙제 화면 맨 위에 있다', await p.locator('#todayBox .tdcard').isVisible(), true);
  const 칸 = (await p.locator('#todayBox .tdcard').textContent()).replace(/\s+/g, ' ').trim();
  console.log('  오늘 줄:', 칸);
  확인('며칠 연속인지 보인다', /\d+일 연속/.test(칸), true);
  확인('불꽃 그림이 있다', await p.locator('#todayBox .tline svg').count(), 1);
  확인('오늘 하면 더 는다고 알려 준다', 칸.indexOf('오늘 숙제까지 내면') > -1, true);
  확인('남은 숙제 개수도 같이 보인다', /\d+ \/ \d+ 냈어요/.test(칸), true);

  /* 불꽃 줄이 숙제보다 위에 있어야 한다 */
  const 순서 = await p.evaluate(() => {
    const a = document.querySelector('#todayBox .tdcard').getBoundingClientRect().top;
    const c = document.querySelector('.hwhero') || document.querySelector('.hwrow');
    return c ? a < c.getBoundingClientRect().top : true;
  });
  확인('숙제 카드보다 위', 순서, true);
  await p.screenshot({ path: 'n1_streak_home.png' });

  /* ---------- 순위 ---------- */
  console.log('\n— 불꽃 순위 —');
  await p.click('#tdRank');
  await p.waitForTimeout(600);
  확인('순위 화면이 열린다', await p.evaluate(() => document.getElementById('s-streak').classList.contains('on')), true);
  const 탭 = (await p.locator('#skTabs').textContent()).replace(/\s+/g, ' ').trim();
  console.log('  칸:', 탭);
  확인('학원 전체 한 칸', 탭.indexOf('학원 전체') > -1, true);
  확인('반 칸은 없앴다', 탭.indexOf('우리 반') > -1, false);

  const 줄 = await p.locator('.skrow').count();
  console.log('  순위 줄:', 줄);
  확인('학원 전체 6명', 줄, 6);
  확인('내 줄이 표시된다', await p.locator('.skrow.me').count(), 1);
  const 내줄 = (await p.locator('.skrow.me').textContent()).replace(/\s+/g, ' ').trim();
  console.log('  내 줄:', 내줄);
  확인('(나) 라고 알려 준다', 내줄.indexOf('(나)') > -1, true);

  const 첫 = (await p.locator('.skrow').first().textContent()).replace(/\s+/g, ' ').trim();
  console.log('  1등:', 첫);
  확인('1등은 금메달', 첫.indexOf('🥇') > -1, true);
  확인('연속 많은 순', 첫.indexOf('김영희') > -1, true);

  /* 0일인 학생은 - 로 */
  const 꼴찌 = (await p.locator('.skrow').last().textContent()).replace(/\s+/g, ' ').trim();
  console.log('  꼴찌:', 꼴찌);
  확인('0일은 불꽃 없이', 꼴찌.indexOf('🔥') < 0, true);

  /* 동점은 같은 등수 */
  const 등수들 = (await p.locator('.skrow .rk').allTextContents()).map(x => x.trim());
  console.log('  등수:', 등수들.join(' / '));
  확인('동점이면 같은 등수 (3등 둘)', 등수들.filter(x => x === '🥉').length, 2);

  const 전체줄 = (await p.locator('.skrow').allInnerTexts()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  ' + 전체줄.join(' | '));
  확인('예전 다른 반 아이도 한 표에 있다',
    전체줄.some(x => x.indexOf('이철수') > -1), true);
  확인('반 이름은 이제 안 붙는다',
    전체줄.some(x => x.indexOf('고3 B반') > -1), false);

  확인('세는 방법을 알려 준다',
    (await p.locator('#skHelp').textContent()).indexOf('숙제가 없던 날은 건너뛰') > -1, true);
  확인('언제부터 세는지 알려 준다',
    (await p.locator('#skHelp').textContent()).indexOf('2026-09-15') > -1, true);
  await p.screenshot({ path: 'n2_streak_rank.png' });

  /* ---------- 뒤로 — 들어온 곳으로 돌아간다 ---------- */
  /* 숙제 화면의 「순위 ›」 로 들어왔으면 숙제로 */
  await p.click('#s-streak [data-back]');
  await p.waitForTimeout(500);
  확인('숙제 화면으로 잘 돌아온다', await p.evaluate(() => document.getElementById('s-home').classList.contains('on')), true);
  /* 게임 화면의 「순위」 타일로 들어왔으면 게임으로 */
  await p.click('[data-hbt="game"]'); await p.waitForTimeout(600);
  await p.click('#btnGmRank'); await p.waitForTimeout(600);
  await p.click('#s-streak [data-back]');
  await p.waitForTimeout(500);
  확인('게임 화면으로 잘 돌아온다', await p.evaluate(() => document.getElementById('s-games').classList.contains('on')), true);
  확인('아래 탭바가 보인다', await p.locator('#tabbar').isVisible(), true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
