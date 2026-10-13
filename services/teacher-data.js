/* ================================================================
   「자료」 탭 — 표를 칸째로 고치고, 줄을 골라 지우고(휴지통 30일), 모든 표를 엑셀로 받는다.
   teacher.html 에만 박힌다 (scripts/build-services.mjs). 서버 쪽은 services/table-edit.mjs —
   업무 엔진을 거치지 않는다. 순위·연습 점수 같은 계산 값은 저장하지 않고, 고친 표로 엔진이 다시 센다.
   날짜는 서버가 보낸 꼴({$date: 밀리초}) 그대로 들고 있다 — 「바꾸기 전 줄」 을 그 꼴로 돌려보내야 서버가 맞대어 본다.
================================================================ */
var 자료 = {표:'학생', 목록:null, 부르는중:false, 표들:{}, 찾기:'', 반:{}, 학생:'', 부터:'', 까지:'', 고름:{}, 몇줄:200, 휴지통:false, 바뀜:false};
/* SheetJS — 버전을 박아 둔다 (공식 CDN. npm 의 xlsx 는 0.18.5 에서 멈췄다) */
var 자료엑셀주소 = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
var 자료보관일 = 30;
/* 기록처럼 밑으로 쌓이는 표는 최근 것부터 보인다 */
var 자료쌓이는표 = {'기록':1, '기록보관':1, '점수':1, '휴지통':1};

