/* 기록 시트 보기 좋게 정리 — 날짜로 묶고, 숙제·오답노트를 색으로 나눈다 */
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync(require('path').join(__dirname, 'Code.gs'), 'utf8');

/* ---- 기록 시트 흉내 ---- */
const COLS = 16;
const 날 = (s) => new Date(s + 'T09:00:00');
/* [시각, 반, 이름, 단어장, 범위, 유형, 문항, 정답, 점수, 게임, 콤보, 초, 숙제여부, 틀린단어, 구분, 제외] */
function 줄(시각, 이름, 구분, 숙제여부) {
  const r = new Array(COLS).fill('');
  r[0] = 시각; r[1] = '중2 A반'; r[2] = 이름; r[3] = '예시'; r[4] = '1~10';
  r[5] = '스펠링'; r[6] = 10; r[7] = 9; r[8] = 90; r[12] = 숙제여부; r[14] = 구분;
  return r;
}
const 원본 = [
  줄(날('2026-09-15'), '홍길동', '숙제', 'O'),
  줄(날('2026-09-15'), '김영희', '오답 재시험', 'O'),
  줄(날('2026-09-16'), '홍길동', '시험', 'O'),
  줄(날('2026-09-16'), '김영희', '숙제', 'O'),
  줄(날('2026-09-16'), '이철수', '보충', 'O'),
  줄(날('2026-09-17'), '홍길동', '', ''),              // 혼자 연습
  줄(날('2026-09-17'), '김영희', '숙제', 'O')
];

let 값 = 원본.map(r => r.slice());
const 그린배경 = { v: null }, 그린글색 = { v: null }, 그린굵기 = { v: null };
const 테두리줄 = [];
let 지운테두리 = 0, 메모 = '';
const 너비 = {};

function 범위(행, 칸, 줄수, 칸수) {
  return {
    getValues: () => 값.slice(행 - 2, 행 - 2 + 줄수).map(r => r.slice(칸 - 1, 칸 - 1 + 칸수)),
    setValues() { return this; },
    setBackgrounds(v) { if (칸수 === COLS) 그린배경.v = v; return this; },
    setFontColors(v) { if (칸수 === COLS) 그린글색.v = v; return this; },
    setFontWeights(v) { if (칸수 === 1) 그린굵기.v = v; return this; },
    setBorder(top) { if (top) 테두리줄.push(행); else 지운테두리++; return this; },
    setNote(t) { 메모 = t; return this; },
    setNumberFormat() { return this; },
    setWrapStrategy() { return this; },
    setVerticalAlignment() { return this; },
    setFontWeight() { return this; },
    setBackground() { return this; },
    getValue: () => '',
    sort(규칙) {
      const c = 규칙[0].column - 1, 오름 = 규칙[0].ascending;
      값.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (오름 ? 1 : -1));
      return this;
    },
    createFilter() { return {}; }
  };
}
const 시트 = {
  getLastRow: () => 값.length + 1,
  getLastColumn: () => COLS,
  getMaxColumns: () => COLS,
  setFrozenRows() {}, setColumnWidth(c, w) { 너비[c] = w; },
  getFilter: () => null,
  getRange: (a, b, c, d) => 범위(a, b, c === undefined ? 1 : c, d === undefined ? 1 : d)
};
let 토스트 = '';
const ctx = {
  console,
  Utilities: { formatDate(d, tz, f) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  } },
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getSheetByName: n => (n === '기록' ? 시트 : null),
      toast: t => { 토스트 = t; }
    }),
    WrapStrategy: { CLIP: 'clip' },
    BorderStyle: { SOLID_MEDIUM: 'medium' }
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
};
vm.createContext(ctx);
vm.runInContext(src, ctx);

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

ctx.기록서식정리();

const 날짜들 = 값.map(r => ctx.ymd_(r[0]));
const 이름들 = 값.map(r => r[2]);
const 항목들 = 값.map(r => ctx.기록항목_(r[14], r[12]));
const 색들 = 그린배경.v.map(r => r[0]);
const 글색들 = 그린글색.v.map(r => r[0]);

