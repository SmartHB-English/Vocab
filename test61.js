/* 단어장 배정을 없애고 명단의 「교재」 로 본다 · 숙제 「이어서 내기」 */
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

async function 학생으로(p, 이름){
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.fill('#inPw', '1234'); await p.fill('#inName', 이름);
  await p.click('#btnLogin');
  await p.waitForTimeout(1800);
  const n = p.locator('#noti');
  if (await n.isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }
}
const 내책 = p => p.evaluate(() => 내책들().map(b => b.이름));

(async () => {
  const b = await chromium.launch(require('./도구').띄우기설정);
  const errs = [];

  console.log('— 명단의 교재가 볼 수 있는 단어장을 정한다 —');
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', d => d.accept());

  await 학생으로(p, '홍길동');
  확인('홍길동은 교재가 둘', await 내책(p), ['예시 단어장', '불규칙 동사 50']);

  await 학생으로(p, '김영희');
  확인('김영희는 예시 단어장만', await 내책(p), ['예시 단어장']);

  await 학생으로(p, '이철수');
  확인('이철수는 불규칙과 본문', await 내책(p), ['불규칙 동사 50', '중2 5과 본문']);

  console.log('\n— 교재를 비우면 전부 보인다 —');
  await p.goto(앱주소);
  await p.waitForTimeout(400);
  await p.evaluate(() => { DEMO_배정.forEach(x => { x.교재 = []; }); });
  await p.fill('#inPw', '1234'); await p.fill('#inName', '김영희');
  await p.click('#btnLogin'); await p.waitForTimeout(1800);
  if (await p.locator('#noti').isVisible()) { await p.click('#notiOk'); await p.waitForTimeout(400); }
  /* 미리보기 단어장은 늘어난다(문법이 붙었다) — 미리보기에 있는 단어장 전부와 견준다 */
  확인('전부 보인다', await 내책(p), await p.evaluate(() => DEMO.선생님요약().단어장목록.map(b => b.이름)));

  console.log('\n— 선생님 화면에서 「단어장 배정」 칸은 사라졌다 —');
  const t = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  t.on('pageerror', e => errs.push('PAGEERROR(선생님): ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소);
  await t.waitForTimeout(400);
  await t.click('#btnTeacherGo');
  await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  확인('배정 칸이 없다', await t.locator('[data-tab="give"]').count(), 0);
  await 묶음열기(t, 'roster');
  const 자료칸 = (await t.locator('[data-g="자료"]').allTextContents()).map(x => x.trim());
  console.log('  자료 묶음: ' + 자료칸.join(' / '));
  확인('단어장·학생 명단·설정만', 자료칸, ['단어장', '학생 명단', '설정']);
  확인('명단 칸은 그대로 열린다', await t.locator('[data-tab="roster"]').count(), 1);

  console.log('\n— 숙제 「이어서 내기」 —');
  /* 진도를 레슨 1까지 낸 상태로 맞춰 둔다 */
  await t.evaluate(() => {
    DEMO_HW = [
      { 행:2, 단어장:'예시 단어장', 시작:1, 끝:10, 유형:'스펠링', 마감일:'2026-12-31',
        학생:'', 색:'#FF7A3D', 종류:'기한', 지남:false, 대상수:2, 한사람:[], 안한사람:[] },
      { 행:3, 단어장:'예시 단어장', 시작:1, 끝:25, 유형:'스펠링', 마감일:'2026-12-20',
        학생:'', 색:'#FF7A3D', 종류:'시험', 지남:false, 대상수:2, 한사람:[], 안한사람:[] }
    ];
    T.data = null; loadTeacher();
  });
  await t.waitForTimeout(1500);
  await 탭가기(t, 'hw');
  await t.waitForTimeout(1400);
  확인('이어서 내기 줄이 있다', await t.locator('.nextpick').count(), 1);
  const 칩들 = (await t.locator('.npcard').allInnerTexts()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('  ' + 칩들.join(' | '));
  확인('단어장마다 하나씩', 칩들.length > 0, true);

  /* 데모 숙제에서 「예시 단어장」 의 가장 뒤 번호를 찾아 그 다음이 채워지는지 본다 */
  const 진도 = await t.evaluate(() => {
    var 끝 = 0, 시험끝 = 0;
    (T.data.숙제목록 || []).forEach(function (h) {
      if (h.단어장 !== '예시 단어장') return;
      if (h.종류 === '시험' || h.종류 === '보충') { 시험끝 = Math.max(시험끝, Number(h.끝) || 0); return; }
      끝 = Math.max(끝, Number(h.끝) || 0);
    });
    var 묶음 = 0, 총 = 0;
    (T.data.단어장목록 || []).forEach(function (x) {
      if (x.이름 === '예시 단어장') { 묶음 = Number(x.레슨) || 10; 총 = Number(x.개수) || 0; }
    });
    return { 지난끝: 끝, 시험끝: 시험끝, 묶음: 묶음, 총: 총 };
  });
  console.log('  ' + JSON.stringify(진도));
  확인('시험은 1~25로 냈지만', 진도.시험끝, 25);
  확인('진도는 평소 숙제만 센다', 진도.지난끝, 10);
  const 다음시작 = 진도.지난끝 + 1;
  const 다음끝 = Math.min(진도.총, 다음시작 + 진도.묶음 - 1);

  const 칩 = t.locator('.npcard', { hasText: '예시 단어장' }).first();
  확인('지난번 진도를 알려 준다',
    /지난번 (레슨 \d+|\d+번)까지/.test((await 칩.innerText()).replace(/\s+/g, ' ')), true);
  await 칩.click();
  await t.waitForTimeout(800);
  확인('단어장이 채워진다', await t.locator('#hwBook').inputValue(), '예시 단어장');
  확인('다음 레슨 시작', await t.locator('#hwFrom').inputValue(), String(다음시작));
  확인('다음 레슨 끝', await t.locator('#hwTo').inputValue(), String(다음끝));
  await t.screenshot({ path: 'nx1_hw.png' });

  console.log('\n— 그대로 등록하면 진도가 한 칸 나아간다 —');
  await t.click('#btnHwAdd');
  await t.waitForTimeout(1600);
  const 새진도 = await t.evaluate(() => {
    var 끝 = 0;
    (T.data.숙제목록 || []).forEach(function (h) {
      if (h.단어장 !== '예시 단어장') return;
      if (h.종류 === '시험' || h.종류 === '보충') return;
      끝 = Math.max(끝, Number(h.끝) || 0);
    });
    return 끝;
  });
  확인('진도가 다음 레슨 끝까지 왔다', 새진도, 다음끝);
  const 칩2 = t.locator('.npcard', { hasText: '예시 단어장' }).first();
  const 글2 = (await 칩2.innerText()).replace(/\s+/g, ' ');
  console.log('  ' + 글2);
  if (다음끝 < 진도.총) {
    확인('다음 번호가 또 채워진다', 글2.indexOf(String(다음끝 + 1)) > -1, true);
  } else {
    확인('끝까지 냈다고 알려 준다', /끝까지 냈어요/.test(글2), true);
  }

  console.log('\n— 범위는 레슨 번호로 적는다 —');
  확인('레슨 계산', await t.evaluate(() => [
    레슨글_(10, 25, 1, 10, false),
    레슨글_(10, 25, 11, 20, false),
    레슨글_(10, 25, 11, 17, false),
    레슨글_(10, 25, 21, 25, false),
    레슨글_(10, 25, 1, 25, false),
    레슨글_(10, 25, 6, 23, false),
    레슨글_(10, 25, 11, 20, true)
  ]), ['레슨 1', '레슨 2', '레슨 2 중 일부', '레슨 3', '전체', '레슨 1~3 중 일부', '레슨 2 · 11~20번']);

  const 표줄 = (await t.locator('.tb tbody tr').first().innerText()).replace(/\s+/g, ' ').trim();
  console.log('  선생님 표: ' + 표줄);
  확인('선생님 표에는 레슨과 번호를 같이', /레슨 \d+ · \d+~\d+번|전체 · \d+~\d+번/.test(표줄), true);

  const p3 = await b.newPage({ viewport: { width: 420, height: 900 } });
  p3.on('pageerror', e => errs.push('PAGEERROR3: ' + e.message));
  p3.on('dialog', d => d.accept());
  await 학생으로(p3, '홍길동');
  const 학생줄 = (await p3.locator('#hwBox .ckrow').first().innerText()).replace(/\s+/g, ' ').trim();
  console.log('  학생 줄: ' + 학생줄);
  확인('학생 화면엔 레슨만', /\d+~\d+번/.test(학생줄), false);
  확인('레슨이라고 적힌다', /레슨 \d+|전체/.test(학생줄), true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
