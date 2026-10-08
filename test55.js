/* 숙제를 조급하게 두 번 눌러도 시험이 뒤집히지 않는다 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동');
  await p.click('#btnLogin'); await p.waitForTimeout(1800);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }

  /* 느린 인터넷을 흉내 낸다 — 첫 번째 대답이 두 번째보다 늦게 온다 */
  await p.evaluate(() => {
    window.__부른횟수 = 0;
    window.__시작한횟수 = 0;
    const 원래api = window.api;
    window.api = function (이름) {
      const 인자 = arguments;
      if (이름 === '단어가져오기') {
        window.__부른횟수++;
        const 늦기 = window.__부른횟수 === 1 ? 1600 : 200;   // 첫 번째를 일부러 늦춘다
        return new Promise(function (풀기) {
          setTimeout(function () { 원래api.apply(null, 인자).then(풀기); }, 늦기);
        });
      }
      return 원래api.apply(null, 인자);
    };
    const 원래시작 = window.startVerb;
    window.startVerb = function () { window.__시작한횟수++; return 원래시작.apply(null, arguments); };
  });

  const i3 = await p.evaluate(() => S.숙제.findIndex(h => String(h.유형).indexOf('3단') >= 0));
  확인('3단변화 숙제가 있다', i3 > -1, true);

  console.log('\n— 조급하게 두 번 누른다 —');
  await p.locator('[data-hw="' + i3 + '"]').click({ force: true });
  await p.waitForTimeout(120);
  await p.locator('[data-hw="' + i3 + '"]').click({ force: true });
  await p.waitForTimeout(2800);

  const 센것 = await p.evaluate(() => ({ 부름: window.__부른횟수, 시작: window.__시작한횟수 }));
  console.log('  ' + JSON.stringify(센것));
  확인('단어 불러오기는 두 번 돌았다', 센것.부름, 2);
  확인('시험은 한 번만 시작된다', 센것.시작, 1);
  확인('세 칸 화면이 열려 있다', await p.locator('#s-verb').isVisible(), true);

  console.log('\n— 답을 쓰는 동안 늦은 대답이 와도 뒤집히지 않는다 —');
  const 본것 = await p.evaluate(() => {
    const w = S.본문제;
    const f = 세형태(w.en);
    return { 뜻: document.getElementById('vQ').textContent.trim(), 속뜻: w.ko, 답: [f.원형, f.과거, f.분사] };
  });
  console.log('  화면 뜻: ' + 본것.뜻 + ' / 정답: ' + 본것.답.join(' - '));
  확인('화면에 보이는 뜻과 속이 같다', 본것.뜻, 본것.속뜻);

  await p.fill('#vBase', 본것.답[0]);
  await p.fill('#vPast', 본것.답[1]);
  await p.fill('#vPp', 본것.답[2]);
  await p.waitForTimeout(1500);        // 늦은 대답이 올 만한 시간
  확인('쓰는 사이에 뜻이 안 바뀐다',
    await p.evaluate(() => document.getElementById('vQ').textContent.trim()), 본것.뜻);
  확인('쓴 것도 그대로 있다',
    await p.evaluate(() => [vBase.value, vPast.value, vPp.value]), 본것.답);

  await p.click('#vSubmit');
  await p.waitForTimeout(600);
  확인('맞다고 나온다', await p.locator('.vin.ng').count(), 0);
  확인('세 칸 다 O', await p.locator('.vmark.ok').count(), 3);
  확인('채점 뒤에도 뜻이 그대로',
    await p.evaluate(() => document.getElementById('vQ').textContent.trim()), 본것.뜻);

  console.log('\n— 채점은 화면에 보인 그 단어로 한다 —');
  await p.click('#vNext');
  await p.waitForTimeout(600);
  const 둘째 = await p.evaluate(() => ({
    뜻: document.getElementById('vQ').textContent.trim(),
    본문제: S.본문제 ? S.본문제.ko : null
  }));
  확인('다음 문제도 화면과 속이 같다', 둘째.뜻, 둘째.본문제);

  /* 뒤에서 몰래 문제를 갈아엎어도, 채점은 화면에 보인 단어로 */
  const 답2 = await p.evaluate(() => {
    const f = 세형태(S.본문제.en); return [f.원형, f.과거, f.분사];
  });
  await p.fill('#vBase', 답2[0]); await p.fill('#vPast', 답2[1]); await p.fill('#vPp', 답2[2]);
  await p.evaluate(() => { S.문제 = shuffle(S.문제.slice()); S.idx = 0; });   // 뒤에서 갈아엎기
  await p.click('#vSubmit');
  await p.waitForTimeout(600);
  확인('그래도 맞다고 나온다', await p.locator('.vin.ng').count(), 0);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
