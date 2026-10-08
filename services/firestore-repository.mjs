import { randomId } from './random-id.mjs';
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { TableStore } from './table-store.mjs';
import { createRuntime } from './legacy-runtime.mjs';
import { pack, unpack, publicTable, tableMetadata, sheetId } from './store-codec.mjs';
import { createDatasetDocuments } from './dataset-model.mjs';

export const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
const jsonResult = result => result === undefined ? undefined : JSON.parse(JSON.stringify(result));
// 푸시 전송 · 그림 파일은 Cloud Functions(functions/src/index.mjs aux)가 한다 — 예전엔 Apps Script 창구였다.
const auxUrl = 'https://asia-northeast3-smarthb-vocab-20261007.cloudfunctions.net/aux';
async function auxiliary(user, fn, args) {
  const response = await fetch(auxUrl, {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+await user.getIdToken()}, body:JSON.stringify({fn,args})});
  const reply = await response.json().catch(() => null);
  if (!reply?.ok) throw new Error(reply?.메시지 || '서버가 답하지 않았습니다');
  return reply.값;
}
const privileged = role => role === 'teacher' || role === 'bridge';

export class FirestoreRepository {
  constructor(db, dataset, identity) { this.db = db; this.dataset = dataset; this.identity = identity; this.cache = new Map(); this.parentCache = null; this.auxiliary = (fn,args) => auxiliary(this.identity.user,fn,args); }
  ref(path) { return doc(this.db, `vocabDatasets/${this.dataset}/${path}`); }
  async catalog(reader = ref => getDoc(ref)) {
    const d = await reader(this.ref('meta/catalog'));
    if (!d.exists()) throw new Error('자료 이관 준비가 끝나지 않았습니다.');
    return d.data();
  }
  async load(catalog, reader, { publicOnly = false, fresh = false } = {}) {
    const role = this.identity.role;
    const tables = await Promise.all(catalog.tables.map(async meta => {
      const isPublic = ['학생','설정','단어장목록','공지'].includes(meta.name) || meta.name.startsWith('단어_');
      if (publicOnly && !isPublic) return null;
      const id = sheetId(meta.name), version = meta.version;
      const fetchPayload = async (section, expected) => {
        const key = section + '/' + id;
        const cached = this.cache.get(key);
        if (!fresh && cached?.version === expected) return unpack(cached.payload);
        const d = await reader(this.ref(key));
        if (!d.exists()) throw new Error('자료 일부를 불러오지 못했습니다. 새로고침 후 다시 해 주세요.');
        const data = d.data();
        if (!fresh) this.cache.set(key, data);
        return unpack(data.payload);
      };
      const table = await fetchPayload('tables',version);
      if (privileged(role) && ['학생','설정'].includes(meta.name)) {
        const secret = await fetchPayload('secrets',meta.secretVersion);
        Object.assign(table.cells, secret.cells);
      }
      return table;
    }));
    const store = new TableStore(tables.filter(Boolean));
    // Reconstruct only the currently authenticated user's legacy credential columns.
    if (this.identity.role === 'student' && this.identity.pin !== undefined) {
      const s = store.getSheetByName('학생');
      if (s) s.cells[`${this.identity.row}:3`] = {value:this.identity.pin,note:'',format:'General'};
    }
    if (this.identity.role === 'parent') {
      const s = store.getSheetByName('학생');
      if (s) s.cells[`${this.identity.row}:9`] = {value:this.identity.token,note:'',format:'General'};
    }
    return store;
  }
  async grant(credentialId, proof) {
    const user = this.identity.user;
    await setDoc(doc(this.db,`sessions/${user.uid}`),{dataset:this.dataset,credentialId,proof});
  }
  async studentLogin(name, pin) {
    const catalog = await this.catalog();
    const identities = catalog.identities;
    const exact = String(name ?? '').trim();
    const match = identities.find(i => i.name === exact) ?? identities.find(i => i.name.replace(/\s/g,'') === exact.replace(/\s/g,''));
    if (!match) return {ok:false,메시지:'명단에 없는 이름이에요. 선생님께 말씀드리세요.'};
    const cleanPin = String(pin ?? '').trim();
    try { await this.grant(match.id,await digest(cleanPin)); }
    catch (e) { if (e.code === 'permission-denied') return {ok:false,메시지:'비밀번호가 달라요.'}; throw e; }
    Object.assign(this.identity,{role:'student',credentialId:match.id,row:match.row,name:match.name,pin:cleanPin});
    const store = await this.load(catalog, ref=>getDoc(ref),{publicOnly:true});
    return jsonResult(createRuntime(store).call('로그인',[name,pin]));
  }
  async teacherLogin(pin) {
    try { await this.grant('teacher',await digest(String(pin ?? '').trim())); }
    catch (e) { if (e.code === 'permission-denied') return {ok:false}; throw e; }
    Object.assign(this.identity,{role:'teacher',pin:String(pin ?? '').trim()});
    return {ok:true};
  }
  async parentLogin(token) {
    const clean = String(token ?? '').trim().toLowerCase();
    if (!/^[0-9a-f]{32,128}$/.test(clean)) return false;
    const link = await getDoc(this.ref(`links/${clean}`));
    if (!link.exists()) return false;
    const data = link.data();
    await this.grant(data.credentialId,await digest(clean));
    Object.assign(this.identity,{role:'parent',token:clean,row:data.row,name:data.name,credentialId:data.credentialId});
    return true;
  }
  async call(fn,args) {
    if (fn === '로그인') return this.studentLogin(...args);
    if (fn === '선생님로그인') return this.teacherLogin(...args);
    if (fn === '학부모보기') {
      if (!await this.parentLogin(args[0])) return {ok:false,메시지:'링크가 맞지 않습니다. 선생님께 문의해 주세요.'};
    }
    const publicOnly = ['시작정보','푸시공개키','공지가져오기'].includes(fn) && !this.identity.role;
    const catalog = await this.catalog();
    if(fn==='학부모보기' && this.parentCache?.token===this.identity.token && this.parentCache.revision===catalog.revision && this.parentCache.until>Date.now()) {
      const value=this.parentCache.value; return args[1]?{ok:true,이름:value.이름,안낸수:value.안낸수}:jsonResult(value);
    }
    if(fn==='푸시전송') return this.auxiliary(fn,args);
    const store = await this.load(catalog,ref=>getDoc(ref),{publicOnly});
    const started = Date.now();
    const ids = [];
    const imageOperation=['그림올리기','그림여러개'].includes(fn);
    let planningImages=imageOperation; const images=new Map();
    const saveImage=(...job)=>{
      const key=JSON.stringify(job);
      if(planningImages){if(!images.has(key))images.set(key,{job});return 'image-upload-planned:'+images.size;}
      const cached=images.get(key);if(!cached)throw new Error('자료가 변경되었습니다. 다시 시도해 주세요.');
      if(cached.error)throw cached.error;return cached.url;
    };
    const execute = current => {
      let index = 0;
      const engine = createRuntime(current,{effects:{saveImage:imageOperation?saveImage:undefined},now:()=>started,uuid:()=>{ const i=index++; return ids[i] ?? (ids[i]=randomId()); }});
      return fn==='__월시상' ? engine.monthly() : engine.call(fn,args);
    };
    const result = execute(store);
    if(imageOperation){planningImages=false;for(const cached of images.values()){try{cached.url=await this.auxiliary('__그림파일',[args[0],...cached.job]);}catch(error){cached.error=error;}}}
    if (!store.deleted.size && !store.getSheets().some(s=>s.dirty)) return jsonResult(result);
    const requestId = this.identity.user.uid+'_'+randomId();
    return runTransaction(this.db,async transaction => {
      const oldReceipt = await transaction.get(this.ref(`journal/${requestId}`));
      if (oldReceipt.exists()) return unpack(oldReceipt.data().result);
      const currentCatalog = await this.catalog(ref=>transaction.get(ref));
      const current = await this.load(currentCatalog,ref=>transaction.get(ref),{fresh:true});
      const originalTables = current.export();
      const answer = jsonResult(execute(current));
      const compiled = current.getSheetByName('학생')?.dirty || current.getSheetByName('설정')?.dirty ? await createDatasetDocuments(current,{digest,previousIdentities:currentCatalog.identities}) : null;
      const before = new Map(currentCatalog.tables.map(t=>[t.name,t]));
      const changes = [];
      const tables = current.getSheets();
      const nextMetadata = [];
      for (let position=0;position<tables.length;position++) {
        const table=tables[position];
        if (!table.dirty) { nextMetadata.push(before.get(table.name)); continue; }
        const full=table.export(), visible=publicTable(full), payload=pack(visible);
        if (new TextEncoder().encode(payload).length > 850000) throw new Error('자료가 커서 나누어 저장해야 합니다.');
        const version=await digest(payload), meta={...tableMetadata(full,position),version};
        transaction.set(this.ref(`tables/${sheetId(full.name)}`),{payload,version,name:full.name,public:['학생','설정','단어장목록','공지'].includes(full.name)||full.name.startsWith('단어_')});
        if (['학생','설정'].includes(full.name) && privileged(this.identity.role)) {
          const secret={name:full.name,cells:Object.fromEntries(Object.entries(full.cells).filter(([key,c])=>pack(c)!==pack(visible.cells[key])))};
          const secretPayload=pack(secret), secretVersion=await digest(secretPayload);
          transaction.set(this.ref(`secrets/${sheetId(full.name)}`),{payload:secretPayload,version:secretVersion});
          meta.secretVersion=secretVersion;
        } else if(before.get(full.name)?.secretVersion) meta.secretVersion=before.get(full.name).secretVersion;
        nextMetadata.push(meta); changes.push(full.name);
        transaction.set(this.ref(`journal/${requestId}/tables/${sheetId(full.name)}`),{payload:pack(full)});
      }
      for (const name of current.deleted) if (!tables.some(t=>t.name===name)) {
        transaction.delete(this.ref(`tables/${sheetId(name)}`)); changes.push(name);
      }
      transaction.set(this.ref('meta/catalog'),{...currentCatalog,tables:nextMetadata,revision:fn==='학부모보기'?currentCatalog.revision:requestId,identities:compiled?.identities??currentCatalog.identities});
      if(compiled && privileged(this.identity.role)) {
        for(const [path,data] of compiled.documents) if(path.startsWith('credentials/')||path.startsWith('links/')) transaction.set(this.ref(path),data);
        const nextPaths=new Set(compiled.documents.keys());
        for(const identity of currentCatalog.identities) {
          if(!nextPaths.has('credentials/'+identity.id)) transaction.delete(this.ref('credentials/'+identity.id));
          if(!nextPaths.has('credentials/parent-'+identity.id)) transaction.delete(this.ref('credentials/parent-'+identity.id));
        }
        const students=originalTables.find(t=>t.name==='학생');
        for(const [key,cell] of Object.entries(students?.cells??{})) {
          if(!key.endsWith(':9')) continue;
          const token=String(cell.value??'').trim().toLowerCase();
          if(/^[0-9a-f]{32,128}$/.test(token)&&!nextPaths.has('links/'+token)) transaction.delete(this.ref('links/'+token));
        }
      }
      transaction.set(this.ref(`journal/${requestId}`),{actor:this.identity.user.uid,fn,result:pack(answer),changes,at:started});
      this.cache.clear();
      if(fn==='학부모보기'&&!args[1]&&answer?.ok)this.parentCache={token:this.identity.token,revision:currentCatalog.revision,until:started+60000,value:answer};
      return answer;
    });
  }
}
