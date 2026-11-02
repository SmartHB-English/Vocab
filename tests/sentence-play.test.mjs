// 문장 탭 2단계 — 아이 화면과 「문장기록」.
// 아이가 한 판을 끝내면 문장기록 표에 줄 하나를 덧붙인다. 학생은 새 표를 만들 수 없으니(firestore.rules)
// 표는 선생님이 문장 묶음을 넣을 때 만들고, 학생 저장은 덧붙임 조각 하나로만 나간다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { sheetId, unpack } from '../services/store-codec.mjs';
import { fakeDb } from './helpers/fake-firestore.mjs';

const 흉내 = new URL('./helpers/fake-firestore.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { return s === 'firebase/firestore' ? { url: ${JSON.stringify(흉내)}, shortCircuit: true } : n(s, c); }`));
const { FirestoreRepository, digest } = await import('../services/firestore-repository.mjs');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

const 판 = 't', 선생님비번 = '5678';
async function 판차리기() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 선생님비번]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);
  학생.appendRow(['', '홍길동', '1234', '', '', '중2', '', '', '', '', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  store.insertSheet('기록').appendRow(['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외']);
  const db = fakeDb();
  const { documents } = await createDatasetDocuments(store, { digest });
  for (const [path, data] of documents) db.docs.set(`vocabDatasets/${판}/${path}`, data);
  return db;
}
let 번호 = 0;
const 사람 = db => new FirestoreRepository(db, 판, { user: { uid: 'uid' + (++번호) + 'abcdef', getIdToken: async () => '' } });
async function 학생(db) { const r = 사람(db); assert.equal((await r.call('로그인', ['홍길동', '1234'])).ok, true); return r; }
async function 선생님(db) { const r = 사람(db); assert.deepEqual(await r.call('선생님로그인', [선생님비번]), { ok: true }); return r; }
const 조각들 = (db, 표) => [...db.docs.keys()].filter(k => k.includes(`/tables/${sheetId(표)}/appends/`)).sort();
const 한판 = { 이름: '홍길동', 단어장: '중2 문장', 범위: '', 유형: '끊어 읽기', 난이도: 2, 문항수: 5, 정답수: 4, 소요초: 73, 숙제여부: false,
  틀린문장: ['I know that she likes me very much'] };
const 줄 = 'The boy=주 / kicked=동 / the ball=목 | 소년이 공을 찼다';

test('선생님이 문장 묶음을 넣기 전에는 기록표가 없어 저장하지 않는다 — 학생이 새 표를 만들려 들지 않는다', async () => {
  const db = await 판차리기(), r = await 학생(db);
  const 답 = await r.call('문장기록저장', [한판]);
  assert.equal(답.ok, false); assert.match(답.메시지, /선생님/);
  assert.ok(!db.docs.has(`vocabDatasets/${판}/tables/${sheetId('문장기록')}`));
});

test('문장 묶음을 넣으면 문장기록 표가 생기고, 아이의 한 판은 덧붙임 조각 하나로만 들어간다', async () => {
  const db = await 판차리기(), t = await 선생님(db);
  assert.equal((await t.call('단어붙여넣기', [선생님비번, '중2 문장', 줄, false, '문장'])).ok, true);
  const 본체경로 = `vocabDatasets/${판}/tables/${sheetId('문장기록')}`;
  assert.ok(db.docs.has(본체경로), '문장기록 표가 생긴다');
  const 전본체 = structuredClone(db.docs.get(본체경로)), 전목록 = structuredClone(db.docs.get(`vocabDatasets/${판}/meta/catalog`));

  const r = await 학생(db);
  const 문장들 = await r.call('단어가져오기', ['중2 문장']);
  assert.equal(문장들[0].en, 'The boy=주 / kicked=동 / the ball=목');
  assert.deepEqual(await r.call('문장기록저장', [한판]), { ok: true });
  assert.deepEqual(db.docs.get(본체경로), 전본체, '본체는 그대로');
  assert.deepEqual(db.docs.get(`vocabDatasets/${판}/meta/catalog`), 전목록, '목록도 그대로');
  assert.equal(조각들(db, '문장기록').length, 1);
  assert.equal(조각들(db, '기록').length, 0, '단어 기록표에는 안 섞인다');
  const 조각 = db.docs.get(조각들(db, '문장기록')[0]);
  assert.equal(조각.name, '문장기록');
  const 칸 = unpack(조각.rows)[0], 값 = i => 칸[i]?.value;
  // 시각 · 반 · 이름 · 단어장 · 범위 · 유형 · 난이도 · 문항수 · 정답수 · 점수 · 소요초 · 숙제여부 · 틀린문장 · 구분 · 집계제외
  assert.deepEqual([3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(값),
    ['홍길동', '중2 문장', '끊어 읽기', 2, 5, 4, 80, 73, '', 'I know that she likes me very much', '연습']);
});

test('모르는 놀이 · 이상한 수는 받지 않거나 다듬는다', async () => {
  const db = await 판차리기(), t = await 선생님(db);
  await t.call('단어붙여넣기', [선생님비번, '중2 문장', 줄, false, '문장']);
  const r = await 학생(db);
  assert.equal((await r.call('문장기록저장', [{ ...한판, 유형: '스펠링' }])).ok, false);
  assert.equal((await r.call('문장기록저장', [{ ...한판, 정답수: 99 }])).ok, true);
  const 칸 = unpack(db.docs.get(조각들(db, '문장기록')[0]).rows)[0];
  assert.equal(칸[9].value, 5, '정답수는 문항수를 넘지 않는다');
  assert.equal(칸[10].value, 100);
});

test('규칙: 학생은 문장기록 표를 고치고 조각을 만들 수 있다 (기록과 같은 꼴)', () => {
  const 규칙 = read('../firebase/firestore.rules');
  assert.match(규칙, /request\.resource\.data\.name in \['기록','게임','푸시','문장기록'\]/);
  assert.match(규칙, /request\.resource\.data\.name in \['기록','문장기록'\]/);
  assert.match(read('../services/firestore-repository.mjs'), /const 조각표들 = \['기록', '문장기록'\];/);
});

test('아이 화면: 아래 탭바가 숙제 · 외우기 · 시험 · 문장 · 게임 다섯 칸', () => {
  const html = read('../index.html');
  const 탭 = [...html.matchAll(/data-hbt="(\w+)" type="button">'\+IC\.\w+\+'<span>([^<]+)<\/span>/g)].map(m => m[2]);
  assert.deepEqual(탭, ['숙제', '외우기', '시험', '문장', '게임']);
  assert.match(html, /<section id="s-sent" class="screen">/);
  assert.match(html, /if\(name === 'sent'\) try\{ 문장화면열기_\(\); \}catch\(e\)\{\}/);
  assert.match(html, /api같은번호\(번호, '문장기록저장', 자료\)/);
});
