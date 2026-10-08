/* 검사 재조준 중에 찾은 것 — 본문 타일 가르기 · 문법 뒤 타일 되살리기 · 시험 칸으로 되돌아가기 */
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

/* 문법 단어장까지 보려면 교재를 준다 — 보통·본문·문법 셋 (네 개를 넘으면 칩 대신 고르개가 나온다) */
async function 학생으로(p) {
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.evaluate(() => { DEMO_배정.forEach(x => { if (x.이름 === '홍길동') x.교재 = ['예시 단어장', '중2 5과 본문', '중2 6과 문법']; }); });
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }
}
/* 이름 조각으로 단어장 칩 찾기 — 미리보기 단어장 이름이 바뀌어도 돌아가게 */
async function 책이름(p, 조각) {
  await 칸열기(p);
  const 것 = await p.locator('[data-bk]').evaluateAll(es => es.map(e => e.dataset.bk));
  await 칸닫기(p);
  return 것.filter(x => x.indexOf(조각) > -1)[0];
}

(async () => {
  const b = await chromium.launch(띄우기설정);
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await 학생으로(p);

  console.log('— 본문 단어장: 외우기와 시험이 타일을 나눠 갖는다 —');
  await 탭(p, 'mem');
  const 본문 = await 책이름(p, '본문');
  const 문법 = await 책이름(p, '문법');
  확인('본문·문법 단어장이 다 있다', !!본문 && !!문법, true);
  await 책고르기(p, 본문);
  확인('외우기엔 본문 보기·빈칸·순서', await 보이는타일(p), ['book', 'cloze', 'order']);
  await 탭(p, 'test');
  확인('시험엔 영작·듣고 쓰기', await 보이는타일(p), ['dict', 'write']);

  console.log('\n— 문법 단어장은 빈칸 하나뿐이라 시험에서도 빈칸을 남긴다 —');
  await 탭(p, 'mem');
  await 책고르기(p, 문법);
  확인('외우기엔 문제 보기·빈칸', await 보이는타일(p), ['book', 'cloze']);
  await 탭(p, 'test');
  확인('시험에도 빈칸이 남는다', await 보이는타일(p), ['cloze']);

  console.log('\n— 문법 → 본문으로 바꾸면 순서·영작·듣고 쓰기가 돌아온다 —');
  await 탭(p, 'mem');
  await 책고르기(p, 본문);
  확인('외우기에 순서가 돌아온다', await 보이는타일(p), ['book', 'cloze', 'order']);
  await 탭(p, 'test');
  확인('시험에 영작·듣고 쓰기가 돌아온다', await 보이는타일(p), ['dict', 'write']);

  console.log('\n— 시험 칸에서 시작한 연습은 시험 칸으로 돌아온다 —');
  await 탭(p, 'mem');
  await 책고르기(p, await 책이름(p, '예시'));
  await 탭(p, 'test');
  확인('시험 칸', await 화면(p), 'exam');
  await p.click('#s-study .mtile[data-mode="spell"]');
  await p.waitForTimeout(1200);
  확인('시험지가 열린다', await 화면(p), 'sheet');
  await p.click('#shBack');
  await p.waitForTimeout(900);
  확인('「그만」 하면 시험 칸으로', await 화면(p), 'exam');
  확인('아래 탭도 시험에 불이 켜진다',
    await p.locator('[data-hbt="test"]').evaluate(e => e.classList.contains('on')), true);

  console.log('\n— 외우기에서 시작한 것은 외우기로 —');
  await 탭(p, 'mem');
  await p.click('#s-study .mtile[data-mode="flash"]');
  await p.waitForTimeout(1200);
  확인('플래시카드가 열린다', await 화면(p), 'flash');
  await p.click('#s-flash [data-back]');
  await p.waitForTimeout(900);
  확인('「그만」 하면 외우기로', await 화면(p), 'study');

  console.log('\n— 스티커판은 시험 칸에서 들어가고 시험 칸으로 나온다 —');
  await 탭(p, 'test');
  await p.click('#s-study .hbstk');
  await p.waitForTimeout(700);
  확인('스티커판이 열린다', await 화면(p), 'sticker');
  await p.click('#s-sticker [data-back]');
  await p.waitForTimeout(700);
  확인('뒤로 하면 시험 칸으로', await 화면(p), 'exam');

  console.log('\n— 외우기 → 시험 → 뒤로가기 —');
  /* 여기서 숙제 탭을 누르면 쌓인 발자국 두 개(숙제·외우기)를 한꺼번에 걷는다.
     그 뒤의 뒤로가기가 삼켜지지 않는지도 같이 본다 */
  await 탭(p, 'hw');
  await 탭(p, 'mem');
  await 탭(p, 'test');
  await p.goBack(); await p.waitForTimeout(700);
  확인('뒤로가기 한 번이면 외우기', await 화면(p), 'study');
  확인('외우기 탭에 불이 켜진다',
    await p.locator('[data-hbt="mem"]').evaluate(e => e.classList.contains('on')), true);
  await p.goBack(); await p.waitForTimeout(700);
  확인('한 번 더 하면 숙제', await 화면(p), 'home');

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
