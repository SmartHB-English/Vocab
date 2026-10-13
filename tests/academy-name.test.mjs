import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 설정의 「학원 이름」 — 선생님이 바꾸면 학생 로그인 · 꼬리말 · 학부모 · 선생님 머리가 한 값을 따라온다 */
const 지금 = Date.parse('2026-10-07T12:00:00Z');
const 머리17 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류',
  '수업', '순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분'];
const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'];

/* 설정 시트는 비밀번호 한 줄뿐 — 「학원이름」 줄이 없다 */
function 엔진() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  store.getSheetByName('설정').appendRow(['항목', '값']);
  store.getSheetByName('설정').appendRow(['선생님비밀번호', '1234']);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분']); 학생.appendRow(['', '홍길동', '1234', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  store.insertSheet('숙제').appendRow([...머리17, '학부모숨김']);
  store.insertSheet('기록').appendRow(머리기록);
  store.insertSheet('기록보관').appendRow(머리기록);
  const 엔 = createRuntime(store, { now: () => 지금 });
  return { store, call: (fn, ...args) => JSON.parse(JSON.stringify(엔.call(fn, args))) };
}
const 설정표 = e => JSON.stringify(e.store.getSheetByName('설정').export());

test('1) 설정가져오기 가 학원이름 을 돌려준다', () => {
  const r = 엔진().call('설정가져오기', '1234');
  assert.equal(r.ok, true);
  assert.equal(r.학원이름, '홍제인왕영어');
  assert.equal(r.합격점, 80);
});

test('2) 저장하고 다시 불러오면 그 이름이 그대로 — 앞뒤 공백은 뗀다, 시작정보 · 학부모 화면도 따라온다', () => {
  const e = 엔진();
  const 답 = e.call('설정저장', '1234', { 학원이름: '  새이름영어학원 ', 합격점: '85' });
  assert.deepEqual([답.ok, 답.학원이름, 답.합격점], [true, '새이름영어학원', 85]);
  assert.equal(e.call('설정가져오기', '1234').학원이름, '새이름영어학원');
  assert.equal(e.call('시작정보').학원이름, '새이름영어학원');
  assert.equal(e.call('학부모미리보기', '1234', '홍길동').학원.이름, '새이름영어학원');
});

test('3) 빈 이름 · 공백만 있는 이름은 거절한다 — 합격점도 같이 안 바뀐다', () => {
  for (const 이름 of ['', '   ', null]) {
    const e = 엔진(), 전 = 설정표(e);
    assert.deepEqual(e.call('설정저장', '1234', { 학원이름: 이름, 합격점: 90 }), { ok: false, 메시지: '학원 이름을 넣어 주세요.' });
    assert.equal(설정표(e), 전);
  }
});

test('4) 40자는 받고 41자는 거절한다', () => {
  const e = 엔진();
  assert.equal(e.call('설정저장', '1234', { 학원이름: '가'.repeat(40) }).학원이름, '가'.repeat(40));
  const 전 = 설정표(e);
  assert.equal(e.call('설정저장', '1234', { 학원이름: '가'.repeat(41) }).ok, false);
  assert.equal(설정표(e), 전);
});

test('5) 합격점만 보내면 학원 이름이 그대로 남는다 — 옛 화면이 이름을 지우지 않는다', () => {
  const e = 엔진();
  e.call('설정저장', '1234', { 학원이름: '바꾼학원' });
  const 답 = e.call('설정저장', '1234', { 합격점: 70 });
  assert.deepEqual([답.ok, 답.학원이름, 답.합격점], [true, '바꾼학원', 70]);
  assert.equal(e.call('시작정보').학원이름, '바꾼학원');
});

test('6) 비번이 틀리면 { ok:false } 이고 아무것도 안 바뀐다', () => {
  const e = 엔진(), 전 = 설정표(e);
  assert.equal(e.call('설정저장', '0000', { 학원이름: '남의학원', 합격점: 10 }).ok, false);
  assert.equal(e.call('설정가져오기', '0000').ok, false);
  assert.equal(설정표(e), 전);
});

test('7) 설정이 비어 있을 때 시작정보 · 학부모자료_ · 설정가져오기 의 기본값이 같다', () => {
  const e = 엔진();
  const 셋 = [e.call('시작정보').학원이름, e.call('학부모미리보기', '1234', '홍길동').학원.이름, e.call('설정가져오기', '1234').학원이름];
  assert.deepEqual(셋, ['홍제인왕영어', '홍제인왕영어', '홍제인왕영어']);
  /* 시트를 처음 만들 때 적는 값도 같은 상수다 */
  const gs = fs.readFileSync(new URL('./fixtures/legacy/Code.gs', import.meta.url), 'utf8');
  assert.match(gs, /\['학원이름', 기본학원이름\]/);
  assert.doesNotMatch(gs, /setting_\('학원이름', '/);
});

/* 화면 쪽 — 흉내 서버(shared-ui.js 의 DEMO)도 같은 규칙, 학생 꼬리말은 박힌 글자가 아니라 서버 값 */
function 흉내() {
  const src = fs.readFileSync(new URL('../services/shared-ui.js', import.meta.url), 'utf8');
  const 앞 = src.indexOf('var DEMO_설정'), 끝 = src.indexOf('  시작정보: function(){');
  const ctx = {};
  vm.runInNewContext(src.slice(앞, 끝).replace(/,\s*$/, '') + '\n};\nthis.DEMO = DEMO;', ctx);
  return ctx.DEMO;
}

test('흉내 서버도 학원 이름을 받고, 합격점만 보내면 이름을 남긴다', () => {
  const D = 흉내();
  assert.equal(D.설정가져오기().학원이름, '홍제인왕영어');
  assert.equal(D.설정저장('1234', { 학원이름: ' ' }).ok, false);
  assert.equal(D.설정저장('1234', { 학원이름: '가'.repeat(41) }).ok, false);
  assert.equal(D.설정저장('1234', { 학원이름: '새학원', 합격점: 75 }).학원이름, '새학원');
  assert.deepEqual([D.설정저장('1234', { 합격점: 60 }).학원이름, D.설정가져오기().합격점], ['새학원', 60]);
});

/* 학생 화면에는 학원 이름을 보이지 않는다 (2026-10-13) — 아이들 화면은 「영단어학습프로그램」 하나로 간다.
   학원 이름은 선생님 화면과 학부모 화면에만 쓴다. */
test('학생 화면(index.html)에는 학원 이름이 보이지 않는다', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const 자취 of ['academyName', 'footBrand', 'homeFoot']) {
    assert.ok(!html.includes(자취), `index.html 에 ${자취} 가 남아 있다`);
  }
  /* 판 번호(verTag)는 남는다 — 어느 판이 올라갔는지 눈으로 보는 자리다 */
  assert.match(html, /<div class="foot"><span id="verTag"/);
  /* 태블릿 옆 메뉴 머리에도 상호명을 두지 않는다 */
  assert.match(html, /<div class="hbtbrand"><b>영단어학습프로그램<\/b><\/div>/);
});

test('학원 이름은 선생님 화면과 학부모 화면에는 그대로 있다', () => {
  const teacher = fs.readFileSync(new URL('../teacher.html', import.meta.url), 'utf8');
  const parent = fs.readFileSync(new URL('../parent.html', import.meta.url), 'utf8');
  assert.ok(teacher.includes('학원이름_'), 'teacher.html 에서 학원 이름을 안 쓴다');
  assert.ok(parent.includes('학원'), 'parent.html 에서 학원 이름을 안 쓴다');
});
