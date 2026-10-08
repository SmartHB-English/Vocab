/* 수업 단계 — 연습 · 시험 흐름 : 연습은 한 번 내면, 시험은 통과해야 다음 · 떨어지면 다시 연습 → 다시 보기 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { chromium } = require('playwright');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 띄우기설정 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

/* ======================= Code.gs — 응시 세기 · 마지막 응시로 합격 · 재응시 더 주기 ======================= */
const 칸 = { SpreadsheetApp: { flush() {} }, Logger: { log() {} }, console,
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  Utilities: { formatDate(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); } } };
vm.createContext(칸);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), 칸);
const 안Date = vm.runInContext('Date', 칸);
const 때 = 분전 => new 안Date(Date.now() - 분전 * 60000);
const 낸때 = 때(100);
const 기록줄 = (분전, 이름, 범위, 점수, 틀린, 구분) => [때(분전), '', 이름, '예시 단어장', 범위, '스펠링', 10, 0, 점수, 0, 0, 0, 'O', 틀린 || '', 구분 || '숙제', ''];
let 기록 = [
  기록줄(200, '홍길동', '1~10', 100),                 // 숙제를 내기 전 기록 — 안 센다
  기록줄(50, '홍길동', '1~10', 60, 'apple, bee'),
  기록줄(40, '홍길동', '1~10', 90),
  기록줄(30, '홍길동', '1~10', 70, 'cat'),           // 마지막 응시
  기록줄(20, '홍길동', '1~10', 100, '', '오답 재시험'), // 오답 다시 풀기는 응시가 아니다
  기록줄(30, '김영희', '1~10', 85)
];
칸.rows_ = name => (name === '기록' ? 기록.map(x => x.slice()) : []);
칸.합격점_ = () => 80;
const 표 = 칸.응시표_();
const 응시 = 칸.응시들_(표, '홍길동', '예시 단어장', 1, 10, '', 낸때.getTime());
console.log('— 몇 번째 응시인지 —');
확인('숙제 낸 뒤 · 오답 다시 풀기 빼고 세 번', 응시.map(a => a.점수), [60, 90, 70]);
확인('마지막 응시에 틀린 것', 응시[2].틀린, ['cat']);
let 상 = 칸.단계상태_('시험', 80, 2, 응시, 0);
확인('합격은 마지막 응시로 — 90점이 있었어도 마지막 70점이면 아직', [상.완료, 상.마지막점수], [false, 70]);
확인('재응시 2번 → 세 번까지 — 다 썼다', [상.응시수, 상.남은응시], [3, 0]);
확인('평균이 아니다', 칸.단계상태_('시험', 80, 2, 응시.slice(0, 2), 0).완료, true);
확인('선생님이 하나 더 주면', 칸.단계상태_('시험', 80, 2, 응시, 1).남은응시, 1);
확인('연습은 한 번 내면 끝 (점수는 안 본다)', 칸.단계상태_('연습', '', '', 응시.slice(0, 1), 0).완료, true);
확인('연습은 안 냈으면 아직', 칸.단계상태_('연습', '', '', [], 0).완료, false);
확인('통과점수·재응시가 비면 80점 · 2번', [칸.단계상태_('시험', '', '', [], 0).통과점수, 칸.단계상태_('시험', '', '', [], 0).남은응시], [80, 3]);

console.log('\n— 재응시 더 주기 —');
const 숙제줄 = [[], ['', '예시 단어장', 1, 10, '스펠링', '2026-10-09', 낸때, '', '당일', '수업A', 1, '', '', '시험', 80, 2]];
const 시트 = { 숙제: null, 재응시: null };
function 가짜(줄) {
  return { 줄, getLastRow: () => 줄.length,
    getRange(r, c, nr, nc) { return {
      getValues: () => 줄.slice(r - 1, r - 1 + (nr || 1)).map(x => x.slice(c - 1, c - 1 + (nc || 1))),
      getValue: () => 줄[r - 1][c - 1],
      setValues(v) { v.forEach((x, i) => { 줄[r - 1 + i] = x.slice(); }); return this; },
      setFontWeight() { return this; }, setBackground() { return this; } }; },
    setFrozenRows() {} };
}
시트.숙제 = 가짜(숙제줄);
칸.sheet_ = () => 시트.숙제;
칸.ss_ = () => ({ getSheetByName: n => 시트[n] || null, insertSheet: n => (시트[n] = 가짜([])) });
칸.선생님확인_ = () => true;
칸.전체숙제 = () => [];
확인('처음엔 더 준 게 없다', 칸.재응시추가표_()['홍길동|' + 낸때.getTime()], undefined);
칸.재응시더주기('1234', 2, '홍길동', 1);
확인('「재응시」 시트에 적힌다', 시트.재응시.줄.length, 2);
확인('그 아이 · 그 숙제에 한 번 더', 칸.재응시추가표_()['홍길동|' + 낸때.getTime()], 1);

