/* 위에서 아래로 당겨도 새로고침되지 않는다 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }

  console.log('— 당겨서 새로고침을 꺼 둔다 —');
  const 값 = await p.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overscrollBehaviorY,
    body: getComputedStyle(document.body).overscrollBehaviorY
  }));
  console.log('  ' + JSON.stringify(값));
  확인('html 에 걸려 있다', 값.html, 'contain');
  확인('body 에도 걸려 있다', 값.body, 'contain');

  console.log('\n— 화면은 그대로 굴러간다 —');
  await p.click('[data-hbt="test"]'); await p.waitForTimeout(900);
  await p.click('.excard'); await p.waitForTimeout(2400);
  await p.click('#wbGo'); await p.waitForTimeout(1200);
  확인('시험지가 열린다', await p.locator('#s-sheet').isVisible(), true);
  await p.evaluate(() => window.scrollTo(0, 600));
  await p.waitForTimeout(400);
  확인('아래로 굴러간다', await p.evaluate(() => window.scrollY > 100), true);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
  확인('위로도 돌아온다', await p.evaluate(() => Math.round(window.scrollY)), 0);

  console.log('\n— 맨 위에서 더 당겨도 화면이 다시 불리지 않는다 —');
  await p.evaluate(() => { window.__안죽었다 = Date.now(); });
  const 답 = await p.evaluate(() => S.문제[0].en);
  await p.locator('.qrow[data-row="0"] .sin').fill(답);
  await p.waitForTimeout(300);
  await p.mouse.move(210, 120);
  await p.mouse.down();
  for (let y = 120; y <= 700; y += 40) { await p.mouse.move(210, y); await p.waitForTimeout(16); }
  await p.mouse.up();
  await p.waitForTimeout(900);
  확인('화면이 다시 안 불렸다', await p.evaluate(() => !!window.__안죽었다), true);
  확인('쓴 답이 그대로 있다',
    await p.evaluate(() => S.답[0]), 답);
  확인('시험지도 그대로', await p.locator('#s-sheet').isVisible(), true);

  console.log('\n— 새로고침은 「↻」 로만 —');
  await p.click('#shBack'); await p.waitForTimeout(900);
  if (!(await p.locator('#s-home').isVisible())) { await p.click('[data-hbt="hw"]'); await p.waitForTimeout(600); }
  확인('↻ 단추는 그대로 있다', await p.locator('#btnRefresh').isVisible(), true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
