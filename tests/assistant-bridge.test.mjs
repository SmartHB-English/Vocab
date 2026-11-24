// 비서 문 — 원장님 컴퓨터의 비서(work/비서)가 서비스 계정 키(bridge 자격)로 정해 둔 선생님 기능만 부른다.
// 비번은 밖에서 넣지 않는다. 엔진 안에서 설정 표의 선생님비밀번호를 그대로 쓴다 — 답에도 journal 에도 안 나간다.
// 열리는 것: 선생님기본 · 선생님기록 · 체크자료 · 숙제예약목록 · 다음숙제뽑기 · 진도숙제내기 · 명단가져오기 · 교재일괄(교재 칸만). 그 밖은 막힌다.
// bridge 만 연다 — 앱 · 브라우저(선생님 · 학생 · 아무나)로는 못 연다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { sheetId, unpack } from '../services/store-codec.mjs';
import { fakeDb } from './helpers/fake-firestore.mjs';

const 흉내 = new URL('./helpers/fake-firestore.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { return s === 'firebase/firestore' ? { url: ${JSON.stringify(흉내)}, shortCircuit: true } : n(s, c); }`));
const { FirestoreRepository, digest } = await import('../services/firestore-repository.mjs');

const 일반 = x => JSON.parse(JSON.stringify(x));
const 비번 = 'S3cret-9871';
const 열린것 = ['선생님기본', '선생님기록', '체크자료', '숙제예약목록', '다음숙제뽑기', '진도숙제내기', '명단가져오기', '교재일괄'];
const 머리숙제 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류',
  '수업', '순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분', '학부모숨김', '문항수', '숙제코드'];
const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초',
  '숙제여부', '틀린단어', '구분', '집계제외', '이탈수', '이탈초', '복사시도', '숙제코드'];

function 판() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 비번]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재']);
  학생.appendRow(['', '홍길동', '1111', '', '', '', '', '교재A']);
  학생.appendRow(['', '김영희', '2222', '', '', '', '', '교재A']);
  const 목록 = store.insertSheet('단어장목록');
  목록.appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과', '하루몫', '소리']);
  목록.appendRow(['교재A', '', 'wA', '', '', '', 10, '']);
  const sh = store.insertSheet('wA'); sh.appendRow(['번호', '영어', '뜻']);
  for (let i = 1; i <= 40; i++) sh.appendRow([i, 'w' + i, '뜻' + i]);
  store.insertSheet('숙제').appendRow(머리숙제);
  store.insertSheet('기록').appendRow(머리기록);
  store.insertSheet('기록보관').appendRow(머리기록);
  return store;
}
const 숙제줄들 = store => { const sh = store.getSheetByName('숙제'); const n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, 20).getValues() : []; };

test('엔진 — 비서 문은 비번 없이 정해 둔 기능을 부른다', () => {
  const store = 판();
  const 엔 = createRuntime(store);
  const 뽑 = 일반(엔.assistant('다음숙제뽑기', [['홍길동', '김영희']]));
  assert.equal(뽑.ok, true);
  assert.deepEqual(뽑.줄들.map(x => [x.이름, x.시작, x.끝, x.까닭, x.낼까]),
    [['홍길동', 1, 10, '처음', true], ['김영희', 1, 10, '처음', true]]);
  const 낸 = 일반(엔.assistant('진도숙제내기', [[{ 이름: '홍길동', 단어장: '교재A', 시작: 1, 끝: 10 }], { 유형: '스펠링', 종류: '당일' }]));
  assert.deepEqual([낸.ok, 낸.낸수], [true, 1]);
  assert.deepEqual(숙제줄들(store).map(x => [x[1], x[2], x[3], x[7]]), [['교재A', 1, 10, '홍길동']]);
  assert.equal(일반(엔.assistant('숙제예약목록', [])).ok, true);
});

