import test from 'node:test';
import assert from 'node:assert/strict';
import { TableStore } from '../services/table-store.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { digest } from '../services/firestore-repository.mjs';
import { unpack, sheetId } from '../services/store-codec.mjs';
assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/);
process.env.GCLOUD_PROJECT ??= 'demo-smarthb-vocab';
const { adminDb, teacherOk, pushAddressOk, sendPush, runMonthlyAward } = await import('../functions/index.js');
const db = adminDb();
const dataset = 'fixture-functions';

test('seed', async () => {
  const s = new TableStore();
  const add = (name, rows) => { const t = s.insertSheet(name); for (const row of rows) t.appendRow(row); };
  add('학생', [['반','이름','비밀번호','학년구분','볼 수 있는 단어장','학년','학교','교재','학부모링크','학부모마지막','선생님한마디'], ['A','가상 학생','0011','초중등','','','','교재A','','','']]);
  add('설정', [['항목','값'], ['선생님비밀번호','9876']]);
  add('단어장목록', [['단어장','종류','시트이름','색','레슨묶음','과'], ['교재A','단어','단어_교재A','blue',10,'']]);
  add('단어_교재A', [['번호','영어','뜻','그림'], [1,'apple','사과','']]);
  for (const n of ['기록','기록보관','숙제','게임','공지','푸시']) s.insertSheet(n);
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
