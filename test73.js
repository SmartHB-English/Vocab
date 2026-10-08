/* 3단계 — 수업 짜기 : 단어장을 한 번만 고르고 단계는 구분·범위·유형만 · 「이어서」 · 틀 · 수업 내주기
   (B1 판 — 과를 고르던 짜개 — 은 백업\v2026-10-06h_3단계_수업짜기\test73.과고르기판.js) */
const { chromium } = require('playwright');
const path = require('path');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 띄우기설정 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
async function 탭가기(p, 이름) {
  await p.evaluate(t => {
    var b = document.querySelector('[data-tab="' + t + '"]');
    var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]');
    if (g) g.click();
  }, 이름);
  await p.waitForTimeout(250);
  await p.click('[data-tab="' + 이름 + '"]');
  await p.waitForTimeout(1000);
}
/* 단계 줄을 읽는다 — 구분·범위·유형·분 */
const 단계들 = p => p.locator('#lsSteps .sjstep').evaluateAll(rs => rs.map(r => {
  const v = f => { const e = r.querySelector('[data-f="' + f + '"]'); return e ? e.value : null; };
  return { 누적: !!r.querySelector('.sjkind.cum'), 칸: v('칸'), 시작: v('시작'), 끝: v('끝'),
           유형: v('유형'), 지난: v('지난'), 분: Number(v('분')) };
}));
const 줄 = (p, i) => p.locator('#lsSteps .sjstep').nth(i);
const 합계 = async p => Number(((await p.locator('#lsSum b').textContent()) || '').replace(/[^\d]/g, ''));
/* 선생님 화면이 들고 있는 숙제 목록에 지난 숙제를 끼워 넣는다 (「이어서」 가 보는 것) */
const 지난숙제 = (p, 책, 칸, 시작, 끝, 며칠) => p.evaluate(a => {
  T.data.숙제목록.push({ 행: 900 + T.data.숙제목록.length, 단어장: a.책, 칸: a.칸, 시작: a.시작, 끝: a.끝, 유형: '스펠링',
    종류: '당일', 등록일: DEMO_지난(a.며칠 || 2), 안한사람: [], 한사람: [] });
}, { 책, 칸, 시작, 끝, 며칠 });

