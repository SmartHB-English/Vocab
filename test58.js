/* 시험 탭 — 선생님이 낸 시험만 여기 모인다 · 외우기 → 저절로 시험 · 선생님 설정 */
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
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
const 글 = async (p, sel) => (await p.locator(sel).textContent()).trim();
const 시간당기기 = (p, 초) => p.evaluate(s => { 제한.끝날때 = Date.now() + s * 1000; }, 초);

const 엿듣기 = p => p.evaluate(() => {
  window.__보낸것 = [];
  const 원래 = window.api;
  window.api = function (이름) {
    if (이름 === '결과저장') window.__보낸것.push(arguments[1]);
    return 원래.apply(null, arguments);
  };
});

async function 학생으로(p) {
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }
}

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', d => d.accept());
  await 학생으로(p);
  await 엿듣기(p);

  console.log('— 숙제 칸에는 시험이 없다 —');
  const 나뉨 = await p.evaluate(() => ({
    전체: S.숙제.length,
    시험: S.숙제.filter(h => h.종류 === '시험').length,
    숙제: 숙제만_().length,
    안낸숙제: 숙제만_().filter(h => !h.완료).length,
    수업: 숙제만_().filter(h => h.수업).length
  }));
  console.log('  ' + JSON.stringify(나뉨));
  확인('시험 숙제가 있다', 나뉨.시험 > 0, true);
  확인('숙제 = 전체 − 시험', 나뉨.숙제, 나뉨.전체 - 나뉨.시험);
  /* 수업으로 묶인 숙제는 위 수업 카드(.lsrow, 잠긴 줄은 data-hw 가 없다)에, 나머지는 아래 목록(.ckrow)에 뜬다 */
  확인('숙제 목록에 시험이 안 보인다',
    await p.locator('#hwBox .lsrow').count() + await p.locator('#hwBox .ckrow').count(),
    나뉨.숙제);
  /* 머리의 「남은 숙제 4 / 5」 는 아래 목록 것만 센다 — 수업 카드는 제 카드에 「1 / 4」 를 따로 단다 */
  확인('숙제 머리의 전체 수도 시험을 뺀 수',
    (await 글(p, '#hwBox .ckn small')).replace('/', '').trim(), String(나뉨.숙제 - 나뉨.수업));
  확인('아래 칸 배지도 시험을 뺀 수', await 글(p, '#tbHw'), String(나뉨.안낸숙제));
  확인('시험 칸에 배지가 붙는다', await 글(p, '#tbEx'), String(나뉨.시험));

  console.log('\n— 시험 칸 —');
  await p.click('[data-hbt="test"]');
  await p.waitForTimeout(900);
  확인('시험 화면이 열린다', await p.locator('#hbExam').isVisible(), true);
  확인('시험이 카드로 나온다', await p.locator('.excard').count(), 나뉨.시험);
  const 첫줄 = await 글(p, '.excard .exhead b');
  console.log('  ' + 첫줄 + ' / ' + await 글(p, '.excard .exsub'));
  확인('단어장과 레슨이 보인다', /(레슨 \d+|전체)$/.test(첫줄), true);
  확인('한 번만 본다고 알려 준다', /한 번만/.test(await 글(p, '.excard .exsub')), true);
  확인('걸리는 시간이 보인다',
    (await p.locator('.excard .extime span').allTextContents()).map(x => x.trim()),
    ['외우기 5분', '시험 20분']);
  await p.screenshot({ path: 'ey1_list.png' });

  console.log('\n— 시험이 없으면 「등록된 시험이 없어요」 —');
  await p.evaluate(() => { window.__보관 = S.숙제.slice(); S.숙제 = 숙제만_(); 그리기_시험목록_(); 칠하기_탭('exam'); });
  await p.waitForTimeout(400);
  확인('빈 칸 안내가 뜬다', /등록된 시험이 없어요/.test(await 글(p, '#exBody')), true);
  확인('연습 칸으로 안내한다', /연습/.test(await 글(p, '#exBody')), true);
  확인('카드는 하나도 없다', await p.locator('.excard').count(), 0);
  확인('배지도 사라진다', await p.locator('#tbEx').isVisible(), false);
  await p.screenshot({ path: 'ey2_empty.png' });
  await p.evaluate(() => { S.숙제 = window.__보관; 그리기_시험목록_(); drawHw(); 칠하기_탭('exam'); });
  await p.waitForTimeout(400);
  확인('되돌리면 다시 나온다', await p.locator('.excard').count(), 나뉨.시험);

  console.log('\n— 시작하면 먼저 외운다 —');
  await p.click('.excard');
  await p.waitForTimeout(2400);
  확인('단어장 화면이 열린다', await p.locator('#s-book').isVisible(), true);
  확인('외우는 중이라고 알려 준다', await p.locator('#wbMem').isVisible(), true);
  확인('단계는 외우기', await p.evaluate(() => 시험판 && 시험판.단계), '외우기');
  확인('그 시험이 지금 숙제가 된다', await p.evaluate(() => S.현재숙제 && S.현재숙제.종류), '시험');
  const 외시계 = await 글(p, '#fixClock');
  console.log('  ' + 외시계);
  확인('5분에서 시작한다', /^⏱ (5:00|4:5\d)$/.test(외시계), true);
  확인('시험 범위만 보여 준다', await p.evaluate(() => {
    var h = S.현재숙제;
    return S.책.목록.length === (Number(h.끝) - Number(h.시작) + 1);
  }), true);
  확인('「시험 보기」 칩은 감춘다', await p.locator('#wbTest').isVisible(), false);
  await p.screenshot({ path: 'ey3_memorize.png' });

  console.log('\n— 「바로 시험 보기」 로 미리 넘어간다 —');
  await p.click('#wbGo');
  await p.waitForTimeout(1200);
  확인('단계는 시험', await p.evaluate(() => 시험판 && 시험판.단계), '시험');
  확인('시험지가 열린다', await p.locator('#s-sheet').isVisible(), true);
  확인('외우기 띠는 사라진다', await p.locator('#wbMem').isVisible(), false);
  const 시험시계 = await 글(p, '#fixClock');
  console.log('  ' + 시험시계);
  확인('20분에서 시작한다', /^⏱ (20:00|19:5\d)$/.test(시험시계), true);

  console.log('\n— 시간이 다 되면 그때까지 쓴 것만 채점된다 —');
  const 답1 = await p.evaluate(() => S.문제[0].en);
  await p.locator('.qrow[data-row="0"] .sin').fill(답1);
  await p.waitForTimeout(400);
  await 시간당기기(p, 1);
  await p.waitForTimeout(1900);
  확인('결과 화면', await p.locator('#s-result').isVisible(), true);
  확인('쓴 것 하나는 맞았다', await p.evaluate(() => S.정답수), 1);
  확인('제목에 (시험) 이 붙는다', /\(시험\)$/.test(await 글(p, '#rTitle')), true);

  console.log('\n— 기록이 선생님께 간다 —');
  const 보낸것 = await p.evaluate(() => window.__보낸것);
  console.log('  ' + JSON.stringify(보낸것.map(x => ({ 구분: x.구분, 숙제여부: x.숙제여부, 범위: x.범위 }))));
  확인('한 번 보냈다', 보낸것.length, 1);
  확인('구분은 시험', 보낸것[0].구분, '시험');
  확인('숙제여부 표시가 있다', 보낸것[0].숙제여부, true);

  console.log('\n— 보고 나면 「봤어요」 로 바뀐다 —');
  await p.click('#s-result [data-back]');
  await p.waitForTimeout(900);
  확인('시험 칸으로 돌아온다', await p.locator('#hbExam').isVisible(), true);
  확인('시험판이 치워진다', await p.evaluate(() => 시험판), null);
  확인('끝난 것으로 표시된다', await p.locator('.excard.done').count(), 1);
  확인('점수가 보인다', /점$/.test(await 글(p, '.excard .exdone')), true);
  확인('다시 누를 수 없다', await p.locator('.excard').first().isDisabled(), true);
  확인('배지가 사라진다', await p.locator('#tbEx').isVisible(), false);
  await p.screenshot({ path: 'ey4_done.png' });

  console.log('\n— 숙제와 연습에는 시간을 안 잰다 —');
  await p.click('[data-hbt="hw"]'); await p.waitForTimeout(600);
  await p.locator('#hwBox [data-hw]').first().click();
  await p.waitForTimeout(2400);
  확인('숙제에는 시계가 없다', await p.evaluate(() => 제한.시계), null);
  확인('시계 칸이 다 숨어 있다',
    await p.evaluate(() => [shClock, vClock, wbClock].every(e => e.classList.contains('hide'))), true);
  확인('시험판도 없다', await p.evaluate(() => 시험판), null);

  console.log('\n— 연습은 기록에 안 남는다 —');
  await p.click('#shBack').catch(() => {});
  await p.waitForTimeout(800);
  if (!(await p.locator('#s-home').isVisible())) { await p.click('[data-hbt="hw"]'); await p.waitForTimeout(600); }
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(1400);
  await 책고르기(p, await 책이름(p, '예시')); 
  await p.waitForTimeout(1400);
  await 방법(p, 'spell');
  await p.waitForTimeout(900);
  확인('연습 시험지가 열린다', await p.locator('#s-sheet').isVisible(), true);
  확인('연습에는 시계가 없다', await p.locator('#fixClock').isVisible(), false);
  await p.click('#shSubmit'); await p.waitForTimeout(900);
  확인('기록에 안 남는다고 알려 준다', /기록에 남지 않아요/.test(await 글(p, '#rSaved')), true);
  확인('보낸 것은 그대로 하나', (await p.evaluate(() => window.__보낸것)).length, 1);

  console.log('\n— 3단변화 시험도 같은 흐름 —');
  const p2 = await b.newPage({ viewport: { width: 420, height: 900 } });
  p2.on('pageerror', e => errs.push('PAGEERROR2: ' + e.message));
  p2.on('dialog', d => d.accept());
  await 학생으로(p2);
  /* 데모 시험 하나를 3단변화로 바꿔 둔다 */
  await p2.evaluate(() => {
    var h = S.숙제.filter(x => x.종류 === '시험')[0];
    h.단어장 = '불규칙 동사 50'; h.유형 = '3단변화'; h.시작 = 1; h.끝 = 5;
    그리기_시험목록_();
  });
  await p2.click('[data-hbt="test"]'); await p2.waitForTimeout(900);
  await p2.click('.excard');
  await p2.waitForTimeout(2400);
  확인('먼저 외운다', await p2.locator('#wbMem').isVisible(), true);
  await p2.click('#wbGo');
  await p2.waitForTimeout(1200);
  확인('세 칸 화면이 열린다', await p2.locator('#s-verb').isVisible(), true);
  확인('여기도 시계가 있다', await p2.locator('#fixClock').isVisible(), true);
  await 시간당기기(p2, 1);
  await p2.waitForTimeout(1900);
  확인('결과 화면으로 간다', await p2.locator('#s-result').isVisible(), true);

  console.log('\n— 그만두면 시계도 멈춘다 —');
  const p3 = await b.newPage({ viewport: { width: 420, height: 900 } });
  p3.on('pageerror', e => errs.push('PAGEERROR3: ' + e.message));
  p3.on('dialog', d => d.accept());
  await 학생으로(p3);
  await p3.click('[data-hbt="test"]'); await p3.waitForTimeout(900);
  await p3.click('.excard'); await p3.waitForTimeout(2400);
  확인('외우는 중', await p3.evaluate(() => !!제한.시계), true);
  await p3.click('#s-book [data-back]');
  await p3.waitForTimeout(800);
  확인('시계가 멈춘다', await p3.evaluate(() => 제한.시계), null);
  확인('시험판도 치워진다', await p3.evaluate(() => 시험판), null);

  console.log('\n— 선생님 화면에서 시간을 바꾼다 —');
  const t = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  t.on('pageerror', e => errs.push('PAGEERROR(선생님): ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소);
  await t.waitForTimeout(400);
  await t.click('#btnTeacherGo');
  await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  await 탭가기(t, 'setting');
  await t.waitForTimeout(1200);
  /* 시간은 설정이 아니라 숙제마다 — 설정 화면엔 합격점만 남는다 */
  확인('외우는 시간·시험 시간 칸이 없다', await t.locator('#setMem, #setEx').count(), 0);
  확인('숙제마다 정한다고 알려 준다', /시간은 숙제마다 정합니다/.test(await t.locator('#setTimeNote').textContent()), true);
  확인('합격점은 그대로', await t.locator('#setPass').inputValue(), '80');
  await t.screenshot({ path: 'ey5_setting.png' });
  await t.fill('#setPass', '70');
  await t.click('#btnSetSave');
  await t.waitForTimeout(1200);
  확인('저장했다고 알려 준다', /저장했습니다/.test(await t.locator('#toast').textContent()), true);
  확인('합격점만 보낸다', await t.evaluate(() => [시작정보.합격점, 시작정보.외우기분, 시작정보.시험분]), [70, null, null]);

  console.log('\n— 외우기 0분이면 바로 시험이 시작된다 —');
  const p4 = await b.newPage({ viewport: { width: 420, height: 900 } });
  p4.on('pageerror', e => errs.push('PAGEERROR4: ' + e.message));
  p4.on('dialog', d => d.accept());
  await p4.goto(앱주소);
  await p4.waitForTimeout(400);
  await p4.fill('#inPw', '1234'); await p4.fill('#inName', '홍길동');
  await p4.click('#btnLogin'); await p4.waitForTimeout(1800);
  if (await p4.locator('#noti').isVisible()) { await p4.click('#notiOk'); await p4.waitForTimeout(400); }
  /* 그 시험 숙제의 외우기분이 0 — 다른 시험·설정과 상관없이 */
  await p4.evaluate(() => { S.숙제.filter(h => h.종류 === '시험')[0].외우기분 = 0; 그리기_시험목록_(); });
  await p4.click('[data-hbt="test"]'); await p4.waitForTimeout(900);
  확인('외우기 칸이 안 보인다',
    (await p4.locator('.excard .extime span').allTextContents()).map(x => x.trim()), ['시험 20분']);
  await p4.click('.excard');
  await p4.waitForTimeout(2400);
  확인('바로 시험지가 열린다', await p4.locator('#s-sheet').isVisible(), true);
  확인('단어장 화면은 안 들른다', await p4.locator('#s-book').isVisible(), false);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
