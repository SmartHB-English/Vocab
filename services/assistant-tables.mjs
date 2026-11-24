// 비서가 치우는 표 — 마감 지난 옛 숙제 · 숙제 예약. 엔진(Code.gs)을 거치지 않고 「자료 고치기」 의 줄지우기 로 휴지통에 보낸다
// (30일 남고 되살릴 수 있다. journal 에 누가: 비서 · 지운 줄이 남는다).
// 두 번 부른다 — 지울까 가 거짓이면 고른 줄과 확인값만 돌려준다. 참이면 다시 골라 확인값이 같을 때만 지운다.
// 기록 · 기록보관 · 알림예약 · 학생 · 단어장은 여기서 못 건드린다 — 표 이름이 아래 둘로 박혀 있다.
// 저장(잠금 · 거래 · journal)은 firestore-repository.mjs 가 __자료지우기 와 같은 길로 한다. 여기는 표(TableStore)만 만진다.
import { pack } from './store-codec.mjs';
import { 줄지우기, 서울날짜 } from './table-edit.mjs';

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
  const 글 = pack([끝행, 줄들.map(j => [j.행, j.전줄])]);
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
    .filter(j => 맞나(j.전줄)) };
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

export const 비서표함수 = { 옛숙제정리, 숙제예약정리 };
