import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* 프롬프트29 — 무르고 들어가면 「시간이 지났다」 며 쫓겨나던 것 + 한 번 들어간 시험은 끝까지.
   · 시계 열쇠에서 응시수를 뺀다 (무르면 응시수가 1 → 0 으로 돌아가 첫 응시의 지난 시각을 다시 읽었다)
   · 한 판을 내는 순간(숙제냈음) 그 숙제의 기기 표시를 지운다
   · 시험판이 있는 동안은 「← 그만」 · 폰 뒤로가기로 못 나간다
   · 외우기는 한 판뿐 — 닫고 다시 들어오면 바로 시험 */
const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/* `function 이름(` 부터 짝이 맞는 `}` 까지 — 글자열·주석 안의 괄호는 세지 않는다 */
function 함수떼기(name) {
  const at = source.indexOf(`\nfunction ${name}(`);
  assert.ok(at > -1, `${name} 을 못 찾았다`);
  return 짝까지(at + 1);
}
function 짝까지(from) {
  let i = source.indexOf('{', from), 깊이 = 0, 글 = null;
  for (; i < source.length; i++) {
    const c = source[i], 다음 = source[i + 1];
    if (글) {
      if (c === '\\') { i++; continue; }
      if (c === 글) 글 = null;
      continue;
    }
    if (c === '/' && 다음 === '*') { i = source.indexOf('*/', i + 2) + 1; continue; }
    if (c === '/' && 다음 === '/') { i = source.indexOf('\n', i); continue; }
    if (c === "'" || c === '"' || c === '`') { 글 = c; continue; }
    if (c === '{') 깊이++;
    else if (c === '}' && --깊이 === 0) return source.slice(from, i + 1);
  }
  throw new Error('짝이 안 맞는다');
}
function 덩이(시작글) {
  const at = source.indexOf(시작글);
  assert.ok(at > -1, `${시작글} 을 못 찾았다`);
  return 짝까지(at);
}

function 판(더 = {}) {
  const 저장 = new Map();
  const ctx = vm.createContext({
    S: { 학생: { 이름: '홍길동' } },
    localStorage: {
      getItem: k => (저장.has(k) ? 저장.get(k) : null),
      setItem: (k, v) => 저장.set(k, String(v)),
      removeItem: k => 저장.delete(k),
    },
    ...더,
  });
  vm.runInContext(['저장읽기_', '저장쓰기_', '저장지우기_', '숙제표시뿌리_', '제한열쇠_', '외우기끝열쇠_', '시도표시지우기_']
    .map(함수떼기).join('\n'), ctx);
  return { ctx, 저장 };
}
const 시험 = (더 = {}) => ({ 단어장: '교재A', 시작: 1, 끝: 40, 유형: '스펠링', 종류: '시험', 단계: '시험', 낸때: 1700000000000, 제한시간: 20, ...더 });

test('1) 제한열쇠_ 에 응시수가 없다', () => {
  assert.doesNotMatch(함수떼기('제한열쇠_'), /응시수/);
});

test('2) 응시수만 다른 같은 숙제(0 · 1)는 열쇠가 같다 — 무른 뒤에도 같은 열쇠를 쓰지만 내는 순간 지워진다', () => {
  const { ctx } = 판();
  for (const 단계 of ['', '시험']) {
    assert.equal(ctx.제한열쇠_(시험({ 응시수: 0 }), 단계), ctx.제한열쇠_(시험({ 응시수: 1 }), 단계));
  }
  assert.equal(ctx.제한열쇠_(시험(), '시험'), '제한시작_홍길동|1700000000000|시험');
});

test('3) 외우기 시계와 시험 시계는 열쇠가 다르다', () => {
  const { ctx } = 판();
  assert.notEqual(ctx.제한열쇠_(시험(), '시험'), ctx.제한열쇠_(시험(), ''));
  assert.notEqual(ctx.외우기끝열쇠_(시험()), ctx.제한열쇠_(시험(), ''));
});

test('4) 숙제냈음 이 시도표시지우기_ 를 부른다', () => {
  assert.match(함수떼기('숙제냈음'), /시도표시지우기_\(h\)/);
});

