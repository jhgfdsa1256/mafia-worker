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

function parseReplayHtml(html) {
  const $ = cheerio.load(html);
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

// ---------- 라우팅 ----------

// 입력: 공유 링크(https://mafia42.com/history/kr/{id}) 또는 id+lang
function resolveTarget(params) {
  const link = params.get("url");
  if (link) {
    let u;
    try {
      u = new URL(link);
    } catch {
      return null;
    }
    const parts = u.pathname.split("/").filter(Boolean);
    return { lang: parts[1], id: parts[2] };
  }
  return { lang: params.get("lang") || "kr", id: params.get("id") };
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/replay") {
      const target = resolveTarget(url.searchParams);
      if (!target) return json({ error: "잘못된 링크입니다." }, 400);

      const { lang, id } = target;
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
        return json({ error: "리플레이 내용을 찾지 못했습니다. (만료되었거나 형식이 다릅니다)" }, 404);
      }

      return json({ roomId: id, lang, ...parsed }, 200, {
        "Cache-Control": "public, max-age=3600",
      });
    }

    return json({ ok: true, usage: "/api/replay?url=<리플레이 링크> 또는 ?id=<방코드>&lang=kr" });
  },
};
