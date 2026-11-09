// 알림만 보내기 · 받는 사람 고르기 — 공지 없이, 선생님이 쓴 글을 고른 아이에게만.
// 엔진(Code.gs): 알림명단 · 알림기록목록(선생님) · 알림거리_ = __알림거리 · 알림기록쓰기_ = __알림기록쓰기 (bridge 만).
// 함수(functions): aux 의 알림보내기 → sendNowNotice → sendNoticeWith(scheduled-push.mjs) — 예약과 같은 sendScheduledNotices 로 쏜다.
// 예약도 같은 두 칸(대상종류 · 대상값)으로 거른다. 대상값 — 반이면 반 이름 하나, 아이면 이름을 세로줄(|)로 이은 글.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { sheetId, unpack } from '../services/store-codec.mjs';
import { fakeDb } from './helpers/fake-firestore.mjs';
import { sendScheduledNotices, sendNoticeWith, noticeLogRows } from '../functions/src/scheduled-push.mjs';

const 흉내 = new URL('./helpers/fake-firestore.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { return s === 'firebase/firestore' ? { url: ${JSON.stringify(흉내)}, shortCircuit: true } : n(s, c); }`));
const { FirestoreRepository, digest } = await import('../services/firestore-repository.mjs');

const 비번 = '5678';
const 서울 = t => new Date(t + '+09:00').getTime();
const 지금 = 서울('2026-11-20T19:05:00');
const 옛예약머리 = ['만든때', '종류', '날짜', '시각', '제목', '내용', '공지함께', '공지끝날', '보낸때', '켬'];   // 대상 두 칸이 없던 때
const 홍 = 'https://fcm.googleapis.com/fcm/send/hong', 박 = 'https://fcm.googleapis.com/fcm/send/park', 김 = 'fcm:' + 'k'.repeat(40);

/* 3A — 홍길동(웹) · 김영희(앱) · 이민준(꺼짐) / 3B — 박철수(웹) · 최서연(꺼짐) */
function 판({ 숙제 = [], 기록 = [] } = {}) {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 비번]);
  설정.appendRow(['푸시공개키', 'PUBLIC-KEY']); 설정.appendRow(['푸시비밀키', JSON.stringify({ kty: 'EC', crv: 'P-256', d: 'SECRET-D', x: 'x', y: 'y' })]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);
  for (const [반, 이름] of [['3A', '홍길동'], ['3A', '김영희'], ['3A', '이민준'], ['3B', '박철수'], ['3B', '최서연']]) {
    학생.appendRow([반, 이름, '1234', '', '', '중2', '', '교재A', '', '', '']);
  }
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 기록표 = store.insertSheet('기록');
  기록표.appendRow(['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외']);
  for (const r of 기록) 기록표.appendRow(r);
  const 숙제표 = store.insertSheet('숙제');
  숙제표.appendRow(['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류']);
  for (const r of 숙제) 숙제표.appendRow(r);
  store.insertSheet('공지').appendRow(['만든때', '반', '제목', '내용', '끝나는날', '켬']);
  const 푸시 = store.insertSheet('푸시');
  푸시.appendRow(['켠때', '반', '이름', '주소', 'p256dh', 'auth', '기기']);
  푸시.appendRow([new Date(서울('2026-11-20T08:00:00')), '', '홍길동', 홍, 'P256', 'AUTH', 'Android']);
  푸시.appendRow([new Date(서울('2026-11-20T08:00:00')), '', '김영희', 김, '', '', 'app']);
  푸시.appendRow([new Date(서울('2026-11-20T08:00:00')), '', '박철수', 박, 'P256', 'AUTH', 'iPhone']);
  store.insertSheet('알림예약').appendRow(옛예약머리);
  return store;
}
const 엔진 = (store, now = 지금) => createRuntime(store, { now: () => now });
const 이름들 = 구독 => 구독.map(s => s.이름).sort();
/* 예약 한 줄 — 대상을 주면 12칸, 안 주면 옛 10칸 */
const 예약줄 = (store, 종류, 시각, 대상) => store.getSheetByName('알림예약').appendRow(
  [new Date(지금 - 86400000), 종류, 종류 === '한번' ? '2026-11-20' : '', 시각, '알림 제목', '알림 내용', '', '', '', '', ...(대상 ?? [])]);

