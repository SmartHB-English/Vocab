import test from 'node:test';
import assert from 'node:assert/strict';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 「지금」 은 2026-10-07(수) 21:00 서울 — 다른 검사와 같다 */
const 지금 = Date.parse('2026-10-07T12:00:00Z');
const 머리17 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류',
  '수업', '순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분'];
const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'];
/* 시각이 곧 키 — 줄마다 다르다 */
const 때 = n => new Date(Date.parse('2026-10-06T01:00:00Z') + n * 60000);
const 기록줄 = (n, 범위, 구분, 점수 = 0) => [때(n), '', '홍길동', '교재A', 범위, '스펠링', 10, 점수 / 10, 점수, 0, 0, 30, 구분 === '오답 재시험' ? '' : 'O', '', 구분, ''];   // 오답 재시험은 숙제여부를 안 적는다
const 키 = n => 때(n).getTime();

/* 기록: 1 시험(0점 — 잘못 낸 시험) · 2 숙제 · 3 오답 재시험 · 4 다른 범위 시험(100점)
   기록보관: 5 시험(정리해 둔 것) */
function 엔진() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분']); 학생.appendRow(['', '홍길동', '1234', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 숙제 = store.insertSheet('숙제');
  숙제.appendRow([...머리17, '학부모숨김']);
  숙제.appendRow(['', '교재A', 1, 10, '스펠링', '2026-10-09', new Date('2026-10-05T01:00:00Z'), '홍길동', '시험',
    '', '', '', '', '', '', '', '', '']);
  const 기록 = store.insertSheet('기록');
  기록.appendRow(머리기록);
  기록.appendRow(기록줄(1, '1~10', '시험', 0));
  기록.appendRow(기록줄(2, '11~20', '숙제', 90));
  기록.appendRow(기록줄(3, '1~10', '오답 재시험', 50));
  기록.appendRow(기록줄(4, '21~30', '시험', 100));
  const 보관 = store.insertSheet('기록보관');
  보관.appendRow(머리기록);
  보관.appendRow(기록줄(5, '31~40', '시험', 0));
  const 엔 = createRuntime(store, { now: () => 지금 });
  return { store, 기록, 보관, call: (fn, ...args) => JSON.parse(JSON.stringify(엔.call(fn, args))) };
}
const 시험보기 = (e, 범위) => e.call('결과저장', {
  이름: '홍길동', 단어장: '교재A', 범위, 유형: '스펠링', 문항수: 10, 정답수: 9, 점수: 90, 숙제여부: true, 구분: '시험',
});
const 구분들 = sh => sh.getRange(2, 15, sh.getLastRow() - 1, 1).getValues().map(r => r[0]);
const 시트들 = e => JSON.stringify([e.store.getSheetByName('기록').export(), e.store.getSheetByName('기록보관').export()]);

test('시험 기록이 있으면 같은 범위 결과저장이 막힌다', () => {
  const 답 = 시험보기(엔진(), '1~10');
  assert.equal(답.ok, false);
  assert.equal(답.이미봄, true);
});

test('그 기록을 무르면 같은 결과저장이 들어간다 — 무른 기록은 지우지 않고 남는다', () => {
  const e = 엔진();
  assert.deepEqual(e.call('시험무르기', '1234', [키(1)], true), { ok: true, 개수: 1, 무름: true });
  assert.deepEqual(구분들(e.기록), ['시험(무효)', '숙제', '오답 재시험', '시험']);
  assert.deepEqual(시험보기(e, '1~10'), { ok: true });
  assert.equal(e.기록.getLastRow(), 6);                          // 옛 기록 4줄 + 새 시험 1줄
  assert.equal(e.기록.getRange(6, 15).getValue(), '시험');
});

test('되돌리면 다시 막힌다', () => {
  const e = 엔진();
  e.call('시험무르기', '1234', [키(1)], true);
  assert.deepEqual(e.call('시험무르기', '1234', [키(1)], false), { ok: true, 개수: 1, 무름: false });
  assert.equal(e.기록.getRange(2, 15).getValue(), '시험');
  assert.equal(시험보기(e, '1~10').이미봄, true);
});

test('기록보관에 있는 시험도 무러진다', () => {
  const e = 엔진();
  assert.equal(시험보기(e, '31~40').이미봄, true);              // 보관함도 막고 있었다
  assert.equal(e.call('시험무르기', '1234', [키(5)], true).개수, 1);
  assert.deepEqual(구분들(e.보관), ['시험(무효)']);
  assert.deepEqual(시험보기(e, '31~40'), { ok: true });
});

