import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, terminate } from 'firebase/firestore';
import { createHash } from 'node:crypto';
import { TableStore } from '../services/table-store.mjs';
import { createDatasetDocuments } from '../services/dataset-model.mjs';
import { FirestoreRepository, digest } from '../services/firestore-repository.mjs';
import { unpack, sheetId } from '../services/store-codec.mjs';
const project='demo-smarthb-vocab';
const fh=process.env.FIRESTORE_EMULATOR_HOST, ah=process.env.FIREBASE_AUTH_EMULATOR_HOST;
assert.match(fh??'',/^(127\.0\.0\.1|localhost):\d+$/); assert.match(ah??'',/^(127\.0\.0\.1|localhost):\d+$/);
const dataset='fixture-direct';
const base=`http://${fh}/v1/projects/${project}/databases/(default)/documents`;
const headers={'Authorization':'Bearer owner','Content-Type':'application/json'};
const fvalue=v=>v===null?{nullValue:null}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:typeof v==='string'?{stringValue:v}:Array.isArray(v)?{arrayValue:{values:v.map(fvalue)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fvalue(x)]))}};
async function seed(path,data) {
 const response=await fetch(`${base}/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'PATCH',headers,body:JSON.stringify({fields:fvalue(data).mapValue.fields})}); assert.equal(response.status,200);
}
const apps=[];
async function client(label) {
 const app=initializeApp({apiKey:'emulator',projectId:project},label);apps.push(app);
 const auth=getAuth(app);connectAuthEmulator(auth,`http://${ah}`,{disableWarnings:true});
 const db=getFirestore(app); const [host,port]=fh.split(':');connectFirestoreEmulator(db,host,Number(port));
 const {user}=await signInAnonymously(auth);const identity={user};
 return {app,db,identity,repo:new FirestoreRepository(db,dataset,identity)};
}
function syntheticStore() {
 const s=new TableStore();
 const add=(name,rows)=>{const t=s.insertSheet(name);for(const row of rows)t.appendRow(row);};
 add('학생',[['반','이름','비밀번호','학년구분','볼 수 있는 단어장','학년','학교','교재','학부모링크','학부모마지막','선생님한마디'],['A','가상 학생','0011','유치','','','','교재A','a'.repeat(64),'',''],['B','다른학생','2222','초중등']]);
 add('설정',[['항목','값'],['선생님비밀번호','9876'],['숙제합격점',80],['푸시공개키','public-fixture'],['푸시비밀키','PRIVATE-FIXTURE']]);
 add('단어장목록',[['단어장','종류','시트이름','색','레슨묶음','과'],['교재A','단어','단어_교재A','blue',10,'']]);
 add('단어_교재A',[['번호','영어','뜻','그림'],[1,'apple','사과','']]);
 add('기록',[Array.from({length:26},(_,i)=>'column'+i)]);
 add('기록보관',[Array.from({length:26},(_,i)=>'column'+i)]);
 add('숙제',[Array.from({length:17},(_,i)=>'column'+i)]);
 add('게임',[Array.from({length:7},(_,i)=>'column'+i)]);
 add('푸시',[['켠때','반','이름','주소','p256dh','auth','기기']]);
 add('공지',[Array.from({length:6},(_,i)=>'column'+i)]);
 return s;
}
let student,teacher,other;
test('seed a synthetic dataset only in the local emulator',async()=>{
 const {documents}=await createDatasetDocuments(syntheticStore(),{digest,newId:()=>crypto.randomUUID()});
 for(const [path,value]of documents)await seed(`vocabDatasets/${dataset}/${path}`,value);
 await seed('runtime/config',{dataset,state:'active'});
 student=await client('student-fixture');teacher=await client('teacher-fixture');other=await client('other-fixture');
});
test('PIN login preserves leading zero and whitespace; anonymous user cannot read records or credential',async()=>{
 const unknown=await student.repo.call('로그인',['누구','0011']);assert.equal(unknown.ok,false);
 const bad=await student.repo.call('로그인',['가상학생','11']);assert.deepEqual(bad,{ok:false,메시지:'비밀번호가 달라요.'});
 await assert.rejects(getDoc(doc(other.db,`vocabDatasets/${dataset}/tables/${sheetId('기록')}`)),{code:'permission-denied'});
 const result=await student.repo.call('로그인',[' 가상학생 ','0011']); assert.equal(result.ok,true);assert.equal(result.학생.이름,'가상 학생');
 await assert.rejects(getDoc(doc(student.db,`vocabDatasets/${dataset}/credentials/teacher`)),{code:'permission-denied'});
 const profiles=await getDoc(doc(student.db,`vocabDatasets/${dataset}/tables/${sheetId('학생')}`));
 assert.equal(unpack(profiles.data().payload).cells['2:3'].value,'');assert.equal(unpack(profiles.data().payload).cells['2:9'].value,'');
 const settings=await getDoc(doc(student.db,`vocabDatasets/${dataset}/tables/${sheetId('설정')}`));
 assert.equal(unpack(settings.data().payload).cells['2:2'].value,'');assert.equal(unpack(settings.data().payload).cells['5:2'].value,'');
});
test('concurrent submission retains both rows and the full wrong-answer note',async()=>{
 await other.repo.call('로그인',['가상 학생','0011']);
 const payload={이름:'가상 학생',단어장:'교재A',범위:'1~10',유형:'스펠링',틀린단어:'a,b,c,d,e,f',점수:80};
 const results=await Promise.all([student.repo.call('결과저장',[payload]),other.repo.call('결과저장',[{...payload,점수:90}])]);
 assert.deepEqual(results,[{ok:true},{ok:true}]);
 const record=await getDoc(doc(student.db,`vocabDatasets/${dataset}/tables/${sheetId('기록')}`));const table=unpack(record.data().payload);
 assert.equal(table.cells['2:9'].value+table.cells['3:9'].value,170);assert.match(table.cells['2:14'].note,/\nf$/);assert.match(table.cells['3:14'].value,/외 1개/);
});
test('repeated exam is rejected against committed records',async()=>{
 const p={이름:'가상 학생',단어장:'교재A',범위:'11~20',유형:'스펠링',구분:'시험',점수:0};
 assert.deepEqual(await student.repo.call('결과저장',[p]),{ok:true});
 assert.equal((await other.repo.call('결과저장',[p])).이미봄,true);
});
test('teacher credential is validated without changing the existing PIN UI',async()=>{
 assert.deepEqual(await teacher.repo.call('선생님로그인',['bad']),{ok:false});
 assert.deepEqual(await teacher.repo.call('선생님로그인',['9876']),{ok:true});
 assert.equal((await teacher.repo.call('명단가져오기',['9876'])).ok,true);
 const secret=await getDoc(doc(teacher.db,`vocabDatasets/${dataset}/secrets/${sheetId('학생')}`));assert.equal(unpack(secret.data().payload).cells['2:3'].value,'0011');
});
test('changing a student PIN keeps identity and prevents old-PIN login',async()=>{
 const list=await teacher.repo.call('명단가져오기',['9876']);
 assert.ok(list.ok);
 const before=await teacher.repo.catalog();const identity=before.identities.find(i=>i.name==='가상 학생');
 const profiles=await teacher.repo.load(before,ref=>getDoc(ref));
 // Invoke the real teacher editor contract from the production function below.
 const result=await teacher.repo.call('학생수정',['9876',identity.row,{이름:'가상 학생',비밀번호:'0044',학년구분:'유치',교재:'교재A'}]);
 assert.equal(result.ok,true);
 const after=await teacher.repo.catalog();assert.equal(after.identities.find(i=>i.name==='가상 학생').id,identity.id);
 const fresh=await client('new-pin-fixture');
 assert.equal((await fresh.repo.call('로그인',['가상학생','0011'])).ok,false);
 assert.equal((await fresh.repo.call('로그인',['가상학생','0044'])).ok,true);
});
test('parent tokens retain output and a reissued link invalidates its predecessor',async()=>{
 const parent=await client('parent-fixture');
 assert.deepEqual(await parent.repo.call('학부모보기',['not-a-token']),{ok:false,메시지:'링크가 맞지 않습니다. 선생님께 문의해 주세요.'});
 const notification=await parent.repo.call('학부모보기',['a'.repeat(64),true]);assert.equal(notification.ok,true);assert.equal(notification.이름,'가상 학생');
 const reissued=await teacher.repo.call('학부모링크발급',['9876','가상 학생']);assert.equal(reissued.ok,true);
 assert.equal((await parent.repo.call('학부모보기',['a'.repeat(64),true])).ok,false);
 const token=reissued.주소.split('k=')[1];assert.ok(token);
 assert.equal((await parent.repo.call('학부모보기',[token,true])).ok,true);
});
test('parent full view caches last-seen without suppressing link revocation',async()=>{
 const parent=await client('parent-full-fixture');
 const catalog=await teacher.repo.catalog();const store=await teacher.repo.load(catalog,ref=>getDoc(ref));
 const token=store.getSheetByName('학생').cells['2:9'].value;
 const first=await parent.repo.call('학부모보기',[token]);assert.equal(first.ok,true);
 const changed=await teacher.repo.catalog();const version=changed.tables.find(t=>t.name==='학생').version;
 const second=await parent.repo.call('학부모보기',[token]);assert.deepEqual(second,first);
 assert.equal((await teacher.repo.catalog()).tables.find(t=>t.name==='학생').version,version);
 const next=await teacher.repo.call('학부모링크발급',['9876','가상 학생']);assert.equal(next.ok,true);
 assert.equal((await parent.repo.call('학부모보기',[token])).ok,false);
});
test('Drive upload occurs once outside the transaction and saves the returned URL',async()=>{
 const jobs=[];teacher.repo.auxiliary=async(fn,args)=>{jobs.push({fn,args});return 'https://fixture.invalid/image.png';};
 const result=await teacher.repo.call('그림올리기',['9876','교재A',2,'apple.png','fixture-base64','image/png']);
 assert.deepEqual(result,{ok:true,주소:'https://fixture.invalid/image.png'});
 assert.equal(jobs.length,1);assert.equal(jobs[0].fn,'__그림파일');assert.deepEqual(jobs[0].args,['9876','교재A','apple.png','fixture-base64','image/png']);
 const table=await getDoc(doc(teacher.db,`vocabDatasets/${dataset}/tables/${sheetId('단어_교재A')}`));
 assert.equal(unpack(table.data().payload).cells['2:4'].value,'https://fixture.invalid/image.png');
 jobs.length=0;assert.equal((await teacher.repo.call('그림올리기',['bad','교재A',2,'apple.png','fixture-base64','image/png'])).ok,false);assert.equal(jobs.length,0);
});
test('failed upload retains its error and does not replace the existing image',async()=>{
 teacher.repo.auxiliary=async()=>{throw Error('upload unavailable');};
 const answer=await teacher.repo.call('그림올리기',['9876','교재A',2,'apple.png','fixture-base64','image/png']);
 assert.deepEqual(answer,{ok:false,메시지:'upload unavailable'});
 const table=await getDoc(doc(teacher.db,`vocabDatasets/${dataset}/tables/${sheetId('단어_교재A')}`));assert.equal(unpack(table.data().payload).cells['2:4'].value,'https://fixture.invalid/image.png');
});
test('push is delegated once without a real notification or database write',async()=>{
 const calls=[];teacher.repo.auxiliary=async(fn,args)=>{calls.push({fn,args});return {ok:true,fixture:true};};
 const result=await teacher.repo.call('푸시전송',['9876',[]]);assert.deepEqual(result,{ok:true,fixture:true});assert.equal(calls.length,1);assert.equal(calls[0].fn,'푸시전송');
});
test('freeze blocks submissions and dataset changes revoke cached sessions',async()=>{
 const current=await client('freeze-fixture');assert.equal((await current.repo.call('로그인',['가상 학생','0044'])).ok,true);
 const before=await current.repo.catalog();
 await seed('runtime/config',{dataset,state:'frozen'});
 await assert.rejects(current.repo.call('결과저장',[{이름:'가상 학생',단어장:'교재A',범위:'31~40',유형:'스펠링',점수:80}]),{code:'permission-denied'});
 assert.equal((await current.repo.catalog()).revision,before.revision);
 assert.ok((await teacher.repo.load(await teacher.repo.catalog(),ref=>getDoc(ref))).getSheetByName('학생'));
 await seed('runtime/config',{dataset:'replacement-fixture',state:'active'});
 await assert.rejects(getDoc(doc(current.db,`vocabDatasets/${dataset}/tables/${sheetId('기록')}`)),{code:'permission-denied'});
 await seed('runtime/config',{dataset,state:'active'});
});
test.after(async()=>{for(const app of apps){await terminate(getFirestore(app));await deleteApp(app);}});
