/* 학생 화면 — 80점을 못 넘기면 숙제가 그대로 남고 '숙제 다시 풀기'가 뜬다 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
/* 로그인하면 알림 팝업이 뜬다 — 눌러서 닫고 시작한다 (실제 학생도 그렇게 합니다) */
async function 알림닫기(p){
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(350); }
}


/* 시험지 한 장을 정답 수만큼만 맞게 채워 제출한다 */
async function 시험지풀기(p, 맞출개수) {
  await p.waitForTimeout(400);
  await p.evaluate((n) => {
    S.문제.forEach(function (w, i) {
      var inp = document.querySelector('.qrow[data-row="' + i + '"] .sin');
      if (!inp) return;
      inp.value = (i < n) ? w.en : 'zzzz';
      inp.dispatchEvent(new Event('input'));
    });
  }, 맞출개수);
  await p.waitForTimeout(200);
  await p.click('#shSubmit');
  await p.waitForTimeout(1300);
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
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234');
  await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1200);
  await 알림닫기(p);

  확인('합격점은 80점', await p.evaluate(() => 합격점()), 80);
  /* 숙제는 체크리스트 한 장(.cklist)으로 바뀌었다 — 아직 안 낸 줄은 .ckrow:not(.done), 맨 위는 .ckrow.now */
  const 남은전 = await p.locator('#hwBox .ckrow:not(.done)').count();
  console.log('  남은 숙제:', 남은전, '개');

  /* ---------- 10문제 중 7개만 맞히기 = 70점 ---------- */
  console.log('\n— 70점 (합격점 못 넘김) —');
  await p.locator('#hwBox .ckrow.now').click();
  await p.waitForTimeout(1300);
  await 시험지풀기(p, 7);

  확인('결과 화면이 뜬다',
    await p.evaluate(() => document.getElementById('s-result').classList.contains('on')), true);
  확인('점수는 70점', (await p.locator('#rScore').textContent()).trim(), '70');
  확인('빨간 안내가 보인다', await p.locator('#rFail').isVisible(), true);
  const 안내 = (await p.locator('#rFail').innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 안내);
  확인('몇 점을 넘겨야 하는지 알려 준다', 안내.indexOf('80점을 넘겨야') > -1, true);
  확인('지금 점수도 알려 준다', 안내.indexOf('70점') > -1, true);
  확인('아직 안 낸 숙제라고 말해 준다', 안내.indexOf('안 낸 숙제') > -1, true);
  확인('숙제 다시 풀기 단추', await p.locator('#btnRedoHw').isVisible(), true);
  확인('틀린 것만 다시 풀기도 그대로', await p.locator('#btnRetryWrong').isVisible(), true);
  await p.screenshot({ path: 'v1_fail.png' });

  /* 홈으로 돌아가면 그 숙제가 그대로 남아 있어야 한다 */
  await p.click('#s-result [data-back="home"]');
  await p.waitForTimeout(800);
  확인('숙제가 사라지지 않는다', await p.locator('#hwBox .ckrow:not(.done)').count(), 남은전);
  const 줄 = (await p.locator('#hwBox .ckrow.now').innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 줄);
  확인('몇 점이었는지 보인다', /70점/.test(줄), true);
  확인('다시 풀라고 표시', 줄.indexOf('다시') > -1, true);
  const 낸줄 = (await p.locator('#hwBox .ckhead').innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 낸줄);
  확인('낸 숙제 수는 그대로 1건', /4 \/ 5/.test(낸줄), true);
  await p.screenshot({ path: 'v2_hwrow.png' });

  /* ---------- 다시 풀어서 90점 ---------- */
  console.log('\n— 다시 풀어 90점 —');
  await p.locator('#hwBox .ckrow.now').click();
  await p.waitForTimeout(1300);
  await 시험지풀기(p, 7);
  await p.click('#btnRedoHw');
  await p.waitForTimeout(1300);
  확인('그 숙제가 다시 열린다',
    await p.evaluate(() => document.getElementById('s-sheet').classList.contains('on')), true);
  확인('같은 범위 10문제', await p.locator('.qrow').count(), 10);
  확인('오답노트가 아니라 숙제로 본다', await p.evaluate(() => S.재시험), false);
  await 시험지풀기(p, 9);
  확인('90점', (await p.locator('#rScore').textContent()).trim(), '90');
  확인('안내가 사라진다', await p.locator('#rFail').isVisible(), false);
  확인('다시 풀기 단추도 사라진다', await p.locator('#btnRedoHw').isVisible(), false);

  await p.click('#s-result [data-back="home"]');
  await p.waitForTimeout(800);
  확인('이제 숙제가 하나 줄어든다', await p.locator('#hwBox .ckrow:not(.done)').count(), 남은전 - 1);
  const 낸줄2 = (await p.locator('#hwBox .ckhead').innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 낸줄2);
  확인('낸 숙제가 2건이 된다', /3 \/ 5/.test(낸줄2), true);
  await p.screenshot({ path: 'v3_pass.png' });

  /* ---------- 혼자 연습은 합격점과 상관없다 ---------- */
  console.log('\n— 혼자 연습 —');
  await p.evaluate(() => { S.현재숙제 = null; });
  await p.evaluate(() => 결과합격표시(10));
  확인('숙제가 아니면 안내가 없다', await p.locator('#rFail').isVisible(), false);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
