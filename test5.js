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
/* 로그인하면 알림 팝업이 뜬다 — 눌러서 닫고 시작한다 (실제 학생도 그렇게 합니다) */
async function 알림닫기(p){
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(350); }
}

/* 로그인하면 첫 화면(고르기)이 뜨므로 '단어' 칸으로 한 번 더 들어간다 */
async function 허브넘기(p){
  await p.waitForTimeout(400);
  /* 단어장·모드 고르기는 '연습' 칸으로 옮겼다 */
  await p.click('[data-hbt="mem"]');
  await p.waitForTimeout(500);
}
(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto(앱주소);
  await p.waitForTimeout(400);

  // 학생: 개별 숙제 배지 확인
  await p.fill('#inName','홍길동'); await p.fill('#inPw','1234'); await p.click('#btnLogin');
  await p.waitForTimeout(700);
  await 알림닫기(p);
  await 허브넘기(p);
  await p.screenshot({ path: 'h1_student_hw.png', fullPage: true });
  const hw = await p.textContent('#hwBox');
  console.log('학생 숙제 카드에 [나만] 있음:', hw.includes('나만'));

  // 선생님: 개별 숙제 내기
  await p.click('[data-hbt="hw"]'); await p.waitForTimeout(300);
  await p.click('#btnLogout'); await p.waitForTimeout(300);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw','1234'); await p.click('#btnTLogin');
  await p.waitForTimeout(600);
  await 탭가기(p, 'hw'); await p.waitForTimeout(400);
  await p.screenshot({ path: 'h2_hw_all.png', fullPage: true });
  console.log('학생칸 숨김:', await p.isHidden('#hwStuWrap'));

  await p.check('input[name=hwTarget][value=some]');
  await p.waitForTimeout(300);
  console.log('학생 체크박스:', await p.$$eval('.hwStu', e => e.map(x => x.value)));
  await p.screenshot({ path: 'h3_hw_some.png', fullPage: true });

  await p.check('.hwStu >> nth=0');
  await p.evaluate(()=>{var e=document.getElementById('hwHand'); if(e) e.classList.remove('hide');});
  await p.fill('#hwFrom','21'); await p.fill('#hwTo','25');
  await p.click('#btnHwAdd');
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'h4_hw_added.png', fullPage: true });
  console.log(errs.length ? errs.join('\n') : 'NO JS ERRORS');
  await b.close();
})();