test('엔진 — 목록 밖의 기능은 막힌다 (설정 · 학생 고치기 · 없는 이름)', () => {
  const 엔 = createRuntime(판());
  for (const fn of ['설정저장', '학생추가', '선생님로그인', '학생번호채우기', '숙제예약저장', '아무거나', '__예약숙제']) {
    const r = 일반(엔.assistant(fn, []));
    assert.equal(r.ok, false, fn + ' 은 막혀야 한다');
    assert.match(r.메시지, /비서가 부를 수 없는 기능/);
  }
});

test('엔진 — 열린 여덟은 전부 열린기능_ 에 있고 첫 칸이 비번이다', () => {
  const code = readFileSync(new URL('./fixtures/legacy/Code.gs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  for (const fn of 열린것) {
    assert.match(code, new RegExp(`  ${fn}: ${fn},`), fn + ' 은 열린기능_ 에');
    assert.match(code, new RegExp(`function ${fn}\\(비번[,)]`), fn + ' 의 첫 칸은 비번');
  }
  const 만들기 = readFileSync(new URL('../scripts/build-legacy.mjs', import.meta.url), 'utf8');
  assert.ok(만들기.includes("[" + 열린것.map(x => `'${x}'`).join(', ') + "]"), '목록은 build-legacy 한 곳에');
});

/* ---------------- 저장소 쪽 — bridge 만 ---------------- */
async function 저장소판(store) {
  const db = fakeDb();
  const { documents } = await createDatasetDocuments(store, { digest });
  for (const [path, data] of documents) db.docs.set(`vocabDatasets/t/${path}`, data);
  return db;
}
const 표 = (db, name) => unpack(db.docs.get(`vocabDatasets/t/tables/${sheetId(name)}`).payload);

test('__비서 — bridge 거래 안에서 숙제가 들어가고, journal · 답 어디에도 비번이 없다', async () => {
  const db = await 저장소판(판());
  const 비서 = new FirestoreRepository(db, 't', { role: 'bridge', user: { uid: 'assistant' } });
  const 뽑 = await 비서.call('__비서', ['다음숙제뽑기', [['홍길동']]]);
  assert.equal(뽑.ok, true);
  assert.equal(뽑.줄들[0].끝, 10);
  const 낸 = await 비서.call('__비서', ['진도숙제내기', [[{ 이름: '홍길동', 단어장: '교재A', 시작: 1, 끝: 10 }], { 유형: '스펠링', 종류: '당일' }]]);
  assert.deepEqual([낸.ok, 낸.낸수], [true, 1]);
  assert.equal(표(db, '숙제').cells['2:8']?.value, '홍길동');
  const 막 = await 비서.call('__비서', ['설정저장', [{ 학원이름: 'x' }]]);
  assert.equal(막.ok, false);
  const journal = [...db.docs.entries()].filter(([k]) => /\/journal\/[^/]+$/.test(k)).map(([, v]) => JSON.stringify(v));
  assert.ok(journal.length > 0);
  assert.ok(!journal.some(j => j.includes(비번)), 'journal 에 비번이 없다');
  assert.ok(!JSON.stringify([뽑, 낸, 막]).includes(비번), '답에 비번이 없다');
});

test('__비서 는 bridge 만 — 선생님 · 아무나 는 못 연다', async () => {
  const db = await 저장소판(판());
  const 선생님 = new FirestoreRepository(db, 't', { user: { uid: 'teacher-uid-abc', getIdToken: async () => '' } });
  assert.deepEqual(await 선생님.call('선생님로그인', [비번]), { ok: true });
  assert.equal((await 선생님.call('__비서', ['다음숙제뽑기', [['홍길동']]])).ok, false);
  const 아무나 = new FirestoreRepository(db, 't', { user: { uid: 'anon-uid-abc', getIdToken: async () => '' } });
  assert.equal((await 아무나.call('__비서', ['다음숙제뽑기', [['홍길동']]])).ok, false);
});
