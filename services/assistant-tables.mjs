// 비서가 치우는 표 — 마감 지난 옛 숙제 · 숙제 예약. 엔진(Code.gs)을 거치지 않고 「자료 고치기」 의 줄지우기 로 휴지통에 보낸다
// (30일 남고 되살릴 수 있다. journal 에 누가: 비서 · 지운 줄이 남는다).
// 두 번 부른다 — 지울까 가 거짓이면 고른 줄과 확인값만 돌려준다. 참이면 다시 골라 확인값이 같을 때만 지운다.
// 기록 · 기록보관 · 알림예약 · 학생 · 단어장은 여기서 못 건드린다 — 표 이름이 아래 둘로 박혀 있다.
// 저장(잠금 · 거래 · journal)은 firestore-repository.mjs 가 __자료지우기 와 같은 길로 한다. 여기는 표(TableStore)만 만진다.
import { pack } from './store-codec.mjs';
import { 줄지우기, 칸고치기, 서울날짜 } from './table-edit.mjs';

export const 최대줄 = 300;
const 하루 = 86400000;

/* 서울 날짜 글 'YYYY-MM-DD' — Date 는 서울 시각으로, 글은 날짜 꼴일 때만. 아니면 '' */
const 서울글 = d => new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
export function 날짜글(v) {
  if (v instanceof Date) return isNaN(v) ? '' : 서울글(v);
  const d = 서울날짜(String(v ?? '').trim());
  return d ? 서울글(d) : '';
}

/* 고른 줄들의 행번호 + 줄 내용 + 표의 끝 행 → 짧은 해시 (FNV-1a 32비트 둘).
   끝 행도 넣는다 — 그 사이 숙제가 새로 나가면(뒤에 붙어 고른 줄은 그대로여도) 다시 보여 드린다 */
