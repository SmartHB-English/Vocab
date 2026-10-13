// 반 전체가 동시에 내면 기록 표 한 장을 두고 쓰기 거래가 밀린다 — 밀린 쓰기는 같은 요청번호로 다시 보낸다.
// 화면 쪽 재시도(services/api-client.js)를 진짜 저장소(FirestoreRepository) + 흉내 Firestore 위에서 돌린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { TableStore } from '../services/table-store.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { sheetId, unpack } from '../services/store-codec.mjs';
import { fakeDb } from './helpers/fake-firestore.mjs';

const 흉내 = new URL('./helpers/fake-firestore.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { return s === 'firebase/firestore' ? { url: ${JSON.stringify(흉내)}, shortCircuit: true } : n(s, c); }`));
const { FirestoreRepository, digest } = await import('../services/firestore-repository.mjs');

const 판 = 't';
const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'];
async function 판차리기() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', '5678']);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);
  학생.appendRow(['월수금', '홍길동', '1234', '', '', '중2', '', '', '', '', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  store.insertSheet('기록').appendRow(머리기록);
  store.insertSheet('기록보관').appendRow(머리기록);
  const db = fakeDb();
  const { documents } = await createDatasetDocuments(store, { digest });
  for (const [path, data] of documents) db.docs.set(`vocabDatasets/${판}/${path}`, data);
  return db;
}
let 번호 = 0;
async function 학생(db) {
  const r = new FirestoreRepository(db, 판, { user: { uid: 'uid-' + (++번호) + '-abcdef', getIdToken: async () => '' } });
  assert.equal((await r.call('로그인', ['홍길동', '1234'])).ok, true);
  return r;
}
/* 진짜 api-client 를 vm 에 올리고, 번들 대신 저장소를 바로 붙인다. 기다림은 재지 않고 적어만 둔다 */
function 화면(저장소) {
  const 기다림 = [], 부름 = [];
  const context = {
    importScripts() { context.VocabFirestore = { call: (fn, args, o) => { 부름.push({ fn, ...o }); return 저장소.call(fn, args, o); } }; },
    setTimeout(f, ms) { 기다림.push(ms); f(); },
    fetch() { throw Error('예전 HTTP 창구로 가면 안 된다'); },
  };
  context.self = context; vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../services/api-client.js', import.meta.url), 'utf8'), context);
  return { api: context.VocabApi, 기다림, 부름, 보내기: (fn, ...args) => context.VocabApi.request('firestore:v1', fn, args) };
}
const 제출 = (구분 = '숙제') => ({ 이름: '홍길동', 단어장: '교재A', 범위: '1~10', 유형: '스펠링', 문항수: 10, 정답수: 9, 점수: 90, 숙제여부: true, 구분, 틀린단어: '' });
const 기록줄수 = db => Object.keys(unpack(db.docs.get(`vocabDatasets/${판}/tables/${sheetId('기록')}`).payload).cells)
  .filter(k => k.endsWith(':3') && k !== '1:3').length;
const 영수증들 = db => [...db.docs.keys()].filter(k => /\/journal\/[^/]+$/.test(k));

test('1) 쓰기가 밀려 실패하면 같은 requestId 로 다시 보낸다', async () => {
  const db = await 판차리기(), 화 = 화면(await 학생(db));
  db.밀림 = 2;
  const 답 = await 화.보내기('결과저장', 제출());
  assert.equal(답.ok, true);
  assert.equal(화.부름.length, 3);
  assert.equal(new Set(화.부름.map(b => b.요청번호)).size, 1, '세 번 모두 같은 요청번호');
  assert.deepEqual(화.부름.map(b => b.다시보냄), [false, true, true]);
  assert.equal(기록줄수(db), 1);
  assert.equal(영수증들(db).length, 1);
  assert.ok(영수증들(db)[0].endsWith('_' + 화.부름[0].요청번호), 'journal 문서 이름이 그 요청번호');
});

test('2) 세 번까지만 다시 보내고 그만둔다 — 0.5 → 1.5 → 3초, ±30%', async () => {
  const db = await 판차리기(), 화 = 화면(await 학생(db));
  db.밀림 = 99;
  await assert.rejects(화.보내기('결과저장', 제출()), e => e.code === 'aborted' && e.다시보내도됨 === true);
  assert.equal(화.부름.length, 4);
  assert.equal(화.기다림.length, 3);
  [500, 1500, 3000].forEach((기준, i) => assert.ok(화.기다림[i] >= 기준 * 0.7 - 1 && 화.기다림[i] <= 기준 * 1.3 + 1, `${i + 1}번째 기다림 ${화.기다림[i]}`));
  assert.equal(기록줄수(db), 0);
});

test('2-1) 기다림에 임의가 섞인다 — 여럿이 같이 밀려도 같은 때에 다시 몰리지 않는다', async () => {
  const 첫기다림 = new Set();
  for (let i = 0; i < 8; i++) {
    const db = await 판차리기(), 화 = 화면(await 학생(db));
    db.밀림 = 1; await 화.보내기('결과저장', 제출()); 첫기다림.add(화.기다림[0]);
  }
  assert.ok(첫기다림.size > 1, [...첫기다림].join(','));
});

test('3) 「비밀번호가 달라요」 · 「이미 봤습니다」 같은 거절은 다시 안 보낸다', async () => {
  const db = await 판차리기();
  const 화 = 화면(new FirestoreRepository(db, 판, { user: { uid: 'uid-x-abcdef', getIdToken: async () => '' } }));
  const 틀림 = await 화.보내기('로그인', '홍길동', '9999');
  assert.equal(틀림.ok, false); assert.match(틀림.메시지, /비밀번호/);
  assert.equal(화.부름.length, 1);

  const 화2 = 화면(await 학생(db));
  assert.equal((await 화2.보내기('결과저장', 제출('시험'))).ok, true);
  db.밀림 = 0;
  const 또 = await 화2.보내기('결과저장', 제출('시험'));
  assert.equal(또.ok, false); assert.equal(또.이미봄, true);
  assert.equal(화2.부름.length, 2);
  assert.equal(화2.기다림.length, 0);
});

test('3-1) 권한 거절(permission-denied)처럼 표시 없는 오류는 다시 안 보낸다', async () => {
  let n = 0;
  const 화 = 화면({ call: async () => { n++; throw Object.assign(new Error('permission-denied'), { code: 'permission-denied' }); } });
  await assert.rejects(화.보내기('결과저장', 제출()), /permission-denied/);
  assert.equal(n, 1);
});

test('4) 읽기에는 재시도가 안 걸린다 — 읽다 끊겨도 한 번으로 끝', async () => {
  const db = await 판차리기(), 화 = 화면(await 학생(db));
  db.읽기끊김 = true;
  await assert.rejects(화.보내기('내기록', '홍길동'), e => e.code === 'unavailable' && !e.다시보내도됨);
  assert.equal(화.부름.length, 1);
  assert.equal(db.거래, 0);
});

test('5) 영수증이 있으면 두 번 저장되지 않는다 — 써 놓고 답만 잃은 뒤 같은 번호로 다시', async () => {
  const db = await 판차리기(), 화 = 화면(await 학생(db));
  db.답잃음 = 1;
  const 답 = await 화.보내기('결과저장', 제출('시험'));
  assert.equal(답.ok, true, '먼저 것의 답을 영수증에서 돌려준다 — 「이미 봤습니다」 가 아니다');
  assert.equal(화.부름.length, 2);
  assert.equal(기록줄수(db), 1);
  assert.equal(영수증들(db).length, 1);
});

test('5-1) 같은 번호로 두 번 보내면(다시 보내기 단추) 한 번만 저장된다', async () => {
  const db = await 판차리기(), r = await 학생(db);
  const 첫 = await r.call('결과저장', [제출()], { 요청번호: 'same-number-0001' });
  const 둘 = await r.call('결과저장', [제출()], { 요청번호: 'same-number-0001', 다시보냄: true });
  assert.deepEqual(둘, 첫);
  assert.equal(기록줄수(db), 1);
  const 셋 = await r.call('결과저장', [제출()], { 요청번호: 'other-number-0002' });
  assert.equal(셋.ok, true);
  assert.equal(기록줄수(db), 2);
});

test('5-2) 이상한 요청번호는 쓰지 않고 새로 만든다 — journal 경로를 건드리지 못하게', async () => {
  const db = await 판차리기(), r = await 학생(db);
  await r.call('결과저장', [제출()], { 요청번호: '../../tables/x' });
  assert.equal(영수증들(db).length, 1);
  assert.ok(!영수증들(db)[0].includes('tables'));
});

test('예전 HTTP 창구는 다시 보내지 않는다', async () => {
  let n = 0;
  const context = { fetch: async () => { n++; throw Object.assign(new Error('offline'), { 다시보내도됨: true }); }, setTimeout: f => f() };
  context.self = context; vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../services/api-client.js', import.meta.url), 'utf8'), context);
  await assert.rejects(context.VocabApi.request('https://example.invalid', '결과저장', []), /offline/);
  assert.equal(n, 1);
});

/* 화면 — index.html 의 결과보내기_ 를 떼어 돌린다 */
function 결과보내기(답들) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const from = html.indexOf('function 결과보내기_(');
  const to = html.indexOf('\n}\r\n', from);
  assert.ok(from > 0 && to > from);
  const 상자 = { textContent: '', innerHTML: '', 단추: null, querySelector() { return this.단추 ??= {}; } };
  Object.defineProperty(상자, 'html', { get() { return this.innerHTML; } });
  const 기다림 = [], 부름 = [], 받은것 = [];
  const ctx = {
    $: () => 상자, VocabApi: { newRequestNumber: () => 'num-' + 부름.length + '-abcdefgh' },
    api같은번호: (번호, fn, 자료) => { 부름.push({ 번호, fn, 자료 }); const 답 = 답들.shift(); return 답 instanceof Error ? Promise.reject(답) : Promise.resolve(답); },
    setTimeout: (f, ms) => { 기다림.push(ms); f(); },
    Math,
  };
  vm.createContext(ctx); vm.runInContext(html.slice(from, to + 2), ctx);
  const 쉬기 = () => new Promise(r => setImmediate(r));
  return { 보내기: 자료 => ctx.결과보내기_('rSaved', 자료, r => 받은것.push(r)), 상자, 기다림, 부름, 받은것, 쉬기 };
}

test('화면: 채점 화면과 따로, 보내는 것만 0~1.5초 사이 임의로 늦춘다', async () => {
  const 늦춤 = new Set();
  for (let i = 0; i < 12; i++) {
    const 화 = 결과보내기([{ ok: true }]); 화.보내기({ 점수: 90 }); await 화.쉬기();
    assert.ok(화.기다림[0] >= 0 && 화.기다림[0] <= 1500, String(화.기다림[0]));
    assert.equal(화.부름[0].fn, '결과저장');
    assert.equal(화.받은것.length, 1);
    늦춤.add(화.기다림[0]);
  }
  assert.ok(늦춤.size > 1);
});

test('화면: 끝내 못 보내면 「저장되지 않았어요 — 선생님께 말씀드리세요」 와 다시 보내기 단추 — 같은 번호로 다시 보낸다', async () => {
  const 화 = 결과보내기([new Error('aborted'), { ok: true }]);
  화.보내기({ 점수: 90 }); await 화.쉬기();
  assert.match(화.상자.html, /저장되지 않았어요 — 선생님께 말씀드리세요/);
  assert.match(화.상자.html, /다시 보내기/);
  assert.equal(화.받은것.length, 0);
  화.상자.단추.onclick(); await 화.쉬기();
  assert.equal(화.부름.length, 2);
  assert.equal(화.부름[1].번호, 화.부름[0].번호);
  assert.deepEqual(화.부름[1].자료, 화.부름[0].자료);
  assert.equal(화.기다림[1], 0, '단추로 다시 보낼 때는 안 늦춘다');
  assert.equal(화.받은것.length, 1);
});

test('화면: {ok:false} 답(잠시 후 다시)도 조용히 넘기지 않는다 · 「이미 봤습니다」 는 받은 쪽이 알린다', async () => {
  const 화 = 결과보내기([{ ok: false, 메시지: '잠시 후 다시 시도해 주세요.' }]);
  화.보내기({}); await 화.쉬기();
  assert.match(화.상자.html, /저장되지 않았어요/);
  const 화2 = 결과보내기([{ ok: false, 이미봄: true }]);
  화2.보내기({}); await 화2.쉬기();
  assert.equal(화2.받은것[0].이미봄, true);
});

test('index.html: 결과저장을 바로 부르는 자리가 남아 있지 않다 — 세 자리 모두 결과보내기_ 로', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/api\('결과저장'/g) || []).length, 0);
  assert.equal((html.match(/결과보내기_\('(rSaved|kSaved)'/g) || []).length, 3);
});
