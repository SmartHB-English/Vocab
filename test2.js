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
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(500);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw', '1234');
  await p.click('#btnTLogin');
  await p.waitForTimeout(700);
  await 탭가기(p, 'today'); await p.waitForTimeout(600);
  await p.screenshot({ path: 't1_results.png', fullPage: true });

  await p.click('#chkAll');
  await p.waitForTimeout(200);
  await p.screenshot({ path: 't2_selected.png', fullPage: true });
  await p.click('#btnClean');
  await p.waitForTimeout(700);
  await p.screenshot({ path: 't3_after.png', fullPage: true });

  console.log(errs.length ? errs.join('\n') : 'NO JS ERRORS');
  await b.close();
})();
