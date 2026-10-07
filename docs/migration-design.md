# Firestore 호환 이관 설계

## 기준과 계약

웹 기준 커밋 a53866469a7805e30267d1090685f3cff660acfa. 실제 GAS 배포 v80의 업무 엔진을 사용한다. 원본 Code.gs 편집본을 덮어쓰지 않고 FirebaseBridge.gs를 추가한다.

요청 `{fn,args}`, 응답 `{ok:true,값:...}` / `{ok:false,메시지:...}`를 유지한다. 전송 성공과 내부 로그인 `값.ok`는 구분한다. 이름/PIN 문자열, 날짜(Asia/Seoul), 시트 행 번호, 순위 동률, 전체 오답 메모를 보존한다.

## 구조

- services/api-client.js: 학생·교사·학부모·두 서비스워커 공통 창구. 기존 GAS 또는 명시적인 firestore:v1을 선택한다. 네트워크 실패 시 다른 DB에 쓰지 않는다.
- services/legacy-runtime.mjs, table-store.mjs, seoul-date.mjs: 배포 v80의 저장소·시각 의존성을 분리해 기존 계산을 실행한다.
- services/firestore-repository.mjs: 표 버전별 읽기 캐시, credential/session 검증, 원자적인 표 쓰기와 저널. 트랜잭션 재시도에서는 시각과 UUID를 고정한다.
- server/FirebaseBridge.gs.template: 기존 HTTP/google.script.run/월간 트리거를 같은 selector로 전환한다. Drive·Web Push 부수효과를 유지한다.

vocabDatasets/{snapshotHash}/tables/{encodedSheetName}의 JSON cell payload는 날짜·메모·번호 위치와 중첩 배열을 보존한다. meta/catalog은 표 순서·extent·version·학생 영구 ID/현재 행 번호를 가진다. 학생 PIN/학부모 토큰 및 설정의 비밀 값은 secrets로 분리한다. credentials와 links는 로그인 및 폐기 검증에 사용한다. 매 변경 journal에는 결과와 변경 표의 postimage를 기록한다.

이 구조는 표 단위 호환 모델이다. 전체 기능을 개별 학생/기록 문서로 재설계하는 작업은 이번 전환 범위에 포함하지 않는다. 변경 표만 쓰고 읽기는 버전 캐시를 사용하지만 초기/트랜잭션 조회는 여러 표를 읽는다. 무료 할당량과 표 문서 크기를 확인하며, 850KB를 넘는 변경 표는 명시적으로 중단한다.

## 인증과 부수효과

이름/PIN 화면은 그대로다. anonymous Auth UID에 기존 credential의 PIN SHA-256을 제출한 session을 규칙으로 검증한다. 잘못된 PIN, 변경된 PIN, 폐기된 학부모 링크는 거부한다. 로그아웃 전 일반 기록과 숨김 credential은 읽을 수 없다. 클라이언트 신뢰 모델은 사용자 승인 범위이며 회원 데이터의 DB 수준 학생별 격리는 제공하지 않는다.

그림 업로드는 트랜잭션 이전에 준비하고 재시도에서 URL을 재사용한다. Web Push 전송은 기존 GAS 보조 창구에서 처리한다. 외부 부수효과를 Firestore 재시도 안에서 반복하지 않는다. 월간 집계는 기존 트리거 이름을 유지한다.

## 전환 순서

runtime/config은 owner만 변경한다. staged는 기존 Sheets 경로, frozen은 요청을 잠시 중단해 최종 백업을 확보하는 상태, active는 최종 Firestore dataset을 사용하는 상태다. selector 읽기 실패는 오류이며 Sheets로 자동 복귀하지 않는다.

1. 중간 원본 XLSX를 타입/메모/순서 보존 JSON으로 정규화하고 immutable migrationSnapshots에 전체 재조회 검증 후 보관한다.
2. 서비스 dataset과 규칙을 격리 프로젝트에서 검증한다. 기존 업무 결과, 동시 쓰기, PIN/링크 변경, 복구를 테스트한다.
3. 기존 GAS에 staged 어댑터를 배포해 출력 보존을 확인한다. 미배포 editor 변경은 factory 내부 v80을 사용해 제외한다.
4. frozen으로 바꾸고 기존 쓰기가 끝난 후 최신 XLSX를 다운로드한다. 기존 원본·스냅샷을 삭제하지 않는다. 새 dataset 적재/재조회/집계 대조 후 selector를 active로 변경한다.
5. 기존 GAS와 새로운 SDK 경로를 함께 검증한 후 웹을 배포한다. 서비스워커 캐시와 오래 열린 웹의 제출은 기존 GAS를 통해 같은 DB로 간다.

## 복구

단순한 주소 복귀는 새 기록을 잃으므로 금지한다. frozen 상태에서 export_recovery.py로 Firestore를 read-only transaction으로 일관되게 읽고, 일반 표에 secret overlay를 복원한 비공개 XLSX를 만든다. PIN 문자열·날짜·오답 메모·셀 위치를 재조회 대조한다. 원본 Sheets에 최신 복구본을 재반영하고 재대조한 뒤에만 staged로 돌아간다. 복구 도구는 원본 Sheets를 직접 덮어쓰지 않는다.

중간 dataset의 실제 Firestore → 복구 XLSX → 정규화 → 표 비교 리허설에서 30개 시트, 18,225개 셀, 219개 메모가 일치했다. 최종 전환 dataset에서도 재실행한다.
