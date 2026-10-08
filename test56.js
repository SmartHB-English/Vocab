/* 학생 화면 「화면 돌리기」 단추 — 가로/세로 전환 */
const { chromium } = require('playwright');
const { 방법 } = require('./도구');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

/* 기기 흉내 — 돌릴 수 있는 기기(태블릿)와 못 하는 기기(아이폰) */
function 기기흉내() {
  return function (돌릴수있나) {
    window.__발자취 = [];
    var 방향 = { type: 'portrait-primary' };
    var 듣는이 = [];
    방향.addEventListener = function (이름, f) { if (이름 === 'change') 듣는이.push(f); };
    방향.__알리기 = function () { 듣는이.forEach(function (f) { try { f(); } catch (e) {} }); };
    if (돌릴수있나) {
      방향.lock = function (무엇) {
        window.__발자취.push('lock:' + 무엇);
        방향.type = (무엇 === 'landscape') ? 'landscape-primary' : 무엇;
        setTimeout(방향.__알리기, 0);
        return Promise.resolve();
      };
      방향.unlock = function () {
        window.__발자취.push('unlock');
        방향.type = 'portrait-primary';
        setTimeout(방향.__알리기, 0);
      };
    }
    Object.defineProperty(window.screen, 'orientation', { configurable: true, value: 방향 });

    var 전체 = null;
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      value: function () {
        window.__발자취.push('fullscreen');
        전체 = this;
        setTimeout(function () { document.dispatchEvent(new Event('fullscreenchange')); }, 0);
        return Promise.resolve();
      }
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: function () {
        window.__발자취.push('exit');
        전체 = null;
        setTimeout(function () { document.dispatchEvent(new Event('fullscreenchange')); }, 0);
        return Promise.resolve();
      }
    });
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: function () { return 전체; } });
  };
}

