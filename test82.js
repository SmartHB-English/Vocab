/* 선생님 화면 속도 — 기록은 끝에서부터 덩이로 · 메모는 안 읽는다 · 기본/기록 둘로 · 90초 담아 두기 · 기록메모
   고치기 전 Code.gs(백업)와 같은 자료로 집계가 같은지 맞대 본다 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { chromium } = require('playwright');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 띄우기설정 } = require('./도구');
const 옛코드 = path.join(__dirname, '백업', 'v2026-10-06k_선생님속도', 'Code.고치기전.gs');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  const 짧게 = v => { const g = JSON.stringify(v); return g && g.length > 300 ? g.slice(0, 300) + '… (' + g.length + '자)' : g; };
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + 짧게(실제) +
    (ok ? '' : '  (기대: ' + 짧게(기대) + ')'));
}

/* ---------- 흉내 자료 — 같은 씨앗이면 같은 기록 ---------- */
function 난수(씨) { return () => { 씨 = (씨 * 1103515245 + 12345) % 2147483648; return 씨 / 2147483648; }; }
const 지금고정 = Date.now();          // 옛·새 판이 같은 기록을 갖게 — 시각을 하나로
const 이름들 = ['홍길동', '김영희', '이철수', '박하늘'];
const 단어들 = ['apple', 'bee', 'cat', 'dog', 'egg', 'fig', 'gum', 'hat', 'ink', 'jam', 'kite', 'lion'];
/* 기록 줄 [때, 반, 이름, 단어장, 범위, 유형, 문항, 정답, 점수, 게임, 콤보, 초, 숙제, 틀린(요약), 구분, 제외] + 메모 */
function 기록만들기(D, 몇, 옵션) {
  옵션 = 옵션 || {};
  const r = 난수(옵션.씨 || 7), 지금 = 지금고정, 줄들 = [];
  for (let i = 0; i < 몇; i++) {
    const 전 = (몇 - i) * (옵션.간격분 || 17);            // 맨 끝이 가장 최근 — 날짜순
    const 틀린수 = Math.floor(r() * (옵션.긴것 ? 9 : 5)); // 긴것이면 다섯 개 넘는 것도
    const 고른 = []; for (let k = 0; k < 틀린수; k++) { const w = 단어들[Math.floor(r() * 단어들.length)]; if (고른.indexOf(w) < 0) 고른.push(w); }
    const 요약 = 고른.length > 5 ? 고른.slice(0, 5).join(', ') + '  …외 ' + (고른.length - 5) + '개' : 고른.join(', ');
    const 구분 = ['숙제', '숙제', '숙제', '보충', '시험', '오답 재시험'][Math.floor(r() * 6)];
    const 줄 = [new D(지금 - 전 * 60000), '', 이름들[Math.floor(r() * 이름들.length)], '예시 단어장', '1~10', '스펠링',
      10, 10 - 고른.length, (10 - 고른.length) * 10, 0, 0, 30 + Math.floor(r() * 200), 구분 === '오답 재시험' ? '' : 'O', 요약, 구분,
      r() < 0.05 ? 'O' : ''];
    if (i % 997 === 3) 줄[0] = '';                           // 날짜가 빈 옛 줄
    줄.메모 = 고른.length ? '틀린 단어 ' + 고른.length + '개\n\n' + 고른.join('\n') : '';
    if (i % 1301 === 5) { 줄.length = 13; 줄.메모 = ''; }       // 칸이 모자란 옛 줄 (틀린 단어 칸이 생기기 전 — 메모도 없다)
    줄들.push(줄);
  }
  return 줄들;
}
function 기록시트(줄들, 셈, 넓이) {
  return {
    getLastRow: () => 줄들.length + 1,
    getLastColumn: () => 넓이 || 16,
    getMaxColumns: () => 넓이 || 16,
    getRange(r, c, nr, nc) { nr = nr || 1; nc = nc || 1; return {
      getValues() { 셈.values++; 셈.칸 += nr * nc; return 줄들.slice(r - 2, r - 2 + nr).map(x => { const y = x.slice(c - 1, c - 1 + nc); while (y.length < nc) y.push(''); return y; }); },
      getNotes() { 셈.notes++; 셈.메모칸 += nr * nc; return 줄들.slice(r - 2, r - 2 + nr).map(x => { const y = []; for (let j = 0; j < nc; j++) y.push(c + j === 14 ? (x.메모 || '') : ''); return y; }); },
      getValue() { return (줄들[r - 2] || [])[c - 1]; },
      getNote() { return c === 14 ? ((줄들[r - 2] || {}).메모 || '') : ''; },
      setValue() { 셈.쓰기++; return this; }, setFontWeight() { 셈.쓰기++; return this; }, setBackground() { 셈.쓰기++; return this; } }; },
    insertColumnsAfter() { 셈.쓰기++; }, setColumnWidth() { 셈.쓰기++; }
  };
}
function 캐시흉내() {
  const m = new Map();
  return { m, get: k => (m.has(k) ? m.get(k) : null), put: (k, v) => m.set(k, v), remove: k => m.delete(k), removeAll: ks => ks.forEach(k => m.delete(k)) };
}
const 학생줄 = [['', '홍길동', '1234', '초중등', '', '중2', '인왕중', '예시 단어장'], ['', '김영희', '1234', '초중등', '', '중2', '인왕중', '예시 단어장'],
  ['', '이철수', '1234', '고등', '', '고3', '한성고', '예시 단어장'], ['', '박하늘', '1234', '초중등', '', '중1', '인왕중', '예시 단어장'],
  ['', '최새봄', '1234', '초중등', '', '중1', '인왕중', '예시 단어장']];   // 최새봄 — 기록이 없다 (미응시)
