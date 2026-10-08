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
(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.click('#btnTeacherGo'); await p.fill('#tPw', '1234');
  await p.click('#btnTLogin'); await p.waitForTimeout(900);
  await 탭가기(p, 'roster'); await p.waitForTimeout(1000);

  console.log('학생 줄:', await p.locator('#tBody tbody tr').count());
  const 머리 = await p.$$eval('#tBody thead th', e => e.map(x => x.textContent.trim()));
  console.log('표 머리:', 머리.filter(Boolean).join(' / '));
  const 첫줄 = (await p.locator('#tBody tbody tr').first().textContent()).replace(/\s+/g, ' ').trim();
  console.log('첫 줄:', 첫줄);
  await p.screenshot({ path: 'j1_roster.png' });

  // 수정 열기
  await p.locator('[data-sedit]').first().click(); await p.waitForTimeout(400);
  console.log('수정폼 열림?', await p.isVisible('.stediting'));
  console.log('반 고르개는 사라졌나?', (await p.locator('.sBan').count()) === 0);

  // 학년·학교 고치기
  await p.fill('.sGrade', '중3');
  await p.fill('.sSchool', '무악중');
  await p.click('[data-ssave]'); await p.waitForTimeout(1200);
  const 바뀐줄 = (await p.locator('#tBody tbody tr').first().textContent()).replace(/\s+/g, ' ').trim();
  console.log('고친 뒤:', 바뀐줄);

  // 학년 필터는 초중등부 / 고등부 로
  const 학년들 = await p.$$eval('#stFClass option', e => e.map(x => x.textContent.trim()));
  console.log('필터 목록:', 학년들.join(' / '));
  await p.screenshot({ path: 'j2_roster_moved.png' });

  // 이름 중복 막기
  await p.locator('[data-sedit]').nth(0).click(); await p.waitForTimeout(400);
  await p.fill('.sName', '김영희');
  await p.click('[data-ssave]'); await p.waitForTimeout(1000);
  console.log('중복 막혔나? (수정폼 그대로)', await p.isVisible('.stediting'));
  await p.click('[data-scancel]'); await p.waitForTimeout(400);

  // 찾기
  await p.fill('#stFind', '한성'); await p.waitForTimeout(800);
  console.log('“한성”으로 찾은 줄:', await p.locator('#tBody tbody tr').count());

  console.log(errs.length ? errs.join('\n') : 'NO JS ERRORS');
  await b.close();
})();
