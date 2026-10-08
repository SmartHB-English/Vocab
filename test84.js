/* 학부모 사이트 — 비밀 링크로 그 아이 것만 · 틀린 링크는 아무것도 안 알려 준다 · 다시 발급하면 옛 링크는 바로 막힌다
   · 선생님 명단의 [학부모] (링크 · 한마디 · 문자 만들기) */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const 앱주소 = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;
const 학부모주소 = require('url').pathToFileURL(path.join(__dirname, 'parent.html')).href;
const { 띄우기설정 } = require('./도구');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  const 짧게 = v => { const g = JSON.stringify(v); return g && g.length > 300 ? g.slice(0, 300) + '…' : g; };
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + 짧게(실제) + (ok ? '' : '  (기대: ' + 짧게(기대) + ')'));
}

/* ======================= Code.gs ======================= */
function 시트(줄들, 셈) {
  const 줄 = r => (줄들[r - 1] = 줄들[r - 1] || []);
  return { 줄들,
    getLastRow: () => 줄들.length, getLastColumn: () => Math.max(...줄들.map(x => x.length)),
    getMaxColumns: () => Math.max(11, ...줄들.map(x => x.length)), insertColumnsAfter() {},
    getRange(r, c, nr, nc) { nr = nr || 1; nc = nc || 1; return {
      getValues() { const o = []; for (let i = 0; i < nr; i++) { const x = 줄들[r - 1 + i] || []; const y = []; for (let j = 0; j < nc; j++) y.push(x[c - 1 + j] === undefined ? '' : x[c - 1 + j]); o.push(y); } return o; },
      getValue() { const x = 줄들[r - 1] || []; return x[c - 1] === undefined ? '' : x[c - 1]; },
      setValue(v) { if (셈) 셈.쓰기++; 줄(r)[c - 1] = v; return this; },
      setValues(v) { v.forEach((x, i) => x.forEach((y, j) => { 줄(r + i)[c - 1 + j] = y; })); return this; },
      setFontWeight() { return this; }, setBackground() { return this; } }; } };
}
const 칸 = { Logger: { log() {} }, console,
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { getUuid: () => crypto.randomUUID(),
    /* 꼴을 읽는다 — 학부모 숙제 줄의 「밤 9:14」 는 'M/d|H|mm' 로 만든다 */
    formatDate(d, tz, 꼴) { const p = n => String(n).padStart(2, '0');
      return String(꼴 || 'yyyy-MM-dd').replace(/yyyy|MM|M|dd|d|HH|H|mm/g, t => ({ yyyy: d.getFullYear(), MM: p(d.getMonth() + 1), M: d.getMonth() + 1,
        dd: p(d.getDate()), d: d.getDate(), HH: p(d.getHours()), H: d.getHours(), mm: p(d.getMinutes()) })[t]); } } };
