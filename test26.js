/* 숙제를 교재로 묶어 한 번에 내기 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');

/* 선생님 화면 탭은 묶음(오늘/숙제/학생/자료) 아래로 숨어 있다 — 묶음을 먼저 펼쳐야 보인다 */
async function 묶음열기(p, 이름){
  await p.evaluate(t => {
    var b = document.querySelector('[data-tab="' + t + '"]');
    var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]');
    if (g) g.click();
  }, 이름);
  await p.waitForTimeout(250);
}
async function 탭가기(p, 이름){
  await 묶음열기(p, 이름);
  await p.click('[data-tab="' + 이름 + '"]');
}
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw', '1234');
  await p.click('#btnTLogin');
  await p.waitForTimeout(1200);

  await 탭가기(p, 'hw');
  await p.waitForTimeout(900);

  console.log('— 숙제 내주기 —');
  const 대상 = await p.locator('input[name=hwTarget]').evaluateAll(
    els => els.map(e => e.value + (e.checked ? '*' : '')).join(' / '));
  console.log('  누구에게:', 대상);
  확인('교재로가 첫 칸이고 기본값', 대상.split(' / ')[0], 'text*');
  확인('고를 수 있는 것은 둘뿐', 대상.split(' / ').length, 2);
  확인('반 고르개는 아예 없앴다', await p.locator('#hwClassWrap').count(), 0);
  확인('따로 교재 고르개도 없앴다 — 단어장이 곧 교재',
    await p.locator('#hwText').count(), 0);

  await p.waitForTimeout(700);
  const 미리 = (await p.locator('#hwTextWho').textContent()).replace(/\s+/g, ' ').trim();
  console.log('  미리 보기:', 미리);
  확인('몇 명에게 나가는지 보여 준다', /\d+명에게 나갑니다/.test(미리), true);
  확인('누구인지 이름으로 보여 준다', 미리.indexOf('홍길동') > -1, true);
  await p.screenshot({ path: 'm1_hw_by_text.png' });

  /* 단어장을 바꾸면 미리 보기도 바뀐다 */
  await p.selectOption('#hwBook', '불규칙 동사 50');
  await p.waitForTimeout(900);
  const 미리2 = (await p.locator('#hwTextWho').textContent()).replace(/\s+/g, ' ').trim();
  console.log('  단어장 바꾼 뒤:', 미리2);
  확인('다른 교재는 다른 인원', 미리2 !== 미리, true);
  확인('이철수가 나온다', 미리2.indexOf('이철수') > -1, true);

  /* 실제로 내보기 */
  await p.selectOption('#hwBook', '예시 단어장');
  await p.waitForTimeout(800);
  const 전 = await p.locator('.hwrow').count();
  await p.evaluate(()=>{var e=document.getElementById('hwHand'); if(e) e.classList.remove('hide');});
  await p.fill('#hwFrom', '1');
  await p.fill('#hwTo', '10');
  await p.click('#btnHwAdd');
  await p.waitForTimeout(1400);
  const 후 = await p.locator('.hwrow').count();
  console.log('  숙제 줄:', 전, '→', 후);
  확인('숙제가 늘었다', 후 > 전, true);
  const 안내 = (await p.locator('.toast').textContent()).trim();
  console.log('  안내:', 안내);
  확인('교재 이름으로 알려 준다', 안내.indexOf('예시 단어장') > -1, true);

  /* 교재 전원으로 들어갔는지 — 대상이 개별 이름이 아니어야 한다 */
  const 첫줄 = (await p.locator('.hwrow').first().textContent()).replace(/\s+/g, ' ').trim();
  console.log('  새 숙제 줄:', 첫줄.slice(0, 70));
  확인('교재 전원으로 나갔다', 첫줄.indexOf('교재 전원') > -1, true);

  /* ---------- 고른 학생만도 그대로 되는지 ---------- */
  console.log('\n— 고른 학생만 —');
  await p.locator('input[name=hwTarget][value="some"]').check();
  await p.waitForTimeout(500);
  확인('고른 학생만이면 학생칸이 뜬다', await p.locator('#hwStuWrap').isVisible(), true);
  확인('학생 체크박스가 있다', await p.locator('.hwStu').count() > 0, true);

  const 전2 = await p.locator('.hwrow').count();
  await p.evaluate(()=>{var e=document.getElementById('hwHand'); if(e) e.classList.remove('hide');});
  await p.fill('#hwFrom', '11');
  await p.fill('#hwTo', '20');
  await p.locator('.hwStu').first().check();
  await p.click('#btnHwAdd');
  await p.waitForTimeout(1400);
  확인('고른 학생에게도 나간다', await p.locator('.hwrow').count(), 전2 + 1);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
