/* 4단계 — 오늘 추천 · 과 단어장 (구분마다 따로 본다) · 내오답의 구분 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { chromium } = require('playwright');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 띄우기설정 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

/* ======================= Code.gs — 진단 다섯 규칙을 과 단어장에 ======================= */
const 칸 = { SpreadsheetApp: { flush() {} }, Logger: { log() {} }, console,
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  Utilities: { formatDate(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); } } };
vm.createContext(칸);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), 칸);

const 기록 = (이름, k, 유형, 점수, 틀린) => ({ 이름, 칸: k, 유형, 점수, 틀린: 틀린 || '' });
const 평범 = [1, 2, 3, 4, 5].map(i => 기록('학생' + i, '단어', '스펠링', 88));
const 재료 = 더 => Object.assign({ 교재: '중2 5과', 종류: '과', 오늘: '2026-10-08', 예산: 90, 레슨: 10, 학생수: 6,
  칸수: { 단어: 155, 본문: 28, 문법: 12 }, 숙제들: [], 기록들: 평범.slice(), 단어들: [] }, 더);
/* 수업 날짜 — 10/7 이 1수업 전, 10/6 이 2, 10/3 이 3, 10/1 이 4 */
const 숙 = (k, 시작, 끝, 유형, 등록, 안낸수) => ({ 단어장: '중2 5과', 칸: k, 시작, 끝, 유형, 등록, 안낸수: 안낸수 || 0 });

console.log('— 구분마다 따로 —');
let r = 칸.수업추천짜기_(재료({ 숙제들: [
  숙('단어', 21, 40, '스펠링', '2026-10-07', 3),
  숙('단어', 1, 20, '스펠링', '2026-10-06', 0),
  숙('단어', 1, 20, '첫 글자', '2026-10-03', 0),
  숙('본문', 1, 12, '빈칸 채우기', '2026-10-01', 0)] }));
console.log('  ' + r.단계.map(s => s.이름 + ' ← ' + s.이유).join(' | '));
확인('1순위 — 못 낸 단어 범위가 맨 앞 (구분이 붙는다)', [r.단계[0].칸, r.단계[0].이름, r.단계[0].이유], ['단어', '단어 21~40 스펠링', '3명이 못 냈습니다']);
확인('1순위 진단', r.진단[0], '3명이 단어 21~40 스펠링을 못 냈습니다');
const 본복습 = r.단계.filter(s => s.칸 === '본문' && /수업 전/.test(s.이유))[0];
확인('3순위 — 본문은 그때 낸 유형으로 그 범위를 다시 (누적이 아니다)', 본복습 && [본복습.종류, 본복습.이름, 본복습.이유], ['보통', '본문 1~12 빈칸 채우기', '4수업 전에 봤습니다']);
확인('3순위 진단', r.진단.indexOf('본문 1~12를 본 지 4수업 됐습니다') > -1, true);
const 단누적 = r.단계.filter(s => s.칸 === '단어' && s.종류 === '누적')[0];
확인('3순위 — 단어는 누적', 단누적 && [단누적.이름, 단누적.지난], ['누적 단어 1~20 스펠링', 2]);
const 진도 = r.단계.filter(s => s.이유 === '진도').map(s => s.이름);
확인('5순위 — 구분마다 이어서 (단어 20 · 본문·문법 12)', 진도, ['단어 41~60 스펠링', '본문 13~24 빈칸 채우기', '문법 1~12 빈칸 채우기']);
확인('단계마다 이유가 붙는다', r.단계.every(s => s.이유), true);

console.log('\n— 철자 진단은 단어 기록만 —');
r = 칸.수업추천짜기_(재료({ 숙제들: [숙('단어', 1, 20, '스펠링', '2026-10-07', 0)], 기록들: [
  기록('가', '단어', '4지선다', 94), 기록('나', '단어', '첫 글자', 90),
  기록('가', '단어', '스펠링', 70), 기록('나', '단어', '듣고 쓰기', 74),
  기록('가', '본문', '영작', 20), 기록('나', '본문', '듣고 쓰기', 30)] }));
확인('(4지선다+첫 글자) − (스펠링+듣고 쓰기) — 본문 듣고 쓰기는 안 센다', r.진단.filter(t => /철자/.test(t)), ['뜻 고르기 92점 / 철자 쓰기 72점 — 철자가 약합니다']);
확인('단어 진도가 듣고 쓰기·첫 글자로', r.단계.filter(s => s.칸 === '단어' && s.이유 === '철자가 약합니다').map(s => s.이름), ['단어 21~40 듣고 쓰기', '단어 21~40 첫 글자']);
확인('본문·문법 진도는 그대로', r.단계.filter(s => s.칸 !== '단어' && s.이유 === '진도').map(s => s.유형), ['빈칸 채우기', '빈칸 채우기']);

console.log('\n— 다 같이 틀린 단어는 단어 기록만 —');
const 낱말 = ['ant', 'bee', 'cat', 'dog', 'eel', 'fox', 'gnu', 'hen'];
r = 칸.수업추천짜기_(재료({ 단어들: 낱말, 기록들: [
  기록('가', '단어', '스펠링', 70, 'bee, cat, dog'), 기록('나', '단어', '스펠링', 70, 'bee, cat, dog'),
  기록('가', '본문', '영작', 50, 'He is tall., She runs., We go., It is., You are.'),
  기록('나', '본문', '영작', 50, 'He is tall., She runs., We go., It is., You are.'),
  기록('다', '단어', '스펠링', 90, '')] }));