const 캐시 = new Map();
칸.CacheService = { getScriptCache: () => ({ get: k => (캐시.has(k) ? 캐시.get(k) : null), put: (k, v) => 캐시.set(k, v), remove: k => 캐시.delete(k), removeAll: ks => ks.forEach(k => 캐시.delete(k)) }) };
vm.createContext(칸);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), 칸);
const D = vm.runInContext('Date', 칸);
const 전 = 일 => new D(Date.now() - 일 * 86400000);
const 셈 = { 쓰기: 0 };
const 시트들 = {
  학생: 시트([['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재'],
    ['', '홍길동', '1234', '초중등', '', '중2', '인왕중', '예시 단어장'],
    ['', '김영희', '1234', '초중등', '', '중2', '인왕중', '예시 단어장'],
    ['', '이철수', '1234', '고등', '', '고3', '한성고', '예시 단어장']], 셈),
  숙제: 시트([['반'],
    ['', '예시 단어장', 1, 10, '스펠링', 전(-2), 전(1), '', '기한', '', 0, '', '', '', '', '', ''],
    ['', '예시 단어장', 11, 20, '첫 글자', 전(-2), 전(1), '김영희', '기한', '', 0, '', '', '', '', '', ''],     // 김영희만
    ['', '예시 단어장', 21, 25, '스펠링', 전(-3), 전(1), '', '시험', '', 0, '', 10, '', '', '', 3],            // 학원 시험 — 홍길동은 봤다
    ['', '예시 단어장', 1, 5, '스펠링', 전(-4), 전(1), '', '시험', '', 0, '', 10, '', '', '', 3]]),             // 아직 아무도 안 본 시험
  기록: 시트([['때'],
    [전(2), '', '홍길동', '예시 단어장', '1~10', '스펠링', 10, 9, 90, 0, 0, 60, 'O', 'apple, bee', '숙제', ''],
    [전(1.5), '', '김영희', '예시 단어장', '11~20', '첫 글자', 10, 5, 50, 0, 0, 60, 'O', 'cat, dog, egg', '숙제', ''],
    [전(1), '', '홍길동', '예시 단어장', '1~10', '스펠링', 10, 8, 80, 0, 0, 60, 'O', 'apple', '숙제', ''],
    [전(0.5), '', '이철수', '예시 단어장', '1~10', '스펠링', 10, 10, 100, 0, 0, 60, 'O', '', '숙제', ''],
    [전(0.4), '', '홍길동', '예시 단어장', '21~25', '스펠링', 5, 3, 60, 0, 0, 60, 'O', 'fig, gum', '시험', ''],
    [전(0.3), '', '김영희', '예시 단어장', '21~25', '스펠링', 5, 5, 100, 0, 0, 60, 'O', '', '시험', '']]),
  기록보관: 시트([['때']]),
  단어장목록: 시트([['이름', '종류', '시트', '색'], ['예시 단어장', '', '예시 단어장', '#FF7A3D']]),
  '예시 단어장': 시트([['영어']].concat(Array.from({ length: 25 }, (_, i) => ['w' + i]))),
  설정: 시트([['항목', '값'], ['선생님비밀번호', '1234'], ['학원이름', '홍제인왕해법영어'], ['학원전화', '02-000-0000']])
};
칸.SpreadsheetApp = { flush() {}, getActiveSpreadsheet: () => ({ getSheetByName: n => 시트들[n] || null }) };

