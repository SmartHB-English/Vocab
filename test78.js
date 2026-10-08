/* 시험마다 제한 시간 — 시작 전 안내 · 남은 시간 · 0 이면 자동 제출 · 껐다 켜도 이어서 · 제한 없으면 타이머 없음
   · 걸린 시간 기록 · 시간이 빠듯하다는 진단 · 비고의 묶음(단원)으로 범위 고르기 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { chromium } = require('playwright');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 띄우기설정, 탭, 칸열기, 칸닫기 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

/* ======================= Code.gs ======================= */
const 칸 = { SpreadsheetApp: { flush() {} }, Logger: { log() {} }, console };
vm.createContext(칸);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), 칸);
console.log('— 숙제 시트에 제한시간 —');
확인('머리글에 보탠다 (칸 다음)', 칸.HEADERS.숙제.slice(칸.HEADERS.숙제.indexOf('칸'), 칸.HEADERS.숙제.indexOf('칸') + 2), ['칸', '제한시간']);
확인('흉내 시트(getMaxColumns 없음)에서도 칸 넓히기가 안 터진다', (() => { try { 칸.숙제칸확보_({ getLastRow: () => 1 }); return 'ok'; } catch (e) { return e.message; } })(), 'ok');
/* 시험 시간 기본 — 그 유형·문항 수의 예상 × 1.2 올림 (스펠링 20초 × 20개 = 7분 → 9분, 5 × 1.2 는 6 그대로) */
확인('시험 시간 기본값 — 예상의 1.2배 올림', [칸.시험시간기본_('스펠링', 20, ''), 칸.시험시간기본_('스펠링', 15, ''), 칸.시험시간기본_('스펠링', 0, '')], [9, 6, '']);

console.log('\n— 시간이 빠듯합니다 —');
const 기본 = { 교재: 'A', 오늘: '2026-10-08', 예산: 60, 레슨: 10, 총: 100, 학생수: 6, 단어들: [],
  숙제들: [{ 단어장: 'A', 시작: 1, 끝: 20, 유형: '스펠링', 등록: '2026-10-07', 안낸수: 0, 제한시간: 5 }] };
const 기록들 = 초 => [1, 2, 3, 4, 5].map(i => ({ 이름: '학생' + i, 유형: '스펠링', 점수: 90, 틀린: '', 초 }));
let r = 칸.수업추천짜기_(Object.assign({}, 기본, { 기록들: 기록들(290) }));
확인('평균 걸린 시간이 제한의 90% 를 넘으면', r.진단.filter(t => /빠듯/.test(t)), ['스펠링 평균 4분 50초 / 제한 5분 — 시간이 빠듯합니다']);
r = 칸.수업추천짜기_(Object.assign({}, 기본, { 기록들: 기록들(200) }));
확인('넉넉하면 안 적는다', r.진단.some(t => /빠듯/.test(t)), false);
r = 칸.수업추천짜기_(Object.assign({}, 기본, { 기록들: 기록들(290), 숙제들: [Object.assign({}, 기본.숙제들[0], { 제한시간: 0 })] }));
확인('제한이 없는 유형은 안 본다', r.진단.some(t => /빠듯/.test(t)), false);

/* ======================= 화면 — 아이 ======================= */
const 숙제넣기 = (p, h) => p.evaluate(h => {
  S.숙제.push(Object.assign({ 단어장: '예시 단어장', 시작: 1, 끝: 5, 유형: '스펠링', 마감일: 오늘값(), 개별: false,
    색: '', 종류: '당일', 남은일수: 0, 완료: false, 점수: 0 }, h));
  drawHw();
  return S.숙제.length - 1;
}, h);
const 화면 = p => p.evaluate(() => 지금화면_());
const 남은초 = p => p.evaluate(() => Math.ceil((제한.끝날때 - Date.now()) / 1000));
async function 들어가기(p) {
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동'); await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  if (await p.locator('#noti').isVisible()) await p.click('#notiOk');
  await p.evaluate(() => {
    window.__보낸 = [];
    const 원래 = window.api;
    window.api = function (이름, 짐) { if (이름 === '결과저장') window.__보낸.push(짐); return 원래.apply(null, arguments); };
  });
}

