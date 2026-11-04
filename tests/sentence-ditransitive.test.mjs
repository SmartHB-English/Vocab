import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 프롬프트 36 — 문장 탭의 「4형식 연습」. 하루 몫 일곱 단계와 따로 돈다.
   4형식 = =목 이 둘인 문장 (앞이 간접, 뒤가 직접목적어). 전치사는 셋째 칸(비고)에서 읽는다 — to · for · of 일 때만 바꾸기.
   한 판 = 다섯 문장 × ① 누구에게 · 무엇을 찾기 ② 3·4형식 바꾸기(방향 번갈아). 기록은 구분 「형식」 — 문장진도 가 뺀다 */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const index = read('../index.html'), teacher = read('../teacher.html'), shared = read('../services/shared-ui.js'), code = read('./fixtures/legacy/Code.gs');
const 문장칸 = index.slice(index.indexOf('문장 — 하루 몫 · 일곱 단계'), index.indexOf('iOS 구조 — 탭 5개'));
const 일반 = x => JSON.parse(JSON.stringify(x));

function 화면() {
  const 칸 = {}, 보냄 = [], 지움 = [];
  const ctx = vm.createContext({ location: { protocol: 'https:', hostname: 'example.invalid', search: '' }, 창구주소: 'firestore:v1',
    setTimeout: f => f(), localStorage: { getItem: () => null, setItem() {}, removeItem: k => 지움.push(k) } });
  vm.runInContext(shared, ctx);
  vm.runInContext(문장칸.slice(0, 문장칸.lastIndexOf('/*')).replace(/^[^\n]*\n/, '/*\n'), ctx);
  Object.assign(ctx, {
    $: id => (칸[id] ??= { innerHTML: '', textContent: '', className: '', disabled: false }), qsa: () => [], beep() {},
    읽어주기_() {}, S: { 학생: { 이름: '홍길동' }, 내단어장: [{ 이름: '초5 문장', 종류: '문장' }] },
    VocabApi: { newRequestNumber: () => 'n1' },
    api같은번호: (번호, 이름, 자료) => { 보냄.push(자료); return Promise.resolve({ ok: true }); }
  });
  ctx.SN.책 = '초5 문장';
  return { ctx, 칸, 보냄, 지움 };
}
const { ctx: ui } = 화면();
const 줄만들기 = (c, no, en, 비고 = '', ko = '뜻 ' + no) => {
  const r = c.문장읽기_(en);
  return { no, en, ko, 비고, r, 것: c.문장물을것_(r), 사형: c.문장4형식_(r, 비고) };
};
const 주어 = ['My mom', 'She', 'He', 'I', 'They', 'Tom', 'My uncle', 'The guide', 'Our teacher', 'Amy'];
const 동사 = ['gave', 'sent', 'told', 'showed', 'taught', 'lent', 'passed', 'brought', 'made', 'bought'];
const 간목 = ['me', 'him', 'us', 'her', 'them', 'me', 'us', 'him', 'her', 'them'];
const 직목 = ['a present', 'a letter', 'the truth', 'her pictures', 'a song', 'my umbrella', 'the salt', 'some fruit', 'a cake', 'a hat'];
const 사형줄들 = (c, n, 비고 = 'to', 처음 = 1) => Array.from({ length: n }, (_, i) =>
  줄만들기(c, 처음 + i, `${주어[i % 10]}=주 / ${동사[i % 10]}=동 / ${간목[i % 10]}=목 / ${직목[i % 10]}=목`, typeof 비고 === 'function' ? 비고(i) : 비고));
const 엄마 = c => 줄만들기(c, 1, 'My mom=주 / gave=동 / me=목 / a present=목', 'to', '엄마가 나에게 선물을 주셨다');
/* 한 문제를 열고 SN.문 을 돌려준다 */
function 열기(h, q) {
  h.ctx.SN.판 = { 형식: true, 문장: [q.w], 문제: [q], 소리: false, i: 0, 맞음: 0, 문항: 0, 틀린: {}, 소요: 0, 들어온때: Date.now() };
  h.ctx.문장문제열기_();
  return h.ctx.SN.문;
}
const 놓기 = (Q, 글들) => {
  for (const t of 글들) {
    const id = Q.남음.find(i => Q.조각[i].t === t);
    assert.notEqual(id, undefined, t + ' 조각이 있다');
    Q.남음 = Q.남음.filter(x => x !== id); Q.놓음.push(id);
  }
};

