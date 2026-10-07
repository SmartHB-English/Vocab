/*******************************************************************
 *  해법 영단어 — 구글 Apps Script 백엔드
 *  스프레드시트에 붙어서 동작합니다.
 *  처음 한 번만 [초기설정] 함수를 실행하면 필요한 시트가 자동으로 만들어집니다.
 *******************************************************************/

var SHEET = {
  설정: '설정',
  학생: '학생',
  단어장목록: '단어장목록',
  숙제: '숙제',
  기록: '기록',
  기록보관: '기록보관',
  점수: '점수',
  미제출: '미제출',
  시상: '시상',
  게임: '게임',
  공지: '공지',
  푸시: '푸시'
};

var 틀린단어열 = 14;   // N열
var 구분열 = 15;       // O열 — '숙제' 또는 '오답 재시험'
var 제외열 = 16;       // P열 — 'O' 면 이 기록 한 줄을 집계에서 뺀다
var 재시험표시 = '오답 재시험';
var 보충표시 = '보충';        // 보충 숙제로 본 시험 — 집계에서 뺀다
var 시험표시 = '시험';        // 학원에서 보는 시험 — 평균을 따로 낸다
var 기본레슨 = 10;            // 단어장을 몇 단어씩 레슨으로 나눌지 (기본값)
var 기본합격점 = 80;          // 숙제로 인정하는 최소 점수 (이보다 낮으면 다시 봐야 한다)
/* 처음 만드는 설정 시트에만 적는 값 — 이제 읽지 않는다 (시간은 숙제마다 「외우기분」·「제한시간」 칸).
   설정 시트의 두 줄은 되돌릴 수 있게 지우지 않고 둔다 */
var 기본외우기분 = 5;
var 기본시험분 = 20;
var 오답요약개수 = 5;  // 셀에 보여줄 단어 개수

var HEADERS = {
  설정: ['항목', '값'],
  학생: ['반', '이름', '비밀번호', '학년구분', '볼 수 있는 단어장', '학년', '학교', '교재',
        '학부모링크', '학부모마지막', '선생님한마디'],
  단어장목록: ['단어장', '종류', '시트이름', '색', '레슨묶음', '과'],
  숙제: ['반', '단어장', '시작번호', '끝번호', '유형', '마감일', '등록시각', '학생', '숙제종류',
        '수업', '순서', '칸', '제한시간', '단계', '통과점수', '재응시', '외우기분'],
  기록: ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수',
        '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'],
  기록보관: ['시각', '반', '이름', '단어장', '범위', '유형', '문항수', '정답수',
           '점수', '게임점수', '최고콤보', '소요초', '숙제여부', '틀린단어', '구분', '집계제외'],
  점수: ['날짜', '반', '이름', '시험명', '점수'],
  미제출: ['상태', '반', '단어장', '범위', '유형', '숙제종류', '마감일',
         '대상', '한 명', '안 한 명', '안 한 학생'],
  시상: ['년월', '상', '학생', '반', '기록', '동점자', '집계한 때'],
  게임: ['시각', '반', '이름', '게임', '점수', '기록', '단어장'],
  공지: ['만든때', '반', '제목', '내용', '끝나는날', '켬'],
  푸시: ['켠때', '반', '이름', '주소', 'p256dh', 'auth', '기기']
};

/* ------------------------------------------------------------------ 앱이 사는 곳
 * 앱 화면은 이제 깃헙 페이지에 있다. 이 스크립트 주소로 들어온 사람에게는
 * index.html(안내 페이지)이 뜨면서 아래 주소로 가라고 알려 준다.
 * 깃헙 주소가 바뀌면 여기 한 줄만 고치면 된다. */
var 새주소 = 'https://smarthb-english.github.io/Vocab/';

/* ------------------------------------------------------------------ 웹앱 진입 */
function doGet(e) {
  var 페이지 = (e && e.parameter && e.parameter.p) || '';

  if (페이지 === 'guide') {           // 학생용 사용법
    return HtmlService.createHtmlOutputFromFile('guide')
      .setTitle('해법 영단어 사용법')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  /* 앱 화면은 이제 깃헙에 있다. 예전 주소로 들어온 사람에게는
     index.html(안내 페이지)을 띄워 새 주소로 보내 준다. */
  var t = HtmlService.createTemplateFromFile('index');
  t.새주소 = 새주소;
  try { t.앱주소 = ScriptApp.getService().getUrl(); } catch (err) { t.앱주소 = ''; }
  return t.evaluate()
    .setTitle('해법 영단어')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ------------------------------------------------------------------ 바깥 화면용 창구
 * 화면을 깃헙 같은 곳에 올려 두고 이 주소로 말을 걸 때 쓴다.
 * 브라우저가 미리 물어보는(preflight) 걸 피하려고 글은 text/plain 으로 온다.
 */
var 열린기능_ = {
  시작정보: 시작정보,
  로그인: 로그인,
  단어가져오기: 단어가져오기,
  숙제가져오기: 숙제가져오기,
  결과저장: 결과저장,
  내기록: 내기록,
  월간순위: 월간순위,
  연속가져오기: 연속가져오기,
  게임저장: 게임저장,
  게임순위: 게임순위,
  공지가져오기: 공지가져오기,
  푸시공개키: 푸시공개키,
  구독등록: 구독등록,
  구독해제: 구독해제,
  선생님로그인: 선생님로그인,
  선생님요약: 선생님요약,
  선생님기본: 선생님기본,
  선생님기록: 선생님기록,
  기록메모: 기록메모,
  학부모보기: 학부모보기,
  학부모링크발급: 학부모링크발급,
  학부모한마디: 학부모한마디,
  학부모미리보기: 학부모미리보기,
  틀린전문: 틀린전문,
  숙제등록: 숙제등록,
  수업꾸러미목록: 수업꾸러미목록,
  수업내주기: 수업내주기,
  수업틀목록: 수업틀목록,
  과목록: 과목록,
  과넣기: 과넣기,
  재응시더주기: 재응시더주기,
  수업틀저장: 수업틀저장,
  수업틀삭제: 수업틀삭제,
  수업추천: 수업추천,
  내오답: 내오답,
  수업삭제: 수업삭제,
  숙제수정: 숙제수정,
  숙제삭제: 숙제삭제,
  숙제여러개삭제: 숙제여러개삭제,
  지난숙제정리: 지난숙제정리,
  명단가져오기: 명단가져오기,
  학생수정: 학생수정,
  학생붙여넣기: 학생붙여넣기,
  배정가져오기: 배정가져오기,
  배정저장: 배정저장,
  교재대상: 교재대상,
  교재일괄: 교재일괄,
  단어목록: 단어목록,
  단어추가: 단어추가,
  단어수정: 단어수정,
  단어삭제: 단어삭제,
  단어붙여넣기: 단어붙여넣기,
  그림올리기: 그림올리기,
  그림여러개: 그림여러개,
  그림지우기: 그림지우기,
  단어장이름변경: 단어장이름변경,
  단어장색변경: 단어장색변경,
  단어장삭제: 단어장삭제,
  레슨크기저장: 레슨크기저장,
  기록정리: 기록정리,
  기록제외설정: 기록제외설정,
  미제출시트: 미제출시트,
  오래된기록정리API: 오래된기록정리API,
  시상집계: 시상집계,
  시상저장API: 시상저장API,
  시상달목록: 시상달목록,
  시상시작일저장: 시상시작일저장,
  시상항목저장: 시상항목저장,
  공지목록: 공지목록,
  공지등록: 공지등록,
  공지끄기: 공지끄기,
  공지삭제: 공지삭제,
  합격점저장: 합격점저장,
  설정가져오기: 설정가져오기,
  설정저장: 설정저장,
  연속시작일저장: 연속시작일저장,
  푸시열쇠: 푸시열쇠,
  푸시열쇠저장: 푸시열쇠저장,
  구독목록: 구독목록,
  구독현황: 구독현황,
  구독지우기: 구독지우기,
  푸시전송: 푸시전송
};

function doPost(e) {
  var 답 = { ok: false, 메시지: '알 수 없는 요청입니다.' };
  try {
    var 글 = (e && e.postData && e.postData.contents) || '{}';
    var 온것 = JSON.parse(글);
    var 무엇 = s_(온것.fn);
    var 인자 = 온것.args || [];
    읽은것_ = null;                       // 앞 요청의 메모가 남아 있으면 안 된다
    var f = 열린기능_[무엇];
    if (typeof f !== 'function') throw new Error('쓸 수 없는 기능입니다: ' + 무엇);
    답 = { ok: true, 값: f.apply(null, 인자) };
    담은것버리기_(무엇);
  } catch (err) {
    답 = { ok: false, 메시지: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(답))
    .setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('해법 영단어')
    .addItem('초기설정 (처음 한 번)', '초기설정')
    .addItem('예시 단어 넣기', '예시단어넣기')
    .addSeparator()
    .addItem('점수 입력표 만들기', '점수입력표')
    .addItem('숙제 안 한 학생 정리', '미제출정리')
    .addSeparator()
    .addItem('알림 보낼 권한 확인', '알림권한확인')
    .addItem('사진 올릴 권한 확인', '그림권한확인')
    .addSeparator()
    .addItem('지난달 시상 집계하기', '지난달시상집계')
    .addItem('매월 1일 자동 집계 켜기', '시상자동켜기')
    .addItem('매월 1일 자동 집계 끄기', '시상자동끄기')
    .addSeparator()
    .addItem('고른 줄을 보관함으로 옮기기', '선택기록정리')
    .addItem('오래된 기록을 보관함으로 옮기기', '오래된기록정리')
    .addItem('기록 시트 보기 좋게 정리', '기록서식정리')
    .addItem('기록을 단어장별로 묶기', '단어장별정렬')
    .addItem('조회 시트 새로 만들기', '조회만들기')
    .addSeparator()
    .addItem('보관함 완전히 비우기', '보관함비우기')
    .addToUi();
}

/* ------------------------------------------------------------------ 초기 설정 */
function 초기설정() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET).forEach(function (k) {
    var name = SHEET[k];
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[k].length).setValues([HEADERS[k]])
        .setFontWeight('bold').setBackground('#EFF3F9');
      sh.setFrozenRows(1);
    }
  });

  /* 이미 쓰고 있던 시트에도 나중에 생긴 칸을 붙여 준다 */
  기록칸확보_(SHEET.기록);
  기록칸확보_(SHEET.기록보관);
  목록칸확보_();
  명단칸확보_();

  /* 연속 기록은 처음 켤 때 '어제'부터 세기 시작한다 (예전 기록으로 헛불꽃이 생기지 않게) */
  var 있나 = false;
  rows_(SHEET.설정).forEach(function (r) { if (s_(r[0]) === '연속시작일') 있나 = true; });
  if (!있나) 설정쓰기_('연속시작일', 어제_());

  var st = ss.getSheetByName(SHEET.설정);
  if (st.getLastRow() < 2) {
    st.getRange(2, 1, 9, 2).setValues([
      ['선생님비밀번호', '1234'],
      ['학원이름', '홍제인왕해법영어'],
      ['기본테마', '자동'],
      ['시상시작일', ''],
      ['시상항목', '숙제'],
      ['숙제합격점', 기본합격점],
      ['외우기시간분', 기본외우기분],
      ['시험시간분', 기본시험분],
      ['연속시작일', 어제_()]
    ]);
  }

  var stu = ss.getSheetByName(SHEET.학생);
  if (stu.getLastRow() < 2) {
    stu.getRange(2, 1, 3, 8).setValues([
      ['중2 A반', '홍길동', '1234', '초중등', '', '중2', '인왕중', '예시 단어장'],
      ['중2 A반', '김영희', '1234', '초중등', '', '중2', '인왕중', '예시 단어장'],
      ['고3 B반', '이철수', '1234', '고등', '', '고3', '한성고', '']
    ]);
  }

  var 기본시트 = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (기본시트 && ss.getSheets().length > 1 && 기본시트.getLastRow() === 0) {
    ss.deleteSheet(기본시트);
  }

  var 옮김 = 단어장분리_();
  /* 한 군데가 넘어져도 나머지는 끝까지 간다. 무엇이 안 됐는지는 끝에 알려 준다. */
  var 탈 = [];
  [['예시 단어', 예시단어넣기], ['점수 시트', 점수시트_], ['머리글 보정', 헤더보정_],
   ['조회 시트', 조회만들기], ['기록 서식', 기록서식정리]].forEach(function (x) {
    try { x[1](); } catch (e) { 탈.push(x[0] + ' — ' + String((e && e.message) || e)); }
  });
  SpreadsheetApp.getActiveSpreadsheet().toast(
    (탈.length ? '초기설정을 마쳤지만 ' + 탈.length + '군데가 안 됐습니다.' : '초기설정이 끝났습니다.') +
    (옮김 ? ' 예전 단어장 ' + 옮김 + '개를 시트로 나눴습니다.' : ''),
    '해법 영단어', 8);
  if (탈.length) {
    Logger.log(탈.join('\n'));
    try {
      SpreadsheetApp.getUi().alert('해법 영단어 · 초기설정',
        '아래는 안 됐습니다. 나머지는 끝났습니다.\n\n' + 탈.join('\n'),
        SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) { }
  }
}

/**
 * 기능이 늘면서 시트에 열이 추가될 때, 이미 쓰던 시트에도 빠진 머리글을 채워 준다.
 * 기존 자료는 건드리지 않는다.
 */
function 헤더보정_() {
  Object.keys(SHEET).forEach(function (k) {
    var sh = ss_().getSheetByName(SHEET[k]);
    if (!sh || !HEADERS[k]) return;
    var 필요 = HEADERS[k].length;
    if (sh.getMaxColumns() < 필요) sh.insertColumnsAfter(sh.getMaxColumns(), 필요 - sh.getMaxColumns());
    var 현재 = sh.getRange(1, 1, 1, 필요).getValues()[0];
    var 바꿈 = false;
    for (var i = 0; i < 필요; i++) {
      if (String(현재[i]).trim() === '') { 현재[i] = HEADERS[k][i]; 바꿈 = true; }
    }
    if (바꿈) {
      sh.getRange(1, 1, 1, 필요).setValues([현재])
        .setFontWeight('bold').setBackground('#EFF3F9');
    }
  });
}

/* ------------------------------------------------------------------ 기록 보기 정리 */
/* 항목마다 줄 색을 달리해서 한눈에 구분되게 한다.
   같은 날짜끼리 묶이도록 날짜가 바뀔 때마다 옅고 진한 색을 번갈아 쓴다. */
var 기록색 = {
  '숙제':    ['#FFFFFF', '#EEF4FD'],
  '시험':    ['#DCE9FB', '#CFE0F8'],
  '보충':    ['#F1F3F5', '#E6E9EC'],
  '오답노트': ['#FFF4E0', '#FDE9C8'],
  '연습':    ['#FAFAFA', '#F0F1F3']
};
var 기록글색 = {
  '숙제': '#111827', '시험': '#1D4ED8', '보충': '#6B7280',
  '오답노트': '#B45309', '연습': '#9AA0A6'
};

function 기록서식정리() {
  [SHEET.기록, SHEET.기록보관].forEach(function (name) {
    var sh = ss_().getSheetByName(name);
    if (!sh) return;
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 135);          // 시각
    sh.setColumnWidth(2, 90);           // 반
    sh.setColumnWidth(3, 75);           // 이름
    sh.setColumnWidth(4, 130);          // 단어장
    sh.setColumnWidth(5, 70);           // 범위
    sh.setColumnWidth(6, 75);           // 유형
    for (var c = 7; c <= 13; c++) sh.setColumnWidth(c, 62);
    sh.setColumnWidth(틀린단어열, 330); // 틀린단어
    sh.setColumnWidth(구분열, 90);
    var last = Math.max(sh.getLastRow(), 2);
    sh.getRange(1, 1, last, sh.getMaxColumns())
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
      .setVerticalAlignment('middle');
    sh.getRange(2, 1, last - 1, 1).setNumberFormat('yyyy-MM-dd HH:mm');
    sh.getRange(1, 구분열).setNote(
      '줄 색 안내\n' +
      '  흰색 / 연파랑 — 숙제 (날짜가 바뀔 때마다 색이 번갈아 바뀝니다)\n' +
      '  파랑 — 시험\n' +
      '  주황 — 오답 재시험 (오답노트)\n' +
      '  회색 — 보충\n' +
      '  연회색 — 혼자 연습 (집계에 안 들어갑니다)\n' +
      '날짜가 바뀌는 줄 위에는 굵은 줄이 그어집니다.');
    기록날짜묶기_(sh);
    기록필터_(sh);
  });
  ss_().toast('기록 시트를 날짜별로 묶고 숙제·오답노트를 색으로 나눴습니다.', '해법 영단어', 8);
}

/**
 * 기록 시트를 최신순으로 세우고, 날짜가 바뀔 때마다 줄을 그어 묶는다.
 * 항목(숙제·시험·보충·오답노트·연습)마다 줄 색이 다르다.
 */
function 기록날짜묶기_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var cols = Math.max(sh.getLastColumn(), HEADERS.기록.length);
  var n = last - 1;

  var f = sh.getFilter(); if (f) f.remove();
  if (n > 1) sh.getRange(2, 1, n, cols).sort([{ column: 1, ascending: false }]);   // 최신이 위로

  var 값 = sh.getRange(2, 1, n, cols).getValues();
  var 배경 = [], 글색 = [], 굵기 = [], 날바뀜 = [];
  var 앞날 = null, 짝 = 0;

  값.forEach(function (x, i) {
    var 날 = (x[0] instanceof Date) ? ymd_(x[0]) : s_(x[0]).slice(0, 10);
    var 바뀜 = (날 !== 앞날);
    if (바뀜) { 앞날 = 날; 짝 = 1 - 짝; 날바뀜.push(i + 2); }

    var 항목 = 기록항목_(x[구분열 - 1], x[12]);
    var 색 = (기록색[항목] || 기록색['숙제'])[짝];
    var 줄배경 = [], 줄글색 = [];
    for (var c = 0; c < cols; c++) { 줄배경.push(색); 줄글색.push(기록글색[항목] || '#111827'); }
    배경.push(줄배경); 글색.push(줄글색);
    굵기.push([바뀜 ? 'bold' : 'normal']);          // 날짜가 바뀌는 줄의 시각만 굵게
  });

  var 범위 = sh.getRange(2, 1, n, cols);
  범위.setBackgrounds(배경).setFontColors(글색);
  범위.setBorder(false, false, false, false, false, false);
  sh.getRange(2, 1, n, 1).setFontWeights(굵기);

  /* 날짜가 바뀌는 줄 위에 굵은 선 — 너무 많으면 건너뛴다 (시트가 느려지지 않게) */
  if (날바뀜.length <= 400) {
    날바뀜.forEach(function (r) {
      if (r === 2) return;                          // 맨 윗줄은 머리글 밑이라 필요 없다
      sh.getRange(r, 1, 1, cols)
        .setBorder(true, null, null, null, null, null, '#9AA3AF', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    });
  }
}

/** 머리글에 필터를 걸어 둔다 — 단어장·반·이름으로 골라 볼 수 있게 */
function 기록필터_(sh) {
  try {
    var f = sh.getFilter();
    if (f) f.remove();
    var last = sh.getLastRow();
    if (last < 2) return;
    sh.getRange(1, 1, last, Math.max(sh.getLastColumn(), HEADERS.기록.length)).createFilter();
  } catch (e) { /* 필터를 못 걸어도 나머지는 그대로 동작한다 */ }
}

/** 메뉴: 기록을 단어장 → 최신순으로 묶고, 단어장이 바뀔 때마다 줄 색을 바꾼다 */
function 단어장별정렬() {
  var sh = sheet_(SHEET.기록);
  var last = sh.getLastRow();
  if (last < 3) { ss_().toast('정리할 기록이 없습니다.', '해법 영단어', 5); return; }

  var f = sh.getFilter(); if (f) f.remove();
  var cols = Math.max(sh.getLastColumn(), HEADERS.기록.length);
  sh.getRange(2, 1, last - 1, cols)
    .sort([{ column: 4, ascending: true }, { column: 1, ascending: false }]);

  // 단어장에 지정한 색으로 옅게 칠해 눈으로 묶이게 한다
  var 색맵 = {};
  단어장목록().forEach(function (b) { if (b.색) 색맵[b.이름] = 연한색_(b.색); });

  var 이름들 = sh.getRange(2, 4, last - 1, 1).getValues();
  var 기본 = ['#FFFFFF', '#F1F6FD'];
  var 현재 = null, 토글 = 0, bg = [];
  이름들.forEach(function (r) {
    var n = String(r[0]);
    if (n !== 현재) { 현재 = n; 토글 = 1 - 토글; }
    var c색 = 색맵[n] || 기본[토글];
    var row = [];
    for (var c = 0; c < cols; c++) row.push(c색);
    bg.push(row);
  });
  var 범위 = sh.getRange(2, 1, bg.length, cols);
  범위.setBackgrounds(bg).setFontColors('#111827');
  범위.setBorder(false, false, false, false, false, false);   // 날짜 줄은 지운다
  sh.getRange(2, 1, bg.length, 1).setFontWeights('normal');

  기록필터_(sh);
  ss_().toast('단어장별로 묶었습니다. 날짜별로 되돌리려면 [기록 시트 보기 좋게 정리] 를 누르세요.',
    '해법 영단어', 6);
}

function 보관시트_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET.기록보관);
  if (!sh) {
    sh = ss.insertSheet(SHEET.기록보관, ss.getNumSheets());
    sh.getRange(1, 1, 1, HEADERS.기록보관.length).setValues([HEADERS.기록보관])
      .setFontWeight('bold').setBackground('#EFF3F9');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** 지정한 행 번호들을 보관함으로 옮긴다 (행번호는 기록 시트 기준) */
function 행보관_(행번호들) {
  if (!행번호들 || !행번호들.length) return 0;
  var sh = sheet_(SHEET.기록);
  var cols = Math.max(sh.getLastColumn(), HEADERS.기록.length);
  var 보관 = 보관시트_();
  var 값 = [], 메모 = [];
  행번호들.forEach(function (r) {
    var rng = sh.getRange(r, 1, 1, cols);
    값.push(rng.getValues()[0]);
    메모.push(rng.getNotes()[0]);
  });
  var start = 보관.getLastRow() + 1;
  보관.getRange(start, 1, 값.length, cols).setValues(값);
  보관.getRange(start, 1, 메모.length, cols).setNotes(메모);
  행번호들.slice().sort(function (a, b) { return b - a; })
    .forEach(function (r) { sh.deleteRow(r); });
  return 값.length;
}

/** 메뉴: 시트에서 고른 줄 보관 */
function 선택기록정리() {
  var ui = SpreadsheetApp.getUi();
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== SHEET.기록) {
    ui.alert('해법 영단어', '"기록" 시트에서 지울 줄을 고른 뒤 다시 눌러 주세요.', ui.ButtonSet.OK);
    return;
  }
  var 행들 = [];
  SpreadsheetApp.getActiveRangeList().getRanges().forEach(function (rg) {
    for (var r = rg.getRow(); r < rg.getRow() + rg.getNumRows(); r++) {
      if (r >= 2 && 행들.indexOf(r) < 0) 행들.push(r);
    }
  });
  if (!행들.length) { ui.alert('해법 영단어', '옮길 줄을 먼저 골라 주세요.', ui.ButtonSet.OK); return; }
  var res = ui.alert('해법 영단어', 행들.length + '개 줄을 보관함으로 옮길까요?\n(기록 시트에서는 사라지고 "기록보관" 시트에 남습니다)', ui.ButtonSet.OK_CANCEL);
  if (res !== ui.Button.OK) return;
  var n = 행보관_(행들);
  ss_().toast(n + '개를 보관함으로 옮겼습니다.', '해법 영단어', 5);
}

/** 메뉴: 오래된 기록 보관 */
function 오래된기록정리() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('해법 영단어', '며칠보다 오래된 기록을 보관함으로 옮길까요?\n숫자만 적어 주세요. (예: 30)', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var days = parseInt(r.getResponseText(), 10);
  if (!days || days < 1) { ui.alert('해법 영단어', '숫자를 적어 주세요.', ui.ButtonSet.OK); return; }
  var n = 오래된기록보관_(days);
  ui.alert('해법 영단어', n + '개를 보관함으로 옮겼습니다.', ui.ButtonSet.OK);
}

function 오래된기록보관_(days) {
  var 기준 = new Date(); 기준.setHours(0, 0, 0, 0);
  기준.setDate(기준.getDate() - days);
  var sh = sheet_(SHEET.기록);
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var vals = sh.getRange(2, 1, last - 1, 1).getValues();
  var 행들 = [];
  for (var i = 0; i < vals.length; i++) {
    var d = vals[i][0];
    if (d instanceof Date && d < 기준) 행들.push(i + 2);
  }
  return 행보관_(행들);
}

/** 메뉴: 보관함 완전 삭제 */
function 보관함비우기() {
  var ui = SpreadsheetApp.getUi();
  var sh = 보관시트_();
  var n = Math.max(0, sh.getLastRow() - 1);
  if (!n) { ui.alert('해법 영단어', '보관함이 비어 있습니다.', ui.ButtonSet.OK); return; }
  var res = ui.alert('해법 영단어',
    '보관함의 ' + n + '개 기록을 완전히 지웁니다.\n되돌릴 수 없습니다. 계속할까요?', ui.ButtonSet.OK_CANCEL);
  if (res !== ui.Button.OK) return;
  sh.deleteRows(2, n);
  ui.alert('해법 영단어', '보관함을 비웠습니다.', ui.ButtonSet.OK);
}

function 예시단어넣기() {
  if (단어장목록().length) return;          // 이미 단어장이 있으면 건드리지 않는다
  var 예시 = [
    ['acquire', '얻다, 습득하다'], ['acknowledge', '인정하다'], ['adapt', '적응하다'],
    ['alter', '변경하다'], ['analyze', '분석하다'], ['anticipate', '예상하다'],
    ['assess', '평가하다'], ['assume', '가정하다'], ['attribute', '~의 탓으로 돌리다'],
    ['compensate', '보상하다'], ['contribute', '기여하다'], ['demonstrate', '증명하다'],
    ['distinguish', '구별하다'], ['enhance', '향상시키다'], ['establish', '확립하다'],
    ['generate', '생성하다'], ['implement', '실행하다'], ['indicate', '나타내다'],
    ['modify', '수정하다'], ['perceive', '인식하다'], ['preserve', '보존하다'],
    ['restrict', '제한하다'], ['sustain', '유지하다'], ['transform', '변화시키다'],
    ['vulnerable', '취약한']
  ];
  단어시트만들기_('예시 단어장', '');
  단어쓰기_('예시 단어장', 예시.map(function (p, i) { return [i + 1, p[0], p[1]]; }));
}

/* --------------------------------------- 예전 [단어장] 한 장을 단어장별 시트로 나누기 */
function 단어장분리_() {
  var ss = ss_();
  var old = ss.getSheetByName('단어장');
  if (!old) return 0;
  var last = old.getLastRow();
  if (last < 2) return 0;

  var cols = Math.max(old.getLastColumn(), 5);
  var v = old.getRange(2, 1, last - 1, cols).getValues();
  var 묶음 = {}, 순서 = [];
  v.forEach(function (x) {
    var n = s_(x[0]), en = s_(x[2]), ko = s_(x[3]);
    if (!n || !en || !ko) return;
    if (!묶음[n]) { 묶음[n] = { 종류: '', 목록: [] }; 순서.push(n); }
    if (!묶음[n].종류 && s_(x[4])) 묶음[n].종류 = s_(x[4]);
    묶음[n].목록.push([Number(x[1]) || 묶음[n].목록.length + 1, en, ko]);
  });

  var 만든개수 = 0;
  순서.forEach(function (n) {
    if (단어장찾기_(n)) return;                    // 이미 옮긴 단어장은 건너뛴다
    단어시트만들기_(n, 묶음[n].종류);
    var 값 = 묶음[n].목록
      .sort(function (a, b) { return a[0] - b[0]; })
      .map(function (r, i) { return [i + 1, r[1], r[2]]; });
    단어쓰기_(n, 값);
    만든개수++;
  });

  if (만든개수) {
    try { old.setName('단어장(예전)'); old.hideSheet(); } catch (e) { }
  }
  return 만든개수;
}

/* --------------------------------------- 조회 시트 — 골라서 보는 한 장 */
function 조회만들기() {
  var ss = ss_();
  var sh = ss.getSheetByName('조회');
  if (!sh) sh = ss.insertSheet('조회', 0);
  sh.clear();
  sh.clearConditionalFormatRules();
  try { var f = sh.getFilter(); if (f) f.remove(); } catch (e) { }
  /* sh.clear() 는 내용과 서식만 지우고 데이터 확인(드롭다운) 규칙은 남긴다.
     규칙은 Z·AA·AB 열을 보는데 그 열이 방금 비워졌으니, 이대로 B1 에 「기록」 을 넣으면
     「데이터 확인 규칙을 위반했습니다」 로 멈춘다. 그래서 규칙부터 걷어 낸다. */
  try {
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  } catch (e) { }

  sh.getRange('A1:A3').setValues([['무엇을 볼까요'], ['단어장'], ['학생 이름']])
    .setFontWeight('bold').setBackground('#EFF3F9');
  sh.getRange('B1:B3').setValues([['기록'], ['전체'], ['전체']])
    .setFontWeight('bold').setBackground('#FFFDF3');
  sh.setColumnWidth(1, 110);
  sh.setColumnWidth(2, 220);
  sh.getRange('C1').setValue('← 노란 칸을 눌러 골라 보세요. 아래가 바로 바뀝니다.')
    .setFontColor('#8A8A8A');

  // 드롭다운에 쓸 목록 (오른쪽 끝에 숨겨 둔다)
  sh.getRange('Z1:Z3').setValues([['기록'], ['숙제'], ['점수']]);
  sh.getRange('AA1').setValue('전체');
  sh.getRange('AA2').setFormula('=IFERROR(SORT(UNIQUE(FILTER(단어장목록!A2:A, 단어장목록!A2:A<>""))),"")');
  sh.getRange('AB1').setValue('전체');
  sh.getRange('AB2').setFormula('=IFERROR(SORT(UNIQUE(FILTER(학생!B2:B, 학생!B2:B<>""))),"")');
  sh.hideColumns(26, 3);   /* Z · AA · AB — 드롭다운에 쓸 목록을 숨긴다 */

  function 목록검사(범위) {
    return SpreadsheetApp.newDataValidation()
      .requireValueInRange(범위, true).setAllowInvalid(false).build();
  }
  sh.getRange('B1').setDataValidation(목록검사(sh.getRange('Z1:Z3')));
  sh.getRange('B2').setDataValidation(목록검사(sh.getRange('AA1:AA200')));
  sh.getRange('B3').setDataValidation(목록검사(sh.getRange('AB1:AB200')));

  var 기록조건 = '"select * where Col1 is not null"'
    + '&IF($B$2="전체",""," and Col4 = \'"&$B$2&"\'")'
    + '&IF($B$3="전체",""," and Col3 = \'"&$B$3&"\'")'
    + '&" order by Col1 desc"';
  var 숙제조건 = '"select * where Col1 is not null"'
    + '&IF($B$2="전체",""," and Col2 = \'"&$B$2&"\'")';
  var 점수조건 = '"select * where Col1 is not null"'
    + '&IF($B$3="전체",""," and Col3 = \'"&$B$3&"\'")'
    + '&" order by Col1 desc"';

  var 수식 = '=IFERROR(IFS('
    + '$B$1="기록", QUERY({기록!A1:O}, ' + 기록조건 + ', 1),'
    + '$B$1="숙제", QUERY({숙제!A1:H}, ' + 숙제조건 + ', 1),'
    + '$B$1="점수", QUERY({점수!A1:E}, ' + 점수조건 + ', 1)'
    + '), "조건에 맞는 자료가 없습니다.")';
  sh.getRange('A6').setFormula(수식);

  sh.setFrozenRows(6);
  ss.setActiveSheet(sh);
  ss.toast('조회 시트를 만들었습니다. B1~B3을 골라 보세요.', '해법 영단어', 8);
}

