import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 프롬프트 47 — 시험 중 앱 이탈 · 복사 붙여넣기를 재서 선생님에게만.
   세는 묶음(services/exam-watch.js → index.html 에 박힘)을 가짜 문서 · 가짜 시계로 돌리고,
   엔진(Code.gs)은 TableStore 위에서 진짜로 돌린다 */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const 묶음 = read('../services/exam-watch.js');
const index = read('../index.html'), teacher = read('../teacher.html'), parent = read('../parent.html');
const code = read('./fixtures/legacy/Code.gs'), shared = read('../services/shared-ui.js');
const 일반 = x => JSON.parse(JSON.stringify(x));

/* ---------------- 세는 묶음 ---------------- */
class 가짜문서 extends EventTarget {
  constructor() { super(); this.visibilityState = 'visible'; this.들음 = new Map(); }
  addEventListener(t, f, o) { this.들음.set(t, (this.들음.get(t) || 0) + 1); super.addEventListener(t, f, o); }
  removeEventListener(t, f, o) { this.들음.set(t, (this.들음.get(t) || 0) - 1); super.removeEventListener(t, f, o); }
  가림(v) { this.visibilityState = v ? 'hidden' : 'visible'; this.dispatchEvent(new Event('visibilitychange')); }
  쏘기(t) { const e = new Event(t, { cancelable: true, bubbles: true }); this.dispatchEvent(e); return e.defaultPrevented; }
}
function 감시판() {
  const ctx = vm.createContext({});
  vm.runInContext(묶음, ctx);
  const 문서 = new 가짜문서();
  let 지금 = Date.parse('2026-11-16T01:00:00Z');
  const 감시 = ctx.시험감시만들기_(문서, () => 지금);
  return { 감시, 문서, 지나기: 초 => { 지금 += 초 * 1000; } };
}

test('1. 가려졌다 돌아오면 이탈수 1, 이탈초가 그만큼 는다', () => {
  const { 감시, 문서, 지나기 } = 감시판();
  감시.시작();
  지나기(5); 문서.가림(true); 지나기(12); 문서.가림(false); 지나기(3);
  assert.deepEqual(일반(감시.끝()), { 이탈수: 1, 이탈초: 12, 복사시도: 0 });
});

test('2. 두 번 나갔다 오면 2 — 가려진 시간은 더한다', () => {
  const { 감시, 문서, 지나기 } = 감시판();
  감시.시작();
  문서.가림(true); 지나기(4); 문서.가림(false);
  지나기(10);
  문서.가림(true); 지나기(7); 문서.가림(false);
  assert.deepEqual(일반(감시.끝()), { 이탈수: 2, 이탈초: 11, 복사시도: 0 });
});

test('3. 나간 채로 안 돌아오면 안 센다', () => {
  const { 감시, 문서, 지나기 } = 감시판();
  감시.시작();
  문서.가림(true); 지나기(600);
  assert.deepEqual(일반(감시.끝()), { 이탈수: 0, 이탈초: 0, 복사시도: 0 });
  문서.가림(false);   // 끝() 뒤에 돌아와도 안 센다
  assert.equal(감시.끝().이탈수, 0);
});

test('4. 복사 · 잘라내기 · 붙여넣기 · 긴 누르기가 각각 막히고 1씩 는다', () => {
  const { 감시, 문서 } = 감시판();
  for (const t of ['copy', 'cut', 'paste', 'contextmenu']) {
    감시.시작();
    assert.equal(문서.쏘기(t), true, t + ' 이 막힌다');
    assert.equal(감시.끝().복사시도, 1, t + ' 를 1 센다');
  }
  감시.시작();
  for (const t of ['copy', 'cut', 'paste', 'contextmenu']) 문서.쏘기(t);
  assert.equal(감시.끝().복사시도, 4, '한 시험에서 넷 다 하면 4');
  감시.시작();
  /* 글자 고르기 · 입력은 건드리지 않는다 */
  for (const t of ['selectstart', 'select', 'input', 'keydown', 'mousedown', 'touchstart']) assert.equal(문서.쏘기(t), false, t + ' 는 안 막는다');
});

