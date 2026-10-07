import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../services/api-client.js',import.meta.url),'utf8');
function client(call){
 let loads=0;
 const context={fetch(){throw Error('Unexpected HTTP fallback');},importScripts(path){assert.equal(path,'./services/firestore.bundle.js');loads++;context.VocabFirestore={call};}};
 context.self=context;vm.createContext(context);vm.runInContext(source,context);
 return {api:context.VocabApi,loads:()=>loads};
}
test('Firestore replies keep the legacy envelope and load the worker bundle once',async()=>{
 const seen=[],c=client(async(fn,args)=>{seen.push([fn,args]);return {ok:false,메시지:'비밀번호가 달라요.'};});
 assert.equal(c.api.defaultEndpoint,'firestore:v1');
 const reply=await c.api.post(c.api.defaultEndpoint,'로그인',['test','0011']);
 assert.equal(reply.ok,true);assert.equal(reply.값.ok,false);
 assert.equal((await c.api.request('firestore:v1','로그인',['test','0011'])).메시지,'비밀번호가 달라요.');
 assert.equal(c.loads(),1);assert.equal(seen.length,2);
});
test('Firestore failure does not retry submissions or switch to another writer',async()=>{
 let calls=0;const c=client(async()=>{calls++;throw Error('permission-denied');});
 await assert.rejects(c.api.request('firestore:v1','기록저장',[]),/permission-denied/);assert.equal(calls,1);
});
test('both deployed HTML entry points use the shared Firestore default',()=>{
 for(const name of ['index.html','parent.html'])assert.match(readFileSync(new URL('../'+name,import.meta.url),'utf8'),/var 창구주소 = VocabApi.defaultEndpoint;/);
});
