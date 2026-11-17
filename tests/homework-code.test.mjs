import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 프롬프트 49 — 숙제마다 코드를 줘서 그 숙제만 풀리게.
   완료 판정이 이름·단어장·범위로만 묶여, 같은 범위를 시험으로 보면 숙제도 낸 것이 되고
   같은 숙제를 두 번 내주면 한 번만 풀어도 둘 다 완료됐다. 엔진(Code.gs)을 TableStore 위에서 진짜로 돌린다 */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = read('./fixtures/legacy/Code.gs'), index = read('../index.html'), teacher = read('../teacher.html');
const 일반 = x => JSON.parse(JSON.stringify(x));
const 비번 = '5678';

function 엔진() {
  let 지금 = Date.parse('2026-11-16T03:00:00Z');     // 서울 11/16 낮 12시
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', 비번]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);
  for (const n of ['홍길동', '김영희']) 학생.appendRow(['', n, '1234', '', '', '중2', '', '', '', '', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'];
  const 기록 = store.insertSheet('기록'); 기록.appendRow(머리기록);
  store.insertSheet('기록보관').appendRow(머리기록);
  const 숙제 = store.insertSheet('숙제');
  숙제.appendRow(['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류']);   // 예전 표 — 9칸
  const 엔 = createRuntime(store, { now: () => 지금 });
  const call = (fn, ...args) => 일반(엔.call(fn, args));
  return {
    store, 기록, 숙제, call,
    지나기: 분 => { 지금 += 분 * 60000; },
    /* 숙제 하나 내기 — 기본은 기한 숙제, 두 아이에게 */
    내기: (h = {}) => {
      const r = call('숙제등록', 비번, { 단어장: '교재A', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '기한', 마감일: '2026-11-20',
        학생들: ['홍길동', '김영희'], 바뀐줄만: true, ...h });
      assert.equal(r.ok, true, JSON.stringify(r));
      return r.숙제;
    },
    코드들: () => 숙제.getRange(2, 20, 숙제.getLastRow() - 1, 1).getValues().map(x => x[0]),
    아이숙제: (이름 = '홍길동') => call('숙제가져오기', 이름),
    /* 선생님 쪽 숙제 목록 (전체숙제) — 아무것도 안 고치는 숙제수정이 통째로 돌려준다 */
    선생님숙제: () => call('숙제수정', 비번, 2, {}).숙제목록,
    내다: (p = {}) => {
      const r = call('결과저장', { 이름: '홍길동', 단어장: '교재A', 범위: '1~10', 유형: '스펠링', 문항수: 10, 정답수: 9, 점수: 90,
        게임점수: 0, 최고콤보: 0, 소요초: 100, 숙제여부: true, 구분: '숙제', 틀린단어: '', ...p });
      assert.equal(r.ok, true, JSON.stringify(r));
      return r;
    },
  };
}
const 끝줄 = sh => sh.getRange(sh.getLastRow(), 1, 1, sh.getMaxColumns()).getValues()[0];

test('1. 숙제를 내면 코드가 생기고, 같은 것을 두 번 내도 서로 다른 코드다 (같은 밀리초여도)', () => {
  const e = 엔진();
  e.내기(); e.내기();                       // 시계를 안 움직였다 — 등록시각이 똑같다
  const [a, b] = e.코드들();
  assert.match(a, /^h\d{13}[a-z0-9]{4}$/);
  assert.match(b, /^h\d{13}[a-z0-9]{4}$/);
  assert.notEqual(a, b);
  assert.equal(e.숙제.getRange(1, 20).getValue(), '숙제코드', '머리글을 붙였다 (9칸 → 20칸)');
  const 아이 = e.아이숙제();
  assert.deepEqual(아이.map(h => h.코드).sort(), [a, b].sort(), '아이에게 코드를 내려보낸다');
  for (const h of e.선생님숙제()) assert.equal(h.코드, undefined, '선생님 목록에는 코드를 안 싣는다');
});

test('2. 숙제를 고쳐도 코드는 그대로다 — 시간 · 단어장 · 범위 · 종류를 고쳐도', () => {
  const e = 엔진();
  e.내기();
  const [전] = e.코드들();
  assert.equal(e.call('숙제수정', 비번, 2, { 제한시간: 15, 외우기분: 3, 문항수: 5, 바뀐줄만: true }).ok, true);
  assert.equal(e.call('숙제수정', 비번, 2, { 단어장: '교재B', 시작: 11, 끝: 20, 유형: '4지선다', 종류: '시험', 마감일: '2026-11-21', 바뀐줄만: true }).ok, true);
  assert.deepEqual(e.코드들(), [전]);
  assert.equal(e.숙제.getRange(2, 2).getValue(), '교재B', '고친 것은 고쳐졌다');
});

test('3. 같은 단어장 · 범위 숙제가 둘 — 하나를 풀면 그 하나만 완료된다', () => {
  const e = 엔진();
  e.내기(); e.지나기(1); e.내기();
  const [가, 나] = e.아이숙제();
  e.내다({ 숙제코드: 가.코드 });
  assert.equal(끝줄(e.기록)[19], 가.코드, '기록 T열에 코드를 적었다');
  const 뒤 = e.아이숙제();
  assert.equal(뒤.find(h => h.코드 === 가.코드).완료, true);
  assert.equal(뒤.find(h => h.코드 === 나.코드).완료, false);
  assert.deepEqual(e.아이숙제('김영희').map(h => h.완료), [false, false], '다른 아이는 그대로');
  /* 선생님 쪽(전체숙제 → 숙제줄_)도 같은 열쇠 */
  const [줄1, 줄2] = e.선생님숙제();
  assert.deepEqual(줄1.한사람, ['홍길동']);
  assert.deepEqual(줄2.한사람, []);
  /* 남은 하나를 풀면 둘 다 */
  e.내다({ 숙제코드: 나.코드 });
  assert.deepEqual(e.아이숙제().map(h => h.완료), [true, true]);
});

test('3-2. 시상 제출률(제출현황_)도 같은 열쇠 — 둘 중 하나만 냈으면 낸수 1', () => {
  const e = 엔진();
  e.내기(); e.내기();
  const [가] = e.아이숙제();
  e.내다({ 숙제코드: 가.코드 });
  const 줄 = e.call('시상집계', 비번, '2026-11').줄.find(r => r.이름 === '홍길동');
  assert.equal(줄.숙제수, 2);
  assert.equal(줄.낸수, 1);
});

test('4. 시험으로 낸 기록이 숙제(당일 · 기한) 숙제를 완료시키지 않는다', () => {
  const e = 엔진();
  e.내기();
  e.내기({ 종류: '당일' });
  e.내다({ 구분: '시험' });                 // 코드 없이 — 같은 범위를 학원 시험으로 봤다
  assert.deepEqual(e.아이숙제().map(h => [h.종류, h.완료]).sort(), [['기한', false], ['당일', false]]);
});

test('5. 숙제로 낸 기록이 시험 숙제를 완료시키지 않는다 — 시험으로 본 것만', () => {
  const e = 엔진();
  e.내기({ 종류: '시험', 마감일: '2026-11-16' });
  e.내다({ 구분: '숙제' });
  assert.equal(e.아이숙제()[0].완료, false);
  e.내다({ 구분: '시험', 범위: '1~10' });
  assert.equal(e.아이숙제()[0].완료, true);
});

test('6. 보충은 보충끼리만', () => {
  const e = 엔진();
  e.내기({ 종류: '보충' });
  e.내기({ 종류: '기한' });
  e.내다({ 구분: '숙제' });
  let 지금 = Object.fromEntries(e.아이숙제().map(h => [h.종류, h.완료]));
  assert.deepEqual(지금, { 보충: false, 기한: true });

  const f = 엔진();
  f.내기({ 종류: '보충' });
  f.내기({ 종류: '기한' });
  f.내다({ 구분: '보충' });
  지금 = Object.fromEntries(f.아이숙제().map(h => [h.종류, h.완료]));
  assert.deepEqual(지금, { 보충: true, 기한: false });
});

test('7. 코드 없는 옛 기록은 옛 방식으로 떨어진다 — 구분만 맞으면 (같은 숙제 둘이면 둘 다)', () => {
  const e = 엔진();
  e.내기(); e.내기();
  e.내다({});                               // 아직 안 바뀐 아이 앱 — 숙제코드를 안 보낸다
  assert.equal(끝줄(e.기록)[19], '', '코드 칸은 빈 칸');
  assert.deepEqual(e.아이숙제().map(h => h.완료), [true, true]);
  /* 코드가 붙은 기록은 옛 열쇠로 새지 않는다 — 다른 숙제를 채우지 않는다 */
  const f = 엔진();
  f.내기(); f.내기();
  const [가] = f.아이숙제();
  f.내다({ 숙제코드: 가.코드 });
  assert.equal(f.아이숙제().filter(h => h.완료).length, 1);
});

test('8. 코드 없는 옛 기록 중 구분이 빈 것은 숙제로 친다', () => {
  const e = 엔진();
  e.내기();
  e.내기({ 종류: '시험', 마감일: '2026-11-16' });
  e.내다({ 구분: '' });
  assert.deepEqual(Object.fromEntries(e.아이숙제().map(h => [h.종류, h.완료])), { 기한: true, 시험: false });
});

test('9. 오답 재시험은 어느 쪽도 완료시키지 않는다 — 코드가 섞여 와도 적지 않는다', () => {
  const e = 엔진();
  e.내기();
  e.내기({ 종류: '보충' });
  e.내기({ 종류: '시험', 마감일: '2026-11-16' });
  const 코드 = e.아이숙제()[0].코드;
  e.내다({ 구분: '오답 재시험', 숙제여부: false, 점수: 100, 숙제코드: 코드 });
  assert.equal(끝줄(e.기록)[19], '', '재시험 줄에는 코드를 안 적는다');
  e.내다({ 구분: '오답 재시험', 숙제여부: false, 점수: 100 });
  assert.deepEqual(e.아이숙제().map(h => h.완료), [false, false, false]);
});

test('10. 무른(무효) 기록도 완료시키지 않는다', () => {
  const e = 엔진();
  e.내기();
  const [가] = e.아이숙제();
  e.내다({ 숙제코드: 가.코드 });
  assert.equal(e.아이숙제()[0].완료, true);
  const 키 = e.call('선생님기록', 비번, 7).시험목록[0].키;
  assert.equal(e.call('기록무르기', 비번, [키], true).ok, true);
  assert.equal(e.아이숙제()[0].완료, false, '코드가 있어도 무른 기록은 안 친다');
  e.내다({ 구분: '숙제(무효)' });           // 코드 없는 옛 무효 기록
  assert.equal(e.아이숙제()[0].완료, false);
});

test('11. 한 숙제를 여러 번 풀면 그중 제일 높은 점수가 잡힌다', () => {
  const e = 엔진();
  e.내기(); e.내기();
  const [가, 나] = e.아이숙제();
  for (const 점수 of [70, 95, 85]) { e.지나기(5); e.내다({ 숙제코드: 가.코드, 점수 }); }
  e.내다({ 숙제코드: 나.코드, 점수: 60 });
  const 뒤 = e.아이숙제();
  assert.equal(뒤.find(h => h.코드 === 가.코드).점수, 95);
  const 둘째 = 뒤.find(h => h.코드 === 나.코드);
  assert.equal(둘째.점수, 60, '다른 숙제의 점수가 섞이지 않는다');
  assert.equal(둘째.완료, false);
  assert.equal(둘째.모자람, true);
});

test('12. 기록 표 — 학생 저장은 머리글을 안 쓰고, 선생님 쪽 길(기록제외설정)이 T열 머리글을 붙인다', () => {
  const e = 엔진();
  e.내기();
  e.내다({ 숙제코드: e.아이숙제()[0].코드 });
  assert.equal(e.기록.getRange(1, 20).getValue(), '', '덧붙임만 — 머리글은 그대로');
  const 키 = e.call('선생님기록', 비번, 7).시험목록[0].키;
  e.call('기록제외설정', 비번, [키], true);
  assert.equal(e.기록.getRange(1, 20).getValue(), '숙제코드');
  assert.match(code, /'이탈수', '이탈초', '복사시도', '숙제코드'\],\n\s+점수:/, '기록보관 머리글에도');
});

test('엔진 — 열쇠는 완료열쇠_ 하나가 만든다 (두 벌로 갈라지지 않게)', () => {
  const 몸 = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.equal((몸.match(/function 완료열쇠_\(/g) || []).length, 1);
  /* 완료 장부를 손으로 「단어장 + '|' + 범위」 로 묶는 자리가 남아 있지 않다 */
  assert.doesNotMatch(몸.replace(함수떼기(code, '완료열쇠_'), ''), /단어장 \+ '\|' \+ (범|이름들\[i\]|r\.범위)/);
  for (const f of ['완료점수들_', '달성적_', '기록찾기_']) assert.match(함수떼기(code, f), /완료열쇠_\(/, f);
  assert.match(함수떼기(code, '제출현황_'), /기록찾기_\(낸것, '', h\.단어장, h\.시작, h\.끝, h\.칸, h\.종류, h\.코드\)/);
  /* 부르는 자리는 다 종류 · 코드를 넘긴다 */
  const 부름 = 몸.match(/기록찾기_\(.*\);/g).filter(x => !x.startsWith('기록찾기_(맵'));
  assert.equal(부름.length, 4);
  for (const x of 부름) assert.match(x, /종류, (코드|코드칸_\(x\)|h\.코드)\);$/, x);
});

test('아이 화면 — 결과저장 세 자리가 숙제코드를 싣는다 · 재시험 · 혼자 연습은 빈 값', () => {
  assert.equal((index.match(/구분: 기록구분\(\), 숙제코드: 기록숙제코드\(\),/g) || []).length, 3);
  assert.equal((index.match(/구분: 기록구분\(\),(?! 숙제코드)/g) || []).length, 0);
  const f = 함수떼기(index, '기록숙제코드');
  const run = S => new Function('S', f + '\nreturn 기록숙제코드();')(S);
  assert.equal(run({ 재시험: false, 현재숙제: { 코드: 'h1abc' } }), 'h1abc');
  assert.equal(run({ 재시험: true, 현재숙제: { 코드: 'h1abc' } }), '');
  assert.equal(run({ 재시험: false, 현재숙제: null }), '');
  assert.equal(run({ 재시험: false, 현재숙제: { 단어장: '옛 숙제' } }), '');
});

test('선생님 화면 — 같은 숙제가 같은 아이에게 두 번이면 묶지 않고 차례 · 시각으로 가른다 · 코드는 안 보인다', () => {
  const esc = s => String(s);
  const 묶기 = new Function('esc', 함수떼기(teacher, '숙제묶기') + '\n' + 함수떼기(teacher, '같은숙제칩_') + '\nreturn { 숙제묶기, 같은숙제칩_ };')(esc);
  const 줄 = (행, 낸때, 한, 안, 학생 = '') => ({ 행, 낸때, 단어장: '교재A', 칸: '', 시작: 1, 끝: 10, 유형: '스펠링', 종류: '기한', 마감일: '2026-11-20',
    학생, 한사람: 한, 안한사람: 안, 대상수: 한.length + 안.length });
  /* 같은 아이들에게 두 번 → 두 줄 */
  const 두번 = 묶기.숙제묶기([줄(2, Date.parse('2026-11-16T05:05:00Z'), ['홍길동'], ['김영희']), 줄(3, Date.parse('2026-11-16T05:07:00Z'), [], ['홍길동', '김영희'])]);
  assert.equal(두번.length, 2);
  assert.ok(두번[0].같은숙제글.startsWith('1번 · 11/16'), 두번[0].같은숙제글);
  assert.ok(두번[1].같은숙제글.startsWith('2번 · 11/16'));
  assert.match(묶기.같은숙제칩_(두번[1]), /2번/);
  /* 학생을 나눠 낸 같은 숙제(받는 아이가 안 겹친다) → 예전처럼 한 줄로 묶고 칩은 없다 */
  const 나눠 = 묶기.숙제묶기([줄(2, 1, ['홍길동'], [], '홍길동'), 줄(3, 2, [], ['김영희'], '김영희')]);
  assert.equal(나눠.length, 1);
  assert.equal(나눠[0].줄들.length, 2);
  assert.equal(묶기.같은숙제칩_(나눠[0]), '');
  assert.doesNotMatch(teacher, /숙제코드|\.코드(?![가-힣])/, '선생님 화면은 코드를 글자로 쓰지 않는다');
});

function 함수떼기(src, name) {
  const at = src.indexOf(`\nfunction ${name}(`);
  assert.ok(at >= 0, name);
  let i = src.indexOf('{', at), 깊이 = 0;
  for (; i < src.length; i++) { if (src[i] === '{') 깊이++; else if (src[i] === '}' && --깊이 === 0) return src.slice(at + 1, i + 1); }
  throw new Error(name);
}
