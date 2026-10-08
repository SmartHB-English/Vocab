/* 범위가 잘려도 '냈다'로 잡히는지 — 냈는데 안 냈다고 나오던 버그 */
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync(require('path').join(__dirname, 'Code.gs'), 'utf8');
const SH = { 기록: [], 기록보관: [], 숙제: [], 학생: [], 설정: [], 단어장목록: [] };
const ctx = {
  console,
  Utilities: { formatDate(d, tz, fmt) {
    const p = n => String(n).padStart(2, '0');
    if (fmt === 'yyyy-MM') return d.getFullYear() + '-' + p(d.getMonth() + 1);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  } },
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => null }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
};
vm.createContext(ctx);
vm.runInContext(src, ctx);
const VMDate = vm.runInContext('Date', ctx);
const 오늘 = new VMDate();
function 날(전) { const d = new VMDate(오늘.getTime()); d.setDate(d.getDate() - 전); return d; }
function ymd(전) { const d = 날(전), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }

SH.학생 = [['중2 A반', '홍길동', '1234', '초중등', '', '중2', '인왕중', '예시']];
ctx.rows_ = name => (SH[name] || []).map(r => r.slice());
ctx.선생님확인_ = () => true;
ctx.setting_ = (k, def) => { const r = SH.설정.find(x => x[0] === k); return r ? r[1] : def; };
ctx.교재맵_ = () => ({ '홍길동': ['예시'] });
/* 단어장 '예시' 에는 단어가 20개뿐 */
ctx.단어장목록 = () => [{ 이름: '예시', 개수: 20, 종류: '', 시트: '예시', 색: '' }];

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
function 기록(범위, 전) {
  return [날(전 || 0), '중2 A반', '홍길동', '예시', 범위, '스펠링', 10, 9, 90, 0, 0, 60, 'O', '', '숙제', ''];
}

console.log('— 숙제 1~25, 단어는 20개, 기록은 1~20 —');
SH.숙제 = [['중2 A반', '예시', 1, 25, '스펠링', ymd(0), 날(0), '', '당일']];
SH.기록 = [기록('1~20', 0)];
let hw = ctx.숙제가져오기('홍길동');
확인('학생 화면에서 낸 걸로 잡힌다', hw[0].완료, true);
let 전체 = ctx.전체숙제();
확인('선생님 화면에서도 낸 사람', 전체[0].한사람, ['홍길동']);
확인('안 낸 사람이 없다', 전체[0].안한사람, []);

console.log('\n— 범위가 딱 맞는 보통 경우 —');
SH.숙제 = [['중2 A반', '예시', 1, 10, '스펠링', ymd(0), 날(0), '', '당일']];
SH.기록 = [기록('1~10', 0)];
확인('그대로 잡힌다', ctx.숙제가져오기('홍길동')[0].완료, true);
확인('선생님 화면도', ctx.전체숙제()[0].한사람, ['홍길동']);

console.log('\n— 안 낸 건 여전히 안 낸 것 —');
SH.숙제 = [['중2 A반', '예시', 1, 25, '스펠링', ymd(0), 날(0), '', '당일']];
SH.기록 = [];
확인('기록이 없으면 안 냄', ctx.숙제가져오기('홍길동')[0].완료, false);
확인('선생님 화면도 안 냄', ctx.전체숙제()[0].안한사람, ['홍길동']);

console.log('\n— 엉뚱한 범위는 안 잡힌다 —');
SH.기록 = [기록('31~40', 0)];
확인('다른 범위는 안 냄', ctx.숙제가져오기('홍길동')[0].완료, false);

console.log('\n— 시작이 단어 수보다 클 때 (21~25 숙제, 단어 20개) —');
SH.숙제 = [['중2 A반', '예시', 21, 25, '스펠링', ymd(0), 날(0), '', '당일']];
SH.기록 = [기록('20~21', 0)];          // 학생 앱이 뒤집어 저장한 모양
확인('뒤집힌 기록도 찾는다', ctx.숙제가져오기('홍길동')[0].완료, true);

console.log('\n— 연속 기록도 같이 고쳐졌나 —');
SH.숙제 = [['중2 A반', '예시', 1, 25, '스펠링', ymd(1), 날(1), '', '당일']];
SH.기록 = [기록('1~20', 1)];
확인('어제 낸 것이 연속 1일로', ctx.연속가져오기('홍길동').연속, 1);

console.log('\n— 시상 제출률도 같이 —');
SH.숙제 = [['중2 A반', '예시', 1, 25, '스펠링', ymd(1), 날(1), '', '기한']];
SH.기록 = [기록('1~20', 1)];
const 상 = ctx.시상집계('1234', ctx.월_(날(1)));
const 홍 = 상.줄.find(x => x.이름 === '홍길동');
확인('제출률 100%', 홍.제출률, 100);

console.log('\n' + (실패 ? '✗ ' + 실패 + '개 실패' : '전부 통과'));
process.exit(실패 ? 1 : 0);
