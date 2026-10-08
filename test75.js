/* 1단계 — 과 단어장으로 연습하기 : 구분 고르는 줄 · 구분에 맞는 타일 · 그 구분의 줄만 · 범위 · 숙제 */
const { chromium } = require('playwright');
const path = require('path');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 띄우기설정, 탭, 칸열기, 칸닫기, 책고르기 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
const 보이는타일 = p => p.locator('#s-study .mtile:visible').evaluateAll(es => es.map(e => e.dataset.mode).sort());
const 화면 = p => p.evaluate(() => 지금화면_());
async function 구분고르기(p, k) {
  await 칸열기(p);
  await p.click('#bkKan [data-kan="' + k + '"]'); await p.waitForTimeout(400);
  await 칸닫기(p);
}

(async () => {
  const b = await chromium.launch(띄우기설정);
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소); await p.waitForTimeout(400);
  /* 홍길동에게 보통 단어장 하나와 과 단어장 하나를 준다 (둘이면 칩으로 고른다) */
  await p.evaluate(() => { DEMO_배정.forEach(x => { if (x.이름 === '홍길동') x.교재 = ['예시 단어장', '중2 7과']; }); });
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동'); await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  if (await p.locator('#noti').isVisible()) await p.click('#notiOk');
  const 수 = await p.evaluate(() => { const c = DEMO_과책['중2 7과']; return { 단어: c.단어.length, 본문: c.본문.length, 문법: c.문법.length }; });

  console.log('— 과 단어장을 고르면 구분 고르는 줄 —');
  await 탭(p, 'mem');
  await 칸열기(p);
  확인('보통 단어장일 땐 안 보인다', await p.locator('#bkKan').isVisible(), false);
  await p.click('[data-bk="중2 7과"]'); await p.waitForTimeout(900);
  확인('[data-bk] 단추는 그대로', await p.locator('#bookChips [data-bk]').count(), 2);
  확인('구분 줄이 뜬다', await p.locator('#bkKan').isVisible(), true);
  확인('자료 있는 구분만, 개수와 함께', (await p.locator('#bkKan [data-kan]').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim()),
    ['단어 ' + 수.단어, '본문 ' + 수.본문, '문법 ' + 수.문법]);
  확인('처음엔 단어', await p.evaluate(() => S.칸), '단어');
  확인('범위는 그 구분의 1 ~ 끝', [await p.inputValue('#inFrom'), await p.inputValue('#inTo')], ['1', String(수.단어)]);
  await 칸닫기(p);

  console.log('\n— 「단어」 —');
  확인('외우기 — 플래시카드·단어장 보기', await 보이는타일(p), ['book', 'flash']);
  await 탭(p, 'test');
  const 단어시험 = await 보이는타일(p);
  확인('시험 — 스펠링·4지선다·첫 글자 (+듣고 쓰기)', ['spell', 'choice', 'hint'].every(m => 단어시험.indexOf(m) > -1), true);
  확인('빈칸 채우기는 안 보인다', 단어시험.indexOf('cloze'), -1);
  /* 2단계 — 단어 칸에서도 듣고 쓰기. 과 단어장의 「단어」 도 낱말 하나를 받아 쓴다 (문장이 아니다) */
  확인('단어 칸에도 듣고 쓰기', 단어시험.indexOf('dict') > -1, true);
  await p.click('#s-study .mtile[data-mode="dict"]'); await p.waitForTimeout(1200);
  확인('낱말 칸(.sin)에 🔊', [await p.locator('#shList .qrow .sin').count() > 0, await p.locator('#shList .sen').count(),
    await p.locator('#shList .spk').count() === await p.locator('#shList .qrow').count()], [true, 0, true]);
  확인('단어 줄만', await p.evaluate(() => S.문제.every(w => w.칸 === '단어')), true);
  await p.click('#shBack'); await p.waitForTimeout(600);

  console.log('\n— 「본문」 —');
  await 구분고르기(p, '본문');
  확인('범위가 본문의 1 ~ 끝', [await p.inputValue('#inFrom'), await p.inputValue('#inTo')], ['1', String(수.본문)]);
  확인('시험 — 영작·듣고 쓰기', await 보이는타일(p), ['dict', 'write']);
  await 탭(p, 'mem');
  확인('외우기 — 빈칸·순서·본문 보기', await 보이는타일(p), ['book', 'cloze', 'order']);
  확인('4지선다는 안 보인다', await p.locator('#s-study .mtile[data-mode="choice"]:visible').count(), 0);
  await p.click('#s-study .mtile[data-mode="cloze"]'); await p.waitForTimeout(1200);
  확인('시험지가 열린다', await 화면(p), 'sheet');
  확인('본문 줄만 나온다 (단어가 섞이지 않는다)', await p.evaluate(() => S.문제.every(w => w.칸 === '본문')), true);
  확인('본문 줄 수만큼', await p.evaluate(() => S.문제.length), 수.본문);
  확인('기록 범위에 구분이 붙는다', await p.evaluate(() => 기록범위({ a: 1, b: 3 })), '본문 1~3');
  await p.click('#shBack'); await p.waitForTimeout(600);

  console.log('\n— 범위를 본문 1~5 로 —');
  await 칸열기(p);
  if (!(await p.locator('#inFrom').isVisible())) { await p.click('#btnHandRange'); await p.waitForTimeout(200); }
  await p.fill('#inFrom', '1'); await p.fill('#inTo', '5'); await p.waitForTimeout(200);
  await 칸닫기(p);
  await p.click('#s-study .mtile[data-mode="cloze"]'); await p.waitForTimeout(1200);
  확인('본문 다섯 줄만', await p.evaluate(() => [S.문제.length, S.문제.every(w => w.칸 === '본문')]), [Math.min(5, 수.본문), true]);
  await p.click('#shBack'); await p.waitForTimeout(600);

  console.log('\n— 「문법」 — [ ] 자리가 빈칸 —');
  await 구분고르기(p, '문법');
  확인('외우기 — 문제 보기·빈칸', await 보이는타일(p), ['book', 'cloze']);
  await p.click('#s-study .mtile[data-mode="cloze"]'); await p.waitForTimeout(1200);
  확인('문법 줄만', await p.evaluate(() => S.문제.every(w => w.칸 === '문법')), true);
  const 빈칸 = await p.evaluate(() => S.문제.map(w => [w._빈칸, (w.en.match(/\[([^\]]+)\]/) || [])[1]]));
  확인('[ ] 안의 말이 빈칸이 된다', 빈칸.every(x => x[0] === x[1]), true);
  확인('문장 속 빈칸 칸', await p.locator('#shList .gapline .gapin').count(), 수.문법);
  await p.click('#shBack'); await p.waitForTimeout(600);

  console.log('\n— 과 숙제 — 적힌 구분으로 들어간다 —');
  await p.click('[data-hbt="hw"]'); await p.waitForTimeout(600);
  await p.evaluate(() => {
    S.숙제.push({ 단어장: '중2 7과', 칸: '본문', 시작: 2, 끝: 4, 유형: '빈칸 채우기', 마감일: 오늘값(), 개별: false,
      색: '', 종류: '당일', 남은일수: 0, 완료: false, 점수: 0, 낸때: 777 });
    drawHw();
  });
  확인('숙제 줄에 구분이 보인다', /중2 7과 본문/.test(await p.locator('#hwBox').innerText()), true);
  const 몇째 = await p.evaluate(() => S.숙제.length - 1);
  await p.click('#hwBox [data-hw="' + 몇째 + '"]'); await p.waitForTimeout(1800);
  확인('시험지가 열린다', await 화면(p), 'sheet');
  확인('본문으로 들어간다', await p.evaluate(() => S.칸), '본문');
  확인('본문 2~4 세 줄', await p.evaluate(() => S.문제.map(w => w.칸 + w.no).sort()), ['본문2', '본문3', '본문4']);
  확인('기록 범위는 「본문 2~4」', await p.evaluate(() => S.범위), '본문 2~4');

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
