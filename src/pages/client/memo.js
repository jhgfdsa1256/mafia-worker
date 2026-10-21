import { JOB_SECTIONS } from "../../jobs.js";

// 화면 JS ⑨ 직업 메모장: 참가자 아이콘을 누르면 그 사람 아래에 직업 후보 메모가 열림
export const clientMemo = `
var MEMO_SECTIONS=${JSON.stringify(JOB_SECTIONS)};
var MEMO={};      // MEMO[참가자번호] = 추리한 직업 이름
var MEMO_SEL=0;
var JOBCODE={};
MEMO_SECTIONS.forEach(function(sec){sec.rows.forEach(function(r){r.forEach(function(j){JOBCODE[j[0]]=j[1];});});});
function memoKey(){return "m42memo2:"+LANG+":"+ID;}
function loadMemo(){
  MEMO={};
  try{
    var s=localStorage.getItem(memoKey());var o=s?JSON.parse(s):{};
    if(o&&typeof o==="object"){for(var k in o){if(typeof o[k]==="string"&&JOBCODE[o[k]])MEMO[k]=o[k];}}
  }catch(e){}
}
function saveMemo(){try{localStorage.setItem(memoKey(),JSON.stringify(MEMO));}catch(e){}}
// 숨김 상태에서 이 참가자에게 보여줄 추리 직업 코드 (없으면 null)
function guessCode(n){
  var name=MEMO[n];
  return (name&&JOBCODE[name])?JOBCODE[name]:null;
}
function updateMemoLabel(n){
  var t=document.getElementById("mc"+n);
  if(t)t.textContent=(HIDE&&MEMO[n])?MEMO[n]:"";
}
function renderMemoBox(n){
  var box=el("div","memo");
  var tt=el("div","memotitle");
  tt.appendChild(el("span","","메모장 · "+n+"픽 직업 추리"));
  var cb=el("button","memoclose","✕");
  cb.onclick=function(e){e.stopPropagation();closeMemo();};
  tt.appendChild(cb);
  box.appendChild(tt);
  var sc=el("div","memoscroll");
  var cells=[];
  MEMO_SECTIONS.forEach(function(sec){
    if(sec.title)sc.appendChild(el("div","memosec","<"+sec.title+">"));
    sec.rows.forEach(function(r){
      var row=el("div","memorow");
      r.forEach(function(j){
        var name=j[0],code=j[1];
        var cell=el("div","memocell"+(MEMO[n]===name?" on":""));
        var ic=el("div","micon");
        var img=document.createElement("img");
        img.alt=name;
        img.src=code?"https://mafia42.com/chat/jobs/jobthumb_"+code+".png":UNKNOWN_ICON;
        img.onerror=function(){img.remove();ic.appendChild(el("span","mfb","?"));};
        ic.appendChild(img);
        cell.appendChild(ic);
        cell.appendChild(el("div","mlabel",name));
        cells.push([cell,name]);
        cell.onclick=function(e){
          e.stopPropagation();
          // 같은 직업을 다시 누르거나 '추리중'을 누르면 해제
          if(MEMO[n]===name||!code)delete MEMO[n];else MEMO[n]=name;
          cells.forEach(function(c){c[0].className="memocell"+(MEMO[n]===c[1]?" on":"");});
          saveMemo();
          refreshAvatars(n);
          updateMemoLabel(n);
          closeMemo(); // 직업을 고르면 메모장을 닫음
        };
        row.appendChild(cell);
      });
      sc.appendChild(row);
    });
  });
  box.appendChild(sc);
  box.appendChild(el("div","memohint","직업을 누르면 이 참가자의 아이콘이 그 직업으로 바뀌고 메모장이 닫혀요. 같은 직업을 다시 누르면 해제돼요. '직업 숨기기'를 끄면 진짜 직업이 보여요."));
  return box;
}
// 화면 한가운데에 메모장을 띄움 (바깥을 누르거나 Esc를 눌러도 닫힘)
function openMemo(n){
  closeMemoBox();
  MEMO_SEL=n;
  var bg=el("div","modalbg");
  bg.id="memoov";
  bg.onclick=function(){closeMemo();};
  var box=renderMemoBox(n);
  box.onclick=function(e){e.stopPropagation();};
  bg.appendChild(box);
  document.body.appendChild(bg);
}
function closeMemoBox(){var o=document.getElementById("memoov");if(o)o.remove();}
function closeMemo(){
  closeMemoBox();
  if(MEMO_SEL){MEMO_SEL=0;renderUsers();}
}
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&document.getElementById("memoov"))closeMemo();});
loadMemo();
`;