(async () => {
  const b = await chromium.launch(띄우기설정);
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await 들어가기(p);

  console.log('\n— 제한시간 10분 — 시작 전에 알려 준다 —');
  let i = await 숙제넣기(p, { 제한시간: 10, 낸때: 7001 });
  확인('숙제 줄에 ⏱ 10분', /⏱ 10분/.test(await p.locator('#hwBox [data-hw="' + i + '"]').innerText()), true);
  await p.click('#hwBox [data-hw="' + i + '"]'); await p.waitForTimeout(600);
  확인('안내가 뜬다', await p.locator('#limAsk').isVisible(), true);
  확인('「10분 안에 풀어야 해요. 시작할까요?」', (await p.locator('#limT').innerText()).trim(), '⏱ 10분 안에 풀어야 해요. 시작할까요?');
  확인('시작 전에는 시간이 안 간다 (시작한 때가 없다)', await p.evaluate(() => 제한시작때_(S.숙제[S.숙제.length - 1])), 0);
  확인('아직 숙제 화면', await 화면(p), 'home');
  await p.click('#limNo'); await p.waitForTimeout(200);
  확인('「나중에」 면 그대로', [await p.locator('#limAsk').isVisible(), await 화면(p)], [false, 'home']);
  await p.click('#hwBox [data-hw="' + i + '"]'); await p.waitForTimeout(400);
  await p.click('#limGo'); await p.waitForTimeout(1800);
  확인('「시작」 하면 시험지', await 화면(p), 'sheet');
  확인('남은 시간이 위에 뜬다', await p.locator('#fixClock').isVisible(), true);
  const 처음 = await 남은초(p);
  확인('10분부터 센다', 처음 > 590 && 처음 <= 600, true);
  await p.waitForTimeout(2200);
  확인('시간이 줄어든다', (await 남은초(p)) < 처음, true);

  console.log('\n— 껐다 켜도 남은 시간이 이어진다 —');
  const 끄기전 = await 남은초(p);
  await p.waitForTimeout(1200);
  await 들어가기(p);                                   // 앱을 다시 연다 (이 기기의 기록은 남는다)
  i = await 숙제넣기(p, { 제한시간: 10, 낸때: 7001 });
  await p.click('#hwBox [data-hw="' + i + '"]'); await p.waitForTimeout(1800);
  확인('다시 묻지 않고 이어서 들어간다', [await p.locator('#limAsk').isVisible(), await 화면(p)], [false, 'sheet']);
  const 켠뒤 = await 남은초(p);
  console.log('  끄기 전 ' + 끄기전 + '초 → 켠 뒤 ' + 켠뒤 + '초');
  확인('남은 시간이 늘어나지 않는다', 켠뒤 < 끄기전, true);
  await p.click('#shBack'); await p.waitForTimeout(500);

  console.log('\n— 이미 지났으면 못 들어간다 —');
  i = await 숙제넣기(p, { 제한시간: 10, 낸때: 7002 });
  await p.evaluate(() => 저장쓰기_(제한열쇠_(S.숙제[S.숙제.length - 1]), Date.now() - 11 * 60000));
  await p.click('#hwBox [data-hw="' + i + '"]'); await p.waitForTimeout(800);
  확인('숙제 화면에 남는다', [await p.locator('#limAsk').isVisible(), await 화면(p)], [false, 'home']);

  console.log('\n— 0 이 되면 쓴 데까지 자동 제출 —');
  i = await 숙제넣기(p, { 제한시간: 1, 낸때: 7003 });
  await p.evaluate(() => 저장쓰기_(제한열쇠_(S.숙제[S.숙제.length - 1]), Date.now() - 52000));
  await p.click('#hwBox [data-hw="' + i + '"]'); await p.waitForTimeout(1500);
  확인('시험지', await 화면(p), 'sheet');
  확인('10초부터는 초를 센다', /⏱ \d+초/.test(await p.locator('#fixClock').innerText()), true);
  확인('1분 안쪽은 빨갛게', await p.locator('#fixClock.soon').count(), 1);
  const 첫답 = await p.evaluate(() => S.문제[0].en);
  await p.locator('#shList .sin').first().fill(첫답);
  const 문항 = await p.evaluate(() => S.문제.length);
  await p.waitForTimeout(8500);
  확인('결과 화면으로 간다', await 화면(p), 'result');
  확인('알려 준다', (await p.locator('#toast').textContent()).indexOf('시간이 다 됐어요. 쓴 데까지 채점할게요.') > -1 ||
    await p.evaluate(() => S.채점됨), true);
  확인('쓴 것만 맞고 나머지는 틀림', await p.evaluate(() => [S.정답수, S.오답.length]), [1, 문항 - 1]);
  const 보낸 = await p.evaluate(() => window.__보낸.slice(-1)[0]);
  console.log('  걸린 시간 ' + (보낸 && 보낸.소요초) + '초');
  확인('기록에 걸린 시간(초)이 남는다 — 「시작」 한 때부터', 보낸 && 보낸.소요초 >= 59 && 보낸.소요초 <= 63, true);
  확인('기록 범위는 숙제 범위', 보낸 && 보낸.범위, '1~5');

  console.log('\n— 제한시간이 없는 숙제에는 타이머가 없다 —');
  await p.click('[data-hbt="hw"]').catch(() => {}); await p.waitForTimeout(400);
  await p.evaluate(() => show('home')); await p.waitForTimeout(400);
  i = await 숙제넣기(p, { 낸때: 7004 });
  확인('숙제 줄에 ⏱ 가 없다', /⏱/.test(await p.locator('#hwBox [data-hw="' + i + '"]').innerText()), false);
  await p.click('#hwBox [data-hw="' + i + '"]'); await p.waitForTimeout(1800);
  확인('안 묻고 바로 시험지', [await p.locator('#limAsk').isVisible(), await 화면(p)], [false, 'sheet']);
  확인('타이머가 안 보인다', await p.locator('#fixClock').isVisible(), false);
  await p.click('#shBack'); await p.waitForTimeout(500);

  console.log('\n— 비고의 묶음(단원)으로 범위 고르기 —');
  await p.evaluate(() => {
    DEMO_과책['단원 단어장'] = { 단어: [
      { en: 'a1', ko: '가1', 비고: '단원 01' }, { en: 'a2', ko: '가2', 비고: '단원 01' },
      { en: 'b1', ko: '나1', 비고: '단원 02' }, { en: 'b2', ko: '나2', 비고: '단원 02' }, { en: 'b3', ko: '나3', 비고: '단원 02' },
      { en: 'c1', ko: '다1', 비고: '단원 03' }, { en: 'c2', ko: '다2', 비고: '단원 03' }] };
  });
  await p.evaluate(() => { S.내단어장 = 내책들().concat([{ 이름: '단원 단어장', 개수: 7, 종류: '과', 레슨: 10, 칸수: { 단어: 7 } }]); enterHome(); });
  await p.waitForTimeout(400);
  await 탭(p, 'mem');
  await 칸열기(p);
  확인('묶음이 없는 단어장엔 안 보인다', await p.locator('#unitA').count(), 0);
  await p.evaluate(() => { $('selBook').value = '단원 단어장'; loadBook(); }); await p.waitForTimeout(900);
  확인('묶음 목록', (await p.locator('#unitA option').allTextContents()).map(x => x.trim()), ['—', '단원 01', '단원 02', '단원 03']);
  await p.selectOption('#unitA', { label: '단원 02' }); await p.waitForTimeout(200);
  확인('묶음 하나 — 그 줄들의 첫~끝 번호', [await p.inputValue('#inFrom'), await p.inputValue('#inTo')], ['3', '5']);
  await p.selectOption('#unitB', { label: '단원 03' }); await p.waitForTimeout(200);
  확인('단원 02~03 한 번에', [await p.inputValue('#inFrom'), await p.inputValue('#inTo')], ['3', '7']);
  await 칸닫기(p);

  /* ======================= 화면 — 선생님 ======================= */
  console.log('\n— 선생님 숙제 내주기 · 수업 짜기에 제한 칸 —');
  const t = await ctx.newPage();
  t.on('pageerror', e => errs.push('ERR(선생님) ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소); await t.waitForTimeout(400);
  await t.click('#btnTeacherGo'); await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  await t.evaluate(() => { var b = document.querySelector('[data-tab="hw"]'); var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]'); if (g) g.click(); });
  await t.waitForTimeout(250); await t.click('[data-tab="hw"]'); await t.waitForTimeout(1000);
  /* 시간은 시험에만 — 시험은 「시험」 탭에서 낸다 */
  await t.evaluate(() => { var b = document.querySelector('[data-tab="exam"]'); var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]'); if (g) g.click(); });
  await t.waitForTimeout(250); await t.click('[data-tab="exam"]'); await t.waitForTimeout(1000);
  const 기대 = await t.evaluate(() => 시험시간기본_($('hwType').value, Number($('hwTo').value) - Number($('hwFrom').value) + 1, ''));
  확인('숙제 내주기 — 시험 시간 기본은 예상의 1.2배', await t.inputValue('#hwTestMin'), String(기대));
  await t.fill('#hwTestMin', '7');
  await t.click('#btnHwAdd').catch(async () => { await t.locator('button', { hasText: '숙제 내주기' }).last().click(); });
  await t.waitForTimeout(1200);
  확인('숙제 줄에 제한시간이 적힌다', await t.evaluate(() => DEMO_HW[DEMO_HW.length - 1].제한시간), 7);
  await t.click('[data-tab="hw"]'); await t.waitForTimeout(1000);      // 수업 짜기는 숙제 탭에
  await t.selectOption('#lsBook', '예시 단어장'); await t.waitForTimeout(300);
  await t.click('#lsAddStep'); await t.waitForTimeout(200);
  const 단분 = Number(await t.locator('#lsSteps [data-f="분"]').first().inputValue());
  /* 제한 칸은 시험 단계에만 나온다 (연습은 몇 번이든 — 시간을 안 잰다) */
  확인('연습 단계엔 제한 칸이 없다', await t.locator('#lsSteps [data-f="제한"]').count(), 0);
  await t.locator('#lsSteps [data-f="단계"]').first().selectOption('시험'); await t.waitForTimeout(200);
  확인('수업 짜기 시험 단계 — 「제한」 칸이 「분」 과 따로, 기본 1.2배', await t.locator('#lsSteps [data-f="제한"]').first().inputValue(), String(Math.ceil(단분 * 12 / 10)));
  await t.click('#lsAddStep'); await t.waitForTimeout(200);
  await t.locator('#lsSteps [data-f="단계"]').nth(1).selectOption('시험'); await t.waitForTimeout(200);
  await t.locator('#lsSteps [data-f="제한"]').nth(1).fill(''); await t.waitForTimeout(100);
  await t.fill('#lsName', '제한 검사 수업');
  await t.evaluate(() => { DEMO_배정.forEach(x => { if (x.이름 === '김영희' && x.교재.indexOf('예시 단어장') < 0) x.교재.push('예시 단어장'); }); });
  await t.click('#btnLsAdd'); await t.waitForTimeout(1500);
  확인('수업 숙제에도 — 기본값 · 비우면 제한 없음', await t.evaluate(() => DEMO_HW.filter(h => h.수업 === '제한 검사 수업').map(h => h.제한시간)),
    [Math.ceil(단분 * 12 / 10), 0]);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
