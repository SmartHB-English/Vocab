import test from 'node:test';
import assert from 'node:assert/strict';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 「지금」 은 2026-10-07(수) 21:00 서울 — 다른 검사와 같다. 이번 주 월요일 10-05 */
const 지금 = Date.parse('2026-10-07T12:00:00Z');
const 머리17 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류',
  '수업', '순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분'];
/* 등록시각(낸때)이 줄마다 달라야 숙제줄찾기_ 가 맞춰 본다 */
const 낸때 = n => new Date(Date.parse('2026-10-05T01:00:00Z') + n * 60000);
const 줄 = (n, 범위, 마감, 종류) => ['', '교재A', 범위[0], 범위[1], '스펠링', 마감, 낸때(n), '홍길동', 종류,
  '', '', '', '', '', '', '', ''];

/* 2: 낸 숙제 · 3: 안 낸 숙제 · 4: 시험 (홍길동 한 사람 앞으로) */
function 엔진({ 옛시트 = false } = {}) {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분']); 학생.appendRow(['', '홍길동', '1234', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 숙제 = store.insertSheet('숙제');
  숙제.appendRow(옛시트 ? 머리17 : [...머리17, '학부모숨김']);
  숙제.appendRow(줄(1, [1, 10], '2026-10-07', '기한'));
  숙제.appendRow(줄(2, [11, 20], '2026-10-08', '기한'));
  숙제.appendRow(줄(3, [21, 30], '2026-10-09', '시험'));
  const 기록 = store.insertSheet('기록');
  기록.appendRow(['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외']);
  기록.appendRow([new Date('2026-10-06T10:00:00Z'), '', '홍길동', '교재A', '1~10', '스펠링', 10, 10, 100, 0, 0, 30, 'O', '', '', '']);
  const 엔 = createRuntime(store, { now: () => 지금 });
  return { store, 숙제, call: (fn, ...args) => JSON.parse(JSON.stringify(엔.call(fn, args))) };
}
const 학부모 = e => e.call('학부모미리보기', '1234', '홍길동');
const 숙제범위 = r => r.이번주숙제.map(h => h.제목);
const 시험범위 = r => r.시험.map(t => t.범위);

test('감추기 전 — 숙제 둘 · 시험 하나가 학부모 화면에 있다', () => {
  const r = 학부모(엔진());
  assert.deepEqual(숙제범위(r), ['교재A 11~20', '교재A 1~10']);   // 안 낸 것이 위
  assert.deepEqual([r.낸수, r.안낸수], [1, 1]);
  assert.deepEqual(시험범위(r), ['21~30']);
});

test('감춘 숙제는 학부모 목록에 없고 「N/M 냈어요」 에도 안 든다', () => {
  const e = 엔진();
  const 답 = e.call('숙제숨김바꾸기', '1234', [{ 행: 2, 낸때: 낸때(1).getTime() }, { 행: 3, 낸때: 낸때(2).getTime() }], true, true);
  assert.deepEqual(답, { ok: true, 개수: 2, 바꾼행: [2, 3] });
  assert.equal(e.숙제.getRange(2, 18).getValue(), '1');
  const r = 학부모(e);
  assert.deepEqual(숙제범위(r), []);
  assert.deepEqual([r.낸수, r.안낸수], [0, 0]);
  assert.deepEqual(시험범위(r), ['21~30']);           // 고른 것만 감춘다
});

test('감춘 시험은 「시험」 에 없다', () => {
  const e = 엔진();
  e.call('숙제숨김바꾸기', '1234', [{ 행: 4, 낸때: 낸때(3).getTime() }], true, true);
  assert.deepEqual(시험범위(학부모(e)), []);
});

test('다시 보이게 하면 숙제도 시험도 돌아온다', () => {
  const e = 엔진(), 고른 = [2, 3, 4].map(n => ({ 행: n, 낸때: 낸때(n - 1).getTime() }));
  e.call('숙제숨김바꾸기', '1234', 고른, true, true);
  e.call('숙제숨김바꾸기', '1234', 고른, false, true);
  assert.equal(e.숙제.getRange(2, 18).getValue(), '');
  const r = 학부모(e);
  assert.equal(r.이번주숙제.length, 2);
  assert.deepEqual([r.낸수, r.안낸수], [1, 1]);
  assert.deepEqual(시험범위(r), ['21~30']);
});

test('감춰도 학생 쪽(숙제가져오기)에는 그대로 있고, 선생님 쪽 줄에는 학부모숨김이 실린다', () => {
  const e = 엔진();
  e.call('숙제숨김바꾸기', '1234', [2, 3, 4], true, true);   // 줄번호만 보내는 옛 꼴도 받는다
  assert.deepEqual(e.call('숙제가져오기', '홍길동').map(h => h.시작 + '~' + h.끝).sort(), ['11~20', '1~10', '21~30']);
  assert.ok(e.call('숙제가져오기', '홍길동').every(h => !('학부모숨김' in h)));
  assert.deepEqual(e.call('선생님기본', '1234').숙제목록.map(h => h.학부모숨김), [true, true, true]);
});

test('바뀐줄만 이 아니면 숙제목록을 같이 싣는다 (옛 화면)', () => {
  const 답 = 엔진().call('숙제숨김바꾸기', '1234', [2], true);
  assert.deepEqual(답.숙제목록.map(h => h.학부모숨김), [true, false, false]);
});

test('17칸짜리 옛 시트도 안 터지고 아무것도 안 감춘 것으로 친다 — 감추면 칸을 늘려 쓴다', () => {
  const e = 엔진({ 옛시트: true });
  const r = 학부모(e);
  assert.equal(r.이번주숙제.length, 2);
  assert.deepEqual(시험범위(r), ['21~30']);
  assert.deepEqual(e.call('선생님기본', '1234').숙제목록.map(h => h.학부모숨김), [false, false, false]);
  e.call('숙제숨김바꾸기', '1234', [{ 행: 3, 낸때: 낸때(2).getTime() }], true, true);
  assert.equal(e.숙제.getRange(1, 18).getValue(), '학부모숨김');
  assert.deepEqual(숙제범위(학부모(e)), ['교재A 1~10']);
});

test('비번이 틀리면 { ok:false } 이고 시트가 안 바뀐다', () => {
  const e = 엔진(), 전 = JSON.stringify(e.store.getSheetByName('숙제').export());
  assert.deepEqual(e.call('숙제숨김바꾸기', '0000', [2, 3], true, true), { ok: false });
  assert.equal(JSON.stringify(e.store.getSheetByName('숙제').export()), 전);
});
