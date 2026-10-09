import * as cheerio from "cheerio";

const API_URLS = {
  kr: (id) =>
    `https://o2zj8uijbj.execute-api.ap-northeast-2.amazonaws.com/GetMafiaChat?id=${id}&lang=kr`,
  en: (id) =>
    `https://lwlexm3imq2lvqcst4kjr6322u0acknn.lambda-url.us-east-1.on.aws/?id=${id}&lang=en`,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS,
      ...extra,
    },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ---------- 파서 (이전에 Termux에서 검증한 로직 + 유언 감지) ----------

function normalizeText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

// 유언은 아직 실제 리플레이로 구조를 확인하지 못해서,
// 클래스 이름(will / testament)이나 본문의 "[유언]" 표시로 추정합니다.
function detectChatChannel(className, text, containerClass) {
  const classes = String(className ?? "").split(/\s+/).filter(Boolean);
  const megaphone = classes.find((t) => t.toUpperCase().includes("MEGAPHONE"));
  if (megaphone) return "MEGAPHONE";

  const allClasses = classes.concat(String(containerClass ?? "").split(/\s+/).filter(Boolean));
  const willClass = allClasses.find((t) => /(^|[-_])(will|testament)([-_]|$)/i.test(t));
  if (willClass || /^\s*\[유언\]/.test(String(text ?? ""))) return "WILL";

  const channel = classes.find(
    (t) => t.toUpperCase().endsWith("CHAT") && t.toLowerCase() !== "chat-bubble"
  );
  return channel ? channel.toUpperCase() : "CHAT";
}

function extractJobFromIconSrc(iconSrc) {
  const m = String(iconSrc ?? "").match(
    /jobthumb_([^./?]+)\.(?:png|jpg|jpeg|webp|gif|svg)/i
  );
  return m ? m[1].toLowerCase() : null;
}

function extractUsers($) {
  const users = [];
  $("#user-table-container #user-table .item").each((i, el) => {
    const $item = $(el);
    users.push({
      number: i + 1,
      nickname: normalizeText($item.find(".nick-name").first().text()) || null,
      job: extractJobFromIconSrc($item.find("img.job-icon-img").first().attr("src")),
    });
  });
  return users;
}

function extractWinningTeam($) {
  const t = normalizeText(
    $(".team-container.display-flex.center.game-end-type").first().text()
  );
  return t || null;
}

function parseReplayHtml(htmlText) {
  const $ = cheerio.load(htmlText);
  const users = extractUsers($);
  const winningTeam = extractWinningTeam($);
  const logs = [];

  $("section.table")
    .first()
    .children(".system, .chat-data-container")
    .each((_, el) => {
      const $item = $(el);

      if ($item.hasClass("system")) {
        const message = normalizeText($item.find("b").first().text() || $item.text());
        if (message) logs.push({ type: "system", message });
        return;
      }

      const nickname = normalizeText($item.find(".nick-name").first().text()) || null;
      $item.find(".chat-bubble").each((__, b) => {
        const $b = $(b);
        const message = normalizeText($b.text());
        if (!message) return;
        logs.push({
          type: "chat",
          channel: detectChatChannel($b.attr("class"), message, $item.attr("class")),
          nickname,
          message,
        });
      });
    });

  return { users, winningTeam, logs };
}

// 구조 확인용: 이 리플레이에서 쓰인 클래스 이름과 "유언"이 들어간 부분의 원본 HTML
function buildDebug(htmlText) {
  const $ = cheerio.load(htmlText);

  const bubbleClasses = new Set();
  $(".chat-bubble").each((_, b) => bubbleClasses.add(($(b).attr("class") || "").trim()));

  const tableChildClasses = new Set();
  $("section.table")
    .first()
    .children()
    .each((_, c) => tableChildClasses.add(($(c).attr("class") || "").trim()));

  const willClassSamples = [];
  $("[class]").each((_, el) => {
    if (willClassSamples.length >= 5) return false;
    if (/will|testament/i.test($(el).attr("class") || "")) {
      willClassSamples.push($.html(el).replace(/\s+/g, " ").slice(0, 500));
    }
  });

  const seen = new Set();
  const willTextSamples = [];
  $("*").each((_, el) => {
    if (willTextSamples.length >= 8) return false;
    if (/^(script|style|title)$/i.test(el.name)) return;
    const $el = $(el);
    if ($el.children().length) return;
    if (!/유언/.test($el.text())) return;
    const sig = ($el.attr("class") || "") + "|" + ($el.parent().attr("class") || "");
    if (seen.has(sig)) return;
    seen.add(sig);
    willTextSamples.push($.html($el.parent()).replace(/\s+/g, " ").slice(0, 600));
  });

  return {
    bubbleClasses: [...bubbleClasses],
    tableChildClasses: [...tableChildClasses],
    willClassSamples,
    willTextSamples,
  };
}

