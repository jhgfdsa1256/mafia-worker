// 화면 JS ③ 로그인 표시, 보관함 저장 창, 주석 가져오기
export const clientAccount = `function setupAuth(){
  var box=document.getElementById("auth");box.textContent="";
  var lb=document.getElementById("libbtn"),im=document.getElementById("import"),hint=document.getElementById("hint");
  lb.hidden=true;im.hidden=true;
  if(!ME.configured){box.textContent="로그인은 아직 설정되지 않았어요.";return;}
  if(!ME.loggedIn){
    var a=el("a","gbtn","");
    a.href="/auth/login?next="+encodeURIComponent(location.pathname);
    var ic=el("span",null,"");ic.innerHTML=GOOGLE_G;
    a.appendChild(ic);a.appendChild(el("span",null,"Google로 로그인"));
    box.appendChild(a);
    box.appendChild(el("div","gnote",LOGIN_NOTE));
    return;
  }
  hint.textContent="말풍선을 누르면 주석을 달 수 있어요. 주석은 내 계정에 저장돼요.";
  box.appendChild(el("div","pname",ME.name+" 님"));
  var lo=el("button","sec","로그아웃");
  lo.onclick=function(){fetch("/auth/logout",{method:"POST"}).then(function(){location.reload();});};
  box.appendChild(lo);
  lb.hidden=false;
  var cur=null; // 보관함에 있는 내 항목
  var form=document.getElementById("libform");
  function paint(){lb.textContent=cur?"보관함 정보 수정":"보관함에 저장";}
  function today(){return new Date(Date.now()+9*3600000).toISOString().slice(2,10).replace(/-/g,"");}
  function gameDay(){
    var m=DATA&&DATA.playedAt?/^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(DATA.playedAt):null;
    return m?m[1].slice(2)+m[2]+m[3]:today(); // 리플레이에 게임 날짜가 있으면 그 날짜, 없으면 저장한 날
  }
  function defTitle(pick){var u=USERS[pick-1];return gameDay()+" "+((u&&u.nickname)||"?")+"의 게임";}
  fetch("/api/library").then(function(r){return r.json();}).then(function(d){
    (d.items||[]).forEach(function(it){if(it.lang===LANG&&it.id===ID)cur=it;});paint();
  },paint);
  lb.onclick=function(){
    form.textContent="";form.hidden=false;
    if(!USERS.length){form.appendChild(el("div","info","리플레이를 불러온 뒤에 눌러 주세요."));return;}
    form.appendChild(el("div","info","누구의 게임으로 저장할까요?"));
    var sel=document.createElement("select");
    USERS.forEach(function(u){
      var o=document.createElement("option");
      o.value=String(u.number);o.textContent=u.number+". "+(u.nickname||"?");
      sel.appendChild(o);
    });
    var pick=(cur&&cur.pick)?cur.pick:1;
    sel.value=String(pick);
    form.appendChild(sel);
    form.appendChild(el("div","info","제목"));
    var ti=document.createElement("input");
    ti.type="text";ti.maxLength=60;
    var edited=!!(cur&&cur.title);
    ti.value=(cur&&cur.title)||defTitle(pick);
    ti.oninput=function(){edited=true;};
    sel.onchange=function(){if(!edited)ti.value=defTitle(Number(sel.value));};
    form.appendChild(ti);
    var st=el("div","info","");
    var ok=el("button",null,"저장");
    ok.onclick=function(){
      var n=Number(sel.value),u=USERS[n-1]||{};
      var body={title:ti.value.trim()||defTitle(n),pick:n,nickname:u.nickname||null,job:u.job||null};
      ok.disabled=true;st.textContent="";
      fetch("/api/library/"+LANG+"/"+ID,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(function(r){
        if(r.ok){cur={lang:LANG,id:ID,title:body.title,pick:n,nickname:body.nickname,job:body.job};paint();form.hidden=true;}
        else{ok.disabled=false;st.textContent="저장하지 못했어요. 다시 시도해 주세요.";}
      },function(){ok.disabled=false;st.textContent="저장하지 못했어요. 다시 시도해 주세요.";});
    };
    form.appendChild(ok);
    if(cur){
      var rm=el("button","sec","보관함에서 빼기");
      rm.onclick=function(){
        rm.disabled=true;
        fetch("/api/library/"+LANG+"/"+ID,{method:"DELETE"}).then(function(r){
          if(r.ok){cur=null;paint();form.hidden=true;}else{rm.disabled=false;st.textContent="빼지 못했어요.";}
        },function(){rm.disabled=false;st.textContent="빼지 못했어요.";});
      };
      form.appendChild(rm);
    }
    var no=el("button","sec","닫기");
    no.onclick=function(){form.hidden=true;};
    form.appendChild(no);
    form.appendChild(st);
  };
  var loc=localNotes();
  if(Object.keys(loc).length){
    im.hidden=false;
    im.onclick=function(){
      im.disabled=true;
      fetch("/api/annotations/"+LANG+"/"+ID,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({notes:loc})}).then(function(r){
        if(r.ok){for(var k in loc){if(!ANN[k])ANN[k]=loc[k];}im.hidden=true;renderLogs();}
        else{im.disabled=false;im.textContent="가져오지 못했어요. 다시 시도";}
      },function(){im.disabled=false;});
    };
  }
}

`;
