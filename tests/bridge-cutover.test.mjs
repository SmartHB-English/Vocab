import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {TableStore} from '../services/table-store.mjs';
import {createDatasetDocuments} from '../services/dataset-model.mjs';
import {pack,unpack,publicTable,tableMetadata,sheetId} from '../services/store-codec.mjs';
import {toField,fromField} from '../services/firestore-wire.mjs';
const source=readFileSync(new URL('../server/FirebaseBridge.gs.template',import.meta.url),'utf8').replace('__BRIDGE_CONFIG__',JSON.stringify({project:'fixture',dataset:'old'}));
function bridge(state='staged'){
 const calls=[];
 const context={LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},FB_RPC_NAMES:['로그인'],로그인:(...args)=>{calls.push(['legacy',...args]);return {ok:true};},doPost:()=>{},매월시상:()=>calls.push(['monthly-legacy']),담은것버리기_:()=>{},읽은것_:null,VocabBridgeCore:{fromField:value=>value.mapValue.fields},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})}};
 vm.createContext(context);vm.runInContext(source,context);
 context.fbNativeEngine_=()=>({call:(fn,args)=>{calls.push(['legacy',...args]);return {ok:true};},monthly:()=>calls.push(['monthly-legacy'])});
 context.fbHttp_=()=>({fields:{dataset:'final-snapshot',state}});
 context.originalFbRequest=context.fbRequest_;
 context.fbRequest_=(fn,args)=>{calls.push(['firestore',fn,...args]);return {ok:true};};
 return {context,calls};
}
test('staged selector retains legacy HTTP and google.script.run output',()=>{
 const {context,calls}=bridge();assert.equal(context.로그인('student','0011').ok,true);
 const result=context.doPost({postData:{contents:JSON.stringify({fn:'로그인',args:['student','0011']})}});
 assert.deepEqual(JSON.parse(result.text),{ok:true,값:{ok:true}});assert.equal(calls.length,2);assert.equal(calls[0][0],'legacy');
});
test('frozen selector prevents writes through every old entry point',()=>{
 const {context,calls}=bridge('frozen');assert.throws(()=>context.로그인('student','0011'),/자료를 옮기는 중/);
 assert.throws(()=>context.매월시상(),/자료를 옮기는 중/);
 assert.equal(JSON.parse(context.doPost({postData:{contents:JSON.stringify({fn:'로그인',args:[]})}}).text).ok,false);assert.equal(calls.length,0);
});
test('active selector moves cached clients and monthly trigger to the final dataset',()=>{
 const {context,calls}=bridge('active');context.로그인('student','0011');context.매월시상();
 assert.deepEqual(calls,[['firestore','로그인','student','0011'],['firestore','__월시상']]);assert.equal(context.FB_BRIDGE_CONFIG.dataset,'final-snapshot');
});
test('selector failure never resumes Sheet writes and internal monthly RPC is not public',()=>{
 const {context,calls}=bridge('active');context.fbHttp_=()=>{throw Error('unavailable');};assert.throws(()=>context.로그인(),/unavailable/);
 assert.equal(JSON.parse(context.doPost({postData:{contents:JSON.stringify({fn:'__월시상',args:[]})}}).text).ok,false);assert.equal(calls.length,0);
});
test('REST bridge uses optimistic preconditions for every read and newly created table',()=>{
 const {context}=bridge();const calls=[];
 context.fbHttp_=(url,method,body)=>{
  calls.push({url,method,body});
  if(url.endsWith(':batchGet'))return body.documents.map(name=>name.endsWith('/missing')?{missing:name,readTime:'2026-10-07T12:00:00Z'}:{found:{name,updateTime:'2026-10-07T11:00:00Z',fields:{payload:'fixture'}},readTime:'2026-10-07T12:00:00Z'});
  return {};
 };
 const auth={idToken:'fixture'};const tx=context.fbDatabase_(auth,':beginTransaction',{}).transaction;
 assert.equal(calls.length,0);
 context.fbRead_(auth,['meta/catalog'],tx);context.fbRead_(auth,['tables/record','tables/missing'],tx);
 assert.equal(calls[1].body.readTime,'2026-10-07T12:00:00Z');
 const prefix='projects/fixture/databases/(default)/documents/vocabDatasets/old/';
 context.fbDatabase_(auth,':commit',{transaction:tx,writes:[{update:{name:prefix+'tables/record',fields:{}}},{update:{name:prefix+'tables/new',fields:{}}}]});
 const commit=calls[2].body;assert.equal(commit.transaction,undefined);
 assert.deepEqual(JSON.parse(JSON.stringify(commit.writes[0].currentDocument)),{updateTime:'2026-10-07T11:00:00Z'});
 assert.deepEqual(JSON.parse(JSON.stringify(commit.writes[1].currentDocument)),{exists:false});
 assert.ok(commit.writes.some(w=>w.verify===prefix+'meta/catalog'));assert.ok(commit.writes.some(w=>w.verify===prefix+'tables/missing'&&w.currentDocument.exists===false));
});
test('bridge retries optimistic conflicts with one request context without blocking readers',()=>{
 const {context}=bridge();context.fbRequest_=context.originalFbRequest;let attempts=0;const seen=[];
 context.LockService={getScriptLock:()=>{throw Error('must not serialize Firestore requests');}};
 context.fbRequestOnce_=(fn,args,request)=>{seen.push(request);if(++attempts<3){const e=Error('conflict');e.retryable=true;throw e;}return 'stored';};
 assert.equal(context.fbRequest_('결과저장',[]),'stored');assert.equal(seen[0],seen[2]);
 context.fbRequestOnce_=()=>{throw Error('permission');};assert.throws(()=>context.fbRequest_('결과저장',[]),/permission/);
});

