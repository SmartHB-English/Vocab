import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* 시험 시계 — index.html 의 진짜 함수들을 떼어 와 가짜 시계(Date.now · setInterval)로 돌린다.
   화면(DOM)·채점·저장은 흉내로 바꾸고, 무엇이 불렸는지만 본다. */
const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/* `function 이름(` 부터 짝이 맞는 `}` 까지 — 글자열·주석 안의 괄호는 센다에서 뺀다 */
function 함수떼기(name) {
  const at = source.indexOf(`\nfunction ${name}(`);
  if (at < 0) return '';
  let i = source.indexOf('{', at), 깊이 = 0;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === '/' && source[i + 1] === '*') { i = source.indexOf('*/', i + 2) + 1; continue; }
    if (c === '/' && source[i + 1] === '/') { i = source.indexOf('\n', i); continue; }
    if (c === "'" || c === '"' || c === '`') {
      for (i++; source[i] !== c; i++) if (source[i] === '\\') i++;
      continue;
    }
    if (c === '{') 깊이++;
    else if (c === '}' && --깊이 === 0) return source.slice(at + 1, i + 1);
  }
  throw new Error(`짝이 안 맞는다: ${name}`);
}

const 쓸함수 = [
  '제한분_', '제한열쇠_', '제한시작때_', '제한시작적기_', '제한지났나_', '제한물어야_', '숙제제한_',
  '제한멈춤_', '제한시작_', '외우기분_', '시험분_', '시험중_', '시험단계로_', '시험판치우기_',
  'startSheet', 'startVerb', '시간끝_3단_', '시간끝_시험지_', '시험못보고나가기_', '한번뿐시험_', '안푼채시간끝_', '시험인가_', '숙제종류_', 's_', '숙제문항수_',
  '숙제표시뿌리_', '외우기끝열쇠_',   // 열쇠의 뿌리를 함수로 뽑았다 — 시험단계로_ 가 외우기끝 표시를 적는다
];

const 처음 = Date.parse('2026-10-12T01:00:00Z');
const 분 = 60000;

function 판(초기 = {}) {
  const 기록 = { toast: [], show: [], 채점: 0, 끝3단: 0, 결과저장: 0 };
  const 저장 = new Map();
  const 시계들 = new Map();
  let 지금 = 처음, 번호 = 0;
  const 칸 = {};
  const el = id => (칸[id] ||= {
    id, value: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  });
  const ctx = {
    S: { 학생: { 이름: '홍길동' }, 답: [], 재시험: false, ...초기.S },
    제한: { 시계: null, 끝날때: 0, 어디: '', 예고함: false },
    시험판: null,
    Date: { now: () => 지금 },
    setInterval: f => { 시계들.set(++번호, f); return 번호; },
    clearInterval: n => 시계들.delete(n),
    setTimeout: () => 0,
    window: { scrollTo() {} },
    document: { body: { classList: { add() {}, remove() {}, toggle() {} } }, getElementById: el },
    $: el,
    toast: m => 기록.toast.push(m),
    show: s => 기록.show.push(s),
    beep() {}, stopTimer() {}, 보기만들기() {}, 본문준비_() {}, drawSheet() {}, 제한그리기_() {},
    renderVerb() {}, judgeVerb() {}, shuffle: a => a.slice(), 문항뽑기_: a => a.slice(),
    제한묻기_: (분수, 시작함) => 시작함(),      // 「시작」 을 바로 누른다
    저장읽기_: (k, 기본) => (저장.has(k) ? 저장.get(k) : 기본),
    저장쓰기_: (k, v) => 저장.set(k, v),
    채점하기: () => { 기록.채점++; 기록.결과저장++; },        // 진짜는 채점 → finishQuiz → 결과저장
    finishVerb: () => { 기록.끝3단++; 기록.결과저장++; },
    세형태: en => { const [원형, 과거, 분사] = en.split(' - '); return { 원형, 과거, 분사 }; },
    V_ID: ['vBase', 'vPast', 'vPp'], V_이름: ['원형', '과거형', '과거분사형'],
    단어들: [{ en: 'go - went - gone', ko: '가다' }, { en: 'eat - ate - eaten', ko: '먹다' }, { en: 'see - saw - seen', ko: '보다' }],
  };
  ctx.범위단어 = () => ({ list: ctx.단어들, a: 1, b: 3 });
  ctx.기록범위 = () => '1~3';
  ctx.startQuiz = m => ctx.startSheet(m, ctx.단어들, '1~3');
  vm.createContext(ctx);
  vm.runInContext(쓸함수.map(함수떼기).join('\n'), ctx);
  return {
    ctx, 기록, 저장,
    흘러가기(ms) {                          // 1초씩 박자를 친다
      for (let t = 0; t < ms; t += 1000) { 지금 += 1000; [...시계들.values()].forEach(f => f()); }
    },
    지금: () => 지금,
    돌아가는시계: () => 시계들.size,
  };
}

