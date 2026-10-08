/* 숙제 내기·지우기 — 기록 시트를 통째로 다시 읽지 않는다 · 바뀐 줄만 돌려준다 · 지우면 줄번호를 당긴다
   · 여러 줄은 deleteRows 로 묶어서 · 누르면 바로 사라지고 실패하면 돌아온다
   고치기 전 Code.gs(백업)와 같은 자료로 숙제 목록 숫자가 같은지, 시트를 몇 번 읽는지 맞대 본다 */
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
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + 짧게(실제) + (ok ? '' : '  (기대: ' + 짧게(기대) + ')'));
}

/* ---------- 흉내 스프레드시트 — 시트마다 읽은 횟수를 센다 ---------- */
function 시트(줄들, 셈) {   // 줄들[0] 은 머리글
  const 넓이 = () => Math.max(...줄들.map(x => x.length));
  const 줄 = r => (줄들[r - 1] = 줄들[r - 1] || []);
  return { 줄들, 셈,
    getLastRow: () => 줄들.length, getLastColumn: () => 넓이(), getMaxColumns: () => 넓이(),
    getName: () => '', insertColumnsAfter() {}, setFrozenRows() {}, setColumnWidth() {},
    deleteRow(n) { 셈.deleteRow++; 줄들.splice(n - 1, 1); },
    deleteRows(n, k) { 셈.deleteRows++; 줄들.splice(n - 1, k); },
    appendRow(v) { 줄들.push(v.slice()); },
    getRange(r, c, nr, nc) { nr = nr || 1; nc = nc || 1; return {
      getValues() { 셈.values++; 셈.칸 += nr * nc; const o = []; for (let i = 0; i < nr; i++) { const x = 줄들[r - 1 + i] || []; const y = []; for (let j = 0; j < nc; j++) y.push(x[c - 1 + j] === undefined ? '' : x[c - 1 + j]); o.push(y); } return o; },
      getNotes() { 셈.notes++; const o = []; for (let i = 0; i < nr; i++) { const y = []; for (let j = 0; j < nc; j++) y.push(c + j === 14 ? ((줄들[r - 1 + i] || {}).메모 || '') : ''); o.push(y); } return o; },
      getValue() { const x = 줄들[r - 1] || []; return x[c - 1] === undefined ? '' : x[c - 1]; },
      getNote() { return c === 14 ? ((줄들[r - 1] || {}).메모 || '') : ''; },
      setValue(v) { 줄(r)[c - 1] = v; return this; },
      setValues(v) { v.forEach((x, i) => x.forEach((y, j) => { 줄(r + i)[c - 1 + j] = y; })); return this; },
      setFontWeight() { return this; }, setBackground() { return this; }, setNumberFormat() { return this; },
      setWrapStrategy() { return this; }, setVerticalAlignment() { return this; }, setNote() { return this; } }; } };
}
const 지금고정 = Date.now();
function 자료(D) {
  const 오늘 = new D(지금고정), 전 = 분 => new D(지금고정 - 분 * 60000);
  const 기록 = [['때']];
  for (let i = 0; i < 3000; i++) {
    const 이름 = ['홍길동', '김영희', '이철수'][i % 3], 범위 = ['1~10', '11~20', '21~25'][i % 3];
    const 틀 = i % 4 === 0 ? 'apple, bee, cat, dog, egg  …외 2개' : (i % 4 === 1 ? 'fig' : '');
    const x = [전((3000 - i) * 23), '', 이름, '예시 단어장', 범위, '스펠링', 10, 8, 50 + (i * 7) % 51, 0, 0, 60, 'O', 틀, i % 9 === 0 ? '오답 재시험' : '숙제', ''];
    if (틀) x.메모 = '틀린 단어 ' + (틀.indexOf('외') > -1 ? 7 : 1) + '개\n\n' + (틀.indexOf('외') > -1 ? 'apple\nbee\ncat\ndog\negg\nfig\ngum' : 'fig');
    기록.push(x);
  }
  기록.push([new D(지금고정 - 10 * 60000), '', '홍길동', '예시 단어장', '1~10', '스펠링', 10, 9, 90, 0, 0, 60, 'O', 'bee', '숙제', '']);   // 오늘 푼 것
  const 보관 = [['때']];
  for (let i = 0; i < 200; i++) 보관.push([전(3000 * 23 + (200 - i) * 60), '', '김영희', '예시 단어장', '11~20', '스펠링', 10, 10, 100, 0, 0, 40, 'O', '', '숙제', '']);
  const 학생 = [['반', '이름', '비번', '구분', '', '학년', '학교', '교재'],
    ['', '홍길동', '1234', '초중등', '', '중2', '인왕중', '예시 단어장'], ['', '김영희', '1234', '초중등', '', '중2', '인왕중', '예시 단어장'],
    ['', '이철수', '1234', '고등', '', '고3', '한성고', '예시 단어장']];
  const 지난 = n => { const d = new D(지금고정); d.setDate(d.getDate() - n); return d; };
  const 숙제 = [['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류', '수업', '순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분'],
    ['', '예시 단어장', 1, 10, '스펠링', 지난(-3), 지난(5), '', '기한', '', 0, '', '', '', '', '', ''],
    ['', '예시 단어장', 11, 20, '스펠링', 지난(2), 지난(6), '', '기한', '', 0, '', '', '', '', '', ''],
    ['', '예시 단어장', 21, 25, '스펠링', 지난(-3), 지난(1), '', '기한', '수업A', 1, '', 8, '시험', 80, 2, ''],
    ['', '예시 단어장', 1, 10, '첫 글자', 지난(0), 지난(0), '홍길동', '당일', '', 0, '', '', '', '', '', ''],
    ['', '예시 단어장', 11, 20, '4지선다', 지난(-5), 지난(3), '', '시험', '', 0, '', 20, '', '', '', 5]];
  const 단어장목록 = [['이름', '종류', '시트', '색', '레슨'], ['예시 단어장', '', '예시 단어장', '#FF7A3D', '']];
  const 낱말 = [['영어', '뜻']].concat(Array.from({ length: 25 }, (_, i) => ['w' + i, '뜻']));
  return { 기록, 기록보관: 보관, 학생, 숙제, 단어장목록, '예시 단어장': 낱말, 설정: [['항목', '값']] };
}
function 판(코드) {
  const 칸 = { Logger: { log() {} }, console,
    Session: { getScriptTimeZone: () => 'Asia/Seoul' },
    CacheService: { getScriptCache: () => null },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); } } };
  vm.createContext(칸);
  vm.runInContext(fs.readFileSync(코드, 'utf8'), 칸);
  const D = vm.runInContext('Date', 칸);
  const 셈 = {};
  const 시트들 = {};
  Object.entries(자료(D)).forEach(([k, v]) => { 셈[k] = { values: 0, 칸: 0, notes: 0, deleteRow: 0, deleteRows: 0 }; 시트들[k] = 시트(v, 셈[k]); });
  칸.SpreadsheetApp = { flush() {}, getActiveSpreadsheet: () => ({ getSheetByName: n => 시트들[n] || null, insertSheet: n => (시트들[n] = 시트([[]], { values: 0, 칸: 0, notes: 0, deleteRow: 0, deleteRows: 0 })) }),
    WrapStrategy: { CLIP: 1 } };
  칸.선생님확인_ = () => true;
  const 비우기 = () => Object.values(셈).forEach(s => Object.keys(s).forEach(k => { s[k] = 0; }));
  return { 칸, D, 셈, 시트들, 비우기 };
}
const 읽음 = 셈 => ({ 기록: 셈.기록.values + '번', 보관: 셈.기록보관.values + '번', 학생: 셈.학생.values + '번', 메모: 셈.기록.notes + 셈.기록보관.notes + '번' });