function 판만들기(코드, 캐시) {
  const 칸 = { SpreadsheetApp: { flush() {} }, Logger: { log() {} }, console,
    Session: { getScriptTimeZone: () => 'Asia/Seoul' },
    CacheService: { getScriptCache: () => 캐시 },
    Utilities: { formatDate(d) { const p = n => String(n).padStart(2, '0'); return (d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + '|' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); } } };
  vm.createContext(칸);
  vm.runInContext(fs.readFileSync(코드, 'utf8'), 칸);
  /* ymd_ 는 formatDate 의 날짜 쪽만 */
  칸.ymd_ = d => 칸.Utilities.formatDate(d).split('|')[1];
  칸.rows_ = name => (name === '학생' ? 학생줄.map(x => x.slice()) : []);
  칸.선생님확인_ = () => true;
  칸.단어장목록 = () => [{ 이름: '예시 단어장', 개수: 12 }];
  칸.기록칸확보_ = () => null;     // 옛 코드가 부른다 — 진짜 시트를 만지므로 흉내만
  const D = vm.runInContext('Date', 칸);
  const 지난 = n => { const d = new D(); d.setDate(d.getDate() - n); return 칸.ymd_(d); };
  /* 마감이 지났는데 안 한 숙제 — 학생별 평균에 0점으로 들어간다 */
  칸.전체숙제 = () => [{ 행: 2, 단어장: '예시 단어장', 종류: '기한', 마감일: 지난(2), 안한사람: ['박하늘', '홍길동'], 모자란사람: ['홍길동'], 한사람: [] }];
  return { 칸, D };
}
function 같게(r) {  // 비교할 수 있게 — 교재·줄·틀린단어는 따로 본다
  return {
    시험목록: r.시험목록.map(t => { const x = Object.assign({}, t); delete x.교재; delete x.줄; delete x.틀린단어; delete x.틀린더; return x; }),
    학생별: r.학생별.map(v => { const x = Object.assign({}, v); delete x.교재; return x; }),
    미응시: r.미응시, 오답: r.오답
  };
}

/* ======================= Code.gs ======================= */
console.log('— 기록 5000줄 · 7일치는 맨 끝 몇백 줄 —');
const 옛 = 판만들기(옛코드, null), 새 = 판만들기(path.join(__dirname, 'Code.gs'), 캐시흉내());
const 옛셈 = { values: 0, notes: 0, 칸: 0, 메모칸: 0, 쓰기: 0 }, 새셈 = { values: 0, notes: 0, 칸: 0, 메모칸: 0, 쓰기: 0 };
옛.칸.sheet_ = () => 기록시트(기록만들기(옛.D, 5000), 옛셈);
const 새기록 = 기록만들기(새.D, 5000);
새.칸.sheet_ = () => 기록시트(새기록, 새셈);
const 전 = 옛.칸.선생님요약('1234', 7);
const 후 = 새.칸.선생님기록('1234', 7);
console.log('  고치기 전: getValues ' + 옛셈.values + '번 (' + 옛셈.칸 + '칸) · getNotes ' + 옛셈.notes + '번 (' + 옛셈.메모칸 + '칸)');
console.log('  고친 뒤  : getValues ' + 새셈.values + '번 (' + 새셈.칸 + '칸) · getNotes ' + 새셈.notes + '번 (' + 새셈.메모칸 + '칸)');
확인('7일치 기록이 있다', 후.시험목록.length > 100, true);
확인('끝에서 한 덩이(1000줄)만 읽는다 — getValues 1번', 새셈.values, 1);
확인('읽은 칸 수가 훨씬 적다 (전체의 1/4 아래)', 새셈.칸 < 옛셈.칸 / 4, true);
확인('getNotes 0번 (다섯 개 넘는 기록이 없으면)', 새셈.notes, 0);
확인('읽는 길에서 시트에 쓰지 않는다', 새셈.쓰기, 0);
확인('고치기 전과 집계가 같다 — 시험목록·학생별·미응시·오답', 같게(후), 같게(전));
확인('틀린 단어는 앞 다섯 개까지만', 후.시험목록.every(t => t.틀린단어.split(',').filter(String).length <= 5), true);
확인('교재는 줄마다가 아니라 표로 한 번', [후.시험목록.some(t => 't.교재' in t || t.교재), 후.교재맵['홍길동']], [false, ['예시 단어장']]);
확인('줄번호가 실려 간다 (기록메모 용)', 후.시험목록.every(t => t.줄 >= 2), true);