test('5. 시작() 을 다시 부르면 0 으로 돌아간다 · 듣기가 겹치지 않는다', () => {
  const { 감시, 문서, 지나기 } = 감시판();
  감시.시작();
  문서.쏘기('paste'); 문서.가림(true); 지나기(40); 문서.가림(false);
  감시.시작();
  assert.equal(문서.들음.get('visibilitychange'), 1, '두 번 켜도 하나만 듣는다');
  문서.쏘기('copy');
  assert.deepEqual(일반(감시.끝()), { 이탈수: 0, 이탈초: 0, 복사시도: 1 });
});

test('6. 끝() 뒤에는 더 안 센다 — 듣기를 뗐다. 막지도 않는다 (시험 화면 밖)', () => {
  const { 감시, 문서, 지나기 } = 감시판();
  감시.시작(); 문서.쏘기('copy');
  const 센 = 일반(감시.끝());
  for (const [t, n] of 문서.들음) assert.equal(n, 0, t + ' 를 뗐다');
  assert.equal(감시.켜졌나(), false);
  assert.equal(문서.쏘기('copy'), false, '끝난 뒤의 복사는 막지 않는다');
  assert.equal(문서.쏘기('contextmenu'), false);
  문서.가림(true); 지나기(50); 문서.가림(false);
  assert.deepEqual(일반(감시.끝()), 센, '끝() 을 다시 불러도 같은 값');
  감시.치우기();
  assert.deepEqual(일반(감시.끝()), { 이탈수: 0, 이탈초: 0, 복사시도: 0 }, '보낸 뒤 치우면 다음 판에 안 섞인다');
});

test('이탈은 visibilitychange 하나만 — blur · pagehide 를 겹쳐 듣지 않는다 · 입력칸 글자 고르기를 막지 않는다', () => {
  const { 감시, 문서 } = 감시판();
  감시.시작();
  assert.deepEqual([...문서.들음.keys()].sort(), ['contextmenu', 'copy', 'cut', 'paste', 'visibilitychange']);
  const 코드 = 묶음.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(코드, /blur|pagehide|focusout/);
  assert.doesNotMatch(코드, /user-select|selectstart|toast|alert/);
});

/* ---------------- 아이 화면 — 켜고 떼는 자리 ---------------- */
function 함수떼기(src, name) {
  const at = src.indexOf(`\nfunction ${name}(`);
  assert.ok(at >= 0, name);
  let i = src.indexOf('{', at), 깊이 = 0;
  for (; i < src.length; i++) { if (src[i] === '{') 깊이++; else if (src[i] === '}' && --깊이 === 0) return src.slice(at + 1, i + 1); }
  throw new Error(name);
}
function 화면판(S, 시험판 = null) {
  const 불림 = [];
  const ctx = vm.createContext({ S, 시험판, 시험감시_: {
    시작: () => 불림.push('시작'), 끝: () => 불림.push('끝'), 켜졌나: () => 불림.includes('시작') } });
  vm.runInContext('var 감시화면_ = { quiz:1, sheet:1, verb:1 };\n' + 함수떼기(index, '시험감시맞추기_'), ctx);
  return { 불림, 간다: (전, 곳) => ctx.시험감시맞추기_(전, 곳) };
}

