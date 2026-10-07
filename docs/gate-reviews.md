# 게이트 기록

2026-10-07, 기준선 확보 단계.

사용자가 제공한 Claude Gate 체크리스트로 수동 검토한다. 설치된 skill 경로에서 `gate-spec/design/code/release` SKILL.md를 찾지 못했으므로, 해당 스킬 명령을 실행했다고 주장하지 않는다.

## Spec Gate — Pass (기준선 확보 단계 한정)

입력: migration-spec.md, decisions.md. 운영 호환·데이터 보존·인증 결정·제외 범위·Given/When/Then을 명시했다. 전체 이관의 지연/전환 목표 및 데이터 검증 증거는 미확정으로 기록했다. API 인벤토리와 오프라인 전송 테스트 구현만 다음 단계로 승인한다.

## Design Gate — Pass (기준선 확보 단계 한정)

입력: migration-design.md. 학생/교사/학부모/서비스워커 읽기·쓰기 주체, 기존 봉투, 이관 및 롤백 위험을 식별했다. 구현은 기존 코드 읽기와 오프라인 테스트로 한정한다. 운영 전환 설계는 미완료이며 전체 서버/데이터 모델이 확보되면 재검토한다.

## Code Gate — Pending

검증 실행 후 결과를 기록한다.

## 추가 Spec / Design Gate — Pass (요청 서비스 추출 한정)

사용자 추가 요청에 따라 공통 서비스 소스, 4개 실행 경로, Apps Script/file:// 호환을 위한 인라인 빌드, 실패/동시성/서비스워커 검증을 범위에 포함했다. 기존 13개 전송 테스트가 구조 변경 전 통과했다. 서버 원본 특성화 테스트는 비식별 자료로만 실행하며 실제 전환 검증을 대신하지 않는다.

## Release Gate — Not run

배포하지 않는다. 실제 배포본 서버 분석, 데이터 대조, 권한/인증, 전환 및 복구 리허설이 남아 있다.

## Spec / Design Gate — Pass (스냅샷 정규화 도구 한정)

전체 시트와 셀 메모 보존, 위치/타입 보존, 재실행 결정성, 실제 데이터의 Git 제외를 수용 조건으로 검토했다. XLSX 원본 SHA-256과 셀 표현을 저장하고, 가짜 통합 문서로 날짜/PIN/메모/빈칸 회귀 검증을 한다. 운영 전환 승인은 아니다.

## Spec / Design Gate — Pass (Firestore 백업 적재 한정)

원본 해시 기반 멱등 ID, 기존 문서 충돌 시 중단, 전체 재조회 대조 후 verified 표시, 개인정보 로그 제외, 재실행 복구를 수용 조건으로 검토했다. 기존 웹 트래픽을 새 DB로 전환하는 단계가 아니며 현재 서비스에는 영향이 없다.

## Code / Release Gate — Pass (격리된 Firestore 백업 적재 한정)

가짜 XLSX/메모·날짜·PIN 타입 보존, 결정성, Firestore 타입 왕복, 멱등 재실행, 부분 실패 복구, 충돌 중단, 입력 변조 거부, 재조회 오류 시 manifest 미발행의 Python 테스트 8개 통과. 운영 데이터는 work/에만 저장하며 토큰/셀 값은 출력하지 않는다. 새 Firebase 프로젝트의 client deny-all 규칙이 적용되어 있다. 이 판정은 백업 namespace 적재에만 적용하며 웹 서버 배포·트래픽 전환은 승인하지 않는다.

## 백업 적재 검증 후속

Firestore REST는 doubleValue:100.0을 JSON에서 doubleValue:100으로 반환할 수 있어 정규화 해시 대조가 최초 중단됐다. doubleValue 복원을 float로 고정하고 해당 회귀 테스트를 추가했다. Python 9개 테스트 통과 후 동일 snapshot ID로 재실행, 3,242개 문서 전체 재조회와 verified manifest 재조회 통과. 기존 문서 덮어쓰기는 발생하지 않았다.

## Spec / Design Gate — Revise (Functions 없는 운영 이관)

사용자가 Functions 제거와 직접 Firestore 접근으로 변경했다. 현재 운영 이관 설계는 재검토가 필요하다. 기존 서버 전용 기능·캐시된 클라이언트·로그인 세션·쓰기 충돌 보존을 포함한 설계가 통과하기 전에는 운영 전환하지 않는다. 백업 적재와 기존 전송 서비스 테스트 통과는 이 게이트를 대신하지 않는다.

## 운영 배포본 기준선 확정