/* ------------------------------------------------------------------ 유틸 */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('시트 "' + name + '"가 없습니다. 메뉴에서 [초기설정]을 먼저 실행해 주세요.');
  return sh;
}

function rows_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
}

/* 요청 하나가 사는 동안만 들고 있는 메모 — 숙제 목록 한 번에 기록 시트를 네 번, 학생 시트를 세 번 읽던 것을 한 번으로.
   읽는동안_ 안에서만 켜진다 (읽기만 하는 길). 쓰기가 끼는 곳에서는 메모가 꺼져 있으니 늘 새로 읽는다.
   doPost 가 시작할 때 비운다 — 요청끼리 섞이면 안 된다 */
var 읽은것_ = null;
function 읽기캐시_(이름) {
  if (!읽은것_) return rows_(이름);
  if (!Object.prototype.hasOwnProperty.call(읽은것_, 이름)) 읽은것_[이름] = rows_(이름);
  return 읽은것_[이름];
}
function 읽기캐시버리기_(이름) { if (읽은것_) delete 읽은것_[이름]; }
function 읽는동안_(f) {
  if (읽은것_) return f();
  읽은것_ = {};
  try { return f(); } finally { 읽은것_ = null; }
}

function setting_(key, def) {
  var r = rows_(SHEET.설정);
  for (var i = 0; i < r.length; i++) {
    if (String(r[i][0]).trim() === key) return String(r[i][1]).trim();
  }
  return def;
}

function s_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

/* ------------------------------------------------ 숙제 합격점 (기본 80점)
   이보다 낮게 맞으면 숙제를 낸 것으로 치지 않는다 — 다시 봐야 한다.
   설정 시트의 '숙제합격점' 칸으로 바꿀 수 있다. */
var 합격점캐시_ = null;
function 합격점_() {
  if (합격점캐시_ !== null) return 합격점캐시_;
  var n = Number(setting_('숙제합격점', 기본합격점));
  합격점캐시_ = (isFinite(n) && n >= 0 && n <= 100) ? n : 기본합격점;
  return 합격점캐시_;
}

/** 이 숙제 종류에 적용할 합격점. 시험은 한 번만 보므로 점수와 상관없이 인정한다. */
function 합격컷_(종류) { return 한번만_(종류) ? 0 : 합격점_(); }

/* 시험 시간은 설정(전역)이 아니라 숙제마다 — 숙제 시트의 「외우기분」·「제한시간」 칸.
   설정 시트의 '외우기시간분'·'시험시간분' 은 이제 읽지 않는다 (줄은 지우지 않고 둔다). */

/** 선생님 화면의 「설정」 칸이 읽어 가는 값들 */
function 설정가져오기(비번) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  return { ok: true, 합격점: 합격점_() };
}

/** 선생님 화면의 「설정」 칸이 저장하는 값들. 보낸 것만 바꾼다. */
function 설정저장(비번, 값) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  값 = 값 || {};
  function 숫자(v) { var n = Number(v); return isFinite(n) ? Math.round(n) : null; }

  if (값.합격점 !== undefined && 값.합격점 !== '') {
    var p = 숫자(값.합격점);
    if (p === null || p < 0 || p > 100) return { ok: false, 메시지: '합격점은 0에서 100 사이로 넣어 주세요.' };
    설정쓰기_('숙제합격점', p);
  }
  /* 외우기분·시험분은 더 받지 않는다 — 옛 화면이 보내도 그냥 넘긴다 */
  return 설정가져오기(비번);
}

function 합격점저장(비번, 점수) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var n = Math.round(Number(점수));
  if (!isFinite(n) || n < 0 || n > 100) return { ok: false, 메시지: '0에서 100 사이로 넣어 주세요.' };
  설정쓰기_('숙제합격점', n);
  return { ok: true, 합격점: n };
}

function 어제_() {
  var d = new Date(); d.setDate(d.getDate() - 1);
  return ymd_(d);
}

function ymd_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/* ------------------------------------------------------------------ 학생 API */

/** 첫 화면에 필요한 목록 */
function 시작정보() {
  /* 명단은 일부러 내려보내지 않는다 — 아이가 다른 아이 이름을 볼 일이 없게.
     시험 시간은 숙제마다 내려간다 (숙제가져오기의 외우기분·제한시간).
     거의 안 바뀌니 90초 담아 둔다 — 단어장·합격점이 바뀌면 창구(doPost)가 버린다 */
  var 담긴 = 캐시읽기_('시작정보');
  if (담긴 && 담긴.단어장목록) return 담긴;
  var r = {
    학원이름: setting_('학원이름', '해법 영단어'),
    합격점: 합격점_(),
    단어장목록: 단어장목록()
  };
  캐시담기_('시작정보', r, 기록캐시초_);
  return r;
}

/* ------------------------------------------------ 단어장 (단어장마다 시트 하나) */

/** 시트 이름으로 쓸 수 없는 글자를 걸러 낸다 */
function 시트이름만들기_(단어장) {
  var n = s_(단어장).replace(/[\\\/\?\*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) n = '단어장';
  n = '단어_' + n;
  if (n.length > 95) n = n.slice(0, 95);
  var ss = ss_(), 후보 = n, i = 2;
  while (ss.getSheetByName(후보)) { 후보 = n + ' (' + i + ')'; i++; }
  return 후보;
}

function 목록시트_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET.단어장목록);
  if (!sh) {
    sh = ss.insertSheet(SHEET.단어장목록, 2);
    sh.getRange(1, 1, 1, HEADERS.단어장목록.length).setValues([HEADERS.단어장목록])
      .setFontWeight('bold').setBackground('#EFF3F9');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 200); sh.setColumnWidth(2, 90);
    sh.setColumnWidth(3, 200); sh.setColumnWidth(4, 80);
    sh.setColumnWidth(5, 90);
  }
  목록칸확보_(sh);
  return sh;
}

/** 단어장목록 시트에 '레슨묶음' 칸이 없으면 만들어 준다 */
function 목록칸확보_(sh) {
  sh = sh || ss_().getSheetByName(SHEET.단어장목록);
  if (!sh) return null;
  var 필요 = HEADERS.단어장목록.length;
  if (sh.getMaxColumns() < 필요) sh.insertColumnsAfter(sh.getMaxColumns(), 필요 - sh.getMaxColumns());
  var 머리 = sh.getRange(1, 1, 1, 필요).getValues()[0];
  var 고칠까 = false;
  for (var i = 0; i < 필요; i++) {
    if (s_(머리[i]) !== HEADERS.단어장목록[i]) { 머리[i] = HEADERS.단어장목록[i]; 고칠까 = true; }
  }
  if (고칠까) {
    sh.getRange(1, 1, 1, 필요).setValues([머리]).setFontWeight('bold').setBackground('#EFF3F9');
    sh.setColumnWidth(5, 90);
  }
  return sh;
}

/** 레슨 묶음 크기 — 비어 있으면 기본 10 */
function 레슨크기_(v) {
  var n = Number(v) || 0;
  if (!n || n < 1) return 기본레슨;
  return Math.min(500, Math.round(n));
}

/** 단어장 목록 — [{이름, 개수, 종류, 시트}] */
function 단어장목록() {
  var r = rows_(SHEET.단어장목록);
  var out = [];
  r.forEach(function (x) {
    var 이름 = s_(x[0]);
    if (!이름) return;
    var 시트 = s_(x[2]);
    var sh = 시트 ? ss_().getSheetByName(시트) : null;
    var 개수 = sh ? Math.max(0, sh.getLastRow() - 1) : 0;
    var b = { 이름: 이름, 개수: 개수, 종류: s_(x[1]), 시트: 시트, 색: s_(x[3]),
      레슨: 레슨크기_(x.length > 4 ? x[4] : ''),
      과칸: x.length > 5 ? s_(x[5]) : '' };          // 손으로 적은 과 (비어 있으면 이름으로 뽑는다)
    b.과 = 과이름_(b);
    b.어디 = 과쪼개기_(이름, b.종류).어디;
    if (과장_(b.종류)) b.칸수 = 과칸수_(시트);
    out.push(b);
  });
  return out;
}

/** 단어장목록 시트에 「과」 칸이 없으면 넓혀 머리글을 붙인다 — 보태기만 하고 있는 머리글은 안 건드린다 */
function 단어장목록칸확보_(sh) {
  try { sh = sh || sheet_(SHEET.단어장목록); } catch (e) { return null; }
  /* 흉내 낸 시트(test65 등)에는 이런 함수가 없다 — 있을 때만 넓힌다 */
  if (!sh || typeof sh.getMaxColumns !== 'function' || typeof sh.getRange !== 'function') return sh;
  var 필요 = HEADERS.단어장목록.length;
  if (sh.getMaxColumns() < 필요 && typeof sh.insertColumnsAfter === 'function') {
    sh.insertColumnsAfter(sh.getMaxColumns(), 필요 - sh.getMaxColumns());
  }
  var 머리 = sh.getRange(1, 1, 1, 필요).getValues()[0];
  var 고칠까 = false;
  for (var i = 0; i < 필요; i++) {
    if (!s_(머리[i])) { 머리[i] = HEADERS.단어장목록[i]; 고칠까 = true; }
  }
  if (고칠까) sh.getRange(1, 1, 1, 필요).setValues([머리]);
  return sh;
}

/** 과 묶음 — [{과, 칸:{단어:[{이름,개수}], 본문:[…], 문법:[…]}}] (과 없는 단어장은 빠진다) */
function 과목록() {
  단어장목록칸확보_();
  return { ok: true, 과: 과묶음_(단어장목록()) };
}

function 단어장찾기_(단어장) {
  var 이름 = s_(단어장);
  var r = rows_(SHEET.단어장목록);
  for (var i = 0; i < r.length; i++) {
    if (s_(r[i][0]) === 이름) {
      return { 행: i + 2, 이름: 이름, 종류: s_(r[i][1]), 시트: s_(r[i][2]), 색: s_(r[i][3]),
        레슨: 레슨크기_(r[i].length > 4 ? r[i][4] : '') };
    }
  }
  return null;
}

function 단어시트_(단어장) {
  var b = 단어장찾기_(단어장);
  if (!b || !b.시트) return null;
  return ss_().getSheetByName(b.시트);
}

/** 새 단어장 시트를 만들고 목록에 등록한다 */
function 단어시트만들기_(단어장, 종류) {
  var 있음 = 단어장찾기_(단어장);
  if (있음 && ss_().getSheetByName(있음.시트)) return ss_().getSheetByName(있음.시트);

  var ss = ss_();
  var 시트이름 = 시트이름만들기_(단어장);
  var sh = ss.insertSheet(시트이름, ss.getNumSheets());
  var 문장 = 본문장_(종류), 문법 = 문법장_(종류);
  if (과장_(종류)) {
    /* 과 — 한 장에 단어·본문·문법이 같이 산다. 번호는 구분 안에서 1부터 */
    sh.getRange(1, 1, 1, 5).setValues([과머리_])
      .setFontWeight('bold').setBackground('#EFF3F9');
    sh.setColumnWidth(1, 55); sh.setColumnWidth(2, 60);
    sh.setColumnWidth(3, 420); sh.setColumnWidth(4, 420); sh.setColumnWidth(5, 220);
  } else {
    sh.getRange(1, 1, 1, 4)
      .setValues([문법 ? ['번호', '문제 문장', '해석', '힌트·해설']
                : 문장 ? ['번호', '영어 문장', '해석', '비고']
                       : ['번호', '영어', '뜻', '그림']])
      .setFontWeight('bold').setBackground('#EFF3F9');
    sh.setColumnWidth(1, 55);
    sh.setColumnWidth(2, 문장 ? 420 : 200);
    sh.setColumnWidth(3, 문장 ? 420 : 260);
    sh.setColumnWidth(4, 문장 ? 200 : 260);
  }
  sh.setFrozenRows(1);

  var 목록 = 목록시트_();
  var 색 = 다음색_();
  if (있음) {
    목록.getRange(있음.행, 1, 1, 5).setValues([[s_(단어장), s_(종류), 시트이름,
      있음.색 || 색, 있음.레슨 || 기본레슨]]);
  } else {
    목록.appendRow([s_(단어장), s_(종류), 시트이름, 색, 기본레슨]);
  }
  목록시트색칠_();
  return sh;
}

/** [번호, 영어, 뜻] 배열을 단어장 시트 맨 뒤에 붙인다 */
function 단어쓰기_(단어장, 값들) {
  if (!값들 || !값들.length) return;
  var sh = 단어시트_(단어장);
  if (!sh) sh = 단어시트만들기_(단어장, '');
  sh.getRange(sh.getLastRow() + 1, 1, 값들.length, 3).setValues(값들);
}

/* ------------------------------------------------ 단어장 색 */
var 색표 = [
  '#FF7A3D', '#3B82F6', '#16A34A', '#8B5CF6', '#EC4899',
  '#06B6D4', '#F59E0B', '#EF4444', '#84CC16', '#64748B'
];

/** 아직 안 쓴 색부터 차례로 준다 */
function 다음색_() {
  var 쓴색 = {};
  rows_(SHEET.단어장목록).forEach(function (x) { if (s_(x[3])) 쓴색[s_(x[3]).toUpperCase()] = 1; });
  for (var i = 0; i < 색표.length; i++) {
    if (!쓴색[색표[i].toUpperCase()]) return 색표[i];
  }
  return 색표[Math.floor(Math.random() * 색표.length)];
}

/** 흰색과 섞어 옅게 만든다 (시트 배경용) */
function 연한색_(hex, 정도) {
  var h = s_(hex).replace('#', '');
  if (h.length !== 6) return '#FFFFFF';
  정도 = (정도 === undefined) ? 0.86 : 정도;
  var out = '#';
  for (var i = 0; i < 3; i++) {
    var v = parseInt(h.substr(i * 2, 2), 16);
    var m = Math.round(v + (255 - v) * 정도);
    out += ('0' + m.toString(16)).slice(-2);
  }
  return out.toUpperCase();
}

/** 목록 시트의 색 칸을 그 색으로 칠해 눈에 보이게 한다 */
function 목록시트색칠_() {
  var sh = 목록시트_();
  var last = sh.getLastRow();
  if (last < 2) return;
  var v = sh.getRange(2, 4, last - 1, 1).getValues();
  var bg = v.map(function (r) { return [s_(r[0]) ? s_(r[0]) : '#FFFFFF']; });
  sh.getRange(2, 4, bg.length, 1).setBackgrounds(bg).setFontColor('#FFFFFF');
}

/** 선생님 화면에서 단어장 색 바꾸기 */
function 단어장색변경(비번, 단어장, 색) {
  if (!선생님확인_(비번)) return { ok: false };
  var b = 단어장찾기_(단어장);
  if (!b) return { ok: false, 메시지: '단어장을 찾을 수 없습니다.' };
  목록시트_().getRange(b.행, 4).setValue(s_(색));
  목록시트색칠_();
  return { ok: true, 단어장목록: 단어장목록() };
}

/** 선생님 화면에서 레슨 묶음(몇 단어씩) 바꾸기 */
function 레슨크기저장(비번, 단어장, 크기) {
  if (!선생님확인_(비번)) return { ok: false };
  var b = 단어장찾기_(단어장);
  if (!b) return { ok: false, 메시지: '단어장을 찾을 수 없습니다.' };
  var n = Number(크기) || 0;
  if (n < 1 || n > 500) return { ok: false, 메시지: '레슨은 1~500 사이로 정해 주세요.' };
  목록칸확보_().getRange(b.행, 5).setValue(Math.round(n));
  return { ok: true, 단어장목록: 단어장목록() };
}

function 색표가져오기() { return 색표; }

/**
 * 단어 가져오기 (학생 화면)
 * 칸·시작·끝은 안 줘도 된다 (화면은 통째로 받아 거른다). 주면 그 구분 안에서 번호로 자른다.
 */
function 단어가져오기(단어장, 칸, 시작, 끝) {
  var b = 단어장찾기_(단어장);
  if (!b) return [];
  var sh = ss_().getSheetByName(b.시트);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  if (과장_(b.종류)) return 범위단어_(과줄들_(sh, last), 칸, 시작, 끝);
  var 칸수 = Math.max(3, Math.min(4, sh.getLastColumn()));
  var v = sh.getRange(2, 1, last - 1, 칸수).getValues();
  var out = [];
  v.forEach(function (x) {
    var en = s_(x[1]), ko = s_(x[2]);
    if (!en || !ko) return;
    var w = { no: Number(x[0]) || out.length + 1, en: en, ko: ko, 종류: b.종류 };
    var 넷째 = (칸수 > 3) ? s_(x[3]) : '';
    /* 보통은 유치부에서 쓸 그림 주소, 본문 단어장은 비고(교과서 쪽수) */
    if (넷째) { if (본문장_(b.종류)) w.비고 = 넷째; else w.그림 = 넷째; }
    out.push(w);
  });
  out.sort(function (a, c) { return a.no - c.no; });
  out.forEach(function (w, i) { w.no = i + 1; });
  return 범위단어_(out, 칸, 시작, 끝);
}

/* ------------------------------------------------ 과 단어장 */
var 과머리_ = ['번호', '구분', '영어', '뜻·해석', '비고'];
var 과구분들_ = ['단어', '본문', '문법', '3단변화'];
function 과장_(종류) { return s_(종류) === '과'; }
/* 구분 칸 글 → 단어·본문·문법·3단변화 (비었거나 모르는 말이면 단어) */
function 구분정리_(v) { var t = s_(v); return 과구분들_.indexOf(t) > -1 ? t : '단어'; }
/* 비고는 구분마다 뜻이 다르다 — 단어는 그림 주소, 본문은 교과서 쪽, 문법은 힌트·해설 */
function 구분문장_(칸) { return 칸 === '본문' || 칸 === '문법'; }

/** 과 시트의 줄 → 단어들. 구분 차례(단어·본문·문법·3단변화)로, 구분 안에서 번호 차례로, 번호는 1부터 다시 */
function 과줄들_(sh, last) {
  var 칸수 = Math.max(4, Math.min(5, sh.getLastColumn()));
  var v = sh.getRange(2, 1, last - 1, 칸수).getValues();
  var out = [];
  v.forEach(function (x, i) {
    var en = s_(x[2]), ko = s_(x[3]);
    if (!en || !ko) return;
    var 칸 = 구분정리_(x[1]);
    var w = { no: Number(x[0]) || i + 1, en: en, ko: ko, 종류: '과', 칸: 칸 };
    var 다섯째 = 칸수 > 4 ? s_(x[4]) : '';
    if (다섯째) { if (구분문장_(칸)) w.비고 = 다섯째; else w.그림 = 다섯째; }
    out.push(w);
  });
  out.sort(function (a, c) {
    return 과구분들_.indexOf(a.칸) - 과구분들_.indexOf(c.칸) || a.no - c.no;
  });
  var 센 = {};
  out.forEach(function (w) { 센[w.칸] = (센[w.칸] || 0) + 1; w.no = 센[w.칸]; });
  return out;
}

/** 범위로 자를 때는 구분으로 먼저 거르고, 그 안에서 번호를 본다 (본문 1~12 = 본문의 1~12번) */
function 범위단어_(단어들, 칸, 시작, 끝) {
  var 것 = 단어들 || [];
  if (s_(칸)) 것 = 것.filter(function (w) { return (w.칸 || 어디로_(w.종류)) === s_(칸); });
  if (시작 === undefined || 시작 === null || 시작 === '') return 것;
  var a = Number(시작) || 1, b = Number(끝) || 것.length;
  return 것.filter(function (w, i) { return i + 1 >= a && i + 1 <= b; });
}

/** 과 시트의 구분별 개수 */
function 과칸수_(시트) {
  var sh = 시트 ? ss_().getSheetByName(시트) : null;
  var 수 = {};
  if (!sh || sh.getLastRow() < 2) return 수;
  sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().forEach(function (x) {
    var k = 구분정리_(x[0]);
    수[k] = (수[k] || 0) + 1;
  });
  return 수;
}

/** 과 단어장은 줄 칸이 달라서(구분이 둘째 칸) 한 줄씩 고치는 기능들이 엉뚱한 칸을 쓴다 — 막아 둔다 */
function 과면막기_(단어장) {
  var b = 단어장찾기_(단어장);
  if (b && 과장_(b.종류)) {
    return { ok: false, 메시지: '과 단어장은 「과 한꺼번에 넣기」 로 고칩니다 — 「과 꼴로 뽑기」 로 뽑아서 고친 뒤 덮어쓰기로 넣어 주세요.' };
  }
  return null;
}

/**
 * 과 한꺼번에 넣기 — 한 번 부르면 끝난다 (구분마다 부르면 앱스 스크립트가 느리다)
 * c = { 이름, 구분들:{ 단어:[{en,ko,비고}…], 본문:[…], 문법:[…] }, 덮어쓰기 }
 * 줄 읽기(가르기)는 화면이 한다 — 미리보기를 먼저 띄워야 하니까.
 */
function 과넣기(비번, c) {
  if (!선생님확인_(비번)) return { ok: false };
  c = c || {};
  var 이름 = s_(c.이름), 개수 = { 단어: 0, 본문: 0, 문법: 0 };
  function 답(결과, 까닭) {
    return { ok: 결과 !== '실패', 이름: 이름, 종류: '과', 개수: 개수, 결과: 결과, 까닭: 까닭 || '',
             단어장목록: 결과 === '실패' ? undefined : 단어장목록() };
  }
  if (!이름) return 답('실패', '단어장 이름이 없습니다. 맨 위에 「## 중2 5과」 처럼 적어 주세요.');
  var 줄 = [];
  과구분들_.forEach(function (k) {
    var n = 0;
    ((c.구분들 || {})[k] || []).forEach(function (r) {
      var en = s_(r && (r.en !== undefined ? r.en : r[0]));
      var ko = s_(r && (r.ko !== undefined ? r.ko : r[1]));
      var 비고 = s_(r && (r.비고 !== undefined ? r.비고 : r[2]));
      if (!en || !ko) return;
      n++;
      줄.push([n, k, en, ko, 비고]);                 // 번호는 구분 안에서 1부터
    });
    if (n) 개수[k] = n;
  });
  if (!줄.length) return 답('실패', '넣을 줄이 없습니다.');

  var 있음 = 단어장찾기_(이름);
  var sh = 있음 ? ss_().getSheetByName(있음.시트) : null;
  if (있음 && sh && !c.덮어쓰기) return 답('건너뜀', '같은 이름의 단어장이 이미 있어서 건너뛰었습니다.');
  /* 옛 단어장(보통·본문…)을 과로 덮지는 않는다 — 실수로 지우는 게 제일 무섭다 */
  if (있음 && sh && !과장_(있음.종류)) return 답('실패', '같은 이름의 「' + (있음.종류 || '보통') + '」 단어장이 있습니다. 이름을 바꿔 주세요.');
  if (!sh) sh = 단어시트만들기_(이름, '과');
  else if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(5, sh.getLastColumn())).clearContent();
  sh.getRange(2, 1, 줄.length, 5).setValues(줄);
  단어수맵_ = null;
  return 답(있음 ? '덮음' : '만듦');
}
/** 로그인: 이름 + 비밀번호 */
/**
 * '볼 수 있는 단어장' 칸을 목록으로 바꾼다.
 * 비어 있으면 null — 전부 볼 수 있다는 뜻.
 */
function 배정풀기_(v) {
  var t = s_(v);
  if (!t) return null;
  var 목록 = t.split(/\s*[,|]\s*/).map(s_).filter(String);
  return 목록.length ? 목록 : null;
}

/** 이 학생에게 보여 줄 단어장만 걸러 낸다 */
/** 학년구분은 셋뿐이다 — 유치 · 초중등 · 고등 */
function 학년구분_(v) {
  var t = s_(v);
  return (t === '고등' || t === '유치') ? t : '초중등';
}

function 내단어장_(배정) {
  var 전체 = 단어장목록();
  if (!배정) return 전체;
  return 전체.filter(function (b) { return 배정.indexOf(b.이름) > -1; });
}

function 로그인(이름, 비번) {
  var 찾는이름 = 이름맞추기_(이름);
  if (!찾는이름) return { ok: false, 메시지: '명단에 없는 이름이에요. 선생님께 말씀드리세요.' };
  var r = rows_(SHEET.학생);
  for (var i = 0; i < r.length; i++) {
    if (s_(r[i][1]) !== 찾는이름) continue;
    if (s_(r[i][2]) !== s_(비번)) return { ok: false, 메시지: '비밀번호가 달라요.' };
    /* 볼 수 있는 단어장은 학생 명단의 '교재' 칸을 따른다.
       비어 있으면 모든 단어장을 볼 수 있다. */
    var 교재 = 줄교재_(r[i]);
    return {
      ok: true,
      학생: {
        이름: 찾는이름,
        학년구분: s_(r[i][3]) || '초중등'
      },
      단어장목록: 내단어장_(교재.length ? 교재 : null)
    };
  }
  return { ok: false, 메시지: '명단에 없는 이름이에요. 선생님께 말씀드리세요.' };
}

/**
 * 아이가 적은 이름을 명단의 이름에 맞춰 준다.
 * 띄어쓰기나 앞뒤 빈칸이 달라도 찾아 준다. 못 찾으면 '' 를 준다.
 */
function 이름맞추기_(적은것) {
  var 온것 = s_(적은것);
  if (!온것) return '';
  var 다듬 = function (x) { return s_(x).replace(/\s+/g, ''); };
  var 찾을것 = 다듬(온것);
  if (!찾을것) return '';
  var r = rows_(SHEET.학생), 후보 = '';
  for (var i = 0; i < r.length; i++) {
    var 이름 = s_(r[i][1]);
    if (!이름) continue;
    if (이름 === 온것) return 이름;              // 그대로 맞으면 바로
    if (!후보 && 다듬(이름) === 찾을것) 후보 = 이름;
  }
  return 후보;
}

/* ------------------------------------------------------- 학생 명단 (선생님용) */

/** 학생 시트에 학년(6열)·학교(7열) 칸이 없으면 만들어 준다 */
function 명단칸확보_() {
  var sh = sheet_(SHEET.학생);
  if (sh.getMaxColumns() < 8) sh.insertColumnsAfter(sh.getMaxColumns(), 8 - sh.getMaxColumns());
  ['볼 수 있는 단어장', '학년', '학교', '교재'].forEach(function (이름, i) {
    var 칸 = sh.getRange(1, 5 + i);
    if (s_(칸.getValue()) === '') 칸.setValue(이름).setFontWeight('bold').setBackground('#EFF3F9');
  });
  return sh;
}

/**
 * 교재 칸을 목록으로 바꾼다. 한 학생이 여러 권을 배울 수 있다.
 * 시트에는 '중2 능률 | 수능 단어장' 처럼 세로줄(쉼표도 됨)로 적는다.
 */
function 교재풀기_(v) {
  if (Object.prototype.toString.call(v) === '[object Array]') {
    return v.map(s_).filter(String);
  }
  var t = s_(v);
  if (!t) return [];
  var 본것 = {}, out = [];
  t.split(/\s*[,|]\s*/).forEach(function (x) {
    var n = s_(x);
    if (n && !본것[n]) { 본것[n] = 1; out.push(n); }
  });
  return out;
}

/** 목록을 시트 한 칸에 적을 글로 */
function 교재글_(목록) { return 교재풀기_(목록).join(' | '); }

/** 한 줄에서 교재 목록 꺼내기 */
function 줄교재_(r) { return 교재풀기_(r.length > 7 ? r[7] : ''); }

/** 학생마다 지금 배우는 교재 { '홍길동': ['중2 능률', '수능 단어장'] } */
function 교재맵_() {
  var m = {};
  읽기캐시_(SHEET.학생).forEach(function (r) {
    var 이름 = s_(r[1]);
    if (!이름) return;
    m[이름] = 줄교재_(r);
  });
  return m;
}

function 명단가져오기(비번) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  명단칸확보_();
  var out = [];
  rows_(SHEET.학생).forEach(function (r, i) {
    /* 반은 이제 안 쓴다 (교재로 나눈다). 이름만 있으면 명단에 넣는다 —
       「명단 넣기」 로 들어온 학생은 반 칸이 비어 있다. */
    var 반 = s_(r[0]), 이름 = s_(r[1]);
    if (!이름) return;
    out.push({
      행: i + 2, 반: 반, 이름: 이름,
      비밀번호: s_(r[2]),
      학년구분: s_(r[3]) || '초중등',
      학년: r.length > 5 ? s_(r[5]) : '',
      학교: r.length > 6 ? s_(r[6]) : '',
      교재: 줄교재_(r),
      학부모주소: r.length > 8 && 토큰모양_(r[8]) ? 학부모주소_(s_(r[8])) : '',
      학부모마지막: r.length > 9 && r[9] instanceof Date ? Utilities.formatDate(r[9], Session.getScriptTimeZone(), 'M/d HH:mm') : '',
      한마디: r.length > 10 ? s_(r[10]) : ''
    });
  });
  return { ok: true, 학생: out };
}

/**
 * 교재를 여러 학생에게 한꺼번에 주기.
 *   방식 — '추가' (있던 것은 두고 더하기) · '빼기' · '덮어쓰기' (고른 것만 남기기)
 * 한 칸씩 읽고 쓰면 느리므로 교재 칸을 통째로 읽어 한 번에 되돌려 놓는다.
 */
function 교재일괄(비번, 행들, 교재들, 방식) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var 줄번호 = (행들 || []).map(Number).filter(function (n) { return n >= 2; });
  if (!줄번호.length) return { ok: false, 메시지: '학생을 골라 주세요.' };

  var 고른 = 교재풀기_(교재들);
  var 어떻게 = s_(방식) || '추가';
  if (어떻게 !== '빼기' && 어떻게 !== '덮어쓰기') 어떻게 = '추가';
  if (어떻게 !== '덮어쓰기' && !고른.length) return { ok: false, 메시지: '교재를 골라 주세요.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { ok: false, 메시지: '잠시 후 다시 시도해 주세요' }; }
  var 바뀐 = 0;
  try {
    var sh = 명단칸확보_();
    var 끝 = sh.getLastRow();
    if (끝 < 2) return { ok: false, 메시지: '학생이 없습니다.' };
    var 칸 = sh.getRange(2, 8, 끝 - 1, 1);
    var 값 = 칸.getValues();
    줄번호.forEach(function (n) {
      var i = n - 2;
      if (i < 0 || i >= 값.length) return;
      var 지금 = 교재풀기_(값[i][0]);
      var 새것;
      if (어떻게 === '덮어쓰기') {
        새것 = 고른.slice();
      } else if (어떻게 === '빼기') {
        새것 = 지금.filter(function (t) { return 고른.indexOf(t) < 0; });
      } else {
        새것 = 지금.slice();
        고른.forEach(function (t) { if (새것.indexOf(t) < 0) 새것.push(t); });
      }
      var 글 = 교재글_(새것);
      if (글 !== 교재글_(지금)) { 값[i][0] = 글; 바뀐++; }
    });
    if (바뀐) 칸.setValues(값);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, 인원: 바뀐, 방식: 어떻게, 교재: 고른, 학생: 명단가져오기(비번).학생 };
}