console.log('\n— 틀린 단어가 다섯 개 넘는 기록 — 오답 순위는 예전처럼 전문으로 —');
옛셈.notes = 새셈.notes = 0; 옛셈.메모칸 = 새셈.메모칸 = 0; 새셈.values = 0;
옛.칸.sheet_ = () => 기록시트(기록만들기(옛.D, 3000, { 긴것: true, 씨: 11 }), 옛셈);
새.칸.sheet_ = () => 기록시트(기록만들기(새.D, 3000, { 긴것: true, 씨: 11 }), 새셈);
const 전2 = 옛.칸.선생님요약('1234', 7), 후2 = 새.칸.선생님요약('1234', 7);
확인('오답 순위가 같다', 후2.오답, 전2.오답);
확인('학생별 평균이 같다', 같게(후2).학생별, 같게(전2).학생별);
확인('메모는 N열 한 칸 너비로 한 번만', [새셈.notes, 새셈.메모칸 < 옛셈.메모칸 / 10], [1, true]);
console.log('  메모 칸 — 고치기 전 ' + 옛셈.메모칸 + ' · 고친 뒤 ' + 새셈.메모칸);
확인('선생님요약은 옛 꼴 그대로 (줄마다 교재)', [Array.isArray(후2.시험목록[0].교재), '숙제목록' in 후2, '단어장목록' in 후2], [true, true, true]);

console.log('\n— 「기록을 단어장별로 묶기」 로 날짜순이 깨진 시트 — 통째로 읽어 놓치지 않는다 —');
const 섞음 = 기록만들기(새.D, 2500, { 씨: 5 });
섞음.sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));   // 이름순으로 묶어 버린다
const 옛섞음 = 기록만들기(옛.D, 2500, { 씨: 5 }); 옛섞음.sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));
옛.칸.sheet_ = () => 기록시트(옛섞음, 옛셈);
새셈.values = 0; 새.칸.sheet_ = () => 기록시트(섞음, 새셈);
const 캐시 = 새.칸.CacheService.getScriptCache(); 캐시.m.clear();
확인('집계가 같다', 같게(새.칸.선생님기록('1234', 7)), 같게(옛.칸.선생님요약('1234', 7)));

console.log('\n— 칸이 모자란 옛 시트 — 터지지 않고 빈 값으로 —');
캐시.m.clear();
const 좁은셈 = { values: 0, notes: 0, 칸: 0, 메모칸: 0, 쓰기: 0 };
새.칸.sheet_ = () => 기록시트(기록만들기(새.D, 300).map(x => x.slice(0, 13)), 좁은셈, 13);
let 좁은 = null;
try { 좁은 = 새.칸.선생님기록('1234', 7); } catch (e) { 좁은 = { 오류: e.message }; }
확인('13칸짜리 시트도 읽는다 · 쓰지 않는다', [!!(좁은 && 좁은.ok), 좁은셈.쓰기], [true, 0]);

