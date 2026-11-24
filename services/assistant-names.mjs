// 비서 문(__비서)으로 부를 수 있는 이름 — 이 파일 한 곳에서 본다.
// · 엔진기능 — 엔진(Code.gs) 의 선생님 기능. scripts/build-legacy.mjs 가 이 목록을 엔진 assistant(...) 에 박는다
// · 표기능 — 저장소 쪽(services/assistant-tables.mjs). 엔진을 거치지 않고 「자료 고치기」 의 줄지우기(휴지통) 길로 지운다
// 늘리면 tests/assistant-bridge.test.mjs 가 맞대어 본다.
export const 비서엔진기능 = ['선생님기본', '선생님기록', '체크자료', '숙제예약목록', '다음숙제뽑기', '진도숙제내기', '명단가져오기', '교재일괄', '해법단어장넣기'];
export const 비서표기능 = ['옛숙제정리', '숙제예약정리'];
export const 비서기능 = [...비서엔진기능, ...비서표기능];