/**
 * 학생 한 명 고치기.
 * 이름이 바뀌면 이미 쌓인 기록·숙제·점수의 이름도 같이 바꿔 준다.
 */
function 학생수정(비번, 행, v) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var sh = 명단칸확보_();
  var n = Number(행);
  if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, 메시지: '이미 지워진 학생입니다.' };

  var 옛 = sh.getRange(n, 1, 1, 8).getValues()[0];
  var 옛이름 = s_(옛[1]);
  var 새이름 = s_(v.이름) || 옛이름;
  if (!새이름) return { ok: false, 메시지: '이름은 비울 수 없습니다.' };

  // 학원에 같은 이름이 이미 있으면 막는다 (이름으로 로그인하니 겹치면 안 된다)
  var 겹침 = false;
  rows_(SHEET.학생).forEach(function (r, i) {
    if (i + 2 === n) return;
    if (s_(r[1]) === 새이름) 겹침 = true;
  });
  if (겹침) return { ok: false, 메시지: '“' + 새이름 + '” 은 이미 있는 이름입니다. ' +
                                       '이름으로 로그인하니 겹치면 안 됩니다.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { ok: false, 메시지: '잠시 후 다시 시도해 주세요' }; }
  var 옮긴기록 = 0;
  try {
    sh.getRange(n, 1, 1, 8).setValues([[
      s_(옛[0]), 새이름,
      s_(v.비밀번호) || s_(옛[2]) || '1234',
      학년구분_(v.학년구분),
      s_(옛[4]),                       // 배정은 건드리지 않는다
      s_(v.학년), s_(v.학교),
      v.교재 === undefined ? s_(옛[7]) : 교재글_(v.교재)
    ]]);
    if (새이름 !== 옛이름) {
      옮긴기록 = 학생이름바꾸기_(옛이름, 새이름);
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: true, 옮긴기록: 옮긴기록, 학생: 명단가져오기(비번).학생 };
}

/** 이름이 바뀌면 이미 쌓인 자료의 이름도 따라 바꾼다 */
function 학생이름바꾸기_(옛이름, 새이름) {
  var 바뀜 = 0;
  // 기록 / 기록보관 : C열=이름
  [SHEET.기록, SHEET.기록보관].forEach(function (name) {
    var sh = ss_().getSheetByName(name);
    if (!sh) return;
    var last = sh.getLastRow();
    if (last < 2) return;
    var rng = sh.getRange(2, 3, last - 1, 1);
    var v = rng.getValues(); var 손댐 = false;
    for (var i = 0; i < v.length; i++) {
      if (s_(v[i][0]) === 옛이름) { v[i][0] = 새이름; 손댐 = true; 바뀜++; }
    }
    if (손댐) rng.setValues(v);
  });
  // 점수 : C열=이름
  var ps = ss_().getSheetByName(SHEET.점수);
  if (ps && ps.getLastRow() >= 2) {
    var pr = ps.getRange(2, 3, ps.getLastRow() - 1, 1);
    var pv = pr.getValues(); var p손댐 = false;
    for (var j = 0; j < pv.length; j++) {
      if (s_(pv[j][0]) === 옛이름) { pv[j][0] = 새이름; p손댐 = true; 바뀜++; }
    }
    if (p손댐) pr.setValues(pv);
  }
  // 숙제 : H열=학생 (쉼표로 여럿 적혀 있을 수 있다)
  var hs = ss_().getSheetByName(SHEET.숙제);
  if (hs && hs.getLastRow() >= 2) {
    var hr = hs.getRange(2, 8, hs.getLastRow() - 1, 1);
    var hv = hr.getValues(); var h손댐 = false;
    for (var k = 0; k < hv.length; k++) {
      var 목록 = 이름들풀기_(hv[k][0]);
      if (목록.indexOf(옛이름) < 0) continue;
      hv[k][0] = 목록.map(function (n) { return n === 옛이름 ? 새이름 : n; }).join(', ');
      h손댐 = true; 바뀜++;
    }
    if (h손댐) hr.setValues(hv);
  }
  // 게임 / 푸시 : C열=이름
  [SHEET.게임, SHEET.푸시].forEach(function (name) {
    var sh = ss_().getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    var rng = sh.getRange(2, 3, sh.getLastRow() - 1, 1);
    var v = rng.getValues(); var 손댐 = false;
    for (var i = 0; i < v.length; i++) {
      if (s_(v[i][0]) === 옛이름) { v[i][0] = 새이름; 손댐 = true; 바뀜++; }
    }
    if (손댐) rng.setValues(v);
  });
  return 바뀜;
}

/* ------------------------------------------------------------- 시상 집계 */

/** 'YYYY-MM' */
function 월_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM');
}
function 지난달_(ym) {
  var p = String(ym).split('-');
  var y = Number(p[0]), m = Number(p[1]) - 1;
  if (m < 1) { m = 12; y--; }
  return y + '-' + (m < 10 ? '0' + m : m);
}

/**
 * 이 날짜보다 앞선 기록은 시상 집계에서 통째로 뺀다.
 * 설정 시트의 '시상시작일' 값 (예: 2026-09-08). 비어 있으면 전부 센다.
 */
/** 설정 시트에 한 줄 써 넣기 (없으면 만든다) */
function 설정쓰기_(항목, 값) {
  합격점캐시_ = null;
  옛시험시간캐시_ = null;
  var sh = sheet_(SHEET.설정);
  var v = rows_(SHEET.설정);
  var 줄 = 0;
  for (var i = 0; i < v.length; i++) {
    if (s_(v[i][0]) === 항목) { 줄 = i + 2; break; }
  }
  if (!줄) { sh.appendRow([항목, 값]); 줄 = sh.getLastRow(); }
  else sh.getRange(줄, 2).setValue(값);
  sh.getRange(줄, 2).setNumberFormat('@');   // 글자로 붙들어 둔다
  return 줄;
}

/* ------------------------------------------------------------------
   시상 평균에 넣을 항목.
   '숙제,시험,보충,오답노트' 중에서 고른다. 비어 있으면 숙제만.
------------------------------------------------------------------- */
var 시상항목전체 = ['숙제', '시험', '보충', '오답노트'];

function 시상항목_() {
  var t = s_(setting_('시상항목', ''));
  if (!t) return ['숙제'];
  var 고른 = t.split(',').map(function (x) { return s_(x); })
              .filter(function (x) { return 시상항목전체.indexOf(x) > -1; });
  return 고른.length ? 고른 : ['숙제'];
}

function 시상항목저장(비번, 목록) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var 고른 = (목록 || []).map(function (x) { return s_(x); })
              .filter(function (x) { return 시상항목전체.indexOf(x) > -1; });
  if (!고른.length) return { ok: false, 메시지: '적어도 한 가지는 골라 주세요.' };
  설정쓰기_('시상항목', 고른.join(','));
  return { ok: true, 항목: 고른 };
}

/** 기록 한 줄이 어느 항목인가 */
function 기록항목_(구분, 숙제여부) {
  var g = s_(구분);
  if (g === 재시험표시) return '오답노트';
  if (g === 시험표시) return '시험';
  if (g === 보충표시) return '보충';
  return 숙제였나_(숙제여부) ? '숙제' : '연습';   // 혼자 연습은 어디에도 안 들어간다
}

/** 기록 시트에 '집계제외' 칸이 있는지 확인하고 없으면 만든다 */
function 기록칸확보_(name) {
  var sh = sheet_(name);
  if (sh.getMaxColumns() < 제외열) {
    sh.insertColumnsAfter(sh.getMaxColumns(), 제외열 - sh.getMaxColumns());
  }
  var 칸 = sh.getRange(1, 제외열);
  if (s_(칸.getValue()) === '') {
    칸.setValue('집계제외').setFontWeight('bold').setBackground('#EFF3F9');
    sh.setColumnWidth(제외열, 80);
  }
  return sh;
}

/** 고른 기록을 집계에서 빼거나 다시 넣는다 */
function 기록제외설정(비번, 키들, 뺄까) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var set = {};
  (키들 || []).forEach(function (k) { set[Number(k)] = 1; });
  if (!Object.keys(set).length) return { ok: false, 메시지: '고른 기록이 없습니다.' };

  var 값 = 뺄까 ? 'O' : '';
  var 바꾼수 = 0;
  [SHEET.기록, SHEET.기록보관].forEach(function (name) {
    var sh = 기록칸확보_(name);
    var last = sh.getLastRow();
    if (last < 2) return;
    var 날들 = sh.getRange(2, 1, last - 1, 1).getValues();
    var 지금 = sh.getRange(2, 제외열, last - 1, 1).getValues();
    var 바뀜 = false;
    for (var i = 0; i < 날들.length; i++) {
      var d = 날들[i][0];
      if (!(d instanceof Date) || !set[d.getTime()]) continue;
      if (s_(지금[i][0]) === 값) continue;
      지금[i][0] = 값; 바뀜 = true; 바꾼수++;
    }
    if (바뀜) sh.getRange(2, 제외열, last - 1, 1).setValues(지금);
  });
  return { ok: true, 개수: 바꾼수, 뺐나: !!뺄까 };
}

function 시상시작일_() {
  var v = setting_('시상시작일', '');
  if (v instanceof Date) return ymd_(v);
  var t = s_(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
}

/**
 * 기록 시트의 '숙제여부' 칸이 숙제라는 뜻인지.
 * 결과저장은 'O' 를 적지만, 예전 자료나 손으로 고친 값도 받아 준다.
 */
function 숙제였나_(v) {
  if (v === true || v === 1) return true;
  var t = s_(v).toUpperCase();
  if (!t) return false;
  if (t === 'X' || t === 'FALSE' || t === '아니오' || t === '0') return false;
  return true;   // 'O', 'TRUE', '예', '숙제' 등
}

/**
 * 기록 + 기록보관 을 합쳐 한 달치를 뽑는다.
 * 혼자 연습한 것과 손으로 뺀 기록은 아예 빼고, 나머지는 항목을 붙여 그대로 넘긴다.
 * 무엇을 평균에 넣을지는 달성적_ 가 정한다.
 */
function 그달기록_(ym) {
  var out = [];
  var 시작 = 시상시작일_();
  [SHEET.기록, SHEET.기록보관].forEach(function (name) {
    rows_(name).forEach(function (x) {
      if (!(x[0] instanceof Date)) return;
      if (월_(x[0]) !== ym) return;
      if (시작 && ymd_(x[0]) < 시작) return;
      var 항목 = 기록항목_(x[14], x[12]);
      if (항목 === '연습') return;                  // 혼자 연습한 것은 언제나 뺀다
      out.push({
        날: ymd_(x[0]), 반: s_(x[1]), 이름: s_(x[2]),
        단어장: s_(x[3]), 범위: s_(x[4]),
        항목: 항목,
        시험: 항목 === '시험',        // 시험은 평균을 따로 낸다
        뺌: s_(x[제외열 - 1]) === 'O',  // 선생님이 하나씩 뺀 기록 — 평균에서만 빠진다
        점수: Number(x[8]) || 0
      });
    });
  });
  return out;
}

/** 한 달 동안 학생별 성적을 낸다 */
function 달성적_(ym, 항목들) {
  var 기록 = 그달기록_(ym);
  var 넣을것 = {};
  (항목들 || 시상항목_()).forEach(function (k) { 넣을것[k] = 1; });
  var 맵 = {};
  기록.forEach(function (r) {
    /* 평균에 넣을 항목만 센다. 다만 숙제를 냈는지 세는 '낸것' 은
       고른 항목이나 하나씩 뺀 것과 상관없이 늘 담는다 (제출률은 안 바뀐다). */
    var 셀까 = !!넣을것[r.항목] && !r.뺌;
    var k = r.이름;
    if (!맵[k]) 맵[k] = {
      이름: r.이름,
      건수: 0, 합: 0, 만점: 0,          // 숙제로 본 시험
      시험건수: 0, 시험합: 0,            // 학원에서 본 시험
      낸것: {}
    };
    var m = 맵[k];
    if (r.항목 !== '오답노트') {
      var 키 = r.단어장 + '|' + r.범위;
      var 칸 = (m.낸것[키] = m.낸것[키] || {});        // 여러 날 푼 것도 다 담는다
      if (칸[r.날] === undefined || r.점수 > 칸[r.날]) 칸[r.날] = r.점수;   // 그날 최고점
    }
    /* 학원 시험 평균은 참고용이라 고른 항목과 상관없이 늘 따로 낸다 (뺀 것만 제외) */
    if (r.시험 && !r.뺌) { m.시험건수++; m.시험합 += r.점수; }
    if (!셀까) return;
    m.건수++; m.합 += r.점수;
    if (r.점수 >= 100) m.만점++;
  });
  Object.keys(맵).forEach(function (k) {
    var m = 맵[k];
    m.평균 = m.건수 ? Math.round(m.합 / m.건수) : 0;
    m.시험평균 = m.시험건수 ? Math.round(m.시험합 / m.시험건수) : null;
  });
  return 맵;
}

/**
 * 평균 — 아예 손도 안 댄 숙제는 0점으로 함께 센다.
 * 풀었는데 점수가 모자란 것은 그 점수가 이미 평균에 들어가 있으니 두 번 깎지 않는다.
 */
function 평균내기_(m, 안한수) {
  var 분모 = (m.건수 || 0) + (안한수 || 0);
  return 분모 ? Math.round((m.합 || 0) / 분모) : null;
}

/**
 * 그 달에 해야 했던 숙제.
 * 마감일이 그 달이면 그 달 것으로 본다 (지난달에 내줬어도 이번 달이 마감이면 이번 달).
 * 마감일이 없으면 낸 날짜로 본다.
 */
function 그달숙제_(ym) {
  var 시작일 = 시상시작일_();
  var 숙제 = [];
  rows_(SHEET.숙제).forEach(function (x) {
    var 등록 = (x[6] instanceof Date) ? x[6] : null;
    var 마감 = x[5] instanceof Date ? ymd_(x[5]) : s_(x[5]);
    var 기준달 = 마감 ? String(마감).slice(0, 7) : (등록 ? 월_(등록) : '');
    if (기준달 !== ym) return;
    // 집계 시작일보다 앞서 끝난 숙제는 세지 않는다
    if (시작일 && 마감 && 마감 < 시작일) return;
    // 보충 숙제와 시험은 제출률에서 뺀다 — 시험은 숙제가 아니다
    if (숙제종류_(x[8]) === '보충' || 숙제종류_(x[8]) === '시험') return;
    숙제.push({
      반: s_(x[0]), 단어장: s_(x[1]),
      범위: (Number(x[2]) || 1) + '~' + (Number(x[3]) || 0),
      시작: Number(x[2]) || 1, 끝: Number(x[3]) || 0,
      칸: s_(x.length > 11 ? x[11] : ''),      // 과 숙제의 구분 — 기록 범위가 「본문 1~12」 꼴이다
      학생: s_(x[7]),
      종류: 숙제종류_(x[8] || '기한'),
      등록: 등록 ? ymd_(등록) : '',
      마감: 마감
    });
  });
  return 숙제;
}

/**
 * 학생마다 { 숙제수, 낸수, 안한수 }.
 *   낸수   — 합격점을 넘겨 제출로 인정된 숙제
 *   안한수 — 아예 손도 안 댄 숙제 (평균에 0점으로 들어간다)
 */
function 제출현황_(숙제들, 전체, 성적맵, 교재맵, 반학생) {
  var out = {};
  전체.forEach(function (이름) {
    var 낸것 = (성적맵[이름] && 성적맵[이름].낸것) || {};
    var 내숙제 = 숙제들.filter(function (h) {
      return 내숙제인가_(h, 이름, 교재맵, 반학생);
    });
    var 낸수 = 0, 안한수 = 0;
    내숙제.forEach(function (h) {
      var 이름들 = h.칸 ? [h.칸 + ' ' + h.시작 + '~' + h.끝] : 범위이름들_(h.단어장, h.시작, h.끝);
      var 날들 = 이름들.reduce(function (찾음, 범) {
        return 찾음 || 낸것[h.단어장 + '|' + 범];
      }, null);
      var 판단날 = h.마감 || h.등록 || '';
      if (낸것_(날들, h.종류, h.등록, 판단날)) 낸수++;
      if (!푼것_(날들, h.종류, h.등록, 판단날, 0)) 안한수++;
    });
    out[이름] = { 숙제수: 내숙제.length, 낸수: 낸수, 안한수: 안한수 };
  });
  return out;
}

/**
 * 한 달 시상 집계.
 * 반마다 최우수상 · 성실상 · 발전상 · 만점왕 을 각각 한 명씩 뽑는다.
 */
function 시상집계(비번, 년월) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var ym = s_(년월) || 월_(new Date());
  var 전달 = 지난달_(ym);

  var 항목 = 시상항목_();
  var 이번 = 달성적_(ym, 항목);
  var 지난 = 달성적_(전달, 항목);

  var 전체 = 전체명단_();
  var 교재맵 = 교재맵_();
  var 반학생 = 반별명단_();
  var 시작일 = 시상시작일_();
  var 숙제 = 그달숙제_(ym);
  var 현황 = 제출현황_(숙제, 전체, 이번, 교재맵, 반학생);
  var 지난현황 = 제출현황_(그달숙제_(전달), 전체, 지난, 교재맵, 반학생);

  var 줄 = [];
  {
    전체.forEach(function (이름) {
      var k = 이름;
      var m = 이번[k] || { 건수: 0, 합: 0, 평균: 0, 만점: 0, 시험건수: 0, 시험평균: null, 낸것: {} };
      var p = 지난[k];
      var c = 현황[k] || { 숙제수: 0, 낸수: 0, 안한수: 0 };
      var pc = 지난현황[k] || { 숙제수: 0, 낸수: 0, 안한수: 0 };

      var 평균 = 평균내기_(m, c.안한수);
      var 지난평균 = p ? 평균내기_(p, pc.안한수) : null;

      줄.push({
        이름: 이름,
        숙제수: c.숙제수,
        낸수: c.낸수,
        못낸: c.안한수,                                // 아예 안 낸 숙제 — 평균에 0점으로 들어간다
        제출률: c.숙제수 ? Math.round(c.낸수 / c.숙제수 * 100) : null,
        건수: m.건수,
        평균: 평균,
        시험건수: m.시험건수 || 0,
        시험평균: m.시험건수 ? m.시험평균 : null,
        만점: m.만점,
        지난평균: 지난평균,
        향상: (지난평균 !== null && 평균 !== null) ? (평균 - 지난평균) : null
      });
    });
  }

  /* 학원 전체에서 상마다 한 명씩 */
  function 최고(값뽑기, 최소, 동점정리) {
    var 후보 = 줄.filter(function (r) {
      var v = 값뽑기(r);
      return v !== null && v !== undefined && v >= (최소 === undefined ? 0 : 최소);
    });
    if (!후보.length) return null;
    var 최대 = Math.max.apply(null, 후보.map(값뽑기));
    var 동점 = 후보.filter(function (r) { return 값뽑기(r) === 최대; });
    if (동점정리) 동점 = 동점정리(동점);
    return {
      값: 최대,
      주인공: 동점[0],
      동점: 동점.map(function (r) { return { 이름: r.이름 }; })
    };
  }

  var 상 = {
    최우수: 최고(function (r) { return r.평균; }, 1,
      function (동점) {   // 평균이 같으면 많이 푼 쪽
        동점.sort(function (a, b) { return b.건수 - a.건수; });
        return 동점.filter(function (r) { return r.건수 === 동점[0].건수; });
      }),
    성실: 최고(function (r) { return r.숙제수 > 0 ? r.제출률 : null; }, 1,
      function (동점) {   // 제출률이 같으면 낸 개수가 많은 쪽
        동점.sort(function (a, b) { return b.낸수 - a.낸수; });
        return 동점.filter(function (r) { return r.낸수 === 동점[0].낸수; });
      }),
    발전: 최고(function (r) { return r.향상; }, 1)
  };

  줄.sort(function (a, b) { return (b.평균 || 0) - (a.평균 || 0); });

  return {
    ok: true, 년월: ym, 지난달: 전달,
    상: 상, 줄: 줄, 숙제수: 숙제.length,
    시작일: 시작일,
    항목: 항목, 항목전체: 시상항목전체
  };
}


/* --------------------------------------------- 시상 결과 저장 (자동/수동) */

var 상이름표 = [
  { 키: '최우수', 이름: '최우수상' },
  { 키: '성실',   이름: '성실상' },
  { 키: '발전',   이름: '발전상' }
];

function 상기록글_(키, w) {
  var r = w.주인공;
  if (키 === '최우수') return w.값 + '점 (숙제 ' + r.건수 + '번)';
  if (키 === '성실')   return w.값 + '% (' + r.숙제수 + '개 중 ' + r.낸수 + '개)';
  return '+' + w.값 + '점 (' + r.지난평균 + ' → ' + r.평균 + ')';
}

/**
 * 한 달 시상 결과를 '시상' 시트에 남긴다.
 * 같은 달 기록이 이미 있으면 지우고 새로 쓴다.
 */
function 시상저장(년월) {
  var ym = s_(년월) || 월_(new Date());
  var r = 시상집계(setting_('선생님비밀번호', '1234'), ym);
  if (!r.ok) return { ok: false, 메시지: '집계하지 못했습니다.' };

  var ss = ss_();
  var sh = ss.getSheetByName(SHEET.시상);
  if (!sh) {
    sh = ss.insertSheet(SHEET.시상);
    sh.getRange(1, 1, 1, HEADERS.시상.length).setValues([HEADERS.시상])
      .setFontWeight('bold').setBackground('#EFF3F9');
    sh.setFrozenRows(1);
  }
  if (s_(sh.getRange(1, 1).getValue()) === '') {
    sh.getRange(1, 1, 1, HEADERS.시상.length).setValues([HEADERS.시상])
      .setFontWeight('bold').setBackground('#EFF3F9');
    sh.setFrozenRows(1);
  }

  // 같은 달 줄 지우기
  var last = sh.getLastRow();
  if (last >= 2) {
    var v = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = v.length - 1; i >= 0; i--) {
      if (s_(v[i][0]) === ym) sh.deleteRow(i + 2);
    }
  }

  var 지금 = new Date();
  var 줄 = [];
  상이름표.forEach(function (x) {
    var w = r.상 ? r.상[x.키] : null;
    if (!w) {
      줄.push([ym, x.이름, '', '', '받을 학생 없음', '', 지금]);
      return;
    }
    var 동점 = w.동점.length > 1
      ? w.동점.map(function (t) { return t.이름; }).join(', ')
      : '';
    줄.push([ym, x.이름, w.주인공.이름, '', 상기록글_(x.키, w), 동점, 지금]);
  });

  sh.getRange(sh.getLastRow() + 1, 1, 줄.length, HEADERS.시상.length).setValues(줄);
  sh.getRange(2, 7, sh.getLastRow() - 1, 1).setNumberFormat('yyyy-MM-dd HH:mm');
  sh.autoResizeColumns(1, HEADERS.시상.length);
  return { ok: true, 년월: ym, 개수: 줄.length };
}

/** 매월 1일에 자동으로 도는 함수 — 지난달을 집계해서 남긴다 */
function 매월시상() {
  var 지난 = 지난달_(월_(new Date()));
  return 시상저장(지난);
}

/** 집계 시작일 바꾸기 */
function 시상시작일저장(비번, 날짜) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var t = s_(날짜);
  if (t && !/^\d{4}-\d{2}-\d{2}$/.test(t)) return { ok: false, 메시지: '날짜 모양이 맞지 않습니다.' };

  설정쓰기_('시상시작일', t);
  return { ok: true, 시작일: t };
}

/** 선생님 화면에서 부르는 용 */
function 시상저장API(비번, 년월) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  return 시상저장(년월);
}

/** 저장해 둔 시상 결과 */
function 시상기록(비번) {
  if (!선생님확인_(비번)) return { ok: false };
  var out = [];
  rows_(SHEET.시상).forEach(function (x) {
    var ym = s_(x[0]); if (!ym) return;
    out.push({
      년월: ym, 상: s_(x[1]), 학생: s_(x[2]), 반: s_(x[3]),
      기록: s_(x[4]), 동점: s_(x[5]),
      때: (x[6] instanceof Date) ? ymd_(x[6]) : s_(x[6])
    });
  });
  return { ok: true, 목록: out };
}

/* --- 매월 1일 자동 집계 켜고 끄기 --- */

function 시상자동_있나_() {
  var 있다 = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === '매월시상') 있다 = true;
  });
  return 있다;
}

function 시상자동켜기() {
  var ui = SpreadsheetApp.getUi();
  if (시상자동_있나_()) {
    ui.alert('이미 켜져 있습니다.\n매월 1일 아침에 지난달 시상이 자동으로 집계됩니다.');
    return;
  }
  ScriptApp.newTrigger('매월시상').timeBased().onMonthDay(1).atHour(6).create();
  ui.alert('켰습니다.\n\n매월 1일 아침 6~7시에 지난달 결과를 집계해서\n<시상> 시트에 남깁니다.');
}

function 시상자동끄기() {
  var ui = SpreadsheetApp.getUi();
  var 지움 = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === '매월시상') { ScriptApp.deleteTrigger(t); 지움++; }
  });
  ui.alert(지움 ? '껐습니다. 이제 자동으로 집계하지 않습니다.' : '켜져 있지 않았습니다.');
}

/** 메뉴에서 지금 바로 지난달 집계 */
function 지난달시상집계() {
  var r = 매월시상();
  var ui = SpreadsheetApp.getUi();
  if (r.ok) {
    ss_().setActiveSheet(ss_().getSheetByName(SHEET.시상));
    ui.alert(r.년월 + ' 시상을 <시상> 시트에 남겼습니다.');
  } else {
    ui.alert(r.메시지 || '집계하지 못했습니다.');
  }
}

/** 골라 볼 수 있는 달 목록 (기록이 있는 달) */
function 시상달목록(비번) {
  if (!선생님확인_(비번)) return { ok: false };
  var 본것 = {}, 목록 = [];
  [SHEET.기록, SHEET.기록보관].forEach(function (name) {
    rows_(name).forEach(function (x) {
      if (!(x[0] instanceof Date)) return;
      var m = 월_(x[0]);
      if (!본것[m]) { 본것[m] = 1; 목록.push(m); }
    });
  });
  var 이번 = 월_(new Date());
  if (!본것[이번]) 목록.push(이번);
  목록.sort(); 목록.reverse();
  return { ok: true, 달: 목록 };
}

/* --------------------------------------------- 학생별 단어장 배정 (선생님용) */

/** 학생 명단 + 각자 볼 수 있는 단어장 */
/** 학생 시트에 '볼 수 있는 단어장' 칸(5열)이 없으면 만들어 준다 */
function 배정칸확보_() { return 명단칸확보_(); }

function 배정가져오기(비번) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  배정칸확보_();
  var 학생 = [];
  rows_(SHEET.학생).forEach(function (r, i) {
    var 반 = s_(r[0]), 이름 = s_(r[1]);
    if (!이름) return;
    var 배정 = 배정풀기_(r.length > 4 ? r[4] : '');
    학생.push({
      행: i + 2, 반: 반, 이름: 이름,
      학년구분: s_(r[3]) || '초중등',
      전부: !배정,
      단어장: 배정 || []
    });
  });
  return { ok: true, 학생: 학생, 단어장목록: 단어장목록() };
}

/**
 * 배정 저장.
 * 목록: [{행, 전부, 단어장:[이름...]}, ...]
 * 전부가 true면 칸을 비워 둔다 (= 전부 볼 수 있음).
 */
function 배정저장(비번, 목록) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var sh = 배정칸확보_();
  var last = sh.getLastRow();
  var 바뀜 = 0;

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { ok: false, 메시지: '잠시 후 다시 시도해 주세요' }; }
  try {
    (목록 || []).forEach(function (x) {
      var n = Number(x.행);
      if (!(n >= 2 && n <= last)) return;
      var 값 = x.전부 ? '' : (x.단어장 || []).map(s_).filter(String).join(', ');
      sh.getRange(n, 5).setValue(값);
      바뀜++;
    });
  } finally {
    lock.releaseLock();
  }
  return { ok: true, 개수: 바뀜 };
}

/** 단어장 이름이 바뀌거나 지워졌을 때 배정 칸도 따라 고친다 */
function 배정정리_(옛이름, 새이름) {
  var sh = 배정칸확보_();
  var last = sh.getLastRow();
  if (last < 2) return;
  var rng = sh.getRange(2, 5, last - 1, 1);
  var v = rng.getValues();
  var 바뀜 = false;
  for (var i = 0; i < v.length; i++) {
    var 목록 = 배정풀기_(v[i][0]);
    if (!목록) continue;
    var 새목록 = [];
    목록.forEach(function (n) {
      if (n !== 옛이름) { 새목록.push(n); return; }
      바뀜 = true;
      if (새이름) 새목록.push(새이름);
    });
    // 배정이 통째로 비면 '전부 보임'이 되어 버리니, 그럴 땐 없는 이름을 남겨 둔다
    v[i][0] = 새목록.length ? 새목록.join(', ') : (바뀜 ? '(없음)' : v[i][0]);
  }
  if (바뀜) rng.setValues(v);
}

