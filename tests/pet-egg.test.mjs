// 알 키우기 (1) — 숙제를 내면 엔진(Code.gs 결과저장)이 알을 한 칸 올리고, 다섯이면 깨어난다.
// 화면은 받아서 보여 주기만 한다. 펫 표: 이름 · 알종류 · 펫종류 · 숙제수 · 호감도 · 먹이 · 부화한날 · 도감
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { sheetId, unpack } from '../services/store-codec.mjs';

const 흉내 = new URL('./helpers/fake-firestore.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { return s === 'firebase/firestore' ? { url: ${JSON.stringify(흉내)}, shortCircuit: true } : n(s, c); }`));
const { FirestoreRepository, digest } = await import('../services/firestore-repository.mjs');
const { fakeDb } = await import('./helpers/fake-firestore.mjs');

const 지금 = Date.parse('2026-11-10T03:00:00Z');
const 머리기록 = ['시각','반','이름','단어장','범위','유형','문항수','정답수','점수','게임점수','최고콤보','소요초','숙제여부','틀린단어','구분','집계제외'];
const 펫머리 = ['이름', '알종류', '펫종류', '숙제수', '호감도', '먹이', '부화한날', '도감'];

function 판(펫줄 = null) {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', '5678']);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);
  학생.appendRow(['', '홍길동', '1234', '', '', '', '', '', '', '', '']);
  학생.appendRow(['', '김영희', '1234', '', '', '', '', '', '', '', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  store.insertSheet('숙제').appendRow(['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류']);
  store.insertSheet('기록').appendRow(머리기록);
  if (펫줄) { const 펫 = store.insertSheet('펫'); 펫.appendRow(펫머리); for (const r of 펫줄) 펫.appendRow(r); }
  return store;
}
const 부르기 = (store, fn, args) => createRuntime(store, { now: () => 지금 }).call(fn, args);
let 번 = 0;
const 숙제 = (store, 이름 = '홍길동', 더 = {}) => 부르기(store, '결과저장', [{ 이름, 단어장: '교재A', 범위: String(++번), 유형: '스펠링',
  문항수: 10, 정답수: 3, 점수: 30, 숙제여부: true, 구분: '', ...더 }]);
const 연습 = (store, 이름 = '홍길동') => 부르기(store, '결과저장', [{ 이름, 단어장: '교재A', 범위: '1~10', 유형: '스펠링',
  문항수: 10, 정답수: 10, 점수: 100, 숙제여부: false, 구분: '' }]);
/* 펫 표에서 이 아이 줄 — {이름, 알종류, …} */
function 줄(store, 이름 = '홍길동') {
  const sh = store.getSheetByName('펫');
  if (!sh) return null;
  const 값 = sh.getRange(1, 1, sh.getLastRow(), 8).getValues();
  const r = 값.slice(1).find(x => x[0] === 이름);
  return r ? Object.fromEntries(펫머리.map((h, i) => [h, r[i]])) : null;
}

test('1. 숙제를 내면 숙제수가 1 는다', () => {
  const store = 판([['홍길동', 'eg2', '', 2, 0, 0, '', '']]);
  const r = 숙제(store);
  assert.equal(r.ok, true);
  assert.equal(줄(store).숙제수, 3);
  assert.equal(줄(store).알종류, 'eg2', '알종류는 중간에 안 바뀐다');
});

test('1-1. 점수는 안 본다 — 0점이든 100점이든 한 칸', () => {
  const store = 판([['홍길동', 'eg1', '', 0, 0, 0, '', '']]);
  숙제(store, '홍길동', { 점수: 0, 정답수: 0 });
  숙제(store, '홍길동', { 점수: 100, 정답수: 10 });
  assert.equal(줄(store).숙제수, 2);
});

test('2. 연습(숙제여부 거짓)은 안 는다', () => {
  const store = 판([['홍길동', 'eg2', '', 2, 0, 0, '', '']]);
  const r = 연습(store);
  assert.deepEqual(r, { ok: true });
  assert.equal(줄(store).숙제수, 2);
  /* 펫 표가 없을 때 연습하면 표를 만들지도 않는다 */
  const 빈 = 판();
  연습(빈);
  assert.equal(빈.getSheetByName('펫'), null);
});

test('3. 펫 줄이 없는 아이가 숙제를 내면 줄이 생기고 알종류가 eg1~eg5 중 하나', () => {
  const store = 판();
  const r = 숙제(store);
  assert.deepEqual(store.getSheetByName('펫').getRange(1, 1, 1, 8).getValues()[0], 펫머리, '표 칸은 이번에 다 만든다');
  const 내 = 줄(store);
  assert.match(내.알종류, /^eg[1-5]$/);
  assert.equal(내.숙제수, 1);
  assert.equal(내.펫종류, '');
  assert.equal(내.부화한날, '');
  assert.equal(내.호감도, 0); assert.equal(내.먹이, 0); assert.equal(내.도감, '');
  assert.equal(r.펫.알종류, 내.알종류);
  assert.equal(r.펫.숙제수, 1);
  /* 다른 아이 줄은 따로 */
  숙제(store, '김영희');
  assert.equal(줄(store, '김영희').숙제수, 1);
  assert.equal(줄(store).숙제수, 1);
});

test('4. 숙제수가 5가 되면 부화한날이 찍히고 펫종류가 pet1~pet10 중 하나', () => {
  const store = 판([['홍길동', 'eg3', '', 4, 0, 0, '', '']]);
  const r = 숙제(store);
  const 내 = 줄(store);
  assert.equal(내.숙제수, 5);
  assert.ok(내.부화한날 instanceof Date, '부화한날이 찍힌다');
  assert.match(내.펫종류, /^pet([1-9]|10)$/);
  assert.equal(r.펫.부화, true);
  assert.equal(r.펫.펫종류, 내.펫종류);
  assert.equal(r.펫.부화한날, '2026-11-10');
  assert.equal(r.펫.알종류, 'eg3');
});

test('4-1. 처음부터 다섯 번 내면 깨어난다', () => {
  const store = 판();
  const 답 = [1, 2, 3, 4, 5].map(() => 숙제(store));
  assert.deepEqual(답.map(r => r.펫.숙제수), [1, 2, 3, 4, 5]);
  assert.deepEqual(답.map(r => r.부화했나), [false, false, false, false, true]);
  assert.equal(줄(store).부화한날 instanceof Date, true);
});

test('5. 부화한 뒤에 숙제를 또 내도 숙제수가 안 는다', () => {
  const store = 판([['홍길동', 'eg1', 'pet4', 5, 0, 0, new Date(지금 - 86400000), '']]);
  const r = 숙제(store);
  assert.equal(줄(store).숙제수, 5);
  assert.equal(줄(store).펫종류, 'pet4', '펫종류도 그대로');
  assert.equal(r.자랐나, false);
  assert.equal(r.부화했나, false);
  assert.equal(r.펫.펫종류, 'pet4');
});

test('6. 결과저장이 자랐나 · 부화했나를 제대로 돌려준다', () => {
  const store = 판([['홍길동', 'eg1', '', 3, 0, 0, '', '']]);
  const a = 숙제(store);
  assert.equal(a.ok, true); assert.equal(a.자랐나, true); assert.equal(a.부화했나, false);
  assert.equal(a.펫.숙제수, 4); assert.equal(a.펫.부화, false); assert.equal(a.펫.펫종류, '');
  const b = 숙제(store);
  assert.equal(b.자랐나, true); assert.equal(b.부화했나, true);
  const c = 숙제(store);
  assert.equal(c.자랐나, false); assert.equal(c.부화했나, false);
  /* 연습은 펫을 싣지 않는다 */
  assert.equal(연습(store).펫, undefined);
});

test('6-1. 시험을 두 번 내면 두 번째는 받지 않고 알도 안 자란다 (이미본시험_)', () => {
  const store = 판([['홍길동', 'eg1', '', 0, 0, 0, '', '']]);
  const 시험 = { 구분: '시험', 범위: '1~25' };
  assert.equal(부르기(store, '결과저장', [{ 이름: '홍길동', 단어장: '교재A', 유형: '스펠링', 점수: 90, 숙제여부: true, ...시험 }]).자랐나, true);
  const 두번 = 부르기(store, '결과저장', [{ 이름: '홍길동', 단어장: '교재A', 유형: '스펠링', 점수: 90, 숙제여부: true, ...시험 }]);
  assert.equal(두번.ok, false); assert.equal(두번.이미봄, true);
  assert.equal(줄(store).숙제수, 1);
});

test('6-2. 명단에 없는 이름으로는 줄을 만들지 않는다', () => {
  const store = 판();
  const r = 숙제(store, '아무개');
  assert.deepEqual(r, { ok: true });
  assert.equal(store.getSheetByName('펫'), null);
});

test('7. 로그인이 펫 상태를 같이 돌려준다', () => {
  const 알 = 부르기(판([['홍길동', 'eg5', '', 4, 0, 0, '', '']]), '로그인', ['홍길동', '1234']);
  assert.equal(알.ok, true);
  assert.deepEqual(알.펫, { 알종류: 'eg5', 펫종류: '', 숙제수: 4, 부화: false, 부화한날: '', 다섯: 5 });
  const 깬 = 부르기(판([['홍길동', 'eg5', 'pet7', 5, 0, 0, new Date(지금), '']]), '로그인', ['홍길동', '1234']);
  assert.deepEqual(깬.펫, { 알종류: 'eg5', 펫종류: 'pet7', 숙제수: 5, 부화: true, 부화한날: '2026-11-10', 다섯: 5 });
  /* 아직 알을 못 받은 아이 — 표가 없어도 로그인은 되고, 표를 만들지 않는다 */
  const 빈판 = 판();
  const 없음 = 부르기(빈판, '로그인', ['홍길동', '1234']);
  assert.equal(없음.ok, true);
  assert.deepEqual(없음.펫, { 알종류: '', 펫종류: '', 숙제수: 0, 부화: false, 부화한날: '', 다섯: 5 });
  assert.equal(빈판.getSheetByName('펫'), null);
});

test('8. 알 다섯 가지 · 펫 열 가지가 골고루 나온다', () => {
  const store = 판();
  const 학생 = store.getSheetByName('학생');
  const 이름들 = Array.from({ length: 400 }, (_, i) => '아이' + i);
  for (const n of 이름들) 학생.appendRow(['', n, '1234', '', '', '', '', '', '', '', '']);
  const 펫 = store.insertSheet('펫'); 펫.appendRow(펫머리);
  for (const n of 이름들) 펫.appendRow([n, '', '', 4, 0, 0, '', '']);   /* 알종류가 빈 옛 줄 — 엔진이 채운다 */
  const 알 = {}, 펫수 = {};
  for (const n of 이름들) {
    const r = 숙제(store, n);
    알[r.펫.알종류] = (알[r.펫.알종류] || 0) + 1;
    펫수[r.펫.펫종류] = (펫수[r.펫.펫종류] || 0) + 1;
  }
  assert.deepEqual(Object.keys(알).sort(), ['eg1', 'eg2', 'eg3', 'eg4', 'eg5']);
  assert.deepEqual(Object.keys(펫수).sort(), ['pet1', 'pet10', 'pet2', 'pet3', 'pet4', 'pet5', 'pet6', 'pet7', 'pet8', 'pet9']);
  /* 400 번 — 한 가지가 평균(40)의 두 배를 넘거나 절반 아래로 떨어지면 쏠린 것 */
  for (const [k, v] of Object.entries(펫수)) assert.ok(v >= 15 && v <= 80, `${k} 가 ${v} 번`);
  for (const [k, v] of Object.entries(알)) assert.ok(v >= 40 && v <= 140, `${k} 가 ${v} 번`);
});

test('9. 아이가 보낸 값으로 숙제수 · 부화한날 · 종류를 바꿀 수 없다', () => {
  const store = 판([['홍길동', 'eg2', '', 1, 0, 0, '', '']]);
  const r = 숙제(store, '홍길동', { 숙제수: 5, 부화한날: '2026-01-01', 펫종류: 'pet1', 알종류: 'eg5', 부화: true, 펫: { 숙제수: 5 } });
  const 내 = 줄(store);
  assert.equal(내.숙제수, 2);
  assert.equal(내.부화한날, '');
  assert.equal(내.펫종류, '');
  assert.equal(내.알종류, 'eg2');
  assert.equal(r.부화했나, false);
  /* 펫을 바로 고치는 엔진 길은 아이에게 열려 있지 않다 */
  for (const fn of ['펫자라기_', '펫시트_', '펫저장', '펫고치기']) {
    assert.throws(() => 부르기(store, fn, ['홍길동']));
  }
  assert.equal(줄(store).숙제수, 2);
});

test('10. 화면은 알을 올리지 않는다 — 결과저장 답을 받아 그리기만, localStorage 에 두지 않는다', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const 펫코드 = html.slice(html.indexOf('/* ==== 알 키우기 화면'), html.indexOf('/* ==== 알 키우기 화면 끝 ==== */'));
  assert.ok(펫코드.length > 200, '알 키우기 화면 묶음을 못 찾았다');
  assert.doesNotMatch(펫코드, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(펫코드, /api\(/, '알 칸은 따로 서버를 부르지 않는다 — 로그인 · 결과저장 답만 쓴다');
  /* eggBox 는 숙제 바로 아래, 남은 숙제 위 */
  const 홈 = html.slice(html.indexOf('<div id="hwBox"></div>'), html.indexOf('<div id="leftBox"></div>'));
  assert.match(홈, /^<div id="hwBox"><\/div>\s*<div id="eggBox"><\/div>\s*$/);
});

test('11. 앱 번들에 pet/ 이 통째로 들어가고 버전 해시에도 들어간다', () => {
  const src = readFileSync(new URL('../scripts/build-app.mjs', import.meta.url), 'utf8');
  assert.match(src, /DIRS\s*=\s*\[[^\]]*'pet'/);
  assert.match(src, /cpSync\([^)]*recursive:\s*true/);
  for (const n of [1, 2, 3, 4, 5]) assert.ok(readFileSync(new URL(`../pet/eg${n}.webp`, import.meta.url)).length > 0);
  for (let n = 1; n <= 10; n++) assert.ok(readFileSync(new URL(`../pet/pet${n}.webp`, import.meta.url)).length > 0);
});

/* ---- 파이어스토어 길 — 아이 화면이 실제로 부르는 길 ---- */
async function 저장소판(펫줄 = null) {
  const db = fakeDb();
  const store = 판(펫줄);
  const built = await createDatasetDocuments(store, { digest });
  for (const [path, data] of built.documents) db.docs.set(`vocabDatasets/t/${path}`, structuredClone(data));
  db.docs.set('runtime/config', { dataset: 't', state: 'active' });
  return db;
}
const 학생저장소 = db => new FirestoreRepository(db, 't', { user: { uid: 'kid1', getIdToken: async () => 'x' } });
const 펫표 = db => { const d = db.docs.get(`vocabDatasets/t/tables/${sheetId('펫')}`); return d ? unpack(d.payload) : null; };

test('12. 파이어스토어 — 로그인하면 펫 상태가 같이 오고, 숙제를 내면 기록은 조각으로 · 펫 표는 본체로 저장된다', async () => {
  const db = await 저장소판([['홍길동', 'eg4', '', 3, 0, 0, '', '']]);
  const repo = 학생저장소(db);
  const 들어감 = await repo.call('로그인', ['홍길동', '1234']);
  assert.equal(들어감.ok, true);
  assert.equal(들어감.펫.알종류, 'eg4');
  assert.equal(들어감.펫.숙제수, 3);
  const 기록본체전 = db.docs.get(`vocabDatasets/t/tables/${sheetId('기록')}`).payload;
  const r = await repo.call('결과저장', [{ 이름: '홍길동', 단어장: '교재A', 범위: '1~10', 유형: '스펠링', 점수: 50, 숙제여부: true, 구분: '' }]);
  assert.equal(r.ok, true); assert.equal(r.자랐나, true); assert.equal(r.펫.숙제수, 4);
  assert.equal(db.docs.get(`vocabDatasets/t/tables/${sheetId('기록')}`).payload, 기록본체전, '기록 본체는 다시 쓰지 않는다 — 반 전체가 내도 안 다툰다');
  const 조각 = [...db.docs.keys()].filter(k => k.startsWith(`vocabDatasets/t/tables/${sheetId('기록')}/appends/`));
  assert.equal(조각.length, 1);
  const 펫 = 펫표(db);
  assert.equal(Object.values(펫.cells).find(c => c.value === 4)?.value, 4);
  /* 다시 들어오면 늘어난 숙제수가 보인다 */
  const 또 = await 학생저장소(db).call('로그인', ['홍길동', '1234']);
  assert.equal(또.펫.숙제수, 4);
  /* 연습은 펫 표를 안 건드리고 조각만 */
  const 버전 = db.docs.get(`vocabDatasets/t/tables/${sheetId('펫')}`).version;
  await repo.call('결과저장', [{ 이름: '홍길동', 단어장: '교재A', 범위: '1~10', 유형: '스펠링', 점수: 50, 숙제여부: false, 구분: '' }]);
  assert.equal(db.docs.get(`vocabDatasets/t/tables/${sheetId('펫')}`).version, 버전);
});

test('13. 파이어스토어 — 펫 표가 아직 없는 자료에서 첫 숙제를 내면 표가 생긴다', async () => {
  const db = await 저장소판();
  const repo = 학생저장소(db);
  assert.deepEqual((await repo.call('로그인', ['홍길동', '1234'])).펫.숙제수, 0);
  const r = await repo.call('결과저장', [{ 이름: '홍길동', 단어장: '교재A', 범위: '1~10', 유형: '스펠링', 점수: 50, 숙제여부: true, 구분: '' }]);
  assert.equal(r.펫.숙제수, 1);
  assert.ok(펫표(db), '펫 표가 생겼다');
  assert.ok(db.docs.get('vocabDatasets/t/meta/catalog').tables.some(t => t.name === '펫'));
});

test('14. 파이어스토어 — 펫 표에 못 쓰면(규칙이 아직 안 올라감) 기록만 남기고 숙제 제출은 된다', async () => {
  const db = await 저장소판([['홍길동', 'eg1', '', 1, 0, 0, '', '']]);
  const repo = 학생저장소(db);
  await repo.call('로그인', ['홍길동', '1234']);
  db.거절 = path => path.endsWith(`tables/${sheetId('펫')}`);
  const r = await repo.call('결과저장', [{ 이름: '홍길동', 단어장: '교재A', 범위: '1~10', 유형: '스펠링', 점수: 50, 숙제여부: true, 구분: '' }]);
  assert.deepEqual(r, { ok: true });
  const 조각 = [...db.docs.keys()].filter(k => k.startsWith(`vocabDatasets/t/tables/${sheetId('기록')}/appends/`));
  assert.equal(조각.length, 1, '기록은 남았다');
});

test('14-1. 파이어스토어 — 펫과 같이 쓰다 밀리면 「다시 보내도 됨」, 같은 번호로 다시 보내도 알은 한 칸만', async () => {
  const db = await 저장소판([['홍길동', 'eg1', '', 1, 0, 0, '', '']]);
  const repo = 학생저장소(db);
  await repo.call('로그인', ['홍길동', '1234']);
  const 제출 = { 이름: '홍길동', 단어장: '교재A', 범위: '1~10', 유형: '스펠링', 점수: 50, 숙제여부: true, 구분: '' };
  db.밀림 = 1;
  await assert.rejects(repo.call('결과저장', [제출], { 요청번호: 'pet-retry-0001' }), e => e.다시보내도됨 === true);
  db.답잃음 = 1;
  await assert.rejects(repo.call('결과저장', [제출], { 요청번호: 'pet-retry-0001', 다시보냄: true }), e => e.다시보내도됨 === true);
  const 다시 = await repo.call('결과저장', [제출], { 요청번호: 'pet-retry-0001', 다시보냄: true });
  assert.equal(다시.펫.숙제수, 2, '써 놓고 답만 잃은 것 — 영수증의 답');
  assert.equal((await 학생저장소(db).call('로그인', ['홍길동', '1234'])).펫.숙제수, 2, '두 번 세지 않았다');
  const 조각 = [...db.docs.keys()].filter(k => k.startsWith(`vocabDatasets/t/tables/${sheetId('기록')}/appends/`));
  assert.equal(조각.length, 1);
});

test('14-2. 파이어스토어 — 두 아이가 차례로 내면 각자 줄이 따로 자란다 (기록 본체는 그대로)', async () => {
  const db = await 저장소판();
  const 홍 = 학생저장소(db), 김 = new FirestoreRepository(db, 't', { user: { uid: 'kid2', getIdToken: async () => 'x' } });
  await 홍.call('로그인', ['홍길동', '1234']); await 김.call('로그인', ['김영희', '1234']);
  const 기록본체전 = db.docs.get(`vocabDatasets/t/tables/${sheetId('기록')}`).payload;
  const 낸다 = (r, 이름, i) => r.call('결과저장', [{ 이름, 단어장: '교재A', 범위: String(i), 유형: '스펠링', 점수: 50, 숙제여부: true, 구분: '' }]);
  for (let i = 0; i < 3; i++) { await 낸다(홍, '홍길동', i); await 낸다(김, '김영희', i); }
  await 낸다(홍, '홍길동', 9);
  assert.equal((await 학생저장소(db).call('로그인', ['홍길동', '1234'])).펫.숙제수, 4);
  assert.equal((await 학생저장소(db).call('로그인', ['김영희', '1234'])).펫.숙제수, 3);
  assert.equal(db.docs.get(`vocabDatasets/t/tables/${sheetId('기록')}`).payload, 기록본체전);
  assert.equal([...db.docs.keys()].filter(k => k.includes(`/tables/${sheetId('기록')}/appends/`)).length, 7);
});

test('15. 규칙 — 학생은 펫 표를 만들고 고칠 수 있지만 공개로 바꾸거나 지울 수 없다', () => {
  const rules = readFileSync(new URL('../firebase/firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /credential\(\)\.role == 'student' && request\.resource\.data\.name == '펫' && request\.resource\.data\.public == false/);
});
