/* 단어 연습 보강 — 보통 단어장 듣고 쓰기 · 글자 단위 오답 · 틀린 것 3번 쓰기 */
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
const 화면 = p => p.evaluate(() => 지금화면_());
const 부른것 = p => p.evaluate(() => window.__부른것.slice());
const 비우기 = p => p.evaluate(() => { window.__부른것.length = 0; });

async function 학생으로(p) {
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }
  /* api 를 가로채 무엇을 불렀는지 적어 둔다 — 3번 쓰기가 기록을 남기지 않는지 보려고 */
  await p.evaluate(() => {
    window.__부른것 = [];
    const 원래api = window.api;
    window.api = function (이름) { window.__부른것.push(이름); return 원래api.apply(null, arguments); };
  });
}
async function 책이름(p, 조각) {
  await 칸열기(p);
  const 것 = await p.locator('[data-bk]').evaluateAll(es => es.map(e => e.dataset.bk));
  await 칸닫기(p);
  return 것.filter(x => x.indexOf(조각) > -1)[0];
}
/* 한 글자를 바꿔 틀린 답을 만든다 — 맨 끝 글자를 다른 글자로 */
function 한글자틀리게(답) {
  const 끝 = 답.slice(-1).toLowerCase();
  return 답.slice(0, -1) + (끝 === 'z' ? 'q' : 'z');
}

