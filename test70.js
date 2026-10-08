/* 오늘 추천 — 진단 · 이유 · 기록이 없을 때 · 「고치기」 / 누적 단계는 내가 틀린 단어부터 */
const { chromium } = require('playwright');
const path = require('path');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 띄우기설정 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
async function 탭가기(p, 이름) {
  await p.evaluate(t => {
    var b = document.querySelector('[data-tab="' + t + '"]');
    var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]');
    if (g) g.click();
  }, 이름);
  await p.waitForTimeout(250);
  await p.click('[data-tab="' + 이름 + '"]');
  await p.waitForTimeout(1000);
}
/* 추천 칸을 읽는다 — 진단 줄, 단계 이름, 단계마다 붙은 이유 */
const 추천 = p => p.evaluate(() => {
  const 칸 = document.querySelector('#lsRecBox .sjrec');
  if (!칸) return null;
  return {
    진단: [...칸.querySelectorAll('.sjdiag li')].map(e => e.textContent.trim()),
    단계: [...칸.querySelectorAll('.sjrecl li')].map(e => e.querySelector('b').textContent.trim()),
    이유: [...칸.querySelectorAll('.sjrecl li')].map(e => { const i = e.querySelector('i'); return i ? i.textContent.trim() : ''; })
  };
});
/* 미리보기 기록을 채운다 — 진짜로는 「기록」 시트에 쌓이는 것 */
const 기록넣기 = (p, 줄들) => p.evaluate(줄들 => {
  DEMO_기록.length = 0;
  줄들.forEach(r => DEMO_기록.push(Object.assign({ 단어장: '예시 단어장', 틀린: '', 날: DEMO_지난(2) }, r)));
}, 줄들);

