// 프롬프트 60 — 단어 진도를 기록에서 읽고 다음 숙제를 뽑는 셈 (화면은 61에서).
// 진도는 어디에도 저장하지 않는다. 기록 · 기록보관에서 범위마다 최고점 · 본 횟수를 센다 (문장진도 를 본뜬 것).
// 다음숙제뽑기 는 뽑기만, 진도숙제내기 는 받은 줄 그대로 낸다. 시험은 숙제 예약에 아이마다 한 줄, 같은 묶음 값으로.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

const code = readFileSync(new URL('./fixtures/legacy/Code.gs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const 일반 = x => JSON.parse(JSON.stringify(x));
const 비번 = '5678';
const 서울 = t => new Date(t + '+09:00').getTime();
const 머리숙제 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류',
  '수업', '순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분', '학부모숨김', '문항수', '숙제코드'];
const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초',
  '숙제여부', '틀린단어', '구분', '집계제외', '이탈수', '이탈초', '복사시도', '숙제코드'];
const 예약머리옛 = ['만든때', '날짜', '시각', '요약', '내용', '알림함께', '보낸때', '켬'];

/** 판 — 교재A 75단어(하루몫 10) · 교재B 30단어(하루몫 칸 빔, 레슨 6) · 과책 · 문장책.
    홍길동 · 김영희 · 박철수 는 교재A, 이빈칸 은 교재 없음, 최없음 은 없는 교재, 정과 는 과책, 한문장 은 문장책, 윤섞임 은 「교재B | 교재A」 */
function 판({ 더아이 = 0 } = {}) {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 비번]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재']);
  [['홍길동', '교재A'], ['김영희', '교재A'], ['박철수', '교재A'], ['이빈칸', ''], ['최없음', '없는책'],
   ['정과', '과책'], ['한문장', '문장책'], ['윤섞임', '교재B | 교재A']]
    .forEach(([n, 책], i) => 학생.appendRow(['', n, String(1000 + i), '', '', '', '', 책]));
  for (let i = 1; i <= 더아이; i++) 학생.appendRow(['', '아이' + i, String(2000 + i), '', '', '', '', '교재A']);
  const 목록 = store.insertSheet('단어장목록');
  목록.appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과', '하루몫', '소리']);
  목록.appendRow(['교재A', '', 'wA', '', '', '', 10, '']);
  목록.appendRow(['교재B', '', 'wB', '', 6, '', '', '']);
  목록.appendRow(['과책', '과', 'w과', '', '', '', '', '']);
  목록.appendRow(['문장책', '문장', 'w문장', '', '', '', 5, '']);
  const 시트 = (이름, n) => { const sh = store.insertSheet(이름); sh.appendRow(['번호', '영어', '뜻']); for (let i = 1; i <= n; i++) sh.appendRow([i, 'w' + i, '뜻' + i]); };
  시트('wA', 75); 시트('wB', 30); 시트('w과', 12); 시트('w문장', 20);
  store.insertSheet('숙제').appendRow(머리숙제);
  store.insertSheet('기록').appendRow(머리기록);
  store.insertSheet('기록보관').appendRow(머리기록);
  return store;
}
function 엔진(store = 판(), 처음 = '2026-11-24T18:00:00') {
  let 시계 = 서울(처음);
  const 엔 = createRuntime(store, { now: () => 시계 });
  return {
    store,
    call: (fn, ...args) => 일반(엔.call(fn, args)),
    날것: (fn, ...args) => 엔.call(fn, args),
    돌기: t => { 시계 = 서울(t); return 일반(엔.scheduledHomework(시계)); },
  };
}
let 분 = 0;
/** 기록 한 줄 — 숙제여부 O, 구분 빈칸이 기본 (숙제로 낸 것) */
function 적기(store, 이름, 책, 범위, 점수, { 구분 = '', 숙제 = 'O', 코드 = '', 표 = '기록' } = {}) {
  분 += 1;
  store.getSheetByName(표).appendRow([new Date(서울('2026-11-10T16:00:00') + 분 * 60000), '', 이름, 책, 범위, '스펠링', 10, 0,
    점수, 0, 0, 60, 숙제, '', 구분, '', 0, 0, 0, 코드]);
}
const 뽑기 = (e, 이름들) => e.call('다음숙제뽑기', 비번, 이름들);
const 한줄 = (e, 이름) => 뽑기(e, [이름]).줄들[0];
const 범위 = 줄 => `${줄.시작}~${줄.끝}`;
const 숙제줄들 = store => { const sh = store.getSheetByName('숙제'); const n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, 20).getValues() : []; };
const 예약줄들 = store => { const sh = store.getSheetByName('숙제예약'); if (!sh) return []; const n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, 9).getValues() : []; };

