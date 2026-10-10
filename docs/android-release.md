# 인왕보카 Google Play 심사 준비

## 범위와 수용 조건
- 최신 main ac2822e를 기준으로 기존 학습 동작을 유지한다.
- Google Play·Android 설치 이름·앱 시작 화면 이름은 인왕보카로 한다.
- 한국어 무료 교육 앱, 패키지 com.smarthb.vocab, 최초 versionCode 1.
- 심사는 비공개 테스트 트랙에서 진행한다. 프로덕션 공개는 사용자가 직접 결정한다.
- 개인정보 문서에는 실제 구현에서 확인된 수집·저장만 설명한다.
- 검토용 계정은 실제 학생 계정과 분리하고 스크린샷에는 실제 학생 정보를 노출하지 않는다.
- 서명 키·암호·실제 계정 데이터는 Git에 저장하지 않는다.

## 설계
기존 Capacitor Android 프로젝트를 유지한다. 앱은 웹 파일을 로컬 패키징하고 GitHub Pages의 웹 번들 업데이트를 받는다. Firestore SDK, 익명 Firebase 인증, 서버 aux 함수가 기존 웹과 동일하게 사용된다. 출시 AAB는 로컬 전용 업로드 키로 서명하고 Google Play 앱 서명으로 배포 키를 관리한다. Gradle은 환경변수로 키 경로와 암호를 받아 로컬 자격증명 파일의 커밋을 방지한다.

Android 네이티브 푸시는 Capacitor Push Notifications와 Firebase Cloud Messaging을 사용한다. 기존 웹 구독은 VAPID 경로를 유지하며 iOS APNs는 이번 범위에서 제외한다. 개인정보처리방침과 삭제 안내는 정적 페이지로 제공하고 문의는 사용자 지정 이메일 yuiop70372@gmail.com을 사용한다.

## 품질 게이트
2026-10-10, gate-* SKILL.md는 로컬 skill 디렉터리와 저장소에서 발견되지 않았다. 사용자 제공 체크리스트로 수동 검토하며 명령 실행 결과로 표기하지 않는다.
- Spec Gate: Pass. 이름·패키지·비공개 심사·기존 출력 유지·자격증명 제외 수용 조건 명시.
- Design Gate: Pass. 기존 Capacitor 재사용, 서명 환경변수, Firestore 연결 유지, 공개 배포 보류.
- Code Gate / Release Gate: 심사 자료·서명 AAB·실기 검증 완료 후 판정. 아직 제출 완료 아님.

## 초기 검증
- npm ci: 완료.
- npm test: 107/107 통과.
- npm run app:build / npx cap sync android: 통과.
- npm audit: 개발용 Capacitor CLI→xcode→uuid 경로의 moderate 3건, 런타임 영향은 별도 확인.
- Google Play Console: ZeroneStudio 조직 계정에 인왕보카 앱 생성 완료. 앱 서명·수출 관련 최초 약관은 사용자 승인 후 동의.
- 첫 출시 관리형 게시 불가: https://support.google.com/googleplay/android-developer/answer/9859654?hl=en

## FCM 추가 수용 조건과 설계 (2026-10-10)
Spec Gate: Pass (수동). Android에서 명시적 알림 허용 후 등록, 학생 로그인과 토큰 연결, 토큰 교체 및 로그아웃 때 이전 연결 해제, 앱 백그라운드 수신, 클릭 시 공지 화면, 웹 구독·발송 기존 동작 유지. 심사 제출은 기능 검증 이후로 보류한다.
Design Gate: Pass (수동). Capacitor Push Notifications 플러그인과 기존 푸시 테이블을 재사용한다. 네이티브 주소는 fcm: 접두어로 식별하고 Admin Messaging으로 발송하며 웹 주소는 기존 VAPID 방식으로 보낸다. 이름/PIN 흐름과 반환 envelope는 유지한다. 알림 내용에는 학생 이름·점수 등 개인정보를 넣지 않고 공지 확인 안내만 보낸다. iOS APNs는 이번 Google Play Android 범위에서 제외한다.

### FCM 코드 검토 및 로컬 검증
- 네이티브 Push 플러그인이 없는 기존 설치본은 기존 웹 알림 경로를 유지한다.
- FCM 등록은 명시적 허용 후 이루어지고 학생 로그인에 연결된다.
- 로그아웃에서 구독 해제 실패 시 학생 전환을 완료하지 않는다.
- 서버 발송은 기존 교사 세션 검증을 거친다. 토큰 형식 검증, 실패 상태 유지, 만료 토큰만 cleanup 대상.
- FCM 알림 본문은 일반 공지 안내만 포함한다.
- npm test: 113개 통과.
- npm run test:emulators: 28개 통과 (FCM 발송·만료 처리는 Messaging mock, 실제 수신 증명과 구분).
- bundleRelease / assembleDebug: Push 플러그인 포함 빌드 통과. 이후 소스 수정분은 재빌드 필요.
- Code Gate: Approved (수동, 단 실제 수신·권한·클릭 검증은 Release Gate에서 수행).
- Release Gate: 아직 심사 제출 준비 중. FCM 실제 수신·스크린샷·심사 계정·Play 11개 필수 설정 완료 전 제출하지 않는다.
- aux 단독 서버 배포 Release Gate: Pass (수동). 기존 인증·교사 권한 검증 유지, FCM 형식·실패 처리 테스트 통과, 비밀 credential 소스 미포함, 웹 주소 allowlist 유지, 월시상 함수 제외한 aux만 배포. 모바일 심사 제출 Release Gate와 별개이며 앱 실제 수신은 배포된 서버와 검증한다.