test('staged read-only calls do not queue behind a Sheet writer',()=>{
 const {context}=bridge();context.LockService={getScriptLock:()=>{throw Error('reader acquired writer lock');}};
 assert.equal(context.로그인('student','0011').ok,true);
});

test('bridge account edits distinguish existing credentials from new links before atomic commit',async()=>{
 const oldToken='a'.repeat(32),newToken='b'.repeat(32),cell=value=>({value,note:'',format:'General'});
 const store=new TableStore([{name:'학생',cells:{'1:2':cell('이름'),'2:1':cell('테스트반'),'2:2':cell('테스트학생'),'2:3':cell('0011'),'2:9':cell(oldToken)}},{name:'설정',cells:{'1:1':cell('키'),'2:1':cell('선생님비밀번호'),'2:2':cell('teacher-test')}}]);
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const initial=await createDatasetDocuments(store,{digest:async value=>hash(value),newId:()=> 'fixture'});
 const catalog=initial.documents.get('meta/catalog'),original=store.export(),prefix='projects/fixture/databases/(default)/documents/vocabDatasets/old/';
 store.getSheetByName('학생').getRange(2,3).setValue('0044');store.getSheetByName('학생').getRange(2,9).setValue(newToken);
 const {context}=bridge();context.VocabBridgeCore={pack,unpack,publicTable,tableMetadata,sheetId,toField,fromField};context.fbHash_=hash;
 context.Utilities={getUuid:()=> 'receipt-fixture',newBlob:value=>({getBytes:()=>new TextEncoder().encode(value)})};
 const tx={reads:{},readTime:'2026-10-07T12:00:00Z'};
 for(const[path]of initial.documents)if(path.startsWith('tables/')||path.startsWith('secrets/')||path==='meta/catalog')tx.reads[prefix+path]={updateTime:'2026-10-07T11:00:00Z'};
 let committed;
 context.fbHttp_=(url,method,body)=>{
  if(url.endsWith(':batchGet')){assert.equal(body.readTime,tx.readTime);return body.documents.map(name=>{const data=initial.documents.get(name.slice(prefix.length));return data?{found:{name,fields:toField(data).mapValue.fields,updateTime:'2026-10-07T11:00:00Z'},readTime:tx.readTime}:{missing:name,readTime:tx.readTime};});}
  assert.ok(url.endsWith(':commit'));committed=body;return {};
 };
 context.fbSave_({uid:'bridge-fixture'},store,catalog,tx,'학생수정',original,{ok:true});
 const credential=committed.writes.find(w=>w.update?.name===prefix+'credentials/student-fixture');assert.equal(credential.currentDocument.updateTime,'2026-10-07T11:00:00Z');
 const teacher=committed.writes.find(w=>w.update?.name===prefix+'credentials/teacher');assert.equal(teacher.currentDocument.updateTime,'2026-10-07T11:00:00Z');
 const link=committed.writes.find(w=>w.update?.name===prefix+'links/'+newToken);assert.equal(link.currentDocument.exists,false);
 const deleted=committed.writes.find(w=>w.delete===prefix+'links/'+oldToken);assert.equal(deleted.currentDocument.updateTime,'2026-10-07T11:00:00Z');
 assert.ok(committed.writes.some(w=>w.verify===prefix+'tables/'+sheetId('설정')));
});
