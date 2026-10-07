# 기존 웹 API 호출 후보 목록

생성: `node scripts/api-inventory.mjs`

정적 리터럴 후보만 수집한다. 동적 호출·주석과 서버의 전체 디스패처는 수동 대조가 필요하다. 실제 사용자 데이터나 서버 응답은 수집하지 않는다.

호출 주체: index.html, parent.html, sw.js, parent-sw.js. 고유 후보: 73개.

| 함수 | 호출 위치 |
|---|---|
| 게임순위 | index.html:4407 |
| 게임저장 | index.html:4395 |
| 결과저장 | index.html:5404, index.html:7684, index.html:8046 |
| 공지가져오기 | index.html:4104, sw.js:68 |
| 공지끄기 | index.html:9871 |
| 공지등록 | index.html:9821 |
| 공지목록 | index.html:9713 |
| 공지삭제 | index.html:9880 |
| 과넣기 | index.html:10205 |
| 교재대상 | index.html:11626 |
| 교재일괄 | index.html:10818 |
| 구독등록 | index.html:6176, index.html:6211, parent.html:573 |
| 구독목록 | index.html:8461, index.html:8471 |
| 구독지우기 | index.html:8476 |
| 구독해제 | index.html:6175, index.html:6233 |
| 구독현황 | index.html:9714 |
| 그림여러개 | index.html:12509 |
| 그림올리기 | index.html:12675 |
| 그림지우기 | index.html:12687 |
| 기록메모 | index.html:9163 |
| 기록정리 | index.html:9223 |
| 기록제외설정 | index.html:9209 |
| 내기록 | index.html:8095 |
| 내오답 | index.html:6643 |
| 단어가져오기 | index.html:4254, index.html:5040, index.html:5224, index.html:5570, index.html:6459, index.html:7158, index.html:10458, index.html:11709 |
| 단어목록 | index.html:10250, index.html:12596 |
| 단어붙여넣기 | index.html:10229 |
| 단어삭제 | index.html:12696 |
| 단어수정 | index.html:12663 |
| 단어장삭제 | index.html:10296 |
| 단어장색변경 | index.html:10953 |
| 단어장이름변경 | index.html:10289 |
| 단어추가 | index.html:10304 |
| 레슨크기저장 | index.html:10279 |
| 로그인 | index.html:3997 |
| 명단가져오기 | index.html:10522 |
| 미제출시트 | index.html:10062 |
| 선생님기록 | index.html:8176 |
| 선생님기본 | index.html:8177 |
| 선생님로그인 | index.html:8153 |
| 설정가져오기 | index.html:10901 |
| 설정저장 | index.html:10927 |
| 수업내주기 | index.html:12079 |
| 수업추천 | index.html:11985 |
| 수업틀목록 | index.html:11772 |
| 수업틀삭제 | index.html:12046 |
| 수업틀저장 | index.html:12037 |
| 숙제가져오기 | index.html:4094, index.html:4107 |
| 숙제등록 | index.html:8581, index.html:12192 |
| 숙제수정 | index.html:12252, index.html:12414 |
| 숙제여러개삭제 | index.html:12361, index.html:12370 |
| 시상달목록 | index.html:9316 |
| 시상시작일저장 | index.html:9543 |
| 시상저장API | index.html:9552 |
| 시상집계 | index.html:9317 |
| 시상항목저장 | index.html:9535 |
| 시작정보 | index.html:3988 |
| 연속가져오기 | index.html:4116, index.html:5943 |
| 오래된기록정리API | index.html:9230 |
| 월간순위 | index.html:4135, index.html:8111 |
| 재응시더주기 | index.html:10054 |
| 지난숙제정리 | index.html:10042 |
| 틀린전문 | index.html:7156 |
| 푸시공개키 | index.html:6140, index.html:6199, parent.html:565 |
| 푸시열쇠 | index.html:8469 |
| 푸시열쇠저장 | index.html:8365 |
| 푸시전송 | index.html:8435 |
| 학부모링크발급 | index.html:10742 |
| 학부모미리보기 | index.html:10773 |
| 학부모보기 | parent.html:381, parent-sw.js:79 |
| 학부모한마디 | index.html:10763 |
| 학생붙여넣기 | index.html:10882 |
| 학생수정 | index.html:10858 |