console.log('\n— 숙제가져오기 — 단계 숙제는 단계로, 옛 숙제는 그대로 —');
칸.rows_ = name => (name === '숙제' ? [
  ['', '예시 단어장', 1, 10, '스펠링', '2026-12-31', 낸때, '', '기한', '수업A', 1, '', '', '시험', 80, 2],
  ['', '예시 단어장', 11, 20, '스펠링', '2026-12-31', 낸때, '', '기한', '수업A', 2, '', '', '연습', '', ''],
  ['', '예시 단어장', 21, 25, '스펠링', '2026-12-31', 낸때, '', '기한']] : name === '기록' ? 기록.map(x => x.slice()) : []);
칸.단어장목록 = () => [{ 이름: '예시 단어장', 개수: 25, 종류: '' }];
칸.교재맵_ = () => ({}); 칸.반별명단_ = () => ({}); 칸.내숙제인가_ = () => true;
const 받은 = 칸.숙제가져오기('홍길동');
const 시험 = 받은.filter(h => h.시작 === 1)[0], 옛 = 받은.filter(h => h.시작 === 21)[0];
확인('시험 단계 — 응시수 · 마지막 점수 · 남은 응시(더 준 1번 포함)', [시험.단계, 시험.응시수, 시험.마지막점수, 시험.남은응시, 시험.완료], ['시험', 3, 70, 1, false]);
확인('연습 단계 — 안 냈으면 아직', [받은.filter(h => h.시작 === 11)[0].단계, 받은.filter(h => h.시작 === 11)[0].완료], ['연습', false]);
확인('단계가 빈 옛 숙제는 단계 없음', [옛.단계, 옛.응시수], ['', 0]);

