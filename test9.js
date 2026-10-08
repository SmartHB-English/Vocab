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
(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
  const errs=[]; p.on('pageerror',e=>errs.push('ERR '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text());});
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.evaluate(()=>{const d=document.getElementById('demoBadge'); if(d)d.remove();});
  await p.fill('#inName','홍길동'); await p.fill('#inPw','1234'); await p.click('#btnLogin');
  await p.waitForTimeout(1400);
  await 알림닫기(p);
  await 허브넘기(p);
  console.log('[일반 단어장] 3단변화 UI 숨김?', await p.isHidden('#verbForm'), await p.isHidden('#btnVerbTest'));

  await 책고르기(p, '불규칙 동사 50');
  console.log('[불규칙 단어장] 형태칩 보임?', await p.isVisible('#verbForm'), '/ 3단변화시험 보임?', await p.isVisible('#btnVerbTest'), '/ 일반모드 숨김?', await p.isHidden('#normalModes'));
  await p.screenshot({path:'w1_home_verb.png', fullPage:true});

  // 플래시카드 전체 → 15장
  await 방법(p, 'flash'); await p.waitForTimeout(500);
  console.log('플래시 전체 카드 수:', await p.evaluate(()=>S.문제.length));
  await p.click('#flashCard'); await p.waitForTimeout(300);
  await p.screenshot({path:'w2_flash_verb.png'});
  console.log('카드 뒷면 예:', await p.evaluate(()=>S.문제.map(x=>x.en+' → '+x.ko).slice(0,6)));
  await p.click('#s-flash [data-back="home"]'); await p.waitForTimeout(400);

  // 과거형만
  await p.click('[data-form="past"]'); await p.waitForTimeout(200);
  await 방법(p, 'flash'); await p.waitForTimeout(500);
  console.log('과거형만 카드 수:', await p.evaluate(()=>S.문제.length));
  await p.click('#s-flash [data-back="home"]'); await p.waitForTimeout(400);
  await p.click('[data-form="all"]'); await p.waitForTimeout(200);

  // 3단변화 시험
  await 방법(p, 'verb'); await p.waitForTimeout(600);
  await p.screenshot({path:'w3_verb_q.png'});
  // 1번: 일부러 하나 틀리기
  let f = await p.evaluate(()=>{const w=S.문제[S.idx]; return 세형태(w.en);});
  await p.fill('#vBase', f.원형); await p.fill('#vPast','zzz'); await p.fill('#vPp', f.분사);
  await p.click('#vSubmit'); await p.waitForTimeout(400);
  await p.screenshot({path:'w4_verb_feedback.png'});
  console.log('칸 표시:', await p.textContent('#vMark0'), await p.textContent('#vMark1'), await p.textContent('#vMark2'));
  await p.click('#vNext'); await p.waitForTimeout(400);
  // 나머지 다 맞히기
  for(let i=0;i<10;i++){
    const done=await p.evaluate(()=>document.getElementById('s-result').classList.contains('on'));
    if(done) break;
    f = await p.evaluate(()=>{const w=S.문제[S.idx]; return 세형태(w.en);});
    await p.fill('#vBase',f.원형); await p.fill('#vPast',f.과거.split('/')[0].trim()); await p.fill('#vPp',f.분사.split('/')[0].trim());
    await p.click('#vSubmit'); await p.waitForTimeout(350);
    await p.click('#vNext'); await p.waitForTimeout(350);
  }
  await p.waitForTimeout(600);
  await p.screenshot({path:'w5_verb_result.png', fullPage:true});
  console.log('결과 점수:', await p.textContent('#rScore'), '/ 맞은칸:', await p.textContent('#rRight'), '/ 라벨:', await p.textContent('#rRightL'), await p.textContent('#rComboL'));
  console.log(errs.length?errs.join('\n'):'NO JS ERRORS');
  await b.close();
})();
