import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 프롬프트 33 — 문장 6단계의 마지막이 영작에서 「듣고 고르기」 로.
   다섯 단계를 지나온 문장을 글자 없이 소리만 듣고 뜻(넷 중 하나)을 고른다.
   기기에 영어 목소리가 없으면 글자를 보여 주고 같은 문제를 낸다. 묶음의 「듣기」 칸(옛 「영작」 칸 자리)으로 끈다. */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const index = read('../index.html'), code = read('./fixtures/legacy/Code.gs');
function 함수(source, name) {
  const from = source.indexOf('function ' + name + '(');
  assert.ok(from >= 0, name + ' 가 없다');
  let i = source.indexOf('{', from), depth = 0;
  for (; i < source.length; i++) { if (source[i] === '{') depth++; else if (source[i] === '}' && --depth === 0) break; }
  return source.slice(from, i + 1);
}
/* index.html 의 문장 탭 칸 — 단어 쪽 영작(본문 단어장 · 수업 짜기)은 세지 않게 여기만 */
const 문장칸 = index.slice(index.indexOf('문장 — 하루 몫 · 6단계'), index.indexOf('iOS 구조 — 탭 5개'));

/* 화면 함수를 따로 돌린다 — 공용 블록(문장단계_ 등) 위에 index.html 의 문장 함수 몇 개 */
function 화면(바깥 = {}) {
  const ctx = vm.createContext({ location: { protocol: 'https:', hostname: 'example.invalid', search: '' }, 창구주소: 'firestore:v1', setTimeout, ...바깥 });
  vm.runInContext(read('../services/shared-ui.js'), ctx);
  vm.runInContext(['문장섞기_', '문장듣기보기_', '영어목소리있나_', '문장문제들_'].map(n => 함수(index, n)).join('\n'), ctx);
  return ctx;
}
const 줄 = (no, ko) => ({ no, en: 'I=주 / run=동 / ' + no, ko: ko ?? '뜻 ' + no });
const 문장줄 = (no, ko) => { const w = 줄(no, ko); return { ...w, r: {}, 것: { 끊기: false, 뼈대: null, 조립: false, 낱말: false } }; };

