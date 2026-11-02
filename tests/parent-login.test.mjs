// 학부모가 아이 이름 + 아이 비밀번호로 학부모 화면에 들어간다. 토큰 링크 길은 그대로 같이 있다.
// · 학부모로그인 은 토큰만 준다 — 자료는 학부모보기 한 곳으로만
// · 틀린 까닭(명단에 없음 · 비번 다름)은 가리지 않는다
// · 학생 로그인 답에는 학부모 토큰이 없다
// Firestore 에서는 학생 자격으로 학생 표의 토큰 칸(secrets)을 못 읽어서, 저장소가 그 아이 자격 문서의 parentToken 을 읽는다.
// 규칙(자기 자격 문서만 읽는다)은 test:emulators 가 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { fakeDb } from './helpers/fake-firestore.mjs';

const 흉내 = new URL('./helpers/fake-firestore.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { return s === 'firebase/firestore' ? { url: ${JSON.stringify(흉내)}, shortCircuit: true } : n(s, c); }`));
const { FirestoreRepository, digest } = await import('../services/firestore-repository.mjs');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const 틀림글 = '이름이나 비밀번호가 맞지 않습니다.';
const 있던토큰 = 'c'.repeat(64);
function 판(선생님비번 = '5678') {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 선생님비번]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);
  학생.appendRow(['', '홍길동', '1234', '', '', '중2', '', '', '', '', '공부 잘해요']);
  학생.appendRow(['', '김영희', '0011', '', '', '중1', '', '', 있던토큰, '', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  store.insertSheet('숙제').appendRow(['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류']);
  store.insertSheet('기록').appendRow(['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외']);
  store.insertSheet('기록보관').appendRow(['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외']);
  return store;
}
function 엔진() {
  const store = 판(), 엔 = createRuntime(store, { now: () => Date.parse('2026-11-02T03:00:00Z') });
  return { store, call: (fn, ...args) => JSON.parse(JSON.stringify(엔.call(fn, args))) };
}

/* ---------- 엔진 (GAS 길) ---------- */
test('맞는 이름·비번이면 ok 와 토큰이 오고, 그 토큰으로 학부모보기가 된다', () => {
  const e = 엔진();
  const r = e.call('학부모로그인', '김영희', '0011');
  assert.deepEqual(r, { ok: true, 토큰: 있던토큰 });
  const 보기 = e.call('학부모보기', r.토큰);
  assert.equal(보기.ok, true); assert.equal(보기.이름, '김영희');
});
test('토큰이 없던 아이는 그 자리에서 발급되고, 두 번 불러도 같은 토큰이다', () => {
  const e = 엔진();
  const 첫 = e.call('학부모로그인', '홍길동', '1234');
  assert.equal(첫.ok, true); assert.match(첫.토큰, /^[0-9a-f]{64}$/);
  assert.equal(e.call('학부모로그인', '홍길동', '1234').토큰, 첫.토큰);
  assert.equal(e.store.getSheetByName('학생').getRange(2, 9).getValue(), 첫.토큰);
  assert.equal(e.call('학부모보기', 첫.토큰).이름, '홍길동');
});
test('비번이 틀려도 · 명단에 없어도 · 비번을 비워도 똑같은 한 마디 — 왜 틀렸는지 가리지 않는다', () => {
  const e = 엔진();
  const 답들 = [e.call('학부모로그인', '홍길동', '9999'), e.call('학부모로그인', '없는아이', '1234'), e.call('학부모로그인', '홍길동', '')];
  for (const r of 답들) assert.deepEqual(r, { ok: false, 메시지: 틀림글 });
});
test('이름 띄어쓰기가 달라도 찾는다', () => {
  assert.equal(엔진().call('학부모로그인', ' 김 영희 ', '0011').토큰, 있던토큰);
});
test('학생 로그인 답에는 학부모 토큰이 없다', () => {
  const e = 엔진();
  e.call('학부모로그인', '홍길동', '1234');
  const 답 = JSON.stringify(e.call('로그인', '홍길동', '1234'));
  assert.equal(JSON.parse(답).ok, true);
  assert.equal(/[0-9a-f]{32,}/.test(답), false);
});
test('학부모로그인은 자료(숙제 · 점수 · 한마디)를 주지 않는다 — 토큰만', () => {
  const r = 엔진().call('학부모로그인', '홍길동', '1234');
  assert.deepEqual(Object.keys(r).sort(), ['ok', '토큰']);
});
test('학부모토큰채우기 — 선생님만, 빈 아이만 채우고 있던 토큰은 그대로', () => {
  const e = 엔진();
  assert.equal(e.call('학부모토큰채우기', '틀린비번').ok, false);
  assert.deepEqual(e.call('학부모토큰채우기', '5678'), { ok: true, 개수: 1 });
  assert.equal(e.store.getSheetByName('학생').getRange(3, 9).getValue(), 있던토큰);
  assert.deepEqual(e.call('학부모토큰채우기', '5678'), { ok: true, 개수: 0 });
});

/* ---------- Firestore 저장소 길 ---------- */
const 판이름 = 't';
async function db차리기() {
  const db = fakeDb();
  const { documents } = await createDatasetDocuments(판(), { digest });
  for (const [path, data] of documents) db.docs.set(`vocabDatasets/${판이름}/${path}`, data);
  return db;
}
let 번호 = 0;
const 사람 = db => new FirestoreRepository(db, 판이름, { user: { uid: 'uid' + (++번호) + 'abcdef', getIdToken: async () => '' } });

test('저장소: 토큰이 있던 아이는 이름 + 비번으로 토큰을 받고, 그 토큰으로 학부모보기가 된다', async () => {
  const db = await db차리기(), 부모 = 사람(db);
  assert.deepEqual(await 부모.call('학부모로그인', [' 김영희', '0011']), { ok: true, 토큰: 있던토큰 });
  const 보기 = await 사람(db).call('학부모보기', [있던토큰]);
  assert.equal(보기.ok, true); assert.equal(보기.이름, '김영희');
});
test('저장소: 틀린 비번 · 없는 이름은 같은 한 마디', async () => {
  const db = await db차리기();
  assert.deepEqual(await 사람(db).call('학부모로그인', ['김영희', '9999']), { ok: false, 메시지: 틀림글 });
  assert.deepEqual(await 사람(db).call('학부모로그인', ['없는아이', '0011']), { ok: false, 메시지: 틀림글 });
});
test('저장소: 토큰이 없던 아이는 선생님이 들어올 때 채워지고, 그 뒤로 이름 + 비번으로 들어온다', async () => {
  const db = await db차리기();
  const 전 = await 사람(db).call('학부모로그인', ['홍길동', '1234']);
  assert.equal(전.ok, false); assert.notEqual(전.메시지, 틀림글, '비번은 맞았으니 준비 중이라고 말해도 된다');
  assert.deepEqual(await 사람(db).call('선생님로그인', ['5678']), { ok: true });
  const 후 = await 사람(db).call('학부모로그인', ['홍길동', '1234']);
  assert.equal(후.ok, true); assert.match(후.토큰, /^[0-9a-f]{64}$/);
  assert.equal((await 사람(db).call('학부모보기', [후.토큰])).이름, '홍길동');
  assert.equal(db.docs.get(`vocabDatasets/${판이름}/meta/catalog`).부모열쇠, true);
});
test('저장소: 학생 로그인 답에는 학부모 토큰이 없다', async () => {
  const db = await db차리기();
  const 답 = JSON.stringify(await 사람(db).call('로그인', ['김영희', '0011']));
  assert.equal(답.includes(있던토큰), false);
});
test('규칙: 자기 자격 문서는 그 자격이 읽는다 — 다른 자격 문서는 여전히 선생님만', () => {
  assert.match(read('../firebase/firestore.rules'),
    /match \/credentials\/\{id\} \{ allow read: if teacher\(dataset\) \|\| \(member\(dataset\) && session\(\)\.credentialId == id\);/);
});

/* ---------- 화면 ---------- */
const parent = read('../parent.html');
function 함수(name) {
  const from = parent.indexOf('function ' + name + '(');
  assert.ok(from >= 0, name);
  let i = parent.indexOf('{', from), depth = 0;
  for (; i < parent.length; i++) { if (parent[i] === '{') depth++; else if (parent[i] === '}' && --depth === 0) break; }
  return parent.slice(from, i + 1);
}
test('학부모 화면에 아이 이름 · 비밀번호(숫자 자판, 가림) 칸과 들어가기 단추가 있다', () => {
  const 칸 = 함수('로그인칸');
  assert.match(칸, /id="pName"/);
  assert.match(칸, /id="pPw" type="password" inputmode="numeric"/);
  assert.match(칸, /id="pGo">들어가기</);
  assert.match(칸, /api\('학부모로그인', 이름, 비번\)/);
  assert.match(칸, /저장쓰기\(토큰열쇠, r\.토큰\)/);
  assert.doesNotMatch(칸, /location\.hash\s*=/, '토큰을 주소에 붙이지 않는다');
});
test('토큰 없는 화면과 링크가 맞지 않는 화면 둘 다 로그인 칸으로 가는 길이 있다', () => {
  const 열기 = 함수('열기');
  assert.match(열기, /if\(!토큰\)\{\s*로그인칸\(\);/);
  assert.match(열기, /메시지\('🔒'[\s\S]*?id="pToLogin"[\s\S]*?\$\('pToLogin'\)\.onclick = function\(\)\{ 토큰 = ''; 로그인칸\(\); \};/);
});
test('「학생 화면으로」 가 여전히 있다 — 로그인 칸에도', () => {
  assert.match(함수('학생화면단추_'), /학생 화면으로/);
  assert.match(함수('로그인칸'), /학생화면단추_\(\)/);
});
