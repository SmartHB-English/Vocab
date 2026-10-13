// 선생님 「자료」 탭 — 표를 칸째로 고치고, 줄을 지우고(휴지통으로), 되살린다.
// 업무 엔진(Code.gs, 운영 v80 고정)을 거치지 않는다. 순위·연습 점수 같은 계산 값은 여기서 쓰지 않고,
// 고친 원본(표)으로 엔진이 다음에 부를 때 다시 센다.
// 저장은 firestore-repository.mjs 가 엔진 때와 같은 거래(transaction)로 한다 — 여기는 표(TableStore)만 만진다.
import { pack } from './store-codec.mjs';

export const 휴지통이름 = '휴지통';
export const 휴지통머리 = ['지운때', '표', '원래행', '내용', '메모', '비밀', '번호', '지운사람'];
const 비밀열 = 6;                     // 휴지통의 「비밀」 칸 — 학생 비밀번호·학부모 링크는 여기로 (공개 표에는 비운다)
export const 보관일수 = 30;
const 하루 = 86400000;

/* 지운 줄에서 떼어 둘 칸 — store-codec.publicTable 이 공개 표에서 비우는 칸과 같다 */
const 비밀칸들 = { 학생: [3, 9] };
/* 날짜로 읽을 머리글 — 빈 칸에 날짜를 적었을 때 글이 아니라 날짜로 넣는다 */
const 날짜머리 = new Set(['시각', '날짜', '등록시각', '마감일', '켠때', '만든때', '끝나는날', '학부모마지막', '지운때']);

export class 충돌 extends Error {
  constructor(메시지) { super(메시지); this.code = '충돌'; }
}

/* 「자료」 탭에서 고를 수 있는 표 — 있는 것만, 이 차례로 */
export function 자료표목록(store) {
  const 목록 = [];
  const 넣기 = (이름, 보일이름, 묶음) => { if (store.getSheetByName(이름)) 목록.push({ 이름, 보일이름, 묶음 }); };
  넣기('학생', '학생 명단', '학생');
  넣기('숙제', '숙제', '숙제');
  넣기('기록', '숙제 결과', '숙제');
  넣기('기록보관', '지난 숙제 결과', '숙제');
  넣기('점수', '시험 점수', '숙제');
  넣기('단어장목록', '단어장 목록', '단어장');
  const 책 = store.getSheetByName('단어장목록');
  const 본것 = new Set();
  if (책) for (let r = 2; r <= 책.getLastRow(); r++) {
    const [이름, , 시트] = 책.getRange(r, 1, 1, 3).getValues()[0].map(v => String(v ?? '').trim());
    if (시트 && !본것.has(시트) && store.getSheetByName(시트)) { 본것.add(시트); 목록.push({ 이름: 시트, 보일이름: '단어장 · ' + (이름 || 시트), 묶음: '단어장' }); }
  }
  for (const s of store.getSheets()) if (s.getName().startsWith('단어_') && !본것.has(s.getName())) 목록.push({ 이름: s.getName(), 보일이름: '단어장 · ' + s.getName().slice(3), 묶음: '단어장' });
  return 목록;
}
export const 고칠수있나 = (store, 이름) => 자료표목록(store).some(t => t.이름 === 이름);

/* 한 줄 — 뒤의 빈 칸은 떼어 비교한다 (그 사이 다른 줄 때문에 표 폭이 늘어도 같은 줄로 본다) */
const 줄자르기 = 줄 => { const a = 줄.map(v => v ?? ''); while (a.length && a[a.length - 1] === '') a.pop(); return a; };
export const 줄글 = 줄 => pack(줄자르기(줄));
const 폭 = (sheet, 더 = 0) => Math.max(1, sheet.getLastColumn(), 더);
const 줄읽기 = (sheet, 행, 너비 = 폭(sheet)) => sheet.getRange(행, 1, 1, 너비).getValues()[0];
const 메모읽기 = (sheet, 행, 너비 = 폭(sheet)) => sheet.getRange(행, 1, 1, 너비).getNotes()[0];

