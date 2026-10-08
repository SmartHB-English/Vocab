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
  const p = await b.newPage({ viewport:{width:1440,height:1000} });
  const errs=[]; p.on('pageerror',e=>errs.push('ERR '+e.message));
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.click('#btnTeacherGo'); await p.fill('#tPw','1234'); await p.click('#btnTLogin');
  await p.waitForTimeout(900);
  await 탭가기(p, 'award'); await p.waitForTimeout(1300);

  const 카드수 = await p.locator('.awcard').count();
  console.log('상 카드 수:', 카드수, 카드수===3?'(만점왕 뺌 OK)':'(문제!)');
  const 카드 = await p.$$eval('.awcard', e=>e.map(x=>x.innerText.replace(/\s+/g,' ').trim()));
  카드.forEach(c=>console.log('  ·', c.slice(0,80)));
  console.log('집계표 줄:', await p.locator('#tBody tbody tr').count());
  console.log('달 고르개:', await p.$$eval('#awMonth option', e=>e.map(x=>x.textContent)));
  await p.screenshot({path:'m1_award.png'});
  await p.selectOption('#awMonth','2026-08'); await p.waitForTimeout(1200);
  console.log('달 바꾼 뒤 제목:', (await p.textContent('.kpi .v')).trim());
  await p.selectOption('#awMonth','2026-09'); await p.waitForTimeout(1200);
  console.log('시트에 남기기 버튼?', await p.isVisible('#btnAwSave'));
  await p.click('#btnAwSave'); await p.waitForTimeout(900);
  console.log('저장 후 버튼 글자:', (await p.textContent('#btnAwSave')).trim());
  console.log(errs.length?errs.join('\n'):'NO JS ERRORS');
  await b.close();
})();