const 시험 = (더 = {}) => ({ 단어장: '교재A', 시작: 1, 끝: 3, 유형: '스펠링', 종류: '시험', 낸때: 'T1', 제한시간: 5, 외우기분: 5, ...더 });

/* 시험 탭에서 「시작」 — 시험열기_ 가 하는 대로 외우기 시계를 건다 */
function 시험열기(p, h, 방법 = 'spell') {
  const c = p.ctx;
  c.S.현재숙제 = h; c.S.돌아갈곳 = 'exam';
  c.시험판 = { 방법, 단계: '외우기' };
  if (!c.외우기분_(h)) { c.시험단계로_(); return; }
  c.제한시작_('wbClock', c.시험단계로_, c.외우기분_(h));
}

test('1) 외우기 5분 뒤 시험이 시작되면 시험 시계는 제한시간 전부가 남아 있다', () => {
  const p = 판(), h = 시험();
  p.ctx.제한시작적기_(h);                     // 옛 길 — 「시작」 을 누른 때가 숙제 열쇠에 적혀 있어도
  시험열기(p, h);
  p.흘러가기(5 * 분);                          // 외우기 5분이 다 돼 저절로 시험으로
  assert.equal(p.ctx.시험판.단계, '시험');
  assert.equal(p.ctx.제한.어디, 'shClock');
  assert.equal(p.ctx.제한.끝날때 - p.지금(), 5 * 분);   // 깎이지 않았다
  assert.equal(p.기록.채점, 0);
  p.흘러가기(4 * 분);
  assert.equal(p.기록.채점, 0, '4분 뒤에도 아직 시험 중');
});

test('1) 외우기와 시험은 열쇠가 다르다 — 시험 열쇠에 시험이 뜬 때가 적힌다', () => {
  const p = 판(), h = 시험();
  시험열기(p, h);
  p.흘러가기(5 * 분);
  assert.notEqual(p.ctx.제한열쇠_(h, '시험'), p.ctx.제한열쇠_(h));
  assert.equal(p.ctx.제한시작때_(h, '시험'), p.지금());
  assert.equal(p.ctx.제한시작때_(h), 0, '외우기는 기기에 적지 않는다 (wbClock 은 따로 돈다)');
});

test('1) 3단변화 시험도 외우기 시간을 깎지 않는다', () => {
  const p = 판(), h = 시험({ 유형: '3단변화' });
  p.ctx.제한시작적기_(h);
  시험열기(p, h, 'verb');
  p.흘러가기(5 * 분);
  assert.equal(p.ctx.제한.어디, 'vClock');
  assert.equal(p.ctx.제한.끝날때 - p.지금(), 5 * 분);
});

test('6) 숙제(시험 아님)는 그대로 — 「시작」 을 누른 때부터, 껐다 켜도 이어서 센다', () => {
  const p = 판(), h = { 단어장: '교재A', 시작: 1, 끝: 3, 유형: '스펠링', 종류: '당일', 낸때: 'H1', 제한시간: 10 };
  let 들어감 = 0;
  assert.equal(p.ctx.제한물어야_(h, () => 들어감++), true);
  assert.equal(들어감, 1);
  assert.deepEqual([...p.저장.keys()], ['제한시작_홍길동|H1']);   // 열쇠 이름도 예전 그대로
  const 시작 = p.지금();
  p.흘러가기(3 * 분);                                               // 3분 뒤에 연다
  p.ctx.S.현재숙제 = h;
  p.ctx.startQuiz('spell');
  assert.equal(p.ctx.제한.끝날때, 시작 + 10 * 분);                  // 남은 7분
  assert.equal(p.ctx.S.시작시각, 시작);
  p.ctx.제한멈춤_();
  p.흘러가기(8 * 분);
  assert.equal(p.ctx.제한물어야_(h, () => 들어감++), true);         // 시간이 지나면 막는다
  assert.equal(들어감, 1);
  assert.match(p.기록.toast.at(-1), /시간이 지나서 이 숙제는 더 들어갈 수 없어요/);
});

test('2) 저장된 시작 시각이 이미 지난 채로 시험에 들어가면 채점·제출하지 않고 막는 글만 띄운다', () => {
  const p = 판(), h = 시험({ 외우기분: 0 });
  p.ctx.제한시작적기_(h, '시험');               // 전에 시험을 띄웠다가 나갔다
  p.흘러가기(10 * 분);                          // 제한 5분이 한참 지나 다시 들어온다
  시험열기(p, h);
  p.흘러가기(5000);
  assert.equal(p.기록.채점, 0);
  assert.equal(p.기록.결과저장, 0);
  assert.equal(p.돌아가는시계(), 0, '시계를 걸지 않았다');
  assert.match(p.기록.toast.at(-1), /시간이 지났어요 — 선생님께 말씀드리세요/);
  assert.equal(p.기록.show.at(-1), 'exam');     // 시험 목록으로
  assert.equal(p.ctx.시험판, null);
});

