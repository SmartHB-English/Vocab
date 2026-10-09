import test from 'node:test';
import assert from 'node:assert/strict';
import { legacy, plain, record } from './helpers/legacy-server.mjs';

/* 「지금」 은 2026-10-07(수) 21:00 서울 — 어제 10-06, 이번 주 월요일 10-05 */
function 숙제(마감일, 완료, 덧 = {}) {
  return { 단어장: '교재A', 칸: '', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '기한', 완료, 마감일, 등록일: 마감일, ...덧 };
}
function 학부모(숙제들, 기록들 = []) {
  const ctx = legacy({ 기록: 기록들 });
  ctx.숙제가져오기_ = () => structuredClone(숙제들);
  return plain(ctx.학부모자료_('테스트학생', null));
}
const 마감들 = r => r.이번주숙제.map(h => h.마감일 + (h.완료 ? ' 냄' : ' 안냄'));

test('어제 마감으로 낸 숙제는 목록에 있다', () => {
  assert.deepEqual(마감들(학부모([숙제('2026-10-06', true)])), ['2026-10-06 냄']);
});

test('이틀 전 마감으로 낸 숙제는 목록에서 빠진다', () => {
  assert.deepEqual(마감들(학부모([숙제('2026-10-05', true)])), []);
});

test('이틀 전 마감인데 안 낸 숙제는 목록에 남는다', () => {
  const r = 학부모([숙제('2026-10-05', false)]);
  assert.deepEqual(마감들(r), ['2026-10-05 안냄']);
  assert.equal(r.안낸수, 1);
});

test('목록에서 빠진 낸 숙제도 「N/M 냈어요」 에는 든다 — 한 주 전체로 센다', () => {
  const r = 학부모([숙제('2026-10-05', true), 숙제('2026-10-07', false)]);
  assert.deepEqual(마감들(r), ['2026-10-07 안냄']);
  assert.equal(r.낸수, 1);
  assert.equal(r.안낸수, 1);
  assert.equal(학부모([숙제('2026-10-05', true)]).낸수, 1);
});

test('지난주 숙제는 수에도 목록에도 안 든다', () => {
  const r = 학부모([숙제('2026-10-02', true), 숙제('2026-10-02', false)]);
  assert.deepEqual([r.이번주숙제.length, r.낸수, r.안낸수], [0, 0, 0]);
});

test('날짜가 이틀 지난 안 본 시험은 「시험」 에 없고, 어제 · 앞으로 볼 시험은 있다', () => {
  const r = 학부모([
    숙제('2026-10-05', false, { 종류: '시험', 단어장: '교재B' }),
    숙제('2026-10-06', false, { 종류: '시험', 시작: 11, 끝: 20 }),
    숙제('2026-10-09', false, { 종류: '시험', 시작: 21, 끝: 30 }),
  ]);
  assert.deepEqual(r.시험.map(t => t.범위), ['11~20', '21~30']);
  assert.equal(r.이번주숙제.length, 0);          // 시험은 숙제 목록 · 수에 안 섞는다
});

test('본 시험 점수 기록은 그대로 최근 8개까지 온다', () => {
  const 기록들 = Array.from({ length: 10 }, (_, i) =>
    record({ at: `2026-09-${String(10 + i).padStart(2, '0')}T01:00:00Z`, score: 60 + i, kind: '시험' }));
  const r = 학부모([], 기록들);
  const 본것 = r.시험.filter(t => t.봤나);
  assert.equal(본것.length, 8);
  assert.deepEqual(본것.map(t => t.점수), [69, 68, 67, 66, 65, 64, 63, 62]);
});
