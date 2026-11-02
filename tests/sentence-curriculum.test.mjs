import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 문장 탭 3단계 — 하루 몫 · 6단계 커리큘럼.
   진도는 따로 저장하지 않는다: 문장기록에서 그 아이 · 그 묶음 기록의 가장 큰 끝번호. 무르면 같이 돌아간다.
   「지금」 은 2026-11-02(월) 21:00 서울 */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const ui = vm.createContext({ location: { protocol: 'https:', hostname: 'example.invalid', search: '' }, 창구주소: 'firestore:v1' });
vm.runInContext(read('../services/shared-ui.js'), ui);
const 물을것 = en => JSON.parse(JSON.stringify(ui.문장물을것_(ui.문장읽기_(en))));

test('뼈대 찾기는 그 문장에 적힌 만큼만 묻는다', () => {
  assert.deepEqual(물을것('Birds=주 / sing=동 / in the morning').뼈대, { 역할: ['주', '동'], 절: false, 꾸밈: false });
  assert.deepEqual(물을것('The boy=주 / kicked=동 / the ball=목').뼈대.역할, ['주', '동', '목', '보']);
  assert.deepEqual(물을것('We=주 / are=동 / happy=보').뼈대.역할, ['주', '동', '목', '보']);
  assert.deepEqual(물을것('I=주 / know=동 / that she likes me=목절 / very much=수2').뼈대, { 역할: ['주', '동', '목', '보'], 절: true, 꾸밈: true });
  assert.equal(물을것('The boy / kicked / the ball').뼈대, null, '주어·동사 표가 없으면 건너뛴다');
});
test('끊어 읽기·조립은 덩어리가 둘 이상, 낱말로 조립은 낱말이 둘 이상이어야', () => {
  assert.deepEqual((({ 끊기, 조립, 낱말 }) => [끊기, 조립, 낱말])(물을것('Hello world')), [false, false, true]);
  assert.deepEqual((({ 끊기, 조립, 낱말 }) => [끊기, 조립, 낱말])(물을것('Hello=주 / world=동')), [true, true, true]);
});
// 프롬프트 33: 마지막 단계가 영작에서 듣고 고르기로 바뀌었다 (영작은 수업 서술형 대비와 겹친다)
test('하루 6단계 차례 — 보기 · 끊어 읽기 · 뼈대 찾기 · 조립하기 · 낱말로 조립 · 듣고 고르기', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(ui.문장단계_)).map(g => g.이름), ['보기', '끊어 읽기', '뼈대 찾기', '조립하기', '낱말로 조립', '듣고 고르기']);
});

