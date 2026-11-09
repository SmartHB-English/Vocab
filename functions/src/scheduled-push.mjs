// 예약 알림을 쏜다 — 브라우저가 없으니 VAPID 표는 함수가 직접 서명한다.
// 열쇠는 설정 표의 푸시공개키 · 푸시비밀키 (선생님 화면이 만든 한 쌍: 공개키는 raw b64url, 비밀키는 JWK 글 — d 가 그 비밀 숫자다).
// 엔진(__예약알림)이 보낸때를 먼저 찍고 돌려준 목록만 쏜다. 선생님이 손으로 보내는 sendPush(index.mjs)는 건드리지 않는다.
// firebase-admin 을 들이지 않는다 — messaging · repo 는 받아 쓴다 (tests/scheduled-notice.test.mjs 가 흉내로 돌린다).
import { pushAddressOk } from './push-address.mjs';

export const 알림연락처 = 'https://smarthb-english.github.io/Vocab/';
const 죽은FCM = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

/* JWK 글 → web-push 가 받는 b64url 비밀 숫자. 옛날에 raw 로 적힌 것도 받아 준다 */
export function vapidPrivateKey(비밀키글) {
  const t = String(비밀키글 ?? '').trim();
  if (!t) return '';
  if (t.startsWith('{')) { try { return String(JSON.parse(t).d ?? ''); } catch { return ''; } }
  return t;
}

async function 웹보내기(webPush, sub, 실을것, vapid) {
  const 주소 = String(sub.주소);
  if (!pushAddressOk(주소)) return { 주소, 상태: 0, 글: '알림 서버 주소가 아닙니다.' };
  if (!vapid.privateKey || !vapid.publicKey) return { 주소, 상태: 0, 글: '푸시 열쇠가 없습니다 — 선생님 화면에서 알림 준비하기를 해 주세요.' };
  const 열쇠있나 = !!(sub.p256dh && sub.auth);
  try {
    // 구독 열쇠(p256dh·auth)가 있으면 제목·내용을 암호로 실어 보낸다. 없으면 선생님이 보내던 것처럼 글 없이 — 앱이 공지를 읽어 띄운다
    const r = await webPush.sendNotification({ endpoint: 주소, keys: 열쇠있나 ? { p256dh: sub.p256dh, auth: sub.auth } : undefined },
      열쇠있나 ? JSON.stringify(실을것) : null, { vapidDetails: vapid, TTL: 86400 });
    return { 주소, 상태: r?.statusCode ?? 201, 글: String(r?.body ?? '').slice(0, 200) };
  } catch (e) {
    return { 주소, 상태: Number(e?.statusCode) || 0, 글: String(e?.body || e?.message || e).slice(0, 200) };
  }
}

async function fcm보내기(messaging, sub, 실을것) {
  const 주소 = String(sub.주소), token = 주소.slice(4);
  if (!/^[A-Za-z0-9_:\-]{20,4096}$/.test(token)) return { 주소, 상태: 400, 글: 'FCM 토큰이 올바르지 않습니다.' };
  try {
    await messaging.send({ token, notification: { title: 실을것.제목, body: 실을것.내용 }, data: { route: 'notices' },
      android: { priority: 'high', notification: { channelId: 'academy', icon: 'ic_stat_bell' } }, apns: { payload: { aps: { sound: 'default' } } } });
    return { 주소, 상태: 200, 글: '' };
  } catch (e) {
    return { 주소, 상태: 죽은FCM.includes(e?.code) ? 410 : 0, 글: String(e?.code || 'FCM 전송 실패') };
  }
}

/**
 * 할일 = __예약알림 의 답 { 보낼것:[{행, 제목, 내용, 대상, 구독:[{이름, 주소, p256dh, auth}]}], 공개키, 푸시비밀키 }
 *   알림만 보내기(sendNoticeWith)도 같은 꼴로 넣는다 — 묶음 하나, 행은 없다.
 * 죽은 구독(404 · 410)은 선생님 화면과 같은 기준으로 모아 repo 의 __죽은구독지우기 로 치운다.
 * 돌려주는 것 = { 예약:[{행, 대상, 보냄, 실패, 줄}], 보냄, 실패, 지운구독 }  — 비밀키는 싣지 않는다
 */
