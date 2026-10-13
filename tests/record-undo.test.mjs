import test from 'node:test';
import assert from 'node:assert/strict';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 「기록 무르기」 — 시험뿐 아니라 숙제·보충·빈 구분도 구분 뒤에 (무효) 를 붙여 무른다.
   「지금」 은 2026-10-07(수) 21:00 서울 — exam-undo 와 같다 */
const 지금 = Date.parse('2026-10-07T12:00:00Z');
const 머리17 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류',
  '수업', '순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분'];
const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'];
const 때 = n => new Date(Date.parse('2026-10-06T01:00:00Z') + n * 60000);
const 기록줄 = (n, 범위, 구분, 점수, 숙제여부) => [때(n), '', '홍길동', '교재A', 범위, '스펠링', 10, 점수 / 10, 점수, 0, 0, 30, 숙제여부, '', 구분, ''];
const 키 = n => 때(n).getTime();

/* 숙제: 11~20 기한 숙제(단계 없음 — 완료점수들_ 로 판정) · 41~50 연습 단계 숙제(응시표_ 로 판정)
   기록: 1 숙제 90 · 2 보충 · 3 빈 구분(혼자 연습) · 4 숙제 70 (41~50) · 5 오답 재시험 · 6 시험 100 */
function 엔진() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분']); 학생.appendRow(['', '홍길동', '1234', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 숙제 = store.insertSheet('숙제');
  숙제.appendRow([...머리17, '학부모숨김']);
  const 낸때 = new Date('2026-10-05T01:00:00Z');
  숙제.appendRow(['', '교재A', 11, 20, '스펠링', '2026-10-09', 낸때, '홍길동', '', '', '', '', '', '', '', '', '', '']);
  숙제.appendRow(['', '교재A', 41, 50, '스펠링', '2026-10-09', 낸때, '홍길동', '', '', '', '', '', '연습', '', '', '', '']);
  const 기록 = store.insertSheet('기록');
  기록.appendRow(머리기록);
  기록.appendRow(기록줄(1, '11~20', '숙제', 90, 'O'));
  기록.appendRow(기록줄(2, '21~30', '보충', 80, 'O'));
  기록.appendRow(기록줄(3, '31~40', '', 60, ''));
  기록.appendRow(기록줄(4, '41~50', '숙제', 70, 'O'));
  기록.appendRow(기록줄(5, '11~20', '오답 재시험', 50, ''));
  기록.appendRow(기록줄(6, '51~60', '시험', 100, 'O'));
  store.insertSheet('기록보관').appendRow(머리기록);
  const 엔 = createRuntime(store, { now: () => 지금 });
  return { store, 기록, call: (fn, ...args) => JSON.parse(JSON.stringify(엔.call(fn, args))) };
}
const 구분들 = sh => sh.getRange(2, 15, sh.getLastRow() - 1, 1).getValues().map(r => r[0]);
const 시트들 = e => JSON.stringify([e.store.getSheetByName('기록').export(), e.store.getSheetByName('기록보관').export()]);
const 숙제칸 = (e, 시작) => e.call('숙제가져오기', '홍길동').find(h => h.시작 === 시작);

test('기록무르기 · 시험무르기 둘 다 열린 기능이다', () => {
  const e = 엔진();
  assert.equal(e.call('기록무르기', '1234', [키(6)], true).개수, 1);
  assert.equal(e.call('시험무르기', '1234', [키(6)], false).개수, 1);
  assert.equal(e.기록.getRange(7, 15).getValue(), '시험');
});

test('1) 숙제 기록을 무르면 그 숙제가 다시 「안 낸」 상태가 된다 (완료점수들_)', () => {
  const e = 엔진();
  assert.equal(숙제칸(e, 11).완료, true);
  e.call('기록무르기', '1234', [키(1)], true);
  assert.equal(e.기록.getRange(2, 15).getValue(), '숙제(무효)');
  assert.equal(숙제칸(e, 11).완료, false);
  e.call('기록무르기', '1234', [키(1)], false);
  assert.equal(숙제칸(e, 11).완료, true);
});

test('2) 무른 숙제는 응시에서도 빠진다 (응시표_)', () => {
  const e = 엔진();
  const 전 = 숙제칸(e, 41);
  assert.deepEqual([전.응시수, 전.완료], [1, true]);
  e.call('기록무르기', '1234', [키(4)], true);
  const 뒤 = 숙제칸(e, 41);
  assert.deepEqual([뒤.응시수, 뒤.완료], [0, false]);
});

