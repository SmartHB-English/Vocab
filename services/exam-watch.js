/* ==== 시험 감시 — 시험 하나 동안 앱을 나갔다 온 것 · 복사 붙여넣기를 센다 ====
   원본은 여기 하나 (node scripts/build-services.mjs 가 index.html 에 박는다). 학생 화면에만 — 선생님 · 학부모 화면에는 없다.
   · 시작() — 센 것을 0 으로 되돌리고 듣기 시작. 끝() — { 이탈수, 이탈초, 복사시도 } 를 돌려주고 듣기를 뗀다
     (끝() 을 두 번 불러도 같은 값 — 결과 화면으로 넘어갈 때 한 번, 보낼 때 한 번 부른다. 다음 시작() 이 0 으로 되돌린다)
   · 이탈 — visibilitychange 하나만 듣는다 (pagehide · blur 를 겹쳐 들으면 한 번 나간 것이 두 번으로 세어진다).
     가려질 때 시각을 적고, 돌아왔을 때만 센다. 나간 채로 안 돌아오면 그 시험은 제출이 안 되니 셀 일이 없다
   · 복사 · 잘라내기 · 붙여넣기 · 긴 누르기(contextmenu) — 막으면서 센다. 아이에게는 아무 말도 안 한다 (토스트도 없다)
   · 글자 고르기(user-select)는 건드리지 않는다 — 아이가 자기가 쓴 답을 고칠 수 있어야 한다
   · 켜 있는 동안만 막는다. 시험 화면을 떠나면 show() 가 끝() 을 불러 뗀다
   문서 · 지금 은 바꿔 끼울 수 있다 (tests/exam-watch.test.mjs 가 가짜 문서 · 가짜 시계로 돌린다) */
function 시험감시만들기_(문서, 지금){
  지금 = 지금 || function(){ return Date.now(); };
  var 막을것 = ['copy', 'cut', 'paste', 'contextmenu'];
  var 잡기 = { capture: true };      /* 붙일 때와 뗄 때 같은 것으로 — true 만 넘기면 떼지 못하는 곳이 있다 */
  var 이탈수 = 0, 이탈밀리 = 0, 복사시도 = 0, 나간때 = null, 켜짐 = false;
  function 보임바뀜(){
    if(문서.visibilityState === 'hidden'){ if(나간때 === null) 나간때 = 지금(); return; }
    if(나간때 === null) return;
    이탈수++;
    이탈밀리 += Math.max(0, 지금() - 나간때);
    나간때 = null;
  }
  function 막기(e){
    try{ e.preventDefault(); }catch(x){}
    복사시도++;
  }
  function 떼기(){
    if(!켜짐) return;
    켜짐 = false;
    문서.removeEventListener('visibilitychange', 보임바뀜);
    막을것.forEach(function(t){ 문서.removeEventListener(t, 막기, 잡기); });
  }
  return {
    시작: function(){
      떼기();
      이탈수 = 0; 이탈밀리 = 0; 복사시도 = 0; 나간때 = null;
      켜짐 = true;
      문서.addEventListener('visibilitychange', 보임바뀜);
      막을것.forEach(function(t){ 문서.addEventListener(t, 막기, 잡기); });
    },
    끝: function(){
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
