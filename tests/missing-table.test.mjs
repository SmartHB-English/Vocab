import test from 'node:test';
import assert from 'node:assert/strict';
import { TableStore } from '../services/table-store.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

/* 보관함(기록보관)·점수표가 아직 없는 자료 — 파이어스토어로 옮긴 뒤 실제로 이랬다.
   없으면 「없는 것」 으로 치고 넘어가야지, 던져서 화면을 통째로 막으면 안 된다. */
const 지금 = Date.parse('2026-10-07T12:00:00Z');
const 머리17 = ['반','단어장','시작번호','끝번호','유형','마감일','등록시각','학생','숙제종류','수업','순서','칸','제한시간','단계','통과점수','재응시','외우기분'];
const 머리기록 = ['시각','반','이름','단어장','범위','유형','문항수','정답수','점수','게임점수','최고콤보','소요초','숙제여부','틀린단어','구분','집계제외'];

function 엔진() {
  const store = new TableStore([{ name:'설정', maxRows:20, maxColumns:26, cells:{} }]);
  const 학생 = store.insertSheet('학생');
  학생.appendRow(['반','이름','비밀번호','학년구분']); 학생.appendRow(['','홍길동','1234','']);
  store.insertSheet('단어장목록').appendRow(['단어장','종류','시트이름','색','레슨묶음','과']);
  const 숙제 = store.insertSheet('숙제');
  숙제.appendRow([...머리17, '학부모숨김']);
  숙제.appendRow(['','교재A',1,10,'스펠링','2026-10-09',new Date('2026-10-05T01:00:00Z'),'홍길동','시험','','','','','','','','','']);
  store.insertSheet('기록').appendRow(머리기록);
  /* 기록보관 도 점수 도 일부러 안 만든다 */
  const 엔 = createRuntime(store, { now: () => 지금 });
  return (fn, args) => 엔.call(fn, args);
}

test('보관함이 없어도 시험을 낼 수 있다', () => {
  const r = 엔진()('결과저장', [{ 이름:'홍길동', 단어장:'교재A', 범위:'1~10', 유형:'스펠링',
    문항수:10, 정답수:9, 점수:90, 숙제여부:true, 구분:'시험' }]);
  assert.deepEqual(r, { ok: true });
});

test('보관함이 없어도 선생님 화면 기록이 불러와진다', () => {
  assert.equal(엔진()('선생님기록', ['1234']).ok, true);
});

test('보관함이 없어도 선생님 요약이 불러와진다', () => {
  assert.equal(엔진()('선생님요약', ['1234']).ok, true);
});

test('점수표가 없어도 월간순위가 돈다 — 빈 순위로', () => {
  const r = 엔진()('월간순위', ['홍길동']);
  assert.deepEqual(r.순위, []);
});

test('기록보관을 읽는 자리가 모두 보호돼 있다', async () => {
  const fs = await import('node:fs');
  const code = fs.readFileSync(new URL('./fixtures/legacy/Code.gs', import.meta.url), 'utf8');
  /* [SHEET.기록, SHEET.기록보관].forEach( … ) 묶음마다, 그 안에 지켜 읽는 장치가 있어야 한다 */
  const 묶음 = code.split('[SHEET.기록, SHEET.기록보관].forEach').slice(1);
  assert.ok(묶음.length >= 8, '묶음을 못 찾았다');
  묶음.forEach((조각, i) => {
    const 머리 = 조각.slice(0, 400);
    const 지킨다 = /try\s*{/.test(머리) || /if\s*\(!sh\)\s*return/.test(머리) || /기록칸확보_\(/.test(머리);
    assert.ok(지킨다, `${i + 1}번째 묶음이 보관함 없음을 안 지킨다 — 없으면 거기서 터진다`);
  });
});
