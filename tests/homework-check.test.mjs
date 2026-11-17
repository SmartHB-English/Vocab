// 프롬프트 53 — 숙제 다 냈나. 그날(등록일) 숙제를 하나도 못 받은 아이를 반별로 (엔진의 숙제체크).
// 예약으로 걸어 둔 숙제(숙제예약 표 · 그날 · 켬 · 아직 안 나감)도 받은 것으로 친다. 받을 아이 계산은 숙제등록안_ 과 같은 숙제받을아이_.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = read('./fixtures/legacy/Code.gs'), teacher = read('../teacher.html'), shared = read('../services/shared-ui.js');
const 일반 = x => JSON.parse(JSON.stringify(x));
const 비번 = '5678';
const 서울 = t => new Date(t + '+09:00').getTime();
const 숙제머리 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류'];

/** 3A: 홍길동 · 김영희(교재A) · 이철수(교재B)  /  3B: 박철수 · 정하윤(교재B)  /  반 없음: 최아람(교재A) */
function 엔진({ 예약표 = true, 처음 = '2026-11-20T20:00:00' } = {}) {
  let 시계 = 서울(처음);
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 비번]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);
  for (const [반, 이름, 교재] of [['3A', '홍길동', '교재A'], ['3A', '김영희', '교재A'], ['3A', '이철수', '교재B'],
                                 ['3B', '박철수', '교재B'], ['3B', '정하윤', '교재B'], ['', '최아람', '교재A']]) {
    학생.appendRow([반, 이름, '1234', '', '', '중2', '', 교재, '', '', '']);
  }
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 기록머리 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'];
  store.insertSheet('기록').appendRow(기록머리);
  store.insertSheet('기록보관').appendRow(기록머리);
  store.insertSheet('숙제').appendRow(숙제머리);
  if (예약표) store.insertSheet('숙제예약').appendRow(['만든때', '날짜', '시각', '요약', '내용', '알림함께', '보낸때', '켬']);
  const 엔 = createRuntime(store, { now: () => 시계 });
  const call = (fn, ...args) => 일반(엔.call(fn, args));
  return {
    store, 엔, call,
    때: t => { 시계 = 서울(t); },
    내기: (h = {}, 언제) => {
      if (언제) 시계 = 서울(언제);
      const r = call('숙제등록', 비번, { 단어장: '교재A', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '당일', 학생들: [], 바뀐줄만: true, ...h });
      assert.equal(r.ok, true, JSON.stringify(r));
    },
    체크: 날짜 => call('숙제체크', 비번, 날짜),
  };
}
const 못받은 = r => Object.fromEntries(r.반들.map(b => [b.반, b.못받은]));

test('1. 아무 숙제도 안 낸 날이면 전체 명단이 다 못 받은 것으로 나온다', () => {
  const e = 엔진();
  const r = e.체크('2026-11-20');
  assert.equal(r.ok, true);
  assert.deepEqual(못받은(r), { '3A': ['홍길동', '김영희', '이철수'], '3B': ['박철수', '정하윤'], '반 없음': ['최아람'] });
  assert.equal(r.예약수, 0);
  assert.equal(e.call('숙제체크', '0000', '2026-11-20').ok, false, '선생님 비번을 거친다');
  assert.equal(e.체크('2026/11/20').ok, false, '날짜 꼴');
});

test('2. 반 전체에 숙제를 내면 그 반은 0 명이 된다', () => {
  const e = 엔진();
  e.내기({ 단어장: '교재B' }, '2026-11-20T16:00:00');                // 3B 는 모두 교재B
  assert.deepEqual(못받은(e.체크('2026-11-20'))['3B'], []);
  /* 반 칸이 적힌 줄(옛 숙제 · 수업)은 그 반 전체에게 간다 — 숙제대상_ 그대로 */
  e.store.getSheetByName('숙제').appendRow(['3A', '교재Z', 1, 10, '스펠링', '2026-11-20', new Date(서울('2026-11-20T17:00:00')), '', '당일']);
  assert.deepEqual(못받은(e.체크('2026-11-20'))['3A'], []);
});

test('3 · 4. 반에 냈는데 그 교재를 안 배우는 아이는 남는다 — 따로 내주면 사라진다', () => {
  const e = 엔진();
  e.내기({ 단어장: '교재A' }, '2026-11-20T16:00:00');                // 「이 교재 배우는 학생」
  assert.deepEqual(못받은(e.체크('2026-11-20'))['3A'], ['이철수'], '교재B 를 배우는 이철수만 남는다');
  e.내기({ 단어장: '교재A', 학생들: ['이철수'] }, '2026-11-20T16:10:00');
  assert.deepEqual(못받은(e.체크('2026-11-20'))['3A'], []);
});

