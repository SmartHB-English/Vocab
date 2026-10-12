# 영단어학습프로그램 — 고칠 때 지킬 것

## 화면 셋
- `index.html` — 학생 화면 (폰 앱 번들에도 들어간다)
- `teacher.html` — 선생님 화면. 컴퓨터·태블릿의 브라우저로 연다. 설치형이 아니다 (manifest · 서비스워커 · 푸시 없음)
- `parent.html` — 학부모 화면

## 공용 코드는 원본 한 곳에서 고치고 박아 넣는다
- 두 화면이 같이 쓰는 JS 는 `services/shared-ui.js`, CSS 는 `services/shared-ui.css`, 서버 부르기는 `services/api-client.js`.
- HTML 안의 `/* BEGIN GENERATED … */ … /* END GENERATED … */` 사이는 **손으로 고치지 않는다.**
  원본을 고친 뒤 `node scripts/build-services.mjs`. 어긋나면 `npm test` 첫 줄(`--check`)이 떨어진다.
- 어느 파일에 박히는지는 `scripts/build-services.mjs` 의 짝 목록이 정한다.
- 같은 함수를 `index.html` 과 `teacher.html` 에 **따로 두지 않는다.** 양쪽이 쓰면 `shared-ui.js` 로 올린다
  (`tests/teacher-split.test.mjs` 가 겹치는 이름을 잡는다). 페이지마다 따로 두는 것은 `var 창구주소` 하나뿐이다.
- `var 창구주소` 는 공용 블록(`shared-ui.js`)보다 **앞에** 둔다 — 블록 안의 `GAS` 가 그것을 읽는다.
- `var 앱버전` 은 이제 `services/shared-ui.js` 에 있다 (올린 뒤 build-services). `build-app.mjs` 는 박힌 `index.html` 에서 읽는다.
- `services/shared-ui.js` 맨 끝은 서버 부르기(`var 부르는중_ = 0;` ~ `부르기_`)다. 그 뒤에 아무것도 붙이지 않는다 —
  `tests/legacy-rpc` · `rpc-parity` 가 `index.html` 에서 거기부터 「상태」 주석까지 떼어 돌린다.

## 「수업 짜기 공용」 블록 — Code.gs 와 글자 하나 다르지 않다
- `/* ==== 수업 짜기 공용 시작 … */` ~ `/* ==== 수업 짜기 공용 끝 ==== */` 블록은
  `tests/fixtures/legacy/Code.gs` 와 `services/shared-ui.js`(→ `index.html` · `teacher.html` 에 박힘)에 **똑같이** 들어 있다.
  서버는 진짜 기록으로, 화면의 미리보기는 흉내 자료로 같은 규칙을 돌린다.
- 고칠 때는 **두 곳을 같이** 고친다. 블록 머리 주석의 「index.html」 이라는 말은 Code.gs 와 맞추느라 그대로 둔 것이다.
- `tests/teacher-split.test.mjs` 가 세 곳을 맞대어 본다. Code.gs 를 고치면 `firestore.bundle.js` 를 다시 만들고 GAS 도 다시 배포해야 한다.

## 폰 앱(Capacitor)
- `scripts/build-app.mjs` 의 `FILES` 에 `teacher.html` 을 **넣지 않는다.**
  앱의 선생님 입구는 `https://smarthb-english.github.io/Vocab/teacher.html` 을 바깥 브라우저로 연다 (`index.html` 의 `선생님화면열기_`).
