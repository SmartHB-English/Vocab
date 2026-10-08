/* 화면마다 필요한 것만 받아 온다 · 불러오는 중 표시 · ↻ 새로고침 */
const { chromium } = require('playwright');
const { 순위가기 } = require('./도구');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
const 부른것 = p => p.evaluate(() => window.__부른것.slice());
const 비우기 = p => p.evaluate(() => { window.__부른것.length = 0; });

/* api 를 가로채 무엇을 몇 번 불렀는지 적어 둔다. 늦기(ms) 만큼 일부러 늦춘다 */
async function 엿듣기(p, 늦기) {
  await p.evaluate(ms => {
    window.__부른것 = [];
    const 원래api = window.api;
    window.api = function (이름) {
      window.__부른것.push(이름);
      return 원래api.apply(null, arguments);
    };
    if (ms) {                       /* 느린 인터넷 흉내 — 세는 것보다 안쪽에 둔다 */
      const 원래부르기 = window.부르기_;
      window.부르기_ = function (fn, args) {
        return new Promise(function (풀기, 깨기) {
          setTimeout(function () { 원래부르기(fn, args).then(풀기, 깨기); }, ms);
        });
      };
    }
  }, 늦기 || 0);
}

async function 들어가기(p, 늦기) {
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await 엿듣기(p, 늦기);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
}

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', d => d.accept());

  console.log('— 들어갈 때는 숙제 화면 것만 부른다 —');
  await 들어가기(p, 600);
  await p.waitForTimeout(1000);
  확인('숙제 자리에 뼈대가 보인다', await p.locator('#hwBox .skl').count() > 0, true);
  확인('위쪽 막대는 없앴다', await p.locator('#loadBar').count(), 0);
  await p.screenshot({ path: 'ld1_skeleton.png' });

  await p.waitForTimeout(2200);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }

  const 처음 = await 부른것(p);
  console.log('  부른 것: ' + 처음.join(', '));
  확인('로그인·공지·숙제·연속, 이 넷만 부른다', 처음.slice().sort(),
    ['공지가져오기', '로그인', '숙제가져오기', '연속가져오기']);
  확인('단어는 아직 안 부른다', 처음.indexOf('단어가져오기'), -1);
  확인('월간순위도 아직', 처음.indexOf('월간순위'), -1);
  확인('게임순위도 아직', 처음.indexOf('게임순위'), -1);
  확인('뼈대는 사라졌다', await p.locator('#hwBox .skl').count(), 0);
  확인('숙제가 그려졌다', await p.locator('#hwBox [data-hw]').count() > 0, true);
  확인('↻ 단추도 멈춰 있다',
    await p.locator('#btnRefresh').evaluate(e => e.classList.contains('doing')), false);

  console.log('\n— 연습 화면을 열 때 단어를 받는다 —');
  await 비우기(p);
  await p.click('[data-hbt="mem"]');
  await p.waitForTimeout(1500);
  확인('단어를 그때 부른다', await 부른것(p), ['단어가져오기']);
  확인('레슨 고르개가 생긴다', await p.locator('#lesSel').count(), 1);

  console.log('\n— 다시 들어가도 또 부르지 않는다 —');
  await 비우기(p);
  await p.click('[data-hbt="hw"]'); await p.waitForTimeout(400);
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(900);
  확인('아무것도 안 부른다', await 부른것(p), []);

  console.log('\n— 순위 화면을 열 때 이달의 점수를 받는다 —');
  await 비우기(p);
  await 순위가기(p);   /* 순위 탭은 없어졌다 — 게임 화면의 「순위」 타일로 들어간다 */
  await p.waitForTimeout(1500);
  const 순위부름 = [...new Set(await 부른것(p))].sort();
  console.log('  부른 것: ' + 순위부름.join(', '));
  확인('월간순위와 게임순위를 그때 부른다', 순위부름, ['게임순위', '단어가져오기', '월간순위']);
  확인('순위 화면이 열려 있다', await p.locator('#s-streak').isVisible(), true);

  console.log('\n— ↻ 를 누르면 숙제 화면 것을 다시 받는다 —');
  await p.click('[data-hbt="hw"]'); await p.waitForTimeout(400);
  await 비우기(p);
  확인('↻ 단추가 보인다', await p.locator('#btnRefresh').isVisible(), true);
  await p.click('#btnRefresh');
  await p.waitForTimeout(200);
  확인('누르는 동안 단추가 돈다',
    await p.locator('#btnRefresh').evaluate(e => e.classList.contains('doing')), true);
  await p.screenshot({ path: 'ld2_refresh.png' });
  await p.waitForTimeout(2200);
  const 다시 = (await 부른것(p)).sort();
  console.log('  부른 것: ' + 다시.join(', '));
  확인('숙제 화면 것만 다시 부른다', 다시, ['공지가져오기', '숙제가져오기', '연속가져오기']);
  확인('단추가 멈춘다',
    await p.locator('#btnRefresh').evaluate(e => e.classList.contains('doing')), false);
  확인('숙제가 그대로 보인다', await p.locator('#hwBox [data-hw]').count() > 0, true);

  console.log('\n— ↻ 뒤에는 연습·순위도 새로 받는다 —');
  await 비우기(p);
  await p.click('[data-hbt="mem"]');
  await p.waitForTimeout(1500);
  확인('단어를 다시 부른다', await 부른것(p), ['단어가져오기']);

  console.log('\n— 숙제·시험 탭과 순위 화면에 ↻ 가 있다 —');
  /* 외우기·게임 탭은 큰 제목만 두고 옛 위 띠(.top)를 숨겨서 ↻ 가 없다.
     대신 숙제·순위의 ↻ 가 「받은 표시」 를 지워 두어 그 탭을 열 때 새로 받는다 (아래에서 본다).
     시험 탭은 「선생님이 낸 시험」 머리의 ↻ 새로고침(#hbExRef)이 그 자리다. */
  await p.click('[data-hbt="hw"]'); await p.waitForTimeout(1200);
  확인('숙제 탭에 ↻ 가 보인다', await p.locator('.screen.on .refbtn').isVisible(), true);
  await p.click('[data-hbt="test"]'); await p.waitForTimeout(1200);
  확인('시험 탭에 ↻ 가 보인다', await p.locator('#hbExRef').isVisible(), true);
  await 순위가기(p); await p.waitForTimeout(1200);
  확인('순위 화면에도 ↻ 가 보인다',
    await p.locator('.screen.on .refbtn').isVisible(), true);

  console.log('\n— 탭마다 그 탭 것만 다시 받는다 —');
  async function 눌러보기(t, 이름) {
    if (t === 'streak') {               /* 순위는 게임 칸 안으로 들어갔다 */
      await p.click('[data-hbt="game"]'); await p.waitForTimeout(800);
      await p.click('#btnGmRank');
    } else {
      await p.click('[data-hbt="' + t + '"]');
    }
    await p.waitForTimeout(1300);
    await 비우기(p);
    await p.click(t === 'test' ? '#hbExRef' : '.screen.on .refbtn');
    await p.waitForTimeout(2200);
    const r = (await 부른것(p)).sort();
    console.log('  ' + 이름 + ' → ' + (r.join(', ') || '(없음)'));
    return r;
  }
  확인('순위에서는 순위만',
    await 눌러보기('streak', '순위'), ['게임순위', '월간순위']);
  확인('시험에서는 숙제 목록을 다시',
    await 눌러보기('test', '시험'), ['공지가져오기', '숙제가져오기', '연속가져오기']);
  확인('숙제에서도 그대로',
    await 눌러보기('hw', '숙제'), ['공지가져오기', '숙제가져오기', '연속가져오기']);
  /* 외우기에는 ↻ 가 없으니, 숙제의 ↻ 뒤에 외우기를 열면 단어를 새로 받아야 한다 */
  await 비우기(p);
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(1500);
  확인('↻ 뒤에 외우기를 열면 단어를 새로 받는다', await 부른것(p), ['단어가져오기']);

  console.log('\n— 부르는 동안 단추들이 같이 돈다 —');
  await 순위가기(p);   /* 순위 탭은 없어졌다 — 게임 화면의 「순위」 타일로 들어간다 */ await p.waitForTimeout(1200);
  await p.click('.screen.on .refbtn');
  await p.waitForTimeout(200);
  확인('그 화면 단추가 돈다',
    await p.locator('.screen.on .refbtn').evaluate(e => e.classList.contains('doing')), true);
  await p.waitForTimeout(2200);
  확인('다 받으면 멈춘다',
    await p.evaluate(() => [...document.querySelectorAll('.refbtn')]
      .filter(e => e.classList.contains('doing')).length), 0);

  console.log('\n— 나갔다 다시 들어와도 마찬가지 —');
  await p.click('[data-hbt="hw"]'); await p.waitForTimeout(400);
  await p.click('#btnLogout'); await p.waitForTimeout(600);
  확인('로그인 화면으로 간다', await p.locator('#s-login').isVisible(), true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
