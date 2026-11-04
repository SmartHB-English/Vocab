import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

/* 프롬프트 37 — 뼈대 찾기에서 4형식(=목 둘)이면 목적어를 간접·직접으로 가른다.
   자료는 =목 그대로. 가르는 것은 문장4형식_ 이 하고, 색 단추 · 채점 · 복기가 문장뼈대역할_ 하나를 본다 */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const index = read('../index.html'), shared = read('../services/shared-ui.js');
const 문장칸 = index.slice(index.indexOf('문장 — 하루 몫 · 일곱 단계'), index.indexOf('iOS 구조 — 탭 5개'));
const 일반 = x => JSON.parse(JSON.stringify(x));
function 함수(source, name) {
  const from = source.indexOf('function ' + name + '(');
  assert.ok(from >= 0, name + ' 가 없다');
  let i = source.indexOf('{', from), depth = 0;
  for (; i < source.length; i++) { if (source[i] === '{') depth++; else if (source[i] === '}' && --depth === 0) break; }
  return source.slice(from, i + 1);
}
function 화면() {
  const 칸 = {};
  const ctx = vm.createContext({ location: { protocol: 'https:', hostname: 'example.invalid', search: '' }, 창구주소: 'firestore:v1',
    setTimeout: f => f(), localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  vm.runInContext(shared, ctx);
  vm.runInContext(문장칸.slice(0, 문장칸.lastIndexOf('/*')).replace(/^[^\n]*\n/, '/*\n'), ctx);
  Object.assign(ctx, {
    $: id => (칸[id] ??= { innerHTML: '', textContent: '', className: '', disabled: false }), qsa: () => [], beep() {},
    읽어주기_() {}, S: { 학생: { 이름: '홍길동' } }, VocabApi: { newRequestNumber: () => 'n1' },
    api같은번호: () => Promise.resolve({ ok: true })
  });
  ctx.SN.책 = '초5 문장';
  return { ctx, 칸 };
}
const { ctx: ui } = 화면();
const 물을것 = en => 일반(ui.문장물을것_(ui.문장읽기_(en)));
const 엄마 = 'My mom=주 / gave=동 / me=목 / a present=목';

test('1. =목 둘인 문장 — 뼈대.역할 이 주 · 동 · 간목 · 직목, 보어는 없다', () => {
  const 역할 = 물을것(엄마).뼈대.역할;
  assert.deepEqual(역할, ['주', '동', '간목', '직목']);
  assert.equal(역할.includes('보'), false);
  assert.deepEqual(물을것('She=주 / made=동 / me=목 / a cake=목 / yesterday').뼈대.역할, ['주', '동', '간목', '직목']);
});
test('2. =목 하나인 문장 — 그대로 주 · 동 · 목 · 보', () => {
  assert.deepEqual(물을것('The boy=주 / kicked=동 / the ball=목').뼈대.역할, ['주', '동', '목', '보']);
});
test('3. =목 이 없는 문장 — 그대로 주 · 동 (보어만 있으면 주 · 동 · 목 · 보)', () => {
  assert.deepEqual(물을것('Birds=주 / sing=동 / in the morning').뼈대.역할, ['주', '동']);
  assert.deepEqual(물을것('We=주 / are=동 / happy=보').뼈대.역할, ['주', '동', '목', '보']);
});
test('4. 문장뼈대역할_ — 4형식에서 앞 목적어가 간목, 뒤가 직목. 다른 덩어리는 제 역할, 표 없는 덩어리는 빈 글', () => {
  const r = ui.문장읽기_(엄마 + ' / yesterday');
  assert.deepEqual([0, 1, 2, 3, 4].map(i => ui.문장뼈대역할_(r, i)), ['주', '동', '간목', '직목', '']);
  const 하나 = ui.문장읽기_('The boy=주 / kicked=동 / the ball=목');
  assert.equal(ui.문장뼈대역할_(하나, 2), '목');
  /* 판정은 문장4형식_ 을 부른다 — 조건을 베껴 쓰지 않는다 */
  assert.match(함수(shared, '문장뼈대역할_'), /문장4형식_\(r\)/);
  assert.match(함수(shared, '뼈대역할목록_'), /문장4형식_\(r\)/);
});
test('5. =목절 이 낀 문장은 4형식으로 보지 않는다', () => {
  const r = ui.문장읽기_('He=주 / told=동 / me=목 / that he was sick=목절');
  assert.equal(ui.문장4형식_(r), null);
  assert.deepEqual(물을것('He=주 / told=동 / me=목 / that he was sick=목절').뼈대.역할, ['주', '동', '목', '보']);
  assert.deepEqual([2, 3].map(i => ui.문장뼈대역할_(r, i)), ['목', '목']);
});
function 뼈대문제(h, en) {
  const r = h.ctx.문장읽기_(en), w = { no: 1, en, ko: '엄마가 나에게 선물을 주셨다', r, 것: h.ctx.문장물을것_(r) };
  h.ctx.SN.판 = { 시작: 1, 끝: 1, 문장: [w], 문제: [{ 단계: '뼈대', w, 종류: '뼈대' }], 소리: false, i: 0, 맞음: 0, 문항: 0, 틀린: {}, 소요: 0, 들어온때: Date.now() };
  h.ctx.문장문제열기_();
  return h.ctx.SN.문;
}
test('6. 채점 — 4형식에서 앞 목적어를 「목」 으로 칠하면 틀린다. 간목 · 직목으로 칠하면 맞는다', () => {
  for (const [칠, 맞] of [[{ 0: '주', 1: '동', 2: '목', 3: '목' }, false], [{ 0: '주', 1: '동', 2: '직목', 3: '간목' }, false],
                          [{ 0: '주', 1: '동', 2: '간목', 3: '직목' }, true]]) {
    const h = 화면(), Q = 뼈대문제(h, 엄마);
    assert.deepEqual(일반(Q.역할들), ['주', '동', '간목', '직목']);
    Q.칠 = 칠; h.ctx.문장채점_();
    assert.equal(Q.맞, 맞, JSON.stringify(칠));
    if (!맞) {
      assert.match(h.칸.snFeed.innerHTML, /sn-간목[^>]*>me<small>간접목적어/, '복기에 간접목적어');
      assert.match(h.칸.snFeed.innerHTML, /sn-직목[^>]*>a present<small>직접목적어/, '복기에 직접목적어');
    }
  }
  /* 단추와 칠한 덩어리 밑 이름 */
  const h = 화면(), Q = 뼈대문제(h, 엄마);
  assert.match(h.칸.snPlay.innerHTML, /class="snpen sn-간목[^"]*"[^>]*>간접목적어</);
  assert.match(h.칸.snPlay.innerHTML, /class="snpen sn-직목[^"]*"[^>]*>직접목적어</);
  assert.doesNotMatch(h.칸.snPlay.innerHTML, /data-snpen="보"/, '4형식 단추에 보어는 없다');
  Q.칠 = { 2: '간목' }; h.ctx.문장판그리기_();
  assert.match(h.칸.snPlay.innerHTML, /sn-간목[^>]*>me<small>간접목적어/);
  /* 목적어 하나인 문장은 그대로 */
  const h2 = 화면(), Q2 = 뼈대문제(h2, 'The boy=주 / kicked=동 / the ball=목');
  Q2.칠 = { 0: '주', 1: '동', 2: '목' }; h2.ctx.문장채점_();
  assert.equal(Q2.맞, true);
});
test('7. 채점 · 복기 · 꾸밈 칸이 같은 함수를 쓴다 — 뼈대 쪽에 d.역할 로 기대를 정하는 곳이 없다', () => {
  const 채점 = 함수(index, '문장채점_');
  const 뼈대칸 = 채점.slice(채점.indexOf("q.종류==='뼈대'"), 채점.indexOf("q.종류==='꾸밈'"));
  assert.match(뼈대칸, /문장뼈대역할_\(r, i\)/);
  assert.doesNotMatch(뼈대칸, /d\.역할/);
  const 정답 = 함수(index, '문장정답그림_'), 뼈복기 = 정답.slice(정답.indexOf('var 뼈 ='));
  assert.match(뼈복기, /문장뼈대역할_\(r, i\)/);
  assert.doesNotMatch(뼈복기, /indexOf\(d\.역할\)|\? d\.역할 :/);
  const 판 = 함수(index, '문장판그리기_');
  const 꾸밈칸 = 판.slice(판.indexOf("q.종류==='꾸밈'"), 판.indexOf("q.종류==='끊기'"));
  assert.match(꾸밈칸, /문장뼈대역할_\(r, i\)/);
  const 뼈칸 = 판.slice(판.indexOf("q.종류==='뼈대'"), 판.indexOf("q.종류==='꾸밈'"));
  assert.doesNotMatch(뼈칸, /d\.역할/, '단추 · 칠은 Q.역할들 · Q.칠 (문장물을것_ → 뼈대역할목록_)');
  assert.match(함수(shared, '문장물을것_'), /역할: 뼈대역할목록_\(r\)/);
  /* 틀린 곳 고치기 · 뜻 보고 영어는 =목 끼리 바꾼다 — 그대로 */
  assert.doesNotMatch(함수(shared, '문장바꿀거리_') + 함수(shared, '문장바꿀자리_'), /간목|직목|문장뼈대역할_/);
});
test('8. 문장역할_ 에 간목 · 직목 — 간접목적어 · 직접목적어. 목은 그대로, 색도 셋 다 있다', () => {
  const 역 = 일반(ui.문장역할_);
  assert.equal(역.간목, '간접목적어'); assert.equal(역.직목, '직접목적어'); assert.equal(역.목, '목적어');
  const css = read('../services/shared-ui.css');
  for (const k of ['목', '간목', '직목']) for (const 꼴 of ['#s-sent .snchip.sn-', '#s-sent .snpen.sn-', '.snd.sn-'])
    assert.ok(css.includes(꼴 + k + '{'), 꼴 + k);
  /* 자료에 새 표를 만들지 않는다 */
  assert.ok(ui.문장읽기_('me=간목').경고.length > 0, '=간목 은 모르는 표');
});
