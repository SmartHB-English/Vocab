# Firebase 이관 의사결정

2026-10-07, 사용자 후속 결정을 반영한 현재 기준.

1. 먼저 운영 웹의 Sheets 데이터를 Firestore로 이관하고 안정화한다. 이후 RN WebView 앱을 만든다.
2. 기존 URL, 이름/PIN 로그인, 학생·교사·학부모 화면 및 응답, 점수·오답·숙제·시험·링크를 보존한다. 재가입과 PIN 변경을 요구하지 않는다.
3. Cloud Functions와 Blaze는 사용하지 않는다. 웹 공통 서비스에서 Firebase Web SDK로 Firestore를 직접 조회하고 기존 v80 업무 엔진으로 계산한다. Firebase SDK는 Firestore에 접근하는 클라이언트 라이브러리다.
4. 계정 원장은 Firestore에 둔다. Firebase anonymous Auth는 내부 요청 UID에만 사용하며 가입 화면을 만들지 않는다. 보안 규칙이 기존 PIN 검증 값과 숨김 credential을 대조해 session 문서 저장을 허용한다. 이전 custom-token/Functions 설계는 폐기했다.
5. 기존 단순 PIN과 클라이언트 계산 신뢰 모델을 유지한다. 로그인한 회원의 DB 데이터 접근은 학생별로 엄격히 격리하지 않는다. 화면/API 결과는 기존 업무 엔진으로 제한한다. PIN, 학부모 토큰, 교사 PIN, VAPID 비밀키는 일반 표에서 분리한다.
6. Drive 업로드, 기존 Web Push 전송, 예약 월간 집계는 GAS 보조 창구로 유지한다. 기존 웹·서비스워커도 GAS 주소를 계속 쓸 수 있으므로 해당 창구 역시 Firestore로 전환한다. 저장소 오류 시 Sheets로 자동 복귀해 쓰지 않는다.
7. 실제 운영 기준은 Apps Script v80, 2026-10-07 17:05 KST다. 편집기 18:07의 미배포 변경은 별도로 보존한다. 새 어댑터도 v80 엔진을 사용해 이를 암묵적으로 출시하지 않는다.
8. 최종 동기화·전환·복구 검증 후 원본 SmartHB-English/Vocab에 커밋/푸시/배포하고 배포본을 테스트한다. 이후 SmartHB-English-hongjae/Vocab에 동일 이력의 비공개 저장소를 만든다. 2026-10-08 후속 요청에 따라 오늘은 저장 경로 수정·검증과 원본 커밋/푸시까지만 진행하고 비공개 복제와 RN은 다음 단계로 미룬다.
9. RN은 기존 웹을 WebView로 재사용하며 네이티브 푸시, 알림 화면 이동, 세션 유지, 뒤로가기 등을 담당한다. 조직 Play 계정은 사용자 진술로 확인했다. RN 구현과 Play 제출은 웹 이관 다음 단계다.

실제 개인정보·PIN·학부모 토큰·구독·로그인 토큰·백업은 gitignored work/에만 보관하며 공개 원본 저장소에 커밋하지 않는다. Firebase 공개 웹 설정은 관리 권한을 주는 credential이 아니다.
