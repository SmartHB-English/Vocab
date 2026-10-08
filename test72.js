/* 과 묶음 — 과쪼개기_ · 과묶음_ · 단어장목록의 「과」 칸 · 선생님 목록과 아이 바텀시트를 과별로 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { chromium } = require('playwright');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 띄우기설정, 칸열기 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

/* ======================= Code.gs (브라우저 없이) ======================= */
const 칸 = { SpreadsheetApp: { flush() {} }, Logger: { log() {} }, console };
vm.createContext(칸);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), 칸);

console.log('— 과쪼개기_ —');
확인('중2 5과 단어 → 중2 5과 · 단어', 칸.과쪼개기_('중2 5과 단어', ''), { 과: '중2 5과', 어디: '단어' });
확인('중2 5과 본문 → 중2 5과 · 본문', 칸.과쪼개기_('중2 5과 본문', '본문'), { 과: '중2 5과', 어디: '본문' });
확인('중2 6과 문법 → 중2 6과 · 문법', 칸.과쪼개기_('중2 6과 문법', '문법'), { 과: '중2 6과', 어디: '문법' });
확인('어디는 종류로 — 이름이 「… 단어」 여도 종류가 본문이면 본문', 칸.과쪼개기_('중2 5과 단어', '본문').어디, '본문');
확인('3단변화도 꼬리말', 칸.과쪼개기_('중1 2과 3단변화', '3단변화'), { 과: '중1 2과', 어디: '3단변화' });
확인('SL VOCA 800-1 은 과 없음', 칸.과쪼개기_('SL VOCA 800-1', '').과, '');
확인('예시 단어장 은 과 없음 (꼬리말이 「단어장」)', 칸.과쪼개기_('예시 단어장', '').과, '');
확인('꼬리말만 있는 이름은 과 없음', 칸.과쪼개기_('단어', '').과, '');

console.log('\n— 과묶음_ —');
const 묶 = 칸.과묶음_([
  { 이름: '중2 5과 단어', 종류: '', 개수: 60 },
  { 이름: 'SL VOCA 800-1', 종류: '', 개수: 800 },
  { 이름: '중2 5과 본문', 종류: '본문', 개수: 12 },
  { 이름: '중2 5과 문법', 종류: '문법', 개수: 5 },
  { 이름: '중2 5과 단어2', 종류: '', 개수: 30 },
  { 이름: '중2 6과 문법', 종류: '문법', 개수: 8 }
]);
확인('세 단어장이 한 과로', 묶[0].과, '중2 5과');
확인('어디별 칸', Object.keys(묶[0].칸), ['단어', '본문', '문법']);
확인('같은 어디가 둘이면 둘 다 (먼저 나온 것이 앞)', 묶[0].칸.단어.map(x => x.이름), ['중2 5과 단어', '중2 5과 단어2']);
확인('개수가 따라온다', 묶[0].칸.본문, [{ 이름: '중2 5과 본문', 개수: 12 }]);
확인('SL VOCA 는 어느 과에도 없다', 묶.some(g => JSON.stringify(g).indexOf('SL VOCA') > -1), false);
확인('과는 처음 나온 차례', 묶.map(g => g.과), ['중2 5과', '중2 6과']);

console.log('\n— 단어장목록 시트의 「과」 칸 —');
/* [단어장, 종류, 시트이름, 색, 레슨묶음, 과] */
const 목록줄 = [
  ['중2 5과 단어', '', '', '', '', ''],
  ['옛 단어 모음', '', '', '', '', '중2 5과'],       // 이름 규칙에서 벗어난 옛 단어장을 손으로 묶는다
  ['중2 6과 단어', '', '', '', '', '특강 A'],         // 적혀 있으면 그게 이긴다
  ['SL VOCA 800-1', '', '', '', '']                   // 과 칸이 없는 옛 줄
];
칸.rows_ = name => (name === '단어장목록' ? 목록줄.map(x => x.slice()) : []);
칸.ss_ = () => ({ getSheetByName: () => null });
const 목 = 칸.단어장목록();
확인('줄마다 과가 붙는다', 목.map(b => b.과), ['중2 5과', '중2 5과', '특강 A', '']);
확인('줄마다 어디가 붙는다', 목.map(b => b.어디), ['단어', '단어', '단어', '단어']);
확인('과 칸에 값이 있으면 그게 이긴다', 칸.과묶음_(목).map(g => [g.과, g.칸.단어.map(x => x.이름)]),
  [['중2 5과', ['중2 5과 단어', '옛 단어 모음']], ['특강 A', ['중2 6과 단어']]]);
확인('과목록 — 과묶음_ 결과', 칸.과목록().과.map(g => g.과), ['중2 5과', '특강 A']);

console.log('\n— 「과」 칸 넓히기 —');
확인('머리글에 과', 칸.HEADERS.단어장목록.slice(-1)[0], '과');
const 흉내 = { getLastRow: () => 3, getRange: () => ({ getValues: () => [] }) };   // getMaxColumns 가 없는 시트
let 터짐 = '';
try { 칸.단어장목록칸확보_(흉내); } catch (e) { 터짐 = e.message; }
확인('getMaxColumns 없는 흉내 시트에서 안 터진다', 터짐, '');
let 넓힘 = 0, 쓴머리 = null;
const 머리 = ['단어장', '종류', '시트이름', '색', '레슨 몇 개씩'];
const 시트 = {
  getMaxColumns: () => 5, insertColumnsAfter: (a, n) => { 넓힘 = n; },
  getRange: () => ({ getValues: () => [머리.concat([''])], setValues(v) { 쓴머리 = v[0]; return this; } })
};
칸.단어장목록칸확보_(시트);
확인('칸이 모자라면 하나 넓힌다', 넓힘, 1);
확인('과 머리글을 붙인다', 쓴머리 && 쓴머리[5], '과');
확인('있던 머리글은 안 바꾼다', 쓴머리 && 쓴머리[4], '레슨 몇 개씩');

