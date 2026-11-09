// 알림 예약 — 선생님이 미리 써 두면 때가 됐을 때 Cloud Functions(scheduledNotices, 10분마다)가 보낸다.
// 엔진(Code.gs 의 예약알림_ = __예약알림)이 때가 된 줄을 고르고 보낸때를 먼저 찍는다 → functions/src/scheduled-push.mjs 가 서명해 쏜다.
// 시각은 Asia/Seoul. 선생님이 손으로 보내는 길(푸시전송 → aux → sendPush)은 그대로다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { sheetId, unpack } from '../services/store-codec.mjs';
import { fakeDb } from './helpers/fake-firestore.mjs';
import { sendScheduledNotices, vapidPrivateKey } from '../functions/src/scheduled-push.mjs';

const 흉내 = new URL('./helpers/fake-firestore.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { return s === 'firebase/firestore' ? { url: ${JSON.stringify(흉내)}, shortCircuit: true } : n(s, c); }`));
const { FirestoreRepository, digest } = await import('../services/firestore-repository.mjs');

const 비번 = '5678';
const 예약머리 = ['만든때', '종류', '날짜', '시각', '제목', '내용', '공지함께', '공지끝날', '보낸때', '켬'];
const 숙제머리 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류'];
// 2026-11-20 19:05 서울 = 10:05 UTC. UTC 로 세면 아직 아침 10시라 19:00 예약이 안 골라진다
const 서울 = t => new Date(t + '+09:00').getTime();
const 지금 = 서울('2026-11-20T19:05:00');

function 판(오늘 = '2026-11-20', { 숙제 = [], 기록 = [] } = {}) {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 비번]);
  설정.appendRow(['푸시공개키', 'PUBLIC-KEY']); 설정.appendRow(['푸시비밀키', JSON.stringify({ kty: 'EC', crv: 'P-256', d: 'SECRET-D', x: 'x', y: 'y' })]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);
  학생.appendRow(['', '홍길동', '1234', '', '', '중2', '', '교재A', '', '', '']);
  학생.appendRow(['', '김영희', '0011', '', '', '중1', '', '교재A', '', '', '']);
  학생.appendRow(['', '박철수', '2222', '', '', '중1', '', '교재A', '', '', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 기록표 = store.insertSheet('기록');
  기록표.appendRow(['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외']);
  for (const r of 기록) 기록표.appendRow(r);
  const 숙제표 = store.insertSheet('숙제'); 숙제표.appendRow(숙제머리);
  for (const r of 숙제) 숙제표.appendRow(r);
  store.insertSheet('공지').appendRow(['만든때', '반', '제목', '내용', '끝나는날', '켬']);
  const 푸시 = store.insertSheet('푸시');
  푸시.appendRow(['켠때', '반', '이름', '주소', 'p256dh', 'auth', '기기']);
  푸시.appendRow([new Date(서울(오늘 + 'T08:00:00')), '', '홍길동', 'https://fcm.googleapis.com/fcm/send/hong', 'P256', 'AUTH', 'Android']);
  푸시.appendRow([new Date(서울(오늘 + 'T08:00:00')), '', '김영희', 'fcm:' + 'k'.repeat(40), '', '', 'app']);
  store.insertSheet('알림예약').appendRow(예약머리);
  return store;
}
const 예약줄 = (store, 종류, 날짜, 시각, { 보낸때 = '', 켬 = '', 공지함께 = '', 공지끝날 = '', 제목 = '알림 제목' } = {}) =>
  store.getSheetByName('알림예약').appendRow([new Date(지금 - 86400000), 종류, 날짜, 시각, 제목, '알림 내용', 공지함께, 공지끝날, 보낸때, 켬]);
const 엔진 = (store, now = 지금) => createRuntime(store, { now: () => now });
const 예약칸 = (store, 행, 칸) => store.getSheetByName('알림예약').getRange(행, 칸).getValue();
const 공지수 = store => Math.max(0, store.getSheetByName('공지').getLastRow() - 1);

test('예약저장 — 6:59 · 21:01 은 막고 7:00 · 21:00 은 받는다', () => {
  const store = 판(), e = 엔진(store);
  const 값 = 시각 => ({ 종류: '한번', 날짜: '2026-11-21', 시각, 제목: '시험 안내', 내용: '내일 시험' });
  for (const t of ['06:59', '6:59', '21:01', '23:00', '03:00']) {
    const r = e.call('예약저장', [비번, '', 값(t)]);
    assert.equal(r.ok, false, t); assert.match(r.메시지, /7시부터 밤 9시/);
  }
  for (const t of ['07:00', '7:00', '21:00']) assert.equal(e.call('예약저장', [비번, '', 값(t)]).ok, true, t);
  const 목록 = e.call('예약목록', [비번]).예약;
  assert.deepEqual(목록.map(n => n.시각).sort(), ['07:00', '07:00', '21:00']);
  assert.equal(e.call('예약저장', ['0000', '', 값('19:00')]).ok, false);                       // 선생님 비번
  assert.equal(e.call('예약저장', [비번, '', { ...값('19:00'), 종류: '매주' }]).ok, false);      // 종류
  assert.equal(e.call('예약저장', [비번, '', { ...값('19:00'), 날짜: '2026-11-31' }]).ok, false); // 없는 날짜
  assert.equal(e.call('예약저장', [비번, '', { ...값('19:00'), 날짜: '2026-11-19' }]).ok, false); // 지난 날짜
  assert.equal(e.call('예약저장', [비번, '', { ...값('19:00'), 시각: '19시' }]).ok, false);       // 꼴
  const 매일 = e.call('예약저장', [비번, '', { 종류: '안낸아이', 날짜: '2026-11-25', 시각: '20:00', 제목: '숙제' }]);
  assert.equal(매일.ok, true);
  assert.equal(매일.예약[0].날짜, '', '안낸아이 는 날짜를 비운다 (매일 돈다)');
});

test('예약켜기 · 예약지우기 — 행과 키로 그 줄을 찾는다', () => {
  const store = 판(), e = 엔진(store);
  const 걸기 = e.call('예약저장', [비번, '', { 종류: '한번', 날짜: '2026-11-21', 시각: '19:00', 제목: '하나' }]);
  const n = 걸기.예약[0];
  assert.equal(n.켬, true);
  assert.equal(e.call('예약켜기', [비번, n.행, false, n.키]).예약[0].켬, false);
  assert.equal(e.call('예약켜기', [비번, n.행, false, 'wrong-key']).ok, false, '줄이 밀렸으면 건드리지 않는다');
  assert.equal(e.call('예약지우기', [비번, n.행, n.키]).예약.length, 0);
});

test('한번 — 날짜·시각이 지나면 고르고, 아직이면 안 고른다', () => {
  const store = 판();
  예약줄(store, '한번', '2026-11-20', '19:00', { 제목: '지금' });
  예약줄(store, '한번', '2026-11-20', '19:10', { 제목: '조금 뒤' });
  예약줄(store, '한번', '2026-11-21', '07:00', { 제목: '내일' });
  예약줄(store, '한번', '2026-11-19', '19:00', { 제목: '어제 것' });
  const r = 엔진(store).scheduledNotices(지금);
  assert.deepEqual(r.보낼것.map(j => j.제목), ['지금']);
  assert.equal(r.보낼것[0].구독.length, 2, '한번 은 알림을 켠 아이 전부');
  assert.equal(예약칸(store, 2, 9), '2026-11-20 19:05');
  assert.equal(예약칸(store, 3, 9), '');
});

test('한번 — 보낸때가 찍혀 있으면 다시 안 고른다', () => {
  const store = 판();
  예약줄(store, '한번', '2026-11-20', '19:00');
  assert.equal(엔진(store).scheduledNotices(지금).보낼것.length, 1);
  assert.equal(엔진(store, 지금 + 600000).scheduledNotices(지금 + 600000).보낼것.length, 0);
  const 또 = 판(); 예약줄(또, '한번', '2026-11-20', '19:00', { 보낸때: '2026-11-20 19:00' });
  assert.equal(엔진(또).scheduledNotices(지금).보낼것.length, 0);
});

const 오늘숙제 = [['', '교재A', 1, 10, '스펠링', '2026-11-20', new Date(서울('2026-11-18T10:00:00')), '홍길동,김영희', '기한']];

test('안낸아이 — 보낸때가 오늘이면 안 고르고, 어제면 고른다 · 안 낸 아이에게만 간다', () => {
  const 오늘것 = 판('2026-11-20', { 숙제: 오늘숙제 });
  예약줄(오늘것, '안낸아이', '', '19:00', { 보낸때: '2026-11-20' });
  assert.equal(엔진(오늘것).scheduledNotices(지금).보낼것.length, 0);

  const store = 판('2026-11-20', { 숙제: 오늘숙제 });
  예약줄(store, '안낸아이', '', '19:00', { 보낸때: '2026-11-19' });
  예약줄(store, '안낸아이', '', '20:00');                       // 아직 시각 전
  const r = 엔진(store).scheduledNotices(지금);
  assert.equal(r.보낼것.length, 1);
  assert.deepEqual(r.보낼것[0].구독.map(s => s.이름).sort(), ['김영희', '홍길동']);
  assert.equal(예약칸(store, 2, 9), '2026-11-20', '안낸아이 는 날짜만 찍는다');
  assert.equal(예약칸(store, 3, 9), '');
  // 다음 날 같은 시각 — 또 나간다
  const 내일 = 서울('2026-11-21T19:05:00');
  assert.equal(엔진(store, 내일).scheduledNotices(내일).찍은수, 1);
});

test('안낸아이 — 낸 아이는 빼고, 오늘 마감이 아닌 숙제는 안 센다 (전체숙제 → 숙제줄_ 의 안한사람)', () => {
  const store = 판('2026-11-20', { 숙제: [
    ...오늘숙제,
    ['', '교재A', 11, 20, '스펠링', '2026-11-22', new Date(서울('2026-11-18T10:00:00')), '박철수', '기한'],
  ], 기록: [                                                       // 김영희는 오늘 냈다
    [new Date(서울('2026-11-20T17:00:00')), '', '김영희', '교재A', '1~10', '스펠링', 10, 10, 100, 0, 0, 30, 'O', '', '숙제', ''],
  ] });
  예약줄(store, '안낸아이', '', '19:00');
  const e = 엔진(store);
  const 숙제들 = e.call('선생님기본', [비번]).숙제목록;
  const 오늘 = 숙제들.find(h => h.마감일 === '2026-11-20');
  assert.deepEqual(오늘.안한사람, ['홍길동']); assert.deepEqual(오늘.한사람, ['김영희']);
  const r = e.scheduledNotices(지금);
  assert.deepEqual(r.보낼것[0].구독.map(s => s.이름), ['홍길동']);
  assert.ok(!r.보낼것[0].구독.some(s => s.이름 === '박철수'), '모레 마감 숙제만 남은 아이는 안 받는다');
});

test('안낸아이 — 안 낸 아이가 없으면 보낼 것이 비고, 보낸때는 찍힌다', () => {
  const store = 판();                                             // 오늘 마감 숙제가 없다
  예약줄(store, '안낸아이', '', '19:00', { 공지함께: 'O' });
  const r = 엔진(store).scheduledNotices(지금);
  assert.deepEqual(r.보낼것, []);
  assert.equal(r.푸시비밀키, undefined, '보낼 것이 없으면 열쇠도 안 싣는다');
  assert.equal(예약칸(store, 2, 9), '2026-11-20');
  assert.equal(공지수(store), 0, '안 보낼 때는 공지도 안 올린다');
});

test('켬 이 꺼진 줄은 안 고른다', () => {
  const store = 판('2026-11-20', { 숙제: 오늘숙제 });
  예약줄(store, '한번', '2026-11-20', '19:00', { 켬: 'X' });
  예약줄(store, '안낸아이', '', '19:00', { 켬: 'X' });
  const r = 엔진(store).scheduledNotices(지금);
  assert.equal(r.보낼것.length, 0);
  assert.equal(예약칸(store, 2, 9), '');
});

test('공지함께 가 켜지면 공지 표에 줄이 하나 는다 — 끝날이 비면 사흘 뒤', () => {
  const store = 판();
  예약줄(store, '한번', '2026-11-20', '19:00', { 공지함께: 'O', 제목: '휴원 안내' });
  예약줄(store, '한번', '2026-11-20', '18:00', { 공지함께: 'O', 공지끝날: '2026-11-30', 제목: '시험 안내' });
  예약줄(store, '한번', '2026-11-20', '18:30', { 제목: '공지 없이' });
  엔진(store).scheduledNotices(지금);
  assert.equal(공지수(store), 2);
  const 공지 = 엔진(store).call('공지가져오기', []);
  assert.deepEqual(공지.map(n => n.제목).sort(), ['시험 안내', '휴원 안내']);
  const 줄 = store.getSheetByName('공지').getRange(2, 1, 2, 6).getValues();
  assert.deepEqual(줄.map(x => [x[2], x[4]]).sort(), [['시험 안내', '2026-11-30'], ['휴원 안내', '2026-11-23']]);
});

test('시각 기준은 Asia/Seoul — UTC 로 세면 아홉 시간 어긋난다', () => {
  const store = 판();
  예약줄(store, '한번', '2026-11-20', '19:00');
  // 10:05 UTC 는 서울 19:05 — 고른다
  assert.equal(new Date(지금).toISOString(), '2026-11-20T10:05:00.000Z');
  assert.equal(엔진(store).scheduledNotices(지금).보낼것.length, 1);
  // 서울 18:55 (= 09:55 UTC) — 아직
  const 이른 = 판(); 예약줄(이른, '한번', '2026-11-20', '19:00');
  assert.equal(엔진(이른, 지금 - 600000).scheduledNotices(지금 - 600000).보낼것.length, 0);
  // 15:30 UTC 11-20 은 서울로 벌써 11-21 00:30 — 「오늘」 이 11-21 이다
  const 자정넘어 = 서울('2026-11-21T00:30:00');
  assert.equal(엔진(판(), 자정넘어).scheduledNotices(자정넘어).오늘, '2026-11-21');
});

test('죽은 구독 지우기 — 선생님 길(구독지우기)과 함수 길(dropDeadPushes)이 같은 속을 쓴다', () => {
  const store = 판(), e = 엔진(store);
  assert.equal(e.call('구독지우기', ['0000', ['x']]).ok, false);
  assert.equal(e.call('구독지우기', [비번, ['https://fcm.googleapis.com/fcm/send/hong']]).개수, 1);
  assert.equal(e.dropDeadPushes(['fcm:' + 'k'.repeat(40)]).개수, 1);
  assert.equal(store.getSheetByName('푸시').getLastRow(), 1);
});

/* ---------------- 함수 쪽 — 서명하고 쏘기 ---------------- */
const 할일 = () => ({ ok: true, 오늘: '2026-11-20', 찍은수: 1, 공개키: 'PUBLIC-KEY', 푸시비밀키: JSON.stringify({ d: 'SECRET-D' }),
  보낼것: [{ 행: 2, 종류: '한번', 제목: '시험 안내', 내용: '내일 시험', 구독: [
    { 이름: '홍길동', 주소: 'https://fcm.googleapis.com/fcm/send/hong', p256dh: 'P256', auth: 'AUTH' },
    { 이름: '김영희', 주소: 'fcm:' + 'k'.repeat(40) },
    { 이름: '죽은폰', 주소: 'https://web.push.apple.com/dead', p256dh: 'P', auth: 'A' },
    { 이름: '나쁜곳', 주소: 'https://evil.example/x', p256dh: 'P', auth: 'A' },
  ] }] });

test('예약 알림 쏘기 — 웹은 설정의 비밀키로 서명해 제목·내용을 싣고, FCM 은 messaging 이, 410 은 치운다', async () => {
  const 웹 = [], 앱 = [], 치움 = [];
  const webPush = { sendNotification: async (sub, payload, opts) => {
    웹.push({ sub, payload, opts });
    if (sub.endpoint.includes('dead')) throw Object.assign(new Error('gone'), { statusCode: 410, body: 'gone' });
    return { statusCode: 201, body: '' };
  } };
  const messaging = { send: async m => { 앱.push(m); return 'id'; } };
  const repo = { call: async (fn, args) => { 치움.push([fn, args]); return { ok: true, 개수: args[0].length }; } };
  const r = await sendScheduledNotices(할일(), { webPush, messaging, repo });
  assert.equal(웹.length, 2, '알림 서버가 아닌 주소로는 안 나간다');
  assert.deepEqual(웹[0].opts.vapidDetails, { subject: 'https://smarthb-english.github.io/Vocab/', publicKey: 'PUBLIC-KEY', privateKey: 'SECRET-D' });
  assert.deepEqual(JSON.parse(웹[0].payload), { 제목: '시험 안내', 내용: '내일 시험' });
  assert.deepEqual(웹[0].sub.keys, { p256dh: 'P256', auth: 'AUTH' });
  assert.equal(앱.length, 1);
  assert.deepEqual(앱[0].notification, { title: '시험 안내', body: '내일 시험' });
  assert.deepEqual(치움, [['__죽은구독지우기', [['https://web.push.apple.com/dead']]]]);
  assert.equal(r.보냄, 2); assert.equal(r.실패, 2); assert.equal(r.지운구독, 1);
  assert.ok(!JSON.stringify(r).includes('SECRET'), '돌려주는(로그에 남는) 것에 비밀키가 없다');
});

test('예약 알림 쏘기 — FCM 의 죽은 토큰도 410 으로 치운다 · 보낼 것이 없으면 아무것도 안 부른다', async () => {
  const 치움 = [];
  const repo = { call: async (fn, args) => { 치움.push(args[0]); return { ok: true, 개수: 1 }; } };
  const 일 = { 보낼것: [{ 행: 2, 제목: '', 내용: '숙제', 구독: [{ 이름: '김영희', 주소: 'fcm:' + 'k'.repeat(40) }] }] };
  const messaging = { send: async () => { throw Object.assign(new Error('x'), { code: 'messaging/registration-token-not-registered' }); } };
  await sendScheduledNotices(일, { messaging, repo });
  assert.deepEqual(치움, [['fcm:' + 'k'.repeat(40)]]);
  const 안부름 = { send: async () => { throw new Error('must not send'); } };
  assert.equal((await sendScheduledNotices({ ok: true, 보낼것: [] }, { messaging: 안부름, repo: { call: async () => { throw new Error('no'); } } })).보냄, 0);
});

test('VAPID — 선생님 화면이 만든 JWK 비밀키(d)로 web-push 가 서명하고, 공개키로 풀린다', async t => {
  let webpush;
  try { webpush = createRequire(new URL('../functions/package.json', import.meta.url))('web-push'); }
  catch { return t.skip('functions/node_modules 에 web-push 가 없다 — cd functions && npm install'); }
  const b64 = b => Buffer.from(b).toString('base64url');
  const 쌍 = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const 공개키 = b64(await crypto.subtle.exportKey('raw', 쌍.publicKey));
  const 비밀키글 = JSON.stringify(await crypto.subtle.exportKey('jwk', 쌍.privateKey));    // 설정 표에 적히는 꼴 (알림열쇠만들기)
  const 받는쪽 = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const sub = { 주소: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: b64(await crypto.subtle.exportKey('raw', 받는쪽.publicKey)), auth: b64(crypto.getRandomValues(new Uint8Array(16))) };
  let 머리;
  const webPush = { sendNotification: async (s, payload, opts) => { 머리 = webpush.generateRequestDetails(s, payload, opts).headers; return { statusCode: 201 }; } };
  const r = await sendScheduledNotices({ 공개키, 푸시비밀키: 비밀키글, 보낼것: [{ 행: 2, 제목: '가', 내용: '나', 구독: [sub] }] }, { webPush });
  assert.equal(r.보냄, 1);
  const [, 표, k] = /^vapid t=([^,]+), k=(.+)$/.exec(머리.Authorization);
  assert.equal(k, 공개키);
  const [a, b, c] = 표.split('.');
  assert.equal(JSON.parse(Buffer.from(b, 'base64url')).aud, 'https://fcm.googleapis.com');
  assert.equal(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, 쌍.publicKey, Buffer.from(c, 'base64url'), new TextEncoder().encode(a + '.' + b)), true);
  assert.equal(머리['Content-Encoding'], 'aes128gcm', '제목·내용은 구독 열쇠로 암호화해 싣는다');
  assert.equal(vapidPrivateKey(비밀키글), JSON.parse(비밀키글).d);
});

