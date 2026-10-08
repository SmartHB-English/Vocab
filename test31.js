/* 같은 숙제를 한 줄로 묶고 낸 학생/전체 로 보여 주기 */
const { chromium } = require('playwright');
const 앱주소 = 'file://' + require('path').join(__dirname, 'index.html').replace(/\\/g, '/');

/* 선생님 화면 탭은 묶음(오늘/숙제/학생/자료) 아래로 숨어 있다 — 묶음을 먼저 펼쳐야 보인다 */
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
(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.click('#btnTeacherGo');
  await p.fill('#tPw', '1234');
  await p.click('#btnTLogin');
  await p.waitForTimeout(1300);

  /* ---------- 안 한 학생 ---------- */
  console.log('— 안 한 학생 · 숙제별 —');
  await 탭가기(p, 'miss');
  await p.waitForTimeout(800);
  const 표 = p.locator('.cols > div').first().locator('.tb').first();
  const 머리 = (await 표.locator('thead th').allTextContents()).map(x => x.trim()).filter(Boolean);
  console.log('  표 머리:', 머리.join(' / '));
  확인('낸 학생 칸이 있다', 머리.indexOf('낸 학생') > -1, true);
  확인('대상 칸이 있다', 머리.indexOf('대상') > -1, true);

  const 줄들 = await 표.locator('tbody tr').allTextContents();
  줄들.forEach(x => console.log('   ·', x.replace(/\s+/g, ' ').trim().slice(0, 78)));

  확인('묶인 줄이 있다', await 표.locator('.pill.hw').count() > 0, true);
  const 묶인줄 = 표.locator('tr.many').first();
  const 글 = (await 묶인줄.textContent()).replace(/\s+/g, ' ').trim();
  console.log('  묶인 줄:', 글);
  확인('몇 건 묶였는지 보인다', /\d+건 묶음/.test(글), true);
  확인('n / n 으로 나온다', /\d+ \/ \d+/.test(글), true);
  확인('누구에게 간 숙제인지 보인다', /명$|명\s/.test(글) || /고른 학생/.test(글), true);
  await p.screenshot({ path: 'r1_miss_grouped.png' });

  /* 펼치기 */
  const 전줄 = await 표.locator('tbody tr').count();
  await 묶인줄.click();
  await p.waitForTimeout(500);
  const 후줄 = await p.locator('.cols > div').first().locator('.tb').first()
    .locator('tbody tr').count();
  console.log('  펼치기 전', 전줄, '→ 후', 후줄);
  확인('누르면 반별로 펼쳐진다', 후줄 > 전줄, true);
  const 속 = (await p.locator('.misslist').first().textContent()).replace(/\s+/g, ' ').trim();
  console.log('  펼친 속:', 속.slice(0, 90));
  확인('반별로 몇 명 냈는지 보인다', /\d+ \/ \d+ 냄/.test(속), true);
  await p.screenshot({ path: 'r2_miss_expanded.png' });

  /* ---------- 숙제 탭 ---------- */
  console.log('\n— 숙제 목록 —');
  await 탭가기(p, 'hw');
  await p.waitForTimeout(900);
  const 숙표 = p.locator('.tb').first();          /* 숙제 폼이 위, 목록은 그 아래 한 폭으로 */
  const 숙줄 = await 숙표.locator('tbody tr').allTextContents();
  숙줄.forEach(x => console.log('   ·', x.replace(/\s+/g, ' ').trim().slice(0, 78)));
  확인('여기도 묶인 줄이 있다', await 숙표.locator('tr.many').count() > 0, true);
  const 묶2 = 숙표.locator('tr.many').first();
  확인('제출이 n / n', /\d+ \/ \d+/.test((await 묶2.textContent())), true);
  확인('펼치기 안내', (await 묶2.textContent()).indexOf('펼치기') > -1, true);

  /* 묶음 네모칸이 여러 건을 한꺼번에 고른다 */
  const 전선택 = await p.evaluate(() => Object.keys(T.선택숙제 || {}).length);
  await 묶2.locator('.hwPick묶음').check();
  await p.waitForTimeout(400);
  const 후선택 = await p.evaluate(() => Object.keys(T.선택숙제 || {}).length);
  console.log('  고른 건수:', 전선택, '→', 후선택);
  확인('한 번에 여러 건이 골라진다', 후선택 - 전선택 >= 2, true);
  const 단추 = (await p.locator('.hwDelSel[data-scope="now"]').textContent()).trim();
  console.log('  삭제 단추:', 단추);
  확인('삭제 단추에 건수가 반영된다', /선택 삭제 \(\d+\)/.test(단추), true);

  /* 펼치면 개별 줄에 수정 단추 */
  await 묶2.click();
  await p.waitForTimeout(500);
  확인('펼치면 수정 단추가 나온다', await 숙표.locator('[data-edit]').count() > 0, true);
  await p.screenshot({ path: 'r3_hw_grouped.png' });

  /* 안 묶인 숙제는 그대로 수정 가능 */
  const 홑줄 = 숙표.locator('tr.hwrow:not(.many)').first();
  확인('안 묶인 줄에도 수정 단추', await 홑줄.locator('[data-edit]').count(), 1);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
