// 선생님 사이트(teacher.html) — 로그인 · 숙제 내기 · 「자료」 탭(칸 고치기 · 지우기 · 휴지통 되살리기) · 엑셀 표 개수.
// 진짜 저장소(FirestoreRepository)를 흉내 Firestore(tests/helpers/fake-firestore.mjs) 위에서 돌린다.
// 화면 쪽은 teacher.html 에 박히는 services/teacher-data.js 를 vm 으로 띄워 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { unpack, sheetId } from '../services/store-codec.mjs';
import { fakeDb } from './helpers/fake-firestore.mjs';

const 흉내 = new URL('./helpers/fake-firestore.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { return s === 'firebase/firestore' ? { url: ${JSON.stringify(흉내)}, shortCircuit: true } : n(s, c); }`));
const { FirestoreRepository, digest } = await import('../services/firestore-repository.mjs');

const 선생님비번 = '5678';
const 판 = 't';
const 한시간전 = () => new Date(Date.now() - 3600000);   // 저장소는 진짜 「지금」 으로 돈다 — 최근 7일 안에 들게
const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'];
const 머리숙제 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류',
  '수업', '순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분', '학부모숨김'];

async function 판차리기() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 선생님비번]); 설정.appendRow(['푸시비밀키', '아주-비밀']);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);
  학생.appendRow(['월수금', '홍길동', '1234', '', '', '중2', '', '', 'a'.repeat(64), '', '']);
  학생.appendRow(['화목', '김영희', '0011', '', '', '중1', '', '', 'b'.repeat(64), '', '']);
  학생.appendRow(['월수금', '이철수', '2222', '', '', '중2', '', '', '', '', '']);
  const 목록 = store.insertSheet('단어장목록');
  목록.appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  목록.appendRow(['교재A', '', '단어_교재A', '', 10, '']);
  const 단어 = store.insertSheet('단어_교재A');
  단어.appendRow(['번호', '영어', '뜻']);
  for (let i = 1; i <= 12; i++) 단어.appendRow([i, 'word' + i, '뜻' + i]);
  store.insertSheet('숙제').appendRow(머리숙제);
  const 기록 = store.insertSheet('기록');
  기록.appendRow(머리기록);
  기록.appendRow([한시간전(), '', '홍길동', '교재A', '1~10', '스펠링', 10, 9, 90, 0, 0, 30, 'O', '', '시험', '']);
  기록.appendRow([한시간전(), '', '김영희', '교재A', '1~10', '스펠링', 10, 7, 70, 0, 0, 30, 'O', '', '시험', '']);
  store.insertSheet('점수').appendRow(['날짜', '반', '이름', '시험명', '점수']);
  const db = fakeDb();
  const { documents } = await createDatasetDocuments(store, { digest });
  for (const [path, data] of documents) db.docs.set(`vocabDatasets/${판}/${path}`, data);
  return db;
}
let 번호 = 0;
const 사람 = db => new FirestoreRepository(db, 판, { user: { uid: 'uid-' + (++번호) + '-abcdef', getIdToken: async () => '' } });
async function 선생님(db) { const r = 사람(db); assert.deepEqual(await r.call('선생님로그인', [선생님비번]), { ok: true }); return r; }
const 풀기 = r => { assert.equal(r.ok, true, r.메시지); return JSON.parse(r.자료); };
const 공개표 = (db, 이름) => { const d = db.docs.get(`vocabDatasets/${판}/tables/${sheetId(이름)}`); return d && unpack(d.payload); };
const 칸 = (표, r, c) => 표.cells[`${r}:${c}`]?.value ?? '';
const 일지들 = db => [...db.docs.entries()].filter(([k]) => /\/journal\/[^/]+$/.test(k)).map(([, v]) => v);

