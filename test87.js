/* 시험 타이머 — 화면 위에 떠 있는 시계 하나(#fixClock). 스크롤해도 늘 보인다
   스크롤 시험지 · 3단변화 · 외우기 세 화면이 같이 쓴다. 화면 안의 시계(shClock·vClock·wbClock)는 늘 숨어 있다 */
const path = require('path');
const { chromium } = require('playwright');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 방법, 칸열기, 칸닫기, 책고르기 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) + (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
const 시간당기기 = (p, 초) => p.evaluate(s => { 제한.끝날때 = Date.now() + s * 1000; }, 초);
/* 맨 아래까지 내린다 — 창도, 안에서 스크롤되는 칸도 */
const 끝까지내리기 = p => p.evaluate(() => {
  window.scrollTo(0, document.documentElement.scrollHeight);
  document.querySelectorAll('.screen.on, .screen.on *').forEach(e => { if (e.scrollHeight > e.clientHeight + 4) e.scrollTop = e.scrollHeight; });
});
/* 시계가 지금 화면 안에 보이는가 — 위치 · 크기 · 숨김 */
const 화면안인가 = p => p.evaluate(() => {
  const e = document.getElementById('fixClock'), r = e.getBoundingClientRect();
  return !e.classList.contains('hide') && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
});
const 화면안시계숨음 = p => p.evaluate(() => ['shClock', 'vClock', 'wbClock'].every(id => document.getElementById(id).classList.contains('hide')));

async function 학생으로(b) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동');
  await p.click('#btnLogin'); await p.waitForTimeout(1800);
  if (await p.locator('#noti').isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }
  return p;
}
const errs = [];

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);

  console.log('— 떠 있는 시계는 #app 밖에 하나 —');
  let p = await 학생으로(b);
  확인('body 바로 아래 · #app 안이 아니다', await p.evaluate(() => { const e = document.getElementById('fixClock'); return [e.parentElement === document.body, !!e.closest('#app')]; }), [true, false]);
  확인('position:fixed · pointer-events:none', await p.evaluate(() => { const s = getComputedStyle(fixClock); return [s.position, s.pointerEvents]; }), ['fixed', 'none']);
  확인('평소에는 안 보인다', await p.locator('#fixClock').isVisible(), false);

  console.log('\n— 외우기 단계 —');
  await p.click('[data-hbt="test"]'); await p.waitForTimeout(900);
  await p.click('.excard'); await p.waitForTimeout(2400);
  확인('외우는 중 · 떠 있는 시계가 보인다', [await p.locator('#wbMem').isVisible(), await p.locator('#fixClock').isVisible()], [true, true]);
  확인('시계 글', /^⏱ \d+:\d\d$/.test((await p.locator('#fixClock').innerText()).trim()), true);
  await 끝까지내리기(p); await p.waitForTimeout(300);
  확인('맨 아래까지 내려도 화면 안에 그대로', await 화면안인가(p), true);
  확인('화면 안의 시계는 숨어 있다', await 화면안시계숨음(p), true);

  console.log('\n— 스크롤 시험지 —');
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('#wbGo'); await p.waitForTimeout(1200);
  확인('시험지가 열리고 시계가 보인다', [await p.locator('#s-sheet').isVisible(), await p.locator('#fixClock').isVisible()], [true, true]);
  확인('문항이 화면보다 길다', await p.evaluate(() => document.documentElement.scrollHeight > innerHeight + 200), true);
  await p.locator('.qrow').last().scrollIntoViewIfNeeded();
  await 끝까지내리기(p); await p.waitForTimeout(300);
  확인('마지막 문항까지 내려도 화면 안에 그대로', await 화면안인가(p), true);
  확인('「← 그만」 쪽(왼쪽)이 아니라 오른쪽 위', await p.evaluate(() => { const r = fixClock.getBoundingClientRect(); return r.left > innerWidth / 2 && r.top < 80; }), true);
  확인('화면 안의 시계는 숨어 있다', await 화면안시계숨음(p), true);
  확인('「가로」 단추가 시계 밑에 숨지 않는다', await p.evaluate(() => { const c = fixClock.getBoundingClientRect(); return [...document.querySelectorAll('.screen.on .rotbtn')].filter(b => b.offsetParent).every(b => { const r = b.getBoundingClientRect(); return r.right <= c.left || r.top >= c.bottom; }); }), true);
  /* 시계 밑의 것이 눌린다 — 그 자리에서 잡히는 것은 시계가 아니다 */
  확인('시계가 누르기를 가로채지 않는다', await p.evaluate(() => { const r = fixClock.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && e.id !== 'fixClock'; }), true);
  await 시간당기기(p, 50); await p.waitForTimeout(1300);
  확인('1분 남으면 빨갛게 · 더 크게', await p.evaluate(() => [fixClock.classList.contains('soon'), parseFloat(getComputedStyle(fixClock).fontSize) > 16]), [true, true]);
  await 시간당기기(p, 1); await p.waitForTimeout(1900);
  확인('시간이 다 되면 저절로 제출 · 시계가 사라진다', [await p.locator('#s-result').isVisible(), await p.locator('#fixClock').isVisible()], [true, false]);

  console.log('\n— 3단변화 시험 —');
  const p2 = await 학생으로(b);
  await p2.evaluate(() => {
    var h = S.숙제.filter(x => x.종류 === '시험')[0];
    h.단어장 = '불규칙 동사 50'; h.유형 = '3단변화'; h.시작 = 1; h.끝 = 5;
    그리기_시험목록_();
  });
  await p2.click('[data-hbt="test"]'); await p2.waitForTimeout(900);
  await p2.click('.excard'); await p2.waitForTimeout(2400);
  await p2.click('#wbGo'); await p2.waitForTimeout(1200);
  확인('세 칸 화면 · 시계가 보인다', [await p2.locator('#s-verb').isVisible(), await p2.locator('#fixClock').isVisible()], [true, true]);
  /* 화면이 짧아도 내릴 수 있게 아래에 자리를 붙여 본다 — .top 에는 sticky 가 없어 예전엔 올라가 버렸다 */
  await p2.evaluate(() => { const d = document.createElement('div'); d.id = '__긴칸'; d.style.height = '1600px'; document.getElementById('s-verb').appendChild(d); });
  await 끝까지내리기(p2); await p2.waitForTimeout(300);
  확인('내려도 화면 안에 그대로', [await p2.evaluate(() => scrollY > 300), await 화면안인가(p2)], [true, true]);
  확인('화면 안의 시계는 숨어 있다', await 화면안시계숨음(p2), true);
  await p2.evaluate(() => { document.getElementById('__긴칸').remove(); window.scrollTo(0, 0); });

  console.log('\n— 화면을 떠나면 시계도 안 보인다 (셈은 그대로) —');
  await p2.evaluate(() => show('home')); await p2.waitForTimeout(300);
  확인('다른 화면에서는 안 보인다 · 시간은 계속 센다', [await p2.locator('#fixClock').isVisible(), await p2.evaluate(() => !!제한.시계)], [false, true]);
  await p2.evaluate(() => show('verb')); await p2.waitForTimeout(1300);
  확인('돌아오면 다시 보인다', await p2.locator('#fixClock').isVisible(), true);

  console.log('\n— 제한시간이 없는 연습 —');
  const p3 = await 학생으로(b);
  await p3.click('[data-hbt="mem"]'); await p3.waitForTimeout(1400);
  await 칸열기(p3);
  const 책 = (await p3.locator('#bookChips [data-bk]').evaluateAll(es => es.map(e => e.dataset.bk))).filter(x => x.indexOf('예시') > -1)[0];
  await 칸닫기(p3);
  await 책고르기(p3, 책); await p3.waitForTimeout(1400);
  await 방법(p3, 'spell'); await p3.waitForTimeout(900);
  await 끝까지내리기(p3); await p3.waitForTimeout(300);
  확인('연습 시험지 · 떠 있는 시계가 아예 없다', [await p3.locator('#s-sheet').isVisible(), await p3.locator('#fixClock').isVisible(), await p3.evaluate(() => 제한.시계)], [true, false, null]);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
