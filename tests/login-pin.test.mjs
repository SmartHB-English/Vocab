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

/* 나가기를 누르면 로그인 칸이 비워진다 */
test('나가기 — 이름·비밀번호·자동 로그인 체크가 다 지워진다', () => {
  const 지운열쇠 = [];
  const 화면 = { inName:{value:'홍길동'}, inPw:{value:'1234', dispatchEvent(){ 화면.알림++; }},
                 inAuto:{checked:true}, loginMsg:{textContent:'비밀번호가 달라요.'} };
  화면.알림 = 0;
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const 시작 = html.indexOf('function 로그인칸비우기_');
  /* 맨 왼쪽 칸의 닫는 괄호가 함수의 끝이다 — try/catch 안의 괄호에 걸리지 않게 */
  const 끝 = html.indexOf('\n}', 시작) + 2;
  const 조각 = html.slice(시작, 끝);
  const ctx = { $:(id)=>화면[id], Event:class{constructor(t){this.type=t;}},
                localStorage:{ removeItem(k){ 지운열쇠.push(k); } } };
  vm.createContext(ctx);
  vm.runInContext(조각 + '\n로그인칸비우기_();', ctx);
  assert.equal(화면.inName.value, '');
  assert.equal(화면.inPw.value, '');
  assert.equal(화면.inAuto.checked, false);
  assert.equal(화면.loginMsg.textContent, '');
  assert.equal(화면.알림, 1, '비밀번호 점을 다시 그리라고 알려야 한다');
  assert.deepEqual(지운열쇠, ['hb_last'], '다음에 열 때 앞 아이 이름이 뜨면 안 된다');
});

test('나가기 두 곳(보통 · 유치부)이 모두 로그인 칸을 비운다', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /\$\('kOut'\)[\s\S]{0,120}로그인칸비우기_\(\)/);
  assert.match(html, /var leave=function\(\)\{[^}]*로그인칸비우기_\(\)/);
});
