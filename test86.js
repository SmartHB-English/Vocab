/* 숙제와 시험을 갈라 놓기 — 숙제 종류 「시험」 은 숙제가 아니다
   · 선생님 화면에 「시험」 탭 · 숙제 탭엔 시험이 없다 · 배지·안 낸 숙제 수에 시험이 안 섞인다
   · 시험 탭에만 평균 점수 · 옛 숙제(종류 빈칸)는 숙제 쪽 · 아이 화면은 그대로 */
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
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) + (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

/* ======================= Code.gs ======================= */
const 칸 = { Logger: { log() {} }, console, Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  Utilities: { formatDate(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); } } };
vm.createContext(칸);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), 칸);
console.log('— 시험인가_ · 숙제인가_ —');
확인('종류 「시험」 은 시험', [칸.시험인가_({ 종류: '시험' }), 칸.숙제인가_({ 종류: '시험' })], [true, false]);
확인('당일 · 기한 · 보충은 숙제', ['당일', '기한', '보충'].map(k => 칸.숙제인가_({ 종류: k })), [true, true, true]);
확인('종류가 빈 옛 숙제는 숙제 쪽', [칸.숙제인가_({ 종류: '' }), 칸.숙제인가_({})], [true, true]);
확인('수업의 시험 「단계」 는 다른 것 — 숙제다', 칸.숙제인가_({ 종류: '당일', 단계: '시험' }), true);

console.log('\n— 시험 줄에만 평균 — 숙제 줄에는 점수가 없다 —');
const D = vm.runInContext('Date', 칸);
const 오늘 = new D(), 어제 = new D(Date.now() - 86400000);
const 오늘글 = 칸.ymd_(오늘);
vm.runInContext("교재맵전체_ = { A: ['예시 단어장'], B: ['예시 단어장'], C: ['예시 단어장'] };", 칸);
칸.합격점_ = () => 80;      // 설정 시트 대신
const 맥 = { today: 오늘글, 색맵: {}, 전체: ['A', 'B', 'C'], 반학생: {}, 응시: {}, 더준표: {},
  완료: { 'A|예시 단어장|단어 1~10': { [오늘글]: 90 }, 'B|예시 단어장|단어 1~10': { [오늘글]: 70 } } };
const 시험줄 = 칸.숙제줄_(['', '예시 단어장', 1, 10, '스펠링', 오늘, 어제, '', '시험', '', 0, '단어', '', '', '', '', ''], 2, 맥);
const 숙제줄 = 칸.숙제줄_(['', '예시 단어장', 1, 10, '스펠링', 오늘, 어제, '', '기한', '', 0, '단어', '', '', '', '', ''], 3, 맥);
확인('시험 — 본 아이 둘의 평균 80 · 안 본 아이 C', [시험줄.평균, 시험줄.한사람, 시험줄.안한사람], [80, ['A', 'B'], ['C']]);
확인('숙제 줄에는 평균 칸이 아예 없다', '평균' in 숙제줄, false);
확인('아무도 안 본 시험 — 평균 없음(null)', 칸.숙제줄_(['', '예시 단어장', 11, 20, '스펠링', 오늘, 어제, '', '시험', '', 0, '단어', '', '', '', '', ''], 4, 맥).평균, null);
const 목록 = [시험줄, 숙제줄];
확인('숙제 완료율은 숙제만으로', 목록.filter(칸.숙제인가_).map(h => h.한사람.length + '/' + h.대상수), ['1/3']);

