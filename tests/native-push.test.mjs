import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app/native-push.js',import.meta.url),'utf8');
function harness({granted=true, enabled=false, fail=false}={}) {
  const listeners={}, calls=[], storage=new Map(), notifications=[];
  if(enabled)storage.set('inwang-fcm-v1',JSON.stringify({enabled:true,token:'old-token'}));
  const state={학생:{이름:'학생A'}}, c={S:state, setTimeout,clearTimeout,toast:m=>notifications.push(m),알림보이기:()=>notifications.push('opened'),localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}, api:async(...a)=>{calls.push(a);if(fail)throw Error('offline');return a[0]==='공지가져오기'?[{제목:'새 공지'}]:{ok:true};}};
  c.window=c;
  c.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',isPluginAvailable:()=>true,addListener:async(_,event,callback)=>{listeners[event]=callback;},nativePromise:async(_,method)=>{
    if(method==='checkPermissions'||method==='requestPermissions')return {receive:granted?'granted':'denied'};
    if(method==='register')queueMicrotask(()=>listeners.registration({value:'new-token'}));
  }};
  vm.runInNewContext(source,c);return {c,calls,listeners,notifications,state,storage};
}
test('native opt-in binds student and replaces old token',async()=>{const h=harness({enabled:true});assert.equal(await h.c.VocabNativePush.prepare(),true);assert.deepEqual(h.calls.map(x=>x[0]),['구독등록','구독해제']);assert.equal(h.calls[0][2].주소,'fcm:new-token');assert.equal(h.calls[1][1],'fcm:old-token');});
test('permission denial never registers',async()=>{const h=harness({granted:false});await assert.rejects(h.c.VocabNativePush.enable());assert.equal(h.calls.length,0);});
test('first launch never opts in automatically',async()=>{const h=harness();assert.equal(await h.c.VocabNativePush.prepare(),false);assert.equal(h.calls.length,0);});
test('logout removes token and next student rebinds',async()=>{const h=harness();await h.c.VocabNativePush.enable();await h.c.VocabNativePush.logout();h.state.학생={이름:'학생B'};await h.c.VocabNativePush.prepare();assert.equal(h.calls.at(-1)[1],'학생B');assert.equal(h.calls[1][0],'구독해제');});
test('failed unlink blocks logout completion',async()=>{const h=harness({enabled:true,fail:true});await assert.rejects(h.c.VocabNativePush.logout(),/offline/);assert.equal(JSON.parse(h.storage.get('inwang-fcm-v1')).token,'old-token');});
test('notification click opens notices for logged in student',async()=>{const h=harness();await h.c.VocabNativePush.prepare();h.listeners.pushNotificationActionPerformed({});await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.at(-1)[0],'공지가져오기');assert.deepEqual(h.notifications,['opened']);});

test('repeated enable shares one registration request',async()=>{const h=harness();await Promise.all([h.c.VocabNativePush.enable(),h.c.VocabNativePush.enable()]);assert.equal(h.calls.filter(x=>x[0]==='구독등록').length,1);});
test('disable unlinks server token and clears local opt-in',async()=>{const h=harness();await h.c.VocabNativePush.enable();await h.c.VocabNativePush.disable();assert.equal(h.calls.at(-1)[0],'구독해제');assert.equal(JSON.parse(h.storage.get('inwang-fcm-v1')).enabled,false);});
test('OS permission revocation removes previous student link',async()=>{const h=harness({granted:false,enabled:true});assert.equal(await h.c.VocabNativePush.prepare(),false);assert.equal(h.calls[0][0],'구독해제');assert.equal(JSON.parse(h.storage.get('inwang-fcm-v1')).token,'');});
test('cold-start notification waits for login then refreshes notices',async()=>{const h=harness();h.state.학생=null;await h.c.VocabNativePush.prepare();h.listeners.pushNotificationActionPerformed({});assert.equal(JSON.parse(h.storage.get('inwang-fcm-v1')).openNotice,true);h.state.학생={이름:'학생A'};await h.c.VocabNativePush.prepare();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.at(-1)[0],'공지가져오기');assert.deepEqual(h.notifications,['opened']);});
