/* 알림 서버로만 보낸다 — 아무 주소로나 나가는 창구가 되지 않게 (손으로 보내는 sendPush · 예약 알림이 같이 쓴다) */
const pushHosts = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
export function pushAddressOk(address) {
  try {
    const u = new URL(address);
    return u.protocol === 'https:' && pushHosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch { return false; }
}
