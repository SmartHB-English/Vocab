/* 학생 화면과 선생님 화면이 함께 쓰는 것. 모듈이 아니다 —
   build-services.mjs 가 두 파일의 인라인 스크립트에 그대로 박는다. 여기를 고친 뒤 node scripts/build-services.mjs.
   한쪽 파일에만 같은 이름을 따로 두지 않는다 (tests/teacher-split.test.mjs 가 막는다).
   이 블록 앞에서 페이지마다 var 창구주소 를 정해 둔다 — 아래 GAS 가 그것을 읽는다. */

/** 화면에 넣을 글자를 HTML 로 안전하게 */
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

/* ---- 아래는 Code.gs 에서 그대로 옮겨 온 것 (글자 하나 바꾸지 않는다 — tests/shared-ui.test.mjs 가 맞대어 본다) ---- */

function s_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

/** 숙제 종류는 넷: 당일 · 기한 · 보충 · 시험 */
function 숙제종류_(v) {
  var t = s_(v);
  if (t === '보충') return '보충';
  if (t === '시험') return '시험';
  if (t === '기한') return '기한';
  return '당일';
}

/* 숙제 종류 「시험」 은 숙제가 아니라 학원에서 보는 시험이다 — 가르는 곳은 여기 한 군데 (Code.gs 에도 같은 꼴).
   숙제 수·제출률·안 낸 숙제에 시험을 넣지 않는다. 수업 안의 연습/시험 「단계」 와는 다른 것이다.
   종류가 빈 옛 숙제는 숙제 쪽이다 (숙제종류_ 가 당일·기한으로 읽는다) */
function 시험인가_(h) { return !!h && 숙제종류_(h.종류) === '시험'; }
function 숙제인가_(h) { return !시험인가_(h); }

/* ------------------------------- 어디서 열렸나 (창구주소 는 이 블록 앞에서) */
var 안쪽 = (typeof google !== 'undefined' && google.script && google.script.run);
var 미리보기 = (location.protocol === 'file:') ||
               (location.hostname === 'localhost' && location.search.indexOf('real') < 0) ||
               location.search.indexOf('demo') > -1;
var GAS = !미리보기 && (안쪽 || !!창구주소);

var 앱버전 = '2026-10-14b';   /* 파일이 제대로 올라갔는지 눈으로 확인하는 표시 */

/* ------------------------------- 미리보기용 예시 자료 */
var DEMO_WORDS = [
  ['acquire','얻다, 습득하다'],['acknowledge','인정하다'],['adapt','적응하다'],
  ['alter','변경하다'],['analyze','분석하다'],['anticipate','예상하다'],
  ['assess','평가하다'],['assume','가정하다'],['attribute','~의 탓으로 돌리다'],
  ['compensate','보상하다'],['contribute','기여하다'],['demonstrate','증명하다'],
  ['distinguish','구별하다'],['enhance','향상시키다'],['establish','확립하다'],
  ['generate','생성하다'],['implement','실행하다'],['indicate','나타내다'],
  ['modify','수정하다'],['perceive','인식하다'],['preserve','보존하다'],
  ['restrict','제한하다'],['sustain','유지하다'],['transform','변화시키다'],
  ['vulnerable','취약한']
].map(function(p,i){return {no:i+1,en:p[0],ko:p[1]};});

var DEMO_VERBS = [
  ['go - went - gone','가다'],
  ['be - was / were - been','~이다, 있다'],
  ['teach - taught - taught','가르치다'],
  ['write - wrote - written','쓰다'],
  ['get - got - got / gotten','얻다, 받다']
];

/* 교과서 본문 단어장 (문장) — 미리보기용 */
/* 문법 단어장 (빈칸을 [ ] 로 찍어 둔 문장) — 미리보기용 */
var DEMO_GRAM = [
  ['I saw a boy [running] across the street.',
   '나는 한 소년이 길을 건너는 것을 보았다.', '(run) 지각동사 + 목적어 + -ing'],
  ['She heard the birds [singing] in the tree.',
   '그녀는 새들이 나무에서 노래하는 것을 들었다.', '(sing) 지각동사 + -ing'],
  ['He studied so hard [that] he was able to teach in Korean.',
   '그는 매우 열심히 공부해서 한국어로 가르칠 수 있었다.', 'so + 부사 + that + 주어 + 동사'],
  ['We watched the sun [rise] over the mountain.',
   '우리는 해가 산 위로 떠오르는 것을 보았다.', '(rise) 지각동사 + 동사원형'],
  ['Every country has the right [to be] independent.',
   '모든 나라는 독립할 권리가 있다.', 'the right to + 동사원형']
];

var DEMO_TEXT = [
  ['Modern street art comes in many different forms, and it makes cities colorful and lively.',
   '현대의 거리 예술은 여러 가지 다양한 형태로 나타나며, 도시를 다채롭고 활기차게 만든다.',
   '교과서 88쪽 · Street Art in London'],
  ['Today, we are going to see some well-known street artworks in London.',
   '오늘 우리는 런던의 잘 알려진 거리 예술 작품들을 볼 것이다.',
   '교과서 88쪽 · Street Art in London'],
  ['The place that we are going to visit is Shoreditch.',
   '우리가 방문할 장소는 Shoreditch이다.',
   '교과서 89쪽 · Shoreditch & STIK'],
  ['He studied so hard that he was able to teach in Korean.',
   '그는 매우 열심히 공부해서 한국어로 가르칠 수 있었다.',
   '교과서 107쪽'],
  ['I have a special favor to ask you.',
   '당신에게 특별히 부탁드릴 것이 있습니다.',
   '교과서 106쪽'],
  ['He was thirsty and hungry.',
   '그는 목이 마르고 배가 고팠다.',
   '교과서 71쪽 · Camp Green Lake']
];

var DEMO_시작일 = '';

var DEMO_배정 = [
  {행:2,이름:'홍길동',학년구분:'초중등',학년:'중2',학교:'인왕중',단어장:[],
   교재:['예시 단어장','불규칙 동사 50']},
  {행:3,이름:'김영희',학년구분:'초중등',학년:'중2',학교:'인왕중',단어장:['예시 단어장'],
   교재:['예시 단어장']},
  {행:4,이름:'이철수',학년구분:'고등',학년:'고3',학교:'한성고',단어장:[],
   교재:['불규칙 동사 50','중2 5과 본문']},
  {행:5,이름:'최아람',학년구분:'유치',학년:'7세',학교:'인왕유치원',단어장:[],
   교재:['예시 단어장']}
];

var DEMO_게임 = [];
var DEMO_레슨 = {'예시 단어장':10, '불규칙 동사 50':5, '중2 5과 단어':10, '중2 5과 본문':3, '중2 6과 문법':5};
var DEMO_항목 = ['숙제'];
var DEMO_제외 = {};
var DEMO_무효 = {};
function DEMO_지난(일){
  var t=new Date(); t.setDate(t.getDate()-일);
  var z=function(n){return n<10?'0'+n:''+n;};
  return t.getFullYear()+'-'+z(t.getMonth()+1)+'-'+z(t.getDate());
}
function DEMO_종류(k){
  return (k==='보충'||k==='시험'||k==='기한') ? k : '당일';
}
/* 교재를 받은 학생 목록 — 진짜 앱에서 하는 것과 같은 방식 */
function DEMO_교재학생(책){
  return DEMO_배정.filter(function(x){ return (x.교재||[]).indexOf(책)>-1; })
                  .map(function(x){ return x.이름; });
}
function DEMO_대상(h){
  var 고른 = (h.학생||'').split(/\s*,\s*/).filter(String);
  return 고른.length ? 고른 : DEMO_교재학생(h.단어장);
}
var DEMO_HW = [
  {행:2,단어장:'예시 단어장',시작:1,끝:10,유형:'스펠링',마감일:'2026-12-31',학생:'',색:'#FF7A3D',종류:'기한',지남:false,
   대상수:2,한사람:['김영희'],안한사람:['홍길동'],모자란사람:['홍길동'],합격점:80},
  {행:3,단어장:'불규칙 동사 50',시작:1,끝:20,유형:'3단변화',마감일:'2026-12-31',학생:'홍길동',색:'#3B82F6',종류:'당일',지남:false,
   대상수:1,한사람:[],안한사람:['홍길동']},
  {행:4,단어장:'예시 단어장',시작:11,끝:25,유형:'4지선다',마감일:'2026-12-25',학생:'',색:'#FF7A3D',종류:'기한',지남:false,
   대상수:2,한사람:['홍길동','김영희'],안한사람:[]},
  {행:5,단어장:'예시 단어장',시작:21,끝:25,유형:'첫 글자',마감일:'2026-12-31',학생:'홍길동',색:'#FF7A3D',종류:'보충',지남:false,
   대상수:1,한사람:[],안한사람:['홍길동']},
  {행:6,단어장:'예시 단어장',시작:1,끝:25,유형:'스펠링',마감일:'2026-12-20',학생:'',색:'#FF7A3D',종류:'시험',지남:false,외우기분:5,제한시간:20,평균:null,
   대상수:2,한사람:[],안한사람:['홍길동','김영희']},
  /* 마감이 지난 것들 — 목록이 길어졌을 때를 보여 주려고 */
  {행:7,단어장:'예시 단어장',시작:1,끝:5,유형:'스펠링',마감일:DEMO_지난(3),등록일:DEMO_지난(3),학생:'',색:'#FF7A3D',종류:'기한',지남:true,
   대상수:2,한사람:['김영희'],안한사람:['홍길동']},
  {행:8,단어장:'예시 단어장',시작:6,끝:10,유형:'첫 글자',마감일:DEMO_지난(9),등록일:DEMO_지난(9),학생:'',색:'#FF7A3D',종류:'기한',지남:true,
   대상수:2,한사람:[],안한사람:['홍길동','김영희']},
  {행:9,단어장:'불규칙 동사 50',시작:1,끝:10,유형:'3단변화',마감일:DEMO_지난(40),등록일:DEMO_지난(40),학생:'',색:'#3B82F6',종류:'기한',지남:true,
   대상수:2,한사람:[],안한사람:['홍길동','이철수']},
  {행:10,단어장:'예시 단어장',시작:11,끝:20,유형:'스펠링',마감일:DEMO_지난(70),등록일:DEMO_지난(70),학생:'김영희',색:'#FF7A3D',종류:'기한',지남:true,
   대상수:1,한사람:[],안한사람:['김영희']},
  /* 교재로 낸 숙제 — 그 교재를 받은 학생 전원에게 한 줄로 나간다 */
  {행:11,단어장:'예시 단어장',시작:31,끝:40,유형:'스펠링',마감일:'2026-12-28',학생:'',색:'#FF7A3D',종류:'기한',지남:false,
   대상수:2,한사람:['김영희'],안한사람:['홍길동']},
  /* 학생을 골라서 낸 숙제 */
  {행:12,단어장:'예시 단어장',시작:41,끝:50,유형:'첫 글자',마감일:'2026-12-29',학생:'홍길동',색:'#FF7A3D',종류:'기한',지남:false,
   대상수:1,한사람:[],안한사람:['홍길동']},
  {행:13,단어장:'예시 단어장',시작:41,끝:50,유형:'첫 글자',마감일:'2026-12-29',학생:'김영희',색:'#FF7A3D',종류:'기한',지남:false,
   대상수:1,한사람:[],안한사람:['김영희']}
];
var DEMO_HW다음행 = 14;
/* 미리보기 과 단어장 — 진짜로는 시트 한 장에 「번호 | 구분 | 영어 | 뜻·해석 | 비고」 */
var DEMO_과책 = {
  '중2 7과': {
    단어: DEMO_WORDS.map(function(w){ return {en:w.en, ko:w.ko}; }),
    본문: DEMO_TEXT.map(function(w){ return {en:w[0], ko:w[1], 비고:w[2]}; }),
    문법: DEMO_GRAM.map(function(w){ return {en:w[0], ko:w[1], 비고:w[2]}; })
  }
};
function DEMO_과목록_(){
  return Object.keys(DEMO_과책).map(function(이름){
    var c = DEMO_과책[이름], 수 = {}, 합 = 0;
    ['단어','본문','문법','3단변화'].forEach(function(k){ if((c[k]||[]).length){ 수[k] = c[k].length; 합 += c[k].length; } });
    return {이름:이름, 개수:합, 종류:'과', 색:'#14B8A6', 레슨:10, 칸수:수};
  });
}
/* 미리보기 기록 — 진짜로는 「기록」 시트. 오늘 추천·내오답이 이걸 본다 (검사가 채워 넣는다) */
var DEMO_기록 = [];
/* 미리보기 수업틀 — 진짜 앱의 시트처럼 처음 부를 때 처음 틀을 옮겨 담는다 */
var DEMO_수업틀 = null;
function DEMO_틀들(){
  if(!DEMO_수업틀) DEMO_수업틀 = 처음수업틀_.map(function(t){
    return {이름:t.이름, 단계:JSON.parse(JSON.stringify(t.단계))};
  });
  return DEMO_수업틀;
}

