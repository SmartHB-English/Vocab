/* 수업 시험 단계의 제한 시간 — 안내 · 「시작」 부터 · 이어서 · 다시 보기는 새 시간 · 연습엔 타이머 없음
   (껐다 켜기 · 0 이면 자동 제출 · 묶음 고르기는 test78 이 보고, 여기서는 시험 단계를 본다) */
const path = require('path');
const { chromium } = require('playwright');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 띄우기설정 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
const 화면 = p => p.evaluate(() => 지금화면_());
const 남은초 = p => p.evaluate(() => Math.ceil((제한.끝날때 - Date.now()) / 1000));

async function 들어가기(p) {
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동'); await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  if (await p.locator('#noti').isVisible()) await p.click('#notiOk');
  await p.evaluate(() => {
    const 기본 = { 단어장: '예시 단어장', 마감일: 오늘값(), 개별: false, 색: '', 종류: '당일', 남은일수: 0, 완료: false, 점수: 0, 응시수: 0, 수업: '시간 수업' };
    S.숙제 = S.숙제.filter(h => !h.수업);
    S.숙제.push(Object.assign({}, 기본, { 순서: 1, 시작: 1, 끝: 10, 유형: '스펠링', 단계: '시험', 통과점수: 80, 남은응시: 3, 제한시간: 8, 낸때: 9101 }));
    S.숙제.push(Object.assign({}, 기본, { 순서: 2, 시작: 11, 끝: 15, 유형: '첫 글자', 단계: '연습', 낸때: 9102 }));
    drawHw();
  });
}

(async () => {
  const b = await chromium.launch(띄우기설정);
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await 들어가기(p);
  const 시험줄 = () => p.locator('.lscard .lsrow.now[data-hw]').first();

  console.log('— 시험 줄에 미리 보여 준다 —');
  확인('「80점을 넘겨야 다음이 열려요 · ⏱ 8분」', /80점을 넘겨야 다음이 열려요 · ⏱ 8분/.test(await 시험줄().innerText()), true);

  console.log('\n— 시작 전 안내 — 「시작」 을 눌러야 시간이 간다 —');
  await 시험줄().click(); await p.waitForTimeout(500);
  const 안내 = (await p.locator('#limT').innerText()).replace(/\s+/g, ' ').trim();
  확인('통과점수와 제한 시간을 같이', 안내, '80점을 넘겨야 다음이 열려요. ⏱ 8분 안에 풀어야 해요. 시작할까요?');
  확인('누르기 전엔 시간이 안 간다', await p.evaluate(() => 제한시작때_(S.숙제.filter(h => h.낸때 === 9101)[0])), 0);
  await p.click('#limGo'); await p.waitForTimeout(1800);
  확인('시험지 · 남은 시간이 뜬다', [await 화면(p), await p.locator('#fixClock').isVisible()], ['sheet', true]);
  const 처음 = await 남은초(p);
  확인('8분부터', 처음 > 470 && 처음 <= 480, true);
  await p.waitForTimeout(2200);
  확인('줄어든다', (await 남은초(p)) < 처음, true);

  console.log('\n— 껐다 켜도 이어진다 —');
  const 끄기전 = await 남은초(p);
  await 들어가기(p);
  await 시험줄().click(); await p.waitForTimeout(1800);
  확인('다시 안 묻고 이어서', [await p.locator('#limAsk').isVisible(), await 화면(p)], [false, 'sheet']);
  확인('늘어나지 않는다', (await 남은초(p)) < 끄기전, true);

  console.log('\n— 떨어져서 「다시 보기」 하면 새 응시 — 시간을 새로 센다 —');
  const 답 = await p.evaluate(() => S.문제.map(w => w.en));
  for (let k = 0; k < 답.length; k++) await p.locator('#shList .sin').nth(k).fill(k < 3 ? 답[k] : 'zzz');
  await p.click('#shSubmit'); await p.waitForTimeout(1000);
  await p.evaluate(() => show('home')); await p.waitForTimeout(400);
  await p.click('[data-again]'); await p.waitForTimeout(1800);
  확인('다시 연습엔 타이머가 없다', await p.locator('#fixClock').isVisible(), false);
  const 연습답 = await p.evaluate(() => S.문제.map(w => w.en));
  for (let k = 0; k < 연습답.length; k++) await p.locator('#shList .sin').nth(k).fill(연습답[k]);
  await p.click('#shSubmit'); await p.waitForTimeout(1000);
  await p.evaluate(() => show('home')); await p.waitForTimeout(400);
  await 시험줄().click(); await p.waitForTimeout(500);
  확인('다시 보기도 시작 전에 묻는다', await p.locator('#limAsk').isVisible(), true);
  await p.click('#limGo'); await p.waitForTimeout(1800);
  const 새 = await 남은초(p);
  확인('새 응시는 8분부터 다시', 새 > 470 && 새 <= 480, true);
  const 답2 = await p.evaluate(() => S.문제.map(w => w.en));
  for (let k = 0; k < 답2.length; k++) await p.locator('#shList .sin').nth(k).fill(답2[k]);
  await p.click('#shSubmit'); await p.waitForTimeout(1000);
  await p.evaluate(() => show('home')); await p.waitForTimeout(400);

  console.log('\n— 연습 단계는 제한이 없으면 타이머를 안 보인다 —');
  await p.locator('.lscard .lsrow.now[data-hw]').click(); await p.waitForTimeout(1800);
  확인('묻지 않고 바로', [await p.locator('#limAsk').isVisible(), await 화면(p)], [false, 'sheet']);
  확인('타이머가 없다', await p.locator('#fixClock').isVisible(), false);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
