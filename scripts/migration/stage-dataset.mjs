import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {TableStore} from '../../services/table-store.mjs';
import {createDatasetDocuments} from '../../services/dataset-model.mjs';
const snapshot=JSON.parse(readFileSync('work/source/snapshot.normalized.json','utf8'));
const store=TableStore.fromSnapshot(snapshot);
const digest=async value=>createHash('sha256').update(value).digest('hex');
let previousIdentities=[],bridgeProof;
try { const previous=JSON.parse(readFileSync('work/dataset-documents.json','utf8')).documents; previousIdentities=previous.find(([p])=>p.endsWith('/meta/catalog'))[1].identities; bridgeProof=previous.find(([p])=>p.endsWith('/credentials/bridge'))?.[1].pinHash; } catch(e) { if(e.code!=='ENOENT') throw e; }
const data=await createDatasetDocuments(store,{digest,previousIdentities,newId:randomUUID});
data.documents.set('credentials/bridge',{role:'bridge',pinHash:bridgeProof??data.documents.get('credentials/teacher').pinHash});
const prefix='vocabDatasets/'+snapshot.contentSha256+'/';
const docs=[...data.documents].map(([path,value])=>[prefix+path,value]);
for(const [,value] of docs) if(Buffer.byteLength(JSON.stringify(value))>900000) throw new Error('Document too large');
writeFileSync('work/dataset-documents.json',JSON.stringify({dataset:snapshot.contentSha256,documents:docs}),{mode:0o600});
console.log(JSON.stringify({dataset:snapshot.contentSha256,documentCount:docs.length,identities:data.identities.length}));
