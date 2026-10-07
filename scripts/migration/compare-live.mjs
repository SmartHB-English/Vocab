// Explicit read-only requests against the existing endpoint; no submissions/last-seen writes.
import { readFileSync, writeFileSync } from 'node:fs';
import { TableStore } from '../../services/table-store.mjs';
import { createRuntime } from '../../services/legacy-runtime.mjs';
import '../../services/api-client.js';
const snapshot = JSON.parse(readFileSync(process.argv[2]??new URL('../../work/source/snapshot.normalized.json', import.meta.url)));
const tables = TableStore.fromSnapshot(snapshot);
const students = tables.getSheetByName('학생').getRange(2,1,tables.getSheetByName('학생').getLastRow()-1,11).getValues();
const [student] = students.filter(r => r[1] && r[2]);
const cases = [
  ['로그인',[String(student[1]),String(student[2])]],
  ['내기록',[String(student[1])]],
  ['숙제가져오기',[String(student[1])]],
  ['월간순위',[String(student[1])]],
  ['연속가져오기',[String(student[1])]],
];
if(process.argv.includes('--teacher')){
 const settings=tables.getSheetByName('설정').getRange(2,1,tables.getSheetByName('설정').getLastRow()-1,2).getValues();
 const pin=String(settings.find(r=>String(r[0]).trim()==='선생님비밀번호')?.[1]??'1234').trim();
 cases.push(['시작정보',[]],['명단가져오기',[pin]],['선생님기본',[pin]],['선생님기록',[pin,30]],['설정가져오기',[pin]],['공지목록',[pin]],['시상달목록',[pin]],['학부모미리보기',[pin,String(student[1])]]);
}
const canonical = value => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k,v[k]])) : v);
const results=[];
const selected=process.argv.includes('--parallel-pair')?cases.slice(0,2):cases;
async function check([fn,args]) {
  const store=TableStore.fromSnapshot(snapshot);
  const time=Date.now();
  const response=await fetch(VocabApi.legacyEndpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({fn,args}),signal:AbortSignal.timeout(120000)}).then(r=>r.json());
  if (!response.ok) { results.push({fn,status:'legacy-error'}); return; }
  try {
    const local=createRuntime(store,{now:()=>time}).call(fn,args);
    const equal=canonical(response.값)===canonical(local);
    results.push({fn,status:equal?'match':'differs'});
    if (!equal) writeFileSync(new URL(`../../work/compare-${fn}.json`, import.meta.url),JSON.stringify({legacy:response.값,local},null,2),{mode:0o600});
  } catch(error) { results.push({fn,status:'runtime-error',error:error.message}); }
  console.log(JSON.stringify(results.at(-1)));
}
if(process.argv.includes('--parallel-pair'))await Promise.all(selected.map(check));else for(const c of selected)await check(c);
writeFileSync(new URL('../../work/live-parity.json', import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.status!=='match')) process.exitCode=1;