test('3) 되돌리면 숙제 · 보충 · 빈값이 원래 구분 그대로 돌아온다', () => {
  const e = 엔진();
  assert.equal(e.call('기록무르기', '1234', [키(1), 키(2), 키(3)], true).개수, 3);
  assert.deepEqual(구분들(e.기록), ['숙제(무효)', '보충(무효)', '(무효)', '숙제', '오답 재시험', '시험']);
  assert.deepEqual(e.call('기록무르기', '1234', [키(1), 키(2), 키(3)], false), { ok: true, 개수: 3, 무름: false });
  assert.deepEqual(구분들(e.기록), ['숙제', '보충', '', '숙제', '오답 재시험', '시험']);
});

test('4) 시험은 예전처럼 「시험」 ↔ 「시험(무효)」 — 무효시험표시 와 글자가 같다', () => {
  const e = 엔진();
  e.call('기록무르기', '1234', [키(6)], true);
  assert.equal(e.기록.getRange(7, 15).getValue(), '시험(무효)');
  e.call('기록무르기', '1234', [키(6)], false);
  assert.equal(e.기록.getRange(7, 15).getValue(), '시험');
});

test('5) 오답 재시험 줄은 키를 같이 보내도 안 바뀐다', () => {
  const e = 엔진();
  assert.equal(e.call('기록무르기', '1234', [키(5)], true).개수, 0);
  assert.equal(e.call('기록무르기', '1234', [키(1), 키(5)], true).개수, 1);
  assert.equal(e.기록.getRange(6, 15).getValue(), '오답 재시험');
  e.call('기록무르기', '1234', [키(1), 키(5)], false);
  assert.equal(e.기록.getRange(6, 15).getValue(), '오답 재시험');
});

test('6) 두 번 무르기를 눌러도 (무효)(무효) 가 되지 않는다 — 되돌리기도 두 번이 한 번과 같다', () => {
  const e = 엔진();
  const 모두 = [키(1), 키(2), 키(3), 키(6)];
  assert.equal(e.call('기록무르기', '1234', 모두, true).개수, 4);
  assert.equal(e.call('기록무르기', '1234', 모두, true).개수, 0);
  assert.deepEqual(구분들(e.기록), ['숙제(무효)', '보충(무효)', '(무효)', '숙제', '오답 재시험', '시험(무효)']);
  assert.ok(!구분들(e.기록).some(v => v.includes('(무효)(무효)')));
  e.call('기록무르기', '1234', 모두, false);
  assert.equal(e.call('기록무르기', '1234', 모두, false).개수, 0);
  assert.deepEqual(구분들(e.기록), ['숙제', '보충', '', '숙제', '오답 재시험', '시험']);
});

test('7) 무른 숙제는 선생님 평균과 월간 시상에서 빠진다', () => {
  const e = 엔진();
  const 홍 = () => e.call('선생님기록', '1234', 7).학생별.find(s => s.이름 === '홍길동');
  const 상 = () => e.call('시상집계', '1234', '2026-10').줄.find(r => r.이름 === '홍길동');
  assert.deepEqual([홍().횟수, 홍().평균, 홍().보충], [2, 80, 1]);
  assert.deepEqual([상().건수, 상().낸수, 상().못낸, 상().평균], [2, 1, 0, 80]);
  e.call('기록무르기', '1234', [키(1), 키(2)], true);
  const 기록 = e.call('선생님기록', '1234', 7);
  assert.deepEqual(기록.시험목록.filter(t => t.무효).map(t => t.키).sort(), [키(1), 키(2)].sort());
  assert.deepEqual([홍().횟수, 홍().평균, 홍().보충], [1, 70, 0]);
  /* 시상은 90점 기록이 빠지고, 그 숙제는 다시 「안 낸 숙제」 — 0점으로 평균에 든다 ((70 + 0) / 2) */
  assert.deepEqual([상().건수, 상().낸수, 상().못낸, 상().평균], [1, 0, 1, 35]);
});

test('8) 비번이 틀리면 { ok:false } 이고 한 줄도 안 바뀐다', () => {
  const e = 엔진(), 전 = 시트들(e);
  assert.deepEqual(e.call('기록무르기', '0000', [키(1), 키(2), 키(3)], true), { ok: false, 메시지: '비밀번호가 다릅니다.' });
  assert.equal(시트들(e), 전);
});
