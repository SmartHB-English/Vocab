# 영단어학습프로그램 — 웹앱 (깃헙 페이지용)

이 폴더가 **깃헙 저장소**입니다. 여기 있는 파일을 깃헙에 올리면
`https://<내아이디>.github.io/haebeop-vocab/` 주소로 앱이 열립니다.

앱을 깃헙에 올리는 이유는 하나입니다 — **아이들 휴대폰에 진짜 알림을 띄우기 위해서**입니다.
구글 앱스 스크립트 주소로는 알림(웹 푸시)을 켤 수 없습니다.
자료(학생·숙제·시험 기록)는 2026-10-08부터 **Firebase(Firestore)** 에 있습니다.
**구글 스프레드시트는 10월 7일 이관 때 멈춰 있어서 그 뒤 기록은 시트에 생기지 않습니다.**
시험 기록은 선생님 화면 **「시험 결과」**(최근 7일)와 **「시험」**(본 사람·평균)에서 봅니다.

---

## 들어 있는 파일

| 파일 | 하는 일 |
| --- | --- |
| `index.html` | 앱 전부 (학생 화면 + 선생님 화면) |
| `manifest.json` | 홈 화면에 앱처럼 깔리게 하는 설명서 |
| `sw.js` | 알림 일꾼 — 알림이 오면 깨어나서 공지를 띄웁니다 |
| `icon-192.png` / `icon-512.png` | 홈 화면 아이콘 |
| `apple-touch-icon.png` | 아이폰용 아이콘 |

`Code.gs` 는 여기 두지 않습니다 — 그건 앱스 스크립트 쪽에 그대로 있습니다.

---

## 선생님이 하실 일 (한 번만)

1. **깃헙에 저장소 만들기**
   github.com → New repository → 이름 `haebeop-vocab` → **Public** → Create.
   (Public 이어야 페이지가 열립니다. 비밀번호 같은 건 이 파일들에 없습니다.)

2. **파일 올리기**
   저장소 화면에서 **Add file → Upload files** 를 누르고,
   이 폴더에 있는 파일 6개를 통째로 끌어다 놓은 뒤 **Commit changes**.

3. **페이지 켜기**
   Settings → Pages → Source 를 **Deploy from a branch**,
   Branch 를 **main / (root)** 로 두고 Save.
   1~2분 뒤 위쪽에 주소가 뜹니다.

4. **주소 확인**
   `https://<내아이디>.github.io/haebeop-vocab/` 에 들어가서 로그인 화면이 뜨면 성공입니다.

5. **앱스 스크립트 다시 배포**
   앱스 스크립트에서 `Code.gs` 와 `index.html` 을 최신 것으로 바꾼 뒤
   **배포 → 배포 관리 → 연필(수정) → 버전: 새 버전 → 배포**.
   ※ 새로 만들지 말고 **기존 배포를 수정**해야 주소가 안 바뀝니다.

6. **알림 준비하기**
   새 주소로 들어가 선생님 화면 → **공지 보내기** → 오른쪽 아래
   **「알림 준비하기」** 를 한 번 누릅니다. (딱 한 번만)

7. **아이들 휴대폰에 깔기** — 수업 때 5분이면 됩니다.
   - **안드로이드**: 주소 열기 → 「알림 켜기」 누르기 → 허용
   - **아이폰**: 주소를 **사파리**로 열기 → 아래 공유 단추 → **홈 화면에 추가** →
     홈 화면 아이콘으로 다시 열기 → 「알림 켜기」 누르기 → 허용
     (아이폰은 홈 화면에 추가해야만 알림이 됩니다. 아이폰 iOS 16.4 이상)

8. **QR 코드 새로 만들기**
   주소가 바뀌었으니 예전 QR은 못 씁니다. 새 주소를 알려 주시면 새로 만들어 드립니다.

---

## 앞으로 앱을 고칠 때

`index.html` 만 다시 올리면 됩니다 (Add file → Upload files → 같은 이름으로 덮어쓰기).
아이들은 앱을 다시 깔 필요 없이, 다음에 열 때 새것으로 바뀝니다.

## 알아 두실 것

- 알림은 **글을 싣지 않고** 보냅니다. 알림이 도착하면 일꾼이 깨어나
  Firestore에서 공지를 직접 읽어와 띄웁니다. 그래서 암호화가 필요 없습니다.
- 「알림 다시 준비하기」를 누르면 **지금 켠 아이들이 모두 다시 켜야 합니다.**
  웬만하면 누르지 마세요.
- 아이가 휴대폰을 바꾸거나 앱을 지우면 다시 켜야 합니다.
  선생님 화면의 「아직 안 켠 학생」 칸에서 누군지 바로 보입니다.

## 개발 및 Firebase 이관 작업

운영 데이터는 Firestore에 있습니다. 웹은 Firebase SDK 공통 서비스를 사용하며 이전 웹과 Drive·Web Push 보조 기능은 Firestore에 연결된 Apps Script를 통해 동작합니다. 기존 이름/PIN을 그대로 사용합니다. 이관 결정·진행 조건은 `docs/decisions.md`, `docs/migration-design.md`, `docs/gate-reviews.md`를 참고하세요. Firebase 백업 적재와 운영 트래픽 전환은 별개 단계입니다.

Node.js 22 이상에서 다음 명령을 사용합니다.

```sh
npm run build:legacy
npm run build:services
npm run build:firestore
npm test
npm run test:emulators
```

HTTP 요청 공통 소스는 `services/api-client.js`입니다. 변경 후 빌드하면 학생/교사·학부모 HTML과 두 서비스워커에 반영됩니다. 생성 구간을 직접 수정하지 마세요. Emulator 테스트에는 Firebase CLI와 Java 21 이상이 필요합니다.

시트 백업 도구는 Python 3 및 openpyxl을 사용합니다.

```sh
python3 -m unittest discover -s tests/migration
python3 scripts/migration/normalize_xlsx.py work/source/snapshot.xlsx work/source/snapshot.normalized.json
python3 scripts/migration/firestore_snapshot.py work/source/snapshot.normalized.json --project PROJECT_ID --firebase-account ACCOUNT_EMAIL
```

실제 학생 정보·PIN·학부모 토큰·원본 백업은 Git에 넣지 않습니다. 정규화 출력은 `work/`에만 저장되며 기존 파일을 덮어쓰지 않습니다. 적재기는 불변 스냅샷을 재조회 검증하고, 기존 웹의 연결 주소나 운영 데이터를 변경하지 않습니다.

GitHub Pages는 main 브랜치 루트 정적 파일을 배포합니다. `services/firestore.bundle.js`는 이 배포에 필요한 공개 브라우저 실행 파일로 저장소에 포함합니다. 수정 후 `npm run build:firestore`로 재생성하세요. 학생 데이터와 비밀 자격증명은 번들에 포함되지 않습니다.