async function 들어가기(p) {
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }
}
const 글자 = async p => (await p.locator('#btnRotate').textContent()).trim();
const 발자취 = p => p.evaluate(() => window.__발자취);

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const errs = [];

  console.log('— 돌릴 수 있는 기기 —');
  const p = await b.newPage({ viewport: { width: 800, height: 1200 } });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', d => d.accept());
  await p.addInitScript(기기흉내(), true);
  await 들어가기(p);

  확인('숙제 화면이 열린다', await p.locator('#s-home').isVisible(), true);
  확인('단추가 보인다', await p.locator('#btnRotate').isVisible(), true);
  확인('처음엔 「가로」', await 글자(p), '가로');
  확인('「나가기」와 같은 줄에 있다', await p.evaluate(() => {
    var a = document.getElementById('btnRotate').getBoundingClientRect();
    var c = document.getElementById('btnLogout').getBoundingClientRect();
    return Math.abs(a.top - c.top) < 6;
  }), true);
  확인('아직 아무것도 안 했다', await 발자취(p), []);
  await p.screenshot({ path: 'rot1_portrait.png' });

  console.log('\n— 누르면 가로로 —');
  await p.click('#btnRotate');
  await p.waitForTimeout(700);
  확인('전체화면 먼저, 그다음 가로 잠금', await 발자취(p), ['fullscreen', 'lock:landscape']);
  확인('글자가 「세로」로 바뀐다', await 글자(p), '세로');
  확인('단추는 그대로 보인다', await p.locator('#btnRotate').isVisible(), true);

  console.log('\n— 다시 누르면 세로로 —');
  await p.click('#btnRotate');
  await p.waitForTimeout(700);
  확인('잠금을 풀고 전체화면에서 나온다', await 발자취(p),
    ['fullscreen', 'lock:landscape', 'unlock', 'exit']);
  확인('글자가 「가로」로 되돌아온다', await 글자(p), '가로');

  console.log('\n— 다른 화면에 갔다 와도 글자가 맞다 —');
  await p.click('#btnRotate');
  await p.waitForTimeout(700);
  확인('가로 상태', await 글자(p), '세로');
  await p.click('[data-hbt="mem"]');
  await p.waitForTimeout(500);
  await p.click('[data-hbt="hw"]');
  await p.waitForTimeout(500);
  확인('돌아와도 「세로」', await 글자(p), '세로');
  await p.screenshot({ path: 'rot2_landscape.png' });
  await p.click('#btnRotate');
  await p.waitForTimeout(600);

  console.log('\n— 학생 화면마다 단추가 있다 —');
  const 화면들 = await p.evaluate(() => {
    var 답 = {};
    ['s-home','s-study','s-flash','s-quiz','s-games','s-match','s-puz','s-streak',
     's-sheet','s-verb','s-book','s-result','s-records'].forEach(function(id){
      var el = document.getElementById(id);
      답[id] = el ? el.querySelectorAll('.rotbtn').length : -1;
    });
    답.로그인 = document.getElementById('s-login').querySelectorAll('.rotbtn').length;
    답.선생님 = document.getElementById('s-teacher').querySelectorAll('.rotbtn').length;
    return 답;
  });
  console.log('  ' + JSON.stringify(화면들));
  확인('학생 화면 열세 곳에 하나씩 있다',
    Object.keys(화면들).filter(k => k.indexOf('s-') === 0).map(k => 화면들[k]),
    [1,1,1,1,1,1,1,1,1,1,1,1,1]);
  확인('로그인·선생님 화면에는 없다', [화면들.로그인, 화면들.선생님], [0, 0]);

  console.log('\n— 외우기에서 들어간 화면에서도 눌린다 —');
  /* 외우기·시험·게임 탭은 큰 제목만 두고 옛 위 띠(.top)를 숨겨서 거기엔 단추가 안 보인다.
     외우기에서 고른 플래시카드 화면에서 누른다. */
  await 방법(p, 'flash');
  const 연습단추 = p.locator('#s-flash .rotbtn');
  확인('플래시카드 화면 단추가 보인다', await 연습단추.isVisible(), true);
  확인('글자는 「가로」', (await 연습단추.textContent()).trim(), '가로');
  const 전 = (await 발자취(p)).length;
  await 연습단추.click();
  await p.waitForTimeout(700);
  확인('플래시카드 화면에서도 돌아간다', (await 발자취(p)).slice(전), ['fullscreen', 'lock:landscape']);
  확인('플래시카드 화면 글자도 바뀐다', (await 연습단추.textContent()).trim(), '세로');
  확인('집 화면 단추 글자도 같이 바뀐다', await 글자(p), '세로');
  await p.screenshot({ path: 'rot3_study.png' });
  await 연습단추.click();
  await p.waitForTimeout(700);
  await p.click('#s-flash [data-back]');
  await p.waitForTimeout(500);
  await p.click('[data-hbt="hw"]');
  await p.waitForTimeout(500);

  console.log('\n— 시험 중에도 방향은 그대로 —');
  const i3 = await p.evaluate(() => S.숙제.findIndex(h => String(h.유형).indexOf('3단') >= 0));
  if (i3 > -1) {
    await p.click('#btnRotate'); await p.waitForTimeout(700);
    await p.locator('[data-hw="' + i3 + '"]').click();
    await p.waitForTimeout(2000);
    확인('세 칸 화면이 열린다', await p.locator('#s-verb').isVisible(), true);
    확인('시험 화면에도 단추가 보인다', await p.locator('#s-verb .rotbtn').isVisible(), true);
    확인('시험 화면 글자는 「세로」',
      (await p.locator('#s-verb .rotbtn').textContent()).trim(), '세로');
    확인('가로 잠금이 풀리지 않는다',
      (await 발자취(p)).filter(x => x === 'exit').length, 3);
  }

  console.log('\n— 못 돌리는 기기(아이폰)에서는 단추를 감춘다 —');
  const p2 = await b.newPage({ viewport: { width: 420, height: 900 } });
  p2.on('pageerror', e => errs.push('PAGEERROR2: ' + e.message));
  p2.on('dialog', d => d.accept());
  await p2.addInitScript(기기흉내(), false);
  await 들어가기(p2);
  확인('단추가 안 보인다', await p2.locator('#btnRotate').isVisible(), false);
  확인('다른 화면 단추도 다 숨는다',
    await p2.locator('.rotbtn:not(.hide)').count(), 0);
  확인('숙제 화면은 정상', await p2.locator('#s-home').isVisible(), true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
