/* 단어 그림 — 선생님이 그림 파일을 올리면 유치부 화면에 그림이 뜬다 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
const 화면 = p => p.evaluate(() => 지금화면_());

async function 묶음열기(p, 이름) {
  await p.evaluate(t => {
    var b = document.querySelector('[data-tab="' + t + '"]');
    var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]');
    if (g) g.click();
  }, 이름);
  await p.waitForTimeout(250);
}
async function 탭가기(p, 이름) {
  await 묶음열기(p, 이름);
  await p.click('[data-tab="' + 이름 + '"]');
  await p.waitForTimeout(1200);
}

/* 파일 고르개를 흉내 낸다 — 진짜 파일 창을 못 여니 만든 그림을 바로 넘겨준다 */
const 파일흉내 = 이름들 => p => p.evaluate(names => {
  window.__고른것 = names;
  window.그림고르기_ = function (여러장, 하기) {
    var 것 = (여러장 ? names : names.slice(0, 1)).map(function (n) {
      /* 1×1 짜리 빨간 점 png */
      var b = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
      var u = new Uint8Array(b.length);
      for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      return new File([u], n, { type: 'image/png' });
    });
    하기(것);
  };
}, 이름들);

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const errs = [];

  /* ---------------- 선생님 화면 ---------------- */
  const t = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  t.on('pageerror', e => errs.push('PAGEERROR(선생님): ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소);
  await t.waitForTimeout(400);
  await t.click('#btnTeacherGo');
  await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  await 탭가기(t, 'book');
  await t.waitForTimeout(800);

  console.log('— 단어장 화면에 그림 자리가 있다 —');
  확인('단어마다 그림 자리', await t.locator('#bkList .wpic').count() > 0, true);
  확인('아직 붙은 그림은 없다', await t.locator('#bkList img.wpic').count(), 0);
  확인('여러 장 올리기 단추', await t.locator('#bkPics').count(), 1);
  확인('무엇에 쓰는지 알려 준다',
    /유치부/.test(await t.locator('#s-teacher').innerText()), true);
  await t.screenshot({ path: 'pic1_book.png' });

  console.log('\n— 한 단어에 그림 넣기 —');
  await t.locator('#bkList .wrow').first().click();
  await t.waitForTimeout(400);
  확인('고치기 칸이 열린다', await t.locator('#bkList .picbar').count(), 1);
  확인('단추 글은 「그림 넣기」',
    (await t.locator('[data-pic]').textContent()).trim(), '그림 넣기');
  await 파일흉내(['아무거나.png'])(t);
  await t.click('[data-pic]');
  await t.waitForTimeout(1400);
  확인('목록에 그림이 뜬다', await t.locator('#bkList img.wpic').count(), 1);
  const 붙은단어 = await t.evaluate(() => (T.단어들.filter(w => w.그림)[0] || {}).en);
  console.log('  ' + 붙은단어);
  확인('첫 단어에 붙었다', 붙은단어, await t.evaluate(() => T.단어들[0].en));
  await t.screenshot({ path: 'pic2_one.png' });

  console.log('\n— 그림 빼기 —');
  await t.locator('#bkList .wrow').first().click();
  await t.waitForTimeout(400);
  확인('단추 글이 「그림 바꾸기」 로 바뀐다',
    (await t.locator('[data-pic]').textContent()).trim(), '그림 바꾸기');
  확인('빼는 단추도 생긴다', await t.locator('[data-picdel]').count(), 1);
  await t.click('[data-picdel]');
  await t.waitForTimeout(1000);
  확인('그림이 없어진다', await t.locator('#bkList img.wpic').count(), 0);

  console.log('\n— 파일 이름으로 여러 장 한꺼번에 —');
  const 이름들 = await t.evaluate(() => T.단어들.slice(0, 3).map(w => w.en + '.png')
    .concat(['이런단어없음.png']));
  console.log('  ' + 이름들.join(', '));
  await 파일흉내(이름들)(t);
  await t.click('#bkPics');
  await t.waitForTimeout(2600);
  확인('세 장이 붙었다', await t.locator('#bkList img.wpic').count(), 3);
  확인('짝 없는 파일은 안 붙는다',
    await t.evaluate(() => T.단어들.filter(w => w.그림).length), 3);
  await t.screenshot({ path: 'pic3_many.png' });

  console.log('\n— 대소문자·번호가 달라도 맞춰 준다 —');
  const 첫단어 = await t.evaluate(() => T.단어들[4].en);
  await 파일흉내([첫단어.toUpperCase() + ' (1).png'])(t);
  await t.click('#bkPics');
  await t.waitForTimeout(2400);
  확인('네 장째도 붙었다',
    await t.evaluate(() => T.단어들.filter(w => w.그림).length), 4);
  확인('다섯 번째 단어에 붙었다',
    await t.evaluate(() => !!T.단어들[4].그림), true);

  console.log('\n— 단어를 고쳐도 그림은 남는다 —');
  await t.locator('#bkList .wrow').first().click();
  await t.waitForTimeout(400);
  await t.fill('#bkList .ed-ko', '고친 뜻');
  await t.click('[data-save]');
  await t.waitForTimeout(1200);
  확인('그림 수 그대로',
    await t.evaluate(() => T.단어들.filter(w => w.그림).length), 4);

  /* ---------------- 유치부 화면 ---------------- */
  console.log('\n— 유치부 아이 화면에 그림이 보인다 —');
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  p.on('pageerror', e => errs.push('PAGEERROR(유치): ' + e.message));
  p.on('dialog', d => d.accept());
  await p.addInitScript(() => {
    window.__읽은것 = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true, value: { cancel() {}, speak(u) { window.__읽은것.push(u.text); } }
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true, value: function (x) { this.text = x; }
    });
  });
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  /* 데모 자료는 창마다 새로 만들어지니 여기서 그림을 직접 붙인다 */
  await p.evaluate(() => {
    var 점 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    /* 뜻 고르는 카드는 몇 장만 무작위로 뽑힌다 — 여섯 단어에만 그림을 주면 가끔 그림 없는 카드만 나와 검사가 흔들린다 */
    DEMO_WORDS.forEach(function (w) { w.그림 = 점; });
  });
  await p.fill('#inPw', '1234'); await p.fill('#inName', '최아람');
  await p.click('#btnLogin');
  await p.waitForTimeout(2200);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }

  await p.locator('#kPath [data-kid]').first().click();
  await p.waitForTimeout(2400);
  확인('배우기 화면', await 화면(p), 'kidlearn');
  확인('배우기 카드에 그림이 있다', await p.locator('#kLCard img').count(), 1);
  await p.screenshot({ path: 'pic4_learn.png' });

  const 단어수 = await p.evaluate(() => 유치판.원목록.length);
  for (let i = 0; i < 단어수; i++) { await p.click('#kLNext'); await p.waitForTimeout(110); }
  확인('문제 화면', await 화면(p), 'kidq');
  확인('뜻 고르는 카드엔 그림이 같이 나온다',
    await p.locator('#kCards .kcard img').count() > 0, true);
  await p.screenshot({ path: 'pic5_quiz.png' });

  console.log('\n— 거꾸로 푸는 단계엔 그림을 안 보여 준다 —');
  for (let i = 0; i < 40; i++) {
    if (await p.evaluate(() => 유치판 && 유치판.단계) !== 'q1') break;
    if (await p.locator('#kNext').count()) { await p.click('#kNext'); await p.waitForTimeout(180); }
    else if (await p.locator('[data-kc="0"]').count()) { await p.click('[data-kc="0"]'); await p.waitForTimeout(180); }
  }
  확인('단계는 q2', await p.evaluate(() => 유치판 && 유치판.단계), 'q2');
  확인('영어 카드뿐이다', await p.locator('#kCards .kcard img').count(), 0);
  확인('그림으로 답을 알려 주지 않는다', await p.locator('#kCards .kcard .en').count(), 4);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
