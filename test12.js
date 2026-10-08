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

/* 시험지 한 장을 오답비율만큼 틀리게 채워 제출한다 (스펠링/첫글자/4지선다 공용) */
async function 시험지풀기(p, 오답비율){
  await p.waitForTimeout(400);
  const 시험지 = await p.evaluate(()=>document.getElementById('s-sheet').classList.contains('on'));
  if(!시험지) return false;
  await p.evaluate((r)=>{
    S.문제.forEach(function(w,i){
      var 틀리게 = (r>0 && i%r===0);
      if(S.모드==='choice'){
        var 줄=document.querySelector('.qrow[data-row="'+i+'"]');
        var 보기=qsa('.sch',줄);
        var 맞는칸=null, 틀린칸=null;
        보기.forEach(function(b){ if(b.dataset.v===w.ko) 맞는칸=b; else if(!틀린칸) 틀린칸=b; });
        var 고를것 = 틀리게 ? (틀린칸||맞는칸) : 맞는칸;
        if(고를것) 고를것.click();
      }else{
        var inp=document.querySelector('.qrow[data-row="'+i+'"] .sin');
        if(!inp) return;
        inp.value = 틀리게 ? 'zzzz' : w.en;
        inp.dispatchEvent(new Event('input'));
      }
    });
  }, 오답비율);
  await p.waitForTimeout(250);
  await p.click('#shSubmit');
  await p.waitForTimeout(1300);
  return true;
}

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(500);

  /* ---------- 학생: 낸 숙제는 사라진다 ---------- */
  await p.fill('#inPw', '1234');
  await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(900);
  await 알림닫기(p);
  await 허브넘기(p);
  console.log('처음 숙제 카드 수:', await p.locator('.hwcard').count());
  console.log('완료 카드 남아 있나?', await p.locator('.hwcard.done').count());
  console.log('낸 숙제 한 줄:', (await p.locator('.hwdone').count())
    ? (await p.locator('.hwdone').textContent()).trim() : '(없음)');
  await p.screenshot({ path: 'g1_home_pending.png', fullPage: true });

  // 첫 숙제를 끝까지 풀기
  const 전 = await p.locator('.hwcard').count();
  await p.click('[data-hbt="hw"]'); await p.waitForTimeout(400);
  await p.locator('[data-hw]').first().click();
  await p.waitForTimeout(800);
  await 시험지풀기(p, 0);
  await p.waitForTimeout(900);
  console.log('결과 안내:', (await p.textContent('#rSaved')).trim());
  await p.click('#s-result [data-back="home"]');
  await p.waitForTimeout(600);
  const 후 = await p.locator('.hwcard').count();
  console.log('푼 뒤 카드 수:', 전, '→', 후, 후 === 전 - 1 ? '(사라짐 OK)' : '(문제!)');
  console.log('낸 숙제 줄:', (await p.locator('.hwdone').count())
    ? (await p.locator('.hwdone').textContent()).trim() : '(없음)');
  await p.screenshot({ path: 'g2_home_after.png', fullPage: true });

  /* ---------- 선생님: 안 한 학생 ---------- */
  await p.click('#s-home [data-out]').catch(() => {});
  await p.reload(); await p.waitForTimeout(600);
  await p.click('#btnTeacherGo'); await p.fill('#tPw', '1234');
  await p.click('#btnTLogin'); await p.waitForTimeout(900);

  await 탭가기(p, 'hw'); await p.waitForTimeout(700);
  console.log('숙제 줄의 안 함 배지:', await p.locator('.pill.miss').count());
  console.log('다 냈어요 배지:', await p.locator('.hwrow .pill.ok').count());
  await p.locator('.pill.miss').first().click(); await p.waitForTimeout(450);
  console.log('펼친 명단:', (await p.locator('.misslist').textContent()).replace(/\s+/g, ' ').trim());
  await p.screenshot({ path: 'g3_hw_miss.png', fullPage: true });

  await 탭가기(p, 'miss'); await p.waitForTimeout(700);
  const t = (await p.textContent('#tBody')).replace(/\s+/g, ' ');
  console.log('안 한 학생 탭 머리글:', t.slice(0, 60).trim());
  console.log('학생별로 보기 있나?', t.indexOf('학생별로 보기') > -1);
  await p.screenshot({ path: 'g4_miss_tab.png', fullPage: true });
  await p.click('#btnMissSheet'); await p.waitForTimeout(800);
  console.log('시트 정리 후 버튼:', (await p.textContent('#btnMissSheet')).trim());

  console.log(errs.length ? errs.join('\n') : 'NO JS ERRORS');
  await b.close();
})();
