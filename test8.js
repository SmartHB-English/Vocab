const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
const { 탭, 방법, 칸열기, 칸닫기, 책고르기, 범위정하기 } = require('./도구');
/* 칩 글자로 단어장 이름 찾기 */
async function 책이름(p, 조각){
  await 칸열기(p);
  const 것 = await p.locator('#bookChips [data-bk]').evaluateAll(es => es.map(e => e.dataset.bk));
  await 칸닫기(p);
  return 것.filter(x => x.indexOf(조각) > -1)[0] || 것[0];
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
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.evaluate(()=>{const d=document.getElementById('demoBadge'); if(d) d.remove();});
  await p.fill('#inName','홍길동'); await p.fill('#inPw','1234'); await p.click('#btnLogin');
  await p.waitForTimeout(900);
  await 알림닫기(p);
  await 허브넘기(p);

  async function 끝까지(n){
    await 시험지풀기(p, n);
  }

  // 숙제 → 오답 발생
  await p.click('[data-hbt="hw"]'); await p.waitForTimeout(400);
  await p.click('[data-hw="0"]'); await p.waitForTimeout(700);
  await 끝까지(3);
  console.log('[숙제 결과] 재시험박스 보임?', await p.isVisible('#rRetry'));
  console.log('[숙제 결과] 제목:', (await p.textContent('#rTitle')).trim());

  // 틀린 것만 다시
  await p.click('#btnRetryWrong'); await p.waitForTimeout(600);
  await p.screenshot({path:'z1_quiz_retry.png'});
  console.log('[시험중] 다시풀기 배지 보임?', await p.isVisible('#qRetry'));
  await 끝까지(99);
  await p.screenshot({path:'z2_result_retry.png', fullPage:true});
  console.log('[재시험 결과] 제목:', (await p.textContent('#rTitle')).trim());
  console.log('[재시험 결과] 안내:', (await p.textContent('#rSaved')).trim());

  // 다시 일반 시험 → 박스 사라져야 함
  await p.click('#s-result [data-back="home"]'); await p.waitForTimeout(400);
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(400);
  await p.evaluate(()=>{var e=document.getElementById('handRange'); if(e) e.classList.remove('hide');});
  await 범위정하기(p, 1, 5); 
  await 방법(p, 'spell'); await p.waitForTimeout(400);
  console.log('[일반 시험중] 다시풀기 배지 보임?', await p.isVisible('#qRetry'));
  await 끝까지(2);
  console.log('[일반 결과] 재시험박스 보임?', await p.isVisible('#rRetry'));
  console.log(errs.length?errs.join('\n'):'NO JS ERRORS');
  await b.close();
})();