/** 내 숙제 — 반 전체에게 낸 것 + 나에게만 낸 것.  끝냈는지도 함께 알려 준다 */
function 숙제가져오기(이름) {
  return 읽는동안_(function () { return 숙제가져오기_(이름); });
}
function 숙제가져오기_(이름, 부터) {
  var r = rows_(SHEET.숙제);
  /* 단계(연습·시험) 숙제가 있을 때만 응시 기록을 훑는다 — 옛 숙제만이면 지금 그대로 */
  var 단계있다 = r.some(function (x) { return 단계정리_(x.length > 13 ? x[13] : ''); });
  var 응시 = 단계있다 ? 응시표_(이름) : {}, 더준표 = 단계있다 ? 재응시추가표_() : {};
  var today = ymd_(new Date());
  var 색맵 = {};
  단어장목록().forEach(function (b) { 색맵[b.이름] = b.색; });
  var 교재맵 = 교재맵_();
  var 반학생 = 반별명단_();

  // 이 학생이 끝낸 숙제를 미리 모아 둔다 (단어장 + 범위 기준, 보관함 포함)
  var 끝낸것 = 완료점수들_(이름);

  var out = [];
  r.forEach(function (x) {
    var 줄 = { 반: s_(x[0]), 단어장: s_(x[1]), 학생: s_(x[7]) };
    if (!내숙제인가_(줄, 이름, 교재맵, 반학생)) return;
    var 대상 = s_(x[7]);
    var 마감 = x[5] instanceof Date ? ymd_(x[5]) : s_(x[5]);
    if (마감 && 마감 < (부터 === undefined ? today : 부터)) return;     // 아이 화면은 지난 숙제를 안 본다

    var 단어장 = s_(x[1]);
    var 시작 = Number(x[2]) || 1, 끝 = Number(x[3]) || 0;
    var 종류 = s_(x[8]) ? 숙제종류_(x[8]) : (마감 === today ? '당일' : '기한');
    var 등록 = x[6] instanceof Date ? ymd_(x[6]) : '';

    var 칸 = s_(x.length > 11 ? x[11] : '');
    var 날들 = 기록찾기_(끝낸것, '', 단어장, 시작, 끝, 칸);
    /* 당일·보충은 그 숙제의 날에 푼 것만, 기한 숙제는 낸 날 이후에 푼 것이면 끝낸 것.
       다만 합격점(기본 80점)을 넘겨야 제출로 인정한다. */
    var 판단날 = 마감 || today;
    var 기록 = 낸것_(날들, 종류, 등록, 판단날);
    var 완료 = !!기록;
    var 시도 = 완료 ? 기록 : 푼것_(날들, 종류, 등록, 판단날, 0);   // 풀긴 풀었는데 점수가 모자란 경우
    var 단계 = 단계정리_(x.length > 13 ? x[13] : ''), 단상 = null;
    if (단계) {
      var 낸때0 = x[6] instanceof Date ? x[6].getTime() : 0;
      단상 = 단계상태_(단계, x.length > 14 ? x[14] : '', x.length > 15 ? x[15] : '',
                       응시들_(응시, 이름, 단어장, 시작, 끝, 칸, 낸때0), 더준표[s_(이름) + '|' + 낸때0]);
      완료 = 단상.완료;
    }

    out.push({
      단어장: 단어장, 시작: 시작, 끝: 끝, 칸: 칸,
      제한시간: 숙제시간_(x, 종류).제한시간,     // 분 — 0 이면 제한 없음 (옛 숙제)
      외우기분: 숙제시간_(x, 종류).외우기분,     // 시험 탭에서 먼저 외우는 시간 — 0 이면 건너뛴다
      유형: s_(x[4]) || '스펠링',
      마감일: 마감,
      /* 이 숙제를 다른 숙제와 가려 주는 값. 지웠다 똑같이 다시 내면 이 값이 달라진다.
         유치부가 「어디까지 했나」 를 기기에 적어 둘 때 이것을 열쇠로 쓴다. */
      낸때: x[6] instanceof Date ? x[6].getTime() : 0,
      개별: !!대상,
      색: 색맵[단어장] || '',
      종류: 종류,
      완료: 완료,
      점수: 시도 ? 시도.점수 : null,
      모자람: (!완료 && !!시도),                    // 풀었지만 합격점을 못 넘겼다
      합격점: 합격컷_(종류),
      남은일수: 남은일수_(마감, today),
      등록일: 등록,
      수업: s_(x.length > 9 ? x[9] : ''),
      순서: Number(x.length > 10 ? x[10] : 0) || 0,
      단계: 단계,                                    // 연습 · 시험 (빈칸 = 옛 숙제)
      통과점수: 단상 && 단상.통과점수 !== undefined ? 단상.통과점수 : '',
      응시수: 단상 ? 단상.응시수 : 0,
      남은응시: 단상 && 단상.남은응시 !== undefined ? 단상.남은응시 : null,
      마지막점수: 단상 ? 단상.마지막점수 : null,
      마지막틀린: 단상 && 단상.마지막틀린 ? 단상.마지막틀린 : [],
      마지막틀린더: 단상 ? 단상.마지막틀린더 || 0 : 0,
      마지막자리: 단상 ? 단상.마지막자리 || null : null
    });
  });

  // 당일 숙제를 먼저, 그다음 마감이 가까운 순
  out.sort(function (a, b) {
    var 순 = { '당일': 0, '보충': 1, '기한': 2 };
    if (a.종류 !== b.종류) return (순[a.종류] || 9) - (순[b.종류] || 9);
    return (a.남은일수 === null ? 9999 : a.남은일수) - (b.남은일수 === null ? 9999 : b.남은일수);
  });
  return out;
}

/** 마감까지 며칠 남았는지 (오늘이면 0, 마감일이 없으면 null) */
function 남은일수_(마감, 오늘) {
  if (!마감) return null;
  var a = new Date(마감 + 'T00:00:00');
  var b = new Date(오늘 + 'T00:00:00');
  if (isNaN(a.getTime())) return null;
  return Math.round((a - b) / 86400000);
}

/** 시험 결과 저장 */
function 결과저장(p) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { ok: false, 메시지: '잠시 후 다시 시도해 주세요.' }; }
  try {
    /* 시험은 한 번만 볼 수 있다 — 같은 범위 시험 기록이 이미 있으면 받지 않는다 */
    if (s_(p.구분) === 시험표시 && 이미본시험_(s_(p.이름), s_(p.단어장), s_(p.범위))) {
      return { ok: false, 이미봄: true, 메시지: '이 시험은 이미 봤습니다. 시험은 한 번만 볼 수 있어요.' };
    }
    var sh = sheet_(SHEET.기록);
    if (!캐시읽기_('기록칸확보')) { try { 기록칸확보_(SHEET.기록); 캐시담기_('기록칸확보', 1, 21600); } catch (e) {} }
    var 전체오답 = s_(p.틀린단어);
    var 단어들 = 전체오답 ? 전체오답.split(',').map(function (x) { return x.trim(); }).filter(String) : [];
    var 요약 = 단어들.length > 오답요약개수
      ? 단어들.slice(0, 오답요약개수).join(', ') + '  …외 ' + (단어들.length - 오답요약개수) + '개'
      : 단어들.join(', ');

    sh.appendRow([
      new Date(),
      '', s_(p.이름), s_(p.단어장), s_(p.범위), s_(p.유형),
      Number(p.문항수) || 0, Number(p.정답수) || 0, Number(p.점수) || 0,
      Number(p.게임점수) || 0, Number(p.최고콤보) || 0, Number(p.소요초) || 0,
      p.숙제여부 ? 'O' : '',
      요약,
      s_(p.구분)
    ]);

    var row = sh.getLastRow();
    sh.getRange(row, 1, 1, HEADERS.기록.length)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
      .setVerticalAlignment('middle');
    sh.getRange(row, 1).setNumberFormat('yyyy-MM-dd HH:mm');
    if (단어들.length) {
      sh.getRange(row, 틀린단어열).setNote(
        '틀린 단어 ' + 단어들.length + '개\n\n' + 단어들.join('\n')
      );
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, 메시지: String(e) };
  } finally {
    lock.releaseLock();
  }
}

/** 이 학생이 이 범위 시험을 이미 봤는가 (보관함 포함) */
function 이미본시험_(이름, 단어장, 범위) {
  var 봤다 = false;
  [SHEET.기록, SHEET.기록보관].forEach(function (name) {
    if (봤다) return;
    rows_(name).forEach(function (x) {
      if (봤다) return;
      if (s_(x[14]) !== 시험표시) return;
      if (s_(x[2]) !== 이름) return;
      if (s_(x[3]) !== 단어장 || s_(x[4]) !== 범위) return;
      봤다 = true;
    });
  });
  return 봤다;
}

/** 내 기록 (최근 20개) */
function 내기록(이름) {
  var r = rows_(SHEET.기록);
  var out = [];
  for (var i = r.length - 1; i >= 0 && out.length < 20; i--) {
    if (s_(r[i][2]) !== s_(이름)) continue;
    out.push({
      시각: r[i][0] instanceof Date
        ? Utilities.formatDate(r[i][0], Session.getScriptTimeZone(), 'MM/dd HH:mm')
        : s_(r[i][0]),
      단어장: s_(r[i][3]), 범위: s_(r[i][4]), 유형: s_(r[i][5]),
      문항수: Number(r[i][6]) || 0, 정답수: Number(r[i][7]) || 0,
      점수: Number(r[i][8]) || 0, 게임점수: Number(r[i][9]) || 0
    });
  }
  return out;
}

/* ---------------------------------------------- 월간 순위 (선생님이 넣은 시험 점수) */

function 월키_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM'); }
function 월이름_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy년 M월'); }

function 점수시트_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET.점수);
  if (!sh) {
    sh = ss.insertSheet(SHEET.점수);
    sh.getRange(1, 1, 1, HEADERS.점수.length).setValues([HEADERS.점수])
      .setFontWeight('bold').setBackground('#EFF3F9');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 110); sh.setColumnWidth(2, 100);
    sh.setColumnWidth(3, 90); sh.setColumnWidth(4, 160); sh.setColumnWidth(5, 70);
  }
  return sh;
}

/**
 * 한 반의 이번 달 순위와 지난달 1~3등.
 * 점수는 선생님이 [점수] 시트에 직접 넣은 학원 시험 점수만 쓴다.
 * 앱에서 푼 것은 순위에 들어가지 않는다.
 */
function 월간순위(반) {
  var r = rows_(SHEET.점수);
  var 오늘 = new Date();
  var 지난날 = new Date(오늘.getFullYear(), 오늘.getMonth() - 1, 1);
  var 이번키 = 월키_(오늘), 지난키 = 월키_(지난날);
  var m1 = {}, m2 = {};

  r.forEach(function (x) {
    if (s_(x[1]) !== s_(반)) return;
    var d = x[0];
    if (!(d instanceof Date)) return;
    var 이름 = s_(x[2]);
    if (!이름) return;
    if (s_(x[4]) === '') return;
    var 점 = Number(x[4]);
    if (isNaN(점)) return;

    var k = 월키_(d);
    var t = (k === 이번키) ? m1 : (k === 지난키 ? m2 : null);
    if (!t) return;
    if (!t[이름]) t[이름] = { 이름: 이름, 합: 0, 수: 0 };
    t[이름].합 += 점;
    t[이름].수++;
  });

  function 정리(m) {
    return Object.keys(m).map(function (n) {
      var v = m[n];
      return { 이름: v.이름, 점수: Math.round(v.합 / v.수 * 10) / 10 };
    }).sort(function (a, b) { return b.점수 - a.점수; });
  }

  return {
    이번달: 월이름_(오늘),
    순위: 정리(m1),
    지난달: 월이름_(지난날),
    시상: 정리(m2).slice(0, 3)
  };
}

/** 메뉴: 점수 입력표 만들기 — 학원 전체 명단을 점수 시트에 깔아 준다 */
function 점수입력표() {
  var ui = SpreadsheetApp.getUi();

  var 학생들 = 전체명단_();
  if (!학생들.length) {
    ui.alert('해법 영단어', '학생 명단이 비어 있습니다.', ui.ButtonSet.OK);
    return;
  }

  var r2 = ui.prompt('해법 영단어', '시험 이름을 적어 주세요. (예: 3과 단어시험)', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var 시험 = r2.getResponseText().trim();

  var sh = 점수시트_();
  var 오늘 = new Date(); 오늘.setHours(0, 0, 0, 0);
  var 값 = 학생들.map(function (n) { return [오늘, '', n, 시험, '']; });
  var start = sh.getLastRow() + 1;
  sh.getRange(start, 1, 값.length, 5).setValues(값);
  sh.getRange(start, 1, 값.length, 1).setNumberFormat('yyyy-MM-dd');

  ss_().setActiveSheet(sh);
  sh.setActiveRange(sh.getRange(start, 5, 값.length, 1));
  ui.alert('해법 영단어',
    학생들.length + '명의 줄을 만들었습니다.\n맨 오른쪽 [점수] 칸에 숫자만 넣어 주세요.\n\n' +
    '시험을 안 본 학생은 점수 칸을 비워 두면 순위에서 빠집니다.', ui.ButtonSet.OK);
}

/* ------------------------------------------------------------------ 선생님 API */
function 선생님확인_(비번) {
  return s_(비번) === setting_('선생님비밀번호', '1234');
}

function 선생님로그인(비번) {
  return { ok: 선생님확인_(비번) };
}

/* ================================================================
   선생님 화면 — 둘로 나눠 부른다 (선생님요약 하나를 기다리면 기록을 다 훑을 때까지 빈 화면이다)
     선생님기본(비번)       숙제목록 · 학생목록 · 단어장목록 · 합격점 · 시상항목   ← 기록 분석 없음
     선생님기록(비번, 일수) 시험목록 · 학생별 · 미응시 · 오답 · 교재맵          ← 90초 담아 둔다
   선생님요약 은 옛 화면을 위해 그대로 둔다 (둘을 합쳐 부르는 꼴)
================================================================ */
var 기록캐시초_ = 90;
var 캐시한도_ = 100000;            // CacheService 한 칸에 담을 수 있는 크기 (100KB)
var 캐시조각최대_ = 20;            // 한 칸에 안 들어가면 조각으로 — 20조각(약 2MB)을 넘으면 안 담는다
var 기록덩이_ = 1000;              // 기록은 끝에서부터 이만큼씩 읽는다
var 기록최대_ = 5000;              // 아무리 많아도 이만큼만 (7일치가 이보다 많을 일은 없다)

function 캐시_() { try { return CacheService.getScriptCache(); } catch (e) { return null; } }
function 캐시읽기_(열쇠) {
  var c = 캐시_(); if (!c) return null;
  try {
    var 머리 = c.get(열쇠);
    if (!머리) return null;
    if (머리.charAt(0) !== '#') return JSON.parse(머리);
    /* 조각으로 나눠 담은 것 — 머리에 「#조각 수」. 한 조각이라도 없으면 없는 것으로 */
    var n = Number(머리.slice(1)), 열쇠들 = [];
    for (var i = 0; i < n; i++) 열쇠들.push(열쇠 + '#' + i);
    var 모음 = (typeof c.getAll === 'function') ? c.getAll(열쇠들) : null, 글 = '';
    for (var j = 0; j < n; j++) {
      var g = 모음 ? 모음[열쇠들[j]] : c.get(열쇠들[j]);
      if (g === null || g === undefined) return null;
      글 += g;
    }
    return JSON.parse(글);
  } catch (e) { return null; }
}
function 글크기_(글) {
  try { return Utilities.newBlob(글).getBytes().length; } catch (e) { return 글.length * 3; }   // 한글은 3바이트
}
function 캐시담기_(열쇠, 값, 초) {
  var c = 캐시_(); if (!c) return false;
  try {
    var 글 = JSON.stringify(값);
    if (글크기_(글) <= 캐시한도_) { c.put(열쇠, 글, 초); return true; }
    /* 7일치 기록은 한 칸(100KB)을 넘기 쉽다 — 3만 자씩(한글 3바이트라 90KB 안쪽) 조각으로 나눠 담는다 */
    var 조각들 = [], a = 0;
    while (a < 글.length) {
      var b = Math.min(글.length, a + 30000);
      var 끝글 = 글.charCodeAt(b - 1);
      if (b < 글.length && 끝글 >= 0xD800 && 끝글 <= 0xDBFF) b--;    // 그림 글자(두 칸짜리)를 반으로 가르지 않는다
      조각들.push(글.slice(a, b)); a = b;
    }
    if (조각들.length > 캐시조각최대_) return false;      // 너무 크면 담지 않는다 — 다음에 새로 읽으면 된다
    var 묶음 = {};
    조각들.forEach(function (g, i) { 묶음[열쇠 + '#' + i] = g; });
    if (typeof c.putAll === 'function') c.putAll(묶음, 초);
    else for (var k in 묶음) c.put(k, 묶음[k], 초);
    c.put(열쇠, '#' + 조각들.length, 초);                 // 머리는 맨 나중에 — 조각이 다 들어간 뒤에만 읽히게
    return true;
  } catch (e) { return false; }
}
function 기록캐시버리기_() {
  var c = 캐시_(); if (!c) return;
  var 열쇠들 = [];
  for (var d = 1; d <= 62; d++) 열쇠들.push('선생님기록|' + d);
  try { c.removeAll(열쇠들); } catch (e) {}
}
function 시작정보캐시버리기_() {
  var c = 캐시_(); if (!c) return;
  try { c.remove('시작정보'); } catch (e) {}
}
/* 무엇이 바뀌면 무엇을 버리나 — 안 버리면 숙제를 내고도 화면이 안 바뀌어 보인다 */
var 기록바꾸는기능_ = { 결과저장: 1, 숙제등록: 1, 숙제수정: 1, 숙제삭제: 1, 숙제여러개삭제: 1, 수업내주기: 1,
  수업삭제: 1, 지난숙제정리: 1, 기록정리: 1, 기록제외설정: 1, 오래된기록정리API: 1, 재응시더주기: 1,
  학생수정: 1, 학생붙여넣기: 1, 배정저장: 1, 교재일괄: 1, 단어장이름변경: 1, 단어장삭제: 1, 합격점저장: 1, 설정저장: 1 };
var 단어장바꾸는기능_ = { 과넣기: 1, 단어추가: 1, 단어수정: 1, 단어삭제: 1, 단어붙여넣기: 1, 그림올리기: 1, 그림여러개: 1,
  그림지우기: 1, 단어장이름변경: 1, 단어장색변경: 1, 단어장삭제: 1, 레슨크기저장: 1, 합격점저장: 1, 설정저장: 1 };
function 담은것버리기_(무엇) {
  if (기록바꾸는기능_[무엇]) 기록캐시버리기_();
  if (단어장바꾸는기능_[무엇]) 시작정보캐시버리기_();
}

/* 기록 시트를 끝에서부터 덩이로 읽는다 — 기록은 날짜순으로 쌓이니 7일치는 맨 끝에 있다.
   덩이의 첫 날짜가 기준보다 오래되면 멈춘다. 날짜가 비었거나 날짜가 아닌 줄(옛 기록)은 그냥 넘긴다.
   메뉴의 「기록을 단어장별로 묶기」 를 쓰면 날짜순이 깨진다 — 그걸 알아채면 예전처럼 통째로 읽는다
   (숫자가 달라지면 안 된다). 칸이 모자란 줄은 빈 값으로 채운다 — 읽는 길에서 시트를 고치지 않는다.
   돌려주는 것: [{줄: 시트 줄번호, x: 값들}] (위에서 아래 차례) */
function 최근기록줄_(sh, 기준) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var 넓이 = Math.max(1, sh.getLastColumn());
  var 채울 = Math.max(넓이, HEADERS.기록.length);
  function 채우기(x) { x = x.slice(); while (x.length < 채울) x.push(''); return x; }
  function 첫날(v) { for (var i = 0; i < v.length; i++) if (v[i][0] instanceof Date) return v[i][0]; return null; }
  function 끝날(v) { for (var i = v.length - 1; i >= 0; i--) if (v[i][0] instanceof Date) return v[i][0]; return null; }
  function 날짜순(v) {
    var 앞 = null;
    for (var i = 0; i < v.length; i++) {
      var d = v[i][0];
      if (!(d instanceof Date)) continue;
      if (앞 && d < 앞) return false;
      앞 = d;
    }
    return true;
  }
  var 덩이들 = [], 끝 = last, 읽은 = 0, 뒤첫날 = null;
  while (끝 >= 2 && 읽은 < 기록최대_) {
    var n = Math.min(기록덩이_, 끝 - 1, 기록최대_ - 읽은);
    var 시작 = 끝 - n + 1;
    var v = sh.getRange(시작, 1, n, 넓이).getValues();
    var 이끝 = 끝날(v);
    if (!날짜순(v) || (뒤첫날 && 이끝 && 이끝 > 뒤첫날)) {
      /* 날짜순이 깨졌다 — 끝에서 끊어 읽으면 최근 기록을 놓친다 */
      return sh.getRange(2, 1, last - 1, 넓이).getValues()
        .map(function (x, i) { return { 줄: i + 2, x: 채우기(x) }; });
    }
    덩이들.unshift({ 시작: 시작, 값: v });
    읽은 += n; 끝 = 시작 - 1;
    var 첫 = 첫날(v);
    if (첫) 뒤첫날 = 첫;
    if (첫 && 첫 < 기준) break;
  }
  var out = [];
  덩이들.forEach(function (d) {
    d.값.forEach(function (x, i) { out.push({ 줄: d.시작 + i, x: 채우기(x) }); });
  });
  return out;
}

/* 틀린 단어 칸 — 다섯 개 + 「…외 N개」. 꼬리를 떼고 몇 개 더 있는지 */
function 틀린칸나누기_(셀) {
  var t = s_(셀), m = t.match(/\s*…외\s*(\d+)개\s*$/);
  return { 앞: m ? t.slice(0, m.index) : t, 더: m ? Number(m[1]) : 0 };
}

/** 선생님 화면 — 가벼운 쪽 (숙제 탭에 필요한 것만) */
function 선생님기본(비번) {
  if (!선생님확인_(비번)) return { ok: false };
  return 읽는동안_(function () { return {
    ok: true,
    숙제목록: 전체숙제(),
    학생목록: 전체명단_(),
    단어장목록: 단어장목록(),       // 선생님은 담아 둔 것 말고 지금 것을 본다 (방금 붙여넣은 단어 수)
    시상항목: 시상항목_(),
    합격점: 합격점_()
  }; });
}

/** 선생님 화면 — 무거운 쪽 (기록 분석). 90초 담아 둔다 — 기록·숙제가 바뀌면 창구가 버린다 */
function 선생님기록(비번, 일수) {
  if (!선생님확인_(비번)) return { ok: false };
  var days = Number(일수) || 7, 열쇠 = '선생님기록|' + days;
  var 담긴 = 캐시읽기_(열쇠);
  if (담긴 && 담긴.ok) return 담긴;
  var r = 읽는동안_(function () { return 기록분석_(days, 전체숙제()); });
  캐시담기_(열쇠, r, 기록캐시초_);
  return r;
}

/** 대시보드 요약 — 예전 꼴 그대로 (옛 화면용). 이제는 기본 + 기록을 합쳐 부른다 */
function 선생님요약(비번, 일수) {
  if (!선생님확인_(비번)) return { ok: false };
  var 기본 = 선생님기본(비번);
  var 기록 = 읽는동안_(function () { return 기록분석_(Number(일수) || 7, 기본.숙제목록); });
  var 교재맵 = 기록.교재맵 || {};
  기록.시험목록.forEach(function (t) { t.교재 = 교재맵[t.이름] || []; });
  기록.학생별.forEach(function (v) { v.교재 = 교재맵[v.이름] || []; });
  return {
    ok: true,
    시험목록: 기록.시험목록,
    학생별: 기록.학생별,
    미응시: 기록.미응시,
    오답: 기록.오답,
    학생목록: 기본.학생목록,
    단어장목록: 기본.단어장목록,
    시상항목: 기본.시상항목,
    합격점: 기본.합격점,
    숙제목록: 기본.숙제목록
  };
}

/** 아이 — 「틀린 것 다시 연습」 에 쓸 그 시험의 틀린 단어 전문. 그 한 줄의 메모만 읽고, 제 기록만 준다 */
function 틀린전문(이름, 시트, 줄, 키) {
  var name = s_(시트) === SHEET.기록보관 ? SHEET.기록보관 : SHEET.기록;
  var sh = null;
  try { sh = sheet_(name); } catch (e) { return { ok: false }; }
  var last = sh.getLastRow(), n = Number(줄), k = Number(키) || 0;
  function 맞나(v) { return v instanceof Date && v.getTime() === k; }
  if (!(n >= 2 && n <= last && 맞나(sh.getRange(n, 1).getValue()))) {
    n = 0;
    if (k && last >= 2) {
      var 때들 = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 때들.length - 1; i >= 0; i--) if (맞나(때들[i][0])) { n = i + 2; break; }
    }
    if (!n) return { ok: false };
  }
  if (s_(sh.getRange(n, 3).getValue()) !== s_(이름)) return { ok: false };     // 남의 기록은 안 준다
  var 단어들 = 온오답_(sh.getRange(n, 틀린단어열).getValue(), sh.getRange(n, 틀린단어열).getNote());
  return { ok: true, 틀린: 단어들 };
}

/** 기록 한 줄의 틀린 단어 전문 — 요약에는 다섯 개만 가니, 줄을 눌렀을 때 이것으로 가져온다.
 *  줄번호로 찾고 키(기록 시각)로 맞춰 본다 — 그 사이 정리로 줄이 밀렸으면 시각으로 다시 찾는다 */
function 기록메모(비번, 줄, 키) {
  if (!선생님확인_(비번)) return { ok: false };
  var sh = sheet_(SHEET.기록), last = sh.getLastRow(), n = Number(줄), k = Number(키) || 0;
  function 맞나(v) { return !k || (v instanceof Date && v.getTime() === k); }
  if (!(n >= 2 && n <= last && 맞나(sh.getRange(n, 1).getValue()))) {
    n = 0;
    if (k && last >= 2) {
      var 때들 = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 때들.length - 1; i >= 0; i--) if (맞나(때들[i][0])) { n = i + 2; break; }
    }
    if (!n) return { ok: false, 메시지: '기록을 찾지 못했습니다 (정리했거나 지워진 기록)' };
  }
  var 셀 = s_(sh.getRange(n, 틀린단어열).getValue());
  var 메모 = s_(sh.getRange(n, 틀린단어열).getNote());
  var 단어들 = 온오답_(셀, 메모);
  return { ok: true, 줄: n, 키: k, 틀린: 단어들, 개수: 단어들.length };
}

/* 기록 분석 — 선생님기록 · 선생님요약 이 같이 쓴다. 숙제목록은 받는다 (두 번 훑지 않게) */
function 기록분석_(days, 숙제목록) {
  var 기준 = new Date(); 기준.setHours(0, 0, 0, 0); 기준.setDate(기준.getDate() - (days - 1));

  var sh = sheet_(SHEET.기록);
  var 줄들 = 최근기록줄_(sh, 기준);

  var 교재맵 = 교재맵_();
  var 시험목록 = [];
  var 긴줄 = [];                 // 틀린 단어가 다섯 개 넘는 기록 — 오답 순위에는 전문이 든다
  for (var i = 0; i < 줄들.length; i++) {
    var x = 줄들[i].x;
    if (!(x[0] instanceof Date) || x[0] < 기준) continue;
    var 칸 = 틀린칸나누기_(x[13]);
    시험목록.push({
      키: x[0].getTime(),
      줄: 줄들[i].줄,
      구분: s_(x[구분열 - 1]),
      제외: s_(x[제외열 - 1]) === 'O',
      재시험: s_(x[구분열 - 1]) === 재시험표시,
      시각: Utilities.formatDate(x[0], Session.getScriptTimeZone(), 'MM/dd HH:mm'),
      날짜: ymd_(x[0]),
      이름: s_(x[2]),
      단어장: s_(x[3]), 범위: s_(x[4]), 유형: s_(x[5]),
      문항수: Number(x[6]) || 0, 정답수: Number(x[7]) || 0, 점수: Number(x[8]) || 0,
      게임점수: Number(x[9]) || 0, 소요초: Number(x[11]) || 0,
      숙제: 숙제였나_(x[12]),
      틀린단어: 칸.앞,           // 앞 다섯 개까지만 — 전문은 기록메모 로
      틀린더: 칸.더
    });
    if (칸.더) 긴줄.push(시험목록[시험목록.length - 1]);
  }
  /* 오답 순위는 예전처럼 전문으로 센다 (숫자가 달라지면 안 된다). 메모는 기록 전체 × 16칸이 아니라
     다섯 개 넘는 기록이 있을 때만, 그 줄들이 걸친 N열 한 칸 너비만 한 번 읽는다 */
  var 전문 = {};
  if (긴줄.length) {
    var 처음 = 긴줄[0].줄, 마지막 = 긴줄[긴줄.length - 1].줄;
    var 메모들 = sh.getRange(처음, 틀린단어열, 마지막 - 처음 + 1, 1).getNotes();
    긴줄.forEach(function (t) {
      var 메모 = s_((메모들[t.줄 - 처음] || [])[0]);
      if (메모) 전문[t.키 + '|' + t.줄] = 메모.split('\n').slice(2).filter(String).join(', ');
    });
  }
  시험목록.reverse();

  /* 학생별 집계 — 숙제 평균에는 '숙제로 본 시험'만 넣는다.
     오답노트도, 보충도, 학원 시험도, 혼자 연습한 것도 빠진다.
     (구분 칸이 없던 옛 기록도 숙제 표시가 없으면 자동으로 빠진다) */
  var 본시험 = 시험목록.filter(function (t) {
    return t.숙제 && !t.제외 && t.구분 !== 보충표시 && t.구분 !== 시험표시;
  });

  function 빈줄_(t) {
    return {
      이름: t.이름, 횟수: 0, 점수합: 0,
      오답노트: 0, 보충: 0, 시험: 0, 시험합: 0, 최근: t.시각
    };
  }

  var 학생맵 = {};
  본시험.forEach(function (t) {
    var key = t.이름;
    if (!학생맵[key]) 학생맵[key] = 빈줄_(t);
    학생맵[key].횟수++;
    학생맵[key].점수합 += t.점수;
  });
  /* 오답노트·보충은 몇 번 했는지만, 학원 시험은 따로 평균까지 낸다.
     숙제를 한 번도 안 하고 시험이나 보충만 한 학생도 줄이 생기게 한다. */
  시험목록.forEach(function (t) {
    if (t.제외) return;
    var 시험 = t.구분 === 시험표시;
    if (!t.재시험 && t.구분 !== 보충표시 && !시험) return;
    var key = t.이름;
    if (!학생맵[key]) 학생맵[key] = 빈줄_(t);
    if (t.재시험) 학생맵[key].오답노트++;
    else if (시험) { 학생맵[key].시험++; 학생맵[key].시험합 += t.점수; }
    else 학생맵[key].보충++;
  });
  /* 마감이 지났는데 아예 손도 안 댄 숙제는 평균에 0점으로 들어간다.
     풀었는데 합격점을 못 넘긴 것은 그 점수가 이미 평균에 있으니 두 번 깎지 않는다. */
  숙제목록 = 숙제목록 || 전체숙제();
  var 창시작 = ymd_(기준), 오늘날 = ymd_(new Date());
  var 빵점 = {};
  숙제목록.forEach(function (h) {
    if (h.종류 === 보충표시) return;                    // 보충은 평균에서 뺀다
    if (시험인가_(h)) return;                            // 시험은 숙제가 아니다 — 안 본 시험을 숙제 0점으로 치지 않는다
    var 날 = h.마감일 || '';
    if (!날 || 날 < 창시작 || 날 >= 오늘날) return;      // 기간 밖이거나 아직 기회가 남은 숙제
    (h.안한사람 || []).forEach(function (n) {
      if ((h.모자란사람 || []).indexOf(n) > -1) return;
      빵점[n] = (빵점[n] || 0) + 1;
    });
  });

  var 학생별 = Object.keys(학생맵).map(function (k) {
    var v = 학생맵[k];
    v.못낸 = 빵점[k] || 0;                              // 0점으로 들어간 숙제 수
    var 분모 = v.횟수 + v.못낸;
    v.평균 = 분모 ? Math.round(v.점수합 / 분모) : null;
    v.시험평균 = v.시험 ? Math.round(v.시험합 / v.시험) : null;
    return v;
  });
  학생별.sort(function (a, b) {
    // 숙제를 한 번도 안 한 학생(평균 없음)은 맨 뒤로
    if (a.평균 === null || b.평균 === null) return (a.평균 === null ? 1 : 0) - (b.평균 === null ? 1 : 0);
    return a.평균 - b.평균;
  });

  // 아직 안 한 학생 — 숙제든 연습이든 뭐라도 한 번 했으면 뺀다
  var 한사람 = {};
  시험목록.forEach(function (t) { 한사람[t.이름] = 1; });
  var 미응시 = 읽기캐시_(SHEET.학생)
    .filter(function (x) { return s_(x[1]) && !한사람[s_(x[1])]; })
    .map(function (x) {
      return { 이름: s_(x[1]), 학년구분: s_(x[3]) || '초중등', 교재: 줄교재_(x) };
    });

  // 많이 틀린 단어 — 숙제로 본 시험만 (오답노트·연습 제외)
  var 오답맵 = {};
  본시험.forEach(function (t) {
    var 글 = 전문[t.키 + '|' + t.줄] !== undefined ? 전문[t.키 + '|' + t.줄] : t.틀린단어;
    s_(글).split(',').forEach(function (w) {
      w = w.trim();
      if (w) 오답맵[w] = (오답맵[w] || 0) + 1;
    });
  });
  var 오답 = Object.keys(오답맵).map(function (w) { return { 단어: w, 횟수: 오답맵[w] }; });
  오답.sort(function (a, b) { return b.횟수 - a.횟수; });

  /* 교재는 줄마다 싣지 않고 이름 → 교재 표를 한 번만 보낸다 (화면이 줄에 다시 붙인다) */
  return {
    ok: true,
    시험목록: 시험목록.slice(0, 200),
    학생별: 학생별,
    미응시: 미응시,
    오답: 오답.slice(0, 30),
    교재맵: 교재맵
  };
}

