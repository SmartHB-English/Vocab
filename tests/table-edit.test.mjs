// 「자료」 탭의 표 고치기 규칙 (services/table-edit.mjs) — 저장소 없이 표(TableStore)만으로.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TableStore } from '../services/table-store.mjs';
import { 값맞추기, 서울날짜, 칸고치기, 줄지우기, 휴지통비우기, 자료표목록, 고칠수있나 } from '../services/table-edit.mjs';

const 하루 = 86400000;
function 표들() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  store.getSheetByName('설정').appendRow(['항목', '값']);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호']); 학생.appendRow(['월수금', '홍길동', 1234]);
  const 점수 = store.insertSheet('점수');
  점수.appendRow(['날짜', '반', '이름', '시험명', '점수']); 점수.appendRow(['', '', '홍길동', '10월', 80]);
  return store;
}

test('값 맞추기 — 숫자 칸은 숫자로, 「0011」 같은 비밀번호는 글로, 날짜는 서울 시각으로', () => {
  assert.equal(값맞추기(90, '55'), 55);
  assert.equal(값맞추기(1234, '0011'), '0011');
  assert.equal(값맞추기('', '85'), 85);
  assert.equal(값맞추기('글', '85'), '85');
  assert.equal(값맞추기(80, ''), '');
  assert.equal(값맞추기(true, 'false'), false);
  assert.equal(값맞추기(new Date(), '2026-10-07 21:05').toISOString(), '2026-10-07T12:05:00.000Z');
  assert.equal(값맞추기('', '2026-10-07', '마감일').toISOString(), '2026-10-06T15:00:00.000Z');
  assert.equal(값맞추기('', '2026-10-07', '시험명'), '2026-10-07');
  assert.equal(서울날짜('엉뚱'), null);
});

test('고칠 수 있는 표 — 설정 · 휴지통 · 계산 결과(시상 등)는 「자료」 에서 안 고친다', () => {
  const store = 표들();
  store.insertSheet('시상');
  assert.deepEqual(자료표목록(store).map(t => t.이름), ['학생', '점수']);
  assert.equal(고칠수있나(store, '설정'), false);
  assert.throws(() => 칸고치기(store, { 표: '설정', 행: 2, 열: 2, 전줄: [], 값: 'x' }), /고칠 수 없는 표/);
  assert.throws(() => 칸고치기(store, { 표: '시상', 행: 2, 열: 1, 전줄: [], 값: 'x' }), /고칠 수 없는 표/);
});

test('머리글(1행)은 안 고치고 안 지운다', () => {
  const store = 표들();
  assert.throws(() => 칸고치기(store, { 표: '점수', 행: 1, 열: 5, 전줄: ['날짜', '반', '이름', '시험명', '점수'], 값: '총점' }), /맞지 않/);
  assert.throws(() => 줄지우기(store, { 표: '점수', 줄들: [{ 행: 1, 전줄: [] }] }), /맞지 않/);
});

test('줄 비교는 뒤의 빈 칸을 안 센다 — 표 폭이 늘어도 같은 줄', () => {
  const store = 표들();
  const 줄 = ['', '', '홍길동', '10월', 80];
  store.getSheetByName('점수').getRange(3, 7).setValue('다른 줄이 칸을 늘렸다');
  const 답 = 칸고치기(store, { 표: '점수', 행: 2, 열: 5, 전줄: 줄, 값: '95' });
  assert.equal(답.후, 95);
});

test('휴지통 비우기 — 30일 지난 줄만 비운다', () => {
  const store = 표들();
  const 지금 = Date.parse('2026-11-20T00:00:00Z');
  줄지우기(store, { 표: '점수', 줄들: [{ 행: 2, 전줄: ['', '', '홍길동', '10월', 80] }] }, { 지금: 지금 - 31 * 하루 });
  줄지우기(store, { 표: '학생', 줄들: [{ 행: 2, 전줄: ['월수금', '홍길동', 1234] }] }, { 지금: 지금 - 29 * 하루 });
  const 통 = store.getSheetByName('휴지통');
  assert.equal(통.getLastRow(), 3);
  통.dirty = false;
  assert.deepEqual(휴지통비우기(store, {}, { 지금 }), { 비운: 1 });
  assert.equal(통.getLastRow(), 2);
  assert.equal(통.getRange(2, 2).getValue(), '학생');
  통.dirty = false;
  assert.deepEqual(휴지통비우기(store, {}, { 지금 }), { 비운: 0 });
  assert.equal(통.dirty, false);                                    // 비울 게 없으면 표를 안 건드린다 → 저장 안 함
});

test('지운 학생 줄 — 비밀번호는 「비밀」 칸으로 따로, 「내용」 에는 비운다', () => {
  const store = 표들();
  줄지우기(store, { 표: '학생', 줄들: [{ 행: 2, 전줄: ['월수금', '홍길동', 1234] }] });
  const [, , , 내용, , 비밀] = store.getSheetByName('휴지통').getRange(2, 1, 1, 8).getValues()[0];
  assert.deepEqual(JSON.parse(내용), ['월수금', '홍길동', '']);
  assert.deepEqual(JSON.parse(비밀), { 3: 1234, 9: '' });
});
