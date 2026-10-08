/* 알림 팝업 — 선생님 공지 + 오늘 챙길 것 */
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
async function 학생로그인(b, 이름) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  if (이름) await p.fill('#inName', 이름);
  await p.fill('#inName','홍길동'); await p.fill('#inPw','1234'); await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  return p;
}

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const errs = [];

  /* ================= 학생 팝업 ================= */
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.fill('#inPw', '1234');
  await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);

  console.log('— 앱을 열면 팝업 —');
  확인('팝업이 뜬다', await p.locator('#noti').isVisible(), true);
  const 줄 = (await p.locator('.notirow').allInnerTexts()).map(x => x.replace(/\s+/g, ' ').trim());
  줄.forEach(x => console.log('   ·', x.slice(0, 70)));
  확인('공지가 맨 위', 줄[0].indexOf('추석 연휴 휴강 안내') > -1, true);
  확인('공지 내용도 보인다', 줄[0].indexOf('9월 28일') > -1, true);
  확인('다른 공지도 같이 온다', 줄.some(x => x.indexOf('금요일 단어 시험') > -1), true);
  확인('선생님 말이라고 알려 준다',
    (await p.locator('#notiDay').textContent()).indexOf('선생님') > -1, true);
  확인('공지는 다른 색', await p.locator('.notirow.say').count(), 2);
  확인('오늘 챙길 것도 같이', 줄.some(x => x.indexOf('오늘까지 끝낼 숙제') > -1), true);
  await p.screenshot({ path: 'h1_noti.png' });

  console.log('\n— 읽으면 사라진다 —');
  await p.click('#notiOk');
  await p.waitForTimeout(500);
  확인('팝업이 닫힌다', await p.locator('#noti').isVisible(), false);
  확인('홈에 한 줄로 남는다', await p.locator('.saybar').isVisible(), true);
  const 한줄 = (await p.locator('.saybar').innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 한줄);
  확인('제목이 보인다', 한줄.indexOf('추석 연휴 휴강 안내') > -1, true);
  확인('몇 개 더 있는지', 한줄.indexOf('＋1') > -1, true);

  console.log('\n— 다시 열어도 안 뜬다 —');
  await p.reload();
  await p.waitForTimeout(500);
  await p.fill('#inPw', '1234');
  await p.fill('#inName', '홍길동');
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  확인('읽은 공지는 다시 안 뜬다', await p.locator('#noti').isVisible(), false);
  확인('한 줄은 그대로 남아 있다', await p.locator('.saybar').isVisible(), true);

  console.log('\n— 한 줄을 누르면 다시 볼 수 있다 —');
  await p.click('.saybar');
  await p.waitForTimeout(500);
  확인('다시 뜬다', await p.locator('#noti').isVisible(), true);
  확인('공지가 그대로', (await p.locator('.notirow').first().innerText()).indexOf('추석') > -1, true);
  await p.click('#notiClose');
  await p.waitForTimeout(400);
  확인('✕ 로도 닫힌다', await p.locator('#noti').isVisible(), false);

  console.log('\n— 다시 풀 숙제가 있으면 빨갛게 —');
  await p.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    S.공지 = [];
    S.숙제[0].모자람 = true; S.숙제[0].점수 = 70; S.숙제[0].완료 = false;
    알림보이기(true);
  });
  await p.waitForTimeout(500);
  const 줄2 = (await p.locator('.notirow').allInnerTexts()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  ' + 줄2[0].slice(0, 80));
  확인('다시 풀 숙제가 맨 위', 줄2[0].indexOf('다시 풀어야') > -1, true);
  확인('빨간 줄', await p.locator('.notirow.warn').count(), 1);
  확인('몇 점이었는지 알려 준다', 줄2[0].indexOf('70점') > -1, true);
  확인('넘어야 할 점수도', 줄2[0].indexOf('80점') > -1, true);

  console.log('\n— 공지가 없으면 제목이 바뀐다 —');
  확인('오늘 챙길 것', (await p.locator('#notiDay').textContent()).indexOf('오늘 챙길 것') > -1, true);

  console.log('\n— 할 일이 없으면 안 뜬다 —');
  await p.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    S.공지 = []; S.숙제 = []; S.연속 = null;
    알림보이기(true);
  });
  await p.waitForTimeout(400);
  확인('아무것도 없으면 조용하다', await p.locator('#noti').isVisible(), false);

  /* ================= 선생님 ================= */
  console.log('\n— 선생님이 공지 올리기 —');
  const t = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  t.on('pageerror', e => errs.push('ERR(선생님) ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소);
  await t.waitForTimeout(400);
  await t.click('#btnTeacherGo');
  await t.fill('#tPw', '1234');
  await t.click('#btnTLogin');
  await t.waitForTimeout(1400);
  await 묶음열기(t, 'notice');
  확인('메뉴에 공지가 있다', await t.locator('[data-tab="notice"]').isVisible(), true);
  await 탭가기(t, 'notice');
  await t.waitForTimeout(1200);

  확인('적는 칸이 있다', await t.locator('#ncTitle').isVisible(), true);
  확인('반 고르개는 없앴다 — 학원 전체 하나', await t.locator('#ncClass').count(), 0);
  const 전 = await t.locator('.tb tbody tr').count();
  await t.fill('#ncTitle', '내일 교재 꼭 가져오기');
  await t.fill('#ncBody', '단어장을 두고 오는 친구가 많습니다.');
  await t.click('#btnNcAdd');
  await t.waitForTimeout(1200);
  확인('목록에 올라간다', await t.locator('.tb tbody tr').count(), 전 + 1);
  const 첫 = (await t.locator('.tb tbody tr').first().innerText()).replace(/\s+/g, ' ').trim();
  console.log('  ' + 첫.slice(0, 80));
  확인('제목이 보인다', 첫.indexOf('내일 교재 꼭 가져오기') > -1, true);
  확인('기한이 없으면 계속', 첫.indexOf('계속') > -1, true);
  await t.screenshot({ path: 'h2_notice.png' });

  console.log('\n— 내렸다 다시 띄우기 —');
  await t.locator('[data-ncoff]').first().click();
  await t.waitForTimeout(1000);
  확인('내리면 단추가 바뀐다',
    (await t.locator('[data-ncoff]').first().textContent()).trim(), '다시 띄우기');
  확인('내린 줄은 흐리게', await t.locator('.tb tbody tr.offrow').count() > 0, true);
  await t.locator('[data-ncoff]').first().click();
  await t.waitForTimeout(1000);
  확인('다시 띄우면 돌아온다',
    (await t.locator('[data-ncoff]').first().textContent()).trim(), '내리기');

  console.log('\n— 지우기 —');
  const 전2 = await t.locator('.tb tbody tr').count();
  await t.locator('[data-ncdel]').first().click();
  await t.waitForTimeout(1100);
  확인('한 줄 줄어든다', await t.locator('.tb tbody tr').count(), 전2 - 1);

  console.log('\n— 빈 공지는 막는다 —');
  await t.click('#btnNcAdd');
  await t.waitForTimeout(600);
  확인('내용을 적으라고 알려 준다',
    (await t.locator('.toast').textContent()).indexOf('내용을 적어') > -1, true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