(async () => {
  const b = await chromium.launch(띄우기설정);
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw', '1234'); await p.click('#btnTLogin');
  await p.waitForTimeout(1300);
  await 탭가기(p, 'hw');
  await p.selectOption('#lsBook', '예시 단어장'); await p.waitForTimeout(200);

  console.log('— 기록이 없을 때 —');
  await p.click('#lsRec'); await p.waitForTimeout(600);
  let r = await 추천(p);
  console.log('  ' + JSON.stringify(r));
  확인('빈 화면이 아니다', !!r && r.단계.length > 0, true);
  확인('기록이 적다고 말해 준다', r.진단.some(t => /아직 기록이 적어 진도만 보고 짰습니다/.test(t)), true);
  /* 미리보기 숙제는 1~5 · 6~10 · 11~20 이 나갔다 — 가장 멀리 간 20번의 다음 */
  확인('진도 단계 — 나간 데까지의 다음 레슨', r.단계[0], '레슨 3 스펠링');
  확인('이유가 붙는다', r.이유[0], '← 진도');

  console.log('\n— 스펠링이 4지선다·첫 글자보다 12점 넘게 낮으면 —');
  await 기록넣기(p, [
    { 이름: '홍길동', 유형: '4지선다', 점수: 94 }, { 이름: '김영희', 유형: '4지선다', 점수: 92 },
    { 이름: '홍길동', 유형: '첫 글자', 점수: 90 },
    { 이름: '홍길동', 유형: '스펠링', 점수: 70 }, { 이름: '김영희', 유형: '스펠링', 점수: 72 },
    { 이름: '김영희', 유형: '스펠링', 점수: 74 }
  ]);
  await p.click('#lsRecAgain'); await p.waitForTimeout(600);
  r = await 추천(p);
  console.log('  ' + JSON.stringify(r));
  확인('철자가 약하다고 진단한다', r.진단.some(t => /92점 \/ 철자 쓰기 72점 — 철자가 약합니다/.test(t)), true);
  확인('새 진도에 듣고 쓰기가 들어간다', r.단계.indexOf('레슨 3 듣고 쓰기') > -1, true);
  확인('새 진도에 첫 글자가 들어간다', r.단계.indexOf('레슨 3 첫 글자') > -1, true);
  확인('새 진도는 스펠링 대신이다', r.단계.indexOf('레슨 3 스펠링'), -1);
  확인('그 단계 이유', r.이유[r.단계.indexOf('레슨 3 듣고 쓰기')], '← 철자가 약합니다');
  확인('같은 단계가 두 번 들어가지 않는다', r.단계.length, new Set(r.단계).size);
  확인('단계마다 이유가 붙는다', r.이유.every(x => x.length > 2), true);

  console.log('\n— 차이가 12점보다 작으면 —');
  await 기록넣기(p, [
    { 이름: '홍길동', 유형: '4지선다', 점수: 88 }, { 이름: '김영희', 유형: '4지선다', 점수: 84 },
    { 이름: '홍길동', 유형: '스펠링', 점수: 80 }, { 이름: '김영희', 유형: '스펠링', 점수: 78 },
    { 이름: '김영희', 유형: '스펠링', 점수: 82 }
  ]);
  await p.click('#lsRecAgain'); await p.waitForTimeout(600);
  r = await 추천(p);
  확인('철자 진단이 없다', r.진단.some(t => /철자가 약합니다/.test(t)), false);
  확인('진도는 스펠링으로', r.단계.indexOf('레슨 3 스펠링') > -1, true);

  console.log('\n— 지난 수업에 못 낸 사람이 있으면 그 범위가 맨 앞 —');
  await p.evaluate(() => {
    DEMO_HW.push({ 행: 99, 단어장: '예시 단어장', 시작: 21, 끝: 25, 유형: '스펠링', 마감일: DEMO_지난(1),
      등록일: DEMO_지난(1), 학생: '', 색: '', 종류: '당일', 지남: true, 대상수: 2,
      한사람: ['김영희'], 안한사람: ['홍길동'] });
  });
  await p.click('#lsRecAgain'); await p.waitForTimeout(600);
  r = await 추천(p);
  console.log('  ' + JSON.stringify(r));
  확인('못 낸 범위가 1번 단계', r.단계[0], '레슨 3 스펠링');
  확인('이유 — 몇 명이 못 냈는지', r.이유[0], '← 1명이 못 냈습니다');
  확인('진단에도 적는다', r.진단[0], '1명이 레슨 3 스펠링을 못 냈습니다');
  확인('단계마다 이유가 붙는다', r.이유.every(x => x.length > 2), true);
  const 합 = Number((await p.locator('#lsRecBox .sjrech span').textContent()).replace(/[^\d]/g, ''));
  확인('시간 예산 안이다', 합 <= 35, true);

  console.log('\n— 「고치기」 를 누르면 짜개에 그대로 —');
  const 추천단계 = await p.evaluate(() => T.수업.추천.단계.map(s => [s.종류, s.유형, String(s.시작 || ''), String(s.끝 || '')]));
  await p.click('#lsRecEdit'); await p.waitForTimeout(400);
  const 채운 = await p.locator('#lsSteps .sjstep').evaluateAll(rs => rs.map(r => {
    const v = f => { const e = r.querySelector('[data-f="' + f + '"]'); return e ? e.value : ''; };
    return [r.querySelector('.sjkind.cum') ? '누적' : '보통', v('유형'), v('시작'), v('끝')];
  }));
  확인('단계 수가 같다', 채운.length, 추천단계.length);
  확인('종류·유형이 같다', 채운.map(x => x.slice(0, 2)), 추천단계.map(x => x.slice(0, 2)));
  확인('보통 단계는 범위도 같다', 채운.filter(x => x[0] === '보통'), 추천단계.filter(x => x[0] === '보통'));
  확인('이유도 따라온다', await p.locator('#lsSteps .sjwhy').count() > 0, true);
  확인('추천 칸은 닫힌다', await p.locator('#lsRecBox .sjrec').count(), 0);

  /* ======================= 아이 화면 — 누적 단계 ======================= */
  console.log('\n— 누적 단계는 내가 틀렸던 단어부터 —');
  const q = await b.newPage({ viewport: { width: 420, height: 900 } });
  q.on('pageerror', e => errs.push('ERR(아이) ' + e.message));
  q.on('dialog', d => d.accept());
  await q.goto(앱주소);
  await q.waitForTimeout(400);
  await q.fill('#inPw', '1234'); await q.fill('#inName', '홍길동');
  await q.click('#btnLogin');
  await q.waitForTimeout(1800);
  if (await q.locator('#noti').isVisible()) await q.click('#notiOk');
  /* 틀린 단어는 화면이 쓰는 단어장에서 읽어 온다 — 박아 두지 않는다 */
  const 틀린 = await q.evaluate(() => {
    const 낱말 = DEMO.단어가져오기('예시 단어장');
    const 둘 = [낱말[3].en, 낱말[17].en];
    DEMO_기록.push({ 이름: '홍길동', 단어장: '예시 단어장', 유형: '스펠링', 점수: 60, 틀린: 둘.join(', '), 날: DEMO_지난(2) });
    DEMO_기록.push({ 이름: '김영희', 단어장: '예시 단어장', 유형: '스펠링', 점수: 60, 틀린: 낱말[5].en, 날: DEMO_지난(2) });
    window.__부른것 = [];
    const 원래 = window.api;
    window.api = function (이름) { window.__부른것.push(이름); return 원래.apply(null, arguments); };
    S.숙제.push({ 단어장: '예시 단어장', 시작: 1, 끝: 25, 유형: '스펠링 (누적 5)', 마감일: 오늘값(), 개별: false,
      색: '', 종류: '당일', 남은일수: 0, 완료: false, 점수: 0, 낸때: 999 });
    drawHw();
    return 둘;
  });
  const 몇째 = await q.evaluate(() => S.숙제.length - 1);
  await q.click('#hwBox [data-hw="' + 몇째 + '"]');
  await q.waitForTimeout(1800);
  확인('시험지가 열린다', await q.evaluate(() => 지금화면_()), 'sheet');
  확인('내 오답을 물어본다', await q.evaluate(() => window.__부른것.indexOf('내오답') > -1), true);
  const 낸것 = await q.evaluate(() => S.문제.map(w => w.en));
  console.log('  낸 단어: ' + 낸것.join(', '));
  확인('「누적 5」 라 다섯 개만', 낸것.length, 5);
  확인('내가 틀렸던 단어가 다 들어 있다', 틀린.every(w => 낸것.indexOf(w) > -1), true);
  확인('기록 범위는 숙제 범위 그대로 (제출로 쳐야 한다)', await q.evaluate(() => S.범위), '1~25');
  확인('방법은 스펠링', await q.evaluate(() => S.모드), 'spell');

  console.log('\n— 보통 숙제는 그대로 —');
  확인('누적 아닌 숙제엔 오답을 안 묻는다', await q.evaluate(() => 누적인가_('스펠링')), false);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
