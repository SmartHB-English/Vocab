import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 순위 시상대 — 목록 맨 위 세 줄을 집지 않고, 자료의 등수로 자리를 고른다.
   동점이면 그 등수인 사람을 한 자리에 묶는다. 빈 칸에 아무나 끌어다 세우지 않는다. */
const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');

const 처음 = html.indexOf('/* ==== 시상대 고르기 시작');
const 끝 = html.indexOf('/* ==== 시상대 고르기 끝 ==== */');
assert.ok(처음 > 0 && 끝 > 처음, '시상대 고르기를 찾지 못했다');
const ctx = {};
vm.runInNewContext(html.slice(처음, 끝), ctx);
const 고르기 = 사람들 => JSON.parse(JSON.stringify(ctx.시상대고르기(사람들)));
const 모양 = 칸 => 칸.map(c => [c.등, c.사람.map(v => v.이름)]);
const 사람 = (이름, 등, 영 = false) => ({ 이름, 등, 점: '🔥 3일', 나: false, 영 });

test('1) 1·2·3등이 한 명씩이면 셋이 선다', () => {
  assert.deepEqual(모양(고르기([사람('가', 1), 사람('나', 2), 사람('다', 3), 사람('라', 4)])),
    [[1, ['가']], [2, ['나']], [3, ['다']]]);
});

test('2) 1등이 일곱 명이면 1등 자리에 일곱, 그다음 등수(8등)가 2등 자리', () => {
  const 일곱 = ['고지호', '곽은설', '김나율', '김지훈', '최연우', '박하늘', '이철수'].map(n => 사람(n, 1));
  assert.deepEqual(모양(고르기([...일곱, 사람('홍길동', 8), 사람('김영희', 9), 사람('박지훈', 10)])),
    [[1, 일곱.map(v => v.이름)], [8, ['홍길동']], [9, ['김영희']]]);
});

test('3) 등수가 두 종류뿐이면 두 칸만 — 세 번째 칸은 빈다', () => {
  const 칸 = 고르기([사람('가', 1), 사람('나', 1), 사람('다', 3), 사람('라', 3)]);
  assert.deepEqual(모양(칸), [[1, ['가', '나']], [3, ['다', '라']]]);
});

test('4) 전원 동점이면 가운데 한 칸만', () => {
  assert.deepEqual(모양(고르기([사람('가', 1), 사람('나', 1), 사람('다', 1)])), [[1, ['가', '나', '다']]]);
});

test('5) 연속일수 0 인 사람은 시상대에 안 올라간다', () => {
  assert.deepEqual(모양(고르기([사람('가', 1), 사람('나', 2), 사람('다', 3, true), 사람('라', 3, true)])),
    [[1, ['가']], [2, ['나']]]);
  assert.deepEqual(고르기([사람('가', 1, true), 사람('나', 1, true)]), []);
});

