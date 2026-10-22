// 길 안내: 주소에 따라 알맞은 곳으로 보냅니다.
import { CORS, html } from "./http.js";
import { HEAD } from "./pages/style.js";
import { HOME_PAGE } from "./pages/home.js";
import { replayPage } from "./pages/replay.js";
import { msgPage, authLogin, authCallback, authLogout, apiMe } from "./auth.js";
import { handleApi, apiLibrary, apiAnnotations } from "./api.js";
import { jsonPrivate } from "./http.js";

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