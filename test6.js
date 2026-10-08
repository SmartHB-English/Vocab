const { chromium } = require('playwright');
const { 순위가기 } = require('./도구');
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
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.evaluate(() => { const d=document.getElementById('demoBadge'); if(d) d.remove(); });
  await p.fill('#inName','홍길동'); await p.fill('#inPw','1234'); await p.click('#btnLogin');
  await p.waitForTimeout(900);
  await 알림닫기(p);
  await 허브넘기(p);
  await p.screenshot({ path: 'k1_home.png', fullPage: true });

  /* 명예의 전당은 순위 화면 맨 위로 옮겼다 */
  await 순위가기(p);   /* 순위 탭은 없어졌다 — 게임 화면의 「순위」 타일로 들어간다 */
  await p.waitForTimeout(900);
  console.log('명예의 전당 배너:', (await p.textContent('#trophyBox')).replace(/\s+/g,' ').trim().slice(0,60));
  await p.click('[data-rk="이달의 점수"]');
  await p.waitForTimeout(700);
  await p.screenshot({ path: 'k2_rank.png', fullPage: true });

  // 결과 화면 연습 점수 문구
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(300);
  await 방법(p, 'spell'); await p.waitForTimeout(400);
  await 시험지풀기(p, 0);
  await p.waitForTimeout(700);
  console.log('결과 문구:', (await p.textContent('#rGame')).trim(), '/', (await p.textContent('#rGameNote')).trim());
  console.log(errs.length ? errs.join('\n') : 'NO JS ERRORS');
  await b.close();
})();