test('1. 통과한 범위의 가장 큰 끝번호가 진도다', () => {
  const e = 엔진();
  적기(e.store, '홍길동', '교재A', '1~10', 90);
  적기(e.store, '홍길동', '교재A', '11~20', 100);
  적기(e.store, '홍길동', '교재A', '21~30', 80, { 표: '기록보관' });     // 보관함도 본다 · 80 은 넘은 것
  const 줄 = 한줄(e, '홍길동');
  assert.equal(줄.진도, 30);
  assert.equal(범위(줄), '31~40', '진도 + 1 부터 하루몫 10');
  assert.equal(줄.까닭, '지난번 21~30 통과');
  assert.equal(줄.낼까, true);
  assert.equal(줄.단어장, '교재A');
  assert.equal(e.call('다음숙제뽑기', '0000', ['홍길동']).ok, false, '선생님 비번을 거친다');
});

test('2. 80점을 못 넘은 범위는 끝난 걸로 안 친다 — 같은 범위가 다시 나온다', () => {
  const e = 엔진();
  적기(e.store, '홍길동', '교재A', '1~10', 90);
  적기(e.store, '홍길동', '교재A', '11~20', 79);
  const 줄 = 한줄(e, '홍길동');
  assert.equal(범위(줄), '11~20');
  assert.equal(줄.까닭, '80점 못 넘음 — 다시');
  assert.equal(줄.진도, 10);
  assert.equal(줄.낼까, true);
  /* 숙제의 통과점수가 있으면 그것으로 — 70점짜리 숙제에서 75 는 넘은 것 */
  const e2 = 엔진();
  e2.store.getSheetByName('숙제').appendRow(['', '교재A', 11, 20, '스펠링', '2026-11-10', new Date(), '홍길동', '당일',
    '', 0, '', '', '시험', 70, '', '', '', '', 'hcode70']);
  적기(e2.store, '홍길동', '교재A', '1~10', 90);
  적기(e2.store, '홍길동', '교재A', '11~20', 75, { 코드: 'hcode70' });
  assert.equal(범위(한줄(e2, '홍길동')), '21~30');
  /* 통과점수가 90 이면 85 로는 못 넘는다 — 까닭에도 그 점수 */
  e2.store.getSheetByName('숙제').appendRow(['', '교재A', 21, 30, '스펠링', '2026-11-11', new Date(), '홍길동', '당일',
    '', 0, '', '', '시험', 90, '', '', '', '', 'hcode90']);
  적기(e2.store, '홍길동', '교재A', '21~30', 85, { 코드: 'hcode90' });
  const 줄2 = 한줄(e2, '홍길동');
  assert.equal(범위(줄2), '21~30');
  assert.equal(줄2.까닭, '90점 못 넘음 — 다시');
});

