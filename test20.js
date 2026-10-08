/* 선생님요약의 학생별 평균이 '숙제로 본 시험'만 세는지 확인 */
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync(require('path').join(__dirname, 'Code.gs'), 'utf8');

const SH = { 기록: [], 기록보관: [], 숙제: [], 학생: [], 설정: [] };

const ctx = {
  console,
  Utilities: {
    formatDate(d, tz, fmt) {
      const p = n => String(n).padStart(2, '0');
      if (fmt === 'yyyy-MM') return d.getFullYear() + '-' + p(d.getMonth() + 1);
      if (fmt === 'MM/dd HH:mm') return p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
  },
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => null }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
};
vm.createContext(ctx);
vm.runInContext(src, ctx);
const VMDate = vm.runInContext('Date', ctx);

// 오늘 기준으로 최근 며칠 안에 들어오게 만든다
function 요전(일) {
  const d = new VMDate();
  d.setDate(d.getDate() - 일);
  d.setHours(10, 0, 0, 0);
  return d;
}

SH.학생 = [
  ['중2 A반', '홍길동', '1234', '초중등', '', '중2', '인왕중'],
  ['중2 A반', '김영희', '1234', '초중등', '', '중2', '인왕중']
];

function 기록(날, 이름, 점수, 숙제여부, 구분, 틀린단어) {
  return [날, '중2 A반', 이름, '예시', '1~10', '스펠링', 10, 9, 점수, 0, 0, 60,
          숙제여부, 틀린단어 || '', 구분 === undefined ? '숙제' : 구분];
}
SH.기록 = [
  기록(요전(1), '홍길동', 100, 'O', '숙제', 'apple'),
  기록(요전(2), '홍길동', 80, 'O', '숙제', 'banana'),
  기록(요전(2), '홍길동', 20, '', '오답 재시험', 'apple'),   // 오답노트 — 빠져야
  기록(요전(3), '홍길동', 40, '', '', 'cherry'),             // 혼자 연습 — 빠져야
  기록(요전(3), '홍길동', 10, '', '', 'apple'),              // 구분 없는 옛 오답노트 — 빠져야
  기록(요전(1), '김영희', 60, '', '', 'apple'),              // 연습만 함
  기록(요전(1), '홍길동', 30, 'O', '보충', 'apple'),          // 보충 — 평균에서 빠져야
  기록(요전(2), '김영희', 50, 'O', '보충', 'durian'),         // 숙제 없이 보충만
  기록(요전(1), '홍길동', 60, 'O', '시험', 'elder'),           // 학원 시험 — 숙제 평균에서 빠져야
  기록(요전(2), '홍길동', 80, 'O', '시험', 'fig')
];

// 시트 흉내 — 선생님요약은 getRange/getNotes 를 쓴다
const 기록시트 = {
  getLastRow: () => SH.기록.length + 1,
  getLastColumn: () => 15,
  getRange: (r, c, nr, nc) => ({
    getValues: () => SH.기록.slice(r - 2, r - 2 + nr).map(x => x.slice(c - 1, c - 1 + nc)),
    getNotes: () => SH.기록.slice(r - 2, r - 2 + nr).map(() => new Array(nc).fill(''))
  })
};
ctx.sheet_ = name => (name === '기록' ? 기록시트 : { getLastRow: () => 1, getLastColumn: () => 15 });
ctx.rows_ = name => (SH[name] || []).map(r => r.slice());
ctx.선생님확인_ = () => true;
/* 기록칸확보_ 는 진짜 시트를 만지므로 흉내만 낸다 */
ctx.기록칸확보_ = () => ({ getMaxColumns: () => 16, getRange: () => ({ getValue: () => '집계제외' }) });
ctx.setting_ = (k, def) => { const r = SH.설정.find(x => x[0] === k); return r ? r[1] : def; };
ctx.단어장목록 = () => [];

const d = ctx.선생님요약('1234', 7);

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

console.log('— 학생별 —');
d.학생별.forEach(s => console.log('  ' + s.이름 + ' | 숙제 ' + s.횟수 + '회 | 평균 ' +
  s.평균 + ' | 오답노트 ' + s.오답노트 + '회'));

console.log('\n— 확인 —');
const 홍 = d.학생별.find(s => s.이름 === '홍길동');
확인('홍길동 숙제 2회만 셈', 홍.횟수, 2);
확인('홍길동 평균 90 (100,80만)', 홍.평균, 90);
확인('홍길동 오답노트 1회는 따로 셈', 홍.오답노트, 1);
확인('보충 1회는 따로 셈', 홍.보충, 1);
확인('시험 2회는 따로 셈', 홍.시험, 2);
확인('시험 평균은 따로 (60,80)', 홍.시험평균, 70);
확인('시험을 넣어도 숙제 평균은 그대로 90', 홍.평균, 90);
확인('보충 넣어도 평균 그대로 90', 홍.평균, 90);
const 김 = d.학생별.find(s => s.이름 === '김영희');
확인('보충만 한 학생도 줄은 생김', !!김, true);
확인('보충만 한 학생 평균은 없음', 김.평균, null);
확인('보충만 한 학생 숙제 0회', 김.횟수, 0);
확인('보충만 한 학생 보충 1회', 김.보충, 1);
확인('김영희는 미응시에도 안 뜸 (연습은 함)', d.미응시.some(m => m.이름 === '김영희'), false);

const 오답맵 = {};
d.오답.forEach(o => 오답맵[o.단어] = o.횟수);
console.log('  많이 틀린 단어:', JSON.stringify(오답맵));
확인('apple 은 숙제에서 1번만 (오답노트·연습 제외)', 오답맵.apple, 1);
확인('cherry 는 연습이라 안 셈', 오답맵.cherry, undefined);
확인('durian 은 보충이라 안 셈', 오답맵.durian, undefined);
확인('elder 는 시험이라 안 셈', 오답맵.elder, undefined);
확인('banana 숙제에서 1번', 오답맵.banana, 1);

console.log('\n' + (실패 ? '✗ ' + 실패 + '개 실패' : '전부 통과'));
process.exit(실패 ? 1 : 0);
