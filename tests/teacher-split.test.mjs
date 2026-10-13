// 선생님 화면을 teacher.html 로 떼어냈다 (2026-10-12). 두 화면이 같은 것을 따로 들고 있다가 한쪽만 고쳐 갈라지지 않게 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const 읽기 = 파일 => readFileSync(new URL('../' + 파일, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const 학생 = 읽기('index.html'), 선생님 = 읽기('teacher.html');
const 표시 = 원본 => [`/* BEGIN GENERATED ${원본} */`, `/* END GENERATED ${원본} */`];
/* 박힌 블록(공용)을 걷어 낸 그 화면만의 글 */
const 제것 = 글 => 글.replace(/\/\* BEGIN GENERATED (\S+) \*\/[\s\S]*?\/\* END GENERATED \1 \*\//g, '');

test('teacher.html 에 공용 블록(api-client · shared-ui)이 둘 다 박혀 있고, 창구주소가 그보다 앞에 있다', () => {
  for (const 원본 of ['services/api-client.js', 'services/shared-ui.js', 'services/shared-ui.css']) {
    const [처음, 끝] = 표시(원본);
    assert.equal(선생님.split(처음).length, 2, 원본);
    assert.ok(선생님.indexOf(끝) > 선생님.indexOf(처음), 원본);
  }
  // shared-ui.js 의 GAS 가 창구주소를 읽는다 — 블록보다 앞에서 정해 두지 않으면 미리보기로 돈다
  for (const [이름, 글] of [['index.html', 학생], ['teacher.html', 선생님]]) {
    const 창구 = 글.indexOf('var 창구주소 = VocabApi.defaultEndpoint;');
    assert.ok(창구 > 0 && 창구 < 글.indexOf(표시('services/shared-ui.js')[0]), 이름);
  }
});

test('index.html 에 선생님 코드가 안 남아 있다', () => {
  for (const 이름 of ['loadTeacher', '선생님들어가기_', 'id="s-teacher"']) assert.ok(!학생.includes(이름), 이름);
});

test('teacher.html 에 학생 전용 코드(유치부 · 게임 · 학생 로그인)가 안 들어갔다', () => {
  for (const 이름 of ['유치길그리기_', 'startPuzzle', 'id="s-login"', 'id="s-kid"']) assert.ok(!선생님.includes(이름), 이름);
});

test('teacher.html 은 홈 화면에 설치된다 — 제 manifest · 제 서비스워커 · 푸시 구독은 없다', () => {
  assert.match(선생님, /<link rel="manifest" href="teacher-manifest\.json">/);
  assert.match(선생님, /serviceWorker\.register\('teacher-sw\.js', \{scope:'\.\/teacher\.html'\}\)/);
  assert.doesNotMatch(선생님, /pushManager\.subscribe/);
  const 설명서 = JSON.parse(읽기('teacher-manifest.json'));
  assert.equal(설명서.start_url, 'teacher.html');
  assert.equal(설명서.scope, 'teacher.html');
  assert.equal(설명서.display, 'standalone');
  assert.ok(['192x192', '512x512'].every(크기 => 설명서.icons.some(i => i.sizes === 크기)));
});

/* 세 화면의 서비스워커 — 같은 주소(…/Vocab/) 아래에 산다. 범위가 겹치면 남의 화면을 가로챈다 */
test('서비스워커 범위가 겹치지 않는다 — 학생 sw.js · 학부모 parent-sw.js · 선생님 teacher-sw.js', () => {
  const 바탕 = 'https://smarthb-english.github.io/Vocab/';
  const 띄움 = (글, 일꾼) => {
    const m = new RegExp(`serviceWorker\\.register\\('${일꾼.replace('.', '\\.')}'(?:,\\s*\\{scope:'([^']+)'\\})?\\)`).exec(글);
    assert.ok(m, 일꾼 + ' 를 띄우는 곳이 없다');
    return new URL(m[1] || './', 바탕).href;                       // 범위를 안 주면 일꾼 파일이 있는 폴더
  };
  const 범위 = { 학생: 띄움(학생, 'sw.js'), 학부모: 띄움(읽기('parent.html'), 'parent-sw.js'), 선생님: 띄움(선생님, 'teacher-sw.js') };
  const 화면 = { 학생: 바탕 + 'index.html', 학부모: 바탕 + 'parent.html', 선생님: 바탕 + 'teacher.html' };
  // 그 화면을 맡는 일꾼 = 그 주소로 시작하는 범위 중 가장 긴 것 (브라우저 규칙)
  const 맡는것 = 주소 => Object.entries(범위).filter(([, s]) => 주소.startsWith(s)).sort((a, b) => b[1].length - a[1].length)[0]?.[0];
  for (const 누구 of Object.keys(화면)) assert.equal(맡는것(화면[누구]), 누구, 누구 + ' 화면은 제 일꾼이 맡아야 한다');
  // 좁은 두 범위(학부모 · 선생님)는 서로도, 학생 화면도 안 덮는다
  for (const 누구 of ['학부모', '선생님']) for (const 남 of Object.keys(화면)) if (남 !== 누구) assert.ok(!화면[남].startsWith(범위[누구]), `${누구} 범위가 ${남} 화면을 덮는다`);
  // 학생 일꾼은 범위가 넓다(./) — 그래서 fetch 를 가로채지 않아야 남의 화면을 건드리지 않는다
  assert.doesNotMatch(읽기('sw.js'), /addEventListener\(\s*['"]fetch['"]/);
  // 선생님 일꾼은 teacher.html 만 받고, 캐시는 「teacher-」 것만 만들고 지운다 (캐시 칸은 세 일꾼이 같이 쓴다)
  const 선생님일꾼 = 읽기('teacher-sw.js');
  assert.ok(선생님일꾼.includes("!/\\/teacher\\.html$/.test("));
  assert.match(선생님일꾼, /var 칸이름 = 'teacher-/);
  assert.match(선생님일꾼, /n\.indexOf\('teacher-'\) === 0 && n !== 칸이름/);
  assert.doesNotMatch(선생님일꾼, /addEventListener\(\s*['"]push['"]/);
  // 설치 설명서의 범위도 겹치지 않는다
  const 설명범위 = 파일 => new URL(JSON.parse(읽기(파일)).scope, 바탕).href;
  assert.equal(설명범위('teacher-manifest.json'), 화면.선생님);
  assert.equal(설명범위('parent-manifest.json'), 화면.학부모);
});

test('「수업 짜기 공용」 블록이 teacher.html · shared-ui.js 와 Code.gs 에 글자 하나 다르지 않게 들어 있다', () => {
  const 떼기 = (글, 어디) => {
    const 처음 = '/* ==== 수업 짜기 공용 시작', 끝 = '/* ==== 수업 짜기 공용 끝 ==== */';
    const a = 글.indexOf(처음), b = 글.indexOf(끝, a);
    assert.ok(a >= 0 && b > a, 어디);
    assert.equal(글.split(처음).length, 2, 어디 + ' — 블록은 한 번만');
    return 글.slice(a, b + 끝.length);
  };
  const 서버 = 떼기(읽기('tests/fixtures/legacy/Code.gs'), 'Code.gs');
  assert.ok(서버.length > 10000);
  assert.equal(떼기(선생님, 'teacher.html'), 서버);
  assert.equal(떼기(읽기('services/shared-ui.js'), 'shared-ui.js'), 서버);
});

test('폰 앱 번들(build-app.mjs 의 FILES)에 teacher.html 이 없다 — 앱의 선생님 입구는 깃헙 주소', () => {
  const 앱 = 읽기('scripts/build-app.mjs');
  const FILES = /const FILES = \[([\s\S]*?)\];/.exec(앱);
  assert.ok(FILES);
  assert.ok(FILES[1].includes("'index.html'"));
  assert.ok(!FILES[1].includes('teacher.html'));
  assert.ok(학생.includes("'https://smarthb-english.github.io/Vocab/teacher.html'"));
});

test('같은 이름의 함수·변수가 index.html 과 teacher.html 에 따로 정의돼 있지 않다 (공용 블록 안의 것은 뺀다)', () => {
  // 페이지마다 일부러 따로 두는 것 — 창구주소는 공용 블록보다 앞에서 정해야 한다
  const 따로둠 = new Set(['창구주소']);
  const 이름들 = 글 => new Set([...제것(글).matchAll(/^(?:function\s+([\p{L}\p{N}_$]+)\s*\(|var\s+([\p{L}\p{N}_$]+))/gmu)].map(m => m[1] || m[2]));
  const 학생쪽 = 이름들(학생), 선생님쪽 = 이름들(선생님);
  assert.ok(학생쪽.size > 200 && 선생님쪽.size > 80);           // 정말 읽었나
  const 겹침 = [...선생님쪽].filter(이름 => 학생쪽.has(이름) && !따로둠.has(이름));
  assert.deepEqual(겹침, [], '두 화면에 따로 있으면 한쪽만 고쳐 갈라진다 — services/shared-ui.js 로 올려라');
  // 공용 블록에 있는 이름을 화면 쪽에서 또 정의하지도 않는다
  const 공용 = new Set([...읽기('services/shared-ui.js').matchAll(/^(?:function\s+([\p{L}\p{N}_$]+)\s*\(|var\s+([\p{L}\p{N}_$]+))/gmu)].map(m => m[1] || m[2]));
  assert.ok(공용.has('api') && 공용.has('esc'));
  for (const [어디, 쪽] of [['index.html', 학생쪽], ['teacher.html', 선생님쪽]]) {
    assert.deepEqual([...쪽].filter(이름 => 공용.has(이름)), [], 어디);
  }
});
