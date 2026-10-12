import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

/* 유치부 낱말 소리 — sound/ 의 mp3 와 img/ 의 그림이 짝이 맞고,
   읽어주기_ 가 파일을 먼저 틀고 안 되면 기기 읽어주기(TTS)로 넘어가는지 본다 */
const root = new URL('../', import.meta.url);
const 이름들 = (dir, ext) => readdirSync(new URL(dir, root)).filter(f => f.endsWith(ext)).map(f => f.slice(0, -ext.length)).sort();

test('1) sound/ 에 mp3 가 90개 있다', () => {
  assert.equal(이름들('sound/', '.mp3').length, 90);
});

test('2) img/ 의 그림과 sound/ 의 소리가 하나도 빠짐없이 짝이 맞는다', () => {
  const 그림 = 이름들('img/', '.png'), 소리 = 이름들('sound/', '.mp3');
  assert.deepEqual(그림.filter(x => !소리.includes(x)), [], '소리가 없는 그림');
  assert.deepEqual(소리.filter(x => !그림.includes(x)), [], '그림이 없는 소리');
});

/* index.html 에서 「var 소리주소_」 부터 읽어주기_ 끝까지 떼어 온다 */
const source = readFileSync(new URL('index.html', root), 'utf8');
const 처음 = source.indexOf('var 소리주소_');
const 끝 = source.indexOf('\nfunction startBook(');
assert.ok(처음 > 0 && 끝 > 처음, '읽어주기_ 를 찾지 못했다');
const 코드 = source.slice(처음, 끝);

const 쉬기 = () => new Promise(r => setImmediate(r));

/* 있는 파일만 틀린다. 없는 파일은 브라우저처럼 onerror 와 play() 거절이 둘 다 온다 */
function 판(있는것 = ['apple']) {
  const 셈 = { 새소리: 0, 튼것: [], 읽은것: [], 멈춤: 0 };
  class Audio {
    constructor() { 셈.새소리++; this.src = ''; this.onerror = null; }
    pause() {}
    play() {
      const 낱말 = /sound\/([a-z]+)\.mp3$/.exec(this.src)?.[1];
      셈.튼것.push(낱말);
      if (있는것.includes(낱말)) return Promise.resolve();
      const e = Object.assign(new Error('없음'), { name: 'NotSupportedError' });
      setImmediate(() => this.onerror && this.onerror(e));
      return Promise.reject(e);
    }
  }
  class SpeechSynthesisUtterance { constructor(t) { this.text = t; } }
  const window = {
    speechSynthesis: { cancel: () => 셈.멈춤++, speak: u => 셈.읽은것.push(u.text) },
  };
  const ctx = { window, Audio, SpeechSynthesisUtterance, Set };
  vm.createContext(ctx);
  vm.runInContext(코드, ctx);
  return { 읽기: 글 => ctx.읽어주기_(글), 셈, ctx };
}

test('3) 파일이 있으면 파일을 튼다 — TTS 는 부르지 않는다', async () => {
  const p = 판(['apple']);
  p.읽기('Apple');
  await 쉬기();
  assert.deepEqual(p.셈.튼것, ['apple']);
  assert.deepEqual(p.셈.읽은것, []);
});

test('3) 파일이 없으면 speechSynthesis 로 한 번 넘어간다', async () => {
  const p = 판([]);
  p.읽기('ambulance');
  await 쉬기(); await 쉬기();
  assert.deepEqual(p.셈.튼것, ['ambulance']);
  assert.deepEqual(p.셈.읽은것, ['ambulance']);   // onerror 와 거절이 둘 다 와도 한 번만
});

test('3) 소리 객체는 하나만 만든다 — src 만 바꿔 쓴다', async () => {
  const p = 판(['apple', 'cat']);
  p.읽기('apple'); p.읽기('cat'); p.읽기('apple');
  await 쉬기();
  assert.equal(p.셈.새소리, 1);
  assert.equal(p.ctx.소리판_.src, 'https://smarthb-english.github.io/Vocab/sound/apple.mp3');
});

test('4) 띄어쓰기 · 기호 · 숫자가 든 글은 파일을 안 찾고 바로 TTS', async () => {
  const p = 판(['apple']);
  for (const 글 of ['go - went - gone', 'ice cream', "don't", 'A1', 'be - was / were - been']) p.읽기(글);
  await 쉬기();
  assert.deepEqual(p.셈.튼것, []);
  assert.equal(p.셈.새소리, 0);
  assert.deepEqual(p.셈.읽은것, ['go, went, gone', 'ice cream', "don't", 'A1', 'be, was / were, been']);
});

test('5) 한 번 없다고 확인된 낱말은 두 번 찾지 않는다', async () => {
  const p = 판([]);
  p.읽기('necessary');
  await 쉬기(); await 쉬기();
  p.읽기('necessary'); p.읽기('Necessary');
  await 쉬기();
  assert.deepEqual(p.셈.튼것, ['necessary']);             // 파일은 처음 한 번만
  assert.deepEqual(p.셈.읽은것, ['necessary', 'necessary', 'Necessary']);
});

test('5) 막혀서 못 튼 것(NotAllowedError)은 없다고 적지 않는다', async () => {
  const p = 판(['apple']);
  const 원래 = p.ctx.Audio.prototype.play;
  p.ctx.Audio.prototype.play = function () {
    p.셈.튼것.push('막힘');
    return Promise.reject(Object.assign(new Error('막힘'), { name: 'NotAllowedError' }));
  };
  p.읽기('apple');
  await 쉬기();
  assert.deepEqual(p.셈.읽은것, ['apple']);               // 이번엔 TTS 로
  p.ctx.Audio.prototype.play = 원래;
  p.읽기('apple');
  await 쉬기();
  assert.deepEqual(p.셈.튼것, ['막힘', 'apple']);         // 다음엔 다시 파일을 찾는다
});

test('앞 소리가 나는 중이면 TTS 를 멈추고 튼다', async () => {
  const p = 판(['apple']);
  p.읽기('apple');
  assert.ok(p.셈.멈춤 >= 1);
});