test('1. =목 이 둘이면 4형식 — 앞이 간접목적어, 뒤가 직접목적어. 전치사는 셋째 칸에서', () => {
  assert.deepEqual(일반(ui.문장4형식_(ui.문장읽기_('My mom=주 / gave=동 / me=목 / a present=목'), 'to')), { 간: 2, 직: 3, 전치사: 'to' });
  assert.deepEqual(일반(ui.문장4형식_(ui.문장읽기_('She=주 / made=동 / me=목 / a cake=목 / yesterday'), ' For ')), { 간: 2, 직: 3, 전치사: 'for' });
  assert.deepEqual(일반(ui.문장4형식_(ui.문장읽기_('He=주 / asked=동 / me=목 / a question=목'), 'of')), { 간: 2, 직: 3, 전치사: 'of' });
  /* 새 역할 표를 만들지 않는다 */
  assert.equal(/=간목|간목:/.test(함수글(shared, '문장읽기_')), false);
});
test('2. =목 이 하나거나 셋이면(또는 절이 끼면) 4형식 연습에 안 들어간다', () => {
  assert.equal(ui.문장4형식_(ui.문장읽기_('She=주 / plays=동 / the piano=목'), 'to'), null);
  assert.equal(ui.문장4형식_(ui.문장읽기_('A=주 / gave=동 / me=목 / you=목 / it=목'), 'to'), null);
  assert.equal(ui.문장4형식_(ui.문장읽기_('He=주 / told=동 / me=목 / that he was sick=목절'), 'to'), null);
  assert.equal(ui.문장4형식_(ui.문장읽기_('My mom / gave / me / a present'), 'to'), null, '표가 없으면 아니다');
  const 섞임 = [...사형줄들(ui, 5), 줄만들기(ui, 6, 'She=주 / plays=동 / the piano=목', 'to'), 줄만들기(ui, 7, 'A=주 / gave=동 / me=목 / you=목 / it=목', 'to')];
  assert.deepEqual(일반(ui.문장4형식수_(섞임)), { 수: 5, 바꿈: 5 });
  for (let k = 0; k < 20; k++) {
    const h = 화면(); h.ctx.SN.줄 = { 책: '초5 문장', 줄: 섞임 };
    assert.ok(Array.from(h.ctx.문장형식줄들_()).every(w => w.no <= 5));
  }
});
test('3. 비고가 to · for · of 가 아니면 바꾸기를 안 내고 찾기만 낸다 (동사에서 짐작하지 않는다)', () => {
  for (const 비고 of ['', '교과서 88쪽', 'at', 'to me']) assert.equal(ui.문장4형식_(ui.문장읽기_('My mom=주 / gave=동 / me=목 / a present=목'), 비고).전치사, '', 비고);
  const 줄들 = 사형줄들(ui, 5, '교과서 12쪽');
  const 판 = 일반(ui.문장형식문제들_(줄들, 5));
  assert.deepEqual(판.문제.map(q => q.종류), Array(5).fill('형식찾기'));
  /* 반만 전치사가 있으면 그 문장만 바꾸기 */
  const 반 = 사형줄들(ui, 6, i => (i % 2 ? 'for' : ''));
  const 판2 = ui.문장형식문제들_(반, 6);
  const 바꾸기 = Array.from(판2.문제).filter(q => q.종류 === '형식바꾸기');
  assert.equal(바꾸기.length, 3);
  assert.ok(바꾸기.every(q => q.w.사형.전치사 === 'for'));
  assert.doesNotMatch(함수글(shared, '문장전치사_'), /gave|give|동/);
});
test('4. 4형식 → 3형식 — 조각 다섯, 정답 차례는 주 · 동 · 직목 · 전치사 · 간목', () => {
  const h = 화면(), w = 엄마(h.ctx);
  const q = { 단계: '형식', w, 종류: '형식바꾸기', 방향: '43' };
  assert.deepEqual(일반(h.ctx.문장형식조각들_(q)), { 보일: 'My mom gave me a present', 답: ['My mom', 'gave', 'a present', 'to', 'me'], 미끼: [] });
  const Q = 열기(h, q);
  assert.equal(Q.조각.length, 5);
  assert.deepEqual(일반(Q.조각.map(x => x.t).sort()), ['My mom', 'a present', 'gave', 'me', 'to']);
  assert.equal(Q.미끼, false);
  assert.match(h.칸.snPlay.innerHTML, /My mom gave me a present/, '위에 4형식 문장');
  assert.match(h.칸.snApp.innerHTML, /엄마가 나에게 선물을 주셨다/, '해석도');
  놓기(Q, ['My mom', 'gave', 'a present']);
  h.ctx.문장판그리기_();
  assert.equal(h.칸.snOk.disabled, true, '조각을 다 써야 확인');
  놓기(Q, ['to', 'me']);
  h.ctx.문장판그리기_();
  assert.equal(h.칸.snOk.disabled, false);
  h.ctx.문장채점_();
  assert.equal(Q.맞, true); assert.equal(h.ctx.SN.판.맞음, 1);
  /* 수식어는 제자리 */
  const 수 = 줄만들기(h.ctx, 2, 'She=주 / made=동 / me=목 / a cake=목 / yesterday', 'for');
  assert.deepEqual(Array.from(h.ctx.문장3형식조각_(수.r, 수.사형)), ['She', 'made', 'a cake', 'for', 'me', 'yesterday']);
});
test('5. 3형식 → 4형식 — 정답 차례는 주 · 동 · 간목 · 직목, 전치사 조각 하나가 미끼로 섞인다', () => {
  const h = 화면(), w = 엄마(h.ctx);
  const q = { 단계: '형식', w, 종류: '형식바꾸기', 방향: '34' };
  assert.deepEqual(일반(h.ctx.문장형식조각들_(q)), { 보일: 'My mom gave a present to me', 답: ['My mom', 'gave', 'me', 'a present'], 미끼: ['to'] });
  const Q = 열기(h, q);
  assert.equal(Q.조각.length, 5, '네 조각 + 미끼');
  assert.equal(Q.미끼, true);
  assert.match(h.칸.snPlay.innerHTML, /My mom gave a present to me/, '위에 3형식 문장');
  놓기(Q, ['My mom', 'gave', 'me', 'a present']);
  h.ctx.문장판그리기_();
  assert.equal(h.칸.snOk.disabled, false, '미끼는 안 써도 확인할 수 있다');
  h.ctx.문장채점_();
  assert.equal(Q.맞, true);
  /* 미끼까지 끼우면 틀린다 */
  const h2 = 화면(), Q2 = 열기(h2, { 단계: '형식', w: 엄마(h2.ctx), 종류: '형식바꾸기', 방향: '34' });
  놓기(Q2, ['My mom', 'gave', 'to', 'me', 'a present']);
  h2.ctx.문장채점_();
  assert.equal(Q2.맞, false); assert.equal(h2.ctx.SN.판.문항, 1); assert.equal(h2.ctx.SN.판.맞음, 0);
});
test('6. 한 판에 두 방향이 섞여 나온다 — 다섯 문장 × 두 문제 = 열 문제', () => {
  const 줄들 = 사형줄들(ui, 30);
  for (let k = 0; k < 50; k++) {
    const 판 = 일반(ui.문장형식문제들_(줄들, 5));
    assert.equal(판.문장.length, 5);
    assert.equal(new Set(판.문장.map(w => w.no)).size, 5);
    assert.equal(판.문제.length, 10);
    const 방향 = 판.문제.filter(q => q.종류 === '형식바꾸기').map(q => q.방향);
    assert.ok(방향.includes('43') && 방향.includes('34'), 방향.join(','));
    assert.ok(방향.every((d, i) => i === 0 || d !== 방향[i - 1]), '번갈아');
    assert.ok(판.문제.every(q => q.단계 === '형식'));
  }
  /* 하루 몫 단계 목록에는 없다 */
  assert.equal(일반(ui.문장단계_).some(g => /형식/.test(g.키 + g.이름)), false);
});
test('7. 4형식 문장이 5개 미만인 묶음은 「4형식 연습」 칸이 안 뜬다', () => {
  for (const [n, 뜸] of [[0, false], [4, false], [5, true], [12, true]]) {
    const h = 화면();
    const 줄들 = [...사형줄들(h.ctx, n), ...Array.from({ length: 10 }, (_, i) => 줄만들기(h.ctx, n + i + 1, 'I=주 / like=동 / apples=목'))];
    h.ctx.SN.줄 = { 책: '초5 문장', 줄: 줄들 };
    h.ctx.SN.진도 = { ok: true, 진도: 0, 오늘: 0, 하루몫: 5, 소리: true };
    h.ctx.문장첫화면_();
    assert.equal(h.칸.snApp.innerHTML.includes('id="snDitr"'), 뜸, n + '문장');
    assert.equal(h.칸.snApp.innerHTML.includes('4형식 연습'), 뜸, n + '문장');
    assert.match(h.칸.snApp.innerHTML, /id="snStart"/, '오늘 몫은 그대로');
    if (뜸) assert.ok(h.칸.snApp.innerHTML.indexOf('snDitr') > h.칸.snApp.innerHTML.indexOf('snStart'), '오늘 몫 아래');
  }
});