/* 받은 「바꾸기 전 줄」 이 지금 그 줄과 같은지 — 다르면 그 사이 누가 고쳤거나 줄이 밀렸다 */
function 그대로인가(sheet, 행, 전줄) {
  if (!Array.isArray(전줄)) throw new Error('바꾸기 전 줄이 없어요.');
  if (행 > sheet.getMaxRows()) return 줄자르기(전줄).length === 0;
  return 줄글(줄읽기(sheet, 행, 폭(sheet, 전줄.length))) === 줄글(전줄);   // 화면이 받은 날짜는 {$date} 그대로 — pack 도 날짜를 그렇게 적는다
}

/* 서울 시각으로 적은 날짜 글 → Date. 「2026-10-07」 · 「2026-10-07 21:05」 */
export function 서울날짜(글) {
  const m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(글).trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], (+m[4] || 0) - 9, +m[5] || 0, +m[6] || 0));
  return isNaN(d) ? null : d;
}

/* 화면에서 적은 글을 칸의 원래 꼴에 맞춘다. 비밀번호 「0011」 처럼 숫자로 바꾸면 달라지는 글은 글로 둔다 */
export function 값맞추기(옛값, 새값, 머리 = '') {
  if (새값 && typeof 새값 === 'object' && '$date' in 새값) return new Date(새값.$date);
  if (typeof 새값 === 'number' || typeof 새값 === 'boolean') return 새값;
  const 글 = String(새값 ?? '').trim();
  if (글 === '') return '';
  if (옛값 instanceof Date || (옛값 === '' && 날짜머리.has(머리))) return 서울날짜(글) ?? 글;
  const 숫자같다 = /^-?\d+(\.\d+)?$/.test(글) && String(Number(글)) === 글;
  if ((typeof 옛값 === 'number' || 옛값 === '') && 숫자같다) return Number(글);
  if (typeof 옛값 === 'boolean' && /^(true|false)$/i.test(글)) return /^true$/i.test(글);
  return 글;
}

function 표찾기(store, 이름) {
  if (!고칠수있나(store, 이름)) throw new Error('고칠 수 없는 표예요: ' + 이름);
  return store.getSheetByName(이름);
}
const 행맞나 = 행 => Number.isInteger(행) && 행 >= 2;   // 1행은 머리글 — 안 고친다

/* 칸 하나 고치기 */
export function 칸고치기(store, { 표, 행, 열, 전줄, 값 } = {}) {
  const sheet = 표찾기(store, 표);
  if (!행맞나(행) || !Number.isInteger(열) || 열 < 1) throw new Error('고칠 칸이 맞지 않아요.');
  if (!그대로인가(sheet, 행, 전줄)) throw new 충돌('그 사이 다른 곳에서 이 줄이 바뀌었어요. 새로 불러온 뒤 다시 고쳐 주세요.');
  if (행 > sheet.getMaxRows()) sheet.maxRows = 행;
  if (열 > sheet.getMaxColumns()) sheet.maxColumns = 열;
  const 머리 = String(sheet.getRange(1, 열).getValue() ?? '').trim();
  const 전 = sheet.getRange(행, 열).getValue();
  const 후 = 값맞추기(전, 값, 머리);
  sheet.getRange(행, 열).setValue(후);
  return { 표, 행, 열, 머리, 전, 후, 후줄: 줄읽기(sheet, 행) };
}

function 휴지통(store) {
  let sheet = store.getSheetByName(휴지통이름);
  if (!sheet) {
    sheet = store.insertSheet(휴지통이름);
    sheet.getRange(1, 1, 1, 휴지통머리.length).setValues([휴지통머리]);
  }
  return sheet;
}