/* ---------------- 저장소(거래) 쪽 ---------------- */
async function 저장소판(store) {
  const db = fakeDb();
  const { documents } = await createDatasetDocuments(store, { digest });
  for (const [path, data] of documents) db.docs.set(`vocabDatasets/t/${path}`, data);
  return db;
}
const 다리 = db => new FirestoreRepository(db, 't', { role: 'bridge', user: { uid: 'scheduled-notice' } });
const 예약표 = db => unpack(db.docs.get(`vocabDatasets/t/tables/${sheetId('알림예약')}`).payload);
const 보낸때칸 = (db, 행) => 예약표(db).cells[`${행}:9`]?.value ?? '';

test('보낸때를 먼저 찍는다 — 거래가 끝난 뒤에 쏘고, 쏘다 터져도 같은 줄이 두 번 안 나간다', async () => {
  const 서울오늘 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const store = 판(서울오늘);
  store.getSheetByName('알림예약').appendRow([new Date(), '한번', 서울오늘, '07:00', '오늘 안내', '내용', '', '', '', '']);
  const db = await 저장소판(store);
  const 저녁 = 서울(서울오늘 + 'T20:00:00');
  const 할일 = await 다리(db).call('__예약알림', [저녁]);
  assert.equal(할일.보낼것.length, 1);
  assert.match(할일.푸시비밀키, /SECRET-D/, '함수에는 비밀키를 준다');
  // 쏘기 전에 이미 저장돼 있다
  assert.equal(보낸때칸(db, 2), 서울오늘 + ' 20:00');
  const journal = [...db.docs.entries()].filter(([k]) => /\/journal\/[^/]+$/.test(k)).map(([, v]) => v);
  assert.ok(journal.some(j => j.fn === '__예약알림'));
  assert.ok(!journal.some(j => String(j.result).includes('SECRET-D')), 'journal 에는 비밀키를 적지 않는다');
  // 쏘다 터진다 — 그래도 보낸때는 이미 거래로 들어가 있다
  const 터짐 = { send: async () => { throw new Error('network'); } };
  const 결과 = await sendScheduledNotices(할일, { messaging: 터짐, webPush: { sendNotification: async () => { throw new Error('boom'); } } });
  assert.equal(결과.보냄, 0);
  assert.equal(보낸때칸(db, 2), 서울오늘 + ' 20:00');
  // 10분 뒤 다시 돌아도 안 고른다
  assert.deepEqual((await 다리(db).call('__예약알림', [저녁 + 600000])).보낼것, []);
});

