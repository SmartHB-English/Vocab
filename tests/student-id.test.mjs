import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';
import { 칸고치기, 줄지우기, 표꺼내기 } from '../services/table-edit.mjs';

/* 프롬프트 50 — 아이마다 안 바뀌는 학생번호. 붙이기만 하고 아무 데도 안 쓴다.
   엔진(Code.gs)은 TableStore 위에서 진짜로 돌리고, 「자료」 탭 고치기(table-edit)는 같은 표에 바로 */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = read('./fixtures/legacy/Code.gs');
const 일반 = x => JSON.parse(JSON.stringify(x));
const 비번 = '5678';
const 꼴 = /^s_[0-9a-f]{12}$/;

function 엔진(학생줄들) {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 비번]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);   // 예전 표 — 11칸
  for (const r of 학생줄들 || [['월수금', '홍길동'], ['', '김영희'], ['화목', '박지훈']]) 학생.appendRow([r[0], r[1], '1234', '', '', '중2', '', '', '', '', '', ...(r[2] ? [r[2]] : [])]);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  for (const n of ['기록', '기록보관', '숙제']) store.insertSheet(n).appendRow(['시각']);
  const 엔 = createRuntime(store, { now: () => Date.parse('2026-11-17T03:00:00Z') });
  return {
    store, 학생, call: (fn, ...args) => 일반(엔.call(fn, args)),
    번호들: () => 학생.getRange(2, 12, 학생.getLastRow() - 1, 1).getValues().map(x => x[0]),
    줄: 행 => 학생.getRange(행, 1, 1, 학생.getLastColumn()).getValues()[0],
    /* 저장소가 저장한 뒤처럼 — 차려 놓느라 쓴 표들을 깨끗하게 */
    깨끗이: () => store.getSheets().forEach(s => { s.dirty = false; }),
  };
}

test('1. 번호 없는 학생들에게 번호가 붙는다 — 머리글도 (11칸 → 12칸)', () => {
  const e = 엔진();
  e.깨끗이();
  assert.equal(e.call('학생번호채우기', '틀린비번').ok, false, '선생님만');
  assert.equal(e.학생.dirty, false, '틀린 비번이면 아무것도 안 쓴다');
  assert.deepEqual(e.call('학생번호채우기', 비번), { ok: true, 개수: 3 });
  assert.equal(e.학생.getRange(1, 12).getValue(), '학생번호');
  for (const n of e.번호들()) assert.match(n, 꼴);
});

test('2. 이미 번호가 있는 줄은 안 바뀐다', () => {
  const e = 엔진([['', '홍길동', 's_0123456789ab'], ['', '김영희'], ['', '박지훈', 's_ffffffffffff']]);
  e.학생.getRange(1, 12).setValue('학생번호');
  assert.deepEqual(e.call('학생번호채우기', 비번), { ok: true, 개수: 1 });
  const [가, 나, 다] = e.번호들();
  assert.equal(가, 's_0123456789ab');
  assert.match(나, 꼴);
  assert.equal(다, 's_ffffffffffff');
});

test('3. 두 번 불러도 안 바뀐다', () => {
  const e = 엔진();
  e.call('학생번호채우기', 비번);
  const 전 = e.번호들();
  assert.deepEqual(e.call('학생번호채우기', 비번), { ok: true, 개수: 0 });
  assert.deepEqual(e.번호들(), 전);
});

test('4. 번호가 서로 겹치지 않는다 — 무작위가 겹쳐 나와도 다시 뽑는다', () => {
  const 많이 = Array.from({ length: 200 }, (_, i) => ['', '학생' + i]);
  const e = 엔진(많이);
  e.call('학생번호채우기', 비번);
  const 번호 = e.번호들();
  assert.equal(new Set(번호).size, 200);

  /* 무작위가 이미 있는 번호를 내놓는다 — 겹치면 다시 뽑아야 한다 */
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  store.getSheetByName('설정').appendRow(['항목', '값']); store.getSheetByName('설정').appendRow(['선생님비밀번호', 비번]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디', '학생번호']);
  학생.appendRow(['', '홍길동', '1234', '', '', '', '', '', '', '', '', 's_aaaaaaaaaaaa']);
  학생.appendRow(['', '김영희', '1234', '', '', '', '', '', '', '', '', '']);
  학생.appendRow(['', '박지훈', '1234', '', '', '', '', '', '', '', '', '']);
  const 차례 = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
               'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'];
  const 엔 = createRuntime(store, { uuid: () => 차례.shift() });
  assert.deepEqual(일반(엔.call('학생번호채우기', [비번])), { ok: true, 개수: 2 });
  assert.deepEqual(학생.getRange(2, 12, 3, 1).getValues().map(x => x[0]), ['s_aaaaaaaaaaaa', 's_bbbbbbbbbbbb', 's_cccccccccccc']);
});