console.log('— 줄 세우기 —');
console.log('  ' + 값.map((r, i) => 날짜들[i] + ' ' + 이름들[i] + ' ' + 항목들[i] + ' ' + 색들[i]).join('\n  '));
확인('최신 날짜가 맨 위', 날짜들[0], '2026-09-17');
확인('오래된 날짜가 맨 아래', 날짜들[날짜들.length - 1], '2026-09-15');
확인('같은 날끼리 붙어 있다', 날짜들, ['2026-09-17', '2026-09-17', '2026-09-16', '2026-09-16', '2026-09-16', '2026-09-15', '2026-09-15']);

console.log('\n— 날짜 구분 —');
console.log('  굵은 줄:', 테두리줄.join(', '));
확인('날짜가 바뀌는 줄에만 굵은 선', 테두리줄, [4, 7]);
확인('맨 윗줄에는 선을 안 긋는다', 테두리줄.indexOf(2), -1);
확인('먼저 옛 테두리를 지운다', 지운테두리 > 0, true);
const 굵기 = 그린굵기.v.map(r => r[0]);
console.log('  시각 칸 굵기:', 굵기.join(' / '));
확인('날짜 첫 줄의 시각만 굵게', 굵기, ['bold', 'normal', 'bold', 'normal', 'normal', 'bold', 'normal']);

console.log('\n— 날짜 블록마다 색이 번갈아 —');
console.log('  숙제 줄:',
  날짜들.map((d, i) => 항목들[i] === '숙제' ? d + ':' + 색들[i] : null).filter(Boolean).join(' / '));
const 숙제색 = (d) => 색들.filter((c, i) => 날짜들[i] === d && 항목들[i] === '숙제')[0];
확인('붙어 있는 날끼리는 색이 다르다', 숙제색('2026-09-17') !== 숙제색('2026-09-16'), true);
확인('한 칸 건너뛴 날은 같은 색으로 돌아온다', 숙제색('2026-09-17'), 숙제색('2026-09-15'));

console.log('\n— 항목마다 다른 색 —');
const 색표 = {};
항목들.forEach((t, i) => { 색표[t] = 색표[t] || 색들[i]; });
console.log('  ' + Object.keys(색표).map(k => k + '=' + 색표[k]).join(' / '));
확인('다섯 항목이 다 나온다', Object.keys(색표).sort(), ['보충', '숙제', '시험', '연습', '오답노트']);
확인('오답노트는 주황 계열', /^#FF|^#FD/.test(색표['오답노트']), true);
확인('시험은 파랑 계열', /^#DC|^#CF/.test(색표['시험']), true);
확인('숙제와 오답노트는 다른 색', 색표['숙제'] !== 색표['오답노트'], true);
확인('숙제와 시험도 다른 색', 색표['숙제'] !== 색표['시험'], true);
확인('보충도 따로', 색표['보충'] !== 색표['숙제'] && 색표['보충'] !== 색표['오답노트'], true);

const 글색표 = {};
항목들.forEach((t, i) => { 글색표[t] = 글색표[t] || 글색들[i]; });
console.log('  글자색: ' + Object.keys(글색표).map(k => k + '=' + 글색표[k]).join(' / '));
확인('오답노트는 글자색도 다르다', 글색표['오답노트'] !== 글색표['숙제'], true);
확인('혼자 연습은 흐리게', 글색표['연습'], '#9AA0A6');

console.log('\n— 안내와 칸 너비 —');
console.log('  메모:', 메모.split('\n')[0]);
확인('구분 칸에 색 안내를 붙인다', 메모.indexOf('오답 재시험') > -1, true);
확인('숙제 색도 설명한다', 메모.indexOf('숙제') > -1, true);
확인('틀린단어 칸을 넓힌다', 너비[14], 330);
확인('구분 칸도 넓힌다', 너비[15], 90);
확인('무슨 일을 했는지 알려 준다', 토스트.indexOf('날짜별로 묶고') > -1, true);

console.log('\n— 기록이 한 줄뿐일 때 —');
값 = [줄(날('2026-09-17'), '홍길동', '숙제', 'O')];
테두리줄.length = 0;
ctx.기록서식정리();
확인('한 줄이어도 안 깨진다', 그린배경.v.length, 1);
확인('굵은 선은 없다', 테두리줄, []);

console.log('\n— 기록이 없을 때 —');
값 = [];
ctx.기록서식정리();
확인('빈 시트도 안 깨진다', true, true);

console.log(실패 ? '\n✗ ' + 실패 + '개 실패' : '\n전부 통과');
process.exit(실패 ? 1 : 0);
