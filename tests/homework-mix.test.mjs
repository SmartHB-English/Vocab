import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 교재 섞기 — 한 시험에 단어장 셋까지. 칸을 새로 만들지 않고 단어장 · 시작번호 · 끝번호 · 칸에 「|」 로 이어 담는다.
   「|」 가 없으면 옛 숙제 그대로다. 엔진은 담고 · 막고 · 기록을 잇기만 하고, 단어를 합쳐 섞는 것은 아이 기기가 한다 */
const 지금 = Date.parse('2026-11-23T03:00:00Z');
const 뿌리 = new URL('../', import.meta.url);
const 읽기 = p => readFileSync(new URL(p, 뿌리), 'utf8');
const code = 읽기('tests/fixtures/legacy/Code.gs');
const shared = 읽기('services/shared-ui.js');
const index = 읽기('index.html');
const teacher = 읽기('teacher.html');

const 머리숙제 = ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류',
  '수업', '순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분', '학부모숨김', '문항수', '숙제코드'];
const 머리기록 = ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수', '점수', '게임점수', '최고콤보', '소요초',
  '숙제여부', '틀린단어', '구분', '집계제외', '이탈수', '이탈초', '복사시도', '숙제코드'];

/* 600-1 은 80개 · 중3 은 30개. 600-1 의 45번과 중3 의 25번이 같은 철자(run / Run) */
function 단어(책, n, 바꿀 = {}) {
  return Array.from({ length: n }, (_, i) => {
    const no = i + 1;
    return 바꿀[no] || [no, `${책}_w${no}`, `${책} 뜻${no}`];
  });
}
function 판짜기(store) {
  store.insertSheet('학생').appendRow(['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재']);
  const 학생 = store.getSheetByName('학생');
  학생.appendRow(['', '홍길동', '1111', '', '', '', '', '600-1']);
  학생.appendRow(['', '김영희', '2222', '', '', '', '', '중3']);
  학생.appendRow(['', '박철수', '3333', '', '', '', '', '다른책']);
  const 목록 = store.insertSheet('단어장목록');
  목록.appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과']);
  [['600-1', '', 'w600', 'orange'], ['중3', '', 'w중3', 'blue'], ['다른책', '', 'w다른', ''],
   ['본문책', '본문', 'w본문', ''], ['L1', '과', 'w과1', ''], ['L2', '과', 'w과2', ''], ['문장책', '문장', 'w문장', '']]
    .forEach(x => 목록.appendRow(x));
  const 시트 = (이름, 줄들, 머리 = ['번호', '영어', '뜻']) => { const sh = store.insertSheet(이름); sh.appendRow(머리); 줄들.forEach(x => sh.appendRow(x)); };
  시트('w600', 단어('600', 80, { 45: [45, 'run', '달리다 (600-1)'] }));
  시트('w중3', 단어('중3', 30, { 25: [25, 'Run', '뛰다 (중3)'] }));
  시트('w다른', 단어('다른', 10));
  시트('w본문', 단어('본문', 10));
  const 과 = (k) => [...Array.from({ length: 8 }, (_, i) => [i + 1, '단어', `${k}_단어${i + 1}`, '뜻']),
                    ...Array.from({ length: 4 }, (_, i) => [i + 1, '본문', `${k} sentence ${i + 1}.`, '해석'])];
  시트('w과1', 과('L1'), ['번호', '구분', '영어', '뜻·해석', '비고']);
  시트('w과2', 과('L2'), ['번호', '구분', '영어', '뜻·해석', '비고']);
  시트('w문장', 단어('문장', 10));
  store.insertSheet('숙제').appendRow(머리숙제);
  store.insertSheet('기록').appendRow(머리기록);
}
function 엔진(만들기 = createRuntime) {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  판짜기(store);
  const 엔 = 만들기(store, { now: () => 지금 });
  return {
    store, 숙제: store.getSheetByName('숙제'), 기록: store.getSheetByName('기록'),
    call: (fn, ...args) => JSON.parse(JSON.stringify(엔.call(fn, args))),
  };
}
const 비번 = '1234';
const 섞어내기 = (e, 더 = {}) => e.call('숙제등록', 비번, {
  단어장: '600-1|중3', 시작: '41|1', 끝: '50|20', 칸: '|', 유형: '스펠링', 종류: '시험', 마감일: '2026-11-24',
  바뀐줄만: true, ...더,
});
const 줄값 = (e, 행 = 2) => e.숙제.getRange(행, 1, 1, 20).getValues()[0];

