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

// ---------- 파서 (이전에 Termux에서 검증한 로직 그대로) ----------

function normalizeText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function detectChatChannel(className) {
  const classes = String(className ?? "").split(/\s+/).filter(Boolean);
  const megaphone = classes.find((t) => t.toUpperCase().includes("MEGAPHONE"));
  if (megaphone) return "MEGAPHONE";
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
          channel: detectChatChannel($b.attr("class")),
          nickname,
          message,
        });
      });
    });

  return { users, winningTeam, logs };
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
.back{display:block;font-size:14px;margin-bottom:14px}
.tools-out{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.tools-out .info{font-size:12px;color:var(--muted)}
.player{display:flex;align-items:center;gap:12px;padding:7px 0}
.jobbox{position:relative;width:44px;height:44px;flex:none;background:#222;border-radius:8px;display:flex;align-items:center;justify-content:center}
.jobbox img{width:100%;height:100%;object-fit:contain;border-radius:8px}
.jobfb{font-size:10px;color:var(--muted);text-align:center;word-break:break-all;padding:2px;line-height:1.2}
.badge{position:absolute;top:-6px;left:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#000;border:1px solid #777;color:#fff;font-size:11px;line-height:16px;text-align:center;font-weight:700}
.pname{min-width:0;word-break:break-all;font-size:14px}
.win{margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}

.center{min-width:0}
.log{display:flex;flex-direction:column;gap:6px}
.sys{text-align:center;color:var(--muted);font-size:13px;padding:4px 0}
.msg{padding:7px 11px;border-radius:8px;word-break:break-word;border:1px solid transparent}
.msg .nick{font-weight:700;margin-right:6px}
.ch-CHAT{background:#fff;color:#000}
.ch-MAFIACHAT{background:#000;color:#ff3030;border-color:#ff3030}
.ch-MEGAPHONE{background:rgba(0,0,0,.55);color:#fff;border-color:#fff}
.ch-GHOSTCHAT{background:#7a7a7a;color:#fff;border-color:#9a9a9a}
.ch-other{background:#3d3d3d;color:#eee;border-color:#666}
.tag{display:inline-block;font-size:11px;border:1px solid #888;border-radius:4px;padding:0 5px;margin-right:6px}

@media (max-width:860px){
  .layout{grid-template-columns:1fr}
  .wing{position:static;max-height:none}
  .wing.right{order:1}
  .wing.left{order:2}
  .center{order:3}
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
  <h2>참가자</h2>
  <div id="users"></div>
  <div class="win" id="win" hidden></div>
</aside>
</div>
<script>
var LANG=${JSON.stringify(lang)},ID=${JSON.stringify(id)};
var DATA=null;
var KNOWN={CHAT:1,MAFIACHAT:1,MEGAPHONE:1,GHOSTCHAT:1};

function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}

function renderUsers(users){
  var box=document.getElementById("users");
  users.forEach(function(u){
    var row=el("div","player");
    var icon=el("div","jobbox");
    if(u.job&&/^[a-z0-9_]+$/.test(u.job)){
      var img=document.createElement("img");
      img.alt=u.job;
      img.src="https://mafia42.com/chat/jobs/jobthumb_"+u.job+".png";
      img.onerror=function(){img.remove();icon.appendChild(el("span","jobfb",u.job));};
      icon.appendChild(img);
    }else{
      icon.appendChild(el("span","jobfb","?"));
    }
    icon.appendChild(el("span","badge",String(u.number)));
    row.appendChild(icon);
    row.appendChild(el("div","pname",u.nickname||"?"));
    box.appendChild(row);
  });
}

function renderLogs(logs){
  var log=document.getElementById("log");
  logs.forEach(function(l){
    if(l.type==="system"){log.appendChild(el("div","sys",l.message));return;}
    var ch=String(l.channel||"CHAT").replace(/[^A-Z0-9_]/g,"");
    var known=!!KNOWN[ch];
    var m=el("div","msg "+(known?"ch-"+ch:"ch-other"));
    if(!known)m.appendChild(el("span","tag",ch||"?"));
    m.appendChild(el("span","nick",l.nickname||"?"));
    m.appendChild(document.createTextNode(l.message));
    log.appendChild(m);
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
  var text=JSON.stringify(DATA,null,2);
  var out=document.getElementById("toolsOut");
  out.textContent="";
  var wrap=el("div","tools-out");
  wrap.appendChild(el("div","info","JSON 준비됨 ("+Math.max(1,Math.round(text.length/1024))+" KB)"));
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
  DATA=d;
  renderUsers(d.users);
  if(d.winningTeam){var w=document.getElementById("win");w.hidden=false;w.textContent="결과: "+d.winningTeam;}
  renderLogs(d.logs);
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

  const parsed = parseReplayHtml(await upstream.text());
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
