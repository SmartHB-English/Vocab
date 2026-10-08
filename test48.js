/* 공지 백엔드 — 학원 전체 하나로, 기한, 켜고 끄기 */
const fs=require('fs'), vm=require('vm');
const src=fs.readFileSync(require('path').join(__dirname, 'Code.gs'),'utf8');
const SH={공지:[],학생:[],설정:[]};
let 지운행=[];
const 공지시트={
  getLastRow:()=>SH.공지.length+1,
  appendRow(r){ SH.공지.push(r.slice()); },
  deleteRow(n){ 지운행.push(n); SH.공지.splice(n-2,1); },
  getRange(r,c,nr,nc){ return {
    getValues:()=>SH.공지.slice(r-2,r-2+(nr||1)).map(x=>x.slice(c-1,c-1+(nc||1))),
    setValues(v){ v.forEach((x,i)=>{ const 줄=SH.공지[r-2+i]; if(줄) x.forEach((y,j)=>줄[c-1+j]=y); }); return this; },
    setValue(v){ const 줄=SH.공지[r-2]; if(줄) 줄[c-1]=v; return this; },
    setNumberFormat(){return this;}, setFontWeight(){return this;}, setBackground(){return this;}
  };},
  setFrozenRows(){}, setColumnWidth(){}, getLastColumn:()=>6, getMaxColumns:()=>6
};
const ctx={ console,
  Utilities:{formatDate(d,tz,f){const p=n=>String(n).padStart(2,'0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}},
  Session:{getScriptTimeZone:()=>'Asia/Seoul'},
  SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>(n==='공지'?공지시트:null), insertSheet:()=>공지시트})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}
};
vm.createContext(ctx); vm.runInContext(src,ctx);
ctx.rows_=name=>(SH[name]||[]).map(r=>r.slice());
ctx.선생님확인_=비번=>비번==='1234';
const D=vm.runInContext('Date',ctx);
const 오늘=new D(); const p=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
const 어제=new D(오늘.getTime()-86400000), 내일=new D(오늘.getTime()+86400000);

let 실패=0;
function 확인(이름,실제,기대){
  const ok=JSON.stringify(실제)===JSON.stringify(기대);
  if(!ok)실패++;
  console.log((ok?'  OK  ':'  ✗   ')+이름+': '+JSON.stringify(실제)+(ok?'':'  (기대: '+JSON.stringify(기대)+')'));
}

console.log('— 올리기 —');
let r=ctx.공지등록('1234',{제목:'휴강',내용:'월요일 쉽니다',끝나는날:''});
확인('올라간다',r.ok,true);
확인('시트에 한 줄',SH.공지.length,1);
ctx.공지등록('1234',{제목:'금요일 시험',내용:'1~50번',끝나는날:ymd(내일)});
ctx.공지등록('1234',{제목:'지난 공지',내용:'끝났어요',끝나는날:ymd(어제)});
확인('빈 공지는 막는다',ctx.공지등록('1234',{제목:'',내용:''}).ok,false);
확인('날짜 모양이 틀리면 막는다',ctx.공지등록('1234',{제목:'x',끝나는날:'9/30'}).ok,false);
확인('비밀번호가 틀리면 막는다',ctx.공지등록('x',{제목:'x'}).ok,false);

console.log('\n— 학생이 받는 것 —');
let a=ctx.공지가져오기().map(x=>x.제목);
console.log('  학생이 받는 것:',a.join(' / '));
확인('안 지난 공지는 다 온다',a,['금요일 시험','휴강']);
확인('기한 지난 것은 안 온다',a.indexOf('지난 공지'),-1);
확인('누구에게나 똑같이 간다',ctx.공지가져오기().map(x=>x.제목),a);
확인('새것부터 위로',ctx.공지가져오기()[0].제목,'금요일 시험');
확인('내용도 같이 온다',ctx.공지가져오기()[0].내용,'1~50번');
확인('열쇠가 붙는다',!!ctx.공지가져오기()[0].키,true);

console.log('\n— 내리고 다시 띄우기 —');
확인('내리면 안 간다',(ctx.공지끄기('1234',2,false),ctx.공지가져오기().length),1);
확인('선생님 목록에는 남는다',ctx.공지목록('1234').공지.length,3);
확인('꺼짐 표시',ctx.공지목록('1234').공지.filter(x=>!x.켬).length,1);
확인('다시 띄우면 돌아온다',(ctx.공지끄기('1234',2,true),ctx.공지가져오기().length),2);

console.log('\n— 선생님 목록 —');
const 목록=ctx.공지목록('1234').공지;
console.log('  '+목록.map(x=>x.제목+(x.지남?'(지남)':'')).join(' / '));
확인('지난 것도 보여 준다',목록.length,3);
확인('지난 것은 표시',목록.filter(x=>x.지남).map(x=>x.제목),['지난 공지']);
확인('새것부터',목록[0].제목,'지난 공지');

console.log('\n— 지우기 —');
확인('지운다',(ctx.공지삭제('1234',2),SH.공지.length),2);
확인('없는 줄은 막는다',ctx.공지삭제('1234',99).ok,false);

console.log('\n— 시트가 없어도 —');
ctx.rows_=name=>{ if(name==='공지') throw new Error('없음'); return []; };
확인('학생 화면은 안 깨진다',ctx.공지가져오기(),[]);

console.log(실패?'\n✗ '+실패+'개 실패':'\n전부 통과');
process.exit(실패?1:0);