test('7) 아무도 없으면 시상대를 안 그린다', () => {
  assert.deepEqual(고르기([]), []);
  assert.deepEqual(고르기(undefined), []);
  /* 그리는 쪽은 칸이 하나라도 있어야 시상대를 연다 */
  assert.match(html, /var 칸=시상대고르기\(줄\.map\(뜻\)\);\s*if\(칸\.length\)\{/);
});

test('시상대는 .rk 글자(메달)를 읽지 않고 data-rank 를 읽는다 · 목록에서 숨기지 않는다', () => {
  assert.doesNotMatch(html, /querySelector\('\.rk'\)/);
  assert.doesNotMatch(html, /inpod/);
  for (const 칸 of ['drawStreakRank', 'drawGameRank', 'drawMonthRank']) {
    const 몸 = html.slice(html.indexOf('function ' + 칸 + '('), html.indexOf('\n}', html.indexOf('function ' + 칸 + '(')));
    assert.match(몸, /data-rank="/, 칸 + ' 에 data-rank 가 없다');
  }
});

/* 6) 엔진 — 이달의 점수도 같은 점수면 같은 등수 */
test('6) 월간순위 — 같은 점수면 같은 등수', () => {
  const 지금 = Date.parse('2026-10-15T03:00:00Z');
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분']);
  const 점수 = store.insertSheet('점수');
  점수.appendRow(['날짜', '반', '이름', '시험명', '점수']);
  const 날 = new Date('2026-10-10T03:00:00Z');
  [['다현', 90], ['가람', 90], ['나래', 90], ['라온', 80], ['마루', 80], ['바다', 70]]
    .forEach(([n, s]) => 점수.appendRow([날, '', n, '단어시험', s]));
  const 엔 = createRuntime(store, { now: () => 지금 });
  const r = 엔.call('월간순위', ['']);
  assert.deepEqual(r.순위.map(x => [x.이름, x.점수, x.등수]), [
    ['가람', 90, 1], ['나래', 90, 1], ['다현', 90, 1], ['라온', 80, 4], ['마루', 80, 4], ['바다', 70, 6]
  ]);
});

/* ---- 프롬프트45: 묶음 칸을 누르면 목록에서 그 등수 줄들이 잠깐 켜진다 ---- */
function 가짜줄(등수, 이름) {
  const 반 = new Set();
  return { 이름, 반, 굴림: 0,
    getAttribute: k => (k === 'data-rank' ? String(등수) : null),
    classList: { add: c => 반.add(c), remove: c => 반.delete(c) },
    scrollIntoView(o) { this.굴림++; this.굴림법 = o; } };
}
function 켜기판() {
  const 시계들 = [];
  const c = { setTimeout: (f, ms) => { 시계들.push({ f, ms, 꺼짐: false }); return 시계들.length; },
    clearTimeout: id => { if (시계들[id - 1]) 시계들[id - 1].꺼짐 = true; } };
  vm.runInNewContext(html.slice(처음, 끝), c);
  return { c, 시계들 };
}
const 목록줄 = () => [가짜줄(1, '가'), 가짜줄(1, '나'), 가짜줄(1, '다'), 가짜줄(4, '라'), 가짜줄(5, '마'), 가짜줄(6, '바')];

test('45-1) 1등 묶음을 누르면 등수 1인 줄만 골라진다', () => {
  const 줄 = 목록줄();
  assert.deepEqual([...ctx.시상대켤줄(줄, '1')].map(r => r.이름), ['가', '나', '다']);
  assert.deepEqual([...ctx.시상대켤줄(줄, 4)].map(r => r.이름), ['라']);
  const { c, 시계들 } = 켜기판();
  const 상태 = { 켠: [], 시계: null };
  c.시상대켜기(줄, '1', 상태);
  assert.deepEqual(줄.filter(r => r.반.has('tiehl')).map(r => r.이름), ['가', '나', '다']);
  assert.equal(줄[0].굴림, 1, '첫 줄로 미끄러진다');
  assert.equal(줄[0].굴림법.block, 'center', '맨 위에 붙이지 않는다 — 상단바에 가린다');
  assert.equal(시계들[0].ms, 1500);
  시계들[0].f();
  assert.equal(줄.filter(r => r.반.has('tiehl')).length, 0, '저절로 꺼진다');
});

test('45-2) 한 명뿐인 칸에는 누르는 것이 안 달린다 — 묶음 칸만 button', () => {
  const 그리기 = html.slice(html.indexOf('var 칸=시상대고르기(줄.map(뜻));'), html.indexOf("pod.classList.remove('hide');", html.indexOf('var 칸=시상대고르기(줄.map(뜻));')));
  assert.match(그리기, /여럿\s*\?\s*'<button type="button" class="hbpd'[^\n]*data-tie="'\+c\.등\+'"[^\n]*aria-label=/);
  assert.match(그리기, /:\s*'<div class="hbpd'\+\(나있음\?' me':''\)\+'">'/, '한 명 칸은 div 그대로');
  assert.match(그리기, /querySelectorAll\('\[data-tie\]'\)/, '누르는 것은 data-tie 칸에만 단다');
});

test('45-3) 다른 묶음을 누르면 앞서 켠 것이 꺼진다', () => {
  const 줄 = [가짜줄(1, '가'), 가짜줄(1, '나'), 가짜줄(3, '다'), 가짜줄(3, '라')];
  const { c, 시계들 } = 켜기판();
  const 상태 = { 켠: [], 시계: null };
  c.시상대켜기(줄, 1, 상태);
  c.시상대켜기(줄, 3, 상태);
  assert.deepEqual(줄.filter(r => r.반.has('tiehl')).map(r => r.이름), ['다', '라']);
  assert.equal(시계들[0].꺼짐, true, '앞의 시계는 멈춘다');
  시계들[1].f();
  assert.equal(줄.filter(r => r.반.has('tiehl')).length, 0);
});
