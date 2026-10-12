import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
/* shared-ui.js 는 페이지에 박히는 글이라 맨 위에서 location · 창구주소 를 읽는다 — 그만큼만 흉내 낸다 */
const ui=vm.createContext({location:{protocol:'https:',hostname:'example.invalid',search:''},창구주소:'firestore:v1'});
vm.runInContext(read('../services/shared-ui.js'),ui);
/* 업무 엔진은 시험인가_ 를 밖으로 내놓지 않는다 — 생성된 엔진 글에서 그 함수들의 글을 그대로 떼어 따로 돌린다 */
function 떼기(source,name){
 const from=source.indexOf('\nfunction '+name+'(');assert.ok(from>=0,name+' 가 엔진에 없다');
 let i=source.indexOf('{',from),depth=0;
 for(;i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&--depth===0)break;}
 return source.slice(from+1,i+1);
}
const engineSource=read('../services/legacy-engine.generated.mjs').replace(/\r\n/g,'\n');
const gs=vm.createContext({});
vm.runInContext(['s_','숙제종류_','시험인가_','숙제인가_'].map(name=>떼기(engineSource,name)).join('\n'),gs);
const 종류들=['시험','보충','기한','당일','',null,undefined,'시험 ','시 험'];
test('esc 는 & < > " 를 바꾸고 null·undefined 는 빈 글',()=>{
 assert.equal(ui.esc('a & b <i> "q"'),'a &amp; b &lt;i&gt; &quot;q&quot;');
 assert.equal(ui.esc('&amp;'),'&amp;amp;');
 assert.equal(ui.esc(null),'');assert.equal(ui.esc(undefined),'');
 assert.equal(ui.esc(0),'0');assert.equal(ui.esc("it's"),"it's");
});
test('숙제종류_ 는 시험·보충·기한 은 그대로, 나머지는 당일',()=>{
 for(const v of ['시험','보충','기한'])assert.equal(ui.숙제종류_(v),v);
 for(const v of ['','당일','모르는값',null,undefined,0])assert.equal(ui.숙제종류_(v),'당일');
});
test('시험인가_ 는 종류가 시험일 때만 참',()=>{
 assert.equal(ui.시험인가_({종류:'시험'}),true);
 for(const v of ['보충','기한','',undefined])assert.equal(ui.시험인가_({종류:v}),false);
 assert.equal(ui.시험인가_(null),false);assert.equal(ui.시험인가_(undefined),false);
});
test('시험인가_ · 숙제인가_ · 숙제종류_ 가 Code.gs 와 한 글자도 다르지 않게 답한다',()=>{
 for(const v of 종류들){
  assert.equal(ui.숙제종류_(v),gs.숙제종류_(v),'숙제종류_ '+String(v));
  assert.equal(ui.시험인가_({종류:v}),gs.시험인가_({종류:v}),'시험인가_ '+String(v));
  assert.equal(ui.숙제인가_({종류:v}),gs.숙제인가_({종류:v}),'숙제인가_ '+String(v));
 }
 for(const h of [null,undefined,{}])assert.equal(ui.시험인가_(h),gs.시험인가_(h));
 /* 함수 글 자체도 같다 — 한쪽만 고치면 여기서 걸린다 */
 for(const name of ['s_','숙제종류_','시험인가_','숙제인가_'])assert.equal(떼기('\n'+read('../services/shared-ui.js').replace(/\r\n/g,'\n'),name),떼기(engineSource,name),name);
});
test('숙제인가_ 는 늘 시험인가_ 의 반대',()=>{
 for(const v of 종류들)assert.equal(ui.숙제인가_({종류:v}),!ui.시험인가_({종류:v}));
 for(const h of [null,undefined,{}])assert.equal(ui.숙제인가_(h),!ui.시험인가_(h));
});