/* 화면 쪽 함수 — shared-ui.js · index.html 에서 그대로 떼어 돌린다 */
function 함수떼기(src, name) {
  const at = src.indexOf(`\nfunction ${name}(`);
  assert.ok(at >= 0, name);
  let i = src.indexOf('{', at), 깊이 = 0;
  for (; i < src.length; i++) { if (src[i] === '{') 깊이++; else if (src[i] === '}' && --깊이 === 0) return src.slice(at + 1, i + 1); }
  throw new Error(name);
}
const 공용시작 = shared.indexOf('/* ==== 수업 짜기 공용 시작'), 공용끝 = shared.indexOf('/* ==== 수업 짜기 공용 끝 ==== */');
const 공용 = shared.slice(공용시작, 공용끝);
function 화면(S = {}, api = () => Promise.resolve([])) {
  const 몸 = [공용, ...['shuffle', '문항자르기_', '문항뽑기_', '섞인숙제_', '숙제첫책_', '섞인단어모으기_'].map(n => 함수떼기(shared, n)),
    ...['숙제단어받기_', '기록범위', '숙제범위글_', '섞인풀이중_'].map(n => 함수떼기(index, n))].join('\n');
  return new Function('S', 'api', '지금칸_', '학생범위글_', 몸 + `
    return { 섞인단어모으기_, 숙제단어받기_, 기록범위, 문항뽑기_, 범위들_, 섞기막힘_, 섞인숙제_, 숙제범위글_ };`)(
    S, api, () => S.칸 || '단어', (책, a, b) => `${a}~${b}번`);
}
const 받기 = e => 책 => Promise.resolve(e.call('단어가져오기', 책));