test('3. 두 번 본 범위는 점수가 낮아도 끝난 것으로 친다 — 세 번째엔 다음 범위가 나온다', () => {
  const e = 엔진();
  적기(e.store, '홍길동', '교재A', '1~10', 40);
  assert.equal(범위(한줄(e, '홍길동')), '1~10', '한 번 — 다시');
  적기(e.store, '홍길동', '교재A', '1~10', 50, { 표: '기록보관' });   // 두 번째는 보관함에 — 둘을 합쳐 센다
  const 줄 = 한줄(e, '홍길동');
  assert.equal(범위(줄), '11~20');
  assert.equal(줄.진도, 10);
  assert.match(줄.까닭, /^지난번 1~10 /);
});

test('4. 시험 기록은 진도에 안 센다 (숙제여부가 빈 연습도)', () => {
  const e = 엔진();
  적기(e.store, '홍길동', '교재A', '1~10', 100);
  적기(e.store, '홍길동', '교재A', '11~40', 100, { 구분: '시험' });   // 학원 시험 — 숙제여부는 O 라도
  적기(e.store, '홍길동', '교재A', '41~50', 100, { 숙제: '' });       // 혼자 연습
  const 줄 = 한줄(e, '홍길동');
  assert.equal(줄.진도, 10);
  assert.equal(범위(줄), '11~20');
  /* 보충은 숙제 쪽이라 센다 · 오답 재시험은 응시가 아니다 */
  적기(e.store, '홍길동', '교재A', '11~20', 90, { 구분: '보충' });
  적기(e.store, '홍길동', '교재A', '21~30', 100, { 구분: '오답 재시험' });
  assert.equal(범위(한줄(e, '홍길동')), '21~30');
});

test('5. 무효 처리된 기록은 진도에 안 센다', () => {
  const e = 엔진();
  적기(e.store, '홍길동', '교재A', '1~10', 100);
  적기(e.store, '홍길동', '교재A', '11~20', 100, { 구분: '(무효)' });
  적기(e.store, '홍길동', '교재A', '11~20', 10, { 구분: '숙제(무효)' });
  적기(e.store, '홍길동', '교재A', '21~30', 100, { 구분: '보충(무효)' });
  const 줄 = 한줄(e, '홍길동');
  assert.equal(줄.진도, 10);
  assert.equal(범위(줄), '11~20');
  assert.equal(줄.까닭, '지난번 1~10 통과', '무른 두 줄은 「두 번 봄」 에도 안 든다');
});

test('6. 섞은 시험(41~50, 1~20)은 진도에 안 센다', () => {
  const e = 엔진();
  적기(e.store, '홍길동', '교재A', '1~10', 100);
  적기(e.store, '홍길동', '교재A', '41~50, 1~20', 100);
  적기(e.store, '홍길동', '교재A|교재B', '41~50, 1~20', 100);
  적기(e.store, '홍길동', '교재A', '본문 1~12', 100);
  assert.equal(범위(한줄(e, '홍길동')), '11~20');
});

test('7. 기록이 하나도 없으면 1 부터 시작한다', () => {
  const e = 엔진();
  적기(e.store, '김영희', '교재A', '1~10', 100);   // 다른 아이 기록은 안 섞인다
  적기(e.store, '홍길동', '교재B', '1~10', 100);   // 다른 단어장 기록도
  const 줄 = 한줄(e, '홍길동');
  assert.deepEqual([범위(줄), 줄.진도, 줄.까닭, 줄.낼까], ['1~10', 0, '처음', true]);
  /* 하루몫 칸이 빈 단어장은 레슨 크기(교재B 는 6) */
  const 윤 = 한줄(e, '윤섞임');
  assert.equal(윤.단어장, '교재B');
  assert.equal(범위(윤), '1~6');
});

