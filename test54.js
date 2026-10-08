/* 단어장 보기 — 목록·가리기·별표·발음 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
const { 탭, 방법, 칸열기, 칸닫기, 책고르기, 범위정하기 } = require('./도구');
/* 칩 글자로 단어장 이름 찾기 */
async function 책이름(p, 조각){
  await 칸열기(p);
  const 것 = await p.locator('#bookChips [data-bk]').evaluateAll(es => es.map(e => e.dataset.bk));
  await 칸닫기(p);
  return 것.filter(x => x.indexOf(조각) > -1)[0] || 것[0];
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
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', d => d.accept());

  /* 읽어주기를 흉내 내어 무엇을 읽었는지 본다 */
  await p.addInitScript(() => {
    window.__읽은것 = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel() {}, speak(u) { window.__읽은것.push(u.text); } }
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: function (t) { this.text = t; }
    });
  });

  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }

  await p.click('[data-hbt="mem"]');
  await p.waitForTimeout(900);
  확인('연습 화면에 단추가 있다', await p.locator('.mtile[data-mode="book"]').isVisible(), true);
  확인('이름이 「단어장 보기」',
    (await p.locator('.mtile[data-mode="book"] b').textContent()).trim(), '단어장 보기');

  await 방법(p, 'book');
  await p.waitForTimeout(900);
  확인('단어장 화면이 열린다', await p.locator('#s-book').isVisible(), true);
  const 줄수 = await p.locator('#wbList .wbrow').count();
  console.log('  ' + 줄수 + '줄, 머리글: ' +
    (await p.locator('#wbName').innerText()).replace(/\s+/g, ' ').trim());
  확인('단어가 줄줄이 나온다', 줄수 > 0, true);
  확인('개수를 알려 준다', /개/.test(await p.locator('#wbCnt').textContent()), true);
  await p.screenshot({ path: 'bk1_all.png' });

  const 첫줄 = p.locator('#wbList .wbrow').first();
  const 영1 = (await 첫줄.locator('.wben').textContent()).trim();
  const 뜻1 = (await 첫줄.locator('.wbko').textContent()).trim();
  console.log('  첫 줄: ' + 영1 + ' — ' + 뜻1);
  확인('영어가 있다', 영1.length > 0, true);
  확인('뜻이 있다', 뜻1.length > 0, true);

  console.log('\n— 뜻 가리기 —');
  await p.click('#wbChips [data-wb="ko"]');
  await p.waitForTimeout(400);
  확인('가리기가 걸린다', await p.locator('#wbList').evaluate(e => e.classList.contains('hideko')), true);
  확인('뜻 글자가 안 보인다',
    await 첫줄.locator('.wbko').evaluate(e => getComputedStyle(e).color), 'rgba(0, 0, 0, 0)');
  확인('영어는 그대로 보인다',
    await 첫줄.locator('.wben').evaluate(e => getComputedStyle(e).color !== 'rgba(0, 0, 0, 0)'), true);
  await p.screenshot({ path: 'bk2_hideko.png' });

  console.log('\n— 줄을 누르면 그 줄만 열린다 —');
  await 첫줄.locator('.wbno').click();
  await p.waitForTimeout(300);
  확인('첫 줄이 열린다', await 첫줄.evaluate(e => e.classList.contains('open')), true);
  확인('열린 줄은 뜻이 보인다',
    await 첫줄.locator('.wbko').evaluate(e => getComputedStyle(e).color !== 'rgba(0, 0, 0, 0)'), true);
  확인('둘째 줄은 아직 가려져 있다',
    await p.locator('#wbList .wbrow').nth(1).evaluate(e => e.classList.contains('open')), false);

  console.log('\n— 영어 가리기 —');
  await p.click('#wbChips [data-wb="en"]');
  await p.waitForTimeout(400);
  확인('영어 가리기로 바뀐다',
    await p.locator('#wbList').evaluate(e => [e.classList.contains('hideen'), e.classList.contains('hideko')]),
    [true, false]);

  console.log('\n— 모두 보기로 되돌리기 —');
  await p.click('#wbChips [data-wb="all"]');
  await p.waitForTimeout(400);
  확인('가리기가 풀린다',
    await p.locator('#wbList').evaluate(e => [e.classList.contains('hideen'), e.classList.contains('hideko')]),
    [false, false]);

  console.log('\n— 단어를 누르면 읽어 준다 —');
  await 첫줄.locator('.wben').click();
  await p.waitForTimeout(400);
  const 읽음 = await p.evaluate(() => window.__읽은것);
  console.log('  읽은 것: ' + JSON.stringify(읽음));
  확인('한 번 읽었다', 읽음.length, 1);
  확인('그 단어를 읽었다', 읽음[0], 영1);

  console.log('\n— 별표 —');
  확인('처음엔 별표가 없다', await p.locator('#wbList .wbrow.on').count(), 0);
  await 첫줄.locator('.wbstar').click();
  await p.waitForTimeout(400);
  확인('별표가 켜진다', await 첫줄.evaluate(e => e.classList.contains('on')), true);
  확인('머리글에 별표 수가 나온다',
    /별표 1개/.test(await p.locator('#wbName').innerText()), true);
  확인('별표를 눌러도 읽지 않는다', (await p.evaluate(() => window.__읽은것)).length, 1);

  await p.locator('#wbList .wbrow').nth(2).locator('.wbstar').click();
  await p.waitForTimeout(400);
  확인('두 개가 된다', await p.locator('#wbList .wbrow.on').count(), 2);
  await p.screenshot({ path: 'bk3_star.png' });

  console.log('\n— 별표만 보기 —');
  await p.click('#wbStarOnly');
  await p.waitForTimeout(500);
  확인('별표한 것만 남는다', await p.locator('#wbList .wbrow').count(), 2);
  확인('남은 것은 전부 별표', await p.locator('#wbList .wbrow.on').count(), 2);
  확인('단추가 켜진 표시', await p.locator('#wbStarOnly').evaluate(e => e.classList.contains('on')), true);

  console.log('\n— 별표만 보기에서 별표를 빼면 사라진다 —');
  await p.locator('#wbList .wbrow').first().locator('.wbstar').click();
  await p.waitForTimeout(500);
  확인('한 개만 남는다', await p.locator('#wbList .wbrow').count(), 1);

  await p.click('#wbStarOnly');
  await p.waitForTimeout(400);
  확인('되돌리면 다시 다 나온다', await p.locator('#wbList .wbrow').count(), 줄수);

  console.log('\n— 별표는 앱을 껐다 켜도 남는다 —');
  await p.reload();
  await p.waitForTimeout(500);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  const n2 = p.locator('#noti');
  if (await n2.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(800);
  await 방법(p, 'book'); await p.waitForTimeout(800);
  확인('별표가 그대로 있다', await p.locator('#wbList .wbrow.on').count(), 1);

  console.log('\n— 그만 누르면 연습으로 돌아간다 —');
  await p.click('#s-book [data-back]');
  await p.waitForTimeout(600);
  확인('연습 화면', await p.locator('#s-study').isVisible(), true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
