// 비서 문 — 원장님 컴퓨터의 비서(work/비서)가 서비스 계정 키(bridge 자격)로 정해 둔 선생님 기능만 부른다.
// 비번은 밖에서 넣지 않는다. 엔진 안에서 설정 표의 선생님비밀번호를 그대로 쓴다 — 답에도 journal 에도 안 나간다.
// 열리는 것: 선생님기본 · 선생님기록 · 체크자료 · 숙제예약목록 · 다음숙제뽑기 · 진도숙제내기 · 명단가져오기 · 교재일괄(교재 칸만) · 해법단어장넣기(「해법 」 단어장만)
//          + 저장소 쪽 옛숙제정리 · 숙제예약정리(미리보기 → 확인값 → 휴지통). 이름 목록은 services/assistant-names.mjs 한 곳. 그 밖은 막힌다.
// bridge 만 연다 — 앱 · 브라우저(선생님 · 학생 · 아무나)로는 못 연다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { sheetId, unpack } from '../services/store-codec.mjs';
import { fakeDb } from './helpers/fake-firestore.mjs';

const 흉내 = new URL('./helpers/fake-firestore.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { return s === 'firebase/firestore' ? { url: ${JSON.stringify(흉내)}, shortCircuit: true } : n(s, c); }`));
const { FirestoreRepository, digest } = await import('../services/firestore-repository.mjs');
const { 비서엔진기능, 비서표기능 } = await import('../services/assistant-names.mjs');
const { 비서표함수, 옛숙제정리, 숙제예약정리 } = await import('../services/assistant-tables.mjs');

const 일반 = x => JSON.parse(JSON.stringify(x));
const 비번 = 'S3cret-9871';
const 열린것 = 비서엔진기능;
const 머리숙제 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류',
  '수업', '순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분', '학부모숨김', '문항수', '숙제코드'];
const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초',
  '숙제여부', '틀린단어', '구분', '집계제외', '이탈수', '이탈초', '복사시도', '숙제코드'];

function 판() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 비번]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재']);
  학생.appendRow(['', '홍길동', '1111', '', '', '', '', '교재A']);
  학생.appendRow(['', '김영희', '2222', '', '', '', '', '교재A']);
  const 목록 = store.insertSheet('단어장목록');
  목록.appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과', '하루몫', '소리']);
  목록.appendRow(['교재A', '', 'wA', '', '', '', 10, '']);
  const sh = store.insertSheet('wA'); sh.appendRow(['번호', '영어', '뜻']);
  for (let i = 1; i <= 40; i++) sh.appendRow([i, 'w' + i, '뜻' + i]);
  store.insertSheet('숙제').appendRow(머리숙제);
  store.insertSheet('기록').appendRow(머리기록);
  store.insertSheet('기록보관').appendRow(머리기록);
  return store;
}
const 숙제줄들 = store => { const sh = store.getSheetByName('숙제'); const n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, 20).getValues() : []; };

test('엔진 — 비서 문은 비번 없이 정해 둔 기능을 부른다', () => {
  const store = 판();
  const 엔 = createRuntime(store);
  const 뽑 = 일반(엔.assistant('다음숙제뽑기', [['홍길동', '김영희']]));
  assert.equal(뽑.ok, true);
  assert.deepEqual(뽑.줄들.map(x => [x.이름, x.시작, x.끝, x.까닭, x.낼까]),
    [['홍길동', 1, 10, '처음', true], ['김영희', 1, 10, '처음', true]]);
  const 낸 = 일반(엔.assistant('진도숙제내기', [[{ 이름: '홍길동', 단어장: '교재A', 시작: 1, 끝: 10 }], { 유형: '스펠링', 종류: '당일' }]));
  assert.deepEqual([낸.ok, 낸.낸수], [true, 1]);
  assert.deepEqual(숙제줄들(store).map(x => [x[1], x[2], x[3], x[7]]), [['교재A', 1, 10, '홍길동']]);
  assert.equal(일반(엔.assistant('숙제예약목록', [])).ok, true);
});

test('엔진 — 목록 밖의 기능은 막힌다 (설정 · 학생 고치기 · 없는 이름)', () => {
  const 엔 = createRuntime(판());
  for (const fn of ['설정저장', '학생추가', '선생님로그인', '학생번호채우기', '숙제예약저장', '아무거나', '__예약숙제']) {
    const r = 일반(엔.assistant(fn, []));
    assert.equal(r.ok, false, fn + ' 은 막혀야 한다');
    assert.match(r.메시지, /비서가 부를 수 없는 기능/);
  }
});