test('2) 3단변화도 지난 시계로는 내지 않는다', () => {
  const p = 판(), h = 시험({ 외우기분: 0, 유형: '3단변화' });
  p.ctx.제한시작적기_(h, '시험');
  p.흘러가기(6 * 분);
  시험열기(p, h, 'verb');
  p.흘러가기(5000);
  assert.equal(p.기록.끝3단, 0);
  assert.equal(p.기록.결과저장, 0);
  assert.match(p.기록.toast.at(-1), /선생님께 말씀드리세요/);
});

test('2) 시험을 보다 나갔다가 시간 안에 돌아오면 남은 시간만 이어서 — 새로 받지 않는다', () => {
  const p = 판(), h = 시험({ 외우기분: 0 });
  시험열기(p, h);
  p.흘러가기(2 * 분);
  p.ctx.시험판치우기_();                        // 나갔다
  시험열기(p, h);                               // 다시
  assert.equal(p.ctx.제한.끝날때 - p.지금(), 3 * 분);
});

/* 시험을 띄워 시간이 다 될 때까지 둔다. 손대기(p) 로 그 사이 아이가 한 일을 넣는다 */
function 끝까지(h, 방법, 손대기 = () => {}) {
  const p = 판();
  시험열기(p, h, 방법);
  p.흘러가기(5 * 분);                    // 외우기
  손대기(p);
  p.흘러가기(5 * 분 + 1000);             // 시험 시간
  return p;
}

test('3) 시간이 다 됐는데 푼 문제가 하나도 없으면 기록을 저장하지 않는다', () => {
  const p = 끝까지(시험(), 'spell');
  assert.equal(p.기록.채점, 0);
  assert.equal(p.기록.결과저장, 0);
  assert.match(p.기록.toast.at(-1), /시간이 지나 제출하지 못했어요 — 선생님께 말씀드리세요/);
  assert.equal(p.기록.show.at(-1), 'exam');
  assert.equal(p.돌아가는시계(), 0);
});

test('3) 빈칸·띄어쓰기만 쓴 것도 안 푼 것이다', () => {
  const p = 끝까지(시험(), 'spell', q => { q.ctx.S.답 = ['', '  ', '']; });
  assert.equal(p.기록.결과저장, 0);
});

test('4) 시간이 다 됐고 몇 개라도 풀었으면 거기까지 채점해 저장한다', () => {
  const p = 끝까지(시험(), 'spell', q => { q.ctx.S.답[1] = 'eat'; });
  assert.equal(p.기록.채점, 1);
  assert.equal(p.기록.결과저장, 1);
});

test('5) 3단변화 — 한 동사도 안 풀었으면 저장하지 않는다', () => {
  const p = 끝까지(시험({ 유형: '3단변화' }), 'verb', q => { q.ctx.S.v상태 = 'input'; q.ctx.S.본문제 = q.ctx.단어들[0]; });
  assert.equal(p.기록.끝3단, 0);
  assert.equal(p.기록.결과저장, 0);
  assert.match(p.기록.toast.at(-1), /시간이 지나 제출하지 못했어요/);
});

test('5) 3단변화 — 한 동사라도 채점됐으면 나머지는 틀린 것으로 채워 저장한다', () => {
  const p = 끝까지(시험({ 유형: '3단변화' }), 'verb', q => {
    Object.assign(q.ctx.S, { idx: 1, 칸수: 3, 칸정답: 3, v상태: 'input', 본문제: q.ctx.단어들[1] });
  });
  assert.equal(p.기록.끝3단, 1);
  assert.equal(p.기록.결과저장, 1);
  assert.equal(p.ctx.S.칸수, 9);                         // 안 푼 두 동사의 여섯 칸이 더해졌다
  assert.equal(p.ctx.S.오답.length, 2);
});

test('5) 3단변화 — 지금 칸에 쓰다 만 것만 있어도 채점해 저장한다', () => {
  const p = 끝까지(시험({ 유형: '3단변화' }), 'verb', q => {
    Object.assign(q.ctx.S, { v상태: 'input', 본문제: q.ctx.단어들[0] });
    q.ctx.$('vBase').value = 'go';
  });
  assert.equal(p.기록.결과저장, 1);
});

test('6) 숙제는 한 문제도 안 썼어도 예전처럼 시간이 되면 낸다', () => {
  const p = 판(), h = { 단어장: '교재A', 시작: 1, 끝: 3, 유형: '스펠링', 종류: '당일', 낸때: 'H2', 제한시간: 10 };
  p.ctx.S.현재숙제 = h;
  p.ctx.startQuiz('spell');
  p.흘러가기(10 * 분 + 1000);
  assert.equal(p.기록.채점, 1);
});
