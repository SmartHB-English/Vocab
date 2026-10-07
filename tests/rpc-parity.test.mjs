import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const baseline = 'a53866469a7805e30267d1090685f3cff660acfa';
const service = readFileSync(new URL('services/api-client.js', root), 'utf8');
function wrapper(source, file) {
  const start = file === 'index.html' ? 'var 부르는중_ = 0;' : 'function api(fn){';
  const end = file === 'index.html' ? '/* ------------------------------- 상태 */' : '/* ---------- 미리보기 흉내';
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from);
  return source.slice(from, to);
}
async function run(code, fixture) {
  const requests = [];
  const ctx = vm.createContext({
    GAS: true, 안쪽: false, 미리보기: false, 창구주소:'https://example.invalid/rpc', qsa:()=>[],
    fetch: async (url, options) => {
      requests.push({url, ...JSON.parse(JSON.stringify(options))});
      if (fixture.network) throw new Error(fixture.network);
      return { status: fixture.status ?? 200, json: async () => {
        if (fixture.jsonError) throw new Error(fixture.jsonError);
        return fixture.body;
      } };
    },
  });
  vm.runInContext(service, ctx); vm.runInContext(code, ctx);
  let outcome;
  try { outcome = {value:await ctx.api('結果テスト', null, 0, false, '', {한글:'값',배열:[1,2]})}; }
  catch (e) { outcome = {error:e.message}; }
  return JSON.parse(JSON.stringify({outcome,requests,pending:ctx.부르는중_}));
}
const cases = [
  {name:'object result',body:{ok:true,값:{이름:'테스트',점수:0}}},
  {name:'nested login failure',body:{ok:true,값:{ok:false,메시지:'틀림'}}},
  ...[[], null, false, 0, '', undefined].map((value,i)=>({name:`value type ${i}`,body:{ok:true,값:value}})),
  {name:'explicit error',body:{ok:false,메시지:'실패 메시지'}},
  ...[null, false, {}, {ok:false,메시지:''}].map((body,i)=>({name:`missing error ${i}`,body})),
  {name:'malformed JSON',jsonError:'bad JSON'},
  {name:'network failure',network:'offline'},
  {name:'legacy HTTP status behavior',status:503,body:{ok:false,메시지:'잠시 후'}},
];
for (const file of ['index.html','parent.html']) {
  const old = wrapper(execFileSync('git',['show',`${baseline}:${file}`],{cwd:root,encoding:'utf8'}),file);
  const current = wrapper(readFileSync(new URL(file,root),'utf8'),file);
  for (const fixture of cases) {
    test(`${file} old/new parity: ${fixture.name}`,async()=>{
      assert.deepEqual(await run(current,fixture),await run(old,fixture));
    });
  }
}

test('all inline scripts and worker sources parse',()=>{
  for (const file of ['index.html','parent.html']) {
    const source=readFileSync(new URL(file,root),'utf8');
    let count=0;
    for (const m of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
      new vm.Script(m[1],{filename:`${file}:script-${count++}`});
    }
    assert.ok(count>0);
  }
  for (const file of ['sw.js','parent-sw.js','services/api-client.js']) {
    new vm.Script(readFileSync(new URL(file,root),'utf8'),{filename:file});
  }
});
