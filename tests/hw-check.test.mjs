// 프롬프트 55 — 숙제 체크 오버레이(check.html)를 인왕보카로. 체크설정 한 줄 · 체크기록 날마다 한 줄 (JSON 글).
// 학생은 학생번호로 가리킨다. 앱으로 숙제가 나간 아이는 저절로 ○ (숙제체크 의 못 받은 아이를 뺀 나머지) — 손으로 못 끈다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';
import { pack, unpack, publicTable } from '../services/store-codec.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = read('./fixtures/legacy/Code.gs'), check = read('../check.html');
const appBuild = read('../scripts/build-app.mjs');
const 일반 = x => JSON.parse(JSON.stringify(x));
const 비번 = '5678';
const 서울 = t => new Date(t + '+09:00').getTime();

/* check.html 의 「체크 셈」 — 화면(DOM)을 안 쓰는 셈만 떼어서 돌린다 */
const 셈 = new Function(check.slice(check.indexOf('/* ==== 체크 셈 시작'), check.indexOf('/* ==== 체크 셈 끝 ==== */')) +
  '\nreturn { 명단맞추기, 줬나, 손으로뒤집기, 옛자료옮기기, 레슨들, 레슨이름, 범위맞추기, 다음범위, 진도로, 붙인글읽기 };')();

/** 3A: 홍길동(교재A) · 김영희(교재A) · 이철수(교재B) / 3B: 박철수(교재B) / 번호 없는 새 아이: 새친구 */
function 엔진(처음 = '2026-11-18T15:00:00') {
  let 시계 = 서울(처음);
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 비번]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디', '학생번호']);
  for (const [반, 이름, 교재, 번호] of [['3A', '홍길동', '교재A', 's_hong'], ['3A', '김영희', '교재A', 's_kim'],
                                       ['3A', '이철수', '교재B', 's_lee'], ['3B', '박철수', '교재B', 's_park'], ['', '새친구', '교재A', '']]) {
    학생.appendRow([반, 이름, '1234', '', '', '중2', '', 교재, '', '', '', 번호]);
  }
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 기록머리 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'];
  store.insertSheet('기록').appendRow(기록머리);
  store.insertSheet('기록보관').appendRow(기록머리);
  store.insertSheet('숙제').appendRow(['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류']);
  const 엔 = createRuntime(store, { now: () => 시계 });
  const call = (fn, ...args) => 일반(엔.call(fn, args));
  return { store, call, 때: t => { 시계 = 서울(t); }, 자료: (날 = '2026-11-18') => call('체크자료', 비번, 날) };
}
const 칸 = (store, 표, 행, 열) => store.getSheetByName(표).getRange(행, 열).getValue();
const 설정본 = () => ({
  groups: [{ id: 'g1', name: '월수금 4시 "A"반', tracks: [{ book: 'b1', lesson: 2, end: 4, moved: '2026-11-17', ts: 1763300000000 }],
             subs: [{ id: 'u1', name: '1단계', ids: ['s_hong', 's_kim'], tracks: [{ book: 'b2', lesson: 0, end: 0, moved: null, ts: 0, span: 2 }] },
                    { id: 'u2', name: '2단계 — 리딩\n줄바꿈 · 이모지 👍', ids: ['s_lee'], tracks: [] }] }],
  books: [{ id: 'b1', name: '해법 Grammar 1', lessons: ['Unit 1 be동사', 'Unit 2 일반동사', "it's \\ 백슬래시", 'U4', 'U5'] },
          { id: 'b2', name: '리딩튜터 1', lessons: ['Lesson 1', 'Lesson 2'] }],
  view: { group: 'all', folded: { g1: false } },
  옮김: null,
});