test('5. 채울 게 없으면 표를 다시 쓰지 않는다 — 머리글도 안 건드린다', () => {
  const e = 엔진();
  e.call('학생번호채우기', 비번);
  e.깨끗이();
  assert.deepEqual(e.call('학생번호채우기', 비번), { ok: true, 개수: 0 });
  assert.equal(e.학생.dirty, false);
  assert.equal(e.store.getSheets().some(s => s.dirty), false, '어느 표도 안 건드렸다');
  /* 이름 없는 빈 줄 · 학생이 아무도 없는 표도 마찬가지 */
  const 빈 = 엔진([]);
  빈.깨끗이();
  assert.deepEqual(빈.call('학생번호채우기', 비번), { ok: true, 개수: 0 });
  assert.equal(빈.학생.dirty, false);
  assert.equal(빈.학생.getMaxColumns() >= 12 && 빈.학생.getRange(1, 12).getValue() === '학생번호', false, '머리글을 붙이러 표를 쓰지도 않는다');
});

test('6. 이름 · 반 · 교재를 고쳐도 번호는 그대로다', () => {
  const e = 엔진();
  e.call('학생번호채우기', 비번);
  const 전 = e.번호들();
  assert.equal(e.call('학생수정', 비번, 2, { 이름: '홍길순', 학년구분: '초중등', 학년: '중3', 학교: '인왕중', 교재: ['교재A'] }).ok, true);
  e.학생.getRange(3, 1).setValue('토');      // 반을 옮겼다
  assert.equal(칸고치기(e.store, { 표: '학생', 행: 4, 열: 2, 전줄: e.줄(4), 값: '박지훈2' }).후, '박지훈2');
  assert.deepEqual(e.call('학생번호채우기', 비번), { ok: true, 개수: 0 });
  assert.deepEqual(e.번호들(), 전);
  assert.equal(e.줄(2)[1], '홍길순');
});

test('7. 칸고치기 로 학생번호를 바꾸려 하면 거부된다 — 비우기도', () => {
  const e = 엔진();
  e.call('학생번호채우기', 비번);
  const 전 = e.번호들();
  assert.throws(() => 칸고치기(e.store, { 표: '학생', 행: 2, 열: 12, 전줄: e.줄(2), 값: 's_000000000000' }), /이 칸은 고칠 수 없습니다/);
  assert.throws(() => 칸고치기(e.store, { 표: '학생', 행: 3, 열: 12, 전줄: e.줄(3), 값: '' }), /이 칸은 고칠 수 없습니다/);
  assert.deepEqual(e.번호들(), 전);
  /* 보이기는 한다 — 자료 탭으로 보내는 표에서 비우지 않는다 */
  const 표 = 표꺼내기(e.store, '학생');
  assert.equal(표.머리[11], '학생번호');
  assert.deepEqual(표.줄들.map(x => x[11]), 전);
});

test('8. 다른 칸(이름 · 반 · 교재)은 지금처럼 고쳐진다', () => {
  const e = 엔진();
  e.call('학생번호채우기', 비번);
  for (const [열, 값] of [[2, '홍길순'], [1, '토요반'], [8, '교재A | 교재B']]) {
    const r = 칸고치기(e.store, { 표: '학생', 행: 2, 열, 전줄: e.줄(2), 값 });
    assert.equal(r.후, 값);
    assert.equal(e.학생.getRange(2, 열).getValue(), 값);
  }
});

test('9. 학생 줄을 지우는 것은 막히지 않는다 — 남은 아이 번호는 그대로', () => {
  const e = 엔진();
  e.call('학생번호채우기', 비번);
  const [, 나, 다] = e.번호들();
  const r = 줄지우기(e.store, { 표: '학생', 줄들: [{ 행: 2, 전줄: e.줄(2) }] }, { 지금: Date.parse('2026-11-17T03:00:00Z') });
  assert.equal(r.지운.length, 1);
  assert.deepEqual(e.번호들(), [나, 다]);
  assert.deepEqual(e.call('학생번호채우기', 비번), { ok: true, 개수: 0 }, '지웠다고 남은 아이에게 다시 발급하지 않는다');
});

test('아무 데도 안 쓴다 — 로그인 답 · 학부모 · 기록 · 숙제 · 펫에 번호가 안 나간다', () => {
  const e = 엔진();
  e.call('학생번호채우기', 비번);
  const 번호 = e.번호들();
  const 답 = JSON.stringify(e.call('로그인', '홍길동', '1234'));
  assert.equal(JSON.parse(답).ok, true);
  for (const n of 번호) assert.equal(답.includes(n), false);
  /* 엔진 안에서 학생번호 칸을 읽는 곳은 채우기뿐 — 다시 발급하는 길도 없다 */
  const 몸 = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const 쓰는곳 = 몸.split('\n').filter(줄 => /학생번호열/.test(줄));
  assert.ok(쓰는곳.every(줄 => /학생번호열 = 12|학생번호열 - |학생번호열\)|학생번호열, |학생번호열 \?/.test(줄)), 쓰는곳.join('\n'));
  assert.equal((몸.match(/학생번호새로_\(/g) || []).length, 2, '만드는 함수 하나 · 부르는 곳 하나(학생번호채우기)');
  assert.match(code, /학생번호채우기: 학생번호채우기,/);
  assert.match(read('../services/firestore-repository.mjs'), /teacherLogin[\s\S]*?this\.call\('학생번호채우기'/);
});