test('__예약알림 · __죽은구독지우기 는 bridge 만 — 학생 · 선생님이 불러도 비밀키를 안 준다', async () => {
  const store = 판();
  const db = await 저장소판(store);
  const 선생님 = new FirestoreRepository(db, 't', { user: { uid: 'teacher-uid-abc', getIdToken: async () => '' } });
  assert.deepEqual(await 선생님.call('선생님로그인', [비번]), { ok: true });
  assert.equal((await 선생님.call('__예약알림', [지금])).ok, false);
  assert.equal((await 선생님.call('__죽은구독지우기', [['x']])).ok, false);
  const 아무나 = new FirestoreRepository(db, 't', { user: { uid: 'anon-uid-abc', getIdToken: async () => '' } });
  assert.equal((await 아무나.call('__예약알림', [지금])).ok, false);
  // bridge 는 죽은 구독을 치울 수 있다
  assert.equal((await 다리(db).call('__죽은구독지우기', [['https://fcm.googleapis.com/fcm/send/hong']])).개수, 1);
});

test('선생님이 손으로 보내는 푸시전송 길은 그대로 — 화면이 만든 표를 aux 로 넘기고 sendPush 가 실어 보낸다', async () => {
  const store = 판();
  const db = await 저장소판(store);
  const 선생님 = new FirestoreRepository(db, 't', { user: { uid: 'teacher-uid-xyz', getIdToken: async () => '' } });
  await 선생님.call('선생님로그인', [비번]);
  const 넘긴 = [];
  선생님.auxiliary = async (fn, args) => { 넘긴.push([fn, args]); return { ok: true, 줄: [{ 주소: 'a', 상태: 201, 글: '' }] }; };
  const 보낼것 = [{ 주소: 'https://fcm.googleapis.com/fcm/send/hong', 표: 'JWT', 공개키: 'PUBLIC-KEY' }];
  assert.deepEqual(await 선생님.call('푸시전송', [비번, 보낼것]), { ok: true, 줄: [{ 주소: 'a', 상태: 201, 글: '' }] });
  assert.deepEqual(넘긴, [['푸시전송', [비번, 보낼것]]]);
  // 엔진 쪽 선생님 함수들도 그대로
  const e = 엔진(store);
  assert.equal(e.call('푸시열쇠', [비번]).공개키, 'PUBLIC-KEY');
  assert.equal(e.call('구독목록', [비번, []]).구독.length, 2);
  // 함수 쪽 — aux 는 여전히 푸시전송을 sendPush 로, sendPush 는 화면이 만든 표(x.표)를 그대로 싣는다
  const src = readFileSync(new URL('../functions/src/index.mjs', import.meta.url), 'utf8');
  assert.match(src, /if \(fn === '푸시전송'\) return void res\.json\(\{ ok: true, 값: await sendPush\(args\[1\]\) \}\);/);
  assert.match(src, /Authorization: `vapid t=\$\{x\.표\}, k=\$\{x\.공개키\}`/);
  assert.match(src, /export const scheduledNotices = onSchedule\(\{ region, schedule: '\*\/10 \* \* \* \*', timeZone: 'Asia\/Seoul' \}/);
  // 선생님 화면의 알림쏘기도 그대로 표를 만들어 푸시전송 으로 보낸다
  const teacher = readFileSync(new URL('../teacher.html', import.meta.url), 'utf8');
  assert.match(teacher, /return api\('푸시전송', T\.pw, 보낼것\)/);
});

test('선생님 화면 — 「공지 보내기」 탭에 예약 칸, 시각은 7:00~21:00 만, 켠 아이 수 · 안낸아이 안내', () => {
  const teacher = readFileSync(new URL('../teacher.html', import.meta.url), 'utf8');
  const 탭 = teacher.slice(teacher.indexOf("else if(T.tab==='notice'){"), teacher.indexOf("else if(T.tab==='miss'){"));
  assert.match(탭, /api\('예약목록',T\.pw\)/);
  assert.match(탭, /판\('알림 예약'/);
  assert.match(탭, /for\(var 분=7\*60; 분<=21\*60; 분\+=10\)/);
  assert.match(탭, /지금 알림을 켠 아이 <b>'\+현황\.켬\+'명<\/b>/);
  assert.match(탭, /오늘 마감인 숙제를 안 낸 아이에게만 갑니다\. 아무도 없으면 안 보냅니다/);
  for (const fn of ['예약저장', '예약켜기', '예약지우기']) assert.match(탭, new RegExp(`api\\('${fn}'`));
  assert.doesNotMatch(teacher, /data-tab="schedule"|data-tab="reserve"/, '새 탭을 만들지 않는다');
});