test('1. __알림거리 — 전체면 켠 아이 전부, 꺼진 아이는 꺼진수로 센다', () => {
  const r = 엔진(판()).noticeTargets('전체', '', '알림', '오늘 휴강');
  assert.equal(r.ok, true);
  assert.deepEqual(이름들(r.구독), ['김영희', '박철수', '홍길동']);
  assert.equal(r.대상글, '전체');
  assert.equal(r.꺼진수, 2);
  assert.equal(r.공개키, 'PUBLIC-KEY');
  // 대상종류가 비어도 전체
  assert.deepEqual(이름들(엔진(판()).noticeTargets('', '', '알림', '오늘 휴강').구독), ['김영희', '박철수', '홍길동']);
});

test('2. __알림거리 — 반이면 그 반에서 켠 아이만 (다른 반은 안 들어온다)', () => {
  const r = 엔진(판()).noticeTargets('반', '3A', '알림', '내용');
  assert.deepEqual(이름들(r.구독), ['김영희', '홍길동']);
  assert.ok(!r.구독.some(s => s.이름 === '박철수'));
  assert.equal(r.대상글, '3A반');
  assert.equal(r.꺼진수, 1, '이민준');
  assert.equal(엔진(판()).noticeTargets('반', '', '알림', '내용').ok, false, '반을 안 고르면 막는다');
});

test('3. __알림거리 — 아이면 고른 이름만, 꺼진 아이를 골라도 구독에 안 들어가고 꺼진수에 센다', () => {
  const r = 엔진(판()).noticeTargets('아이', '김영희|이민준', '알림', '내용');
  assert.deepEqual(이름들(r.구독), ['김영희']);
  assert.equal(r.꺼진수, 1);
  assert.equal(r.대상글, '김영희·이민준');
  // 배열로 와도 같다 · 넷 이상이면 「외 n명」
  const 넷 = 엔진(판()).noticeTargets('아이', ['홍길동', '김영희', '박철수', '최서연', '이민준'], '알림', '내용');
  assert.equal(넷.대상글, '홍길동·김영희·박철수 외 2명');
  assert.equal(넷.꺼진수, 2);
  assert.equal(엔진(판()).noticeTargets('아이', '', '알림', '내용').ok, false, '아무도 안 고르면 막는다');
});

test('4. __알림거리 — 보낼 웹 구독이 없으면 푸시비밀키를 안 돌려준다', () => {
  const 앱만 = 엔진(판()).noticeTargets('아이', '김영희', '알림', '내용');
  assert.equal(앱만.구독.length, 1);
  assert.equal('푸시비밀키' in 앱만, false);
  const 웹 = 엔진(판()).noticeTargets('아이', '홍길동', '알림', '내용');
  assert.match(웹.푸시비밀키, /SECRET-D/);
  const 아무도 = 엔진(판()).noticeTargets('아이', '최서연', '알림', '내용');
  assert.equal(아무도.구독.length, 0); assert.equal('푸시비밀키' in 아무도, false);
});

test('5. 알림명단 — 학생 표에서 깐다: 알림 안 켠 아이도 켬:false 로 나온다', () => {
  const e = 엔진(판());
  assert.equal(e.call('알림명단', ['0000']).ok, false);
  const r = e.call('알림명단', [비번]);
  assert.deepEqual(r.반들, ['3A', '3B']);
  assert.equal(r.아이들.length, 5);
  assert.deepEqual(r.아이들.find(x => x.이름 === '이민준'), { 이름: '이민준', 반: '3A', 켬: false });
  assert.deepEqual(r.아이들.find(x => x.이름 === '홍길동'), { 이름: '홍길동', 반: '3A', 켬: true });
  // 구독현황 과 같은 셈 (같은 조각 — 알림켠이름_)
  const 현황 = e.call('구독현황', [비번]);
  assert.equal(현황.켬, r.아이들.filter(x => x.켬).length);
});

