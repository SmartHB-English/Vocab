/* 1단계 — 과 한 장 읽기 (화면) · 과넣기 (Code.gs) */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { chromium } = require('playwright');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const { 띄우기설정 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

/* ======================= Code.gs — 과넣기 ======================= */
const 칸 = { SpreadsheetApp: { flush() {} }, Logger: { log() {} }, console };
vm.createContext(칸);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), 칸);
칸.선생님확인_ = () => true;
칸.단어장목록 = () => [];
/* 가짜 시트 — 줄을 배열로 들고 있는다 (1행은 머리글) */
function 가짜시트(머리) {
  const 줄 = [머리];
  return {
    줄,
    getLastRow: () => 줄.length, getLastColumn: () => 5,
    getRange(r, c, nr, nc) {
      return {
        setValues(v) { v.forEach((x, i) => { 줄[r - 1 + i] = x.slice(); }); return this; },
        getValues: () => 줄.slice(r - 1, r - 1 + nr).map(x => x.slice(c - 1, c - 1 + nc)),
        clearContent() { for (let i = 0; i < nr; i++) 줄[r - 1 + i] = ['', '', '', '', '']; return this; }
      };
    }
  };
}
const 책들 = {};       // 이름 → {종류, 시트}
const 시트들 = {};
칸.단어장찾기_ = 이름 => 책들[이름] ? { 이름, 종류: 책들[이름].종류, 시트: 이름 } : null;
칸.ss_ = () => ({ getSheetByName: n => 시트들[n] || null });
칸.단어시트만들기_ = (이름, 종류) => { 책들[이름] = { 종류 }; 시트들[이름] = 가짜시트(칸.과머리_.slice()); return 시트들[이름]; };
const 넣을것 = {
  이름: '중2 5과',
  구분들: {
    단어: [{ en: 'apple', ko: '사과' }, { en: 'banana', ko: '바나나', 비고: 'https://x/banana.png' }],
    본문: [{ en: 'Modern street art comes in many forms.', ko: '현대의 거리 예술은…', 비고: '교과서 88쪽' }],
    문법: [{ en: 'I saw a boy [running].', ko: '나는 뛰는 소년을 보았다.', 비고: '(run) 지각동사+-ing' },
           { en: 'She [used to] live here.', ko: '그녀는 여기 살곤 했다.', 비고: '' }]
  }
};
console.log('— 과넣기 —');
let r = 칸.과넣기('1234', 넣을것);
확인('만든다', [r.결과, r.종류, r.개수], ['만듦', '과', { 단어: 2, 본문: 1, 문법: 2 }]);
확인('번호는 구분 안에서 1부터', 시트들['중2 5과'].줄.slice(1).map(x => x[1] + x[0]), ['단어1', '단어2', '본문1', '문법1', '문법2']);
확인('다섯 칸 — 번호 | 구분 | 영어 | 뜻·해석 | 비고', 시트들['중2 5과'].줄[2], [2, '단어', 'banana', '바나나', 'https://x/banana.png']);
r = 칸.과넣기('1234', Object.assign({}, 넣을것, { 구분들: { 단어: [{ en: 'cat', ko: '고양이' }] } }));
확인('같은 이름이면 기본은 건너뛰기', [r.결과, 시트들['중2 5과'].줄.length], ['건너뜀', 6]);
r = 칸.과넣기('1234', Object.assign({}, 넣을것, { 구분들: { 단어: [{ en: 'cat', ko: '고양이' }] }, 덮어쓰기: true }));
확인('덮어쓰기면 새로 쓴다', [r.결과, r.개수.단어, r.개수.본문], ['덮음', 1, 0]);
확인('덮어쓴 뒤 남은 줄은 빈 줄', 칸.과줄들_(시트들['중2 5과'], 시트들['중2 5과'].줄.length).map(w => w.en), ['cat']);
책들['옛 단어장'] = { 종류: '' }; 시트들['옛 단어장'] = 가짜시트(['번호', '영어', '뜻']);
r = 칸.과넣기('1234', Object.assign({}, 넣을것, { 이름: '옛 단어장', 덮어쓰기: true }));
확인('옛 단어장은 과로 덮지 않는다', [r.결과, r.ok], ['실패', false]);
확인('이름이 없으면 못 넣는다', 칸.과넣기('1234', { 구분들: 넣을것.구분들 }).결과, '실패');
확인('줄이 없으면 못 넣는다', 칸.과넣기('1234', { 이름: '빈 과', 구분들: {} }).결과, '실패');

console.log('\n— 구분으로 먼저 거르고 그 안에서 번호 —');
const 섞인 = 가짜시트(칸.과머리_.slice());
섞인.줄.push([3, '본문', 's3', '해3', ''], [1, '단어', 'w1', '뜻1', ''], [1, '본문', 's1', '해1', '88쪽'],
           [2, '본문', 's2', '해2', ''], [2, '단어', 'w2', '뜻2', 'pic.png'], [1, '', 'w3', '뜻3', '']);