/* 엔진 */
function 엔진() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 목록 = store.insertSheet('단어장목록');
  목록.appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과', '하루몫', '소리']);
  목록.appendRow(['4형식 연습', '문장', '4형식 연습', '', 10, '', '', '']);
  const 책 = store.insertSheet('4형식 연습'); 책.appendRow(['번호', '끊은 문장', '해석', '비고']);
  for (let i = 1; i <= 20; i++) 책.appendRow([i, 'My mom=주 / gave=동 / me=목 / a present=목', '엄마가 나에게 선물을 주셨다', 'to']);
  const 기록 = store.insertSheet('문장기록');
  기록.appendRow(['시각', '반', '이름', '단어장', '범위', '유형', '난이도', '문항수', '정답수', '점수', '소요초', '숙제여부', '틀린문장', '구분', '집계제외']);
  const 엔 = createRuntime(store, { now: () => Date.parse('2026-11-04T03:00:00Z') });
  return { 기록, call: (fn, ...args) => JSON.parse(JSON.stringify(엔.call(fn, args))) };
}
const 형식판 = (범위, 숙제여부 = false) => ({ 이름: '홍길동', 단어장: '4형식 연습', 범위, 유형: '4형식 연습', 구분: '형식', 난이도: 2, 문항수: 10, 정답수: 8, 소요초: 200, 숙제여부, 틀린문장: [] });
test('8. 형식 연습 기록을 여러 판 남겨도 문장진도 의 진도가 안 올라간다 (오늘 몫에도 안 센다)', () => {
  const e = 엔진();
  for (const 범위 of ['3,7,11,15,19', '1,2,3,4,5', '16,17,18,19,20', '2~20', '1~5']) assert.equal(e.call('문장기록저장', 형식판(범위)).ok, true, 범위);
  assert.equal(e.call('문장기록저장', 형식판('1~20', true)).ok, true, '숙제여부가 와도 형식');
  assert.deepEqual(e.call('문장진도', '홍길동', '4형식 연습'), { ok: true, 진도: 0, 오늘: 0, 하루몫: 5, 소리: true });
  const 줄들 = e.기록.getRange(2, 1, e.기록.getLastRow() - 1, 15).getValues();
  assert.ok(줄들.every(x => x[5] === '4형식 연습' && x[13] === '형식'), '구분 칸에 형식');
  /* 하루 몫은 그대로 센다 */
  assert.equal(e.call('문장기록저장', { ...형식판('1~5'), 유형: '하루 단계', 구분: '' }).ok, true);
  assert.deepEqual((({ 진도, 오늘 }) => ({ 진도, 오늘 }))(e.call('문장진도', '홍길동', '4형식 연습')), { 진도: 5, 오늘: 5 });
  /* 무른 형식 기록(형식(무효))도 안 센다 */
  e.기록.appendRow([new Date('2026-11-04T02:00:00Z'), '', '홍길동', '4형식 연습', '1~20', '4형식 연습', 2, 10, 10, 100, 100, '', '', '형식(무효)', '']);
  assert.equal(e.call('문장진도', '홍길동', '4형식 연습').진도, 5);
  assert.match(code, /if \(s_\(x\[13\]\)\.indexOf\(문장형식구분_\) === 0\) return;/);
});
test('8-1. 아이 화면 — 4형식 연습이 끝나면 유형 「4형식 연습」 · 구분 「형식」 · 범위는 나온 번호. 하루 몫 이어 하기 자리는 그대로', async () => {
  const h = 화면(), 줄들 = 사형줄들(h.ctx, 12);
  h.ctx.SN.줄 = { 책: '초5 문장', 줄: 줄들 };
  h.ctx.SN.진도 = { ok: true, 진도: 3, 오늘: 0, 하루몫: 5, 소리: true };
  h.ctx.문장형식판시작_();
  const P = h.ctx.SN.판;
  assert.equal(P.형식, true); assert.equal(P.문제.length, 10);
  assert.match(h.칸.snApp.innerHTML, /4형식 연습 · 누구에게 · 무엇을/);
  P.i = P.문제.length; P.문항 = 10; P.맞음 = 9; P.틀린 = { [P.문장[0].no]: 1 };
  h.ctx.문장판끝_();
  await new Promise(r => setImmediate(r));
  assert.equal(h.보냄.length, 1);
  const 보낸 = h.보냄[0];
  assert.equal(보낸.유형, '4형식 연습'); assert.equal(보낸.구분, '형식');
  assert.equal(보낸.범위, P.문장.map(w => w.no).sort((a, b) => a - b).join(','));
  assert.deepEqual([보낸.문항수, 보낸.정답수], [10, 9]);
  assert.equal(h.ctx.SN.진도.진도, 3, '아이 화면의 진도도 안 움직인다');
  assert.deepEqual(h.지움, [], '하루 몫 이어 하기 자리를 안 지운다');
  assert.match(h.칸.snApp.innerHTML, /4형식 한 판 더/);
});
test('9. 찾기 — 둘 다 맞혀야 맞힌 것, 문항 수는 하나. ① 에서 틀리면 거기서 끝', () => {
  function 찾기(첫, 둘) {
    const h = 화면(), Q = 열기(h, { 단계: '형식', w: 엄마(h.ctx), 종류: '형식찾기' });
    assert.match(h.칸.snApp.innerHTML, /누구에게/);
    assert.match(h.칸.snApp.innerHTML, /엄마가 나에게 선물을 주셨다/, '해석도 보인다');
    Q.고름 = 첫; h.ctx.문장채점_();
    if (둘 !== undefined) {
      assert.equal(Q.끝, false, '① 을 맞히면 아직 안 끝났다');
      assert.equal(h.ctx.SN.판.문항, 0);
      assert.match(h.칸.snAsk.innerHTML, /무엇을/);
      Q.고름 = 둘; h.ctx.문장채점_();
    }
    assert.equal(Q.끝, true);
    return [h.ctx.SN.판.문항, h.ctx.SN.판.맞음, h];
  }
  assert.deepEqual(찾기(2, 3).slice(0, 2), [1, 1], '둘 다 맞힘');
  assert.deepEqual(찾기(2, 0).slice(0, 2), [1, 0], '② 에서 틀림');
  const [문항, 맞음, h] = 찾기(3);
  assert.deepEqual([문항, 맞음], [1, 0], '① 에서 틀림 — 한 문제로 끝');
  assert.match(h.칸.snFeed.innerHTML, /누구에게 · 간접목적어/);
  assert.match(h.칸.snFeed.innerHTML, /무엇을 · 직접목적어/);
});
test('10. 엔진 · 선생님 화면 — 유형을 받고, 도움말 한 줄 · 묶음 미리보기에 4형식 수', () => {
  assert.match(code, /var 문장유형들_ = \[[^\]]*문장형식유형\]/);
  assert.match(teacher, /=목 을 둘 적고 셋째 칸에 to · for · of 를 적으면 4형식 연습이 열립니다/);
  assert.match(teacher, /전치사를 안 적으면 누구에게 · 무엇을 찾기만 되고 3·4형식 바꾸기는 안 나옵니다/);
  assert.match(함수글(teacher, '문장줄그리기_'), /문장4형식줄_\(줄\)/);
  const t = 화면().ctx;
  vm.runInContext(함수글(teacher, '문장4형식줄_'), t);
  const 줄 = [...사형줄들(t, 6, i => (i < 2 ? 'to' : '')).map(w => ({ en: w.en, 비고: w.비고 })), { en: 'I=주 / like=동 / apples=목', 비고: '' }];
  assert.match(t.문장4형식줄_(줄), /4형식 연습 6문장 · 바꾸기 2/);
  assert.match(t.문장4형식줄_(줄.slice(2)), /4형식 연습 4문장 — 5개부터/);
  assert.equal(t.문장4형식줄_([{ en: 'I=주 / like=동 / apples=목' }]), '');
});
function 함수글(source, name) {
  const from = source.indexOf('function ' + name + '(');
  assert.ok(from >= 0, name + ' 가 없다');
  let i = source.indexOf('{', from), depth = 0;
  for (; i < source.length; i++) { if (source[i] === '{') depth++; else if (source[i] === '}' && --depth === 0) break; }
  return source.slice(from, i + 1);
}