test('아이 화면: 기록이 남는 판의 시험 화면에 들어설 때만 켜고, 떠나면 뗀다 — 혼자 연습은 재지 않는다', () => {
  const 숙제 = 화면판({ 현재숙제: { 단어장: 'A' }, 채점됨: false });
  숙제.간다('home', 'sheet');
  assert.deepEqual(숙제.불림, ['시작']);
  숙제.간다('sheet', 'sheet');
  assert.deepEqual(숙제.불림, ['시작'], '같은 시험 안에서는 다시 켜지 않는다');
  숙제.간다('sheet', 'result');
  assert.deepEqual(숙제.불림, ['시작', '끝'], '결과 화면으로 가면 뗀다');

  const 연습 = 화면판({ 현재숙제: null, 채점됨: false });
  연습.간다('study', 'sheet'); 연습.간다('study', 'quiz'); 연습.간다('study', 'verb');
  assert.deepEqual(연습.불림, [], '혼자 연습은 안 켠다');

  const 시험 = 화면판({ 현재숙제: null, 채점됨: false }, { 단계: '시험' });
  시험.간다('book', 'sheet');
  assert.deepEqual(시험.불림, ['시작'], '시험 탭의 시험은 켠다');

  const 다시봄 = 화면판({ 현재숙제: { 단어장: 'A' }, 채점됨: true });
  다시봄.간다('result', 'sheet');
  assert.deepEqual(다시봄.불림, [], '채점이 끝난 시험지를 다시 보는 것은 새 판이 아니다');
  const 삼단 = 화면판({ 현재숙제: { 단어장: 'A' }, 채점됨: true });
  삼단.간다('home', 'verb');
  assert.deepEqual(삼단.불림, ['시작'], '앞 시험지의 채점됨 이 3단변화를 막지 않는다');
});