test('엔진 — 열린 아홉은 전부 열린기능_ 에 있고 첫 칸이 비번이다', () => {
  const code = readFileSync(new URL('./fixtures/legacy/Code.gs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  for (const fn of 열린것) {
    assert.match(code, new RegExp(`  ${fn}: ${fn},`), fn + ' 은 열린기능_ 에');
    assert.match(code, new RegExp(`function ${fn}\\(비번[,)]`), fn + ' 의 첫 칸은 비번');
  }
  assert.deepEqual(열린것, ['선생님기본', '선생님기록', '체크자료', '숙제예약목록', '다음숙제뽑기', '진도숙제내기', '명단가져오기', '교재일괄', '해법단어장넣기']);
  const 만들기 = readFileSync(new URL('../scripts/build-legacy.mjs', import.meta.url), 'utf8');
  assert.ok(만들기.includes('${JSON.stringify(비서엔진기능)}.includes(name)'), 'build-legacy 는 assistant-names 의 목록을 박는다');
  const 엔진 = readFileSync(new URL('../services/legacy-engine.generated.mjs', import.meta.url), 'utf8');
  assert.ok(엔진.includes(JSON.stringify(열린것) + '.includes(name)'), '엔진에 박힌 목록이 같다');
});

/* ---------------- 해법 단어장 · 한 아이 숙제 두 줄 ---------------- */
const 목록줄 = (store, 이름) => {
  const sh = store.getSheetByName('단어장목록');
  return sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues().filter(x => x[0] === 이름);
};
const 학생교재 = store => { const sh = store.getSheetByName('학생'); return sh.getRange(2, 8, sh.getLastRow() - 1, 1).getValues().map(x => x[0]); };
const 본문 = n => Array.from({ length: n }, (_, i) => `h${i + 1} | 해${i + 1}`).join('\n');

test('엔진 — 해법단어장넣기 는 새로 만들고, 다시 넣으면 통째로 바뀐다', () => {
  const store = 판();
  const 엔 = createRuntime(store);
  const 새 = 일반(엔.assistant('해법단어장넣기', ['해법 I2_30_2', 본문(6), 6]));
  assert.deepEqual(새, { ok: true, 개수: 6, 새로만듦: true });
  assert.ok(일반(엔.call('시작정보', [])).단어장목록.some(b => b.이름 === '해법 I2_30_2' && b.개수 === 6), '단어장목록에 생긴다');
  const 줄 = 목록줄(store, '해법 I2_30_2');
  assert.equal(줄.length, 1);
  assert.equal(줄[0][1], '');
  assert.equal(Number(줄[0][4]), 6, '레슨 묶음');
  assert.equal(엔.call('단어가져오기', ['해법 I2_30_2']).length, 6);
  const 다시 = 일반(엔.assistant('해법단어장넣기', ['해법 I2_30_2', 'x1 | 엑스1\nx2 | 엑스2\nx3 | 엑스3']));
  assert.deepEqual(다시, { ok: true, 개수: 3, 새로만듦: false });
  const 단어 = 일반(엔.call('단어가져오기', ['해법 I2_30_2']));
  assert.deepEqual(단어.map(w => [w.no, w.en]), [[1, 'x1'], [2, 'x2'], [3, 'x3']], '덧붙지 않고 바뀐다');
  assert.equal(목록줄(store, '해법 I2_30_2').length, 1);
  assert.equal(Number(목록줄(store, '해법 I2_30_2')[0][4]), 6, '레슨크기를 안 주면 그대로');
  assert.deepEqual(학생교재(store), ['교재A', '교재A'], '아이 교재 칸은 그대로');
});

test('엔진 — 해법단어장넣기 는 「해법 」 아닌 이름 · 과 단어장을 거절한다', () => {
  const store = 판();
  const 목록 = store.getSheetByName('단어장목록');
  목록.appendRow(['1000-2', '', 'w1000', '', '', '', '', '']);
  const w = store.insertSheet('w1000'); w.appendRow(['번호', '영어', '뜻']); w.appendRow([1, 'apple', '사과']);
  목록.appendRow(['해법 과책', '과', 'w과', '', '', '', '', '']);
  store.insertSheet('w과').appendRow(['번호', '구분', '영어', '뜻·해석', '비고']);
  const 엔 = createRuntime(store);
  for (const 이름 of ['1000-2', '교재A', '해법', '해법I2', '']) {
    const r = 일반(엔.assistant('해법단어장넣기', [이름, 본문(3)]));
    assert.equal(r.ok, false, 이름 + ' 은 거절');
    assert.match(r.메시지, /해법 /);
  }
  assert.deepEqual(일반(엔.call('단어가져오기', ['1000-2'])).map(x => x.en), ['apple'], '원래 단어장 그대로');
  assert.equal(엔.call('단어가져오기', ['교재A']).length, 40);
  const 과 = 일반(엔.assistant('해법단어장넣기', ['해법 과책', 본문(3)]));
  assert.equal(과.ok, false);
  assert.equal(목록줄(store, '해법 과책')[0][1], '과');
  assert.equal(일반(엔.assistant('해법단어장넣기', ['해법 I2', 본문(3), 0])).ok, false, '레슨크기가 틀리면 아무것도 안 넣는다');
  assert.equal(목록줄(store, '해법 I2').length, 0);
});

test('엔진 — 진도숙제내기: 한 아이에 해법 한 줄 + 학년 한 줄, 같은 교재 두 줄은 막고 시험은 하나만', () => {
  const store = 판();
  const 엔 = createRuntime(store);
  assert.equal(일반(엔.assistant('해법단어장넣기', ['해법 I2_30_2', 본문(12), 6])).ok, true);
  const 낸 = 일반(엔.assistant('진도숙제내기', [[
    { 이름: '홍길동', 단어장: '해법 I2_30_2', 시작: 1, 끝: 6 },
    { 이름: '홍길동', 단어장: '교재A', 시작: 1, 끝: 9 },
    { 이름: '홍길동', 단어장: '교재A', 시작: 10, 끝: 18 },
    { 이름: '김영희', 단어장: '교재A', 시작: 1, 끝: 9 }
  ], { 유형: '스펠링', 종류: '당일' }, { 이름들: ['홍길동'], 날짜: '2099-01-05', 시각: '15:00' }]));
  assert.equal(낸.ok, true);
  assert.equal(낸.낸수, 3);
  assert.equal(낸.시험수, 1);
  assert.deepEqual(낸.못낸, [{ 이름: '홍길동', 까닭: '같은 아이 같은 교재가 두 번 들어 있어요' }]);
  assert.deepEqual(숙제줄들(store).map(x => [x[1], x[2], x[3], x[7]]),
    [['해법 I2_30_2', 1, 6, '홍길동'], ['교재A', 1, 9, '홍길동'], ['교재A', 1, 9, '김영희']]);
  const 예약 = 일반(엔.assistant('숙제예약목록', []));
  assert.equal(예약.예약.length, 1, '시험 예약은 아이당 하나');
  assert.equal(JSON.parse(예약.예약[0].내용).단어장, '해법 I2_30_2', '시험은 그 아이 첫 줄에 건다');
});

test('엔진 — 해법 숙제를 받은 아이가 단어를 받고, 해법 기록이 학년 진도를 흐리지 않는다', () => {
  const store = 판();
  const 엔 = createRuntime(store);
  assert.equal(일반(엔.assistant('해법단어장넣기', ['해법 I2_30_2', 본문(6)])).ok, true);
  const 낸 = 일반(엔.assistant('진도숙제내기', [[
    { 이름: '홍길동', 단어장: '해법 I2_30_2', 시작: 1, 끝: 6 },
    { 이름: '홍길동', 단어장: '교재A', 시작: 1, 끝: 9 }
  ], { 유형: '스펠링', 종류: '당일' }]));
  assert.equal(낸.낸수, 2);
  const 숙 = 일반(엔.call('숙제가져오기', ['홍길동']));
  const 목 = Array.isArray(숙) ? 숙 : (숙.숙제 || 숙.숙제들 || []);
  assert.ok(목.some(h => h.단어장 === '해법 I2_30_2'), '해법 숙제가 아이에게 보인다');
  const 단어 = 일반(엔.call('단어가져오기', ['해법 I2_30_2', '', 1, 6]));
  assert.equal(단어.length, 6, '볼 수 있는 단어장에 없어도 받는다');
  const 기록 = store.getSheetByName('기록');
  const 줄 = (책, 범위) => { const r = Array(20).fill(''); r[0] = new Date(Date.now() - 3600e3); r[2] = '홍길동'; r[3] = 책; r[4] = 범위;
    r[5] = '스펠링'; r[6] = 9; r[7] = 9; r[8] = 100; r[12] = 'O'; return r; };
  기록.appendRow(줄('해법 I2_30_2', '1~6'));
  기록.appendRow(줄('교재A', '1~9'));
  const 뽑 = 일반(createRuntime(store).assistant('다음숙제뽑기', [['홍길동']]));
  assert.deepEqual(뽑.줄들.map(x => [x.단어장, x.시작, x.끝]), [['교재A', 10, 19]]);
});

/* ---------------- 진도숙제내기 넷째 인자 예약 — 바로 안 내고 숙제예약 표에 아이마다 한 줄 (프롬프트 63) ---------------- */
const 서울 = t => new Date(t + '+09:00').getTime();
function 시계판(처음 = '2026-11-25T10:00:00') {
  const store = 판();
  store.getSheetByName('학생').appendRow(['', '박철수', '3333', '', '', '', '', '교재A']);
  let 시계 = 서울(처음);
  const 엔 = createRuntime(store, { now: () => 시계 });
  return { store, 엔, 비서: (fn, a) => 일반(엔.assistant(fn, a)), 때: t => { 시계 = 서울(t); } };
}
const 예약줄들 = store => {
  const sh = store.getSheetByName('숙제예약');
  const n = sh ? sh.getLastRow() - 1 : 0;
  return n > 0 ? sh.getRange(2, 1, n, 9).getValues() : [];
};
const 세줄 = [
  { 이름: '홍길동', 단어장: '교재A', 시작: 1, 끝: 10 },
  { 이름: '김영희', 단어장: '교재A', 시작: 11, 끝: 20 },
  { 이름: '박철수', 단어장: '교재A', 시작: 21, 끝: 30 }
];
const 공통값 = { 유형: '스펠링', 종류: '당일' };

test('예약 — 비었거나 안 주면 지금처럼 바로 나가고 예약 표는 그대로', () => {
  for (const 예약 of [undefined, null, {}]) {
    const e = 시계판();
    const 낸 = e.비서('진도숙제내기', [세줄.slice(0, 1), 공통값, null, 예약]);
    assert.deepEqual([낸.ok, 낸.낸수, 낸.예약수], [true, 1, undefined], String(예약));
    assert.equal(숙제줄들(e.store).length, 1);
    assert.equal(예약줄들(e.store).length, 0);
  }
});

test('예약 — 오늘 17:00 세 아이: 숙제 표는 그대로, 예약 표에 세 줄 · 한 묶음 · 내용이 아이마다 맞다', () => {
  const e = 시계판();
  const 낸 = e.비서('진도숙제내기', [세줄, 공통값, null, { 날짜: '2026-11-25', 시각: '17:00', 알림함께: true }]);
  assert.equal(낸.ok, true);
  assert.deepEqual([낸.낸수, 낸.예약수, 낸.못낸], [0, 3, []]);
  assert.match(낸.묶음, /^g[a-z0-9]{6}$/);
  assert.equal(숙제줄들(e.store).length, 0, '바로 나가지 않는다');
  const 줄 = 예약줄들(e.store);
  assert.equal(줄.length, 3);
  assert.deepEqual(줄.map(x => [x[1], x[2], x[5], x[6], x[8]]), Array(3).fill(['2026-11-25', '17:00', 'O', '', 낸.묶음]));
  assert.deepEqual(줄.map(x => { const h = JSON.parse(x[4]); return [h.단어장, h.시작, h.끝, h.학생들, h.유형, h.종류, h.마감일]; }), [
    ['교재A', 1, 10, ['홍길동'], '스펠링', '당일', ''],
    ['교재A', 11, 20, ['김영희'], '스펠링', '당일', ''],
    ['교재A', 21, 30, ['박철수'], '스펠링', '당일', '']
  ]);
  assert.ok(줄.every(x => !('바뀐줄만' in JSON.parse(x[4]))));
  const 목록 = e.비서('숙제예약목록', []).예약;
  assert.deepEqual(목록.map(n => n.받는이들).reverse(), [['홍길동'], ['김영희'], ['박철수']]);
});

test('예약 — 지난 날짜 · 22:00 은 하나도 안 건다', () => {
  for (const [날짜, 시각] of [['2026-11-24', '17:00'], ['2026-11-25', '22:00'], ['', '17:00'], ['2026-11-25', '']]) {
    const e = 시계판();
    const 낸 = e.비서('진도숙제내기', [세줄, 공통값, null, { 날짜, 시각 }]);
    assert.equal(낸.ok, false, 날짜 + ' ' + 시각);
    assert.match(낸.메시지, /^숙제 예약: /);
    assert.equal(예약줄들(e.store).length, 0);
    assert.equal(숙제줄들(e.store).length, 0);
  }
});

test('예약 — 단어장을 못 찾는 줄 하나는 못낸, 나머지는 걸린다 · 같은 아이 다른 단어장 두 줄도 된다', () => {
  const e = 시계판();
  assert.equal(e.비서('해법단어장넣기', ['해법 I2_30_2', 본문(12), 6]).ok, true);
  const 낸 = e.비서('진도숙제내기', [[
    { 이름: '홍길동', 단어장: '해법 I2_30_2', 시작: 1, 끝: 6 },
    { 이름: '홍길동', 단어장: '교재A', 시작: 1, 끝: 9 },
    { 이름: '홍길동', 단어장: '교재A', 시작: 10, 끝: 18 },
    { 이름: '김영희', 단어장: '없는책', 시작: 1, 끝: 9 },
    { 이름: '박철수', 단어장: '교재A', 시작: 1, 끝: 9 }
  ], 공통값, null, { 날짜: '2026-11-26', 시각: '08:00' }]);
  assert.equal(낸.ok, true);
  assert.equal(낸.예약수, 3);
  assert.deepEqual(낸.못낸, [
    { 이름: '홍길동', 까닭: '같은 아이 같은 교재가 두 번 들어 있어요' },
    { 이름: '김영희', 까닭: '교재를 단어장에서 못 찾았어요' }
  ]);
  assert.deepEqual(예약줄들(e.store).map(x => { const h = JSON.parse(x[4]); return [h.학생들[0], h.단어장, h.시작]; }),
    [['홍길동', '해법 I2_30_2', 1], ['홍길동', '교재A', 1], ['박철수', '교재A', 1]]);
});

test('예약 + 시험 — 시험도 따로 걸리고 숙제 예약과 한 묶음', () => {
  const e = 시계판();
  const 낸 = e.비서('진도숙제내기', [세줄.slice(0, 2), 공통값, { 이름들: ['김영희'], 날짜: '2026-11-28', 시각: '15:00' },
    { 날짜: '2026-11-25', 시각: '17:00' }]);
  assert.deepEqual([낸.ok, 낸.낸수, 낸.예약수, 낸.시험수, 낸.못낸], [true, 0, 2, 1, []]);
  assert.equal(숙제줄들(e.store).length, 0);
  const 줄 = 예약줄들(e.store);
  assert.equal(줄.length, 3);
  assert.ok(줄.every(x => x[8] === 낸.묶음));
  const 시험 = 줄.map(x => JSON.parse(x[4])).filter(h => h.종류 === '시험');
  assert.deepEqual(시험.map(h => [h.학생들, h.시작, h.끝, h.마감일]), [[['김영희'], 11, 20, '2026-11-28']]);
});

test('예약 — 그 시각에 scheduledHomework 가 아이마다 한 줄씩 내고, 선생님 화면에서 건 예약과 똑같이 나간다', () => {
  const e = 시계판();
  e.비서('진도숙제내기', [세줄, { ...공통값, 문항수: 15 }, null, { 날짜: '2026-11-25', 시각: '17:00' }]);
  /* 맞대 볼 것 — 선생님 화면 「숙제 예약」 이 보내는 꾸러미 (teacher.html 숙제예약걸기_) 로 김영희 한 줄 */
  const t = 시계판();
  assert.equal(일반(t.엔.call('숙제예약저장', [비번, '', { 날짜: '2026-11-25', 시각: '17:00', 알림함께: false,
    내용: { 단어장: '교재A', 시작: 11, 끝: 20, 유형: '스펠링', 종류: '당일', 마감일: '', 문항수: 15, 학생들: ['김영희'], 칸: '', 바뀐줄만: true } }])).ok, true);
  assert.equal(예약줄들(e.store)[1][3], 예약줄들(t.store)[0][3], '요약이 같다');
  e.때('2026-11-25T16:55:00');
  assert.equal(일반(e.엔.scheduledHomework(서울('2026-11-25T16:55:00'))).찍은수, 0, '아직 이르다');
  e.때('2026-11-25T17:05:00'); t.때('2026-11-25T17:05:00');
  일반(e.엔.scheduledHomework(서울('2026-11-25T17:05:00')));
  일반(t.엔.scheduledHomework(서울('2026-11-25T17:05:00')));
  const 낸 = 숙제줄들(e.store);
  assert.deepEqual(낸.map(x => [x[1], x[2], x[3], x[7]]), [['교재A', 1, 10, '홍길동'], ['교재A', 11, 20, '김영희'], ['교재A', 21, 30, '박철수']]);
  assert.ok(예약줄들(e.store).every(x => x[6] && !String(x[6]).includes('못 냄')), '보낸때가 찍히고 못 냄이 없다');
  const 뺀 = r => r.filter((_, i) => i !== 6 && i !== 19);          // 등록시각 · 숙제코드 는 그때마다 다르다
  assert.deepEqual(뺀(낸[1]), 뺀(숙제줄들(t.store)[0]), '선생님 화면에서 건 예약과 같은 숙제 줄');
});

/* ---------------- 저장소 쪽 — bridge 만 ---------------- */
async function 저장소판(store) {
  const db = fakeDb();
  const { documents } = await createDatasetDocuments(store, { digest });
  for (const [path, data] of documents) db.docs.set(`vocabDatasets/t/${path}`, data);
  return db;
}
const 표 = (db, name) => unpack(db.docs.get(`vocabDatasets/t/tables/${sheetId(name)}`).payload);

test('__비서 — bridge 거래 안에서 숙제가 들어가고, journal · 답 어디에도 비번이 없다', async () => {
  const db = await 저장소판(판());
  const 비서 = new FirestoreRepository(db, 't', { role: 'bridge', user: { uid: 'assistant' } });
  const 뽑 = await 비서.call('__비서', ['다음숙제뽑기', [['홍길동']]]);
  assert.equal(뽑.ok, true);
  assert.equal(뽑.줄들[0].끝, 10);
  const 낸 = await 비서.call('__비서', ['진도숙제내기', [[{ 이름: '홍길동', 단어장: '교재A', 시작: 1, 끝: 10 }], { 유형: '스펠링', 종류: '당일' }]]);
  assert.deepEqual([낸.ok, 낸.낸수], [true, 1]);
  assert.equal(표(db, '숙제').cells['2:8']?.value, '홍길동');
  const 막 = await 비서.call('__비서', ['설정저장', [{ 학원이름: 'x' }]]);
  assert.equal(막.ok, false);
  const journal = [...db.docs.entries()].filter(([k]) => /\/journal\/[^/]+$/.test(k)).map(([, v]) => JSON.stringify(v));
  assert.ok(journal.length > 0);
  assert.ok(!journal.some(j => j.includes(비번)), 'journal 에 비번이 없다');
  assert.ok(!JSON.stringify([뽑, 낸, 막]).includes(비번), '답에 비번이 없다');
});

test('__비서 는 bridge 만 — 선생님 · 아무나 는 못 연다', async () => {
  const db = await 저장소판(판());
  const 선생님 = new FirestoreRepository(db, 't', { user: { uid: 'teacher-uid-abc', getIdToken: async () => '' } });
  assert.deepEqual(await 선생님.call('선생님로그인', [비번]), { ok: true });
  assert.equal((await 선생님.call('__비서', ['다음숙제뽑기', [['홍길동']]])).ok, false);
  const 아무나 = new FirestoreRepository(db, 't', { user: { uid: 'anon-uid-abc', getIdToken: async () => '' } });
  assert.equal((await 아무나.call('__비서', ['다음숙제뽑기', [['홍길동']]])).ok, false);
});

/* ---------------- 옛 숙제 · 숙제 예약 정리 — 저장소 쪽, 휴지통으로 ---------------- */
const 날전 = 일 => new Date(Date.now() - 일 * 86400000);
function 숙제판() {
  const store = 판();
  const 숙 = store.getSheetByName('숙제');
  const 줄 = (책, 마감) => { const r = Array(20).fill(''); r[1] = 책; r[2] = 1; r[3] = 10; r[4] = '스펠링'; r[5] = 마감; r[6] = 날전(50); r[7] = '홍길동'; r[8] = '당일'; return r; };
  숙.appendRow(줄('교재A', 날전(40)));
  숙.appendRow(줄('교재A', 날전(10)));
  숙.appendRow(줄('교재A', ''));
  숙.appendRow(줄('교재A', 날전(41)));
  숙.appendRow(줄('교재A', '언젠가'));
  const 기록 = store.getSheetByName('기록');
  const r = Array(20).fill(''); r[0] = 날전(40); r[2] = '홍길동'; r[3] = '교재A'; r[4] = '1~10'; r[8] = 100;
  기록.appendRow(r);
  const 예 = store.insertSheet('숙제예약');
  예.appendRow(['만든때', '날짜', '시각', '요약', '내용', '알림함께', '보낸때', '켬', '묶음']);
  예.appendRow([날전(5), '2026-11-20', '15:00', '홍길동 교재A', '{}', '', 날전(4), 'O', 'b1']);
  예.appendRow([날전(1), '2099-01-01', '15:00', '김영희 교재A', '{}', '', '', 'O', 'b2']);
  예.appendRow([날전(1), '2099-01-02', '15:00', '홍길동 교재A', '{}', '', '못 냄 — 까닭', 'O', 'b3']);
  return store;
}

test('옛숙제정리 · 숙제예약정리 는 비서 이름 목록 한 곳에 있다', () => {
  assert.deepEqual(Object.keys(비서표함수), 비서표기능);
  assert.ok(!비서엔진기능.some(n => 비서표기능.includes(n)), '엔진 쪽과 겹치지 않는다');
});

test('옛숙제정리 — 마감이 30일 넘게 지난 날짜 줄만 고른다 (빈칸 · 날짜 아닌 것 · 10일 전은 빼고)', () => {
  const r = 일반(옛숙제정리(숙제판(), [30, false]));
  assert.equal(r.ok, true);
  assert.equal(r.개수, 2);
  assert.deepEqual(r.줄들.map(j => j.행), [2, 5]);
  assert.equal(r.줄들[0].범위, '1~10');
  assert.equal(r.줄들[0].학생, '홍길동');
  assert.match(r.확인값, /^[0-9a-f]{16}$/);
  assert.equal(일반(옛숙제정리(숙제판(), [])).개수, 2, '일수 기본값 30');
});

test('숙제예약정리 — 보낸것 은 보낸때 찬 줄만, 전부 는 다', () => {
  const store = 숙제판();
  const 보낸 = 일반(숙제예약정리(store, ['보낸것', false]));
  assert.deepEqual(보낸.줄들.map(j => j.묶음), ['b1', 'b3']);
  const 전부 = 일반(숙제예약정리(숙제판(), ['전부', false]));
  assert.deepEqual(전부.줄들.map(j => j.묶음), ['b1', 'b2', 'b3']);
  assert.equal(일반(숙제예약정리(숙제판(), ['아무거나', false])).ok, false);
  const 지움 = 일반(숙제예약정리(store, ['보낸것', true, 보낸.확인값]));
  assert.deepEqual([지움.ok, 지움.개수], [true, 2]);
  assert.equal(store.getSheetByName('숙제예약').getLastRow(), 2);
  assert.equal(store.getSheetByName('휴지통').getLastRow(), 3);
});

test('정리 — 301줄이면 안 지운다', () => {
  const store = 판();
  const 숙 = store.getSheetByName('숙제');
  for (let i = 0; i < 301; i++) { const r = Array(20).fill(''); r[1] = '교재A'; r[2] = 1; r[3] = 2; r[5] = 날전(60); 숙.appendRow(r); }
  const 봄 = 일반(옛숙제정리(store, [30, false]));
  assert.equal(봄.ok, false);
  assert.match(봄.메시지, /너무 많아요/);
  const 지움 = 일반(옛숙제정리(store, [30, true, 'x']));
  assert.equal(지움.ok, false);
  assert.equal(숙.getLastRow(), 302);
  assert.equal(store.getSheetByName('휴지통'), null);
});

test('__비서 옛숙제정리 — 미리보기 뒤 숙제가 늘면 안 지우고, 확인값이 맞으면 휴지통으로 · 되살리기 · 기록은 그대로', async () => {
  const db = await 저장소판(숙제판());
  const 비서 = new FirestoreRepository(db, 't', { role: 'bridge', user: { uid: 'assistant' } });
  const 기록수 = () => 표(db, '기록').cells ? Object.keys(표(db, '기록').cells).filter(k => k.endsWith(':1')).length : 0;
  const 기록전 = 기록수();
  const 봄 = await 비서.call('__비서', ['옛숙제정리', [30, false]]);
  assert.deepEqual([봄.ok, 봄.개수], [true, 2]);
  assert.equal(표(db, '숙제').cells['2:6'] !== undefined, true);

  /* 그 사이 숙제가 하나 더 나갔다 — 위에 끼면 줄이 밀린다 */
  const 낸 = await 비서.call('__비서', ['진도숙제내기', [[{ 이름: '김영희', 단어장: '교재A', 시작: 1, 끝: 10 }], { 유형: '스펠링', 종류: '당일' }]]);
  assert.equal(낸.낸수, 1);
  const 바뀜 = await 비서.call('__비서', ['옛숙제정리', [30, true, 봄.확인값]]);
  assert.equal(바뀜.ok, false);
  assert.match(바뀜.메시지, /그 사이 숙제 표가 바뀌었어요/);
  const 숙제수 = () => { const c = 표(db, '숙제').cells; return Math.max(...Object.keys(c).filter(k => c[k].value !== '' && c[k].value != null).map(k => Number(k.split(':')[0]))); };
  assert.equal(숙제수(), 7, '하나도 안 지웠다');

  const 다시 = await 비서.call('__비서', ['옛숙제정리', [30, false]]);
  const 지움 = await 비서.call('__비서', ['옛숙제정리', [30, true, 다시.확인값]]);
  assert.deepEqual([지움.ok, 지움.개수], [true, 2]);
  assert.equal(숙제수(), 5);
  const 통 = 표(db, '휴지통').cells;
  assert.equal(통['2:2'].value, '숙제');
  assert.equal(통['2:8'].value, '비서');
  assert.equal(통['3:8'].value, '비서');
  assert.equal(통['4:1'], undefined, '휴지통에 두 줄');
  assert.equal(기록수(), 기록전, '기록 표는 그대로');
  const journal = [...db.docs.entries()].filter(([k]) => /\/journal\/[^/]+$/.test(k)).map(([, v]) => v).filter(v => v.fn === '__비서' && v.누가 === '비서');
  assert.equal(journal.length, 1);
  assert.equal(journal[0].표, '숙제');
  assert.match(journal[0].result, /교재A/, 'journal 에 지운 줄');

  const 선생님 = new FirestoreRepository(db, 't', { user: { uid: 'teacher-uid-abc', getIdToken: async () => '' } });
  assert.deepEqual(await 선생님.call('선생님로그인', [비번]), { ok: true });
  const 살림 = await 선생님.call('__자료되살리기', [{ 번호들: 지움.지운.map(j => j.번호) }]);
  assert.equal(살림.ok, true);
  assert.equal(숙제수(), 7);
  assert.equal(표(db, '숙제').cells['2:2'].value, '교재A');
  assert.ok(표(db, '숙제').cells['2:6'].value, '마감일이 돌아왔다');
});

test('옛숙제정리 · 숙제예약정리 는 선생님 · 학생 · 아무나 로는 못 부른다', async () => {
  const db = await 저장소판(숙제판());
  const 선생님 = new FirestoreRepository(db, 't', { user: { uid: 'teacher-uid-abc', getIdToken: async () => '' } });
  assert.deepEqual(await 선생님.call('선생님로그인', [비번]), { ok: true });
  const 학생 = new FirestoreRepository(db, 't', { user: { uid: 'student-uid-abc', getIdToken: async () => '' } });
  assert.equal((await 학생.call('로그인', ['홍길동', '1111'])).ok, true);
  const 아무나 = new FirestoreRepository(db, 't', { user: { uid: 'anon-uid-abc', getIdToken: async () => '' } });
  for (const 누구 of [선생님, 학생, 아무나]) {
    for (const [fn, a] of [['옛숙제정리', [30, false]], ['숙제예약정리', ['전부', false]]]) {
      assert.equal((await 누구.call('__비서', [fn, a])).ok, false);
      await assert.rejects(() => 누구.call(fn, a), /쓸 수 없는 기능/);
    }
  }
});