test('5. 그 날짜에 예약이 걸려 있으면 그 대상 아이들은 못 받은 데서 빠진다', () => {
  const e = 엔진({ 처음: '2026-11-19T20:00:00' });
  const 걸기 = (h, 값 = {}) => e.call('숙제예약저장', 비번, '', { 날짜: '2026-11-20', 시각: '18:00', 내용: { 단어장: '교재B', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '당일', 학생들: [], ...h }, ...값 });
  assert.equal(걸기({}).ok, true);                                   // 교재B 배우는 아이 셋
  assert.equal(걸기({ 단어장: '교재A', 학생들: ['최아람'] }).ok, true);
  assert.equal(걸기({ 단어장: '교재A' }, { 날짜: '2026-11-21' }).ok, true, '다른 날 예약은 안 센다');
  e.때('2026-11-20T09:00:00');
  const r = e.체크('2026-11-20');
  assert.equal(r.예약수, 2);
  assert.deepEqual(못받은(r), { '3A': ['홍길동', '김영희'], '3B': [], '반 없음': [] });
  /* 꺼 둔 예약은 받은 것으로 안 친다 */
  const 목록 = e.call('숙제예약목록', 비번).예약;
  const 최아람것 = 목록.find(n => /최아람/.test(n.요약));
  e.call('숙제예약켜기', 비번, 최아람것.행, false, 최아람것.키);
  assert.deepEqual(못받은(e.체크('2026-11-20'))['반 없음'], ['최아람']);
  /* 예약이 나간 뒤에는 숙제 줄로 센다 — 두 번 세지 않고, 그대로 받은 것이다 */
  e.엔.scheduledHomework(서울('2026-11-20T18:05:00'));
  const 뒤 = e.체크('2026-11-20');
  assert.equal(뒤.예약수, 0);
  assert.deepEqual(못받은(뒤)['3B'], []);
  /* 못 나간 예약(까닭이 적힌 것)은 받은 것이 아니다 */
  const f = 엔진({ 처음: '2026-11-19T20:00:00' });
  f.call('숙제예약저장', 비번, '', { 날짜: '2026-11-20', 시각: '08:00', 내용: { 단어장: '지운책', 학생들: [] } });
  f.엔.scheduledHomework(서울('2026-11-20T08:05:00'));
  assert.equal(f.체크('2026-11-20').예약수, 0);
});

test('6. 숙제예약 표가 없어도 터지지 않는다', () => {
  const e = 엔진({ 예약표: false });
  e.내기({ 단어장: '교재B' }, '2026-11-20T16:00:00');
  const r = e.체크('2026-11-20');
  assert.equal(r.ok, true);
  assert.equal(r.예약수, 0);
  assert.deepEqual(못받은(r)['3B'], []);
  assert.equal(e.store.getSheetByName('숙제예약'), null, '보기만 했다 — 표를 만들지 않는다');
});

test('7. 등록일 기준이다 — 마감이 그날인 옛 숙제는 안 센다', () => {
  const e = 엔진();
  e.내기({ 단어장: '교재B', 종류: '기한', 마감일: '2026-11-20' }, '2026-11-17T16:00:00');   // 11/17 에 낸, 11/20 마감
  e.때('2026-11-20T20:00:00');
  assert.deepEqual(못받은(e.체크('2026-11-20'))['3B'], ['박철수', '정하윤'], '마감일로 세지 않는다');
  assert.deepEqual(못받은(e.체크('2026-11-17'))['3B'], [], '낸 날(11/17)에는 받은 것');
  /* 시험은 숙제가 아니다 */
  e.내기({ 단어장: '교재A', 종류: '시험', 마감일: '2026-11-22' }, '2026-11-20T16:00:00');
  assert.deepEqual(못받은(e.체크('2026-11-20'))['반 없음'], ['최아람']);
});

test('8. 날짜를 비우면 오늘(학습날)이다', () => {
  const e = 엔진();
  e.내기({ 단어장: '교재B' }, '2026-11-20T16:00:00');
  e.때('2026-11-20T20:00:00');
  const r = e.체크('');
  assert.equal(r.날짜, '2026-11-20');
  assert.deepEqual(못받은(r)['3B'], []);
  assert.equal(e.체크().날짜, '2026-11-20');
});

