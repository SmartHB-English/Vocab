import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 프롬프트 35 — 문장 연습을 일곱 단계로.
   6 틀린 곳 고치기: 덩어리 하나를 같은 역할의 다른 덩어리로 바꿔 놓고 ① 찾게 하고 ② 바른 것을 넷 중에 고르게 한다 (한 문제로 센다).
   7 뜻 보고 영어 고르기: 해석만 보고 영어 문장 넷 중에 고른다. 오답은 덩어리 하나만 바꾼 문장.
   둘이 같은 재료(shared-ui.js 의 문장바꿀거리_)를 쓴다. 듣고 고르기는 빠지고, 묶음의 「듣기」 칸은 「소리」 칸이 된다.
   (옛 sentence-listen.test.mjs 의 아직 뜻 있는 것 — 영작같나_ 없음 · 단어 쪽 영작 그대로 · 끄는 말 목록 · 옛 머리글 옮기기 — 은 여기로 옮겼다) */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const index = read('../index.html'), teacher = read('../teacher.html'), shared = read('../services/shared-ui.js'), code = read('./fixtures/legacy/Code.gs');
function 함수(source, name) {
  const from = source.indexOf('function ' + name + '(');
  assert.ok(from >= 0, name + ' 가 없다');
  let i = source.indexOf('{', from), depth = 0;
  for (; i < source.length; i++) { if (source[i] === '{') depth++; else if (source[i] === '}' && --depth === 0) break; }
  return source.slice(from, i + 1);
}
/* 박아 넣은 공용 블록을 뺀 페이지 고유 코드 */
const 고유 = html => html.replace(/\/\* BEGIN GENERATED [^*]*\*\/[\s\S]*?\/\* END GENERATED [^*]*\*\//g, '');
/* index.html 의 문장 탭 칸 */
const 문장칸 = index.slice(index.indexOf('문장 — 하루 몫 · 일곱 단계'), index.indexOf('iOS 구조 — 탭 5개'));

/* 화면을 따로 돌린다 — 공용 블록 위에 index.html 의 문장 탭 칸 통째로. DOM 은 흉내 */
function 화면(바깥 = {}) {
  const 칸 = {}, 읽음 = [], 보냄 = [];
  const ctx = vm.createContext({ location: { protocol: 'https:', hostname: 'example.invalid', search: '' }, 창구주소: 'firestore:v1',
    setTimeout: f => f(), localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, ...바깥 });
  vm.runInContext(shared, ctx);
  vm.runInContext(문장칸.slice(0, 문장칸.lastIndexOf('/*')).replace(/^[^\n]*\n/, '/*\n'), ctx);
  Object.assign(ctx, {
    $: id => (칸[id] ??= { innerHTML: '', textContent: '', className: '', disabled: false }), qsa: () => [], beep() {},
    읽어주기_: t => 읽음.push(t), S: { 학생: { 이름: '홍길동' } },
    VocabApi: { newRequestNumber: () => 'n1' },
    api같은번호: (번호, 이름, 자료) => { 보냄.push(자료); return Promise.resolve({ ok: true }); }
  });
  ctx.SN.책 = '초5 문장';
  return { ctx, 칸, 읽음, 보냄 };
}
const { ctx: ui } = 화면();
const 줄만들기 = (no, en, ko = '뜻 ' + no) => { const r = ui.문장읽기_(en); return { no, en, ko, r, 것: ui.문장물을것_(r) }; };
const 이름들 = ['Tom', 'The boy', 'My sister', 'The dog', 'She', 'The teacher', 'Our class', 'He'];
const 동사들 = ['kicked', 'found', 'washed', 'liked', 'painted', 'carried', 'opened', 'dropped'];
const 목적어들 = ['the ball', 'a box', 'the car', 'the cake', 'the door', 'a bag', 'the window', 'the cup'];
const 묶음 = (n = 40) => Array.from({ length: n }, (_, i) =>
  줄만들기(i + 1, `${이름들[i % 8]}=주 / ${동사들[(i * 3) % 8]}=동 / ${목적어들[(i * 5) % 8]}=목 / yesterday`));
const 일반 = x => JSON.parse(JSON.stringify(x));

test('1. 문장단계_ 가 일곱 — 보기 · 끊기 · 뼈대 · 조립 · 낱말 · 틀린곳 · 영어. 듣기 키는 없다', () => {
  const 단계 = 일반(ui.문장단계_);
  assert.deepEqual(단계.map(g => g.키), ['보기', '끊기', '뼈대', '조립', '낱말', '틀린곳', '영어']);
  assert.deepEqual(단계.slice(5).map(g => g.이름), ['틀린 곳 고치기', '뜻 보고 영어 고르기']);
  assert.equal(단계.some(g => g.키 === '듣기'), false);
});
test('2. 문장물을것_ — 덩어리 2개면 틀린곳 false, 3개면 true. 영어는 문장물을것_ 에 없다', () => {
  assert.equal(ui.문장물을것_(ui.문장읽기_('I=주 / run=동')).틀린곳, false);
  assert.equal(ui.문장물을것_(ui.문장읽기_('I=주 / like=동 / apples=목')).틀린곳, true);
  assert.equal('영어' in ui.문장물을것_(ui.문장읽기_('I=주 / like=동 / apples=목')), false);
});
test('3. 덩어리 바꾸기 — 바꾼 덩어리는 원래 것과 글자가 다르고 역할이 같다 (주·동·목·보 자리만, 앞뒤 20개가 먼저)', () => {
  const 줄들 = 묶음(80), 역할글 = {};
  줄들.forEach(w => w.r.덩어리.forEach(d => { if (d.표) (역할글[d.역할] ??= new Set()).add(d.글.toLowerCase()); }));
  for (const w of [줄들[0], 줄들[40], 줄들[79]]) {
    const 거리 = 일반(ui.문장바꿀거리_(줄들, w));
    assert.deepEqual(거리.map(x => x.자리), [0, 1, 2], '수식어(yesterday)는 안 바꾼다');
    for (const x of 거리) {
      const 원 = w.r.덩어리[x.자리];
      assert.equal(x.역할, 원.역할);
      assert.equal(new Set(x.후보.map(t => t.toLowerCase())).size, x.후보.length, '같은 글은 한 번만');
      for (const t of x.후보) {
        assert.notEqual(t.toLowerCase(), 원.글.toLowerCase());
        assert.ok(역할글[원.역할].has(t.toLowerCase()), t + ' 는 같은 역할의 덩어리');
      }
    }
  }
  /* 앞뒤 20개가 먼저 — 41번의 목적어 후보 맨 앞은 21~61번 안의 것 */
  const 가까운 = new Set(줄들.filter(x => Math.abs(x.no - 41) <= 20 && x.no !== 41).map(x => x.r.덩어리[2].글));
  for (let k = 0; k < 30; k++) assert.ok(가까운.has(일반(ui.문장바꿀거리_(줄들, 줄들[40]))[2].후보[0]));
  /* 자리를 옮기면 첫 글자를 맞춘다 */
  assert.equal(ui.문장자리글_('the cat', 2, 0), 'The cat');
  assert.equal(ui.문장자리글_('The girl', 0, 2), 'the girl');
  assert.equal(ui.문장자리글_('Tom', 0, 2), 'Tom', '사람 이름은 그대로');
  assert.equal(ui.문장자리글_('I', 0, 2), 'I');
});
test('4. 바꿔 끼울 덩어리가 묶음에 없으면 그 문장은 틀린 곳 고치기 · 뜻 보고 영어 고르기를 건너뛴다', () => {
  const 혼자 = [줄만들기(1, 'The boy=주 / kicked=동 / the ball=목'), 줄만들기(2, 'Birds / sing / in the morning'), 줄만들기(3, 'It / is / raining now')];
  const 문제 = Array.from(ui.문장문제들_(혼자, 혼자));
  assert.equal(문제.some(q => q.종류 === '틀린곳' || q.종류 === '영어'), false, '같은 역할의 다른 덩어리가 없다');
  assert.equal(문제.filter(q => q.종류 === '보기').length, 3, '다른 단계는 그대로');
  const 표없음 = [1, 2, 3, 4].map(n => 줄만들기(n, `The boy ${n} / kicked / the ball ${n}`));
  assert.equal(Array.from(ui.문장문제들_(표없음, 표없음)).some(q => q.종류 === '틀린곳' || q.종류 === '영어'), false, '역할 표가 없다');
  const 둘 = 묶음(10).map(w => 줄만들기(w.no, w.r.덩어리.slice(0, 2).map(d => d.글 + '=' + d.역할).join(' / ')));
  const 둘문제 = Array.from(ui.문장문제들_(둘.slice(0, 5), 둘));
  assert.equal(둘문제.some(q => q.종류 === '틀린곳'), false, '덩어리 2개는 틀린 곳 고치기를 안 한다');
  assert.ok(둘문제.some(q => q.종류 === '영어'), '뜻 보고 영어 고르기는 늘 낸다');
});

/* 틀린 곳 고치기 한 문제를 화면 함수로 끝까지 */
function 틀린곳판(골라) {
  const h = 화면(), 줄들 = 묶음(30);
  const 문제 = Array.from(h.ctx.문장문제들_(줄들.slice(0, 1), 줄들)).filter(q => q.종류 === '틀린곳');
  assert.equal(문제.length, 1);
  h.ctx.SN.판 = { 시작: 1, 끝: 1, 문장: 줄들.slice(0, 1), 소리: true, 문제, i: 0, 맞음: 0, 문항: 0, 틀린: {}, 소요: 0, 들어온때: Date.now() };
  h.ctx.문장문제열기_();
  const P = h.ctx.SN.판, Q = h.ctx.SN.문, q = 문제[0];
  골라(h, P, Q, q);
  return { h, P, Q, q };
}
test('5. 틀린 곳 고치기 — 두 번 묻고, 둘 다 맞혀야 맞힌 것. 문항 수는 하나', () => {
  {
    const { P, Q, q, h } = 틀린곳판(({ ctx }, P, Q, q) => {
      assert.equal(q.틀린곳.덩어리.length, 4);
      assert.notEqual(q.틀린곳.덩어리[q.틀린곳.자리], q.w.r.덩어리[q.틀린곳.자리].글, '한 자리가 바뀌어 있다');
      assert.ok(q.틀린곳.보기.includes(q.w.r.덩어리[q.틀린곳.자리].글) && q.틀린곳.보기.includes(q.틀린곳.끼운));
      assert.equal(q.틀린곳.보기.length, 4);
      Q.고름 = q.틀린곳.자리; ctx.문장채점_();
      assert.equal(Q.차례, '고치기'); assert.equal(Q.끝, false);
      assert.equal(P.문항, 0, '① 만 맞혀서는 세지 않는다');
      Q.고름 = Q.보기.indexOf(Q.정답); ctx.문장채점_();
    });
    assert.equal(Q.끝, true); assert.equal(P.문항, 1); assert.equal(P.맞음, 1); assert.deepEqual(일반(P.틀린), {});
    assert.match(h.칸.snFeed.innerHTML, /맞았어요/);
  }
  {
    const { P, Q, q, h } = 틀린곳판(({ ctx }, P, Q, q) => { Q.고름 = (q.틀린곳.자리 + 1) % 4; ctx.문장채점_(); });
    assert.equal(Q.끝, true, '① 에서 틀리면 다른 단계처럼 끝나고 정답을 보여 준다');
    assert.equal(Q.차례, '찾기', '② 는 묻지 않는다');
    assert.equal(P.문항, 1); assert.equal(P.맞음, 0); assert.equal(P.틀린[q.w.no], 1);
    assert.match(h.칸.snFeed.innerHTML, /정답은/);
  }
  {
    const { P, Q, q } = 틀린곳판(({ ctx }, P, Q, q) => {
      Q.고름 = q.틀린곳.자리; ctx.문장채점_();
      Q.고름 = Q.보기.indexOf(q.틀린곳.끼운); ctx.문장채점_();
    });
    assert.equal(Q.끝, true); assert.equal(P.문항, 1); assert.equal(P.맞음, 0); assert.equal(P.틀린[q.w.no], 1);
  }
  assert.match(함수(index, '문장문제그리기_'), /\(q\.종류==='보기' \? '' : '<div class="snko">'/, '틀린 곳 고치기에 해석을 보여 준다');
});
test('6. 뜻 보고 영어 고르기 — 오답 셋은 정답과 한 덩어리만 다르고, 셋이 서로 다르다. 영어는 통글(빗금 · 표 없이)', () => {
  const 줄들 = 묶음(40);
  for (let k = 0; k < 100; k++) {
    const w = 줄들[k % 40], q = Array.from(ui.문장문제들_([w], 줄들)).find(x => x.종류 === '영어');
    assert.ok(q, w.no + '번에 영어 문제가 있다');
    const 보기 = Array.from(q.영어.보기), 원 = w.r.덩어리.map(d => d.글);
    assert.equal(보기.length, 4); assert.equal(new Set(보기).size, 4);
    assert.equal(q.영어.정답, w.r.글); assert.ok(보기.includes(w.r.글));
    for (const t of 보기) assert.doesNotMatch(t, /[\/=]/);
    for (const t of 보기.filter(t => t !== w.r.글)) {
      const 한자리 = 원.some((d, i) => {
        const 앞 = 원.slice(0, i).join(' '), 뒤 = 원.slice(i + 1).join(' ');
        if (!t.startsWith(앞 ? 앞 + ' ' : '') || !t.endsWith(뒤 ? ' ' + 뒤 : '')) return false;
        const 가운데 = t.slice(앞 ? 앞.length + 1 : 0, 뒤 ? t.length - 뒤.length - 1 : t.length);
        return 가운데.length > 0 && 가운데.toLowerCase() !== d.toLowerCase();
      });
      assert.ok(한자리, `「${t}」 는 「${w.r.글}」 에서 한 덩어리만 다르다`);
    }
  }
  /* 바꾼 문장으로 셋을 못 채우면 앞뒤 20개의 다른 문장으로 */
  const 적음 = [줄만들기(1, 'The boy=주 / kicked=동 / the ball=목'), 줄만들기(2, 'The girl=주 / runs / fast'), 줄만들기(3, 'It / is / cold'), 줄만들기(4, 'We / sing / songs')];
  const q = Array.from(ui.문장문제들_([적음[0]], 적음)).find(x => x.종류 === '영어');
  const 보기 = [...q.영어.보기];
  assert.equal(보기.length, 4);
  assert.ok(보기.includes('The boy kicked the ball') && 보기.includes('The girl kicked the ball'), '바꾼 문장이 먼저');
  assert.equal(보기.filter(t => ['It is cold', 'The girl runs fast', 'We sing songs'].includes(t)).length, 2, '모자란 둘은 다른 문장으로');
  const 너무적음 = 적음.slice(0, 2);
  assert.equal(Array.from(ui.문장문제들_([너무적음[0]], 너무적음)).some(x => x.종류 === '영어'), false, '그래도 셋이 안 되면 건너뛴다');
});
test('7. 틀린 곳 고치기와 뜻 보고 영어 고르기가 같은 함수(문장바꿀거리_)를 쓴다 — 복사본이 없다', () => {
  assert.equal((shared.match(/function 문장바꿀거리_\(/g) || []).length, 1);
  for (const html of [index, teacher]) {
    assert.equal(고유(html).includes('function 문장바꿀거리_('), false);
    assert.equal(고유(html).includes('function 문장바꾼덩어리_('), false);
  }
  const 문제들 = 함수(index, '문장문제들_');
  assert.match(문제들, /문장틀린곳문제_\(문장바꿀거리_\(전체 \|\| 문장, w\), w\)/);
  assert.match(문제들, /문장영어문제_\(문장바꿀거리_\(전체 \|\| 문장, w\), w, 전체 \|\| 문장\)/);
  assert.match(함수(index, '문장틀린곳문제_'), /문장바꾼덩어리_\(/);
  assert.match(함수(index, '문장영어문제_'), /문장바꾼덩어리_\(/);
  assert.equal((고유(index).match(/\.후보/g) || []).length > 0, true);
  assert.doesNotMatch(고유(index), /역할 *=== *d\.역할|e\.역할 !== d\.역할/, '역할을 맞대어 후보를 고르는 코드는 공용에만');
});
test('8. index.html 문장 탭 칸에 듣고 고르기 코드가 없다', () => {
  assert.ok(문장칸.length > 5000, '문장 탭 칸을 찾았다');
  for (const 낱 of ['듣고 고르기', "'듣기'", '종류===\'듣기\'', '문장듣기보기_', '문장듣기시작_', '영어목소리있나_', '목소리', 'SN.진도.듣기', 'P.듣기', 'snlisten', 'snnovoice', '영작'])
    assert.equal(문장칸.includes(낱), false, 낱);
  for (const f of [index, teacher, shared, read('../services/shared-ui.css')]) {
    assert.equal(f.includes('영어목소리있나_'), false); assert.equal(f.includes('snnovoice'), false); assert.equal(f.includes('영작같나_'), false);
  }
});
test('8-1. 단어 쪽 영작은 그대로 — 본문 유형 · 수업 짜기 단계', () => {
  assert.match(teacher, /var 본문유형_ = \['빈칸 채우기','순서 맞추기','영작','듣고 쓰기'\];/);
  assert.match(index, /write:'영작'/);
  assert.match(shared, /\{ 종류: '보통', 어디: '본문', 유형: '영작' \}/);
});
test('9. 보기 단계의 읽어주기_ 는 남아 있고, 소리가 꺼지면 안 부르고 「다시 듣기」 단추도 숨긴다', () => {
  for (const 소리 of [true, false]) {
    const h = 화면(), 줄들 = 묶음(5);
    const 문제 = Array.from(h.ctx.문장문제들_(줄들.slice(0, 1), 줄들)).filter(q => q.종류 === '보기');
    h.ctx.SN.판 = { 시작: 1, 끝: 1, 문장: 줄들.slice(0, 1), 소리, 문제, i: 0, 맞음: 0, 문항: 0, 틀린: {}, 소요: 0, 들어온때: Date.now() };
    h.ctx.문장문제열기_();
    assert.deepEqual(h.읽음, 소리 ? [줄들[0].r.글] : []);
    assert.equal(h.칸.snPlay.innerHTML.includes('🔊 다시 듣기'), 소리);
  }
  assert.match(함수(index, '문장문제그리기_'), /if\(q\.종류==='보기' && P\.소리 !== false\) try\{ 읽어주기_\(r\.글\); \}catch\(e\)\{\}/);
  assert.match(함수(index, '문장판시작_'), /소리:SN\.진도\.소리 !== false/);
});
test('10. Code.gs HEADERS.단어장목록 의 여덟째가 소리', () => {
  const m = code.match(/단어장목록: \[([^\]]*)\]/);
  assert.equal(JSON.parse('[' + m[1].replace(/'/g, '"') + ']')[7], '소리');
});

/* 엔진 */
function 엔진({ 소리 = '', 머리글 = '소리' } = {}) {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', '5678']);
  const 목록 = store.insertSheet('단어장목록');
  목록.appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과', '하루몫', 머리글]);
  목록.appendRow(['초5 문장', '문장', '초5 문장', '', 10, '', '', 소리]);
  store.insertSheet('초5 문장').appendRow(['번호', '끊은 문장', '해석', '비고']);
  store.insertSheet('문장기록').appendRow(['시각', '반', '이름', '단어장', '범위', '유형', '난이도', '문항수', '정답수', '점수', '소요초', '숙제여부', '틀린문장', '구분', '집계제외']);
  const 엔 = createRuntime(store, { now: () => Date.parse('2026-11-03T03:00:00Z') });
  return { store, call: (fn, ...args) => JSON.parse(JSON.stringify(엔.call(fn, args))) };
}
test('10-1. 소리켬_ — 빈칸이면 켬, 끔 · X 등은 끔. 문장진도 가 소리를 돌려준다 (듣기는 없다)', () => {
  assert.match(code, /function 소리켬_\(v\) \{\n\s*return \['끔', 'x', '0', '아니오', 'no', 'off', 'false', 'n'\]\.indexOf\(s_\(v\)\.toLowerCase\(\)\) < 0;/);
  assert.equal(code.includes('듣기켬_'), false);
  for (const v of ['', 'O', '켬', 'yes']) assert.equal(엔진({ 소리: v }).call('문장진도', '홍길동', '초5 문장').소리, true, v);
  for (const v of ['끔', 'X', '0', '아니오', 'OFF', 'false', 'N']) assert.equal(엔진({ 소리: v }).call('문장진도', '홍길동', '초5 문장').소리, false, v);
  assert.deepEqual(엔진().call('문장진도', '홍길동', '초5 문장'), { ok: true, 진도: 0, 오늘: 0, 하루몫: 5, 소리: true });
});
test('11. 옛 머리글 「듣기」 · 「영작」 은 선생님이 단어 · 문장 탭을 열 때 「소리」 로 옮겨지고 값(끔)은 이어진다', () => {
  for (const 옛 of ['듣기', '영작']) {
    const e = 엔진({ 머리글: 옛, 소리: '끔' });
    assert.equal(e.call('문장진도', '홍길동', '초5 문장').소리, false, '옮기기 전에도 자리(여덟째)로 읽는다');
    e.call('단어목록', '틀린비번', '초5 문장');
    assert.equal(e.store.getSheetByName('단어장목록').getRange(1, 8).getValue(), 옛, '선생님이 아니면 손대지 않는다');
    e.call('단어목록', '5678', '초5 문장');
    assert.equal(e.store.getSheetByName('단어장목록').getRange(1, 8).getValue(), '소리', 옛 + ' → 소리');
    assert.equal(e.call('문장진도', '홍길동', '초5 문장').소리, false);
  }
});
test('12. 기록의 단계 수는 일곱 — 세어서 적고, 소리를 꺼도 그대로', async () => {
  for (const 소리 of [true, false]) {
    const h = 화면(), 줄들 = 묶음(10);
    h.ctx.SN.줄 = { 책: '초5 문장', 줄: 줄들 }; h.ctx.SN.진도 = { ok: true, 진도: 0, 오늘: 0, 하루몫: 5, 소리 };
    h.ctx.SN.판 = { 시작: 1, 끝: 5, 문장: 줄들.slice(0, 5), 소리, 문제: [], i: 0, 맞음: 30, 문항: 33, 틀린: {}, 소요: 0, 들어온때: Date.now() };
    h.ctx.문장판끝_();
    await new Promise(r => setImmediate(r));
    assert.equal(h.보냄.length, 1);
    assert.equal(h.보냄[0].난이도, 7); assert.equal(h.보냄[0].유형, '하루 단계');
    assert.match(h.칸.snApp.innerHTML, /하루 7단계/);
  }
  assert.match(함수(index, '문장판끝_'), /난이도:문장단계_\.length/, '숫자를 손으로 박지 않는다');
  const e = 엔진();
  for (const 유형 of ['하루 단계', '하루 6단계'])
    assert.equal(e.call('문장기록저장', { 이름: '홍길동', 단어장: '초5 문장', 범위: '1~5', 유형, 난이도: 7, 문항수: 35, 정답수: 30, 소요초: 300, 숙제여부: false, 틀린문장: [] }).ok, true, 유형 + ' 를 받는다');
});
test('13. 선생님 화면 도움말 — 새 차례 · 역할 표를 쓰는 두 단계 · 소리 칸', () => {
  const 도움 = 함수(teacher, '문장탭_');
  assert.match(도움, /보기 → 끊어 읽기 → 뼈대 찾기 → 조립하기 → 낱말로 조립 → 틀린 곳 고치기 → 뜻 보고 영어 고르기/);
  assert.match(도움, /틀린 곳 고치기와 뜻 보고 영어 고르기는 역할 표/);
  assert.match(도움, /<b>소리<\/b> 칸에 <b>끔<\/b>/);
  assert.doesNotMatch(도움, /듣고 고르기|<b>듣기<\/b>/);
  assert.match(함수(teacher, '문장단줄_'), /'틀린 곳 고치기'/);
});
