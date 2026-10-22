// 구글 로그인, 세션 쿠키, D1 테이블 준비
// 필요한 설정: D1 바인딩 DB, 시크릿 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / SESSION_SECRET
import { HEAD } from "./pages/style.js";
import { jsonPrivate, escapeHtml } from "./http.js";

const SESSION_COOKIE = "m42_session";
const OAUTH_COOKIE = "m42_oauth";
const SESSION_DAYS = 30;
const enc = new TextEncoder();

export function authConfigured(env) {
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

export async function signToken(secret, payload) {
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return body + "." + b64urlEncode(new Uint8Array(sig));
}

export async function verifyToken(secret, token) {
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

export function parseCookies(request) {
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

export function msgPage(message, status = 400) {
  return new Response(
    HEAD("로그인") +
      `<body><div class="wrap"><div class="card"><p>${escapeHtml(message)}</p><p><a href="/">처음으로</a></p></div></div></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    }
  );
}

export function safeNext(next) {
  const n = String(next || "/");
  return n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : "/";
}

// 쿠키를 쓰는 요청은 같은 사이트에서 보낸 것만 허용
export function sameOrigin(request, url) {
  const origin = request.headers.get("Origin");
  if (origin) return origin === url.origin;
  return request.headers.get("Sec-Fetch-Site") === "same-origin";
}

let schemaReady = false;
export async function ensureSchema(db) {
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
  // 예전에 만든 보관함 테이블에 제목/픽/닉네임/직업 칸 추가
  const info = await db.prepare("PRAGMA table_info(library)").all();
  const have = new Set((info.results || []).map((r) => r.name));
  const add = [];
  for (const [col, type] of [["title", "TEXT"], ["pick", "INTEGER"], ["nickname", "TEXT"], ["job", "TEXT"]]) {
    if (!have.has(col)) add.push(db.prepare("ALTER TABLE library ADD COLUMN " + col + " " + type));
  }
  if (add.length) await db.batch(add);
  schemaReady = true;
}

export async function getUser(request, env) {
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

export async function authLogin(url, env) {
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

export async function authCallback(request, url, env) {
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

export function authLogout(request, url) {
  if (request.method !== "POST") return jsonPrivate({ error: "method not allowed" }, 405);
  if (!sameOrigin(request, url)) return jsonPrivate({ error: "forbidden" }, 403);
  return jsonPrivate({ ok: true }, 200, {
    "Set-Cookie": setCookie(SESSION_COOKIE, "", { maxAge: 0 }),
  });
}

export async function apiMe(request, env) {
  const configured = authConfigured(env);
  const user = configured ? await getUser(request, env) : null;
  const missing = ["DB", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET"].filter(
    (k) => !(env && env[k])
  );
  return jsonPrivate({ configured, loggedIn: !!user, name: user ? user.name : null, missing });
}