test('9. 새벽 2시에 물으면 전날 기준으로 센다', () => {
  const e = 엔진();
  e.내기({ 단어장: '교재B' }, '2026-11-20T16:00:00');
  e.때('2026-11-21T02:00:00');
  const r = e.체크('');
  assert.equal(r.날짜, '2026-11-20');
  assert.deepEqual(못받은(r)['3B'], []);
  e.때('2026-11-21T08:00:00');
  assert.equal(e.체크('').날짜, '2026-11-21');
});

test('10 · 11. 반이 빈 아이는 「반 없음」 으로 맨 뒤에 모이고, 못 받은 아이가 없는 반도 돌려준다', () => {
  const e = 엔진();
  e.내기({ 단어장: '교재B' }, '2026-11-20T16:00:00');
  e.내기({ 단어장: '교재A' }, '2026-11-20T16:05:00');
  const r = e.체크('2026-11-20');
  assert.deepEqual(r.반들.map(b => b.반), ['3A', '3B', '반 없음']);
  assert.deepEqual(r.반들.map(b => [b.전체수, b.못받은.length]), [[3, 0], [2, 0], [1, 0]]);
});

test('받을 아이 계산은 한 곳 — 숙제등록안_ 과 숙제체크가 숙제받을아이_ 를 같이 쓴다', () => {
  const 등록 = code.slice(code.indexOf('function 숙제등록안_('), code.indexOf('/* 이번 판(외우기분 칸) 전에 낸 시험 숙제'));
  assert.match(등록, /var 받을 = 숙제받을아이_\(h, 전체명단_\(\)\);/);
  assert.doesNotMatch(등록, /이름들풀기_|교재학생_/, '숙제등록안_ 안에 두 벌로 남기지 않는다');
  const 체크 = code.slice(code.indexOf('function 숙제체크('), code.indexOf('function 숙제등록(비번, h)'));
  assert.match(체크, /숙제받을아이_\(h, 전체\)\.대상/);
  assert.match(code, /  숙제체크: 숙제체크,/);
  /* 등록은 예전과 똑같이 막는다 */
  const e = 엔진();
  const r = e.call('숙제등록', 비번, { 단어장: '아무도안배움', 학생들: [] });
  assert.equal(r.ok, false);
  assert.match(r.메시지, /배우는 학생이 없습니다/);
  assert.equal(e.call('숙제등록', 비번, { 단어장: '아무도안배움', 학생들: ['없는아이', '최아람'], 바뀐줄만: true }).대상, 1, '명단에 없는 이름은 뺀다');
});

test('선생님 화면 — 숙제 탭 맨 위 · 날짜(오늘·어제·그제) · 반 칩 숫자 · 못 받은 이름만 · 이름은 「숙제 따로 내주기」 로', () => {
  const 탭 = teacher.slice(teacher.indexOf("else if(T.tab==='hw' || T.tab==='exam'){"), teacher.indexOf("/* ---------------- 공지·알림 ---------------- */"));
  assert.ok(탭.indexOf("'<div id=\"hwCheck\"></div>'") > -1 && 탭.indexOf("'<div id=\"hwCheck\"></div>'") < 탭.indexOf('수업 짜기'), '맨 위');
  assert.match(teacher, /\[\['그제',날더하기_\(오늘,-2\)\],\['어제',날더하기_\(오늘,-1\)\],\['오늘',''\]\]/);
  assert.match(teacher, /오늘은 다 냈습니다/);
  assert.match(teacher, /예약으로 나갈 숙제 '\+r\.예약수\+'건/);
  assert.match(teacher, /data-hcname="'\+esc\(n\)\+'"/);
  assert.match(teacher, /b\.onclick=function\(\)\{ 숙제따로내주기_\(b\.dataset\.hcname\); \};/);
  assert.match(teacher, /if\(\$\('ppHw'\)\) \$\('ppHw'\)\.onclick=function\(\)\{ 숙제따로내주기_\(T\.p고름\); \};/, '「숙제 따로 내주기」 단추도 같은 길');
  assert.doesNotMatch(teacher, /\.한사람\b.*hcname|받은사람/, '받은 아이는 안 보여 준다');
  assert.match(shared, /  숙제체크:function\(pw,날짜\)\{/, '미리보기 흉내');
  const 날더하기_ = new Function(teacher.slice(teacher.indexOf('function 날더하기_('), teacher.indexOf('function 숙제체크서명_(')) + '\nreturn 날더하기_;')();
  assert.equal(날더하기_('2026-03-01', -1), '2026-02-28');
  assert.equal(날더하기_('2026-01-01', -2), '2025-12-30');
});