/* ---------------------------------------------------------------- 1 */
test('1) 「|」 가 없는 옛 숙제는 지금과 똑같이 돈다 — 바꾸기 전 엔진과 줄 · 아이 목록 · 선생님 목록이 한 글자도 같다', async (t) => {
  let 옛코드 = '';
  try { 옛코드 = execFileSync('git', ['show', '5191eee:tests/fixtures/legacy/Code.gs'], { cwd: new URL('.', 뿌리), encoding: 'utf8', maxBuffer: 1 << 26 }); }
  catch (err) { t.skip('바꾸기 전 Code.gs 를 git 에서 못 읽었다'); return; }
  /* 바꾸기 전 엔진 — 생성된 엔진 파일에서 Code.gs 부분만 옛것으로 갈아 끼운다 */
  const 생성 = 읽기('services/legacy-engine.generated.mjs');
  assert.equal(생성.split(code).length, 2, '생성 엔진에 Code.gs 가 그대로 한 번 들어 있다');
  const 곳 = mkdtempSync(join(tmpdir(), 'hb-mix-'));
  writeFileSync(join(곳, 'engine.mjs'), 생성.replace(code, () => 옛코드));
  const 런 = 읽기('services/legacy-runtime.mjs')
    .replace("'./legacy-engine.generated.mjs'", JSON.stringify(pathToFileURL(join(곳, 'engine.mjs')).href))
    .replace("'./random-id.mjs'", JSON.stringify(new URL('services/random-id.mjs', 뿌리).href))
    .replace("'./seoul-date.mjs'", JSON.stringify(new URL('services/seoul-date.mjs', 뿌리).href));
  writeFileSync(join(곳, 'runtime.mjs'), 런);
  const { createRuntime: 옛런타임 } = await import(pathToFileURL(join(곳, 'runtime.mjs')).href);

  const 새 = 엔진(), 옛 = 엔진(옛런타임);
  const 내기 = [
    { 단어장: '600-1', 시작: 41, 끝: 50, 유형: '스펠링', 종류: '시험', 마감일: '2026-11-24', 문항수: 5 },
    { 단어장: '중3', 시작: '1', 끝: '20', 유형: '첫 글자', 종류: '기한', 마감일: '2026-11-25' },
    { 단어장: 'L1', 칸: '본문', 시작: 1, 끝: 4, 유형: '빈칸 채우기', 종류: '당일', 학생들: ['홍길동'] },
  ];
  for (const h of 내기) {
    const a = 새.call('숙제등록', 비번, { ...h, 바뀐줄만: true }), b = 옛.call('숙제등록', 비번, { ...h, 바뀐줄만: true });
    assert.equal(a.ok, true, a.메시지);
    delete a.숙제.낸때; delete b.숙제.낸때;
    assert.deepEqual(a, b);
  }
  for (let 행 = 2; 행 <= 4; 행++) {
    const a = 줄값(새, 행), b = 줄값(옛, 행);
    a.splice(19, 1); b.splice(19, 1); a.splice(6, 1); b.splice(6, 1);     // 숙제코드 · 등록시각은 낼 때마다 다르다
    assert.deepEqual(a, b, `${행}번 줄`);
  }
  const 떼기 = 목록 => 목록.map(({ 낸때, 코드, ...x }) => x);
  for (const 이름 of ['홍길동', '김영희', '박철수']) assert.deepEqual(떼기(새.call('숙제가져오기', 이름)), 떼기(옛.call('숙제가져오기', 이름)), 이름);
  assert.deepEqual(떼기(새.call('선생님기본', 비번).숙제목록), 떼기(옛.call('선생님기본', 비번).숙제목록));
  /* 옛 숙제 줄에는 새 칸(섞음 · 범위)이 아예 안 붙는다 */
  for (const h of 새.call('숙제가져오기', '홍길동')) { assert.equal('섞음' in h, false); assert.equal('범위' in h, false); }
  /* 아이 화면 — 옛 숙제는 단어장 하나를 한 번만 받는다 (지금 그대로) */
  const 부름 = [];
  const 판 = 화면({}, (fn, 책) => { 부름.push([fn, 책]); return Promise.resolve([]); });
  await 판.숙제단어받기_({ 단어장: '600-1', 시작: 41, 끝: 50 });
  assert.deepEqual(부름, [['단어가져오기', '600-1']]);
  assert.equal(판.범위들_('600-1', 41, 50, '').length, 1);
  assert.deepEqual(판.범위들_('600-1', '41', '50', ''), [{ 단어장: '600-1', 시작: 41, 끝: 50, 칸: '' }]);
});

