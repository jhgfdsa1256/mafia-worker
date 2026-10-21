// 출처: 리플레이를 HTTP GET 한 번으로 가져와 HTML에서 읽는 방식과 링크 경로 해석은
// 대현닷컴 오픈소스(https://github.com/daehyuh/daehyun-backend, TribunalReplayScraper)를 참고했습니다.
// 마피아42 리플레이 HTML을 읽어서 {users, winningTeam, playedAt, logs}로 바꾸는 부분
import * as cheerio from "cheerio";

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

// 리플레이 안에 게임 날짜가 들어 있으면 "YYYY-MM-DD"로 돌려줌 (없으면 null)
const DATE_RES = [
  /(20\d{2})-(\d{2})-(\d{2})[T ]\d{2}:\d{2}/,
  /(20\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/,
];
function findDateCandidates(htmlText) {
  const out = [];
  for (const re of DATE_RES) {
    const g = new RegExp(re.source, "g");
    let m;
    while ((m = g.exec(htmlText)) && out.length < 8) {
      out.push({
        date: `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`,
        context: htmlText.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, " "),
      });
    }
  }
  return out;
}
function extractPlayedDate(htmlText) {
  const c = findDateCandidates(htmlText)[0];
  return c ? c.date : null;
}

export function parseReplayHtml(htmlText) {
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

  return { users, winningTeam, playedAt: extractPlayedDate(htmlText), logs };
}

// 구조 확인용: 이 리플레이에서 쓰인 클래스 이름과 "유언"이 들어간 부분의 원본 HTML
export function buildDebug(htmlText, upstreamHeaders) {
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
    dateCandidates: findDateCandidates(htmlText),
    upstreamHeaders: upstreamHeaders || {},
    otherChildSamples,
    letterSamples,
    bubbleClasses: [...bubbleClasses],
    tableChildClasses: [...tableChildClasses],
    willClassSamples,
    willTextSamples,
  };
}
