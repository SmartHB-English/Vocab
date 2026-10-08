/* 레슨 — 뒤(Apps Script)에서 묶음 크기를 제대로 읽고 쓰는지 */
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync(require('path').join(__dirname, 'Code.gs'), 'utf8');

/* 단어장목록 시트 흉내 — [단어장, 종류, 시트이름, 색, 레슨묶음] */
const 목록 = [
  ['예시 단어장', '', '단어_예시', '#FF7A3D', 10],
  ['수능 2000', '', '단어_수능', '#3B82F6', ''],      // 비어 있으면 기본 10
  ['불규칙 동사', '3단변화', '단어_동사', '#16A34A', 5],
  ['옛날 단어장', '', '단어_옛날']                    // 칸 자체가 없던 옛 줄
];
const 쓴값 = [];
const ctx = {
  console,
  Utilities: { formatDate: (d, tz, f) => '' },
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({
    getSheetByName: name => ({
      getLastRow: () => ({ '단어_예시': 26, '단어_수능': 2001, '단어_동사': 51, '단어_옛날': 8 }[name] || 1)
    })
  }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
};
vm.createContext(ctx);
vm.runInContext(src, ctx);

ctx.rows_ = name => 목록.map(r => r.slice());
ctx.선생님확인_ = 비번 => 비번 === '1234';
ctx.목록칸확보_ = () => ({
  getRange: (행, 칸) => ({ setValue: v => 쓴값.push({ 행: 행, 칸: 칸, 값: v }) })
});

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

console.log('— 묶음 크기 읽기 —');
확인('적어 둔 값을 쓴다', ctx.레슨크기_(10), 10);
확인('비어 있으면 10', ctx.레슨크기_(''), 10);
확인('0 이나 음수도 10', [ctx.레슨크기_(0), ctx.레슨크기_(-3)], [10, 10]);
확인('글자로 적혀 있어도 읽는다', ctx.레슨크기_('20'), 20);
확인('소수는 반올림', ctx.레슨크기_(7.6), 8);
확인('너무 크면 500 까지', ctx.레슨크기_(9999), 500);

console.log('\n— 단어장 목록에 묶음이 실려 오는지 —');
const L = ctx.단어장목록();
console.log('  ' + L.map(b => b.이름 + '(' + b.개수 + '개, ' + b.레슨 + '씩)').join(' / '));
확인('예시 단어장은 10씩', L[0].레슨, 10);
확인('빈 칸은 기본 10', L[1].레슨, 10);
확인('동사는 5씩', L[2].레슨, 5);
확인('칸이 없던 옛 줄도 10', L[3].레슨, 10);
확인('단어 개수는 그대로', L.map(b => b.개수), [25, 2000, 50, 7]);

console.log('\n— 단어장찾기_ 도 묶음을 준다 —');
확인('행과 묶음', (function () { const b = ctx.단어장찾기_('불규칙 동사'); return [b.행, b.레슨]; })(), [4, 5]);
확인('없는 단어장은 null', ctx.단어장찾기_('없는 것'), null);

console.log('\n— 저장 —');
확인('비밀번호가 틀리면 막는다', ctx.레슨크기저장('9999', '예시 단어장', 20).ok, false);
확인('없는 단어장도 막는다', ctx.레슨크기저장('1234', '없는 것', 20).ok, false);
확인('0 은 막는다', ctx.레슨크기저장('1234', '예시 단어장', 0).ok, false);
확인('501 도 막는다', ctx.레슨크기저장('1234', '예시 단어장', 501).ok, false);
확인('20 은 저장된다', ctx.레슨크기저장('1234', '예시 단어장', 20).ok, true);
console.log('  시트에 쓴 것:', JSON.stringify(쓴값));
확인('2행 5칸에 20 을 쓴다', 쓴값[쓴값.length - 1], { 행: 2, 칸: 5, 값: 20 });
확인('막힌 것은 시트를 안 건드린다', 쓴값.length, 1);
확인('저장하면 새 목록을 돌려준다',
  ctx.레슨크기저장('1234', '수능 2000', 25).단어장목록.length, 4);

console.log('\n— 머리글 —');
/* 과 묶음 — 「과」 칸은 맨 뒤에 보태기만 한다 (있던 칸 차례는 그대로) */
확인('레슨묶음 칸이 다섯 번째, 과 칸이 여섯 번째',
  vm.runInContext('HEADERS.단어장목록', ctx), ['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);

console.log(실패 ? '\n✗ ' + 실패 + '개 실패' : '\n전부 통과');
process.exit(실패 ? 1 : 0);