test('6. __알림기록쓰기 — 줄이 늘고, 200줄이 넘으면 오래된 것부터 지운다', () => {
  const store = 판(), e = 엔진(store);
  assert.equal(store.getSheetByName('알림기록'), null);
  e.writeNoticeLog({ 누가: '선생님', 대상: '3A반', 제목: '첫 줄', 내용: '가', 보냄: 2, 실패: 0 });
  const 표 = store.getSheetByName('알림기록');
  assert.deepEqual(표.getRange(1, 1, 1, 7).getValues()[0], ['보낸때', '누가', '대상', '제목', '내용', '보냄', '실패']);
  assert.equal(표.getLastRow(), 2);
  const 많이 = Array.from({ length: 204 }, (_, i) => ({ 누가: i % 2 ? '예약' : '선생님', 대상: '전체', 제목: '줄' + i, 내용: '', 보냄: 1, 실패: 0 }));
  const r = e.writeNoticeLog(많이);
  assert.equal(r.지움, 5);
  assert.equal(표.getLastRow() - 1, 200, '최근 200줄만');
  assert.equal(표.getRange(2, 4).getValue(), '줄4', '가장 오래된 「첫 줄」 과 줄0~3 이 지워졌다');
  assert.equal(표.getRange(201, 4).getValue(), '줄203');
  // 화면 — 최근 것부터 20줄
  const 목록 = e.call('알림기록목록', [비번]).기록;
  assert.equal(목록.length, 20);
  assert.equal(목록[0].제목, '줄203'); assert.equal(목록[0].누가, '예약');
  assert.equal(e.call('알림기록목록', ['0000']).ok, false);
});

test('7. 예약알림_ — 반을 걸면 그 반만 받는다', () => {
  const store = 판();
  예약줄(store, '한번', '19:00', ['반', '3B']);
  const r = 엔진(store).scheduledNotices(지금);
  assert.equal(r.보낼것.length, 1);
  assert.deepEqual(이름들(r.보낼것[0].구독), ['박철수']);
  assert.equal(r.보낼것[0].대상, '3B반');
});

test('8. 예약알림_ — 안낸아이 + 반 은 두 조건을 다 만족하는 아이만', () => {
  const store = 판({
    숙제: [['', '교재A', 1, 10, '스펠링', '2026-11-20', new Date(서울('2026-11-18T10:00:00')), '홍길동,김영희,박철수', '기한']],
    기록: [[new Date(서울('2026-11-20T17:00:00')), '', '김영희', '교재A', '1~10', '스펠링', 10, 10, 100, 0, 0, 30, 'O', '', '숙제', '']],
  });
  예약줄(store, '안낸아이', '19:00', ['반', '3A']);
  const r = 엔진(store).scheduledNotices(지금);
  // 3A(홍길동 · 김영희 · 이민준) ∩ 안 낸 아이(홍길동 · 박철수) = 홍길동
  assert.deepEqual(이름들(r.보낼것[0].구독), ['홍길동']);
  assert.equal(r.보낼것[0].대상, '3A반 안 낸 아이');
});