Safari 프로젝트 기록에서 실제 배포 버전 80 (5,372줄)을 별도 확보했다. 이전 fixture는 편집기 최신본으로 학부모 숙제 점수/시각 관련 미배포 변경이 있었다. 실제 운영 버전으로 fixture를 교체하고 64개 테스트 모두 재통과했다. 미배포 변경은 work에 보존하며 Firebase 이관에 암묵적으로 포함하지 않는다.

## Spec / Design Gate — Pass (저장소 독립 계산 계층 한정)

배포 버전 80의 업무 결과·셀 메모·행 번호·서울 날짜 의미 보존을 조건으로 저장소 어댑터 및 날짜 의존성 분리를 승인한다. 실제 Firestore 접근 규칙·세션·오래된 클라이언트 전환은 별도 검토 대상이다. 원본 시트 스냅샷 대조와 기존 64개 회귀 테스트를 기준으로 삼는다.

## Spec / Design Gate — Pass (직접 Firestore 구현)

사용자가 클라이언트 계산과 기존 출력 보존을 승인했다. 표별 데이터/개인 자격증명 분리, 익명 Auth 내부 UID와 규칙 기반 기존 PIN 세션, 표 계산의 원자적 트랜잭션, 외부 부수효과 분리, 기존 GAS 창구도 동일 데이터로 연결하는 전환을 검토했다. 실제 운영 읽기 5개 API가 새 계산과 일치했다. 쓰기/역할 규칙/혼합 버전/메모/동시성 검증과 최종 동기화가 통과해야 Release Gate를 통과할 수 있다.

## 진행 증거 — 직접 Firestore

- 원본 서버 실데이터 읽기 5개(로그인/내기록/숙제/월간순위/연속학습)와 새 클라이언트 계산 결과가 JSON 수준에서 일치했다. 운영 쓰기는 하지 않았다.
- 기본 회귀/표 어댑터/서울 날짜 테스트 71개 통과.
- Firestore Emulator의 실제 SDK+규칙 통합 테스트 5개 통과: PIN 선행 0/공백, 로그인 전 기록 차단, 자격증명 분리, 두 기기의 동시 제출 보존/오답 메모, 중복 시험 거부, 교사 기존 PIN 유지.
- Firebase 12.19.0 / esbuild 0.28.2. Node SDK의 전이 grpc 의존성 취약점은 1.14.5 override로 보정했고 npm audit 결과 0건이다. 브라우저 번들에는 Node grpc가 포함되지 않는다.

Release Gate는 아직 통과하지 않았다. 학부모 링크 재발급/PIN 변경/교사 편집/그림·푸시 보조 창구/기존 GAS 전환 및 복구가 남아 있다.

## Spec / Design Gate — Pass (전환 제어)

기존 HTTP·google.script.run·월간 트리거를 동일 selector로 제어한다. staged에서는 Sheets, frozen에서는 요청을 중단하고 최종 백업을 확보, active에서는 새 dataset만 사용한다. selector 읽기 실패 시 Sheets로 돌아가서 이중 쓰기를 일으키지 않는다. selector 변경은 클라이언트 규칙으로 금지한다. 최종 데이터 대조 및 복구 리허설 전에는 active로 변경하지 않는다.

## Code Gate — Approved (격리된 새 프로젝트 규칙 검증 한정)

기본/차등/전환 제어 75개 테스트 통과. SDK+Emulator에서 동시 제출·PIN 갱신·링크 재발급 7개 검증을 이전 실행에서 통과했다. 표 credential 값과 메모를 모두 공개 payload에서 제거한다. 사용자 승인한 클라이언트 신뢰 모델이며 로그인한 사용자의 DB 읽기는 학생별로 격리하지 않는다. 기존 운영 서비스 전환은 아직 승인하지 않는다. 새 프로젝트 staged 데이터의 실제 SDK 읽기 검증을 위해 해당 규칙만 배포한다.

## 복구 리허설 증거

복구용 exporter의 날짜·PIN 선행 0·빈 셀 메모·문자열 수식 보존 및 secret overlay 테스트를 포함해 Python 11개 통과. 실제 Firestore read-only transaction → recovery-staged.xlsx → 정규화 → 원본 표 비교에서 30개 시트, 18,225개 셀, 219개 메모 일치. Sheets에는 쓰지 않았다. Java 25를 명시한 Emulator 통합 14개, 일반/차등/전환 75개 통과.

## 실제 SDK 읽기 검증 — 최종 대조 필요