/**
 * 학원 전체 학생 이름 ['홍길동','김영희']
 */
function 전체명단_() {
  var 본것 = {}, out = [];
  읽기캐시_(SHEET.학생).forEach(function (x) {
    var 이름 = s_(x[1]);
    if (!이름 || 본것[이름]) return;
    본것[이름] = 1; out.push(이름);
  });
  return out;
}

/**
 * 이 숙제가 누구에게 가는가 — 한 곳에서만 정한다.
 *   1) 학생 칸에 이름이 적혀 있으면  → 그 학생들에게만
 *   2) 반 칸이 적혀 있으면           → 그 반 학생들 (반을 쓰던 시절의 옛 숙제)
 *   3) 둘 다 비어 있으면             → 그 단어장을 배정받은 학생 전원
 * 3번이 지금 쓰는 방식이다. 교재를 안 받은 사람에게는 가지 않는다.
 */
function 숙제대상_(h, 전체, 교재맵, 반학생) {
  var 고른 = 이름들풀기_(h && h.학생);
  if (고른.length) return 고른.filter(function (n) { return 전체.indexOf(n) > -1; });

  var 반 = s_(h && h.반);
  if (반) return ((반학생 || {})[반] || []).slice();

  var 책 = s_(h && h.단어장);
  if (!책) return 전체.slice();
  var 받은사람 = 전체.filter(function (n) {
    return ((교재맵 || {})[n] || []).indexOf(책) > -1;
  });
  return 받은사람;
}

/** '홍길동, 김영희' 처럼 적힌 것을 목록으로 */
function 이름들풀기_(v) {
  if (Object.prototype.toString.call(v) === '[object Array]') {
    return v.map(s_).filter(String);
  }
  var t = s_(v);
  if (!t) return [];
  var 본것 = {}, out = [];
  t.split(/\s*[,|]\s*/).forEach(function (x) {
    var n = s_(x);
    if (n && !본것[n]) { 본것[n] = 1; out.push(n); }
  });
  return out;
}

/** 이 숙제가 나에게 온 것인가 */
function 내숙제인가_(h, 이름, 교재맵, 반학생) {
  var 고른 = 이름들풀기_(h && h.학생);
  if (고른.length) return 고른.indexOf(s_(이름)) > -1;
  var 반 = s_(h && h.반);
  if (반) return ((반학생 || {})[반] || []).indexOf(s_(이름)) > -1;
  var 책 = s_(h && h.단어장);
  if (!책) return true;
  return ((교재맵 || {})[s_(이름)] || []).indexOf(책) > -1;
}

/** 옛 숙제(반이 적혀 있는 줄) 때문에 반별 명단도 아직 필요하다 */
function 반별명단_() {
  var 반학생 = {};
  읽기캐시_(SHEET.학생).forEach(function (x) {
    var 반 = s_(x[0]), 이름 = s_(x[1]);
    if (!반 || !이름) return;
    if (!반학생[반]) 반학생[반] = [];
    if (반학생[반].indexOf(이름) < 0) 반학생[반].push(이름);
  });
  return 반학생;
}

/**
 * 누가 무엇을 끝냈는지 한 번에 모은다.
 * 키: 이름|단어장|시작~끝  →  { 날: 'YYYY-MM-DD', 점수: n }
 * 오답 재시험은 완료로 치지 않는다.
 */
/**
 * 학생·단어장·범위마다 '푼 날짜를 전부' 모은다. 보관함도 함께 본다.
 *   { '이름|단어장|범위' : { '2026-09-15': 90, '2026-09-17': 100 } }
 * 한 사람 것만 필요하면 이름을 넘긴다 (그때는 열쇠에서 이름이 빠진다).
 *
 * 예전 완료맵_ 은 (1) 가장 최근 한 번만 들고 있어서 지난 날짜를 되짚을 수 없었고,
 * (2) 보관함을 안 봐서 정리한 기록이 '안 냈다'로 바뀌었다.
 */
function 완료점수들_(이름, 준줄들) {
  var m = {};
  var 한사람 = (이름 !== undefined && 이름 !== null);
  (준줄들 ? [null] : [SHEET.기록, SHEET.기록보관]).forEach(function (name) {
    var 줄들 = [];
    if (준줄들) 줄들 = 준줄들;
    else { try { 줄들 = 읽기캐시_(name); } catch (e) { return; } }      // 보관함이 아직 없어도 괜찮다
    줄들.forEach(function (x) {
      if (s_(x[14]) === 재시험표시) return;                 // 오답 재시험은 제출로 안 친다
      if (!(x[0] instanceof Date)) return;
      if (한사람 && s_(x[2]) !== s_(이름)) return;
      var key = (한사람 ? '' : s_(x[2]) + '|') + s_(x[3]) + '|' + s_(x[4]);
      var 날 = ymd_(x[0]);
      var 점 = Number(x[8]) || 0;
      var 칸 = (m[key] = m[key] || {});
      if (칸[날] === undefined || 점 > 칸[날]) 칸[날] = 점;
    });
  });
  return m;
}

/**
 * 이 숙제를 풀었는가. 풀었으면 { 날, 점수 }, 아니면 null.
 * 당일·보충은 '그 숙제의 날'에 푼 것만 친다 — 오늘이 아니라 마감날 기준이다.
 * (마감이 지난 당일 숙제가 늘 '안 냈음'으로 나오던 원인)
 * 컷을 주면 그 점수 이상으로 맞은 것만 센다.
 */
function 푼것_(날들, 종류, 등록, 판단날, 컷) {
  if (!날들) return null;
  컷 = Number(컷) || 0;
  if (당일치기_(종류)) {
    var 점 = 날들[판단날];
    return (점 === undefined || 점 < 컷) ? null : { 날: 판단날, 점수: 점 };
  }
  var 늦은 = '';                                   // 기한·시험은 낸 날 이후면 인정
  for (var d in 날들) {
    if (등록 && d < 등록) continue;
    if ((Number(날들[d]) || 0) < 컷) continue;
    if (!늦은 || d > 늦은) 늦은 = d;
  }
  return 늦은 ? { 날: 늦은, 점수: 날들[늦은] } : null;
}

/**
 * 이 숙제를 '냈는가' — 합격점을 넘겨야 낸 것으로 친다.
 * 80점 미만이면 푼 기록이 있어도 제출로 치지 않는다 (다시 봐야 한다).
 * 시험은 한 번만 보는 것이라 점수와 상관없이 인정한다.
 */
function 낸것_(날들, 종류, 등록, 판단날) {
  return 푼것_(날들, 종류, 등록, 판단날, 합격컷_(종류));
}

/* ==================================================================
   연속 기록 (🔥)
   숙제가 나간 날만 세고, 그날 나온 숙제를 다 내야 하루로 친다.
   숙제가 없던 날은 건너뛰므로 주말이나 안 오는 날에 끊기지 않는다.
================================================================== */

/** 언제부터 세기 시작할지 (설정 '연속시작일', 비어 있으면 처음부터) */
function 연속시작일_() {
  var v = setting_('연속시작일', '');
  if (v instanceof Date) return ymd_(v);
  var t = s_(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
}

function 연속시작일저장(비번, 날짜) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var t = s_(날짜);
  if (t && !/^\d{4}-\d{2}-\d{2}$/.test(t)) return { ok: false, 메시지: '날짜 모양이 맞지 않습니다.' };
  설정쓰기_('연속시작일', t);
  return { ok: true, 시작일: t };
}

/** 연속도 같은 장부를 쓴다 — 학생·단어장·범위마다 푼 날짜 전부 (보관함 포함) */
function 완료날들_() { return 완료점수들_(); }

/**
 * 그 숙제를 '그날 안에' 끝냈는가 — 연속 세기 전용.
 * 마감날까지 냈는지를 따진다 (낸것_ 은 늦게 낸 것도 제출로 친다).
 */
function 그날냈나_(날들, 종류, 등록, 날) {
  if (!날들) return false;
  var 컷 = 합격컷_(종류);
  if (당일치기_(종류)) {                           // 당일·보충은 바로 그날
    return 날들[날] !== undefined && (Number(날들[날]) || 0) >= 컷;
  }
  for (var d in 날들) {                            // 기한·시험은 낸 날부터 마감날까지
    if (등록 && d < 등록) continue;
    if ((Number(날들[d]) || 0) < 컷) continue;
    if (d <= 날) return true;
  }
  return false;
}

/** 기한 숙제를 언제 냈는지 (가장 이른 날). 안 냈으면 빈 글자 */
function 언제냈나_(날들, 등록, 끝, 컷) {
  if (!날들) return '';
  컷 = Number(컷) || 0;
  var 이른 = '';
  for (var d in 날들) {
    if (등록 && d < 등록) continue;
    if (끝 && d > 끝) continue;
    if ((Number(날들[d]) || 0) < 컷) continue;
    if (!이른 || d < 이른) 이른 = d;
  }
  return 이른;
}

/**
 * 학생마다 { 날 : {총, 낸} } 을 만든다.
 * 날은 그 숙제의 마감일 (당일·보충은 그날) 기준이다.
 */
function 숙제날표_() {
  var 시작 = 연속시작일_();
  var today = ymd_(new Date());
  var 전체 = 전체명단_();
  var 교재맵 = 교재맵_();
  var 반학생 = 반별명단_();
  var 완료 = 완료날들_();
  var 표 = {};

  rows_(SHEET.숙제).forEach(function (x) {
    var 단어장 = s_(x[1]);
    if (!단어장) return;
    var 범위 = (Number(x[2]) || 1) + '~' + (Number(x[3]) || 0);
    var 마감 = x[5] instanceof Date ? ymd_(x[5]) : s_(x[5]);
    var 등록 = x[6] instanceof Date ? ymd_(x[6]) : '';
    var 종류 = s_(x[8]) ? 숙제종류_(x[8]) : (마감 === today ? '당일' : '기한');
    if (종류 === '시험') return;                         // 연속 기록은 숙제로 센다 — 시험은 숙제가 아니다
    var 날 = 마감 || 등록;
    if (!날) return;

    var 대상들 = 숙제대상_({ 반: s_(x[0]), 단어장: 단어장, 학생: s_(x[7]) },
                          전체, 교재맵, 반학생);
    var 아직 = 날 > today;        // 마감이 아직 안 온 숙제

    대상들.forEach(function (이름) {
      var 날들 = 기록찾기_(완료, 이름 + '|', 단어장, Number(x[2]) || 1, Number(x[3]) || 0, x.length > 11 ? x[11] : '');
      var key = 이름;

      if (아직) {
        /* 마감이 멀어도 미리 낸 날에는 불이 붙는다.
           아직 안 냈으면 그날이 오지 않은 것이므로 아무 일도 없다. */
        if (당일치기_(종류)) return;
        var 낸날 = 언제냈나_(날들, 등록, today, 합격컷_(종류));
        if (!낸날) return;
        if (시작 && 낸날 < 시작) return;
        var 칸2 = (표[key] = 표[key] || {});
        var 하루2 = (칸2[낸날] = 칸2[낸날] || { 총: 0, 낸: 0 });
        하루2.총++; 하루2.낸++;
        return;
      }

      if (시작 && 날 < 시작) return;
      var 칸 = (표[key] = 표[key] || {});
      var 하루 = (칸[날] = 칸[날] || { 총: 0, 낸: 0 });
      하루.총++;
      if (그날냈나_(날들, 종류, 등록, 날)) 하루.낸++;
    });
  });
  return 표;
}

/** 날표 한 사람 몫에서 지금 연속 · 최고 연속을 뽑는다 */
function 연속세기_(칸) {
  var today = ymd_(new Date());
  var 날들 = Object.keys(칸 || {}).sort();          // 오래된 것부터
  var 최고 = 0, 이어짐 = 0;
  날들.forEach(function (d) {
    var v = 칸[d];
    if (v.낸 >= v.총) { 이어짐++; 최고 = Math.max(최고, 이어짐); }
    else if (d === today) { /* 오늘은 아직 진행 중이라 끊지 않는다 */ }
    else 이어짐 = 0;
  });

  // 지금 연속 — 최근 날부터 거꾸로
  var 지금 = 0, 오늘남음 = false;
  for (var i = 날들.length - 1; i >= 0; i--) {
    var d = 날들[i], v = 칸[d];
    if (v.낸 >= v.총) { 지금++; continue; }
    if (d === today) { 오늘남음 = true; continue; }   // 오늘 것은 아직 기회가 있다
    break;
  }
  return { 지금: 지금, 최고: Math.max(최고, 지금), 오늘남음: 오늘남음, 숙제날수: 날들.length };
}

/** 학생 화면에 줄 연속 정보 + 반·학원 전체 순위 */
function 연속가져오기(이름) {
  var 표 = 숙제날표_();
  var 나키 = s_(이름);

  var 모두 = [];
  전체명단_().forEach(function (n) {
    var v = 연속세기_(표[n]);
    모두.push({ 이름: n, 연속: v.지금, 최고: v.최고 });
  });

  function 줄세우기(목록) {
    목록 = 목록.slice().sort(function (a, b) {
      if (b.연속 !== a.연속) return b.연속 - a.연속;
      return a.이름 < b.이름 ? -1 : 1;
    });
    var 등수 = 0, 앞값 = null;
    return 목록.map(function (x, i) {
      if (x.연속 !== 앞값) { 등수 = i + 1; 앞값 = x.연속; }
      return { 이름: x.이름, 연속: x.연속, 등수: 등수, 나: (x.이름 === s_(이름)) };
    });
  }

  var 나 = 연속세기_(표[나키]);
  return {
    ok: true,
    연속: 나.지금, 최고: 나.최고, 오늘남음: 나.오늘남음,
    시작일: 연속시작일_(),
    전체순위: 줄세우기(모두)
  };
}

/* ==================================================================
   알림(웹 푸시) — 앱을 안 열어도 휴대폰에 뜨는 알림.
   구독(어느 휴대폰에 보낼지)은 '푸시' 시트에 쌓이고,
   실제로 쏘는 일은 선생님 화면(브라우저)이 한다.
================================================================== */
function 푸시시트_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET.푸시);
  if (!sh) {
    sh = ss.insertSheet(SHEET.푸시);
    sh.getRange(1, 1, 1, HEADERS.푸시.length).setValues([HEADERS.푸시])
      .setFontWeight('bold').setBackground('#EFF3F9');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 140); sh.setColumnWidth(2, 110); sh.setColumnWidth(3, 90);
    sh.setColumnWidth(4, 420); sh.setColumnWidth(7, 120);
  }
  return sh;
}

/** 학생 화면이 쓰는 열쇠 — 공개키는 숨길 것이 아니다 */
function 푸시공개키() { return s_(setting_('푸시공개키', '')); }

/** 선생님 화면이 알림을 쏠 때 쓰는 열쇠 (비밀번호가 맞아야 준다) */
function 푸시열쇠(비번) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  return { ok: true, 공개키: 푸시공개키(), 비밀키: s_(setting_('푸시비밀키', '')) };
}

/** 열쇠 한 쌍을 새로 넣는다 (선생님 화면에서 만들어 보낸다) */
function 푸시열쇠저장(비번, 공개키, 비밀키) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  if (!s_(공개키) || !s_(비밀키)) return { ok: false, 메시지: '열쇠가 비어 있습니다.' };
  설정쓰기_('푸시공개키', s_(공개키));
  설정쓰기_('푸시비밀키', s_(비밀키));
  푸시시트_();
  return { ok: true };
}

/** 이 휴대폰으로 알림을 보내 달라고 등록 (같은 주소면 덮어쓴다) */
function 구독등록(이름, 구독, 기기) {
  var 주소 = s_(구독 && 구독.주소);
  if (!주소) return { ok: false, 메시지: '주소가 없습니다.' };
  var sh = 푸시시트_();
  var 줄들 = [];
  try { 줄들 = rows_(SHEET.푸시); } catch (e) { 줄들 = []; }
  for (var i = 0; i < 줄들.length; i++) {
    if (s_(줄들[i][3]) === 주소) {
      sh.getRange(i + 2, 1, 1, 7).setValues([[
        new Date(), '', s_(이름), 주소,
        s_(구독.p256dh), s_(구독.auth), s_(기기)
      ]]);
      return { ok: true, 새것: false };
    }
  }
  sh.appendRow([new Date(), '', s_(이름), 주소, s_(구독.p256dh), s_(구독.auth), s_(기기)]);
  sh.getRange(sh.getLastRow(), 1).setNumberFormat('yyyy-MM-dd HH:mm');
  return { ok: true, 새것: true };
}

/** 알림 끄기 — 그 휴대폰 줄을 지운다 */
function 구독해제(주소) {
  var t = s_(주소);
  if (!t) return { ok: false };
  var sh = 푸시시트_();
  var 줄들 = [];
  try { 줄들 = rows_(SHEET.푸시); } catch (e) { return { ok: true, 개수: 0 }; }
  var 지움 = 0;
  for (var i = 줄들.length - 1; i >= 0; i--) {
    if (s_(줄들[i][3]) === t) { sh.deleteRow(i + 2); 지움++; }
  }
  return { ok: true, 개수: 지움 };
}

/** 선생님이 알림을 쏠 대상 목록 (이름들을 주면 그 학생들만) */
function 구독목록(비번, 이름들) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  푸시시트_();
  var 줄들 = [];
  try { 줄들 = rows_(SHEET.푸시); } catch (e) { 줄들 = []; }
  var 고른 = 이름들풀기_(이름들), 걸러 = {};
  고른.forEach(function (n) { 걸러[n] = 1; });
  var out = [];
  줄들.forEach(function (x, i) {
    var 주소 = s_(x[3]);
    if (!주소) return;
    if (고른.length && !걸러[s_(x[2])]) return;
    out.push({ 행: i + 2, 이름: s_(x[2]), 주소: 주소,
               p256dh: s_(x[4]), auth: s_(x[5]), 기기: s_(x[6]) });
  });
  return { ok: true, 구독: out };
}

/** 누가 알림을 켜 두었는지 — 선생님 화면에 보여 준다 */
function 구독현황(비번) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var 켠사람 = {};
  try {
    rows_(SHEET.푸시).forEach(function (x) {
      if (s_(x[3])) 켠사람[s_(x[2])] = 1;
    });
  } catch (e) {}
  var 다 = 전체명단_(), 켠수 = 0, 안켠 = [];
  다.forEach(function (이름) {
    if (켠사람[이름]) 켠수++;
    else 안켠.push({ 이름: 이름 });
  });
  return { ok: true, 전체: 다.length, 켬: 켠수, 안켠: 안켠,
           열쇠있나: !!푸시공개키() };
}

/**
 * 알림을 실제로 쏜다 — 서버(앱스 스크립트)가 보낸다.
 * 브라우저에서 알림 서버로 바로 보내면 CORS 로 막히기 때문에,
 * 표(JWT)만 브라우저가 만들어 주고 보내는 일은 여기서 한다.
 *   보낼것 = [{ 주소, 표, 공개키 }, ...]
 * 돌려주는 것 = { ok, 줄:[{주소, 상태, 글}] }
 */
function 푸시전송(비번, 보낼것) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var 목록 = 보낼것 || [];
  if (!목록.length) return { ok: true, 줄: [] };

  function 요청만들기(x) {
    return {
      url: s_(x.주소),
      method: 'post',
      payload: '',
      headers: {
        'TTL': '86400',
        'Authorization': 'vapid t=' + s_(x.표) + ', k=' + s_(x.공개키)
      },
      muteHttpExceptions: true
    };
  }
  var 요청 = 목록.map(요청만들기);

  var 줄 = [];
  try {
    var 답들 = UrlFetchApp.fetchAll(요청);
    답들.forEach(function (r, i) {
      var 글 = '';
      try { 글 = String(r.getContentText() || '').slice(0, 200); } catch (e) {}
      줄.push({ 주소: 목록[i].주소, 상태: r.getResponseCode(), 글: 글 });
    });
  } catch (e) {
    /* 한꺼번에 안 되면 하나씩 — 어느 줄이 문제인지 보이게 */
    목록.forEach(function (x, i) {
      try {
        var r = UrlFetchApp.fetch(요청[i].url, 요청[i]);
        줄.push({ 주소: x.주소, 상태: r.getResponseCode(),
                  글: String(r.getContentText() || '').slice(0, 200) });
      } catch (err) {
        줄.push({ 주소: x.주소, 상태: 0, 글: String((err && err.message) || err).slice(0, 200) });
      }
    });
  }
  return { ok: true, 줄: 줄 };
}

/**
 * 알림을 보낼 권한(바깥 주소로 나가기)을 받아 둔다.
 *
 * 스크립트 편집기에서 이 함수를 골라 [실행] 을 누르면
 * 구글이 "승인 필요" 창을 띄운다. 허용해 두지 않으면 알림이 안 나간다.
 *
 * ※ 일부러 try/catch 로 감싸지 않는다.
 *   오류를 여기서 잡아 버리면 구글이 허용 창을 못 띄운다.
 */
function 알림권한확인() {
  var r = UrlFetchApp.fetch('https://www.google.com/generate_204',
    { muteHttpExceptions: true });
  var 글 = '바깥으로 나갈 수 있습니다. (응답 ' + r.getResponseCode() + ')\n\n' +
           '이제 배포 → 배포 관리 → 수정 → 새 버전 을 한 뒤\n' +
           '선생님 화면에서 [알림 시험 보내기] 를 눌러 보세요.';
  Logger.log(글);
  try {
    SpreadsheetApp.getUi().alert('해법 영단어 · 알림 권한', 글,
      SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { /* 편집기에서 실행하면 화면이 없다 — 로그로 충분하다 */ }
  return 글;
}

/** 죽은 주소 지우기 — 보내다가 404/410 이 난 것들 */
function 구독지우기(비번, 주소들) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var 뺄것 = {};
  (주소들 || []).forEach(function (t) { if (s_(t)) 뺄것[s_(t)] = 1; });
  if (!Object.keys(뺄것).length) return { ok: true, 개수: 0 };
  var sh = 푸시시트_();
  var 줄들 = [];
  try { 줄들 = rows_(SHEET.푸시); } catch (e) { return { ok: true, 개수: 0 }; }
  var 지움 = 0;
  for (var i = 줄들.length - 1; i >= 0; i--) {
    if (뺄것[s_(줄들[i][3])]) { sh.deleteRow(i + 2); 지움++; }
  }
  return { ok: true, 개수: 지움 };
}

/* ==================================================================
   공지 — 선생님이 적어 올리면 학생 앱에 팝업으로 뜬다.
   끝나는날이 지나면 저절로 안 뜬다.
================================================================== */
function 공지시트_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET.공지);
  if (!sh) {
    sh = ss.insertSheet(SHEET.공지);
    sh.getRange(1, 1, 1, HEADERS.공지.length).setValues([HEADERS.공지])
      .setFontWeight('bold').setBackground('#EFF3F9');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 140); sh.setColumnWidth(2, 110);
    sh.setColumnWidth(3, 200); sh.setColumnWidth(4, 420);
    sh.setColumnWidth(5, 110); sh.setColumnWidth(6, 60);
  }
  return sh;
}

/** 공지 한 줄을 화면에 줄 모양으로 */
function 공지줄_(x, i) {
  var 때 = (x[0] instanceof Date) ? x[0] : null;
  return {
    행: i + 2,
    키: 때 ? String(때.getTime()) : ('r' + (i + 2)),
    반: s_(x[1]),
    제목: s_(x[2]),
    내용: s_(x[3]),
    끝나는날: x[4] instanceof Date ? ymd_(x[4]) : s_(x[4]),
    켬: s_(x[5]) !== 'X',
    만든날: 때 ? ymd_(때) : ''
  };
}

/** 학생 화면에 띄울 공지 — 아직 안 끝난 것만 */
function 공지가져오기() {
  var 오늘 = ymd_(new Date());
  var 줄들 = [];
  try { 줄들 = rows_(SHEET.공지); } catch (e) { return []; }   // 시트가 아직 없어도 괜찮다
  var out = [];
  줄들.forEach(function (x, i) {
    var n = 공지줄_(x, i);
    if (!n.켬) return;
    if (!n.제목 && !n.내용) return;
    if (n.끝나는날 && n.끝나는날 < 오늘) return;                // 지난 공지는 안 뜬다
    out.push({ 키: n.키, 제목: n.제목, 내용: n.내용, 만든날: n.만든날 });
  });
  out.reverse();                                                // 새것부터
  return out.slice(0, 5);
}

/** 선생님 화면 — 지난 것까지 전부 */
function 공지목록(비번) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  공지시트_();
  var 오늘 = ymd_(new Date());
  var 줄들 = [];
  try { 줄들 = rows_(SHEET.공지); } catch (e) { 줄들 = []; }
  var out = 줄들.map(공지줄_).filter(function (n) { return n.제목 || n.내용; });
  out.forEach(function (n) {
    n.지남 = !!(n.끝나는날 && n.끝나는날 < 오늘);
  });
  out.reverse();
  return { ok: true, 공지: out };
}

function 공지등록(비번, v) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var 제목 = s_(v && v.제목), 내용 = s_(v && v.내용);
  if (!제목 && !내용) return { ok: false, 메시지: '내용을 적어 주세요.' };
  var 끝 = s_(v && v.끝나는날);
  if (끝 && !/^\d{4}-\d{2}-\d{2}$/.test(끝)) return { ok: false, 메시지: '날짜 모양이 맞지 않습니다.' };
  var sh = 공지시트_();
  sh.appendRow([new Date(), '', 제목, 내용, 끝, '']);
  sh.getRange(sh.getLastRow(), 1).setNumberFormat('yyyy-MM-dd HH:mm');
  return { ok: true, 공지: 공지목록(비번).공지 };
}

function 공지끄기(비번, 행, 켤까) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var sh = 공지시트_();
  var n = Number(행);
  if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, 메시지: '이미 지워진 공지입니다.' };
  sh.getRange(n, 6).setValue(켤까 ? '' : 'X');
  return { ok: true, 공지: 공지목록(비번).공지 };
}

function 공지삭제(비번, 행) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var sh = 공지시트_();
  var n = Number(행);
  if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, 메시지: '이미 지워진 공지입니다.' };
  sh.deleteRow(n);
  return { ok: true, 공지: 공지목록(비번).공지 };
}

/* ==================================================================
   게임 — 성적과 완전히 따로 노는 놀이터.
   점수는 '게임' 시트에만 쌓이고 평균·시상에는 절대 안 들어간다.
================================================================== */
var 게임이름 = { 짝: '짝 맞추기', 퍼즐: '글자 퍼즐' };

/** 게임 시트 — 없으면 만들어 준다 (초기설정을 안 돌렸어도 점수가 사라지지 않게) */
function 게임시트_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET.게임);
  if (!sh) sh = ss.insertSheet(SHEET.게임);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.게임.length).setValues([HEADERS.게임])
      .setFontWeight('bold').setBackground('#EFF3F9');
    sh.setFrozenRows(1);
  }
  return sh;
}

function 게임저장(p) {
  var 종 = s_(p.게임);
  if (!게임이름[종]) return { ok: false, 메시지: '모르는 게임입니다.' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { ok: false, 메시지: '잠시 후 다시 해 주세요.' }; }
  try {
    var sh = 게임시트_();
    sh.appendRow([
      new Date(), '', s_(p.이름), 종,
      Number(p.점수) || 0, s_(p.기록), s_(p.단어장)
    ]);
    sh.getRange(sh.getLastRow(), 1).setNumberFormat('yyyy-MM-dd HH:mm');
    return { ok: true };
  } catch (e) {
    return { ok: false, 메시지: String(e) };
  } finally {
    lock.releaseLock();
  }
}

/** 게임별 최고 점수 순위 (한 사람당 제일 잘한 한 판만) */
function 게임순위(이름) {
  var 최고 = {};          // 게임|이름 -> {점수, 기록}
  var 오늘 = ymd_(new Date());
  var 오늘판 = 0;
  var 줄들 = [];
  /* 게임 시트가 아직 없어도 화면이 깨지지 않게 (초기설정 전) */
  try { 줄들 = rows_(SHEET.게임); } catch (e) { 줄들 = []; }
  줄들.forEach(function (x) {
    var 종 = s_(x[3]); if (!게임이름[종]) return;
    var n = s_(x[2]);
    if (!n) return;
    var 점 = Number(x[4]) || 0;
    var k = 종 + '|' + n;
    if (!최고[k] || 점 > 최고[k].점수) 최고[k] = { 게임: 종, 이름: n, 점수: 점, 기록: s_(x[5]) };
    var 날 = (x[0] instanceof Date) ? ymd_(x[0]) : s_(x[0]).slice(0, 10);
    if (n === s_(이름) && 날 === 오늘) 오늘판++;
  });

  function 줄세우기(종) {
    var 목록 = Object.keys(최고).map(function (k) { return 최고[k]; })
      .filter(function (v) { return v.게임 === 종; })
      .sort(function (a, b) {
        if (b.점수 !== a.점수) return b.점수 - a.점수;
        return a.이름 < b.이름 ? -1 : 1;
      });
    var 등수 = 0, 앞 = null;
    return 목록.slice(0, 20).map(function (x, i) {
      if (x.점수 !== 앞) { 등수 = i + 1; 앞 = x.점수; }
      return {
        이름: x.이름, 점수: x.점수, 기록: x.기록, 등수: 등수,
        나: (x.이름 === s_(이름))
      };
    });
  }

  var out = { ok: true, 오늘판: 오늘판, 게임: [] };
  Object.keys(게임이름).forEach(function (종) {
    var 내것 = 최고[종 + '|' + s_(이름)];
    out.게임.push({
      키: 종, 이름: 게임이름[종],
      내최고: 내것 ? 내것.점수 : 0,
      전체: 줄세우기(종)
    });
  });
  return out;
}

/* ------------------------------------------------------------------
   범위 짝 맞추기.
   학생 앱은 단어장에 있는 만큼만 풀 수 있어서, 숙제가 1~25 라도
   단어가 20개면 기록에는 1~20 으로 남는다. 그래서 숙제 한 건이
   가질 수 있는 범위 이름을 모두 만들어 두고 그중 하나라도 맞으면 낸 걸로 본다.
------------------------------------------------------------------- */
var 단어수맵_ = null;
function 단어수_(단어장) {
  if (!단어수맵_) {
    단어수맵_ = {};
    단어장목록().forEach(function (b) { 단어수맵_[b.이름] = b.개수; });
  }
  var n = 단어수맵_[s_(단어장)];
  return n > 0 ? n : 0;
}