console.log('\n— 90초 담아 두기 —');
캐시.m.clear(); 새셈.values = 0;
새.칸.sheet_ = () => 기록시트(새기록, 새셈);
새.칸.선생님기록('1234', 7);
const 처음읽음 = 새셈.values;
새.칸.선생님기록('1234', 7);
확인('두 번째는 담아 둔 것 — 시트를 안 읽는다', 새셈.values, 처음읽음);
확인('열쇠에 일수가 들어간다', [...캐시.m.keys()].filter(k => /^선생님기록\|\d+$/.test(k)), ['선생님기록|7']);
확인('7일치(100KB 넘음)는 조각으로 나눠 담는다', /^#\d+$/.test(String(캐시.m.get('선생님기록|7'))), true);
확인('조각으로 담겼다가 그대로 읽힌다', JSON.stringify(새.칸.캐시읽기_('선생님기록|7')) === JSON.stringify(새.칸.기록분석_(7, 새.칸.전체숙제())), true);
새.칸.ContentService = { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } };
const 부르기 = (fn, args) => 새.칸.doPost({ postData: { contents: JSON.stringify({ fn, args: args || [] }) } });
['결과저장', '숙제등록', '숙제수정', '숙제삭제', '수업내주기'].forEach(fn => {
  새.칸.선생님기록('1234', 7);
  새.칸.열린기능_[fn] = () => ({ ok: true });       // 진짜 시트 대신 — 창구가 캐시를 버리는지만 본다
  부르기(fn);
  확인(fn + ' 이 돌면 캐시를 버린다', 캐시.m.has('선생님기록|7'), false);
});
새.칸.선생님기록('1234', 7);
부르기('선생님기본', ['1234']);
확인('읽기만 하는 기능은 안 버린다', 캐시.m.has('선생님기록|7'), true);
캐시.m.clear();
const 작은 = 새.칸.캐시담기_('작은것', { 글: 'ㄱ'.repeat(1000) }, 90);
확인('작으면 한 칸에', [작은, String(캐시.m.get('작은것')).charAt(0)], [true, '{']);
const 큰 = 새.칸.캐시담기_('큰것', { 글: 'ㄱ'.repeat(700000) }, 90);
확인('너무 크면(20조각 넘게) 담지 않는다', [큰, 캐시.m.has('큰것')], [false, false]);

console.log('\n— 기록메모 — 그 한 줄의 메모만 —');
const 메모셈 = { values: 0, notes: 0, 칸: 0, 메모칸: 0, 쓰기: 0 };
const 메모기록 = 기록만들기(새.D, 50, { 긴것: true, 씨: 3 });
새.칸.sheet_ = () => 기록시트(메모기록, 메모셈);
const 긴줄 = 메모기록.findIndex(x => x[0] instanceof 새.D && (x.메모.match(/\n/g) || []).length > 6);
const 키 = 메모기록[긴줄][0].getTime();
let m = 새.칸.기록메모('1234', 긴줄 + 2, 키);
확인('전문을 가져온다', m.틀린, 메모기록[긴줄].메모.split('\n').slice(2));
확인('메모를 통째로 읽지 않는다', 메모셈.notes, 0);
메모기록.splice(0, 3);                                          // 앞의 기록을 정리해서 줄이 밀렸다
m = 새.칸.기록메모('1234', 긴줄 + 2, 키);
확인('줄이 밀렸으면 시각으로 다시 찾는다', [m.ok, m.줄], [true, 긴줄 - 1]);
확인('없는 기록이면 알려 준다', 새.칸.기록메모('1234', 2, 123).ok, false);

