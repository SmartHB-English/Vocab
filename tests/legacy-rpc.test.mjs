import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
function section(file, start, end) {
  const source = readFileSync(new URL(file, root), 'utf8');
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Review extraction boundaries in ${file}`);
  return source.slice(from, to);
}
// Execute the actual production wrappers, not a separately rewritten implementation.
const studentSource = section('index.html', 'var 부르는중_ = 0;', '/* ------------------------------- 상태 */');
const parentSource = section('parent.html', 'function api(fn){', '/* ---------- 미리보기 흉내');
function context(kind, overrides = {}) {
  const sandbox = {
    GAS: true, 안쪽: false, 미리보기: false, 창구주소: 'https://example.invalid/rpc',
    qsa: () => [], DEMO: {}, 흉내: {},
    setTimeout: callback => callback(),
    fetch: () => { throw new Error('Unexpected network access'); },
    ...overrides,
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('services/api-client.js', root), 'utf8'), sandbox);
  vm.runInContext(kind === 'student' ? studentSource : parentSource, sandbox);
  return sandbox;
}

for (const kind of ['student', 'parent']) {
  test(`${kind}: preserve RPC arguments and nested application failure`, async () => {
    let request;
    const ctx = context(kind, { fetch: async (url, options) => {
      request = { url, ...options };
      return { json: async () => ({ ok: true, 값: { ok: false, 메시지: '기존 로그인 실패' } }) };
    } });
    const result = await ctx.api('로그인', '테스트 학생', '0000');
    assert.equal(request.url, 'https://example.invalid/rpc');
    assert.equal(request.method, 'POST');
    assert.equal(request.redirect, 'follow');
    assert.equal(request.headers['Content-Type'], 'text/plain;charset=utf-8');
    assert.deepEqual(JSON.parse(request.body), { fn: '로그인', args: ['테스트 학생', '0000'] });
    assert.equal(result.ok, false);
    assert.equal(result.메시지, '기존 로그인 실패');
    if (kind === 'student') assert.equal(ctx.부르는중_, 0);
  });

  test(`${kind}: propagate server error and finish pending state`, async () => {
    const ctx = context(kind, { fetch: async () => ({ json: async () => ({ ok: false, 메시지: '서버 오류' }) }) });
    await assert.rejects(ctx.api('테스트'), /서버 오류/);
    if (kind === 'student') assert.equal(ctx.부르는중_, 0);
  });

  test(`${kind}: reject malformed JSON without automatic write retry`, async () => {
    let requests = 0;
    const ctx = context(kind, { fetch: async () => {
      requests++;
      return { json: async () => { throw new Error('invalid JSON'); } };
    } });
    await assert.rejects(ctx.api('결과저장', { 제출: 'fixture' }), /invalid JSON/);
    assert.equal(requests, 1);
    if (kind === 'student') assert.equal(ctx.부르는중_, 0);
  });

  test(`${kind}: propagate network failure`, async () => {
    const ctx = context(kind, { fetch: async () => { throw new Error('offline'); } });
    await assert.rejects(ctx.api('테스트'), /offline/);
    if (kind === 'student') assert.equal(ctx.부르는중_, 0);
  });
}

test('student: concurrent requests independently clear pending state', async () => {
  const pending = [];
  const ctx = context('student', { fetch: () => new Promise(resolve => pending.push(resolve)) });
  const a = ctx.api('숙제가져오기', '테스트');
  const b = ctx.api('내기록', '테스트');
  assert.equal(ctx.부르는중_, 2);
  pending[1]({ json: async () => ({ ok: true, 값: [] }) });
  await b;
  assert.equal(ctx.부르는중_, 1);
  pending[0]({ json: async () => ({ ok: true, 값: [] }) });
  await a;
  assert.equal(ctx.부르는중_, 0);
});

test('student: preserve Apps Script embedded success and failure path', async () => {
  let success, failure, received;
  const runner = {
    withSuccessHandler(fn) { success = fn; return this; },
    withFailureHandler(fn) { failure = fn; return this; },
    조회(...args) { received = args; success('기존 결과'); },
    실패() { failure(new Error('GAS 오류')); },
  };
  const ctx = context('student', { 안쪽: true, google: { script: { run: runner } } });
  assert.equal(await ctx.api('조회', '테스트'), '기존 결과');
  assert.deepEqual(received, ['테스트']);
  await assert.rejects(ctx.api('실패'), /GAS 오류/);
  assert.equal(ctx.부르는중_, 0);
});

test('student and parent: demo modes remain offline', async () => {
  const student = context('student', { GAS: false, DEMO: { 조회: name => name } });
  const parent = context('parent', { 미리보기: true, 흉내: { 조회: token => token } });
  assert.equal(await student.api('조회', '테스트'), '테스트');
  assert.equal(await parent.api('조회', 'fixture-token'), 'fixture-token');
});

for (const [file, state, fn, args] of [
  ['sw.js', { 창구: 'https://example.invalid/rpc', 반: '테스트반' }, '공지가져오기', ['테스트반']],
  ['parent-sw.js', { 창구: 'https://example.invalid/rpc', 토큰: 'fixture-token', 주소: './parent.html' }, '학부모보기', ['fixture-token', true]],
]) {
  test(`${file}: preserve background push RPC and fallback notification`, async () => {
    const events = new Map();
    const notifications = [];
    let request;
    const self = {
      addEventListener: (name, handler) => events.set(name, handler),
      registration: { showNotification: async (...values) => notifications.push(values) },
    };
    const ctx = vm.createContext({
      ...self,
      caches: { open: async () => ({ match: async () => ({ json: async () => state }) }) },
      fetch: async (url, options) => {
        request = { url, ...options };
        return { json: async () => ({ ok: false }) };
      },
    });
    ctx.self = ctx;
    vm.runInContext(readFileSync(new URL(file, root), 'utf8'), ctx);
    let job;
    events.get('push')({ waitUntil: promise => { job = promise; } });
    await job;
    assert.equal(request.url, state.창구);
    assert.deepEqual(JSON.parse(request.body), { fn, args });
    assert.equal(notifications.length, 1);
    assert.ok(notifications[0][1].body);
  });
}