(async () => {
  const b = await chromium.launch(띄우기설정);
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  /* 읽어 주기를 가로채 무엇을 읽었는지 적는다 (헤드리스에는 소리가 없다) */
  await p.addInitScript(() => {
    window.__읽은것 = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel() {}, speak(u) { window.__읽은것.push(u.text); } }
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true, value: function (x) { this.text = x; }
    });
  });
  await 학생으로(p);

  /* ======================= 1. 보통 단어장 듣고 쓰기 ======================= */
  console.log('— 보통 단어장에서도 듣고 쓰기 —');
  await 탭(p, 'mem');
  const 보통 = await 책이름(p, '예시');
  const 불규칙 = await 책이름(p, '불규칙');
  await 책고르기(p, 보통);
  const 듣기타일 = p.locator('#s-study .mtile[data-mode="dict"]');
  확인('외우기에는 안 보인다 (시험 쪽 방법이다)', await 듣기타일.isVisible(), false);
  await 탭(p, 'test');
  확인('시험에 듣고 쓰기 타일이 보인다', await 듣기타일.isVisible(), true);
  확인('타일 글이 「단어」 받아쓰기', (await 듣기타일.locator('i').textContent()).trim(), '들리는 단어 쓰기');
  확인('빈칸·순서·영작은 안 보인다',
    await p.locator('#s-study .mtile[data-mode="cloze"]:visible, #s-study .mtile[data-mode="order"]:visible, #s-study .mtile[data-mode="write"]:visible').count(), 0);

  await 듣기타일.click();
  await p.waitForTimeout(1200);
  확인('시험지가 열린다', await 화면(p), 'sheet');
  확인('방법은 듣고 쓰기', await p.evaluate(() => S.모드), 'dict');
  const 문항 = await p.evaluate(() => S.문제.length);
  확인('🔊 단추가 문항마다 있다', await p.locator('#shList .qrow .spk').count(), 문항);
  확인('한 낱말 칸(.sin)으로 쓴다', await p.locator('#shList .qrow .sin').count(), 문항);
  확인('문장 칸이 아니다', await p.locator('#shList .sen').count(), 0);
  const 철자들 = await p.evaluate(() => S.문제.map(w => w.en));
  const 시험지글 = (await p.locator('#shList').innerText()).toLowerCase();
  확인('영어 철자가 안 보인다', 철자들.filter(e => 시험지글.indexOf(e.toLowerCase()) > -1), []);
  await p.locator('#shList .spk').first().click();
  확인('누르면 그 단어를 읽는다', await p.evaluate(() => window.__읽은것.slice(-1)[0]), 철자들[0]);
  await p.click('#shBack'); await p.waitForTimeout(700);

  console.log('\n— 3단변화 단어장에는 듣고 쓰기가 없다 —');
  await 탭(p, 'mem');
  await 책고르기(p, 불규칙);
  await 탭(p, 'test');
  확인('3단변화면 타일이 안 보인다', await 듣기타일.isVisible(), false);
  await 탭(p, 'mem');
  확인('외우기에도 없다', await 듣기타일.isVisible(), false);

  console.log('\n— 선생님 숙제 유형 —');
  확인('보통 단어장 숙제에 「듣고 쓰기」 가 있다',
    await p.evaluate(n => 책유형들_(n, 내책들()).indexOf('듣고 쓰기') > -1, 보통), true);
  확인('3단변화 단어장에는 없다',
    await p.evaluate(n => 책유형들_(n, 내책들()).indexOf('듣고 쓰기') > -1, 불규칙), false);
  확인('「듣고 쓰기」 숙제는 듣고 쓰기로 열린다', await p.evaluate(() => 유형모드_('듣고 쓰기')), 'dict');

  /* ======================= 2. 글자 단위 오답 ======================= */
  console.log('\n— 스펠링을 틀리면 어긋난 글자만 빨갛게 —');
  await 책고르기(p, 보통);
  await 탭(p, 'test');
  await p.click('#s-study .mtile[data-mode="spell"]');
  await p.waitForTimeout(1200);
  const 정답0 = await p.evaluate(() => S.문제[0].en);
  const 틀린0 = 한글자틀리게(정답0);
  console.log('  정답 ' + 정답0 + ' / 쓴 답 ' + 틀린0);
  await p.locator('#shList .sin').nth(0).fill(틀린0);
  await p.locator('#shList .sin').nth(1).fill(await p.evaluate(() => S.문제[1].en));
  await p.click('#shSubmit'); await p.waitForTimeout(900);
  await p.click('#btnSeeSheet'); await p.waitForTimeout(500);
  const 줄 = p.locator('#shList .qrow').nth(0);
  확인('내 답 줄이 있다', await 줄.locator('.ltrow.mine').count(), 1);
  확인('정답 줄은 「정답 :」 으로 시작', (await 줄.locator('.real').textContent()).indexOf('정답 :') === 0, true);
  const 빨간글자 = await 줄.locator('.ltrow.mine .lc.ng').allTextContents();
  확인('어긋난 한 글자만 빨갛다', 빨간글자, [틀린0.slice(-1)]);
  const 칸수 = await 줄.locator('.ltrow.mine .lc').count();
  확인('맞은 글자는 빨갛지 않다', 칸수 - 빨간글자.length, 정답0.length - 1);
  확인('두 줄이 같은 칸 수로 맞춰진다', await 줄.locator('.real .lc').count(), 칸수);
  const 줄맞춤 = await 줄.evaluate(r => {
    const 위 = r.querySelectorAll('.ltrow.mine .lc'), 아래 = r.querySelectorAll('.real .lc');
    return [...위].every((e, k) => Math.abs(e.getBoundingClientRect().left - 아래[k].getBoundingClientRect().left) < 1);
  });
  확인('글자가 위아래로 맞닿는다', 줄맞춤, true);
  확인('맞은 줄에는 안 붙는다', await p.locator('#shList .qrow').nth(1).locator('.ltrow').count(), 0);

  console.log('\n— 빠뜨린 글자 · 더 쓴 글자 —');
  const 표시 = await p.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = 글자대보기_('thirsty', 'thrsty');
    const e = document.createElement('div');
    e.innerHTML = 글자대보기_('apple', 'applle');
    return {
      빠뜨림: [...d.querySelectorAll('.real .lc.lack')].map(x => x.textContent),
      더씀: [...e.querySelectorAll('.mine .lc.more')].map(x => x.textContent)
    };
  });
  확인('빠뜨린 글자는 정답 줄에 밑줄', 표시.빠뜨림, ['i']);
  확인('더 쓴 글자는 취소선', 표시.더씀, ['l']);

  /* ======================= 3. 틀린 것 3번 쓰기 ======================= */
  console.log('\n— 틀린 것 3번 쓰기 —');
  await p.click('#shSubmit'); await p.waitForTimeout(700);   /* 결과 보기 */
  확인('결과 화면', await 화면(p), 'result');
  const 틀린수 = await p.evaluate(() => S.오답.length);
  확인('틀린 게 있다', 틀린수 > 1, true);
  확인('「틀린 것 3번 쓰기」 단추가 뜬다', await p.locator('#btnCopy3').isVisible(), true);
  await 비우기(p);
  await p.click('#btnCopy3'); await p.waitForTimeout(500);
  확인('3번 쓰기 화면', await 화면(p), 'copy3');
  const 첫단어 = (await p.locator('#c3En').textContent()).trim();
  확인('정답 철자를 보여 준다', 첫단어.length > 0, true);
  확인('진행이 보인다', (await p.locator('#c3Prog').textContent()).trim(), '1 / ' + 틀린수);

  await p.fill('#c3In', 한글자틀리게(첫단어)); await p.press('#c3In', 'Enter');
  await p.waitForTimeout(200);
  확인('틀리면 세지 않는다', await p.locator('#c3Dots i.on').count(), 0);
  확인('틀리면 어긋난 글자를 보여 준다', await p.locator('#c3Msg .lc.ng').count() > 0, true);
  for (let k = 1; k <= 2; k++) {
    await p.fill('#c3In', 첫단어); await p.press('#c3In', 'Enter'); await p.waitForTimeout(200);
    확인(k + '번 맞으면 동그라미 ' + k + '개', await p.locator('#c3Dots i.on').count(), k);
    확인(k + '번으로는 안 넘어간다', (await p.locator('#c3En').textContent()).trim(), 첫단어);
  }
  await p.fill('#c3In', 첫단어.toUpperCase()); await p.click('#c3Ok'); await p.waitForTimeout(300);
  확인('3번 맞으면 다음 단어로 넘어간다', (await p.locator('#c3Prog').textContent()).trim(), '2 / ' + 틀린수);
  확인('동그라미는 다시 비운다', await p.locator('#c3Dots i.on').count(), 0);

  /* 나머지도 다 쓴다 */
  for (let w = 1; w < 틀린수; w++) {
    const 단어 = (await p.locator('#c3En').textContent()).trim();
    for (let k = 0; k < 3; k++) { await p.fill('#c3In', 단어); await p.press('#c3In', 'Enter'); await p.waitForTimeout(150); }
  }
  확인('다 쓰면 끝 칸이 뜬다', await p.locator('#c3Done').isVisible(), true);
  확인('3번 쓰기는 결과저장을 부르지 않는다', (await 부른것(p)).indexOf('결과저장'), -1);

  await p.click('#c3Retry'); await p.waitForTimeout(900);
  확인('「오답노트 다시 풀기」 로 이어진다', await 화면(p), 'sheet');
  확인('오답노트로 푼다', await p.evaluate(() => S.재시험), true);
  확인('틀린 것만 나온다', await p.locator('#shList .qrow').count(), 틀린수);

  console.log('\n— 문장 단어장은 3번 쓰기를 안 띄운다 —');
  확인('본문 듣고 쓰기는 문장 모드', await p.evaluate(() => { S.종류 = '본문'; return 문장방법_('dict'); }), true);
  확인('보통 듣고 쓰기는 낱말 모드', await p.evaluate(() => { S.종류 = ''; return 문장방법_('dict'); }), false);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