var DEMO_공지 = [
  {키:'n1', 제목:'추석 연휴 휴강 안내',
   내용:'9월 28일(월)부터 30일(수)까지 학원이 쉽니다.\n숙제는 미리 내 두었으니 연휴 동안 틈틈이 해 주세요.',
   끝나는날:'2026-09-30', 켬:true},
  {키:'n2', 제목:'금요일 단어 시험',
   내용:'이번 주 금요일에 1~50번 전체 시험을 봅니다.',
   끝나는날:'', 켬:true}
];

/* 미리보기용 — 휴대폰 알림을 켠 학생 (진짜로는 시트에 쌓인다) */
var DEMO_구독 = [
  {행:2, 이름:'홍길동', 주소:'https://fcm.example/1', 기기:'안드로이드', 켠때:'2026-09-23'},
  {행:3, 이름:'김영희', 주소:'https://fcm.example/2', 기기:'아이폰', 켠때:'2026-09-23'}
];
var DEMO_열쇠 = {공개키:'', 비밀키:''};

var DEMO_설정 = { 합격점:80, 학원이름:'홍제인왕영어' };

var DEMO = {
  설정가져오기: function(){
    return {ok:true, 합격점:DEMO_설정.합격점, 학원이름:DEMO_설정.학원이름};
  },
  /* 시간은 숙제마다 — 외우기분·시험분을 보내도 안 받는다 */
  설정저장: function(pw, 값){
    값 = 값 || {};
    var 끝 = {합격점:100};
    var 말 = {합격점:'합격점은 0에서 100 사이로 넣어 주세요.'};
    var 새것 = {}, 나쁨 = '';
    if(값.학원이름!==undefined){
      var 이름 = String(값.학원이름==null?'':값.학원이름).trim();
      if(!이름) 나쁨 = '학원 이름을 넣어 주세요.';
      else if(이름.length > 40) 나쁨 = '학원 이름은 40자까지 넣을 수 있습니다.';
      else 새것.학원이름 = 이름;
    }
    ['합격점'].forEach(function(k){
      if(나쁨 || 값[k]===undefined || 값[k]==='') return;
      var n = Math.round(Number(값[k]));
      if(!isFinite(n) || n < 0 || n > 끝[k]){ 나쁨 = 말[k]; return; }
      새것[k] = n;
    });
    if(나쁨) return {ok:false, 메시지:나쁨};
    for(var k in 새것) DEMO_설정[k] = 새것[k];
    return {ok:true, 합격점:DEMO_설정.합격점, 학원이름:DEMO_설정.학원이름};
  },
  시작정보: function(){
    return {
      학원이름:DEMO_설정.학원이름,
      합격점:80,
      단어장목록:[{이름:'예시 단어장',개수:25,종류:'',색:'#FF7A3D',레슨:DEMO_레슨['예시 단어장']},{이름:'불규칙 동사 50',개수:5,종류:'3단변화',색:'#3B82F6',레슨:DEMO_레슨['불규칙 동사 50']},{이름:'중2 5과 단어',개수:DEMO_WORDS.length,종류:'',색:'#0EA5E9',레슨:DEMO_레슨['중2 5과 단어']},{이름:'중2 5과 본문',개수:DEMO_TEXT.length,종류:'본문',색:'#16A34A',레슨:DEMO_레슨['중2 5과 본문']},{이름:'중2 6과 문법',개수:DEMO_GRAM.length,종류:'문법',색:'#8B5CF6',레슨:DEMO_레슨['중2 6과 문법']}].concat(DEMO_과목록_())
    };
  },
  로그인:function(n){
    var 전체=[{이름:'예시 단어장',개수:25,레슨:DEMO_레슨['예시 단어장']},
               {이름:'불규칙 동사 50',개수:5,종류:'3단변화',레슨:DEMO_레슨['불규칙 동사 50']},
               {이름:'중2 5과 단어',개수:DEMO_WORDS.length,종류:'',색:'#0EA5E9',레슨:DEMO_레슨['중2 5과 단어']},{이름:'중2 5과 본문',개수:DEMO_TEXT.length,종류:'본문',레슨:DEMO_레슨['중2 5과 본문']},
               {이름:'중2 6과 문법',개수:DEMO_GRAM.length,종류:'문법',레슨:DEMO_레슨['중2 6과 문법']}].concat(DEMO_과목록_());
    var 찾을것=String(n||'').replace(/\s+/g,'');
    var me=null;
    DEMO_배정.forEach(function(x){ if(x.이름.replace(/\s+/g,'')===찾을것) me=x; });
    if(!me) return {ok:false, 메시지:'명단에 없는 이름이에요. 선생님께 말씀드리세요.'};
    /* 볼 수 있는 단어장은 명단의 「교재」 칸을 따른다 (비면 전부) */
    var 교재 = me.교재 || [];
    var 책 = 교재.length
      ? 전체.filter(function(b){ return 교재.indexOf(b.이름)>-1; })
      : 전체;
    return {ok:true, 학생:{이름:me.이름, 학년구분:me.학년구분}, 단어장목록:책};},
  단어가져오기:function(name){
    if(DEMO_과책[name]){
      var 과 = DEMO_과책[name], 줄 = [];
      ['단어','본문','문법','3단변화'].forEach(function(k){
        (과[k]||[]).forEach(function(w, i){
          var o = {no:i+1, en:w.en, ko:w.ko, 종류:'과', 칸:k};
          if(w.비고){ if(k==='본문'||k==='문법') o.비고 = w.비고; else o.그림 = w.비고; }
          줄.push(o);
        });
      });
      return 줄;
    }
    if(name && name.indexOf('불규칙')>=0) return DEMO_VERBS.map(function(w,i){
      return {no:i+1, en:w[0], ko:w[1], 종류:'3단변화'};});
    if(name && name.indexOf('문법')>=0) return DEMO_GRAM.map(function(w,i){
      return {no:i+1, en:w[0], ko:w[1], 비고:w[2], 종류:'문법'};});
    if(name && name.indexOf('본문')>=0) return DEMO_TEXT.map(function(w,i){
      return {no:i+1, en:w[0], ko:w[1], 비고:w[2], 종류:'본문'};});
    return DEMO_WORDS;
  },
  숙제가져오기:function(이름){
    var t=new Date(), z=function(n){return n<10?'0'+n:''+n;};
    var 오늘=t.getFullYear()+'-'+z(t.getMonth()+1)+'-'+z(t.getDate());
    var d3=new Date(t.getTime()+3*86400000);
    var 사흘후=d3.getFullYear()+'-'+z(d3.getMonth()+1)+'-'+z(d3.getDate());
    /* 낸때 — 숙제를 가려 주는 값. 선생님이 지웠다 다시 내면 달라진다 */
    if(!window.DEMO_낸때) window.DEMO_낸때 = [101,102,103,104,105,106];
    var n = window.DEMO_낸때;
    return [
    {단어장:'예시 단어장',시작:1,끝:10,유형:'스펠링',마감일:오늘,개별:false,색:'#FF7A3D',종류:'당일',남은일수:0,완료:false,점수:0,낸때:n[0]},
    {단어장:'예시 단어장',시작:11,끝:20,유형:'뜻 고르기',마감일:오늘,개별:false,색:'#FF7A3D',종류:'당일',남은일수:0,완료:true,점수:90,낸때:n[1]},
    {단어장:'불규칙 동사 50',시작:1,끝:20,유형:'3단변화',마감일:사흘후,개별:true,색:'#3B82F6',종류:'기한',남은일수:3,완료:false,점수:0,낸때:n[2]},
    {단어장:'예시 단어장',시작:21,끝:25,유형:'첫 글자',마감일:오늘,개별:true,색:'#FF7A3D',종류:'보충',남은일수:0,완료:false,점수:0,낸때:n[3]},
    {단어장:'예시 단어장',시작:1,끝:25,유형:'스펠링',마감일:사흘후,개별:false,색:'#FF7A3D',종류:'시험',남은일수:3,완료:false,점수:0,낸때:n[4],외우기분:5,제한시간:20},
    {단어장:'중2 5과 본문',시작:1,끝:DEMO_TEXT.length,유형:'빈칸 채우기',마감일:사흘후,개별:false,색:'#16A34A',종류:'기한',남은일수:3,완료:false,점수:0,낸때:n[5]},
    /* 수업 한 벌 — 순서대로, 앞엣것을 끝내야 다음이 열린다 */
    {단어장:'예시 단어장',시작:1,끝:10,유형:'스펠링',마감일:오늘,개별:false,색:'#FF7A3D',종류:'당일',남은일수:0,완료:true,점수:95,낸때:901,수업:'중2 6과 2회차',순서:1},
    {단어장:'중2 5과 본문',시작:1,끝:3,유형:'빈칸 채우기',마감일:오늘,개별:false,색:'#16A34A',종류:'당일',남은일수:0,완료:false,점수:0,낸때:902,수업:'중2 6과 2회차',순서:2},
    {단어장:'중2 5과 본문',시작:1,끝:3,유형:'영작',마감일:오늘,개별:false,색:'#16A34A',종류:'당일',남은일수:0,완료:false,점수:0,낸때:903,수업:'중2 6과 2회차',순서:3},
    {단어장:'중2 6과 문법',시작:1,끝:DEMO_GRAM.length,유형:'빈칸 채우기',마감일:오늘,개별:false,색:'#8B5CF6',종류:'당일',남은일수:0,완료:false,점수:0,낸때:904,수업:'중2 6과 2회차',순서:4}
  ];},
  결과저장:function(){return {ok:true,demo:true};},
  시상저장API:function(pw,ym){return {ok:true,년월:ym||'2026-09',개수:4};},
  시상시작일저장:function(pw,d){DEMO_시작일=d||''; return {ok:true,시작일:DEMO_시작일};},
  시상항목저장:function(pw,목록){
    DEMO_항목=(목록||[]).slice();
    if(!DEMO_항목.length) return {ok:false,메시지:'적어도 한 가지는 골라 주세요.'};
    return {ok:true,항목:DEMO_항목.slice()};},
  기록제외설정:function(pw,keys,뺄까){
    var n=0;
    (keys||[]).forEach(function(k){ DEMO_제외[Number(k)] = !!뺄까; n++; });
    return {ok:true,개수:n,뺐나:!!뺄까};},
  기록무르기:function(pw,keys,무를까){
    if(pw!=='1234') return {ok:false,메시지:'비밀번호가 다릅니다.'};
    var 무를키={}; (DEMO.선생님요약().시험목록||[]).forEach(function(t){ if(!t.재시험) 무를키[t.키]=1; });   // 오답 재시험만 빼고 무엇이든
    var n=0;
    (keys||[]).forEach(function(k){ k=Number(k); if(무를키[k] && !!DEMO_무효[k]!==!!무를까){ DEMO_무효[k]=!!무를까; n++; } });
    return {ok:true,개수:n,무름:!!무를까};},
  시험무르기:function(pw,keys,무를까){ return DEMO.기록무르기(pw,keys,무를까); },
  시상달목록:function(){return {ok:true,달:['2026-09','2026-08','2026-07']};},
  시상집계:function(pw,ym){
    ym = ym || '2026-09';
    var 줄=[
      {이름:'홍길동',숙제수:8,낸수:8,제출률:100,건수:8,평균:92,시험건수:2,시험평균:86,만점:4,지난평균:78,향상:14},
      {이름:'김영희',숙제수:8,낸수:7,제출률:88,건수:7,평균:95,시험건수:2,시험평균:91,만점:5,지난평균:93,향상:2},
      {이름:'이철수',숙제수:5,낸수:3,제출률:60,건수:3,평균:71,시험건수:1,시험평균:64,만점:0,지난평균:80,향상:-9},
      {이름:'박지훈',숙제수:5,낸수:4,제출률:80,건수:4,평균:84,시험건수:0,시험평균:null,만점:1,지난평균:62,향상:22}
    ];
    function 상만들기(키,값뽑기){
      var 후보=줄.filter(function(r){var v=값뽑기(r);return v!==null&&v>=1;});
      if(!후보.length) return null;
      var 최대=Math.max.apply(null,후보.map(값뽑기));
      var 동점=후보.filter(function(r){return 값뽑기(r)===최대;});
      return {값:최대,주인공:동점[0],동점:동점.map(function(r){return {이름:r.이름};})};
    }
    return {ok:true, 년월:ym, 지난달:'2026-08',
      상:{
        최우수:상만들기('최우수',function(r){return r.평균;}),
        성실:상만들기('성실',function(r){return r.제출률;}),
        발전:상만들기('발전',function(r){return r.향상;})
      },
      줄:줄.slice().sort(function(a,b){return b.평균-a.평균;}), 숙제수:13, 시작일:DEMO_시작일,
      항목:DEMO_항목.slice(), 항목전체:['숙제','시험','보충','오답노트']};},
  명단가져오기:function(){return {ok:true, 학생:DEMO_배정.map(function(x){
    return {행:x.행,이름:x.이름,비밀번호:x.비밀번호||'1234',학년구분:x.학년구분,
            학년:x.학년||'',학교:x.학교||'',교재:(x.교재||[]).slice(),
            학부모주소:x.학부모토큰?'https://smarthb-english.github.io/Vocab/parent.html#k='+x.학부모토큰:'',
            학부모마지막:x.학부모마지막||'', 한마디:x.한마디||''};})};},
  /* 학부모 — 진짜로는 학생 시트 9·10·11번째 칸 */
  학부모링크발급:function(pw,이름){
    var x=null; DEMO_배정.forEach(function(y){ if(y.이름===이름) x=y; });
    if(!x) return {ok:false,메시지:'학생을 찾지 못했습니다.'};
    var t=''; for(var i=0;i<64;i++) t+='0123456789abcdef'.charAt(Math.floor(Math.random()*16));
    x.학부모토큰=t; x.학부모마지막='';
    return {ok:true,이름:이름,주소:'https://smarthb-english.github.io/Vocab/parent.html#k='+t};
  },
  학부모한마디:function(pw,이름,글){
    글=String(글||'').trim();
    if(글.length>200) return {ok:false,메시지:'한마디는 200자까지 적을 수 있어요. (지금 '+글.length+'자)'};
    var x=null; DEMO_배정.forEach(function(y){ if(y.이름===이름) x=y; });
    if(!x) return {ok:false,메시지:'학생을 찾지 못했습니다.'};
    x.한마디=글; return {ok:true,이름:이름,한마디:글};
  },
  학부모미리보기:function(pw,이름){
    function 짧(d){ return d?Number(String(d).slice(5,7))+'/'+Number(String(d).slice(8,10)):''; }
    var 내것=DEMO_HW.filter(function(h){
      return !h.지남 && (h.한사람||[]).concat(h.안한사람||[]).indexOf(이름)>-1;
    });
    /* 숙제와 시험은 두 묶음 — 숙제 수에 시험을 섞지 않는다. 점수는 푼 것만 */
    var 이번주=내것.filter(숙제인가_).map(function(h){
      var 낸=(h.한사람||[]).indexOf(이름)>-1, 다시=!낸 && (h.모자란사람||[]).indexOf(이름)>-1;
      return {제목:h.단어장+' '+h.시작+'~'+h.끝, 유형:h.유형, 종류:h.종류, 완료:낸, 다시:다시, 점수:낸?90:(다시?68:null), 마감일:h.마감일||'', 마감글:짧(h.마감일)};
    });
    var 시험=내것.filter(function(h){ return 시험인가_(h) && (h.한사람||[]).indexOf(이름)<0; }).map(function(h){
      return {날짜:짧(h.마감일), 단어장:h.단어장, 범위:h.시작+'~'+h.끝, 유형:h.유형, 점수:null, 봤나:false};
    }).concat((DEMO.선생님요약().시험목록||[]).filter(function(t){ return t.이름===이름 && t.구분==='시험'; }).slice(0,8)
      .map(function(t){ return {날짜:String(t.시각).slice(0,5).replace(/^0/,'').replace('/0','/'), 단어장:t.단어장, 범위:t.범위, 유형:t.유형, 점수:t.점수, 봤나:true}; }));
    var x=null; DEMO_배정.forEach(function(y){ if(y.이름===이름) x=y; });
    return {ok:true, 이름:이름, 한마디:(x&&x.한마디)||'', 이번주숙제:이번주,
      낸수:이번주.filter(function(h){return h.완료;}).length, 안낸수:이번주.filter(function(h){return !h.완료;}).length,
      시험:시험, 자주틀린:[{단어:'assume',번:2}], 진도:[], 학원:{이름:'홍제인왕영어',전화:''}};
  },
  교재일괄:function(pw,행들,교재들,방식){
    var 고른=교재목록(교재들), 바뀐=0;
    (행들||[]).forEach(function(n){
      DEMO_배정.forEach(function(x){
        if(x.행!==Number(n)) return;
        var 지금=(x.교재||[]).slice(), 새것;
        if(방식==='덮어쓰기') 새것=고른.slice();
        else if(방식==='빼기') 새것=지금.filter(function(t){return 고른.indexOf(t)<0;});
        else { 새것=지금.slice(); 고른.forEach(function(t){ if(새것.indexOf(t)<0) 새것.push(t); }); }
        if(새것.join('|')!==지금.join('|')){ x.교재=새것; 바뀐++; }
      });
    });
    return {ok:true, 인원:바뀐, 방식:방식, 교재:고른,
      학생:DEMO_배정.map(function(x){
        return {행:x.행,이름:x.이름,비밀번호:'1234',학년구분:x.학년구분,
                학년:x.학년||'',학교:x.학교||'',교재:(x.교재||[]).slice()};})};},
  학생수정:function(pw,행,v){
    var 옛=null; DEMO_배정.forEach(function(x){ if(x.행===Number(행)) 옛=x; });
    if(!옛) return {ok:false,메시지:'이미 지워진 학생입니다.'};
    var 겹침=DEMO_배정.some(function(x){
      return x.행!==Number(행) && x.이름===v.이름; });
    if(겹침) return {ok:false,메시지:'“'+v.이름+'” 은 이미 있는 이름입니다.'};
    옛.이름=v.이름; 옛.학년=v.학년; 옛.학교=v.학교; 옛.학년구분=v.학년구분;
    if(v.교재!==undefined) 옛.교재=교재목록(v.교재);
    return {ok:true, 옮긴기록:0, 학생:DEMO_배정.map(function(x){
      return {행:x.행,이름:x.이름,비밀번호:'1234',학년구분:x.학년구분,
              학년:x.학년||'',학교:x.학교||'',교재:(x.교재||[]).slice()};})};},
  게임저장:function(p){
    DEMO_게임.push({게임:p.게임, 이름:p.이름, 점수:Number(p.점수)||0, 기록:p.기록||''});
    return {ok:true}; },
  게임순위:function(이름){
    function 줄(목록){
      var 등수=0, 앞=null;
      return 목록.map(function(x,i){
        if(x.점수!==앞){ 등수=i+1; 앞=x.점수; }
        return {이름:x.이름,점수:x.점수,기록:x.기록||'',등수:등수,나:(x.이름===이름)};
      });
    }
    var 짝=[{이름:'김영희',점수:820,기록:'22초 / 19번'},
            {이름:'홍길동',점수:640,기록:'31초 / 24번'},
            {이름:'이철수',점수:590,기록:'35초 / 22번'}];
    var 퍼즐=[{이름:'이철수',점수:410,기록:'12단어 / 88초'},
              {이름:'홍길동',점수:260,기록:'8단어 / 61초'}];
    /* 방금 저장한 판도 반영한다 (한 사람당 제일 잘한 판만) */
    DEMO_게임.forEach(function(g){
      var 목록 = g.게임==='짝' ? 짝 : 퍼즐;
      var 있 = 목록.filter(function(x){return x.이름===g.이름;})[0];
      if(있){ if(g.점수>있.점수){ 있.점수=g.점수; 있.기록=g.기록; } }
      else 목록.push({이름:g.이름,점수:g.점수,기록:g.기록});
    });
    짝.sort(function(a,b){return b.점수-a.점수;});
    퍼즐.sort(function(a,b){return b.점수-a.점수;});
    function 내점(목록){
      var v=목록.filter(function(x){return x.이름===이름;})[0];
      return v?v.점수:0;
    }
    return {ok:true, 오늘판:1, 게임:[
      {키:'짝',이름:'짝 맞추기',내최고:내점(짝),전체:줄(짝)},
      {키:'퍼즐',이름:'글자 퍼즐',내최고:내점(퍼즐),전체:줄(퍼즐)}
    ]};},
  공지가져오기:function(){
    return DEMO_공지.map(function(n){
      return {키:n.키, 제목:n.제목, 내용:n.내용, 만든날:'2026-09-23'}; });
  },
  공지목록:function(){ return {ok:true, 공지:DEMO_공지.map(function(n,i){
    return {행:i+2, 키:n.키, 제목:n.제목, 내용:n.내용,
            끝나는날:n.끝나는날||'', 켬:n.켬!==false, 만든날:'2026-09-23', 지남:false};
  })};},
  공지등록:function(pw,v){
    DEMO_공지.unshift({키:String(Date.now()), 제목:v.제목||'', 내용:v.내용||'',
                       끝나는날:v.끝나는날||'', 켬:true});
    return DEMO.공지목록(pw);
  },
  공지끄기:function(pw,행,켤까){
    var n=DEMO_공지[Number(행)-2]; if(n) n.켬=!!켤까;
    return DEMO.공지목록(pw);
  },
  공지삭제:function(pw,행){
    DEMO_공지.splice(Number(행)-2,1);
    return DEMO.공지목록(pw);
  },
  푸시공개키:function(){ return DEMO_열쇠.공개키; },
  푸시열쇠:function(){ return {ok:true, 공개키:DEMO_열쇠.공개키, 비밀키:DEMO_열쇠.비밀키}; },
  푸시열쇠저장:function(pw,공개,비밀){
    DEMO_열쇠={공개키:공개||'', 비밀키:비밀||''};
    return {ok:true, 공개키:DEMO_열쇠.공개키};
  },
  구독등록:function(){ return {ok:true}; },
  구독해제:function(){ return {ok:true}; },
  구독목록:function(pw,이름들){
    var 고른=(이름들||[]).slice();
    return {ok:true, 구독:DEMO_구독.filter(function(x){
      return !고른.length || 고른.indexOf(x.이름)>-1; })};
  },
  구독현황:function(){
    var 켠사람={};
    DEMO_구독.forEach(function(x){ 켠사람[x.이름]=1; });
    var 안켠=[];
    DEMO_배정.forEach(function(x){ if(!켠사람[x.이름]) 안켠.push({이름:x.이름}); });
    return {ok:true, 전체:DEMO_배정.length, 켬:Object.keys(켠사람).length,
            안켠:안켠, 열쇠있나:!!DEMO_열쇠.공개키};
  },
  연속가져오기:function(이름){
    var 사람=[
      {이름:'김영희',연속:12},
      {이름:'홍길동',연속:5},
      {이름:'박하늘',연속:5},
      {이름:'최연우',연속:0},
      {이름:'이철수',연속:8},
      {이름:'박지훈',연속:3}
    ];
    function 줄세우기(목록){
      목록=목록.slice().sort(function(a,b){
        if(b.연속!==a.연속) return b.연속-a.연속;
        return a.이름<b.이름?-1:1;});
      var 등수=0, 앞=null;
      return 목록.map(function(x,i){
        if(x.연속!==앞){ 등수=i+1; 앞=x.연속; }
        return {이름:x.이름,연속:x.연속,등수:등수,나:(x.이름===이름)};
      });
    }
    var 나=사람.filter(function(x){return x.이름===이름;})[0];
    return {ok:true, 연속:(나?나.연속:5), 최고:14, 오늘남음:true,
      시작일:'2026-09-15',
      전체순위:줄세우기(사람)};},
  내기록:function(){return [{시각:'09/06 18:20',단어장:'예시 단어장',범위:'1~10',유형:'스펠링',문항수:10,정답수:8,점수:80,게임점수:2400}];},
  월간순위:function(){return {
    이번달:'2026년 9월',
    순위:[{이름:'김영희',점수:95},{이름:'홍길동',점수:88},{이름:'박지훈',점수:74}],
    지난달:'2026년 8월',
    시상:[{이름:'홍길동',점수:97},{이름:'김영희',점수:93},{이름:'박지훈',점수:85}]};},
  선생님로그인:function(pw){return {ok:pw==='1234'};},
  선생님요약:function(){return {ok:true,
    시험목록:[
      {키:1,시각:'09/06 18:20',이름:'홍길동',단어장:'예시 단어장',범위:'1~10',유형:'스펠링',문항수:10,정답수:8,점수:80,게임점수:2400,소요초:95,숙제:true,재시험:false,구분:'숙제',틀린단어:'analyze, assume'},
      {키:3,시각:'09/06 18:24',이름:'홍길동',단어장:'예시 단어장',범위:'1~10',유형:'스펠링',문항수:2,정답수:1,점수:50,게임점수:100,소요초:20,숙제:false,재시험:true,구분:'오답 재시험',틀린단어:'assume'},
      {키:2,시각:'09/05 17:40',이름:'이철수',단어장:'예시 단어장',범위:'1~25',유형:'첫 글자',문항수:25,정답수:19,점수:76,게임점수:3100,소요초:210,숙제:true,재시험:false,구분:'숙제',틀린단어:'acquire, alter, assess, compensate, distinguish, restrict'},
      {키:4,시각:'09/07 16:00',이름:'김영희',단어장:'예시 단어장',범위:'1~25',유형:'스펠링',문항수:25,정답수:22,점수:88,게임점수:2200,소요초:300,숙제:true,재시험:false,구분:'시험',틀린단어:'alter, assess, restrict'}
    ].map(function(t){
      t.제외=!!DEMO_제외[t.키];
      if(!t.재시험){ t.무효=!!DEMO_무효[t.키]; if(t.무효) t.구분=(t.구분||'')+'(무효)'; }
      DEMO_배정.forEach(function(x){ if(x.이름===t.이름) t.교재=(x.교재||[]).slice(); });
      return t;
    }),
    학생별:[{이름:'홍길동',교재:['예시 단어장','불규칙 동사 50'],횟수:1,오답노트:1,보충:2,시험:1,못낸:0,평균:80,시험평균:72,최근:'09/06 18:20'},
            {이름:'이철수',교재:['불규칙 동사 50'],횟수:1,오답노트:0,보충:0,시험:0,못낸:1,평균:38,시험평균:null,최근:'09/05 17:40'},
            {이름:'김영희',교재:['예시 단어장'],횟수:0,오답노트:0,보충:1,시험:1,못낸:0,평균:null,시험평균:88,최근:'09/06 19:00'}],
    미응시:[{이름:'김영희',학년구분:'초중등',교재:['예시 단어장']}],
    오답:[{단어:'analyze',횟수:1},{단어:'assume',횟수:1}],
    학생목록:DEMO_배정.map(function(x){return x.이름;}),
    단어장목록:[{이름:'예시 단어장',개수:25,종류:'',색:'#FF7A3D',레슨:DEMO_레슨['예시 단어장']},{이름:'불규칙 동사 50',개수:5,종류:'3단변화',색:'#3B82F6',레슨:DEMO_레슨['불규칙 동사 50']},{이름:'중2 5과 단어',개수:DEMO_WORDS.length,종류:'',색:'#0EA5E9',레슨:DEMO_레슨['중2 5과 단어']},{이름:'중2 5과 본문',개수:DEMO_TEXT.length,종류:'본문',색:'#16A34A',레슨:DEMO_레슨['중2 5과 본문']},{이름:'중2 6과 문법',개수:DEMO_GRAM.length,종류:'문법',색:'#8B5CF6',레슨:DEMO_레슨['중2 6과 문법']}].concat(DEMO_과목록_()),
    시상항목:DEMO_항목.slice(),
    합격점:80,
    숙제목록:DEMO_HW.slice()};},
  선생님기본:function(pw){
    var d=DEMO.선생님요약(pw,7);
    return {ok:d.ok, 숙제목록:d.숙제목록, 학생목록:d.학생목록, 단어장목록:d.단어장목록, 시상항목:d.시상항목, 합격점:d.합격점};
  },
  /* 진짜와 같은 꼴 — 교재는 표로 한 번, 틀린 단어는 앞 다섯 개 + 몇 개 더 */
  선생님기록:function(pw,일수){
    var d=DEMO.선생님요약(pw,일수), 맵={};
    function 줄(t,i){
      var x=Object.assign({}, t), w=String(t.틀린단어||'').split(',').map(function(s){return s.trim();}).filter(String);
      if(t.교재) 맵[t.이름]=t.교재;
      delete x.교재;
      x.줄 = i+2; x.틀린단어 = w.slice(0,5).join(', '); x.틀린더 = Math.max(0, w.length-5);
      return x;
    }
    DEMO_배정.forEach(function(x){ if(!맵[x.이름]) 맵[x.이름]=(x.교재||[]).slice(); });
    return {ok:d.ok, 시험목록:(d.시험목록||[]).map(줄),
      학생별:d.학생별,              /* 흉내 학생별은 교재를 손으로 적어 두었다 — 그대로 (기록붙이기_ 는 없을 때만 채운다) */
      미응시:d.미응시, 오답:d.오답, 교재맵:맵};
  },
  틀린전문:function(){ return {ok:false}; },   /* 미리보기 숙제는 틀린 단어를 줄에 다 들고 있다 */
  기록메모:function(pw,줄,키){
    var t=(DEMO.선생님요약(pw,7).시험목록||[]).filter(function(x){ return x.키===Number(키); })[0];
    if(!t) return {ok:false, 메시지:'기록을 찾지 못했습니다 (정리했거나 지워진 기록)'};
    var w=String(t.틀린단어||'').split(',').map(function(s){return s.trim();}).filter(String);
    return {ok:true, 줄:줄, 키:Number(키), 틀린:w, 개수:w.length};
  },
  기록정리:function(pw,keys){return {ok:true,개수:(keys||[]).length};},
  지난숙제정리:function(pw,일수){
    var t=new Date(), z=function(n){return n<10?'0'+n:''+n;};
    t.setDate(t.getDate()-(Number(일수)||30));
    var 자른=t.getFullYear()+'-'+z(t.getMonth()+1)+'-'+z(t.getDate());
    var n=DEMO_HW.length;
    DEMO_HW=DEMO_HW.filter(function(h){ return !(h.마감일 && h.마감일 < 자른); });
    return {ok:true,개수:n-DEMO_HW.length,자른날:자른,숙제목록:DEMO_HW.slice()};},
  오래된기록정리API:function(){return {ok:true,개수:0};},
  수업꾸러미목록:function(){
    return 처음수업틀_.map(function(t){ return {키:t.키,이름:t.이름,설명:t.설명,단계:t.단계}; });
  },
  수업내주기:function(pw,c){
    if(!String(c.이름||'').trim()) return {ok:false,메시지:'수업 이름을 적어 주세요.'};
    if(!(c.단계 && c.단계.length)){
      var 꾸 = 처음수업틀_.filter(function(k){return k.키===c.꾸러미;})[0];
      if(!꾸) return {ok:false,메시지:'꾸러미를 골라 주세요.'};
      return {ok:true, 이름:c.이름, 단계수:꾸.단계.length, 숙제목록:DEMO_HW.slice()};
    }
    var 됨=0, 탈=[], 새것들=[];
    c.단계.forEach(function(d,i){
      var r = DEMO.숙제등록(pw,{단어장:d.단어장,칸:d.칸||'',시작:d.시작,끝:d.끝,유형:d.유형,제한시간:d.제한시간,
        단계:d.단계,통과점수:d.통과점수,재응시:d.재응시,종류:c.종류,
        마감일:c.마감일,학생들:c.학생들,수업:c.이름,순서:i+1});
      if(r.ok){ 됨++; 새것들.push(r.숙제); } else 탈.push((i+1)+'단계 '+d.유형+' — '+r.메시지);
    });
    if(!됨) return {ok:false, 메시지:탈[0]||'수업을 내지 못했습니다.'};
    return {ok:true, 이름:c.이름, 단계수:됨, 메시지:탈.length?('일부만 나갔습니다 — '+탈.join(' / ')):'',
            숙제들:새것들};
  },
  수업틀목록:function(){ return {ok:true, 틀:JSON.parse(JSON.stringify(DEMO_틀들()))}; },
  수업틀저장:function(pw,이름,단계){
    이름 = String(이름||'').trim();
    if(!이름) return {ok:false,메시지:'틀 이름을 적어 주세요.'};
    var 정리 = (단계||[]).filter(function(x){ return x && x.유형; }).map(function(x){
      var o = {};
      ['종류','칸','어디','유형','분','제한','단계','통과','재응시','지난','개수'].forEach(function(k){
        if(x[k]!==undefined && x[k]!==null && x[k]!=='') o[k]=x[k];
      });
      return o;
    });
    if(!정리.length) return {ok:false,메시지:'단계를 하나 이상 넣어 주세요.'};
    var 틀 = DEMO_틀들(), 있던 = 틀.filter(function(t){ return t.이름===이름; })[0];
    if(있던) 있던.단계 = 정리; else 틀.push({이름:이름, 단계:정리});
    return DEMO.수업틀목록();
  },
  수업틀삭제:function(pw,이름){
    DEMO_수업틀 = DEMO_틀들().filter(function(t){ return t.이름!==이름; });
    return DEMO.수업틀목록();
  },
  /* 진짜 앱의 수업재료_ 를 흉내 내서 같은 규칙(수업추천짜기_)을 돌린다 */
  수업추천:function(pw,교재,예산){
    var 책 = DEMO.시작정보().단어장목록.filter(function(b){ return b.이름===교재; })[0] || {};
    var 한달전 = DEMO_지난(30);
    /* 과 단어장이면 다 같이 틀린 단어의 자리는 단어 구분 안에서 센다 */
    var 단어들 = DEMO.단어가져오기(교재).filter(function(w){ return !w.칸 || w.칸==='단어'; }).map(function(w){ return w.en; });
    return {ok:true, 추천:수업추천짜기_({
      교재:교재, 종류:책.종류||'', 오늘:DEMO_지난(0), 예산:Number(예산)||추천예산기본_,
      레슨:책.레슨||DEMO_레슨[교재]||10, 총:책.개수||단어들.length, 칸수:책.칸수||{},
      학생수:DEMO_교재학생(교재).length,
      숙제들:DEMO_HW.filter(function(h){ return h.단어장===교재 && 숙제인가_(h); }).map(function(h){
        return {단어장:h.단어장,칸:h.칸||'',시작:h.시작,끝:h.끝,유형:h.유형,등록:h.등록일||'',제한시간:h.제한시간||0,안낸수:(h.안한사람||[]).length};
      }),
      기록들:DEMO_기록.filter(function(r){ return r.단어장===교재 && r.날>=한달전; }),
      단어들:단어들
    })};
  },
  내오답:function(이름,단어장,함께,칸){
    var 본={}, 단어=[];
    function 이칸(r){ return !칸 || (r.칸||'')===칸; }
    function 넣기(w){ var k=String(w||'').toLowerCase(); if(!k || 본[k]) return; 본[k]=1; 단어.push(w); }
    if(함께) 함께틀린_(DEMO_기록.filter(function(r){ return r.단어장===단어장 && r.날>=DEMO_지난(30) && 이칸(r); }),
                     DEMO_교재학생(단어장).length).forEach(function(x){ 넣기(x.글); });
    DEMO_기록.filter(function(r){ return r.이름===이름 && r.단어장===단어장 && 이칸(r); })
      .sort(function(a,b){ return a.날<b.날 ? 1 : -1; }).slice(0,10)
      .forEach(function(r){ 틀린칸풀기_(r.틀린).forEach(넣기); });
    return {ok:true, 단어:단어};
  },
  수업삭제:function(){ return {ok:true, 지운수:0, 숙제목록:DEMO.전체숙제?DEMO.전체숙제():[]}; },
  숙제등록:function(pw,h){
    var 색맵={'예시 단어장':'#FF7A3D','불규칙 동사 50':'#3B82F6'};
    var 종류=DEMO_종류(h.종류);
    var t=new Date(), z=function(n){return n<10?'0'+n:''+n;};
    var 오늘=t.getFullYear()+'-'+z(t.getMonth()+1)+'-'+z(t.getDate());
    var 책=h.단어장||h.교재;
    if(!책) return {ok:false,메시지:'단어장을 골라 주세요.'};
    var 고른=(h.학생들||[]).filter(String);
    var 대상들 = 고른.length ? 고른.slice() : DEMO_교재학생(책);
    if(!대상들.length) return {ok:false,
      메시지:'“'+책+'” 을(를) 배우는 학생이 없습니다. 학생 명단에서 교재를 먼저 주시거나, 받을 학생을 골라 주세요.'};
    DEMO_HW.push({행:DEMO_HW다음행++,단어장:책,
      시작:Number(h.시작)||1,끝:Number(h.끝)||0,유형:h.유형,
      마감일:(종류==='기한'||종류==='시험')?h.마감일:오늘,학생:고른.join(', '),
      색:색맵[책]||'',종류:종류,지남:false,수업:h.수업||'',순서:Number(h.순서)||0,칸:h.칸||'',
      제한시간:Number(h.제한시간)>0?Math.round(Number(h.제한시간)):0,
      외우기분:Number(h.외우기분)>0?Math.round(Number(h.외우기분)):0,
      단계:(h.단계==='연습'||h.단계==='시험')?h.단계:'',
      통과점수:h.단계==='시험'&&h.통과점수!==''&&h.통과점수!==undefined?Number(h.통과점수)||0:'',
      재응시:h.단계==='시험'&&h.재응시!==''&&h.재응시!==undefined?Number(h.재응시)||0:'',
      문항수:(Number(h.문항수)>0&&Number(h.문항수)<=200)?Math.round(Number(h.문항수)):'',
      막힌사람:[],등록일:오늘,
      대상수:대상들.length,한사람:[],안한사람:대상들.slice()});
    return {ok:true,개수:1,대상:대상들.length,숙제:JSON.parse(JSON.stringify(DEMO_HW[DEMO_HW.length-1]))};},
  교재대상:function(pw,교재){
    var 학생=DEMO_교재학생(교재);
    return {ok:true, 교재:교재, 인원:학생.length, 학생:학생};},
  숙제삭제:function(pw,행){
    var r = DEMO.숙제여러개삭제(pw,[행]);
    return {ok:r.ok, 지운행:r.지운행};},
  미제출시트:function(){
    var n=DEMO_HW.filter(function(h){return (h.안한사람||[]).length;}).length;
    return {ok:true,건수:n,인원:n};},
  숙제여러개삭제:function(pw,행들){
    /* 시트처럼 — 지운 줄 아래 줄들은 번호가 당겨진다 ({행, 낸때} 도 받는다) */
    var 셋={};
    (행들||[]).forEach(function(r){
      var n = Number(r && typeof r==='object' ? r.행 : r);
      if(DEMO_HW.some(function(h){ return h.행===n; })) 셋[n]=1;
    });
    var 지운 = Object.keys(셋).map(Number).sort(function(a,b){return a-b;});
    DEMO_HW = DEMO_HW.filter(function(h){ return !셋[h.행]; }).map(function(h){
      var 앞 = 지운.filter(function(n){ return n < h.행; }).length;
      if(앞) h.행 -= 앞;
      return h;
    });
    DEMO_HW다음행 -= 지운.length;
    return {ok:true,개수:지운.length,지운행:지운};},
  숙제숨김바꾸기:function(pw,행들,숨길까){
    /* 지우지 않는다 — 그 줄의 학부모숨김만. 줄번호는 그대로 */
    var 바꾼=[];
    (행들||[]).forEach(function(r){
      var n = Number(r && typeof r==='object' ? r.행 : r);
      DEMO_HW.forEach(function(h){ if(h.행===n && 바꾼.indexOf(n)<0){ h.학부모숨김=!!숨길까; 바꾼.push(n); } });
    });
    바꾼.sort(function(a,b){return a-b;});
    return {ok:true,개수:바꾼.length,바꾼행:바꾼};},
  숙제수정:function(pw,행,h){
    h=h||{};
    var 색맵={'예시 단어장':'#FF7A3D','불규칙 동사 50':'#3B82F6'};
    var t=new Date(), z=function(n){return n<10?'0'+n:''+n;};
    var 오늘=t.getFullYear()+'-'+z(t.getMonth()+1)+'-'+z(t.getDate());
    var 앞을=['단어장','시작','끝','유형','종류','마감일'].some(function(k){return h[k]!==undefined;});
    function 하나(r){
      var n=Number(r&&r.행!==undefined?r.행:r), 대상=null;
      DEMO_HW.forEach(function(x){if(x.행===n) 대상=x;});
      if(!대상) return false;
      if(앞을){
        var 종류=DEMO_종류(h.종류);
        var f=Number(h.시작)||1, e=Number(h.끝)||0;
        if(e<f){var s=f;f=e;e=s;}
        대상.단어장=h.단어장; 대상.시작=f; 대상.끝=e; 대상.유형=h.유형;
        대상.종류=종류; 대상.마감일=(종류==='당일')?오늘:h.마감일;
        대상.색=색맵[h.단어장]||'';
      }
      ['외우기분','제한시간','통과점수','재응시','문항수'].forEach(function(k){
        if(h[k]===undefined) return;
        var v=(h[k]===''||h[k]===null)?'':Math.round(Number(h[k]));
        if(k==='외우기분'||k==='제한시간') v=Number(v)||0;
        if(k==='문항수') v=(v>0&&v<=200)?v:'';
        대상[k]=v;
      });
      return true;
    }
    function 줄(n){ var x=null; DEMO_HW.forEach(function(h){ if(h.행===n) x=h; }); return x ? JSON.parse(JSON.stringify(x)) : null; }
    if(Array.isArray(행)){
      var 된줄=행.filter(하나);
      return {ok:true,개수:된줄.length,숙제들:된줄.map(function(r){ return 줄(Number(r&&r.행!==undefined?r.행:r)); })};
    }
    if(!하나(행)) return {ok:false,메시지:'이미 지워진 숙제입니다'};
    return {ok:true,숙제:줄(Number(행))};},
  단어붙여넣기:function(){return {ok:true,개수:0,메시지:'미리보기에서는 저장되지 않습니다.'};},
  학생붙여넣기:function(pw,본문,기본비번,학년구분,학년,학교,교재){
    var 있는것={}; DEMO_배정.forEach(function(x){ 있는것[x.이름]=1; });
    var 겹침=[], 넣음=0;
    String(본문||'').split(/[\n,]/).forEach(function(줄){
      var t=줄.trim(); if(!t) return;
      var p=t.split(/\s+/), 이름=p[0];
      if(있는것[이름]){ 겹침.push(이름); return; }
      있는것[이름]=1; 넣음++;
      DEMO_배정.push({행:DEMO_배정.length+2, 이름:이름,
        학년구분:(학년구분==='고등'||학년구분==='유치')?학년구분:'초중등',
        학년:학년||'', 학교:학교||'', 단어장:[],
        교재:교재목록(교재), 비밀번호:(p[1]||기본비번||'1234')});
    });
    if(!넣음) return {ok:false, 메시지: 겹침.length
      ? '이미 있는 이름뿐입니다: '+겹침.join(', ') : '이름이 없습니다.'};
    return {ok:true, 개수:넣음, 겹침:겹침, 학생:DEMO.명단가져오기(pw).학생};},
  /* 과 한꺼번에 넣기 — 진짜 앱의 과넣기 와 같은 답 */
  /* 재응시를 다 쓴 아이에게 한 번 더 — 진짜 앱은 「재응시」 시트에 적는다 */
  재응시더주기:function(pw,행,이름,몇){
    DEMO_HW.forEach(function(h){
      if(h.행===Number(행)) h.막힌사람=(h.막힌사람||[]).filter(function(n){ return n!==이름; });
    });
    return {ok:true, 숙제목록:DEMO_HW.slice()};
  },
  과넣기:function(pw,c){
    c = c || {};
    var 이름 = String(c.이름||'').trim(), 개수 = {단어:0, 본문:0, 문법:0};
    if(!이름) return {ok:false, 이름:'', 종류:'과', 개수:개수, 결과:'실패', 까닭:'단어장 이름이 없습니다.'};
    var 새것 = {}, 합 = 0;
    ['단어','본문','문법','3단변화'].forEach(function(k){
      var 줄 = ((c.구분들||{})[k]||[]).filter(function(r){ return r && r.en && r.ko; });
      if(줄.length){ 새것[k] = 줄.map(function(r){ return {en:r.en, ko:r.ko, 비고:r.비고||''}; }); 개수[k] = 줄.length; 합 += 줄.length; }
    });
    if(!합) return {ok:false, 이름:이름, 종류:'과', 개수:개수, 결과:'실패', 까닭:'넣을 줄이 없습니다.'};
    var 옛것 = DEMO.시작정보().단어장목록.filter(function(b){ return b.이름===이름; })[0];
    if(옛것 && !c.덮어쓰기) return {ok:true, 이름:이름, 종류:'과', 개수:개수, 결과:'건너뜀', 까닭:'같은 이름의 단어장이 이미 있어서 건너뛰었습니다.'};
    if(옛것 && 옛것.종류!=='과') return {ok:false, 이름:이름, 종류:'과', 개수:개수, 결과:'실패', 까닭:'같은 이름의 다른 단어장이 있습니다.'};
    DEMO_과책[이름] = 새것;
    return {ok:true, 이름:이름, 종류:'과', 개수:개수, 결과: 옛것 ? '덮음' : '만듦', 까닭:'',
            단어장목록: DEMO.시작정보().단어장목록};
  },
  단어목록:function(pw,책){
    if(DEMO_과책[책]) return {ok:true, 종류:'과', 단어들:DEMO.단어가져오기(책).map(function(w){
      return {번호:w.no, 칸:w.칸, en:w.en, ko:w.ko, 그림:w.그림||'', 비고:w.비고||''}; })};
    return {ok:true,단어들:DEMO_WORDS.map(function(w,i){
      return {행:i+2,번호:i+1,en:w.en,ko:w.ko,그림:w.그림||''};})};},
  그림올리기:function(pw,책,행,이름,자료,종류){
    var w=DEMO_WORDS[Number(행)-2]; if(!w) return {ok:false,메시지:'없는 줄입니다.'};
    w.그림='data:'+(종류||'image/png')+';base64,'+자료;
    return {ok:true,주소:w.그림};},
  그림지우기:function(pw,책,행){
    var w=DEMO_WORDS[Number(행)-2]; if(w) delete w.그림; return {ok:true};},
  그림여러개:function(pw,책,것들){
    var 붙인=0, 못=[];
    (것들||[]).forEach(function(g){
      var k=DEMO열쇠_(g&&g.이름);
      var w=DEMO_WORDS.filter(function(x){return DEMO열쇠_(x.en)===k;})[0];
      if(w && k){ w.그림='data:'+(g.종류||'image/png')+';base64,'+g.자료; 붙인++; }
      else 못.push(String((g&&g.이름)||''));
    });
    return {ok:true,붙인수:붙인,못찾은:못};},
  단어수정:function(pw,책,행,en,ko){var i=Number(행)-2; if(DEMO_WORDS[i]){DEMO_WORDS[i].en=en;DEMO_WORDS[i].ko=ko;} return {ok:true};},
  단어삭제:function(pw,책,행들){(행들||[]).sort(function(a,b){return b-a;}).forEach(function(r){DEMO_WORDS.splice(Number(r)-2,1);});
      DEMO_WORDS.forEach(function(w,i){w.no=i+1;}); return {ok:true,개수:(행들||[]).length};},
  단어추가:function(pw,책,en,ko){DEMO_WORDS.push({no:DEMO_WORDS.length+1,en:en,ko:ko}); return {ok:true};},
  단어장이름변경:function(){return {ok:true,단어장목록:DEMO.선생님요약().단어장목록};},
  단어장색변경:function(pw,책,색){return {ok:true,단어장목록:DEMO.선생님요약().단어장목록};},
  레슨크기저장:function(pw,책,n){
    var L=DEMO.선생님요약().단어장목록;
    L.forEach(function(x){ if(x.이름===책) x.레슨=Number(n)||10; });
    DEMO_레슨[책]=Number(n)||10;
    return {ok:true,단어장목록:L};},
  단어장삭제:function(){return {ok:true,단어:DEMO_WORDS.length,숙제:0,단어장목록:[]};}
};