/* ---------------------------------------------------------------- 2 · 3 */
test('2) 두 교재를 섞으면 각 범위의 단어가 다 나온다 (10 + 20 = 30) · 엔진은 「|」 로 담고 조각을 실어 준다', async () => {
  const e = 엔진();
  const 답 = 섞어내기(e);
  assert.equal(답.ok, true, 답.메시지);
  const x = 줄값(e);
  assert.deepEqual([x[1], x[2], x[3], x[11]], ['600-1|중3', '41|1', '50|20', '|']);   // 칸을 새로 만들지 않는다
  assert.equal(e.숙제.getLastColumn(), 20);
  /* 교재 중 하나라도 배우는 아이에게 간다 */
  assert.equal(답.대상, 2);
  const 아이 = e.call('숙제가져오기', '김영희')[0];
  assert.equal(아이.단어장, '600-1+중3');
  assert.equal(아이.범위, '41~50, 1~20');
  assert.deepEqual(아이.섞음, [{ 단어장: '600-1', 시작: 41, 끝: 50, 칸: '' }, { 단어장: '중3', 시작: 1, 끝: 20, 칸: '' }]);
  assert.equal(아이.색, 'orange');                                             // 첫 교재의 색
  assert.equal(e.call('숙제가져오기', '박철수').length, 0);
  /* 아이 기기 — 조각마다 따로 받아 범위를 먼저 자르고 합친다 */
  const 판 = 화면({}, (fn, 책) => 받기(e)(책));
  const 합 = await 판.숙제단어받기_(아이);
  assert.equal(합.length, 30);
  const 철자 = new Set(합.map(w => w.en));
  for (let i = 41; i <= 50; i++) if (i !== 45) assert.ok(철자.has(`600_w${i}`), `600-1 ${i}`);
  for (let i = 1; i <= 20; i++) assert.ok(철자.has(`중3_w${i}`), `중3 ${i}`);
  assert.ok(!철자.has('600_w40') && !철자.has('600_w51') && !철자.has('중3_w21'), '범위 밖 단어는 없다');
  /* 번호는 섞은 뒤 1부터 다시 */
  assert.deepEqual(합.map(w => w.no), Array.from({ length: 30 }, (_, i) => i + 1));
});

test('2-1) 완전히 섞는다 — 교재별로 묶어 내지 않는다 (앞 열 개가 늘 600-1 이면 안 된다)', async () => {
  const e = 엔진();
  섞어내기(e);
  const 아이 = e.call('숙제가져오기', '홍길동')[0];
  const 판 = 화면({}, (fn, 책) => 받기(e)(책));
  let 묶였다 = 0;
  for (let n = 0; n < 40; n++) {
    const 합 = await 판.숙제단어받기_(아이);
    if (합.slice(0, 10).every(w => /^600_|^run$/.test(w.en))) 묶였다++;
  }
  assert.ok(묶였다 < 3, `앞 열 개가 600-1 로만 묶인 판이 ${묶였다}번`);
});

test('3) 영어 철자가 겹치면 하나만 남긴다 — 앞에 고른 교재 것을 쓴다 (대소문자 · 띄어쓰기만 다른 것도 같은 철자)', async () => {
  const e = 엔진();
  const 판 = 화면();
  const 받은 = [e.call('단어가져오기', '600-1'), e.call('단어가져오기', '중3')];
  /* 600-1 41~50 의 run 과 중3 21~30 의 Run — 10 + 10 에서 하나 뺀 19 */
  const 조각 = 판.범위들_('600-1|중3', '41|21', '50|30', '|');
  const r = 판.섞인단어모으기_(조각, 받은);
  assert.equal(r.단어.length, 19);
  assert.equal(r.겹침, 1);
  const run = r.단어.filter(w => w.en.toLowerCase() === 'run');
  assert.equal(run.length, 1);
  assert.equal(run[0].ko, '달리다 (600-1)');
  /* 순서를 바꾸면 앞에 온 중3 것이 남는다 */
  const 거꾸로 = 판.섞인단어모으기_(판.범위들_('중3|600-1', '21|41', '30|50', '|'), [받은[1], 받은[0]]);
  assert.equal(거꾸로.단어.filter(w => w.en.toLowerCase() === 'run')[0].ko, '뛰다 (중3)');
  /* 받은 단어를 건드리지 않는다 (번호를 다시 매겨도 원본은 그대로) */
  assert.equal(받은[0][44].no, 45);
});

