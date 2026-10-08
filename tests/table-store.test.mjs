import test from 'node:test';
import assert from 'node:assert/strict';
import { TableStore } from '../services/table-store.mjs';
import { createSeoulDate, formatDate } from '../services/seoul-date.mjs';
import { createRuntime } from '../services/legacy-runtime.mjs';

function table() { return new TableStore([{ name: '기록', maxRows: 20, maxColumns: 26, cells: {} }]); }
test('delete rows preserves the values and notes on shifted records', () => {
  const store = table(), s = store.getSheetByName('기록');
  s.getRange(1, 1, 4, 2).setValues([['날짜', '이름'], ['a', 'A'], ['b', 'B'], ['c', 'C']]);
  s.getRange(4, 2).setNote('full wrong words');
  s.deleteRows(2, 2);
  assert.deepEqual(s.getRange('A1:B2').getValues(), [['날짜', '이름'], ['c', 'C']]);
  assert.equal(s.getRange(2, 2).getNote(), 'full wrong words');
  assert.equal(s.getLastRow(), 2);
});
test('clearContent retains notes; clear removes values and notes', () => {
  const s = table().getSheetByName('기록'), r = s.getRange(2, 2);
  r.setValue(0).setNote('note'); assert.equal(s.getLastRow(), 2);
  r.clearContent(); assert.equal(r.getNote(), 'note'); assert.equal(s.getLastRow(), 0);
  r.clear(); assert.equal(r.getNote(), '');
});
test('range values are isolated; shape and boundary failures do not partially write', () => {
  const s = table().getSheetByName('기록');
  s.getRange(1,1,1,2).setValues([[false, new Date('2026-10-07T00:00:00Z')]]);
  const values=s.getRange(1,1,1,2).getValues(); values[0][1].setUTCFullYear(2000);
  assert.equal(s.getRange(1,2).getValue().getUTCFullYear(),2026);
  assert.throws(() => s.getRange(1,1,2,2).setValues([[1,2],[3]]), /shape/);
  assert.equal(s.getRange(1,1).getValue(),false);
  assert.throws(() => s.getRange(21,1), /bounds/);
});
test('append uses last populated row; formatting does not inflate data extent', () => {
  const s=table().getSheetByName('기록'); s.getRange(20,26).setNumberFormat('0');
  s.appendRow(['header']); s.appendRow(['0011',0,false]);
  assert.equal(s.getLastRow(),2); assert.equal(s.getLastColumn(),3);
  assert.deepEqual(s.getRange(2,1,1,3).getValues(),[['0011',0,false]]);
});
test('inserting columns and renaming preserve cell positions and reject collisions', () => {
  const store=table(), s=store.getSheetByName('기록'); s.getRange(2,2).setValue('x').setNote('y');
  s.insertColumnsAfter(1,2); assert.equal(s.getRange(2,4).getNote(),'y');
  store.insertSheet('other'); assert.throws(() => s.setName('other'), /Duplicate/);
  s.setName('renamed'); assert.equal(store.getSheetByName('기록'),null);
  assert.equal(store.getSheetByName('renamed').getRange(2,4).getValue(),'x');
});
test('Seoul calendar operations retain midnight and month boundaries', () => {
  const D=createSeoulDate(() => new Date('2026-10-07T15:00:01Z').getTime());
  const d=new D(); assert.equal(d.getDate(),8); assert.equal(d.getHours(),0);
  d.setHours(0,0,0,0); assert.equal(d.toISOString(),'2026-10-07T15:00:00.000Z');
  d.setDate(0); assert.equal(d.toISOString(),'2026-09-29T15:00:00.000Z');
  assert.equal(new D(2026,9,7).toISOString(),'2026-10-06T15:00:00.000Z');
  assert.equal(new D('2026-10-07T00:00:00').toISOString(),'2026-10-06T15:00:00.000Z');
  assert.equal(formatDate(new D('2026-10-07T00:00:00Z'),'Asia/Seoul','M/d HH:mm'),'10/7 09:00');
});
test('runtime preserves production login through the actual table adapter', () => {
  const store=table();
  const students=store.insertSheet('학생'); students.appendRow(['반','이름','비밀번호','학년구분']); students.appendRow(['A','가상 학생','0011','유치']);
  const books=store.insertSheet('단어장목록'); books.appendRow(['단어장','종류','시트이름','색','레슨묶음','과']);
  const engine=createRuntime(store);
  assert.equal(engine.call('로그인',['가상학생','11']).ok,false);
  assert.deepEqual(engine.call('로그인',[' 가상학생 ','0011']),{ok:true,학생:{이름:'가상 학생',학년구분:'유치'},단어장목록:[]});
  assert.throws(() => engine.call('constructor'), /쓸 수 없는/);
});
test('runtime 알림받기 keeps one student route; other students and parent devices stay', () => {
  const store=table();
  const push=store.insertSheet('푸시'); push.appendRow(['켠때','반','이름','주소','p256dh','auth','기기']);
  push.appendRow(['2026-09-20 10:00','','테스트 학생','https://web.push/1','p','a','Windows']);
  push.appendRow(['2026-09-20 10:00','','테스트 학생','fcm:OLD','','','Android']);
  push.appendRow(['2026-09-20 10:00','','테스트 학생','https://web.push/p','p','a','학부모 · 아이폰']);
  push.appendRow(['2026-09-20 10:00','','다른 학생','https://web.push/2','p','a','Android']);
  const engine=createRuntime(store);
  assert.equal(engine.call('알림받기',['테스트 학생',{주소:'fcm:NEW'},'iPhone']).ok,true);
  assert.deepEqual(engine.call('내구독목록',['테스트 학생']).map(x=>x.주소),['fcm:NEW']);
  const 남은=push.getRange(2,1,push.getLastRow()-1,7).getValues().map(x=>x[3]).sort();
  assert.deepEqual(남은,['fcm:NEW','https://web.push/2','https://web.push/p']);
  assert.equal(engine.call('알림받기',['테스트 학생',{},'']).ok,false);
});