/* ======================= 화면 ======================= */
(async () => {
  const b = await chromium.launch(띄우기설정);
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const t = await ctx.newPage();
  t.on('pageerror', e => errs.push('ERR(선생님) ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소); await t.waitForTimeout(400);
  await t.click('#btnTeacherGo'); await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  async function 탭가기(이름) {
    await t.evaluate(n => { var b = document.querySelector('[data-tab="' + n + '"]'); var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]'); if (g) g.click(); }, 이름);
    await t.waitForTimeout(250); await t.click('[data-tab="' + 이름 + '"]'); await t.waitForTimeout(900);
  }
  const 시험행들 = () => t.evaluate(() => DEMO_HW.filter(시험인가_).map(h => h.행));

  console.log('\n— 선생님 화면에 「시험」 탭 —');
  확인('「시험」 탭이 「숙제 내주기」 바로 아래에', await t.evaluate(() => {
    var 칸들 = [].slice.call(document.querySelectorAll('[data-tab]')).map(b => b.dataset.tab);
    return 칸들[칸들.indexOf('hw') + 1];
  }), 'exam');

  console.log('\n— 숙제 탭에는 시험이 없다 —');
  await 탭가기('hw');
  const 시험들 = await 시험행들();
  확인('시험 줄은 숙제 탭에 안 나온다', await t.evaluate(rs => rs.filter(n => document.querySelector('.hwPick[data-row="' + n + '"]')).length, 시험들), 0);
  확인('숙제 탭 종류 고르개에 「시험」 이 없다', await t.locator('input[name=hwKind][value="시험"]').count(), 0);
  확인('숙제 탭 표에는 점수가 안 나온다', /\d+\s*점/.test(await t.locator('.tb').first().innerText()), false);

  console.log('\n— 시험 탭 —');
  await 탭가기('exam');
  확인('시험 줄이 시험 탭에 나온다', await t.evaluate(rs => rs.filter(n => document.querySelector('.hwPick[data-row="' + n + '"]')).length, 시험들), 시험들.length);
  확인('시험 탭엔 숙제 줄이 없다', await t.evaluate(() => [].slice.call(document.querySelectorAll('.hwPick')).every(c => {
    var h = DEMO_HW.filter(x => x.행 === Number(c.dataset.row))[0]; return 시험인가_(h); })), true);
  확인('시험 내는 칸 — 종류는 시험으로 못 박혀 있고 날짜·시간 칸이 바로 보인다',
    [await t.locator('input[name=hwKind]:checked').getAttribute('value'), await t.locator('#hwDueWrap').isVisible(), await t.locator('#hwTestWrap').isVisible(), await t.locator('#hwMemWrap').isVisible(), (await t.locator('#btnHwAdd').innerText()).trim()],
    ['시험', true, true, true, '시험 내기']);
  확인('평균 칸이 있다', (await t.locator('.tb thead').first().innerText()).indexOf('평균') > -1, true);
  await t.evaluate(() => { var h = T.data.숙제목록.filter(시험인가_)[0]; h.평균 = 88; drawTab(); });
  await t.waitForTimeout(300);
  확인('시험 탭에는 평균 점수가 나온다', /88점/.test(await t.locator('.tb').first().innerText()), true);
  확인('말은 「봤어요 · 안 봄」', /안 봄|다 봤어요/.test(await t.locator('.tb').first().innerText()), true);

  console.log('\n— 시험 내기 — 시험 탭에서만 —');
  const 전수 = await t.evaluate(() => DEMO_HW.filter(시험인가_).length);
  await t.selectOption('#hwBook', '예시 단어장'); await t.waitForTimeout(300);
  await t.evaluate(() => { DEMO_배정.forEach(x => { if (x.교재.indexOf('예시 단어장') < 0) x.교재.push('예시 단어장'); }); });
  await t.click('#btnHwAdd'); await t.waitForTimeout(1200);
  확인('시험 탭에서 내면 종류가 「시험」', [await t.evaluate(() => DEMO_HW[DEMO_HW.length - 1].종류), await t.evaluate(() => DEMO_HW.filter(시험인가_).length) - 전수], ['시험', 1]);

  console.log('\n— 시험 탭에서도 고르기 · 선택 삭제 —');
  const 지울 = await t.evaluate(() => DEMO_HW[DEMO_HW.length - 1].행);
  await t.check('.hwPick[data-row="' + 지울 + '"]'); await t.waitForTimeout(200);
  확인('선택 시간 바꾸기 · 선택 삭제가 켜진다', [await t.locator('.hwTimeSel[data-scope="now"]').isDisabled(), await t.locator('.hwDelSel[data-scope="now"]').isDisabled()], [false, false]);
  await t.click('.hwDelSel[data-scope="now"]'); await t.waitForTimeout(800);
  확인('시험 수가 되돌아온다', await t.evaluate(() => DEMO_HW.filter(시험인가_).length), 전수);

  console.log('\n— 왼쪽 배지 · 안 낸 숙제 수에 시험이 안 섞인다 —');
  await t.evaluate(() => {
    window.__보관 = T.data.숙제목록;
    T.data.숙제목록 = [1, 2, 3].map(i => ({ 행: 100 + i, 단어장: '예시 단어장', 시작: i, 끝: i + 5, 유형: '스펠링', 종류: '시험', 마감일: '2099-01-0' + i, 지남: false, 대상수: 2, 한사람: [], 안한사람: ['홍길동', '김영희'], 모자란사람: [] }));
    사이드배지();
  });
  확인('시험만 셋이고 숙제가 없으면 숙제 배지는 0 (숨김)', [await t.locator('#navHw').isVisible(), await t.locator('#navMiss').isVisible()], [false, false]);
  확인('시험 탭 배지 — 안 본 사람이 있는 시험 3', [await t.locator('#navExam').isVisible(), (await t.locator('#navExam').innerText()).trim()], [true, '3']);
  await 탭가기('sum');
  const 한눈 = await t.locator('#tBody').innerText();
  확인('「숙제 안 낸 학생」 에 안 본 시험이 안 들어간다', /숙제 안 낸 학생\s*0\s*명/.test(한눈), true);
  확인('안 본 시험은 따로 한 줄', /안 본 시험 3건/.test(한눈), true);
  await 탭가기('miss');
  확인('안 한 학생 탭도 숙제만 — 시험은 없다', /예시 단어장/.test(await t.locator('#tBody').innerText()) && await t.locator('#tBody .pill.siheom').count() > 0, false);

  console.log('\n— 종류가 빈 옛 숙제는 숙제 탭에 —');
  await t.evaluate(() => {
    T.data.숙제목록 = window.__보관.concat([{ 행: 999, 단어장: '예시 단어장', 시작: 7, 끝: 9, 유형: '스펠링', 종류: '', 마감일: '2099-12-31', 지남: false, 대상수: 1, 한사람: [], 안한사람: ['홍길동'], 모자란사람: [] }]);
    사이드배지();
  });
  await 탭가기('hw');
  확인('옛 숙제가 숙제 탭에 보인다', await t.locator('.hwPick[data-row="999"]').count(), 1);
  await 탭가기('exam');
  확인('시험 탭에는 안 보인다', await t.locator('.hwPick[data-row="999"]').count(), 0);

  /* ---------- 아이 화면 — 그대로 ---------- */
  console.log('\n— 아이 화면은 전과 똑같다 —');
  const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  p.on('pageerror', e => errs.push('ERR(아이) ' + e.message));
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동'); await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  if (await p.locator('#noti').isVisible()) await p.click('#notiOk');
  const 아이 = await p.evaluate(() => ({ 전체: S.숙제.length, 숙제: 숙제만_().length, 시험: 내시험들_().length,
    숙제에시험: 숙제만_().some(h => h.종류 === '시험'), 시험에숙제: 내시험들_().some(h => h.종류 !== '시험') }));
  확인('숙제 탭엔 시험이 없고, 시험 탭엔 시험만', [아이.숙제에시험, 아이.시험에숙제, 아이.숙제 + 아이.시험 === 아이.전체, 아이.시험 > 0], [false, false, true, true]);
  await p.click('[data-hbt="test"]'); await p.waitForTimeout(800);
  확인('시험 칸 카드 수 = 시험 수', await p.locator('.excard').count(), 아이.시험);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
