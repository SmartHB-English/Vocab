// 앱 이름에서 「해법」 을 뺐다 (2026-10-08) — 보이는 글은 「영단어학습프로그램」, 바깥과 묶인 주소·아이디는 그대로
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const 읽기 = 파일 => readFileSync(new URL('../' + 파일, import.meta.url), 'utf8');
const 볼파일 = ['index.html', 'parent.html', 'sw.js', 'parent-sw.js', 'manifest.json', 'parent-manifest.json',
  'capacitor.config.json', 'app/app-boot.js', 'tests/fixtures/legacy/Code.gs'];
// 이미 설치한 기기의 것을 옮겨 오려고 일부러 남긴 옛 이름 — 이 상수 줄만 「해법」 이 있어도 된다
const 옛이름줄 = /^var 옛(칸이름|열쇠앞|그림폴더이름) = '[^']*';\r?$/;

test('보이는 글에 「해법」 이 한 번도 안 나온다 (옛 이름 상수 줄만 빼고)', () => {
  for (const 파일 of 볼파일) {
    const 남은 = 읽기(파일).split('\n').filter(줄 => 줄.includes('해법') && !옛이름줄.test(줄));
    assert.deepEqual(남은, [], 파일);
  }
});

test('옛 이름 상수는 서비스워커 둘 · 학부모 화면 · 엔진에 하나씩만', () => {
  for (const [파일, 수] of [['sw.js', 1], ['parent-sw.js', 1], ['parent.html', 1], ['tests/fixtures/legacy/Code.gs', 1], ['index.html', 0]]) {
    assert.equal(읽기(파일).split('\n').filter(줄 => 줄.includes('해법')).length, 수, 파일);
  }
});

test('manifest 이름이 「영단어학습프로그램」 이다', () => {
  const 학생 = JSON.parse(읽기('manifest.json')), 학부모 = JSON.parse(읽기('parent-manifest.json'));
  assert.equal(학생.name, '영단어학습프로그램');
  assert.equal(학생.short_name, '영단어학습프로그램');
  assert.equal(학부모.name, '홍제인왕영어 학부모');
  assert.equal(학부모.short_name, '영단어학습프로그램 학부모');
  assert.equal(JSON.parse(읽기('capacitor.config.json')).appName, '인왕보카');
  assert.match(읽기('index.html'), /<title>영단어학습프로그램<\/title>/);
});

test('바깥과 묶인 주소 · 아이디는 그대로 있다', () => {
  const 주소 = 'https://smarthb-english.github.io/Vocab/';
  assert.ok(읽기('tests/fixtures/legacy/Code.gs').includes(주소 + 'parent.html'), '학부모 링크 기본 주소');
  assert.ok(읽기('index.html').includes(주소 + 'parent.html#k='), '화면이 만드는 학부모 링크');
  assert.ok(읽기('app/app-boot.js').includes(주소 + 'app-update/version.json'), '앱 OTA 주소');
  assert.ok(읽기('scripts/build-app.mjs').includes(주소 + 'app-update/'));
  const 프로젝트 = JSON.parse(읽기('.firebaserc')).projects.migration;
  assert.equal(프로젝트, 'smarthb-vocab-20261007');
  assert.ok(읽기('services/firebase-config.mjs').includes(`"projectId": "${프로젝트}"`));
  assert.equal(JSON.parse(읽기('capacitor.config.json')).appId, 'com.smarthb.vocab');
});

/* 가짜 caches — 이름 → (열쇠 → 값) */
function 가짜칸들(처음 = {}, 터짐 = false) {
  const 칸들 = new Map(Object.entries(처음).map(([k, v]) => [k, new Map(Object.entries(v))]));
  const 칸 = 이름 => {
    if (!칸들.has(이름)) 칸들.set(이름, new Map());
    const m = 칸들.get(이름);
    return { keys: async () => [...m.keys()], match: async q => m.get(q), put: async (q, r) => { m.set(q, r); } };
  };
  const caches = {
    has: async 이름 => { if (터짐) throw new Error('막힘'); return 칸들.has(이름); },
    open: async 이름 => 칸(이름),
    delete: async 이름 => 칸들.delete(이름),
  };
  return { caches, 칸들 };
}
async function 깨우기(파일, caches) {
  const 손잡이 = {}; let 붙음 = 0;
  const self = { addEventListener: (k, f) => { 손잡이[k] = f; }, skipWaiting() {}, clients: { claim: async () => { 붙음++; } } };
  const ctx = vm.createContext({ self, caches, Response: class {}, Promise, console });
  vm.runInContext(읽기(파일), ctx, { filename: 파일 });
  let 기다림;
  손잡이.activate({ waitUntil: p => { 기다림 = p; } });
  await 기다림;
  return { ctx, 붙음 };
}

for (const [파일, 옛, 새] of [['sw.js', '해법영단어-설정', '영단어학습-설정'], ['parent-sw.js', '해법학부모-설정', '영단어학습-학부모-설정']]) {
  test(`${파일} — 깨어날 때 옛 칸의 것을 새 칸으로 옮기고 옛 칸은 지운다`, async () => {
    const { caches, 칸들 } = 가짜칸들({ [옛]: { '/__내정보': '옛것', '/__학부모정보': '옛것2' }, [새]: { '/__학부모정보': '새것' } });
    const { 붙음 } = await 깨우기(파일, caches);
    assert.equal(칸들.has(옛), false);
    assert.equal(칸들.get(새).get('/__내정보'), '옛것');
    assert.equal(칸들.get(새).get('/__학부모정보'), '새것');        // 새 칸에 이미 있으면 새것이 맞다
    assert.equal(붙음, 1);
  });
  test(`${파일} — 옛 칸이 없거나 caches 가 터져도 깨어난다 (알림이 죽으면 안 된다)`, async () => {
    const 없음 = 가짜칸들({});
    assert.equal((await 깨우기(파일, 없음.caches)).붙음, 1);
    assert.equal(없음.칸들.size, 0);
    assert.equal((await 깨우기(파일, 가짜칸들({}, true).caches)).붙음, 1);
  });
}

test('학부모 화면 — 옛 열쇠(토큰 · 안내닫음 · 알림)를 한 번 옮겨 온다', () => {
  const 화면 = 읽기('parent.html');
  const 앞 = 화면.indexOf("var 열쇠앞 = '"), 뒤 = 화면.indexOf('var 토큰 = ', 앞);
  assert.ok(앞 > 0 && 뒤 > 앞);
  // 토큰을 읽기 전에 옮긴다 — 그 사이 토막만 떼어 돌린다
  const 토막 = 화면.slice(앞, 화면.indexOf('\n', 화면.indexOf("저장쓰기(옛열쇠앞 + k, null);")) + 1) + '});';
  const 판 = new Map([['해법학부모_토큰', 'a'.repeat(64)], ['해법학부모_안내닫음', '1'], ['영단어학습-학부모_알림', '새것'], ['해법학부모_알림', '옛것']]);
  const localStorage = { getItem: k => (판.has(k) ? 판.get(k) : null), setItem: (k, v) => 판.set(k, String(v)), removeItem: k => 판.delete(k) };
  const ctx = vm.createContext({ localStorage });
  vm.runInContext(토막, ctx);
  assert.equal(판.get('영단어학습-학부모_토큰'), 'a'.repeat(64));
  assert.equal(판.get('영단어학습-학부모_안내닫음'), '1');
  assert.equal(판.get('영단어학습-학부모_알림'), '새것');
  assert.deepEqual([...판.keys()].filter(k => k.startsWith('해법')), []);
});
