// 화면 JS ⑥ 채팅 그리기 (밀서, 투표 집계, 유언 등)
export const clientLog = `// ---- 채팅 보여주기 ----
function chOf(l){return String(l.channel||"CHAT").replace(/[^A-Z0-9_]/g,"")||"CHAT";}
function isNight(ch){return ch!=="CHAT"&&ch!=="MEGAPHONE"&&ch!=="GHOSTCHAT"&&ch!=="WILL";}
function userByName(n){
  if(!n)return null;
  if(NICK2USER[n])return NICK2USER[n];
  // 밀서의 받는 사람 이름이 잘려 있을 수 있어 앞부분이 같고 한 명뿐일 때만 맞춰 줌
  var hit=USERS.filter(function(u){return u.nickname&&(u.nickname.indexOf(n)===0||n.indexOf(u.nickname)===0);});
  return hit.length===1?hit[0]:null;
}
function nameWithPick(n){
  var u=userByName(n);
  return (n||"?")+(u?" · "+u.number+"픽":"");
}
function isVisible(l){
  if(l.type==="letter")return SHOW_NIGHT; // 밀서도 밤챗으로 취급
  if(l.type==="system")return !(ANON&&VOTE_RE.test(l.message));
  var ch=chOf(l);
  if(ch==="GHOSTCHAT")return SHOW_GHOST;
  if(isNight(ch))return SHOW_NIGHT;
  return true;
}

// ---- 투표 익명: 득표 현황 카드 ----
function newTally(idx){
  var key="t"+idx; // 첫 투표 줄 번호 기준. 일반 줄의 주석과 겹치지 않도록 구분
  var item=el("div","item");
  var card=el("div","tally");
  var slot=el("div","annslot");
  card.onclick=function(){openEditor(slot,key,"center");};
  item.appendChild(card);
  item.appendChild(slot);
  renderAnn(slot,key,false,"center");
  return {item:item,card:card,counts:{}};
}
function fillTally(g){
  g.card.textContent="";
  g.card.appendChild(el("div","thead","투표 결과"));
  var rows=Object.keys(g.counts).map(function(k){return {n:Number(k),c:g.counts[k]};});
  rows.sort(function(a,b){return b.c-a.c||a.n-b.n;});
  rows.forEach(function(r){
    var u=USERS[r.n-1];
    var row=el("div","trow");
    row.appendChild(makeAvatar(u,"tally-av"));
    row.appendChild(el("div","tname",(u&&u.nickname)||(r.n+"번")));
    row.appendChild(el("div","tcnt",r.c+"표"));
    g.card.appendChild(row);
  });
}

function renderLogs(){
  var log=document.getElementById("log");log.textContent="";
  OPEN=null;
  var prevKey=null;
  var group=null;
  var me=VIEW&&USERS[VIEW-1]?USERS[VIEW-1].nickname:null;
  // 연속된 "N님이 M님에게 투표" 메시지가 끝나는 자리(최후의 반론 앞)에 득표 결과 카드를 넣음
  function flush(){
    if(group){fillTally(group);log.appendChild(group.item);group=null;prevKey=null;}
  }
  DATA.logs.forEach(function(l,i){
    var vm=(l.type==="system")?VOTE_LINE.exec(l.message):null;
    if(vm){
      if(!group)group=newTally(i);
      group.counts[vm[2]]=(group.counts[vm[2]]||0)+1;
      if(ANON)return; // 투표 익명이면 개별 투표 메시지는 숨김 (익명이 아니면 아래에서 그대로 표시)
    }else{
      flush();
    }
    if(!isVisible(l))return;
    var item=el("div","item");
    var slot=el("div","annslot");

    if(l.type==="system"){
      var sys=el("div","sys",l.message);
      sys.onclick=function(){openEditor(slot,i,"center");};
      item.appendChild(sys);
      item.appendChild(slot);
      renderAnn(slot,i,false,"center");
      log.appendChild(item);
      prevKey=null;
      return;
    }

    if(l.type==="letter"){
      var lt=el("div","letter");
      var hd=el("div","lhead");
      hd.appendChild(el("span","lfrom","From. "+nameWithPick(l.from)));
      hd.appendChild(el("span","ltitle","밀서"));
      hd.appendChild(el("span","lto","To. "+nameWithPick(l.to)));
      lt.appendChild(hd);
      lt.appendChild(el("div","lmsg",l.message));
      lt.onclick=function(){openEditor(slot,i,"center");};
      item.appendChild(lt);
      item.appendChild(slot);
      renderAnn(slot,i,false,"center");
      log.appendChild(item);
      prevKey=null;
      return;
    }

    var ch=chOf(l);
    var known=!!KNOWN[ch];
    var key=(l.nickname||"")+"|"+ch;
    var first=key!==prevKey;prevKey=key;
    var mine=!!me&&l.nickname===me;

    var text=l.message;
    if(ch==="WILL"&&!/^\\s*\\[유언\\]/.test(text))text='[유언] "'+text+'"';

    var klass=ch==="WILL"?"ch-CHAT":(known?"ch-"+ch:"ch-other");
    var bubble=el("div","bubble "+klass+(first?" first":""));
    if(!known)bubble.appendChild(el("span","tag",ch||"?"));
    bubble.appendChild(document.createTextNode(text));
    var mode=mine?"me":"other";
    bubble.onclick=function(){openEditor(slot,i,mode);};

    var row=el("div","row"+(mine?" me":""));
    if(mine){
      row.appendChild(bubble);
    }else{
      row.appendChild(first?makeAvatar(NICK2USER[l.nickname],"chat-av"):el("div","av-spacer"));
      var col=el("div","col");
      if(first){
        col.appendChild(el("div","name",nameWithPick(l.nickname)));
      }
      col.appendChild(bubble);
      row.appendChild(col);
    }
    item.className="item"+(first?"":" cont");
    item.appendChild(row);
    item.appendChild(slot);
    renderAnn(slot,i,false,mode);
    log.appendChild(item);
  });
  flush();
}

`;
