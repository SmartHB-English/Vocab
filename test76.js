/* 1단계 — 옛 단어장·옛 숙제·옛 기록이 안 깨졌다 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { chromium } = require('playwright');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 띄우기설정, 방법, 책고르기 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

/* ======================= Code.gs — 칸이 없는 옛 숙제 줄 ======================= */
const 칸 = { SpreadsheetApp: { flush() {} }, Logger: { log() {} }, console,
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  Utilities: { formatDate(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); } } };
vm.createContext(칸);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), 칸);
const 안Date = vm.runInContext('Date', 칸);
const 오늘 = new 안Date();
/* 숙제 시트 — 옛 줄은 11칸(칸 칸이 없다), 새 줄은 12칸 */
const 숙제줄 = [
  ['', '예시 단어장', 1, 10, '스펠링', 오늘, 오늘, '', '당일', '', 0],
  ['', '중2 7과', 1, 12, '빈칸 채우기', 오늘, 오늘, '', '당일', '', 0, '본문']
];
const 기록줄 = [
  [오늘, '', '홍길동', '예시 단어장', '1~10', '스펠링', 10, 9, 90, 0, 0, 0, 'O', '', '숙제', ''],
  [오늘, '', '홍길동', '중2 7과', '단어 1~12', '스펠링', 12, 12, 100, 0, 0, 0, 'O', '', '숙제', '']
];
칸.rows_ = name => (name === '숙제' ? 숙제줄 : name === '기록' ? 기록줄 : []).map(x => x.slice());
칸.단어장목록 = () => [{ 이름: '예시 단어장', 개수: 25, 종류: '', 색: '' }, { 이름: '중2 7과', 개수: 40, 종류: '과', 색: '' }];
칸.교재맵_ = () => ({ 홍길동: ['예시 단어장', '중2 7과'] });
칸.반별명단_ = () => ({});
칸.내숙제인가_ = () => true;
칸.합격점_ = () => 80;
const 받은 = 칸.숙제가져오기('홍길동');
console.log('— 숙제가져오기 —');
확인('옛 숙제(칸 없음)도 나온다', 받은.map(h => h.단어장), ['예시 단어장', '중2 7과']);
확인('옛 숙제의 칸은 빈칸', 받은[0].칸, '');
확인('옛 숙제는 예전처럼 「1~10」 기록으로 낸 것이 된다', 받은[0].완료, true);
확인('과 숙제는 칸이 따라온다', 받은[1].칸, '본문');
확인('과 숙제는 「단어 1~12」 기록으로는 안 낸 것 (본문이 아니다)', 받은[1].완료, false);

console.log('\n— 이달 시상의 제출 셈 — 과 숙제는 구분 붙은 기록으로, 옛 숙제는 예전처럼 —');
칸.내숙제인가_ = () => true;
const 낸맵 = { 낸것: { '중2 7과|본문 1~12': { '2026-10-06': 90 }, '예시 단어장|1~10': { '2026-10-06': 85 } } };
const 셈 = 칸.제출현황_([
  { 단어장: '중2 7과', 칸: '본문', 시작: 1, 끝: 12, 종류: '기한', 등록: '2026-10-01', 마감: '2026-10-09' },
  { 단어장: '중2 7과', 칸: '문법', 시작: 1, 끝: 12, 종류: '기한', 등록: '2026-10-01', 마감: '2026-10-09' },
  { 단어장: '예시 단어장', 칸: '', 시작: 1, 끝: 10, 종류: '기한', 등록: '2026-10-01', 마감: '2026-10-09' }],
  ['홍길동'], { 홍길동: 낸맵 }, {}, {});
확인('본문 1~12 는 냈고 문법 1~12 는 안 냈다 — 옛 숙제도 냈다', [셈.홍길동.숙제수, 셈.홍길동.낸수], [3, 2]);

console.log('\n— 숙제를 고쳐 단어장을 바꾸면 칸도 맞춘다 —');
const 숙시트 = { 줄: [[], ['', '중2 7과', 1, 12, '빈칸 채우기', '2026-10-09', 오늘, '', '기한', '', 0, '본문']] };
숙시트.getLastRow = () => 숙시트.줄.length;
숙시트.getRange = (r, c, nr, nc) => ({
  getValues: () => [숙시트.줄[r - 1].slice(c - 1, c - 1 + (nc || 1))],
  setValues(v) { v[0].forEach((x, i) => { 숙시트.줄[r - 1][c - 1 + i] = x; }); return this; },
  setValue(x) { 숙시트.줄[r - 1][c - 1] = x; return this; }
});
칸.sheet_ = () => 숙시트;
칸.숙제칸확보_ = () => 숙시트;
칸.전체숙제 = () => [];
칸.선생님확인_ = () => true;
칸.단어장찾기_ = 이름 => ({ 이름, 종류: 이름 === '중2 7과' ? '과' : '' });
칸.숙제수정('1234', 2, { 단어장: '예시 단어장', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '기한', 마감일: '2026-10-09' });
확인('옛 단어장으로 바꾸면 칸은 빈칸', 숙시트.줄[1][11], '');
칸.숙제수정('1234', 2, { 단어장: '중2 7과', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '기한', 마감일: '2026-10-09' });
확인('과로 바꾸면 단어', 숙시트.줄[1][11], '단어');
칸.숙제수정('1234', 2, { 단어장: '중2 7과', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '기한', 마감일: '2026-10-09' });
확인('단어장을 안 바꾸면 칸은 그대로', 숙시트.줄[1][11], '단어');

