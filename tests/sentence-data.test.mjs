import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 문장 탭 1단계 — 자료. 단어장 종류 「문장」 한 줄
   「The boy=주 / kicked=동 / the ball=목 / at the park=수2 | 소년이 공원에서 공을 찼다 | 교과서 88쪽」
   에서 배열·성분 찾기·끊어 읽기가 나오고, 자료에 적힌 만큼만 단이 열린다. */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const ui = vm.createContext({ location: { protocol: 'https:', hostname: 'example.invalid', search: '' }, 창구주소: 'firestore:v1' });
vm.runInContext(read('../services/shared-ui.js'), ui);
const 읽기 = en => JSON.parse(JSON.stringify(ui.문장읽기_(en)));

test('빗금으로 덩어리를 쪼개고 = 뒤를 역할로 읽는다', () => {
  const r = 읽기('The boy=주 / kicked=동 / the ball=목 / at the park=수2');
  assert.deepEqual(r.덩어리.map(d => [d.글, d.역할, d.꾸밈]),
    [['The boy', '주', 0], ['kicked', '동', 0], ['the ball', '목', 0], ['at the park', '수', 2]]);
  assert.equal(r.글, 'The boy kicked the ball at the park');
  assert.equal(r.낱말.length, 8);
  assert.deepEqual(r.경고, []);
});
test('주어·동사만 적으면 성분 찾기는 1단만, 목적어·절·꾸밈을 채우면 그만큼 열린다', () => {
  assert.deepEqual(읽기('Birds=주 / sing=동 / in the morning').단.성분, [1]);
  assert.deepEqual(읽기('The boy=주 / kicked=동 / the ball=목').단.성분, [1, 2]);
  assert.deepEqual(읽기('I=주 / know=동 / that she likes me=목절 / very much=수2').단.성분, [1, 2, 3, 4]);
  assert.deepEqual(읽기('The boy / kicked / the ball').단.성분, []);
});
test('배열은 덩어리가 둘 이상이면 1단, 낱말이 둘 이상이면 2단 · 끊어 읽기는 빗금이 있어야', () => {
  const r = 읽기('The boy=주 / kicked=동');
  assert.deepEqual(r.단.배열, [1, 2]); assert.deepEqual(r.단.끊기, [1, 2]);
  const 하나 = 읽기('Hello world');
  assert.deepEqual(하나.단.배열, [2]); assert.deepEqual(하나.단.끊기, []);
});
test('표가 없는 덩어리는 수식어, 절은 역할 뒤 「절」', () => {
  const r = 읽기('I=주 / know=동 / that she likes me=목절 / very much');
  assert.equal(r.덩어리[2].역할, '목'); assert.equal(r.덩어리[2].절, true);
  assert.equal(r.덩어리[3].역할, '수'); assert.equal(r.덩어리[3].표, false);
});
test('잘못 찍은 표는 경고로 알려 준다 — 줄을 버리지는 않는다', () => {
  assert.match(읽기('The boy=주 / kicked=X').경고.join(), /모르는 표/);
  assert.match(읽기('The boy=주 / kicked=동 / home=수9').경고.join(), /번호 9/);
  assert.match(읽기('The boy=주 / kicked=동 / home=수3').경고.join(), /자기 자신/);
  assert.match(읽기('The boy=주 / kicked / home').경고.join(), /동사/);
  assert.equal(읽기('The boy=주 / kicked=X').덩어리.length, 2);
});
test('한 묶음의 열린 단은 줄들을 합친 것', () => {
  const 단 = JSON.parse(JSON.stringify(ui.문장장단들_([{ en: 'A=주 / b=동' }, { en: 'I=주 / know=동 / that=목절' }])));
  assert.deepEqual(단.성분, [1, 2, 3]);
});

/* 엔진 — 붙여넣기 · 고치기 */
function 엔진() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 엔 = createRuntime(store, { now: () => Date.parse('2026-11-02T03:00:00Z') });
  return { store, call: (fn, ...args) => JSON.parse(JSON.stringify(엔.call(fn, args))) };
}
const 줄 = 'The boy=주 / kicked=동 / the ball=목 / at the park=수2 | 소년이 공원에서 공을 찼다 | 교과서 88쪽';
test('문장 단어장을 붙여넣으면 끊은 문장·해석·메모가 그대로 들어가고, 종류는 문장으로 돌아온다', () => {
  const e = 엔진();
  const r = e.call('단어붙여넣기', '1234', '중2 문장', 줄 + '\nI=주 / know=동 | 나는 안다', false, '문장');
  assert.equal(r.ok, true); assert.equal(r.개수, 2);
  assert.equal(r.단어장목록.find(b => b.이름 === '중2 문장').종류, '문장');
  const 목록 = e.call('단어목록', '1234', '중2 문장');
  assert.equal(목록.종류, '문장');
  assert.deepEqual(목록.단어들.map(w => [w.en, w.ko, w.비고]), [
    ['The boy=주 / kicked=동 / the ball=목 / at the park=수2', '소년이 공원에서 공을 찼다', '교과서 88쪽'],
    ['I=주 / know=동', '나는 안다', ''],
  ]);
});
test('한 줄 고치기는 메모 칸까지 고친다 — 메모를 안 넘기면 그대로 둔다', () => {
  const e = 엔진();
  e.call('단어붙여넣기', '1234', '중2 문장', 줄, false, '문장');
  assert.equal(e.call('단어수정', '1234', '중2 문장', 2, 'The boy=주 / kicked=동', '소년이 찼다', '89쪽').ok, true);
  assert.deepEqual((({ en, ko, 비고 }) => [en, ko, 비고])(e.call('단어목록', '1234', '중2 문장').단어들[0]), ['The boy=주 / kicked=동', '소년이 찼다', '89쪽']);
  e.call('단어수정', '1234', '중2 문장', 2, 'The boy=주 / kicked=동', '소년이 공을 찼다');
  assert.equal(e.call('단어목록', '1234', '중2 문장').단어들[0].비고, '89쪽');
});
test('문장 묶음과 단어장은 같은 이름으로 서로 덮지 않는다', () => {
  const e = 엔진();
  e.call('단어붙여넣기', '1234', '교재A', 'apple | 사과', false, '');
  const r = e.call('단어붙여넣기', '1234', '교재A', 줄, true, '문장');
  assert.equal(r.ok, false); assert.match(r.메시지, /이름을 바꿔/);
  assert.equal(e.call('단어목록', '1234', '교재A').단어들[0].en, 'apple');
});

/* 화면 — 학생 고르개에는 안 뜨고, 선생님은 「문장」 탭에서 다룬다 */
test('학생 화면의 단어장 고르개(내책들)는 문장 묶음을 뺀다', () => {
  const html = read('../index.html');
  const from = html.indexOf('function 내책들(){');
  assert.ok(from > 0);
  assert.match(html.slice(from, html.indexOf('\n}', from)), /종류!=='문장'/);
});
test('선생님 화면에 「문장」 탭이 있고, 단어장 목록에서 문장 묶음을 떼어 둔다', () => {
  const html = read('../teacher.html');
  assert.match(html, /data-tab="sent" data-g="자료">문장</);
  assert.match(html, /else if\(T\.tab==='sent'\)\{ 문장탭_\(b, d\); \}/);
  assert.match(html, /문장책떼기_\(d, d\.단어장목록\)/);
});
