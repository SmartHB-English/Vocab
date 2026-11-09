import test from 'node:test';
import assert from 'node:assert/strict';
import { TableStore } from '../services/table-store.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { digest } from '../services/firestore-repository.mjs';
import { unpack, sheetId } from '../services/store-codec.mjs';
assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/);
process.env.GCLOUD_PROJECT ??= 'demo-smarthb-vocab';
const { adminDb, teacherOk, pushAddressOk, sendPush, runMonthlyAward, runScheduledNotices, sendNowNotice } = await import('../functions/index.js');
const db = adminDb();
const dataset = 'fixture-functions';
const 서울오늘 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

test('seed', async () => {
  const s = new TableStore();
  const add = (name, rows) => { const t = s.insertSheet(name); for (const row of rows) t.appendRow(row); };
  add('학생', [['반','이름','비밀번호','학년구분','볼 수 있는 단어장','학년','학교','교재','학부모링크','학부모마지막','선생님한마디'], ['A','가상 학생','0011','초중등','','','','교재A','','','']]);
  add('설정', [['항목','값'], ['선생님비밀번호','9876']]);
  add('단어장목록', [['단어장','종류','시트이름','색','레슨묶음','과'], ['교재A','단어','단어_교재A','blue',10,'']]);
  add('단어_교재A', [['번호','영어','뜻','그림'], [1,'apple','사과','']]);
  for (const n of ['기록','기록보관','숙제','게임','공지','푸시']) s.insertSheet(n);
  const 예약 = s.insertSheet('알림예약');
  예약.appendRow(['만든때','종류','날짜','시각','제목','내용','공지함께','공지끝날','보낸때','켬']);
  예약.appendRow([new Date(), '한번', 서울오늘, '07:00', '예약 안내', '내용', 'O', '', '', '']);
  s.getSheetByName('푸시').appendRow(['켠때','반','이름','주소','p256dh','auth','기기']);
  s.getSheetByName('푸시').appendRow([new Date(), '', '가상 학생', 'fcm:' + 'f'.repeat(40), '', '', 'app']);
  const { documents } = await createDatasetDocuments(s, { digest, newId: () => crypto.randomUUID() });
  for (const [path, value] of documents) await db.doc(`vocabDatasets/${dataset}/${path}`).set(value);
  await db.doc('runtime/config').set({ dataset, state: 'active' });
});

test('only a session holding the teacher proof passes', async () => {
  await db.doc('sessions/t').set({ dataset, credentialId: 'teacher', proof: await digest('9876') });
  await db.doc('sessions/wrong').set({ dataset, credentialId: 'teacher', proof: await digest('0000') });
  assert.equal(await teacherOk('t'), true);
  assert.equal(await teacherOk('wrong'), false);
  assert.equal(await teacherOk('nobody'), false);
});

test('push goes only to push services', async () => {
  assert.equal(pushAddressOk('https://fcm.googleapis.com/fcm/send/abc'), true);
  assert.equal(pushAddressOk('https://web.push.apple.com/QK'), true);
  assert.equal(pushAddressOk('https://evil.example/fcm.googleapis.com'), false);
  assert.equal(pushAddressOk('http://fcm.googleapis.com/x'), false);
  assert.deepEqual((await sendPush([{ 주소: 'https://evil.example/' }])).줄[0].상태, 0);
});

test('scheduled notice stamps 보낸때 in the Admin SDK transaction before sending, then never picks it again', async () => {
  const 저녁 = new Date(서울오늘 + 'T20:00:00+09:00').getTime();
  const sent = [];
  const messaging = { send: async m => {
    const t = unpack((await db.doc(`vocabDatasets/${dataset}/tables/${sheetId('알림예약')}`).get()).data().payload);
    sent.push({ m, 보낸때: t.cells['2:9']?.value });            // 쏘는 그때 이미 저장돼 있어야 한다
    return 'id';
  } };
  const first = await runScheduledNotices({ now: 저녁, messaging });
  assert.equal(first.보냄, 1);
  assert.deepEqual(sent.map(x => [x.m.notification.title, x.보낸때]), [['예약 안내', 서울오늘 + ' 20:00']]);
  const notices = unpack((await db.doc(`vocabDatasets/${dataset}/tables/${sheetId('공지')}`).get()).data().payload);
  assert.ok(Object.values(notices.cells).some(c => c.value === '예약 안내'));
  assert.equal((await runScheduledNotices({ now: 저녁 + 600000, messaging })).보냄, 0);
  assert.equal(sent.length, 1);
  // 예약으로 나간 것도 알림기록 표에 남는다 (누가: 예약)
  const log = unpack((await db.doc(`vocabDatasets/${dataset}/tables/${sheetId('알림기록')}`).get()).data().payload);
  assert.deepEqual([2, 3, 4, 6].map(c => log.cells[`2:${c}`]?.value), ['예약', '전체', '예약 안내', 1]);
});

