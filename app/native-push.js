/* Android FCM only. Web/iOS keep their existing notification implementation. */
(function () {
  'use strict';
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform() || C.getPlatform() !== 'android' || !C.isPluginAvailable('PushNotifications')) return;
  var key = 'inwang-fcm-v1', saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
  var pending, timer, listening, registering, queue = Promise.resolve();
  function persist() { localStorage.setItem(key, JSON.stringify(saved)); }
  function plugin(method, args) { return C.nativePromise('PushNotifications', method, args || {}); }
  function serialize(task) { var p = queue.then(task, task); queue = p.catch(function () {}); return p; }
  function remove(token) { return token ? api('구독해제', 'fcm:' + token).then(function (r) { if (!r.ok) throw new Error('알림 해제 실패'); }) : Promise.resolve(); }
  function bind(token) {
    return serialize(async function () {
      if (!saved.enabled || !S.학생) return;
      var old = saved.token;
      var result = await api('구독등록', S.학생.이름, {주소:'fcm:' + token, p256dh:'', auth:''}, 'Android FCM');
      if (!result.ok) throw new Error(result.메시지 || '알림 등록 실패');
      if (old && old !== token) await remove(old);
      saved.token = token; persist();
    });
  }
  async function notices(open) {
    var student = S.학생;
    if (!student) return;
    try {
      var result = await api('공지가져오기');
      if (S.학생 !== student) return;
      S.공지 = result || [];
      if (typeof 그리기_공지줄 === 'function') 그리기_공지줄();
      if (open) {
        if (typeof show === 'function') show('home');
        알림보이기(true);
        if (!S.공지.length) toast('확인할 새 공지가 없어요');
      }
    } catch (_) { if (open) toast('공지를 불러오지 못했어요. 새로고침해 주세요'); }
  }
  function listeners() {
    if (listening) return listening;
    listening = Promise.all([
      C.addListener('PushNotifications', 'registration', function (event) {
        var token = event.value;
        bind(token).then(function () {
          if (pending) { clearTimeout(timer); pending.resolve(); pending = null; }
        }).catch(function (error) {
          if (pending) { clearTimeout(timer); pending.reject(error); pending = null; }
        });
      }),
      C.addListener('PushNotifications', 'registrationError', function () {
        if (pending) { clearTimeout(timer); pending.reject(new Error('FCM 등록 실패')); pending = null; }
      }),
      C.addListener('PushNotifications', 'pushNotificationReceived', function () {
        if (S.학생) { toast('새 학원 알림이 도착했어요'); notices(false); }
      }),
      C.addListener('PushNotifications', 'pushNotificationActionPerformed', function () {
        if (S.학생) notices(true);
        else saved.openNotice = true;
        persist();
      })
    ]);
    return listening;
  }
  function register() {
    if (registering) return registering;
    registering = (async function () {
      await listeners();
      await plugin('createChannel', {id:'academy', name:'학원 공지', description:'숙제와 학원 공지 안내', importance:4, visibility:0});
      return new Promise(function (resolve, reject) {
        pending = {resolve:resolve, reject:reject};
        timer = setTimeout(function () { pending = null; reject(new Error('알림 등록 시간이 초과됐어요')); }, 30000);
        plugin('register').catch(function (error) { clearTimeout(timer); pending = null; reject(error); });
      });
    })();
    registering.then(function () { registering = null; }, function () { registering = null; });
    return registering;
  }
  window.VocabNativePush = {
    async prepare() {
      await listeners();
      if (saved.openNotice && S.학생) { saved.openNotice = false; persist(); notices(true); }
      var permission = await plugin('checkPermissions');
      if (permission.receive !== 'granted') {
        if (saved.token) await remove(saved.token);
        saved.enabled = false; saved.token = ''; persist();
        return false;
      }
      if (!saved.enabled) return false;
      await register(); return true;
    },
    async enable() {
      var permission = await plugin('requestPermissions');
      if (permission.receive !== 'granted') throw new Error('알림을 허용해야 받을 수 있어요');
      saved.enabled = true; persist();
      try { await register(); } catch (error) { saved.enabled = false; persist(); throw error; }
      return true;
    },
    async disable() {
      await serialize(async function () { await remove(saved.token); saved.enabled = false; saved.token = ''; persist(); await plugin('unregister'); });
    },
    async logout() {
      await serialize(async function () { await remove(saved.token); saved.token = ''; persist(); await plugin('removeAllDeliveredNotifications'); });
    }
  };
})();
