/* 3단변화 시험 — 세 칸을 다 써야 넘어가고, 확인 뒤엔 단추로만 넘어간다 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');
let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}
const 문제번호 = p => p.evaluate(() => S.idx);
const 지금정답 = p => p.evaluate(() => {
  var f = 세형태(S.문제[S.idx].en); return [f.원형, f.과거, f.분사];
});

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }

  const i3 = await p.evaluate(() => S.숙제.findIndex(h => String(h.유형).indexOf('3단') >= 0));
  확인('3단변화 숙제가 있다', i3 > -1, true);
  await p.locator('[data-hw="' + i3 + '"]').click();
  await p.waitForTimeout(2200);
  확인('세 칸 화면이 열린다', await p.locator('#s-verb').isVisible(), true);

  console.log('\n— 다 비워 두고 확인을 누르면 안 넘어간다 —');
  확인('처음은 첫 문제', await 문제번호(p), 0);
  await p.click('#vSubmit');
  await p.waitForTimeout(400);
  확인('문제가 안 바뀐다', await 문제번호(p), 0);
  확인('아직 답 쓰는 중', await p.evaluate(() => S.v상태), 'input');
  const 말1 = (await p.locator('#vMsg').textContent()).trim();
  console.log('  ' + 말1);
  확인('다 써야 한다고 알려 준다', /다 써야 넘어가요/.test(말1), true);
  확인('비어 있는 칸에 표시가 된다', await p.locator('.vin.need').count(), 3);
  확인('단추는 아직 「확인」', (await p.locator('#vSubmit').textContent()).trim(), '확인');

  console.log('\n— 두 칸만 쓰고 눌러도 안 넘어간다 —');
  const 답 = await 지금정답(p);
  console.log('  이번 문제 정답: ' + 답.join(' - '));
  await p.fill('#vBase', 답[0]);
  await p.fill('#vPast', 답[1]);
  await p.click('#vSubmit');
  await p.waitForTimeout(400);
  확인('여전히 답 쓰는 중', await p.evaluate(() => S.v상태), 'input');
  const 말2 = (await p.locator('#vMsg').textContent()).trim();
  console.log('  ' + 말2);
  확인('어느 칸이 비었는지 짚어 준다', /과거분사형/.test(말2), true);
  확인('빈 칸 하나만 표시된다', await p.locator('.vin.need').count(), 1);
  확인('그 칸으로 커서가 간다',
    await p.evaluate(() => document.activeElement && document.activeElement.id), 'vPp');

  console.log('\n— 쓰기 시작하면 표시가 사라진다 —');
  await p.fill('#vPp', 답[2]);
  await p.waitForTimeout(200);
  확인('표시가 없어진다', await p.locator('.vin.need').count(), 0);

  console.log('\n— 마지막 칸에서 자판 「완료」를 눌러도 한 번만 채점된다 —');
  await p.locator('#vPp').press('Enter');
  await p.waitForTimeout(500);
  확인('채점됐다', await p.evaluate(() => S.v상태), 'feedback');
  확인('문제는 아직 그대로', await 문제번호(p), 0);
  확인('「확인」 단추는 그대로 보인다', await p.locator('#vSubmit').isVisible(), true);
  const 눌린것 = await p.evaluate(() => {
    const st = getComputedStyle(document.getElementById('vSubmit'));
    return { 흐림: st.opacity, 못누름: st.pointerEvents };
  });
  console.log('  ' + JSON.stringify(눌린것));
  확인('흐려진다', Number(눌린것.흐림) < 0.6, true);
  확인('눌러도 안 먹는다', 눌린것.못누름, 'none');
  확인('「다음 문제」 단추가 나온다', await p.locator('#vNext').isVisible(), true);
  확인('글자도 「다음 문제」', (await p.locator('#vNext').textContent()).trim(), '다음 문제');
  확인('세 칸이 잠긴다',
    await p.evaluate(() => [vBase, vPast, vPp].map(x => x.readOnly)), [true, true, true]);
  await p.screenshot({ path: 'v1_locked.png' });

  console.log('\n— 채점 뒤엔 자판으로 못 넘어간다 —');
  await p.locator('#vPp').press('Enter');
  await p.locator('#vBase').press('Enter');
  await p.waitForTimeout(400);
  확인('문제가 안 바뀐다', await 문제번호(p), 0);
  확인('아직 채점 화면', await p.evaluate(() => S.v상태), 'feedback');

  console.log('\n— 두 단추가 다른 자리에 있다 —');
  const 자리 = await p.evaluate(() => {
    const a = document.getElementById('vSubmit').getBoundingClientRect();
    const b = document.getElementById('vNext').getBoundingClientRect();
    return { 확인위: Math.round(a.top), 확인아래: Math.round(a.bottom),
             다음위: Math.round(b.top), 겹침: !(b.top >= a.bottom || b.bottom <= a.top) };
  });
  console.log('  ' + JSON.stringify(자리));
  확인('두 단추가 겹치지 않는다', 자리.겹침, false);
  확인('「다음 문제」가 더 아래에 있다', 자리.다음위 > 자리.확인아래, true);
  확인('사이가 20px 넘게 떨어져 있다', 자리.다음위 - 자리.확인아래 >= 20, true);
  확인('「확인」 자리는 그대로 비어 있다', 자리.확인아래 > 자리.확인위, true);

  console.log('\n— 흐려진 「확인」을 눌러도 안 넘어간다 —');
  await p.locator('#vSubmit').click({ force: true });
  await p.waitForTimeout(400);
  확인('문제가 안 바뀐다', await 문제번호(p), 0);
  확인('아직 채점 화면', await p.evaluate(() => S.v상태), 'feedback');

  console.log('\n— 「다음 문제」를 눌러야 넘어간다 —');
  await p.click('#vNext');
  await p.waitForTimeout(500);
  확인('다음 문제로 간다', await 문제번호(p), 1);
  확인('다시 답 쓰는 중', await p.evaluate(() => S.v상태), 'input');
  확인('잠금이 풀린다',
    await p.evaluate(() => [vBase, vPast, vPp].map(x => x.readOnly)), [false, false, false]);
  확인('칸이 비워진다',
    await p.evaluate(() => [vBase, vPast, vPp].map(x => x.value)), ['', '', '']);
  확인('안내 글도 지워진다', (await p.locator('#vMsg').textContent()).trim(), '');
  확인('다시 「확인」만 보인다',
    [await p.locator('#vSubmit').isVisible(), await p.locator('#vNext').isVisible()],
    [true, false]);
  확인('흐림이 풀린다',
    await p.evaluate(() => getComputedStyle(document.getElementById('vSubmit')).opacity), '1');

  console.log('\n— 틀리게 써도 세 칸만 채우면 넘어간다 —');
  await p.fill('#vBase', 'aaa'); await p.fill('#vPast', 'bbb'); await p.fill('#vPp', 'ccc');
  await p.click('#vSubmit');
  await p.waitForTimeout(500);
  확인('채점된다', await p.evaluate(() => S.v상태), 'feedback');
  확인('틀린 표시가 뜬다', await p.locator('.vin.ng').count() > 0, true);
  확인('정답을 보여 준다', await p.locator('.vans').count() > 0, true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
