// Real project verification: credential/session writes only, no academy data mutations.
import {readFileSync,writeFileSync} from 'node:fs';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,signInAnonymously} from 'firebase/auth';
import {getFirestore,terminate,getDoc,doc} from 'firebase/firestore';
import {firebaseConfig} from '../../services/firebase-config.mjs';
import {FirestoreRepository} from '../../services/firestore-repository.mjs';
import {TableStore} from '../../services/table-store.mjs';
import {createRuntime} from '../../services/legacy-runtime.mjs';
import '../../services/api-client.js';
if(firebaseConfig.projectId!=='smarthb-vocab-20261007'||process.env.FIRESTORE_EMULATOR_HOST)throw Error('Unexpected verification destination');
const snapshot=JSON.parse(readFileSync('work/source/snapshot.normalized.json'));
const store=TableStore.fromSnapshot(snapshot),table=store.getSheetByName('학생');
const student=table.getRange(2,1,table.getLastRow()-1,11).getValues().find(r=>r[1]&&r[2]);
const app=initializeApp(firebaseConfig,'staged-read-only'),db=getFirestore(app);
const canonical=value=>JSON.stringify(value,(_,v)=>v&&!Array.isArray(v)&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const results=[];
try{
 const {user}=await signInAnonymously(getAuth(app));const {dataset}= (await getDoc(doc(db,'runtime/config'))).data();const repo=new FirestoreRepository(db,dataset,{user});
 const cases=[['로그인',[String(student[1]),String(student[2])]],['내기록',[String(student[1])]],['숙제가져오기',[String(student[1])]],['월간순위',[String(student[1])]],['연속가져오기',[String(student[1])]]];
 for(const[fn,args]of cases){
  const time=Date.now();
  const[actual,old]=await Promise.all([repo.call(fn,args),process.argv.includes('--offline-baseline')?{ok:true,값:createRuntime(TableStore.fromSnapshot(snapshot),{now:()=>time}).call(fn,args)}:VocabApi.post(VocabApi.legacyEndpoint,fn,args)]);
  const match=old.ok&&canonical(actual)===canonical(old.값);results.push({fn,status:match?'match':'differs'});
  if(!match)writeFileSync('work/staged-diff-'+fn+'.json',JSON.stringify({actual,legacy:old.값},null,2),{mode:0o600});
  console.log(JSON.stringify(results.at(-1)));
 }
 if(process.argv.includes('--teacher')){
  const settings=store.getSheetByName('설정');const pin=String(settings.getRange(2,1,settings.getLastRow()-1,2).getValues().find(r=>String(r[0]).trim()==='선생님비밀번호')?.[1]??'1234').trim();
  await repo.teacherLogin(pin);
  for(const[fn,args]of [['시작정보',[]],['명단가져오기',[pin]],['선생님기본',[pin]],['선생님기록',[pin,30]],['설정가져오기',[pin]],['공지목록',[pin]],['시상달목록',[pin]],['학부모미리보기',[pin,String(student[1])]]]){
   const time=Date.now(),actual=await repo.call(fn,args),old=createRuntime(TableStore.fromSnapshot(snapshot),{now:()=>time}).call(fn,args);
   const match=canonical(actual)===canonical(old);results.push({fn,status:match?'match':'differs'});console.log(JSON.stringify(results.at(-1)));
   if(!match)writeFileSync('work/staged-diff-'+fn+'.json',JSON.stringify({actual,legacy:old},null,2),{mode:0o600});
  }
 }
 writeFileSync('work/staged-parity.json',JSON.stringify(results,null,2),{mode:0o600});console.log(JSON.stringify(results));
 if(results.some(r=>r.status!=='match'))process.exitCode=1;
}finally{await terminate(db);await deleteApp(app);}
