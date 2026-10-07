import { randomId } from './random-id.mjs';
import { pack, publicTable, tableMetadata, sheetId } from './store-codec.mjs';
export async function createDatasetDocuments(store, { digest, previousIdentities = [], newId = () => randomId() } = {}) {
  const documents = new Map(), tables=[];
  for (const [position,table] of store.getSheets().entries()) {
    const full=table.export(), visible=publicTable(full), payload=pack(visible), version=await digest(payload);
    const meta={...tableMetadata(full,position),version};
    documents.set(`tables/${sheetId(full.name)}`,{payload,version,name:full.name,public:['학생','설정','단어장목록','공지'].includes(full.name)||full.name.startsWith('단어_')});
    if (['학생','설정'].includes(full.name)) {
      const secret={name:full.name,cells:Object.fromEntries(Object.entries(full.cells).filter(([k,c])=>pack(c)!==pack(visible.cells[k])))};
      const payload=pack(secret),version=await digest(payload);
      documents.set(`secrets/${sheetId(full.name)}`,{payload,version}); meta.secretVersion=version;
    }
    tables.push(meta);
  }
  const students=store.getSheetByName('학생');
  const identities=[];
  for (let row=2;row<=students.getLastRow();row++) {
    const r=students.getRange(row,1,1,Math.max(11,students.getLastColumn())).getValues()[0];
    const name=String(r[1]??'').trim(); if(!name) continue;
    const id=previousIdentities.find(i=>i.row===row)?.id ?? 'student-'+newId();
    identities.push({id,name,row});
    documents.set(`credentials/${id}`,{role:'student',name,row,pinHash:await digest(String(r[2]??'').trim())});
    const token=String(r[8]??'').trim().toLowerCase();
    if (/^[0-9a-f]{32,128}$/.test(token)) {
      const credentialId='parent-'+id;
      documents.set(`credentials/${credentialId}`,{role:'parent',name,row,pinHash:await digest(token)});
      documents.set(`links/${token}`,{credentialId,name,row});
    }
  }
  const settings=store.getSheetByName('설정');
  const rows=settings.getRange(2,1,Math.max(1,settings.getLastRow()-1),2).getValues();
  const pin=String(rows.find(r=>String(r[0]).trim()==='선생님비밀번호')?.[1] ?? '1234').trim();
  documents.set('credentials/teacher',{role:'teacher',pinHash:await digest(pin)});
  documents.set('meta/catalog',{tables,identities,revision:'initial'});
  return {documents,tables,identities};
}
