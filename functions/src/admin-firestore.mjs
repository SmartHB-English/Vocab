// FirestoreRepository는 웹 SDK(firebase/firestore) 함수만 쓴다. 함수 번들에서는 이 파일이 그 자리를 대신해
// 같은 저장 코드를 Admin SDK로 돌린다 (scripts/build-functions.mjs의 alias).
const wrap = s => ({ exists: () => s.exists, data: () => s.data() });
export const doc = (db, path) => db.doc(path);
export const getDoc = ref => ref.get().then(wrap);
export const setDoc = (ref, data) => ref.set(data);
export const runTransaction = (db, body) => db.runTransaction(t => body({
  get: ref => t.get(ref).then(wrap),
  set: (ref, data) => { t.set(ref, data); },
  delete: ref => { t.delete(ref); },
}));
