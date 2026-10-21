// 공통 스타일과 <head>

// 구글 로그인 버튼에 쓰는 G 로고 (공식 4색)
export const GOOGLE_G =
  "<svg viewBox='0 0 48 48' width='20' height='20' aria-hidden='true'>" +
  "<path fill='#EA4335' d='M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z'/>" +
  "<path fill='#4285F4' d='M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z'/>" +
  "<path fill='#FBBC05' d='M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z'/>" +
  "<path fill='#34A853' d='M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z'/>" +
  "</svg>";
export const LOGIN_NOTE = "로그인하면 보관함 저장과 주석 저장을 쓸 수 있어요.";

export const STYLE = `
:root{--bg:#2b2b2b;--fg:#ececec;--muted:#a8a8a8;--card:#363636;--line:#4d4d4d;--accent:#4a7de8}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Noto Sans KR",sans-serif}
a{color:#8fb0ff}
.wrap{max-width:720px;margin:0 auto;padding:20px 16px 48px}
h1{font-size:22px;margin:0 0 4px}
.sub{color:var(--muted);margin:0 0 20px;font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px}
input[type=text]{width:100%;padding:12px;font-size:16px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)}
button{font-family:inherit;width:100%;padding:11px;font-size:15px;border:0;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer}
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
.jobbox{position:relative;width:44px;height:44px;flex:none;background:#222;border-radius:0;display:flex;align-items:center;justify-content:center}
.jobbox img{width:100%;height:100%;object-fit:contain;border-radius:inherit}
.qmark{font-weight:800;font-size:22px;color:#ddd;line-height:1}
.jobfb{font-size:10px;color:var(--muted);text-align:center;word-break:break-all;padding:2px;line-height:1.2}
.badge{position:absolute;top:-6px;left:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#000;border:1px solid #777;color:#fff;font-size:11px;line-height:16px;text-align:center;font-weight:700}
.pname{min-width:0;word-break:break-all;font-size:14px}
.win{margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}

.center{min-width:0}
.log{display:flex;flex-direction:column;gap:8px}
.item.cont{margin-top:-5px}
#auth .pname,#acct .pname{margin-bottom:8px}
.wing button{margin-top:8px}
.ghoulbox{position:absolute;right:0;bottom:0;width:40%;height:40%;background:#111;border:1px solid #ccc;border-radius:0;overflow:hidden;display:flex}
.ghoulbox img{width:100%;height:100%;object-fit:contain;border-radius:0}
.gbtn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:10px 14px;background:#fff;color:#3c4043;border:1px solid #dadce0;border-radius:8px;font-size:15px;font-weight:500;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,.3)}
.gbtn{white-space:nowrap}
#acct .gbtn{width:33.333%;min-width:190px;margin:0 auto}
.wing .gbtn{font-size:13px;padding:9px 8px;gap:8px}
.gbtn:hover{background:#f6f7f8}
.gbtn:active{background:#eceff1}
.gbtn svg{flex:none;display:block}
.gnote{font-size:12px;color:var(--muted);line-height:1.4;margin-top:8px;text-align:center}
.player.pick{cursor:pointer}
.player.sel .pname{font-weight:700}
.mcount{margin-left:auto;font-size:11px;color:#9fd6a8}
.memo{margin:2px 0 10px;background:#cdb67b;color:#2e2410}
.memotitle{padding:7px 10px;font-size:12px;font-weight:700;background:#b89f5e;color:#2e2410}
.memoscroll{max-height:395px;overflow-y:auto;padding:6px 6px 8px;-webkit-overflow-scrolling:touch}
.memosec{font-size:12px;font-weight:700;margin:8px 4px 4px}
.memorow{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-bottom:4px}
.memocell{display:flex;flex-direction:column;align-items:center;cursor:pointer;min-width:0}
.micon{position:relative;width:34px;height:34px;background:#222;display:flex;align-items:center;justify-content:center}
.micon img{width:100%;height:100%;object-fit:contain;display:block}
.mfb{font-size:14px;font-weight:800;color:#ddd}
.mlabel{font-size:10px;line-height:1.15;text-align:center;margin-top:2px;word-break:keep-all;min-height:23px}
.memocell.s1 .micon{outline:3px solid #2e9d4f;outline-offset:-1px}
.memocell.s1 .mlabel{color:#1b6b34;font-weight:700}
.memocell.s2 .micon{opacity:.4}
.memocell.s2 .micon::after{content:"✕";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#e5322d;font-size:26px;font-weight:800;opacity:2}
.memocell.s2 .mlabel{text-decoration:line-through;opacity:.6}
.memohint{padding:0 10px 8px;font-size:10px;color:#5b4a22}
.libform{margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:8px;background:#2f2f2f}
.libform .info{font-size:12px;color:var(--muted);margin:6px 0 4px}
.libform button{margin-top:8px}
.libform input[type=text]{padding:8px;font-size:14px}
.linkbtn{display:inline-block;flex:none;padding:6px 10px;font-size:13px;border-radius:8px;background:var(--accent);color:#fff;text-decoration:none;text-align:center}
.linkbtn:hover{background:#628ced}
.linkbtn.full{display:block;width:100%;padding:11px;font-size:15px;margin-top:8px}
button.del{background:#e8564f;color:#fff}
button.del:hover{background:#f0655e}
.modalbg{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px}
.modal{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;width:100%;max-width:320px}
.modaltext{font-size:16px;text-align:center;margin-bottom:16px}
.modalbtns{display:flex;gap:10px}
.modalbtns button{margin:0}
.libitem{cursor:pointer;display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line)}
.libitem .libtxt{flex:1;min-width:0}
.libitem:hover{background:rgba(255,255,255,.04)}
.libitem .libtitle{display:block;font-size:15px;word-break:break-all}
.libitem .libsub{font-size:12px;color:var(--muted)}
.libitem button,.libitem .linkbtn{width:auto;height:32px;margin:0;padding:0 12px;font-size:13px;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex:none}
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
.jobbox.chat-av{border-radius:0}
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
.jobbox.tally-av{width:34px;height:34px;border-radius:0}
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

.sheetbtn{display:none}
@media (max-width:860px){
  :root{--sheet:max(35vh,240px);--sheet:max(35dvh,240px)}
  .layout{grid-template-columns:1fr;padding-bottom:84px}
  .wing{position:static;max-height:none}
  .wing.left{order:1}
  .center{order:2}
  .ann,.ann.me{max-width:90%}
  /* 오른쪽 날개는 아래에서 올라오는 메모장으로 */
  .wing.right{position:fixed;left:0;right:0;top:auto;bottom:0;order:3;z-index:20;height:var(--sheet);max-height:none;overflow:auto;border-radius:16px 16px 0 0;border-bottom:0;box-shadow:0 -6px 24px rgba(0,0,0,.5);transform:translateY(105%);transition:transform .25s ease;visibility:hidden}
  body.sheet-open .wing.right{transform:none;visibility:visible}
  body.sheet-open .layout{padding-bottom:calc(var(--sheet) + 70px)}
  .sheetbtn{display:flex;align-items:center;justify-content:center;position:fixed;right:14px;bottom:14px;z-index:30;width:48px;height:48px;padding:0;border-radius:24px;background:var(--accent);color:#fff;font-size:20px;box-shadow:0 2px 10px rgba(0,0,0,.5);transition:bottom .25s ease}
  body.sheet-open .sheetbtn{bottom:calc(var(--sheet) + 10px)}
}
`;

export const HEAD = (title) =>
  `<!doctype html><html lang="ko"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<title>${title}</title><style>${STYLE}</style></head>`;
