import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('화면을 떠나면 시험 시계를 멈춘다 — show() 맨 앞에서', () => {
  const 조각 = html.slice(html.indexOf('function show(name){'), html.indexOf('뒤로기록_(지금화면_()'));
  assert.match(조각, /제한멈춤_\(\)/, 'show() 가 시계를 안 멈춘다');
  assert.match(조각, /시계화면_\[제한\.어디\] !== name/, '어느 화면의 시계인지 보고 멈춰야 한다');
});

test('시계가 붙은 화면 세 곳이 다 적혀 있다', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(html.slice(html.indexOf('var 시계화면_'), html.indexOf('function show(name){')), ctx);
  assert.deepEqual({ ...ctx.시계화면_ }, { shClock:"sheet", vClock:"verb", wbClock:"book" });
});

test('제한시작_ 이 쓰는 이름과 시계화면_ 의 이름이 어긋나지 않는다', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(html.slice(html.indexOf('var 시계화면_'), html.indexOf('function show(name){')), ctx);
  /* 제한시작_('shClock', …) 처럼 부르는 곳의 첫 값이 모두 시계화면_ 에 있어야 한다 */
  const 쓴이름 = [...html.matchAll(/제한시작_\('([^']+)'/g)].map(m => m[1]);
  assert.ok(쓴이름.length >= 3, '제한시작_ 을 부르는 곳을 못 찾았다');
  for (const 이름 of new Set(쓴이름)) {
    assert.ok(이름 in ctx.시계화면_, `제한시작_('${이름}') 이 시계화면_ 에 없다 — 그 화면은 나가도 시계가 안 멈춘다`);
  }
});