test('1. 설정을 담고 다시 읽으면 같은 것이 나온다 — 칸에는 JSON 글, Firestore 로 묶고 풀어도 같다', () => {
  const e = 엔진();
  const 원래 = 설정본();
  const w = e.call('체크설정저장', 비번, 원래, 0);
  assert.equal(w.ok, true, JSON.stringify(w));
  const 글 = 칸(e.store, '체크설정', 2, 2);
  assert.equal(typeof 글, 'string', '칸에는 글이 들어간다');
  assert.deepEqual(JSON.parse(글), 원래);
  assert.deepEqual(e.자료().설정, 원래, '체크자료로 다시 읽어도 같다');
  assert.equal(e.자료().설정까닭, '');
  /* 저장소(Firestore)에 묶어 올렸다 내려도 같다 — pack · unpack · publicTable */
  const 내린 = unpack(pack(publicTable(e.store.getSheetByName('체크설정').export())));
  assert.deepEqual(JSON.parse(내린.cells['2:2'].value), 원래);
  /* 체크기록도 */
  const 오늘 = { s_hong: { 줬나: true, 메모: 'Unit 3 p.12~15 "다시"' }, s_lee: { 줬나: false, 메모: '' } };
  assert.equal(e.call('체크기록저장', 비번, '2026-11-18', 오늘).ok, true);
  assert.equal(typeof 칸(e.store, '체크기록', 2, 2), 'string');
  assert.equal(칸(e.store, '체크기록', 2, 1), '2026-11-18', '날짜는 글로 (날짜 꼴로 바뀌지 않게)');
  assert.deepEqual(e.자료().오늘, 오늘);
  /* 글로 보내도 같은 것 */
  assert.equal(e.call('체크기록저장', 비번, '2026-11-18', JSON.stringify(오늘)).ok, true);
  assert.deepEqual(e.자료().오늘, 오늘);
  assert.equal(e.store.getSheetByName('체크기록').getLastRow(), 2, '같은 날은 한 줄을 통째로 바꾼다');
});

test('2. 객체를 그대로 넣으려 해도 [object Object] 가 저장되지 않는다', () => {
  const e = 엔진();
  assert.equal(e.call('체크설정저장', 비번, { groups: [] }, 0).ok, true);
  assert.notEqual(칸(e.store, '체크설정', 2, 2), '[object Object]');
  assert.equal(칸(e.store, '체크설정', 2, 2), '{"groups":[]}');
  for (const 나쁜 of ['[object Object]', '{깨짐', '', '[1,2]', [1, 2], null, 3]) {
    const r = e.call('체크설정저장', 비번, 나쁜, Date.now() * 2, true);
    assert.equal(r.ok, false, JSON.stringify(나쁜));
    const r2 = e.call('체크기록저장', 비번, '2026-11-18', 나쁜);
    assert.equal(r2.ok, false, JSON.stringify(나쁜));
  }
  assert.equal(칸(e.store, '체크설정', 2, 2), '{"groups":[]}', '나쁜 것은 아무것도 안 바꾼다');
  assert.equal(e.store.getSheetByName('체크기록')?.getLastRow() ?? 1, 1);
  /* 엔진 — 칸에 넣는 곳은 체크글쓰기_ 를 거친 글뿐 */
  const 몸 = code.slice(code.indexOf('function 체크설정저장('), code.indexOf('function 숙제등록('));
  assert.match(몸, /글 = 체크글쓰기_\(내용\)/);
  assert.doesNotMatch(몸, /setValues\(\[\[[^\]]*내용[^\]]*\]\]\)/, '내용(객체)을 칸에 바로 넣지 않는다');
});

test('3. 읽을 때 JSON 이 깨져 있으면 까닭이 남는다 (조용히 빈 값이 되지 않는다)', () => {
  const e = 엔진();
  e.call('체크설정저장', 비번, 설정본(), 0);
  e.call('체크기록저장', 비번, '2026-11-17', { s_hong: { 줬나: true, 메모: '어제' } });
  e.call('체크기록저장', 비번, '2026-11-18', { s_kim: { 줬나: true, 메모: '' } });
  e.store.getSheetByName('체크설정').getRange(2, 2).setValue('{"groups":[ 끊김');
  e.store.getSheetByName('체크기록').getRange(2, 2).setValue('[object Object]');
  e.store.getSheetByName('체크기록').getRange(3, 2).setValue({ 객체: '그대로' });
  const r = e.자료();
  assert.equal(r.ok, true);
  assert.equal(r.설정, null);
  assert.match(r.설정까닭, /체크설정 2행 — JSON 으로 읽히지 않습니다/);
  assert.match(r.지난기록[0].까닭, /체크기록 2행\(2026-11-17\) — JSON 으로 읽히지 않습니다: \[object Object\]/);
  assert.match(r.오늘까닭, /체크기록 3행\(2026-11-18\) — 글이 아닌 것이 들어 있습니다/);
  /* 화면은 까닭을 띄우고, 체크설정이 안 읽히면 덮어쓰지 않고 멈춘다 */
  assert.match(check, /설정막힘 = r\.설정까닭 \|\| ''/);
  assert.match(check, /if \(set !== 보낸설정글 && !설정막힘 && !충돌\)/);
  assert.match(check, /서버 자료 일부를 읽지 못했어요/);
});

