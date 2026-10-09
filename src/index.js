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

  // 밀서: To.받는사람 / from.보낸사람 / 본문
  const pushLetter = ($l) => {
    const strip = (t) => normalizeText(t).replace(/^(to|from)\s*\.\s*/i, "");
    const to = strip($l.find(".secret-letter .to").first().text()) || null;
    const from = strip($l.find(".secret-letter .from").first().text()) || null;
    const message = normalizeText($l.find(".secret-letter .message").first().text());
    if (!message && !to && !from) return;
    logs.push({ type: "letter", from, to, nickname: from, message });
  };

  const ITEM_SEL = ".system, .chat-data-container, .secret-letter-container";
  const $root = $("section.table").length ? $("section.table").first() : $.root();
  $root
    .find(ITEM_SEL)
    .each((_, el) => {
      const $item = $(el);
      // 이미 처리되는 묶음 안에 들어 있는 것은 바깥 묶음에서 처리
      if ($item.parents(ITEM_SEL).length) return;

      if ($item.hasClass("secret-letter-container")) {
        pushLetter($item);
        return;
      }

      if ($item.hasClass("system")) {
        const message = normalizeText($item.find("b").first().text() || $item.text());
        if (message) logs.push({ type: "system", message });
        return;
      }

      const nickname = normalizeText($item.find(".nick-name").first().text()) || null;
      $item.find(".chat-bubble, .secret-letter-container").each((__, b) => {
        const $b = $(b);
        if ($b.hasClass("secret-letter-container")) {
          pushLetter($b);
          return;
        }
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

  const otherChildSamples = [];
  $("section.table")
    .first()
    .children()
    .each((_, c) => {
      if (otherChildSamples.length >= 6) return false;
      const $c = $(c);
      if ($c.hasClass("system") || $c.hasClass("chat-data-container")) return;
      otherChildSamples.push($.html(c).replace(/\s+/g, " ").slice(0, 700));
    });

  const letterSamples = [];
  const letterSeen = new Set();
  $("*").each((_, el) => {
    if (letterSamples.length >= 8) return false;
    if (/^(script|style|title)$/i.test(el.name)) return;
    const $el = $(el);
    if ($el.children().length) return;
    if (!/밀서/.test($el.text())) return;
    const sig = ($el.attr("class") || "") + "|" + ($el.parent().attr("class") || "") + "|" + ($el.parent().parent().attr("class") || "");
    if (letterSeen.has(sig)) return;
    letterSeen.add(sig);
    letterSamples.push($.html($el.parent().parent()).replace(/\s+/g, " ").slice(0, 900));
  });

  return {
    otherChildSamples,
    letterSamples,
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
.letter{background:#f3e9c9;color:#2b2416;border:1px solid #b9a56a;border-radius:10px;padding:8px 14px 12px;margin:4px 0;cursor:pointer}
.lhead{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;font-size:12px;color:#5c4d2a;font-weight:600}
.lhead .lfrom{flex:1;text-align:left;word-break:break-all}
.lhead .lto{flex:1;text-align:right;word-break:break-all}
.lhead .ltitle{flex:none;font-weight:800;color:#7a5c14}
.lmsg{text-align:center;margin-top:6px;word-break:break-word;font-size:15px}
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

.tally{background:#1e1e1e;border-radius:10px;padding:10px 14px;margin:4px auto;max-width:420px;cursor:pointer}
.tally .thead{font-size:12px;color:var(--muted);margin-bottom:6px}
.trow{display:flex;align-items:center;gap:10px;padding:4px 0}
.jobbox.tally-av{width:34px;height:34px;border-radius:10px}
.jobbox.tally-av .qmark{font-size:18px}
.tname{flex:1;min-width:0;text-align:left;word-break:break-all;font-size:14px}
.tcnt{font-weight:700;color:#ff5a5a;white-space:nowrap}

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
</div>
<div class="card" id="acct"><div class="info">확인 중...</div></div>
</div>
<script>
function go(){
  var v=document.getElementById("q").value.trim();
  var m=v.match(/[0-9a-f]{32}/i);
  if(!m){document.getElementById("err").textContent="방 코드(32자)를 찾지 못했어요. 링크 전체나 방 코드를 넣어 주세요.";return;}
  var l=v.match(/\\/history\\/(kr|en)\\//i);
  var lang=l?l[1].toLowerCase():"kr";
  location.href="/replay/"+lang+"/"+m[0].toLowerCase();
}
function esc(t){return String(t);}
function mk(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function acct(){
  var box=document.getElementById("acct");
  fetch("/api/me").then(function(r){return r.json();}).then(function(me){
    box.textContent="";
    if(!me.configured){box.style.display="none";return;}
    if(!me.loggedIn){
      var a=mk("a","back","구글로 로그인하면 보관함과 주석을 계정에 저장할 수 있어요");
      a.href="/auth/login?next=/";box.appendChild(a);return;
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
        var row=mk("div","player","");
        var a=mk("a","pname",it.lang+" · "+it.id.slice(0,8)+"…");
        a.href="/replay/"+it.lang+"/"+it.id;
        var x=mk("button","sec","빼기");
        x.onclick=function(){fetch("/api/library/"+it.lang+"/"+it.id,{method:"DELETE"}).then(function(r){if(r.ok)row.remove();});};
        row.appendChild(a);row.appendChild(x);list.appendChild(row);
      });
    });
  }).catch(function(){box.style.display="none";});
}
acct();
document.getElementById("go").onclick=go;
document.getElementById("q").addEventListener("keydown",function(e){if(e.key==="Enter")go();});
</script></body></html>`;

function replayPage(lang, id) {
  return (
    HEAD("리플레이 · 마피아42 스터디") +
    `<body><div class="layout">
<aside class="wing left">
  <a class="back" href="/">← 처음으로</a>
  <h2>계정</h2>
  <div id="auth" class="info">확인 중...</div>
  <button id="libbtn" class="sec" hidden>보관함에 저장</button>
  <button id="import" class="sec" hidden>이 브라우저 주석 가져오기</button>
  <h2 class="mt">도구</h2>
  <button id="extract" disabled>JSON 추출하기</button>
  <div id="toolsOut"></div>
</aside>
<main class="center"><div class="log" id="log"><div class="sys">불러오는 중...</div></div></main>
<aside class="wing right">
  <h2>보기 설정</h2>
  <label class="opt"><input type="checkbox" id="hide" checked> 직업 숨기기</label>
  <label class="opt"><input type="checkbox" id="anon" checked> 투표 익명</label>
  <label class="opt"><input type="checkbox" id="night"> 밤챗 보기</label>
  <label class="opt"><input type="checkbox" id="ghost"> 유령챗 보기</label>
  <label class="opt col">시점 빙의
    <select id="view"><option value="0">없음</option></select>
  </label>
  <div class="hint" id="hint">말풍선을 누르면 주석을 달 수 있어요. 주석은 이 브라우저에만 저장돼요.</div>
  <h2 class="mt">참가자</h2>
  <div id="users"></div>
  <div class="win" id="win" hidden></div>
</aside>
</div>
<script>
var LANG=${JSON.stringify(lang)},ID=${JSON.stringify(id)};
var DATA=null,USERS=[],NICK2USER=Object.create(null);
var HIDE=true,ANON=true,VIEW=0,SHOW_NIGHT=false,SHOW_GHOST=false;
// 누가 누구에게 투표했는지 / 찬성·반대했는지 알려 주는 시스템 메시지
var VOTE_RE=/(\\d+\\s*님이\\s*\\d+\\s*님에게\\s*투표)|((찬성|반대)하였)/;
var VOTE_LINE=/^\\s*(\\d+)\\s*님이\\s*(\\d+)\\s*님에게\\s*투표하였습니다/;
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
function saveLocal(){
  try{localStorage.setItem(annKey(),JSON.stringify(ANN));return true;}
  catch(e){return false;}
}
// 로그인했으면 서버(계정)에, 아니면 이 브라우저에 저장. 항상 Promise<boolean>
var ME={configured:false,loggedIn:false,name:null};
function persistAnn(key){
  if(!ME.loggedIn)return Promise.resolve(saveLocal());
  return fetch("/api/annotations/"+LANG+"/"+ID,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:String(key),note:ANN[key]||""})})
    .then(function(r){return r.ok;},function(){return false;});
}
function loadAnnServer(){
  return fetch("/api/annotations/"+LANG+"/"+ID).then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(d&&d.notes){ANN=d.notes;return true;}return false;
  },function(){return false;});
}
function localNotes(){
  try{var s=localStorage.getItem(annKey());var o=s?JSON.parse(s):{};return(o&&typeof o==="object")?o:{};}catch(e){return {};}
}
function setupAuth(){
  var box=document.getElementById("auth");box.textContent="";
  var lb=document.getElementById("libbtn"),im=document.getElementById("import"),hint=document.getElementById("hint");
  lb.hidden=true;im.hidden=true;
  if(!ME.configured){box.textContent="로그인은 아직 설정되지 않았어요.";return;}
  if(!ME.loggedIn){
    var a=el("a","back","구글로 로그인");
    a.href="/auth/login?next="+encodeURIComponent(location.pathname);
    box.appendChild(a);
    return;
  }
  hint.textContent="말풍선을 누르면 주석을 달 수 있어요. 주석은 내 계정에 저장돼요.";
  box.appendChild(el("div","pname",ME.name+" 님"));
  var lo=el("button","sec","로그아웃");
  lo.onclick=function(){fetch("/auth/logout",{method:"POST"}).then(function(){location.reload();});};
  box.appendChild(lo);
  lb.hidden=false;
  var inLib=false;
  function paint(){lb.textContent=inLib?"보관함에서 빼기":"보관함에 저장";}
  fetch("/api/library").then(function(r){return r.json();}).then(function(d){
    (d.items||[]).forEach(function(it){if(it.lang===LANG&&it.id===ID)inLib=true;});paint();
  },paint);
  lb.onclick=function(){
    lb.disabled=true;
    fetch("/api/library/"+LANG+"/"+ID,{method:inLib?"DELETE":"PUT"}).then(function(r){
      if(r.ok)inLib=!inLib;paint();lb.disabled=false;
    },function(){lb.disabled=false;});
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
      var p=persistAnn(idx);
      OPEN=null;renderAnn(slot,idx,false,mode);
      p.then(function(saved){
        if(!saved)slot.appendChild(el("div","annbar")).appendChild(el("span","info",ME.loggedIn?"서버에 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.":"이 브라우저에는 저장하지 못했어요 (비공개 모드 등)."));
      });
    };
    del.onclick=function(){delete ANN[idx];persistAnn(idx);OPEN=null;renderAnn(slot,idx,false,mode);};
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
  if(l.type==="letter")return true;
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
      hd.appendChild(el("span","lfrom",nameWithPick(l.from)));
      hd.appendChild(el("span","ltitle","밀서"));
      hd.appendChild(el("span","lto",nameWithPick(l.to)));
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
  var notes=Object.keys(ANN).map(function(k){
    var m=/^t(\\d+)$/.exec(k); // 투표 결과 카드에 단 주석
    var i=m?Number(m[1]):Number(k);
    var l=DATA.logs[i]||{};
    return {
      index:i,
      kind:m?"vote_result":"line",
      nickname:m?null:(l.nickname||null),
      message:m?"[투표 결과]":(l.message||null),
      note:ANN[k]
    };
  }).sort(function(a,b){return a.index-b.index;});
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

fetch("/api/me").then(function(r){return r.json();}).catch(function(){return {};}).then(function(me){
  ME={configured:!!me.configured,loggedIn:!!me.loggedIn,name:me.name||null};
  setupAuth();
  return ME.loggedIn?loadAnnServer():false;
}).then(function(fromServer){
  if(!fromServer)loadAnn();
  return fetch("/api/replay?id="+ID+"&lang="+LANG);
}).then(function(r){return r.json();}).then(function(d){
  var log=document.getElementById("log");log.textContent="";
  if(d.error){log.appendChild(el("div","sys",d.error));return;}
  DATA=d;USERS=d.users||[];
  USERS.forEach(function(u){if(u.nickname&&!NICK2USER[u.nickname])NICK2USER[u.nickname]=u;});

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

// ---------- 로그인 / 보관함 / 주석 (구글 로그인 + D1) ----------
// 필요한 설정: D1 바인딩 DB, 시크릿 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / SESSION_SECRET
// 설정이 없으면 로그인만 꺼진 채로 사이트는 그대로 동작합니다.

const SESSION_COOKIE = "m42_session";
const OAUTH_COOKIE = "m42_oauth";
const SESSION_DAYS = 30;
const LIB_MAX = 300;
const ANN_MAX = 1000;
const NOTE_MAX = 2000;
const enc = new TextEncoder();

function authConfigured(env) {
  return !!(
    env &&
    env.DB &&
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.SESSION_SECRET
  );
}

function b64urlEncode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function randomHex(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signToken(secret, payload) {
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return body + "." + b64urlEncode(new Uint8Array(sig));
}

async function verifyToken(secret, token) {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig) return null;
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      b64urlDecode(sig),
      enc.encode(body)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(request) {
  const out = {};
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function setCookie(name, value, { maxAge, path = "/" }) {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function jsonPrivate(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function msgPage(message, status = 400) {
  return new Response(
    HEAD("로그인") +
      `<body><div class="wrap"><div class="card"><p>${escapeHtml(message)}</p><p><a href="/">처음으로</a></p></div></div></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    }
  );
}

function safeNext(next) {
  const n = String(next || "/");
  return n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : "/";
}

// 쿠키를 쓰는 요청은 같은 사이트에서 보낸 것만 허용
function sameOrigin(request, url) {
  const origin = request.headers.get("Origin");
  if (origin) return origin === url.origin;
  return request.headers.get("Sec-Fetch-Site") === "same-origin";
}

let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, created_at INTEGER NOT NULL)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS library (user_id TEXT NOT NULL, lang TEXT NOT NULL, room_id TEXT NOT NULL, added_at INTEGER NOT NULL, PRIMARY KEY (user_id, lang, room_id))"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS annotations (user_id TEXT NOT NULL, lang TEXT NOT NULL, room_id TEXT NOT NULL, line_key TEXT NOT NULL, note TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, lang, room_id, line_key))"
    ),
  ]);
  schemaReady = true;
}

async function getUser(request, env) {
  if (!authConfigured(env)) return null;
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const s = await verifyToken(env.SESSION_SECRET, token);
  if (!s || !s.sub) return null;
  await ensureSchema(env.DB);
  const row = await env.DB.prepare("SELECT id, name FROM users WHERE id = ?")
    .bind(String(s.sub))
    .first();
  return row ? { id: row.id, name: row.name || "사용자" } : null;
}

async function authLogin(url, env) {
  if (!authConfigured(env)) return msgPage("로그인이 아직 설정되지 않았어요.", 503);
  const state = randomHex(16);
  const nonce = randomHex(16);
  const next = safeNext(url.searchParams.get("next"));
  const cookie = await signToken(env.SESSION_SECRET, {
    state,
    nonce,
    next,
    exp: Math.floor(Date.now() / 1000) + 600,
  });
  const q = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: url.origin + "/auth/callback",
    response_type: "code",
    scope: "openid profile",
    state,
    nonce,
    prompt: "select_account",
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: "https://accounts.google.com/o/oauth2/v2/auth?" + q.toString(),
      "Set-Cookie": setCookie(OAUTH_COOKIE, cookie, { maxAge: 600, path: "/auth" }),
      "Cache-Control": "no-store",
    },
  });
}

async function authCallback(request, url, env) {
  if (!authConfigured(env)) return msgPage("로그인이 아직 설정되지 않았어요.", 503);
  if (url.searchParams.get("error")) return msgPage("로그인이 취소되었거나 실패했어요.", 400);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = await verifyToken(env.SESSION_SECRET, parseCookies(request)[OAUTH_COOKIE]);
  if (!code || !state || !saved || saved.state !== state) {
    return msgPage("로그인 정보가 맞지 않아요. 처음부터 다시 시도해 주세요.", 400);
  }

  let tokenRes;
  try {
    tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: url.origin + "/auth/callback",
        grant_type: "authorization_code",
      }),
    });
  } catch {
    return msgPage("구글 서버에 연결하지 못했어요.", 502);
  }
  if (!tokenRes.ok) {
    return msgPage(
      "구글 로그인 확인에 실패했어요. 클라이언트 ID/비밀키와 리디렉션 주소 설정을 확인해 주세요.",
      502
    );
  }

  // 구글 토큰 서버에서 직접 받은 ID 토큰이라 서명 검증 대신 발급처·대상·시간·nonce만 확인
  let claims;
  try {
    const tok = await tokenRes.json();
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(String(tok.id_token).split(".")[1])));
  } catch {
    return msgPage("로그인 정보를 읽지 못했어요.", 502);
  }
  const issOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (
    !issOk ||
    claims.aud !== env.GOOGLE_CLIENT_ID ||
    claims.nonce !== saved.nonce ||
    !claims.sub ||
    (claims.exp && claims.exp < Date.now() / 1000)
  ) {
    return msgPage("로그인 정보를 확인하지 못했어요.", 400);
  }

  await ensureSchema(env.DB);
  const now = Math.floor(Date.now() / 1000);
  const name = String(claims.name || "").slice(0, 80) || "사용자";
  await env.DB.prepare(
    "INSERT INTO users (id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name"
  )
    .bind(String(claims.sub), name, now)
    .run();

  const session = await signToken(env.SESSION_SECRET, {
    sub: String(claims.sub),
    exp: now + SESSION_DAYS * 86400,
  });
  const headers = new Headers({ Location: safeNext(saved.next), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", setCookie(SESSION_COOKIE, session, { maxAge: SESSION_DAYS * 86400 }));
  headers.append("Set-Cookie", setCookie(OAUTH_COOKIE, "", { maxAge: 0, path: "/auth" }));
  return new Response(null, { status: 302, headers });
}

function authLogout(request, url) {
  if (request.method !== "POST") return jsonPrivate({ error: "method not allowed" }, 405);
  if (!sameOrigin(request, url)) return jsonPrivate({ error: "forbidden" }, 403);
  return jsonPrivate({ ok: true }, 200, {
    "Set-Cookie": setCookie(SESSION_COOKIE, "", { maxAge: 0 }),
  });
}

async function apiMe(request, env) {
  const configured = authConfigured(env);
  const user = configured ? await getUser(request, env) : null;
  const missing = ["DB", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET"].filter(
    (k) => !(env && env[k])
  );
  return jsonPrivate({ configured, loggedIn: !!user, name: user ? user.name : null, missing });
}

async function apiLibrary(request, url, env) {
  const user = await getUser(request, env);
  if (!user) return jsonPrivate({ error: "로그인이 필요해요." }, 401);

  const m = url.pathname.match(/^\/api\/library(?:\/(kr|en)\/([0-9a-fA-F]{32}))?$/);
  if (!m) return jsonPrivate({ error: "not found" }, 404);
  const lang = m[1];
  const id = m[2] ? m[2].toLowerCase() : null;

  if (request.method === "GET" && !lang) {
    const { results } = await env.DB.prepare(
      "SELECT lang, room_id, added_at FROM library WHERE user_id = ? ORDER BY added_at DESC LIMIT ?"
    )
      .bind(user.id, LIB_MAX)
      .all();
    return jsonPrivate({
      items: results.map((r) => ({ lang: r.lang, id: r.room_id, added: r.added_at })),
    });
  }

  if (!lang) return jsonPrivate({ error: "method not allowed" }, 405);
  if (!sameOrigin(request, url)) return jsonPrivate({ error: "forbidden" }, 403);

  if (request.method === "PUT") {
    const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM library WHERE user_id = ?")
      .bind(user.id)
      .first();
    if (c && c.n >= LIB_MAX) return jsonPrivate({ error: "보관함이 가득 찼어요." }, 413);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO library (user_id, lang, room_id, added_at) VALUES (?, ?, ?, ?)"
    )
      .bind(user.id, lang, id, Math.floor(Date.now() / 1000))
      .run();
    return jsonPrivate({ ok: true });
  }

  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM library WHERE user_id = ? AND lang = ? AND room_id = ?")
      .bind(user.id, lang, id)
      .run();
    return jsonPrivate({ ok: true });
  }

  return jsonPrivate({ error: "method not allowed" }, 405);
}

async function apiAnnotations(request, url, env) {
  const user = await getUser(request, env);
  if (!user) return jsonPrivate({ error: "로그인이 필요해요." }, 401);

  const m = url.pathname.match(/^\/api\/annotations\/(kr|en)\/([0-9a-fA-F]{32})$/);
  if (!m) return jsonPrivate({ error: "not found" }, 404);
  const lang = m[1];
  const id = m[2].toLowerCase();

  if (request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT line_key, note FROM annotations WHERE user_id = ? AND lang = ? AND room_id = ?"
    )
      .bind(user.id, lang, id)
      .all();
    const notes = {};
    for (const r of results) notes[r.line_key] = r.note;
    return jsonPrivate({ notes });
  }

  if (request.method !== "PUT") return jsonPrivate({ error: "method not allowed" }, 405);
  if (!sameOrigin(request, url)) return jsonPrivate({ error: "forbidden" }, 403);
  if (Number(request.headers.get("Content-Length") || 0) > 300000) {
    return jsonPrivate({ error: "too large" }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonPrivate({ error: "bad request" }, 400);
  }

  let entries = null;
  if (body && body.notes && typeof body.notes === "object") entries = Object.entries(body.notes);
  else if (body && typeof body.key === "string") entries = [[body.key, body.note]];
  if (!entries || entries.length === 0 || entries.length > 500) {
    return jsonPrivate({ error: "bad request" }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const stmts = [];
  let upserts = 0;
  for (const [key, note] of entries) {
    if (!/^t?\d{1,6}$/.test(key)) return jsonPrivate({ error: "bad key" }, 400);
    const text = typeof note === "string" ? note.trim().slice(0, NOTE_MAX) : "";
    if (text) {
      upserts++;
      stmts.push(
        env.DB.prepare(
          "INSERT INTO annotations (user_id, lang, room_id, line_key, note, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, lang, room_id, line_key) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at"
        ).bind(user.id, lang, id, key, text, now)
      );
    } else {
      stmts.push(
        env.DB.prepare(
          "DELETE FROM annotations WHERE user_id = ? AND lang = ? AND room_id = ? AND line_key = ?"
        ).bind(user.id, lang, id, key)
      );
    }
  }

  if (upserts > 0) {
    const c = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM annotations WHERE user_id = ? AND lang = ? AND room_id = ?"
    )
      .bind(user.id, lang, id)
      .first();
    if (c && c.n + upserts > ANN_MAX) return jsonPrivate({ error: "주석이 너무 많아요." }, 413);
  }

  await env.DB.batch(stmts);
  return jsonPrivate({ ok: true });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const p = url.pathname;

    try {
      if (p === "/api/replay") return await handleApi(url);
      if (p === "/auth/login") return await authLogin(url, env);
      if (p === "/auth/callback") return await authCallback(request, url, env);
      if (p === "/auth/logout") return authLogout(request, url);
      if (p === "/api/me") return await apiMe(request, env);
      if (p === "/api/library" || p.startsWith("/api/library/")) {
        return await apiLibrary(request, url, env);
      }
      if (p.startsWith("/api/annotations/")) return await apiAnnotations(request, url, env);
    } catch (e) {
      return p.startsWith("/auth/")
        ? msgPage("서버 오류가 발생했어요. 잠시 뒤에 다시 시도해 주세요.", 500)
        : jsonPrivate({ error: "서버 오류가 발생했어요." }, 500);
    }

    const m = p.match(/^\/replay\/(kr|en)\/([0-9a-fA-F]{32})\/?$/);
    if (m) return html(replayPage(m[1], m[2].toLowerCase()));

    if (p === "/") return html(HOME_PAGE);

    return html(
      HEAD("없는 페이지") +
        `<body><div class="wrap"><p>없는 페이지예요. <a href="/">처음으로</a></p></div></body></html>`,
      404
    );
  },
};
