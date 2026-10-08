/* 스크롤 시험지 + Enter 중복 버그 + 시험 카테고리 */
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

/* 선생님 화면 탭은 묶음(오늘/숙제/학생/자료) 아래로 숨어 있다 — 묶음을 먼저 펼쳐야 보인다 */
async function 묶음열기(p, 이름){
  await p.evaluate(t => {
    var b = document.querySelector('[data-tab="' + t + '"]');
    var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]');
    if (g) g.click();
  }, 이름);
  await p.waitForTimeout(250);
}
async function 탭가기(p, 이름){
  await 묶음열기(p, 이름);
  await p.click('[data-tab="' + 이름 + '"]');
}
/* 로그인하면 알림 팝업이 뜬다 — 눌러서 닫고 시작한다 (실제 학생도 그렇게 합니다) */
async function 알림닫기(p){
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(350); }
}

/* 로그인하면 첫 화면(고르기)이 뜨므로 '단어' 칸으로 한 번 더 들어간다 */
async function 허브넘기(p){
  await p.waitForTimeout(400);
  /* 단어장·모드 고르기는 '연습' 칸으로 옮겼다 */
  await p.click('[data-hbt="mem"]');
  await p.waitForTimeout(500);
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
  await p.waitForTimeout(900);
  await 알림닫기(p);
  await 허브넘기(p);

  /* ---------- 1. 시험 숙제 카드가 '시험' 칸에 따로 뜨나 ---------- */
  console.log('\n— 학생 화면 —');
  /* 숙제는 칸(.hwsec)으로 나누던 것을 체크리스트 한 장(.hwcard)으로 바꿨다 */
  const 칸들 = (await p.locator('#hwBox .ckrow').allInnerTexts()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  숙제 줄:', 칸들.join(' | '));
  확인('숙제 줄에는 시험이 없다', 칸들.filter(t => /한 번만/.test(t)).length, 0);

  /* 시험은 「시험」 칸으로 따로 간다 */
  await p.click('[data-hbt="test"]');
  await p.waitForTimeout(800);
  const 시험줄 = (await p.locator('.excard').allInnerTexts()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  시험 줄:', 시험줄.join(' | '));
  확인('시험 카드가 있다', 시험줄.length, 1);
  확인('한 번만 본다고 적혀 있다', 시험줄.some(t => /한 번만/.test(t)), true);
  await p.click('[data-hbt="hw"]');
  await p.waitForTimeout(600);

  /* ---------- 2. 스크롤 시험지 ---------- */
  console.log('\n— 스크롤 시험지 —');
  await p.click('[data-hbt="hw"]'); await p.waitForTimeout(400);
  await p.locator('[data-hw]').first().click();   // 스펠링 숙제
  await p.waitForTimeout(900);
  확인('시험지 화면이 열렸다', await p.evaluate(() => document.getElementById('s-sheet').classList.contains('on')), true);
  const 총 = await p.locator('.qrow').count();
  console.log('  문제 줄 수:', 총);
  확인('문제가 한 번에 다 보인다 (10문제)', 총, 10);
  console.log('  머리 개수:', (await p.locator('#shCnt').textContent()).trim());
  확인('처음엔 0개 씀', (await p.locator('#shCnt').textContent()).trim(), '0 / 10 씀');

  /* 세 문제만 답을 쓰고, 위로 올라가 고쳐 쓸 수 있는지 */
  await p.locator('.qrow .sin').nth(0).fill('zzz');
  await p.locator('.qrow .sin').nth(1).fill('yyy');
  await p.waitForTimeout(150);
  확인('쓴 개수가 센다', (await p.locator('#shCnt').textContent()).trim(), '2 / 10 씀');
  확인('앞 문제 답이 그대로 남아 있다', await p.locator('.qrow .sin').nth(0).inputValue(), 'zzz');
  await p.locator('.qrow .sin').nth(0).fill('고쳐씀');
  확인('앞 문제를 고쳐 쓸 수 있다', await p.locator('.qrow .sin').nth(0).inputValue(), '고쳐씀');

  /* Enter 를 눌러도 제출되지 않고 다음 칸으로 가야 한다 */
  const 전화면 = await p.evaluate(() => document.getElementById('s-sheet').classList.contains('on'));
  await p.locator('.qrow .sin').nth(0).press('Enter');
  await p.waitForTimeout(200);
  확인('Enter 로 제출되지 않는다', await p.evaluate(() => document.getElementById('s-sheet').classList.contains('on')), true);
  확인('Enter 는 다음 칸으로 간다',
    await p.evaluate(() => +document.activeElement.dataset.i), 1);

  /* Enter 연타해도 채점이 시작되지 않아야 한다 */
  for (let i = 0; i < 5; i++) await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  확인('Enter 연타해도 채점 안 됨', await p.evaluate(() => !!S.채점됨), false);

  /* 정답을 다 써 넣고 제출 */
  await p.evaluate(() => {
    qsa('#shList .sin').forEach(function (inp) {
      var i = +inp.dataset.i;
      inp.value = S.문제[i].en;
      inp.dispatchEvent(new Event('input'));
    });
  });
  await p.waitForTimeout(200);
  확인('다 쓰면 10/10', (await p.locator('#shCnt').textContent()).trim(), '10 / 10 씀');

  await p.locator('.qrow .sin').nth(3).fill('틀린답');   // 한 개만 일부러 틀리게
  await p.waitForTimeout(150);
  await p.click('#shSubmit');
  await p.waitForTimeout(1200);

  console.log('\n— 채점 결과 —');
  확인('결과 화면으로 넘어갔다', await p.evaluate(() => document.getElementById('s-result').classList.contains('on')), true);
  console.log('  점수:', await p.locator('#rScore').textContent());
  확인('9/10 이라 90점', (await p.locator('#rScore').textContent()).trim(), '90');
  확인('답안지 보기 단추가 생겼다', await p.locator('#btnSeeSheet').isVisible(), true);

  /* ---------- 3. 답안지에서 내가 쓴 답을 다시 볼 수 있나 ---------- */
  await p.click('#btnSeeSheet');
  await p.waitForTimeout(500);
  확인('답안지로 돌아왔다', await p.evaluate(() => document.getElementById('s-sheet').classList.contains('on')), true);
  확인('맞은 줄 9개', await p.locator('.qrow.ok').count(), 9);
  확인('틀린 줄 1개', await p.locator('.qrow.ng').count(), 1);
  const 틀린줄 = p.locator('.qrow.ng').first();
  console.log('  틀린 줄:', (await 틀린줄.textContent()).replace(/\s+/g, ' ').trim().slice(0, 60));
  확인('내가 쓴 답이 남아 있다', await 틀린줄.locator('.sin').inputValue(), '틀린답');
  확인('정답을 알려 준다', (await 틀린줄.locator('.real').textContent()).indexOf('정답 :') === 0, true);
  확인('채점 뒤에는 못 고친다', await 틀린줄.locator('.sin').isDisabled(), true);
  확인('요약 띠가 있다', (await p.locator('.sheetsum b').textContent()).trim(), '90점');
  await p.screenshot({ path: 'h1_sheet_graded.png', fullPage: true });

  /* ---------- 4. 4지선다도 시험지로 ---------- */
  console.log('\n— 4지선다 시험지 —');
  await p.click('#shBack');
  await p.waitForTimeout(600);
  await p.click('[data-hbt="mem"]');
  await p.waitForTimeout(400);
  await 방법(p, 'choice');
  await p.waitForTimeout(700);
  확인('4지선다도 시험지', await p.evaluate(() => document.getElementById('s-sheet').classList.contains('on')), true);
  const 보기수 = await p.locator('.qrow').first().locator('.sch').count();
  확인('한 줄에 보기 4개', 보기수, 4);
  await p.locator('.qrow').first().locator('.sch').nth(0).click();
  await p.waitForTimeout(150);
  확인('고른 보기에 표시', await p.locator('.qrow').first().locator('.sch.pick').count(), 1);
  확인('고르면 개수가 센다', (await p.locator('#shCnt').textContent()).indexOf('1 / ') === 0, true);

  /* ---------- 5. 타임어택은 그대로 한 문제씩 + Enter 중복 막기 ---------- */
  console.log('\n— 타임어택 (한 문제씩) —');
  await p.click('#shBack');
  await p.waitForTimeout(600);
  await 방법(p, 'time');
  await p.waitForTimeout(700);
  확인('타임어택은 옛 화면', await p.evaluate(() => document.getElementById('s-quiz').classList.contains('on')), true);

  const 처음idx = await p.evaluate(() => S.idx);
  await p.locator('#qInput').press('Enter');       // 빈 칸으로 Enter
  await p.waitForTimeout(400);
  확인('빈 칸으로 Enter 해도 안 넘어간다', await p.evaluate(() => S.idx), 처음idx);
  확인('오답으로도 안 들어간다', await p.evaluate(() => S.오답.length), 0);

  /* 정답을 쓰고 Enter 를 여러 번 — 다음 문제가 저절로 틀리면 안 된다 */
  await p.evaluate(() => { $('qInput').value = S.문제[S.idx].en; });
  await p.locator('#qInput').press('Enter');
  await p.locator('#qInput').press('Enter');
  await p.locator('#qInput').press('Enter');
  await p.waitForTimeout(900);
  console.log('  정답수:', await p.evaluate(() => S.정답수), '/ 오답:', await p.evaluate(() => S.오답.length));
  확인('정답 1개만 세고', await p.evaluate(() => S.정답수), 1);
  확인('Enter 연타로 오답이 생기지 않는다', await p.evaluate(() => S.오답.length), 0);
  확인('한 문제만 넘어갔다', await p.evaluate(() => S.idx), 처음idx + 1);

  /* ---------- 6. 선생님 화면 ---------- */
  console.log('\n— 선생님 화면 —');
  await p.click('#s-quiz [data-back="home"]');
  await p.waitForTimeout(500);
  await p.click('[data-hbt="hw"]');
  await p.waitForTimeout(300);
  await p.click('#btnLogout');
  await p.waitForTimeout(400);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw', '1234');
  await p.click('#btnTLogin');
  await p.waitForTimeout(1200);

  await 탭가기(p, 'hw');
  await p.waitForTimeout(600);
  const 라디오 = await p.locator('input[name=hwKind]').evaluateAll(
    els => els.map(e => e.value).join(' / '));
  console.log('  숙제 종류:', 라디오);
  /* 시험은 숙제가 아니다 — 숙제 탭 종류는 셋, 시험은 「시험」 탭에서 낸다 */
  확인('종류가 셋 (시험은 시험 탭에서)', 라디오, '당일 / 기한 / 보충');

  확인('숙제 목록에는 시험 알약이 없다', await p.locator('.hwrow .pill.siheom').count(), 0);
  /* 시험은 「시험」 탭에서 — 종류가 시험으로 못 박혀 있어 날짜칸이 바로 보인다 */
  await 탭가기(p, 'exam');
  await p.waitForTimeout(600);
  확인('시험 탭은 날짜칸이 바로 뜬다', await p.locator('#hwDueWrap').isVisible(), true);
  확인('라벨이 시험 날짜', (await p.locator('#hwDueWrap label').textContent()).trim(), '시험 날짜');
  확인('오늘 날짜가 미리 들어간다', (await p.locator('#hwDue').inputValue()).length, 10);

  확인('목록에 시험 알약', await p.locator('.hwrow .pill.siheom').count() > 0, true);

  await 탭가기(p, 'students');
  await p.waitForTimeout(600);
  const 머리 = await p.locator('.tb thead th').allTextContents();
  console.log('  학생별 표:', 머리.map(x => x.trim()).filter(Boolean).join(' / '));
  확인('숙제 평균과 시험 평균이 따로', 머리.map(x => x.trim()).join('|').indexOf('숙제 평균|시험|시험 평균') > -1, true);

  await 탭가기(p, 'award');
  await p.waitForTimeout(900);
  const 상머리 = await p.locator('.tb thead th').allTextContents();
  console.log('  시상표:', 상머리.map(x => x.trim()).filter(Boolean).join(' / '));
  확인('시상표에도 시험 평균', 상머리.some(x => x.trim() === '시험 평균'), true);
  await p.screenshot({ path: 'h2_teacher_exam.png', fullPage: true });

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