/* ---------------------------------------------------------------- 4 · 5 */
test('4) 같은 단어장의 두 범위도 된다 — 겹치는 번호는 한 번만', async () => {
  const e = 엔진();
  const 답 = e.call('숙제등록', 비번, { 단어장: '600-1|600-1', 시작: '41|71', 끝: '50|80', 칸: '|', 유형: '스펠링', 종류: '시험', 마감일: '2026-11-24', 바뀐줄만: true });
  assert.equal(답.ok, true, 답.메시지);
  const 아이 = e.call('숙제가져오기', '홍길동')[0];
  assert.equal(아이.단어장, '600-1+600-1');
  assert.equal(아이.범위, '41~50, 71~80');
  const 판 = 화면({}, (fn, 책) => 받기(e)(책));
  assert.equal((await 판.숙제단어받기_(아이)).length, 20);
  /* 범위가 겹치면(41~50 · 46~55) 겹친 5개는 한 번만 */
  const 받은 = e.call('단어가져오기', '600-1');
  const r = 판.섞인단어모으기_(판.범위들_('600-1|600-1', '41|46', '50|55', '|'), [받은, 받은]);
  assert.equal(r.단어.length, 15);
  assert.equal(r.겹침, 5);
});

test('5) 문항수가 20 이면 섞인 30개 중 20개가 나온다 · 문항수 칸은 지금처럼 산다', async () => {
  const e = 엔진();
  const 답 = 섞어내기(e, { 문항수: 20 });
  assert.equal(답.ok, true, 답.메시지);
  assert.equal(줄값(e)[18], 20);
  const 아이 = e.call('숙제가져오기', '홍길동')[0];
  assert.equal(아이.문항수, 20);
  const 판 = 화면({}, (fn, 책) => 받기(e)(책));
  const 합 = await 판.숙제단어받기_({ ...아이, 섞음: 판.범위들_('600-1|중3', '41|1', '50|20', '|') });
  assert.equal(합.length, 30);
  const 낸 = 판.문항뽑기_(합, 아이.문항수);
  assert.equal(낸.length, 20);
  assert.equal(new Set(낸.map(w => w.en)).size, 20);
  /* 비어 있으면 합친 것 전부 */
  assert.equal(판.문항뽑기_(합, '').length, 30);
});

/* ---------------------------------------------------------------- 6 */
test('6) 조각 수가 안 맞으면(단어장 둘, 시작 하나) 첫 조각만 쓰고 로그를 남긴다 — 터지지 않는다', () => {
  const 판 = 화면();
  const 남긴 = [], 원 = console.log;
  console.log = (...a) => 남긴.push(a.join(' '));
  let 조각;
  try { 조각 = 판.범위들_('600-1|중3', '41', '50|20', '|'); } finally { console.log = 원; }
  assert.deepEqual(조각, [{ 단어장: '600-1', 시작: 41, 끝: 50, 칸: '' }]);
  assert.equal(남긴.length, 1);
  assert.match(남긴[0], /조각 수가 안 맞아 첫 조각만/);
  /* 시트에서 손으로 잘못 고친 줄 — 엔진도 첫 조각(600-1 41~50)으로 읽는다. 섞음이 안 붙는다 */
  const e = 엔진();
  e.call('숙제등록', 비번, { 단어장: '600-1', 시작: 41, 끝: 50, 유형: '스펠링', 종류: '시험', 마감일: '2026-11-24', 바뀐줄만: true });
  e.숙제.getRange(2, 2, 1, 3).setValues([['600-1|중3', '41', '50|20']]);
  const 원2 = console.log; console.log = () => {};
  let 아이;
  try { 아이 = e.call('숙제가져오기', '홍길동'); } finally { console.log = 원2; }
  assert.equal(아이.length, 1);
  assert.deepEqual([아이[0].단어장, 아이[0].시작, 아이[0].끝, 아이[0].섞음], ['600-1', 41, 50, undefined]);
  /* 저장할 때는 아예 받지 않는다 */
  const 답 = e.call('숙제등록', 비번, { 단어장: '600-1|중3', 시작: '41', 끝: '50|20', 칸: '|', 유형: '스펠링', 종류: '시험', 마감일: '2026-11-24', 바뀐줄만: true });
  assert.equal(답.ok, false);
  assert.match(답.메시지, /시작 · 끝/);
});