function 범위이름들_(단어장, 시작, 끝) {
  시작 = Number(시작) || 1;
  끝 = Number(끝) || 0;
  var 목록 = [시작 + '~' + 끝];
  var n = 단어수_(단어장);
  if (n) {
    var a = Math.max(1, 시작), b = Math.min(n, 끝);
    if (a > b) { var t = a; a = b; b = t; }          // 학생 앱이 뒤집는 것까지 흉내
    var 자른 = a + '~' + b;
    if (목록.indexOf(자른) < 0) 목록.push(자른);
  }
  return 목록;
}

/* ================================================================
   수업 단계 — 연습 · 시험
   · 연습 : 한 번이라도 제출하면 끝 (점수는 안 본다)
   · 시험 : 통과점수를 넘겨야 끝. 합격은 「가장 마지막 응시」 로 본다 (평균 내지 않는다)
   · 몇 번째 응시인지는 그 숙제(낸 뒤)의 기록 개수로 센다 — 숙제 줄을 새로 만들지 않는다
   · 재응시를 다 쓰면 선생님이 「재응시」 시트에 더 준다
   · 단계 칸이 빈 옛 숙제는 지금 그대로 (합격점·당일/기한 판정)
================================================================ */
var 재응시기본 = 2;
var 재응시시트이름 = '재응시';
function 단계정리_(v) { var t = s_(v); return (t === '연습' || t === '시험') ? t : ''; }

/** 기록을 「이름|단어장|범위」 별 응시 목록으로 (때 차례). 이름을 주면 그 아이만 */
function 응시표_(이름) {
  var 표 = {};
  [SHEET.기록, SHEET.기록보관].forEach(function (name) {
    var r = [];
    try { r = 읽기캐시_(name); } catch (e) { return; }      // 보관함이 아직 없어도 괜찮다
    r.forEach(function (x, i) {
      if (!(x[0] instanceof Date)) return;
      if (s_(x[14]) === 재시험표시) return;                 // 오답 다시 풀기는 응시가 아니다
      if (이름 !== undefined && 이름 !== null && s_(x[2]) !== s_(이름)) return;
      var k = s_(x[2]) + '|' + s_(x[3]) + '|' + s_(x[4]);
      (표[k] = 표[k] || []).push({ 때: x[0].getTime(), 점수: Number(x[8]) || 0, 틀린: 틀린칸풀기_(x[13]),
                                  /* 더 — 전문이 필요하다: 다섯 개가 넘거나, 「be - was / were - been」 처럼 빗금 낀 낱말이 있으면
                                     (짧은 칸에서는 빗금에서 둘로 갈라져 다시 연습에서 빠진다) */
                                  더: 틀린칸나누기_(x[13]).더 || (/\s\/\s/.test(s_(x[13])) ? 1 : 0), 시트: name, 줄: i + 2 });
    });
  });
  Object.keys(표).forEach(function (k) { 표[k].sort(function (a, b) { return a.때 - b.때; }); });
  return 표;
}
/** 이 아이가 이 숙제를 본 응시들 — 숙제를 낸 뒤의 기록만 */
function 응시들_(표, 이름, 단어장, 시작, 끝, 칸, 낸때) {
  var 이름들 = s_(칸) ? [s_(칸) + ' ' + (Number(시작) || 1) + '~' + (Number(끝) || 0)] : 범위이름들_(단어장, 시작, 끝);
  var out = [];
  이름들.forEach(function (n) {
    (표[s_(이름) + '|' + s_(단어장) + '|' + n] || []).forEach(function (a) {
      if (!낸때 || a.때 >= 낸때) out.push(a);
    });
  });
  out.sort(function (a, b) { return a.때 - b.때; });
  return out;
}
/** 선생님이 더 준 재응시 — 「이름|낸때」 → 몇 번 */
function 재응시추가표_() {
  var 표 = {};
  var sh = null;
  try { sh = ss_().getSheetByName(재응시시트이름); } catch (e) { sh = null; }
  if (!sh || sh.getLastRow() < 2) return 표;
  sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (x) {
    var k = s_(x[1]) + '|' + (Number(x[3]) || 0);
    표[k] = (표[k] || 0) + (Number(x[4]) || 0);
  });
  return 표;
}
/** 단계 하나의 상태 — 완료 · 응시수 · 마지막 점수 · 마지막에 틀린 것 · 남은 응시 */
function 단계상태_(단계, 통과점수, 재응시, 응시, 더준) {
  var n = 응시.length, 마지막 = n ? 응시[n - 1] : null;
  if (단계 === '연습') return { 완료: n > 0, 응시수: n, 마지막점수: 마지막 ? 마지막.점수 : 0 };
  var 컷 = s_(통과점수) !== '' ? Number(통과점수) || 0 : 합격점_();
  var 다시 = s_(재응시) !== '' ? Number(재응시) || 0 : 재응시기본;
  var 허용 = 1 + 다시 + (Number(더준) || 0);
  return { 완료: !!(마지막 && 마지막.점수 >= 컷), 응시수: n, 마지막점수: 마지막 ? 마지막.점수 : 0,
           마지막틀린: 마지막 ? 마지막.틀린 : [], 통과점수: 컷, 남은응시: Math.max(0, 허용 - n),
           /* 틀린 게 다섯 개 넘으면 짧은 칸엔 다섯 개뿐 — 다시 연습이 그 한 줄 메모(틀린전문)를 가져간다 */
           마지막틀린더: 마지막 ? (마지막.더 || 0) : 0,
           마지막자리: 마지막 && 마지막.줄 ? { 시트: 마지막.시트, 줄: 마지막.줄, 키: 마지막.때 } : null };
}

/** 재응시를 다 쓴 아이에게 한 번(또는 몇 번) 더 — 선생님 「안 한 학생」 화면의 단추 */
function 재응시더주기(비번, 행, 이름, 몇) {
  if (!선생님확인_(비번)) return { ok: false };
  var sh = sheet_(SHEET.숙제);
  var n = Number(행);
  if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, 메시지: '이미 지워진 숙제입니다' };
  var x = sh.getRange(n, 1, 1, 3).getValues()[0];
  var 등록 = sh.getRange(n, 7).getValue();
  var 낸때 = 등록 instanceof Date ? 등록.getTime() : 0;
  var ss = ss_();
  var 재 = ss.getSheetByName(재응시시트이름);
  if (!재) {
    재 = ss.insertSheet(재응시시트이름);
    재.getRange(1, 1, 1, 5).setValues([['준 때', '이름', '단어장', '숙제 낸 때', '더 준 수']])
      .setFontWeight('bold').setBackground('#EFF3F9');
    재.setFrozenRows(1);
  }
  재.getRange(재.getLastRow() + 1, 1, 1, 5).setValues([[new Date(), s_(이름), s_(x[1]), 낸때, Number(몇) || 1]]);
  return { ok: true, 숙제목록: 전체숙제() };
}

/** 이 숙제에 해당하는 기록 찾기 (범위가 잘려 저장된 것도 찾는다)
 *  과 단어장 숙제는 기록 범위가 「본문 1~12」 처럼 구분이 붙어 있다 — 칸이 빈 옛 숙제는 지금처럼 */
function 기록찾기_(맵, 이름앞, 단어장, 시작, 끝, 칸) {
  var 이름들 = s_(칸) ? [s_(칸) + ' ' + (Number(시작) || 1) + '~' + (Number(끝) || 0)]
                     : 범위이름들_(단어장, 시작, 끝);
  for (var i = 0; i < 이름들.length; i++) {
    var v = 맵[이름앞 + 단어장 + '|' + 이름들[i]];
    if (v) return v;
  }
  return null;
}

/** 숙제 종류는 넷: 당일 · 기한 · 보충 · 시험 */
function 숙제종류_(v) {
  var t = s_(v);
  if (t === '보충') return '보충';
  if (t === '시험') return '시험';
  if (t === '기한') return '기한';
  return '당일';
}

/** 그날 안에 끝내야 하는 종류인가 (당일 · 보충) */
function 당일치기_(종류) {
  return 종류 === '당일' || 종류 === '보충';
}

/** 한 번 보면 끝나는 종류인가 (시험) */
function 한번만_(종류) {
  return 종류 === '시험';
}

/* 숙제 종류 「시험」 은 숙제가 아니라 학원에서 보는 시험이다 — 가르는 곳은 여기 한 군데 (index.html 에도 같은 꼴).
   숙제 수·제출률·안 낸 숙제에 시험을 넣지 않는다. 수업 안의 연습/시험 「단계」 와는 다른 것이다.
   종류가 빈 옛 숙제는 숙제 쪽이다 (숙제종류_ 가 당일·기한으로 읽는다) */
function 시험인가_(h) { return !!h && 숙제종류_(h.종류) === '시험'; }
function 숙제인가_(h) { return !시험인가_(h); }

var 교재맵전체_ = {};
function 전체숙제() {
  return 읽는동안_(function () {
    var r = rows_(SHEET.숙제);
    var 단계있다 = r.some(function (x) { return 단계정리_(x.length > 13 ? x[13] : ''); });
    var 맥 = 숙제맥락_({ 응시: 단계있다 ? 응시표_() : {}, 더준표: 단계있다 ? 재응시추가표_() : {}, 완료: 완료점수들_() });
    return r.map(function (x, i) { return 숙제줄_(x, i + 2, 맥); });
  });
}

/* 숙제 줄을 화면 꼴로 만들 때 쓰는 것 — 명단·교재·색은 여기서, 기록(완료·응시·더 준 재응시)은 받는다 */
function 숙제맥락_(기록) {
  교재맵전체_ = 교재맵_();
  var 색맵 = {};
  단어장목록().forEach(function (b) { 색맵[b.이름] = b.색; });
  return { today: ymd_(new Date()), 색맵: 색맵, 전체: 전체명단_(), 반학생: 반별명단_(),
           응시: 기록.응시 || {}, 더준표: 기록.더준표 || {}, 완료: 기록.완료 || {} };
}

/* 숙제 시트 한 줄 → 화면 꼴 (누가 냈나까지) */
function 숙제줄_(x, 행, 맥) {
  var today = 맥.today, 색맵 = 맥.색맵, 전체 = 맥.전체, 반학생 = 맥.반학생;
  var 응시 = 맥.응시, 더준표 = 맥.더준표, 완료 = 맥.완료;
  var 마감 = x[5] instanceof Date ? ymd_(x[5]) : s_(x[5]);
  var 반 = s_(x[0]), 단어장 = s_(x[1]);
  var 시작 = Number(x[2]) || 1, 끝 = Number(x[3]) || 0;
  var 대상학생 = s_(x[7]);
  var 종류 = s_(x[8]) ? 숙제종류_(x[8]) : (마감 === today ? '당일' : '기한');
  var 등록 = x[6] instanceof Date ? ymd_(x[6]) : '';
  var 범위 = 시작 + '~' + 끝;

  var 대상들 = 숙제대상_({ 반: 반, 단어장: 단어장, 학생: 대상학생 },
                        전체, 교재맵전체_, 반학생);
  var 교재들 = {};
  대상들.forEach(function (이름) {
    (교재맵전체_[이름] || []).forEach(function (t) { if (t) 교재들[t] = 1; });
  });
  var 판단날 = 마감 || 등록 || today;          // 당일 숙제는 '그 숙제의 날'로 따진다
  var 안한사람 = [], 한사람 = [], 모자란사람 = [], 막힌사람 = [], 점수들 = [];
  var 단계 = 단계정리_(x.length > 13 ? x[13] : '');
  var 낸때 = x[6] instanceof Date ? x[6].getTime() : 0;
  대상들.forEach(function (이름) {
    if (단계) {
      var 상 = 단계상태_(단계, x.length > 14 ? x[14] : '', x.length > 15 ? x[15] : '',
                         응시들_(응시, 이름, 단어장, 시작, 끝, x.length > 11 ? x[11] : '', 낸때), 더준표[이름 + '|' + 낸때]);
      if (상.완료) { 한사람.push(이름); return; }
      안한사람.push(이름);
      if (상.응시수) 모자란사람.push(이름);
      if (단계 === '시험' && 상.응시수 && !상.남은응시) 막힌사람.push(이름);   // 재응시를 다 썼다
      return;
    }
    var 날들 = 기록찾기_(완료, 이름 + '|', 단어장, 시작, 끝, x.length > 11 ? x[11] : '');
    if (한번만_(종류)) {                                 // 시험 — 본 아이의 점수로 평균을 낸다
      var 본것 = 푼것_(날들, 종류, 등록, 판단날, 0);
      if (본것) 점수들.push(Number(본것.점수) || 0);
    }
    if (낸것_(날들, 종류, 등록, 판단날)) { 한사람.push(이름); return; }
    안한사람.push(이름);
    /* 풀긴 풀었는데 합격점을 못 넘긴 학생 — 아예 손도 안 댄 학생과 나눠 본다 */
    if (푼것_(날들, 종류, 등록, 판단날, 0)) 모자란사람.push(이름);
  });

  var 줄 = {
    행: 행,
    단어장: 단어장,
    시작: 시작, 끝: 끝,
    유형: s_(x[4]) || '스펠링', 마감일: 마감,
    학생: 대상학생,
    색: (색맵[단어장] || ''),
    종류: 종류,
    지남: !!(마감 && 마감 < today),
    대상수: 대상들.length,
    교재들: Object.keys(교재들),
    한사람: 한사람,
    안한사람: 안한사람,
    모자란사람: 모자란사람,
    합격점: 합격컷_(종류),
    수업: s_(x.length > 9 ? x[9] : ''),
    순서: Number(x.length > 10 ? x[10] : 0) || 0,
    칸: s_(x.length > 11 ? x[11] : ''),
    제한시간: 숙제시간_(x, 종류).제한시간,
    외우기분: 숙제시간_(x, 종류).외우기분,
    낸때: x[6] instanceof Date ? x[6].getTime() : 0,    // 줄번호가 밀렸는지 숙제수정이 맞춰 본다
    단계: 단계,
    통과점수: s_(x.length > 14 ? x[14] : ''),
    재응시: s_(x.length > 15 ? x[15] : ''),
    막힌사람: 막힌사람,
    등록일: 등록
  };
  /* 평균은 시험 줄에만 — 숙제는 했는지 안 했는지가 중요하고, 점수는 시험에서 본다 */
  if (한번만_(종류)) 줄.평균 = 점수들.length
    ? Math.round(점수들.reduce(function (a, b) { return a + b; }, 0) / 점수들.length) : null;
  return 줄;
}

/* 방금 낸 숙제 한 줄 — 기록을 통째로 볼 까닭이 없다.
   단계(연습·시험) 숙제는 낸 뒤의 응시만 세니 아무것도 안 읽는다.
   옛 방식 숙제는 「그날」 푼 것이면 낸 것으로 쳐 왔다(당일 숙제는 그날 기록, 기한은 낸 날 이후) —
   그래서 오늘 치 기록만 끝에서 한 덩이 읽는다. 숫자가 전과 같아야 한다 */
function 새숙제줄_(x, 행) {
  return 읽는동안_(function () {
    var 단계 = 단계정리_(x.length > 13 ? x[13] : '');
    var 완료 = 단계 ? {} : 완료점수들_(undefined, 오늘기록줄_());
    return 숙제줄_(x, 행, 숙제맥락_({ 완료: 완료 }));
  });
}
function 오늘기록줄_() {
  if (읽은것_ && 읽은것_.오늘기록) return 읽은것_.오늘기록;
  var 오늘 = new Date(); 오늘.setHours(0, 0, 0, 0);
  var 줄들 = [];
  try { 줄들 = 최근기록줄_(sheet_(SHEET.기록), 오늘).map(function (z) { return z.x; }); } catch (e) { 줄들 = []; }
  if (읽은것_) 읽은것_.오늘기록 = 줄들;
  return 줄들;
}

/**
 * 숙제별 미제출 명단을 '미제출' 시트에 정리한다.
 * 누를 때마다 통째로 다시 씁니다 (직접 고쳐 넣은 내용은 남지 않습니다).
 */
function 미제출시트(비번) {
  if (비번 !== undefined && !선생님확인_(비번)) return { ok: false };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET.미제출);
  if (!sh) sh = ss.insertSheet(SHEET.미제출);
  sh.clear();

  var H = HEADERS.미제출;
  sh.getRange(1, 1, 1, H.length).setValues([H])
    .setFontWeight('bold').setBackground('#EFF3F9');
  sh.setFrozenRows(1);

  var 색맵 = {};
  단어장목록().forEach(function (b) { 색맵[b.이름] = b.색; });

  // 안 한 사람이 있는 것만, 진행 중인 것을 먼저
  var 목록 = 전체숙제().filter(function (h) { return 숙제인가_(h) && h.안한사람.length > 0; });   // 시험은 미제출이 아니다
  목록.sort(function (a, b) {
    if (a.지남 !== b.지남) return a.지남 ? 1 : -1;
    if (a.단어장 !== b.단어장) return a.단어장 < b.단어장 ? -1 : 1;
    return (a.마감일 || '') < (b.마감일 || '') ? -1 : 1;
  });

  if (!목록.length) {
    sh.getRange(2, 1).setValue('안 한 학생이 없습니다. 모두 제출했어요.');
    sh.autoResizeColumns(1, H.length);
    return { ok: true, 건수: 0 };
  }

  var 값 = [], 배경 = [], 메모 = [];
  목록.forEach(function (h) {
    var 이름들 = h.안한사람;
    var 보이기 = 이름들.slice(0, 8).join(', ') +
      (이름들.length > 8 ? ' …외 ' + (이름들.length - 8) + '명' : '');
    값.push([
      h.지남 ? '마감 지남' : (당일치기_(h.종류) ? '오늘까지' : '진행 중'),
      h.반, h.단어장, h.시작 + '~' + h.끝 + '번', h.유형, h.종류,
      h.마감일 || '', h.대상수, h.한사람.length, 이름들.length, 보이기
    ]);
    var bg = h.색 ? 연한색_(h.색, 0.86) : '#FFFFFF';
    배경.push(H.map(function () { return bg; }));
    var m = H.map(function () { return ''; });
    m[10] = '안 한 학생 ' + 이름들.length + '명\n' + 이름들.join(', ');
    if (h.모자란사람 && h.모자란사람.length) {
      m[10] += '\n\n풀었지만 ' + h.합격점 + '점을 못 넘긴 학생 ' + h.모자란사람.length + '명\n' +
        h.모자란사람.join(', ');
    }
    if (h.한사람.length) m[8] = '낸 학생\n' + h.한사람.join(', ');
    메모.push(m);
  });

  var rng = sh.getRange(2, 1, 값.length, H.length);
  rng.setValues(값);
  rng.setBackgrounds(배경);
  rng.setNotes(메모);
  rng.setVerticalAlignment('middle');
  sh.getRange(2, 11, 값.length, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sh.autoResizeColumns(1, H.length);
  sh.setColumnWidth(11, 320);
  if (!sh.getFilter()) sh.getRange(1, 1, 값.length + 1, H.length).createFilter();

  var 총 = 0;
  목록.forEach(function (h) { 총 += h.안한사람.length; });
  return { ok: true, 건수: 목록.length, 인원: 총 };
}

/** 시트 메뉴에서 부르는 용 */
function 미제출정리() {
  var r = 미제출시트();
  var ui = SpreadsheetApp.getUi();
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.미제출));
  ui.alert(r.건수
    ? '숙제 ' + r.건수 + '건에 안 한 학생이 있습니다. (연인원 ' + r.인원 + '명)'
    : '안 한 학생이 없습니다. 모두 제출했어요.');
}

/** 이 단어장을 배정받은 학생 목록 */
function 교재학생_(교재) {
  var t = s_(교재);
  if (!t) return [];
  var out = [];
  읽기캐시_(SHEET.학생).forEach(function (r) {
    var 이름 = s_(r[1]);
    if (!이름) return;
    if (줄교재_(r).indexOf(t) > -1) out.push(이름);
  });
  return out;
}

/** 이 단어장을 배우는 학생이 누구누구인지 (화면에서 미리 보여 주려고) */
function 교재대상(비번, 교재) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var 학생 = 교재학생_(교재);
  return { ok: true, 교재: s_(교재), 인원: 학생.length, 학생: 학생 };
}

/**
 * 숙제 등록 — 줄 하나로 끝난다.
 *   학생들을 안 고르면 → 그 단어장을 배정받은 학생 전원에게
 *   학생들을 고르면   → 그 아이들에게만 (학생 칸에 쉼표로 적힌다)
 */
function 숙제등록(비번, h) {
  if (!선생님확인_(비번)) return { ok: false };
  return 읽는동안_(function () { return 숙제등록안_(h); });     // 학생 시트를 한 번만 (숙제 시트는 메모하지 않는다)
}
function 숙제등록안_(h) {
  var 종류 = 숙제종류_(h.종류);
  var 마감 = (종류 === '기한' || 종류 === '시험') ? s_(h.마감일) : ymd_(new Date());
  var 단어장 = s_(h.단어장) || s_(h.교재);
  if (!단어장) return { ok: false, 메시지: '단어장을 골라 주세요.' };

  var 전체 = 전체명단_();
  var 고른 = 이름들풀기_(h.학생들 && h.학생들.length ? h.학생들 : h.학생)
               .filter(function (n) { return 전체.indexOf(n) > -1; });

  if (!고른.length && !교재학생_(단어장).length) {
    return { ok: false, 메시지: '“' + 단어장 + '” 을(를) 배우는 학생이 없습니다. ' +
                              '학생 명단에서 교재를 먼저 주시거나, 받을 학생을 골라 주세요.' };
  }

  var sh = sheet_(SHEET.숙제);
  var 줄 = [[
    '', 단어장, Number(h.시작) || 1, Number(h.끝) || 0,
    s_(h.유형) || '스펠링', 마감, new Date(), 고른.join(', '), 종류,
    s_(h.수업), Number(h.순서) || 0, s_(h.칸),      // 칸 — 과 단어장의 구분 (옛 단어장은 빈칸)
    Number(h.제한시간) > 0 ? Math.round(Number(h.제한시간)) : '',  // 제한시간(분) — 비면 제한 없음
    단계정리_(h.단계),                                               // 연습 · 시험 — 비면 옛 숙제 그대로
    단계정리_(h.단계) === '시험' && s_(h.통과점수) !== '' ? Number(h.통과점수) || 0 : '',
    단계정리_(h.단계) === '시험' && s_(h.재응시) !== '' ? Number(h.재응시) || 0 : '',
    Number(h.외우기분) > 0 ? Math.round(Number(h.외우기분)) : ''   // 외우기분 — 비면 외우기 없이 바로 시험
  ]];
  숙제칸확보_(sh);
  /* 지우기와 겹치면 「마지막 줄 + 1」 이 어긋난다 — 지우기와 같은 잠금 안에서 쓴다 */
  var lock = null;
  try { lock = LockService.getScriptLock(); lock.waitLock(10000); } catch (e) { lock = null; }
  var 새행;
  try {
    새행 = sh.getLastRow() + 1;
    sh.getRange(새행, 1, 1, 17).setValues(줄);
  } finally { if (lock) try { lock.releaseLock(); } catch (e) {} }
  /* 시트에 적힌 그대로 다시 읽는다 — 등록시각(낸때)이 화면과 서버에서 한 치도 달라지면 안 된다 */
  var 적힌 = sh.getRange(새행, 1, 1, 17).getValues()[0];
  var 답 = { ok: true, 개수: 1, 대상: 고른.length || 교재학생_(단어장).length, 숙제: 새숙제줄_(적힌, 새행) };
  /* 새 화면은 「바뀐줄만」 을 보낸다 — 옛 화면(아직 새로 안 받은 것)에는 예전처럼 목록을 통째로 */
  if (!h.바뀐줄만) 답.숙제목록 = 전체숙제();
  return 답;
}

/* 이번 판(외우기분 칸) 전에 낸 시험 숙제 — 그때 쓰던 설정값(외우기 5분 · 시험 20분)으로 돈다.
   그런 줄은 외우기분 칸이 아예 없다(시트가 16칸). 처음 칸이 생길 때 숙제칸확보_ 가 그 값을 줄에 적어 넣으므로
   설정 시트의 두 줄은 이때만 읽는다 */
var 옛시험시간캐시_ = null;
function 옛시험시간_() {
  if (옛시험시간캐시_) return 옛시험시간캐시_;
  function 분(키, 기본) {
    var n = Number(setting_(키, 기본));
    return (isFinite(n) && n >= 0 && n <= 180) ? Math.round(n) : 기본;
  }
  옛시험시간캐시_ = { 외우기: 분('외우기시간분', 기본외우기분), 시험: 분('시험시간분', 기본시험분) };
  return 옛시험시간캐시_;
}
function 숙제시간_(x, 종류) {
  var 제한 = Number(x.length > 12 ? x[12] : 0) || 0, 외 = Number(x.length > 16 ? x[16] : 0) || 0;
  if (종류 === '시험' && x.length <= 16) {
    var 옛 = 옛시험시간_();
    외 = 옛.외우기;
    if (!제한) 제한 = 옛.시험;
  }
  return { 제한시간: 제한, 외우기분: 외 };
}

/** 숙제 시트에 「수업」·「순서」 칸이 없으면 만들어 준다 (예전 시트 이어 쓰기) */
function 숙제칸확보_(sh) {
  sh = sh || sheet_(SHEET.숙제);
  /* 흉내 낸 시트(검사)에는 이런 함수가 없다 — 있을 때만 넓힌다 */
  if (!sh || typeof sh.getMaxColumns !== 'function' || typeof sh.getRange !== 'function') return sh;
  var 필요 = HEADERS.숙제.length;
  if (sh.getMaxColumns() < 필요) sh.insertColumnsAfter(sh.getMaxColumns(), 필요 - sh.getMaxColumns());
  var 머리 = sh.getRange(1, 1, 1, 필요).getValues()[0];
  /* 외우기분 칸이 처음 생긴다 — 이미 낸 시험 숙제에 그때 설정값을 적어 둔다 (안 그러면 외우기 없이 바로 시험이 된다) */
  if (s_(머리[16]) !== '외우기분' && sh.getLastRow() >= 2) {
    var n = sh.getLastRow() - 1, 옛 = 옛시험시간_();
    var 줄들 = sh.getRange(2, 1, n, 17).getValues(), 바꿈 = false;
    var 제한칸 = [], 외칸 = [];
    줄들.forEach(function (x) {
      var 시험 = s_(x[8]) === '시험';
      var 제 = x[12], 외 = x[16];
      if (시험 && s_(외) === '') { 외 = 옛.외우기 || ''; 바꿈 = true; }
      if (시험 && s_(제) === '') { 제 = 옛.시험 || ''; 바꿈 = true; }
      제한칸.push([제]); 외칸.push([외]);
    });
    if (바꿈) {
      sh.getRange(2, 13, n, 1).setValues(제한칸);
      sh.getRange(2, 17, n, 1).setValues(외칸);
    }
  }
  var 고칠까 = false;
  for (var i = 0; i < 필요; i++) {
    if (s_(머리[i]) !== HEADERS.숙제[i]) { 머리[i] = HEADERS.숙제[i]; 고칠까 = true; }
  }
  if (고칠까) {
    sh.getRange(1, 1, 1, 필요).setValues([머리])
      .setFontWeight('bold').setBackground('#EFF3F9');
  }
  return sh;
}

/* ================================================================
   수업 — 숙제 여러 개를 한 묶음으로, 순서대로 내준다
   · 교사용 지도자료의 A~H 흐름을 그대로 담는다
   · 기록·합격점·미제출은 숙제 그대로라 따로 만들 것이 없다
================================================================ */
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

/* 예전 화면(꾸러미 고르기)이 부르는 목록 — 처음 틀을 그 꼴로 돌려준다 */
function 수업꾸러미목록() {
  return 처음수업틀_.map(function (t) { return { 키: t.키, 이름: t.이름, 설명: t.설명, 단계: t.단계 }; });
}

/* ---------------- 수업틀 — 선생님이 짠 단계 묶음을 이름 붙여 둔다 ---------------- */
var 수업틀시트이름 = '수업틀';
/* 없으면 만들고, 그때 한 번만 처음 틀 여섯 개를 옮겨 넣는다.
   초기설정은 SHEET 를 돌며 빈 시트를 만드는데, 그러면 옮겨 넣을 때를 놓친다 — 그래서 SHEET 에는 안 넣는다. */
function 수업틀시트_() {
  var ss = ss_();
  var sh = ss.getSheetByName(수업틀시트이름);
  if (sh) return sh;
  sh = ss.insertSheet(수업틀시트이름);
  sh.getRange(1, 1, 1, 3).setValues([['틀이름', '단계들', '만든때']])
    .setFontWeight('bold').setBackground('#EFF3F9');
  sh.setFrozenRows(1);
  var 줄 = 처음수업틀_.map(function (t) { return [t.이름, JSON.stringify(t.단계), new Date()]; });
  sh.getRange(2, 1, 줄.length, 3).setValues(줄);
  return sh;
}
function 수업틀읽기_() {
  var sh = 수업틀시트_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 3).getValues().map(function (x, i) {
    var 단계 = [];
    try { 단계 = JSON.parse(s_(x[1]) || '[]'); } catch (e) { 단계 = []; }
    return { 행: i + 2, 이름: s_(x[0]), 단계: 단계 };
  }).filter(function (t) { return t.이름; });
}
function 수업틀목록(비번) {
  if (!선생님확인_(비번)) return { ok: false };
  return { ok: true, 틀: 수업틀읽기_().map(function (t) { return { 이름: t.이름, 단계: t.단계 }; }) };
}
/* 틀에는 「구분 + 유형 + 몇 개씩」 만 남긴다. 단어장·범위는 안 넣는다 —
   그래야 「본문 1회차」 틀 하나를 중2 5과에도 6과에도 쓴다 (범위는 불러올 때 「이어서」 로 채운다).
   구분은 「칸」, 처음 틀(꾸러미에서 옮긴 것)은 「어디」 로 적혀 있다 — 둘 다 받는다 */
function 틀단계정리_(단계) {
  var 칸 = ['종류', '칸', '어디', '유형', '분', '제한', '단계', '통과', '재응시', '지난', '개수'];
  return (단계 || []).map(function (d) {
    var o = {};
    칸.forEach(function (k) { if (d && d[k] !== undefined && d[k] !== null && d[k] !== '') o[k] = d[k]; });
    return o;
  }).filter(function (d) { return d.유형; });
}
function 수업틀저장(비번, 이름, 단계) {
  if (!선생님확인_(비번)) return { ok: false };
  이름 = s_(이름);
  if (!이름) return { ok: false, 메시지: '틀 이름을 적어 주세요.' };
  var 정리 = 틀단계정리_(단계);
  if (!정리.length) return { ok: false, 메시지: '단계를 하나 이상 넣어 주세요.' };
  var sh = 수업틀시트_();
  var 있던 = null;
  수업틀읽기_().forEach(function (t) { if (t.이름 === 이름) 있던 = t; });
  var 줄 = [[이름, JSON.stringify(정리), new Date()]];
  if (있던) sh.getRange(있던.행, 1, 1, 3).setValues(줄);
  else sh.getRange(sh.getLastRow() + 1, 1, 1, 3).setValues(줄);
  return 수업틀목록(비번);
}
function 수업틀삭제(비번, 이름) {
  if (!선생님확인_(비번)) return { ok: false };
  var sh = 수업틀시트_();
  수업틀읽기_().filter(function (t) { return t.이름 === s_(이름); })
    .reverse().forEach(function (t) { sh.deleteRow(t.행); });
  return 수업틀목록(비번);
}

