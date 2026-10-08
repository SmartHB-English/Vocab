/* 붙여넣기 사고 알림이 제대로 뜨고, 정상 파일에서는 안 뜨는지 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
const fs = require('fs');
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

(async () => {
  const 원본 = fs.readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');

  /* 사고 재현: 옛 내용이 남은 채 새 내용이 붙은 모양.
     실제 증상과 같게, 두 번째 벌은 <style> 여는 태그가 먹혀 CSS 가 글자로 샌다. */
  const 두번째 = 원본
    .replace('<!DOCTYPE html>', '')
    .replace(/<html[^>]*>/, '')
    .replace(/<head>[\s\S]*?<style>/, '')      // head 와 <style> 여는 태그가 사라진 모양
    .replace('</head>', '')
    .replace(/<\/?body>/g, '')
    .replace('</html>', '');
  /* 함수로 넘긴다 — 글로 넘기면 앱 코드 속 「$'」 같은 글자를 replace 가 특수 기호로 읽어 엉뚱한 파일이 된다 */
  const 망가진 = 원본.replace('</body>', () => 두번째 + '</body>');
  fs.writeFileSync(require('./도구').임시('broken.html'), 망가진);

  const b = await chromium.launch(require('./도구').띄우기설정);

  /* 1) 정상 파일에서는 안 떠야 한다 */
  const p1 = await b.newPage({ viewport: { width: 390, height: 844 } });
  const e1 = [];
  p1.on('pageerror', e => e1.push('ERR ' + e.message));
  await p1.goto(앱주소);
  await p1.waitForTimeout(800);
  console.log('— 정상 파일 —');
  확인('로그인 화면 한 벌', await p1.locator('#s-login').count(), 1);
  확인('경고가 안 뜬다', (await p1.locator('body').innerText()).indexOf('파일이 겹쳐서') > -1, false);
  확인('버전이 보인다', (await p1.locator('#verTag').textContent()).trim(), 'v2026-10-08a');
  확인('CSS 가 글자로 안 샌다', (await p1.locator('body').innerText()).indexOf('box-sizing:border-box') > -1, false);

  /* 2) 겹쳐 붙인 파일에서는 떠야 한다 */
  const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  const e2 = [];
  p2.on('pageerror', e => e2.push('ERR ' + e.message));
  await p2.goto(require('url').pathToFileURL(require('./도구').임시('broken.html')).href);
  await p2.waitForTimeout(900);
  console.log('\n— 겹쳐 붙인 파일 —');
  const 본문 = await p2.locator('body').innerText();
  확인('로그인 화면이 두 벌', await p2.locator('#s-login').count() > 1, true);
  확인('경고가 뜬다', 본문.indexOf('파일이 겹쳐서 올라갔습니다') > -1, true);
  확인('고치는 방법을 알려 준다', 본문.indexOf('점 세 개') > -1, true);
  확인('맞는 버전을 알려 준다', 본문.indexOf('v2026-10-08a') > -1, true);
  await p2.screenshot({ path: 'i1_broken_warn.png' });

  const errs = e1.concat(e2);
  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