test('4. 체크기록은 서른 날까지 — 넘은 줄은 저장할 때 지워진다', () => {
  const e = 엔진();
  for (const d of ['2026-10-01', '2026-10-18', '2026-10-19', '2026-11-01', '2026-11-17']) {
    assert.equal(e.call('체크기록저장', 비번, d, { s_hong: { 줬나: true, 메모: d } }).ok, true);
  }
  /* 10-01 은 11-01 을 저장할 때 이미 지워졌다. 서른 날 넘은 줄을 표에 직접 넣어 둬도 다음 저장 때 지워진다 */
  e.store.getSheetByName('체크기록').appendRow(['2026-09-01', '{}']);
  const r = e.call('체크기록저장', 비번, '2026-11-18', { s_kim: { 줬나: true, 메모: '' } });
  assert.equal(r.지운수, 2, '10-18 · 09-01');
  const 남은 = e.store.getSheetByName('체크기록').getRange(2, 1, e.store.getSheetByName('체크기록').getLastRow() - 1, 1).getValues().map(x => x[0]);
  assert.deepEqual(남은, ['2026-10-19', '2026-11-01', '2026-11-17', '2026-11-18'], '10-19 = 서른 날 전까지 남는다');
  assert.deepEqual(e.자료().지난기록.map(x => x.날짜), ['2026-11-17', '2026-11-01', '2026-10-19'], '지난 메모는 새것부터');
});

test('5. 체크자료가 학생 번호 · 이름 · 반을 준다 (번호 없는 아이는 아직 안 싣는다)', () => {
  const e = 엔진();
  const r = e.자료();
  assert.deepEqual(r.학생들, [
    { 번호: 's_hong', 이름: '홍길동', 반: '3A' }, { 번호: 's_kim', 이름: '김영희', 반: '3A' },
    { 번호: 's_lee', 이름: '이철수', 반: '3A' }, { 번호: 's_park', 이름: '박철수', 반: '3B' }]);
  assert.equal(r.날짜, '2026-11-18');
  assert.equal(e.call('체크자료', '0000').ok, false, '선생님 비번을 거친다');
  for (const fn of ['체크자료', '체크설정저장', '체크기록저장']) {
    assert.match(code, new RegExp(`  ${fn}: ${fn},`), fn + ' 은 열린기능_ 에');
    assert.equal(e.call(fn, '0000', '2026-11-18', {}).ok, false, fn + ' — 비번이 틀리면 막힌다');
  }
});

test('6. 인왕보카에서 빠진 아이의 번호는 단계에서도 안 나온다', () => {
  const e = 엔진();
  e.call('체크설정저장', 비번, 설정본(), 0);
  e.store.getSheetByName('학생').deleteRow(3);                          // 김영희가 학원을 그만뒀다
  const r = e.자료();
  assert.ok(!r.학생들.some(x => x.번호 === 's_kim'));
  const 설정 = r.설정;
  assert.deepEqual(설정.groups[0].subs[0].ids, ['s_hong', 's_kim'], '서버 설정에는 남아 있어도');
  assert.equal(셈.명단맞추기(설정.groups, r.학생들.map(x => x.번호)), 1);
  assert.deepEqual(설정.groups[0].subs[0].ids, ['s_hong'], '화면에서는 단계에서 빠진다');
  assert.deepEqual(설정.groups[0].subs[1].ids, ['s_lee']);
});

