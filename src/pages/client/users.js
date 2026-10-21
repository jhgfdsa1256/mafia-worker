// 화면 JS ④ 직업 아이콘, 도굴 표시, 참가자 목록
export const clientUsers = `// ---- 직업 아이콘 (숨김 상태이거나 직업을 모르면 추리중 이미지) ----
function makeAvatar(u,extra){
  var box=el("div","jobbox"+(extra?" "+extra:""));
  var job=u&&u.job;
  if(HIDE||!job||!/^[a-z0-9_]+$/.test(job)){
    var q=document.createElement("img");
    q.alt="?";
    q.src=UNKNOWN_ICON;
    q.onerror=function(){q.remove();box.appendChild(el("span","qmark","?"));};
    box.appendChild(q);
  }else{
    var img=document.createElement("img");
    img.alt=job;
    img.src="https://mafia42.com/chat/jobs/jobthumb_"+job+".png";
    img.onerror=function(){img.remove();box.appendChild(el("span","jobfb",job));};
    box.appendChild(img);
    if(job==="ghoul"&&GHOUL_JOB&&/^[a-z0-9_]+$/.test(GHOUL_JOB)){
      var gb=el("div","ghoulbox");
      var gi=document.createElement("img");
      gi.alt=GHOUL_JOB;
      gi.src="https://mafia42.com/chat/jobs/jobthumb_"+GHOUL_JOB+".png";
      gi.onerror=function(){gi.remove();};
      gb.appendChild(gi);
      box.appendChild(gb);
    }
  }
  return box;
}

// 첫날 밤 희생자의 직업을 도굴꾼이 가져가는 것으로 보고 계산 (첫 "날이 밝았습니다" 전에 나온 사망 메시지)
function calcGhoul(){
  GHOUL_JOB=null;
  var gh=USERS.filter(function(u){return u.job==="ghoul";})[0];
  if(!gh||!DATA)return;
  for(var i=0;i<DATA.logs.length;i++){
    var l=DATA.logs[i];
    if(l.type!=="system")continue;
    if(/^\\s*날이 밝았습니다/.test(l.message))return;
    var m=/^\\s*(\\d+)\\s*님이\\s*(?:\\S*당하였습니다|사망하였습니다|죽었습니다)/.exec(l.message);
    if(m){
      var n=Number(m[1]);
      if(n===gh.number)return;
      var v=USERS[n-1];
      GHOUL_JOB=(v&&v.job)||null;
      return;
    }
  }
}

function renderUsers(){
  var box=document.getElementById("users");box.textContent="";
  USERS.forEach(function(u){
    var row=el("div","player pick"+(MEMO_SEL===u.number?" sel":""));
    var icon=makeAvatar(u,"");
    icon.appendChild(el("span","badge",String(u.number)));
    row.appendChild(icon);
    var nm=el("div","pname",u.nickname||"?");
    row.appendChild(nm);
    var mc=el("span","mcount","");
    mc.id="mc"+u.number;
    var c=memoCount(u.number);if(c)mc.textContent="후보 "+c;
    row.appendChild(mc);
    row.onclick=function(){
      MEMO_SEL=(MEMO_SEL===u.number)?0:u.number;
      renderUsers();
      // 메모장이 열리면 그 사람이 오른쪽 날개(메모장) 맨 위에 오도록 스크롤
      var cur=document.querySelector(".player.sel"),wing=document.querySelector(".wing.right");
      if(cur&&wing)wing.scrollTop+=cur.getBoundingClientRect().top-wing.getBoundingClientRect().top-8;
    };
    box.appendChild(row);
    if(MEMO_SEL===u.number)box.appendChild(renderMemoBox(u.number));
  });
}

`;
