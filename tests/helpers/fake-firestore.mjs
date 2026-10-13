// FirestoreRepository 를 에뮬레이터 없이 돌리는 흉내 Firestore — 저장소가 쓰는 넷(doc · getDoc · setDoc · runTransaction)만.
// 검사가 'firebase/firestore' 를 이 파일로 돌려 놓고(module.register) 저장소를 부른다.
// 규칙은 하나만 흉내 낸다 — 세션(sessions/uid)은 proof 가 그 credential 의 pinHash 와 같아야 쓸 수 있다(로그인).
// 그 밖의 권한은 firebase/firestore.rules 와 에뮬레이터 검사(test:emulators)가 본다.
const 사진 = (path, data) => ({ exists: () => data !== undefined, data: () => structuredClone(data), id: path.split('/').pop() });

export function fakeDb() { return { docs: new Map(), commits: 0 }; }
export function doc(db, path) { return { db, path }; }
export async function getDoc(ref) { return 사진(ref.path, ref.db.docs.get(ref.path)); }
export async function setDoc(ref, data) {
  if (ref.path.startsWith('sessions/')) {
    const 열쇠 = ref.db.docs.get(`vocabDatasets/${data.dataset}/credentials/${data.credentialId}`);
    if (!열쇠 || 열쇠.pinHash !== data.proof) throw Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
  }
  ref.db.docs.set(ref.path, structuredClone(data));
}
/* 쓰기는 모아 두었다가 함수가 끝나면 한꺼번에 — 진짜 거래처럼 중간에 던지면 하나도 안 쓴다 */
export async function runTransaction(db, fn) {
  const 쓸것 = [];
  const tx = {
    get: async ref => 사진(ref.path, db.docs.get(ref.path)),
    set(ref, data) { 쓸것.push([ref.path, data]); return tx; },
    delete(ref) { 쓸것.push([ref.path]); return tx; },
  };
  const 답 = await fn(tx);
  for (const [path, data] of 쓸것) data === undefined ? db.docs.delete(path) : db.docs.set(path, structuredClone(data));
  if (쓸것.length) db.commits++;
  return 답;
}
