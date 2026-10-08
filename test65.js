/* Code.gs 알맹이 시험 — 반 칸이 비어도 명단에서 안 사라진다
   브라우저 없이 Code.gs 를 그대로 읽어 함수만 불러 본다 */
const fs = require('fs');
const vm = require('vm');

let 실패 = 0;
function 확인(이름, 실제, 기대) {
  const ok = JSON.stringify(실제) === JSON.stringify(기대);
  if (!ok) 실패++;
  console.log((ok ? '  OK  ' : '  ✗   ') + 이름 + ': ' + JSON.stringify(실제) +
    (ok ? '' : '  (기대: ' + JSON.stringify(기대) + ')'));
}

const 칸 = { SpreadsheetApp: { flush() {} }, PropertiesService: {}, DriveApp: {}, Utilities: {},
  Logger: { log() {} }, console };
vm.createContext(칸);
vm.runInContext(fs.readFileSync(require('path').join(__dirname, 'Code.gs'), 'utf8'), 칸);

/* 시트 대신 우리가 만든 줄을 준다
   [반, 이름, 비번, 학년구분, 볼수있는단어장, 학년, 학교, 교재] */
const 줄들 = [
  ['초등A', '옛날학생', '1234', '초중등', '', '초5', '인왕초', '중2 능률'],
  ['',      '오늘넣은아이', '5678', '초중등', '', '초4', '인왕초', '중2 능률'],  // 명단 넣기로 들어온 줄
  ['',      '유치아이', '1234', '유치', '', '7세', '인왕유치원', '유치부-1학기'],
  ['',      '',        '',     '',      '', '',   '',        ''],               // 빈 줄
];
칸.선생님확인_ = () => true;
칸.명단칸확보_ = () => ({ getMaxColumns: () => 8 });
칸.배정칸확보_ = 칸.명단칸확보_;
칸.rows_ = () => 줄들;
칸.단어장목록 = () => [];

console.log('— 명단가져오기 —');
const r = 칸.명단가져오기('1234');
확인('불러온다', r.ok, true);
확인('반이 비어도 다 나온다', r.학생.map(x => x.이름),
  ['옛날학생', '오늘넣은아이', '유치아이']);
확인('빈 줄은 안 나온다', r.학생.length, 3);
확인('줄 번호가 맞다', r.학생.map(x => x.행), [2, 3, 4]);
확인('교재가 붙어 온다',
  r.학생.map(x => x.교재.join(',')), ['중2 능률', '중2 능률', '유치부-1학기']);
확인('학년구분도 온다', r.학생.map(x => x.학년구분), ['초중등', '초중등', '유치']);
확인('비어 있던 반은 빈 칸으로', r.학생[1].반, '');

console.log('\n— 배정가져오기도 같다 —');
const a = 칸.배정가져오기('1234');
확인('반이 비어도 다 나온다', a.학생.map(x => x.이름),
  ['옛날학생', '오늘넣은아이', '유치아이']);

console.log('\n— 반별명단_ 은 반이 있는 줄만 (옛 숙제용) —');
확인('옛날 반만 잡힌다', 칸.반별명단_(), { '초등A': ['옛날학생'] });

console.log('\n— 교재로 대상을 찾을 때도 다 잡힌다 —');
확인('중2 능률을 배우는 학생', 칸.교재학생_('중2 능률'), ['옛날학생', '오늘넣은아이']);
확인('전체 명단', 칸.전체명단_(), ['옛날학생', '오늘넣은아이', '유치아이']);

console.log('\n— 로그인도 된다 —');
확인('오늘 넣은 아이가 들어온다', 칸.로그인('오늘넣은아이', '5678').ok, true);
확인('비번이 다르면 막는다', 칸.로그인('오늘넣은아이', '0000').ok, false);

console.log('\n— 사진 올릴 권한이 아직 없을 때 —');
/* 구글이 내는 말 그대로 흉내 낸다 */
const 권한탈 = () => {
  throw new Error('You do not have permission to call DriveApp.getFoldersByName. ' +
    'Required permissions: https://www.googleapis.com/auth/drive');
};
칸.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) };
칸.Utilities = { base64Decode: () => [1, 2, 3], newBlob: () => ({}) };
칸.DriveApp = { getFoldersByName: 권한탈, createFolder: 권한탈, getFolderById: 권한탈 };
const 가짜시트 = {
  getLastRow: () => 4, getMaxColumns: () => 8,
  getRange: () => ({ getValue: () => '그림', setValue() { return this; },
                     setFontWeight() { return this; }, setBackground() { return this; },
                     getValues: () => [['bag'], ['boy'], ['cut']] }),
  setColumnWidth() {}, insertColumnsAfter() {}
};
칸.단어시트_ = () => 가짜시트;