/* ------------------------------- 두 화면이 같이 쓰는 도움 함수 (index.html 에 있던 차례대로) */
function $(id){return document.getElementById(id);}

function qsa(s,root){return [].slice.call((root||document).querySelectorAll(s));}

function toast(msg){
  var t=$('toast'); t.textContent=msg; t.classList.add('on');
  clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('on');},1900);
}

function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
/* 문항 수 — 범위 안에서 몇 개만 낸다. 섞은 뒤 앞에서 그만큼 자른다.
   비었거나 0 이하이거나 범위보다 크면 자르지 않는다 (= 범위 전부) */
function 문항자르기_(목록, 수){
  var n = Math.floor(Number(수));
  목록 = (목록||[]).slice();
  return (n > 0 && n < 목록.length) ? 목록.slice(0, n) : 목록;
}
function 문항뽑기_(목록, 수){ return 문항자르기_(shuffle(목록||[]), 수); }

function setTheme(t){
  t='kid';   /* 재디자인 — 테마는 하나로 통일 */
  document.documentElement.setAttribute('data-theme',t);
  try{localStorage.setItem('hb_theme',t);}catch(e){}
}

var 시작정보 = null;

/* 자동 로그인 — 로그인 화면의 「자동 로그인」을 체크했을 때만(기본 꺼짐). 「나가기」 전까지 다음에 켜도 바로 들어간다.
   마지막에 들어온 쪽(학생/선생님) 하나만 기억한다. PIN이 바뀌면 들어가기가 실패해 조용히 풀린다. */