const 줄들 = 칸.과줄들_(섞인, 섞인.줄.length);
/* w3 은 구분이 비어 단어로, 번호 1 이 w1 과 겹치면 시트 차례대로 */
확인('구분 차례 · 구분 안 번호 차례', 줄들.map(w => w.칸 + w.no + ':' + w.en), ['단어1:w1', '단어2:w3', '단어3:w2', '본문1:s1', '본문2:s2', '본문3:s3']);
확인('비고는 구분마다 — 단어는 그림, 본문은 비고', [줄들[2].그림, 줄들[3].비고], ['pic.png', '88쪽']);
확인('본문 2~3 은 본문의 2·3번', 칸.범위단어_(줄들, '본문', 2, 3).map(w => w.en), ['s2', 's3']);
확인('단어 1~2 에 본문이 안 섞인다', 칸.범위단어_(줄들, '단어', 1, 2).map(w => w.en), ['w1', 'w3']);
책들['섞인 과'] = { 종류: '과' }; 시트들['섞인 과'] = 섞인;
확인('단어가져오기도 칸·범위로', 칸.단어가져오기('섞인 과', '본문', 1, 2).map(w => w.en), ['s1', 's2']);
확인('칸 없이 부르면 통째로', 칸.단어가져오기('섞인 과').length, 6);

console.log('\n— 숙제와 기록 — 과 숙제는 「본문 1~12」 로 잇는다 —');
const 맵 = { '섞인 과|본문 1~12': { '2026-10-06': 90 }, '섞인 과|1~12': { '2026-10-05': 70 } };
확인('칸이 있으면 구분 붙은 범위로', 칸.기록찾기_(맵, '', '섞인 과', 1, 12, '본문'), { '2026-10-06': 90 });
확인('단어 1~12 와 본문 1~12 는 다르다', 칸.기록찾기_(맵, '', '섞인 과', 1, 12, '단어'), null);
확인('칸이 빈 옛 숙제는 예전처럼', 칸.기록찾기_(맵, '', '섞인 과', 1, 12, ''), { '2026-10-05': 70 });
확인('숙제 머리글 — 순서 뒤에 칸·제한시간·단계·통과점수·재응시·외우기분 (보태기만)', 칸.HEADERS.숙제.slice(-7), ['순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분']);
확인('한 줄씩 고치는 기능은 과에서 막는다', 칸.단어추가('1234', '섞인 과', 'x', 'y').ok, false);

/* ======================= 화면 — 과 한꺼번에 넣기 ======================= */
const 세트 = ['## 중2 5과', '// 이 줄은 주석', '', '### 단어', 'apple | 사과', 'banana | 바나나', '',
  '### 본문', 'Modern street art comes in many forms. | 현대의 거리 예술은 … | 교과서 88쪽 · Street Art',
  'Street Art in London', '### 문법', 'I saw a boy [running] in the park. | 나는 공원에서… | (run) 지각동사+-ing'].join('\n');

