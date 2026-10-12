/* 화면 여러 개가 함께 쓰는 작은 도움말들. 모듈이 아니다 — build-services.mjs 가 대상 파일의 인라인 스크립트에 그대로 박는다. */

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
