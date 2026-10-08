/* 휴대폰·브라우저 뒤로가기 — 앱 안에서 전 화면으로 돌아간다 */
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
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
const 화면 = p => p.evaluate(() => 지금화면_());
const 표 = p => p.evaluate(() => 뒤로표_.slice());
async function 뒤로(p, 번 = 1) {
  for (let i = 0; i < 번; i++) { await p.goBack(); await p.waitForTimeout(500); }
}

async function 학생으로(p) {
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }
}

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', d => d.accept());
  await 학생으로(p);

  console.log('— 들어오자마자는 되돌릴 것이 없다 —');
  확인('숙제 화면', await 화면(p), 'home');
  확인('발자국이 없다', await 표(p), []);

  console.log('\n— 아래 칸을 옮겨 다닌다 —');
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(900);
  확인('연습으로 간다', await 화면(p), 'study');
  확인('발자국 하나', await 표(p), ['home']);
  await p.click('[data-hbt="test"]'); await p.waitForTimeout(900);
  확인('시험으로 간다', await 화면(p), 'exam');
  확인('발자국 둘', await 표(p), ['home', 'study']);

  console.log('\n— 뒤로가기로 되짚어 간다 —');
  await 뒤로(p);
  확인('연습으로 돌아온다', await 화면(p), 'study');
  확인('발자국 하나', await 표(p), ['home']);
  await 뒤로(p);
  확인('숙제로 돌아온다', await 화면(p), 'home');
  확인('발자국이 없다', await 표(p), []);

  console.log('\n— 이미 지나온 화면을 다시 누르면 발자국이 걷힌다 —');
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(700);
  await p.click('[data-hbt="test"]'); await p.waitForTimeout(700);
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(900);
  확인('연습 화면', await 화면(p), 'study');
  확인('발자국은 숙제 하나뿐', await 표(p), ['home']);
  await 뒤로(p);
  확인('숙제로 돌아온다', await 화면(p), 'home');

  console.log('\n— 숙제를 풀다가 뒤로가기 —');
  await p.locator('#hwBox [data-hw]').first().click();
  await p.waitForTimeout(2400);
  const 푸는곳 = await 화면(p);
  console.log('  ' + 푸는곳);
  확인('시험지나 세 칸 화면', ['sheet', 'verb'].indexOf(푸는곳) > -1, true);
  확인('발자국에 숙제 화면이 있다', await 표(p), ['home']);
  await 뒤로(p);
  확인('숙제로 돌아온다', await 화면(p), 'home');
  확인('발자국이 없다', await 표(p), []);

  console.log('\n— 「그만」 으로 나온 뒤엔 뒤로가기가 시험으로 되돌아가지 않는다 —');
  await p.locator('#hwBox [data-hw]').first().click();
  await p.waitForTimeout(2400);
  const 그만 = (await 화면(p)) === 'verb' ? '#s-verb [data-back]' : '#shBack';
  await p.click(그만);
  await p.waitForTimeout(900);
  확인('숙제로 나온다', await 화면(p), 'home');
  확인('발자국이 걷혔다', await 표(p), []);
  /* 발자국이 없으니 여기서 뒤로가기를 누르면 앱이 닫힌다 —
     시험으로 되돌아가지 않는다는 뜻이다 */
  확인('앱 발자국도 남지 않았다', await p.evaluate(() => 무시할팝_), 0);

  console.log('\n— 시험 칸: 외우기 → 시험 중에 뒤로가기 —');
  await p.click('[data-hbt="test"]'); await p.waitForTimeout(900);
  await p.click('.excard'); await p.waitForTimeout(2400);
  확인('외우는 중', await 화면(p), 'book');
  await p.click('#wbGo'); await p.waitForTimeout(1200);
  확인('시험을 보는 중', ['sheet', 'verb'].indexOf(await 화면(p)) > -1, true);
  확인('시험판이 살아 있다', await p.evaluate(() => !!시험판), true);
  await 뒤로(p);
  확인('시작한 자리(시험 칸)로 돌아온다', await 화면(p), 'exam');
  확인('중간 화면을 안 거친다', await 표(p), []);
  확인('시험판이 치워진다', await p.evaluate(() => 시험판), null);
  확인('시계도 멈춘다', await p.evaluate(() => 제한.시계), null);

  console.log('\n— 답을 쓰다 나가면 한 번 물어본다 —');
  const 물음 = [];
  p.on('dialog', d => 물음.push(d.message()));
  await p.click('[data-hbt="mem"]'); await p.waitForTimeout(1200);
  await 책고르기(p, await 책이름(p, '예시')); 
  await p.waitForTimeout(1400);
  await 방법(p, 'spell');
  await p.waitForTimeout(900);
  확인('시험지가 열린다', await 화면(p), 'sheet');
  await p.locator('.qrow[data-row="0"] .sin').fill('abc');
  await p.waitForTimeout(300);
  await 뒤로(p);
  console.log('  ' + 물음.join(' / '));
  확인('물어본다', 물음.some(m => /쓴 답이 사라집니다/.test(m)), true);
  확인('「예」 라서 나온다', await 화면(p), 'exam');

  console.log('\n— 알림 창이 떠 있으면 그것부터 닫는다 —');
  const p2 = await b.newPage({ viewport: { width: 420, height: 900 } });
  p2.on('pageerror', e => errs.push('PAGEERROR2: ' + e.message));
  p2.on('dialog', d => d.accept());
  await p2.goto(앱주소);
  await p2.waitForTimeout(400);
  await p2.fill('#inPw', '1234'); await p2.fill('#inName', '홍길동');
  await p2.click('#btnLogin');
  await p2.waitForTimeout(2200);
  if (await p2.locator('#noti').isVisible()) {
    await 뒤로(p2);
    확인('알림 창이 닫힌다', await p2.locator('#noti').isVisible(), false);
    확인('화면은 그대로 숙제', await 화면(p2), 'home');
    확인('발자국은 그대로 없다', await 표(p2), []);
  } else {
    console.log('  (이번 판엔 알림 창이 안 떴다 — 건너뜀)');
  }

  console.log('\n— 선생님 화면에서도 돌아온다 —');
  const t = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  t.on('pageerror', e => errs.push('PAGEERROR(선생님): ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소);
  await t.waitForTimeout(400);
  await t.click('#btnTeacherGo');
  await t.waitForTimeout(500);
  확인('선생님 화면', await 화면(t), 'teacher');
  확인('로그인 화면이 발자국에 남는다', await 표(t), ['login']);
  await 뒤로(t);
  확인('로그인 화면으로 돌아온다', await 화면(t), 'login');
  확인('발자국이 비었다', await 표(t), []);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