// ---------- 화면 (HTML) ----------

const STYLE = `
:root{--bg:#2b2b2b;--fg:#ececec;--muted:#a8a8a8;--card:#363636;--line:#4d4d4d;--accent:#4a7de8}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Noto Sans KR",sans-serif}
a{color:#8fb0ff}
.wrap{max-width:720px;margin:0 auto;padding:20px 16px 48px}
h1{font-size:22px;margin:0 0 4px}
.sub{color:var(--muted);margin:0 0 20px;font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px}
input[type=text]{width:100%;padding:12px;font-size:16px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)}
button{width:100%;padding:11px;font-size:15px;border:0;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer}
button.sec{background:#4d4d4d}
.card button{margin-top:10px}
.err{color:#ff7b6b;font-size:14px;margin-top:8px;min-height:1em}

.layout{display:grid;grid-template-columns:190px minmax(0,1fr) 230px;gap:16px;max-width:1120px;margin:0 auto;padding:16px}
.wing{align-self:start;position:sticky;top:16px;max-height:calc(100vh - 32px);overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
.wing h2{font-size:13px;margin:0 0 10px;color:var(--muted);font-weight:600}
.wing h2.mt{margin-top:16px}
.back{display:block;font-size:14px;margin-bottom:14px}
.tools-out{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.tools-out .info{font-size:12px;color:var(--muted)}

.opt{display:flex;align-items:center;gap:8px;font-size:14px;margin-bottom:10px}
.opt input[type=checkbox]{width:18px;height:18px;margin:0}
.opt.col{flex-direction:column;align-items:stretch;gap:4px}
select{width:100%;padding:7px;font-size:14px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}
.hint{font-size:12px;color:var(--muted);line-height:1.4;margin:4px 0 0}

.player{display:flex;align-items:center;gap:12px;padding:7px 0}
.jobbox{position:relative;width:44px;height:44px;flex:none;background:#222;border-radius:8px;display:flex;align-items:center;justify-content:center}
.jobbox img{width:100%;height:100%;object-fit:contain;border-radius:inherit}
.qmark{font-weight:800;font-size:22px;color:#ddd;line-height:1}
.jobfb{font-size:10px;color:var(--muted);text-align:center;word-break:break-all;padding:2px;line-height:1.2}
.badge{position:absolute;top:-6px;left:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#000;border:1px solid #777;color:#fff;font-size:11px;line-height:16px;text-align:center;font-weight:700}
.pname{min-width:0;word-break:break-all;font-size:14px}
.win{margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}

.center{min-width:0}
.log{display:flex;flex-direction:column;gap:8px}
.item.cont{margin-top:-5px}
.sys{background:#1e1e1e;color:#ff5a5a;border-radius:10px;padding:8px 14px;text-align:center;font-size:13px;margin:4px 0;cursor:pointer}
.row{display:flex;gap:10px;align-items:flex-start}
.row.me{justify-content:flex-end}
.col{min-width:0;max-width:78%;display:flex;flex-direction:column;align-items:flex-start}
.jobbox.chat-av,.av-spacer{width:40px;height:40px;flex:none}
.jobbox.chat-av{border-radius:12px}
.jobbox.chat-av .qmark{font-size:20px}
.name{font-size:12px;color:var(--muted);margin:0 0 3px 2px}
.bubble{padding:8px 12px;border-radius:14px;word-break:break-word;border:1px solid transparent;max-width:100%;cursor:pointer}
.bubble.first{border-top-left-radius:4px}
.row.me .bubble{max-width:78%}
.row.me .bubble.first{border-top-left-radius:14px;border-top-right-radius:4px}
.ch-CHAT{background:#fff;color:#000}
.ch-MAFIACHAT{background:#000;color:#ff3030;border-color:#ff3030}
.ch-MEGAPHONE{background:rgba(0,0,0,.55);color:#fff;border-color:#fff}
.ch-GHOSTCHAT{background:#7a7a7a;color:#fff;border-color:#9a9a9a}
.ch-other{background:#3d3d3d;color:#eee;border-color:#666}
.tag{display:inline-block;font-size:11px;border:1px solid #888;border-radius:4px;padding:0 5px;margin-right:6px}

.ann{margin:4px 0 0 50px;max-width:78%}
.ann.me{margin:4px 0 0 auto}
.ann.center{margin:4px auto 0}
.note{background:#4a4326;border:1px solid #8a7a2f;color:#f3e9b5;border-radius:8px;padding:6px 10px;font-size:13px;white-space:pre-wrap;word-break:break-word;cursor:pointer}
.note::before{content:"📝 "}
.ann textarea{width:100%;padding:8px;font-size:14px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--fg);resize:vertical;font-family:inherit}
.annbar{display:flex;gap:6px;margin-top:6px;align-items:center;flex-wrap:wrap}
.annbar button{width:auto;padding:6px 14px;font-size:13px}
.annbar .info{font-size:12px;color:var(--muted)}

@media (max-width:860px){
  .layout{grid-template-columns:1fr}
  .wing{position:static;max-height:none}
  .wing.right{order:1}
  .wing.left{order:2}
  .center{order:3}
  .ann,.ann.me{max-width:90%}
}
`;