## 최종 코드·기기 검증 (2026-10-10)
- npm test: 117/117 통과. opt-in, 토큰 교체, 연속 켜기 요청, 권한 철회, 해제, 로그아웃, 로그인 전 알림 클릭, 공지 갱신 포함.
- Firebase Auth·Firestore Emulator: 28/28 통과. FCM 서버 payload·만료/일시 실패 처리는 mock 검증.
- aux 운영 서버 단독 배포 완료. dedicated reviewer 한 명에게만 FCM 발송, 상태 200.
- Pixel 9 / Android 16에서 알림 허용, 서버 구독 1개, 백그라운드 알림창 수신 및 클릭 후 홈 이동 확인. 공지 없는 심사 계정이며 실제 학생에게 공지를 만들거나 알림을 보내지 않았다.
- 알림 끄기 후 구독 0개, 다시 켜기 후 1개, 로그아웃 후 0개 확인. 다시 로그인 시 opt-in 상태 복원 확인.
- 안전 영역: Android 상태바와 제목 겹침을 Capacitor CSS inset 값으로 보정. 새 빌드에서 로그인·홈·학습 화면 확인. 웹 파일에는 보정 미적용.
- bundleRelease / assembleDebug 통과, jarsigner AAB 서명 검증 통과. 첫 versionCode 1, versionName 1.0.
- 런타임 npm audit --omit=dev: 0건. 개발용 Capacitor CLI→xcode→uuid moderate 3건은 기존 빌드 도구 위험으로 추적.
- Android 병합 Manifest에 광고 ID·전화·위치 권한 없음. FCM 자동 초기화는 기본 비활성, 사용자 허용 후 등록. 개인정보 토큰은 payload에 포함하지 않음.
- 업로드 키·암호·심사 PIN·FCM 토큰·원본 학생 자료·로컬 IDE 메타데이터는 커밋 제외.
- Code Gate: Approved (수동). 기존 학습 API 계약 유지, FCM 전용 분기, 교사 인증·서버 주소 검증 유지, 회귀 테스트 통과.
- 코드 배포 Release Gate: Pass (수동). 실제 수신·해제·로그아웃 확인, 서명 AAB 및 정적 개인정보 문서 검증. Play 제출 완료와는 별개.

## Play 등록 진행 상태
- 이름: 인왕보카. 무료, 교육, 한국어. 문의 이메일 yuiop70372@gmail.com. 전화번호는 필수 비공개 연락처 항목이 있을 때만 사용하며 공개 스토어에는 입력하지 않음.
- 사용자가 초등학생 앱임을 확인: 타겟 연령 6–8세 및 9–12세.
- 공개 출시 보류: 최초 앱은 관리형 게시를 켤 수 없어 비공개 테스트 트랙 심사를 사용. 프로덕션 버전은 생성·출시하지 않음.
- 광고 없음 신고 저장 완료. 개인정보처리방침 및 계정 삭제 안내 정적 문서 작성.
- 실제 화면 PNG: work/android-release/store-assets/02-study.png 및 03-flashcards.png. 소개 이미지는 같은 폴더 feature-graphic.svg/png (1024×500).
- Play IARC 약관 동의와 전용 심사 계정/PIN의 Google Play 비공개 검토 항목 전달 승인은 아직 대기. 연령 선택은 사용자 승인 완료.
- 스토어 등록정보·데이터 보안·필수 앱 콘텐츠·비공개 테스트 AAB 업로드·검토 제출은 완료 여부를 Play 화면에서 확인 후 갱신한다. 현재 심사 제출 완료 아님.


### 데이터 보안 신고 근거
학생 이름·사용자 식별자·학교/학년 정보, 학습 수행과 시험/게임 기록, 선택적 푸시 토큰과 Firebase 설치 식별자를 신고한다. 학습/계정 관리는 앱 기능 목적이고 FCM은 선택적 알림 목적이다. Firebase·GitHub는 서비스 제공업체로 사용하며 광고·데이터 판매는 없다. HTTPS 전송을 사용하고 계정 삭제 안내 이메일로 요청할 수 있다. 앱에서 계정 신규 가입은 제공하지 않으며 학원에서 학생을 등록한다. Google Analytics·Crashlytics·광고 SDK·위치/전화 권한은 없다.
Firebase SDK 기술 정보 설명: https://firebase.google.com/docs/android/play-data-disclosure
어린이 대상 정책 확인: https://support.google.com/googleplay/android-developer/answer/11043825