test('아이 화면: 결과저장 두 자리 · 문장 두 자리가 감시 값을 싣는다 · 화면에 숫자를 띄우지 않는다', () => {
  assert.equal((index.match(/결과보내기_\('rSaved',감시싣기_\(\{/g) || []).length, 2, '객관식 · 시험지 · 3단변화');
  assert.match(index, /var 자료 = 감시싣기_\(\{\n\s+이름:S\.학생\.이름, 단어장:SN\.책/);
  assert.match(index, /문장기록보내기_\(감시싣기_\(\{/);
  assert.match(함수떼기(index, 'show'), /시험감시맞추기_\(지금화면_\(\), name\)/);
  /* 박힌 묶음 밖에서 숫자를 그리는 곳이 없다 */
  const 고유 = index.replace(/\/\* BEGIN GENERATED [^*]*\*\/[\s\S]*?\/\* END GENERATED [^*]*\*\//g, '');   // 박힌 공용 블록(선생님 미리보기 흉내 포함)은 빼고
  assert.doesNotMatch(고유, /이탈수|이탈초|복사시도/);
  assert.ok(index.includes(묶음.trimEnd()), 'index.html 에 박혀 있다 (build-services)');
});

/* ---------------- 엔진 ---------------- */
const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'];
function 엔진() {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', '5678']);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재', '학부모링크', '학부모마지막', '선생님한마디']);
  for (const n of ['홍길동', '김영희', '박지훈', '이철수']) 학생.appendRow(['', n, '1234', '', '', '중2', '', '', '', '', '']);
  store.insertSheet('단어장목록').appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  const 기록 = store.insertSheet('기록'); 기록.appendRow(머리기록);   // 예전 표 — 감시 칸 머리글이 없다
  store.insertSheet('기록보관').appendRow(머리기록);
  store.insertSheet('숙제').appendRow(['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류']);
  const 문장 = store.insertSheet('문장기록');
  문장.appendRow(['시각', '반', '이름', '단어장', '범위', '유형', '난이도', '문항수', '정답수', '점수', '소요초', '숙제여부', '틀린문장', '구분', '집계제외']);
  const 엔 = createRuntime(store, { now: () => Date.parse('2026-11-16T03:00:00Z') });
  return { store, 기록, 문장, call: (fn, ...args) => 일반(엔.call(fn, args)) };
}
const 제출 = (이름, 감 = {}) => ({ 이름, 단어장: '교재A', 범위: '1~10', 유형: '스펠링', 문항수: 10, 정답수: 8, 점수: 80,
  게임점수: 0, 최고콤보: 0, 소요초: 120, 숙제여부: true, 구분: '숙제', 틀린단어: 'a, b', ...감 });
const 끝줄 = sh => sh.getRange(sh.getLastRow(), 1, 1, sh.getMaxColumns()).getValues()[0];

test('7. 결과저장 — 음수 · 글자 · 빈 값은 0 · 집계제외 뒤 Q~S 열에 적는다', () => {
  const e = 엔진();
  for (const [감, 기대] of [
    [{ 이탈수: 2, 이탈초: 45, 복사시도: 1 }, [2, 45, 1]],
    [{ 이탈수: -3, 이탈초: '많이', 복사시도: '' }, [0, 0, 0]],
    [{}, [0, 0, 0]],
    [{ 이탈수: null, 이탈초: undefined, 복사시도: '2' }, [0, 0, 2]],
    [{ 이탈수: 2.7, 이탈초: 'NaN', 복사시도: Infinity }, [2, 0, 0]],
  ]) {
    assert.equal(e.call('결과저장', 제출('홍길동', 감)).ok, true);
    const 줄 = 끝줄(e.기록);
    assert.equal(줄[15], '', '집계제외는 비어 있다');
    assert.deepEqual(줄.slice(16, 19), 기대, JSON.stringify(감));
  }
  /* 학생 저장은 머리글을 안 건드린다 — 줄을 뒤에 붙이기만 해야 덧붙임 조각으로 나간다 */
  assert.deepEqual(e.기록.getRange(1, 17, 1, 3).getValues()[0], ['', '', '']);
});

test('8. 이탈초가 7200 을 넘으면 잘린다 · 횟수도 터무니없으면 자른다', () => {
  const e = 엔진();
  e.call('결과저장', 제출('홍길동', { 이탈수: 1e9, 이탈초: 99999, 복사시도: 5000 }));
  assert.deepEqual(끝줄(e.기록).slice(16, 19), [999, 7200, 999]);
});

test('문장기록저장 — 같은 셋을 P~R 열에 적는다', () => {
  const e = 엔진();
  const 판 = { 이름: '홍길동', 단어장: '초5 문장', 범위: '1~5', 유형: '하루 단계', 난이도: 7, 문항수: 10, 정답수: 9, 소요초: 300, 숙제여부: false, 틀린문장: [] };
  assert.equal(e.call('문장기록저장', { ...판, 이탈수: 3, 이탈초: -1, 복사시도: 'x' }).ok, true);
  assert.deepEqual(끝줄(e.문장).slice(14, 18), ['', 3, 0, 0]);
});

test('초기설정 · 기록제외설정(선생님 쪽 길)이 예전 표에 머리글을 붙인다', () => {
  assert.match(code, /'집계제외',\n\s+'이탈수', '이탈초', '복사시도'\],\n\s+기록보관:/);
  assert.match(code, /'틀린문장', '구분', '집계제외', '이탈수', '이탈초', '복사시도'\]/);
  const e = 엔진();
  e.call('결과저장', 제출('홍길동', { 이탈수: 1 }));
  assert.deepEqual(e.기록.getRange(1, 16, 1, 4).getValues()[0], ['집계제외', '', '', ''], '학생 저장은 머리글을 안 쓴다');
  const 키 = e.call('선생님기록', '5678', 7).시험목록[0].키;
  assert.equal(e.call('기록제외설정', '5678', [키], true).ok, true);
  assert.deepEqual(e.기록.getRange(1, 16, 1, 4).getValues()[0], ['집계제외', '이탈수', '이탈초', '복사시도']);
  assert.deepEqual(e.기록.getRange(2, 16, 1, 4).getValues()[0], ['O', 1, 0, 0], '값은 그대로');
  /* 문장기록 — 선생님 쪽 길(만들까)에서만 */
  assert.match(함수떼기(code, '초기설정'), /문장기록시트_\(true\);/);
  assert.match(함수떼기(code, '문장기록시트_'), /if \(만들까\) 감시머리확보_\(sh, HEADERS\.문장기록\.indexOf\('이탈수'\) \+ 1\);/);
});

test('9. 「확인 필요」 는 엔진이 내려 준다 — 이탈 2회 · 20초 · 복사 0 은 아니고, 3회면 · 30초면 · 복사 1회면 달린다', () => {
  const e = 엔진();
  e.call('결과저장', 제출('홍길동', { 이탈수: 2, 이탈초: 20, 복사시도: 0 }));
  e.call('결과저장', 제출('김영희', { 이탈수: 3, 이탈초: 5, 복사시도: 0 }));
  e.call('결과저장', 제출('박지훈', { 이탈수: 0, 이탈초: 0, 복사시도: 1 }));
  e.call('결과저장', 제출('이철수', { 이탈수: 1, 이탈초: 30, 복사시도: 0 }));
  e.기록.appendRow([new Date('2026-11-16T02:00:00Z'), '', '홍길동', '교재B', '1~5', '스펠링', 5, 5, 100, 0, 0, 30, 'O', '', '숙제', '']);   // 예전 줄 — 빈 칸
  const r = e.call('선생님기록', '5678', 7);
  assert.equal(r.ok, true);
  const 봄 = Object.fromEntries(r.시험목록.map(t => [t.이름 + '|' + t.단어장, [t.이탈수, t.이탈초, t.복사시도, t.확인필요]]));
  assert.deepEqual(봄, {
    '홍길동|교재A': [2, 20, 0, false],
    '김영희|교재A': [3, 5, 0, true],
    '박지훈|교재A': [0, 0, 1, true],
    '이철수|교재A': [1, 30, 0, true],
    '홍길동|교재B': [0, 0, 0, false],
  });
});

test('10. 점수 · 합격 판정 · 평균이 감시 값에 안 흔들린다', () => {
  const 깨끗 = 엔진(), 수상 = 엔진();
  for (const n of ['홍길동', '김영희']) {
    깨끗.call('결과저장', 제출(n));
    수상.call('결과저장', 제출(n, { 이탈수: 50, 이탈초: 7000, 복사시도: 30 }));
  }
  assert.deepEqual(끝줄(깨끗.기록).slice(1, 15), 끝줄(수상.기록).slice(1, 15), '점수 칸들은 같다');
  const 빼기 = r => ({ ...r, 시험목록: r.시험목록.map(({ 이탈수, 이탈초, 복사시도, 확인필요, 키, ...t }) => t) });
  assert.deepEqual(빼기(깨끗.call('선생님기록', '5678', 7)), 빼기(수상.call('선생님기록', '5678', 7)), '학생별 평균 · 오답 · 미응시가 같다');
  /* 쓰는 곳은 기록분석_ 의 싣기 한 군데뿐 — 합격점 · 시상 · 순위 함수는 이 이름을 모른다 */
  const 쓰는곳 = code.split('\n').map(l => l.replace(/\/\/.*$|\/\*.*?\*\//g, ''))
    .filter(l => /이탈|복사시도|확인필요_\(|감시값_\(/.test(l) && !/^\s*(\/\*|\*)/.test(l));
  for (const l of 쓰는곳) assert.doesNotMatch(l, /합격|시상|순위|점수/, l);
});

test('아이 로그인 답 · 학부모 화면에는 없다 — 선생님 화면에만', () => {
  assert.doesNotMatch(함수떼기(code, '로그인'), /이탈|복사시도|확인필요/);
  assert.doesNotMatch(parent, /이탈수|이탈초|복사시도|확인 필요/);
  assert.match(teacher, /function 감시배지_\(t\)\{\n\s+return t\.확인필요 \?/, '배지는 엔진이 정한 확인필요 를 그대로 쓴다');
  assert.match(teacher, /구분칩\(t\)\+감시배지_\(t\)/);
  assert.match(teacher, /watchline/, '펼친 줄에는 배지가 없어도 숫자가 나온다');
  /* 미리보기 흉내 자료에도 셋 — 달린 줄과 안 달린 줄이 같이 */
  const ctx = vm.createContext({ location: { protocol: 'https:', hostname: 'example.invalid', search: '' }, 창구주소: 'firestore:v1' });
  vm.runInContext(shared, ctx);
  const 목록 = ctx.DEMO.선생님기록('1234', 7).시험목록;
  assert.ok(목록.some(t => t.확인필요) && 목록.some(t => !t.확인필요));
  assert.ok(목록.every(t => typeof t.이탈수 === 'number' && typeof t.이탈초 === 'number' && typeof t.복사시도 === 'number'));
});