const g = 칸.그림올리기('1234', '어떤 단어장', 2, 'cat.png', 'AAAA', 'image/png');
확인('올리지 못한다', g.ok, false);
확인('무엇을 눌러야 하는지 알려 준다', /사진 올릴 권한 확인/.test(g.메시지), true);
확인('구글 영어 말을 그대로 보여 주지 않는다', /do not have permission/.test(g.메시지), false);

const m = 칸.그림여러개('1234', '어떤 단어장', [{ 이름: 'bag.png', 자료: 'AAAA', 종류: 'image/png' }]);
확인('여러 장도 멈추고 알려 준다', [m.ok, /권한/.test(m.메시지)], [false, true]);

console.log('\n— 메뉴의 「사진 올릴 권한 확인」 —');
const w = 칸.그림권한확인();
확인('매니페스트에 넣을 줄을 그대로 알려 준다',
  w.indexOf('https://www.googleapis.com/auth/drive') > -1, true);
확인('어디를 켜야 하는지도 알려 준다', /매니페스트/.test(w), true);

/* 권한이 생기면 잘 되는지 */
칸.DriveApp = {
  getFoldersByName: () => ({ hasNext: () => false }),
  createFolder: () => 가짜폴더,
  getFolderById: () => { throw new Error('없음'); },
  Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 }
};
const 가짜폴더 = {
  getName: () => '해법 영단어 그림', getId: () => 'FOLDERID',
  getUrl: () => 'https://drive.google.com/drive/folders/FOLDERID',
  getFiles: () => ({ hasNext: () => false }),
  setSharing() { return this; },
  createFile: () => ({ getId: () => 'FILEID', setSharing() { return this; } })
};
console.log('\n— 권한이 생긴 뒤 —');
const ok = 칸.그림권한확인();
확인('올릴 수 있다고 알려 준다', /올릴 수 있습니다/.test(ok), true);
const g2 = 칸.그림올리기('1234', '어떤 단어장', 2, 'cat.png', 'AAAA', 'image/png');
확인('이제 올라간다', g2.ok, true);
확인('아이 화면에서 바로 뜨는 주소', g2.주소,
  'https://drive.google.com/thumbnail?id=FILEID&sz=w400');

console.log('\n— 파일 이름 맞추기 —');
확인('대소문자·번호·괄호를 가려 본다',
  ['cat.png', 'Cat (1).PNG', 'cat_2.jpg', 'CAT-3.jpeg'].map(칸.열쇠말_),
  ['cat', 'cat', 'cat', 'cat']);
확인('다른 단어는 안 섞인다', 칸.열쇠말_('cap.png'), 'cap');

console.log('\n— 조회 시트를 두 번 만들어도 안 넘어진다 —');
/* clear() 는 드롭다운 규칙을 안 지운다. 지난번 규칙이 남은 채로 B1 에 값을 넣으면
   구글이 「데이터 확인 규칙을 위반했습니다」 로 멈춘다 — 그 자리를 흉내 낸다. */
let 규칙남음 = true, 규칙걷음 = 0, 숨긴열 = null;
const 조회시트 = {
  getMaxRows: () => 1000, getMaxColumns: () => 30,
  clear() { /* 내용만 지운다 — 규칙은 그대로 남는다 */ return this; },
  clearConditionalFormatRules() {}, getFilter: () => null,
  setColumnWidth() {}, setFrozenRows() {},
  hideColumns(a, n) { 숨긴열 = [a, n]; },
  getRange(a1) {
    return {
      setValues(v) {
        if (규칙남음 && String(a1).indexOf('B1') === 0) {
          throw new Error('셀 B1에 입력한 데이터가 이 셀에 설정된 데이터 확인 규칙을 위반했습니다.');
        }
        return this;
      },
      clearDataValidations() { 규칙걷음++; 규칙남음 = false; return this; },
      setValue() { return this; }, setFormula() { return this; },
      setFontWeight() { return this; }, setBackground() { return this; },
      setFontColor() { return this; }, setDataValidation() { return this; }
    };
  }
};
칸.ss_ = () => ({
  getSheetByName: () => 조회시트, insertSheet: () => 조회시트,
  setActiveSheet() {}, toast() {}
});
칸.SpreadsheetApp = {
  flush() {},
  newDataValidation: () => ({
    requireValueInRange() { return this; }, setAllowInvalid() { return this; },
    build: () => ({})
  })
};
칸.조회만들기();
확인('지난번 드롭다운 규칙부터 걷어 낸다', 규칙걷음 > 0, true);
확인('목록 열 셋을 숨긴다 (Z·AA·AB)', 숨긴열, [26, 3]);

