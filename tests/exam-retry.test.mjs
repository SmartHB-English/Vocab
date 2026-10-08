// 숙제 종류 「시험」 재응시 — 수업의 시험 단계와 같은 길(단계상태_)로 판정되는지 본다 (2026-10-08 원장님 요청)
import assert from 'node:assert/strict';
import test from 'node:test';
import { legacy, plain, record } from './helpers/legacy-server.mjs';

// 헬퍼의 「지금」 은 2026-10-07 21:00 (서울) — 오늘 = 2026-10-07
const 이름 = '테스트학생';
const 학생 = [['', 이름, '0000', '초중등', '', '', '', '교재A'], ['', '다른학생', '0001', '초중등', '', '', '', '교재A']];
const 낸때 = new Date('2026-10-07T00:00:00Z');                 // 서울 09:00 에 냈다
function 시험줄({ 마감 = '2026-10-07', 등록 = 낸때, 학생: 누구 = 이름, 통과점수 = '', 재응시 = '', 종류 = '시험', 범위 = [1, 10] } = {}) {
  return ['', '교재A', 범위[0], 범위[1], '스펠링', 마감, 등록, 누구, 종류, '', 0, '', '', '', 통과점수, 재응시, ''];
}
function 응시(score, 시 = 1, name = 이름) {
  return record({ name, score, kind: '시험', at: `2026-10-07T0${시}:00:00Z` });
}
function 내시험(c) { return plain(c.숙제가져오기_(이름)).find(h => h.종류 === '시험'); }

test('시험을 72점으로 내면 완료가 안 되고 다시 볼 수 있다', () => {
  const c = legacy({ 학생, 숙제: [시험줄()], 기록: [응시(72)] });
  const h = 내시험(c);
  assert.equal(h.완료, false);
  assert.equal(h.모자람, true);
  assert.equal(h.점수, 72);
  assert.equal(h.합격점, 80);
  assert.equal(h.통과점수, 80);
  assert.equal(h.응시수, 1);
  assert.equal(h.남은응시, 1);                                   // 재응시 기본 1번
  assert.equal(h.단계, '');                                      // 수업 단계로 바뀌지 않는다
  assert.equal(c.시험다봤나_(이름, '교재A', '1~10'), null);       // 결과저장이 받아 준다
});

test('같은 범위를 숙제로 푼 기록은 시험 응시로 세지 않는다', () => {
  const c = legacy({ 학생, 숙제: [시험줄()], 기록: [record({ score: 100, kind: '숙제', at: '2026-10-07T03:00:00Z' })] });
  const h = 내시험(c);
  assert.equal(h.완료, false);
  assert.equal(h.응시수, 0);
  assert.equal(h.모자람, false);
});

test('다시 보기에서 85점을 내면 완료가 되고 더는 못 본다', () => {
  const c = legacy({ 학생, 숙제: [시험줄()], 기록: [응시(72, 1), 응시(85, 2)] });
  const h = 내시험(c);
  assert.equal(h.완료, true);
  assert.equal(h.점수, 85);
  assert.match(c.시험다봤나_(이름, '교재A', '1~10').메시지, /통과/);
});

test('다시 보기에서 또 못 넘기면 막히고 「선생님께 말씀드리세요」', () => {
  const 숙제 = [시험줄()];
  const c = legacy({ 학생, 숙제, 기록: [응시(72, 1), 응시(90, 2, '다른학생'), 응시(60, 3)] });
  const h = 내시험(c);
  assert.equal(h.완료, false);
  assert.equal(h.남은응시, 0);
  assert.equal(h.점수, 60);                                      // 마지막 응시 점수 (평균 아님)
  const 막음 = c.시험다봤나_(이름, '교재A', '1~10');
  assert.equal(막음.다씀, true);
  assert.match(막음.메시지, /선생님께 말씀드리세요/);
  const 줄 = plain(c.전체숙제())[0];
  assert.deepEqual(줄.막힌사람, [이름]);                          // 「재응시 한 번 더」 단추가 뜬다
  assert.deepEqual(줄.모자란사람, [이름]);
  // 선생님이 한 번 더 주면 (「재응시」 시트 — 재응시더주기) 다시 열린다
  c.재응시추가표_ = () => ({ [`${이름}|${낸때.getTime()}`]: 1 });
  assert.equal(c.시험다봤나_(이름, '교재A', '1~10'), null);
  assert.equal(내시험(c).남은응시, 1);
});