실제 새 Firebase에서 기존 이름/PIN 로그인과 내기록/숙제/월간순위 응답이 운영 GAS와 일치했다. 연속 순위 중 타 학생 1명의 연속 값 3→4 차이가 발견되어 전환하지 않는다. 중간 스냅샷 이후 운영 데이터 변경 또는 계산 차이를 최신 원본 대조로 확인해야 한다. 운영 snapshot을 이미 최종 데이터라고 주장하지 않는다.

## Code / Release Gate — Pass (GAS staged 어댑터 배포 한정)

77개 일반/차등/전환/REST precondition 테스트, 18개 실제 SDK+Emulator 통합, 11개 Python 테스트 통과. 그림 업로드를 트랜잭션 밖에서 한 번 준비하고 실패 시 기존 URL 유지, 학부모 마지막 방문 캐시 및 링크 폐기, 실제 알림을 보내지 않는 푸시 위임을 확인했다.

Firebase ID token의 REST beginTransaction이 실제 환경에서 403을 반환했다. Web SDK와 같은 optimistic 방식으로 readTime snapshot + 모든 읽기 버전 precondition/verify commit을 적용했다. 실제 새 프로젝트에서 readTime 조회 및 verify-only commit 통과. GAS 안에서 firebaseMigrationCheck 실행 완료, staged 상태의 원본 v80 시작 정보와 Firestore 응답 일치. 쓰기 충돌 재시도는 같은 시각·UUID·그림 URL을 재사용한다.

staged 상태로 기존 GAS 어댑터만 배포할 수 있다. 이때 데이터 원장은 여전히 Sheets이며 v80 엔진을 사용한다. 최종 스냅샷/연속 순위 차이 대조와 active 전환은 다음 Release Gate로 남긴다. raw backup/credential/debug 출력은 커밋하지 않는다.

## staged 배포 확인 및 drain 보강

GAS 버전 81로 동일 URL 배포 완료. 실제 공개 HTTP 시작 정보가 검증된 v80와 일치했다. 최종 export 시 이미 시작된 기존 쓰기까지 기다릴 수 있도록 staged RPC를 공통 script lock 안에서 실행하고 selector를 재검사한다. 원본 엔진의 내부 lock은 이미 보유한 outer lock으로 대체한다. owner 전용 drain 함수도 제공한다. 77개 회귀/전환 테스트 재통과 후 해당 보강을 staged로 배포한다. active 전환은 여전히 대조 완료 전 금지한다.

## 전환 시점 규칙 보강

SDK 경로는 runtime/config에서 현재 dataset을 읽는다. 고정된 옛 번들/세션은 현재 dataset 이외에 비공개 데이터를 읽거나 쓸 수 없으며, frozen/staged 상태에서는 client 데이터 쓰기를 거부한다. frozen에서도 owner/교사 읽기 대조는 가능하다. local Emulator에서 freeze 제출 거부/기록 불변/옛 세션 폐기를 추가로 검증한다. 이 규칙은 staged 기존 GAS(Sheets) 동작을 변경하지 않는다.

## 2026-10-08 — Code Gate Approved / Release Gate Pass (Firestore 원장 전환)

실행 가능한 gate-* skill 파일은 제공되지 않아 AGENTS.md의 체크리스트를 수동 검토했다. 외부 gate 명령 실행 결과로 주장하지 않는다.

GAS v83을 동일 URL에 배포했다. staged 읽기에는 script lock을 사용하지 않고 쓰기만 lock 안에서 selector를 다시 확인한다. active Firestore는 전체 read 버전 precondition으로 충돌을 감지하며 동일 시각·UUID·그림 결과로 재시도한다. 병렬 로그인/내기록 모두 원본 v80 출력과 일치해 이전 조회 대기 문제가 해결됐다.

79개 일반/차등/전환 테스트 통과, 19개 SDK+Emulator 통합 및 11개 Python 테스트 통과. 원본 최신 snapshot에서 운영 13개 조회 출력이 일치했다. 이전 연속 순위 차이는 중간 backup 이후 원본 데이터 변경으로 확인됐다.

00:27 KST frozen 전환과 owner drain 완료 후 최종 XLSX를 새로 다운로드했다. 30개 시트/18,315개 셀/221개 메모, content SHA e4999ba8c1bebd10f82e3499380ac44c9c745b79cafee1a0312c969e0c55dfff. 95개 서비스 문서 전체 재조회 검증 완료. frozen 상태의 실제 Firebase SDK 학생/교사/학부모 read-only 13개 응답이 최종 원본 v80 계산과 모두 일치했다. 전체 Firestore를 read-only transaction으로 XLSX에 복구하고 날짜/PIN/메모/공백 셀을 포함해 18,315개 논리 셀/221개 메모 일치했다. 원본 Sheets와 이전 backup은 유지한다.