test('8. 중간이 비어 있으면(41~50 통과, 51~60 못 함, 61~70 통과) 51~60 이 다시 나온다', () => {
  const e = 엔진();
  for (let s = 1; s <= 41; s += 10) 적기(e.store, '홍길동', '교재A', `${s}~${s + 9}`, 90);
  적기(e.store, '홍길동', '교재A', '51~60', 60);
  적기(e.store, '홍길동', '교재A', '61~70', 95);
  const 줄 = 한줄(e, '홍길동');
  assert.equal(줄.진도, 70);
  assert.equal(범위(줄), '51~60', '71 로 건너뛰지 않는다');
  assert.equal(줄.까닭, '80점 못 넘음 — 다시');
  /* 아예 안 본 구멍(51~60 기록 없음)은 셈이 모른다 — 기록에 없는 범위는 「못 함」 이 아니라 「안 냄」 이다 */
  /* 못 넘은 범위를 더 큰 범위로 통과해 덮었으면 끝난 것이다 */
  const e2 = 엔진();
  적기(e2.store, '김영희', '교재A', '1~10', 50);
  적기(e2.store, '김영희', '교재A', '1~20', 85);
  assert.equal(범위(한줄(e2, '김영희')), '21~30');
});

test('9. 단어 수를 넘는 범위는 끝에서 잘린다', () => {
  const e = 엔진();
  for (let s = 1; s <= 61; s += 10) 적기(e.store, '홍길동', '교재A', `${s}~${s + 9}`, 90);
  const 줄 = 한줄(e, '홍길동');
  assert.equal(줄.진도, 70);
  assert.equal(범위(줄), '71~75', '교재A 는 75단어');
  assert.equal(줄.낼까, true);
});

test('10. 더 줄 게 없으면 낼까 false 와 「끝까지 다 했어요」 가 온다', () => {
  const e = 엔진();
  for (let s = 1; s <= 61; s += 10) 적기(e.store, '홍길동', '교재A', `${s}~${s + 9}`, 90);
  적기(e.store, '홍길동', '교재A', '71~75', 100);
  const 줄 = 한줄(e, '홍길동');
  assert.equal(줄.진도, 75);
  assert.equal(줄.낼까, false);
  assert.equal(줄.까닭, '끝까지 다 했어요');
  assert.equal(줄.단어장, '교재A', '다음 단어장으로 넘기지 않는다');
  assert.equal(숙제줄들(e.store).length, 0, '뽑기는 숙제를 만들지 않는다');
});

test('11. 교재가 빈 아이, 못 찾는 교재, 「과」 단어장 — 줄로 돌아온다 (사라지지 않는다)', () => {
  const e = 엔진();
  const r = 뽑기(e, ['이빈칸', '최없음', '정과', '한문장', '윤섞임', '없는아이', '홍길동']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.줄들.map(x => x.이름), ['이빈칸', '최없음', '정과', '한문장', '윤섞임', '없는아이', '홍길동'], '차례 그대로, 빠짐없이');
  const 까닭 = Object.fromEntries(r.줄들.map(x => [x.이름, [x.낼까, x.까닭]]));
  assert.deepEqual(까닭.이빈칸, [false, '교재가 안 적혀 있어요']);
  assert.deepEqual(까닭.최없음, [false, '교재를 단어장에서 못 찾았어요']);
  assert.deepEqual(까닭.정과, [false, '「과」 단어장이라 아직 안 돼요']);
  assert.deepEqual(까닭.한문장, [false, '문장 단어장이라 아직 안 돼요']);
  assert.deepEqual(까닭.없는아이, [false, '명단에 없는 이름이에요']);
  assert.equal(까닭.윤섞임[0], true);
  assert.match(까닭.윤섞임[1], /^처음 \(교재가 여럿이라 첫 것 「교재B」 만\)$/, '섞인 교재 칸은 첫 단어장만 쓰고 까닭에 적는다');
  assert.deepEqual(까닭.홍길동, [true, '처음']);
  assert.match(r.읽은때, /^2026-11-24 18:00$/);
});

