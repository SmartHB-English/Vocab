import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 「문항 수」 — 범위 1~40 에서 10개만 낸다. 비우면 범위 전부.
   서버는 숙제 줄 19번째 칸에 적고 실어 보내기만 하고, 섞고 자르는 것은 아이 기기(화면 시험)·선생님 화면(종이)이 한다 */
const 지금 = Date.parse('2026-10-07T12:00:00Z');
const 머리18 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류',
  '수업', '순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분', '학부모숨김'];
/* 문항수 칸이 생기기 전에 낸 시험 — 18칸 */
const 옛줄 = ['', '교재A', 1, 40, '스펠링', '2026-10-09', new Date('2026-10-05T01:00:00Z'), '홍길동', '시험',
  '', '', '', 20, '', '', '', 5, ''];

function 엔진({ 옛것 = false } = {}) {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분']); 학생.appendRow(['', '홍길동', '1234', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 숙제 = store.insertSheet('숙제');
  숙제.appendRow(머리18);
  if (옛것) 숙제.appendRow(옛줄);
  store.insertSheet('기록').appendRow(['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외']);
  const 엔 = createRuntime(store, { now: () => 지금 });
  return { store, 숙제, call: (fn, ...args) => JSON.parse(JSON.stringify(엔.call(fn, args))) };
}
const 시험내기 = (e, 더 = {}) => e.call('숙제등록', '1234', {
  단어장: '교재A', 시작: 1, 끝: 40, 유형: '스펠링', 종류: '시험', 마감일: '2026-10-09', 학생들: ['홍길동'],
  외우기분: 5, 제한시간: 20, 바뀐줄만: true, ...더,
});

test('1) 문항수 10으로 시험을 내면 숙제 줄 19번째 칸에 10이 적히고, 아이·선생님 쪽에 실린다', () => {
  const e = 엔진();
  const 답 = 시험내기(e, { 문항수: 10 });
  assert.equal(답.ok, true, 답.메시지);
  assert.equal(e.숙제.getRange(1, 19).getValue(), '문항수');           // 머리도 19칸으로 넓어졌다
  assert.equal(e.숙제.getRange(2, 19).getValue(), 10);
  assert.equal(e.숙제.getRange(2, 17).getValue(), 5);                  // 외우기분 자리는 그대로
  assert.equal(e.숙제.getRange(2, 18).getValue(), '');                 // 학부모숨김은 빈칸
  assert.equal(답.숙제.문항수, 10);
  assert.equal(e.call('숙제가져오기', '홍길동')[0].문항수, 10);
  assert.equal(e.call('선생님기본', '1234').숙제목록[0].문항수, 10);
  /* 기록의 범위는 숙제 범위 그대로다 — 줄의 시작·끝을 바꾸지 않는다 */
  assert.deepEqual([e.숙제.getRange(2, 3).getValue(), e.숙제.getRange(2, 4).getValue()], [1, 40]);
});

test('2) 0 · 빈 값 · 글자 · 빠뜨림 → 빈 칸 (= 범위 전부)', () => {
  for (const v of [0, '', 'abc', -3, undefined]) {
    const e = 엔진();
    const 답 = 시험내기(e, v === undefined ? {} : { 문항수: v });
    assert.equal(답.ok, true, `${v}: ${답.메시지}`);
    assert.equal(e.숙제.getRange(2, 19).getValue(), '', `${v}`);
    assert.equal(e.call('숙제가져오기', '홍길동')[0].문항수, '', `${v}`);
  }
});

test('3) 201 은 거절한다 — 줄을 쓰지 않는다 · 200 은 받는다', () => {
  const e = 엔진();
  const 답 = 시험내기(e, { 문항수: 201 });
  assert.equal(답.ok, false);
  assert.match(답.메시지, /1에서 200/);
  assert.equal(e.숙제.getLastRow(), 1);
  assert.equal(시험내기(e, { 문항수: 200 }).ok, true);
  assert.equal(e.숙제.getRange(2, 19).getValue(), 200);
});

test('4) 18칸짜리 옛 숙제 줄을 읽어도 안 터지고, 문항수는 빈 값이다', () => {
  const e = 엔진({ 옛것: true });
  const 아이 = e.call('숙제가져오기', '홍길동');
  assert.equal(아이.length, 1);
  assert.equal(아이[0].문항수, '');
  assert.equal(아이[0].끝, 40);
  const 선생님 = e.call('선생님기본', '1234').숙제목록;
  assert.equal(선생님[0].문항수, '');
  assert.equal(선생님[0].외우기분, 5);
  /* 줄이 정말 18칸일 때 — 칸이 없으면 빈 값 */
  const ctx = vm.createContext({});
  vm.runInContext(readFileSync(new URL('./fixtures/legacy/Code.gs', import.meta.url), 'utf8'), ctx);
  assert.equal(옛줄.length, 18);
  assert.equal(ctx.문항수읽기_(옛줄), '');
  assert.equal(ctx.문항수읽기_([...옛줄, 10]), 10);
});