const HEAD = (title) =>
  `<!doctype html><html lang="ko"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<title>${title}</title><style>${STYLE}</style></head>`;

const HOME_PAGE =
  HEAD("마피아42 리플레이 스터디") +
  `<body><div class="wrap">
<h1>마피아42 리플레이 스터디</h1>
<p class="sub">리플레이 링크나 방 코드를 넣고 열기를 누르세요.</p>
<div class="card">
<input id="q" type="text" placeholder="https://mafia42.com/history/kr/... 또는 방 코드" autocomplete="off">
<button id="go">열기</button>
<div class="err" id="err"></div>
</div></div>
<script>
function go(){
  var v=document.getElementById("q").value.trim();
  var m=v.match(/[0-9a-f]{32}/i);
  if(!m){document.getElementById("err").textContent="방 코드(32자)를 찾지 못했어요. 링크 전체나 방 코드를 넣어 주세요.";return;}
  var l=v.match(/\\/history\\/(kr|en)\\//i);
  var lang=l?l[1].toLowerCase():"kr";
  location.href="/replay/"+lang+"/"+m[0].toLowerCase();
}
document.getElementById("go").onclick=go;
document.getElementById("q").addEventListener("keydown",function(e){if(e.key==="Enter")go();});
</script></body></html>`;