var 자동열쇠 = 'hb_auto';

function 자동기억_(v){ try{ v ? localStorage.setItem(자동열쇠, JSON.stringify(v)) : localStorage.removeItem(자동열쇠); }catch(e){} }

function 자동읽기_(){ try{ return JSON.parse(localStorage.getItem(자동열쇠)||'null'); }catch(e){ return null; } }
/* 자동 로그인으로 들어가는 동안 화면을 가린다 — 보이면 또 눌러 요청이 겹친다. 치우는 함수를 돌려준다 */
function 로그인가림_(){
  var 가림 = document.createElement('div');
  가림.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:var(--bg,#F6F4F1);display:flex;' +
    'align-items:center;justify-content:center;font-size:16px;color:var(--sub,#78716C)';
  가림.textContent = '로그인 중…';
  document.body.appendChild(가림);
  var 치우기 = function(){ if(가림.parentNode) 가림.remove(); };
  setTimeout(치우기, 15000);   /* 그래도 안 끝나면 로그인 화면이라도 보여 준다 */
  return 치우기;
}

function 학원이름_(){ return (시작정보 && 시작정보.학원이름) || '홍제인왕영어'; }

/* 숙제로 인정받으려면 넘겨야 하는 점수 (기본 80점). 시험은 한 번만 보므로 컷이 없다. */
function 합격점(){
  var n = 시작정보 && 시작정보.합격점;
  n = Number(n);
  return (isFinite(n) && n>=0 && n<=100) ? n : 80;
}

/* 단어장을 과별로 — [{과, 책:[…]}], 과 없는 것은 맨 끝 「그 밖에」(과 '') 로. 과가 하나도 없으면 한 덩어리 */
function 과로나눠_(목록){
  var 칸 = [], 찾기 = {}, 밖 = [];
  (목록||[]).forEach(function(b){
    var 과 = 과이름_(b);
    if(!과){ 밖.push(b); return; }
    if(!찾기[과]){ 찾기[과] = {과:과, 책:[]}; 칸.push(찾기[과]); }
    찾기[과].책.push(b);
  });
  if(밖.length) 칸.push({과:'', 책:밖});
  return 칸;
}

function 책칸_(이름, 목록){
  var 총 = 0, 묶음 = 10;
  (목록 || []).forEach(function(x){
    if(x.이름 === 이름){ 총 = Number(x.개수) || 0; 묶음 = Number(x.레슨) || 10; }
  });
  return { 총: 총, 묶음: 묶음 };
}

function 레슨글_(묶음, 총, a, b, 번호도){
  a = Number(a) || 1; b = Number(b) || 0;
  if(!묶음 || 묶음 < 1) 묶음 = 10;
  if(!b) return a + '번부터';
  var 번호글 = a + '~' + b + '번';
  function 붙여(글){ return 번호도 ? 글 + ' · ' + 번호글 : 글; }
  if(총 && a <= 1 && b >= 총) return 붙여('전체');
  var 첫 = Math.floor((a - 1) / 묶음) + 1;
  var 끝 = Math.ceil(b / 묶음);
  if(끝 < 첫) 끝 = 첫;
  var 딱 = ((a - 1) % 묶음 === 0) && (b % 묶음 === 0 || (총 && b >= 총));
  var 레 = (첫 === 끝) ? ('레슨 ' + 첫) : ('레슨 ' + 첫 + '~' + 끝);
  return 붙여(딱 ? 레 : (레 + ' 중 일부'));
}

/* [{n:1, a:1, b:10}, ...] */
function 레슨나누기(총, 묶음){
  총=Number(총)||0; 묶음=Number(묶음)||10; if(묶음<1) 묶음=10;
  var out=[];
  for(var a=1;a<=총;a+=묶음) out.push({n:out.length+1, a:a, b:Math.min(a+묶음-1,총)});
  return out;
}

/* 레슨 고르개 (드롭다운) */
function 레슨옵션들(총, 묶음, a, b){
  var 들=레슨나누기(총,묶음), h='', 맞음=false;
  들.forEach(function(L){
    var on=(Number(a)===L.a && Number(b)===L.b);
    if(on) 맞음=true;
    h+='<option value="'+L.a+'|'+L.b+'"'+(on?' selected':'')+'>'+
       '레슨 '+L.n+' · '+L.a+'~'+L.b+'번</option>';
  });
  if(총 && 들.length>1){
    var 다=(Number(a)===1 && Number(b)===Number(총));
    if(다) 맞음=true;
    h+='<option value="1|'+총+'"'+(다?' selected':'')+'>전체 · 1~'+총+'번</option>';
  }
  if(!맞음) h='<option value="" selected>직접 정한 범위 · '+a+'~'+b+'번</option>'+h;
  return h;
}

/* 그 범위의 첫 단어와 끝 단어 — 밑에 작게 보여 준다 */
function 첫끝말(list, a, b){
  if(!list || !list.length) return '';
  a=Number(a)||1; b=Number(b)||0;
  var 안=[];
  list.forEach(function(w,i){ var no=Number(w.no)||(i+1); if(no>=a && no<=b) 안.push(w); });
  if(!안.length) return '';
  if(안.length===1) return 안[0].en;
  return 안[0].en + '  …  ' + 안[안.length-1].en;
}

/* 숫자 칸을 직접 고쳤을 때 드롭다운을 맞춰 준다 */
function 고름맞추기(sel, a, b){
  if(!sel) return;
  var v=Number(a)+'|'+Number(b), 있나=false;
  for(var i=0;i<sel.options.length;i++) if(sel.options[i].value===v) 있나=true;
  var 첫=sel.options[0];
  if(있나){
    if(첫 && 첫.value==='') sel.removeChild(첫);
    sel.value=v;
  }else{
    var 글='직접 정한 범위 · '+a+'~'+b+'번';
    if(첫 && 첫.value===''){ 첫.textContent=글; }
    else {
      var o=document.createElement('option');
      o.value=''; o.textContent=글;
      sel.insertBefore(o, sel.options[0]);
    }
    sel.value='';
  }
}

/* 비고에 적힌 묶음(단원 01 · Lesson 03 · Unit 2)을 찾는다 — 범위를 숫자 대신 묶음으로 고르게.
   번호는 지금 목록(과면 그 구분) 안의 차례다. 단어 구분의 비고는 그림 칸에 들어 있으니 그것도 본다 */
function 묶음찾기_(단어들){
  var 표 = [], 찾기 = {};
  (단어들||[]).forEach(function(w, i){
    var 그림 = String(w.그림||'');
    var 글 = String(w.비고||'') + ' ' + (/^(https?:|data:)/i.test(그림) ? '' : 그림);
    var m = 글.match(/(단원|lesson|unit)\s*0*(\d+)/i);
    if(!m) return;
    var 열쇠 = m[1].toLowerCase() + '|' + Number(m[2]);
    if(!찾기[열쇠]){ 찾기[열쇠] = {이름:m[0].trim(), 첫:i+1, 끝:i+1}; 표.push(찾기[열쇠]); }
    else 찾기[열쇠].끝 = i+1;
  });
  return 표;
}

/* 「단원 01 ~ 단원 03」 — 처음 묶음과 끝 묶음을 고르면 그 줄들의 첫 번호~끝 번호 */
function 묶음고르개_(목록, 앞, 시작, 끝){
  function 옵(id, 고른){
    return '<select id="'+id+'"><option value="">—</option>'+목록.map(function(u, i){
      return '<option value="'+i+'"'+(i===고른?' selected':'')+'>'+esc(u.이름)+'</option>';
    }).join('')+'</select>';
  }
  var a = -1, b = -1;
  목록.forEach(function(u, i){ if(u.첫===Number(시작)) a = i; if(u.끝===Number(끝)) b = i; });
  if(a < 0 || b < a){ a = -1; b = -1; }
  return '<div class="unitpick"><span class="unitl">묶음으로</span>'+옵(앞+'A', a)+'<span>~</span>'+옵(앞+'B', b)+'</div>';
}

function 묶음붙이기_(목록, 앞, 넣기){
  var A = $(앞+'A'), B = $(앞+'B'); if(!A || !B) return;
  function 바뀜(){
    var a = A.value === '' ? -1 : Number(A.value), b = B.value === '' ? -1 : Number(B.value);
    if(a < 0 && b < 0) return;
    if(a < 0){ a = b; A.value = String(a); }
    if(b < a){ b = a; B.value = String(b); }
    넣기(목록[a].첫, 목록[b].끝);
  }
  /* 처음 묶음을 고르면 그 묶음 하나 — 「~」 뒤를 골라 늘린다 */
  A.onchange = function(){ B.value = A.value; 바뀜(); };
  B.onchange = 바뀜;
}

/* 교재는 여러 권일 수 있다 — 무엇이 오든 목록으로 */
function 교재목록(값){
  if(!값) return [];
  if(Object.prototype.toString.call(값)==='[object Array]')
    return 값.map(function(x){return String(x||'').trim();}).filter(Boolean);
  return String(값).split(/\s*[,|]\s*/).map(function(x){return x.trim();}).filter(Boolean);
}

/* ==== 수업 짜기 공용 시작 — Code.gs 와 index.html 에 글자 하나 다르지 않게 들어 있다.
   서버(Code.gs)는 진짜 기록으로, 미리보기(index.html)는 흉내 자료로 같은 규칙을 돌린다.
   한쪽만 고치면 test71 이 빨갛게 된다 — 고칠 때는 둘 다 고친다. ==== */

/* 처음 쓸 때 「수업틀」 시트에 옮겨 넣는 틀. 그 뒤로는 시트가 주인이다 (선생님이 고치고 지운다).
   키는 예전 화면(꾸러미 고르기)이 보내는 값을 받아 주려고 남겨 둔다. */
var 처음수업틀_ = [
  { 키: '본문1', 이름: '본문 1회차', 설명: '단어 확인 → 본문 빈칸 → 해석 보고 영작',
    단계: [ { 종류: '보통', 어디: '단어', 유형: '스펠링' },
            { 종류: '보통', 어디: '본문', 유형: '빈칸 채우기' },
            { 종류: '보통', 어디: '본문', 유형: '영작' } ] },
  { 키: '본문정리', 이름: '본문 총정리', 설명: '빈칸 → 순서 맞추기 → 영작 → 듣고 쓰기',
    단계: [ { 종류: '보통', 어디: '본문', 유형: '빈칸 채우기' },
            { 종류: '보통', 어디: '본문', 유형: '순서 맞추기' },
            { 종류: '보통', 어디: '본문', 유형: '영작' },
            { 종류: '보통', 어디: '본문', 유형: '듣고 쓰기' } ] },
  { 키: '문법', 이름: '문법 확인', 설명: '문법 빈칸 → 본문 빈칸 (오늘 배운 어법 굳히기)',
    단계: [ { 종류: '보통', 어디: '문법', 유형: '빈칸 채우기' },
            { 종류: '보통', 어디: '본문', 유형: '빈칸 채우기' } ] },
  { 키: '본문문법', 이름: '본문 + 문법 (한 회차 전체)', 설명: '단어 → 본문 빈칸 → 영작 → 문법 빈칸',
    단계: [ { 종류: '보통', 어디: '단어', 유형: '스펠링' },
            { 종류: '보통', 어디: '본문', 유형: '빈칸 채우기' },
            { 종류: '보통', 어디: '본문', 유형: '영작' },
            { 종류: '보통', 어디: '문법', 유형: '빈칸 채우기' } ] },
  { 키: '단어집중', 이름: '단어 집중', 설명: '4지선다 → 스펠링',
    단계: [ { 종류: '보통', 어디: '단어', 유형: '4지선다' },
            { 종류: '보통', 어디: '단어', 유형: '스펠링' } ] },
  { 키: '시험대비', 이름: '시험 대비', 설명: '단어 스펠링 → 본문 영작',
    단계: [ { 종류: '보통', 어디: '단어', 유형: '스펠링' },
            { 종류: '보통', 어디: '본문', 유형: '영작' } ] }
];

/* 한 문제에 걸리는 시간(초) — 단계가 몇 분짜리인지 어림하는 기준. 본문·문법은 문장 하나 기준.
   선생님은 단계마다 분을 직접 고칠 수 있다 — 이건 처음 값일 뿐이다. */
var 수업초표_ = {
  '스펠링': 20, '첫 글자': 15, '듣고 쓰기': 25, '4지선다': 10, '뜻 고르기': 10, '플래시카드': 8, '3단변화': 30,
  '본문|빈칸 채우기': 40, '본문|영작': 70, '본문|순서 맞추기': 50, '본문|듣고 쓰기': 60, '문법|빈칸 채우기': 35
};
var 추천기록최소_ = 5;      // 기록이 이보다 적으면 진도만 보고 짠다 (학기 초)
var 추천예산기본_ = 35;     // 분

/* 누적 단계는 숙제 한 줄의 유형 칸에 「스펠링 (누적 20)」 처럼 적힌다.
   숙제 시트 칸을 늘리지 않고, 유형모드_() 는 그대로 「스펠링」 으로 읽는다. */
function 유형알맹이_(유형) { return String(유형 || '').replace(/\s*\(누적[^)]*\)\s*$/, '').trim(); }
function 누적인가_(유형) { return /\(누적/.test(String(유형 || '')); }
function 누적개수_(유형) {
  var m = String(유형 || '').match(/\(누적\s*(\d+)/);
  return m ? Number(m[1]) : 20;
}
/* 함께 = 반이 함께 틀린 단어부터 낸다 (「(누적 7 함께)」). 없으면 그 아이가 틀린 단어부터 */
function 누적유형_(유형, 개수, 함께) {
  return 유형알맹이_(유형) + ' (누적 ' + (Number(개수) || 20) + (함께 ? ' 함께' : '') + ')';
}
function 함께누적인가_(유형) { return /\(누적[^)]*함께/.test(String(유형 || '')); }

/* 기록 한 줄의 틀린 단어 칸 — 시트 칸에는 다섯 개 뒤에 「…외 N개」 가 붙어 있다. 그 꼬리는 단어가 아니다 */
function 틀린칸풀기_(글) {
  return String(글 || '').replace(/\s*…외\s*\d+개\s*$/, '')
    .split(/\s*,\s*|\s+\/\s+/).map(function (w) { return w.replace(/…$/, '').trim(); }).filter(String);
}
/* 반의 1/3 이상(적어도 2명)이 함께 틀린 단어 — 많이 틀린 것부터. 기록들 = [{이름, 틀린}] */
function 함께틀린_(기록들, 학생수) {
  var 누가 = {};
  (기록들 || []).forEach(function (r) {
    틀린칸풀기_(r.틀린).forEach(function (w) {
      var k = w.toLowerCase();
      (누가[k] = 누가[k] || { 글: w, 사람: {} }).사람[r.이름] = 1;
    });
  });
  var 기준 = Math.max(2, Math.ceil((Number(학생수) || 0) / 3));
  return Object.keys(누가).map(function (k) { return { 글: 누가[k].글, 수: Object.keys(누가[k].사람).length }; })
    .filter(function (x) { return x.수 >= 기준; })
    .sort(function (x, y) { return y.수 - x.수; });
}

function 단계초_(유형, 책종류) {
  var 알 = 유형알맹이_(유형);
  return 수업초표_[(책종류 || '') + '|' + 알] || 수업초표_[알] || 20;
}
/* 몇 분짜리 단계인가 — 올림해서 분으로 */
function 단계분_(유형, 개수, 책종류) {
  return Math.max(1, Math.ceil((Number(개수) || 0) * 단계초_(유형, 책종류) / 60));
}

/* 「몇 수업 전」 — 날짜가 아니라 수업 회차로 센다.
   그 교재로 숙제가 나간 날을 모아, 같은 날 나간 것은 한 수업으로 본다.
   (중3 은 주 4회, 중2 는 주 3회라 날짜로 세면 두 반이 어긋난다)
   오늘 나간 것은 아직 「지난」 수업이 아니라 빼고, 가장 최근 날이 1 이다. */
function 수업회차_(숙제들, 오늘) {
  var 날들 = [];
  (숙제들 || []).forEach(function (h) {
    var d = String(h.등록 || '');
    if (d && d < 오늘 && 날들.indexOf(d) < 0) 날들.push(d);
  });
  날들.sort();
  날들.reverse();
  var 표 = {};
  날들.forEach(function (d, i) { 표[d] = i + 1; });
  return 표;
}

/* 한 묶음이 몇 개인가 — 단어는 20개, 본문·문법은 12문장 */
function 묶음크기_(칸) { return (칸 === '본문' || 칸 === '문법') ? 12 : 20; }
/* 「이어서」 — 그 단어장·그 구분으로 나간 숙제의 가장 큰 끝번호 다음부터 (숙제들은 이미 걸러서 준다).
   끝을 넘으면 끝까지만, 이미 끝까지 갔으면 1부터 다시, 처음이면 1부터 */
function 이어서범위_(숙제들, 총, 몇) {
  var 끝본 = 0;
  (숙제들 || []).forEach(function (h) {
    if (!누적인가_(h.유형)) 끝본 = Math.max(끝본, Number(h.끝) || 0);
  });
  총 = Number(총) || 0;
  var a = 끝본 + 1;
  if (총 && a > 총) a = 1;
  var b = a + (Number(몇) || 20) - 1;
  if (총) b = Math.min(b, 총);
  return { 시작: a, 끝: b };
}

/* 지난 N수업에 나간 범위를 하나로 묶는다 — 누적 단계가 「앱이 고르는」 범위.
   칸을 주면 그 구분의 숙제만 (과 단어장의 누적은 단어 구분에서만) */
function 누적범위_(숙제들, 교재, 지난, 오늘, 칸) {
  var 이것 = (숙제들 || []).filter(function (h) { return h.단어장 === 교재; });
  var 범위것 = 칸 === undefined ? 이것 : 이것.filter(function (h) { return (h.칸 || '') === (칸 || ''); });
  var 회차 = 수업회차_(이것, 오늘), a = 0, b = 0;      // 수업 회차는 그 단어장 전체로 센다
  범위것.forEach(function (h) {
    var n = 회차[String(h.등록 || '')];
    if (!n || n > (Number(지난) || 0)) return;
    var s = Number(h.시작) || 1, e = Number(h.끝) || s;
    if (!a || s < a) a = s;
    if (e > b) b = e;
  });
  return a ? { 시작: a, 끝: b } : null;
}

/* 초 → 「6분 20초」 */
function 분초_(초) {
  초 = Math.round(Number(초) || 0);
  var m = Math.floor(초 / 60), s = 초 % 60;
  return (m ? m + '분' : '') + (m && s ? ' ' : '') + (s || !m ? s + '초' : '');
}
/* 시간 기본값 — 한 값을 돌려쓰지 않고 그 숙제의 유형·문항 수로 따로 센다.
   외우는 시간: 문항마다 15초를 올림해서 분 (20개 → 5분).
   시험 시간: 그 유형의 예상 시간 × 1.2 를 올림 (시험이라 연습보다 빠듯하게).
   1.2 를 그냥 곱하면 소수 끝이 남아(5 × 1.2 = 6.000…1) 올림이 한 칸 더 간다 — 12/10 으로 센다 */
function 외우기기본_(개수) { return Math.ceil((Number(개수) || 0) * 15 / 60) || ''; }
function 시험시간기본_(유형, 개수, 책종류) {
  return Number(개수) > 0 ? Math.ceil(단계분_(유형, 개수, 책종류) * 12 / 10) : '';
}

/* 받침이 있으면 「을」, 없으면 「를」 — 숫자로 끝나면 읽는 소리로 (레슨 2 → 이 → 를, 레슨 3 → 삼 → 을) */
function 을를_(글) {
  var t = String(글 || ''), 끝 = t.charAt(t.length - 1);
  if (/[0-9]/.test(끝)) return '0136781'.indexOf(끝) > -1 ? '을' : '를';
  var c = t.charCodeAt(t.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 ? '을' : '를';
  return '을';
}

/* 오늘 추천 — 그 단어장의 숙제·기록을 보고 수업 초안을 짠다.
   재료 = { 교재, 종류, 오늘, 예산, 레슨, 총, 칸수:{단어,본문,문법}, 학생수,
            숙제들:[{단어장,칸,시작,끝,유형,등록,안낸수}], 기록들:[{이름,칸,유형,점수,틀린,날}],
            단어들:[단어 구분의 영어…] }
   과 단어장이면 구분(단어·본문·문법)마다 따로 본다. 옛 단어장은 구분이 하나뿐이다.
   진단은 1순위부터 보고, 고른 단계마다 왜 골랐는지(이유)를 붙인다 — 이유가 안 보이면 선생님이 안 쓴다. */
function 수업추천짜기_(재료) {
  재료 = 재료 || {};
  var 교재 = String(재료.교재 || ''), 오늘 = String(재료.오늘 || '');
  var 예산 = Number(재료.예산) || 추천예산기본_, 레슨 = Number(재료.레슨) || 10;
  var 과 = 재료.종류 === '과', 칸수 = 재료.칸수 || {};
  var 칸들 = 과 ? 어디차례_.filter(function (k) { return Number(칸수[k]) > 0; }) : [어디로_(재료.종류)];
  if (!칸들.length) 칸들 = ['단어'];
  function 총(k) { return 과 ? (Number(칸수[k]) || 0) : (Number(재료.총) || 0); }
  function 칸of(x) { return 과 ? (x.칸 || '단어') : 칸들[0]; }
  function 기본유형(k) { return k === '3단변화' ? '3단변화' : (k === '본문' || k === '문법') ? '빈칸 채우기' : '스펠링'; }
  var 숙제들 = (재료.숙제들 || []).filter(function (h) { return h.단어장 === 교재 && h.등록; });
  var 기록들 = 재료.기록들 || [];
  /* 철자·다 같이 틀린 단어는 단어 구분의 기록만 본다 (본문 문장이 섞이면 안 된다) */
  var 단어기록 = 기록들.filter(function (r) { return 칸of(r) === '단어'; });
  var 단어있나 = 칸들.indexOf('단어') > -1;
  var 회차 = 수업회차_(숙제들, 오늘);
  var 진단 = [], 앞 = [], 복습 = [], 묶음 = [], 쓴범위 = {};

  /* 과는 「단어 21~40」, 옛 단어장은 「레슨 3」·「21~25번」 */
  function 범위글(k, a, b) {
    if (과) return k + ' ' + a + '~' + b;
    if ((a - 1) % 레슨 === 0 && (b % 레슨 === 0 || b === 총(k))) {
      var p = (a - 1) / 레슨 + 1, q = Math.ceil(b / 레슨);
      return p === q ? '레슨 ' + p : '레슨 ' + p + '~' + q;
    }
    return a + '~' + b + '번';
  }
  function 단계(k, 종류, a, b, 유형, 이유, 개수) {
    /* 누적(그 아이 오답부터 몇 개만)은 단어 구분에서만 — 3단변화·본문·문법은 그 범위를 통째로 */
    if (종류 === '누적' && k !== '단어') 종류 = '보통';
    var n = 종류 === '누적' ? (개수 || (b - a + 1)) : (b - a + 1);
    var s = { 종류: 종류, 단어장: 교재, 칸: 과 ? k : '', 시작: a, 끝: b, 유형: 유형, 이유: 이유,
              이름: (종류 === '누적' ? '누적 ' : '') + 범위글(k, a, b) + ' ' + 유형 };
    if (종류 === '누적') s.개수 = n;
    s.분 = 단계분_(유형, n, (k === '본문' || k === '문법') ? k : '');
    return s;
  }

  var 기록적음 = 기록들.length < 추천기록최소_;
  var 약철자 = false;
  if (기록적음) {
    진단.push('아직 기록이 적어 진도만 보고 짰습니다');
  } else {
    /* 1순위 — 지난 2수업에 나간 숙제를 못 낸(80점을 못 넘긴) 사람이 있으면 그 범위를 맨 앞에 */
    숙제들.filter(function (h) {
      var n = 회차[h.등록];
      return n && n <= 2 && (Number(h.안낸수) || 0) > 0;
    }).sort(function (x, y) {
      return 회차[x.등록] - 회차[y.등록] || 칸들.indexOf(칸of(x)) - 칸들.indexOf(칸of(y)) || x.시작 - y.시작;
    }).forEach(function (h) {
      var k = 칸of(h), 유형 = 유형알맹이_(h.유형), 열쇠 = k + '|' + h.시작 + '~' + h.끝 + '|' + 유형;
      if (쓴범위[열쇠]) return;
      쓴범위[열쇠] = 1; 쓴범위[k + '|' + h.시작 + '~' + h.끝] = 1;
      진단.push(h.안낸수 + '명이 ' + 범위글(k, h.시작, h.끝) + ' ' + 유형 + 을를_(유형) + ' 못 냈습니다');
      /* 못 낸 것이 누적이었으면 누적 그대로 다시 (통째 범위로 바꾸면 40개짜리가 된다) */
      var s = 누적인가_(h.유형)
        ? 단계(k, '누적', h.시작, h.끝, 유형, h.안낸수 + '명이 못 냈습니다', 누적개수_(h.유형))
        : 단계(k, '보통', h.시작, h.끝, 유형, h.안낸수 + '명이 못 냈습니다');
      if (함께누적인가_(h.유형)) s.함께 = true;
      앞.push(s);
    });

    /* 2순위 — 최근 30일 단어 기록에서 (4지선다 + 첫 글자 평균) − (스펠링 + 듣고 쓰기 평균) ≥ 12 */
    var 평균 = function (맞나) {
      var 합 = 0, n = 0;
      단어기록.forEach(function (r) {
        if (맞나(String(r.유형 || ''))) { 합 += Number(r.점수) || 0; n++; }
      });
      return n ? Math.round(합 / n) : null;
    };
    var 뜻점 = 평균(function (t) { return /4지|뜻|첫/.test(t); });
    var 철점 = 평균(function (t) { return /스펠|듣고/.test(t); });
    약철자 = 단어있나 && 뜻점 !== null && 철점 !== null && 뜻점 - 철점 >= 12;
    if (약철자) 진단.push('뜻 고르기 ' + 뜻점 + '점 / 철자 쓰기 ' + 철점 + '점 — 철자가 약합니다');

    /* 3순위 — 마지막으로 본 것이 2·4·8수업 전인 범위 (잊을 때쯤 다시 본다).
       단어는 누적(그 아이 오답부터), 본문·문법은 그때 낸 유형으로 그 범위를 다시 */
    var 마지막 = {};
    숙제들.forEach(function (h) {
      var n = 회차[h.등록];
      if (!n || 누적인가_(h.유형)) return;
      var k = 칸of(h), 열 = k + '|' + h.시작 + '~' + h.끝;
      if (!마지막[열] || n < 마지막[열].n) 마지막[열] = { n: n, 칸: k, 시작: h.시작, 끝: h.끝, 유형: 유형알맹이_(h.유형) };
    });
    Object.keys(마지막).map(function (열) { return 마지막[열]; })
      .filter(function (x) { return [2, 4, 8].indexOf(x.n) > -1 && !쓴범위[x.칸 + '|' + x.시작 + '~' + x.끝]; })
      .sort(function (x, y) { return y.n - x.n || 칸들.indexOf(x.칸) - 칸들.indexOf(y.칸) || x.시작 - y.시작; })
      .forEach(function (x) {
        var 글 = 범위글(x.칸, x.시작, x.끝);
        진단.push(글 + 을를_(글) + ' 본 지 ' + x.n + '수업 됐습니다');
        var s = x.칸 === '단어'
          ? 단계('단어', '누적', x.시작, x.끝, 기본유형('단어'), x.n + '수업 전에 봤습니다', Math.min(20, x.끝 - x.시작 + 1))
          : 단계(x.칸, '보통', x.시작, x.끝, x.유형 || 기본유형(x.칸), x.n + '수업 전에 봤습니다');
        s.지난 = x.n;
        복습.push(s);
      });

    /* 4순위 — 아이들 1/3 이상이 다 같이 틀린 단어가 5개를 넘으면, 그 단어들이 있는 자리를 「함께」 누적으로.
       아이 화면은 「함께」 누적을 열면 다 같이 틀린 단어부터 낸다 (내오답 … 함께) */
    var 함께 = 단어있나 ? 함께틀린_(단어기록, 재료.학생수) : [];
    if (함께.length > 5) {
      var 단어들 = (재료.단어들 || []).map(function (w) { return String(w).toLowerCase().trim(); });
      var 자리 = [];
      함께.forEach(function (x) { var i = 단어들.indexOf(x.글.toLowerCase()); if (i > -1) 자리.push(i + 1); });
      var 보기 = 함께.slice(0, 3).map(function (x) { return x.글; }).join(', ') + (함께.length > 3 ? ' …' : '');
      진단.push('다 같이 틀린 단어 ' + 함께.length + '개 (' + 보기 + ')');
      if (자리.length) {
        var a = Math.min.apply(null, 자리), b = Math.max.apply(null, 자리);
        var s = 단계('단어', '누적', a, b, 기본유형('단어'), '다 같이 틀린 단어 ' + 함께.length + '개', 자리.length);
        s.이름 = '다 같이 틀린 단어 ' + 자리.length + '개';
        if (s.종류 === '누적') s.함께 = true;
        묶음.push(s);
      }
    }
  }

  /* 덤 — 제한 시간이 빠듯한가: 제한을 건 유형마다, 그 유형 기록의 평균 걸린 시간이 제한의 90% 를 넘으면.
     단계를 바꾸지는 않는다 — 선생님이 제한을 늘릴지 정한다 */
  if (!기록적음) {
    var 제한들 = {};
    숙제들.forEach(function (h) {
      var m = Number(h.제한시간) || 0;
      if (m > 0) (제한들[유형알맹이_(h.유형)] = 제한들[유형알맹이_(h.유형)] || []).push(m);
    });
    Object.keys(제한들).forEach(function (t) {
      var 초들 = 기록들.filter(function (r) { return 유형알맹이_(r.유형) === t && Number(r.초) > 0; })
        .map(function (r) { return Number(r.초); });
      if (!초들.length) return;
      var 평균초 = 초들.reduce(function (a, b) { return a + b; }, 0) / 초들.length;
      var 제한분 = 제한들[t].reduce(function (a, b) { return a + b; }, 0) / 제한들[t].length;
      if (평균초 > 제한분 * 60 * 0.9) {
        진단.push(t + ' 평균 ' + 분초_(평균초) + ' / 제한 ' + Math.round(제한분) + '분 — 시간이 빠듯합니다');
      }
    });
  }

  /* 5순위 — 구분마다 나간 데까지의 다음 묶음 (수업 짜기의 「이어서」 와 같은 계산).
     철자가 약하면 단어 진도는 스펠링 대신 듣고 쓰기 + 첫 글자 */
  var 단어진도 = [], 딴진도 = [];
  칸들.forEach(function (k) {
    var 것 = 숙제들.filter(function (h) { return 칸of(h) === k; });
    var r = 이어서범위_(것, 총(k), 묶음크기_(k));
    var 끝본 = 0;
    것.forEach(function (h) { if (!누적인가_(h.유형)) 끝본 = Math.max(끝본, Number(h.끝) || 0); });
    if (총(k) && 끝본 >= 총(k)) 진단.push((과 ? k + 을를_(k) + ' ' : '') + '끝까지 나가서 처음부터 다시 돕니다');
    if (k === '단어' && 약철자) {
      단어진도 = [단계(k, '보통', r.시작, r.끝, '듣고 쓰기', '철자가 약합니다'),
                  단계(k, '보통', r.시작, r.끝, '첫 글자', '철자가 약합니다')];
    } else if (k === '단어') {
      단어진도 = [단계(k, '보통', r.시작, r.끝, 기본유형(k), '진도')];
    } else {
      딴진도.push(단계(k, '보통', r.시작, r.끝, 기본유형(k), '진도'));
    }
  });

  /* 같은 범위·같은 유형이 두 번 들어가지 않게 (못 낸 숙제와 새 진도가 겹칠 때) */
  var 본단계 = {};
  var 순서 = (기록적음 ? 단어진도.concat(딴진도)
                       : 앞.concat(약철자 ? 단어진도 : [], 복습, 묶음, 약철자 ? [] : 단어진도, 딴진도))
    .filter(function (s) {
      var k = s.종류 + '|' + s.칸 + '|' + s.시작 + '~' + s.끝 + '|' + s.유형;
      if (본단계[k]) return false;
      본단계[k] = 1;
      return true;
    });
  /* 시간 예산 — 위에서부터 채우다가 넘치면 거기서 뒤를 자른다 (한 단계는 꼭 넣는다) */
  var 단계들 = [], 합 = 0;
  for (var i = 0; i < 순서.length; i++) {
    if (단계들.length && 합 + 순서[i].분 > 예산) break;
    단계들.push(순서[i]);
    합 += 순서[i].분;
  }
  if (순서.length > 단계들.length) {
    진단.push('시간 예산 ' + 예산 + '분을 넘어서 뒤의 ' + (순서.length - 단계들.length) + '단계는 뺐습니다');
  }
  return { 교재: 교재, 오늘: 오늘, 예산: 예산, 진단: 진단, 단계: 단계들, 합계분: 합, 기록적음: 기록적음 };
}

/* ---------- 과 묶음 — 한 과를 가르치려면 단어장이 셋(단어·본문·문법)이다 ----------
   과 이름은 단어장 이름 끝의 꼬리말( 단어 · 본문 · 문법 · 3단변화)을 떼고 남는 것.
   「중2 5과 단어2」 처럼 꼬리말 뒤에 숫자가 붙어도 같은 과다 (한 과에 단어장이 둘일 때).
   어디(단어·본문·문법·3단변화)는 이름이 아니라 「종류」 로 정한다 — 이름이 「… 단어」 여도 종류가 본문이면 본문이다. */
var 과꼬리말_ = ['단어', '본문', '문법', '3단변화'];
var 어디차례_ = ['단어', '본문', '문법', '3단변화'];
function 어디로_(종류) {
  var k = String(종류 || '').trim();
  return (k === '본문' || k === '문법' || k === '3단변화') ? k : '단어';
}
function 과쪼개기_(이름, 종류) {
  var t = String(이름 || '').trim(), 과 = '';
  var m = t.match(new RegExp('^(.+?)\\s+(' + 과꼬리말_.join('|') + ')\\d*$'));
  if (m) 과 = m[1].trim();
  return { 과: 과, 어디: 어디로_(종류) };
}
/* 이 단어장의 과 — 단어장목록 시트의 「과」 칸이 적혀 있으면 그게 이긴다 (옛 단어장을 손으로 묶는 칸) */
function 과이름_(b) {
  var 손 = (b && b.과칸 !== undefined && b.과칸 !== null) ? String(b.과칸).trim() : '';
  /* 종류가 「과」 인 단어장(한 과 = 한 장)은 제 이름이 곧 과 */
  if (!손 && b && String(b.종류 || '').trim() === '과') return String(b.이름 || '').trim();
  return 손 || 과쪼개기_(b && b.이름, b && b.종류).과;
}
/* 단어장목록 → [{과, 칸:{단어:[{이름,개수}], 본문:[…], …}}] — 과는 처음 나온 차례, 과 없는 것은 빠진다 */
function 과묶음_(목록) {
  var 과들 = [], 찾기 = {};
  (목록 || []).forEach(function (b) {
    if (!b || !b.이름) return;
    var 과 = 과이름_(b);
    if (!과) return;
    var g = 찾기[과];
    if (!g) { g = 찾기[과] = { 과: 과, 칸: {} }; 과들.push(g); }
    var 어디 = 어디로_(b.종류);
    (g.칸[어디] = g.칸[어디] || []).push({ 이름: b.이름, 개수: Number(b.개수) || 0 });
  });
  return 과들;
}
/* ==== 수업 짜기 공용 끝 ==== */

/* 그림 주소가 안 뜰 때 다른 형태로 한 번 더 해 본다 */
function 그림안뜨면_(el){
  var m = /[?&]id=([^&]+)/.exec(el.getAttribute('src') || '');
  if(m && el.getAttribute('data-두번째') !== '1'){
    el.setAttribute('data-두번째', '1');
    el.src = 'https://lh3.googleusercontent.com/d/' + m[1];
    return;
  }
  el.style.visibility = 'hidden';
}

function 그림태그_(주소, 클래스){
  return '<img class="' + 클래스 + '" src="' + esc(주소) +
    '" alt="" loading="lazy" onerror="그림안뜨면_(this)">';
}

/* 파일 이름과 영어 단어를 맞춰 볼 때 쓰는 열쇠말 — Code.gs 의 열쇠말_ 과 같은 규칙 */
function DEMO열쇠_(v){
  return String(v || '').toLowerCase().replace(/\.[^.]+$/, '').replace(/[\s_\-().0-9]/g, '');
}

/* 낱말만 쓰는 곳(게임·시험지 뽑기) — 과 단어장이면 단어 구분만. 아직 안 왔으면(null) 그대로 */
function 종이단어_(말){
  return 말 ? 말.filter(function(w){ return !w.칸 || w.칸==='단어'; }) : 말;
}

/* ------------------------------- 서버 부르기 — 이 블록 맨 끝에 둔다 (tests/legacy-rpc · rpc-parity 가 여기서 「상태」 까지 떼어 돌린다) */
var 부르는중_ = 0;
function 부르는중그리기_(){
  qsa('.refbtn').forEach(function(r){ r.classList.toggle('doing', 부르는중_ > 0); });
}
function api(fn){
  return api부르기_(fn, [].slice.call(arguments,1));
}
/* 같은 요청번호로 부른다 — 「다시 보내기」 를 눌러도 먼저 것이 실은 들어갔으면 두 번 저장되지 않는다 */
function api같은번호(번호, fn){
  return api부르기_(fn, [].slice.call(arguments,2), 번호);
}
function api부르기_(fn, args, 번호){
  부르는중_++; 부르는중그리기_();
  function 끝_(){ if(부르는중_ > 0) 부르는중_--; 부르는중그리기_(); }
  return 부르기_(fn, args, 번호).then(
    function(v){ 끝_(); return v; },
    function(e){ 끝_(); throw e; });
}
function 부르기_(fn, args, 번호){
  return new Promise(function(res,rej){
    if(!GAS){
      var d = DEMO[fn];
      setTimeout(function(){
        try{ res(typeof d === 'function' ? d.apply(null,args) : d); }
        catch(e){ rej(e); }
      },180);
      return;
    }
    /* 앱스 스크립트 안에서 그대로 열었을 때 */
    if(안쪽){
      google.script.run.withSuccessHandler(res).withFailureHandler(rej)[fn].apply(null,args);
      return;
    }
    /* 바깥(깃헙 등)에 올려 두고 창구로 말을 걸 때.
       글 종류를 text/plain 으로 보내야 브라우저가 미리 물어보지 않는다. */
    VocabApi.request(창구주소, fn, args, '서버가 답하지 않았습니다', 번호).then(res, rej);
  });
}