test('선생님 로그인 — 맞는 비밀번호만 들어가고, 학생은 「자료」 를 못 부른다', async () => {
  const db = await 판차리기();
  assert.deepEqual(await 사람(db).call('선생님로그인', ['0000']), { ok: false });
  await 선생님(db);
  const 학생 = 사람(db);
  assert.equal((await 학생.call('로그인', ['홍길동', '1234'])).ok, true);
  const 답 = await 학생.call('__자료읽기', [{ 이름들: ['학생'] }]);
  assert.equal(답.ok, false);
  assert.match(답.메시지, /선생님만/);
});

test('숙제 내기 — 엔진(숙제등록)이 그대로 숙제 표에 쓴다', async () => {
  const db = await 판차리기();
  const t = await 선생님(db);
  const 답 = await t.call('숙제등록', [선생님비번, { 단어장: '교재A', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '기한', 마감일: '2099-12-31', 학생들: ['홍길동'], 바뀐줄만: true }]);
  assert.equal(답.ok, true, 답.메시지);
  const 숙제 = 공개표(db, '숙제');
  assert.equal(칸(숙제, 2, 2), '교재A');
  assert.equal(칸(숙제, 2, 8), '홍길동');
  const 자료 = 풀기(await t.call('__자료읽기', [{ 이름들: ['숙제'] }]));
  assert.equal(자료.표들[0].줄들.length, 1);
  assert.ok(자료.목록.some(x => x.이름 === '단어_교재A' && x.보일이름 === '단어장 · 교재A'));
});

test('칸 고치기 — 원본만 바꾸고, 엔진이 고친 점수로 다시 센다 · journal 에 누가·표·전후가 남는다', async () => {
  const db = await 판차리기();
  const t = await 선생님(db);
  const 기록 = 풀기(await t.call('__자료읽기', [{ 이름들: ['기록'] }])).표들[0];
  const 줄 = 기록.줄들[0];
  assert.equal(줄[8], 90);
  const 답 = 풀기(await t.call('__자료고치기', [{ 표: '기록', 행: 2, 열: 9, 전줄: 줄, 값: '55' }]));
  assert.equal(답.전, 90); assert.equal(답.후, 55);
  assert.equal(칸(공개표(db, '기록'), 2, 9), 55);                 // 숫자 칸은 숫자로
  assert.ok(칸(공개표(db, '기록'), 2, 1) instanceof Date);        // 다른 칸(날짜)은 그대로
  const 요약 = await t.call('선생님기록', [선생님비번, 7]);
  const 홍 = 요약.시험목록.find(x => x.이름 === '홍길동');
  assert.equal(홍.점수, 55);
  const 일지 = 일지들(db).find(j => j.fn === '__자료고치기');
  assert.equal(일지.표, '기록'); assert.match(일지.누가, /^선생님 · /); assert.ok(일지.at > 0);
  const 남긴것 = JSON.parse(unpack(일지.result).자료);
  assert.equal(남긴것.전, 90); assert.equal(남긴것.후, 55);
});

test('동시에 고치기 — 그 사이 줄이 바뀌었으면 저장하지 않고 알려 준다', async () => {
  const db = await 판차리기();
  const 갑 = await 선생님(db), 을 = await 선생님(db);
  const 줄 = 풀기(await 갑.call('__자료읽기', [{ 이름들: ['기록'] }])).표들[0].줄들[0];
  풀기(await 을.call('__자료고치기', [{ 표: '기록', 행: 2, 열: 9, 전줄: 줄, 값: '100' }]));
  const 쓴수 = db.commits;
  const 답 = await 갑.call('__자료고치기', [{ 표: '기록', 행: 2, 열: 9, 전줄: 줄, 값: '0' }]);
  assert.equal(답.ok, false); assert.equal(답.충돌, true);
  assert.equal(db.commits, 쓴수);
  assert.equal(칸(공개표(db, '기록'), 2, 9), 100);
});

