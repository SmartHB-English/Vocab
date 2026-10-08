/* 시간은 설정이 아니라 숙제마다 — 외우는 시간 · 시험 시간 두 칸, 손으로 적은 값은 그 숙제 한 번뿐,
   목록에서 줄마다 고치기 · 고른 줄만 한꺼번에 · 아이 「시험」 탭은 그 숙제의 시간으로 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { chromium } = require('playwright');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 띄우기설정, 책고르기, 방법 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

/* ======================= Code.gs ======================= */
const 칸 = { SpreadsheetApp: { flush() {} }, Logger: { log() {} }, console,
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  Utilities: { formatDate(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); } } };
vm.createContext(칸);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), 칸);
const 안Date = vm.runInContext('Date', 칸);

console.log('— 설정에서 시간 두 줄을 안 읽는다 —');
const 읽은열쇠 = [];
칸.setting_ = (k, 기본) => { 읽은열쇠.push(k); return k === '외우기시간분' ? 3 : k === '시험시간분' ? 15 : 기본; };
칸.선생님확인_ = () => true;
칸.합격점_ = () => 80;
칸.단어장목록 = () => [];
const 설정 = 칸.설정가져오기('1234');
const 시작 = 칸.시작정보();
확인('설정가져오기 — 합격점만', Object.keys(설정).sort(), ['ok', '합격점']);
확인('시작정보에 외우기분·시험분이 없다', ['외우기분', '시험분'].filter(k => k in 시작), []);
const 쓴것 = [];
칸.설정쓰기_ = (k, v) => 쓴것.push(k);
칸.설정저장('1234', { 외우기분: 7, 시험분: 9, 합격점: 75 });
확인('설정저장 — 외우기분·시험분은 안 받는다', 쓴것, ['숙제합격점']);
확인('외우기시간분·시험시간분 을 읽지 않는다', 읽은열쇠.filter(k => /시간분/.test(k)), []);
확인('설정 시트를 처음 만들 때 적는 두 줄은 남아 있다 (지우지 않는다)',
  /\['외우기시간분', 기본외우기분\][\s\S]*\['시험시간분', 기본시험분\]/.test(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8')), true);

console.log('\n— 숙제 시트에 외우기분 칸 —');
확인('머리글 맨 뒤에 외우기분', 칸.HEADERS.숙제.slice(-1), ['외우기분']);
확인('흉내 시트(getMaxColumns 없음)에서도 칸 넓히기가 안 터진다',
  (() => { try { 칸.숙제칸확보_({ getLastRow: () => 1 }); return 'ok'; } catch (e) { return e.message; } })(), 'ok');

function 가짜(줄) {
  return { 줄, getLastRow: () => 줄.length,
    getRange(r, c, nr, nc) { return {
      getValues: () => 줄.slice(r - 1, r - 1 + (nr || 1)).map(x => { const y = x.slice(c - 1, c - 1 + (nc || 1)); while (y.length < (nc || 1)) y.push(''); return y; }),
      getValue: () => 줄[r - 1][c - 1],
      setValue(v) { while (줄[r - 1].length < c) 줄[r - 1].push(''); 줄[r - 1][c - 1] = v; return this; },
      setValues(v) { v.forEach((x, i) => { 줄[r - 1 + i] = 줄[r - 1 + i] || []; x.forEach((y, j) => { 줄[r - 1 + i][c - 1 + j] = y; }); }); return this; },
      setFontWeight() { return this; }, setBackground() { return this; } }; } };
}
const 때1 = new 안Date(2026, 9, 1, 9, 0), 때2 = new 안Date(2026, 9, 2, 9, 0), 때3 = new 안Date(2026, 9, 3, 9, 0);
const 숙제줄 = () => [HEADERS_숙제(),
  ['', '예시 단어장', 1, 20, '스펠링', '2026-10-09', 때1, '', '시험', '', 0, '', 9, '', '', '', 5],
  ['', '중2 5과 본문', 1, 12, '영작', '2026-10-09', 때2, '', '시험', '', 0, '', 17, '', '', '', 3],
  ['', '예시 단어장', 21, 25, '첫 글자', '2026-10-09', 때3, '', '기한', '수업A', 1, '', 8, '시험', 80, 2, '']];
function HEADERS_숙제() { return 칸.HEADERS.숙제.slice(); }
let 시트 = 가짜(숙제줄());
칸.sheet_ = () => 시트;
칸.전체숙제 = () => [];

console.log('\n— 숙제수정 — 줄번호로 찾고, 보낸 칸만 고친다 —');
let r = 칸.숙제수정('1234', 2, { 제한시간: 12 });
확인('시간만 고치면 앞칸(단어장·범위·유형·종류·마감)은 그대로', 시트.줄[1].slice(0, 9).map(x => x instanceof 안Date ? 'date' : x),
  ['', '예시 단어장', 1, 20, '스펠링', '2026-10-09', 'date', '', '시험']);
확인('그 줄의 제한시간만 바뀐다 · 외우기분은 그대로', [시트.줄[1][12], 시트.줄[1][16], r.ok], [12, 5, true]);
확인('다른 줄은 그대로', [시트.줄[2][12], 시트.줄[3][12]], [17, 8]);
칸.숙제수정('1234', 4, { 통과점수: 90, 재응시: 3, 외우기분: '' });
확인('시험 단계 줄 — 통과점수·재응시 · 비우면 빈칸', [시트.줄[3][14], 시트.줄[3][15], 시트.줄[3][16]], [90, 3, '']);
칸.숙제수정('1234', 3, { 제한시간: 0 });
확인('0 이면 제한 없음(빈칸)', 시트.줄[2][12], '');
확인('말이 안 되는 값은 막는다', 칸.숙제수정('1234', 3, { 제한시간: 999 }).ok, false);
확인('없는 줄 — 이미 지워진 숙제', 칸.숙제수정('1234', 9, { 제한시간: 5 }).메시지, '이미 지워진 숙제입니다');

console.log('\n— 그 사이 줄이 밀렸으면 등록시각으로 다시 찾는다 —');
시트 = 가짜(숙제줄());
시트.줄.splice(1, 1);                       // 맨 앞 숙제가 지워져 한 줄씩 올라갔다
r = 칸.숙제수정('1234', 2, { 제한시간: 20, 낸때: 때3.getTime() });   // 화면은 옛 줄번호 2 + 「수업A」 숙제의 낸때를 들고 있다
확인('줄번호 2 는 이제 본문 숙제 — 건드리지 않는다', 시트.줄[1][12], 17);
확인('낸때로 찾은 「수업A」 줄이 바뀐다', 시트.줄[2][12], 20);
확인('낸때가 어디에도 없으면 고치지 않는다', 칸.숙제수정('1234', 2, { 제한시간: 1, 낸때: 12345 }).ok, false);

console.log('\n— 여러 줄 한꺼번에 — 고른 줄만 —');
시트 = 가짜(숙제줄());
r = 칸.숙제수정('1234', [{ 행: 2, 낸때: 때1.getTime() }, { 행: 4, 낸때: 때3.getTime() }], { 제한시간: 15 });
확인('고른 두 줄만 15분', [시트.줄[1][12], 시트.줄[2][12], 시트.줄[3][12], r.개수], [15, 17, 15, 2]);
확인('외우기분은 안 보냈으니 그대로', [시트.줄[1][16], 시트.줄[3][16]], [5, '']);

console.log('\n— 숙제등록 — 외우기분을 17번째 칸에 —');
시트 = 가짜([HEADERS_숙제()]);
칸.전체명단_ = () => ['홍길동']; 칸.교재학생_ = () => ['홍길동']; 칸.이름들풀기_ = () => [];
칸.교재맵_ = () => ({ 홍길동: ['예시 단어장'] }); 칸.반별명단_ = () => ({}); 칸.최근기록줄_ = () => [];   // 새 줄 하나만 돌려줄 때 쓰는 것들
칸.숙제등록('1234', { 단어장: '예시 단어장', 시작: 1, 끝: 20, 유형: '스펠링', 종류: '시험', 마감일: '2026-10-09', 외우기분: 5, 제한시간: 9 });
확인('외우기분 5 · 제한시간 9', [시트.줄[1][16], 시트.줄[1][12], 시트.줄[1].length], [5, 9, 17]);
칸.숙제등록('1234', { 단어장: '예시 단어장', 시작: 1, 끝: 20, 유형: '스펠링', 종류: '당일' });
확인('시간을 안 보내면 둘 다 빈칸 (옛 숙제처럼 제한 없음)', [시트.줄[2][16], 시트.줄[2][12]], ['', '']);

console.log('\n— 이번 판 전에 낸 시험 숙제 — 그때 설정값(여기선 외우기 3 · 시험 15)을 이어받는다 —');
const 옛줄 = ['', '예시 단어장', 1, 20, '스펠링', '2026-10-09', 때1, '', '시험', '', 0, '', '', '', '', ''];   // 16칸 — 외우기분 칸이 없던 때
const 옛제한 = ['', '예시 단어장', 1, 20, '스펠링', '2026-10-09', 때1, '', '시험', '', 0, '', 7, '', '', ''];
확인('칸이 없는 옛 시험 줄 — 설정값으로', [칸.숙제시간_(옛줄, '시험').외우기분, 칸.숙제시간_(옛줄, '시험').제한시간], [3, 15]);
확인('옛 시험 줄에 제한을 적어 두었으면 그 값', 칸.숙제시간_(옛제한, '시험').제한시간, 7);
확인('옛 숙제(시험 아님)는 제한 없음 그대로', [칸.숙제시간_(옛줄, '기한').외우기분, 칸.숙제시간_(옛줄, '기한').제한시간], [0, 0]);
확인('칸이 생긴 뒤 비워 둔 줄은 비운 대로', 칸.숙제시간_(옛줄.concat(['']), '시험').외우기분, 0);
let 너비 = 16;
const 옛시트 = 가짜([칸.HEADERS.숙제.slice(0, 16), 옛줄.slice(), ['', '예시 단어장', 1, 5, '스펠링', '2026-10-09', 때2, '', '기한', '', 0, '', '', '', '', '']]);
옛시트.getMaxColumns = () => 너비; 옛시트.insertColumnsAfter = (a, n) => { 너비 += n; };
칸.숙제칸확보_(옛시트);
확인('칸이 처음 생길 때 옛 시험 줄에 그때 값을 적는다', [옛시트.줄[1][16], 옛시트.줄[1][12]], [3, 15]);
확인('시험이 아닌 줄은 그대로', [옛시트.줄[2][16], 옛시트.줄[2][12]], ['', '']);
확인('머리글에 외우기분', 옛시트.줄[0][16], '외우기분');

/* ======================= 화면 ======================= */
(async () => {
  const b = await chromium.launch(띄우기설정);
  const errs = [];

  /* ---------- 선생님 ---------- */
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const t = await ctx.newPage();
  t.on('pageerror', e => errs.push('ERR(선생님) ' + e.message));
  let 물음 = [];
  t.on('dialog', d => { 물음.push(d.message()); d.accept(); });
  await t.goto(앱주소); await t.waitForTimeout(400);
  await t.click('#btnTeacherGo'); await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  async function 탭가기(이름) {
    await t.evaluate(n => { var b = document.querySelector('[data-tab="' + n + '"]'); var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]'); if (g) g.click(); }, 이름);
    await t.waitForTimeout(250); await t.click('[data-tab="' + 이름 + '"]'); await t.waitForTimeout(1000);
  }

  console.log('\n— 설정 화면 —');
  await 탭가기('setting');
  확인('외우는 시간·시험 시간 칸이 없다', await t.locator('#setMem, #setEx').count(), 0);
  확인('「학생 「시험」 탭」 판이 없다', /학생 「시험」 탭/.test(await t.locator('#tBody').innerText()), false);
  확인('한 줄 안내만 남는다', (await t.locator('#setTimeNote').innerText()).trim(), '시간은 숙제마다 정합니다. 숙제 탭에서 내실 때 적으세요.');
  확인('합격점 판은 그대로', await t.locator('#setPass').inputValue(), '80');

  console.log('\n— 시험 내주기 — 유형·문항 수로 따로 센다 (시간은 시험 탭에서) —');
  await 탭가기('exam');
  await t.evaluate(() => { DEMO_배정.forEach(x => ['예시 단어장', '중2 5과 본문'].forEach(c => { if (x.교재.indexOf(c) < 0) x.교재.push(c); })); });
  /* 시험 탭은 종류가 「시험」 으로 못 박혀 있다 — 고를 것이 없다 */
  const 종류고르기 = async k => { if (k === '시험') return; await t.locator('input[name=hwKind][value="' + k + '"]').locator('xpath=..').click(); await t.waitForTimeout(200); };
  const 범위 = (a, z) => t.evaluate(([a, z]) => { $('hwFrom').value = a; $('hwTo').value = z; $('hwFrom').oninput(); }, [a, z]);
  const 내기 = async () => { await t.click('#btnHwAdd'); await t.waitForTimeout(1200); return t.evaluate(() => { var h = DEMO_HW[DEMO_HW.length - 1]; return [h.외우기분, h.제한시간]; }); };
  const 표시 = () => t.evaluate(() => [$('hwMemSrc').textContent, $('hwTestSrc').textContent]);

  await t.selectOption('#hwBook', '예시 단어장'); await t.waitForTimeout(300);
  await 종류고르기('시험');
  await 범위(1, 20); await t.selectOption('#hwType', '스펠링'); await t.waitForTimeout(200);
  const 단어값 = [await t.inputValue('#hwMemMin'), await t.inputValue('#hwTestMin')];
  확인('단어 20개 스펠링 — 외우기 5분 (20 × 15초) · 시험은 예상 × 1.2', 단어값,
    ['5', String(await t.evaluate(() => Math.ceil(단계분_('스펠링', 20, '') * 12 / 10)))]);
  확인('처음엔 「자동」', await 표시(), ['자동', '자동']);
  const 단어낸 = await 내기();

  await t.selectOption('#hwBook', '중2 5과 본문'); await t.waitForTimeout(400);
  await 종류고르기('시험');
  await 범위(1, 12); await t.selectOption('#hwType', '영작'); await t.waitForTimeout(200);
  const 본문낸 = await 내기();
  확인('본문 12문장 영작 — 외우기 3분 · 시험 시간도 따로', 본문낸,
    [3, await t.evaluate(() => Math.ceil(단계분_('영작', 12, '본문') * 12 / 10))]);
  확인('두 숙제의 외우기분·제한시간이 서로 다르다', [단어낸[0] !== 본문낸[0], 단어낸[1] !== 본문낸[1]], [true, true]);

  console.log('\n— 손으로 고친 값은 그 숙제 한 번뿐 —');
  await t.selectOption('#hwBook', '예시 단어장'); await t.waitForTimeout(300);
  await 종류고르기('시험');
  await t.fill('#hwTestMin', '10'); await t.waitForTimeout(100);
  확인('고치면 「직접」', (await 표시())[1], '직접');
  확인('숙제에 10분이 들어간다', (await 내기())[1], 10);
  await 종류고르기('시험');
  확인('낸 뒤엔 다시 「자동」', (await 표시())[1], '자동');
  await t.fill('#hwTestMin', '10'); await t.waitForTimeout(100);
  const 다른유형 = await t.evaluate(() => [].slice.call($('hwType').options).map(o => o.value).filter(v => v !== $('hwType').value)[0]);
  await t.selectOption('#hwType', 다른유형); await t.waitForTimeout(200);
  확인('유형을 바꾸면 자동 값으로 다시 채워진다',
    [await t.inputValue('#hwTestMin'), (await 표시())[1]],
    [String(await t.evaluate(() => 시험시간기본_($('hwType').value, Number($('hwTo').value) - Number($('hwFrom').value) + 1, ''))), '자동']);
  await t.fill('#hwTestMin', '10'); await 범위(1, 10);
  확인('범위를 바꿔도 자동으로', (await 표시())[1], '자동');

  console.log('\n— 숙제 탭에는 시간 칸이 없다 (시간은 시험에만) —');
  await 탭가기('hw');
  await t.selectOption('#hwBook', '예시 단어장'); await t.waitForTimeout(300);
  확인('외우는 시간 · 시험 시간 칸이 숨어 있다', [await t.locator('#hwTestWrap').isVisible(), await t.locator('#hwMemWrap').isVisible()], [false, false]);
  확인('숙제에 시간이 안 들어간다', await 내기(), [0, 0]);

  console.log('\n— 목록 — 한 줄만 고친다 (시험 줄은 시험 탭에) —');
  await 탭가기('exam');
  const 시간들 = () => t.evaluate(() => DEMO_HW.reduce((o, h) => (o[h.행] = [h.외우기분 || 0, h.제한시간 || 0], o), {}));
  const 전 = await 시간들();
  확인('줄마다 「⏱ … ✎」', /⏱ 5분 \/ 20분 ✎/.test(await t.locator('[data-tm="6"]').innerText()), true);
  await t.click('[data-tm="6"]'); await t.waitForTimeout(500);
  확인('그 줄 아래에만 고치는 칸', await t.locator('.tmedit').count(), 1);
  await t.locator('.tmedit .tmTest').fill('12');
  물음 = [];
  await t.click('[data-tmsave="6"]'); await t.waitForTimeout(800);
  const 후 = await 시간들();
  확인('그 줄만 12분 · 외우기 5분은 그대로', 후[6], [5, 12]);
  확인('다른 줄은 그대로', Object.keys(전).filter(k => k !== '6' && JSON.stringify(전[k]) !== JSON.stringify(후[k])), []);
  확인('아무도 안 푼 숙제는 묻지 않는다', 물음.length, 0);
  await 탭가기('hw');
  await t.click('[data-tm="4"]'); await t.waitForTimeout(400);
  await t.locator('.tmedit .tmTest').fill('6');
  await t.click('[data-tmsave="4"]'); await t.waitForTimeout(800);
  확인('이미 푼 아이가 있으면 먼저 묻는다', /이미 2명이 풀었습니다/.test(물음[0] || ''), true);
  확인('「예」 면 바뀐다', (await 시간들())[4][1], 6);

  console.log('\n— 「선택 시간 바꾸기」 — 고른 줄만 같이 바뀐다 —');
  const 전2 = await 시간들();
  확인('고르기 전엔 못 누른다', await t.locator('.hwTimeSel[data-scope="now"]').isDisabled(), true);
  await t.check('.hwPick[data-row="4"]'); await t.check('.hwPick[data-row="2"]'); await t.waitForTimeout(200);
  await t.click('.hwTimeSel[data-scope="now"]'); await t.waitForTimeout(500);
  확인('몇 건인지 보여 준다', await t.locator('#tmBulkN').innerText(), '고른 2건');
  await t.fill('#tmBulkTest', '15');
  await t.click('#tmBulkGo'); await t.waitForTimeout(900);
  const 후2 = await 시간들();
  확인('고른 두 줄만 15분 · 외우기는 비워 둬서 그대로', [후2[4], 후2[2]], [[전2[4][0], 15], [전2[2][0], 15]]);
  확인('안 고른 줄은 그대로', Object.keys(전2).filter(k => k !== '4' && k !== '2' && JSON.stringify(전2[k]) !== JSON.stringify(후2[k])), []);

  /* ---------- 아이 ---------- */
  console.log('\n— 아이 「시험」 탭 — 그 숙제의 시간으로 돈다 —');
  const ctx2 = await b.newContext({ viewport: { width: 420, height: 900 } });
  const p = await ctx2.newPage();
  p.on('pageerror', e => errs.push('ERR(아이) ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동'); await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  if (await p.locator('#noti').isVisible()) await p.click('#notiOk');
  await p.evaluate(() => {
    const 첫 = S.숙제.filter(h => h.종류 === '시험')[0];
    S.숙제.push(Object.assign({}, 첫, { 시작: 1, 끝: 8, 외우기분: 2, 제한시간: 9, 낸때: 7001 }));
    S.숙제.push(Object.assign({}, 첫, { 시작: 9, 끝: 12, 외우기분: 0, 제한시간: 0, 낸때: 7002 }));   // 시간 칸이 빈 옛 숙제
    그리기_시험목록_();
  });
  await p.click('[data-hbt="test"]'); await p.waitForTimeout(900);
  const 카드시간 = await p.locator('.excard').evaluateAll(es => es.map(e => (e.querySelector('.extime') || { innerText: '' }).innerText.replace(/\s+/g, ' ').trim()));
  확인('시험마다 제 시간이 보인다', 카드시간, ['외우기 5분 › 시험 20분', '외우기 2분 › 시험 9분', '시험 제한 없음']);
  await p.locator('.excard').nth(1).click(); await p.waitForTimeout(2400);
  const 외시계 = (await p.locator('#fixClock').innerText()).trim();
  확인('외우기는 그 숙제의 2분 (설정의 5분이 아니다)', /^⏱ (2:00|1:5\d)$/.test(외시계), true);
  await p.click('#wbGo'); await p.waitForTimeout(1500);
  const 시시계 = (await p.locator('#fixClock').innerText()).trim();
  확인('시험은 그 숙제의 9분', /^⏱ (9:00|8:5\d)$/.test(시시계), true);
  await p.click('#shSubmit'); await p.waitForTimeout(1000);
  await p.click('#s-result [data-back]').catch(() => {}); await p.waitForTimeout(800);

  console.log('\n— 시간 칸이 빈 옛 숙제는 제한 없이 —');
  await p.click('[data-hbt="test"]'); await p.waitForTimeout(800);
  await p.locator('.excard:not(.done)').filter({ hasText: '제한 없음' }).click(); await p.waitForTimeout(2400);
  확인('외우기를 건너뛰고 바로 시험지', await p.locator('#s-sheet').isVisible(), true);
  확인('타이머가 없다', [await p.locator('#fixClock').isVisible(), await p.evaluate(() => 제한.시계)], [false, null]);
  await p.click('#shSubmit'); await p.waitForTimeout(1000);

  console.log('\n— 숙제가 아닌 자유 연습에는 타이머가 안 보인다 —');
  await p.click('#s-result [data-back]').catch(() => {}); await p.waitForTimeout(600);
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(1200);
  await 책고르기(p, '예시 단어장');
  await 방법(p, 'spell');
  확인('연습 시험지가 열린다 · 시계는 없다', [await p.locator('#s-sheet').isVisible(), await p.locator('#fixClock').isVisible(), await p.evaluate(() => 제한.시계)], [true, false, null]);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