/* ======================= 화면 ======================= */
(async () => {
  const b = await chromium.launch(띄우기설정);
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const t = await ctx.newPage();
  const errs = [];
  t.on('pageerror', e => errs.push('ERR ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소); await t.waitForTimeout(400);
  /* 기록을 일부러 늦게 — 손으로 풀어 줄 때까지 */
  await t.evaluate(() => {
    window.__부른것 = [];
    const 원래 = window.api;
    window.api = function (이름) {
      window.__부른것.push(이름);
      if (이름 === '선생님기록' && !window.__기록바로) {
        const 인자 = arguments;
        return new Promise(res => { window.__기록풀기 = () => 원래.apply(null, 인자).then(res); });
      }
      return 원래.apply(null, arguments);
    };
  });
  await t.click('#btnTeacherGo'); await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  async function 탭가기(이름) {
    await t.evaluate(n => { var b = document.querySelector('[data-tab="' + n + '"]'); var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]'); if (g) g.click(); }, 이름);
    await t.waitForTimeout(250); await t.click('[data-tab="' + 이름 + '"]'); await t.waitForTimeout(600);
  }

  console.log('\n— 기본만으로 숙제 탭이 다 그려진다 —');
  확인('둘을 같이 띄운다 (요약 한 번이 아니라)', await t.evaluate(() => window.__부른것.filter(x => /^선생님/.test(x)).sort()), ['선생님기록', '선생님기본', '선생님로그인']);
  확인('첫 탭(학생 한 명씩)은 기록을 기다리며 뼈대', [await t.locator('#tBody .tskl .skl').count() > 0, /불러오는 중/.test(await t.locator('#tBody').innerText())], [true, false]);
  await 탭가기('hw');
  확인('숙제 탭 — 내주기 칸 · 목록이 다 있다', [await t.locator('#btnHwAdd').count(), await t.locator('.hwrow').count() > 3, await t.locator('#tBody .tskl').count()], [1, true, 0]);
  await t.fill('#lsName', '기다리는 중에 적은 이름');
  await t.evaluate(() => { window.__표시 = document.querySelector('#tBody > *'); });

  console.log('\n— 기록이 늦게 와도 숙제 탭이 안 지워진다 —');
  await t.evaluate(() => window.__기록풀기()); await t.waitForTimeout(600);
  확인('적던 글이 그대로 (다시 안 그렸다)', [await t.inputValue('#lsName'), await t.evaluate(() => window.__표시 === document.querySelector('#tBody > *'))], ['기다리는 중에 적은 이름', true]);
  확인('기록은 붙어 있다', await t.evaluate(() => [T.data.기록옴, T.data.시험목록.length > 0]), [true, true]);

  console.log('\n— 기록이 오면 기록 쓰는 자리만 채워진다 —');
  await t.evaluate(() => { window.__부른것 = []; loadTeacher(); });
  await t.waitForTimeout(500);
  await 탭가기('today');
  확인('시험 결과 탭 — 기록이 오기 전엔 뼈대', await t.locator('#tBody .tskl').count(), 1);
  await t.evaluate(() => window.__기록풀기()); await t.waitForTimeout(600);
  확인('오면 표가 채워진다', [await t.locator('#tBody .tskl').count(), await t.locator('#tBody tr[data-rk]').count()], [0, 4]);
  확인('교재 칸이 다시 붙어 있다', await t.evaluate(() => T.data.시험목록.every(x => Array.isArray(x.교재))), true);

  console.log('\n— 기록 한 줄을 누르면 기록메모로 전문을 —');
  await t.evaluate(() => { window.__기록바로 = true; window.__부른것 = []; });
  const 긴키 = await t.evaluate(() => T.data.시험목록.filter(x => x.틀린더 > 0)[0].키);
  확인('요약에는 다섯 개만', await t.evaluate(k => T.data.시험목록.filter(x => x.키 === k)[0].틀린단어.split(',').length, 긴키), 5);
  await t.click('tr[data-rk="' + 긴키 + '"] td.name'); await t.waitForTimeout(800);
  const 펼친 = (await t.locator('.wmemo[data-memo="' + 긴키 + '"]').innerText()).replace(/\s+/g, ' ').trim();
  확인('전문이 보인다', 펼친, '틀린 단어 6개 acquire, alter, assess, compensate, distinguish, restrict');
  확인('기록메모를 한 번 불렀다', await t.evaluate(() => window.__부른것.filter(x => x === '기록메모').length), 1);
  await t.click('tr[data-rk="' + 긴키 + '"] td.name'); await t.waitForTimeout(300);
  await t.click('tr[data-rk="' + 긴키 + '"] td.name'); await t.waitForTimeout(500);
  확인('한 번 가져온 것은 들고 있는다', await t.evaluate(() => window.__부른것.filter(x => x === '기록메모').length), 1);
  await t.click('tr[data-rk="1"] .rowchk'); await t.waitForTimeout(200);
  확인('고르기 네모칸은 펼치지 않는다', await t.locator('.wmemo[data-memo="1"]').count(), 0);
  await t.click('tr[data-rk="3"] .rowchk'); await t.waitForTimeout(200);
  await t.click('tr[data-rk="' + 긴키 + '"] td.name'); await t.waitForTimeout(400);
  확인('다른 줄을 펼쳐도 고른 것은 남는다', [await t.locator('tr[data-rk="1"] .rowchk').isChecked(), await t.locator('tr[data-rk="3"] .rowchk').isChecked(), (await t.locator('#cleanCnt').innerText()).trim()], [true, true, '2건 선택됨']);
  await t.check('#chkAll'); await t.waitForTimeout(200);
  확인('전체 선택 — 걸러진 기록 전부', (await t.locator('#cleanCnt').innerText()).trim(), '4건 선택됨');

  console.log('\n— 숫자는 그대로 — 오늘 한눈에 · 학생 한 명씩 —');
  await 탭가기('sum');
  const 한눈 = await t.locator('#tBody').innerText();
  확인('오늘 한눈에가 그려진다', [/오늘 한눈에/.test(한눈), await t.locator('#tBody .tskl').count()], [true, 0]);
  await 탭가기('people');
  확인('학생 한 명씩도', await t.locator('#tBody .tskl').count(), 0);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