test('지우기 → 휴지통 → 되살리기 — 학생 비밀번호·학부모 링크는 공개 휴지통에 안 남고, 되살리면 다시 로그인된다', async () => {
  const db = await 판차리기();
  const t = await 선생님(db);
  const 학생표 = 풀기(await t.call('__자료읽기', [{ 이름들: ['학생'] }])).표들[0];
  assert.equal(학생표.줄들[1][2], '0011');                          // 선생님은 비밀번호가 보인다
  const 지움 = 풀기(await t.call('__자료지우기', [{ 표: '학생', 줄들: [{ 행: 3, 전줄: 학생표.줄들[1] }] }]));
  assert.equal(지움.지운.length, 1);
  assert.equal(칸(공개표(db, '학생'), 3, 2), '이철수');               // 아래 줄이 당겨졌다
  const 통 = 공개표(db, '휴지통');
  assert.equal(칸(통, 2, 2), '학생'); assert.equal(칸(통, 2, 3), 3);
  assert.doesNotMatch(JSON.stringify(통), /0011|bbbbbbbb/);          // 학생도 읽는 표 — 비밀은 secrets 로
  assert.match(db.docs.get(`vocabDatasets/${판}/secrets/${sheetId('휴지통')}`).payload, /0011/);
  assert.equal((await 사람(db).call('로그인', ['김영희', '0011'])).ok, false);
  const 일지 = 일지들(db).find(j => j.fn === '__자료지우기');
  assert.equal(일지.표, '학생');

  const 휴 = 풀기(await t.call('__자료읽기', [{ 이름들: ['휴지통'] }])).표들[0];
  const 살림 = 풀기(await t.call('__자료되살리기', [{ 번호들: [휴.줄들[0][6]] }]));
  assert.equal(살림.되살린[0].행, 3);
  const 학생 = 공개표(db, '학생');
  assert.deepEqual([2, 3, 4].map(r => 칸(학생, r, 2)), ['홍길동', '김영희', '이철수']);
  assert.equal(칸(공개표(db, '휴지통'), 2, 1), '');                   // 휴지통에서 빠졌다
  assert.equal((await 사람(db).call('로그인', ['김영희', '0011'])).ok, true);
  assert.ok(일지들(db).some(j => j.fn === '__자료되살리기'));
  // 이미 되살린 줄을 또 되살리면 「이미」
  const 또 = await t.call('__자료되살리기', [{ 번호들: [휴.줄들[0][6]] }]);
  assert.equal(또.ok, false); assert.equal(또.충돌, true);
});

test('여러 줄 지우기 — 하나라도 바뀌었으면 하나도 안 지운다 · 되살리면 원래 차례로', async () => {
  const db = await 판차리기();
  const t = await 선생님(db);
  const 단어 = 풀기(await t.call('__자료읽기', [{ 이름들: ['단어_교재A'] }])).표들[0];
  const 고름 = [2, 3, 5].map(i => ({ 행: i + 2, 전줄: 단어.줄들[i] }));
  const 틀림 = await t.call('__자료지우기', [{ 표: '단어_교재A', 줄들: [...고름.slice(0, 2), { 행: 7, 전줄: ['엉뚱'] }] }]);
  assert.equal(틀림.ok, false);
  assert.equal(공개표(db, '단어_교재A').cells['13:2'].value, 'word12');
  풀기(await t.call('__자료지우기', [{ 표: '단어_교재A', 줄들: 고름 }]));
  assert.equal(칸(공개표(db, '단어_교재A'), 4, 2), 'word5');
  const 휴 = 풀기(await t.call('__자료읽기', [{ 이름들: ['휴지통'] }])).표들[0];
  풀기(await t.call('__자료되살리기', [{ 번호들: 휴.줄들.map(j => j[6]).reverse() }]));
  const 뒤 = 공개표(db, '단어_교재A');
  assert.deepEqual(Array.from({ length: 12 }, (_, i) => 칸(뒤, i + 2, 2)), Array.from({ length: 12 }, (_, i) => 'word' + (i + 1)));
});

test('휴지통 비우기 — 비울 게 없으면 저장하지 않는다', async () => {
  const db = await 판차리기();
  const t = await 선생님(db);
  const 쓴수 = db.commits;
  assert.deepEqual(풀기(await t.call('__휴지통비우기', [{}])), { 비운: 0 });
  assert.equal(db.commits, 쓴수);
});