/* ======================= Code.gs ======================= */
const 옛 = 판(옛코드), 새 = 판(path.join(__dirname, 'Code.gs'));

console.log('— 숙제 목록 숫자가 전과 같다 —');
const 전목록 = 옛.칸.전체숙제(), 후목록 = 새.칸.전체숙제();
/* 시험 줄에 붙은 평균은 프롬프트 9 에서 보탠 칸이다 — 그것만 빼고 맞댄다 */
확인('전체숙제 — 고치기 전과 같다 (누가 냈나·안 냈나·막힌 사람까지)', 후목록.map(h => { const x = Object.assign({}, h); delete x.평균; return x; }), 전목록);
옛.비우기(); 새.비우기();
옛.칸.전체숙제(); 새.칸.전체숙제();
console.log('  전체숙제 한 번 — 고치기 전 ' + JSON.stringify(읽음(옛.셈)) + ' / 고친 뒤 ' + JSON.stringify(읽음(새.셈)));
확인('한 번에 기록·보관·학생을 한 번씩만 읽는다 (메모 0번)', [새.셈.기록.values, 새.셈.기록보관.values, 새.셈.학생.values, 새.셈.기록.notes], [1, 1, 1, 0]);

console.log('\n— 화면 뜰 때 —');
옛.비우기(); 새.비우기();
옛.칸.선생님요약('1234', 7);
const 옛뜰때 = 읽음(옛.셈);
새.칸.선생님기본('1234'); const 새기본 = 읽음(새.셈); 새.비우기();
새.칸.선생님기록('1234', 7); const 새기록 = 읽음(새.셈);
console.log('  고치기 전 선생님요약 ' + JSON.stringify(옛뜰때));
console.log('  고친 뒤 선생님기본 ' + JSON.stringify(새기본) + ' · 선생님기록 ' + JSON.stringify(새기록));

