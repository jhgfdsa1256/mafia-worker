// 화면 JS ① 공통 변수와 도우미 (방 코드, 상태값)
import { GOOGLE_G, LOGIN_NOTE } from "../style.js";
export const clientCore = (lang, id) => `var LANG=${JSON.stringify(lang)},ID=${JSON.stringify(id)};
var GOOGLE_G=${JSON.stringify(GOOGLE_G)},LOGIN_NOTE=${JSON.stringify(LOGIN_NOTE)};
var DATA=null,USERS=[],NICK2USER=Object.create(null);
var HIDE=true,ANON=true,VIEW=0,SHOW_NIGHT=false,SHOW_GHOST=false;
// 누가 누구에게 투표했는지 / 찬성·반대했는지 알려 주는 시스템 메시지
var VOTE_RE=/(\\d+\\s*님이\\s*\\d+\\s*님에게\\s*투표)|((찬성|반대)하였)/;
var VOTE_LINE=/^\\s*(\\d+)\\s*님이\\s*(\\d+)\\s*님에게\\s*투표하였습니다/;
var ANN={},OPEN=null;
var GHOUL_JOB=null; // 도굴꾼이 첫날 밤 희생자에게서 얻은 직업
var KNOWN={CHAT:1,MAFIACHAT:1,MEGAPHONE:1,GHOSTCHAT:1,WILL:1};
// 추리중 아이콘 (숨김 상태이거나 직업을 모를 때 표시)
var UNKNOWN_ICON="https://raw.githubusercontent.com/LiQuiDsKR/Mafia42ImageResource/refs/heads/main/images/StrategyThumbnail/08%20%EC%B6%94%EB%A6%AC%20%EC%A4%91.webp";

function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}

`;
