// 프롬프트 52 — 숙제 예약. 선생님이 걸어 두면 때가 됐을 때 Cloud Functions(scheduledHomework, 10분마다)가 낸다.
// 알림 예약과 같은 틀: 표 하나(숙제예약), bridge 함수 하나(__예약숙제 → 엔진의 예약숙제_), 10분마다 도는 함수 하나.
// 엔진이 보낸때를 먼저 찍고(거래) 숙제등록안_ 을 부른다. 못 내면 보낸때에 까닭을 남긴다. 알림은 sendScheduledNotices 그대로.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { sheetId, unpack } from '../services/store-codec.mjs';
import { fakeDb } from './helpers/fake-firestore.mjs';
import { sendScheduledNotices } from '../functions/src/scheduled-push.mjs';

const 흉내 = new URL('./helpers/fake-firestore.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { return s === 'firebase/firestore' ? { url: ${JSON.stringify(흉내)}, shortCircuit: true } : n(s, c); }`));
const { FirestoreRepository, digest } = await import('../services/firestore-repository.mjs');

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = read('./fixtures/legacy/Code.gs'), teacher = read('../teacher.html'), fnSrc = read('../functions/src/index.mjs');
const 일반 = x => JSON.parse(JSON.stringify(x));
const 비번 = '5678';
const 서울 = t => new Date(t + '+09:00').getTime();
const 숙제머리 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류'];
const 예약머리 = ['만든때', '날짜', '시각', '요약', '내용', '알림함께', '보낸때', '켬'];

/** 판 — 홍길동 · 김영희 는 교재A 를 배운다. 박철수는 교재B. 셋 다 알림을 켰다 */
function 판({ 숙제표 = true } = {}) {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 비번]);
  설정.appendRow(['푸시공개키', 'PUBLIC-KEY']); 설정.appendRow(['푸시비밀키', JSON.stringify({ kty: 'EC', crv: 'P-256', d: 'SECRET-D', x: 'x', y: 'y' })]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);
  학생.appendRow(['', '홍길동', '1234', '', '', '중2', '', '교재A', '', '', '']);
  학생.appendRow(['', '김영희', '0011', '', '', '중1', '', '교재A', '', '', '']);
  학생.appendRow(['', '박철수', '2222', '', '', '중1', '', '교재B', '', '', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 기록머리 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'];
  store.insertSheet('기록').appendRow(기록머리);
  store.insertSheet('기록보관').appendRow(기록머리);
  if (숙제표) store.insertSheet('숙제').appendRow(숙제머리);
  const 푸시 = store.insertSheet('푸시');
  푸시.appendRow(['켠때', '반', '이름', '주소', 'p256dh', 'auth', '기기']);
  푸시.appendRow([new Date(서울('2026-11-01T08:00:00')), '', '홍길동', 'https://fcm.googleapis.com/fcm/send/hong', 'P256', 'AUTH', 'Android']);
  푸시.appendRow([new Date(서울('2026-11-01T08:00:00')), '', '김영희', 'fcm:' + 'k'.repeat(40), '', '', 'app']);
  푸시.appendRow([new Date(서울('2026-11-01T08:00:00')), '', '박철수', 'fcm:' + 'p'.repeat(40), '', '', 'app']);
  return store;
}
function 엔진(store, 처음 = '2026-11-19T20:00:00') {
  let 시계 = 서울(처음);
  const 엔 = createRuntime(store, { now: () => 시계 });
  return {
    엔, store,
    call: (fn, ...args) => 일반(엔.call(fn, args)),
    때: t => { 시계 = 서울(t); },
    /* 10분마다 도는 함수가 부르는 것 — 그 시각으로 */
    돌기: t => { 시계 = 서울(t); return 일반(엔.scheduledHomework(시계)); },
  };
}
const 꾸러미 = (h = {}) => ({ 단어장: '교재A', 시작: 1, 끝: 20, 유형: '스펠링', 종류: '당일', 마감일: '', 학생들: [], 칸: '', 바뀐줄만: true, ...h });
const 걸기 = (e, 값 = {}) => e.call('숙제예약저장', 비번, '', { 날짜: '2026-11-20', 시각: '08:00', 알림함께: false, 내용: 꾸러미(), ...값 });
const 숙제줄수 = store => Math.max(0, store.getSheetByName('숙제').getLastRow() - 1);
const 숙제줄 = (store, 행 = 2) => store.getSheetByName('숙제').getRange(행, 1, 1, 20).getValues()[0];
const 예약칸 = (store, 행, 칸) => store.getSheetByName('숙제예약').getRange(행, 칸).getValue();

test('1. 시각이 6:59 · 21:01 이면 저장이 막힌다. 7:00 · 21:00 은 받는다', () => {
  const e = 엔진(판());
  for (const t of ['06:59', '6:59', '21:01', '23:00', '03:00', '8시', '']) {
    const r = 걸기(e, { 시각: t });
    assert.equal(r.ok, false, t);
  }
  for (const t of ['07:00', '7:00', '21:00']) assert.equal(걸기(e, { 시각: t }).ok, true, t);
  const 목록 = e.call('숙제예약목록', 비번).예약;
  assert.deepEqual(목록.map(n => n.시각).sort(), ['07:00', '07:00', '21:00']);
  assert.equal(e.call('숙제예약저장', '0000', '', { 날짜: '2026-11-20', 시각: '08:00', 내용: 꾸러미() }).ok, false, '선생님 비번을 거친다');
  assert.equal(걸기(e, { 날짜: '2026-11-18' }).메시지, '지난 날짜입니다.');
  assert.equal(걸기(e, { 날짜: '2026/11/20' }).ok, false, '날짜 꼴');
  assert.equal(걸기(e, { 내용: '' }).메시지, '숙제 내용이 비었습니다.');
  assert.equal(걸기(e, { 내용: {} }).ok, false, '단어장이 없는 꾸러미');
  assert.equal(걸기(e, { 내용: 꾸러미({ 종류: '기한', 마감일: '2026-11-19' }) }).ok, false, '마감이 나가는 날보다 앞');
  /* 내용은 JSON 한 칸 — 칸 스무 개로 펼치지 않는다 */
  const 머리 = e.store.getSheetByName('숙제예약').getRange(1, 1, 1, 8).getValues()[0];
  assert.deepEqual(머리, 예약머리);
  assert.deepEqual(JSON.parse(예약칸(e.store, 2, 5)).단어장, '교재A');
  assert.match(예약칸(e.store, 2, 4), /교재 배우는 학생 · 교재A 1~20 · 스펠링 · 당일/, '요약 한 줄');
});

test('2. 때가 안 됐으면 안 나간다', () => {
  const e = 엔진(판());
  걸기(e);
  assert.equal(e.돌기('2026-11-19T21:00:00').찍은수, 0, '전날');
  assert.equal(e.돌기('2026-11-20T07:59:00').찍은수, 0, '1분 전');
  assert.equal(숙제줄수(e.store), 0);
  assert.equal(예약칸(e.store, 2, 7), '', '보낸때 그대로');
});

test('3. 때가 되면 나가고 숙제 줄이 하나 는다', () => {
  const e = 엔진(판());
  걸기(e);
  const r = e.돌기('2026-11-20T08:05:00');
  assert.equal(r.찍은수, 1);
  assert.deepEqual(r.낸것.map(x => [x.됐나, x.대상]), [[true, 2]]);
  assert.equal(숙제줄수(e.store), 1);
  assert.equal(숙제줄(e.store)[1], '교재A');
  assert.equal(예약칸(e.store, 2, 7), '2026-11-20 08:05');
  const 목록 = e.call('숙제예약목록', 비번).예약;
  assert.equal(목록[0].보낸때, '2026-11-20 08:05'); assert.equal(목록[0].못냄, '');
  /* 아이 화면에도 뜬다 */
  e.때('2026-11-20T09:00:00');
  assert.equal(e.call('숙제가져오기', '홍길동').length, 1);
  assert.equal(e.call('숙제가져오기', '박철수').length, 0, '교재B 아이에게는 안 간다');
});

test('4. 보낸때를 먼저 찍는다 — 숙제 등록이 터져도 두 번 안 나간다', () => {
  const store = 판({ 숙제표: false });                 // 숙제 표가 없다 — 숙제등록안_ 이 sheet_ 에서 터진다
  const e = 엔진(store);
  걸기(e);
  const r = e.돌기('2026-11-20T08:00:00');
  assert.equal(r.찍은수, 1);
  assert.equal(r.낸것[0].됐나, false);
  assert.match(r.낸것[0].메시지, /숙제/);
  const 보낸때 = 예약칸(store, 2, 7);
  assert.match(보낸때, /^2026-11-20 08:00 못 냄 — /, '찍은 시각 뒤에 까닭');
  /* 숙제 표가 생겨도 이미 찍힌 줄은 다시 안 고른다 */
  store.insertSheet('숙제').appendRow(숙제머리);
  assert.equal(e.돌기('2026-11-20T08:10:00').찍은수, 0);
  assert.equal(숙제줄수(store), 0);
  /* 엔진 차례 — 찍기(setValue(찍을)) 가 숙제등록안_ 보다 앞 */
  const 몸 = code.slice(code.indexOf('function 예약숙제_('), code.indexOf('/* ==================================================================\n   알림만 보내기'));
  assert.ok(몸.indexOf('.setValue(찍을)') > -1 && 몸.indexOf('.setValue(찍을)') < 몸.indexOf('숙제등록안_(h)'));
});

test('5. 보낸때가 찍힌 줄은 다시 안 고른다', () => {
  const e = 엔진(판());
  걸기(e);
  assert.equal(e.돌기('2026-11-20T08:00:00').찍은수, 1);
  assert.equal(e.돌기('2026-11-20T08:10:00').찍은수, 0);
  assert.equal(e.돌기('2026-11-21T08:10:00').찍은수, 0, '다음 날에도 — 한 번짜리다');
  assert.equal(숙제줄수(e.store), 1);
});

test('6. 켬이 꺼진 줄은 안 나간다 — 다시 켜면 나간다 · 지우면 없다', () => {
  const e = 엔진(판());
  걸기(e); 걸기(e, { 시각: '09:00' });
  const [나중, 먼저] = e.call('숙제예약목록', 비번).예약;      // 새것부터
  assert.equal(e.call('숙제예약켜기', 비번, 먼저.행, false, 먼저.키).예약.find(n => n.행 === 먼저.행).켬, false);
  assert.equal(e.call('숙제예약켜기', 비번, 먼저.행, false, 'wrong-key').ok, false, '줄이 밀렸으면 건드리지 않는다');
  assert.equal(e.돌기('2026-11-20T08:30:00').찍은수, 0);
  e.call('숙제예약켜기', 비번, 먼저.행, true, 먼저.키);
  assert.equal(e.돌기('2026-11-20T08:40:00').찍은수, 1);
  assert.equal(e.call('숙제예약지우기', 비번, 나중.행, 나중.키).예약.length, 1);
  assert.equal(e.돌기('2026-11-20T09:10:00').찍은수, 0, '지운 것은 안 나간다');
  assert.equal(숙제줄수(e.store), 1);
});

test('7. 당일 숙제는 나가는 날이 마감이다 (예약한 날이 아니라)', () => {
  for (const 종류 of ['당일', '보충']) {
    const e = 엔진(판(), '2026-11-19T20:00:00');
    /* 화면의 마감일 칸에 남은 값이 실려 와도 담을 때 비운다 */
    assert.equal(걸기(e, { 내용: 꾸러미({ 종류, 마감일: '2026-11-19' }) }).ok, true);
    assert.equal(JSON.parse(예약칸(e.store, 2, 5)).마감일, '', 종류 + ' — 마감일을 미리 못 박지 않는다');
    e.돌기('2026-11-20T08:00:00');
    assert.equal(숙제줄(e.store)[5], '2026-11-20', 종류);
    assert.equal(숙제줄(e.store)[8], 종류);
  }
});

test('8. 기한 · 시험 숙제는 예약할 때 정한 마감일 그대로다', () => {
  for (const 종류 of ['기한', '시험']) {
    const e = 엔진(판());
    assert.equal(걸기(e, { 내용: 꾸러미({ 종류, 마감일: '2026-11-25' }) }).ok, true);
    e.돌기('2026-11-20T08:00:00');
    assert.equal(숙제줄(e.store)[5], '2026-11-25', 종류);
  }
});

test('9. 단어장을 배우는 아이가 없어 등록이 실패하면 보낸때에 까닭이 남고 숙제는 안 생긴다', () => {
  const e = 엔진(판());
  걸기(e, { 내용: 꾸러미({ 단어장: '지운책' }) });
  const r = e.돌기('2026-11-20T08:00:00');
  assert.equal(r.낸것[0].됐나, false);
  assert.match(r.낸것[0].메시지, /지운책.*배우는 학생이 없습니다/);
  assert.equal(숙제줄수(e.store), 0);
  const n = e.call('숙제예약목록', 비번).예약[0];
  assert.match(n.보낸때, /^2026-11-20 08:00 못 냄 — /);
  assert.match(n.못냄, /지운책.*배우는 학생이 없습니다/, '선생님 화면이 띄울 까닭');
  /* 고쳐서 다시 걸면(같은 줄) 보낸때를 비워 다시 나간다 */
  assert.equal(e.call('숙제예약저장', 비번, n.행, { 키: n.키, 날짜: '2026-11-20', 시각: '08:00', 내용: 꾸러미() }).ok, true);
  assert.equal(e.돌기('2026-11-20T08:20:00').낸것[0].됐나, true);
  assert.equal(숙제줄수(e.store), 1);
  /* 그날 함수가 못 돌았다 — 다음 날 나가지 않고 까닭만 남긴다 */
  걸기(e, { 날짜: '2026-11-21' });
  const 늦음 = e.돌기('2026-11-22T08:00:00');
  assert.equal(늦음.낸것[0].됐나, false);
  assert.match(늦음.낸것[0].메시지, /2026-11-21/);
  assert.equal(숙제줄수(e.store), 1);
});

test('10. 알림함께 가 꺼져 있으면 구독을 안 돌려준다 · 켜져 있으면 그 숙제 받는 아이 것만', () => {
  const 끔 = 엔진(판());
  걸기(끔, { 알림함께: false });
  const r1 = 끔.돌기('2026-11-20T08:00:00');
  assert.deepEqual(r1.보낼것, []);
  assert.equal(r1.푸시비밀키, undefined);

  const 켬 = 엔진(판());
  걸기(켬, { 알림함께: true });
  const r2 = 켬.돌기('2026-11-20T08:00:00');
  assert.equal(r2.보낼것.length, 1);
  assert.deepEqual(r2.보낼것[0].구독.map(s => s.이름).sort(), ['김영희', '홍길동'], '교재B 박철수는 빠진다');
  assert.equal(r2.보낼것[0].제목, '숙제 나왔어요');
  assert.match(r2.보낼것[0].내용, /교재A 1~20/);
  assert.match(r2.푸시비밀키, /SECRET-D/, '웹 구독이 있으니 함수에 서명 열쇠를 준다');

  /* 고른 학생에게만 낸 숙제면 그 아이만 */
  const 고름 = 엔진(판());
  걸기(고름, { 알림함께: true, 내용: 꾸러미({ 학생들: ['김영희'] }) });
  assert.deepEqual(고름.돌기('2026-11-20T08:00:00').보낼것[0].구독.map(s => s.이름), ['김영희']);
  /* 실패하면 알림도 없다 */
  const 실패 = 엔진(판());
  걸기(실패, { 알림함께: true, 내용: 꾸러미({ 단어장: '지운책' }) });
  assert.deepEqual(실패.돌기('2026-11-20T08:00:00').보낼것, []);
});

test('11. 나간 숙제에 숙제코드가 붙는다', () => {
  const e = 엔진(판());
  걸기(e); 걸기(e);
  e.돌기('2026-11-20T08:00:00');
  assert.equal(숙제줄수(e.store), 2);
  const [a, b] = [숙제줄(e.store, 2)[19], 숙제줄(e.store, 3)[19]];
  assert.match(a, /^h\d{13}[a-z0-9]{4}$/); assert.match(b, /^h\d{13}[a-z0-9]{4}$/);
  assert.notEqual(a, b, '같은 때 둘이 나가도 코드는 서로 다르다');
});

test('12. 시각 기준은 Asia/Seoul 이다', () => {
  const e = 엔진(판());
  걸기(e);
  // 2026-11-19 23:05 UTC = 11/20 08:05 서울. UTC 로 세면 아직 11/19 라 안 나간다
  const r = 일반(e.엔.scheduledHomework(Date.parse('2026-11-19T23:05:00Z')));
  assert.equal(r.오늘, '2026-11-20');
  assert.equal(r.찍은수, 1);
  assert.equal(예약칸(e.store, 2, 7), '2026-11-20 08:05');
  // 2026-11-20 08:05 UTC = 서울 17:05 — 저녁 9시 예약은 아직
  const f = 엔진(판());
  걸기(f, { 시각: '21:00' });
  assert.equal(일반(f.엔.scheduledHomework(Date.parse('2026-11-20T08:05:00Z'))).찍은수, 0);
});

/* ---------------- 저장소(거래) · 함수 쪽 ---------------- */
async function 저장소판(store) {
  const db = fakeDb();
  const { documents } = await createDatasetDocuments(store, { digest });
  for (const [path, data] of documents) db.docs.set(`vocabDatasets/t/${path}`, data);
  return db;
}
const 다리 = db => new FirestoreRepository(db, 't', { role: 'bridge', user: { uid: 'scheduled-homework' } });
const 표 = (db, name) => unpack(db.docs.get(`vocabDatasets/t/tables/${sheetId(name)}`).payload);

test('__예약숙제 — bridge 거래 안에서 보낸때와 숙제 줄이 같이 들어가고, 10분 뒤에는 안 고른다', async () => {
  const 서울오늘 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const store = 판();
  const 예약 = store.insertSheet('숙제예약'); 예약.appendRow(예약머리);
  예약.appendRow([new Date(), 서울오늘, '07:00', '요약', JSON.stringify(꾸러미()), 'O', '', '']);
  const db = await 저장소판(store);
  const 저녁 = 서울(서울오늘 + 'T20:00:00');
  const 할일 = await 다리(db).call('__예약숙제', [저녁]);
  assert.equal(할일.낸것[0].됐나, true);
  assert.equal(할일.보낼것.length, 1);
  assert.equal(표(db, '숙제예약').cells['2:7']?.value, 서울오늘 + ' 20:00', '쏘기 전에 이미 저장돼 있다');
  assert.equal(표(db, '숙제').cells['2:2']?.value, '교재A');
  const journal = [...db.docs.entries()].filter(([k]) => /\/journal\/[^/]+$/.test(k)).map(([, v]) => v);
  assert.ok(journal.some(j => j.fn === '__예약숙제'));
  assert.ok(!journal.some(j => String(j.result).includes('SECRET-D')), 'journal 에는 비밀키를 적지 않는다');
  /* 쏘기는 sendScheduledNotices 그대로 */
  const 앱 = [], 웹 = [];
  const out = await sendScheduledNotices(할일, { messaging: { send: async m => { 앱.push(m.notification); return 'id'; } },
    webPush: { sendNotification: async (s, p) => { 웹.push(JSON.parse(p)); return { statusCode: 201 }; } } });
  assert.equal(out.보냄, 2);
  assert.deepEqual(앱, [{ title: '숙제 나왔어요', body: '교재A 1~20 · 스펠링' }]);
  assert.deepEqual(웹, [{ 제목: '숙제 나왔어요', 내용: '교재A 1~20 · 스펠링' }]);
  const 다음 = await 다리(db).call('__예약숙제', [저녁 + 600000]);
  assert.equal(다음.찍은수, 0);
  assert.equal(Object.keys(표(db, '숙제').cells).filter(k => k.startsWith('3:')).length, 0, '숙제는 한 번만');
});

test('__예약숙제 는 bridge 만 — 선생님 · 아무나 는 못 부른다. 선생님 넷은 비번을 거친다', async () => {
  const db = await 저장소판(판());
  const 선생님 = new FirestoreRepository(db, 't', { user: { uid: 'teacher-uid-abc', getIdToken: async () => '' } });
  assert.deepEqual(await 선생님.call('선생님로그인', [비번]), { ok: true });
  assert.equal((await 선생님.call('__예약숙제', [Date.now()])).ok, false);
  const 아무나 = new FirestoreRepository(db, 't', { user: { uid: 'anon-uid-abc', getIdToken: async () => '' } });
  assert.equal((await 아무나.call('__예약숙제', [Date.now()])).ok, false);
  for (const fn of ['숙제예약목록', '숙제예약저장', '숙제예약지우기', '숙제예약켜기']) {
    assert.match(code, new RegExp(`  ${fn}: ${fn},`), fn + ' 은 열린기능_ 에');
    assert.equal(createRuntime(판()).call(fn, ['0000', 2, {}]).ok, false, fn + ' — 비번이 틀리면 막힌다');
  }
});

test('함수 — scheduledHomework 는 scheduledNotices 옆에 따로, 10분마다, sendScheduledNotices 로 쏜다', () => {
  assert.match(fnSrc, /export const scheduledHomework = onSchedule\(\{ region, schedule: '\*\/10 \* \* \* \*', timeZone: 'Asia\/Seoul' \}/);
  assert.match(fnSrc, /export const scheduledNotices = onSchedule\(\{ region, schedule: '\*\/10 \* \* \* \*', timeZone: 'Asia\/Seoul' \}, async \(\) => \{\n  console\.log\(JSON\.stringify\(await runScheduledNotices\(\)\)\);\n\}\);/,
    'scheduledNotices 는 그대로');
  const 몸 = fnSrc.slice(fnSrc.indexOf('export async function runScheduledHomework'), fnSrc.indexOf('export const scheduledHomework'));
  assert.match(몸, /repo\.call\('__예약숙제', \[now\]\)/);
  assert.match(몸, /sendScheduledNotices\(할일, \{ messaging, webPush, repo \}\)/);
  assert.doesNotMatch(몸, /__예약알림|messaging\.send|sendNotification/, '알림 예약을 섞지 않고, 쏘는 코드를 새로 쓰지 않는다');
});

test('선생님 화면 — 지금 내기/예약하기, 7~21시만, 0~9분 안내, 못 나간 것은 빨갛게', () => {
  assert.match(teacher, /name="hwWhen" value="now" checked><span>지금 내기/);
  assert.match(teacher, /name="hwWhen" value="later"><span>예약하기/);
  assert.match(teacher, /나갈 때 알림도 보내기/);
  assert.match(teacher, /8시로 걸면 8시 0~9분 사이에 나갑니다/);
  const 시각 = new Function(teacher.slice(teacher.indexOf('function 숙제예약시각들_(){'), teacher.indexOf('function 숙제예약내일_(){')) + '\nreturn 숙제예약시각들_();')();
  assert.equal(시각[0], '07:00'); assert.equal(시각[시각.length - 1], '21:00');
  assert.ok(!시각.some(t => t < '07:00' || t > '21:00'));
  assert.match(teacher, /api\('숙제예약저장',T\.pw,''/);
  for (const fn of ['숙제예약목록', '숙제예약켜기', '숙제예약지우기']) assert.match(teacher, new RegExp(`api\\('${fn}'`));
  assert.match(teacher, /예약한 숙제 '\+못\.length\+'건이 나가지 못했습니다/);
  assert.match(teacher, /<span class="pill fail">못 나감<\/span>/);
});

/* ---------------- 프롬프트 54 — 걸어 둔 예약에 누가 받는지 ---------------- */
test('54-1. 학생을 골라 낸 예약은 고른 이름들이 그대로 나온다', () => {
  const e = 엔진(판());
  걸기(e, { 내용: 꾸러미({ 학생들: ['박철수', '홍길동'] }) });
  const [n] = e.call('숙제예약목록', 비번).예약;
  assert.deepEqual(n.받는이들, ['박철수', '홍길동']);
  assert.equal(n.교재로, false);
});

test('54-2. 교재로 낸 예약은 그 교재를 배우는 아이들이 나오고 교재로 가 참이다', () => {
  const e = 엔진(판());
  걸기(e);
  const [n] = e.call('숙제예약목록', 비번).예약;
  assert.deepEqual(n.받는이들, ['홍길동', '김영희']);
  assert.equal(n.교재로, true);
  /* 숙제받을아이_ 를 그대로 쓴다 — 대상 펼치는 계산을 새로 쓰지 않는다 */
  const 몸 = code.slice(code.indexOf('function 숙제예약목록('), code.indexOf('function 숙제예약저장('));
  assert.match(몸, /숙제받을아이_\(h, 전체\)/);
  assert.doesNotMatch(몸, /교재학생_|이름들풀기_/);
});

test('54-3. 그 교재를 배우는 아이가 바뀌면 받는이들도 바뀐다', () => {
  const e = 엔진(판());
  걸기(e);
  e.store.getSheetByName('학생').getRange(4, 8).setValue('교재A');    // 박철수가 교재A 로
  e.store.getSheetByName('학생').getRange(2, 8).setValue('교재B');    // 홍길동은 교재B 로
  assert.deepEqual(e.call('숙제예약목록', 비번).예약[0].받는이들, ['김영희', '박철수']);
});

test('54-4. 이미 나간 줄은 받는이들이 비어 있다 (못 나간 줄도)', () => {
  const e = 엔진(판());
  걸기(e); 걸기(e, { 날짜: '2026-11-21' }); 걸기(e, { 내용: 꾸러미({ 단어장: '지운책' }) });
  e.돌기('2026-11-20T08:00:00');
  const [못, 남음, 나감] = e.call('숙제예약목록', 비번).예약;
  assert.ok(나감.보낸때 && !나감.못냄);
  assert.deepEqual(나감.받는이들, [], '그때 누가 받았는지 모른다 — 지금 기준으로 세지 않는다');
  assert.ok(못.못냄);
  assert.deepEqual(못.받는이들, []);
  assert.deepEqual(남음.받는이들, ['홍길동', '김영희'], '아직 안 나간 줄은 그대로');
});

test('54-5. 저장된 요약 칸은 안 바뀐다', () => {
  const e = 엔진(판());
  걸기(e); 걸기(e, { 내용: 꾸러미({ 학생들: ['홍길동', '김영희', '박철수'] }) });
  const 전 = [예약칸(e.store, 2, 4), 예약칸(e.store, 3, 4)];
  e.store.getSheetByName('학생').getRange(4, 8).setValue('교재A');
  const 목록 = e.call('숙제예약목록', 비번).예약;
  assert.deepEqual([예약칸(e.store, 2, 4), 예약칸(e.store, 3, 4)], 전);
  assert.deepEqual(목록.map(n => n.요약).reverse(), 전, '목록의 요약도 표에 적힌 그대로');
  assert.match(전[1], /홍길동, 김영희 외 1명/);
});

test('54-6. 받을 아이가 아무도 없으면 빈 목록이 나온다 (터지지 않는다)', () => {
  const e = 엔진(판());
  걸기(e, { 내용: 꾸러미({ 단어장: '아무도안배움' }) });
  걸기(e, { 내용: 꾸러미({ 단어장: '아무도안배움', 학생들: ['없는아이'] }) });
  const r = e.call('숙제예약목록', 비번);
  assert.equal(r.ok, true);
  assert.deepEqual(r.예약.map(n => [n.받는이들, n.교재로]), [[[], true], [[], true]]);
  /* 내용 칸이 깨진 줄도 터지지 않는다 */
  e.store.getSheetByName('숙제예약').getRange(2, 5).setValue('{깨짐');
  assert.deepEqual(e.call('숙제예약목록', 비번).예약.map(n => n.받는이들), [[], []]);
});

test('54-7. 선생님 화면 — 사람 수 · 누르면 펼침 · 교재로는 「지금 기준」 · 나간 줄은 안 눌린다', () => {
  const 몸 = teacher.slice(teacher.indexOf('function 숙제예약그리기_(){'), teacher.indexOf('/* 안 낸 숙제를'));
  assert.match(몸, /<span class="hscount">· '\+받는\.length\+'명<\/span>/);
  assert.match(몸, /var 열림 = !n\.보낸때/, '나간 줄(보낸때 찍힘)은 펼치지 않는다');
  assert.match(몸, /받는\.map\(esc\)\.join\(', '\)/, '이름을 줄이지 않는다');
  assert.doesNotMatch(몸, /외 '\s*\+/, '「외 n명」 으로 줄이지 않는다');
  assert.match(몸, /지금 기준입니다 — 나갈 때 교재가 바뀌면 달라집니다/);
  assert.doesNotMatch(몸, /localStorage|sessionStorage/, '펼친 상태는 저장하지 않는다');
  assert.match(teacher, /\.tb tr\.hsopen\{cursor:pointer/);
});