console.log('\n— 붙여넣기에 그림 주소를 같이 적을 수 있다 —');
확인('영어 | 뜻 | 그림주소',
  칸.줄나누기_('cat | 고양이 | https://smarthb-english.github.io/Vocab/img/cat.png'),
  ['cat', '고양이', 'https://smarthb-english.github.io/Vocab/img/cat.png']);
확인('data: 주소도 그림으로 본다',
  칸.줄나누기_('dog | 강아지 | data:image/png;base64,AAA')[2], 'data:image/png;base64,AAA');
확인('그림 없이도 그대로 된다', 칸.줄나누기_('apple | 사과'), ['apple', '사과']);
확인('뜻 안의 쉼표는 살아 있다', 칸.줄나누기_('number | 숫자, 번호'), ['number', '숫자, 번호']);
확인('그림이 아니면 뜻에 붙인다',
  칸.줄나누기_('go | 가다 | 움직이다'), ['go', '가다 | 움직이다']);
확인('엑셀에서 세 칸 복사해도 된다',
  칸.줄나누기_('bus\t버스\thttps://a/b/bus.png'), ['bus', '버스', 'https://a/b/bus.png']);
확인('한글만 있는 줄은 예전처럼', 칸.줄나누기_('pencil 연필'), ['pencil', '연필']);

console.log('\n— 그림이 섞인 단어장을 넣으면 네 칸으로 쓴다 —');
let 쓴것 = null, 그림칸만듦 = 0;
const 단어시트 = {
  getLastRow: () => 1, getMaxColumns: () => 3,
  insertColumnsAfter(a, n) { 그림칸만듦++; },
  setColumnWidth() {},
  getRange(r, c, nr, nc) {
    return {
      getValue: () => '',
      setValue() { return this; }, setFontWeight() { return this; }, setBackground() { return this; },
      setValues(v) { 쓴것 = { 폭: nc, 값: v }; return this; }
    };
  }
};
칸.단어장찾기_ = () => ({ 이름: '유치부-1학기', 종류: '', 시트: 'x', 행: 2 });
칸.ss_ = () => ({ getSheetByName: () => 단어시트 });
칸.단어장목록 = () => [];
const 넣기 = 칸.단어붙여넣기('1234', '유치부-1학기',
  'cat | 고양이 | https://a/img/cat.png\ndog | 강아지 | https://a/img/dog.png', false, '');
확인('두 개를 넣는다', 넣기.개수, 2);
확인('그림 수를 알려 준다', 넣기.그림수, 2);
확인('네 칸으로 쓴다', 쓴것.폭, 4);
확인('그림 주소가 네 번째 칸에', 쓴것.값[0], [1, 'cat', '고양이', 'https://a/img/cat.png']);

쓴것 = null;
const 넣기2 = 칸.단어붙여넣기('1234', '유치부-1학기', 'apple | 사과\nbus | 버스', false, '');
확인('그림이 없으면 세 칸 그대로', [넣기2.그림수, 쓴것.폭], [0, 3]);


console.log('\n— 교과서 본문 단어장 — 셋째 칸은 그림이 아니라 비고(쪽수) —');
확인('문장 | 해석 | 교과서 쪽수',
  칸.줄나누기_('He was thirsty and hungry. | 그는 목이 마르고 배가 고팠다. | 교과서 71쪽', '본문'),
  ['He was thirsty and hungry.', '그는 목이 마르고 배가 고팠다.', '교과서 71쪽']);
확인('쪽수 뒤에 소제목이 붙어도 된다',
  칸.줄나누기_('Today, we are going to see some artworks. | 오늘 우리는 작품을 볼 것이다. | ' +
             '교과서 88쪽 · Street Art in London', '본문')[2],
  '교과서 88쪽 · Street Art in London');
