// 같은 범위 시험을 날을 달리해 다시 냈을 때 — 2026-11-24 1000-2 71~80.
// 11/19 에 본 아이들이 11/24 시험을 풀었는데 서버가 「이미 봤다」 며 막았다. 화면은 숙제코드로, 서버는 단어장 · 범위 글로 봐서
// 화면엔 「안 본 시험」, 저장은 거절. 이제 서버도 코드로 본다. 코드 없는 옛 기록은 지금처럼 글로 맞춘다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초',
  '숙제여부', '틀린단어', '구분', '집계제외', '이탈수', '이탈초', '복사시도', '숙제코드'];
function 판() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', '5678']);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재']);
  학생.appendRow(['', '홍길동', '1111', '', '', '', '', '교재A']);
  store.insertSheet('기록').appendRow(머리기록);
  store.insertSheet('기록보관').appendRow(머리기록);
  return store;
}
const 시험 = (코드, 더 = {}) => ({ 이름: '홍길동', 단어장: '교재A', 범위: '71~80', 유형: '스펠링', 문항수: 10, 정답수: 9, 점수: 90,
  숙제여부: true, 구분: '시험', 숙제코드: 코드, ...더 });
const 부르기 = (store, 값) => JSON.parse(JSON.stringify(createRuntime(store).call('결과저장', [값])));

test('같은 범위라도 다른 날 낸 시험(코드가 다르다)은 받는다', () => {
  const store = 판();
  assert.equal(부르기(store, 시험('h1aaaa')).ok, true);
  const 다시 = 부르기(store, 시험('h2bbbb'));
  assert.equal(다시.ok, true);
  assert.notEqual(다시.이미봄, true);
});

test('같은 시험(같은 코드)을 두 번 내면 두 번째는 막는다', () => {
  const store = 판();
  assert.equal(부르기(store, 시험('h1aaaa')).ok, true);
  const 두번 = 부르기(store, 시험('h1aaaa'));
  assert.deepEqual([두번.ok, 두번.이미봄], [false, true]);
});

test('코드 없는 옛 앱은 지금처럼 범위 글로 막는다', () => {
  const store = 판();
  assert.equal(부르기(store, 시험('')).ok, true);
  assert.equal(부르기(store, 시험('')).이미봄, true);
});

test('코드 없는 옛 기록이 있으면 같은 범위의 새 시험도 막는다 — 옛 앱으로 본 것을 새 앱으로 또 보지 못하게', () => {
  const store = 판();
  assert.equal(부르기(store, 시험('')).ok, true);
  assert.equal(부르기(store, 시험('h9zzzz')).이미봄, true);
});

test('기록보관으로 옮긴 시험도 코드로 본다', () => {
  const store = 판();
  store.getSheetByName('기록보관').appendRow([new Date(), '', '홍길동', '교재A', '71~80', '스펠링', 10, 9, 90, 0, 0, 60, 'O', '', '시험', '', 0, 0, 0, 'h1aaaa']);
  assert.equal(부르기(store, 시험('h1aaaa')).이미봄, true);
  assert.equal(부르기(store, 시험('h2bbbb')).ok, true);
});

test('오답 재시험 · 숙제는 이 판단을 거치지 않는다', () => {
  const store = 판();
  assert.equal(부르기(store, 시험('h1aaaa')).ok, true);
  assert.equal(부르기(store, 시험('', { 구분: '오답 재시험', 숙제여부: false })).ok, true);
  assert.equal(부르기(store, 시험('h1aaaa', { 구분: '' })).ok, true);
});