function replayPage(lang, id) {
  return (
    HEAD("리플레이 · 마피아42 스터디") +
    `<body><div class="layout">
<aside class="wing left">
  <a class="back" href="/">← 처음으로</a>
  <h2>도구</h2>
  <button id="extract" disabled>JSON 추출하기</button>
  <div id="toolsOut"></div>
</aside>
<main class="center"><div class="log" id="log"><div class="sys">불러오는 중...</div></div></main>
<aside class="wing right">
  <h2>보기 설정</h2>
  <label class="opt"><input type="checkbox" id="hide" checked> 직업 숨기기</label>
  <label class="opt"><input type="checkbox" id="night"> 밤챗 보기</label>
  <label class="opt"><input type="checkbox" id="ghost"> 유령챗 보기</label>
  <label class="opt col">시점 빙의
    <select id="view"><option value="0">없음</option></select>
  </label>
  <div class="hint">말풍선을 누르면 주석을 달 수 있어요. 주석은 이 브라우저에만 저장돼요.</div>
  <h2 class="mt">참가자</h2>
  <div id="users"></div>
  <div class="win" id="win" hidden></div>
</aside>
</div>
<script>
var LANG=${JSON.stringify(lang)},ID=${JSON.stringify(id)};
var DATA=null,USERS=[],NICK2USER=Object.create(null);
var HIDE=true,VIEW=0,SHOW_NIGHT=false,SHOW_GHOST=false;
var ANN={},OPEN=null;
var KNOWN={CHAT:1,MAFIACHAT:1,MEGAPHONE:1,GHOSTCHAT:1,WILL:1};
// 추리중 아이콘 (숨김 상태이거나 직업을 모를 때 표시)
var UNKNOWN_ICON="https://raw.githubusercontent.com/LiQuiDsKR/Mafia42ImageResource/refs/heads/main/images/StrategyThumbnail/08%20%EC%B6%94%EB%A6%AC%20%EC%A4%91.webp";

function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}

// ---- 주석 저장 (이 브라우저의 localStorage) ----
function annKey(){return "m42ann:"+LANG+":"+ID;}
function loadAnn(){
  try{var s=localStorage.getItem(annKey());var o=s?JSON.parse(s):{};ANN=(o&&typeof o==="object")?o:{};}
  catch(e){ANN={};}
}
function saveAnn(){
  try{localStorage.setItem(annKey(),JSON.stringify(ANN));return true;}
  catch(e){return false;}
}

// ---- 직업 아이콘 (숨김 상태이거나 직업을 모르면 추리중 이미지) ----
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
  }
  return box;
}

function renderUsers(){
  var box=document.getElementById("users");box.textContent="";
  USERS.forEach(function(u){
    var row=el("div","player");
    var icon=makeAvatar(u,"");
    icon.appendChild(el("span","badge",String(u.number)));
    row.appendChild(icon);
    row.appendChild(el("div","pname",u.nickname||"?"));
    box.appendChild(row);
  });
}

// ---- 주석 보기/편집 ----
function renderAnn(slot,idx,editing,mode){
  slot.textContent="";
  if(editing){
    var box=el("div","ann "+mode);
    var ta=document.createElement("textarea");
    ta.rows=3;ta.value=ANN[idx]||"";ta.placeholder="이 줄에 대한 주석";
    var bar=el("div","annbar");
    var st=el("span","info","");
    var ok=el("button",null,"저장");
    var del=el("button","sec","삭제");
    var no=el("button","sec","취소");
    ok.onclick=function(){
      var v=ta.value.trim();
      if(v){ANN[idx]=v;}else{delete ANN[idx];}
      var saved=saveAnn();
      OPEN=null;renderAnn(slot,idx,false,mode);
      if(!saved)slot.appendChild(el("div","annbar")).appendChild(el("span","info","이 브라우저에는 저장하지 못했어요 (비공개 모드 등)."));
    };
    del.onclick=function(){delete ANN[idx];saveAnn();OPEN=null;renderAnn(slot,idx,false,mode);};
    no.onclick=function(){OPEN=null;renderAnn(slot,idx,false,mode);};
    bar.appendChild(ok);bar.appendChild(del);bar.appendChild(no);bar.appendChild(st);
    box.appendChild(ta);box.appendChild(bar);
    slot.appendChild(box);
    ta.focus();
  }else if(ANN[idx]){
    var n=el("div","ann "+mode);
    var note=el("div","note",ANN[idx]);
    note.onclick=function(){openEditor(slot,idx,mode);};
    n.appendChild(note);
    slot.appendChild(n);
  }
}
function openEditor(slot,idx,mode){
  if(OPEN&&OPEN.slot===slot)return;
  if(OPEN)renderAnn(OPEN.slot,OPEN.idx,false,OPEN.mode);
  OPEN={slot:slot,idx:idx,mode:mode};
  renderAnn(slot,idx,true,mode);
}

// ---- 채팅 보여주기 ----
function chOf(l){return String(l.channel||"CHAT").replace(/[^A-Z0-9_]/g,"")||"CHAT";}
function isNight(ch){return ch!=="CHAT"&&ch!=="MEGAPHONE"&&ch!=="GHOSTCHAT"&&ch!=="WILL";}
function isVisible(l){
  if(l.type==="system")return true;
  var ch=chOf(l);
  if(ch==="GHOSTCHAT")return SHOW_GHOST;
  if(isNight(ch))return SHOW_NIGHT;
  return true;
}

function renderLogs(){
  var log=document.getElementById("log");log.textContent="";
  OPEN=null;
  var prevKey=null;
  var me=VIEW&&USERS[VIEW-1]?USERS[VIEW-1].nickname:null;
  DATA.logs.forEach(function(l,i){
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
      if(first)col.appendChild(el("div","name",l.nickname||"?"));
      col.appendChild(bubble);
      row.appendChild(col);
    }
    item.className="item"+(first?"":" cont");
    item.appendChild(row);
    item.appendChild(slot);
    renderAnn(slot,i,false,mode);
    log.appendChild(item);
  });
}

function copyText(t){
  if(navigator.clipboard&&navigator.clipboard.writeText){return navigator.clipboard.writeText(t);}
  return new Promise(function(res,rej){
    var ta=document.createElement("textarea");
    ta.value=t;ta.style.position="fixed";ta.style.opacity="0";
    document.body.appendChild(ta);ta.select();
    var ok=false;try{ok=document.execCommand("copy");}catch(e){}
    document.body.removeChild(ta);
    ok?res():rej();
  });
}

function buildJsonTools(){
  var notes=Object.keys(ANN).map(Number).sort(function(a,b){return a-b;}).map(function(i){
    var l=DATA.logs[i]||{};
    return {index:i,nickname:l.nickname||null,message:l.message||null,note:ANN[i]};
  });
  var text=JSON.stringify(Object.assign({},DATA,{annotations:notes}),null,2);
  var out=document.getElementById("toolsOut");
  out.textContent="";
  var wrap=el("div","tools-out");
  wrap.appendChild(el("div","info","JSON 준비됨 ("+Math.max(1,Math.round(text.length/1024))+" KB, 주석 "+notes.length+"개 포함)"));
  var dl=el("button",null,"다운로드");
  dl.onclick=function(){
    var blob=new Blob([text],{type:"application/json"});
    var a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="mafia42_"+ID+".json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
  };
  var cp=el("button","sec","복사");
  var st=el("div","info","");
  cp.onclick=function(){
    copyText(text).then(function(){st.textContent="복사했어요.";},function(){st.textContent="복사하지 못했어요. 다운로드를 이용해 주세요.";});
  };
  wrap.appendChild(dl);wrap.appendChild(cp);wrap.appendChild(st);
  out.appendChild(wrap);
}

fetch("/api/replay?id="+ID+"&lang="+LANG).then(function(r){return r.json();}).then(function(d){
  var log=document.getElementById("log");log.textContent="";
  if(d.error){log.appendChild(el("div","sys",d.error));return;}
  DATA=d;USERS=d.users||[];
  USERS.forEach(function(u){if(u.nickname&&!NICK2USER[u.nickname])NICK2USER[u.nickname]=u;});
  loadAnn();

  var hide=document.getElementById("hide");
  hide.checked=true;HIDE=true;
  hide.onchange=function(){HIDE=hide.checked;renderUsers();renderLogs();};

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
</script></body></html>`
  );
}