console.log('\n— 숙제를 낸다 — 그 한 줄만 돌려준다 —');
옛.비우기(); 새.비우기();
const 낼것 = { 단어장: '예시 단어장', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '당일', 바뀐줄만: true };   // 새 화면은 「바뀐줄만」 을 보낸다
const 옛낸 = 옛.칸.숙제등록('1234', 낼것);
const 옛낼때 = 읽음(옛.셈);
const 새낸 = 새.칸.숙제등록('1234', 낼것);
const 새낼때 = 읽음(새.셈);
console.log('  고치기 전 ' + JSON.stringify(옛낼때) + ' / 고친 뒤 ' + JSON.stringify(새낼때));
확인('목록을 통째로 보내지 않고 새 줄 하나만', ['숙제목록' in 새낸, !!새낸.숙제], [false, true]);
const 낸때빼고 = h => { const x = Object.assign({}, h); delete x.낸때; return x; };   // 등록시각은 낸 때마다 다르다
확인('그 줄이 고치기 전 목록의 마지막 줄과 같다 (오늘 이미 푼 아이까지)', 낸때빼고(새낸.숙제), 낸때빼고(옛낸.숙제목록[옛낸.숙제목록.length - 1]));
확인('오늘 푼 홍길동은 낸 것으로', 새낸.숙제.한사람, ['홍길동']);
확인('기록 보관함·메모는 안 읽고 기록도 오늘 치 한 덩이만', [새.셈.기록보관.values, 새.셈.기록.notes, 새.셈.기록.values, 새.셈.기록.칸 < 옛.셈.기록.칸 / 2], [0, 0, 1, true]);
새.비우기();
const 단계낸 = 새.칸.숙제등록('1234', { 단어장: '예시 단어장', 시작: 11, 끝: 20, 유형: '스펠링', 종류: '당일', 수업: '수업B', 순서: 1, 단계: '시험', 통과점수: 80, 재응시: 2, 바뀐줄만: true });
확인('단계(연습·시험) 숙제는 기록 시트를 한 번도 안 읽는다', [새.셈.기록.values, 새.셈.기록보관.values, 새.셈.기록.notes], [0, 0, 0]);
확인('아무도 안 풀었다 — 대상 전원이 안 한 사람', [단계낸.숙제.한사람, 단계낸.숙제.안한사람.length], [[], 3]);
새.비우기();
const 수업 = 새.칸.수업내주기('1234', { 이름: '수업C', 종류: '당일', 바뀐줄만: true, 단계: [
  { 단어장: '예시 단어장', 시작: 1, 끝: 5, 유형: '첫 글자', 단계: '연습' }, { 단어장: '예시 단어장', 시작: 1, 끝: 5, 유형: '스펠링', 단계: '시험' }] });
확인('수업내주기 — 새 줄들만 · 학생 시트 한 번', [수업.숙제들.length, '숙제목록' in 수업, 새.셈.학생.values, 새.셈.기록.values], [2, false, 1, 0]);

console.log('\n— 숙제를 지운다 — 지운 줄번호만 · 기록은 안 읽는다 —');
옛.비우기(); 새.비우기();
옛.칸.숙제삭제('1234', 2);
const 새지움 = 새.칸.숙제삭제('1234', { 행: 2, 낸때: 새.시트들.숙제.줄들[1][6].getTime() }, true);
console.log('  한 줄 지울 때 — 고치기 전 ' + JSON.stringify(읽음(옛.셈)) + ' / 고친 뒤 ' + JSON.stringify(읽음(새.셈)));
확인('지운 줄번호만 돌려준다', JSON.parse(JSON.stringify(새지움)), { ok: true, 지운행: [2] });
확인('기록·보관·학생·메모를 하나도 안 읽는다', [새.셈.기록.values, 새.셈.기록보관.values, 새.셈.학생.values, 새.셈.기록.notes], [0, 0, 0, 0]);

