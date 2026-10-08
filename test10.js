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
  const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
  const errs=[]; p.on('pageerror',e=>errs.push('ERR '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text());});
  await p.goto(앱주소); await p.waitForTimeout(400);
  // 데모 데이터에 단어장 두 개 섞기
  await p.evaluate(()=>{
    const base = DEMO.선생님요약;
    DEMO.선생님요약 = function(){
      const d = base();
      d.시험목록 = d.시험목록.concat([
        {키:11,시각:'09/06 19:10',반:'중2 A반',이름:'김영희',단어장:'불규칙 동사 50',범위:'1~20',유형:'3단변화',문항수:60,정답수:51,점수:85,게임점수:0,소요초:300,숙제:true,재시험:false,구분:'숙제',틀린단어:'go, be'},
        {키:12,시각:'09/05 19:10',반:'고3 B반',이름:'이철수',단어장:'불규칙 동사 50',범위:'1~50',유형:'3단변화',문항수:150,정답수:120,점수:80,게임점수:0,소요초:600,숙제:true,재시험:false,구분:'숙제',틀린단어:'write'}
      ]);
      d.숙제목록 = d.숙제목록.concat([
        {행:20,반:'중2 A반',단어장:'불규칙 동사 50',시작:1,끝:20,유형:'3단변화',마감일:'2026-12-31',학생:'',지남:false},
        {행:21,반:'고3 B반',단어장:'불규칙 동사 50',시작:1,끝:50,유형:'3단변화',마감일:'2020-01-01',학생:'',지남:true}
      ]);
      return d;
    };
  });
  await p.click('#btnTeacherGo'); await p.fill('#tPw','1234'); await p.click('#btnTLogin');
  await p.waitForTimeout(800);
  await 탭가기(p, 'today'); await p.waitForTimeout(600);
  await p.screenshot({path:'x1_results_grouped.png', fullPage:true});
  console.log('단어장 필터 옵션:', await p.$$eval('#fBook option', o=>o.map(x=>x.textContent)));
  await p.selectOption('#fBook','불규칙 동사 50'); await p.waitForTimeout(400);
  await p.screenshot({path:'x2_results_filtered.png', fullPage:true});
  console.log('필터 후 카드 수:', await p.$$eval('#tBody .panel', e=>e.length));
  await p.selectOption('#fBook',''); await p.waitForTimeout(300);

  await 탭가기(p, 'hw'); await p.waitForTimeout(500);
  await p.screenshot({path:'x3_hw_grouped.png', fullPage:true});
  console.log('지난숙제 버튼 있음?', await p.isVisible('#btnOldHw'));
  await p.click('#btnOldHw'); await p.waitForTimeout(400);
  await p.screenshot({path:'x4_hw_expanded.png', fullPage:true});
  console.log(errs.length?errs.join('\n'):'NO JS ERRORS');
  await b.close();
})();
