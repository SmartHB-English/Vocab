// Apps Script 보조 창구(푸시 전송 · 그림 파일 · 매월 시상)를 대신한다. 예약 알림(scheduledNotices)도 여기서 돈다. 2026-10-08 Apps Script 배포가 사라져 옮겼다.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { randomUUID } from 'node:crypto';
import { FirestoreRepository } from '../../services/firestore-repository.mjs';
import { pushAddressOk } from './push-address.mjs';
import { sendScheduledNotices, noticeLogRows, sendNoticeWith } from './scheduled-push.mjs';
export { pushAddressOk };

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

/* 브라우저가 만든 VAPID 표를 실어 글 없이 쏜다. 돌려주는 꼴은 옛 Code.gs 푸시전송 그대로 */
export async function sendPush(list, messaging = getMessaging()) {
  const 줄 = await Promise.all((list || []).map(async x => {
    const 주소 = String(x?.주소 ?? '');
    if (주소.startsWith('fcm:')) {
      const token = 주소.slice(4);
      if (!/^[A-Za-z0-9_:\-]{20,4096}$/.test(token)) return {주소, 상태:400, 글:'FCM 토큰이 올바르지 않습니다.'};
      try {
        await messaging.send({token, notification:{title:'인왕보카', body:'새 학원 알림이 있어요. 앱에서 확인해 주세요.'}, data:{route:'notices'}, android:{priority:'high', notification:{channelId:'academy', icon:'ic_stat_bell'}}, apns:{payload:{aps:{sound:'default'}}}});
        return {주소, 상태:200, 글:''};
      } catch (e) {
        const dead = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(e.code);
        return {주소, 상태:dead?410:0, 글:String(e.code || 'FCM 전송 실패')};
      }
    }
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
    if (fn === '알림보내기') return void res.json({ ok: true, 값: await sendNowNotice(args[1]) });
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

/* 알림 예약 — 10분마다 예약 표를 본다 (19시로 걸면 19시 0~9분에 나간다). 엔진이 보낸때를 먼저 찍고(거래) 보낼 것을 돌려주면
   여기서 서명해 쏜다. 브라우저가 없으니 VAPID 표는 설정의 푸시비밀키로 함수가 만든다 (scheduled-push.mjs).
   선생님이 손으로 보내는 길(aux 의 푸시전송 → sendPush)은 그대로다 */
export async function runScheduledNotices({ now = Date.now(), messaging = getMessaging(), webPush } = {}) {
  const { dataset, state } = (await db.doc('runtime/config').get()).data() ?? {};
  if (state !== 'active') throw new Error('runtime/config가 active가 아닙니다.');
  const repo = new FirestoreRepository(db, dataset, { role: 'bridge', user: { uid: 'scheduled-notice' } });
  const 할일 = await repo.call('__예약알림', [now]);
  const out = await sendScheduledNotices(할일, { messaging, webPush, repo });
  // 예약으로 나간 것도 알림기록 표에 — 묶음마다 한 줄 (누가: 예약)
  const 줄들 = noticeLogRows(out, '예약');
  if (줄들.length) {
    try { await repo.call('__알림기록쓰기', [줄들]); } catch (e) { out.기록못씀 = String(e?.message ?? e); }
  }
  for (const j of out.예약) delete j.줄;   // 로그에는 사람별 줄을 안 남긴다
  return out;
}
export const scheduledNotices = onSchedule({ region, schedule: '*/10 * * * *', timeZone: 'Asia/Seoul' }, async () => {
  console.log(JSON.stringify(await runScheduledNotices()));
});

/* 알림만 보내기 — 공지 없이, 선생님이 쓴 글을 고른 아이에게만. aux 가 선생님인지 이미 봤다.
   브라우저는 글을 암호화해 싣지 못하니 예약과 같은 sendScheduledNotices 로 쏜다 (web-push · FCM · 410 치우기).
   공지 올릴 때 · 「알림 시험 보내기」 는 여전히 브라우저가 서명하는 푸시전송 길이다 */
export async function sendNowNotice(값, { messaging = getMessaging(), webPush, repo } = {}) {
  const { 제목 = '', 내용 = '', 대상종류 = '전체', 대상값 = '' } = 값 ?? {};
  if (!repo) {
    const { dataset, state } = (await db.doc('runtime/config').get()).data() ?? {};
    if (state !== 'active') throw new Error('runtime/config가 active가 아닙니다.');
    repo = new FirestoreRepository(db, dataset, { role: 'bridge', user: { uid: 'notice-now' } });
  }
  return sendNoticeWith(repo, { 제목, 내용, 대상종류, 대상값 }, { messaging, webPush });
}