export async function sendScheduledNotices(할일, { messaging, webPush, repo } = {}) {
  const 보낼것 = 할일?.보낼것 ?? [];
  const out = { 오늘: 할일?.오늘 ?? '', 찍은수: 할일?.찍은수 ?? 0, 예약: [], 보냄: 0, 실패: 0, 지운구독: 0 };
  if (!보낼것.length) return out;
  const vapid = { subject: 알림연락처, publicKey: String(할일.공개키 ?? ''), privateKey: vapidPrivateKey(할일.푸시비밀키) };
  if (보낼것.some(j => j.구독.some(s => !String(s.주소).startsWith('fcm:'))) && !webPush) webPush = (await import('web-push')).default;
  const 죽음 = new Set();
  for (const job of 보낼것) {
    const 실을것 = { 제목: job.제목 || '선생님 말씀', 내용: job.내용 || '' };
    const 줄 = await Promise.all(job.구독.map(sub => String(sub.주소).startsWith('fcm:')
      ? fcm보내기(messaging, sub, 실을것) : 웹보내기(webPush, sub, 실을것, vapid)));
    let 보냄 = 0, 실패 = 0;
    for (const r of 줄) {
      if ([200, 201, 202].includes(r.상태)) 보냄++;
      else { 실패++; if (r.상태 === 404 || r.상태 === 410) 죽음.add(r.주소); }
    }
    out.예약.push({ 행: job.행 ?? null, 종류: job.종류 ?? '', 대상글: job.대상 ?? '전체', 대상: job.구독.length, 제목: 실을것.제목, 내용: 실을것.내용,
      보냄, 실패, 탈: 줄.filter(r => ![200, 201, 202].includes(r.상태)).slice(0, 5),
      줄: 줄.map((r, i) => ({ 이름: job.구독[i]?.이름 ?? '', 기기: job.구독[i]?.기기 ?? '', 상태: r.상태, 글: r.글 })) });
    out.보냄 += 보냄; out.실패 += 실패;
  }
  if (죽음.size && repo) {
    try { out.지운구독 = (await repo.call('__죽은구독지우기', [[...죽음]]))?.개수 ?? 0; }
    catch (e) { out.구독못지움 = String(e?.message ?? e); }   // 못 치워도 알림은 이미 나갔다 — 다음에 또 치운다
  }
  return out;
}

/* 알림기록 표에 적을 줄 — 묶음마다 한 줄 */
export function noticeLogRows(out, 누가) {
  return (out?.예약 ?? []).map(j => ({ 누가, 대상: j.대상글 ?? '전체', 제목: j.제목 ?? '', 내용: j.내용 ?? '', 보냄: j.보냄 ?? 0, 실패: j.실패 ?? 0 }));
}

/**
 * 알림만 보내기 — __알림거리 → 쏘기(sendScheduledNotices 그대로) → __알림기록쓰기 차례.
 * 쏘다 터지면 고른 구독 모두를 실패로 적고 그 오류를 그대로 던진다 (선생님 화면에 뜬다).
 * 돌려주는 것 = { 보냄, 실패, 대상, 꺼진수, 줄:[{이름, 기기, 됐나, 상태, 왜}], 지운구독 }
 */
export async function sendNoticeWith(repo, { 제목 = '', 내용 = '', 대상종류 = '전체', 대상값 = '' } = {}, { messaging, webPush, send = sendScheduledNotices } = {}) {
  const 거리 = await repo.call('__알림거리', [대상종류, 대상값, 제목, 내용]);
  if (!거리?.ok) throw new Error(거리?.메시지 || '받을 사람을 찾지 못했습니다.');
  const 구독 = 거리.구독 ?? [];
  const 할일 = { 공개키: 거리.공개키, 푸시비밀키: 거리.푸시비밀키,
    보낼것: 구독.length ? [{ 제목: 거리.제목, 내용: 거리.내용, 대상: 거리.대상글, 구독 }] : [] };
  let out = null, 터짐 = null;
  try { out = await send(할일, { messaging, webPush, repo }); } catch (e) { 터짐 = e; }
  const 묶음 = out?.예약?.[0];
  const 보냄 = 터짐 ? 0 : (묶음?.보냄 ?? 0), 실패 = 터짐 ? 구독.length : (묶음?.실패 ?? 0);
  let 기록못씀 = '';
  try { await repo.call('__알림기록쓰기', [{ 누가: '선생님', 대상: 거리.대상글, 제목: 거리.제목, 내용: 거리.내용, 보냄, 실패 }]); }
  catch (e) { 기록못씀 = String(e?.message ?? e); }
  if (터짐) throw 터짐;
  const 됐다 = 상태 => [200, 201, 202].includes(상태);
  return { ok: true, 보냄, 실패, 대상: 거리.대상글, 꺼진수: 거리.꺼진수 ?? 0, 지운구독: out?.지운구독 ?? 0,
    줄: (묶음?.줄 ?? []).map(r => ({ 이름: r.이름, 기기: r.기기, 됐나: 됐다(r.상태), 상태: r.상태, 왜: 됐다(r.상태) ? '' : r.글 })),
    ...(기록못씀 ? { 기록못씀 } : {}) };
}
