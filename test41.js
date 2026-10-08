/* 화면 정리 — 숙제 한 줄 · 교재별 현황 · 학부모 안내문 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');

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

const { execSync } = require('child_process');
function 쪽수(파일){
  return require('./도구').쪽수세기(파일);
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

  /* ========== 1) 학생 홈 — 숙제가 한 줄씩 ========== */
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234');
  await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1200);
  await 알림닫기(p);

  console.log('— 학생 홈 —');
  /* 숙제 줄은 체크리스트(.hwcard) 한 장으로 바뀌었다 — 맨 위 '지금 할 것'은 .ckrow.now */
  const 줄수 = await p.locator('#hwBox .ckrow').count();
  console.log('  숙제 줄:', 줄수);
  확인('숙제가 줄로 나온다', 줄수 > 0, true);
  확인('예전 큰 카드는 없다', await p.locator('#hwBox .hwsec').count(), 0);

  const 높이 = await p.locator('#hwBox .ckrow').first().evaluate(e => e.getBoundingClientRect().height);
  console.log('  한 줄 높이:', Math.round(높이), 'px');
  확인('한 줄이 90px 안쪽', 높이 < 90, true);

  const 전체높이 = await p.evaluate(() => document.body.scrollHeight);
  console.log('  홈 전체 높이:', 전체높이, 'px');
  확인('홈이 2000px 안쪽으로 줄었다', 전체높이 < 2000, true);

  /* 숙제 네 줄이 한 화면(900px) 안에 다 보이는지 */
  const 마지막 = await p.locator('#hwBox .ckrow').last().evaluate(e => e.getBoundingClientRect().bottom);
  console.log('  마지막 숙제 줄 끝:', Math.round(마지막), 'px');
  확인('숙제가 한 화면에 다 들어온다', 마지막 < 1400, true);
  확인('아래 탭바가 있다', await p.locator('#tabbar').isVisible(), true);

  const 지금 = (await p.locator('#hwBox .ckrow.now').innerText()).replace(/\s+/g, ' ').trim();
  console.log('  지금 할 것:', 지금);
  /* 개편 — 해야 할 숙제를 다 줄로 깔아 준다 (예전엔 맨 위 하나만 펼쳤다) */
  확인('해야 할 숙제가 모두 줄로 보인다', await p.locator('#hwBox .ckrow:not(.done)').count() > 1, true);
  확인('무엇부터 할지 말해 준다', 지금.indexOf('시작') > -1, true);
  확인('단어장과 레슨이 보인다', /예시 단어장 레슨 1/.test(지금), true);
  확인('언제까지인지 보인다', 지금.indexOf('오늘까지') > -1, true);
  확인('무슨 시험인지 보인다', 지금.indexOf('스펠링') > -1, true);

  const 모든줄 = (await p.locator('#hwBox').innerText()).replace(/\s+/g, ' ').trim();
  확인('나머지도 한 줄씩', /예시 단어장 레슨 3/.test(모든줄), true);
  await p.screenshot({ path: 'u1_home.png' });

  /* 맨 위를 누르면 그 숙제가 시작되는지 */
  await p.locator('#hwBox .ckrow.now').click();
  await p.waitForTimeout(1200);
  확인('누르면 시험이 열린다',
    await p.evaluate(() => document.getElementById('s-sheet').classList.contains('on')), true);
  확인('그 숙제 범위로 열린다', await p.locator('.qrow').count(), 10);
  await p.click('#shBack');
  await p.waitForTimeout(500);

  /* ========== 2) 선생님 — 교재별 현황 ========== */
  console.log('\n— 선생님 오늘 한눈에 —');
  const t = await b.newPage({ viewport: { width: 1500, height: 950 } });
  t.on('pageerror', e => errs.push('ERR(선생님) ' + e.message));
  t.on('dialog', d => d.accept());
  await t.addInitScript(() => { window.__인쇄 = 0; window.print = function () { window.__인쇄++; }; });
  await t.goto(앱주소);
  await t.waitForTimeout(400);
  await t.click('#btnTeacherGo');
  await t.fill('#tPw', '1234');
  await t.click('#btnTLogin');
  await t.waitForTimeout(1400);
  /* 들어가면 이제 '학생 한 명씩' 칸이 먼저 열린다 — '오늘 한눈에' 로 옮긴다 */
  await 탭가기(t, 'sum');
  await t.waitForTimeout(1200);

  const 패널 = (await t.locator('.panel-h b').allTextContents()).map(x => x.trim());
  console.log('  칸:', 패널.join(' | '));
  확인('교재별 현황 칸이 생겼다', 패널.indexOf('교재별 현황') > -1, true);
  const 반표 = t.locator('.cols > div').first().locator('.tb').last();
  const 머리 = (await 반표.locator('thead th').allTextContents()).map(x => x.trim());
  console.log('  머리:', 머리.join(' / '));
  확인('교재·숙제·안 낸 학생·평균', 머리, ['교재', '진행 숙제', '안 낸 학생', '평균']);
  const 반줄 = await 반표.locator('tbody tr').count();
  console.log('  반 수:', 반줄);
  확인('반마다 한 줄', 반줄, 2);
  const 첫반 = (await 반표.locator('tbody tr').first().innerText()).replace(/\s+/g, ' ').trim();
  console.log('  첫 반:', 첫반);
  확인('교재 이름과 인원', /배우는 학생 \d+명/.test(첫반), true);
  확인('숫자 뒤에 단위', 첫반.indexOf('건') > -1, true);

  /* 왼쪽 칸이 더 이상 텅 비지 않는지 */
  const 왼쪽 = await t.locator('.cols > div').first().evaluate(e => e.getBoundingClientRect().height);
  const 오른쪽 = await t.locator('.cols > div').nth(1).evaluate(e => e.getBoundingClientRect().height);
  console.log('  왼쪽', Math.round(왼쪽), 'px / 오른쪽', Math.round(오른쪽), 'px');
  확인('왼쪽이 오른쪽의 절반은 넘는다', 왼쪽 > 오른쪽 * 0.5, true);
  await t.screenshot({ path: 'u2_sum.png' });

  /* ========== 3) 표 가독성 ========== */
  console.log('\n— 표 —');
  await 탭가기(t, 'today');
  await t.waitForTimeout(1000);
  const 얼룩 = await t.locator('.tb tbody tr').nth(1).locator('td').first()
    .evaluate(e => getComputedStyle(e).backgroundColor);
  const 민줄 = await t.locator('.tb tbody tr').first().locator('td').first()
    .evaluate(e => getComputedStyle(e).backgroundColor);
  console.log('  1번째 줄:', 민줄, '/ 2번째 줄:', 얼룩);
  확인('한 줄 걸러 배경이 다르다', 얼룩 !== 민줄, true);
  확인('머리글이 붙어 있다',
    await t.locator('.tb th').first().evaluate(e => getComputedStyle(e).position), 'sticky');

  /* ========== 4) 학부모 안내문 ========== */
  console.log('\n— 학부모 안내문 —');
  await 탭가기(t, 'award');
  await t.waitForTimeout(1700);
  확인('학생마다 인쇄 단추', await t.locator('[data-note]').count() > 0, true);
  확인('모두 인쇄 단추', await t.locator('#btnAwNotes').isVisible(), true);
  const 전 = await t.evaluate(() => window.__인쇄);
  await t.locator('[data-note]').first().click();
  await t.waitForTimeout(600);
  확인('안내문이 인쇄된다', await t.evaluate(() => window.__인쇄), 전 + 1);

  const 글 = (await t.evaluate(() => document.getElementById('printArea').innerText))
    .replace(/\s+/g, ' ').trim();
  console.log('  ' + 글.slice(0, 120));
  확인('제목에 달이 들어간다', /\d+년 \d+월 영어 단어 학습 안내/.test(글), true);
  확인('학생 이름이 있다', /\S+ 학생/.test(글), true);
  확인('숙제 제출률 칸', 글.indexOf('숙제 제출률') > -1, true);
  확인('단어 시험 평균 칸', 글.indexOf('단어 시험 평균') > -1, true);
  확인('학원 시험 평균 칸', 글.indexOf('학원 시험 평균') > -1, true);
  확인('선생님이 손으로 쓸 칸', 글.indexOf('선생님 한마디') > -1, true);
  확인('학원 이름으로 맺는다', 글.indexOf('홍제인왕해법영어') > -1, true);

  /* 한 학생은 A4 한 장 */
  await t.pdf({ path: require('./도구').임시('t41.pdf'), format: 'A4', printBackground: true,
    margin: { top: '14mm', bottom: '12mm', left: '15mm', right: '15mm' } });
  const n = 쪽수(require('./도구').임시('t41.pdf'));
  console.log('  안내문 쪽수:', n);
  확인('한 학생은 한 장', n, 1);

  await t.click('#btnAwNotes');
  await t.waitForTimeout(700);
  const 장수 = await t.locator('#printArea .psheet').count();
  console.log('  모두 인쇄:', 장수, '장');
  확인('학생 수만큼 나온다', 장수 > 1, true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