test('9. 예약알림_ — 대상 칸이 비면(옛 예약 줄) 전체', () => {
  const store = 판();
  예약줄(store, '한번', '19:00');                       // 10칸짜리 옛 줄
  assert.equal(store.getSheetByName('알림예약').getLastColumn(), 10);
  const r = 엔진(store).scheduledNotices(지금);
  assert.deepEqual(이름들(r.보낼것[0].구독), ['김영희', '박철수', '홍길동']);
  assert.equal(r.보낼것[0].대상, '전체');
  // 예약저장 이 시트를 넓혀 머리글을 붙이고, 새 줄에는 대상이 들어간다
  const e = 엔진(store);
  const 저장 = e.call('예약저장', [비번, '', { 종류: '한번', 날짜: '2026-11-21', 시각: '19:00', 제목: '가', 내용: '나', 대상종류: '아이', 대상값: ['홍길동', '박철수'] }]);
  assert.equal(저장.ok, true);
  const 머리 = store.getSheetByName('알림예약').getRange(1, 1, 1, 12).getValues()[0];
  assert.deepEqual(머리.slice(10), ['대상종류', '대상값']);
  const 새것 = 저장.예약.find(n => n.날짜 === '2026-11-21');
  assert.equal(새것.대상종류, '아이'); assert.equal(새것.대상값, '홍길동|박철수');
  assert.equal(저장.예약.find(n => n.날짜 === '2026-11-20').대상종류, '전체');
});

test('10. 예약이 나가면 기록에 누가: 예약 으로 남는다', async () => {
  const store = 판();
  예약줄(store, '한번', '19:00', ['반', '3A']);
  const 할일 = 엔진(store).scheduledNotices(지금);
  const webPush = { sendNotification: async () => ({ statusCode: 201 }) };
  const messaging = { send: async () => 'id' };
  const out = await sendScheduledNotices(할일, { webPush, messaging });
  const 줄들 = noticeLogRows(out, '예약');
  assert.deepEqual(줄들, [{ 누가: '예약', 대상: '3A반', 제목: '알림 제목', 내용: '알림 내용', 보냄: 2, 실패: 0 }]);
  // runScheduledNotices 가 그 줄을 __알림기록쓰기 로 넘긴다
  const src = readFileSync(new URL('../functions/src/index.mjs', import.meta.url), 'utf8');
  assert.match(src, /const 줄들 = noticeLogRows\(out, '예약'\);/);
  assert.match(src, /await repo\.call\('__알림기록쓰기', \[줄들\]\)/);
  // 엔진에 적으면 화면에 예약으로 보인다
  const e = 엔진(store);
  e.writeNoticeLog(줄들);
  assert.deepEqual(e.call('알림기록목록', [비번]).기록.map(n => [n.누가, n.대상, n.보냄]), [['예약', '3A반', 2]]);
});

test('11. 제목 · 내용이 비면 막는다 (넘쳐도 막는다)', async () => {
  const e = 엔진(판());
  for (const [제목, 내용] of [['', '내용'], ['제목', ''], ['  ', '  ']]) {
    const r = e.noticeTargets('전체', '', 제목, 내용);
    assert.equal(r.ok, false); assert.match(r.메시지, /제목과 내용/);
  }
  assert.equal(e.noticeTargets('전체', '', 'x'.repeat(41), '내용').ok, false);
  assert.equal(e.noticeTargets('전체', '', '제목', 'x'.repeat(101)).ok, false);
  // 함수 쪽 — 엔진이 막으면 쏘지도 적지도 않고 그 말을 그대로 던진다
  const 부름 = [];
  const repo = { call: async (fn, args) => { 부름.push(fn); return e.noticeTargets(...args); } };
  await assert.rejects(sendNoticeWith(repo, { 제목: '', 내용: '' }, { send: async () => { 부름.push('쏘기'); } }), /제목과 내용/);
  assert.deepEqual(부름, ['__알림거리']);
});

