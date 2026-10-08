/* 게임 순위 — 점수가 쌓이고 순위가 제대로 나오는지 */
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync(require('path').join(__dirname, 'Code.gs'), 'utf8');

let 게임시트있나 = true;
const 줄 = [];              // 게임 시트 내용
let 머리쓴것 = null;
const 시트 = {
  getLastRow: () => 머리쓴것 ? 줄.length + 1 : 0,
  getLastColumn: () => 7,
  appendRow: r => 줄.push(r),
  getRange: () => ({
    setValues: v => { 머리쓴것 = v[0]; return { setFontWeight: () => ({ setBackground: () => {} }) }; },
    setNumberFormat: () => {},
    setFontWeight: () => ({ setBackground: () => {} })
  }),
  setFrozenRows: () => {}
};
const ctx = {
  console,
  Utilities: { formatDate(d, tz, fmt) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  } },
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({
    getSheetByName: n => (n === '게임' && 게임시트있나) ? 시트 : null,
    insertSheet: () => { 게임시트있나 = true; return 시트; }
  }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
};
vm.createContext(ctx);
vm.runInContext(src, ctx);
ctx.rows_ = name => {
  if (name === '게임') {
    if (!게임시트있나) throw new Error('시트 "게임"가 없습니다.');
    return 줄.map(r => r.slice());
  }
  return [];
};

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
const 이름들 = r => r.map(x => x.이름 + '(' + x.점수 + ',' + x.등수 + ')').join(' ');

console.log('— 시트가 아직 없을 때 —');
게임시트있나 = false;
let r = ctx.게임순위('홍길동');
확인('화면이 안 깨진다', r.ok, true);
확인('두 게임 칸은 나온다', r.게임.map(g => g.키), ['짝', '퍼즐']);
확인('순위는 비어 있다', r.게임[0].전체, []);
확인('내 최고는 0', r.게임[0].내최고, 0);

console.log('\n— 저장하면 시트를 만들어 준다 —');
확인('저장된다', ctx.게임저장({ 이름: '홍길동', 게임: '짝', 점수: 120, 기록: '35초 / 12번', 단어장: '예시' }).ok, true);
확인('머리글도 넣는다', 머리쓴것, ['시각', '반', '이름', '게임', '점수', '기록', '단어장']);
확인('한 줄 쌓였다', 줄.length, 1);
확인('모르는 게임은 막는다', ctx.게임저장({ 이름: '홍길동', 게임: '테트리스', 점수: 9 }).ok, false);
확인('막힌 건 안 쌓인다', 줄.length, 1);

console.log('\n— 여러 사람이 여러 판 —');
const 판 = (이름, 게임, 점수) =>
  ctx.게임저장({ 이름: 이름, 게임: 게임, 점수: 점수, 기록: '', 단어장: '예시' });
판('홍길동', '짝', 80);          // 본인 두 번째 판 (더 낮음)
판('김영희', '짝', 200);
판('김영희', '짝', 150);
판('이철수', '짝', 160);
판('홍길동', '퍼즐', 55);

r = ctx.게임순위('홍길동');
const 짝 = r.게임.filter(g => g.키 === '짝')[0];
console.log('  순위:', 이름들(짝.전체));
확인('한 사람당 제일 잘한 판만', 짝.전체.map(x => x.이름), ['김영희', '이철수', '홍길동']);
확인('내 최고 점수는 120', 짝.내최고, 120);
확인('낮은 판이 최고를 덮어쓰지 않는다',
  짝.전체.filter(x => x.이름 === '홍길동')[0].점수, 120);
확인('반 표시는 이제 없다', 짝.전체.every(x => x.반 === undefined), true);
확인('전체는 세 명', 짝.전체.map(x => x.이름), ['김영희', '이철수', '홍길동']);
확인('내 줄에 표시', 짝.전체.filter(x => x.나).map(x => x.이름), ['홍길동']);
확인('등수는 1,2,3', 짝.전체.map(x => x.등수), [1, 2, 3]);
확인('오늘 몇 판 했는지', r.오늘판, 3);

console.log('\n— 동점은 같은 등수 —');
판('박민수', '짝', 200);
r = ctx.게임순위('홍길동');
const 짝2 = r.게임.filter(g => g.키 === '짝')[0];
console.log('  전체:', 이름들(짝2.전체));
확인('동점 둘이 1등', 짝2.전체.slice(0, 2).map(x => x.등수), [1, 1]);
확인('그다음은 3등', 짝2.전체[2].등수, 3);

console.log('\n— 퍼즐은 따로 —');
const 퍼즐 = r.게임.filter(g => g.키 === '퍼즐')[0];
확인('퍼즐 순위는 한 명', 퍼즐.전체.map(x => x.이름), ['홍길동']);
확인('퍼즐 내 최고', 퍼즐.내최고, 55);

console.log('\n— 시각이 글자로 들어 있어도 —');
줄.push(['2026-09-17 10:00', '중2 A반', '홍길동', '짝', 999, '', '예시']);
r = ctx.게임순위('홍길동');
확인('점수는 그대로 센다', r.게임.filter(g => g.키 === '짝')[0].내최고, 999);

console.log(실패 ? '\n✗ ' + 실패 + '개 실패' : '\n전부 통과');
process.exit(실패 ? 1 : 0);
