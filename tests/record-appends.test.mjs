// 기록을 덧붙임 조각으로 쓴다 — 줄을 뒤에 붙이기만 한 제출은 본체(tables/기록)를 안 건드리고 조각 문서 하나만 만든다.
// 진짜 저장소(FirestoreRepository)를 흉내 Firestore 위에서. 규칙(학생은 조각을 만들기만)은 test:emulators 가 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { TableStore } from '../services/table-store.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { sheetId, unpack } from '../services/store-codec.mjs';
import { fakeDb } from './helpers/fake-firestore.mjs';

const 흉내 = new URL('./helpers/fake-firestore.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { return s === 'firebase/firestore' ? { url: ${JSON.stringify(흉내)}, shortCircuit: true } : n(s, c); }`));
const { FirestoreRepository, digest } = await import('../services/firestore-repository.mjs');

const 판 = 't', 선생님비번 = '5678';
const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'];
const 한시간전 = () => new Date(Date.now() - 3600000);
async function 판차리기() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 선생님비번]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);
  학생.appendRow(['월수금', '홍길동', '1234', '', '', '중2', '', '', '', '', '']);
  학생.appendRow(['화목', '김영희', '0011', '', '', '중1', '', '', '', '', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 기록 = store.insertSheet('기록');
  기록.appendRow(머리기록);
  기록.appendRow([한시간전(), '', '홍길동', '교재A', '본체1', '스펠링', 10, 9, 90, 0, 0, 30, 'O', '', '숙제', '']);
  기록.appendRow([한시간전(), '', '김영희', '교재A', '본체2', '스펠링', 10, 7, 70, 0, 0, 30, 'O', '', '숙제', '']);
  store.insertSheet('기록보관').appendRow(머리기록);
  store.insertSheet('숙제').appendRow(['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류']);
  const db = fakeDb();
  const { documents } = await createDatasetDocuments(store, { digest });
  for (const [path, data] of documents) db.docs.set(`vocabDatasets/${판}/${path}`, data);
  return db;
}
let 번호 = 0;
const 사람 = db => new FirestoreRepository(db, 판, { user: { uid: 'uid' + (++번호) + 'abcdef', getIdToken: async () => '' } });
async function 학생(db, 이름 = '홍길동', 비번 = '1234') { const r = 사람(db); assert.equal((await r.call('로그인', [이름, 비번])).ok, true); return r; }
async function 선생님(db) { const r = 사람(db); assert.deepEqual(await r.call('선생님로그인', [선생님비번]), { ok: true }); return r; }
const 본체 = db => db.docs.get(`vocabDatasets/${판}/tables/${sheetId('기록')}`);
const 목록 = db => db.docs.get(`vocabDatasets/${판}/meta/catalog`);
const 조각들 = db => [...db.docs.keys()].filter(k => k.includes(`/tables/${sheetId('기록')}/appends/`)).sort();
const 제출 = (범위, 구분 = '숙제', 점수 = 80) => ({ 이름: '홍길동', 단어장: '교재A', 범위, 유형: '스펠링', 문항수: 10, 정답수: 8, 점수, 숙제여부: true, 구분, 틀린단어: 'a,b' });
const 잠깐 = () => new Promise(r => setTimeout(r, 3));
/* 선생님 눈으로 본 기록 표의 「범위」 칸들 — 본체 + 조각을 합친 차례 */
async function 범위들(db) {
  const t = await 선생님(db);
  const store = await t.load(await t.catalog(), ref => import('./helpers/fake-firestore.mjs').then(m => m.getDoc(ref)));
  const sh = store.getSheetByName('기록');
  return sh.getRange(2, 5, sh.getLastRow() - 1, 1).getValues().map(r => r[0]);
}

test('표: 줄을 뒤에 붙이기만 하면 그 줄들을, 옛 줄을 고치거나 지우거나 칸을 늘리면 null', () => {
  const 새표 = () => new TableStore([{ name: '기록', cells: { '1:1': { value: '시각', note: '', format: 'General' }, '2:1': { value: 'x', note: '', format: 'General' } } }]).getSheetByName('기록');
  const a = 새표(); a.appendRow(['y', 'z']); a.getRange(3, 2).setNote('틀린 단어');
  assert.deepEqual(a.appendedRows().map(r => Object.keys(r)), [['1', '2']]);
  assert.equal(a.appendedRows()[0][2].note, '틀린 단어');
  const b = 새표(); b.appendRow(['y']); b.getRange(2, 1).setValue('고침'); assert.equal(b.appendedRows(), null);
  const c = 새표(); c.appendRow(['y']); c.deleteRow(2); assert.equal(c.appendedRows(), null);
  const d = 새표(); d.insertColumnsAfter(1, 1); d.appendRow(['y']); assert.equal(d.appendedRows(), null);
  const e = 새표(); e.getRange(5, 1).setValue('사이가 빈 줄'); assert.equal(e.appendedRows(), null);
  const f = 새표(); assert.equal(f.appendedRows(), null, '안 바뀐 표');
});

test('6) 줄을 뒤에 붙이기만 하면 본체·목록을 안 건드리고 조각만 쓴다', async () => {
  const db = await 판차리기(), r = await 학생(db);
  const 전본체 = structuredClone(본체(db)), 전목록 = structuredClone(목록(db));
  assert.deepEqual(await r.call('결과저장', [제출('조각1')]), { ok: true });
  assert.deepEqual(본체(db), 전본체);
  assert.deepEqual(목록(db), 전목록);
  assert.equal(조각들(db).length, 1);
  const 조각 = db.docs.get(조각들(db)[0]);
  assert.deepEqual(Object.keys(조각).sort(), ['actor', 'at', 'name', 'rows']);
  assert.equal(조각.name, '기록');
  assert.equal(unpack(조각.rows)[0][5].value, '조각1');
  assert.match(unpack(조각.rows)[0][14].note, /^틀린 단어 2개/);
  assert.ok(조각들(db)[0].split('/').pop().startsWith(String(조각.at).padStart(15, '0') + '_' + 조각.actor + '_'));
  assert.ok(![...db.docs.keys()].some(k => /\/journal\/[^/]+\/tables\//.test(k)), '조각 쓰기는 표 사본을 journal 에 안 남긴다');
  const 영수증 = [...db.docs.entries()].find(([k]) => /\/journal\/[^/]+$/.test(k))[1];
  assert.equal(영수증.조각, 조각들(db)[0].split('/').pop());
});

test('6-1) 조각에 들어간 기록도 엔진이 본다 — 내 기록 · 「이미 봤습니다」', async () => {
  const db = await 판차리기(), r = await 학생(db);
  assert.equal((await r.call('결과저장', [제출('시험1~10', '시험')])).ok, true);
  const 또 = await r.call('결과저장', [제출('시험1~10', '시험')]);
  assert.equal(또.이미봄, true);
  assert.equal(조각들(db).length, 1);
  const 내것 = await r.call('내기록', ['홍길동']);
  assert.ok(JSON.stringify(내것).includes('시험1~10'));
});

test('7) 줄을 고치거나 지우면 지금처럼 통째로 쓴다 — 선생님이면 합친 조각을 지운다', async () => {
  const db = await 판차리기(), r = await 학생(db);
  await r.call('결과저장', [제출('조각1')]); await 잠깐();
  await r.call('결과저장', [제출('조각2')]);
  assert.equal(조각들(db).length, 2);
  const t = await 선생님(db);
  const 읽음 = JSON.parse((await t.call('__자료읽기', [{ 이름들: ['기록'] }])).자료).표들[0];
  const 줄 = 읽음.줄들[0];
  assert.equal(줄[4], '본체1');
  const 전본체 = 본체(db).version;
  const 답 = await t.call('__자료고치기', [{ 표: '기록', 행: 2, 열: 9, 전줄: 줄, 값: '100' }]);
  assert.equal(답.ok, true, 답.메시지);
  assert.notEqual(본체(db).version, 전본체);
  assert.equal(조각들(db).length, 0, '선생님이 통째로 쓰면 읽은 조각은 본체에 들어가고 지워진다');
  assert.deepEqual(본체(db).합친조각, []);
  assert.deepEqual(await 범위들(db), ['본체1', '본체2', '조각1', '조각2']);
});

test('7-1) 학생이 통째로 쓸 때(조각을 못 지운다)는 「합친조각」 에 적어 두 번 붙지 않게 한다', async () => {
  const db = await 판차리기(), r = await 학생(db);
  await r.call('결과저장', [제출('조각1')]);
  const 조각이름 = 조각들(db)[0].split('/').pop();
  // 학생이 옛 줄을 건드리는 엔진 길은 없으므로, 저장소의 통째 쓰기를 직접 흉내 낸다 — 본체를 조각까지 합쳐 다시 쓰고 이름을 적는다
  const 합친표 = (await r.load(await r.catalog(), ref => import('./helpers/fake-firestore.mjs').then(m => m.getDoc(ref)))).getSheetByName('기록').export();
  const 원 = 본체(db);
  db.docs.set(`vocabDatasets/${판}/tables/${sheetId('기록')}`, { ...원, payload: JSON.stringify(합친표), 합친조각: [조각이름] });
  assert.deepEqual(await 범위들(db), ['본체1', '본체2', '조각1']);
  await 잠깐(); await r.call('결과저장', [제출('조각2')]);
  assert.deepEqual(await 범위들(db), ['본체1', '본체2', '조각1', '조각2']);
});

test('8) 본체 + 조각을 합쳐 읽으면 차례가 맞다 — 여러 학생이 번갈아 내도', async () => {
  const db = await 판차리기(), 갑 = await 학생(db), 을 = await 학생(db, '김영희', '0011');
  for (const [누구, 범위] of [[갑, 'ㄱ'], [을, 'ㄴ'], [갑, 'ㄷ'], [을, 'ㄹ']]) { await 누구.call('결과저장', [{ ...제출(범위), 이름: 누구 === 갑 ? '홍길동' : '김영희' }]); await 잠깐(); }
  assert.equal(조각들(db).length, 4);
  assert.deepEqual(await 범위들(db), ['본체1', '본체2', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ']);
});

test('8-1) 동시에 낸 스무 명이 서로 안 부딪힌다 — 다 들어가고 본체는 그대로', async () => {
  const db = await 판차리기(), r = await 학생(db);
  const 전본체 = 본체(db).version;
  const 답들 = await Promise.all(Array.from({ length: 20 }, (_, i) => r.call('결과저장', [제출('동시' + i)])));
  assert.ok(답들.every(d => d.ok));
  assert.equal(조각들(db).length, 20);
  assert.equal(본체(db).version, 전본체);
  assert.equal((await 범위들(db)).length, 22);
});

test('9) 조각이 50개 쌓이면 선생님이 들어올 때 합쳐진다 — 합친 뒤 줄 수 · 차례가 그대로', async () => {
  const db = await 판차리기(), r = await 학생(db);
  for (let i = 0; i < 50; i++) { await r.call('결과저장', [제출('n' + String(i).padStart(2, '0'))]); await 잠깐(); }
  assert.equal(조각들(db).length, 50);
  const 전 = [];
  { const 학 = await 학생(db); const s = await 학.load(await 학.catalog(), ref => import('./helpers/fake-firestore.mjs').then(m => m.getDoc(ref))); const sh = s.getSheetByName('기록'); 전.push(...sh.getRange(2, 5, sh.getLastRow() - 1, 1).getValues().map(x => x[0])); }
  assert.equal(전.length, 52);
  await 선생님(db);                                   // 들어오면서 합친다
  assert.equal(조각들(db).length, 0);
  assert.deepEqual(본체(db).합친조각, []);
  const 본체줄 = Object.keys(unpack(본체(db).payload).cells).filter(k => k.endsWith(':5') && k !== '1:5').length;
  assert.equal(본체줄, 52);
  assert.deepEqual(await 범위들(db), 전);
  await r.call('결과저장', [제출('합친뒤')]);
  assert.equal(조각들(db).length, 1);
  assert.deepEqual((await 범위들(db)).slice(-2), ['n49', '합친뒤']);
});

test('9-1) 49개면 아직 안 합친다 · 학생은 합치기를 부를 수 없다', async () => {
  const db = await 판차리기(), r = await 학생(db);
  for (let i = 0; i < 49; i++) { await r.call('결과저장', [제출('m' + i)]); }
  await 선생님(db);
  assert.equal(조각들(db).length, 49);
  assert.equal((await r.call('__조각합치기', [])).ok, false);
  assert.equal(조각들(db).length, 49);
});

test('9-2) 같은 번호로 다시 보내도 조각은 하나 — 영수증', async () => {
  const db = await 판차리기(), r = await 학생(db);
  db.답잃음 = 1;
  await assert.rejects(r.call('결과저장', [제출('한번')], { 요청번호: 'piece-retry-0001' }), e => e.다시보내도됨 === true);
  assert.deepEqual(await r.call('결과저장', [제출('한번')], { 요청번호: 'piece-retry-0001', 다시보냄: true }), { ok: true });
  assert.equal(조각들(db).length, 1);
});