test('알림만 보내기 — sendNowNotice 가 Admin SDK 로 __알림거리 → 쏘기 → __알림기록쓰기, 공지는 안 늘어난다', async () => {
  const 공지수 = async () => Object.keys(unpack((await db.doc(`vocabDatasets/${dataset}/tables/${sheetId('공지')}`).get()).data().payload).cells).length;
  const 전 = await 공지수();
  const sent = [];
  const r = await sendNowNotice({ 제목: '휴강', 내용: '오늘은 쉽니다', 대상종류: '반', 대상값: 'A' }, { messaging: { send: async m => { sent.push(m.notification); return 'id'; } } });
  assert.equal(r.ok, true); assert.equal(r.보냄, 1); assert.equal(r.대상, 'A반'); assert.equal(r.꺼진수, 0);
  assert.deepEqual(sent, [{ title: '휴강', body: '오늘은 쉽니다' }]);
  assert.equal(await 공지수(), 전, '공지는 올라가지 않는다');
  const log = unpack((await db.doc(`vocabDatasets/${dataset}/tables/${sheetId('알림기록')}`).get()).data().payload);
  assert.deepEqual([2, 3, 4, 6].map(c => log.cells[`3:${c}`]?.value), ['선생님', 'A반', '휴강', 1]);
  // 다른 반이면 아무에게도 안 간다
  assert.equal((await sendNowNotice({ 제목: '가', 내용: '나', 대상종류: '반', 대상값: 'B' }, { messaging: { send: async () => { throw new Error('안 불린다'); } } })).보냄, 0);
  await assert.rejects(sendNowNotice({ 제목: '', 내용: '' }), /제목과 내용/);
});

test('monthly award runs the legacy engine through the Admin SDK and is repeatable', async () => {
  await runMonthlyAward();
  await runMonthlyAward();
  const catalog = (await db.doc(`vocabDatasets/${dataset}/meta/catalog`).get()).data();
  assert.ok(catalog.tables.some(t => t.name === '시상'));
  const table = unpack((await db.doc(`vocabDatasets/${dataset}/tables/${sheetId('시상')}`).get()).data().payload);
  const months = Object.entries(table.cells).filter(([k, c]) => k.endsWith(':1') && k !== '1:1' && c.value).map(([, c]) => c.value);
  assert.ok(months.length > 0);
  assert.equal(new Set(months).size, 1);                       // 같은 달만 — 두 번 돌아도 줄이 겹치지 않는다
  assert.equal(months.length, Object.keys(table.cells).filter(k => k.endsWith(':1') && k !== '1:1').length);
});

test('FCM sends generic notice and preserves legacy result order', async () => {
  const sent=[];
  const messaging={send:async message=>{sent.push(message);return 'message-id';}};
  const token='valid_synthetic_token_123456789';
  const result=await sendPush([{주소:'fcm:'+token},{주소:'https://evil.example/'}],messaging);
  assert.equal(result.줄[0].상태,200);
  assert.equal(result.줄[1].상태,0);
  assert.equal(sent[0].token,token);
  assert.equal(sent[0].data.route,'notices');
  assert.equal(sent[0].android.notification.channelId,'academy');
  assert.equal(sent[0].notification.title,'인왕보카');
});
test('expired FCM token uses legacy cleanup status; transient failure does not', async () => {
  const token='fcm:valid_synthetic_token_123456789';
  for(const [code,status] of [['messaging/registration-token-not-registered',410],['messaging/server-unavailable',0]]) {
    const result=await sendPush([{주소:token}],{send:async()=>{throw Object.assign(new Error('test'),{code});}});
    assert.equal(result.줄[0].상태,status);
  }
  assert.equal((await sendPush([{주소:'fcm:bad'}],{send:async()=>{throw Error('must not send');}})).줄[0].상태,400);
});