console.log('\n— 줄번호가 밀려도 엉뚱한 줄을 안 지운다 — 세 줄을 내고 가운데·마지막을 차례로 —');
const 숙 = 새.시트들.숙제.줄들;
const 앞수 = 숙.length;
['가', '나', '다'].forEach((t, i) => 새.칸.숙제등록('1234', { 단어장: '예시 단어장', 시작: 1 + i, 끝: 5 + i, 유형: t, 종류: '당일', 바뀐줄만: true }));
/* 등록시각이 같을 수 있으니 흉내에서 1ms 씩 벌려 둔다 */
for (let i = 0; i < 3; i++) 숙[앞수 + i][6] = new 새.D(숙[앞수 + i][6].getTime() + i + 1);
const 줄_ = t => 숙.findIndex(x => x[4] === t) + 1;
const 낸때 = t => 숙[줄_(t) - 1][6].getTime();
const 다낸때 = 낸때('다'), 다옛줄 = 줄_('다');
새.칸.숙제삭제('1234', { 행: 줄_('나'), 낸때: 낸때('나') }, true);
/* 화면이 줄번호를 당기지 못했다고 쳐도 — 옛 번호 + 낸때로 보내면 서버가 맞는 줄을 찾는다 */
const 둘째 = 새.칸.숙제삭제('1234', { 행: 다옛줄, 낸때: 다낸때 }, true);
확인('「다」 는 한 칸 당겨진 줄에서 지워진다', 둘째.지운행, [다옛줄 - 1]);
확인('「가」 만 남는다', 숙.slice(앞수 - 1).map(x => x[4]).filter(t => ['가', '나', '다'].indexOf(t) > -1), ['가']);
확인('낸때가 어디에도 없으면 아무것도 안 지운다', 새.칸.숙제여러개삭제('1234', [{ 행: 2, 낸때: 12345 }], true).지운행, []);

console.log('\n— 여러 줄은 이어진 묶음끼리 deleteRows 로 —');
for (let i = 0; i < 8; i++) 새.칸.숙제등록('1234', { 단어장: '예시 단어장', 시작: 1, 끝: 3, 유형: '묶음' + i, 종류: '당일', 바뀐줄만: true });
새.비우기();
const 끝 = 숙.length;
const 지울 = [끝 - 7, 끝 - 6, 끝 - 5, 끝 - 2, 끝 - 1];   // 세 줄 + 두 줄
const 여럿 = 새.칸.숙제여러개삭제('1234', 지울, true);
확인('다섯 줄 — deleteRow 0번 · deleteRows 2번 (묶음 수만큼)', [새.셈.숙제.deleteRow, 새.셈.숙제.deleteRows], [0, 2]);
확인('지운 줄번호 (작은 차례)', 여럿.지운행, 지울);
확인('남은 묶음 줄', 숙.map(x => x[4]).filter(t => /^묶음/.test(t)), ['묶음3', '묶음4', '묶음7']);

console.log('\n— 숙제수정 — 시간만 고치면 그 칸만 · 기록을 안 읽는다 —');
새.비우기();
const 시험줄 = 숙.findIndex(x => x[4] === '4지선다') + 1;      // 앞에서 지워 줄이 밀렸다 — 내용으로 찾는다
const 고친 = 새.칸.숙제수정('1234', 시험줄, { 제한시간: 15, 바뀐줄만: true });
확인('고친 칸만 돌려준다 (등록시각과 함께)', 고친.숙제, { 행: 시험줄, 낸때: 숙[시험줄 - 1][6].getTime(), 제한시간: 15, 외우기분: 5, 통과점수: '', 재응시: '' });
확인('기록·보관을 안 읽는다', [새.셈.기록.values, 새.셈.기록보관.values], [0, 0]);
const 범위고침 = 새.칸.숙제수정('1234', 2, { 단어장: '예시 단어장', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '기한', 마감일: '2099-01-01', 바뀐줄만: true });
확인('범위를 고치면 그 한 줄을 다시 센다 (누가 냈나 포함)', [범위고침.숙제.행, 범위고침.숙제.시작, Array.isArray(범위고침.숙제.한사람)], [2, 1, true]);

