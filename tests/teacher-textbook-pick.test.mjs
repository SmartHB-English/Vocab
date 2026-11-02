import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

/* 교재 고르개에 문장 묶음이 떠야 한다 — 아이가 볼 수 있는 묶음은 학생 명단의 교재 칸이 정한다.
   숙제 내주기·시험지·단어장 탭은 여전히 문장을 떼어 낸 목록을 쓴다. */
const html = readFileSync(new URL('../teacher.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function 떼기(name) {
  const from = html.indexOf('\nfunction ' + name + '(');
  assert.ok(from >= 0, name + ' 가 teacher.html 에 없다');
  let i = html.indexOf('{', from), depth = 0;
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) break; }
  return html.slice(from + 1, i + 1);
}
const ctx = vm.createContext({});
vm.runInContext(떼기('문장책떼기_'), ctx);
const 목록 = () => [{ 이름: '예시 단어장', 종류: '' }, { 이름: '중등 문장 1', 종류: '문장' }, { 이름: '불규칙 동사 50', 종류: '3단변화' }];
const 이름들 = a => a.map(x => x.이름);

test('문장책떼기_ — 교재고르개목록에는 문장 묶음까지 다 들어 있다', () => {
  const d = {}; ctx.문장책떼기_(d, 목록());
  assert.deepEqual(이름들(d.교재고르개목록), ['예시 단어장', '중등 문장 1', '불규칙 동사 50']);
});
test('문장책떼기_ — 단어장목록에는 문장 묶음이 없고, 문장장목록에는 문장 묶음만 있다', () => {
  const d = {}; ctx.문장책떼기_(d, 목록());
  assert.deepEqual(이름들(d.단어장목록), ['예시 단어장', '불규칙 동사 50']);
  assert.deepEqual(이름들(d.문장장목록), ['중등 문장 1']);
});
test('문장책떼기_ — 교재고르개목록은 넘긴 배열의 사본이다', () => {
  const 원 = 목록(), d = {}; ctx.문장책떼기_(d, 원);
  assert.notEqual(d.교재고르개목록, 원);
  d.교재고르개목록.push({ 이름: '덧붙임' }); d.교재고르개목록.shift();
  assert.deepEqual(이름들(원), ['예시 단어장', '중등 문장 1', '불규칙 동사 50']);
});

/* 체크박스 한 줄(class="…") 앞의 두 줄 — 목록을 고르는 자리 */
function 고르는줄(클래스) {
  const at = html.indexOf(`<input type="checkbox" class="${클래스}"`);
  assert.ok(at > 0, 클래스 + ' 체크박스가 없다');
  return html.slice(html.lastIndexOf("'<div class=\"txlist\">'", at), at);
}
test('학생 수정(sText) · 교재 한꺼번에 주기(bkText) 두 고르개 모두 교재고르개목록을 쓴다', () => {
  for (const 클래스 of ['sText', 'bkText']) {
    const 줄 = 고르는줄(클래스);
    assert.equal((줄.match(/d\.교재고르개목록\|\|d\.단어장목록/g) || []).length, 2, 클래스);
  }
});
test('숙제 내주기 · 시험 탭은 여전히 문장을 떼어 낸 단어장목록만 쓴다', () => {
  const from = html.indexOf("else if(T.tab==='hw' || T.tab==='exam'){");
  const to = html.indexOf("else if(T.tab==='notice'){", from);
  assert.ok(from > 0 && to > from);
  const 숙제 = html.slice(from, to);
  assert.match(숙제, /d\.단어장목록/);
  assert.doesNotMatch(숙제, /교재고르개목록/);
});
