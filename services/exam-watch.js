/* ==== 시험 감시 — 시험 하나 동안 앱을 나갔다 온 것 · 복사 붙여넣기를 센다 ====
   원본은 여기 하나 (node scripts/build-services.mjs 가 index.html 에 박는다). 학생 화면에만 — 선생님 · 학부모 화면에는 없다.
   · 시작() — 센 것을 0 으로 되돌리고 듣기 시작. 끝() — { 이탈수, 이탈초, 복사시도 } 를 돌려주고 듣기를 뗀다
     (끝() 을 두 번 불러도 같은 값 — 결과 화면으로 넘어갈 때 한 번, 보낼 때 한 번 부른다. 다음 시작() 이 0 으로 되돌린다)
   · 이탈 — 「나가 있다」 를 하나의 상태(나간때)로 다룬다. 알리는 쪽은 셋:
       visibilitychange · pagehide/pageshow — 「나갔다」 · 「돌아왔다」 를 알린다 (안드로이드 · 사파리는 이것이 정확하다)
       1초 시계 — 설치형 아이폰 앱(웹뷰)은 홈으로 나가도 visibilitychange 가 안 오는 때가 많다.
         앱이 뒤로 가면 타이머가 멈추니, 깨어났을 때 건너뛴 시간(지금 - 직전에 돈 때 - 1초)이 3초를 넘으면
         그 자리에서 나갔다 돌아온 것으로 친다. 3초 — 화면이 바쁘면 타이머가 조금 늦는다 (1초면 멀쩡히 푸는 중에도 걸린다)
     「나갔다」 — 이미 나가 있으면 아무것도 안 한다. 「돌아왔다」 — 나가 있던 중이 아니면 아무것도 안 한다.
     시계는 나가 있던 중이 아닐 때만 센다 — 그래서 둘 다 잡히는 기기에서도 한 번 나간 것은 한 번이다.
     돌아오면 직전에 돈 때를 지금으로 맞춘다 (다음 돌기에서 또 세지 않게).
     blur · focus 는 안 듣는다 — 입력칸을 오갈 때도 튄다
   · 시계는 시작() 에서 켜고 끝() · 치우기() 에서 끈다 (안 끄면 다음 시험에 섞이고 배터리도 먹는다)
   · 복사 · 잘라내기 · 붙여넣기 · 긴 누르기(contextmenu) — 막으면서 센다. 아이에게는 아무 말도 안 한다 (토스트도 없다)
   · 글자 고르기(user-select)는 건드리지 않는다 — 아이가 자기가 쓴 답을 고칠 수 있어야 한다
   · 켜 있는 동안만 막는다. 시험 화면을 떠나면 show() 가 끝() 을 불러 뗀다
   문서 · 지금 · 타이머 · 창 은 바꿔 끼울 수 있다 (tests/exam-watch.test.mjs 가 가짜 문서 · 가짜 시계로 돌린다) */
function 시험감시만들기_(문서, 지금, 타이머, 창){
  창 = 창 || 문서.defaultView || 문서;   /* pagehide · pageshow 는 window 에 온다 (document 로는 안 온다) */
  지금 = 지금 || function(){ return Date.now(); };
  타이머 = 타이머 || (typeof setInterval === 'function'
    ? { 켜기: function(f, ms){ return setInterval(f, ms); }, 끄기: function(id){ clearInterval(id); } }
    : null);
  var 한번 = 1000, 건너뜀기준 = 3000;
  var 막을것 = ['copy', 'cut', 'paste', 'contextmenu'];
  var 잡기 = { capture: true };      /* 붙일 때와 뗄 때 같은 것으로 — true 만 넘기면 떼지 못하는 곳이 있다 */
  var 이탈수 = 0, 이탈밀리 = 0, 복사시도 = 0, 나간때 = null, 켜짐 = false, 직전 = 0, 시계 = null;
  function 나갔다(){ if(나간때 === null) 나간때 = 지금(); }
  function 돌아왔다(){
    if(나간때 === null) return;
    var t = 지금();
    이탈수++;
    이탈밀리 += Math.max(0, t - 나간때);
    나간때 = null;
    직전 = t;
  }
  function 보임바뀜(){ if(문서.visibilityState === 'hidden') 나갔다(); else 돌아왔다(); }
  function 돌기(){
    var t = 지금(), 건너뜀 = t - 직전 - 한번;
    직전 = t;
    if(나간때 !== null) return;          /* 이미 나가 있는 중 — 돌아왔다 가 센다 */
    if(건너뜀 > 건너뜀기준){ 이탈수++; 이탈밀리 += 건너뜀; }
  }
  var 듣는것 = [[문서, 'visibilitychange', 보임바뀜], [창, 'pagehide', 나갔다], [창, 'pageshow', 돌아왔다]];
  function 막기(e){
    try{ e.preventDefault(); }catch(x){}
    복사시도++;
  }
  function 떼기(){
    if(!켜짐) return;
    켜짐 = false;
    if(시계 !== null && 타이머){ 타이머.끄기(시계); }
    시계 = null;
    듣는것.forEach(function(d){ d[0].removeEventListener(d[1], d[2]); });
    막을것.forEach(function(t){ 문서.removeEventListener(t, 막기, 잡기); });
  }
  return {
    시작: function(){
      떼기();
      이탈수 = 0; 이탈밀리 = 0; 복사시도 = 0; 나간때 = null;
      켜짐 = true;
      직전 = 지금();
      듣는것.forEach(function(d){ d[0].addEventListener(d[1], d[2]); });
      if(타이머) 시계 = 타이머.켜기(돌기, 한번);
      막을것.forEach(function(t){ 문서.addEventListener(t, 막기, 잡기); });
    },
    끝: function(){
      if(켜짐 && 시계 !== null) 돌기();                     /* 돌아오자마자 낸 때 — 시계가 한 번 더 돌기 전이어도 잡는다 */
      떼기();
      나간때 = null;
      return { 이탈수: 이탈수, 이탈초: Math.round(이탈밀리 / 1000), 복사시도: 복사시도 };
    },
    /* 보낸 뒤 0 으로 — 다음 판이 시작() 없이 보내도 앞 시험 숫자가 섞이지 않게 */
    치우기: function(){ 떼기(); 이탈수 = 0; 이탈밀리 = 0; 복사시도 = 0; 나간때 = null; },
    켜졌나: function(){ return 켜짐; }
  };
}
var 시험감시_ = typeof document !== 'undefined' && document.addEventListener ? 시험감시만들기_(document) : null;
/* 보낼 꾸러미에 싣는다 — 이 판을 시작() 으로 켠 화면(기록이 남는 판)에서만 부른다 */
function 감시싣기_(자료){
  var 센 = 시험감시_ ? 시험감시_.끝() : { 이탈수: 0, 이탈초: 0, 복사시도: 0 };
  if(시험감시_) 시험감시_.치우기();
  자료.이탈수 = 센.이탈수; 자료.이탈초 = 센.이탈초; 자료.복사시도 = 센.복사시도;
  return 자료;
}
/* ==== 시험 감시 끝 ==== */