console.log('\n— 옛 화면(「바뀐줄만」 을 안 보냄)에는 예전처럼 목록을 통째로 —');
const 옛화면 = 새.칸.숙제등록('1234', { 단어장: '예시 단어장', 시작: 1, 끝: 2, 유형: '옛화면', 종류: '당일' });
확인('숙제등록 — 숙제목록도 같이', [Array.isArray(옛화면.숙제목록), 옛화면.숙제목록.length === 숙.length - 1], [true, true]);
const 옛화면지움 = 새.칸.숙제여러개삭제('1234', [숙.length]);
확인('숙제 번호만 보내도 지운다 · 목록도 같이', [옛화면지움.개수, Array.isArray(옛화면지움.숙제목록)], [1, true]);

console.log('\n— 응시표_ 는 메모를 안 읽는다 · 다시 연습은 그 한 줄만 —');
새.비우기();
const 아이 = 새.칸.숙제가져오기('홍길동');
확인('아이 숙제 목록 — 메모 0번 · 기록 한 번', [새.셈.기록.notes, 새.셈.기록.values], [0, 1]);
const 수업A = 새.칸.숙제가져오기('이철수').filter(h => h.수업 === '수업A')[0];   // 이 시험을 본 아이
확인('시험 단계의 마지막 틀린 것 — 짧은 칸 다섯 개 + 몇 개 더 + 자리', [수업A.마지막틀린.length <= 5, typeof 수업A.마지막틀린더, !!수업A.마지막자리], [true, 'number', true]);
const 긴줄 = 새.시트들.기록.줄들.findIndex(x => x.메모 && x.메모.indexOf('gum') > -1 && x[2] === '홍길동') + 1;
const 키 = 새.시트들.기록.줄들[긴줄 - 1][0].getTime();
새.비우기();
확인('틀린전문 — 그 줄의 전문 (메모 통째 읽기 0번)', [새.칸.틀린전문('홍길동', '기록', 긴줄, 키).틀린, 새.셈.기록.notes], [['apple', 'bee', 'cat', 'dog', 'egg', 'fig', 'gum'], 0]);
확인('남의 기록은 안 준다', 새.칸.틀린전문('김영희', '기록', 긴줄, 키).ok, false);
/* 빗금 낀 낱말 — 짧은 칸에선 둘로 갈라진다. 다섯 개 안이어도 전문을 가져가게 「더」 를 세운다 */
새.시트들.기록.줄들.push([new 새.D(지금고정 - 5 * 60000), '', '이철수', '예시 단어장', '21~25', '스펠링', 10, 9, 90, 0, 0, 60, 'O', 'be - was / were - been', '숙제', '']);
const 빗금 = 새.칸.숙제가져오기('이철수').filter(h => h.수업 === '수업A')[0];
확인('빗금 낀 낱말이면 전문을 가져가라고 알린다', 빗금.마지막틀린더 > 0, true);