test('5) 숙제수정 으로 문항수만 고쳐도 다른 칸이 안 지워진다 · 비우면 범위 전부로 · 201 은 거절', () => {
  const e = 엔진({ 옛것: true });
  const 전 = e.숙제.getRange(2, 1, 1, 18).getValues()[0];
  const 낸때 = 전[6].getTime();
  const 답 = e.call('숙제수정', '1234', 2, { 문항수: 10, 낸때, 바뀐줄만: true });
  assert.equal(답.ok, true, 답.메시지);
  assert.equal(답.숙제.문항수, 10);
  assert.equal(답.숙제.외우기분, 5);
  assert.equal(답.숙제.제한시간, 20);
  const 후 = e.숙제.getRange(2, 1, 1, 19).getValues()[0];
  assert.deepEqual(JSON.parse(JSON.stringify(후.slice(0, 18))), JSON.parse(JSON.stringify(전)));
  assert.equal(후[18], 10);
  assert.equal(e.call('숙제가져오기', '홍길동')[0].문항수, 10);

  assert.equal(e.call('숙제수정', '1234', 2, { 문항수: 201, 낸때, 바뀐줄만: true }).ok, false);
  assert.equal(e.숙제.getRange(2, 19).getValue(), 10);

  assert.equal(e.call('숙제수정', '1234', 2, { 문항수: '', 낸때, 바뀐줄만: true }).ok, true);
  assert.equal(e.숙제.getRange(2, 19).getValue(), '');
  assert.equal(e.숙제.getRange(2, 17).getValue(), 5);

  /* 시간만 고치면 문항수는 그대로 */
  e.call('숙제수정', '1234', 2, { 문항수: 12, 낸때, 바뀐줄만: true });
  e.call('숙제수정', '1234', 2, { 제한시간: 15, 낸때, 바뀐줄만: true });
  assert.equal(e.숙제.getRange(2, 19).getValue(), 12);
  assert.equal(e.숙제.getRange(2, 13).getValue(), 15);
});

/* ---------- 화면 쪽 — 섞고 자르는 조각만 떼어 돌린다 ---------- */
const 공용 = readFileSync(new URL('../services/shared-ui.js', import.meta.url), 'utf8');
function 조각(src, 이름) {
  const i = src.indexOf('function ' + 이름 + '(');
  assert.ok(i > -1, 이름 + ' 이 없다');
  let 깊이 = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) {
    if (src[j] === '{') 깊이++;
    else if (src[j] === '}' && --깊이 === 0) break;
  }
  return src.slice(i, j + 1);
}
const 화면 = vm.createContext({});
vm.runInContext(['shuffle', '문항자르기_', '문항뽑기_'].map(n => 조각(공용, n)).join('\n'), 화면);
const 사십 = Array.from({ length: 40 }, (_, i) => ({ no: i + 1, en: 'w' + (i + 1) }));

test('6) 섞고 자르기 — 40개에 10 → 10개, 비우면 40개, 100 → 40개', () => {
  const 열 = 화면.문항뽑기_(사십, 10);
  assert.equal(열.length, 10);
  assert.equal(new Set(열.map(w => w.no)).size, 10);                   // 겹치지 않는다
  assert.ok(열.every(w => 사십.includes(w)));                          // 범위 안의 단어들
  assert.equal(화면.문항뽑기_(사십, '').length, 40);
  assert.equal(화면.문항뽑기_(사십, undefined).length, 40);
  assert.equal(화면.문항뽑기_(사십, 0).length, 40);
  assert.equal(화면.문항뽑기_(사십, 100).length, 40);
  assert.equal(화면.문항뽑기_(사십, 40).length, 40);
  assert.equal(사십.length, 40);                                        // 원래 목록은 그대로
  /* 아이마다 다른 10개 — 여러 번 뽑으면 같은 묶음만 나오지 않는다 */
  const 묶음들 = new Set(Array.from({ length: 20 }, () => 화면.문항뽑기_(사십, 10).map(w => w.no).sort((a, b) => a - b).join(',')));
  assert.ok(묶음들.size > 1);
  /* 종이 — 순서를 정한 뒤 앞에서 자른다 */
  assert.deepEqual(화면.문항자르기_(사십, 3).map(w => w.no), [1, 2, 3]);
});

test('6-1) 아이 화면 두 곳(startQuiz·startVerb)이 문항수로 자르고, 기록 범위는 숙제 범위 그대로', () => {
  const 앱 = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(조각(앱, 'startQuiz'), /startSheet\(mode, 고른 \|\| 문항뽑기_\(r\.list, 숙제문항수_\(\)\), 기록범위\(r\)\)/);
  assert.match(조각(앱, 'startVerb'), /S\.문제=문항뽑기_\(r\.list, 숙제문항수_\(\)\); S\.범위=기록범위\(r\);/);
  /* 오답 다시 풀기·자유 연습에는 안 쓴다 */
  const ctx = vm.createContext({ S: {} });
  vm.runInContext(조각(앱, '숙제문항수_'), ctx);
  ctx.S.현재숙제 = { 문항수: 10 }; ctx.S.재시험 = false;
  assert.equal(ctx.숙제문항수_(), 10);
  ctx.S.재시험 = true;
  assert.equal(ctx.숙제문항수_(), '');
  ctx.S.현재숙제 = null; ctx.S.재시험 = false;
  assert.equal(ctx.숙제문항수_(), '');
  /* 기록범위 는 숙제의 시작~끝 — 문항수와 상관없다 */
  assert.doesNotMatch(조각(앱, '기록범위'), /문항/);
});
