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
  const p = await b.newPage({ viewport: { width: 390, height: 860 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(500);

  // 선생님 화면
  await p.click('#btnTeacherGo'); await p.waitForTimeout(300);
  await p.fill('#tPw', '1234'); await p.click('#btnTLogin'); await p.waitForTimeout(900);
  await 탭가기(p, 'hw'); await p.waitForTimeout(700);

  console.log('숙제 줄 수:', await p.locator('.hwrow').count());
  console.log('체크박스 수:', await p.locator('.hwPick').count());
  console.log('선택 삭제 처음에 꺼져 있나?', await p.locator('.hwDelSel').first().isDisabled());

  // 하나 고르기
  await p.locator('.hwPick').first().check(); await p.waitForTimeout(400);
  console.log('한 개 고른 뒤 버튼:', (await p.locator('.hwDelSel').first().textContent()).trim());
  await p.screenshot({ path: 'f1_hw_pick.png', fullPage: true });

  // 전체 선택
  await p.locator('.hwAll').first().check(); await p.waitForTimeout(400);
  console.log('전체 선택 뒤 버튼:', (await p.locator('.hwDelSel').first().textContent()).trim());

  // 전체 해제 후 두 개만 삭제
  await p.locator('.hwAll').first().uncheck(); await p.waitForTimeout(400);
  console.log('전체 해제 뒤 버튼 꺼짐?', await p.locator('.hwDelSel').first().isDisabled());
  await p.locator('.hwPick').nth(0).check(); await p.waitForTimeout(350);
  await p.locator('.hwPick').nth(1).check(); await p.waitForTimeout(350);
  await p.locator('.hwDelSel').first().click(); await p.waitForTimeout(900);
  console.log('삭제 후 남은 줄:', await p.locator('.hwrow').count());

  // 수정
  await p.locator('[data-edit]').first().click(); await p.waitForTimeout(400);
  console.log('수정폼 열림?', await p.isVisible('.hwedit'));
  const 당일 = await p.locator('.eKind[value="당일"]').isChecked();
  const 숨김 = await p.locator('.eDueWrap').first().evaluate(e => e.classList.contains('hide'));
  console.log('당일 선택 =', 당일, '/ 마감일칸 숨김 =', 숨김, 당일 === 숨김 ? '(일치 OK)' : '(문제!)');
  await p.screenshot({ path: 'f2_hw_edit.png', fullPage: true });

  await p.locator('.eKind[value="기한"]').check(); await p.waitForTimeout(300);
  console.log('기한 고른 뒤 마감일칸 보임?', await p.isVisible('.eDue'));
  await p.fill('.eFrom', '5'); await p.fill('.eTo', '30');
  await p.selectOption('.eType', '첫 글자');
  await p.fill('.eDue', '2026-11-20');
  await p.click('[data-save]'); await p.waitForTimeout(900);
  const 줄 = (await p.locator('.hwrow').first().textContent()).replace(/\s+/g, ' ').trim();
  console.log('고친 뒤 줄:', 줄);
  await p.screenshot({ path: 'f3_hw_saved.png', fullPage: true });

  // 취소 동작
  await p.locator('[data-edit]').first().click(); await p.waitForTimeout(350);
  await p.click('[data-cancel]'); await p.waitForTimeout(350);
  console.log('취소 후 수정폼 닫힘?', !(await p.isVisible('.hwedit')));

  console.log(errs.length ? errs.join('\n') : 'NO JS ERRORS');
  await b.close();
})();