test('7. 앱으로 숙제가 나간 아이는 저절로 ○ 로 온다', () => {
  const e = 엔진();
  assert.deepEqual(e.자료().앱받은, []);
  e.때('2026-11-18T16:00:00');
  assert.equal(e.call('숙제등록', 비번, { 단어장: '교재A', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '당일', 학생들: [] }).ok, true);
  assert.deepEqual(e.자료().앱받은, ['s_hong', 's_kim'], '교재A 를 배우는 아이 (번호 없는 새친구는 아직 안 실린다)');
  e.call('숙제등록', 비번, { 단어장: '교재B', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '당일', 학생들: ['박철수'] });
  assert.deepEqual(e.자료().앱받은, ['s_hong', 's_kim', 's_park']);
  assert.deepEqual(e.자료('2026-11-17').앱받은, [], '다른 날은 따로');
  /* 시험은 숙제가 아니다 */
  e.call('숙제등록', 비번, { 단어장: '교재B', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '시험', 마감일: '2026-11-20', 학생들: ['이철수'] });
  assert.ok(!e.자료().앱받은.includes('s_lee'));
  const 앱 = new Set(e.자료().앱받은);
  assert.equal(셈.줬나({}, 앱, 's_hong'), true, '손으로 안 눌러도 ○');
  assert.equal(셈.줬나({}, 앱, 's_lee'), false);
  /* 엔진은 숙제체크 를 그대로 쓴다 — 받을 아이를 따로 세지 않는다 */
  const 몸 = code.slice(code.indexOf('function 체크자료('), code.indexOf('function 체크설정저장('));
  assert.match(몸, /숙제체크\(비번, 날\)/);
});

