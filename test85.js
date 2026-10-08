/* 학부모 사이트 — 「홈 화면에 추가」 안내 · 알림 단추
   환경을 알아보고 확실히 아는 경우에만 그 환경에 맞는 말을 한다. 어느 환경이든 숙제·점수는 다 보인다 */
const path = require('path');
const { chromium } = require('playwright');
const 학부모주소 = require('url').pathToFileURL(path.join(__dirname, 'parent.html')).href;
const { 띄우기설정 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) + (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
const 토큰 = 'a'.repeat(64);
const UA = {
  카톡안드: 'Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36;KAKAOTALK 2610420',
  카톡아이폰: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5',
  네이버: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.1.3)',
  아이폰사파리: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  아이폰크롬: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
  안드크롬: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  컴퓨터: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

(async () => {
  const b = await chromium.launch(띄우기설정);
  const errs = [];
  async function 열기(ua, 미리) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua });
    if (미리) await ctx.addInitScript(미리);
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push('ERR ' + e.message));
    await p.goto(학부모주소 + '#k=' + 토큰); await p.waitForTimeout(700);
    return p;
  }
  const 띠 = async p => (await p.locator('#band').isVisible()) ? (await p.locator('#band').innerText()).replace(/\s+/g, ' ').trim() : '';
  const 다보이나 = async p => [await p.locator('#pHw').isVisible(), await p.locator('#pTest').isVisible()];

  console.log('— 인앱 브라우저 (카카오톡) —');
  let p = await 열기(UA.카톡안드);
  let 글 = await 띠(p);
  console.log('  ' + 글);
  확인('「카카오톡 안에서 열렸어요 … 다른 브라우저로 열기」', /카카오톡 안에서 열렸어요[\s\S]*다른 브라우저로 열기/.test(글), true);
  확인('안드로이드 카톡은 오른쪽 위 ⋮', /오른쪽 위/.test(글), true);
  확인('[주소 복사] 단추', await p.locator('#band [data-copy]').count(), 1);
  확인('숙제·점수는 그대로 다 보인다', await 다보이나(p), [true, true]);
  /* 복사 — clipboard 로 */
  await p.evaluate(() => { window.__복사 = null; navigator.clipboard.writeText = t => { window.__복사 = t; return Promise.resolve(); }; });
  await p.click('#band [data-copy]'); await p.waitForTimeout(300);
  확인('[주소 복사] — 토큰이 든 주소', await p.evaluate(() => window.__복사), 학부모주소 + '#k=' + 토큰);
  확인('복사했다고 알려 준다', /^주소를 복사했어요/.test(await p.locator('#toast').innerText()), true);
  /* clipboard 가 막힌 인앱 브라우저 — 숨은 칸 + execCommand 로 떨어진다 */
  await p.evaluate(() => {
    window.__복사 = null;
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.execCommand = function (c) { if (c === 'copy') window.__복사 = document.activeElement && document.activeElement.value; return true; };
  });
  await p.click('#band [data-copy]'); await p.waitForTimeout(300);
  확인('clipboard 가 없어도 복사된다 (execCommand)', await p.evaluate(() => window.__복사), 학부모주소 + '#k=' + 토큰);

  p = await 열기(UA.카톡아이폰);
  확인('아이폰 카톡은 오른쪽 아래 ⋯', /오른쪽 아래/.test(await 띠(p)), true);
  p = await 열기(UA.네이버);
  확인('네이버 앱도 인앱으로 가린다', /네이버 앱 안에서 열렸어요/.test(await 띠(p)), true);

  console.log('\n— 아이폰 —');
  p = await 열기(UA.아이폰사파리);
  글 = await 띠(p);
  확인('사파리 — 「공유 → 홈 화면에 추가」 (공유 그림과 함께)', [/공유[\s\S]*홈 화면에 추가/.test(글), await p.locator('#band svg').count()], [true, 1]);
  확인('주소 복사 단추는 없다 (필요 없다)', await p.locator('#band [data-copy]').count(), 0);
  p = await 열기(UA.아이폰크롬);
  글 = await 띠(p);
  확인('사파리가 아니면 — 「사파리로 열어 주세요」 + [주소 복사]', [/사파리로 열어 주세요/.test(글), await p.locator('#band [data-copy]').count()], [true, 1]);

  console.log('\n— 이미 홈 화면에서 열었으면 —');
  p = await 열기(UA.아이폰사파리, () => { Object.defineProperty(navigator, 'standalone', { value: true }); });
  확인('아이폰 홈 화면 — 안내가 안 나온다', await 띠(p), '');
  p = await 열기(UA.안드크롬, () => {
    const 원래 = window.matchMedia;
    window.matchMedia = q => (/display-mode:\s*standalone/.test(q) ? { matches: true, addListener() {}, addEventListener() {} } : 원래.call(window, q));
  });
  확인('안드로이드 홈 화면(standalone) — 안내가 안 나온다', await 띠(p), '');
  확인('숙제·점수는 그대로', await 다보이나(p), [true, true]);

  console.log('\n— 안드로이드 — 설치 가능 신호가 오면 [홈 화면에 추가] —');
  p = await 열기(UA.안드크롬);
  확인('신호가 오기 전엔 아무것도 안 나온다', await 띠(p), '');
  await p.evaluate(() => {
    window.__물음 = 0;
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__물음++; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await p.waitForTimeout(200);
  확인('[홈 화면에 추가] 단추가 뜬다', await p.locator('#pInstall').isVisible(), true);
  await p.click('#pInstall'); await p.waitForTimeout(300);
  확인('누르면 브라우저의 설치 창을 부른다 · 받아들이면 띠가 닫힌다', [await p.evaluate(() => window.__물음), await 띠(p)], [1, '']);

  console.log('\n— 가릴 수 없는 환경 — 아무것도 안 나온다 —');
  p = await 열기(UA.컴퓨터);
  확인('컴퓨터 크롬 — 띠가 아예 없다', await 띠(p), '');
  확인('숙제·점수는 그대로', await 다보이나(p), [true, true]);

  console.log('\n— 닫으면 그 기기에서 다시 안 뜬다 —');
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA.카톡안드 });
  p = await ctx.newPage();
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  await p.goto(학부모주소 + '#k=' + 토큰); await p.waitForTimeout(700);
  확인('처음엔 보인다', (await 띠(p)) !== '', true);
  await p.click('#bandX'); await p.waitForTimeout(200);
  확인('닫으면 사라진다', await 띠(p), '');
  await p.reload(); await p.waitForTimeout(700);
  확인('다시 열어도 안 나온다', await 띠(p), '');
  /* 저장소가 막힌 기기 — 터지지 않는다 */
  const 막힘 = await 열기(UA.카톡안드, () => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('막힘'); } }); });
  확인('저장소가 막혀도 터지지 않고 다 보인다', [(await 띠(막힘)) !== '', await 다보이나(막힘)], [true, [true, true]]);

  console.log('\n— 알림 단추 — 받을 수 있는 곳에서만 —');
  p = await 열기(UA.안드크롬, () => { delete window.PushManager; });
  확인('PushManager 가 없으면 단추가 안 보인다', await p.locator('#pPushBtn').count(), 0);
  p = await 열기(UA.안드크롬, () => {
    Object.defineProperty(window, 'isSecureContext', { value: true });
    window.PushManager = function () {};
    window.Notification = { permission: 'default', requestPermission: () => Promise.resolve('default') };
    if (!('serviceWorker' in navigator)) Object.defineProperty(navigator, 'serviceWorker', { value: {} });
  });
  확인('다 되는 곳에서는 「알림 받기」 단추', await p.locator('#pPushBtn').isVisible(), true);
  p = await 열기(UA.아이폰사파리, () => {
    Object.defineProperty(window, 'isSecureContext', { value: true });
    window.PushManager = function () {};
    window.Notification = { permission: 'default', requestPermission: () => Promise.resolve('default') };
    if (!('serviceWorker' in navigator)) Object.defineProperty(navigator, 'serviceWorker', { value: {} });
  });
  확인('아이폰은 홈 화면에서 연 게 아니면 단추를 숨긴다', await p.locator('#pPushBtn').count(), 0);
  p = await 열기(UA.안드크롬, () => {
    Object.defineProperty(window, 'isSecureContext', { value: true });
    window.PushManager = function () {};
    window.Notification = { permission: 'denied', requestPermission: () => Promise.resolve('denied') };
  });
  확인('알림을 막아 두셨으면 단추를 숨긴다', await p.locator('#pPushBtn').count(), 0);

  console.log('\n— 아이콘 배지 — 안 낸 숙제 수 —');
  p = await 열기(UA.안드크롬, () => {
    window.__배지 = null;
    navigator.setAppBadge = n => { window.__배지 = n; return Promise.resolve(); };
    navigator.clearAppBadge = () => { window.__배지 = 0; return Promise.resolve(); };
  });
  확인('setAppBadge(안 낸 숙제 수)', await p.evaluate(() => window.__배지), 2);
  p = await 열기(UA.안드크롬, () => { delete Navigator.prototype.setAppBadge; delete navigator.setAppBadge; });
  확인('배지가 없는 기기에서도 멀쩡하다', await 다보이나(p), [true, true]);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