/* ---------------------------------------------------------------- 7 · 8 */
test('7) 종류가 다른 단어장을 섞으려 하면 거절한다 — 말해 준다 (조용히 빼지 않는다)', () => {
  const e = 엔진();
  for (const [책, 칸, 말] of [
    ['600-1|L1', '|단어', /종류가 달라 같이 낼 수 없습니다 \(단어장 \/ 과 단어장\)/],
    ['600-1|본문책', '|', /종류가 달라 같이 낼 수 없습니다 \(단어장 \/ 본문 단어장\)/],
    ['L1|L2', '단어|본문', /구분이 달라 같이 낼 수 없습니다 \(단어 \/ 본문\)/],
    ['600-1|없는책', '|', /“없는책” 단어장을 찾을 수 없습니다/],
  ]) {
    const 답 = e.call('숙제등록', 비번, { 단어장: 책, 시작: '1|1', 끝: '4|4', 칸, 유형: '스펠링', 종류: '기한', 마감일: '2026-11-24', 학생들: ['홍길동'], 바뀐줄만: true });
    assert.equal(답.ok, false, 책);
    assert.match(답.메시지, 말, 책);
  }
  assert.equal(e.숙제.getLastRow(), 1, '한 줄도 안 쓴다');
  /* 과 단어장끼리 · 같은 구분이면 된다 — 기록 범위에 구분이 붙는다 */
  const 됨 = e.call('숙제등록', 비번, { 단어장: 'L1|L2', 시작: '1|1', 끝: '4|4', 칸: '본문|본문', 유형: '빈칸 채우기', 종류: '기한', 마감일: '2026-11-24', 학생들: ['홍길동'], 바뀐줄만: true });
  assert.equal(됨.ok, true, 됨.메시지);
  assert.equal(됨.숙제.범위, '본문 1~4, 본문 1~4');
  assert.equal(됨.숙제.칸, '본문');
  /* 화면도 같은 규칙(공용 블록)으로 그 자리에서 알린다 */
  const 판 = 화면(), 목록 = [{ 이름: '600-1', 종류: '' }, { 이름: 'L1', 종류: '과' }];
  assert.equal(판.섞기막힘_([{ 단어장: '600-1' }, { 단어장: 'L1', 칸: '단어' }], 목록), '종류가 달라 같이 낼 수 없습니다 (단어장 / 과 단어장)');
  assert.equal(판.섞기막힘_([{ 단어장: '600-1' }, { 단어장: '600-1' }], 목록), '');
});

test('8) 문장 단어장은 섞기를 못 쓴다 — 엔진이 막고, 선생님 화면은 「교재 더하기」 를 잠근다', () => {
  const e = 엔진();
  for (const 책 of ['문장책|600-1', '600-1|문장책', '문장책|문장책']) {
    const 답 = e.call('숙제등록', 비번, { 단어장: 책, 시작: '1|1', 끝: '5|5', 칸: '|', 유형: '스펠링', 종류: '기한', 마감일: '2026-11-24', 학생들: ['홍길동'], 바뀐줄만: true });
    assert.equal(답.ok, false, 책);
    assert.match(답.메시지, /문장 단어장은 채점이 달라/);
  }
  assert.equal(e.숙제.getLastRow(), 1);
  /* 섞지 않은 문장 숙제는 지금처럼 낸다 */
  assert.equal(e.call('숙제등록', 비번, { 단어장: '문장책', 시작: 1, 끝: 5, 유형: '스펠링', 종류: '기한', 마감일: '2026-11-24', 학생들: ['홍길동'], 바뀐줄만: true }).ok, true);
  assert.match(teacher, /function 더교재그리기\(\)[\s\S]{0,400}단추\.disabled = 문장 \|\|/);
  assert.match(teacher, /문장 단어장은 채점이 달라 다른 교재와 섞을 수 없습니다/);
});