export function 확인값만들기(줄들, 끝행 = 0) {
  const 글 = pack([끝행, 줄들.map(j => j.할일 ? [j.행, j.전줄, j.할일] : [j.행, j.전줄])]);   // 할일(숙제지우기)도 넣는다
  let a = 0x811c9dc5, b = 0x01000193 ^ 글.length;
  for (let i = 0; i < 글.length; i++) {
    const c = 글.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

function 고르기(store, 표, 맞나) {
  const sheet = store.getSheetByName(표);
  if (!sheet) return { 끝: 0, 고른: [] };
  const 끝 = sheet.getLastRow(), 너비 = Math.max(1, sheet.getLastColumn());
  if (끝 < 2) return { 끝, 고른: [] };
  return { 끝, 고른: sheet.getRange(2, 1, 끝 - 1, 너비).getValues()
    .map((줄, i) => ({ 행: i + 2, 전줄: 줄 }))
    .filter(j => 맞나(j.전줄, j.행)) };
}

/* 미리보기 또는 지우기 — 고른 것 · 보일 꼴만 다르다 */
function 정리(store, 표, 골라, 보일꼴, 지울까, 확인값, how) {
  const { 끝, 고른 } = 고르기(store, 표, 골라);
  const 값 = 확인값만들기(고른, 끝);
  if (고른.length > 최대줄) return { ok: false, 개수: 고른.length, 메시지: '너무 많아요 — 한 번에 ' + 최대줄 + '줄까지만 지울 수 있어요 (' + 고른.length + '줄).' };
  if (!지울까) return { ok: true, 개수: 고른.length, 줄들: 고른.map(j => ({ 행: j.행, ...보일꼴(j.전줄) })), 확인값: 값 };
  if (String(확인값 ?? '') !== 값) return { ok: false, 메시지: '그 사이 ' + 표 + ' 표가 바뀌었어요. 다시 보여 드릴게요.' };
  if (!고른.length) return { ok: true, 개수: 0, 지운: [] };
  const 답 = 줄지우기(store, { 표, 줄들: 고른 }, { ...how, 누가: '비서', 더열표: [표] });
  return { ok: true, 개수: 답.지운.length, 지운: 답.지운.map(j => ({ 행: j.행, 번호: j.번호, ...보일꼴(j.줄) })) };
}

/* 숙제 표 — 마감일이 오늘(서울) − 일수 보다 앞인 줄. 마감일이 비었거나 날짜가 아니면 안 고른다 */
export function 옛숙제정리(store, [일수, 지울까, 확인값] = [], how = {}) {
  const n = 일수 === undefined || 일수 === null || 일수 === '' ? 30 : Number(일수);
  if (!(Number.isInteger(n) && n >= 0 && n <= 3650)) return { ok: false, 메시지: '일수는 0에서 3650 사이 정수로 주세요.' };
  const 기준 = 서울글(new Date((how.지금 ?? Date.now()) - n * 하루));
  const 보일꼴 = 줄 => ({ 마감일: 날짜글(줄[5]), 단어장: String(줄[1] ?? ''), 범위: 줄[2] === '' && 줄[3] === '' ? '' : 줄[2] + '~' + 줄[3],
    종류: String(줄[8] ?? ''), 학생: String(줄[7] ?? '') });
  return 정리(store, '숙제', 줄 => { const d = 날짜글(줄[5]); return !!d && d < 기준; }, 보일꼴, !!지울까, 확인값, how);
}

/* 숙제예약 표 — '전부' 는 모든 줄, '보낸것' 은 보낸때 가 찬 줄만 */
export function 숙제예약정리(store, [범위, 지울까, 확인값] = [], how = {}) {
  if (범위 !== '전부' && 범위 !== '보낸것') return { ok: false, 메시지: '범위는 「전부」 나 「보낸것」 으로 주세요.' };
  const 찼다 = v => v instanceof Date || String(v ?? '').trim() !== '';
  const 글 = v => v instanceof Date ? 날짜글(v) : String(v ?? '');
  const 보일꼴 = 줄 => ({ 날짜: 글(줄[1]), 시각: 글(줄[2]), 요약: String(줄[3] ?? ''), 보낸때: v보낸(줄[6]), 묶음: String(줄[8] ?? '') });
  const v보낸 = v => v instanceof Date ? new Date(v.getTime() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : String(v ?? '');
  return 정리(store, '숙제예약', 범위 === '전부' ? 줄 => 줄.some(찼다) : 줄 => 찼다(줄[6]), 보일꼴, !!지울까, 확인값, how);
}

/* ---------------- 골라 지우기 — 원장님이 「이거 지워」 한 숙제 · 숙제 예약 ---------------- */
const 고르라 = { ok: false, 메시지: '무엇을 지울지 골라 주세요.' };
const 보통 = v => v !== undefined && v !== null && String(v).trim() !== '';
const 행들맞나 = 행들 => Array.isArray(행들) && 행들.length > 0 && 행들.every(n => Number.isInteger(n) && n >= 2);
const 이름들풀기 = v => [...new Set(String(v ?? '').split(/\s*[,|]\s*/).map(x => x.trim()).filter(Boolean))];   // 엔진 이름들풀기_ 와 같다
const 숙제보일꼴 = 줄 => ({ 마감일: 날짜글(줄[5]), 단어장: String(줄[1] ?? ''), 범위: 줄[2] === '' && 줄[3] === '' ? '' : 줄[2] + '~' + 줄[3],
  종류: String(줄[8] ?? ''), 학생: String(줄[7] ?? '') });
const 못뺌 = '교재로 나간 숙제라 한 아이만 뺄 수 없어요 — 선생님 화면에서';

/* 숙제 표 — 행 번호로, 또는 칸(학생 · 단어장 · 마감일 · 시작 · 끝 · 종류)이 모두 맞는 줄.
   학생을 주면 그 아이만 뺀다: 혼자면 줄을 휴지통으로(지움), 다른 아이도 있으면 학생 칸에서 이름만(이름뺌),
   학생 칸이 비었으면(교재로 받는 숙제) 손대지 않는다(못함). 기록 · 기록보관 은 안 건드린다 */
export function 숙제지우기(store, [골라, 지울까, 확인값] = [], how = {}) {
  if (!골라 || typeof 골라 !== 'object' || Array.isArray(골라)) return 고르라;
  const 행으로 = 골라.행들 !== undefined;
  let 맞나;
  const 학생 = 보통(골라.학생) ? String(골라.학생).trim() : '';
  if (행으로) {
    if (!행들맞나(골라.행들)) return 고르라;
    const 고른행 = new Set(골라.행들);
    맞나 = (줄, 행) => 고른행.has(행);
  } else {
    if (!학생 && !보통(골라.단어장) && !보통(골라.마감일)) return 고르라;
    const 마감 = 보통(골라.마감일) ? 날짜글(골라.마감일) : '';
    if (보통(골라.마감일) && !마감) return { ok: false, 메시지: '마감일을 날짜로 주세요.' };
    const 수 = k => 보통(골라[k]) ? Number(골라[k]) : null;
    const 시작 = 수('시작'), 끝 = 수('끝');
    if ([시작, 끝].some(n => n !== null && !Number.isFinite(n))) return { ok: false, 메시지: '시작 · 끝은 숫자로 주세요.' };
    맞나 = 줄 => (!학생 || 줄[7] === '' || 줄[7] == null || 이름들풀기(줄[7]).includes(학생))
      && (!보통(골라.단어장) || String(줄[1] ?? '').trim() === String(골라.단어장).trim())
      && (!마감 || 날짜글(줄[5]) === 마감)
      && (시작 === null || Number(줄[2]) === 시작) && (끝 === null || Number(줄[3]) === 끝)
      && (!보통(골라.종류) || String(줄[8] ?? '').trim() === String(골라.종류).trim());
  }
  const sheet = store.getSheetByName('숙제');
  const 끝행 = sheet ? sheet.getLastRow() : 0, 너비 = sheet ? Math.max(1, sheet.getLastColumn()) : 1;
  const 줄들 = 끝행 < 2 ? [] : sheet.getRange(2, 1, 끝행 - 1, 너비).getValues().map((줄, i) => ({ 행: i + 2, 전줄: 줄 }));
  const 고른 = 줄들.filter(j => 맞나(j.전줄, j.행)).map(j => {
    const 이름들 = 이름들풀기(j.전줄[7]);
    const 할일 = !학생 ? '지움' : !이름들.length ? '못함' : 이름들.length === 1 && 이름들[0] === 학생 ? '지움' : 이름들.includes(학생) ? '이름뺌' : '못함';
    return { ...j, 할일, 이름들 };
  });
  if (고른.length > 최대줄) return { ok: false, 개수: 고른.length, 메시지: '너무 많아요 — 한 번에 ' + 최대줄 + '줄까지만 지울 수 있어요 (' + 고른.length + '줄).' };
  const 값 = 확인값만들기(고른, 끝행);
  if (!지울까) return { ok: true, 개수: 고른.length, 줄들: 고른.map(j => ({ 행: j.행, 할일: j.할일, ...(j.할일 === '못함' ? { 까닭: 못뺌 } : {}),
    ...숙제보일꼴(j.전줄), 교재로받음: !j.이름들.length })), 확인값: 값 };
  if (String(확인값 ?? '') !== 값) return { ok: false, 메시지: '그 사이 숙제 표가 바뀌었어요. 다시 보여 드릴게요.' };
  const 못한 = 고른.filter(j => j.할일 === '못함').map(j => ({ 행: j.행, 까닭: 못뺌 }));
  /* 이름뺌 먼저 — 줄을 지우면 아래 행이 밀린다 */
  const 이름뺀 = 고른.filter(j => j.할일 === '이름뺌').map(j => {
    const 답 = 칸고치기(store, { 표: '숙제', 행: j.행, 열: 8, 전줄: j.전줄, 값: j.이름들.filter(n => n !== 학생).join(', ') });
    return { 행: j.행, 전: String(답.전 ?? ''), 학생: String(답.후 ?? '') };
  });
  const 지울 = 고른.filter(j => j.할일 === '지움');
  const 지운 = 지울.length ? 줄지우기(store, { 표: '숙제', 줄들: 지울 }, { ...how, 누가: '비서', 더열표: ['숙제'] }).지운
    .map(j => ({ 행: j.행, 번호: j.번호, ...숙제보일꼴(j.줄) })) : [];
  return { ok: true, 개수: 지운.length + 이름뺀.length, 지운, 이름뺀, 못한 };
}

/* 숙제예약 표 — 행 번호로, 묶음 전부, 또는 그날(보낸것만 이면 보낸때 찬 줄만). 한 줄에 한 아이라 이름 빼기는 없다 */
export function 숙제예약지우기(store, [골라, 지울까, 확인값] = [], how = {}) {
  if (!골라 || typeof 골라 !== 'object' || Array.isArray(골라)) return 고르라;
  const 찼다 = v => v instanceof Date || String(v ?? '').trim() !== '';
  const 글 = v => v instanceof Date ? 날짜글(v) : String(v ?? '').trim();
  let 맞나;
  if (골라.행들 !== undefined) {
    if (!행들맞나(골라.행들)) return 고르라;
    const 고른행 = new Set(골라.행들);
    맞나 = (줄, 행) => 고른행.has(행) && 줄.some(찼다);
  } else if (보통(골라.묶음)) {
    const 묶음 = String(골라.묶음).trim();
    맞나 = 줄 => String(줄[8] ?? '').trim() === 묶음;
  } else if (보통(골라.날짜)) {
    const 날 = 날짜글(골라.날짜);
    if (!날) return { ok: false, 메시지: '날짜를 날짜로 주세요.' };
    맞나 = 줄 => (글(줄[1]) === 날 || 날짜글(줄[1]) === 날) && (!골라.보낸것만 || 찼다(줄[6]));
  } else return 고르라;
  const 보일꼴 = 줄 => ({ 날짜: 글(줄[1]), 시각: 글(줄[2]), 요약: String(줄[3] ?? ''), 보낸때: v보낸(줄[6]), 묶음: String(줄[8] ?? '') });
  const v보낸 = v => v instanceof Date ? new Date(v.getTime() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : String(v ?? '');
  return 정리(store, '숙제예약', 맞나, 보일꼴, !!지울까, 확인값, how);
}

export const 비서표함수 = { 옛숙제정리, 숙제예약정리, 숙제지우기, 숙제예약지우기 };
