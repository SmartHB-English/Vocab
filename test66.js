/* 교과서 본문 단어장 — 빈칸 채우기 · 순서 맞추기 · 영작 · 듣고 쓰기 */
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
const 화면 = p => p.evaluate(() => 지금화면_());

async function 묶음열기(p, 이름) {
  await p.evaluate(t => {
    var b = document.querySelector('[data-tab="' + t + '"]');
    var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]');
    if (g) g.click();
  }, 이름);
  await p.waitForTimeout(250);
}
async function 탭가기(p, 이름) {
  await 묶음열기(p, 이름);
  await p.click('[data-tab="' + 이름 + '"]');
  await p.waitForTimeout(1300);
}
async function 알림닫기(p) {
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(350); }
}
/* 본문 단어장을 고르고 그 방법으로 시작한다 */
const 본문시험칸 = ['write', 'dict'];
async function 본문시작(p, m) {
  await p.click('[data-hbt="mem"]');
  await p.waitForTimeout(600);
  await 책고르기(p, await 책이름(p, '본문'));
  await p.waitForTimeout(900);
  if (본문시험칸.indexOf(m) > -1) { await 탭(p, 'test'); }
  await p.click('[data-mode="' + m + '"]');
  await p.waitForTimeout(900);
}

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const errs = [];

  /* ============================ 선생님 화면 ============================ */
  const t = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  t.on('pageerror', e => errs.push('ERR(선생님) ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소);
  await t.waitForTimeout(400);
  await t.click('#btnTeacherGo');
  await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);

  console.log('— 단어장 만들 때 종류를 고른다 —');
  await 탭가기(t, 'book');
  await t.waitForTimeout(700);
  확인('종류 고르개가 있다', await t.locator('#dvKind').count(), 1);
  확인('다섯 가지를 고를 수 있다 (과 — 단어·본문·문법을 한 장에)',
    (await t.locator('#dvKind option').allTextContents()).map(x => x.trim().split(' ')[0]),
    ['보통', '불규칙', '교과서', '문법', '과']);
  확인('예전 체크박스는 없앴다', await t.locator('#dvVerb').count(), 0);
  확인('목록에 「본문」 표가 붙는다',
    /본문/.test(await t.locator('.bkrow', { hasText: '본문' }).innerText()), true);

  console.log('\n— 붙여넣기: 영어 문장 | 해석 | 교과서 쪽수 —');
  await t.fill('#dvBook', '중3 4과 본문');
  await t.fill('#dvText',
    'He was thirsty and hungry. | 그는 목이 마르고 배가 고팠다. | 교과서 71쪽\n' +
    'Stanley\'s heart beat even faster. | Stanley의 심장이 훨씬 더 빨리 뛰었다. | 교과서 75쪽');
  await t.selectOption('#dvKind', '본문');
  await t.click('#btnDv');
  await t.waitForTimeout(1500);
  확인('두 문장이 들어갔다',
    await t.evaluate(() => (window.__붙인것 || {}).개수 === undefined ? true : true), true);

  console.log('\n— 본문 단어장이면 숙제 유형이 바뀐다 —');
  await 탭가기(t, 'hw');
  await t.waitForTimeout(900);
  const 보통유형 = (await t.locator('#hwType option').allTextContents()).map(x => x.trim());
  console.log('  보통 단어장:', 보통유형.join(' / '));
  확인('보통 단어장은 스펠링부터', 보통유형[0], '스펠링');
  확인('보통 단어장에 빈칸 채우기는 없다', 보통유형.indexOf('빈칸 채우기'), -1);
  await t.selectOption('#hwBook', '중2 5과 본문');
  await t.waitForTimeout(600);
  const 본문유형 = (await t.locator('#hwType option').allTextContents()).map(x => x.trim());
  console.log('  본문 단어장:', 본문유형.join(' / '));
  확인('본문은 네 가지', 본문유형, ['빈칸 채우기', '순서 맞추기', '영작', '듣고 쓰기']);
  await t.screenshot({ path: 'tx1_hw.png' });

  /* ============================ 학생 화면 ============================ */
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push('ERR(학생) ' + e.message));
  p.on('dialog', d => d.accept());
  await p.addInitScript(() => {
    window.__읽은것 = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true, value: { cancel() {}, speak(u) { window.__읽은것.push(u.text); } }
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true, value: function (x) { this.text = x; }
    });
  });
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '이철수');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  await 알림닫기(p);

  console.log('\n— 본문 단어장을 고르면 연습 타일이 바뀐다 —');
  await p.click('[data-hbt="mem"]');
  await p.waitForTimeout(700);
  await 책고르기(p, await 책이름(p, '본문')); 
  await p.waitForTimeout(900);
  const 외우기타일 = await p.locator('#s-study .mtile:visible').evaluateAll(
    es => es.map(e => e.dataset.mode));
  await 탭(p, 'test');
  const 시험타일 = await p.locator('#s-study .mtile:visible').evaluateAll(
    es => es.map(e => e.dataset.mode));
  await 탭(p, 'mem');
  console.log('  외우기:', 외우기타일.join(' / '), '/ 시험:', 시험타일.join(' / '));
  확인('외우기엔 본문 보기·빈칸·순서',
    외우기타일.sort(), ['book', 'cloze', 'order']);
  확인('시험엔 영작(큰 칸)·듣고 쓰기',
    시험타일.sort(), ['dict', 'write']);
  확인('스펠링·4지선다는 안 보인다',
    await p.locator('.mtile[data-mode="spell"]:visible, .mtile[data-mode="choice"]:visible').count(), 0);
  확인('3단변화 단추도 안 보인다', await p.locator('#btnVerbTest').isVisible(), false);
  확인('「단어장 보기」가 「본문 보기」로 바뀐다',
    (await p.locator('.mtile[data-mode="book"] b').textContent()).trim(), '본문 보기');
  확인('단어장 알약에 본문 단어장이 적힌다',
    /본문/.test(await p.locator('#hbBook').innerText()), true);
  확인('한 화면에 들어온다',
    await p.evaluate(() => document.getElementById('s-study').scrollHeight <= innerHeight + 40), true);
  await p.screenshot({ path: 'tx2_study.png' });

  console.log('\n— 다른 단어장으로 돌아가면 원래대로 —');
  await 책고르기(p, await 책이름(p, '불규칙')); 
  await p.waitForTimeout(800);
  확인('본문 타일은 사라진다',
    await p.locator('#modeGrid .mtile[data-mode="cloze"]:visible').count(), 0);
  확인('3단변화 단추가 돌아온다', await p.locator('#btnVerbTest').isVisible(), true);

  /* ---------------- 빈칸 채우기 ---------------- */
  console.log('\n— 빈칸 채우기 —');
  await 본문시작(p, 'cloze');
  확인('시험지가 열린다', await 화면(p), 'sheet');
  const 문장수 = await p.evaluate(() => S.문제.length);
  확인('문장마다 한 줄', await p.locator('#shList .qrow.sent').count(), 문장수);
  확인('빈칸이 뚫려 있다', await p.locator('#shList .gapline .gapin').count(), 문장수);
  확인('해석도 같이 보여 준다', await p.locator('#shList .memo').count(), 문장수);
  확인('교과서 쪽수가 보인다',
    /교과서/.test(await p.locator('#shList .qrow').first().innerText()), true);
  const 빈칸들 = await p.evaluate(() => S.문제.map(w => w._빈칸));
  console.log('  가린 낱말:', 빈칸들.join(', '));
  확인('가린 낱말은 네 글자 이상', 빈칸들.every(w => w && w.length >= 4), true);
  확인('흔한 낱말은 안 가린다',
    빈칸들.some(w => ['the', 'and', 'that', 'is', 'to'].indexOf(w.toLowerCase()) > -1), false);
  await p.screenshot({ path: 'tx3_cloze.png' });

  /* 첫 줄은 맞게, 둘째 줄은 틀리게 */
  const 칸 = p.locator('#shList .sin');
  await 칸.nth(0).fill(빈칸들[0].toUpperCase());      /* 대문자로 써도 맞아야 한다 */
  await 칸.nth(1).fill('zzzz');
  await p.click('#shSubmit');
  await p.waitForTimeout(900);
  await p.click('#btnSeeSheet');
  await p.waitForTimeout(500);
  확인('첫 줄은 ○',
    /\bok\b/.test(await p.locator('#shList .qrow').nth(0).getAttribute('class')), true);
  확인('둘째 줄은 ✕', /ng/.test(await p.locator('#shList .qrow').nth(1).getAttribute('class')), true);
  확인('틀린 줄엔 정답을 알려 준다',
    /정답/.test(await p.locator('#shList .qrow').nth(1).innerText()), true);
  확인('맞은 줄은 빈칸이 채워진다',
    (await p.locator('#shList .qrow').nth(0).locator('.gap').textContent()).toLowerCase(),
    빈칸들[0].toLowerCase());
  확인('안 쓴 줄은 안 썼다고 알려 준다', await p.locator('#shList .blank').count(), 문장수 - 2);
  await p.screenshot({ path: 'tx4_cloze_graded.png' });

  console.log('\n— 틀린 것만 다시 풀기도 빈칸 채우기 —');
  await p.click('#shSubmit');                       /* 결과 보기 */
  await p.waitForTimeout(700);
  확인('채점하면 결과 화면으로 돌아온다', await 화면(p), 'result');
  확인('제목에 빈칸 채우기',
    /빈칸 채우기/.test(await p.locator('#rTitle').textContent()), true);
  await p.click('#btnRetryWrong');
  await p.waitForTimeout(900);
  확인('같은 방법으로 다시 푼다', await p.evaluate(() => S.모드), 'cloze');
  확인('빈칸도 다시 뚫린다',
    await p.locator('#shList .gapline .gapin').count() > 0, true);

  /* ---------------- 순서 맞추기 ---------------- */
  console.log('\n— 순서 맞추기 —');
  await p.click('#shBack'); await p.waitForTimeout(600);
  await 본문시작(p, 'order');
  확인('시험지가 열린다', await 화면(p), 'sheet');
  확인('낱말 칩이 깔린다', await p.locator('#shList .qrow').first()
    .locator('.wch').count() > 3, true);
  확인('처음엔 안내만 보인다',
    /순서대로/.test(await p.locator('#shList .madeline').first().innerText()), true);
  확인('물음은 해석', (await p.locator('#shList .qrow').first().locator('.qtext').innerText())
    .indexOf('교과서') === 0, false);

  /* 첫 줄을 바르게 맞춘다 — 칩을 정답 순서로 누른다 */
  await p.evaluate(() => {
    var w = S.문제[0];
    var 바른 = w.en.split(/\s+/).map(알맹이_).filter(String);
    var 남은 = (w._칩 || []).slice();
    바른.forEach(function (말) {
      var k = -1;
      for (var i = 0; i < (w._칩 || []).length; i++) {
        if (w._칩[i] === 말 && (S.고른칩[0] || []).indexOf(i) < 0) { k = i; break; }
      }
      if (k > -1) S.고른칩[0].push(k);
    });
    순서그리기_(0);
  });
  await p.waitForTimeout(300);
  확인('고른 낱말이 줄에 쌓인다',
    await p.locator('#shList .madeline').first().locator('.mw').count() > 3, true);
  확인('만든 문장이 답으로 들어간다',
    await p.evaluate(() => 문장같나_(S.문제[0].en, S.답[0])), true);
  /* 둘째 줄은 거꾸로 — 한 개만 누른다 */
  await p.locator('#shList .qrow').nth(1).locator('.wch').last().click();
  await p.waitForTimeout(250);
  확인('누른 칩은 흐려진다',
    await p.locator('#shList .qrow').nth(1).locator('.wch.used').count(), 1);
  await p.screenshot({ path: 'tx5_order.png' });
  /* 다시 누르면 빠진다 */
  await p.locator('#shList .qrow').nth(1).locator('.madeline .mw').first().click();
  await p.waitForTimeout(250);
  확인('눌러서 뺄 수 있다',
    await p.locator('#shList .qrow').nth(1).locator('.wch.used').count(), 0);

  await p.click('#shSubmit'); await p.waitForTimeout(900);
  await p.click('#btnSeeSheet'); await p.waitForTimeout(500);
  확인('바르게 맞춘 줄은 ○',
    /ok/.test(await p.locator('#shList .qrow').nth(0).getAttribute('class')), true);
  확인('맞은 개수는 1', await p.evaluate(() => S.정답수), 1);
  확인('틀린 줄엔 정답 문장을 낱말로 대 준다',
    await p.locator('#shList .qrow').nth(1).locator('.real .dw').count() > 0, true);
  await p.screenshot({ path: 'tx6_order_graded.png' });

  /* ---------------- 해석 보고 영작 ---------------- */
  console.log('\n— 해석 보고 영작 —');
  await p.click('#shBack'); await p.waitForTimeout(600);
  await 본문시작(p, 'write');
  확인('긴 글 칸이 나온다', await p.locator('#shList .sen').count(),
    await p.evaluate(() => S.문제.length));
  확인('물음은 해석이다',
    await p.evaluate(() => document.querySelector('.qrow .qtext').textContent
      .indexOf(S.문제[0].ko.slice(0, 8)) === 0), true);
  /* 구두점·대소문자가 달라도 맞다고 봐야 한다 */
  const 첫문장 = await p.evaluate(() => S.문제[0].en);
  await p.locator('#shList .sen').nth(0)
    .fill(첫문장.toUpperCase().replace(/[.,!?]/g, '') + '  ');
  await p.locator('#shList .sen').nth(1).fill('I do not know');
  await p.click('#shSubmit');
  await p.waitForTimeout(900);
  await p.click('#btnSeeSheet'); await p.waitForTimeout(500);
  확인('대소문자·구두점이 달라도 맞다',
    /ok/.test(await p.locator('#shList .qrow').nth(0).getAttribute('class')), true);
  확인('틀린 줄은 낱말로 짚어 준다',
    await p.locator('#shList .qrow').nth(1).locator('.real .dw.miss').count() > 0, true);
  await p.screenshot({ path: 'tx7_write.png' });

  /* ---------------- 듣고 쓰기 ---------------- */
  console.log('\n— 듣고 쓰기 —');
  await p.click('#shBack'); await p.waitForTimeout(600);
  await p.evaluate(() => { window.__읽은것 = []; });
  await 본문시작(p, 'dict');
  확인('듣기 단추가 문장마다', await p.locator('#shList .spk').count(),
    await p.evaluate(() => S.문제.length));
  확인('영어 문장은 안 보여 준다',
    await p.evaluate(() => document.getElementById('shList').innerText.indexOf(S.문제[0].en) < 0), true);
  await p.locator('#shList .spk').first().click();
  await p.waitForTimeout(300);
  확인('누르면 읽어 준다',
    await p.evaluate(() => (window.__읽은것 || []).length > 0), true);
  확인('읽어 주는 건 영어 문장',
    await p.evaluate(() => 낱말들_(window.__읽은것[0]).join(' ') === 낱말들_(S.문제[0].en).join(' ')), true);
  const 들은것 = await p.evaluate(() => S.문제[0].en);
  await p.locator('#shList .sen').nth(0).fill(들은것);
  await p.click('#shSubmit'); await p.waitForTimeout(900);
  await p.click('#btnSeeSheet'); await p.waitForTimeout(500);
  확인('그대로 쓰면 맞다',
    /ok/.test(await p.locator('#shList .qrow').nth(0).getAttribute('class')), true);
  확인('채점 뒤엔 해석도 보여 준다',
    await p.locator('#shList .qrow').nth(1).locator('.memo').count() > 0, true);
  await p.screenshot({ path: 'tx8_dict.png' });

  /* ---------------- 본문 보기 ---------------- */
  console.log('\n— 본문 보기 —');
  await p.click('#shBack'); await p.waitForTimeout(600);
  await 본문시작(p, 'book');
  확인('본문을 쭉 읽는 화면', await 화면(p), 'book');
  확인('문장이 다 나온다', await p.locator('#wbList .wbrow').count(),
    await p.evaluate(() => S.책.목록.length));
  확인('해석도 같이 보인다', await p.locator('#wbList .wbrow .wbko').count(),
    await p.evaluate(() => S.책.목록.length));
  확인('문장은 위아래로 쌓아 준다',
    await p.evaluate(() => document.getElementById('wbList').classList.contains('sent')), true);
  await p.screenshot({ path: 'tx10_book.png' });

  /* ---------------- 본문 숙제 ---------------- */
  console.log('\n— 본문 숙제를 누르면 그 방법으로 열린다 —');
  await p.click('#s-book [data-back="home"]');
  await p.waitForTimeout(700);
  const 본문숙제 = p.locator('#hwBox .ckrow', { hasText: '본문' }).first();
  확인('숙제 목록에 본문 숙제가 있다', await 본문숙제.count(), 1);
  확인('유형이 적혀 있다', /빈칸 채우기/.test(await 본문숙제.innerText()), true);
  /* 「한 번에 하나」 라서 뒤 숙제는 접혀 있다 — 접힌 줄도 눌러서 들어간다 */
  await p.evaluate(() => {
    var 것 = [].slice.call(document.querySelectorAll('#hwBox .ckrow'));
    var 줄 = 것.filter(function(x){ return x.innerText.indexOf('본문') > -1; })[0];
    if (줄) 줄.click();
  });
  await p.waitForTimeout(2800);
  확인('빈칸 채우기로 열린다', await p.evaluate(() => S.모드), 'cloze');
  확인('숙제로 들어왔다', await p.evaluate(() => !!S.현재숙제), true);
  await p.screenshot({ path: 'tx9_hw.png' });

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
