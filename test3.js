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
  p.on('dialog', d => d.accept('중2 능률 3과'));
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw','1234'); await p.click('#btnTLogin');
  await p.waitForTimeout(600);
  await 탭가기(p, 'book');
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'b1_book.png', fullPage: true });

  // 단어 하나 눌러서 편집
  await p.click('#bkList .wrow >> nth=2');
  await p.waitForTimeout(250);
  await p.screenshot({ path: 'b2_edit.png', fullPage: true });
  await p.fill('#bkList .ed-ko', '그림을 그리다');
  await p.click('#bkList [data-save]');
  await p.waitForTimeout(500);
  const t = await p.textContent('#bkList');
  console.log('수정 반영:', t.includes('그림을 그리다'));

  // 검색
  await p.fill('#bkSearch','ass');
  await p.waitForTimeout(250);
  await p.screenshot({ path: 'b3_search.png', fullPage: true });
  console.log('검색 카운트:', (await p.textContent('#bkCount')).trim());
  await p.fill('#bkSearch','');
  await p.waitForTimeout(200);

  // 단어 추가
  await p.fill('#bkNewEn','testword'); await p.fill('#bkNewKo','시험 단어');
  await p.click('#bkAdd');
  await p.waitForTimeout(500);
  console.log('추가 반영:', (await p.textContent('#bkList')).includes('testword'));

  // 삭제
  await p.click('#bkList .wrow >> nth=0');
  await p.waitForTimeout(200);
  await p.click('#bkList [data-wdel]');
  await p.waitForTimeout(500);
  console.log('삭제 후 개수:', (await p.textContent('#bkCount')).trim());

  await 탭가기(p, 'roster');
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'b4_roster.png', fullPage: true });

  console.log(errs.length ? errs.join('\n') : 'NO JS ERRORS');
  await b.close();
})();