/* ---------------- 오늘 추천 ---------------- */
/* 기록의 틀린 단어 메모 — 셀에는 다섯 개 + 「…외 N개」 만 적히고, 다 적힌 것은 결과저장이 단 메모에 있다 */
function 기록메모_(name) {
  try {
    var sh = sheet_(name), last = sh.getLastRow();
    if (last < 2) return [];
    return sh.getRange(2, 틀린단어열, last - 1, 1).getNotes().map(function (r) { return s_(r[0]); });
  } catch (e) { return []; }
}
function 온오답_(셀, 메모) {
  메모 = s_(메모);
  if (/^틀린 단어 \d+개/.test(메모)) return 메모.split('\n').slice(1).map(s_).filter(String);
  return 틀린칸풀기_(셀);
}
/* 기록 범위의 구분 — 과 단어장 기록은 「본문 1~12」 처럼 앞에 붙어 있다 (옛 기록은 빈칸) */
function 범위칸_(범위) {
  var m = s_(범위).match(/^(단어|본문|문법|3단변화)\s/);
  return m ? m[1] : '';
}
/* 그 교재의 최근 30일 기록 — 오답 다시 풀기·빼 둔 기록은 안 본다 */
function 최근기록_(교재) {
  var 한달전 = new Date();
  한달전.setDate(한달전.getDate() - 30);
  var 메모 = 기록메모_(SHEET.기록), out = [];
  rows_(SHEET.기록).forEach(function (x, i) {
    if (!(x[0] instanceof Date) || x[0] < 한달전) return;
    if (s_(x[3]) !== 교재) return;
    if (s_(x[14]) === 재시험표시 || s_(x[15]) === 'O') return;
    out.push({ 이름: s_(x[2]), 칸: 범위칸_(x[4]), 유형: s_(x[5]), 점수: Number(x[8]) || 0, 초: Number(x[11]) || 0,
               틀린: 온오답_(x[13], 메모[i]).join(', '), 날: ymd_(x[0]) });
  });
  return out;
}

/* 추천에 쓸 재료 — 그 교재의 숙제와 최근 30일 기록, 단어 목록 */
function 수업재료_(교재) {
  교재 = s_(교재);
  var 책 = null;
  단어장목록().forEach(function (b) { if (b.이름 === 교재) 책 = b; });
  var 숙제들 = 전체숙제().filter(function (h) { return h.단어장 === 교재 && 숙제인가_(h); })
    .map(function (h) {
      return { 단어장: h.단어장, 칸: h.칸 || '', 시작: h.시작, 끝: h.끝, 유형: h.유형, 등록: h.등록일 || '',
               제한시간: h.제한시간 || 0,
               안낸수: (h.안한사람 || []).length, 대상수: h.대상수 };
    });
  var 기록들 = 최근기록_(교재);
  return {
    교재: 교재, 종류: 책 ? 책.종류 : '', 오늘: ymd_(new Date()),
    레슨: 책 ? 책.레슨 : 기본레슨, 총: 책 ? 책.개수 : 0, 칸수: (책 && 책.칸수) || {},
    학생수: 교재학생_(교재).length,
    숙제들: 숙제들, 기록들: 기록들,
    /* 다 같이 틀린 단어의 자리를 찾는 데 쓴다 — 과 단어장은 단어 구분의 줄만 */
    단어들: 범위단어_(단어가져오기(교재) || [], 책 && 과장_(책.종류) ? '단어' : '').map(function (w) { return w.en; })
  };
}
/**
 * 오늘 추천 — 진단과 단계 초안. 앱스 스크립트는 느려서 기록을 다 훑으면 몇 초 걸린다.
 * 그래서 재료는 5분 동안 들고 있다가 다시 쓴다 (「다시 추천」 은 새로 = true 로 새로 훑는다).
 */
function 수업추천(비번, 교재, 예산, 새로) {
  if (!선생님확인_(비번)) return { ok: false };
  if (!s_(교재)) return { ok: false, 메시지: '교재를 골라 주세요.' };
  var 열쇠 = '수업재료|' + s_(교재), 재료 = null, 캐시 = null;
  try { 캐시 = CacheService.getScriptCache(); } catch (e) { 캐시 = null; }
  if (캐시 && !새로) {
    try { var 글 = 캐시.get(열쇠); if (글) 재료 = JSON.parse(글); } catch (e) { 재료 = null; }
  }
  if (!재료) {
    재료 = 수업재료_(교재);
    if (캐시) { try { 캐시.put(열쇠, JSON.stringify(재료), 300); } catch (e) {} }
  }
  재료.예산 = Number(예산) || 추천예산기본_;
  return { ok: true, 추천: 수업추천짜기_(재료) };
}

/* 그 아이가 이 단어장에서 최근에 틀린 단어 — 누적 단계를 풀 때 이것부터 낸다.
   「함께」 누적(오늘 추천 4순위)이면 반이 함께 틀린 단어를 먼저 넣고 그 뒤에 내 것 */
var 내오답기록수 = 10;
/* 칸 — 과 단어장이면 그 구분의 기록만 (본문 문장이 단어 누적에 섞이면 안 된다) */
function 내오답(이름, 단어장, 함께, 칸) {
  칸 = s_(칸);
  이름 = s_(이름); 단어장 = s_(단어장);
  if (!이름 || !단어장) return { ok: true, 단어: [] };
  var 줄들 = [];
  [SHEET.기록, SHEET.기록보관].forEach(function (name) {
    var r = [];
    try { r = rows_(name); } catch (e) { return; }      // 보관함이 아직 없어도 괜찮다
    var 메모 = 기록메모_(name);
    r.forEach(function (x, i) {
      if (!(x[0] instanceof Date)) return;
      if (s_(x[2]) !== 이름 || s_(x[3]) !== 단어장 || !s_(x[13])) return;
      if (칸 && 범위칸_(x[4]) !== 칸) return;
      줄들.push({ 때: x[0], 틀린: 온오답_(x[13], 메모[i]) });
    });
  });
  줄들.sort(function (a, b) { return b.때 - a.때; });
  var 본 = {}, 단어 = [];
  function 넣기(w) {
    var k = String(w || '').toLowerCase();
    if (!k || 본[k]) return;
    본[k] = 1;
    단어.push(w);
  }
  if (함께) 함께틀린_(최근기록_(단어장).filter(function (r) { return !칸 || r.칸 === 칸; }),
                     교재학생_(단어장).length).forEach(function (x) { 넣기(x.글); });
  줄들.slice(0, 내오답기록수).forEach(function (x) { x.틀린.forEach(넣기); });
  return { ok: true, 단어: 단어 };
}

/**
 * 수업 한 벌을 내준다.
 * c = { 이름, 꾸러미, 단어장, 단어시작, 단어끝, 본문장, 본문시작, 본문끝,
 *       마감일, 종류, 학생들 }
 */
function 수업내주기(비번, c) {
  if (!선생님확인_(비번)) return { ok: false };
  var 이름 = s_(c && c.이름);
  if (!이름) return { ok: false, 메시지: '수업 이름을 적어 주세요.' };

  /* 새 화면은 짠 단계를 그대로 보낸다. 꾸러미 키가 오면 예전 화면이다 (재배포 순서가 어긋나도 돌게) */
  if (c.단계 && c.단계.length) return 단계로내주기_(비번, 이름, c);
  var 꾸 = null;
  처음수업틀_.forEach(function (x) { if (x.키 === s_(c.꾸러미)) 꾸 = x; });
  if (!꾸) return { ok: false, 메시지: '꾸러미를 골라 주세요.' };

  function 쓰나(어디){ return 꾸.단계.some(function (d) { return d.어디 === 어디; }); }
  if (쓰나('단어') && !s_(c.단어장)) return { ok: false, 메시지: '단어 단어장을 골라 주세요.' };
  if (쓰나('본문') && !s_(c.본문장)) return { ok: false, 메시지: '본문 단어장을 골라 주세요.' };
  if (쓰나('문법') && !s_(c.문법장)) return { ok: false, 메시지: '문법 단어장을 골라 주세요.' };

  var 됨 = 0, 탈 = [], 새것들 = [];
  꾸.단계.forEach(function (d, i) {
    var 책 = (d.어디 === '본문') ? s_(c.본문장)
           : (d.어디 === '문법') ? s_(c.문법장) : s_(c.단어장);
    var 시작 = (d.어디 === '본문') ? c.본문시작
             : (d.어디 === '문법') ? c.문법시작 : c.단어시작;
    var 끝 = (d.어디 === '본문') ? c.본문끝
           : (d.어디 === '문법') ? c.문법끝 : c.단어끝;
    var r = 숙제등록(비번, {
      단어장: 책, 시작: 시작, 끝: 끝, 유형: d.유형,
      마감일: c.마감일, 종류: c.종류, 학생들: c.학생들,
      수업: 이름, 순서: i + 1, 바뀐줄만: true
    });
    if (r && r.ok) { 됨++; 새것들.push(r.숙제); } else 탈.push((d.유형) + ' — ' + ((r && r.메시지) || '실패'));
  });

  if (!됨) return { ok: false, 메시지: 탈[0] || '수업을 내지 못했습니다.' };
  var 답 = { ok: true, 이름: 이름, 단계수: 됨,
             메시지: 탈.length ? ('일부만 나갔습니다 — ' + 탈.join(' / ')) : '',
             숙제들: 새것들 };
  if (!c.바뀐줄만) 답.숙제목록 = 전체숙제();      // 옛 화면
  return 답;
}

/* 짠 단계를 그대로 — 단계마다 숙제 한 줄, 수업 이름으로 묶고 순서를 붙인다.
   누적 단계는 화면이 범위를 찾아 「스펠링 (누적 20)」 같은 유형으로 보낸다 */
function 단계로내주기_(비번, 이름, c) {
  return 읽는동안_(function () { return 단계로내주기안_(비번, 이름, c); });   // 단계마다 학생 시트를 다시 읽지 않게
}
function 단계로내주기안_(비번, 이름, c) {
  var 됨 = 0, 탈 = [], 책들 = {}, 새것들 = [];
  c.단계.forEach(function (d, i) {
    var r = 숙제등록(비번, {
      단어장: s_(d.단어장), 칸: s_(d.칸), 시작: d.시작, 끝: d.끝, 유형: s_(d.유형), 제한시간: d.제한시간,
      단계: d.단계, 통과점수: d.통과점수, 재응시: d.재응시,
      마감일: c.마감일, 종류: c.종류, 학생들: c.학생들,
      수업: 이름, 순서: i + 1, 바뀐줄만: true
    });
    if (r && r.ok) { 됨++; 책들[s_(d.단어장)] = 1; 새것들.push(r.숙제); }
    else 탈.push((i + 1) + '단계 ' + s_(d.유형) + ' — ' + ((r && r.메시지) || '실패'));
  });
  /* 방금 낸 숙제가 다음 추천에 바로 보이게 들고 있던 재료를 버린다 */
  try {
    var 캐시 = CacheService.getScriptCache();
    Object.keys(책들).forEach(function (b) { 캐시.remove('수업재료|' + b); });
  } catch (e) {}
  if (!됨) return { ok: false, 메시지: 탈[0] || '수업을 내지 못했습니다.' };
  var 답 = { ok: true, 이름: 이름, 단계수: 됨,
             메시지: 탈.length ? ('일부만 나갔습니다 — ' + 탈.join(' / ')) : '',
             숙제들: 새것들 };
  if (!c.바뀐줄만) 답.숙제목록 = 전체숙제();      // 옛 화면
  return 답;
}

/** 수업 한 벌을 통째로 지운다 */
function 수업삭제(비번, 이름) {
  if (!선생님확인_(비번)) return { ok: false };
  var 찾을것 = s_(이름);
  if (!찾을것) return { ok: false };
  var sh = 숙제칸확보_();
  var r = rows_(SHEET.숙제);
  var 지울줄 = [];
  r.forEach(function (x, i) {
    if (s_(x.length > 9 ? x[9] : '') === 찾을것) 지울줄.push(i + 2);
  });
  지울줄.reverse().forEach(function (n) { sh.deleteRow(n); });
  return { ok: true, 지운수: 지울줄.length, 숙제목록: 전체숙제() };
}

function 숙제삭제(비번, 행, 바뀐줄만) {
  if (!선생님확인_(비번)) return { ok: false };
  var r = 숙제여러개삭제(비번, [행], 바뀐줄만);
  if (!r.ok) return r;
  return { ok: true, 지운행: r.지운행, 숙제목록: r.숙제목록 };
}

/**
 * 고른 숙제 여러 개를 한 번에 지운다.
 * 행 번호가 큰 것부터 지워야 앞의 번호가 밀리지 않는다.
 */
function 숙제여러개삭제(비번, 행들, 바뀐줄만) {
  if (!선생님확인_(비번)) return { ok: false };
  var sh = sheet_(SHEET.숙제);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { ok: false, 메시지: '잠시 후 다시 시도해 주세요' }; }
  var 정리 = [];
  try {
    /* 줄번호는 {행, 낸때} 로 온다 — 그 사이 다른 줄이 지워져 밀렸으면 등록시각으로 다시 찾는다 (엉뚱한 줄을 지우면 안 된다).
       잠금 안에서 찾고 지운다 — 두 번 잇따라 눌러도 서로 밀지 않게 */
    var 본것 = {};
    (행들 || []).forEach(function (r) {
      var n = (r && typeof r === 'object') ? 숙제줄찾기_(sh, r.행, r.낸때) : 숙제줄찾기_(sh, r, 0);
      if (n && !본것[n]) { 본것[n] = 1; 정리.push(n); }
    });
    정리.sort(function (a, b) { return b - a; });
    /* 이어진 줄끼리 묶어 deleteRows 한 번 — 스무 줄이면 스무 번 부르던 것을 묶음 수만큼만 (큰 번호 묶음부터) */
    묶음줄들_(정리).forEach(function (m) { sh.deleteRows(m.시작, m.개수); });
  } finally {
    lock.releaseLock();
  }
  정리.sort(function (a, b) { return a - b; });
  /* 화면이 들고 있는 목록에서 이 줄들을 빼고, 그 아래 줄번호를 지운 만큼 당긴다 */
  var 답 = { ok: true, 개수: 정리.length, 지운행: 정리 };
  if (!바뀐줄만) 답.숙제목록 = 전체숙제();        // 옛 화면
  return 답;
}

/* 큰 번호부터 정렬된 줄번호 → 이어진 묶음 [{시작, 개수}] (큰 묶음부터 — 지워도 앞 묶음 번호가 안 밀린다) */
function 묶음줄들_(큰차례) {
  var 묶음 = [];
  큰차례.forEach(function (n) {
    var m = 묶음[묶음.length - 1];
    if (m && m.시작 - 1 === n) { m.시작 = n; m.개수++; }
    else 묶음.push({ 시작: n, 개수: 1 });
  });
  return 묶음;
}

/**
 * 이미 낸 숙제를 고친다. 반·대상 학생은 그대로 둔다.
 *   행 = 줄번호 하나 → 그 줄만.  행 = [{행, 낸때}, …] → 고른 여러 줄 (「선택 시간 바꾸기」)
 *   h 에 보낸 칸만 고친다 — 시간만 고치러 들어왔는데 단어장·범위가 지워지면 안 된다.
 *     앞쪽: 단어장·시작·끝·유형·종류·마감일   뒤쪽: 외우기분·제한시간·통과점수·재응시
 *   이미 낸 기록은 건드리지 않는다 — 바꾼 뒤에 푸는 아이부터 새 값이다.
 */
function 숙제수정(비번, 행, h) {
  if (!선생님확인_(비번)) return { ok: false };
  h = h || {};
  var sh = sheet_(SHEET.숙제);
  if (Array.isArray(행)) {
    var 된 = 0, 탈 = '', 고친행들 = [];
    행.forEach(function (r) {
      var 답 = 숙제한줄고치기_(sh, r && r.행 !== undefined ? r.행 : r, h, r && r.낸때);
      if (답.ok) { 된++; 고친행들.push(답.행); } else 탈 = 탈 || 답.메시지;
    });
    if (!된 && 탈) return { ok: false, 메시지: 탈 };
    if (!h.바뀐줄만) return { ok: true, 개수: 된, 숙제목록: 전체숙제() };      // 옛 화면
    return { ok: true, 개수: 된, 숙제들: 고친행들.map(function (n) { return 고친숙제줄_(sh, n, false); }) };
  }
  var r = 숙제한줄고치기_(sh, 행, h, h.낸때);
  if (!r.ok) return r;
  if (!h.바뀐줄만) return { ok: true, 숙제목록: 전체숙제() };                // 옛 화면
  return { ok: true, 숙제: 고친숙제줄_(sh, r.행, 앞을고침_(h)) };
}

function 앞을고침_(h) {
  return ['단어장', '시작', '끝', '유형', '종류', '마감일'].some(function (k) { return h[k] !== undefined; });
}
/* 고친 줄 — 시간·통과점수·재응시만 고쳤으면 그 칸만 (누가 냈나는 그대로라 기록을 안 읽는다).
   단어장·범위·종류를 고쳤으면 누가 냈나가 바뀌니 그 한 줄만 다시 센다 */
function 고친숙제줄_(sh, n, 전부) {
  var 넓이 = typeof sh.getLastColumn === 'function' ? Math.max(17, sh.getLastColumn()) : 17;
  var x = sh.getRange(n, 1, 1, 넓이).getValues()[0];
  if (!전부) {
    var 종류 = 숙제종류_(x[8]), 시간 = 숙제시간_(x, 종류);
    return { 행: n, 낸때: x[6] instanceof Date ? x[6].getTime() : 0, 제한시간: 시간.제한시간, 외우기분: 시간.외우기분,
             통과점수: s_(x[14]), 재응시: s_(x[15]) };
  }
  return 읽는동안_(function () {
    var 단계있다 = !!단계정리_(x[13]);
    return 숙제줄_(x, n, 숙제맥락_({ 응시: 단계있다 ? 응시표_() : {}, 더준표: 단계있다 ? 재응시추가표_() : {},
                                     완료: 단계있다 ? {} : 완료점수들_() }));
  });
}

/* 줄번호로 찾는다. 낸때(등록시각)를 같이 받으면 그 줄이 맞는지 맞춰 보고,
   그 사이 다른 숙제가 지워져 줄이 밀렸으면 등록시각으로 다시 찾는다 — 엉뚱한 숙제를 고치면 안 된다 */
function 숙제줄찾기_(sh, 행, 낸때) {
  var n = Number(행), 마지막 = sh.getLastRow();
  낸때 = Number(낸때) || 0;
  if (!낸때) return (n >= 2 && n <= 마지막) ? n : 0;
  function 맞나(v) { return v instanceof Date && v.getTime() === 낸때; }
  if (n >= 2 && n <= 마지막 && 맞나(sh.getRange(n, 7).getValue())) return n;
  if (마지막 < 2) return 0;
  var 때들 = sh.getRange(2, 7, 마지막 - 1, 1).getValues();
  for (var i = 0; i < 때들.length; i++) if (맞나(때들[i][0])) return i + 2;
  return 0;
}

function 숙제한줄고치기_(sh, 행, h, 낸때) {
  var n = 숙제줄찾기_(sh, 행, 낸때);
  if (!n) return { ok: false, 메시지: '이미 지워진 숙제입니다' };

  /* 뒤쪽 칸 — 보낸 것만. 시간은 0~180분 (비우거나 0 이면 제한 없음) */
  var 뒤칸 = { 제한시간: 13, 통과점수: 15, 재응시: 16, 외우기분: 17 };
  var 끝값 = { 제한시간: 180, 외우기분: 180, 통과점수: 100, 재응시: 20 };
  var 뒤 = [];
  for (var k in 뒤칸) {
    if (h[k] === undefined) continue;
    var v = (h[k] === '' || h[k] === null) ? '' : Math.round(Number(h[k]));
    if (v !== '' && !(isFinite(v) && v >= 0 && v <= 끝값[k])) {
      return { ok: false, 메시지: (k === '통과점수' ? '통과점수는 0에서 100' : k === '재응시' ? '재응시는 0에서 20번' : '시간은 0에서 180분') + ' 사이로 넣어 주세요.' };
    }
    if (v === 0 && (k === '제한시간' || k === '외우기분')) v = '';
    뒤.push([뒤칸[k], v]);
  }

  var 앞을 = ['단어장', '시작', '끝', '유형', '종류', '마감일'].some(function (k) { return h[k] !== undefined; });
  if (앞을) {
    var 답 = 숙제앞칸고치기_(sh, n, h);
    if (!답.ok) return 답;
  }
  if (뒤.length) {
    숙제칸확보_(sh);
    뒤.forEach(function (x) { sh.getRange(n, x[0]).setValue(x[1]); });
  }
  return { ok: true, 행: n };
}

/* 앞 9칸 — 단어장·범위·유형·종류·마감일 (예전 숙제수정 그대로) */
function 숙제앞칸고치기_(sh, n, h) {
  var 기존 = sh.getRange(n, 1, 1, 9).getValues()[0];
  var 종류 = 숙제종류_(h.종류);
  var 날짜고름 = (종류 === '기한' || 종류 === '시험');
  var 마감 = 날짜고름 ? s_(h.마감일) : ymd_(new Date());
  if (날짜고름 && !마감) {
    return { ok: false, 메시지: 종류 === '시험' ? '시험 날짜를 골라 주세요' : '마감일을 골라 주세요' };
  }

  var 시작 = Number(h.시작) || 1;
  var 끝 = Number(h.끝) || 0;
  if (끝 < 시작) { var t = 시작; 시작 = 끝; 끝 = t; }

  sh.getRange(n, 1, 1, 9).setValues([[
    '',                               // 반은 더 이상 쓰지 않는다
    s_(h.단어장) || s_(기존[1]),
    시작, 끝,
    s_(h.유형) || '스펠링',
    마감,
    기존[6] || new Date(),            // 등록시각 (그대로)
    s_(기존[7]),                      // 대상 학생 (그대로)
    종류
  ]]);
  /* 단어장을 바꾸면 칸(구분)도 맞춘다 — 남은 칸이 엉뚱한 기록을 찾으면 낸 숙제가 안 낸 것이 된다.
     과로 바꾸면 고른 구분(없으면 단어), 옛 단어장으로 바꾸면 빈칸 */
  var 새책 = s_(h.단어장) || s_(기존[1]);
  if (h.칸 !== undefined || 새책 !== s_(기존[1])) {
    var 새칸 = h.칸 !== undefined ? s_(h.칸) : '';
    var nb = 단어장찾기_(새책);
    if (!(nb && 과장_(nb.종류))) 새칸 = '';
    else if (!새칸) 새칸 = '단어';
    숙제칸확보_(sh);
    sh.getRange(n, 12).setValue(새칸);
  }
  return { ok: true };
}

/** 선생님 화면에서 고른 기록을 보관함으로 옮기기 */
function 기록정리(비번, 키들) {
  if (!선생님확인_(비번)) return { ok: false };
  var sh = sheet_(SHEET.기록);
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, 개수: 0 };
  var vals = sh.getRange(2, 1, last - 1, 1).getValues();
  var set = {};
  (키들 || []).forEach(function (k) { set[Number(k)] = 1; });
  var 행들 = [];
  for (var i = 0; i < vals.length; i++) {
    var d = vals[i][0];
    if (d instanceof Date && set[d.getTime()]) 행들.push(i + 2);
  }
  return { ok: true, 개수: 행보관_(행들) };
}

/**
 * 마감이 오래 지난 숙제를 한꺼번에 지운다.
 * 시험 결과는 '기록' 시트에 그대로 남으므로 성적이 사라지지는 않는다.
 */
function 지난숙제정리(비번, 일수) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  var days = Number(일수) || 30;
  var 기준 = new Date(); 기준.setHours(0, 0, 0, 0);
  기준.setDate(기준.getDate() - days);
  var 자른날 = ymd_(기준);

  var sh = sheet_(SHEET.숙제);
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, 개수: 0, 숙제목록: 전체숙제() };

  var vals = sh.getRange(2, 1, last - 1, 9).getValues();
  var 지울줄 = [];
  for (var i = 0; i < vals.length; i++) {
    var x = vals[i];
    var 마감 = x[5] instanceof Date ? ymd_(x[5]) : s_(x[5]);
    if (!마감) continue;
    if (마감 < 자른날) 지울줄.push(i + 2);
  }
  if (!지울줄.length) return { ok: true, 개수: 0, 숙제목록: 전체숙제() };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { ok: false, 메시지: '잠시 후 다시 해 주세요' }; }
  try {
    지울줄.sort(function (a, b) { return b - a; });      // 뒤에서부터 지워야 번호가 안 밀린다
    지울줄.forEach(function (n) { sh.deleteRow(n); });
  } finally {
    lock.releaseLock();
  }
  return { ok: true, 개수: 지울줄.length, 자른날: 자른날, 숙제목록: 전체숙제() };
}

/** 선생님 화면에서 오래된 기록 한 번에 정리 */
function 오래된기록정리API(비번, 일수) {
  if (!선생님확인_(비번)) return { ok: false };
  return { ok: true, 개수: 오래된기록보관_(Number(일수) || 30) };
}

/**
 * 붙여넣은 한 줄에서 [영어, 뜻]을 뽑는다. 못 뽑으면 null.
 * 순서가 중요하다 — 뜻에 쉼표가 들어간 경우("number  숫자, 번호")를 지키기 위해
 * 탭 → 한글 시작점 → 나머지 구분자 순으로 본다.
 */
/** 문장 단어장인가 — 본문·문법 둘 다. 세 번째 칸이 그림이 아니라 비고다 */
function 본문장_(종류) { var t = s_(종류); return t === '본문' || t === '문법'; }
/** 문법 단어장인가 — 빈칸을 선생님이 [ ] 로 찍어 둔다 */
function 문법장_(종류) { return s_(종류) === '문법'; }

/** 세 번째 칸이 그림인지 가린다 — 인터넷 주소 · data: · 그림 파일 이름 */
function 그림같나_(v) {
  var t = s_(v);
  if (!t) return false;
  return /^(https?:\/\/|data:image\/)/i.test(t) || /\.(png|jpe?g|gif|webp|svg)$/i.test(t);
}

function 줄나누기_(line, 종류) {
  var 문장 = 본문장_(종류);
  /* 본문은 "1919 was a hard year." 처럼 숫자로 시작하는 문장이 있으니
     번호를 뗄 때 꼭 점·괄호가 붙어 있어야 한다 */
  var 번호떼기 = 문장 ? /^\s*\d+\s*[.)\]]\s+/ : /^\s*\d+\s*[.)\]]?\s+/;
  var t = String(line || '').replace(번호떼기, '').trim();
  if (!t) return null;
  // 쉼표는 "자르는 기준"으로는 쓰지 않지만, 양 끝에 붙어 있으면 떼어 낸다
  var 꼬리 = /[\-:=,;|\s]+$/, 머리 = /^[\-:=;|\s]+/;
  var en = '', ko = '';

  // 1) 세로줄 | — 권장 형식.  apple | 사과   (세 번째 칸에 그림을 적어도 된다)
  if (t.indexOf('|') > -1) {
    var 쪽 = t.split('|');
    en = s_(쪽[0]).replace(꼬리, '').trim();
    ko = s_(쪽[1]).replace(머리, '').trim();
    var 뒤 = 쪽.slice(2).join('|').trim();
    if (en && ko) {
      if (문장) return 뒤 ? [en, ko, 뒤] : [en, ko];
      return 그림같나_(뒤) ? [en, ko, 뒤] : [en, ko + (뒤 ? ' | ' + 뒤 : '')];
    }
  }

  // 2) 탭 (엑셀·한글 표에서 복사한 경우) — 세 번째 칸은 그림으로 본다
  if (t.indexOf('\t') > -1) {
    var 칸 = t.split('\t');
    en = s_(칸[0]).replace(꼬리, '').trim();
    ko = s_(칸[1]).replace(머리, '').trim();
    var 셋 = s_(칸[2]).trim();
    if (en && ko) {
      if (문장) return 셋 ? [en, ko, 셋] : [en, ko];
      return 그림같나_(셋) ? [en, ko, 셋] : [en, ko];
    }
  }

  /* 본문 문장은 | 나 탭으로만 받는다 — 한글 시작점이나 띄어쓰기로 자르면
     "He said, 그는 말했다" 처럼 문장 가운데가 잘려 버린다 */
  if (문장) return null;

  // 3) 한글이 시작되는 자리에서 자르기 — 뜻 안의 쉼표를 살린다.
  //    쉼표는 구분자로 쓰지 않는다 ("숫자, 번호" 같은 뜻이 흔하다)
  var m = t.match(/[가-힣]/);
  if (m && m.index > 0) {
    var idx = m.index;
    // "~의 탓으로 돌리다" 처럼 앞에 붙은 물결표는 뜻 쪽에 붙여 준다
    while (idx > 0 && /[~∼〜]/.test(t.charAt(idx - 1))) idx--;
    en = t.slice(0, idx).replace(꼬리, '').trim();
    ko = t.slice(idx).trim();
    if (en && ko && !/[가-힣]/.test(en)) return [en, ko];
  }

  // 4) 두 칸 이상 띄어쓰기
  var p2 = t.split(/\s{2,}/);
  if (p2.length >= 2) {
    en = p2[0].replace(꼬리, '').trim();
    ko = p2.slice(1).join(' ').replace(머리, '').trim();
    if (en && ko) return [en, ko];
  }

  // 5) 마지막으로 첫 공백
  var k = t.indexOf(' ');
  if (k > 0) {
    en = t.slice(0, k).replace(꼬리, '').trim();
    ko = t.slice(k + 1).replace(머리, '').trim();
    if (en && ko) return [en, ko];
  }
  return null;
}

