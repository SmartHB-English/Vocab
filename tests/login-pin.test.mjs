import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/* 로그인 자동 시도만 떼어 돌린다 — 화면 전체를 올리지 않고 그 조각만 본다 */
function 판(비번시작, 이름, 글) {
  const 화면 = { inPw:{value:비번시작}, inName:{value:이름}, loginMsg:{textContent:글||''},
                 btnLogin:{click(){ 화면.누름++; }} };
  화면.누름 = 0;
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const 조각 = html.slice(html.indexOf('var 자동시도한비번_'), html.indexOf("qsa('#keypad"));
  const ctx = { $:(id)=>화면[id] };
  vm.createContext(ctx);
  vm.runInContext(조각, ctx);
  return { 화면, 치기(v){ 화면.inPw.value = v; ctx.네자리면들어가기_(); } };
}

test('네 자리가 되면 한 번 들어간다', () => {
  const t = 판('', '홍길동');
  t.치기('12'); assert.equal(t.화면.누름, 0);
  t.치기('1234'); assert.equal(t.화면.누름, 1);
});
test('같은 네 자리로 두 번 쏘지 않는다', () => {
  const t = 판('', '홍길동');
  t.치기('1234'); t.치기('1234');
  assert.equal(t.화면.누름, 1);
});
test('지웠다 다시 치면 또 쏜다', () => {
  const t = 판('', '홍길동');
  t.치기('1234'); t.치기('123'); t.치기('1234');
  assert.equal(t.화면.누름, 2);
});
test('다섯 자리는 안 쏜다', () => {
  const t = 판('', '홍길동');
  t.치기('12345'); assert.equal(t.화면.누름, 0);
});
test('이름이 비면 안 쏜다', () => {
  const t = 판('', '   ');
  t.치기('1234'); assert.equal(t.화면.누름, 0);
});
test('이미 확인 중이면 안 쏜다', () => {
  const t = 판('', '홍길동', '확인 중…');
  t.치기('1234'); assert.equal(t.화면.누름, 0);
});
