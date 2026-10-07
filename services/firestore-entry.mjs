import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
import { FirestoreRepository } from './firestore-repository.mjs';
import { firebaseConfig } from './firebase-config.mjs';
const mode=globalThis.location?.pathname.includes('parent')?'parent':'student';
const app=initializeApp(firebaseConfig,'vocab-'+mode);
const auth=getAuth(app), db=getFirestore(app);
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
