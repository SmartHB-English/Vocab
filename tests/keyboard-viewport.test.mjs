import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/* 아이폰 키보드 — 보이는 영역(visualViewport)을 가짜로 만들어 상단바가 따라오는지 본다.
   진짜 키보드는 Playwright 로 못 띄우니 offsetTop · height 를 손으로 바꾼다 */
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const 시작 = html.indexOf('/* ==== 보이는 영역에 붙이기 시작');
const 끝 = html.indexOf('/* ==== 보이는 영역에 붙이기 끝');
assert.ok(시작 > 0 && 끝 > 시작, 'index.html 에서 「보이는 영역에 붙이기」 조각을 못 찾았다');
const 조각 = html.slice(시작, 끝);

function 이벤트판() {
  const 들음 = {};
  return {
    들음,
    addEventListener(n, f) { (들음[n] ||= new Set()).add(f); },
    removeEventListener(n, f) { 들음[n]?.delete(f); },
    쏘기(n) { [...(들음[n] || [])].forEach(f => f()); },
    수() { return Object.values(들음).reduce((a, s) => a + s.size, 0); },
  };
}

function 판(vv = true) {
  const 보임 = vv ? Object.assign(이벤트판(), { offsetTop: 0, height: 660 }) : undefined;
  const doc = Object.assign(이벤트판(), { activeElement: null });
  const ctx = { window: { visualViewport: 보임 }, document: doc, setTimeout: f => f() };
  vm.createContext(ctx);
  vm.runInContext(조각, ctx);
  const 요소 = () => ({ style: { transform: '' } });
  return { ctx, 보임, doc, 요소 };
}

test('offsetTop 0 → 300 → 0 : 상단바가 따라 내려왔다가 0 이면 깨끗이 지워진다', () => {
  const { ctx, 보임, 요소 } = 판();
  const 상단 = 요소(), 시계 = 요소();
  ctx.보이는영역에붙이기_([상단, 시계]);
  assert.equal(상단.style.transform, '', '키보드가 없을 때는 아무것도 걸지 않는다');

  보임.offsetTop = 300; 보임.쏘기('resize');
  assert.equal(상단.style.transform, 'translateY(300px)');
  assert.equal(시계.style.transform, 'translateY(300px)');

  보임.offsetTop = 412.6; 보임.쏘기('scroll');   /* 키보드가 올라온 채로 밀면 scroll 이 온다 */
  assert.equal(상단.style.transform, 'translateY(413px)');

  보임.offsetTop = 0; 보임.쏘기('resize');
  assert.equal(상단.style.transform, '', '0 일 때 translateY(0px) 을 남기지 않는다');
  assert.equal(시계.style.transform, '');
});

test('다른 화면으로 가면(빈 목록) 듣던 것을 떼고 걸어 둔 것을 지운다', () => {
  const { ctx, 보임, doc, 요소 } = 판();
  const 상단 = 요소();
  ctx.보이는영역에붙이기_([상단]);
  assert.ok(보임.수() >= 2 && doc.수() >= 2, 'resize · scroll · focus 를 들어야 한다');
  보임.offsetTop = 200; 보임.쏘기('resize');
  assert.equal(상단.style.transform, 'translateY(200px)');

  ctx.보이는영역에붙이기_([]);
  assert.equal(상단.style.transform, '', '떠날 때 걸어 둔 것을 지운다');
  assert.equal(보임.수(), 0, 'visualViewport 를 계속 듣고 있다');
  assert.equal(doc.수(), 0, 'document 를 계속 듣고 있다');

  보임.쏘기('scroll');
  assert.equal(상단.style.transform, '', '뗀 뒤에는 다시 걸리면 안 된다');

  ctx.보이는영역에붙이기_([상단]);   /* 다시 들어오면 다시 건다 — 겹쳐 걸지 않는다 */
  ctx.보이는영역에붙이기_([상단]);
  assert.equal(보임.들음.resize.size, 1);
});

test('키보드가 올라오면 제출 바를 숨기고, 내려가면 다시 보인다', () => {
  const { ctx, 보임, doc, 요소 } = 판();
  const 불림 = [];
  ctx.보이는영역에붙이기_([요소()], 올라옴 => 불림.push(올라옴));
  const 칸 = { tagName: 'INPUT', type: 'text' };

  doc.activeElement = 칸; doc.쏘기('focusin');
  assert.deepEqual(불림, [], '칸만 눌렀고 아직 키보드가 안 올라왔다');

  보임.height = 330; 보임.offsetTop = 0; 보임.쏘기('resize');   /* 안드로이드처럼 밀지 않고 줄기만 해도 */
  assert.deepEqual(불림, [true]);

  보임.offsetTop = 250; 보임.쏘기('scroll');
  assert.deepEqual(불림, [true], '같은 상태면 다시 부르지 않는다');

  doc.activeElement = null; 보임.height = 660; 보임.offsetTop = 0;
  doc.쏘기('focusout');
  assert.deepEqual(불림, [true, false]);
});

test('컴퓨터에서 칸에 글을 쳐도(보이는 영역이 그대로) 제출 바를 숨기지 않는다', () => {
  const { ctx, doc, 요소 } = 판();
  const 불림 = [];
  ctx.보이는영역에붙이기_([요소()], 올라옴 => 불림.push(올라옴));
  doc.activeElement = { tagName: 'TEXTAREA' }; doc.쏘기('focusin');
  assert.deepEqual(불림, []);
});

test('키보드가 올라온 채로 화면을 떠나면 숨긴 제출 바를 되돌려 놓는다', () => {
  const { ctx, 보임, doc, 요소 } = 판();
  const 불림 = [];
  ctx.보이는영역에붙이기_([요소()], 올라옴 => 불림.push(올라옴));
  doc.activeElement = { tagName: 'INPUT', type: 'text' };
  보임.height = 300; 보임.offsetTop = 300; 보임.쏘기('resize');
  ctx.보이는영역에붙이기_([]);
  assert.deepEqual(불림, [true, false]);
});

test('visualViewport 가 없는 브라우저면 아무것도 하지 않는다', () => {
  const { ctx, doc, 요소 } = 판(false);
  const 상단 = 요소();
  assert.doesNotThrow(() => ctx.보이는영역에붙이기_([상단], () => { throw new Error('불리면 안 된다'); }));
  assert.equal(상단.style.transform, '');
  assert.equal(doc.수(), 0);
});

test('show() 가 시험지 · 3단변화에서 걸고, 다른 화면에서는 빈 목록으로 뗀다', () => {
  const s = html.slice(html.indexOf('function show(name){'), html.indexOf('/* 마스코트 — 한 마리만'));
  assert.match(s, /name === 'sheet'\) 보이는영역에붙이기_\(\[document\.querySelector\('#s-sheet \.sheettop'\)/);
  assert.match(s, /kbhide/);
  assert.match(s, /else 보이는영역에붙이기_\(\[\]\)/);
  /* 한 벌만 — 따라붙이는 몸통을 다른 데 복사해 두지 않는다 */
  assert.equal(html.split('vv.offsetTop').length - 1, 1, 'offsetTop 을 읽는 곳이 하나여야 한다');
});
