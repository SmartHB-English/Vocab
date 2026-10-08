# Apps Script 호환성 기준선

Safari Apps Script 프로젝트 기록에서 실제 운영 배포 버전 80을 복사했다.

- 운영 배포 시각: 2026-10-07 17:05 KST
- 파일: Code.gs (5,372줄)
- SHA-256: c7b26906854389d756fc7e622da4503b0b9cdb7694145c63031ff9a15385e581
- 원본 프로젝트: 10hUXdyZRjNABTaBAn7aEUEUeHPNLgkuo7BYXzJOPiG0yh8cp4GApH6pg
- 편집기 최신 버전(18:07)은 운영 버전과 다르다. 학부모 숙제 점수/시각 표시 관련 미배포 변경이 있으며 이관에서 섞지 않는다. 최신 편집기 백업은 gitignored work/source/Code.gs.txt에 있다.

2026-10-08 부터 이 파일은 v80 원본 그대로가 아니다 — 원장님 요청으로 시험 재응시 규칙을 넣었다 (docs/decisions.md 10번).
위 SHA-256 은 v80 원본 값이다. 원본은 깃 커밋 5f89b43 의 판이다.

테스트는 이 원본을 VM에서 실행하고 비식별 데이터를 주입한다. 운영 데이터나 인증 토큰은 fixture에 포함하지 않는다. 운영 서버에 대한 쓰기 요청은 발생하지 않는다.
