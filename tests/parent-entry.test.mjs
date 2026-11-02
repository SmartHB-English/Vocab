import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* 로그인 화면의 「학부모이신가요?」 입구 · 학부모 화면의 「학생 화면으로」 돌아오는 길.
   전에 그 기기에서 링크를 써 본 학부모는 기기에 적힌 토큰으로 바로 들어가고,
   잘못 들어온 아이(아이폰 앱엔 뒤로가기가 없다)는 「학생 화면으로」 로 나온다. */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const index = read('../index.html'), parent = read('../parent.html');
/* 함수 하나의 글 — 이름부터 짝 맞는 } 까지 */
function 함수(source, name) {
  const from = source.indexOf('function ' + name + '(');
  assert.ok(from >= 0, name + ' 가 없다');
  let i = source.indexOf('{', from), depth = 0;
  for (; i < source.length; i++) { if (source[i] === '{') depth++; else if (source[i] === '}' && --depth === 0) break; }
  return source.slice(from, i + 1);
}

test('로그인 화면에 「학부모이신가요?」 단추가 있다', () => {
  assert.match(index, /<button class="btn line sm" id="btnParentGo">학부모이신가요\?<\/button>/);
});
test('그 단추는 parent.html 로 보낸다', () => {
  const at = index.indexOf("$('btnParentGo').onclick");
  assert.ok(at > 0);
  assert.match(index.slice(at, index.indexOf('\n', at)), /location\.href = 'parent\.html'/);
});
test('그 단추는 로그인 화면 안, 사용법 보기와 꼬리글(.foot) 사이에 있다', () => {
  const 로그인 = index.indexOf('<section id="s-login"'), 끝 = index.indexOf('</section>', 로그인);
  const 안내 = index.indexOf('id="btnGuide"', 로그인), 학부모 = index.indexOf('id="btnParentGo"', 로그인), 꼬리 = index.indexOf('<div class="foot">', 로그인);
  assert.ok(로그인 < 안내 && 안내 < 학부모 && 학부모 < 꼬리 && 꼬리 < 끝);
});
test('index.html 에는 여전히 선생님 화면 주소가 없다', () => {
  assert.equal(index.includes('teacher.html'), false);
});
test('parent.html 의 학생화면단추_ 는 index.html 로 보낸다 (해시가 주소에 남지 않게 location 으로)', () => {
  assert.match(함수(parent, '학생화면단추_'), /id="pToKid">학생 화면으로</);
  assert.match(함수(parent, '학생화면단추붙이기_'), /location\.href = 'index\.html'/);
});
test('자료 화면(그리기)과 토큰 없는 안내 화면 둘 다 그 단추를 넣고 붙인다', () => {
  const 그리기 = 함수(parent, '그리기');
  assert.match(그리기, /h\.push\(학생화면단추_\(\)\);\n\s*\$\('app'\)\.innerHTML = h\.join\(''\);\n\s*학생화면단추붙이기_\(\);/);
  /* 토큰 없는 화면은 프롬프트 32 에서 아이 이름 + 비밀번호 로그인 칸이 됐다 — 거기에도 그 단추가 붙는다 */
  assert.match(함수(parent, '열기'), /if\(!토큰\)\{\s*로그인칸\(\);/);
  assert.match(함수(parent, '로그인칸'), /학생화면단추_\(\)\+'<\/div>';\n\s*학생화면단추붙이기_\(\);/);
});
test('링크가 맞지 않는 화면 · 연결이 안 되는 화면에도 넣는다 — 아이가 눌러 들어오면 여기서 갇힌다', () => {
  const 열기 = 함수(parent, '열기');
  assert.match(열기, /메시지\('🔒'[\s\S]*?학생화면단추_\(\)\);[\s\S]*?학생화면단추붙이기_\(\);/);
  assert.match(열기, /메시지\('📶'[\s\S]*?학생화면단추_\(\)\);[\s\S]*?학생화면단추붙이기_\(\);/);
});
test('parent.html 에 바깥 사이트로 나가는 링크가 늘지 않았다 (전화 걸기만)', () => {
  const 링크 = [...parent.matchAll(/href="([^"]*)"/g)].map(m => m[1]).filter(h => /^https?:/.test(h));
  assert.deepEqual(링크.filter(h => !/fonts\.(googleapis|gstatic)\.com|cdn/.test(h)), []);
});