console.log('\n— 수업내주기 — 숙제 줄엔 실제 단어장 이름 —');
const 낸것 = [];
칸.선생님확인_ = () => true;
칸.숙제등록 = (비번, h) => { 낸것.push(h.단어장); return { ok: true }; };
칸.전체숙제 = () => [];
칸.CacheService = { getScriptCache: () => ({ remove() {} }) };
칸.수업내주기('1234', { 이름: '중2 5과 3회차', 단계: [
  { 단어장: '중2 5과 단어', 시작: 41, 끝: 60, 유형: '듣고 쓰기' },
  { 단어장: '중2 5과 본문', 시작: 1, 끝: 12, 유형: '빈칸 채우기' }] });
확인('과가 아니라 단어장 이름이 들어간다', 낸것, ['중2 5과 단어', '중2 5과 본문']);

/* ======================= 화면 ======================= */
(async () => {
  const b = await chromium.launch(띄우기설정);
  const errs = [];

  console.log('\n— 선생님 단어장 목록이 과별로 —');
  const t = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  t.on('pageerror', e => errs.push('ERR(선생님) ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소); await t.waitForTimeout(400);
  await t.click('#btnTeacherGo'); await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  await t.evaluate(() => {
    var b = document.querySelector('[data-tab="book"]');
    var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]');
    if (g) g.click();
  });
  await t.waitForTimeout(250);
  await t.click('[data-tab="book"]'); await t.waitForTimeout(800);
  const 줄 = await t.locator('.tb tbody tr').evaluateAll(rs => rs.map(r =>
    r.classList.contains('bkgrp') ? '# ' + r.textContent.trim() : r.dataset.book));
  console.log('  ' + 줄.join(' | '));
  /* 「중2 7과」 는 종류가 「과」 인 단어장 — 제 이름이 곧 과다 */
  확인('과 머리줄', 줄.filter(x => x[0] === '#'), ['# 중2 5과', '# 중2 6과', '# 중2 7과', '# 그 밖에']);
  확인('중2 5과 아래 단어·본문', 줄.slice(줄.indexOf('# 중2 5과') + 1, 줄.indexOf('# 중2 6과')), ['중2 5과 단어', '중2 5과 본문']);
  확인('묶이지 않은 것은 맨 아래 「그 밖에」', 줄.slice(줄.indexOf('# 그 밖에') + 1), ['예시 단어장', '불규칙 동사 50']);
  확인('단어장 줄은 그대로 눌린다', await t.locator('.bkrow').count(), await t.evaluate(() => DEMO.선생님요약().단어장목록.length));
  await t.locator('.bkrow[data-book="중2 5과 본문"]').click(); await t.waitForTimeout(600);
  확인('누르면 그 단어장이 열린다', await t.evaluate(() => T.책), '중2 5과 본문');

  console.log('\n— 아이 단어장 바텀시트도 과별로 —');
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  p.on('pageerror', e => errs.push('ERR(아이) ' + e.message));
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '이철수'); await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  if (await p.locator('#noti').isVisible()) await p.click('#notiOk');
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(700);
  await 칸열기(p);
  const 칩줄 = await p.locator('#bookChips > *').evaluateAll(es => es.map(e =>
    e.classList.contains('bkgh') ? '# ' + e.textContent.trim() : e.dataset.bk));
  console.log('  ' + 칩줄.join(' | '));
  확인('과 이름 머리줄이 끼어 있다', 칩줄.filter(x => x[0] === '#'), ['# 중2 5과', '# 그 밖에']);
  확인('[data-bk] 단추는 그대로', await p.locator('#bookChips [data-bk]').evaluateAll(es => es.map(e => e.tagName + ':' + e.dataset.bk)),
    ['BUTTON:중2 5과 본문', 'BUTTON:불규칙 동사 50']);
  await p.click('[data-bk="중2 5과 본문"]'); await p.waitForTimeout(900);
  확인('[data-bk] 를 누르면 그 단어장으로', await p.evaluate(() => S.단어장), '중2 5과 본문');

  console.log('\n— 단어장이 많아 고르개로 고를 때도 과별로 —');
  const q = await b.newPage({ viewport: { width: 420, height: 900 } });
  q.on('pageerror', e => errs.push('ERR(아이2) ' + e.message));
  await q.goto(앱주소); await q.waitForTimeout(400);
  await q.evaluate(() => { DEMO_배정.forEach(x => { if (x.이름 === '김영희') x.교재 = []; }); });
  await q.fill('#inPw', '1234'); await q.fill('#inName', '김영희'); await q.click('#btnLogin');
  await q.waitForTimeout(1800);
  const 묶음 = await q.locator('#selBook optgroup').evaluateAll(gs => gs.map(g => g.label + ':' + g.children.length));
  console.log('  ' + 묶음.join(' / '));
  확인('optgroup 으로 과별로', 묶음.map(x => x.split(':')[0]), ['중2 5과', '중2 6과', '중2 7과', '그 밖에']);
  확인('단어장은 다 있다', await q.locator('#selBook option').count(), await q.evaluate(() => 내책들().length));

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
