import assert from 'node:assert/strict';
import test from 'node:test';
import { legacy, plain, record } from './helpers/legacy-server.mjs';

const student = ['테스트반', '테스트 학생', '0011', '초중등', '교재B', '', '', '교재A'];
test('login: preserve whitespace name matching, leading-zero PIN and textbook assignment', () => {
  const c = legacy({ 학생: [student] });
  assert.deepEqual(plain(c.로그인(' 테스트학생 ', ' 0011 ')), {
    ok: true, 학생: { 이름: '테스트 학생', 학년구분: '초중등' }, 단어장목록: [{ 이름: '교재A', 색: 'orange' }],
  });
  assert.equal(c.로그인('테스트학생', '11').ok, false);
});
test('login: exact name takes precedence over a whitespace-normalized candidate', () => {
  const c = legacy({ 학생: [student, ['', '테스트학생', '0022', '고등', '', '', '', '']] });
  assert.equal(c.로그인('테스트학생', '0022').학생.학년구분, '고등');
});
test('login: preserve unknown-name and wrong-PIN messages; never return credentials', () => {
  const c = legacy({ 학생: [student] });
  assert.match(c.로그인('없는학생', '0011').메시지, /명단에 없는/);
  assert.equal(c.로그인('테스트 학생', 'wrong').메시지, '비밀번호가 달라요.');
  assert.ok(!JSON.stringify(c.로그인('테스트 학생', '0011')).includes('0011'));
});
test('login: empty textbook assignment means all books, regardless of old visibility column', () => {
  const row = [...student]; row[7] = '';
  assert.equal(legacy({ 학생: [row] }).로그인('테스트 학생', '0011').단어장목록.length, 2);
});
test('teacher: configured password and failure result remain unchanged', () => {
  const c = legacy({ 설정: [['선생님비밀번호', 'fixture-teacher']] });
  assert.deepEqual(plain(c.선생님로그인(' fixture-teacher ')), { ok: true });
  assert.deepEqual(plain(c.선생님로그인('wrong')), { ok: false });
});

