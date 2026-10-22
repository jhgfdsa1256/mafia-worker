// 리플레이 화면 (왼쪽/가운데/오른쪽 날개 + 화면 JS 조립)
import { HEAD } from "./style.js";
import { clientCore } from "./client/core.js";
import { clientStorage } from "./client/storage.js";
import { clientAccount } from "./client/account.js";
import { clientMemo } from "./client/memo.js";
import { clientUsers } from "./client/users.js";
import { clientAnnotate } from "./client/annotate.js";
import { clientLog } from "./client/log.js";
import { clientTools } from "./client/tools.js";
import { clientInit } from "./client/init.js";

export function replayPage(lang, id) {
  return (
    HEAD("리플레이 · 마피아42 스터디") +
    `<body><div class="layout">
<aside class="wing left">
  <a class="back" href="/">← 처음으로</a>
  <h2>계정</h2>
  <div id="auth" class="info">확인 중...</div>
  <button id="libbtn" class="sec" hidden>보관함에 저장</button>
  <div id="libform" class="libform" hidden></div>
  <button id="import" class="sec" hidden>이 브라우저 주석 가져오기</button>
  <h2 class="mt">도구</h2>
  <a class="linkbtn full" id="orig" href="${"https://mafia42.com/history/" + lang + "/" + id}" target="_blank" rel="noopener noreferrer">원본 리플레이 열기</a>

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
<button id="sheetbtn" class="sheetbtn" aria-label="메모장 열기" aria-expanded="false">▲</button>
<script>
${clientCore(lang, id)}
${clientStorage}${clientAccount}${clientMemo}${clientUsers}${clientAnnotate}${clientLog}${clientTools}${clientInit}</script></body></html>`
  );
}