test('12. 이름에 세로줄(|)이 섞이면 막는다 — 대상값이 깨진다 (빈 칸은 털어 낸다)', () => {
  const store = 판(), e = 엔진(store);
  const r = e.noticeTargets('아이', ['김|영희', '홍길동'], '알림', '내용');
  assert.equal(r.ok, false); assert.match(r.메시지, /세로줄/);
  assert.equal(e.noticeTargets('반', '3|A', '알림', '내용').ok, false);
  const 저장 = e.call('예약저장', [비번, '', { 종류: '한번', 날짜: '2026-11-21', 시각: '19:00', 제목: '가', 대상종류: '아이', 대상값: ['박|철수'] }]);
  assert.equal(저장.ok, false);
  assert.equal(store.getSheetByName('알림예약').getLastRow(), 1, '하나라도 틀리면 아무것도 안 쓴다');
  // 글로 올 때 앞뒤 · 겹친 세로줄과 같은 이름은 털어 낸다
  assert.equal(e.noticeTargets('아이', '|홍길동||홍길동| 박철수 |', '알림', '내용').대상글, '홍길동·박철수');
  assert.equal(e.noticeTargets('전체', '', '알림', '내용').ok, true);
  assert.equal(e.noticeTargets('학부모', '', '알림', '내용').ok, false, '모르는 대상종류는 막는다 — 학부모 길은 없다');
});

/* ---------------- 함수 쪽 ---------------- */
test('sendNoticeWith — __알림거리 → 쏘기 → __알림기록쓰기 차례, 중간에 터지면 기록에 실패로 남고 오류를 던진다', async () => {
  const store = 판(), e = 엔진(store);
  const 차례 = [];
  const repo = { call: async (fn, args) => {
    차례.push(fn);
    if (fn === '__알림거리') return e.noticeTargets(...args);
    if (fn === '__알림기록쓰기') return e.writeNoticeLog(args[0]);
    if (fn === '__죽은구독지우기') return e.dropDeadPushes(args[0]);
    throw new Error('모르는 ' + fn);
  } };
  const 쏜것 = [];
  const webPush = { sendNotification: async (sub, payload, opts) => {
    쏜것.push({ sub, payload: JSON.parse(payload), key: opts.vapidDetails.privateKey });
    차례.push('쏘기');
    return { statusCode: 201 };
  } };
  const messaging = { send: async m => { 쏜것.push({ fcm: m.notification }); 차례.push('쏘기'); return 'id'; } };
  const r = await sendNoticeWith(repo, { 제목: '휴강', 내용: '오늘은 쉽니다', 대상종류: '반', 대상값: '3A' }, { webPush, messaging });
  assert.deepEqual(차례, ['__알림거리', '쏘기', '쏘기', '__알림기록쓰기']);
  assert.equal(r.ok, true);
  assert.equal(r.보냄, 2); assert.equal(r.실패, 0); assert.equal(r.대상, '3A반'); assert.equal(r.꺼진수, 1);
  assert.deepEqual(r.줄.map(x => [x.이름, x.기기, x.됐나]).sort(), [['김영희', 'app', true], ['홍길동', 'Android', true]]);
  assert.deepEqual(쏜것.find(x => x.payload).payload, { 제목: '휴강', 내용: '오늘은 쉽니다' }, '웹은 글을 암호화해 싣는다');
  assert.equal(쏜것.find(x => x.payload).key, 'SECRET-D');
  assert.deepEqual(쏜것.find(x => x.fcm).fcm, { title: '휴강', body: '오늘은 쉽니다' });
  assert.ok(!JSON.stringify(r).includes('SECRET'), '선생님 화면에 비밀키가 안 간다');
  assert.deepEqual(e.call('알림기록목록', [비번]).기록.map(n => [n.누가, n.대상, n.제목, n.보냄, n.실패]), [['선생님', '3A반', '휴강', 2, 0]]);

  // 쏘다 터진다 — 고른 구독 모두 실패로 적고 오류는 그대로 올라간다
  차례.length = 0;
  await assert.rejects(sendNoticeWith(repo, { 제목: '두번째', 내용: '내용', 대상종류: '전체' }, { send: async () => { 차례.push('쏘기'); throw new Error('터짐'); } }), /터짐/);
  assert.deepEqual(차례, ['__알림거리', '쏘기', '__알림기록쓰기']);
  assert.deepEqual(e.call('알림기록목록', [비번]).기록[0], { ...e.call('알림기록목록', [비번]).기록[0], 누가: '선생님', 제목: '두번째', 보냄: 0, 실패: 3 });
});