(async () => {
  const b = await chromium.launch(띄우기설정);
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  let 틀이름 = '검사용 틀';
  p.on('dialog', d => d.type() === 'prompt' ? d.accept(틀이름) : d.accept());

  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw', '1234'); await p.click('#btnTLogin');
  await p.waitForTimeout(1300);
  await 탭가기(p, 'hw');
  const 수 = await p.evaluate(() => { const c = DEMO_과책['중2 7과']; return { 단어: c.단어.length, 본문: c.본문.length, 문법: c.문법.length }; });

  console.log('— 단어장을 맨 위에서 한 번만 —');
  확인('꾸러미 고르개는 없다', await p.locator('#lsKit').count(), 0);
  확인('단어장 고르개에 과 단어장이 있다', (await p.locator('#lsBook option').allTextContents()).indexOf('중2 7과 (과)') > -1, true);
  await p.selectOption('#lsBook', '중2 7과'); await p.waitForTimeout(300);

  console.log('\n— 단계의 첫 고르개는 구분 — 자료 있는 구분만 —');
  await p.click('#lsAddStep'); await p.waitForTimeout(200);
  확인('구분 고르개', (await 줄(p, 0).locator('[data-f="칸"] option').allTextContents()).map(x => x.trim()),
    ['단어 ' + 수.단어, '본문 ' + 수.본문, '문법 ' + 수.문법]);
  확인('단계에 단어장 고르개는 없다', await 줄(p, 0).locator('[data-f="단어장"]').count(), 0);
  let 단 = await 단계들(p);
  확인('처음은 단어 1부터 20개', [단[0].칸, 단[0].시작, 단[0].끝], ['단어', '1', '20']);
  await 줄(p, 0).locator('[data-f="칸"]').selectOption('본문'); await p.waitForTimeout(200);
  단 = await 단계들(p);
  확인('본문을 고르면 본문 유형', 단[0].유형, '빈칸 채우기');
  확인('본문은 12개씩 (끝까지만)', [단[0].시작, 단[0].끝], ['1', String(Math.min(12, 수.본문))]);
  await p.selectOption('#lsBook', '예시 단어장'); await p.waitForTimeout(300);
  확인('옛 단어장이면 구분 고르개가 사라진다', await 줄(p, 0).locator('[data-f="칸"]').count(), 0);
  확인('범위·유형은 남는다', (await 단계들(p)).map(x => [x.시작 !== null, x.유형]), [[true, '스펠링']]);
  await p.selectOption('#lsBook', '중2 7과'); await p.waitForTimeout(300);

  console.log('\n— 단계를 넣고 빼고 순서를 바꾼다 —');
  await 줄(p, 0).locator('[data-del]').click(); await p.waitForTimeout(150);
  for (const k of ['단어', '본문', '문법']) {
    await p.click('#lsAddStep'); await p.waitForTimeout(150);
    const n = (await 단계들(p)).length - 1;
    await 줄(p, n).locator('[data-f="칸"]').selectOption(k); await p.waitForTimeout(150);
  }
  확인('세 단계', (await 단계들(p)).map(x => x.칸), ['단어', '본문', '문법']);
  await 줄(p, 1).locator('[data-mv="-1"]').click(); await p.waitForTimeout(150);
  확인('↑ 를 누르면 위로', (await 단계들(p)).map(x => x.칸), ['본문', '단어', '문법']);
  await 줄(p, 0).locator('[data-mv="1"]').click(); await p.waitForTimeout(150);
  확인('↓ 를 누르면 아래로', (await 단계들(p)).map(x => x.칸), ['단어', '본문', '문법']);
  await 줄(p, 2).locator('[data-del]').click(); await p.waitForTimeout(150);
  확인('✕ 로 뺀다', (await 단계들(p)).map(x => x.칸), ['단어', '본문']);

  console.log('\n— 합계 시간 —');
  단 = await 단계들(p);
  확인('합계 = 단계 분의 합', await 합계(p), 단.reduce((a, x) => a + x.분, 0));
  확인('스펠링 20개 = 7분', 단[0].분, 7);
  const 전합 = await 합계(p);
  await p.click('#lsAddStep'); await p.waitForTimeout(150);
  확인('단계를 넣으면 늘고', await 합계(p) > 전합, true);
  await 줄(p, 2).locator('[data-del]').click(); await p.waitForTimeout(150);
  확인('빼면 돌아온다', await 합계(p), 전합);
  await p.fill('#lsBudget', '5'); await p.waitForTimeout(150);
  확인('예산을 넘으면 빨갛게', await p.locator('#lsSum.over').count(), 1);
  await p.fill('#lsBudget', '35'); await p.waitForTimeout(150);
  확인('예산 안이면 풀린다', await p.locator('#lsSum.over').count(), 0);

  console.log('\n— 「이어서」 — 그 단어장·그 구분의 가장 큰 끝번호 다음 —');
  await 지난숙제(p, '중2 7과', '단어', 1, 10);
  await 지난숙제(p, '중2 7과', '단어', 11, 20);
  await 지난숙제(p, '예시 단어장', '', 1, 24);
  await 줄(p, 0).locator('[data-next]').click(); await p.waitForTimeout(200);
  확인('20 다음부터 — 끝(' + 수.단어 + ')까지만', [(await 단계들(p))[0].시작, (await 단계들(p))[0].끝], ['21', String(수.단어)]);
  await 지난숙제(p, '중2 7과', '단어', 21, 수.단어);
  await 줄(p, 0).locator('[data-next]').click(); await p.waitForTimeout(200);
  확인('끝까지 갔으면 1부터 다시', [(await 단계들(p))[0].시작, (await 단계들(p))[0].끝], ['1', '20']);
  await 지난숙제(p, '중2 7과', '본문', 1, 2);
  await 줄(p, 1).locator('[data-next]').click(); await p.waitForTimeout(200);
  확인('본문은 본문 숙제만 본다 — 단어 숙제와 안 섞인다', (await 단계들(p))[1].시작, '3');

  console.log('\n— 틀로 저장하고 다시 불러온다 (단어장은 안 따라온다) —');
  await 줄(p, 1).locator('[data-f="유형"]').selectOption('영작'); await p.waitForTimeout(200);
  const 저장전 = await 단계들(p);
  await p.click('#lsTplSave'); await p.waitForTimeout(400);
  const 틀목록 = await p.locator('#lsTpl option').allTextContents();
  확인('처음 틀 여섯 개가 있다', ['본문 1회차', '본문 총정리', '문법 확인', '본문 + 문법 (한 회차 전체)', '단어 집중', '시험 대비']
    .every(t => 틀목록.indexOf(t) > -1), true);
  const 저장된 = await p.evaluate(n => DEMO_틀들().filter(t => t.이름 === n)[0].단계, 틀이름);
  console.log('  ' + JSON.stringify(저장된));
  /* 단계(연습·시험)도 같이 — 기본은 연습 */
  확인('틀엔 구분·유형·몇 개씩·단계만', 저장된.map(s => Object.keys(s).sort().join(',')), ['개수,단계,유형,종류,칸', '개수,단계,유형,종류,칸']);
  확인('단어장·범위는 안 들어간다', JSON.stringify(저장된).indexOf('중2'), -1);
  for (let k = 0; k < 2; k++) { await 줄(p, 0).locator('[data-del]').click(); await p.waitForTimeout(150); }
  await p.selectOption('#lsTpl', 틀이름); await p.waitForTimeout(400);
  const 불러온 = await 단계들(p);
  확인('불러오면 구분·유형이 그대로', 불러온.map(x => [x.칸, x.유형]), 저장전.map(x => [x.칸, x.유형]));
  확인('범위는 「이어서」 로', 불러온.map(x => x.시작), ['1', '3']);
  await p.selectOption('#lsBook', '예시 단어장'); await p.waitForTimeout(300);
  await p.selectOption('#lsTpl', 틀이름); await p.waitForTimeout(400);
  확인('다른 단어장에 — 그 단어장에 있는 구분만', (await 단계들(p)).map(x => x.유형), ['스펠링']);
  /* 미리보기 숙제엔 예시 단어장(25개)의 41~50번 같은 옛 줄도 있다 — 같은 계산으로 견준다 */
  확인('옛 단어장도 「이어서」', (await 단계들(p)).map(x => x.시작), [await p.evaluate(() => String(이어서범위_(
    T.data.숙제목록.filter(h => h.단어장 === '예시 단어장' && !h.칸 && h.종류 !== '시험'), 25, 20).시작))]);
  await p.selectOption('#lsBook', '중2 7과'); await p.waitForTimeout(300);
  await p.selectOption('#lsTpl', '본문 1회차'); await p.waitForTimeout(400);
  확인('처음 틀(꾸러미)도 구분으로 들어간다', (await 단계들(p)).map(x => x.칸 + ' ' + x.유형), ['단어 스펠링', '본문 빈칸 채우기', '본문 영작']);
  await p.selectOption('#lsTpl', 틀이름); await p.waitForTimeout(300);
  await p.click('#lsTplDel'); await p.waitForTimeout(400);
  확인('틀을 지울 수 있다', (await p.locator('#lsTpl option').allTextContents()).indexOf(틀이름), -1);

  console.log('\n— 수업 내주기 — 숙제 줄에 단어장 이름과 칸 —');
  await p.selectOption('#lsTpl', '본문 + 문법 (한 회차 전체)'); await p.waitForTimeout(400);
  await p.click('#lsAddCum'); await p.waitForTimeout(200);
  const 낼것 = await 단계들(p);
  await p.fill('#lsName', '중2 7과 3회차');
  await p.evaluate(() => { DEMO_배정.forEach(x => { if (x.이름 === '이철수') x.교재 = x.교재.concat(['중2 7과']); }); });
  const 전숙제 = await p.evaluate(() => DEMO_HW.length);
  await p.click('#btnLsAdd'); await p.waitForTimeout(1500);
  const 나간 = await p.evaluate(() => DEMO_HW.filter(h => h.수업 === '중2 7과 3회차')
    .map(h => ({ 순서: h.순서, 단어장: h.단어장, 칸: h.칸, 유형: h.유형, 범위: h.시작 + '~' + h.끝 })));
  console.log('  ' + JSON.stringify(나간));
  확인('단계 수만큼 숙제가 등록된다', [나간.length, await p.evaluate(() => DEMO_HW.length) - 전숙제], [낼것.length, 낼것.length]);
  확인('순서가 붙는다', 나간.map(x => x.순서), [1, 2, 3, 4, 5]);
  확인('단어장 칸엔 단어장 이름', 나간.every(x => x.단어장 === '중2 7과'), true);
  확인('칸엔 구분', 나간.map(x => x.칸), ['단어', '본문', '본문', '문법', '단어']);
  확인('유형도 단계대로', 나간.slice(0, 4).map(x => x.유형), ['스펠링', '빈칸 채우기', '영작', '빈칸 채우기']);
  확인('누적은 단어 구분으로', [나간[4].칸, 나간[4].유형], ['단어', '스펠링 (누적 20)']);
  확인('낸 뒤엔 단계를 비운다', (await 단계들(p)).length, 0);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