/* ======================= 화면 ======================= */
(async () => {
  const b = await chromium.launch(띄우기설정);
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const t = await ctx.newPage();
  const errs = [];
  t.on('pageerror', e => errs.push('ERR ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소); await t.waitForTimeout(400);
  await t.evaluate(() => {
    window.__부른것 = []; window.__지우기멈춤 = false; window.__지우기실패 = false;
    const 원래 = window.api;
    window.api = function (이름) {
      window.__부른것.push(이름);
      if (이름 === '숙제여러개삭제' && window.__지우기멈춤) {
        const 인자 = arguments;
        return new Promise(res => { window.__지우기풀기 = () => (window.__지우기실패 ? Promise.resolve({ ok: false, 메시지: '흉내 실패' }) : 원래.apply(null, 인자)).then(res); });
      }
      return 원래.apply(null, arguments);
    };
  });
  await t.click('#btnTeacherGo'); await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  await t.evaluate(() => { var b = document.querySelector('[data-tab="hw"]'); var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]'); if (g) g.click(); });
  await t.waitForTimeout(250); await t.click('[data-tab="hw"]'); await t.waitForTimeout(800);
  const 맞나 = () => t.evaluate(() => JSON.stringify(T.data.숙제목록.map(h => [h.행, h.단어장, h.시작, h.끝, h.유형])) === JSON.stringify(DEMO_HW.map(h => [h.행, h.단어장, h.시작, h.끝, h.유형])));

  console.log('\n— 숙제를 내면 그 줄만 더한다 —');
  const 전수 = await t.evaluate(() => T.data.숙제목록.length);
  await t.evaluate(() => { window.__부른것 = []; });
  await t.selectOption('#hwBook', '예시 단어장'); await t.waitForTimeout(300);
  await t.click('#btnHwAdd'); await t.waitForTimeout(900);
  확인('목록에 한 줄 늘었다 · 다시 불러오지 않았다', [await t.evaluate(() => T.data.숙제목록.length) - 전수, await t.evaluate(() => window.__부른것.filter(x => /^선생님/.test(x)).length)], [1, 0]);
  확인('화면 목록이 서버(흉내)와 같다', await 맞나(), true);

  console.log('\n— 세 줄을 내고 가운데·마지막을 차례로 지운다 —');
  for (const [a, z] of [[3, 7], [8, 12], [13, 17]]) {
    await t.evaluate(([a, z]) => { $('hwFrom').value = a; $('hwTo').value = z; $('hwFrom').oninput(); }, [a, z]);
    await t.selectOption('#hwType', '첫 글자'); await t.waitForTimeout(100);
    await t.click('#btnHwAdd'); await t.waitForTimeout(800);
  }
  const 셋 = await t.evaluate(() => T.data.숙제목록.slice(-3).map(h => h.행));
  const 지우기 = async 행 => {
    await t.check('.hwPick[data-row="' + 행 + '"]'); await t.waitForTimeout(150);
    await t.click('.hwDelSel[data-scope="now"]'); await t.waitForTimeout(700);
  };
  await 지우기(셋[1]);
  확인('가운데를 지우면 마지막 줄 번호가 당겨진다', await t.evaluate(() => T.data.숙제목록.slice(-2).map(h => h.행)), [셋[0], 셋[1]]);
  await 지우기(셋[1]);       // 당겨진 번호 — 이제 마지막 줄
  확인('남은 것은 첫 줄 (3~7)', await t.evaluate(() => DEMO_HW.map(h => h.시작 + '~' + h.끝).filter(r => ['3~7', '8~12', '13~17'].indexOf(r) > -1)), ['3~7']);
  확인('화면 목록이 서버(흉내)와 같다', await 맞나(), true);

  console.log('\n— 누르면 바로 사라지고, 실패하면 돌아온다 —');
  await t.evaluate(() => { window.__지우기멈춤 = true; window.__지우기실패 = true; });
  const 줄수 = await t.locator('.hwrow').count();
  const 마지막 = await t.evaluate(() => T.data.숙제목록[T.data.숙제목록.length - 1].행);
  await t.check('.hwPick[data-row="' + 마지막 + '"]'); await t.waitForTimeout(150);
  await t.click('.hwDelSel[data-scope="now"]'); await t.waitForTimeout(300);
  확인('서버 답 전에 줄이 사라진다', [await t.locator('.hwrow').count(), await t.locator('.hwPick[data-row="' + 마지막 + '"]').count()], [줄수 - 1, 0]);
  await t.evaluate(() => window.__지우기풀기()); await t.waitForTimeout(600);
  확인('실패하면 돌아온다', [await t.locator('.hwrow').count(), await t.locator('.hwPick[data-row="' + 마지막 + '"]').count()], [줄수, 1]);
  확인('되돌린 목록도 서버(흉내)와 같다', await 맞나(), true);
  await t.evaluate(() => { window.__지우기실패 = false; });
  await t.check('.hwPick[data-row="' + 마지막 + '"]'); await t.waitForTimeout(150);
  await t.click('.hwDelSel[data-scope="now"]'); await t.waitForTimeout(300);
  await t.evaluate(() => window.__지우기풀기()); await t.waitForTimeout(600);
  확인('성공하면 그대로 사라져 있다', [await t.locator('.hwrow').count(), await 맞나()], [줄수 - 1, true]);

  console.log('\n— 수업을 내도 다시 불러오지 않는다 —');
  await t.evaluate(() => { window.__부른것 = []; window.__지우기멈춤 = false; });
  const 수업전 = await t.evaluate(() => T.data.숙제목록.length);
  await t.selectOption('#lsBook', '예시 단어장'); await t.waitForTimeout(200);
  await t.click('#lsAddStep'); await t.waitForTimeout(150);
  await t.click('#lsAddStep'); await t.waitForTimeout(150);
  await t.fill('#lsName', '속도 검사 수업');
  await t.click('#btnLsAdd'); await t.waitForTimeout(1200);
  확인('두 줄이 더해지고 선생님기본·기록을 다시 안 부른다', [await t.evaluate(() => T.data.숙제목록.length) - 수업전, await t.evaluate(() => window.__부른것.filter(x => /^선생님/.test(x)).length)], [2, 0]);
  확인('화면 목록이 서버(흉내)와 같다', await 맞나(), true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