/** 단어장 한 번에 추가 (선생님 화면에서 붙여넣기) */
function 단어붙여넣기(비번, 단어장, 본문, 덮어쓰기, 종류) {
  if (!선생님확인_(비번)) return { ok: false };
  if (과장_(종류)) return { ok: false, 메시지: '과 단어장은 「과 한꺼번에 넣기」 칸에 ## 이름 / ### 단어 꼴로 붙여넣어 주세요.' };
  var 막 = 과면막기_(단어장); if (막) return 막;
  var 이름 = s_(단어장);
  if (!이름) return { ok: false, 메시지: '단어장 이름을 적어 주세요.' };

  var 항목 = [];
  String(본문 || '').split('\n').forEach(function (line) {
    var p = 줄나누기_(line, 종류);
    if (p) 항목.push(p);
  });
  if (!항목.length) return { ok: false, 메시지: '인식된 단어가 없습니다.' };

  var b = 단어장찾기_(이름);
  var sh;
  if (!b) {
    sh = 단어시트만들기_(이름, 종류);
  } else {
    sh = ss_().getSheetByName(b.시트);
    if (!sh) sh = 단어시트만들기_(이름, 종류);
    if (덮어쓰기 && sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
    if (s_(종류) !== b.종류) 목록시트_().getRange(b.행, 2).setValue(s_(종류));
  }

  var 시작번호 = Math.max(0, sh.getLastRow() - 1);
  var 그림수 = 0;
  항목.forEach(function (p) { if (p[2]) 그림수++; });
  var 폭 = 그림수 ? 4 : 3;
  if (그림수) 넷째칸확보_(sh, 종류);
  var 값 = 항목.map(function (p, i) {
    return 그림수 ? [시작번호 + i + 1, p[0], p[1], s_(p[2])]
                  : [시작번호 + i + 1, p[0], p[1]];
  });
  sh.getRange(sh.getLastRow() + 1, 1, 값.length, 폭).setValues(값);

  return { ok: true, 개수: 항목.length, 그림수: 그림수, 단어장목록: 단어장목록() };
}

/* ---------------------------------------------- 단어장 수정 / 삭제 */

/** 한 단어장의 단어를 전부 가져온다 (선생님 편집용) */
function 단어목록(비번, 단어장) {
  if (!선생님확인_(비번)) return { ok: false };
  var sh = 단어시트_(단어장);
  if (!sh) return { ok: true, 단어들: [] };
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, 단어들: [] };
  var b = 단어장찾기_(단어장);
  if (b && 과장_(b.종류)) {
    return { ok: true, 종류: '과', 단어들: 과줄들_(sh, last).map(function (w) {
      return { 번호: w.no, 칸: w.칸, en: w.en, ko: w.ko, 그림: w.그림 || '', 비고: w.비고 || '' };
    }) };
  }
  var 문장 = 본문장_(b && b.종류);
  var 칸수 = Math.max(3, Math.min(4, sh.getLastColumn()));
  var v = sh.getRange(2, 1, last - 1, 칸수).getValues();
  var out = [];
  v.forEach(function (x, i) {
    var 넷째 = (칸수 > 3) ? s_(x[3]) : '';
    out.push({ 행: i + 2, 번호: Number(x[0]) || i + 1, en: s_(x[1]), ko: s_(x[2]),
               그림: 문장 ? '' : 넷째, 비고: 문장 ? 넷째 : '' });
  });
  out.sort(function (a, b) { return a.번호 - b.번호; });
  return { ok: true, 단어들: out, 종류: 문장 ? '본문' : (b ? b.종류 : '') };
}

/** 단어 한 개 고치기 */
function 단어수정(비번, 단어장, 행, en, ko) {
  if (!선생님확인_(비번)) return { ok: false };
  var 막 = 과면막기_(단어장); if (막) return 막;
  if (!s_(en) || !s_(ko)) return { ok: false, 메시지: '영어와 뜻을 모두 적어 주세요.' };
  var sh = 단어시트_(단어장);
  if (!sh) return { ok: false, 메시지: '단어장을 찾을 수 없습니다.' };
  var n = Number(행);
  if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, 메시지: '없는 줄입니다. 새로고침 후 다시 시도해 주세요.' };
  sh.getRange(n, 2, 1, 2).setValues([[s_(en), s_(ko)]]);
  return { ok: true };
}

/** 단어 여러 개 삭제 */
function 단어삭제(비번, 단어장, 행들) {
  if (!선생님확인_(비번)) return { ok: false };
  var 막 = 과면막기_(단어장); if (막) return 막;
  var sh = 단어시트_(단어장);
  if (!sh) return { ok: false };
  var 목록 = (행들 || []).map(Number).filter(function (n) {
    return n >= 2 && n <= sh.getLastRow();
  }).sort(function (a, b) { return b - a; });
  목록.forEach(function (n) { sh.deleteRow(n); });
  번호재정렬_(단어장);
  return { ok: true, 개수: 목록.length };
}

/** 단어 한 개 추가 (맨 뒤에) */
function 단어추가(비번, 단어장, en, ko) {
  if (!선생님확인_(비번)) return { ok: false };
  var 막 = 과면막기_(단어장); if (막) return 막;
  if (!s_(en) || !s_(ko)) return { ok: false, 메시지: '영어와 뜻을 모두 적어 주세요.' };
  var sh = 단어시트_(단어장);
  if (!sh) return { ok: false, 메시지: '단어장을 찾을 수 없습니다.' };
  sh.appendRow([Math.max(0, sh.getLastRow() - 1) + 1, s_(en), s_(ko)]);
  return { ok: true };
}

/* ================================================================
   단어 그림 — 선생님이 올린 그림 파일을 구글 드라이브에 넣고
   그 주소를 단어장 시트 「그림」 칸(D열)에 적어 둔다.
   이 그림은 유치부 화면에서 쓴다.
================================================================ */
var 그림폴더이름 = '해법 영단어 그림';

/** 그림을 모아 둘 드라이브 폴더 — 없으면 만들고, 링크가 있으면 누구나 보게 열어 둔다 */
function 그림폴더_() {
  var P = PropertiesService.getScriptProperties();
  var id = P.getProperty('그림폴더');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* 지워졌으면 새로 만든다 */ }
  }
  var it = DriveApp.getFoldersByName(그림폴더이름);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(그림폴더이름);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  P.setProperty('그림폴더', f.getId());
  return f;
}

/** 아이들 화면에서 바로 뜨는 주소 형태 */
function 그림주소_(id) {
  return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w400';
}

/** 시트에 「그림」 칸이 없으면 만들어 둔다 */
function 그림칸확보_(sh) { 넷째칸확보_(sh, ''); }

/** 넷째 칸을 만든다 — 보통은 「그림」, 본문 단어장은 「비고」(교과서 쪽수) */
function 넷째칸확보_(sh, 종류) {
  if (sh.getMaxColumns() < 4) sh.insertColumnsAfter(sh.getMaxColumns(), 4 - sh.getMaxColumns());
  if (!s_(sh.getRange(1, 4).getValue())) {
    sh.getRange(1, 4).setValue(문법장_(종류) ? '힌트·해설' : 본문장_(종류) ? '비고' : '그림')
      .setFontWeight('bold').setBackground('#EFF3F9');
    sh.setColumnWidth(4, 260);
  }
}

/** 파일 이름에서 군더더기를 뺀 짝짓기용 열쇠말 — cat_1.png, Cat (1).PNG 모두 'cat' */
function 열쇠말_(v) {
  return s_(v).toLowerCase().replace(/\.[^.]+$/, '').replace(/[\s_\-().0-9]/g, '');
}

/* 드라이브 권한이 없을 때 구글이 주는 말은 아이도 선생님도 못 알아본다.
   무엇을 해야 하는지로 바꿔 준다. */
var 그림권한안내 =
  '사진을 올릴 권한이 아직 없습니다.\n\n' +
  '스프레드시트 상단 메뉴 [해법 영단어] → [사진 올릴 권한 확인] 을 한 번 누르고,\n' +
  '구글이 묻는 창에서 [허용] 을 눌러 주세요.\n' +
  '그다음 앱스 스크립트에서 배포 → 배포 관리 → 새 버전 → 배포 를 하시면 됩니다.';

function 권한문제_(e) {
  var t = String((e && e.message) || e || '');
  return /permission|Permission|권한|PERMISSION_DENIED|authoriz/.test(t);
}

/** 선생님이 눌러서 드라이브 권한을 한 번에 받는 곳 (스프레드시트 메뉴) */
function 그림권한확인() {
  var 글;
  try {
    var f = 그림폴더_();
    var 수 = 0;
    var it = f.getFiles();
    while (it.hasNext() && 수 < 1000) { it.next(); 수++; }
    글 = '사진을 올릴 수 있습니다.\n\n' +
         '그림 폴더: ' + f.getName() + '\n' +
         '지금 들어 있는 그림: ' + 수 + '장\n' +
         '폴더 주소: ' + f.getUrl() + '\n\n' +
         '이제 배포 → 배포 관리 → 수정 → 새 버전 을 한 뒤\n' +
         '선생님 화면 [자료 → 단어장] 에서 그림을 올려 보세요.';
  } catch (e) {
    글 = 권한문제_(e)
      ? ('아직 드라이브 권한이 없습니다.\n\n' +
         '왼쪽 ⚙ 프로젝트 설정에서\n' +
         '[appsscript.json 매니페스트 파일을 편집기에 표시] 를 켜고,\n' +
         'oauthScopes 에 아래 한 줄을 넣어 주세요.\n\n' +
         '  "https://www.googleapis.com/auth/drive"\n\n' +
         '넣은 뒤 이 메뉴를 다시 누르면 구글이 허용 창을 띄웁니다.\n\n' +
         '(구글이 준 말: ' + String((e && e.message) || e) + ')')
      : ('확인하지 못했습니다: ' + String((e && e.message) || e));
  }
  Logger.log(글);
  try {
    SpreadsheetApp.getUi().alert('해법 영단어 · 사진 권한', 글,
      SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e2) { /* 편집기에서 실행하면 화면이 없다 — 로그로 충분하다 */ }
  return 글;
}

/** base64 그림 한 장을 드라이브에 넣고 주소를 준다 */
function 그림저장_(단어장, 이름, 자료, 종류) {
  var b = String(자료 || '');
  var 쉼 = b.indexOf(',');
  if (b.indexOf('data:') === 0 && 쉼 > -1) b = b.slice(쉼 + 1);
  if (!b) throw new Error('그림이 비어 있습니다.');
  var 파일이름 = s_(단어장).replace(/[\\/:*?"<>|]/g, '') + '_' +
    s_(이름).replace(/[\\/:*?"<>|]/g, '');
  var blob = Utilities.newBlob(Utilities.base64Decode(b), s_(종류) || 'image/png', 파일이름);
  var f = 그림폴더_().createFile(blob);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return 그림주소_(f.getId());
}

/** 단어 한 줄에 그림 붙이기 */
function 그림올리기(비번, 단어장, 행, 이름, 자료, 종류) {
  if (!선생님확인_(비번)) return { ok: false };
  var 막 = 과면막기_(단어장); if (막) return 막;
  var sh = 단어시트_(단어장);
  if (!sh) return { ok: false, 메시지: '단어장을 찾을 수 없습니다.' };
  var n = Number(행);
  if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, 메시지: '없는 줄입니다. 새로고침 후 다시 해 주세요.' };
  var 주소;
  try {
    주소 = 그림저장_(단어장, 이름, 자료, 종류);
  } catch (e) {
    return { ok: false, 메시지: 권한문제_(e) ? 그림권한안내 : String((e && e.message) || e) };
  }
  그림칸확보_(sh);
  sh.getRange(n, 4).setValue(주소);
  return { ok: true, 주소: 주소 };
}

/** 그림 빼기 (드라이브 파일은 그대로 두고 칸만 비운다) */
function 그림지우기(비번, 단어장, 행) {
  if (!선생님확인_(비번)) return { ok: false };
  var 막 = 과면막기_(단어장); if (막) return 막;
  var sh = 단어시트_(단어장);
  if (!sh) return { ok: false, 메시지: '단어장을 찾을 수 없습니다.' };
  var n = Number(행);
  if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, 메시지: '없는 줄입니다.' };
  if (sh.getMaxColumns() >= 4) sh.getRange(n, 4).setValue('');
  return { ok: true };
}

/**
 * 그림 여러 장을 파일 이름으로 단어와 맞춰 붙인다.
 * cat.png → 영어가 cat 인 줄. 대소문자·띄어쓰기·밑줄·번호는 가려 보지 않는다.
 * 짝을 못 찾은 파일 이름은 그대로 돌려준다.
 */
function 그림여러개(비번, 단어장, 그림들) {
  if (!선생님확인_(비번)) return { ok: false };
  var 막 = 과면막기_(단어장); if (막) return 막;
  var sh = 단어시트_(단어장);
  if (!sh) return { ok: false, 메시지: '단어장을 찾을 수 없습니다.' };
  var last = sh.getLastRow();
  if (last < 2) return { ok: false, 메시지: '단어장에 단어가 없습니다.' };
  그림칸확보_(sh);

  var 영어 = sh.getRange(2, 2, last - 1, 1).getValues();
  var 표 = {};
  영어.forEach(function (r, i) {
    var k = 열쇠말_(r[0]);
    if (k && !표[k]) 표[k] = i + 2;
  });

  var 붙인 = 0, 못찾은 = [], 탈 = null;
  (그림들 || []).forEach(function (g) {
    if (탈) return;
    var 행 = 표[열쇠말_(g && g.이름)];
    if (!행) { 못찾은.push(s_(g && g.이름)); return; }
    try {
      sh.getRange(행, 4).setValue(그림저장_(단어장, g.이름, g.자료, g.종류));
      붙인++;
    } catch (e) {
      탈 = 권한문제_(e) ? 그림권한안내 : String((e && e.message) || e);
    }
  });
  if (탈) return { ok: false, 메시지: 탈, 붙인수: 붙인 };
  return { ok: true, 붙인수: 붙인, 못찾은: 못찾은 };
}

/** 단어장 이름 바꾸기 (숙제에 걸린 이름도 함께 바꾼다) */
function 단어장이름변경(비번, 옛이름, 새이름) {
  if (!선생님확인_(비번)) return { ok: false };
  var 옛 = s_(옛이름), 새 = s_(새이름);
  if (!새) return { ok: false, 메시지: '새 이름을 적어 주세요.' };
  if (옛 === 새) return { ok: true, 단어장목록: 단어장목록() };
  if (단어장찾기_(새)) return { ok: false, 메시지: '같은 이름의 단어장이 이미 있습니다.' };

  var b = 단어장찾기_(옛);
  if (!b) return { ok: false, 메시지: '단어장을 찾을 수 없습니다.' };

  목록시트_().getRange(b.행, 1).setValue(새);
  var sh = ss_().getSheetByName(b.시트);
  if (sh) {
    try {
      var 새시트 = 시트이름만들기_(새);
      sh.setName(새시트);
      목록시트_().getRange(b.행, 3).setValue(새시트);
    } catch (e) { /* 시트 이름은 못 바꿔도 자료는 그대로다 */ }
  }

  // 숙제에 걸린 이름도 같이 바꾼다
  var hs = sheet_(SHEET.숙제);
  var hl = hs.getLastRow();
  if (hl >= 2) {
    var hr = hs.getRange(2, 2, hl - 1, 1);
    var hv = hr.getValues();
    for (var j = 0; j < hv.length; j++) if (s_(hv[j][0]) === 옛) hv[j][0] = 새;
    hr.setValues(hv);
  }
  배정정리_(옛, 새);          // 학생별 배정에 적힌 이름도 같이
  return { ok: true, 단어장목록: 단어장목록() };
}

/** 단어장 통째로 삭제 (시트와 숙제까지 함께) */
function 단어장삭제(비번, 단어장) {
  if (!선생님확인_(비번)) return { ok: false };
  var 이름 = s_(단어장);
  var b = 단어장찾기_(이름);
  if (!b) return { ok: false, 메시지: '단어장을 찾을 수 없습니다.' };

  var 지운단어 = 0;
  var sh = ss_().getSheetByName(b.시트);
  if (sh) {
    지운단어 = Math.max(0, sh.getLastRow() - 1);
    ss_().deleteSheet(sh);
  }
  목록시트_().deleteRow(b.행);

  var hs = sheet_(SHEET.숙제);
  var hall = rows_(SHEET.숙제);
  var 지운숙제 = 0;
  for (var j = hall.length - 1; j >= 0; j--) {
    if (s_(hall[j][1]) === 이름) { hs.deleteRow(j + 2); 지운숙제++; }
  }
  배정정리_(이름, '');        // 학생별 배정에서도 빼 준다
  return { ok: true, 단어: 지운단어, 숙제: 지운숙제, 단어장목록: 단어장목록() };
}

function 번호재정렬_(단어장) {
  var sh = 단어시트_(단어장);
  if (!sh) return;
  var last = sh.getLastRow();
  if (last < 2) return;
  var n = [];
  for (var i = 0; i < last - 1; i++) n.push([i + 1]);
  sh.getRange(2, 1, n.length, 1).setValues(n);
}

/** 학생 명단 한 번에 등록 */
function 학생붙여넣기(비번, 본문, 기본비번, 학년구분, 학년, 학교, 교재) {
  if (!선생님확인_(비번)) return { ok: false };
  var 이름들 = String(본문 || '').split(/[\n,]/)
    .map(function (x) { return x.trim(); })
    .filter(function (x) { return x; });
  if (!이름들.length) return { ok: false, 메시지: '이름이 없습니다.' };

  var 있는것 = {};
  전체명단_().forEach(function (n) { 있는것[n] = 1; });
  var 겹침 = [];
  var sh = sheet_(SHEET.학생);
  var 값 = [];
  이름들.forEach(function (n) {
    var p = n.split(/\s+/);
    var 이름 = p[0];
    if (있는것[이름]) { 겹침.push(이름); return; }   // 이름으로 로그인하니 겹치면 안 된다
    있는것[이름] = 1;
    var pw = p[1] || s_(기본비번) || '1234';
    값.push(['', 이름, pw, 학년구분_(학년구분), '', s_(학년), s_(학교), 교재글_(교재)]);
  });
  if (!값.length) {
    return { ok: false, 메시지: '이미 있는 이름뿐입니다: ' + 겹침.join(', ') };
  }
  명단칸확보_();
  sh.getRange(sh.getLastRow() + 1, 1, 값.length, 8).setValues(값);
  SpreadsheetApp.flush();
  /* 넣은 다음 명단을 다시 부르지 않아도 되게 여기서 같이 돌려준다 */
  return { ok: true, 개수: 값.length, 겹침: 겹침, 학생: 명단가져오기(비번).학생 };
}

/* ================================================================
   학부모 — 아이마다 비밀 링크로 학습 현황을 본다 (읽기만)
   · 링크: …/Vocab/parent.html#k=토큰. 토큰은 학생 시트 「학부모링크」 칸(9번째)에 적는다.
   · 토큰은 「#」 뒤(해시)에 둔다. 「?k=」 처럼 물음표 뒤에 두면 서버 기록이나 바깥 사이트(Referer)로
     새어 나갈 수 있다. 해시는 브라우저 밖으로 안 나간다. 링크에 아이 이름도 넣지 않는다.
   · 토큰으로는 읽기만 된다. 쓰는 기능은 지금처럼 선생님 비번(선생님확인_)으로만 돈다.
   · 틀리면 왜 틀렸는지 말하지 않는다 — 없는 토큰·막힌 토큰·모양이 틀린 토큰이 모두 같은 답.
     가려지면 찍어서 맞힐 수 있다.
   · 돌려주는 값에는 그 아이 것만 — 다른 아이 이름·등수·반 평균은 안 보낸다 (원장님이 안 보여 주기로 하셨다).
   · 다시 발급하면 옛 토큰은 그 자리에서 막힌다 (단톡방에 잘못 올라갔을 때).
================================================================ */
var 학부모칸_ = ['학부모링크', '학부모마지막', '선생님한마디'];     // 학생 시트 9 · 10 · 11번째 칸
var 학부모주소기본_ = 'https://smarthb-english.github.io/Vocab/parent.html';
var 학부모틀림_ = '링크가 맞지 않습니다. 선생님께 문의해 주세요.';
var 학부모캐시초_ = 60;

/** 학생 시트에 학부모 칸 셋이 없으면 넓혀 머리글을 붙인다 (보태기만 — 있는 머리글은 안 건드린다) */
function 학부모칸확보_() {
  var sh = 명단칸확보_();
  if (typeof sh.getMaxColumns === 'function' && sh.getMaxColumns() < 11) {
    sh.insertColumnsAfter(sh.getMaxColumns(), 11 - sh.getMaxColumns());
  }
  학부모칸_.forEach(function (이름, i) {
    var 칸 = sh.getRange(1, 9 + i);
    if (s_(칸.getValue()) === '') 칸.setValue(이름).setFontWeight('bold').setBackground('#EFF3F9');
  });
  return sh;
}

/* 추측할 수 없는 토큰 — UUID 둘(각 122비트 난수)을 한 글자씩 엇갈려 섞는다.
   UUID 의 버전 자리(늘 같은 글자)가 한곳에 몰리지 않게 하나는 거꾸로 넣는다. 64자 */
function 학부모토큰새로_() {
  var a = Utilities.getUuid().replace(/-/g, '').toLowerCase();
  var b = Utilities.getUuid().replace(/-/g, '').toLowerCase();
  var t = '';
  for (var i = 0; i < a.length; i++) t += a.charAt(i) + b.charAt(b.length - 1 - i);
  return t;
}
function 토큰모양_(t) { return /^[0-9a-f]{32,128}$/.test(s_(t)); }
function 학부모주소_(토큰) { return s_(setting_('학부모주소', 학부모주소기본_)) + '#k=' + 토큰; }

/* 토큰 → 학생 줄. 못 찾으면 null — 왜 못 찾았는지는 밖에 안 알린다 */
function 토큰학생_(토큰) {
  토큰 = s_(토큰).toLowerCase();
  if (!토큰모양_(토큰)) return null;
  var 줄들 = rows_(SHEET.학생);
  for (var i = 0; i < 줄들.length; i++) {
    var x = 줄들[i];
    if (x.length > 8 && s_(x[8]).toLowerCase() === 토큰 && s_(x[1])) return { 행: i + 2, 이름: s_(x[1]), x: x };
  }
  return null;
}
function 학부모캐시버리기_(토큰) {
  var c = 캐시_(); if (!c || !s_(토큰)) return;
  try { c.remove('학부모|' + s_(토큰).toLowerCase()); } catch (e) {}
}

/**
 * 학부모 화면 — 토큰 하나로 그 아이 것만.
 * 알림만 = true 면 (알림 일꾼이 부를 때) 이름과 안 낸 숙제 수만 주고, 「본 때」 도 안 적는다.
 */
function 학부모보기(토큰, 알림만) {
  var 틀림 = { ok: false, 메시지: 학부모틀림_ };
  토큰 = s_(토큰).toLowerCase();
  if (!토큰모양_(토큰)) return 틀림;
  var 열쇠 = '학부모|' + 토큰;
  var r = 캐시읽기_(열쇠);
  if (!(r && r.ok)) {
    var 찾은 = 토큰학생_(토큰);
    if (!찾은) return 틀림;
    /* 원장님이 「보셨는지」 아실 수 있게. 담아 둔 것을 줄 때(60초 안)는 다시 안 적는다 */
    if (!알림만) { try { 학부모칸확보_().getRange(찾은.행, 10).setValue(new Date()); } catch (e) {} }
    r = 학부모자료_(찾은.이름, 찾은.x);
    캐시담기_(열쇠, r, 학부모캐시초_);
  }
  if (알림만) return { ok: true, 이름: r.이름, 안낸수: r.안낸수 };
  return r;
}

/** 선생님 — 학부모 링크를 새로 만든다. 옛 링크는 그 자리에서 막힌다 */
function 학부모링크발급(비번, 이름) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  이름 = s_(이름);
  var sh = 학부모칸확보_();
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { ok: false, 메시지: '잠시 후 다시 시도해 주세요' }; }
  try {
    var 줄들 = rows_(SHEET.학생), n = 0, 옛 = '';
    for (var i = 0; i < 줄들.length; i++) if (s_(줄들[i][1]) === 이름) { n = i + 2; 옛 = 줄들[i].length > 8 ? s_(줄들[i][8]) : ''; break; }
    if (!n) return { ok: false, 메시지: '학생을 찾지 못했습니다.' };
    var 새 = 학부모토큰새로_();
    sh.getRange(n, 9).setValue(새);
    sh.getRange(n, 10).setValue('');          // 새 링크로는 아직 아무도 안 봤다
    학부모캐시버리기_(옛);                     // 담아 둔 옛 토큰 답도 바로 버린다 — 60초도 열어 두지 않는다
    return { ok: true, 이름: 이름, 주소: 학부모주소_(새) };
  } finally { lock.releaseLock(); }
}

/** 선생님 — 「선생님 한마디」. 200자까지, 빈 글이면 지운다 */
function 학부모한마디(비번, 이름, 글) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  이름 = s_(이름); 글 = s_(글);
  if (글.length > 200) return { ok: false, 메시지: '한마디는 200자까지 적을 수 있어요. (지금 ' + 글.length + '자)' };
  var sh = 학부모칸확보_();
  var 줄들 = rows_(SHEET.학생);
  for (var i = 0; i < 줄들.length; i++) {
    if (s_(줄들[i][1]) !== 이름) continue;
    sh.getRange(i + 2, 11).setValue(글);
    학부모캐시버리기_(줄들[i].length > 8 ? 줄들[i][8] : '');     // 어머님이 바로 보시게
    return { ok: true, 이름: 이름, 한마디: 글 };
  }
  return { ok: false, 메시지: '학생을 찾지 못했습니다.' };
}

/** 선생님 — 학부모가 보는 것과 같은 자료 (「이번 주 요약 문자」 용). 「본 때」 는 안 적는다 */
function 학부모미리보기(비번, 이름) {
  if (!선생님확인_(비번)) return { ok: false, 메시지: '비밀번호가 다릅니다.' };
  이름 = s_(이름);
  var 줄들 = rows_(SHEET.학생);
  for (var i = 0; i < 줄들.length; i++) if (s_(줄들[i][1]) === 이름) return 학부모자료_(이름, 줄들[i]);
  return { ok: false, 메시지: '학생을 찾지 못했습니다.' };
}

/* 한 아이 것만 모은다 — 숙제는 그 아이 것(숙제가져오기_), 기록은 그 이름의 줄만 남기고 바로 버린다.
   돌려주는 칸을 하나하나 골라 담는다 — 숙제 줄의 대상 학생 명단 같은 것이 딸려 나가지 않게 */
function 학부모자료_(이름, x) {
  return 읽는동안_(function () {
    var 지금 = new Date(), 오늘 = ymd_(지금);
    var 월 = new Date(지금.getTime()); 월.setHours(0, 0, 0, 0); 월.setDate(월.getDate() - ((월.getDay() + 6) % 7));
    var 월요일 = ymd_(월);
    var 짧은날 = function (ymd) { var p = String(ymd).split('-'); return Number(p[1]) + '/' + Number(p[2]); };

    /* 숙제 — 이번 주(월요일부터) 마감인 것. 종류 「시험」 은 숙제가 아니라 아래 시험 묶음으로.
       숙제에는 점수를 담지 않는다 — 냈나 안 냈나만 (합격점을 못 넘겼으면 「다시 하고 있어요」). 진도는 지금까지 낸 숙제 전부로 */
    var 전부 = 숙제가져오기_(이름, '');
    function 제목(h) { return h.단어장 + (h.칸 ? ' ' + h.칸 : '') + ' ' + h.시작 + '~' + h.끝; }
    var 이번주 = 전부.filter(function (h) { return 숙제인가_(h) && (h.마감일 || h.등록일 || '') >= 월요일; }).map(function (h) {
      var 다시 = !h.완료 && (h.단계 ? Number(h.응시수) > 0 : !!h.모자람);
      return { 제목: 제목(h), 유형: 유형알맹이_(h.유형), 종류: h.종류, 완료: !!h.완료, 다시: 다시,
               마감일: h.마감일 || '', 마감글: h.마감일 ? 짧은날(h.마감일) : '',
               오늘까지: h.마감일 === 오늘, 지남: !!(h.마감일 && h.마감일 < 오늘) };
    });
    /* 아직 안 본 시험 (종류 「시험」 인 줄) — 이번 주부터 앞으로 */
    var 볼시험 = 전부.filter(function (h) { return 시험인가_(h) && !h.완료 && (h.마감일 || '') >= 월요일; }).map(function (h) {
      return { 날짜: h.마감일 ? 짧은날(h.마감일) : '', 단어장: h.단어장 + (h.칸 ? ' ' + h.칸 : ''), 범위: h.시작 + '~' + h.끝,
               유형: 유형알맹이_(h.유형), 점수: null, 봤나: false, 지남: !!(h.마감일 && h.마감일 < 오늘) };
    });
    /* 안 낸 것을 위로, 그 안에서는 마감이 이른 것부터 */
    이번주.sort(function (a, b) {
      if (a.완료 !== b.완료) return a.완료 ? 1 : -1;
      return (a.마감일 || '9') < (b.마감일 || '9') ? -1 : (a.마감일 || '9') > (b.마감일 || '9') ? 1 : 0;
    });

    /* 기록 — 그 이름의 줄만. 오답 다시 풀기는 시험이 아니다 */
    var 내기록 = [];
    읽기캐시_(SHEET.기록).forEach(function (r) {
      if (!(r[0] instanceof Date) || s_(r[2]) !== 이름 || s_(r[14]) === 재시험표시) return;
      내기록.push(r);
    });
    내기록.sort(function (a, b) { return b[0].getTime() - a[0].getTime(); });
    /* 시험 — 학원에서 본 시험 기록(구분 「시험」)만. 숙제로 푼 기록의 점수는 여기 안 넣는다 */
    var 본시험 = 내기록.filter(function (r) { return s_(r[14]) === 시험표시; }).slice(0, 8).map(function (r) {
      return { 날짜: 짧은날(ymd_(r[0])), 단어장: s_(r[3]), 범위: s_(r[4]), 유형: s_(r[5]), 점수: Number(r[8]) || 0, 봤나: true };
    });

    /* 자주 틀리는 단어 — 최근 30일, 두 번 이상 틀린 것만 많은 순으로 10개 */
    var 기준 = new Date(지금.getTime() - 30 * 86400000), 셈 = {};
    내기록.forEach(function (r) {
      if (r[0] < 기준) return;
      틀린칸풀기_(r[13]).forEach(function (w) {
        var k = w.toLowerCase();
        (셈[k] = 셈[k] || { 단어: w, 번: 0 }).번++;
      });
    });
    var 자주틀린 = Object.keys(셈).map(function (k) { return 셈[k]; })
      .filter(function (w) { return w.번 >= 2; })
      .sort(function (a, b) { return b.번 - a.번; }).slice(0, 10);

    /* 진도 — 단어장(과면 구분)마다 지금까지 낸 숙제의 가장 뒤 번호 / 전체 (최근에 낸 것 셋) */
    var 책들 = {};
    단어장목록().forEach(function (b) { 책들[b.이름] = b; });
    var 진 = {};
    전부.forEach(function (h) {
      if (누적인가_(h.유형) || 시험인가_(h)) return;
      var k = h.단어장 + '|' + (h.칸 || '');
      var v = (진[k] = 진[k] || { 단어장: h.단어장, 칸: h.칸 || '', 끝: 0, 등록: '' });
      if ((Number(h.끝) || 0) > v.끝) v.끝 = Number(h.끝) || 0;
      if ((h.등록일 || '') > v.등록) v.등록 = h.등록일 || '';
    });
    var 진도 = Object.keys(진).map(function (k) { return 진[k]; })
      .sort(function (a, b) { return a.등록 < b.등록 ? 1 : a.등록 > b.등록 ? -1 : 0; })
      .slice(0, 3).map(function (v) {
        var b = 책들[v.단어장] || {};
        var 총 = (v.칸 && b.칸수) ? (Number(b.칸수[v.칸]) || 0) : (Number(b.개수) || 0);
        return { 단어장: v.단어장, 칸: v.칸, 끝: 총 ? Math.min(v.끝, 총) : v.끝, 총: 총 };
      });

    return {
      ok: true,
      이름: 이름,
      오늘: 짧은날(오늘),
      한마디: x && x.length > 10 ? s_(x[10]) : '',
      이번주숙제: 이번주,
      낸수: 이번주.filter(function (h) { return h.완료; }).length,       // 숙제만 센다 — 시험은 안 섞는다
      안낸수: 이번주.filter(function (h) { return !h.완료; }).length,
      시험: 볼시험.concat(본시험),                                       // 앞으로 볼 것 → 본 것(최근부터)
      자주틀린: 자주틀린,
      진도: 진도,
      학원: { 이름: s_(setting_('학원이름', '홍제인왕해법영어')), 전화: s_(setting_('학원전화', '')) }
    };
  });
}
