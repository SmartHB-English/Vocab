import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* 마스코트 — mascot.js 를 불러오고, 문제·시험지·결과 화면에 자리가 있고,
   채점 자리에서 맞음·틀림·연속·축하를 부르는지 본다 */
const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');

test('1) index.html 이 mascot.js 를 불러온다 (파일 이름은 소문자 — 깃헙 페이지는 대소문자를 가린다)', () => {
  assert.match(html, /<script src="mascot\.js"><\/script>/);
  assert.match(readFileSync(new URL('mascot.js', root), 'utf8'), /function createMascot\(/);
});

test('2) 폰 앱 번들에도 mascot.js 가 들어간다', () => {
  assert.match(readFileSync(new URL('scripts/build-app.mjs', root), 'utf8'), /'mascot\.js'/);
});

test('3) 한 문제씩 · 3단변화 · 시험지 · 결과 화면에 마스코트 자리가 있다', () => {
  for (const id of ['qMascot', 'vMascot', 'shMascot', 'rMascot']) assert.ok(html.includes(`id="${id}"`), id);
});

/* 마스코트() 를 떼어 와서 가짜 createMascot 으로 돌려 본다 */
const 처음 = html.indexOf('var 마스코트자리_');
const 끝 = html.indexOf('\n}', html.indexOf('function 마스코트(')) + 2;
assert.ok(처음 > 0 && 끝 > 처음, '마스코트() 를 찾지 못했다');

function 판(createMascot) {
  const 자리들 = {};
  const 요소 = id => (자리들[id] ||= { id, 자식: [], appendChild(c) { c.parentNode = this; this.자식.push(c); } });
  const ctx = { $: 요소, document: { createElement: () => ({ parentNode: null }) }, createMascot };
  vm.runInNewContext(html.slice(처음, 끝), ctx);
  return ctx;
}

test('4) 한 마리만 만들고, sleepAfter 30초로 만든다', () => {
  const 만든것 = [], 한것 = [];
  const ctx = 판((el, opts) => { 만든것.push(opts); return { play: n => 한것.push(n) }; });
  ctx.마스코트('idle', 'quiz');
  ctx.마스코트('correct', 'quiz');
  ctx.마스코트('celebrate', 'result');
  assert.equal(만든것.length, 1);
  assert.equal(만든것[0].sleepAfter, 30000);
  assert.equal(한것.join(), 'idle,correct,celebrate');
});

test('5) mascot.js 를 못 불러와도 넘어간다', () => {
  const ctx = 판(undefined);
  assert.doesNotThrow(() => ctx.마스코트('correct', 'quiz'));
});

test('6) 채점 자리에서 부른다 — 정답 / 오답 / 3번째 연속부터 combo / 결과는 celebrate', () => {
  assert.ok(html.includes("마스코트(S.콤보>=3 ? 'combo' : 'correct', 'quiz');"));
  assert.ok(html.includes("마스코트('wrong', 'quiz');"));
  assert.ok(html.includes("마스코트(S.v연속>=3 ? 'combo' : 'correct', 'verb');"));
  assert.ok(html.includes("마스코트('wrong', 'verb');"));
  assert.ok(html.includes("if(name === 'result') 마스코트('celebrate', name);"));
});