for (const kind of ['당일', '보충']) {
  test(`completion ${kind}: same-day and exact pass threshold`, () => {
    const c = legacy();
    assert.equal(c.낸것_({ '2026-10-06': 100, '2026-10-07': 79 }, kind, '', '2026-10-07'), null);
    assert.deepEqual(plain(c.낸것_({ '2026-10-07': 80 }, kind, '', '2026-10-07')), { 날: '2026-10-07', 점수: 80 });
  });
}
test('completion deadline: ignore before-assignment attempts and choose latest passing day', () => {
  const c = legacy();
  assert.equal(c.낸것_({ '2026-10-05': 100 }, '기한', '2026-10-06', '2026-10-07'), null);
  assert.deepEqual(plain(c.낸것_({ '2026-10-06': 100, '2026-10-07': 80, '2026-10-08': 79 }, '기한', '2026-10-06', '2026-10-08')), { 날: '2026-10-07', 점수: 80 });
});
test('exam: zero score still counts as an attempt/completion', () => {
  assert.deepEqual(plain(legacy().낸것_({ '2026-10-07': 0 }, '시험', '2026-10-06', '2026-10-07')), { 날: '2026-10-07', 점수: 0 });
});
test('completion map: archives, daily maximum, student isolation and retest exclusion', () => {
  const c = legacy({ 기록: [record({score: 79}), record({score: 100, kind: '오답 재시험'}), record({name: '다른학생', score: 100})], 기록보관: [record({score: 90})] });
  assert.deepEqual(plain(c.완료점수들_('테스트학생')), { '교재A|1~10': { '2026-10-07': 90 } });
});
test('date boundary: UTC records use academy day in Seoul', () => {
  const c = legacy({ 기록: [record({at: '2026-10-06T14:59:59Z',score: 81}), record({at: '2026-10-06T15:00:00Z',score: 82})] });
  assert.deepEqual(plain(c.완료점수들_('테스트학생')), { '교재A|1~10': { '2026-10-06': 81, '2026-10-07': 82 } });
});
test('assignment: explicit student outranks class and textbook routing', () => {
  const c = legacy(), books = { A: ['교재A'], B: ['교재B'] }, classes = { 반1: ['A'] };
  assert.equal(c.내숙제인가_({학생:'B',반:'반1',단어장:'교재A'},'A',books,classes), false);
  assert.equal(c.내숙제인가_({학생:'B',반:'반1',단어장:'교재A'},'B',books,classes), true);
  assert.equal(c.내숙제인가_({반:'반1',단어장:'교재B'},'A',books,classes), true);
  assert.equal(c.내숙제인가_({단어장:'교재A'},'B',books,classes), false);
});
test('staged exam: completion uses last attempt, extra attempts extend limit', () => {
  const c = legacy();
  const result = c.단계상태_('시험',80,1,[{점수:90,틀린:[]},{점수:70,틀린:['a']}],2);
  assert.equal(result.완료, false);
  assert.equal(result.남은응시,2);
  assert.deepEqual(plain(c.단계상태_('연습',80,0,[{점수:0}],0)), {완료:true,응시수:1,마지막점수:0});
});
test('monthly ranking: blank excluded, zero included, other classes and months excluded', () => {
  const c = legacy({ 점수: [
    [new Date('2026-10-07T00:00:00Z'),'반1','A','시험',100],
    [new Date('2026-10-07T00:00:00Z'),'반1','A','시험',0],
    [new Date('2026-10-07T00:00:00Z'),'반1','B','시험',''],
    [new Date('2026-10-07T00:00:00Z'),'반2','C','시험',100],
    [new Date('2026-09-07T00:00:00Z'),'반1','B','시험',90],
  ] });
  const r = c.월간순위('반1');
  assert.deepEqual(plain(r.순위), [{이름:'A',점수:50}]);
  assert.deepEqual(plain(r.시상), [{이름:'B',점수:90}]);
});
test('history: newest 20 own entries with stable numeric types', () => {
  const rows = Array.from({length:25},(_,i)=>record({score:i})); rows.push(record({name:'다른학생',score:99}));
  const r = legacy({기록:rows}).내기록('테스트학생');
  assert.equal(r.length,20); assert.equal(r[0].점수,24); assert.equal(r[19].점수,5);
});
test('parent: reject unknown token; normalize case; push lookup does not record a visit', () => {
  const token = 'a'.repeat(64), row = [...student,token,'',''];
  const c = legacy({학생:[row]}); let visits = 0;
  c.캐시읽기_ = () => null; c.캐시담기_ = () => {};
  c.학부모칸확보_ = () => ({getRange:()=>({setValue:()=>{visits++;}})});
  c.학부모자료_ = name => ({ok:true,이름:name,안낸수:2,비공개상세:'fixture'});
  assert.equal(c.학부모보기('bad').ok,false);
  assert.equal(c.학부모보기('b'.repeat(64)).ok,false);
  assert.deepEqual(plain(c.학부모보기(token.toUpperCase(),true)),{ok:true,이름:'테스트 학생',안낸수:2});
  assert.equal(visits,0);
  assert.equal(c.학부모보기(token).ok,true); assert.equal(visits,1);
});
test('result: preserve full wrong-answer note and reject repeated exam using archive', () => {
  const rows = [], notes = []; let released = 0;
  const c = legacy({});
  c.rows_ = name => name === '기록' ? rows : name === '기록보관' ? [record({kind:'시험',range:'11~20'})] : [];
  c.캐시읽기_ = () => true;
  c.LockService = {getScriptLock:()=>({waitLock(){},releaseLock(){released++;}})};
  c.SpreadsheetApp = {WrapStrategy:{CLIP:'CLIP'}};
  const range = {setWrapStrategy(){return this;},setVerticalAlignment(){return this;},setNumberFormat(){return this;},setNote(value){notes.push(value);return this;}};
  c.sheet_ = () => ({appendRow:r=>rows.push(r),getLastRow:()=>rows.length+1,getRange:()=>range});
  const payload = {이름:'테스트학생',단어장:'교재A',범위:'1~10',구분:'시험',틀린단어:'a,b,c,d,e,f',점수:40};
  assert.equal(c.결과저장(payload).ok,true);
  assert.match(rows[0][13],/외 1개/); assert.match(notes[0],/\nf$/);
  assert.equal(c.결과저장(payload).이미봄,true);
  assert.equal(c.결과저장({...payload,범위:'11~20'}).이미봄,true);
  assert.equal(rows.length,1); assert.equal(released,3);
});
test('result: lock contention returns retry message without writing', () => {
  const c = legacy(); c.LockService = {getScriptLock:()=>({waitLock(){throw new Error('busy');}})};
  c.sheet_ = () => {throw new Error('must not write');};
  assert.match(c.결과저장({}).메시지,/잠시 후/);
});
