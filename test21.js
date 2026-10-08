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
  const errs=[];

  // --- 선생님: 보충 종류 ---
  const p = await b.newPage({ viewport:{width:1440,height:950} });
  p.on('pageerror',e=>errs.push('ERR '+e.message)); p.on('dialog',d=>d.accept());
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.click('#btnTeacherGo'); await p.fill('#tPw','1234'); await p.click('#btnTLogin');
  await p.waitForTimeout(900);
  await 탭가기(p, 'hw'); await p.waitForTimeout(800);

  const 라디오 = await p.$$eval('input[name=hwKind]', e=>e.map(x=>x.value));
  console.log('숙제 종류 고르개:', 라디오.join(' / '));
  await p.check('input[name=hwKind][value="보충"]'); await p.waitForTimeout(300);
  console.log('보충 고르면 마감일칸 숨나?',
    await p.locator('#hwDueWrap').evaluate(e=>e.classList.contains('hide')));
  console.log('보충 알약 있나?', await p.locator('.pill.bochung').count());
  await p.screenshot({path:'n1_hw_bochung.png'});

  // 수정 폼에도 세 개
  await p.locator('[data-edit]').last().click(); await p.waitForTimeout(400);
  const 수정라디오 = await p.$$eval('.eKind', e=>e.map(x=>x.value));
  console.log('수정폼 종류:', 수정라디오.join(' / '));
  console.log('보충 숙제 열면 보충 선택됨?',
    await p.locator('.eKind[value="보충"]').isChecked());
  await p.click('[data-cancel]'); await p.waitForTimeout(300);

  // 학생별에 보충 칸
  await 탭가기(p, 'students'); await p.waitForTimeout(700);
  const 머리 = await p.$$eval('#tBody thead th', e=>e.map(x=>x.textContent.trim()));
  console.log('학생별 표 머리:', 머리.filter(Boolean).join(' / '));
  const 김 = (await p.locator('#tBody tbody tr').filter({hasText:'김영희'}).first().textContent()).replace(/\s+/g,' ').trim();
  console.log('숙제 0회 보충만 한 학생:', 김);
  await p.screenshot({path:'n2_students.png'});

  // --- 학생 화면 ---
  const q = await b.newPage({ viewport:{width:390,height:900} });
  q.on('pageerror',e=>errs.push('ERR(학생) '+e.message));
  await q.goto(앱주소); await q.waitForTimeout(400);
  await q.fill('#inName', '홍길동');
  await q.click('#btnLogin'); await q.waitForTimeout(900);
  const 홈 = (await q.textContent('#hwBox')).replace(/\s+/g,' ');
  console.log('보충 카드 오늘칸에?', 홈.indexOf('보충 · 오늘까지')>-1);
  console.log('오늘 칸 개수 표시:', (홈.match(/오늘 끝낼 숙제\s*(\d+)개 남음/)||[])[0]||'(못 찾음)');
  await q.screenshot({path:'n3_student.png', fullPage:true});

  console.log(errs.length?errs.join('\n'):'NO JS ERRORS');
  await b.close();
})();