test('12. 아이 스물둘을 넘겨도 기록을 한 번만 읽는다', () => {
  const store = 판({ 더아이: 22 });
  const e = 엔진(store);
  for (let i = 1; i <= 22; i++) 적기(store, '아이' + i, '교재A', '1~10', i % 2 ? 90 : 50);
  적기(store, '아이22', '교재A', '1~10', 50, { 표: '기록보관' });     // 빈 표는 아예 안 읽으니 — 세 표 다 줄을 둔다
  store.getSheetByName('숙제').appendRow(['', '교재A', 1, 10, '스펠링', '2026-11-10', new Date(), '아이1', '당일']);
  const 셈 = {};
  for (const 표 of ['기록', '기록보관', '숙제', '학생', '단어장목록']) {
    const sh = store.getSheetByName(표), 원래 = sh.getRange.bind(sh);
    셈[표] = 0;
    sh.getRange = (행, ...나머지) => { if (행 === 2) 셈[표] += 1; return 원래(행, ...나머지); };
  }
  const 이름들 = Array.from({ length: 22 }, (_, i) => '아이' + (i + 1));
  const r = 뽑기(e, 이름들);
  assert.equal(r.줄들.length, 22);
  assert.deepEqual(셈, { 기록: 1, 기록보관: 1, 숙제: 1, 학생: 1, 단어장목록: 1 });
  assert.equal(범위(r.줄들[0]), '11~20');
  assert.equal(범위(r.줄들[1]), '1~10', '아이2 는 50점 한 번 — 다시');
  assert.equal(범위(r.줄들[21]), '11~20', '아이22 는 50점 두 번 (기록 + 보관함) — 넘어간다');
  /* 저절로 도는 것이 없다 — 시계 · 되풀이 없이 부를 때만 */
  const 몸 = code.slice(code.indexOf('/* ==================================================================\n   단어 진도'), code.indexOf('function 진도시험꾸러미_('));
  assert.doesNotMatch(몸, /setInterval|setTimeout|newTrigger/);
  /* 진도를 어디에도 저장하지 않는다 — 쓰는 곳은 숙제등록안_ 과 숙제예약넣기_ 뿐 */
  assert.doesNotMatch(몸.slice(0, 몸.indexOf('function 묶음만들기_(')), /setValue|appendRow|insertSheet/);
});

