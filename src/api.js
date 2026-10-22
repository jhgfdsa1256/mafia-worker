// 리플레이 가져오기, 보관함, 주석 API
import { json, jsonPrivate } from "./http.js";
import { parseReplayHtml, buildDebug } from "./parser.js";
import { getUser, sameOrigin } from "./auth.js";

const API_URLS = {
  kr: (id) =>
    `https://o2zj8uijbj.execute-api.ap-northeast-2.amazonaws.com/GetMafiaChat?id=${id}&lang=kr`,
  en: (id) =>
    `https://lwlexm3imq2lvqcst4kjr6322u0acknn.lambda-url.us-east-1.on.aws/?id=${id}&lang=en`,
};
const LIB_MAX = 300;
const ANN_MAX = 1000;
const NOTE_MAX = 2000;

export async function handleApi(url) {
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
    const hdrs = {};
    for (const k of ["last-modified", "date", "etag", "age", "content-type"]) {
      const v = upstream.headers.get(k);
      if (v) hdrs[k] = v;
    }
    for (const [k, v] of upstream.headers) if (/^x-amz-meta/i.test(k)) hdrs[k] = v;
    return json(buildDebug(htmlText, hdrs), 200, { "Cache-Control": "no-store" });
  }

  const parsed = parseReplayHtml(htmlText);
  if (parsed.logs.length === 0 && parsed.users.length === 0) {
    return json(
      { error: "리플레이 내용을 찾지 못했습니다. (만료되었거나 형식이 다릅니다)" },
      404
    );
  }

  return json({ roomId: id, lang, ...parsed }, 200, {
    "Cache-Control": "public, max-age=300",
  });
}

export async function apiLibrary(request, url, env) {
  const user = await getUser(request, env);
  if (!user) return jsonPrivate({ error: "로그인이 필요해요." }, 401);

  const m = url.pathname.match(/^\/api\/library(?:\/(kr|en)\/([0-9a-fA-F]{32}))?$/);
  if (!m) return jsonPrivate({ error: "not found" }, 404);
  const lang = m[1];
  const id = m[2] ? m[2].toLowerCase() : null;

  if (request.method === "GET" && !lang) {
    const { results } = await env.DB.prepare(
      "SELECT lang, room_id, added_at, title, pick, nickname, job FROM library WHERE user_id = ? ORDER BY added_at DESC LIMIT ?"
    )
      .bind(user.id, LIB_MAX)
      .all();
    return jsonPrivate({
      items: results.map((r) => ({
        lang: r.lang,
        id: r.room_id,
        added: r.added_at,
        title: r.title || null,
        pick: r.pick || null,
        nickname: r.nickname || null,
        job: r.job || null,
      })),
    });
  }

  if (!lang) return jsonPrivate({ error: "method not allowed" }, 405);
  if (!sameOrigin(request, url)) return jsonPrivate({ error: "forbidden" }, 403);

  if (request.method === "PUT") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    if (!body || typeof body !== "object") body = {};
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 60) : "";
    const pickN = Number(body.pick);
    const pick = Number.isInteger(pickN) && pickN >= 1 && pickN <= 8 ? pickN : null;
    const nickname =
      typeof body.nickname === "string" && body.nickname.trim()
        ? body.nickname.trim().slice(0, 40)
        : null;
    const job = typeof body.job === "string" && /^[a-z0-9_]{1,40}$/.test(body.job) ? body.job : null;

    const exists = await env.DB.prepare(
      "SELECT 1 AS x FROM library WHERE user_id = ? AND lang = ? AND room_id = ?"
    )
      .bind(user.id, lang, id)
      .first();
    if (!exists) {
      const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM library WHERE user_id = ?")
        .bind(user.id)
        .first();
      if (c && c.n >= LIB_MAX) return jsonPrivate({ error: "보관함이 가득 찼어요." }, 413);
    }
    await env.DB.prepare(
      "INSERT INTO library (user_id, lang, room_id, added_at, title, pick, nickname, job) VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(user_id, lang, room_id) DO UPDATE SET title = excluded.title, pick = excluded.pick, nickname = excluded.nickname, job = excluded.job"
    )
      .bind(user.id, lang, id, Math.floor(Date.now() / 1000), title || null, pick, nickname, job)
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

export async function apiAnnotations(request, url, env) {
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