권한/입력/credential 분리/의존성/오류 처리/인프라를 검토했다. 단순 PIN 및 회원 간 DB 엄격 격리 미제공은 사용자 승인한 신뢰 모델이며 docs/decisions.md에 명시했다. owner selector만 전환 가능, frozen 쓰기 및 이전 dataset 세션은 거부한다. 배포에는 공개 웹 설정과 업무 코드만 포함하고 실제 학생 데이터/비밀 값/토큰은 제외한다. npm audit 0건. Cloud Functions 및 결제 없음.

최종 namespace active 전환을 승인한다. 원본 웹 SDK 배포와 배포 후 브라우저 검증은 별도 실행 증거로 후속 기록한다. 현재 계정 트리거 목록은 0개이며 다른 소유자의 트리거 존재 여부는 이 UI에서 확인할 수 없다. 기존 월간 함수 이름을 보존하며 중복 트리거는 만들지 않는다.

## 웹 SDK 배포 전 Code / Release Gate — Pass

Firestore active 후 동일 기존 GAS endpoint의 13개 조회가 최종 원본 v80 계산과 모두 일치했다. SDK 공통 창구를 웹 기본값으로 선택했다. HTTP 계약과 내부 로그인 실패를 구분하며 SDK 오류 시 쓰기를 재시도하거나 Sheets로 우회하지 않는 테스트를 추가했다.

최종 일반 테스트 82개, SDK+Emulator 19개, Python 11개 통과. npm audit 0건. Safari에서 실제 SDK 학생/교사/학부모 조회 대조 14개와 실제 worker 컨텍스트의 학생 공지 및 학부모 알림 projection 2개 모두 PASS. 실제 제출·학원 정보 편집·푸시 발송은 발생시키지 않았다. 기존 파일의 CRLF를 보존했고 cr-at-eol 설정을 적용한 diff whitespace 검증을 통과했다.

기존 Pages 설정은 main 브랜치 루트 정적 배포이며 현재 GitHub 권한은 push만 가능하다. 사용자 요청한 해당 원본 배포를 수행하기 위해 공개 브라우저 번들 services/firestore.bundle.js를 배포 파일로 포함한다. 소스 재생성 도구를 제공하고 별도 중복 generated engine과 실제 데이터/credentials는 제외한다. remote main이 기준 커밋 a538664과 동일함을 확인했다. 원본 main fast-forward 배포를 승인하며 배포본 검증 후 같은 이력을 새 비공개 저장소에 복제한다.

## 후속 쓰기 검토 — Revise → Approved

커밋 전 추가 검토에서 GAS optimistic commit이 table load에 포함되지 않은 기존 credential/link 문서를 신규 생성(exists:false)으로 취급하는 문제를 발견했다. 계정 수정·링크 발급·학부모 방문 저장이 거부될 수 있어 웹 배포를 보류하고 수정했다. 모든 write/delete 대상 중 아직 읽지 않은 문서를 원래 readTime에 조회하고 해당 버전으로 commit한다.

기존 credential 갱신/신규 링크 생성/옛 링크 삭제의 precondition 회귀 테스트를 추가해 일반 테스트 83개 통과. 실제 local Auth/Firestore Emulator REST로 GAS adapter를 실행해 학생 PIN 수정과 부모 링크 재발급·폐기, 새 SDK에서 변경된 PIN 로그인 및 GAS/SDK 양쪽 제출 2건과 합산 점수 170 보존을 검증했다. Emulator 테스트 fixture URL에서 literal encoded sheet ID를 다시 URL 인코딩하도록 고쳐 실제 DB 경로와 일치시켰다. 총 21개 통합 테스트 통과. 수정본은 동일 GAS endpoint의 버전 84로 배포 완료했다.

사용자 후속 범위: 오늘은 이 수정·검증과 원본 저장소 커밋/푸시까지만 진행한다. 별도 비공개 저장소 복제, RN 구현, 추가 출시 작업은 보류한다.

실제 운영 Firebase의 credential/link/catalog와 존재하지 않는 새 journal 대상 64개를 일관된 readTime으로 읽고 verify-only commit에 성공했다. 학원 데이터는 변경하지 않았다. v84 공개 endpoint의 병렬 로그인/내기록도 최종 원본과 일치했다. 수정에 대한 Code/Release Gate 수동 재검토 Approved/Pass.