/* 줄 지우기 — 하나라도 그 사이 바뀌었으면 하나도 안 지운다. 지운 줄은 휴지통 표로 */
export function 줄지우기(store, { 표, 줄들 } = {}, { 지금 = Date.now(), 누가 = '선생님', 번호 } = {}) {
  const sheet = 표찾기(store, 표);
  if (!Array.isArray(줄들) || !줄들.length) throw new Error('지울 줄을 골라 주세요.');
  const 행들 = 줄들.map(j => j.행);
  if (!행들.every(행맞나) || new Set(행들).size !== 행들.length) throw new Error('지울 줄이 맞지 않아요.');
  const 바뀐 = 줄들.filter(j => !그대로인가(sheet, j.행, j.전줄));
  if (바뀐.length) throw new 충돌('그 사이 다른 곳에서 ' + 바뀐.length + '줄이 바뀌었어요. 새로 불러온 뒤 다시 골라 주세요.');
  const 통 = 휴지통(store), 너비 = 폭(sheet), 비밀 = 비밀칸들[표] || [];
  const 지운 = [];
  for (const 행 of [...행들].sort((a, b) => a - b)) {
    const 값들 = 줄읽기(sheet, 행, 너비), 메모들 = 메모읽기(sheet, 행, 너비);
    const 공개 = 값들.map((v, i) => 비밀.includes(i + 1) ? '' : v);
    const 숨김 = 비밀.some(c => 값들[c - 1] !== '' && 값들[c - 1] != null) ? pack(Object.fromEntries(비밀.map(c => [c, 값들[c - 1] ?? '']))) : '';
    const n = 번호 ? 번호() : Math.random().toString(36).slice(2, 12);
    통.appendRow([new Date(지금), 표, 행, pack(공개), 메모들.some(Boolean) ? pack(메모들) : '', 숨김, n, 누가]);
    지운.push({ 행, 번호: n, 줄: 공개 });
  }
  for (const 행 of [...행들].sort((a, b) => b - a)) sheet.deleteRow(행);
  return { 표, 지운 };
}

/* 줄 하나를 행 자리에 끼운다 (아래 줄은 한 칸씩 내려간다) */
function 줄끼우기(sheet, 행, 값들, 메모들) {
  const cells = {};
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [r, c] = key.split(':').map(Number);
    cells[r >= 행 ? `${r + 1}:${c}` : key] = cell;
  }
  sheet.cells = cells;
  sheet.maxRows = Math.max(sheet.maxRows, sheet.getLastRow(), 행) + 1;
  sheet.maxColumns = Math.max(sheet.maxColumns, 값들.length);
  sheet.getRange(행, 1, 1, 값들.length).setValues([값들]);
  if (메모들 && 메모들.length) sheet.getRange(행, 1, 1, 메모들.length).setNotes([메모들.slice(0, 값들.length).concat(Array(Math.max(0, 값들.length - 메모들.length)).fill(''))]);
  sheet.dirty = true;
}

const 풀기 = 글 => 글 ? JSON.parse(글, (_, v) => v && typeof v === 'object' && Object.keys(v).length === 1 && '$date' in v ? new Date(v.$date) : v) : null;

