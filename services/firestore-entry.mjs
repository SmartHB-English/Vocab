import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, getDoc, doc } from 'firebase/firestore';
import { FirestoreRepository } from './firestore-repository.mjs';
import { firebaseConfig } from './firebase-config.mjs';
const mode=globalThis.location?.pathname.includes('parent')?'parent':'student';
const app=initializeApp(firebaseConfig,'vocab-'+mode);
// getAuth()는 팝업·리다이렉트 처리기(iframe)까지 띄우는데, iOS 앱(capacitor://)에서는 그게 끝나지 않아
// authStateReady()가 영원히 멈춘다(2026-10-08 실기기 확인). 익명 로그인만 쓰므로 처리기 없이 초기화한다.
// 저장소는 getAuth()와 같게 둬서 기존 익명 계정(세션)이 그대로 이어진다.
const auth=initializeAuth(app,{persistence:[indexedDBLocalPersistence,browserLocalPersistence,browserSessionPersistence]}), db=initializeFirestore(app,{
  // 앱(iOS WKWebView)에서는 쓰기 직후 실시간 스트림(WebChannel)이 끊긴 채 ~30초 멈추는 일이 잦았다
  // (2026-10-08 아이폰 15 재실행 7회 중 5회). 앱에서만 롱 폴링으로 붙는다. 웹은 그대로.
  experimentalForceLongPolling: !!globalThis.Capacitor?.isNativePlatform?.(),
});
const identity={};
let repository;
let ready;
async function initialize() {
  if(!ready) ready=(async()=>{await auth.authStateReady(); const user=auth.currentUser ?? (await signInAnonymously(auth)).user; identity.user=user;})();
  await ready;
  const selector=(await getDoc(doc(db,'runtime/config'))).data();
  if(!selector||selector.state!=='active')throw new Error('자료를 옮기는 중입니다. 잠시 후 다시 해 주세요.');
  if(!repository||repository.dataset!==selector.dataset){
    repository=new FirestoreRepository(db,selector.dataset,identity);
    if(identity.role==='student')await repository.studentLogin(identity.name,identity.pin);
    else if(identity.role==='teacher')await repository.teacherLogin(identity.pin);
    else if(identity.role==='parent')await repository.parentLogin(identity.token);
  }
}
let queue=Promise.resolve();
globalThis.VocabFirestore={
  call(fn,args=[]) {
    const execute=async()=>{await initialize(); return repository.call(fn,args);};
    const promise=queue.then(execute,execute); queue=promise.catch(()=>{}); return promise;
  },
};