/* ---------- 화면 쪽 (services/teacher-data.js) ---------- */
function 화면() {
  const ctx = vm.createContext({ console });
  vm.runInContext(readFileSync(new URL('../services/teacher-data.js', import.meta.url), 'utf8'), ctx, { filename: 'teacher-data.js' });
  return ctx;
}
function 흉내엑셀() {
  return { utils: {
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    aoa_to_sheet: 줄들 => ({ 줄들 }),
    book_append_sheet(책, 시트, 이름) { assert.ok(!책.Sheets[이름], '시트 이름이 겹친다: ' + 이름); 책.SheetNames.push(이름); 책.Sheets[이름] = 시트; },
  } };
}

test('전체 내려받기 — 모든 표가 시트 하나씩 · 날짜는 날짜로 · 설정의 비밀은 비운다', async () => {
  const db = await 판차리기();
  const t = await 선생님(db);
  const 모두 = 풀기(await t.call('__자료읽기', [{ 모두: true }]));
  const 표개수 = db.docs.get(`vocabDatasets/${판}/meta/catalog`).tables.length;
  assert.equal(모두.표들.length, 표개수);
  const 책 = 화면().자료엑셀책_(흉내엑셀(), 모두.표들);
  assert.equal(책.SheetNames.length, 표개수);
  assert.ok(책.SheetNames.every(n => n.length <= 31));
  assert.equal(Object.prototype.toString.call(책.Sheets['기록'].줄들[1][0]), '[object Date]');   // vm 안의 Date — instanceof 로는 못 잰다
  const 설정 = 책.Sheets['설정'].줄들;
  assert.deepEqual([...설정.filter(r => ['선생님비밀번호', '푸시비밀키'].includes(r[0])).map(r => r[1])], ['', '']);
});

test('시트 이름 — 31자 · 겹치면 (2) · 엑셀이 못 쓰는 글자는 뺀다', () => {
  const c = 화면(), 쓴것 = {};
  const 긴 = '단어_' + '가'.repeat(40);
  assert.equal(c.자료시트이름_(긴, 쓴것).length, 31);
  const 둘째 = c.자료시트이름_(긴, 쓴것);
  assert.ok(둘째.endsWith(' (2)') && 둘째.length === 31);
  assert.equal(c.자료시트이름_('a/b:c', 쓴것), 'a b c');
});

test('거르기 — 반(여럿) · 학생 · 날짜 · 찾기, 기록은 최근 것부터', () => {
  const c = 화면();
  const 날 = s => ({ $date: Date.parse(s + '+09:00') });
  const 표 = { 이름: '기록', 머리: ['시각', '반', '이름', '점수'], 줄들: [
    [날('2026-10-01T10:00:00'), '월수금', '홍길동', 90],
    [날('2026-10-05T23:30:00'), '화목', '김영희', 70],
    ['', '', '', ''],
    [날('2026-10-06T00:10:00'), '토', '홍길동', 50],
  ] };
  const 걸러 = 조건 => Array.from(c.자료거르기_(표, { 반: {}, ...조건 }));
  assert.deepEqual(걸러({}), [3, 1, 0]);                              // 빈 줄은 빼고 최근 것부터
  assert.deepEqual(걸러({ 반: { 월수금: true, 화목: true } }), [1, 0]);
  assert.deepEqual(걸러({ 학생: '홍길동' }), [3, 0]);
  assert.deepEqual(걸러({ 부터: '2026-10-05', 까지: '2026-10-05' }), [1]);   // 날짜는 서울 기준 하루
  assert.deepEqual(걸러({ 찾기: '50' }), [3]);
  assert.equal(c.자료칸글_(날('2026-10-05T23:30:00')), '2026-10-05 23:30');
  assert.equal(c.자료칸글_(날('2026-10-05T00:00:00')), '2026-10-05');
});