/* 엔진 — 진도 · 하루 몫 · 듣기 칸 (프롬프트 33 에서 영작 칸이 듣기 칸이 됐다 — 자리는 같은 여덟째) */
const 지금 = Date.parse('2026-11-02T12:00:00Z');
const 머리 = ['시각', '반', '이름', '단어장', '범위', '유형', '난이도', '문항수', '정답수', '점수', '소요초', '숙제여부', '틀린문장', '구분', '집계제외'];
const 줄 = (때, 이름, 책, 범위, 구분 = '연습') => [new Date(때), '', 이름, 책, 범위, '하루 6단계', 6, 25, 20, 80, 300, '', '', 구분, ''];
function 엔진({ 하루몫 = '', 듣기 = '' } = {}) {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 목록 = store.insertSheet('단어장목록');
  목록.appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과', '하루몫', '듣기']);
  목록.appendRow(['초5 문장', '문장', '초5 문장', '', 10, '', 하루몫, 듣기]);
  목록.appendRow(['교재A', '', '교재A', '', 10, '', '', '']);
  const 책 = store.insertSheet('초5 문장'); 책.appendRow(['번호', '끊은 문장', '해석', '비고']);
  for (let i = 1; i <= 20; i++) 책.appendRow([i, `I=주 / run=동 / ${i}`, '나는 달린다']);
  const 기록 = store.insertSheet('문장기록'); 기록.appendRow(머리);
  const 엔 = createRuntime(store, { now: () => 지금 });
  return { 기록, call: (fn, ...args) => JSON.parse(JSON.stringify(엔.call(fn, args))) };
}
test('진도는 그 아이 · 그 묶음 기록의 가장 큰 끝번호 — 기록이 없으면 0', () => {
  const e = 엔진();
  assert.deepEqual(e.call('문장진도', '홍길동', '초5 문장'), { ok: true, 진도: 0, 오늘: 0, 하루몫: 5, 듣기: true });
  e.기록.appendRow(줄('2026-10-30T08:00:00Z', '홍길동', '초5 문장', '1~5'));
  e.기록.appendRow(줄('2026-10-31T08:00:00Z', '홍길동', '초5 문장', '6~10'));
  e.기록.appendRow(줄('2026-10-31T08:00:00Z', '김영희', '초5 문장', '1~15'));
  e.기록.appendRow(줄('2026-10-31T08:00:00Z', '홍길동', '다른 묶음', '1~20'));
  assert.equal(e.call('문장진도', '홍길동', '초5 문장').진도, 10);
});
test('무른 기록(구분 뒤 (무효))은 진도에서 빠진다 — 무르면 진도도 돌아간다', () => {
  const e = 엔진();
  e.기록.appendRow(줄('2026-10-30T08:00:00Z', '홍길동', '초5 문장', '1~5'));
  e.기록.appendRow(줄('2026-10-31T08:00:00Z', '홍길동', '초5 문장', '6~10', '연습(무효)'));
  assert.equal(e.call('문장진도', '홍길동', '초5 문장').진도, 5);
});
test('오늘(서울 자정 기준) 지나간 문장 수를 센다 — 밤 11시에 한 것도 그날 몫', () => {
  const e = 엔진();
  e.기록.appendRow(줄('2026-11-01T14:30:00Z', '홍길동', '초5 문장', '1~5'));   // 11/01 23:30 서울 — 어제
  e.기록.appendRow(줄('2026-11-01T15:10:00Z', '홍길동', '초5 문장', '6~10'));  // 11/02 00:10 서울 — 오늘
  e.기록.appendRow(줄('2026-11-02T11:00:00Z', '홍길동', '초5 문장', '11~13')); // 11/02 20:00 서울 — 오늘
  const 답 = e.call('문장진도', '홍길동', '초5 문장');
  assert.equal(답.진도, 13); assert.equal(답.오늘, 8);
});
test('하루몫 · 듣기 칸 — 비면 5문장 · 켬, 묶음마다 적은 대로', () => {
  assert.deepEqual((({ 하루몫, 듣기 }) => [하루몫, 듣기])(엔진({ 하루몫: 3, 듣기: '끔' }).call('문장진도', '홍길동', '초5 문장')), [3, false]);
  assert.deepEqual((({ 하루몫, 듣기 }) => [하루몫, 듣기])(엔진({ 하루몫: 'abc', 듣기: 'O' }).call('문장진도', '홍길동', '초5 문장')), [5, true]);
  const 목록 = 엔진({ 하루몫: 7 }).call('시작정보').단어장목록;
  assert.equal(목록.find(b => b.이름 === '초5 문장').하루몫, 7);
  assert.equal(목록.find(b => b.이름 === '교재A').하루몫, undefined, '단어장에는 안 붙는다');
});
test('문장 묶음이 아니면 진도를 주지 않는다', () => {
  assert.equal(엔진().call('문장진도', '홍길동', '교재A').ok, false);
});
test('한 판(하루 6단계)은 범위를 「처음~끝」 으로 남기고, 그것이 다음 진도가 된다', () => {
  const e = 엔진();
  assert.equal(e.call('문장기록저장', { 이름: '홍길동', 단어장: '초5 문장', 범위: '1~5', 유형: '하루 6단계', 난이도: 6, 문항수: 25, 정답수: 24, 소요초: 400, 숙제여부: false, 틀린문장: [] }).ok, true);
  const 답 = e.call('문장진도', '홍길동', '초5 문장');
  assert.equal(답.진도, 5); assert.equal(답.오늘, 5);
  assert.deepEqual(e.기록.getRange(2, 5, 1, 2).getValues()[0], ['1~5', '하루 6단계']);
});

/* 아이 화면 — 고르는 길이 「오늘 몫」 한 단추로 */
test('아이 화면은 오늘 몫을 진도에서 정하고, 끝나면 범위로 기록한다', () => {
  const html = read('../index.html');
  assert.match(html, /api\('문장진도', 이름, 책\)/);
  assert.match(html, /범위:P\.시작\+'~'\+P\.끝, 유형:'하루 6단계'/);
  assert.doesNotMatch(html, /data-sng=/, '놀이·단을 따로 고르는 단추는 없앴다');
});