test('5) 시도표시지우기_ 는 외우기 시계 · 시험 시계 · 외우기끝 셋을 모두 지운다 — 다른 숙제 것은 남긴다', () => {
  const { ctx, 저장 } = 판();
  const h = 시험(), 남 = 시험({ 낸때: 1800000000000 });
  for (const x of [h, 남]) {
    ctx.저장쓰기_(ctx.제한열쇠_(x, ''), 1);
    ctx.저장쓰기_(ctx.제한열쇠_(x, '시험'), 2);
    ctx.저장쓰기_(ctx.외우기끝열쇠_(x), 1);
  }
  저장.set('제한시작_홍길동|1700000000000|0|시험', '5');            // 옛 열쇠 — 아무도 안 읽으니 그냥 둔다
  assert.equal(저장.size, 7);
  ctx.시도표시지우기_(h);
  assert.equal(ctx.저장읽기_(ctx.제한열쇠_(h, ''), 0), 0);
  assert.equal(ctx.저장읽기_(ctx.제한열쇠_(h, '시험'), 0), 0);
  assert.equal(ctx.저장읽기_(ctx.외우기끝열쇠_(h), 0), 0);
  assert.equal(저장.size, 4);
  assert.equal(ctx.저장읽기_(ctx.제한열쇠_(남, '시험'), 0), 2);
  ctx.시도표시지우기_(null);                                        // 숙제가 없으면 아무것도 안 한다
  assert.equal(저장.size, 4);
});

test('6) 시험중나가기막나_ — 시험판이 있고 채점 전이면 막는다, 결과 화면·시험판 없음·오답 다시 풀기는 안 막는다', () => {
  const ctx = vm.createContext({ 시험판: { 방법: 'spell', 단계: '외우기' }, S: { 채점됨: false }, 화면: 'book' });
  ctx.지금화면_ = () => ctx.화면;
  vm.runInContext(함수떼기('시험중나가기막나_'), ctx);
  assert.equal(ctx.시험중나가기막나_(), true);                      // 외우기 중
  ctx.시험판.단계 = '시험'; ctx.화면 = 'sheet';
  assert.equal(ctx.시험중나가기막나_(), true);                      // 시험 중
  ctx.화면 = 'result';
  assert.equal(ctx.시험중나가기막나_(), false);
  ctx.화면 = 'sheet'; ctx.S.채점됨 = true;
  assert.equal(ctx.시험중나가기막나_(), false);                     // 채점 뒤 시험지를 다시 보는 것
  ctx.S.채점됨 = false; ctx.S.재시험 = true;
  assert.equal(ctx.시험중나가기막나_(), false);                     // 결과 화면에서 고른 오답 다시 풀기
  ctx.S.재시험 = false; ctx.시험판 = null;
  assert.equal(ctx.시험중나가기막나_(), false);
});

test('7) 「← 그만」(data-back · 시험지의 shBack)과 폰 뒤로가기가 모두 시험중나가기막나_ 를 먼저 본다', () => {
  const 뒤로 = 덩이("qsa('[data-back]').forEach(function(b){");
  assert.ok(뒤로.indexOf('시험중나가기막나_()') > -1 && 뒤로.indexOf('시험중나가기막나_()') < 뒤로.indexOf('시험판치우기_()'));
  const 시험지 = 덩이("$('shBack').onclick=function(){");
  assert.ok(시험지.indexOf('시험중나가기막나_()') > -1 && 시험지.indexOf('시험중나가기막나_()') < 시험지.indexOf('시험판치우기_()'));
  const 팝 = 덩이("window.addEventListener('popstate', function(){");
  assert.match(팝, /if\(시험중나가기막나_\(\)\)\{ 발자국_\(\); toast\(/);
  assert.ok(팝.indexOf('시험중나가기막나_()') < 팝.indexOf('시험판치우기_()'));
  /* 눌러 봐야 안 되는 단추는 가린다 — 자리는 남긴다(visibility) */
  assert.match(함수떼기('show'), /나가기단추맞추기_\(\)/);
  assert.match(함수떼기('나가기단추맞추기_'), /visibility/);
  assert.match(함수떼기('시험단계로_'), /나가기단추맞추기_\(\)/);
  assert.match(함수떼기('시험판치우기_'), /나가기단추맞추기_\(\)/);
});

test('8) 외우기는 한 판뿐 — 시험단계로_ 가 표시를 적고, 시험열기_ 는 그 표시가 있으면 외우기를 건너뛴다', () => {
  assert.match(함수떼기('시험단계로_'), /저장쓰기_\(외우기끝열쇠_\(h\), 1\)/);
  assert.match(함수떼기('시험열기_'), /if\(!외우기분_\(h\) \|\| 저장읽기_\(외우기끝열쇠_\(h\), 0\)\)\{ 시험단계로_\(\); return; \}/);
  /* 앞서 푼 연습의 채점됨이 남아 외우기 중 잠금이 풀리면 안 된다 */
  assert.match(함수떼기('시험열기_'), /S\.채점됨 = false;/);
});