test('1. 문장단계_ 의 여섯째가 듣기 — 영작 키는 없다', () => {
  const 단계 = JSON.parse(JSON.stringify(화면().문장단계_));
  assert.equal(단계.length, 6);
  assert.deepEqual(단계[5], { 키: '듣기', 이름: '듣고 고르기' });
  assert.equal(단계.some(g => g.키 === '영작'), false);
});
test('2. index.html 의 문장 탭 칸 안에 「영작」 이라는 글자가 없다', () => {
  assert.ok(문장칸.length > 5000, '문장 탭 칸을 찾았다');
  assert.equal(문장칸.includes('영작'), false);
});
test('3. 영작같나_ 가 지워졌고 부르는 곳도 없다 (index · teacher · 공용)', () => {
  for (const f of ['../index.html', '../teacher.html', '../services/shared-ui.js']) assert.equal(read(f).includes('영작같나_'), false, f);
});
test('3-1. 단어 쪽 영작은 그대로 — 본문 유형 · 수업 짜기 단계', () => {
  assert.match(read('../teacher.html'), /var 본문유형_ = \['빈칸 채우기','순서 맞추기','영작','듣고 쓰기'\];/);
  assert.match(index, /write:'영작'/);
  assert.match(read('../services/shared-ui.js'), /\{ 종류: '보통', 어디: '본문', 유형: '영작' \}/);
});
test('4. Code.gs HEADERS.단어장목록 의 여덟째가 듣기', () => {
  const m = code.match(/단어장목록: \[([^\]]*)\]/);
  assert.equal(JSON.parse('[' + m[1].replace(/'/g, '"') + ']')[7], '듣기');
});

/* 엔진 */
function 엔진({ 듣기 = '', 머리글 = '듣기' } = {}) {
  const store = new TableStore([{ name: '설정', maxRows: 20, maxColumns: 26, cells: {} }]);
  const 설정 = store.getSheetByName('설정');
  설정.appendRow(['항목', '값']); 설정.appendRow(['선생님비밀번호', '5678']);
  const 목록 = store.insertSheet('단어장목록');
  목록.appendRow(['단어장', '종류', '시트이름', '색', '레슨묶음', '과', '하루몫', 머리글]);
  목록.appendRow(['초5 문장', '문장', '초5 문장', '', 10, '', '', 듣기]);
  store.insertSheet('초5 문장').appendRow(['번호', '끊은 문장', '해석', '비고']);
  store.insertSheet('문장기록').appendRow(['시각', '반', '이름', '단어장', '범위', '유형', '난이도', '문항수', '정답수', '점수', '소요초', '숙제여부', '틀린문장', '구분', '집계제외']);
  const 엔 = createRuntime(store, { now: () => Date.parse('2026-11-02T03:00:00Z') });
  return { store, call: (fn, ...args) => JSON.parse(JSON.stringify(엔.call(fn, args))) };
}
test('5. 듣기켬_ 는 빈칸이면 켬, 끔 · X 등은 끔 — 옛 영작켬_ 과 같은 말들', () => {
  assert.match(code, /function 듣기켬_\(v\) \{\n\s*return \['끔', 'x', '0', '아니오', 'no', 'off', 'false', 'n'\]\.indexOf\(s_\(v\)\.toLowerCase\(\)\) < 0;/);
  assert.equal(code.includes('영작켬_'), false);
  for (const v of ['', 'O', '켬', 'yes']) assert.equal(엔진({ 듣기: v }).call('문장진도', '홍길동', '초5 문장').듣기, true, v);
  for (const v of ['끔', 'X', 'x', '0', '아니오', 'no', 'OFF', 'false', 'N']) assert.equal(엔진({ 듣기: v }).call('문장진도', '홍길동', '초5 문장').듣기, false, v);
});
test('6. 문장진도 가 듣기를 돌려준다 (영작은 없다)', () => {
  const 답 = 엔진().call('문장진도', '홍길동', '초5 문장');
  assert.deepEqual(답, { ok: true, 진도: 0, 오늘: 0, 하루몫: 5, 듣기: true });
});
test('6-1. 옛 시트의 머리글 「영작」 은 선생님이 단어 · 문장 탭을 열 때(단어목록) 「듣기」 로 옮겨지고 값은 이어진다', () => {
  const e = 엔진({ 머리글: '영작', 듣기: '끔' });
  assert.equal(e.call('문장진도', '홍길동', '초5 문장').듣기, false, '옮기기 전에도 자리(여덟째)로 읽는다');
  assert.equal(e.call('단어목록', '틀린비번', '초5 문장').ok, false);
  assert.equal(e.store.getSheetByName('단어장목록').getRange(1, 8).getValue(), '영작', '선생님이 아니면 손대지 않는다');
  e.call('단어목록', '5678', '초5 문장');
  assert.equal(e.store.getSheetByName('단어장목록').getRange(1, 8).getValue(), '듣기');
  assert.equal(e.call('문장진도', '홍길동', '초5 문장').듣기, false);
});

/* 보기 넷 */
test('7. 보기 넷 — 정답이 들어 있고, 넷이 서로 다르고, 번호 앞뒤 20개 안에서 뽑는다', () => {
  const ui = 화면(), 줄들 = Array.from({ length: 80 }, (_, i) => 줄(i + 1));
  for (let k = 0; k < 200; k++) {
    const w = 줄들[40 + (k % 30)], 보기 = Array.from(ui.문장듣기보기_(줄들, w));
    assert.equal(보기.length, 4);
    assert.ok(보기.includes(w.ko));
    assert.equal(new Set(보기).size, 4);
    for (const t of 보기) assert.ok(Math.abs(Number(t.slice(2)) - w.no) <= 20, t + ' 가 ' + w.no + ' 에서 멀다');
  }
});
test('7-1. 앞뒤에 모자라면 묶음 전체에서 채우고, 같은 해석은 한 번만', () => {
  const ui = 화면();
  const 줄들 = [줄(1, '가'), 줄(2, '나'), 줄(3, '나'), 줄(50, '다'), 줄(51, '라'), 줄(52, '가')];
  for (let k = 0; k < 50; k++) {
    const 보기 = Array.from(ui.문장듣기보기_(줄들, 줄들[0]));
    assert.deepEqual([...보기].sort(), ['가', '나', '다', '라']);
  }
  assert.deepEqual(Array.from(ui.문장듣기보기_(줄들, 줄(9, ''))), [], '해석이 없으면 묻지 않는다');
});
test('7-2. 듣기 칸을 켜면 문장마다 듣기 문제가 나오고, 끄면 없다', () => {
  const ui = 화면(), 전체 = Array.from({ length: 10 }, (_, i) => 문장줄(i + 1)), 오늘 = 전체.slice(0, 3);
  const 켬 = Array.from(ui.문장문제들_(오늘, true, 전체)), 끔 = Array.from(ui.문장문제들_(오늘, false, 전체));
  assert.deepEqual(켬.filter(q => q.종류 === '듣기').map(q => q.w.no), [1, 2, 3]);
  assert.equal(켬.find(q => q.종류 === '듣기').보기.length, 4);
  assert.equal(끔.some(q => q.종류 === '듣기'), false);
  assert.equal(켬.length - 끔.length, 3);
});

/* 영어 목소리 */
function 가짜목소리(처음, 나중) {
  const 귀 = [];
  let 목소리들 = 처음;
  return {
    sp: { getVoices: () => 목소리들, addEventListener: (n, f) => { if (n === 'voiceschanged') 귀.push(f); }, removeEventListener() {}, cancel() {}, speak() {} },
    채우기() { 목소리들 = 나중; 귀.forEach(f => f()); }
  };
}
test('8. 영어 목소리가 없으면 글자로 — 가짜 speechSynthesis 로', async () => {
  const ui = 화면({ SpeechSynthesisUtterance: function () {} });
  assert.equal(await ui.영어목소리있나_({ getVoices: () => [{ lang: 'en-US' }, { lang: 'ko-KR' }] }), true);
  assert.equal(await ui.영어목소리있나_({ getVoices: () => [{ lang: 'ko-KR' }] }), false, '한국어 목소리만 있다');
  assert.equal(await ui.영어목소리있나_(null), false, 'speechSynthesis 가 없다');
  const 늦게영어 = 가짜목소리([], [{ lang: 'en_GB' }]), 답1 = ui.영어목소리있나_(늦게영어.sp);
  늦게영어.채우기();
  assert.equal(await 답1, true, '처음엔 비었다가 voiceschanged 로 채워진다');
  const 늦게한국어 = 가짜목소리([], [{ lang: 'ko-KR' }]), 답2 = ui.영어목소리있나_(늦게한국어.sp);
  늦게한국어.채우기();
  assert.equal(await 답2, false);
  assert.equal(await 화면().영어목소리있나_({ getVoices: () => [{ lang: 'en-US' }] }), false, '읽어주기를 못 만드는 기기');
});
test('8-1. 화면 — 소리가 나는 기기에서는 글자 없이 소리만, 없는 기기에서는 글자 · 한 번만 알림 · 다시 듣기 숨김', () => {
  const 그리기 = 함수(index, '문장판그리기_'), 듣기칸 = 그리기.slice(그리기.indexOf("q.종류==='듣기'"));
  assert.match(듣기칸, /var 글자로 = P\.목소리===false;/);
  assert.match(듣기칸, /\(글자로 \? '<div class="snright snlisten">'\+esc\(r\.글\)\+'<\/div>' : ''\)/);
  assert.match(듣기칸, /\(글자로 && P\.알림문제===P\.i \? '<div class="snnovoice">이 기기에는 영어 목소리가 없어서 글자로 보여 드려요<\/div>' : ''\)/);
  assert.match(듣기칸, /\(P\.목소리===true \? '<button type="button" class="snsay" id="snSay">🔊 다시 듣기<\/button>' : ''\)/);
  const 시작 = 함수(index, '문장듣기시작_');
  assert.match(시작, /영어목소리있나_\(\)\.then/);
  assert.match(시작, /if\(P\.목소리 === undefined\)\{ P\.목소리 = !!있다; if\(!있다\) P\.알림문제 = P\.i; \}/, '판마다 한 번만 알아본다');
  assert.match(함수(index, '문장문제그리기_'), /q\.종류==='보기' \|\| q\.종류==='듣기' \? '' : '<div class="snko">'/, '듣기 문제에는 뜻(답)을 위에 보이지 않는다');
  assert.match(함수(index, '문장문제열기_'), /문장소리끊기_\(\);\n\s*문장자리남기기_\(\);/, '다음 문제로 넘어갈 때 앞 소리를 끊는다');
});
test('9. 기록의 난이도 — 듣기를 켜면 6, 끄면 5', () => {
  assert.match(함수(index, '문장판시작_'), /var 듣기 = SN\.진도\.듣기 !== false;\n\s*SN\.판 = \{[^}]*듣기:듣기, 문제:문장문제들_\(몫\.문장, 듣기, SN\.줄\.줄\)/);
  assert.match(함수(index, '문장판끝_'), /유형:'하루 6단계', 난이도:P\.듣기 \? 6 : 5,/);
  const e = 엔진();
  for (const 난이도 of [6, 5]) {
    assert.equal(e.call('문장기록저장', { 이름: '홍길동', 단어장: '초5 문장', 범위: '1~5', 유형: '하루 6단계', 난이도, 문항수: 20, 정답수: 18, 소요초: 300, 숙제여부: false, 틀린문장: [] }).ok, true);
  }
  const 기록 = e.store.getSheetByName('문장기록');
  assert.deepEqual([기록.getRange(2, 7).getValue(), 기록.getRange(3, 7).getValue()].map(Number), [6, 5]);
});
