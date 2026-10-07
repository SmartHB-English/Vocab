// Isolated bridge transport probe; only an internal session is written.
import{readFileSync}from'node:fs';
import{firebaseConfig,dataset}from'../../services/firebase-config.mjs';
import{toField}from'../../services/firestore-wire.mjs';
const base='https://firestore.googleapis.com/v1/projects/'+firebaseConfig.projectId+'/databases/(default)/documents';
const staged=JSON.parse(readFileSync('work/dataset-documents.json'));
const proof=staged.documents.find(([p])=>p.endsWith('/credentials/bridge'))[1].pinHash;
const auth=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+firebaseConfig.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})}).then(r=>r.json());
if(!auth.idToken)throw Error('Auth failed');
async function rpc(suffix,body,method='POST'){
 const response=await fetch(base+suffix,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.idToken},body:JSON.stringify(body)});
 const value=await response.json();if(!response.ok)throw Error(JSON.stringify({status:response.status,code:value.error?.status,message:value.error?.message}));return value;
}
await rpc('/sessions/'+auth.localId,{fields:toField({dataset,credentialId:'bridge',proof}).mapValue.fields},'PATCH');
const prefix='projects/'+firebaseConfig.projectId+'/databases/(default)/documents/';
const paths=staged.documents.map(([p])=>p).filter(p=>/\/(meta|credentials|links)\//.test(p));
paths.push('vocabDatasets/'+dataset+'/journal/'+auth.localId+'_read-only-probe');
const names=paths.map(p=>prefix+p),name=names[0];
try{await rpc(':beginTransaction',{});console.log('explicit-begin: allowed');}catch(e){console.log('explicit-begin: '+e.message);}
const first=await rpc(':batchGet',{documents:[name]});
const read=first.find(r=>r.found);
const consistent=await rpc(':batchGet',{documents:names,readTime:read.readTime});
if(consistent.length!==names.length)throw Error('Read targets missing');
await rpc(':commit',{writes:consistent.map(r=>({verify:r.found?.name??r.missing,currentDocument:r.found?{updateTime:r.found.updateTime}:{exists:false}}))});
console.log(JSON.stringify({optimisticReadTimeVerify:'passed',writeTargetsVerified:consistent.length,academyDataChanged:false}));