test('8. 저절로 켜진 ○ 는 손으로 꺼도 안 꺼진다', () => {
  const 앱 = new Set(['s_hong']);
  const status = {};
  assert.equal(셈.손으로뒤집기(status, 앱, 's_hong'), false, '아무 일도 없다');
  assert.equal(셈.줬나(status, 앱, 's_hong'), true);
  assert.deepEqual(status, {}, '손 기록도 안 바뀐다');
  /* 서버 기록에 줬나:false 가 적혀 있어도 앱 ○ 는 그대로 */
  const e = 엔진();
  e.call('숙제등록', 비번, { 단어장: '교재A', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '당일', 학생들: ['홍길동'] });
  e.call('체크기록저장', 비번, '2026-11-18', { s_hong: { 줬나: false, 메모: '' } });
  const r = e.자료();
  assert.equal(셈.줬나({ s_hong: { done: r.오늘.s_hong.줬나 } }, new Set(r.앱받은), 's_hong'), true);
  /* 화면 — 누르기는 손으로뒤집기 를 거치고, 「앱」 표시를 붙인다 */
  assert.match(check, /const toggle = \(\) => \{ if \(!손으로뒤집기\(data\.status, 앱, id\)\) return;/);
  assert.match(check, /el\('span', 'appTag', '앱'\)/);
});

test('9. 손으로 켠 ○ 는 손으로 꺼진다', () => {
  const 앱 = new Set(['s_hong']);
  const status = {};
  assert.equal(셈.손으로뒤집기(status, 앱, 's_kim'), true);
  assert.equal(셈.줬나(status, 앱, 's_kim'), true);
  assert.equal(셈.손으로뒤집기(status, 앱, 's_kim'), true);
  assert.equal(셈.줬나(status, 앱, 's_kim'), false);
});

test('10. 설정 저장 — 들고 있던 고친때보다 서버가 새것이면 알려 주고 쓰지 않는다', () => {
  const e = 엔진();
  const 처음 = e.call('체크설정저장', 비번, { groups: [], books: [], 판: 'PC' }, 0);
  assert.equal(처음.ok, true);
  e.때('2026-11-18T15:01:00');
  const 집 = e.call('체크설정저장', 비번, { groups: [], books: [], 판: '집' }, 처음.고친때);
  assert.equal(집.ok, true, '들고 있던 것이 최신이면 그냥 쓴다');
  assert.ok(집.고친때 > 처음.고친때);
  /* PC 는 아직 처음 것을 들고 있다 */
  const pc = e.call('체크설정저장', 비번, { groups: [], books: [], 판: 'PC 두 번째' }, 처음.고친때);
  assert.equal(pc.ok, false);
  assert.equal(pc.새것있음, true);
  assert.equal(pc.고친때, 집.고친때);
  assert.equal(pc.설정.판, '집', '새것을 같이 준다 (불러올 수 있게)');
  assert.equal(e.자료().설정.판, '집', '덮어쓰지 않았다');
  /* 그래도 덮어쓰겠다고 하면 */
  const 덮 = e.call('체크설정저장', 비번, { groups: [], books: [], 판: 'PC 덮어씀' }, 처음.고친때, true);
  assert.equal(덮.ok, true);
  assert.equal(e.자료().설정.판, 'PC 덮어씀');
  /* 같은 때에 두 번 써도 고친때는 커진다 */
  const 또 = e.call('체크설정저장', 비번, { groups: [] }, 덮.고친때);
  assert.ok(또.고친때 > 덮.고친때);
});

test('옮기기 — 옛 자료의 이름을 학생번호로. 못 찾은 이름은 버리지 않고 알려 준다', () => {
  const 학생들 = [{ 번호: 's_hong', 이름: '홍길동' }, { 번호: 's_kim', 이름: '김영희' }, { 번호: 's_a', 이름: '이하나' }, { 번호: 's_b', 이름: '이하나' }];
  const old = {
    students: [{ id: 's1', name: '홍길동' }, { id: 's2', name: '김 영희' }, { id: 's3', name: '없는아이' }, { id: 's4', name: '이하나' }],
    groups: [{ id: 'g1', name: '월수금', tracks: [], subs: [{ id: 'u1', name: '1단계', ids: ['s1', 's3'], tracks: [{ book: 'b1', lesson: 3, end: 4 }] },
                                                           { id: 'u2', name: '2단계', ids: ['s2', 's4'], tracks: [] }] }],
    books: [{ id: 'b1', name: '해법 Grammar 1', lessons: ['U1', 'U2', 'U3', 'U4', 'U5'] }],
    view: { group: 'g1', folded: {} }, day: '2026-11-17', status: {}, history: {},
  };
  const 전 = JSON.stringify(old);
  const r = 셈.옛자료옮기기(old, 학생들);
  assert.equal(JSON.stringify(old), 전, '옛 자료는 건드리지 않는다');
  assert.deepEqual(r.설정.groups[0].subs.map(s => s.ids), [['s_hong'], ['s_kim']], '띄어쓰기만 다른 이름은 찾는다');
  assert.equal(r.설정.groups[0].subs[0].tracks[0].옛교재, '해법 Grammar 1 · U4 ~ U5', '단어장 목록이 없으면 옛 교재로 남긴다 (56)');
  assert.equal(r.설정.books, undefined, '손으로 적은 교재는 올리지 않는다 (56)');
  assert.deepEqual(r.못찾은, [{ 이름: '없는아이', 자리: '월수금 › 1단계', 까닭: '' },
                             { 이름: '이하나', 자리: '월수금 › 2단계', 까닭: '인왕보카에 「이하나」 이 2명이에요' }]);
  assert.equal(r.옮긴수, 2);
  /* 화면 — localStorage 는 읽기만, 한 번 올리면 단추를 숨긴다 */
  assert.doesNotMatch(check, /localStorage\.(removeItem|setItem)\(KEY/, '옛 자료를 지우거나 바꾸지 않는다');
  assert.doesNotMatch(check, /localStorage\.clear/);
  assert.match(check, /\$\('importBtn'\)\.hidden = !\(옛자료\(\) && !\(data\.옮김 && data\.옮김\.때\)\)/);
  assert.match(check, /인왕보카 명단에서 못 찾은 이름/);
});

test('화면 — 같은 로그인 길 · 1.5초 모아 저장 · 앱 번들에 안 넣음 · 화면 위 띄우기 그대로', () => {
  assert.match(check, /부르기\('선생님로그인', pw\)/);
  assert.match(check, /const 자동열쇠 = 'hb_auto';/, 'teacher.html 과 같은 자동 로그인 기억');
  assert.match(check, /\/\* BEGIN GENERATED services\/api-client\.js \*\//);
  assert.match(check, /const 모으는초 = 1500;/);
  assert.match(check, /function save\(\) \{ clearTimeout\(saveTimer\); saveTimer = setTimeout\(flush, 모으는초\); \}/);
  assert.doesNotMatch(check, /memo\.oninput = \(\) => \{[^}]*부르기/, '메모를 칠 때마다 서버를 부르지 않는다');
  assert.match(check, /documentPictureInPicture\.requestWindow/);
  assert.match(check, /안 준 애만/);
  assert.doesNotMatch(appBuild, /check\.html/, '아이들 앱 번들(FILES)에 넣지 않는다');
  /* 그룹 편집은 # · ## 만 — 이름 줄은 안 받는다 */
  assert.match(check, /\} else 이름줄\+\+;/);
  assert.match(check, /아직 어느 단계에도 없는 아이/);
  /* 그룹은 반이 아니다 — 반으로 묶지 않는다 */
  assert.doesNotMatch(check.slice(check.indexOf('function render()'), check.indexOf('// ---------- 아직 어느')), /\.ban/);
});

/* ---------------- 프롬프트 56 — 교재 = 인왕보카 단어장 · 진도는 단어 번호 범위 ---------------- */
const 책 = (이름, 레슨묶음, 단어수) => ({ 이름, 레슨묶음, 단어수 });

test('56-1. 체크자료가 단어장 목록(이름 · 레슨묶음 · 단어 수)을 준다 — 레슨묶음이 비면 기본레슨', () => {
  const e = 엔진();
  const 목록 = e.store.getSheetByName('단어장목록');
  목록.appendRow(['600-1', '단어', '단어_600_1', '', 10, '']);
  목록.appendRow(['중2 필수', '단어', '단어_중2', '', '', '']);
  const 단어 = (이름, n) => { const sh = e.store.insertSheet(이름); sh.appendRow(['번호', '영어', '뜻']); for (let i = 1; i <= n; i++) sh.appendRow([i, 'w' + i, '뜻' + i]); };
  단어('단어_600_1', 95); 단어('단어_중2', 23);
  assert.deepEqual(e.자료().단어장들, [{ 이름: '600-1', 레슨묶음: 10, 단어수: 95 }, { 이름: '중2 필수', 레슨묶음: 10, 단어수: 23 }]);
  assert.match(code, /단어장목록\(\)\.forEach\(function \(b\) \{ 단어장들\.push\(\{ 이름: b\.이름, 레슨묶음: b\.레슨, 단어수: b\.개수 \}\); \}\);/,
    '엔진의 단어장목록(레슨크기_ = 기본레슨) 을 그대로 쓴다');
});

test('56-2 · 3 · 4. 레슨 5 는 41~50 · 레슨묶음이 비면 10 · 단어 수를 넘으면 끝에서 자른다', () => {
  const ls = 셈.레슨들(책('600-1', 10, 95));
  assert.equal(셈.레슨이름(ls[4]), '레슨 5 (41~50)');
  assert.deepEqual(ls.at(-1), { 번호: 10, 시작: 91, 끝: 95 }, '마지막 레슨은 단어 수에서 잘린다');
  assert.deepEqual(셈.레슨들(책('빈 묶음', '', 25)).map(셈.레슨이름), ['레슨 1 (1~10)', '레슨 2 (11~20)', '레슨 3 (21~25)']);
  assert.deepEqual(셈.레슨들(책('8개씩', 8, 20)).map(l => [l.시작, l.끝]), [[1, 8], [9, 16], [17, 20]]);
  assert.deepEqual(셈.범위맞추기(책('600-1', 10, 95), 91, 100), { 시작: 91, 끝: 95 });
  assert.deepEqual(셈.범위맞추기(책('600-1', 10, 95), 120, 130), { 시작: 95, 끝: 95 });
  assert.deepEqual(셈.진도로({ 단어장: '600-1', 시작: 81, 끝: 120, ts: 3 }, [], [책('600-1', 10, 95)]).진도,
    { 단어장: '600-1', 시작: 81, 끝: 95, 옮긴날: null, ts: 3 }, '담긴 진도도 읽을 때 잘린다');
});

test('56-5 · 6. 다음 ▶ 은 범위 크기만큼 · 끝에서는 멈추고 알려 준다 · 다음 단어장으로 안 넘어간다', () => {
  const b = 책('600-1', 10, 95);
  assert.deepEqual(셈.다음범위(b, { 시작: 41, 끝: 50 }, 1).범위, { 시작: 51, 끝: 60 });
  assert.deepEqual(셈.다음범위(b, { 시작: 41, 끝: 60 }, 1).범위, { 시작: 61, 끝: 80 }, '두 레슨씩이면 두 레슨씩');
  assert.deepEqual(셈.다음범위(b, { 시작: 81, 끝: 90 }, 1).범위, { 시작: 91, 끝: 95 }, '끝에서 잘린다');
  const 끝 = 셈.다음범위(b, { 시작: 91, 끝: 95 }, 1);
  assert.equal(끝.범위, undefined, '끝에서는 안 움직인다');
  assert.equal(끝.말, '「600-1」 끝이에요 (95번까지). 다음에 할 단어장을 골라 주세요.');
  assert.deepEqual(셈.다음범위(b, { 시작: 41, 끝: 50 }, -1).범위, { 시작: 31, 끝: 40 });
  assert.equal(셈.다음범위(b, { 시작: 1, 끝: 10 }, -1).말, '「600-1」 맨 앞이에요.');
  /* 화면 — step 은 다음범위 만 쓰고 단어장을 바꾸지 않는다. 손으로 적는 교재 · 교재 편집은 없다 */
  const step = check.slice(check.indexOf('function step(t, dir) {'), check.indexOf('function turnIndex(sub) {'));
  assert.doesNotMatch(step, /t\.단어장 =/, '다음 단어장으로 저절로 넘기지 않는다');
  assert.match(step, /다음범위\(bookByName\(t\.단어장\), t, dir\)/);
  assert.doesNotMatch(check, /bookBtn|교재 편집|textToBooks|booksToText|data\.books/);
  assert.doesNotMatch(check.slice(check.indexOf('const 설정글'), check.indexOf('function 기록글')), /books/, '설정에 교재 목록을 담지 않는다');
});

test('56-7 · 8. 옛 자료 환산 — 레슨 0~0 · 묶음 10 → 1~10. 단어장에 없는 교재는 「못 찾음」 으로', () => {
  const 목록 = [책('600-1', 10, 95), 책('리딩튜터 1', 8, 60)];
  const 옛책 = [{ id: 'b1', name: '600-1', lessons: ['L1', 'L2', 'L3', 'L4', 'L5'] }, { id: 'b2', name: '리딩튜터 1', lessons: [] },
               { id: 'b3', name: '해법 Grammar 1', lessons: ['Unit 1 be동사', 'Unit 2 일반동사', 'Unit 3'] }];
  assert.deepEqual(셈.진도로({ book: 'b1', lesson: 0, end: 0, moved: '2026-11-17', ts: 5 }, 옛책, 목록).진도,
    { 단어장: '600-1', 시작: 1, 끝: 10, 옮긴날: '2026-11-17', ts: 5 });
  assert.deepEqual(셈.진도로({ book: 'b1', lesson: 4, end: 5 }, 옛책, 목록).진도, { 단어장: '600-1', 시작: 41, 끝: 60, 옮긴날: null, ts: 0 });
  assert.deepEqual(셈.진도로({ book: 'b2', lesson: 2 }, 옛책, 목록).진도, { 단어장: '리딩튜터 1', 시작: 17, 끝: 24, 옮긴날: null, ts: 0 }, '레슨묶음 8 · end 없음');
  const 없음 = 셈.진도로({ book: 'b3', lesson: 0, end: 1 }, 옛책, 목록);
  assert.equal(없음.못찾은교재, '해법 Grammar 1');
  assert.equal(없음.진도.옛교재, '해법 Grammar 1 · Unit 1 be동사 ~ Unit 2 일반동사', '진도 줄에 옛 교재로 남긴다');
  assert.equal(없음.진도.단어장, '');
  /* 옮기기 전체 */
  const old = {
    students: [{ id: 's1', name: '홍길동' }, { id: 's2', name: '없는아이' }],
    books: 옛책,
    groups: [{ id: 'g1', name: '월수금', tracks: [{ book: 'b2', lesson: 0, end: 1, ts: 0 }],
               subs: [{ id: 'u1', name: '1단계', ids: ['s1', 's2'], tracks: [{ book: 'b1', lesson: 2, end: 2, ts: 9 }, { book: 'b3', lesson: 0, end: 0, ts: 1 }] },
                      { id: 'u2', name: '2단계', ids: [], tracks: [{ book: 'b3', lesson: 1, end: 1, ts: 0 }] }] }],
  };
  const r = 셈.옛자료옮기기(old, [{ 번호: 's_hong', 이름: '홍길동' }], 목록);
  assert.deepEqual(r.설정.groups[0].tracks, [{ 단어장: '리딩튜터 1', 시작: 1, 끝: 16, 옮긴날: null, ts: 0 }]);
  assert.deepEqual(r.설정.groups[0].subs[0].tracks.map(t => [t.단어장, t.시작, t.끝, t.ts]), [['600-1', 21, 30, 9], ['', 0, 0, 1]]);
  assert.deepEqual(r.못찾은교재, [{ 교재: '해법 Grammar 1', 자리: '월수금 › 1단계, 월수금 › 2단계' }]);
  assert.deepEqual(r.못찾은.map(x => x.이름), ['없는아이']);
  /* 화면이 둘 다 보여 준다 */
  assert.match(check, /이 교재는 단어장에 없습니다/);
  assert.match(check, /인왕보카 명단에서 못 찾은 이름/);
});

test('56-9. 붙여넣은 글이 JSON 이 아니면 까닭을 돌려준다', () => {
  assert.equal(셈.붙인글읽기('').까닭, '붙여넣은 글이 없어요.');
  assert.match(셈.붙인글읽기('hwcheck 자료').까닭, /^JSON 이 아니에요 — .+\(글이 \{ 로 시작해야 해요/);
  assert.match(셈.붙인글읽기('{"students":[{"id":"s1"').까닭, /^JSON 이 아니에요 — .+글이 잘렸을 수 있어요/);
  assert.match(셈.붙인글읽기('[1,2]').까닭, /\{ … \} 꼴이어야/);
  assert.match(셈.붙인글읽기('{"a":1}').까닭, /학생\(students\)도 그룹\(groups\)도 없어요/);
  const 좋음 = 셈.붙인글읽기('  {"students":[],"groups":[]}\n');
  assert.equal(좋음.까닭, undefined);
  assert.deepEqual(좋음.자료, { students: [], groups: [] });
  assert.match(check, /if \(r\.까닭\) \{ \$\('pasteMsg'\)\.textContent = r\.까닭; return; \}/);
  assert.match(check, /\$\('pasteBtn'\)\.hidden = !!\(data\.옮김 && data\.옮김\.때\)/, '한 번 올리면 숨긴다');
});

test('56-10. 격일 차례(「오늘」·「다음번」)가 그대로 돈다', () => {
  const turnIndex = new Function(check.slice(check.indexOf('function turnIndex(sub) {'), check.indexOf('// ---------- 화면 ----------')) + '\nreturn turnIndex;')();
  const b = 책('600-1', 10, 95);
  const sub = { tracks: [{ 단어장: '600-1', 시작: 1, 끝: 10, ts: 100 }, { 단어장: '리딩', 시작: 1, 끝: 8, ts: 50 }] };
  assert.equal(turnIndex(sub), 1, 'ts 가 오래된 쪽이 오늘');
  /* 오늘 차례를 다음 ▶ — step 과 같이 범위를 옮기고 ts 를 지금으로 */
  const 오늘것 = sub.tracks[1];
  Object.assign(오늘것, 셈.다음범위(책('리딩', 8, 60), 오늘것, 1).범위, { ts: 200 });
  assert.deepEqual([오늘것.시작, 오늘것.끝], [9, 16]);
  assert.equal(turnIndex(sub), 0, '다음번이 오늘이 된다');
  Object.assign(sub.tracks[0], 셈.다음범위(b, sub.tracks[0], 1).범위, { ts: 300 });
  assert.equal(turnIndex(sub), 1);
  assert.equal(turnIndex({ tracks: [sub.tracks[0]] }), -1, '하나뿐이면 차례가 없다');
  assert.match(check, /el\('span', 'badge', i === turn \? '오늘' : '다음번'\)/);
  assert.match(check, /if \(dir > 0\) t\.ts = Date\.now\(\);/);
});

test('56 — 옛 숙제체크.html 에는 내보내기만 더했다 (자료는 읽기만)', { skip: !existsSync(new URL('../숙제체크.html', import.meta.url)) && '숙제체크.html 은 저장소에 커밋되지 않은 원장님 파일' }, () => {
  const old = read('../숙제체크.html');
  assert.match(old, /<button id="exportBtn">내보내기<\/button>/);
  const 붙인 = old.slice(old.indexOf('// ---------- 내보내기'));
  assert.match(붙인, /navigator\.clipboard\.writeText\(글\)/);
  assert.match(붙인, /execCommand\('copy'\)/, '클립보드가 막히면 글상자에서 고른다');
  assert.doesNotMatch(붙인, /localStorage\.(setItem|removeItem|clear)/);
});