/* ======================= 화면 ======================= */
(async () => {
  const b = await chromium.launch(띄우기설정);
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동'); await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  if (await p.locator('#noti').isVisible()) await p.click('#notiOk');

  console.log('\n— 종류 빈칸 단어장 — 스펠링이 지금처럼 —');
  await 방법(p, 'spell');
  확인('시험지가 열린다', await p.evaluate(() => 지금화면_()), 'sheet');
  확인('예시 단어장', await p.evaluate(() => [S.단어장, S.종류, 지금칸_()]), ['예시 단어장', '', '단어']);
  확인('구분 줄은 안 보인다', await p.locator('#bkKan').isVisible(), false);
  const 정답 = await p.evaluate(() => S.문제.map(w => w.en));
  const 칸들 = p.locator('#shList .sin');
  for (let i = 0; i < 정답.length; i++) await 칸들.nth(i).fill(정답[i]);
  await p.click('#shSubmit'); await p.waitForTimeout(900);
  /* 결과의 점수 글자는 올라가며 세는 움직임이 있다 — 채점 값으로 본다 */
  확인('다 맞히면 다 맞음', await p.evaluate(() => [S.정답수, S.문제.length, S.오답.length]), [정답.length, 정답.length, 0]);
  확인('기록 범위는 예전처럼 구분 없이', await p.evaluate(() => /^\d+~\d+$/.test(S.범위)), true);
  await p.click('#s-result [data-back]'); await p.waitForTimeout(600);

  console.log('\n— 3단변화 단어장 — 세 칸으로 —');
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(500);
  await 책고르기(p, '불규칙 동사 50');
  await 방법(p, 'verb', 1200);
  확인('세 칸 화면', await p.evaluate(() => 지금화면_()), 'verb');
  확인('원형·과거·과거분사 칸', await p.locator('#vBase, #vPast, #vPp').count(), 3);
  확인('지금칸_ 은 3단변화', await p.evaluate(() => [삼단변화(), 지금칸_()]), [true, '3단변화']);
  await p.click('#s-verb [data-back]'); await p.waitForTimeout(600);

  console.log('\n— 본문·문법 옛 단어장도 그대로 —');
  확인('옛 본문 단어장은 본문칸', await p.evaluate(() => { const 전 = S.종류; S.종류 = '본문'; const r = [본문책(), 문법책(), 지금칸_()]; S.종류 = 전; return r; }), [true, false, '본문']);
  확인('옛 문법 단어장은 문법칸', await p.evaluate(() => { const 전 = S.종류; S.종류 = '문법'; const r = [본문책(), 문법책(), 지금칸_()]; S.종류 = 전; return r; }), [true, true, '문법']);

  console.log('\n— 칸이 빈 옛 숙제가 지금처럼 열린다 —');
  await p.click('[data-hbt="hw"]'); await p.waitForTimeout(600);
  const 옛 = await p.evaluate(() => S.숙제.findIndex(h => !h.칸 && h.단어장 === '예시 단어장' && !h.완료 && h.종류 !== '시험' && /스펠/.test(h.유형)));
  await p.click('#hwBox [data-hw="' + 옛 + '"]'); await p.waitForTimeout(1800);
  확인('시험지가 열린다', await p.evaluate(() => 지금화면_()), 'sheet');
  확인('구분 없이 그 숙제 범위로', await p.evaluate(() => [S.칸 || '', S.범위]),
    await p.evaluate(i => ['', S.숙제[i].시작 + '~' + S.숙제[i].끝], 옛));
  확인('그 범위 단어 수만큼', await p.locator('#shList .qrow').count(),
    await p.evaluate(i => S.숙제[i].끝 - S.숙제[i].시작 + 1, 옛));

  console.log('\n— 과 단어장도 같이 있을 때 — 선생님 숙제 표 · 게임 · 시험지 —');
  확인('본문 1~12 와 문법 1~12 는 다른 줄 (칸이 열쇠에)', await p.evaluate(() => 숙제묶기([
    { 단어장: '중2 7과', 칸: '본문', 시작: 1, 끝: 12, 유형: '빈칸 채우기', 종류: '당일', 행: 2 },
    { 단어장: '중2 7과', 칸: '문법', 시작: 1, 끝: 12, 유형: '빈칸 채우기', 종류: '당일', 행: 3 }]).map(g => g.칸 + ':' + g.행들.join(','))), ['본문:2', '문법:3']);
  확인('옛 숙제는 예전처럼 한 줄로 묶인다', await p.evaluate(() => 숙제묶기([
    { 단어장: '예시 단어장', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '당일', 행: 2 },
    { 단어장: '예시 단어장', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '당일', 행: 3 }]).length), 1);
  확인('게임·시험지는 과 단어장의 단어만', await p.evaluate(() => 종이단어_(DEMO.단어가져오기('중2 7과')).every(w => w.칸 === '단어')), true);
  확인('옛 단어장은 그대로', await p.evaluate(() => 종이단어_(DEMO.단어가져오기('예시 단어장')).length === DEMO.단어가져오기('예시 단어장').length), true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
