/* 개편 — 학생 탭바 · 지금 할 것 · 연습 분리 / 선생님 오늘 할 일 · 학생 기준 · 한 줄 폼 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
const { 탭, 방법, 칸열기, 칸닫기, 책고르기, 범위정하기, 순위가기 } = require('./도구');
/* 칩 글자로 단어장 이름 찾기 */
async function 책이름(p, 조각){
  await 칸열기(p);
  const 것 = await p.locator('#bookChips [data-bk]').evaluateAll(es => es.map(e => e.dataset.bk));
  await 칸닫기(p);
  return 것.filter(x => x.indexOf(조각) > -1)[0] || 것[0];
}

/* 아래 탭바에서 '게임' 칸을 없앴다 — 연습 칸에서 '짝 맞추기 · 글자 퍼즐' 을 골라 시작한다 */
async function 게임가기(p){
  await p.click('[data-hbt="game"]');   /* 게임은 아래 탭으로 갔다 */
  await p.waitForTimeout(900);
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

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const errs = [];

  /* ================= 학생 ================= */
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234');
  await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1400);
  await 알림닫기(p);

  console.log('— 열면 바로 숙제 —');
  확인('첫 화면이 숙제 화면',
    await p.evaluate(() => document.getElementById('s-home').classList.contains('on')), true);
  확인('예전 허브 화면은 없앴다', await p.locator('#s-hub').count(), 0);
  확인('아래 탭바가 보인다', await p.locator('#tabbar').isVisible(), true);
  확인('숙제 탭이 켜져 있다',
    await p.locator('#tabbar button').first().evaluate(e => e.classList.contains('on')), true);
  확인('안 낸 개수가 탭에 붙는다 (시험은 빼고)',
    (await p.locator('#tbHw').textContent()).trim(),
    String(await p.evaluate(() => 숙제만_().filter(h => !h.완료).length)));
  확인('시험 개수는 시험 칸에',
    (await p.locator('#tbEx').textContent()).trim(),
    String(await p.evaluate(() => S.숙제.filter(h => h.종류 === '시험').length)));

  /* 남은 개수·낸 개수·진행 막대는 숙제 체크리스트 머리(.ckhead)로 옮겼고,
     맨 윗줄 .tdcard 에는 불꽃만 남았다 */
  const 오늘줄 = (await p.locator('#todayBox .tdcard').innerText()).replace(/\s+/g, ' ').trim();
  const 숙제머리 = (await p.locator('#hwBox .ckhead').innerText()).replace(/\s+/g, ' ').trim();
  console.log('  오늘 줄:', 오늘줄, '/ 숙제 머리:', 숙제머리);
  확인('불꽃은 맨 윗줄에', /일 연속/.test(오늘줄), true);
  확인('남은 숙제가 머리에', /남은 숙제/.test(숙제머리), true);
  확인('전체 개수도 보인다', /\/ *\d+/.test(숙제머리), true);
  확인('진행 막대가 찬다',
    await p.locator('#hwBox .ckbar i').evaluate(e => e.getBoundingClientRect().width > 0), true);

  확인('해야 할 숙제가 다 줄로 보인다', await p.locator('#hwBox .ckrow:not(.done)').count() > 1, true);
  확인('단어장·모드 고르기는 숙제 화면에 없다',
    await p.locator('#s-home #modeBox').count(), 0);
  확인('명예의 전당도 숙제 화면에 없다',
    await p.locator('#s-home #trophyBox').count(), 0);

  /* 숙제가 한 화면에 다 들어오는지 */
  const 끝 = await p.locator('#hwBox').evaluate(e => e.getBoundingClientRect().bottom);
  console.log('  숙제 칸 끝:', Math.round(끝), 'px');
  확인('숙제 칸이 화면 안에서 시작한다', 끝 > 0, true);
  await p.screenshot({ path: 'c1_home.png' });

  console.log('\n— 연습 칸 —');
  await p.click('[data-hbt="mem"]');
  await p.waitForTimeout(800);
  확인('연습 화면이 열린다',
    await p.evaluate(() => document.getElementById('s-study').classList.contains('on')), true);
  /* 단어장 칩은 「단어장 고르기」 알약을 눌러 올라오는 칸 안에 있다 */
  await 칸열기(p);
  확인('단어장 칩이 있다', await p.locator('[data-bk]:visible').count(), 2);
  확인('칩을 쓰면 드롭다운은 감춘다', await p.locator('#bookSelWrap').isVisible(), false);
  await 칸닫기(p);
  /* 한 줄씩 고르던 목록을 두 칸짜리 타일(.mgrid)로 바꿨다 —
     고르는 타일 여섯 개 + 게임으로 들어가는 칸 하나 */
  /* 게임은 아래 탭으로 갔다 — 연습 타일은 고르는 것 여섯뿐이다 */
  /* 개편 — 연습은 외우기·시험 두 칸으로 갈라졌다. 외우기에는 큰 타일 하나 + 작은 타일들 */
  확인('외우기에 타일이 깔린다',
    await p.locator('#s-study .mtile:visible').count() > 0, true);
  /* 큰 타일 = 한 줄을 다 차지하는 타일 (#modeGrid 에서 grid-column 1 / -1) */
  확인('큰 타일은 플래시카드',
    await p.evaluate(() => {
      const 넓이 = document.getElementById('modeGrid').clientWidth;
      const 큰 = [...document.querySelectorAll('#modeGrid .mtile')]
        .filter(e => e.offsetParent && e.offsetWidth > 넓이 * 0.8);
      return 큰.map(e => e.querySelector('b').textContent.trim());
    }), ['플래시카드']);
  확인('두 칸씩 깔린다',
    await p.evaluate(() => getComputedStyle(document.getElementById('modeGrid'))
      .gridTemplateColumns.split(' ').length), 2);
  확인('그 중 하나가 단어장 보기',
    await p.locator('#modeGrid .mtile[data-mode="book"]:visible').count(), 1);
  확인('단어장 알약이 보인다', await p.locator('#hbBook').isVisible(), true);
  await 책고르기(p, '불규칙 동사 50');
  await p.waitForTimeout(900);
  확인('3단변화 단어장이면 그 타일이 생긴다', await p.locator('#btnVerbTest').isVisible(), true);
  확인('스펠링은 시험 칸에만 있다',
    await p.locator('#s-study .mtile[data-mode="spell"]:visible').count(), 0);
  await p.screenshot({ path: 'c2_study.png' });

  console.log('\n— 왔다 갔다 —');
  await 게임가기(p);
  await p.waitForTimeout(900);
  확인('게임 화면', await p.evaluate(() => document.getElementById('s-games').classList.contains('on')), true);
  확인('게임 칸에서도 탭바가 보인다', await p.locator('#tabbar').isVisible(), true);
  await 순위가기(p);   /* 순위 탭은 없어졌다 — 게임 화면의 「순위」 타일로 들어간다 */
  await p.waitForTimeout(900);
  확인('순위 화면', await p.evaluate(() => document.getElementById('s-streak').classList.contains('on')), true);
  확인('명예의 전당은 순위 화면에', (await p.locator('#trophyBox').innerText()).indexOf('명예의 전당') > -1, true);
  await p.click('[data-hbt="hw"]');
  await p.waitForTimeout(600);
  확인('숙제로 돌아온다', await p.evaluate(() => document.getElementById('s-home').classList.contains('on')), true);

  /* 시험 화면에서는 탭바가 사라져야 한다 */
  await p.locator('#hwBox .ckrow.now').click();
  await p.waitForTimeout(1300);
  확인('시험 중에는 탭바를 감춘다', await p.locator('#tabbar').isVisible(), false);
  await p.click('#shBack');
  await p.waitForTimeout(600);
  확인('그만두면 숙제 화면으로', await p.evaluate(() => document.getElementById('s-home').classList.contains('on')), true);

  /* 연습으로 들어간 시험은 연습으로 돌아온다 */
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(600);
  await 책고르기(p, '예시 단어장');  await p.waitForTimeout(900);
  await 방법(p, 'spell'); await p.waitForTimeout(900);
  await p.click('#shBack'); await p.waitForTimeout(600);
  확인('연습으로 들어갔으면 연습으로 돌아온다',
    await p.evaluate(() => document.getElementById('s-study').classList.contains('on')), true);

  /* ================= 선생님 ================= */
  console.log('\n— 선생님 오늘 한눈에 —');
  const t = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  t.on('pageerror', e => errs.push('ERR(선생님) ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소);
  await t.waitForTimeout(400);
  await t.click('#btnTeacherGo');
  await t.fill('#tPw', '1234');
  await t.click('#btnTLogin');
  await t.waitForTimeout(1500);
  /* 들어가면 이제 '학생 한 명씩' 칸이 먼저 열린다 — '오늘 한눈에' 로 옮긴다 */
  await 탭가기(t, 'sum');
  await t.waitForTimeout(1300);

  const 할일 = (await t.locator('.tacts button').allTextContents()).map(x => x.trim());
  console.log('  오늘 할 일:', 할일.join(' / '));
  확인('맨 위에 할 일 세 개', 할일.length, 3);
  확인('숙제 내주기', 할일[0].indexOf('숙제 내주기') > -1, true);
  확인('안 낸 학생 몇 명인지', /안 낸 학생 \d+명/.test(할일[1]), true);
  확인('시험지 뽑기', 할일[2].indexOf('시험지 뽑기') > -1, true);

  const 카드 = await t.locator('#tBody .mcard').count();
  console.log('  안 낸 학생 카드:', 카드, '장');
  확인('학생 기준으로 묶인다', 카드 > 0, true);
  const 첫카드 = (await t.locator('#tBody .mcard').first().innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 첫카드);
  확인('이름이 먼저', 첫카드.indexOf('홍길동') > -1, true);
  확인('몇 건 밀렸는지', /\d+건 밀림/.test(첫카드), true);
  확인('무슨 숙제인지 칩으로', await t.locator('#tBody .mcard').first().locator('.mchip').count() > 0, true);
  확인('점수 모자란 것도 표시', 첫카드.indexOf('점수 모자람') > -1, true);
  확인('그 자리에서 보충을 낸다',
    await t.locator('#tBody .mcard').first().locator('[data-bochung]').count(), 1);

  const kpi = (await t.locator('.kpi').nth(1).innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + kpi);
  확인('KPI도 사람 수로 센다', kpi.indexOf(String(카드) + '명') > -1, true);
  await t.screenshot({ path: 'c3_sum.png' });

  console.log('\n— 왼쪽 메뉴 —');
  /* 메뉴는 묶음(학생·오늘·숙제·자료) 아래로 들어갔다 — 칸 목록은 .tsubs */
  const 묶음 = (await t.locator('.tnav .tgrp').allTextContents()).map(x => x.trim());
  const 메뉴 = (await t.locator('.tnav .tsubs button').allTextContents()).map(x => x.trim().split(' ')[0]);
  console.log('  ' + 묶음.join(' / ') + ' → ' + 메뉴.join(' / '));
  확인('자주 쓰는 것이 위', 메뉴.slice(0, 6),
    ['학생', '오늘', '시험', '공지', '숙제', '시험']);   // 「숙제 내주기」 바로 아래 「시험」 탭
  확인('관리 묶음이 따로 있다', await t.locator('.tnav .tgrps').isVisible(), true);

  console.log('\n— 숙제 내주기 —');
  await 탭가기(t, 'hw');
  await t.waitForTimeout(1200);
  /* 위에 「수업 내주기」 판이 붙으면서 .hwbar 가 셋이 됐다 — 숙제 폼은 단어장 고르개(#hwBook)가 든 줄 */
  확인('폼이 한 줄로 늘어선다', await t.locator('.hwbar:has(#hwBook)').isVisible(), true);
  const 폼높이 = await t.locator('.hwbar:has(#hwBook)').evaluate(e => e.getBoundingClientRect().height);
  console.log('  폼 높이:', Math.round(폼높이), 'px');
  확인('폼이 250px 안쪽', 폼높이 < 250, true);
  확인('종류를 칩으로 고른다 (당일·기한·보충 — 시험은 시험 탭)', await t.locator('.rchips input[name=hwKind]').count(), 3);

  const 같게 = await t.locator('[data-again]').count();
  console.log('  지난번과 같게:', 같게, '개');
  확인('지난번과 같게가 있다', 같게 > 0, true);
  await t.locator('[data-again="0"]').click();
  await t.waitForTimeout(700);
  const 채움 = [await t.locator('#hwBook').inputValue(),
                await t.locator('#hwFrom').inputValue(),
                await t.locator('#hwTo').inputValue(),
                await t.locator('#hwType').inputValue()];
  console.log('  채워진 값:', 채움.join(' / '));
  확인('단어장이 채워진다', 채움[0], '예시 단어장');
  확인('범위도 채워진다', [채움[1], 채움[2]], ['41', '50']);
  확인('유형도 채워진다', 채움[3], '첫 글자');

  /* 표가 한 폭으로, 줄이 카드처럼 떨어지지 않아야 한다 */
  const 줄모양 = await t.locator('.tb tbody tr.hwrow').first()
    .evaluate(e => getComputedStyle(e).display);
  확인('표 줄이 표 줄로 그려진다', 줄모양, 'table-row');
  await t.screenshot({ path: 'c4_hw.png' });

  console.log('\n— 보충으로 다시 내기 —');
  await 탭가기(t, 'sum');
  await t.waitForTimeout(1100);
  const 전건 = await t.evaluate(() => (T.data.숙제목록 || []).length);
  await t.locator('[data-bochung]').first().click();
  await t.waitForTimeout(1500);
  const 후건 = await t.evaluate(() => (T.data.숙제목록 || []).length);
  console.log('  숙제 건수:', 전건, '→', 후건);
  확인('안 낸 만큼 보충이 나간다', 후건 > 전건, true);
  const 새것 = await t.evaluate(() => (T.data.숙제목록 || [])
    .filter(h => h.종류 === '보충' && h.학생 === '홍길동').length);
  확인('그 학생 앞으로 보충이 생긴다', 새것 > 0, true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
