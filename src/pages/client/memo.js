import { JOB_SECTIONS } from "../../jobs.js";

// 화면 JS ⑨ 직업 메모장: 참가자 아이콘을 누르면 그 사람 아래에 직업 후보 메모가 열림
export const clientMemo = `
var MEMO_SECTIONS=${JSON.stringify(JOB_SECTIONS)};
var MEMO={},MEMO_SEL=0;
function memoKey(){return "m42memo:"+LANG+":"+ID;}
function loadMemo(){
  try{var s=localStorage.getItem(memoKey());var o=s?JSON.parse(s):{};MEMO=(o&&typeof o==="object")?o:{};}
  catch(e){MEMO={};}
}
function saveMemo(){try{localStorage.setItem(memoKey(),JSON.stringify(MEMO));}catch(e){}}
function memoState(n,name){return (MEMO[n]&&MEMO[n][name])||0;}
function renderMemoBox(n){
  var box=el("div","memo");
  box.appendChild(el("div","memotitle","메모장 · "+n+"픽 직업 추리"));
  var sc=el("div","memoscroll");
  MEMO_SECTIONS.forEach(function(sec){
    if(sec.title)sc.appendChild(el("div","memosec","<"+sec.title+">"));
    sec.rows.forEach(function(r){
      var row=el("div","memorow");
      r.forEach(function(j){
        var name=j[0],code=j[1];
        var cell=el("div","memocell s"+memoState(n,name));
        var ic=el("div","micon");
        var img=document.createElement("img");
        img.alt=name;
        img.src=code?"https://mafia42.com/chat/jobs/jobthumb_"+code+".png":UNKNOWN_ICON;
        img.onerror=function(){img.remove();ic.appendChild(el("span","mfb","?"));};
        ic.appendChild(img);
        cell.appendChild(ic);
        cell.appendChild(el("div","mlabel",name));
        cell.onclick=function(e){
          e.stopPropagation();
          var v=(memoState(n,name)+1)%3; // 없음 → 후보 → 제외 → 없음
          if(!MEMO[n])MEMO[n]={};
          if(v)MEMO[n][name]=v;else delete MEMO[n][name];
          cell.className="memocell s"+v;
          saveMemo();
          updateMemoCount(n);
        };
        row.appendChild(cell);
      });
      sc.appendChild(row);
    });
  });
  box.appendChild(sc);
  box.appendChild(el("div","memohint","누르면 후보(초록) → 제외(빨강) → 해제 순서로 바뀌어요."));
  return box;
}
function memoCount(n){
  var o=MEMO[n]||{},c=0;
  for(var k in o){if(o[k]===1)c++;}
  return c;
}
function updateMemoCount(n){
  var t=document.getElementById("mc"+n);
  if(t){var c=memoCount(n);t.textContent=c?"후보 "+c:"";}
}
loadMemo();
`;