function 자료날짜인가_(v){ return !!v && typeof v === 'object' && typeof v.$date === 'number'; }
/* 칸 값 → 화면 글. 날짜는 학원 시각(서울)으로, 0시면 날짜만 */
function 자료칸글_(v){
  if(v == null) return '';
  if(자료날짜인가_(v)){
    var d = new Date(v.$date + 9*3600000), z = function(n){ return (n<10?'0':'')+n; };
    var 날 = d.getUTCFullYear()+'-'+z(d.getUTCMonth()+1)+'-'+z(d.getUTCDate());
    var 시 = z(d.getUTCHours())+':'+z(d.getUTCMinutes());
    return 시 === '00:00' ? 날 : 날+' '+시;
  }
  if(typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if(typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
function 자료밀리초_(v){
  if(자료날짜인가_(v)) return v.$date;
  var 글 = String(v == null ? '' : v).trim();
  if(!/^\d{4}-\d{1,2}-\d{1,2}/.test(글)) return NaN;
  return Date.parse(글.replace(' ', 'T') + (글.length <= 10 ? 'T00:00:00' : '') + '+09:00');
}
function 자료열_(머리, 이름들){
  for(var i=0; i<이름들.length; i++){ var k = 머리.map(function(h){ return String(h).trim(); }).indexOf(이름들[i]); if(k >= 0) return k; }
  return -1;
}
/* 거르기에 쓰는 칸 — 머리글 이름으로 찾는다 (표마다 자리가 다르다) */
function 자료열들_(머리){
  return {반:자료열_(머리, ['반']), 학생:자료열_(머리, ['이름','학생']),
    날짜:자료열_(머리, ['시각','날짜','등록시각','지운때','마감일','켠때','만든때'])};
}
/* 보일 줄(0부터 센 자리 — 시트 행은 +2). 빈 줄은 뺀다 */
function 자료거르기_(표, 조건){
  var 열 = 자료열들_(표.머리 || []), 찾기 = String(조건.찾기||'').trim().toLowerCase();
  var 학생 = String(조건.학생||'').trim();
  var 반들 = Object.keys(조건.반||{}).filter(function(k){ return 조건.반[k]; });
  var 부터 = 조건.부터 ? Date.parse(조건.부터+'T00:00:00+09:00') : NaN;
  var 까지 = 조건.까지 ? Date.parse(조건.까지+'T00:00:00+09:00') + 86400000 : NaN;
  var 보일 = [];
  (표.줄들||[]).forEach(function(줄, i){
    var 글들 = 줄.map(자료칸글_);
    if(!글들.some(function(g){ return g !== ''; })) return;
    if(반들.length && 열.반 >= 0 && 반들.indexOf(글들[열.반]) < 0) return;
    if(학생 && 열.학생 >= 0 && 글들[열.학생].indexOf(학생) < 0) return;
    if((!isNaN(부터) || !isNaN(까지)) && 열.날짜 >= 0){
      var ms = 자료밀리초_(줄[열.날짜]);
      if(isNaN(ms) || (!isNaN(부터) && ms < 부터) || (!isNaN(까지) && ms >= 까지)) return;
    }
    if(찾기 && 글들.join('\t').toLowerCase().indexOf(찾기) < 0) return;
    보일.push(i);
  });
  if(자료쌓이는표[표.이름]) 보일.reverse();
  return 보일;
}

/* ---------- 엑셀 — 표마다 시트 하나 ---------- */
function 자료시트이름_(이름, 쓴것){
  var n = String(이름).replace(/[\\\/\?\*\[\]:]/g, ' ').replace(/^'+|'+$/g, '').trim() || '표';
  n = n.slice(0, 31);
  var 후보 = n, i = 2;
  while(쓴것[후보.toLowerCase()]){ var 꼬리 = ' ('+i+')'; 후보 = n.slice(0, 31-꼬리.length)+꼬리; i++; }
  쓴것[후보.toLowerCase()] = 1;
  return 후보;
}
function 자료엑셀책_(XLSX, 표들){
  var 책 = XLSX.utils.book_new(), 쓴것 = {};
  표들.forEach(function(표){
    var 줄들 = [표.머리||[]].concat(표.줄들||[]).map(function(줄){
      return 줄.map(function(v){ return 자료날짜인가_(v) ? new Date(v.$date) : (v == null ? '' : v); });
    });
    XLSX.utils.book_append_sheet(책, XLSX.utils.aoa_to_sheet(줄들, {cellDates:true}), 자료시트이름_(표.이름, 쓴것));
  });
  return 책;
}
function 자료엑셀도구_(){
  if(window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise(function(res, rej){
    var s = document.createElement('script');
    s.src = 자료엑셀주소;
    s.onload = function(){ window.XLSX ? res(window.XLSX) : rej(new Error('엑셀 도구가 비었어요')); };
    s.onerror = function(){ rej(new Error('엑셀 도구를 받지 못했어요 (인터넷 확인)')); };
    document.head.appendChild(s);
  });
}
function 자료엑셀받기_(){
  toast('모든 표를 모으는 중…');
  Promise.all([자료엑셀도구_(), api('__자료읽기', {모두:true})]).then(function(둘){
    var r = 둘[1];
    if(!r || !r.ok) throw new Error((r && r.메시지) || '표를 읽지 못했어요');
    var 책 = 자료엑셀책_(둘[0], JSON.parse(r.자료).표들);
    둘[0].writeFile(책, '영단어자료_'+오늘값()+'.xlsx');
    toast('표 '+책.SheetNames.length+'개를 엑셀로 받았어요');
  }).catch(function(e){ toast('내려받지 못했어요 — '+(e && e.message || e)); });
}

/* ---------- 서버와 ---------- */
function 자료부르기_(이름들){
  var 표이름 = 자료.휴지통 ? '휴지통' : 자료.표;
  이름들 = (이름들 || [표이름]).filter(Boolean);
  자료.부르는중 = true;
  return api('__자료읽기', {이름들:이름들}).then(function(r){
    자료.부르는중 = false;
    if(!r || !r.ok){ 자료못읽음_((r && r.메시지) || '표를 읽지 못했어요'); return; }
    var 답 = JSON.parse(r.자료);
    자료.목록 = 답.목록;
    이름들.forEach(function(n){ delete 자료.표들[n]; });
    답.표들.forEach(function(t){ 자료.표들[t.이름] = t; });
    if(!자료.표 || !자료.목록.some(function(t){ return t.이름 === 자료.표; })) 자료.표 = (자료.목록[0]||{}).이름 || '';
    if(T.tab === 'data') 자료그리기_();
  }).catch(function(e){ 자료.부르는중 = false; 자료못읽음_('표를 읽지 못했어요 — '+(e && e.message || e)); });
}
/* 못 읽었으면 그 자리에 적는다 — 다시 그리면 또 부르게 되니 그리지 않는다 */
function 자료못읽음_(글){
  toast(글);
  var b = $('tBody');
  if(T.tab === 'data' && b && !자료.목록) b.innerHTML = 머리('자료 고치기', '') + 빈칸(esc(글)+' · 왼쪽 아래 ↻ 로 다시');
}
/* 실패 — 그 사이 바뀐 줄이면 그 표를 새로 받아 다시 보여 준다 */
function 자료실패_(r, 이름들){
  toast((r && r.메시지) || '저장하지 못했어요');
  if(r && r.충돌) 자료부르기_(이름들); else 자료그리기_();
}
function 자료칸저장_(표이름, i, c, 새글){
  var 표 = 자료.표들[표이름], 줄 = 표 && 표.줄들[i];
  if(!줄 || 자료칸글_(줄[c]) === 새글){ 자료그리기_(); return; }
  return api('__자료고치기', {표:표이름, 행:i+2, 열:c+1, 전줄:줄, 값:새글}).then(function(r){
    if(!r || !r.ok){ 자료실패_(r, [표이름]); return; }
    표.줄들[i] = JSON.parse(r.자료).후줄;
    자료.바뀜 = true;
    toast('고쳤어요');
    자료그리기_();
  }).catch(function(e){ toast('저장하지 못했어요 — '+(e && e.message || e)); 자료그리기_(); });
}
function 자료고른것_(){ return Object.keys(자료.고름).filter(function(k){ return 자료.고름[k]; }).map(Number); }
function 자료지우기_(){
  var 표이름 = 자료.표, 표 = 자료.표들[표이름], 고른 = 자료고른것_();
  if(!표 || !고른.length) return;
  if(!confirm(고른.length+'줄을 지울까요?\n지운 줄은 휴지통에 '+자료보관일+'일 동안 남아요.')) return;
  return api('__자료지우기', {표:표이름, 줄들:고른.map(function(i){ return {행:i+2, 전줄:표.줄들[i]}; })}).then(function(r){
    if(!r || !r.ok){ 자료실패_(r, [표이름]); return; }
    자료.고름 = {}; 자료.바뀜 = true;
    toast(고른.length+'줄을 휴지통으로 옮겼어요');
    return 자료부르기_([표이름, '휴지통']);
  }).catch(function(e){ toast('지우지 못했어요 — '+(e && e.message || e)); });
}
function 자료되살리기_(){
  var 통 = 자료.표들['휴지통'], 고른 = 자료고른것_();
  if(!통 || !고른.length) return;
  var 번호들 = 고른.map(function(i){ return 통.줄들[i][6]; });
  var 표들 = 고른.map(function(i){ return String(통.줄들[i][1]); });
  return api('__자료되살리기', {번호들:번호들}).then(function(r){
    if(!r || !r.ok){ 자료실패_(r, ['휴지통']); return; }
    자료.고름 = {}; 자료.바뀜 = true;
    toast(고른.length+'줄을 되살렸어요');
    return 자료부르기_(['휴지통'].concat(표들.filter(function(n, k){ return 표들.indexOf(n) === k; })));
  }).catch(function(e){ toast('되살리지 못했어요 — '+(e && e.message || e)); });
}
/* 선생님이 들어올 때 — 30일 지난 휴지통 줄을 비운다. 비울 게 없으면 서버도 저장하지 않는다 */
function 자료휴지통정리_(){
  return api('__휴지통비우기', {}).catch(function(){});
}

/* ---------- 그리기 ---------- */
function 자료휴지통줄_(줄){
  var 내용 = []; try{ 내용 = JSON.parse(줄[3] || '[]'); }catch(e){}
  var 남은 = 자료보관일 - Math.floor((Date.now() - 자료밀리초_(줄[0])) / 86400000);
  var 보일 = (자료.목록||[]).filter(function(t){ return t.이름 === 줄[1]; })[0];
  return {때:자료칸글_(줄[0]), 표:보일 ? 보일.보일이름 : String(줄[1]), 행:줄[2],
    내용:내용.map(자료칸글_).filter(Boolean).slice(0, 8).join(' · '), 누가:자료칸글_(줄[7]), 남은:Math.max(0, 남은)};
}
function 자료그리기_(){
  var b = $('tBody'); if(!b) return;
  var 오른쪽 = '<div class="tacts">'+
    '<button class="btn line sm'+(자료.휴지통?' on':'')+'" id="jrTrash" style="width:auto;margin:0">'+(자료.휴지통?'← 표로':'🗑 휴지통')+'</button>'+
    '<button class="btn sm" id="jrXlsx" style="width:auto;margin:0">전체 내려받기 (.xlsx)</button></div>';
  var 위 = 머리(자료.휴지통 ? '휴지통' : '자료 고치기',
    자료.휴지통 ? '지운 줄은 '+자료보관일+'일 동안 남아요 · 골라서 되살립니다' : '칸을 눌러 고칩니다 · 줄을 골라 지웁니다', 오른쪽);
  var 이름 = 자료.휴지통 ? '휴지통' : 자료.표, 표 = 자료.표들[이름];
  if(!자료.목록 || (이름 && !표 && !(자료.휴지통 && 자료.목록))){
    b.innerHTML = '<div class="jrroot">' + 위 + 빈칸('불러오는 중…') + '</div>';
    if(!자료.부르는중) 자료부르기_();
    자료단추달기_();
    return;
  }
  /* 한 겹 싸 둔다 — 선생님 화면은 #tBody 의 자식마다 떠오르는 움직임을 주는데, 이 탭은 누를 때마다 다시 그리니 흔들린다 */
  b.innerHTML = '<div class="jrroot">' + 위 + (자료.휴지통 ? 자료휴지통판_(표) : 자료표판_(표)) + '</div>';
  자료단추달기_();
}
function 자료표판_(표){
  var 묶음 = {};
  자료.목록.forEach(function(t){ (묶음[t.묶음] = 묶음[t.묶음] || []).push(t); });
  var 고르개 = '<select id="jrTable">'+Object.keys(묶음).map(function(g){
    return '<optgroup label="'+esc(g)+'">'+묶음[g].map(function(t){
      return '<option value="'+esc(t.이름)+'"'+(t.이름===자료.표?' selected':'')+'>'+esc(t.보일이름)+'</option>';
    }).join('')+'</optgroup>';
  }).join('')+'</select>';
  if(!표) return '<div class="tbar"><div class="f"><label>표</label>'+고르개+'</div></div>'+빈칸('표가 없어요');
  var 열 = 자료열들_(표.머리), 보일 = 자료거르기_(표, 자료);
  var 반값 = {};
  if(열.반 >= 0) 표.줄들.forEach(function(줄){ var v = 자료칸글_(줄[열.반]); if(v) 반값[v] = 1; });
  var 반들 = Object.keys(반값).sort();
  var 거르개 = '<div class="tbar jrbar">'+
    '<div class="f"><label>표</label>'+고르개+'</div>'+
    '<div class="f"><label>찾기</label><input id="jrFind" placeholder="아무 글이나" value="'+esc(자료.찾기)+'"></div>'+
    (열.학생 >= 0 ? '<div class="f"><label>학생</label><input id="jrName" placeholder="이름" value="'+esc(자료.학생)+'"></div>' : '')+
    (열.날짜 >= 0 ? '<div class="f"><label>날짜 (부터)</label><input type="date" id="jrFrom" value="'+esc(자료.부터)+'"></div>'+
      '<div class="f"><label>(까지)</label><input type="date" id="jrTo" value="'+esc(자료.까지)+'"></div>' : '')+
    '</div>'+
    (반들.length > 1 ? '<div class="jrban"><span class="sub">반</span>'+반들.map(function(v){
      return '<button type="button" class="chip'+(자료.반[v]?' on':'')+'" data-jrban="'+esc(v)+'">'+esc(v)+'</button>';
    }).join('')+'</div>' : '');
  var 고른수 = 자료고른것_().length;
  var 일 = '<div class="jract"><span class="sub">'+보일.length+'줄'+(고른수?' · <b>'+고른수+'줄 고름</b>':'')+'</span>'+
    '<button class="btn line sm warnbtn" id="jrDel" style="width:auto;margin:0"'+(고른수?'':' disabled')+'>고른 줄 지우기</button></div>';
  var 보일만 = 보일.slice(0, 자료.몇줄);
  var 너비 = Math.max(표.머리.length, 1);
  var 줄들 = 보일만.map(function(i){
    var 줄 = 표.줄들[i];
    var 칸 = [];
    for(var c = 0; c < 너비; c++){
      칸.push('<td class="jc" data-i="'+i+'" data-c="'+c+'" data-h="'+esc(표.머리[c]||'')+'">'+esc(자료칸글_(줄[c]))+'</td>');
    }
    return '<tr'+(자료.고름[i]?' class="pick"':'')+'><td class="jk"><input type="checkbox" data-pick="'+i+'"'+(자료.고름[i]?' checked':'')+'></td>'+
      '<td class="jn">'+(i+2)+'</td>'+칸.join('')+'</tr>';
  }).join('');
  var 머리줄 = '<tr><th class="jk"><input type="checkbox" id="jrAll"'+(보일만.length && 보일만.every(function(i){ return 자료.고름[i]; })?' checked':'')+'></th><th class="jn">줄</th>'+
    표.머리.map(function(h){ return '<th>'+esc(h)+'</th>'; }).join('')+'</tr>';
  var 더 = 보일.length > 자료.몇줄 ? '<button class="btn line sm" id="jrMore" style="width:auto;margin:12px auto;display:block">더 보기 (남은 '+(보일.length-자료.몇줄)+'줄)</button>' : '';
  return 거르개 + 일 + '<div class="panel"><div class="jrwrap"><table class="tb jrt"><thead>'+머리줄+'</thead><tbody>'+
    (줄들 || '<tr><td colspan="'+(너비+2)+'" class="sub">맞는 줄이 없어요</td></tr>')+'</tbody></table></div>'+더+'</div>';
}
function 자료휴지통판_(통){
  var 보일 = 통 ? 자료거르기_(통, {}) : [];
  var 고른수 = 자료고른것_().length;
  var 일 = '<div class="jract"><span class="sub">'+보일.length+'줄'+(고른수?' · <b>'+고른수+'줄 고름</b>':'')+'</span>'+
    '<button class="btn sm" id="jrBack" style="width:auto;margin:0"'+(고른수?'':' disabled')+'>고른 줄 되살리기</button></div>';
  if(!보일.length) return 일 + 빈칸('휴지통이 비었어요');
  var 줄들 = 보일.map(function(i){
    var j = 자료휴지통줄_(통.줄들[i]);
    return '<tr'+(자료.고름[i]?' class="pick"':'')+'><td class="jk"><input type="checkbox" data-pick="'+i+'"'+(자료.고름[i]?' checked':'')+'></td>'+
      '<td data-h="지운 때" class="nw">'+esc(j.때)+'</td><td data-h="표" class="nw">'+esc(j.표)+'</td>'+
      '<td data-h="원래 줄" class="num">'+esc(j.행)+'</td><td data-h="내용">'+esc(j.내용)+'</td>'+
      '<td data-h="누가" class="nw sub">'+esc(j.누가)+'</td><td data-h="남은 날" class="num">'+j.남은+'일</td></tr>';
  }).join('');
  var 다고름 = 보일.every(function(i){ return 자료.고름[i]; });
  return 일 + '<div class="panel"><div class="jrwrap"><table class="tb jrt"><thead><tr><th class="jk"><input type="checkbox" id="jrAll"'+(다고름?' checked':'')+'></th>'+
    '<th>지운 때</th><th>표</th><th>원래 줄</th><th>내용</th><th>누가</th><th>남은 날</th></tr></thead><tbody>'+줄들+'</tbody></table></div></div>';
}
function 자료다시_(){ 자료.고름 = {}; 자료.몇줄 = 200; 자료그리기_(); }
function 자료단추달기_(){
  var 단 = function(id, f){ var e = $(id); if(e) e.onclick = f; };
  단('jrTrash', function(){ 자료.휴지통 = !자료.휴지통; 자료.고름 = {}; 자료.휴지통 ? 자료부르기_(['휴지통']) : 자료그리기_(); });
  단('jrXlsx', 자료엑셀받기_);
  단('jrDel', 자료지우기_);
  단('jrBack', 자료되살리기_);
  단('jrMore', function(){ 자료.몇줄 += 200; 자료그리기_(); });
  var 표고름 = $('jrTable');
  if(표고름) 표고름.onchange = function(){
    자료.표 = 표고름.value; 자료.반 = {}; 자료.찾기 = ''; 자료.학생 = ''; 자료.부터 = ''; 자료.까지 = '';
    자료.고름 = {}; 자료.몇줄 = 200;
    자료.표들[자료.표] ? 자료그리기_() : 자료부르기_([자료.표]);
  };
  /* 글을 칠 때마다 다시 그리면 입력칸이 새로 생겨 커서가 날아간다 — 잠깐 멈췄을 때 그리고 그 칸에 다시 둔다 */
  [['jrFind','찾기'],['jrName','학생'],['jrFrom','부터'],['jrTo','까지']].forEach(function(p){
    var e = $(p[0]); if(!e) return;
    var 때;
    e.oninput = function(){
      clearTimeout(때);
      때 = setTimeout(function(){
        자료[p[1]] = e.value; 자료.고름 = {}; 자료.몇줄 = 200; 자료그리기_();
        var 새 = $(p[0]); if(새 && 새.type !== 'date'){ 새.focus(); try{ 새.setSelectionRange(새.value.length, 새.value.length); }catch(x){} }
      }, e.type === 'date' ? 0 : 250);
    };
  });
  qsa('[data-jrban]').forEach(function(x){
    x.onclick = function(){ var v = x.dataset.jrban; 자료.반[v] = !자료.반[v]; 자료다시_(); };
  });
  qsa('[data-pick]').forEach(function(x){
    x.onchange = function(){ 자료.고름[x.dataset.pick] = x.checked; 자료그리기_(); };
  });
  var 다 = $('jrAll');
  if(다) 다.onchange = function(){
    var 표 = 자료.표들[자료.휴지통 ? '휴지통' : 자료.표];
    var 보일 = 표 ? 자료거르기_(표, 자료.휴지통 ? {} : 자료).slice(0, 자료.휴지통 ? Infinity : 자료.몇줄) : [];
    자료.고름 = {}; if(다.checked) 보일.forEach(function(i){ 자료.고름[i] = true; });
    자료그리기_();
  };
  if(!자료.휴지통) qsa('td.jc').forEach(function(td){ td.onclick = function(){ 자료칸열기_(td); }; });
}
/* 칸을 눌러 고치기 — Enter 나 다른 곳을 누르면 저장, Esc 는 그만 */
function 자료칸열기_(td){
  if(td.querySelector('input')) return;
  var i = +td.dataset.i, c = +td.dataset.c, 옛글 = td.textContent, 끝남 = false;
  td.innerHTML = '<input class="jin" value="'+esc(옛글)+'">';
  td.classList.add('edit');
  var 칸 = td.querySelector('input');
  칸.focus(); 칸.select();
  var 마치기 = function(저장){
    if(끝남) return; 끝남 = true;
    if(저장 && 칸.value !== 옛글){ td.classList.add('saving'); 자료칸저장_(자료.표, i, c, 칸.value); }
    else 자료그리기_();
  };
  칸.onkeydown = function(e){
    if(e.key === 'Enter'){ e.preventDefault(); 마치기(true); }
    else if(e.key === 'Escape'){ e.preventDefault(); 마치기(false); }
  };
  칸.onblur = function(){ 마치기(true); };
}

/* ---------- 미리보기(파일로 열기) — 흉내 표. 진짜 규칙은 services/table-edit.mjs ---------- */
if(typeof DEMO !== 'undefined' && typeof GAS !== 'undefined' && !GAS) (function(){
  var 날 = function(s){ return {$date:Date.parse(s+'+09:00')}; };
  var 표들 = {
    '학생':{이름:'학생', 머리:['반','이름','비밀번호','학년구분','볼 수 있는 단어장','학년','학교','교재','학부모링크','학부모마지막','선생님한마디'],
      줄들:[['월수금','홍길동','1234','중등','','중2','홍제중','중2 5과','','',''],['월수금','김영희','1111','중등','','중2','인왕중','중2 5과','','',''],['화목','이철수','2222','초등','','초6','홍제초','','','','']]},
    '숙제':{이름:'숙제', 머리:['반','단어장','시작번호','끝번호','유형','마감일','등록시각','학생','숙제종류'],
      줄들:[['','예시 단어장',1,10,'스펠링',날('2026-10-15T00:00:00'),날('2026-10-13T16:20:00'),'','숙제']]},
    '기록':{이름:'기록', 머리:['시각','반','이름','단어장','범위','유형','문항수','정답수','점수'],
      줄들:[[날('2026-10-12T19:02:00'),'월수금','홍길동','예시 단어장','1~10','스펠링',10,9,90],[날('2026-10-13T20:41:00'),'월수금','김영희','예시 단어장','1~10','스펠링',10,7,70]]},
    '점수':{이름:'점수', 머리:['날짜','반','이름','시험명','점수'], 줄들:[[날('2026-10-10T00:00:00'),'월수금','홍길동','10월 단어시험',95]]},
    '휴지통':{이름:'휴지통', 머리:['지운때','표','원래행','내용','메모','비밀','번호','지운사람'], 줄들:[]}
  };
  var 목록 = [{이름:'학생',보일이름:'학생 명단',묶음:'학생'},{이름:'숙제',보일이름:'숙제',묶음:'숙제'},{이름:'기록',보일이름:'숙제 결과',묶음:'숙제'},{이름:'점수',보일이름:'시험 점수',묶음:'숙제'}];
  var 답 = function(x){ return {ok:true, 자료:JSON.stringify(x)}; };
  DEMO.__자료읽기 = function(a){
    var 이름들 = a && a.모두 ? Object.keys(표들) : ((a && a.이름들) || []);
    return 답({목록:목록, 표들:이름들.filter(function(n){ return 표들[n]; }).map(function(n){ return JSON.parse(JSON.stringify(표들[n])); })});
  };
  DEMO.__자료고치기 = function(a){
    var 줄 = 표들[a.표].줄들[a.행-2];
    if(JSON.stringify(줄) !== JSON.stringify(a.전줄)) return {ok:false, 충돌:true, 메시지:'그 사이 다른 곳에서 이 줄이 바뀌었어요.'};
    var 옛 = 줄[a.열-1];
    줄[a.열-1] = 자료날짜인가_(옛) ? 날(String(a.값).replace(' ','T')+(String(a.값).length<=10?'T00:00:00':':00')) : (typeof 옛 === 'number' && String(Number(a.값)) === a.값 ? Number(a.값) : a.값);
    return 답({후줄:줄});
  };
  DEMO.__자료지우기 = function(a){
    var 표 = 표들[a.표];
    a.줄들.map(function(j){ return j.행; }).sort(function(x, y){ return y - x; }).forEach(function(행){
      var 줄 = 표.줄들.splice(행-2, 1)[0];
      표들['휴지통'].줄들.push([{$date:Date.now()}, a.표, 행, JSON.stringify(줄), '', '', 'n'+Math.random().toString(36).slice(2,9), '선생님 · 미리보기']);
    });
    return 답({지운:a.줄들.length});
  };
  DEMO.__자료되살리기 = function(a){
    var 통 = 표들['휴지통'].줄들;
    a.번호들.forEach(function(n){
      var k = 통.map(function(j){ return j[6]; }).indexOf(n); if(k < 0) return;
      var j = 통.splice(k, 1)[0], 표 = 표들[j[1]];
      표.줄들.splice(Math.min(j[2]-2, 표.줄들.length), 0, JSON.parse(j[3]));
    });
    return 답({되살린:a.번호들.length});
  };
  DEMO.__휴지통비우기 = function(){ return 답({비운:0}); };
})();