확인('비고가 없어도 된다',
  칸.줄나누기_('He was thirsty. | 그는 목이 말랐다.', '본문'),
  ['He was thirsty.', '그는 목이 말랐다.']);
확인('보통 단어장이면 셋째 칸을 뜻에 붙인다 (전과 같다)',
  칸.줄나누기_('He was thirsty. | 그는 목이 말랐다. | 교과서 71쪽'),
  ['He was thirsty.', '그는 목이 말랐다. | 교과서 71쪽']);
확인('숫자로 시작하는 문장도 안 깎인다',
  칸.줄나누기_('1919 was a hard year. | 1919년은 힘든 해였다. | 교과서 106쪽', '본문')[0],
  '1919 was a hard year.');
확인('번호를 붙여 놓으면 그건 떼어 낸다',
  칸.줄나누기_('12. He was thirsty. | 그는 목이 말랐다. | 교과서 71쪽', '본문')[0],
  'He was thirsty.');
확인('문장은 세로줄 없이 넣을 수 없다 — 가운데가 잘릴 일이 없다',
  칸.줄나누기_('He was thirsty 그는 목이 말랐다', '본문'), null);
확인('엑셀 세 칸도 비고로 받는다',
  칸.줄나누기_('He was thirsty.\t그는 목이 말랐다.\t교과서 71쪽', '본문'),
  ['He was thirsty.', '그는 목이 말랐다.', '교과서 71쪽']);
확인('본문장_ 은 종류로만 가린다',
  [칸.본문장_('본문'), 칸.본문장_('3단변화'), 칸.본문장_('')], [true, false, false]);

console.log('\n— 본문 단어장을 넣으면 넷째 칸 머리글이 「비고」 —');
let 머리글 = null;
const 본문시트 = {
  getLastRow: () => 1, getMaxColumns: () => 3,
  insertColumnsAfter() {}, setColumnWidth() {},
  getRange(r, c, nr, nc) {
    return {
      getValue: () => '',
      setValue(v) { if (r === 1 && c === 4) 머리글 = v; return this; },
      setFontWeight() { return this; }, setBackground() { return this; },
      setValues(v) { 쓴것 = { 폭: nc, 값: v }; return this; }
    };
  }
};
칸.단어장찾기_ = () => ({ 이름: '중3 4과 본문', 종류: '본문', 시트: 'x', 행: 2 });
칸.ss_ = () => ({ getSheetByName: () => 본문시트 });
쓴것 = null;
const 넣기3 = 칸.단어붙여넣기('1234', '중3 4과 본문',
  'He was thirsty and hungry. | 그는 목이 마르고 배가 고팠다. | 교과서 71쪽\n' +
  "Stanley's heart beat even faster. | Stanley의 심장이 훨씬 더 빨리 뛰었다. | 교과서 75쪽",
  false, '본문');
확인('두 문장을 넣는다', 넣기3.개수, 2);
확인('네 칸으로 쓴다', 쓴것.폭, 4);
확인('넷째 칸 머리글은 「비고」', 머리글, '비고');
확인('쪽수가 네 번째 칸에', 쓴것.값[0],
  [1, 'He was thirsty and hungry.', '그는 목이 마르고 배가 고팠다.', '교과서 71쪽']);

console.log('\n— 학생 화면으로 보낼 때 본문은 그림이 아니라 비고 —');
function 단어읽기(종류, 넷째) {
  칸.단어장찾기_ = () => ({ 이름: 'x', 종류: 종류, 시트: 'sh', 행: 2 });
  칸.ss_ = () => ({ getSheetByName: () => ({
    getLastRow: () => 2, getLastColumn: () => 4,
    getRange: () => ({ getValues: () => [[1, 'apple', '사과', 넷째]] })
  }) });
  return 칸.단어가져오기('x')[0];
}
const 본문낱말 = 단어읽기('본문', '교과서 88쪽');
확인('본문은 비고로 온다', [본문낱말.비고, 본문낱말.그림], ['교과서 88쪽', undefined]);
확인('종류도 같이 온다', 본문낱말.종류, '본문');
const 보통낱말 = 단어읽기('', 'https://a/img/apple.png');
확인('보통 단어장은 그림으로 온다',
  [보통낱말.그림, 보통낱말.비고], ['https://a/img/apple.png', undefined]);

console.log(실패 ? '\n✗ ' + 실패 + '개 실패' : '\n전부 통과');
process.exit(실패 ? 1 : 0);