확인('본문 문장은 「다 같이 틀린 단어」 에 안 들어간다', r.진단.some(t => /다 같이 틀린/.test(t)), false);

console.log('\n— 기록이 없으면 구분마다 진도만 —');
r = 칸.수업추천짜기_(재료({ 기록들: [] }));
확인('빈 화면이 아니다', r.단계.map(s => s.이름), ['단어 1~20 스펠링', '본문 1~12 빈칸 채우기', '문법 1~12 빈칸 채우기']);
확인('기록이 적다고 적는다', r.진단, ['아직 기록이 적어 진도만 보고 짰습니다']);

console.log('\n— 내오답 — 구분으로 거른다 —');
const 안Date = vm.runInContext('Date', 칸);
const 어제 = new 안Date(); 어제.setDate(어제.getDate() - 1);
const 줄 = (범위, 틀린) => [어제, '', '홍길동', '중2 5과', 범위, '스펠링', 10, 8, 80, 0, 0, 0, 'O', 틀린, '숙제', ''];
칸.rows_ = name => (name === '기록' ? [줄('단어 1~20', 'apple, bee'), 줄('본문 1~12', 'He is tall.'), 줄('1~10', 'old')] : []);
확인('단어 구분만', 칸.내오답('홍길동', '중2 5과', false, '단어').단어, ['apple', 'bee']);
확인('구분을 안 주면 다 (옛 단어장)', 칸.내오답('홍길동', '중2 5과').단어.length, 4);
확인('기록 범위의 구분 읽기', [칸.범위칸_('본문 1~12'), 칸.범위칸_('1~10'), 칸.범위칸_('문법 3~5')], ['본문', '', '문법']);

/* ======================= 화면 — 과 단어장 오늘 추천 ======================= */
(async () => {
  const b = await chromium.launch(띄우기설정);
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.click('#btnTeacherGo'); await p.fill('#tPw', '1234'); await p.click('#btnTLogin');
  await p.waitForTimeout(1300);
  await p.evaluate(() => { var b = document.querySelector('[data-tab="hw"]'); var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]'); if (g) g.click(); });
  await p.waitForTimeout(250); await p.click('[data-tab="hw"]'); await p.waitForTimeout(1000);
  await p.selectOption('#lsBook', '중2 7과'); await p.waitForTimeout(300);
  const 읽기 = () => p.evaluate(() => {
    const 칸 = document.querySelector('#lsRecBox .sjrec');
    return 칸 ? { 진단: [...칸.querySelectorAll('.sjdiag li')].map(e => e.textContent.trim()),
                 단계: [...칸.querySelectorAll('.sjrecl li b')].map(e => e.textContent.trim()),
                 이유: [...칸.querySelectorAll('.sjrecl li')].map(e => (e.querySelector('i') || {}).textContent || '') } : null;
  });

  console.log('\n— 기록이 없을 때 — 구분마다 진도 —');
  await p.click('#lsRec'); await p.waitForTimeout(600);
  let 화 = await 읽기();
  console.log('  ' + JSON.stringify(화));
  확인('구분이 붙은 진도 단계', 화.단계.map(x => x.split(' ')[0]), ['단어', '본문', '문법']);
  확인('제목에 단어장', /오늘 추천 — 중2 7과/.test(await p.locator('#lsRecBox .sjrech').innerText()), true);

  console.log('\n— 못 낸 본문이 있으면 그 범위가 1번 —');
  await p.evaluate(() => {
    DEMO_HW.push({ 행: 98, 단어장: '중2 7과', 칸: '본문', 시작: 1, 끝: 3, 유형: '빈칸 채우기', 마감일: DEMO_지난(1),
      등록일: DEMO_지난(1), 종류: '당일', 지남: true, 대상수: 2, 한사람: ['김영희'], 안한사람: ['홍길동'] });
    for (let i = 0; i < 5; i++) DEMO_기록.push({ 이름: '학생' + i, 단어장: '중2 7과', 칸: '단어', 유형: '스펠링', 점수: 90, 틀린: '', 날: DEMO_지난(1) });
  });
  await p.click('#lsRecAgain'); await p.waitForTimeout(600);
  화 = await 읽기();
  console.log('  ' + JSON.stringify(화));
  확인('1번은 본문 1~3', [화.단계[0], 화.이유[0]], ['본문 1~3 빈칸 채우기', '← 1명이 못 냈습니다']);
  확인('진단', 화.진단[0], '1명이 본문 1~3 빈칸 채우기를 못 냈습니다');

  console.log('\n— 「고치기」 — 짜개에 구분까지 그대로 —');
  const 추천 = await p.evaluate(() => T.수업.추천.단계.map(s => [s.칸, s.유형, String(s.시작), String(s.끝)]));
  await p.click('#lsRecEdit'); await p.waitForTimeout(400);
  const 채운 = await p.locator('#lsSteps .sjstep').evaluateAll(rs => rs.map(r => {
    const v = f => { const e = r.querySelector('[data-f="' + f + '"]'); return e ? e.value : ''; };
    return [v('칸'), v('유형'), v('시작'), v('끝')];
  }));
  확인('구분·유형·범위가 그대로', 채운, 추천);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