/* ---------------------------------------------------------------- 9 */
test('9) 기록에 「600-1+중3」 · 「41~50, 1~20」 으로 남고, 그 글로 숙제 · 재시험 판정이 저절로 맞는다', () => {
  const e = 엔진();
  섞어내기(e);
  const 아이 = e.call('숙제가져오기', '홍길동')[0];
  /* 아이 기기가 결과저장에 싣는 값 — S.단어장 = 숙제의 단어장, 범위 = 기록범위() */
  const S = { 현재숙제: 아이, 재시험: false, 종류: '', 단어장: 아이.단어장 };
  const 판 = 화면(S);
  const 범위 = 판.기록범위({ a: 1, b: 30, list: [] });
  assert.equal(범위, '41~50, 1~20');
  assert.equal(판.숙제범위글_(아이), '41~50, 1~20');
  const 보내기 = () => e.call('결과저장', { 이름: '홍길동', 단어장: S.단어장, 범위, 유형: '스펠링', 문항수: 30, 정답수: 27, 점수: 90,
    숙제여부: true, 구분: '시험', 숙제코드: 아이.코드 });
  assert.equal(보내기().ok, true);
  const 줄 = e.기록.getRange(2, 1, 1, 20).getValues()[0];
  assert.deepEqual([줄[3], 줄[4]], ['600-1+중3', '41~50, 1~20']);
  /* 한 번만 — 이미본시험_ 은 손대지 않았다. 글이 같으니 두 번째는 막힌다 */
  const 두번 = 보내기();
  assert.equal(두번.ok, false);
  assert.equal(두번.이미봄, true);
  /* 숙제 완료 · 선생님 목록 · 학부모 화면 */
  assert.equal(e.call('숙제가져오기', '홍길동')[0].완료, true);
  const 선생님 = e.call('선생님기본', 비번).숙제목록[0];
  assert.deepEqual([선생님.단어장, 선생님.범위, 선생님.한사람, 선생님.안한사람], ['600-1+중3', '41~50, 1~20', ['홍길동'], ['김영희']]);
  /* 코드 없는 옛 앱의 기록도 범위 글로 찾는다 */
  e.call('결과저장', { 이름: '김영희', 단어장: '600-1+중3', 범위: '41~50, 1~20', 유형: '스펠링', 문항수: 30, 정답수: 30, 점수: 100, 숙제여부: true, 구분: '시험' });
  assert.deepEqual(e.call('선생님기본', 비번).숙제목록[0].안한사람, []);
  /* 학부모 · 내 기록 · 미제출 글 */
  assert.match(code, /function 제목\(h\) \{ return h\.섞음 \? h\.단어장 \+ ' ' \+ h\.범위/);
  assert.match(code, /h\.반, h\.단어장, \(h\.범위 \|\| h\.시작 \+ '~' \+ h\.끝\) \+ '번'/);
  const 내 = e.call('내기록', '홍길동');
  assert.deepEqual([내[0].단어장, 내[0].범위], ['600-1+중3', '41~50, 1~20']);
});

test('9-1) 섞인 숙제의 유형 · 마감만 고치면 교재 · 범위는 그대로 남는다', () => {
  const e = 엔진();
  const 답 = 섞어내기(e);
  const r = e.call('숙제수정', 비번, 답.숙제.행, { 유형: '첫 글자', 종류: '시험', 마감일: '2026-11-26', 낸때: 답.숙제.낸때, 바뀐줄만: true });
  assert.equal(r.ok, true, r.메시지);
  const x = 줄값(e);
  assert.deepEqual([x[1], x[2], x[3], x[4], x[11]], ['600-1|중3', '41|1', '50|20', '첫 글자', '|']);
  assert.equal(r.숙제.범위, '41~50, 1~20');
});

/* ---------------------------------------------------------------- 10 */
test('10) 네 개째는 저장이 막힌다 — 셋까지', () => {
  const e = 엔진();
  const 넷 = e.call('숙제등록', 비번, { 단어장: '600-1|중3|다른책|600-1', 시작: '1|1|1|11', 끝: '5|5|5|15', 칸: '|||', 유형: '스펠링', 종류: '기한', 마감일: '2026-11-24', 바뀐줄만: true });
  assert.equal(넷.ok, false);
  assert.match(넷.메시지, /3개까지/);
  assert.equal(e.숙제.getLastRow(), 1);
  const 셋 = e.call('숙제등록', 비번, { 단어장: '600-1|중3|다른책', 시작: '1|1|1', 끝: '5|5|5', 칸: '||', 유형: '스펠링', 종류: '기한', 마감일: '2026-11-24', 바뀐줄만: true });
  assert.equal(셋.ok, true, 셋.메시지);
  assert.equal(셋.대상, 3);
  /* 숙제수정으로 넷을 넣으려 해도 막힌다 */
  const 고침 = e.call('숙제수정', 비번, 셋.숙제.행, { 단어장: '600-1|중3|다른책|600-1', 시작: '1|1|1|11', 끝: '5|5|5|15', 칸: '|||', 유형: '스펠링', 종류: '기한', 마감일: '2026-11-24', 낸때: 셋.숙제.낸때 });
  assert.equal(고침.ok, false);
  assert.equal(줄값(e)[1], '600-1|중3|다른책');
  /* 선생님 화면은 더한 줄이 둘(합쳐 셋)이면 「교재 더하기」 를 잠근다 */
  assert.match(teacher, /function 더교재그리기\(\)[\s\S]{0,400}T\.더교재\.length >= 섞기최대_-1/);
});

/* ---------------------------------------------------------------- 묶음 */
test('공용 블록 — 섞기 규칙은 Code.gs 와 shared-ui.js 에 한 벌로 (화면 · 엔진이 같은 규칙)', () => {
  for (const f of ['범위들_', '섞기막힘_', '섞기종류_', '단어장표시_', '범위표시_', '섞인숙제인가_']) {
    assert.equal(함수떼기(code, f), 함수떼기(shared, f), f);
    assert.ok(공용.includes(`function ${f}(`), `${f} 는 공용 블록 안에`);
  }
});

test('아이 화면 — 숙제 단어를 받는 네 자리(숙제 · 시험 · 유치부 · 다시 연습)가 모두 숙제단어받기_ 를 지난다', () => {
  assert.equal((index.match(/(?<!function )숙제단어받기_\(h\)/g) || []).length, 4);
  /* 남은 api('단어가져오기') 는 숙제가 아닌 곳뿐 — 게임 · 혼자 공부(loadBook) · 문장 탭 · 숙제단어받기_ 안의 두 자리 */
  const 남은 = index.match(/api\('단어가져오기',\s*[^)]*\)/g) || [];
  assert.deepEqual(남은.map(x => x.replace(/\s/g, '')).sort(),
    ["api('단어가져오기',c.단어장)", "api('단어가져오기',h.단어장)", "api('단어가져오기',name)", "api('단어가져오기',고름)", "api('단어가져오기',책)"].sort());
});

test('check.html 은 그대로 — 섞인 숙제의 단어장 이름(600-1|중3)은 단어장 목록 어디에도 안 맞아 그냥 안 걸린다', () => {
  const out = execFileSync('git', ['status', '--porcelain', '--', 'check.html'], { cwd: new URL('.', 뿌리), encoding: 'utf8' });
  assert.equal(out.trim(), '', 'check.html 을 고치지 않았다');
  const e = 엔진();
  섞어내기(e);
  const 이름들 = new Set(e.call('선생님기본', 비번).단어장목록.map(b => b.이름));
  assert.equal(이름들.has(줄값(e)[1]), false);
  /* 숙제 체크 쪽 엔진(체크자료)이 섞인 숙제 줄을 읽어도 터지지 않는다 */
  e.call('숙제등록', 비번, { 단어장: '600-1|중3', 시작: '1|1', 끝: '5|5', 칸: '|', 유형: '스펠링', 종류: '당일', 바뀐줄만: true });
  const 체크 = e.call('체크자료', 비번, '2026-11-23');
  assert.equal(체크.ok, true, 체크.메시지);
});