test('처음에 85점을 내면 다시 보기가 아예 안 열린다', () => {
  const c = legacy({ 학생, 숙제: [시험줄()], 기록: [응시(85)] });
  const h = 내시험(c);
  assert.equal(h.완료, true);
  assert.equal(h.모자람, false);
  assert.ok(c.시험다봤나_(이름, '교재A', '1~10'));
});

test('마감일이 지난 옛 시험은 점수가 낮아도 다시 열리지 않는다', () => {
  const 옛 = 시험줄({ 마감: '2026-10-06', 등록: new Date('2026-10-05T00:00:00Z') });
  const 옛기록 = record({ score: 40, kind: '시험', at: '2026-10-06T01:00:00Z' });
  const c = legacy({ 학생, 숙제: [옛], 기록: [옛기록] });
  assert.equal(c.숙제가져오기_(이름).length, 0);                  // 아이 화면에는 안 뜬다
  const h = plain(c.숙제가져오기_(이름, '')).find(x => x.종류 === '시험');   // 학부모 화면 꼴 (지난 것까지)
  assert.equal(h.완료, true);
  assert.equal(h.합격점, 0);
  assert.equal(h.남은응시, null);
  const 줄 = plain(c.전체숙제())[0];
  assert.deepEqual(줄.한사람, [이름]);
  assert.deepEqual(줄.모자란사람, []);
  assert.deepEqual(줄.막힌사람, []);
  assert.equal(줄.합격점, 0);
  assert.equal(c.시험다봤나_(이름, '교재A', '1~10').다씀, undefined);
  assert.ok(c.시험다봤나_(이름, '교재A', '1~10'));                 // 예전처럼 막는다
  // 낸것_ 에 컷을 안 넘기면 판단날을 마감으로 본다 — 지난 시험은 0점도 본 것
  assert.deepEqual(plain(c.낸것_({ '2026-10-06': 0 }, '시험', '2026-10-05', '2026-10-06')), { 날: '2026-10-06', 점수: 0 });
});

test('재응시를 2로 적어 낸 시험은 두 번 더 볼 수 있다', () => {
  const 숙제 = [시험줄({ 재응시: 2 })];
  let c = legacy({ 학생, 숙제, 기록: [응시(72, 1), 응시(70, 2)] });
  assert.equal(내시험(c).남은응시, 1);
  assert.equal(c.시험다봤나_(이름, '교재A', '1~10'), null);
  c = legacy({ 학생, 숙제, 기록: [응시(72, 1), 응시(70, 2), 응시(65, 3)] });
  assert.equal(내시험(c).남은응시, 0);
  assert.equal(c.시험다봤나_(이름, '교재A', '1~10').다씀, true);
});

test('통과점수를 적어 낸 시험은 그 점수로 본다', () => {
  const c = legacy({ 학생, 숙제: [시험줄({ 통과점수: 70 })], 기록: [응시(72)] });
  const h = 내시험(c);
  assert.equal(h.완료, true);
  assert.equal(h.합격점, 70);
});

