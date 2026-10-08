// Apps Script 보조 창구(푸시 전송 · 그림 파일 · 매월 시상)를 대신한다. 2026-10-08 Apps Script 배포가 사라져 옮겼다.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { randomUUID } from 'node:crypto';
import { FirestoreRepository } from '../../services/firestore-repository.mjs';

initializeApp();
const db = getFirestore();
export const adminDb = () => db;   // 테스트용 — 객체를 그대로 내보내면 배포 분석기가 끝없이 훑는다
const region = 'asia-northeast3';

/* firestore.rules의 teacher()와 같은 판단 — 세션의 증명이 선생님(또는 브리지) 자격과 맞아야 한다 */
export async function teacherOk(uid) {
  const config = (await db.doc('runtime/config').get()).data();
  const session = (await db.doc(`sessions/${uid}`).get()).data();
  if (!config || config.state !== 'active' || !session || session.dataset !== config.dataset) return false;
  const credential = (await db.doc(`vocabDatasets/${config.dataset}/credentials/${session.credentialId}`).get()).data();
  return !!credential && ['teacher', 'bridge'].includes(credential.role) && credential.pinHash === session.proof;
}

/* 알림 서버로만 보낸다 — 아무 주소로나 나가는 창구가 되지 않게 */
const pushHosts = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
export function pushAddressOk(address) {
  try {
    const u = new URL(address);
    return u.protocol === 'https:' && pushHosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch { return false; }
}

/* 브라우저가 만든 VAPID 표를 실어 글 없이 쏜다. 돌려주는 꼴은 옛 Code.gs 푸시전송 그대로 */
export async function sendPush(list) {
  const 줄 = await Promise.all((list || []).map(async x => {
    const 주소 = String(x?.주소 ?? '');
    if (!pushAddressOk(주소)) return { 주소, 상태: 0, 글: '알림 서버 주소가 아닙니다.' };
    try {
      const r = await fetch(주소, { method: 'POST', body: '', headers: { TTL: '86400', Authorization: `vapid t=${x.표}, k=${x.공개키}` } });
      return { 주소, 상태: r.status, 글: (await r.text()).slice(0, 200) };
    } catch (e) { return { 주소, 상태: 0, 글: String(e?.message ?? e).slice(0, 200) }; }
  }));
  return { ok: true, 줄 };
}

const 이름다듬기 = v => String(v ?? '').replace(/[\\/:*?"<>|]/g, '');
async function saveImage(단어장, 이름, 자료, 종류) {
  const raw = String(자료 ?? ''), comma = raw.indexOf(',');
  const data = Buffer.from(raw.startsWith('data:') && comma > -1 ? raw.slice(comma + 1) : raw, 'base64');
  if (!data.length) throw new Error('그림이 비어 있습니다.');
  const type = String(종류 || 'image/png');
  if (!type.startsWith('image/')) throw new Error('그림 파일만 올릴 수 있습니다.');
  const bucket = getStorage().bucket(), token = randomUUID();
  const path = `그림/${이름다듬기(단어장)}_${이름다듬기(이름)}_${token.slice(0, 8)}`;
  await bucket.file(path).save(data, { contentType: type, metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

export const aux = onRequest({ region, cors: true, memory: '512MiB' }, async (req, res) => {
  try {
    if (req.method !== 'POST') return void res.status(405).json({ ok: false, 메시지: 'POST만 받습니다.' });
    const token = String(req.get('Authorization') ?? '').replace(/^Bearer /, '');
    const uid = token ? (await getAuth().verifyIdToken(token).catch(() => null))?.uid : null;
    if (!uid || !await teacherOk(uid)) return void res.status(403).json({ ok: false, 메시지: '선생님으로 들어와야 합니다.' });
    const { fn, args = [] } = req.body ?? {};
    if (fn === '푸시전송') return void res.json({ ok: true, 값: await sendPush(args[1]) });
    if (fn === '__그림파일') return void res.json({ ok: true, 값: await saveImage(args[1], args[2], args[3], args[4]) });
    res.status(400).json({ ok: false, 메시지: '쓸 수 없는 기능입니다: ' + fn });
  } catch (e) {
    res.status(500).json({ ok: false, 메시지: String(e?.message ?? e) });
  }
});

/* 옛 Apps Script 트리거(매월 1일 6~7시)와 같은 때. 같은 달 줄을 지우고 다시 쓰니 두 번 돌아도 괜찮다 */
export async function runMonthlyAward() {
  const { dataset, state } = (await db.doc('runtime/config').get()).data() ?? {};
  if (state !== 'active') throw new Error('runtime/config가 active가 아닙니다.');
  return new FirestoreRepository(db, dataset, { role: 'bridge', user: { uid: 'monthly-award' } }).call('__월시상', []);
}
export const monthlyAward = onSchedule({ region, schedule: '0 6 1 * *', timeZone: 'Asia/Seoul' }, async () => {
  console.log(JSON.stringify(await runMonthlyAward()));
});