test('sendNoticeWith — 410 은 치우고 줄에 「왜」 가 남는다 · 행 번호 없이도 돈다', async () => {
  const store = 판(), e = 엔진(store);
  const repo = { call: async (fn, args) => fn === '__알림거리' ? e.noticeTargets(...args) : fn === '__알림기록쓰기' ? e.writeNoticeLog(args[0]) : e.dropDeadPushes(args[0]) };
  const webPush = { sendNotification: async () => { throw Object.assign(new Error('gone'), { statusCode: 410, body: 'expired' }); } };
  const r = await sendNoticeWith(repo, { 제목: '가', 내용: '나', 대상종류: '아이', 대상값: '박철수' }, { webPush, messaging: {} });
  assert.equal(r.보냄, 0); assert.equal(r.실패, 1); assert.equal(r.지운구독, 1);
  assert.deepEqual(r.줄, [{ 이름: '박철수', 기기: 'iPhone', 됐나: false, 상태: 410, 왜: 'expired' }]);
  assert.ok(!store.getSheetByName('푸시').getRange(1, 1, 10, 7).getValues().some(x => x[3] === 박));
});

/* ---------------- 저장소(거래) 쪽 ---------------- */
async function 저장소판(store) {
  const db = fakeDb();
  const { documents } = await createDatasetDocuments(store, { digest });
  for (const [path, data] of documents) db.docs.set(`vocabDatasets/t/${path}`, data);
  return db;
}

test('__알림거리 · __알림기록쓰기 는 bridge 만 — journal 에 비밀키를 적지 않는다 · 알림보내기 는 aux 로 간다', async () => {
  const db = await 저장소판(판());
  const 다리 = new FirestoreRepository(db, 't', { role: 'bridge', user: { uid: 'notice-now' } });
  const r = await 다리.call('__알림거리', ['반', '3B', '알림', '내용']);
  assert.deepEqual(이름들(r.구독), ['박철수']);
  assert.match(r.푸시비밀키, /SECRET-D/);
  assert.equal((await 다리.call('__알림기록쓰기', [{ 누가: '선생님', 대상: '3B반', 제목: '알림', 내용: '내용', 보냄: 1, 실패: 0 }])).개수, 1);
  // __알림거리 는 읽기만 해서 journal 이 안 생긴다 — 생기더라도(적을답) 비밀키는 빼고 적는다
  const journal = [...db.docs.entries()].filter(([k]) => /\/journal\/[^/]+$/.test(k)).map(([, v]) => v);
  assert.ok(journal.some(j => j.fn === '__알림기록쓰기'));
  assert.ok(!journal.some(j => String(j.result).includes('SECRET-D')), 'journal 에는 비밀키를 적지 않는다');
  assert.ok(Object.values(unpack(db.docs.get(`vocabDatasets/t/tables/${sheetId('알림기록')}`).payload).cells).some(c => c.value === '3B반'));

  const 선생님 = new FirestoreRepository(db, 't', { user: { uid: 'teacher-uid-abc', getIdToken: async () => '' } });
  assert.deepEqual(await 선생님.call('선생님로그인', [비번]), { ok: true });
  assert.equal((await 선생님.call('__알림거리', ['전체', '', '알림', '내용'])).ok, false);
  assert.equal((await 선생님.call('__알림기록쓰기', [{ 제목: 'x' }])).ok, false);
  assert.equal((await 선생님.call('알림명단', [비번])).아이들.length, 5, '알림명단 은 보통 선생님 함수');
  const 넘긴 = [];
  선생님.auxiliary = async (fn, args) => { 넘긴.push([fn, args]); return { ok: true, 보냄: 1 }; };
  const 값 = { 제목: '휴강', 내용: '오늘', 대상종류: '전체', 대상값: '' };
  assert.deepEqual(await 선생님.call('알림보내기', [비번, 값]), { ok: true, 보냄: 1 });
  assert.deepEqual(넘긴, [['알림보내기', [비번, 값]]]);
});