(async () => {
  const b = await chromium.launch(띄우기설정);
  const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(앱주소); await p.waitForTimeout(400);
  await p.click('#btnTeacherGo'); await p.fill('#tPw', '1234'); await p.click('#btnTLogin');
  await p.waitForTimeout(1300);
  await p.evaluate(() => { var b = document.querySelector('[data-tab="book"]'); var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]'); if (g) g.click(); });
  await p.waitForTimeout(250); await p.click('[data-tab="book"]'); await p.waitForTimeout(800);

  console.log('\n— 붙여넣으면 바로 미리보기 —');
  확인('처음엔 접혀 있다', await p.locator('#gwBody').isVisible(), false);
  await p.click('#gwFold'); await p.waitForTimeout(200);
  await p.fill('#gwText', 세트); await p.waitForTimeout(200);
  const 미리 = await p.locator('#gwPrev').innerText();
  console.log('  ' + 미리.replace(/\n/g, ' / '));
  확인('이름과 구분별 개수', /중2 5과 — 단어 2 · 본문 1 · 문법 1/.test(미리), true);
  확인('「단어장 하나를 만듭니다」', 미리.indexOf('단어장 하나를 만듭니다 (종류 : 과)') > -1, true);
  확인('엉뚱한 줄은 몇째 줄인지와 그 내용으로', 미리.indexOf('⚠ 10째 줄을 못 읽었습니다: "Street Art in London"') > -1, true);
  확인('// 줄과 빈 줄은 안 센다 (경고도 아니다)', (미리.match(/⚠/g) || []).length, 1);
  확인('기본은 건너뛰기', await p.isChecked('[name="gwMode"][value="건너뛰기"]'), true);
  확인('넣기 단추가 눌린다', await p.locator('#gwGo').isDisabled(), false);

  await p.fill('#gwText', '### 단어\napple | 사과'); await p.waitForTimeout(200);
  확인('이름이 없으면 넣기 단추가 안 눌린다', await p.locator('#gwGo').isDisabled(), true);
  확인('이름이 없다고 알려 준다', /이름이 없습니다/.test(await p.locator('#gwPrev').innerText()), true);
  await p.fill('#gwText', '## 낱말만\napple | 사과\nbook | 책\ncat | 고양이'); await p.waitForTimeout(200);
  확인('구분 머리줄 없이 낱말만 → 전부 단어', /단어 3 · 본문 0 · 문법 0/.test(await p.locator('#gwPrev').innerText()), true);

  console.log('\n— 넣기 · 건너뛰기 · 덮어쓰기 —');
  await p.fill('#gwText', 세트); await p.waitForTimeout(200);
  await p.click('#gwGo'); await p.waitForTimeout(1500);
  const 만든 = await p.evaluate(() => { const c = DEMO_과책['중2 5과']; return c && [c.단어.length, c.본문.length, c.문법.length]; });
  확인('단어장 하나가 만들어진다', 만든, [2, 1, 1]);
  확인('목록에 종류 「과」 로', await p.evaluate(() => DEMO.시작정보().단어장목록.filter(x => x.이름 === '중2 5과').map(x => x.종류)), ['과']);
  확인('만든 단어장이 열린다', await p.evaluate(() => T.책), '중2 5과');
  await p.click('#gwFold').catch(() => {}); await p.waitForTimeout(200);
  if (!(await p.locator('#gwBody').isVisible())) { await p.click('#gwFold'); await p.waitForTimeout(200); }
  await p.fill('#gwText', '## 중2 5과\n### 단어\ncat | 고양이'); await p.waitForTimeout(200);
  await p.click('#gwGo'); await p.waitForTimeout(1200);
  확인('같은 이름이면 건너뛴다', await p.evaluate(() => DEMO_과책['중2 5과'].단어.length), 2);
  await p.check('[name="gwMode"][value="덮어쓰기"]');
  await p.click('#gwGo'); await p.waitForTimeout(1500);
  확인('덮어쓰기를 고르면 바꾼다', await p.evaluate(() => DEMO_과책['중2 5과'].단어.map(w => w.en)), ['cat']);

  console.log('\n— 과 꼴로 뽑기 — 뽑아서 다시 넣으면 그대로 —');
  await p.click('.bkrow[data-book="중2 7과"]'); await p.waitForTimeout(800);
  확인('과 단어장이면 뽑기 단추', await p.locator('#bkExport').isVisible(), true);
  확인('한 줄씩 고치는 칸은 숨긴다', await p.locator('#bkAdd').isVisible(), false);
  await p.click('#bkExport'); await p.waitForTimeout(600);
  const 뽑은 = await p.inputValue('#bkExportText');
  확인('같은 꼴의 글', 뽑은.split('\n').slice(0, 3), ['## 중2 7과', '', '### 단어']);
  const 다시 = await p.evaluate(글 => { const r = 과읽기_(글); return [r.이름, r.구분들.단어.length, r.구분들.본문.length, r.구분들.문법.length, r.경고.length]; }, 뽑은);
  const 원래 = await p.evaluate(() => { const c = DEMO_과책['중2 7과']; return ['중2 7과', c.단어.length, c.본문.length, c.문법.length, 0]; });
  확인('다시 읽으면 같은 이름·같은 개수·경고 없음', 다시, 원래);
  확인('본문 비고(쪽수)도 따라간다', await p.evaluate(글 => 과읽기_(글).구분들.본문[0].비고, 뽑은),
    await p.evaluate(() => DEMO_과책['중2 7과'].본문[0].비고));

  console.log('\n— 손으로 만드는 칸에서도 종류 「과」 —');
  확인('종류에 과가 있다', (await p.locator('#dvKind option').allTextContents()).some(t => /^과/.test(t.trim())), true);
  await p.selectOption('#dvKind', '과'); await p.waitForTimeout(150);
  확인('과 꼴로 붙여넣으라고 안내한다', await p.locator('#dvGwNote').isVisible(), true);

  /* 원장님이 만든 진짜 세트 파일이 있으면 그대로 붙여넣어 본다 */
  const 진짜 = path.join(__dirname, '..', '단어장', '중2-5과-세트.txt');
  if (fs.existsSync(진짜)) {
    console.log('\n— 중2-5과-세트.txt —');
    if (!(await p.locator('#gwBody').isVisible())) { await p.click('#gwFold'); await p.waitForTimeout(200); }
    await p.fill('#gwText', fs.readFileSync(진짜, 'utf8')); await p.waitForTimeout(300);
    const 글 = await p.locator('#gwPrev').innerText();
    console.log('  ' + 글.replace(/\n/g, ' / '));
    확인('단어 155 · 본문 28 로 읽힌다', /단어 155 · 본문 28/.test(글), true);
    확인('경고 줄이 없다', (글.match(/⚠/g) || []).length, 0);
  }

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