// ---------- API ----------

async function handleApi(url) {
  const params = url.searchParams;
  let lang = params.get("lang") || "kr";
  let id = params.get("id");

  const link = params.get("url");
  if (link) {
    try {
      const parts = new URL(link).pathname.split("/").filter(Boolean);
      lang = parts[1];
      id = parts[2];
    } catch {
      return json({ error: "잘못된 링크입니다." }, 400);
    }
  }

  if (!API_URLS[lang]) return json({ error: "지원하지 않는 언어입니다." }, 400);
  if (!id || !/^[0-9a-f]{32}$/i.test(id)) {
    return json({ error: "방 코드 형식이 올바르지 않습니다." }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(API_URLS[lang](id), {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
  } catch (e) {
    return json({ error: "마피아42 서버에 연결하지 못했습니다." }, 502);
  }

  if (!upstream.ok) {
    return json(
      { error: "리플레이를 가져오지 못했습니다.", upstreamStatus: upstream.status },
      502
    );
  }

  const htmlText = await upstream.text();

  if (params.get("debug") === "1") {
    return json(buildDebug(htmlText), 200, { "Cache-Control": "no-store" });
  }

  const parsed = parseReplayHtml(htmlText);
  if (parsed.logs.length === 0 && parsed.users.length === 0) {
    return json(
      { error: "리플레이 내용을 찾지 못했습니다. (만료되었거나 형식이 다릅니다)" },
      404
    );
  }

  return json({ roomId: id, lang, ...parsed }, 200, {
    "Cache-Control": "public, max-age=3600",
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/replay") return handleApi(url);

    const m = url.pathname.match(/^\/replay\/(kr|en)\/([0-9a-fA-F]{32})\/?$/);
    if (m) return html(replayPage(m[1], m[2].toLowerCase()));

    if (url.pathname === "/") return html(HOME_PAGE);

    return html(
      HEAD("없는 페이지") +
        `<body><div class="wrap"><p>없는 페이지예요. <a href="/">처음으로</a></p></div></body></html>`,
      404
    );
  },
};
