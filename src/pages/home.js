// 첫 화면 (리플레이 입력 + 로그인 + 보관함)
import { HEAD, GOOGLE_G, LOGIN_NOTE } from "./style.js";

export const HOME_PAGE =
  HEAD("마피아42 리플레이 스터디") +
  `<body><div class="wrap">
<h1>마피아42 리플레이 스터디</h1>
<p class="sub">리플레이 링크나 방 코드를 넣고 열기를 누르세요.</p>
<div class="card">
<input id="q" type="text" placeholder="https://mafia42.com/history/kr/... 또는 방 코드" autocomplete="off">
<button id="go">열기</button>
<div class="err" id="err"></div>
</div>
<div class="card" id="acct"><div class="info">확인 중...</div></div>
<p class="credit">리플레이 조회 방식은 대현닷컴 오픈소스(<a href="https://github.com/daehyuh/daehyun-backend" target="_blank" rel="noopener noreferrer">github.com/daehyuh/daehyun-backend</a>)의 구현을 참고했습니다.</p>
</div>
<script>
var GOOGLE_G=${JSON.stringify(GOOGLE_G)},LOGIN_NOTE=${JSON.stringify(LOGIN_NOTE)};
function go(){
  var v=document.getElementById("q").value.trim();
  var m=v.match(/[0-9a-f]{32}/i);
  if(!m){document.getElementById("err").textContent="방 코드(32자)를 찾지 못했어요. 링크 전체나 방 코드를 넣어 주세요.";return;}
  var l=v.match(/\\/history\\/(kr|en)\\//i);
  var lang=l?l[1].toLowerCase():"kr";
  location.href="/replay/"+lang+"/"+m[0].toLowerCase();
}
function fmtTime(sec){
  var d=new Date(sec*1000+9*3600000).toISOString(); // 한국 시간
  return d.slice(2,4)+"/"+d.slice(5,7)+"/"+d.slice(8,10)+" "+d.slice(11,13)+":"+d.slice(14,16);
}
function askYesNo(msg,onYes){
  var bg=document.createElement("div");bg.className="modalbg";
  var box=document.createElement("div");box.className="modal";
  var t=document.createElement("div");t.className="modaltext";t.textContent=msg;
  var row=document.createElement("div");row.className="modalbtns";
  var yes=document.createElement("button");yes.className="del";yes.textContent="예";
  var no=document.createElement("button");no.className="sec";no.textContent="아니오";
  function close(){bg.remove();}
  yes.onclick=function(){close();onYes();};
  no.onclick=close;
  bg.onclick=function(e){if(e.target===bg)close();};
  row.appendChild(no);row.appendChild(yes);
  box.appendChild(t);box.appendChild(row);bg.appendChild(box);
  document.body.appendChild(bg);
  no.focus();
}
function mk(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function acct(){
  var box=document.getElementById("acct");
  fetch("/api/me").then(function(r){return r.json();}).then(function(me){
    box.textContent="";
    if(!me.configured){box.style.display="none";return;}
    if(!me.loggedIn){
      var a=mk("a","gbtn","");
      a.href="/auth/login?next=/";
      var ic=mk("span",null,"");ic.innerHTML=GOOGLE_G;
      a.appendChild(ic);a.appendChild(mk("span",null,"Google로 로그인"));
      box.appendChild(a);
      box.appendChild(mk("div","gnote",LOGIN_NOTE));
      return;
    }
    box.appendChild(mk("div","pname",me.name+" 님의 보관함"));
    var lo=mk("button","sec","로그아웃");
    lo.onclick=function(){fetch("/auth/logout",{method:"POST"}).then(function(){location.reload();});};
    box.appendChild(lo);
    var list=mk("div",null,"");box.appendChild(list);
    fetch("/api/library").then(function(r){return r.json();}).then(function(d){
      var items=d.items||[];
      if(!items.length){list.appendChild(mk("div","info","아직 비어 있어요. 리플레이 화면에서 보관함에 저장해 보세요."));return;}
      items.forEach(function(it){
        var row=mk("div","libitem","");
        row.setAttribute("role","link");row.tabIndex=0;
        var go=function(){location.href="/replay/"+it.lang+"/"+it.id;};
        row.onclick=go;
        row.onkeydown=function(e){if(e.key==="Enter"&&e.target===row)go();};
        var tx=mk("div","libtxt","");
        tx.appendChild(mk("span","libtitle",it.title||(it.lang+" · "+it.id.slice(0,8)+"…")));
        var parts=[];
        if(it.nickname)parts.push((it.pick?it.pick+"픽 ":"")+it.nickname);
        if(it.added)parts.push("불러온 일시 : "+fmtTime(it.added));
        if(parts.length)tx.appendChild(mk("div","libsub",parts.join(" · ")));
        row.appendChild(tx);
        var ob=mk("a","linkbtn","원본");
        ob.href="https://mafia42.com/history/"+it.lang+"/"+it.id;
        ob.target="_blank";ob.rel="noopener noreferrer";
        ob.onclick=function(e){e.stopPropagation();};
        row.appendChild(ob);
        var x=mk("button","del","삭제");
        x.onclick=function(e){
          e.stopPropagation();
          askYesNo("정말 삭제하시겠습니까?",function(){
            fetch("/api/library/"+it.lang+"/"+it.id,{method:"DELETE"}).then(function(r){if(r.ok)row.remove();});
          });
        };
        row.appendChild(x);
        list.appendChild(row);
      });
    });
  }).catch(function(){box.style.display="none";});
}
acct();
document.getElementById("go").onclick=go;
document.getElementById("q").addEventListener("keydown",function(e){if(e.key==="Enter")go();});
</script></body></html>`;