/* ======================= 화면 ======================= */
(async () => {
  const b = await chromium.launch(띄우기설정);
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const errs = [];

  console.log('\n— 선생님 · 수업 짜기 — 기본은 연습 —');
  const t = await ctx.newPage();
  t.on('pageerror', e => errs.push('ERR(선생님) ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소); await t.waitForTimeout(400);
  await t.click('#btnTeacherGo'); await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  await t.evaluate(() => { var b = document.querySelector('[data-tab="hw"]'); var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]'); if (g) g.click(); });
  await t.waitForTimeout(250); await t.click('[data-tab="hw"]'); await t.waitForTimeout(1000);
  await t.selectOption('#lsBook', '예시 단어장'); await t.waitForTimeout(200);
  await t.click('#lsAddStep'); await t.waitForTimeout(150);
  await t.click('#lsAddStep'); await t.waitForTimeout(150);
  확인('단계 기본값은 연습', await t.locator('#lsSteps [data-f="단계"]').evaluateAll(es => es.map(e => e.value)), ['연습', '연습']);
  확인('연습 줄엔 통과점수·재응시·제한 칸이 없다', await t.locator('#lsSteps [data-f="통과"], #lsSteps [data-f="재응시"], #lsSteps [data-f="제한"]').count(), 0);
  await t.locator('#lsSteps [data-f="단계"]').nth(1).selectOption('시험'); await t.waitForTimeout(200);
  확인('시험으로 바꾸면 그 줄에만 — 통과점수 80 · 재응시 2 · 제한', [
    await t.locator('#lsSteps .sjstep').nth(1).locator('[data-f="통과"]').inputValue(),
    await t.locator('#lsSteps .sjstep').nth(1).locator('[data-f="재응시"]').inputValue(),
    await t.locator('#lsSteps .sjstep').nth(1).locator('[data-f="제한"]').count(),
    await t.locator('#lsSteps .sjstep').nth(0).locator('[data-f="통과"]').count()], ['80', '2', 1, 0]);
  await t.fill('#lsName', '흐름 검사 수업');
  await t.evaluate(() => { DEMO_배정.forEach(x => { if (x.이름 === '김영희' && x.교재.indexOf('예시 단어장') < 0) x.교재.push('예시 단어장'); }); });
  await t.click('#btnLsAdd'); await t.waitForTimeout(1500);
  확인('숙제 줄에 연습 · 시험 · 통과점수 · 재응시', await t.evaluate(() => DEMO_HW.filter(h => h.수업 === '흐름 검사 수업')
    .map(h => [h.단계, h.통과점수, h.재응시])), [['연습', '', ''], ['시험', 80, 2]]);

  console.log('\n— 선생님 · 재응시를 다 쓴 아이에게 한 번 더 —');
  await t.evaluate(() => { const h = DEMO_HW.filter(x => x.수업 === '흐름 검사 수업')[1]; h.막힌사람 = ['홍길동']; T.data.숙제목록 = DEMO_HW.slice(); });
  await t.evaluate(() => { var b = document.querySelector('[data-tab="miss"]'); var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]'); if (g) g.click(); });
  await t.waitForTimeout(250); await t.click('[data-tab="miss"]'); await t.waitForTimeout(800);
  확인('「재응시 한 번 더」 단추', await t.locator('[data-moretry]').count(), 1);
  await t.click('[data-moretry]'); await t.waitForTimeout(800);
  확인('누르면 그 아이가 빠진다', await t.locator('[data-moretry]').count(), 0);

  /* ---------------- 아이 ---------------- */
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 420, height: 900 });
  p.on('pageerror', e => errs.push('ERR(아이) ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동'); await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  if (await p.locator('#noti').isVisible()) await p.click('#notiOk');
  await p.evaluate(() => {
    window.__보낸 = [];
    const 원래 = window.api;
    window.api = function (이름, 짐) { if (이름 === '결과저장') window.__보낸.push(짐); return 원래.apply(null, arguments); };
    const 기본 = { 단어장: '예시 단어장', 마감일: 오늘값(), 개별: false, 색: '', 종류: '당일', 남은일수: 0, 완료: false, 점수: 0, 응시수: 0, 수업: '검사 수업' };
    S.숙제 = S.숙제.filter(h => !h.수업);
    S.숙제.push(Object.assign({}, 기본, { 순서: 1, 시작: 1, 끝: 5, 유형: '첫 글자', 단계: '연습', 낸때: 8101 }));
    S.숙제.push(Object.assign({}, 기본, { 순서: 2, 시작: 11, 끝: 20, 유형: '스펠링', 단계: '시험', 통과점수: 80, 남은응시: 2, 낸때: 8102 }));
    S.숙제.push(Object.assign({}, 기본, { 순서: 3, 시작: 21, 끝: 25, 유형: '4지선다', 단계: '연습', 낸때: 8103 }));
    S.숙제.push(Object.assign({}, 기본, { 수업: '막힐 수업', 순서: 1, 시작: 1, 끝: 10, 유형: '스펠링', 단계: '시험', 통과점수: 80, 남은응시: 1, 낸때: 8201 }));
    drawHw();
  });
  const 줄글 = () => p.locator('.lscard').first().locator('.lsrow, .lsask').evaluateAll(es => es.map(e =>
    (e.classList.contains('lsask') ? 'ask' : [...e.classList].filter(c => c !== 'lsrow')[0]) + ':' + e.innerText.replace(/\s+/g, ' ').trim()));
  const 풀고내기 = async (맞힐수) => {
    const 답 = await p.evaluate(() => S.문제.map(w => w.en));
    const 칸들 = p.locator('#shList .sin');
    for (let k = 0; k < 답.length; k++) await 칸들.nth(k).fill(k < 맞힐수 ? 답[k] : 'zzz');
    await p.click('#shSubmit'); await p.waitForTimeout(1000);
  };
  const 집으로 = async () => { await p.evaluate(() => show('home')); await p.waitForTimeout(500); };

  console.log('\n— 연습은 한 번 내면 다음이 열린다 (점수가 낮아도) —');
  let 줄 = await 줄글();
  확인('처음 — ① 시작, ② ③ 잠김', 줄.map(x => x.split(':')[0]), ['now', 'lock', 'lock']);
  await p.click('.lscard [data-hw]'); await p.waitForTimeout(1800);
  확인('연습엔 시작 안내가 없다', await p.locator('#limAsk').isVisible().catch(() => false), false);
  await 풀고내기(0);
  확인('0점이어도 제출로 친다', await p.evaluate(() => S.숙제.filter(h => h.낸때 === 8101)[0].완료), true);
  확인('기록은 남긴다 (연습도 숙제)', await p.evaluate(() => window.__보낸.length), 1);
  await 집으로();
  줄 = await 줄글();
  확인('② 시험이 열린다 — 통과점수를 알려 준다', [줄[1].split(':')[0], /80점을 넘겨야 다음이 열려요/.test(줄[1])], ['now', true]);

  console.log('\n— 시험은 통과점수를 못 넘으면 다음이 안 열린다 —');
  await p.locator('.lscard').first().locator('.lsrow.now[data-hw]').click(); await p.waitForTimeout(500);
  확인('들어가기 전에 알려 준다', /80점<\/b>을 넘겨야 다음이 열려요/.test(await p.locator('#limT').innerHTML()), true);
  await p.click('#limGo'); await p.waitForTimeout(1800);
  확인('시험지', await p.evaluate(() => 지금화면_()), 'sheet');
  await 풀고내기(4);                                   // 10문제 중 4개 — 40점
  const 틀린말 = await p.evaluate(() => S.오답.map(w => w.en));
  await 집으로();
  줄 = await 줄글();
  console.log('  ' + 줄.join(' | '));
  확인('떨어진 줄 · 다시 연습 · 다시 보기(잠김) · ③ 잠김', 줄.map(x => x.split(':')[0]), ['done', 'fail', 'now', 'lock', 'lock']);
  확인('몇 점이 안 됐는지', /40점 — 80점이 안 됐어요/.test(줄[1]), true);
  확인('다시 보기에 남은 재응시', /재응시 1번 남음/.test(줄[3]), true);

  console.log('\n— 떨어지면 틀린 것만 다시 연습 (기록에 안 남긴다) —');
  const 보낸수 = await p.evaluate(() => window.__보낸.length);
  await p.click('[data-again]'); await p.waitForTimeout(1800);
  const 낸말 = await p.evaluate(() => S.문제.map(w => w.en));
  확인('틀린 문항만 나온다', 낸말.slice().sort(), 틀린말.slice().sort());
  확인('유형은 앞의 연습 단계 것 (첫 글자)', await p.evaluate(() => S.모드), 'hint');
  await 풀고내기(낸말.length);
  확인('「틀린 것 다시 연습」 은 결과저장을 부르지 않는다', await p.evaluate(() => window.__보낸.length), 보낸수);
  await 집으로();
  줄 = await 줄글();
  확인('다시 연습을 끝내면 「다시 보기」 가 열린다', 줄.map(x => x.split(':')[0]), ['done', 'fail', 'done', 'now', 'lock']);

  console.log('\n— 다시 보기에서 통과하면 다음 단계가 열린다 —');
  await p.locator('.lscard').first().locator('.lsrow.now[data-hw]').click(); await p.waitForTimeout(400);
  await p.click('#limGo'); await p.waitForTimeout(1800);
  await 풀고내기(10);
  await 집으로();
  줄 = await 줄글();
  확인('통과 — ✓ 로 접히고 ③ 이 열린다', 줄.map(x => x.split(':')[0]), ['done', 'done', 'now']);
  확인('점수와 ✓', /100점 ✓/.test(줄[1]), true);

  console.log('\n— 재응시를 다 쓰면 선생님께 —');
  const 막 = () => p.locator('.lscard').nth(1).locator('.lsrow, .lsask').evaluateAll(es => es.map(e => e.classList.contains('lsask') ? 'ask:' + e.innerText.trim() : [...e.classList][1]));
  await p.locator('.lscard').nth(1).locator('[data-hw]').click(); await p.waitForTimeout(400);
  await p.click('#limGo'); await p.waitForTimeout(1800);
  await 풀고내기(2);                                   // 남은 응시가 하나뿐이던 시험에 떨어졌다
  await 집으로();
  확인('「선생님께 말씀드리세요」 를 띄우고 멈춘다 (다시 연습·다시 보기 없음)', await 막(), ['fail', 'ask:재응시를 다 썼어요 — 선생님께 말씀드리세요']);
  확인('그 시험 줄은 눌리지 않는다', await p.locator('.lscard').nth(1).locator('[data-hw], [data-again]').count(), 0);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
