// 화면 JS ⑧ 메모장 버튼과 시작 처리 (데이터 불러오기)
export const clientInit = `(function(){
  var b=document.getElementById("sheetbtn");
  if(!b)return;
  b.onclick=function(){
    var open=document.body.classList.toggle("sheet-open");
    b.textContent=open?"▼":"▲";
    b.setAttribute("aria-label",open?"메모장 내리기":"메모장 열기");
    b.setAttribute("aria-expanded",open?"true":"false");
  };
})();

fetch("/api/me").then(function(r){return r.json();}).catch(function(){return {};}).then(function(me){
  ME={configured:!!me.configured,loggedIn:!!me.loggedIn,name:me.name||null};
  setupAuth();
  return ME.loggedIn?loadAnnServer():false;
}).then(function(fromServer){
  if(!fromServer)loadAnn();
  return fetch("/api/replay?id="+ID+"&lang="+LANG+"&v=4");
}).then(function(r){return r.json();}).then(function(d){
  var log=document.getElementById("log");log.textContent="";
  if(d.error){log.appendChild(el("div","sys",d.error));return;}
  DATA=d;USERS=d.users||[];
  USERS.forEach(function(u){if(u.nickname&&!NICK2USER[u.nickname])NICK2USER[u.nickname]=u;});
  calcGhoul();

  var hide=document.getElementById("hide");
  hide.checked=true;HIDE=true;
  hide.onchange=function(){HIDE=hide.checked;renderUsers();renderLogs();};

  var anon=document.getElementById("anon");
  anon.checked=true;ANON=true;
  anon.onchange=function(){ANON=anon.checked;renderLogs();};

  var night=document.getElementById("night");
  night.checked=false;SHOW_NIGHT=false;
  night.onchange=function(){SHOW_NIGHT=night.checked;renderLogs();};

  var ghost=document.getElementById("ghost");
  ghost.checked=false;SHOW_GHOST=false;
  ghost.onchange=function(){SHOW_GHOST=ghost.checked;renderLogs();};

  var sel=document.getElementById("view");
  USERS.forEach(function(u){
    var o=document.createElement("option");
    o.value=String(u.number);o.textContent=u.number+". "+(u.nickname||"?");
    sel.appendChild(o);
  });
  sel.value="0";VIEW=0;
  sel.onchange=function(){VIEW=Number(sel.value)||0;renderLogs();};

  if(d.winningTeam){var w=document.getElementById("win");w.hidden=false;w.textContent="결과: "+d.winningTeam;}
  renderUsers();
  renderLogs();

  var b=document.getElementById("extract");
  b.disabled=false;
  b.onclick=buildJsonTools;
}).catch(function(){
  var log=document.getElementById("log");log.textContent="";
  log.appendChild(el("div","sys","불러오지 못했어요."));
});
`;