console.log('— 링크 발급 (선생님만) —');
확인('비번이 틀리면 안 된다', 칸.학부모링크발급('0000', '홍길동').ok, false);
const 발급 = 칸.학부모링크발급('1234', '홍길동');
const 토큰 = 발급.주소.split('#k=')[1];
확인('토큰은 64자 · 추측 못 하게 (16진수)', [토큰.length, /^[0-9a-f]{64}$/.test(토큰)], [64, true]);
확인('해시(#) 뒤에 둔다 · 물음표는 없다', [/\/parent\.html#k=/.test(발급.주소), 발급.주소.indexOf('?')], [true, -1]);
확인('주소에 아이 이름이 없다', 발급.주소.indexOf('홍길동'), -1);
확인('학생 시트 9번째 칸(학부모링크)에 적힌다 · 머리글은 보태기만', [시트들.학생.줄들[1][8], 시트들.학생.줄들[0].slice(7)], [토큰, ['교재', '학부모링크', '학부모마지막', '선생님한마디']]);
확인('두 번 만들면 다르다', 칸.학부모토큰새로_() !== 칸.학부모토큰새로_(), true);

console.log('\n— 학부모보기 — 그 아이 것만 —');
let r = 칸.학부모보기(토큰);
확인('이름 · 이번 주 숙제', [r.ok, r.이름, r.이번주숙제.length], [true, '홍길동', 1]);
/* 숙제와 시험은 두 묶음 — 숙제에는 점수가 없고, 시험은 학원 시험(구분 「시험」)만 */
확인('이번 주 숙제 — 종류 「시험」 은 안 들어간다', r.이번주숙제.map(h => h.제목), ['예시 단어장 1~10']);
확인('푼 숙제에는 점수가 담긴다 (가장 마지막 기록이 아니라 낸 것으로 친 기록)', r.이번주숙제.map(h => typeof h.점수 === 'number' && h.점수 >= 80), [true]);
확인('낸 수 · 안 낸 수에 시험이 안 섞인다 (숙제 하나 — 냈다)', [r.낸수, r.안낸수], [1, 0]);
확인('시험 — 볼 시험(점수 없음) 다음 본 시험(그 아이 점수만)', r.시험.map(t => [t.범위, t.봤나, t.점수]), [['1~5', false, null], ['21~25', true, 60]]);
확인('숙제로 푼 기록의 점수는 시험에 안 들어간다', r.시험.some(t => t.점수 === 80 || t.점수 === 90), false);
확인('자주 틀린 단어 — 두 번 이상', r.자주틀린, [{ 단어: 'apple', 번: 2 }]);
const 글 = JSON.stringify(r);
확인('다른 아이 이름이 한 글자도 없다', ['김영희', '이철수'].filter(n => 글.indexOf(n) > -1), []);
확인('등수 · 반 평균이 없다', ['등수', '평균', '순위'].filter(n => 글.indexOf(n) > -1), []);
확인('학부모마지막(10번째 칸)에 본 때가 적힌다', 시트들.학생.줄들[1][9] instanceof D, true);
확인('학원 이름 · 전화', r.학원, { 이름: '홍제인왕해법영어', 전화: '02-000-0000' });

console.log('\n— 틀린 토큰은 왜 틀렸는지 안 알려 준다 —');
const 없는 = 칸.학부모보기('f'.repeat(64)), 모양틀림 = 칸.학부모보기('홍길동'), 빈 = 칸.학부모보기('');
확인('없는 토큰 — 자료 없음', [없는.ok, Object.keys(없는).sort()], [false, ['ok', '메시지']]);
확인('없는 · 모양이 틀린 · 빈 토큰이 똑같은 답', [JSON.stringify(모양틀림), JSON.stringify(빈)], [JSON.stringify(없는), JSON.stringify(없는)]);

console.log('\n— 다시 발급하면 옛 링크는 그 자리에서 막힌다 (담아 둔 60초도 버린다) —');
확인('옛 토큰 답이 담겨 있다', 캐시.has('학부모|' + 토큰), true);
const 새발급 = 칸.학부모링크발급('1234', '홍길동');
const 새토큰 = 새발급.주소.split('#k=')[1];
확인('옛 토큰 — 바로 막힌다 · 없는 토큰과 같은 답', JSON.stringify(칸.학부모보기(토큰)), JSON.stringify(없는));
확인('새 토큰으로는 보인다', 칸.학부모보기(새토큰).이름, '홍길동');

console.log('\n— 토큰으로는 읽기만 —');
const 쓰기전 = 셈.쓰기;
칸.학부모보기(새토큰);                       // 담아 둔 답 — 시트에 안 쓴다
const 알림 = 칸.학부모보기(새토큰, true);
확인('알림 일꾼용은 이름과 안 낸 수만', Object.keys(알림).sort(), ['ok', '안낸수', '이름']);
확인('담아 둔 답이나 알림용은 시트에 안 쓴다', 셈.쓰기, 쓰기전);
확인('쓰는 기능에는 토큰이 안 통한다 (선생님 비번 자리에 토큰)', [칸.학부모한마디(새토큰, '홍길동', 'x').ok, 칸.숙제삭제(새토큰, 2).ok, 칸.학부모링크발급(새토큰, '홍길동').ok], [false, false, false]);

console.log('\n— 선생님 한마디 —');
확인('200자 넘으면 막는다', 칸.학부모한마디('1234', '홍길동', 'ㄱ'.repeat(201)).ok, false);
칸.학부모한마디('1234', '홍길동', '철자가 많이 좋아졌어요.');
확인('적으면 바로 보인다 (담아 둔 것을 버린다)', 칸.학부모보기(새토큰).한마디, '철자가 많이 좋아졌어요.');
칸.학부모한마디('1234', '홍길동', '');
확인('빈 글이면 지운다', 칸.학부모보기(새토큰).한마디, '');
확인('명단에 학부모 주소 · 본 때 · 한마디가 실린다 (선생님만)', (() => { const m = 칸.명단가져오기('1234').학생[0]; return [m.학부모주소 === 새발급.주소, !!m.학부모마지막, m.한마디]; })(), [true, true, '']);
확인('토큰이 없는 아이는 빈 주소', 칸.명단가져오기('1234').학생[1].학부모주소, '');

console.log('\n— 숙제 줄의 날짜 · 낸 시각 (프롬프트 11) —');
const 그때 = (일, 시, 분) => { const d = new D(Date.now() + 일 * 86400000); d.setHours(시, 분, 0, 0); return d; };
확인('시각은 어머님 말로 — 24시간 꼴이 아니다',
  [[23, 52], [1, 20], [9, 14], [14, 30], [19, 2], [21, 14], [12, 5], [0, 7]].map(([h, m]) => 칸.학부모시각글_(new D(2026, 9, 7, h, m)).split(' · ')[1]),
  ['밤 11:52', '새벽 1:20', '아침 9:14', '낮 2:30', '저녁 7:02', '밤 9:14', '낮 12:05', '새벽 12:07']);
let 숙 = 칸.학부모자료_('홍길동', null).이번주숙제[0];
확인('낸 숙제 — 기록에서 찾은 시각 · 날짜는 「M/d · 때 h:mm」', /^\d+\/\d+ · (새벽|아침|낮|저녁|밤) \d+:\d\d$/.test(숙.낸때글), true);
확인('마감 안에 냈으면 늦음이 아니다', 숙.늦음, false);
확인('날짜글은 마감일', 숙.날짜글, (전(-2).getMonth() + 1) + '/' + 전(-2).getDate());
/* 밤 11:52 에 다시 냈다 — 가장 최근 기록을 고른다 */
시트들.기록.줄들.push([그때(1, 23, 52), '', '홍길동', '예시 단어장', '1~10', '스펠링', 10, 10, 100, 0, 0, 60, 'O', '', '숙제', '']);
숙 = 칸.학부모자료_('홍길동', null).이번주숙제[0];
확인('가장 최근 기록 — 「밤 11:52」', 숙.낸때글, (그때(1, 0, 0).getMonth() + 1) + '/' + 그때(1, 0, 0).getDate() + ' · 밤 11:52');
/* 범위는 같고 유형이 다른 기록이 더 늦게 있어도 — 유형이 같은 것을 먼저 친다 */
시트들.기록.줄들.push([그때(1, 23, 58), '', '홍길동', '예시 단어장', '1~10', '첫 글자', 10, 10, 100, 0, 0, 60, 'O', '', '숙제', '']);
확인('유형까지 같은 기록을 먼저', 칸.학부모자료_('홍길동', null).이번주숙제[0].낸때글.split(' · ')[1], '밤 11:52');
시트들.기록.줄들.pop();
시트들.기록.줄들.pop();                    // 밤 11:52 줄도 치운다
/* 마감이 오늘인데 내일 새벽 1:20 에 냈다 — 늦게 냄 */
const 원래마감 = 시트들.숙제.줄들[1][5];
시트들.숙제.줄들[1][5] = 그때(0, 12, 0);
시트들.기록.줄들.push([그때(1, 1, 20), '', '홍길동', '예시 단어장', '1~10', '스펠링', 10, 10, 100, 0, 0, 60, 'O', '', '숙제', '']);
숙 = 칸.학부모자료_('홍길동', null).이번주숙제[0];
확인('마감을 넘겨 냈다 — 늦음 · 「새벽 1:20」', [숙.완료, 숙.늦음, 숙.낸때글.split(' · ')[1]], [true, true, '새벽 1:20']);
/* 김영희는 1~10 을 안 풀었다 — 날짜만, 낸때글은 빈 글 · 터지지 않는다 */
시트들.숙제.줄들[1][5] = 원래마감;
const 영희 = 칸.학부모자료_('김영희', null).이번주숙제;
확인('안 낸 숙제 — 낸때글 없이 날짜만', 영희.filter(h => !h.완료 && !h.다시).map(h => [h.낸때글, /^\d+\/\d+$/.test(h.날짜글)])[0], ['', true]);
확인('숙제 수에 시험은 여전히 안 섞인다', (() => { const r = 칸.학부모자료_('홍길동', null); return [r.이번주숙제.length, r.낸수 + r.안낸수]; })(), [1, 1]);
시트들.기록.줄들.pop();

/* ======================= 화면 ======================= */
(async () => {
  const b = await chromium.launch(띄우기설정);
  const errs = [];
  const 열기 = async (해시, 옵션) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 390, height: 844 } }, 옵션 || {}));
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push('ERR(학부모) ' + e.message));
    await p.goto(학부모주소 + 해시); await p.waitForTimeout(700);
    return p;
  };
  const 토 = c => c.repeat(64);

  console.log('\n— 학부모 화면 — 맞는 링크 —');
  let p = await 열기('#k=' + 토('a'));
  const 본문 = await p.locator('body').innerText();
  확인('아이 이름', (await p.locator('.top h1').innerText()).trim(), '홍길동');
  확인('이번 주 숙제가 보인다', [await p.locator('#pHw').isVisible(), await p.locator('#pHw .hw li').count()], [true, 4]);
  확인('안 낸 숙제가 맨 위에 눈에 띄게', [await p.locator('#app > *').nth(1).getAttribute('id'), await p.locator('#pAlert.warn').count(), /아직 안 낸 숙제가 2개/.test(본문)], ['pAlert', 1, true]);
  const 숙제칸 = await p.locator('#pHw').innerText();
  확인('숙제 칸 — 냈어요 · 다시 하고 있어요 · 오늘까지', [/냈어요/.test(숙제칸), /다시 하고 있어요/.test(숙제칸), /오늘까지/.test(숙제칸)], [true, true, true]);
  확인('「2/4 냈어요」 — 숙제만 센다', /2\/4 냈어요/.test(숙제칸), true);
  const 시험칸 = await p.locator('#pTest').innerText();
  확인('시험 칸 — 볼 시험은 「볼 예정」', [/92점/.test(시험칸), /볼 예정/.test(시험칸)], [true, true]);
  확인('시험 칸 제목은 「시험」', (await p.locator('#pTest h2').innerText()).trim(), '시험');
  /* 프롬프트 10 — 숙제 줄에 점수를 되살린다 (숙제 수에 시험을 섞지 않는 것은 그대로) */
  const 줄글 = async 제목 => (await p.locator('#pHw .hw li', { hasText: 제목 }).locator('.r').innerText()).replace(/\s+/g, ' ').trim();
  확인('다 낸 숙제 줄에 점수가 나온다', await 줄글('단어 41~60'), '92점');
  확인('점수가 없는 옛 숙제 줄에는 「냈어요」', await 줄글('본문 1~12'), '냈어요');
  확인('합격점을 못 넘긴 줄 — 「68점 · 다시 하고 있어요」', await 줄글('본문 13~20'), '68점 · 다시 하고 있어요');
  확인('못 넘긴 줄은 빨갛지 않다', await p.locator('#pHw .hw li', { hasText: '본문 13~20' }).locator('.r').evaluate(e => getComputedStyle(e).color) !== 'rgb(217, 72, 15)', true);
  확인('안 낸 줄에는 점수가 아니라 마감 글', await 줄글('문법 1~5'), '오늘까지');
  확인('숫자는 크게 · 「점」 은 작게', await p.locator('#pHw .hw li', { hasText: '단어 41~60' }).evaluate(li => { const r = li.querySelector('.r'), em = r.querySelector('em'); return !!em && parseFloat(getComputedStyle(em).fontSize) < parseFloat(getComputedStyle(r).fontSize); }), true);
  확인('「2/4 냈어요」 — 여전히 시험이 안 섞인다', /2\/4 냈어요/.test(await p.locator('#pHw h2').innerText()), true);
  확인('시험 칸 — 전처럼 점수 · 꺾은선', [/92점/.test(시험칸), /85점/.test(시험칸), await p.locator('#pTest svg.chart polyline').count()], [true, true, 1]);
  /* 프롬프트 11 — 둘째 줄: 언제 것인지 · 언제 냈는지 */
  const 둘째 = async 제목 => { const s = p.locator('#pHw .hw li', { hasText: 제목 }).locator('.sub'); return (await s.count()) ? (await s.innerText()).replace(/\s+/g, ' ').trim() : null; };
  확인('낸 숙제 줄 — 「10/7 · 밤 11:52 냈어요 (늦게 냄)」', await 둘째('단어 41~60'), '10/7 · 밤 11:52 냈어요(늦게 냄)');
  확인('안 낸 숙제 줄 — 「10/7 마감」', await 둘째('문법 1~5'), '10/7 마감');
  확인('다시 하는 줄 — 마지막으로 푼 때 「새벽 1:20」', await 둘째('본문 13~20'), '10/7 · 새벽 1:20 풀었어요');
  확인('기록을 못 찾은 옛 숙제 — 시각 없이 날짜만', await 둘째('본문 1~12'), '10/8 마감');
  확인('늦게 냈어도 빨갛지 않다', await p.locator('#pHw .sub small').evaluate(e => getComputedStyle(e).color) !== 'rgb(217, 72, 15)', true);
  확인('24시간 꼴이 없다', /\b(1[3-9]|2[0-3]):\d\d\b/.test(await p.locator('#pHw').innerText()), false);
  확인('두 줄이 넘치지 않는다 — 둘째 줄이 「…」 로 잘리지 않는다', await p.locator('#pHw .hw li').evaluateAll(ls => ls.every(li => li.scrollWidth <= li.clientWidth + 1 && [...li.querySelectorAll('.sub')].every(s => s.scrollWidth <= s.clientWidth + 1))), true);
  확인('시험 칸에는 둘째 줄을 안 붙인다', await p.locator('#pTest .sub').count(), 0);
  확인('안 낸 숙제 줄이 위로 · 표시가 다르다', await p.locator('#pHw .hw li').first().getAttribute('class'), 'todo');
  확인('점수 흐름은 SVG 로', await p.locator('#pTest svg.chart polyline').count(), 1);
  확인('다른 아이 이름 · 등수 · 반 평균이 없다', ['김영희', '이철수', '등수', '평균', '순위'].filter(w => 본문.indexOf(w) > -1), []);
  확인('가로로 넘치지 않는다 (390)', await p.evaluate(() => document.documentElement.scrollWidth <= 390), true);
  확인('맨 아래 학원 이름 · 문자 주세요', /홍제인왕해법영어[\s\S]*궁금한 점은 문자 주세요/.test(본문), true);

  console.log('\n— 한마디도 시험 기록도 없는 아이 · 숙제는 다 냈다 —');
  p = await 열기('#k=' + 토('b'));
  확인('한마디 칸 · 시험 칸 · 단어 칸 · 진도 칸이 아예 없다', await p.locator('#pSay, #pTest, #pWrong, #pProg').count(), 0);
  확인('칭찬 글', [await p.locator('#pAlert.good').count(), /이번 주 숙제를 다 냈어요/.test(await p.locator('body').innerText())], [1, true]);

  console.log('\n— 틀린 링크 —');
  p = await 열기('#k=' + 토('c'));
  const 틀린글 = (await p.locator('#app').innerText()).trim();
  확인('아무 자료도 안 나온다', [await p.locator('#pHw, .top, #pTest').count(), /링크가 맞지 않습니다/.test(틀린글)], [0, true]);
  const p2 = await 열기('#k=' + 토('d'));
  확인('다른 틀린 링크와 글자 하나 다르지 않다 (있는지 없는지 못 가린다)', (await p2.locator('#app').innerText()).trim(), 틀린글);
  확인('안내 띠 · 알림 단추도 안 나온다', [await p.locator('#band').isVisible(), await p.locator('#pPushBtn').count()], [false, 0]);

  console.log('\n— 토큰이 아예 없으면 —');
  p = await 열기('');
  확인('안내만 · 터지지 않는다', [/받은 링크를 눌러/.test(await p.locator('#app').innerText()), await p.locator('#pHw').count()], [true, 0]);
  p = await 열기('?k=' + 토('a'));
  확인('물음표 뒤 토큰은 읽지 않는다', await p.locator('#pHw').count(), 0);

  /* ---------- 선생님 — 명단의 [학부모] ---------- */
  console.log('\n— 선생님 명단 — 학부모 링크 · 한마디 · 문자 —');
  const tctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const t = await tctx.newPage();
  t.on('pageerror', e => errs.push('ERR(선생님) ' + e.message));
  t.on('dialog', d => d.accept());
  await t.goto(앱주소); await t.waitForTimeout(400);
  await t.evaluate(() => { window.__복사 = []; });
  await t.click('#btnTeacherGo'); await t.fill('#tPw', '1234'); await t.click('#btnTLogin');
  await t.waitForTimeout(1300);
  await t.evaluate(() => { 글복사_ = function (g) { window.__복사.push(g); return Promise.resolve(); }; });
  await t.evaluate(() => { var b = document.querySelector('[data-tab="roster"]'); var g = b && document.querySelector('.tgrp[data-grp="' + b.dataset.g + '"]'); if (g) g.click(); });
  await t.waitForTimeout(250); await t.click('[data-tab="roster"]'); await t.waitForTimeout(1200);
  확인('아직 링크가 없으면 「링크 없음」', /링크 없음/.test(await t.locator('tr:has([data-pv="홍길동"])').innerText()), true);
  await t.click('[data-pv="홍길동"]'); await t.waitForTimeout(400);
  await t.click('.pvbox [data-pvnew]'); await t.waitForTimeout(600);
  const 첫주소 = await t.inputValue('.pvbox .pvurl');
  확인('그 자리에서 발급 — #k= 주소', /\/parent\.html#k=[0-9a-f]{64}$/.test(첫주소), true);
  await t.click('.pvbox [data-pvcopy]'); await t.waitForTimeout(200);
  확인('[복사] — 그 주소', await t.evaluate(() => window.__복사[window.__복사.length - 1]), 첫주소);
  await t.click('.pvbox [data-pvnew]'); await t.waitForTimeout(600);
  확인('[다시 발급] — 묻고 새 주소로', [await t.inputValue('.pvbox .pvurl') !== 첫주소, /^https/.test(await t.inputValue('.pvbox .pvurl'))], [true, true]);
  await t.fill('.pvbox .pvsay', '철자가 많이 좋아졌어요.');
  await t.click('.pvbox [data-pvsay]'); await t.waitForTimeout(500);
  확인('한마디 저장', await t.evaluate(() => DEMO_배정.filter(x => x.이름 === '홍길동')[0].한마디), '철자가 많이 좋아졌어요.');
  await t.click('.pvbox [data-pvsms]'); await t.waitForTimeout(300);
  const 안내 = await t.evaluate(() => window.__복사[window.__복사.length - 1]);
  확인('안내 문자 — 이름 · 링크 · 설치 없음 · 다른 브라우저로 열기',
    [/^홍길동 어머님, /.test(안내), 안내.indexOf(await t.inputValue('.pvbox .pvurl')) > -1, /따로 설치하실 것은 없습니다/.test(안내), /다른 브라우저로 열기/.test(안내)], [true, true, true, true]);
  await t.click('.pvbox [data-pvweek]'); await t.waitForTimeout(500);
  const 요약 = await t.evaluate(() => window.__복사[window.__복사.length - 1]);
  console.log('  ' + 요약.replace(/\n/g, ' / '));
  확인('이번 주 요약 문자 — 그 아이 숙제와 점수 · 다른 아이 이름 없음',
    [/홍길동 이번 주 학습/.test(요약), /숙제 \d+개 중 \d+개 냈어요/.test(요약), ['김영희', '이철수'].filter(n => 요약.indexOf(n) > -1).length], [true, true, 0]);
  확인('요약 문자 — 낸 숙제 줄에 점수 (「… 90점」)', /✓ [^/\n]+ \d+점/.test(요약), true);
  확인('마지막으로 본 때 칸', /아직 안 보심|봄/.test(await t.locator('tr:has([data-pv="홍길동"])').innerText()), true);

  console.log('\n' + (errs.length ? errs.join('\n') : 'NO JS ERRORS'));
  await b.close();
  console.log(실패 || errs.length ? '\n✗ ' + (실패 + errs.length) + '개 실패' : '\n전부 통과');
  process.exit(실패 || errs.length ? 1 : 0);
})();