test('결과저장 — 못 넘긴 시험은 다시 받고, 다 쓰면 받지 않는다', () => {
  const 기록 = [응시(72, 1)];
  const c = legacy({});
  const 표 = { 학생, 숙제: [시험줄()], 기록, 기록보관: [] };
  c.rows_ = name => 표[name] ?? [];
  c.캐시읽기_ = () => true;
  c.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  c.SpreadsheetApp = { WrapStrategy: { CLIP: 'CLIP' } };
  const range = { setWrapStrategy() { return this; }, setVerticalAlignment() { return this; }, setNumberFormat() { return this; }, setNote() { return this; } };
  c.sheet_ = () => ({ appendRow: r => 기록.push(r), getLastRow: () => 기록.length + 1, getRange: () => range });
  const 보냄 = { 이름, 단어장: '교재A', 범위: '1~10', 구분: '시험', 틀린단어: 'a', 점수: 60 };
  assert.equal(c.결과저장(보냄).ok, true);                         // 두 번째 응시 — 받는다
  assert.equal(기록.length, 2);
  const 세번째 = c.결과저장(보냄);                                 // 재응시 1번을 다 썼다
  assert.equal(세번째.ok, false);
  assert.equal(세번째.이미봄, true);
  assert.equal(세번째.다씀, true);
  assert.equal(기록.length, 2);
});

test('숙제 제출률·안 낸 숙제 수에 시험이 안 섞인다 (전과 같다)', () => {
  const 숙제줄 = ['', '교재A', 1, 10, '스펠링', '2026-10-07', 낸때, 이름, '기한', '', 0, '', '', '', '', '', ''];
  const c = legacy({ 학생, 숙제: [숙제줄, 시험줄({ 범위: [11, 20] })], 기록: [record({ score: 90 })] });
  const 그달 = plain(c.그달숙제_('2026-10'));
  assert.equal(그달.length, 1);
  assert.equal(그달[0].종류, '기한');
  const 현황 = plain(c.제출현황_(c.그달숙제_('2026-10'), [이름], { [이름]: { 낸것: c.완료점수들_(이름) } }, {}, {}));
  assert.deepEqual(현황[이름], { 숙제수: 1, 낸수: 1, 안한수: 0 });
  // 연속 기록도 숙제만 센다
  assert.deepEqual(plain(c.숙제날표_())[이름], { '2026-10-07': { 총: 1, 낸: 1 } });
});

test('시험 평균이 전과 같은 뜻으로 나온다 — 본 아이만, 마지막 날의 점수로', () => {
  const 모두 = 시험줄({ 학생: `${이름}, 다른학생` });
  const c = legacy({ 학생, 숙제: [모두], 기록: [응시(72, 1), 응시(85, 2)] });
  const 줄 = plain(c.전체숙제())[0];
  assert.equal(줄.평균, 85);                                      // 안 본 「다른학생」 은 평균에 안 들어간다
  assert.deepEqual(줄.한사람, [이름]);
  assert.deepEqual(줄.안한사람, ['다른학생']);
  assert.deepEqual(줄.모자란사람, []);                            // 안 본 사람과 못 넘긴 사람은 따로
  const 둘 = legacy({ 학생, 숙제: [모두], 기록: [응시(72, 1), 응시(60, 2, '다른학생')] });
  const 줄2 = plain(둘.전체숙제())[0];
  assert.equal(줄2.평균, 66);
  assert.deepEqual(줄2.모자란사람, [이름, '다른학생']);
  // 숙제 줄에는 평균이 없다
  const 숙 = legacy({ 학생, 숙제: [시험줄({ 종류: '기한' })], 기록: [record({ score: 90 })] });
  assert.equal(plain(숙.전체숙제())[0].평균, undefined);
});

test('수업의 시험 단계는 그대로 — 재응시 기본 2번, 구분을 가리지 않는다', () => {
  const 단계줄 = ['', '교재A', 1, 10, '스펠링', '2026-10-07', 낸때, 이름, '기한', '5과', 1, '', '', '시험', '', '', ''];
  const c = legacy({ 학생, 숙제: [단계줄], 기록: [record({ score: 50, kind: '숙제' })] });
  const h = plain(c.숙제가져오기_(이름))[0];
  assert.equal(h.단계, '시험');
  assert.equal(h.응시수, 1);
  assert.equal(h.남은응시, 2);
});