test('숙제 · 오답 재시험 기록은 키를 같이 보내도 안 바뀐다', () => {
  const e = 엔진();
  const 답 = e.call('시험무르기', '1234', [키(1), 키(2), 키(3)], true);
  assert.equal(답.개수, 1);
  assert.deepEqual(구분들(e.기록), ['시험(무효)', '숙제', '오답 재시험', '시험']);
  /* 되돌리기도 무른 것만 — 숙제가 「시험」 이 되지 않는다 */
  assert.equal(e.call('시험무르기', '1234', [키(1), 키(2), 키(3)], false).개수, 1);
  assert.deepEqual(구분들(e.기록), ['시험', '숙제', '오답 재시험', '시험']);
});

test('비번이 틀리면 { ok:false } 이고 한 줄도 안 바뀐다', () => {
  const e = 엔진(), 전 = 시트들(e);
  assert.deepEqual(e.call('시험무르기', '0000', [키(1), 키(5)], true), { ok: false, 메시지: '비밀번호가 다릅니다.' });
  assert.equal(시트들(e), 전);
});

test('무른 기록은 학부모 화면의 「본 시험」 에 안 나온다', () => {
  const e = 엔진();
  const 전 = e.call('학부모미리보기', '1234', '홍길동').시험.map(t => t.범위);
  assert.ok(전.includes('1~10') && 전.includes('21~30'));
  e.call('시험무르기', '1234', [키(1), 키(4)], true);
  const 뒤 = e.call('학부모미리보기', '1234', '홍길동').시험;
  assert.ok(!뒤.some(t => t.범위 === '21~30'));                   // 본 시험으로만 있던 것 — 사라진다
  assert.ok(뒤.filter(t => t.범위 === '1~10').every(t => !t.점수));  // 남은 1~10 은 「앞으로 볼 시험」 뿐이다
});

test('무른 시험은 아이 숙제 목록에서 「안 본 것」 이 된다', () => {
  const e = 엔진();
  e.call('시험무르기', '1234', [키(4)], false);                    // 아무 일 없음 (무효가 아니다)
  e.store.getSheetByName('기록').getRange(2, 9).setValue(100);   // 1~10 시험을 100점으로 봤다고 치자
  const 시험 = () => e.call('숙제가져오기', '홍길동').find(h => h.시작 === 1 && h.끝 === 10);
  assert.equal(시험().완료, true);
  e.call('시험무르기', '1234', [키(1)], true);
  assert.equal(시험().완료, false);
  assert.equal(시험().점수, null);
});

test('선생님 시험 결과 목록에 무효 표시가 실리고, 숙제 평균에는 안 든다', () => {
  const e = 엔진();
  const 줄 = () => e.call('선생님기록', '1234', 7);
  const 홍 = r => r.학생별.find(s => s.이름 === '홍길동');
  const 전 = 줄();
  assert.equal(홍(전).횟수, 1);                                   // 숙제 한 번(90점)만
  assert.equal(홍(전).시험, 2);
  e.call('시험무르기', '1234', [키(1)], true);
  const 뒤 = 줄();
  assert.deepEqual(뒤.시험목록.filter(t => t.무효).map(t => t.키), [키(1)]);
  assert.equal(홍(뒤).횟수, 1);                                   // 무른 시험(숙제여부 O)이 숙제로 새지 않는다
  assert.equal(홍(뒤).평균, 90);
  assert.equal(홍(뒤).시험, 1);                                   // 시험 평균에서도 빠진다
  assert.equal(홍(뒤).시험평균, 100);
});

test('무른 시험은 월간 시상의 숙제 평균에도 시험 평균에도 안 든다', () => {
  const e = 엔진();
  const 홍 = () => e.call('시상집계', '1234', '2026-10').줄.find(r => r.이름 === '홍길동');
  const 전 = 홍();
  assert.deepEqual([전.건수, 전.평균, 전.시험건수, 전.시험평균], [1, 90, 3, 33]);   // 시험 0 · 100 · 보관함 0
  e.call('시험무르기', '1234', [키(1), 키(5)], true);
  const 뒤 = 홍();
  assert.deepEqual([뒤.건수, 뒤.평균, 뒤.시험건수, 뒤.시험평균], [1, 90, 1, 100]);   // 무른 둘이 숙제로 새지 않는다
});
