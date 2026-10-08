/* 유치부 화면 — 학년구분이 「유치」 면 길·그림 고르기·스티커판만 본다 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');

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
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
const 화면 = p => p.evaluate(() => 지금화면_());

const 엿듣기 = p => p.evaluate(() => {
  window.__보낸것 = [];
  const 원래 = window.api;
  window.api = function (이름) {
    if (이름 === '결과저장') window.__보낸것.push(arguments[1]);
    return 원래.apply(null, arguments);
  };
});

async function 들어가기(p, 이름) {
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', 이름);
  await p.click('#btnLogin');
  await p.waitForTimeout(2200);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }
}

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', d => d.accept());

  /* 읽어주기를 흉내 내어 무엇을 읽었는지 본다 */
  await p.addInitScript(() => {
    window.__읽은것 = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel() {}, speak(u) { window.__읽은것.push(u.text); } }
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true, value: function (t) { this.text = t; }
    });
  });

  console.log('— 유치부 아이는 유치부 화면으로 —');
  await 들어가기(p, '최아람');
  await 엿듣기(p);
  확인('유치부로 들어온다', await 화면(p), 'kid');
  확인('아래 탭바가 안 보인다', await p.locator('#tabbar').isVisible(), false);
  확인('숙제·연습·시험 화면은 안 뜬다',
    await p.evaluate(() => ['home','study','exam','streak']
      .filter(x => document.getElementById('s-' + x).classList.contains('on'))), []);
  확인('성을 떼고 이름만 부른다',
    (await p.locator('#kHi').textContent()).trim(), '아람아, 오늘도 해 볼까?');
  확인('받침을 보고 아·야를 가린다', await p.evaluate(() => [
    얘야_('최아람'), 얘야_('김서연'), 얘야_('박지수'), 얘야_('이철수'), 얘야_('남궁민')
  ]), ['아람아', '서연아', '지수야', '철수야', '궁민아']);
  확인('유치부 화면엔 가로/세로 단추가 없다',
    await p.evaluate(() => ['s-kid','s-kidq','s-kidend','s-kidst']
      .reduce((n, id) => n + document.getElementById(id).querySelectorAll('.rotbtn').length, 0)), 0);
  확인('길 칸이 숙제 수만큼',
    await p.locator('#kPath [data-kid]').count(),
    await p.evaluate(() => S.숙제.length));
  확인('범위가 레슨으로 적힌다',
    /레슨 \d+|전체/.test(await p.locator('#kPath .nm').first().textContent()), true);
  확인('맨 위 칸에 「시작!」', await p.locator('#kPath .kgo').count(), 1);
  확인('칸마다 단계 점이 세 개',
    await p.evaluate(() => [...document.querySelectorAll('#kPath .kdot3')]
      .map(d => d.querySelectorAll('i').length)),
    await p.evaluate(() => S.숙제.filter(h => !h.완료).map(() => 3)));
  확인('아직 켜진 점은 없다', await p.locator('#kPath .kdot3 i.on').count(), 0);
  await p.screenshot({ path: 'k1_path.png' });

  console.log('\n— ① 먼저 배우는 단계 —');
  await p.locator('#kPath [data-kid]').first().click();
  await p.waitForTimeout(2400);
  확인('배우기 화면부터', await 화면(p), 'kidlearn');
  확인('영어와 뜻을 같이 보여 준다',
    await p.evaluate(() => !!document.querySelector('#kLCard .en') &&
      !!document.querySelector('#kLCard .ko')), true);
  확인('배울 단어를 읽어 준다',
    (await p.evaluate(() => window.__읽은것)).slice(-1)[0],
    (await p.locator('#kLCard .en').textContent()).trim());
  확인('고를 카드는 없다', await p.locator('#s-kidlearn .kcard').count(), 0);
  await p.screenshot({ path: 'k1b_learn.png' });

  const 단어수 = await p.evaluate(() => 유치판.원목록.length);
  console.log('  단어 ' + 단어수 + '개');
  for (let i = 0; i < 단어수 - 1; i++) { await p.click('#kLNext'); await p.waitForTimeout(120); }
  확인('마지막엔 단추 글이 바뀐다',
    (await p.locator('#kLNext').textContent()).trim(), '풀어 볼까요?');
  await p.click('#kLNext');
  await p.waitForTimeout(400);

  console.log('\n— ② 듣고 뜻 고르는 단계 —');
  확인('문제 화면', await 화면(p), 'kidq');
  확인('단계는 q1', await p.evaluate(() => 유치판.단계), 'q1');
  확인('카드가 넷', await p.locator('#kCards .kcard').count(), 4);
  확인('쓰는 칸이 없다', await p.locator('#s-kidq input').count(), 0);
  const 단어 = (await p.locator('#kWord').textContent()).trim();
  console.log('  ' + 단어);
  확인('영어를 읽어 준다', (await p.evaluate(() => window.__읽은것)).slice(-1)[0], 단어);
  확인('카드는 한글 뜻', await p.evaluate(() => 유치판.보기.length), 4);
  확인('물어보는 말', (await p.locator('#kAsk').textContent()).trim(), '어느 것일까요?');
  확인('다시 듣기 단추가 있다', await p.locator('#kSpk').isVisible(), true);
  확인('정답이 보기에 있다',
    await p.evaluate(() => 유치판.보기.some(x => x.ko === 유치판.본문제.ko)), true);
  await p.screenshot({ path: 'k2_quiz.png' });

  console.log('\n— 다시 듣기 —');
  const 전 = (await p.evaluate(() => window.__읽은것)).length;
  await p.click('#kSpk');
  await p.waitForTimeout(300);
  확인('한 번 더 읽어 준다', (await p.evaluate(() => window.__읽은것)).length, 전 + 1);

  console.log('\n— 맞게 고르면 —');
  const 맞는칸 = await p.evaluate(() => 유치판.보기.findIndex(x => x.ko === 유치판.본문제.ko));
  await p.locator('[data-kc="' + 맞는칸 + '"]').click();
  await p.waitForTimeout(600);
  확인('맞은 카드가 초록', await p.locator('.kcard.ok').count(), 1);
  확인('틀린 표시는 없다', await p.locator('.kcard.ng').count(), 0);
  확인('잘했다고 알려 준다', /참 잘했어요/.test(await p.locator('#kFeed').textContent()), true);
  확인('뜻도 같이 알려 준다', /은 .+예요/.test(await p.locator('#kFeed').textContent()), true);
  확인('한 개 맞았다', await p.evaluate(() => 유치판.맞은수), 1);
  확인('더 못 누른다', await p.locator('.kcard[disabled]').count(), 4);
  await p.screenshot({ path: 'k3_ok.png' });

  console.log('\n— 틀리게 골라도 정답을 보여 준다 —');
  await p.click('#kNext');
  await p.waitForTimeout(500);
  const 틀린칸 = await p.evaluate(() => 유치판.보기.findIndex(x => x.ko !== 유치판.본문제.ko));
  await p.locator('[data-kc="' + 틀린칸 + '"]').click();
  await p.waitForTimeout(600);
  확인('고른 카드가 빨강', await p.locator('.kcard.ng').count(), 1);
  확인('정답 카드는 초록', await p.locator('.kcard.ok').count(), 1);
  확인('혼내지 않는다', /괜찮아요/.test(await p.locator('#kFeed').textContent()), true);
  확인('맞은 수는 그대로', await p.evaluate(() => 유치판.맞은수), 1);
  await p.screenshot({ path: 'k3b_ng.png' });

  console.log('\n— ②를 다 풀면 ③ 거꾸로 묻는 단계 —');
  for (let i = 0; i < 40; i++) {
    if (await p.evaluate(() => 유치판 && 유치판.단계) !== 'q1') break;
    if (await p.locator('#kNext').count()) { await p.click('#kNext'); await p.waitForTimeout(200); }
    else if (await p.locator('[data-kc="0"]').count()) { await p.click('[data-kc="0"]'); await p.waitForTimeout(200); }
  }
  확인('단계는 q2', await p.evaluate(() => 유치판 && 유치판.단계), 'q2');
  확인('아직 끝 화면이 아니다', await 화면(p), 'kidq');
  확인('이번엔 한글 뜻을 물어본다',
    await p.evaluate(() => 유치판.본문제.ko), (await p.locator('#kWord').textContent()).trim());
  확인('물어보는 말이 바뀐다', (await p.locator('#kAsk').textContent()).trim(), '영어로 뭘까요?');
  확인('카드는 영어', await p.locator('#kCards .kcard .en').count(), 4);
  확인('답을 읽어 주지 않는다', await p.locator('#kSpk').isVisible(), false);
  확인('아직 아무것도 안 보냈다', (await p.evaluate(() => window.__보낸것)).length, 0);
  await p.screenshot({ path: 'k2b_quiz_back.png' });

  console.log('\n— 끝까지 가면 별과 스티커 —');
  for (let i = 0; i < 40; i++) {
    if (await 화면(p) === 'kidend') break;
    if (await p.locator('#kNext').count()) { await p.click('#kNext'); await p.waitForTimeout(250); }
    if (await 화면(p) === 'kidend') break;
    if (await p.locator('[data-kc="0"]').count()) { await p.click('[data-kc="0"]'); await p.waitForTimeout(250); }
  }
  확인('끝 화면', await 화면(p), 'kidend');
  await p.waitForTimeout(1200);
  확인('별이 셋 그려진다', await p.locator('#kStars svg').count(), 3);
  확인('스티커를 준다', /스티커/.test(await p.locator('#kGift').textContent()), true);
  확인('점수는 안 보여 준다', /\d+점/.test(await p.locator('#s-kidend').innerText()), false);
  await p.screenshot({ path: 'k4_end.png' });

  console.log('\n— 기록은 선생님께 —');
  const 보낸것 = await p.evaluate(() => window.__보낸것);
  console.log('  ' + JSON.stringify(보낸것.map(x => ({ 유형: x.유형, 구분: x.구분, 숙제여부: x.숙제여부 }))));
  확인('한 번 보냈다', 보낸것.length, 1);
  확인('유형은 유치', 보낸것[0].유형, '유치');
  확인('숙제로 친다', 보낸것[0].숙제여부, true);
  확인('두 번 물었으니 문항수가 두 배', 보낸것[0].문항수, 단어수 * 2);
  확인('범위는 숙제 전체',
    보낸것[0].범위, await p.evaluate(() => 유치판.숙제.시작 + '~' + 유치판.숙제.끝));

  console.log('\n— 스티커판 —');
  await p.click('#kEndGo'); await p.waitForTimeout(600);
  확인('길로 돌아온다', await 화면(p), 'kid');
  확인('스티커 수가 올라간다', (await p.locator('#kStick').textContent()).trim(), '1');
  확인('별도 쌓인다', Number(await p.locator('#kStar').textContent()) > 0, true);
  await p.click('#kStickGo'); await p.waitForTimeout(600);
  확인('스티커판이 열린다', await 화면(p), 'kidst');
  확인('칸이 열두 개', await p.locator('#kStGrid .kst').count(), 12);
  확인('한 장 붙어 있다', await p.locator('#kStGrid .kst.got').count(), 1);
  await p.screenshot({ path: 'k5_sticker.png' });
  await p.click('#kStBack'); await p.waitForTimeout(500);
  확인('다시 길', await 화면(p), 'kid');

  console.log('\n— 나갔다 와도 스티커가 남는다 —');
  await p.click('#kOut'); await p.waitForTimeout(600);
  확인('로그인 화면', await 화면(p), 'login');
  await 들어가기(p, '최아람');
  확인('스티커 그대로', (await p.locator('#kStick').textContent()).trim(), '1');

  console.log('\n— 한 단계만 하고 나가도 이어서 할 수 있다 —');
  const 남은칸 = await p.locator('#kPath [data-kid]:not([disabled])').count();
  if (남은칸) {
    await p.locator('#kPath [data-kid]:not([disabled])').first().click();
    await p.waitForTimeout(2400);
    확인('배우기부터 다시', await 화면(p), 'kidlearn');
    const n = await p.evaluate(() => 유치판.원목록.length);
    for (let i = 0; i < n; i++) { await p.click('#kLNext'); await p.waitForTimeout(120); }
    확인('배우기를 마치면 풀기로', await 화면(p), 'kidq');
    await p.click('#kQuit'); await p.waitForTimeout(500);
    확인('길로 돌아온다', await 화면(p), 'kid');
    확인('점 하나가 켜져 있다', await p.locator('#kPath .kdot3 i.on').count(), 1);
    확인('「이어서!」 라고 알려 준다',
      /이어서/.test(await p.locator('#kPath .kgo').textContent()), true);
    await p.locator('#kPath [data-kid]:not([disabled])').first().click();
    await p.waitForTimeout(2400);
    확인('배우기를 건너뛰고 풀기부터', await 화면(p), 'kidq');
    확인('단계는 q1', await p.evaluate(() => 유치판.단계), 'q1');
    await p.screenshot({ path: 'k6_resume.png' });
  } else {
    console.log('  (남은 숙제가 없어 건너뜀)');
  }

  console.log('\n— 선생님이 숙제를 지웠다 다시 내면 처음부터 —');
  /* 어느 화면에 있든 길로 돌아온다 */
  async function 길로(p) {
    for (let i = 0; i < 4 && await 화면(p) !== 'kid'; i++) {
      for (const b of ['#kQuit', '#kLQuit', '#kStBack', '#kEndGo']) {
        if (await p.locator(b).isVisible().catch(() => false)) {
          await p.click(b); await p.waitForTimeout(500); break;
        }
      }
    }
  }
  await 길로(p);
  확인('앞 단계가 남아 있다', await p.locator('#kPath .kdot3 i.on').count() > 0, true);

  /* 선생님이 그 숙제를 지우고 똑같은 범위로 다시 낸다 → 낸때가 달라진다 */
  await p.evaluate(() => { window.DEMO_낸때 = [201, 202, 203, 204, 205]; });
  await p.evaluate(() => 집자료받기_(true));
  await p.waitForTimeout(1200);
  확인('진행 표시가 사라진다', await p.locator('#kPath .kdot3 i.on').count(), 0);
  확인('「시작!」 으로 돌아온다',
    /시작/.test(await p.locator('#kPath .kgo').textContent()), true);
  await p.locator('#kPath [data-kid]:not([disabled])').first().click();
  await p.waitForTimeout(2400);
  확인('배우기부터 다시 한다', await 화면(p), 'kidlearn');
  확인('묵은 기록은 기기에서 지워진다',
    await p.evaluate(() => {
      var 머리 = 유치진행머리_(), n = 0;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(머리) === 0 && k.indexOf('#1') > -1) n++;
      }
      return n;
    }), 0);
  await 길로(p);

  console.log('\n— 선생님용 · 이 기기 기록 지우기 —');
  await p.click('#kStickGo'); await p.waitForTimeout(600);
  확인('스티커판에 지우개가 있다', await p.locator('#kStReset').isVisible(), true);
  const 전별 = Number(await p.locator('#kStar').textContent().catch(() => '0'));
  await p.click('#kStReset'); await p.waitForTimeout(800);
  확인('길로 돌아온다', await 화면(p), 'kid');
  확인('별이 0', (await p.locator('#kStar').textContent()).trim(), '0');
  확인('스티커도 0', (await p.locator('#kStick').textContent()).trim(), '0');
  확인('하던 단계도 없어진다', await p.locator('#kPath .kdot3 i.on').count(), 0);
  확인('나갔다 와도 0 그대로', await (async () => {
    await p.click('#kOut'); await p.waitForTimeout(500);
    await 들어가기(p, '최아람');
    return (await p.locator('#kStick').textContent()).trim();
  })(), '0');
  await p.screenshot({ path: 'k7_reset.png' });

  console.log('\n— 초중등 아이는 예전 화면 그대로 —');
  const p2 = await b.newPage({ viewport: { width: 420, height: 900 } });
  p2.on('pageerror', e => errs.push('PAGEERROR2: ' + e.message));
  p2.on('dialog', d => d.accept());
  await 들어가기(p2, '홍길동');
  확인('숙제 화면으로 간다', await 화면(p2), 'home');
  확인('아래 탭바가 보인다', await p2.locator('#tabbar').isVisible(), true);
  확인('유치부 화면은 안 뜬다', await p2.locator('#s-kid').isVisible(), false);

  console.log('\n— 선생님 명단에서 「유치」 를 고를 수 있다 —');
  const t = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  t.on('pageerror', e => errs.push('PAGEERROR(선생님): ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소);
  await t.waitForTimeout(400);
  await t.click('#btnTeacherGo');
  await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  await 탭가기(t, 'roster');
  await t.waitForTimeout(1400);
  확인('붙여넣기 고르개에 유치가 있다',
    (await t.locator('#stLv option').allTextContents()).map(x => x.trim()),
    ['유치', '초중등', '고등']);
  const 줄 = t.locator('[data-sedit]').first();
  if (await 줄.count()) {
    await 줄.click();
    await t.waitForTimeout(700);
    확인('학생 고치기에도 유치가 있다',
      (await t.locator('.sLv option').allTextContents()).map(x => x.trim()),
      ['유치', '초중등', '고등']);
  }
  확인('명단에 유치부가 보인다', /유치부|유치/.test(await t.locator('#tBody').innerText()), true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