test('aux — 알림보내기 는 sendNowNotice 로, 푸시전송 · __그림파일 은 그대로', () => {
  const src = readFileSync(new URL('../functions/src/index.mjs', import.meta.url), 'utf8');
  assert.match(src, /if \(fn === '알림보내기'\) return void res\.json\(\{ ok: true, 값: await sendNowNotice\(args\[1\]\) \}\);/);
  assert.match(src, /if \(fn === '푸시전송'\) return void res\.json\(\{ ok: true, 값: await sendPush\(args\[1\]\) \}\);/);
  assert.match(src, /if \(fn === '__그림파일'\)/);
  // 선생님 확인은 aux 가 먼저 한다 — 그 앞에서 돌려보내지 않는다
  assert.ok(src.indexOf("teacherOk(uid)") < src.indexOf("fn === '알림보내기'"));
  assert.match(src, /role: 'bridge', user: \{ uid: 'notice-now' \}/);
});

test('선생님 화면 — 「공지·알림」 탭, 고르개 한 벌, 알림만 보내기 칸 · 경고 · 보낸 알림', () => {
  const teacher = readFileSync(new URL('../teacher.html', import.meta.url), 'utf8');
  assert.match(teacher, /<button data-tab="notice" data-g="오늘">공지·알림<\/button>/);
  assert.doesNotMatch(teacher, />공지 보내기</);
  const 탭 = teacher.slice(teacher.indexOf("else if(T.tab==='notice'){"), teacher.indexOf("else if(T.tab==='miss'){"));
  // 같은 조각 하나를 즉시 · 예약이 같이 쓴다
  assert.equal((teacher.match(/function 대상고르개_\(/g) || []).length, 1);
  assert.match(탭, /<div id="tg_즉시">'\+대상고르개_\('즉시'\)/);
  assert.match(탭, /<div id="tg_예약">'\+대상고르개_\('예약'\)/);
  assert.match(탭, /api\('알림명단',T\.pw\)/);
  assert.match(탭, /api\('알림보내기', T\.pw, 값\)/);
  assert.match(탭, /공지에는 안 남습니다\. 알림만 갑니다/);
  assert.match(탭, /앱을 어제 올린 뒤로 한 번도 껐다 켜지 않은 아이에게는 '\+\s*'이 글이 안 뜨고 옛 공지가 뜰 수 있습니다/);
  assert.match(탭, /판\('보낸 알림'/);
  assert.ok(탭.indexOf("판('새 공지 적기'") < 탭.indexOf("판('알림만 보내기'"), '새 공지 적기 아래');
  assert.match(탭, /대상종류:대상\.대상종류, 대상값:대상\.대상값/, '예약에도 대상을 싣는다');
  // 꺼진 아이는 못 고른다 · 반이면 빠지는 수를 보인다
  const 고르개 = teacher.slice(teacher.indexOf('function 대상고르개_('), teacher.indexOf('function 대상손잡이_('));
  assert.match(고르개, /막힘\?' disabled':''/);
  assert.match(고르개, /명은 알림이 꺼져 빠집니다/);
  // 옛 길(브라우저가 서명하는 푸시전송)은 그대로
  assert.match(teacher, /return api\('푸시전송', T\.pw, 보낼것\)/);
  assert.match(탭, /공지알림보내기\(\[\]\)/);
  // 미리보기 흉내는 진짜로 쏘지 않는다
  const 공용 = readFileSync(new URL('../services/shared-ui.js', import.meta.url), 'utf8');
  const 흉내알림 = 공용.slice(공용.indexOf('  알림보내기:function'), 공용.indexOf('  푸시공개키:function'));
  assert.ok(흉내알림.length > 0);
  assert.doesNotMatch(흉내알림, /fetch|푸시전송|auxiliary/);
});