test('13. 진도숙제내기 는 받은 줄 그대로 낸다 — 진도를 다시 세지 않는다', () => {
  const e = 엔진();
  적기(e.store, '홍길동', '교재A', '1~10', 100);              // 셈대로면 11~20
  const r = e.call('진도숙제내기', 비번, [{ 이름: '홍길동', 단어장: '교재A', 시작: 5, 끝: 7 },
                                       { 이름: '김영희', 단어장: '교재A', 시작: 31, 끝: 45 }],
                   { 유형: '4지선다', 종류: '당일', 문항수: 5 });
  assert.deepEqual([r.ok, r.낸수, r.시험수, r.못낸], [true, 2, 0, []]);
  const 줄들 = 숙제줄들(e.store);
  assert.deepEqual(줄들.map(x => [x[1], x[2], x[3], x[4], x[7], x[8], x[18]]),
    [['교재A', 5, 7, '4지선다', '홍길동', '당일', 5], ['교재A', 31, 45, '4지선다', '김영희', '당일', 5]]);
  assert.ok(줄들.every(x => /^h\d+[0-9a-z]{4}$/.test(x[19])), '숙제코드는 줄마다');
  assert.notEqual(줄들[0][19], 줄들[1][19]);
  const 몸 = code.slice(code.indexOf('function 진도숙제내기('), code.indexOf('function 진도시험꾸러미_('));
  assert.doesNotMatch(몸, /다음숙제뽑기\(|단어진도_?\(|단어진도표_\(/, '뽑기를 다시 부르지 않는다');
  assert.equal(e.call('진도숙제내기', '0000', [{ 이름: '홍길동', 단어장: '교재A', 시작: 1, 끝: 10 }], {}).ok, false);
  assert.equal(e.call('진도숙제내기', 비번, [], {}).ok, false);
});

test('14. 한 아이가 터져도 나머지는 나간다', () => {
  const e = 엔진();
  const 펑 = { toString() { throw new Error('펑'); } };
  const r = e.날것('진도숙제내기', 비번, [
    { 이름: '홍길동', 단어장: '교재A', 시작: 1, 끝: 10 },
    { 이름: '김영희', 단어장: 펑, 시작: 1, 끝: 10 },
    { 이름: '박철수', 단어장: '교재A', 시작: 10, 끝: 3 },
    { 이름: '없는아이', 단어장: '교재A', 시작: 1, 끝: 10 },
    { 이름: '정과', 단어장: '과책', 시작: 1, 끝: 5 },
    { 이름: '윤섞임', 단어장: '교재B|교재A', 시작: 1, 끝: 5 },
    { 이름: '홍길동', 단어장: '교재A', 시작: 11, 끝: 20 },
    { 이름: '한문장', 단어장: '교재B', 시작: 1, 끝: 6 },
  ], { 유형: '스펠링', 종류: '당일' });
  assert.equal(r.ok, true);
  assert.equal(r.낸수, 2);
  assert.deepEqual(r.못낸.map(x => x.이름), ['김영희', '박철수', '없는아이', '정과', '윤섞임', '홍길동']);
  assert.equal(r.못낸[0].까닭, '펑');
  assert.equal(r.못낸[1].까닭, '범위가 맞지 않아요');
  assert.equal(r.못낸[3].까닭, '「과」 단어장이라 아직 안 돼요');
  assert.equal(r.못낸[5].까닭, '같은 아이가 두 번 들어 있어요');
  assert.deepEqual(숙제줄들(e.store).map(x => [x[7], x[1], x[2], x[3]]), [['홍길동', '교재A', 1, 10], ['한문장', '교재B', 1, 6]]);
});

test('15. 시험을 걸면 그 아이들의 예약 줄이 같은 묶음 값으로 생긴다', () => {
  const e = 엔진();
  const r = e.call('진도숙제내기', 비번, [
    { 이름: '홍길동', 단어장: '교재A', 시작: 11, 끝: 20 },
    { 이름: '김영희', 단어장: '교재A', 시작: 1, 끝: 10 },
    { 이름: '박철수', 단어장: '교재A', 시작: 21, 끝: 30 },
  ], { 유형: '스펠링', 종류: '당일', 문항수: 10 }, { 이름들: ['홍길동', '김영희', '이빈칸'], 날짜: '2026-11-27', 시각: '15:30' });
  assert.equal(r.ok, true);
  assert.deepEqual([r.낸수, r.시험수], [3, 2]);
  assert.deepEqual(r.못낸, [{ 이름: '이빈칸', 까닭: '시험 예약: 숙제 줄이 없어요' }], '시험에 골랐는데 줄이 없는 아이도 조용히 빼지 않는다');
  assert.match(r.묶음, /^g[0-9a-z]{6}$/);
  const 예약 = 예약줄들(e.store);
  assert.equal(예약.length, 2, '아이마다 한 줄');
  assert.deepEqual(e.store.getSheetByName('숙제예약').getRange(1, 1, 1, 9).getValues()[0], [...예약머리옛, '묶음']);
  assert.ok(예약.every(x => x[8] === r.묶음), '같은 묶음 값');
  assert.deepEqual(예약.map(x => [x[1], x[2]]), [['2026-11-27', '15:30'], ['2026-11-27', '15:30']], '선생님이 고른 날짜 · 시각 그대로');
  const 꾸러미 = 예약.map(x => JSON.parse(x[4]));
  assert.deepEqual(꾸러미.map(h => [h.학생들, h.단어장, h.시작, h.끝, h.종류, h.마감일, h.문항수]),
    [[['홍길동'], '교재A', 11, 20, '시험', '2026-11-27', 10], [['김영희'], '교재A', 1, 10, '시험', '2026-11-27', 10]], '같은 범위를 시험으로');
  /* 목록에도 묶음이 실린다 */
  const 목록 = e.call('숙제예약목록', 비번).예약;
  assert.deepEqual(목록.map(n => n.묶음), [r.묶음, r.묶음]);
  /* 다음에 또 내면 다른 묶음 */
  const r2 = e.call('진도숙제내기', 비번, [{ 이름: '박철수', 단어장: '교재A', 시작: 31, 끝: 40 }], { 종류: '당일' },
                    { 이름들: ['박철수'], 날짜: '2026-11-27', 시각: '15:30' });
  assert.equal(r2.시험수, 1);
  assert.notEqual(r2.묶음, r.묶음);
  /* 때가 되면 숙제 예약 그대로 나간다 — 그 아이에게만 시험으로 */
  const 돌 = e.돌기('2026-11-27T15:31:00');
  assert.equal(돌.찍은수, 3);
  assert.ok(돌.낸것.every(x => x.됐나));
  const 시험줄 = 숙제줄들(e.store).filter(x => x[8] === '시험');
  assert.deepEqual(시험줄.map(x => [x[7], x[2], x[3], x[5]]),
    [['홍길동', 11, 20, '2026-11-27'], ['김영희', 1, 10, '2026-11-27'], ['박철수', 31, 40, '2026-11-27']]);
  /* 시험 날짜 · 시각이 틀리면 아무것도 안 낸다 */
  const 전 = 숙제줄들(e.store).length;
  for (const 틀린 of [{ 날짜: '2026-11-01', 시각: '15:30' }, { 날짜: '2026-11-27', 시각: '23:00' }, { 날짜: '', 시각: '15:30' }]) {
    const r3 = e.call('진도숙제내기', 비번, [{ 이름: '홍길동', 단어장: '교재A', 시작: 21, 끝: 30 }], { 종류: '당일' }, { 이름들: ['홍길동'], ...틀린 });
    assert.equal(r3.ok, false, JSON.stringify(틀린));
    assert.match(r3.메시지, /^시험 예약: /);
  }
  assert.equal(숙제줄들(e.store).length, 전);
  /* 진도가 반이나 수업 요일 표를 만들지 않는다 */
  assert.equal(e.store.getSheetByName('반'), null);
  assert.equal(e.store.getSheetByName('수업요일'), null);
});

test('16. 묶음 칸이 빈 옛 예약도 그대로 나간다', () => {
  const store = 판();
  const 옛 = store.insertSheet('숙제예약');
  옛.appendRow(예약머리옛);                                       // 묶음 칸이 없던 때의 표
  const 꾸러미 = { 단어장: '교재A', 시작: 1, 끝: 20, 유형: '스펠링', 종류: '당일', 마감일: '', 학생들: ['홍길동'], 칸: '' };
  옛.appendRow([new Date(서울('2026-11-24T17:00:00')), '2026-11-25', '08:00', '홍길동 · 교재A 1~20 · 스펠링 · 당일', JSON.stringify(꾸러미), '', '', '']);
  const e = 엔진(store);
  /* 선생님 화면으로 새로 건 것도 묶음이 비어 있다 */
  assert.equal(e.call('숙제예약저장', 비번, '', { 날짜: '2026-11-25', 시각: '08:00', 알림함께: false,
    내용: { ...꾸러미, 학생들: ['김영희'], 바뀐줄만: true } }).ok, true);
  const 목록 = e.call('숙제예약목록', 비번).예약;
  assert.equal(목록.length, 2);
  assert.ok(목록.every(n => n.묶음 === ''));
  assert.equal(옛.getRange(1, 9).getValue(), '묶음', '머리맞춘시트_ 가 칸을 넓혀 준다');
  const 돌 = e.돌기('2026-11-25T08:05:00');
  assert.equal(돌.찍은수, 2);
  assert.ok(돌.낸것.every(x => x.됐나));
  assert.deepEqual(숙제줄들(store).map(x => x[7]).sort(), ['김영희', '홍길동']);
});