/* 휴지통에서 되살리기 — 원래 자리(그 표가 짧아졌으면 맨 끝)로 */
export function 되살리기(store, { 번호들 } = {}) {
  const 통 = store.getSheetByName(휴지통이름);
  if (!Array.isArray(번호들) || !번호들.length) throw new Error('되살릴 줄을 골라 주세요.');
  const 찾음 = [];
  for (const n of 번호들) {
    let 행 = 0;
    if (통) for (let r = 2; r <= 통.getLastRow(); r++) if (String(통.getRange(r, 7).getValue()) === String(n)) { 행 = r; break; }
    if (!행) throw new 충돌('이미 되살렸거나 휴지통에서 비운 줄이에요. 새로 불러와 주세요.');
    const [지운때, 표, 원래행, 내용, 메모, 숨김] = 통.getRange(행, 1, 1, 6).getValues()[0];
    if (!store.getSheetByName(표)) throw new Error('「' + 표 + '」 표가 없어서 되살릴 수 없어요.');
    const 값들 = 풀기(내용) || [];
    const 비밀 = 풀기(숨김) || {};
    for (const [c, v] of Object.entries(비밀)) 값들[Number(c) - 1] = v;
    찾음.push({ 통행: 행, 번호: n, 지운때, 표, 원래행: Number(원래행) || 2, 값들: 값들.map(v => v ?? ''), 메모들: 풀기(메모) });
  }
  // 같은 표의 여러 줄은 위에서부터 끼워야 원래 차례로 돌아간다
  const 되살린 = [];
  for (const j of [...찾음].sort((a, b) => a.표 < b.표 ? -1 : a.표 > b.표 ? 1 : a.원래행 - b.원래행)) {
    const sheet = store.getSheetByName(j.표);
    const 행 = Math.max(2, Math.min(j.원래행, sheet.getLastRow() + 1));
    줄끼우기(sheet, 행, j.값들, j.메모들);
    되살린.push({ 표: j.표, 행, 번호: j.번호, 줄: j.값들.map((v, i) => (비밀칸들[j.표] || []).includes(i + 1) ? '' : v) });
  }
  for (const 행 of 찾음.map(j => j.통행).sort((a, b) => b - a)) 통.deleteRow(행);
  return { 되살린 };
}

/* 30일 지난 휴지통 줄을 비운다. 비울 게 없으면 표를 건드리지 않는다(저장도 안 한다) */
export function 휴지통비우기(store, _ = {}, { 지금 = Date.now() } = {}) {
  const 통 = store.getSheetByName(휴지통이름);
  if (!통) return { 비운: 0 };
  const 기한 = 지금 - 보관일수 * 하루, 지울 = [];
  for (let r = 2; r <= 통.getLastRow(); r++) {
    const t = 통.getRange(r, 1).getValue();
    const ms = t instanceof Date ? t.getTime() : NaN;
    if (!isNaN(ms) && ms < 기한) 지울.push(r);
  }
  for (const r of 지울.sort((a, b) => b - a)) 통.deleteRow(r);
  return { 비운: 지울.length };
}

/* 화면으로 보낼 표 — 머리글과 줄들. 설정의 비밀(선생님 비밀번호 · 푸시 비밀키)은 비운다 */
export function 표꺼내기(store, 이름) {
  const sheet = store.getSheetByName(이름);
  if (!sheet) return null;
  const 너비 = 폭(sheet), 끝 = sheet.getLastRow();
  const 줄들 = 끝 ? sheet.getRange(1, 1, 끝, 너비).getValues() : [];
  if (이름 === '설정') for (const 줄 of 줄들.slice(1)) if (['선생님비밀번호', '푸시비밀키'].includes(String(줄[0]).trim())) 줄[1] = '';
  return { 이름, 머리: 줄들[0] || [], 줄들: 줄들.slice(1) };
}

/* 화면에서 부르는 이름 → 하는 일. 읽기는 표를 안 바꾼다 */
export function 자료읽기(store, { 이름들, 모두 } = {}) {
  const 목록 = 자료표목록(store);
  const 고를것 = 모두 ? store.getSheets().map(s => s.getName()) : (이름들 || []);
  return { 목록, 표들: 고를것.map(n => 표꺼내기(store, n)).filter(Boolean) };
}

/* 휴지통 표의 공개본 — 「비밀」 칸을 비운다 (학생도 표를 읽을 수 있다). 비운 것은 secrets 로 간다 */
export function 휴지통공개(table) {
  const cells = Object.fromEntries(Object.entries(table.cells).map(([key, cell]) => {
    const [r, c] = key.split(':').map(Number);
    return [key, r > 1 && c === 비밀열 ? { ...cell, value: '', note: '' } : cell];
  }));
  return { ...table, cells };
}
