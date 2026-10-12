/**
 * Local harness for the Vercel functions.
 *
 *   node scripts/test-api.mjs
 *
 * Mounts the real handlers behind a tiny http server so the routes can be
 * exercised without the Vercel CLI — same code path that runs in production.
 */
import { createServer } from "node:http";
import { resolveMedia, isAllowedDownloadHost } from "../api/_lib/resolver.ts";

const json = (res, code, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(payload);
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
    res.end();
    return;
  }

  // --- /api/resolve ---
  if (url.pathname === "/api/resolve") {
    const raw = url.searchParams.get("url") ?? "";
    if (!raw) return json(res, 400, { error: "Missing ?url=" });
    try {
      const result = await resolveMedia(raw);
      return json(res, 200, result);
    } catch (e) {
      return json(res, 502, { error: e instanceof Error ? e.message : "gagal" });
    }
  }

  // --- /api/download ---
  if (url.pathname === "/api/download") {
    const target = url.searchParams.get("url") ?? "";
    if (!target) return json(res, 400, { error: "Missing ?url=" });
    if (!isAllowedDownloadHost(target)) return json(res, 403, { error: "Host tidak diizinkan" });

    const upstream = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://www.tiktok.com/"
      }
    }).catch(() => null);

    if (!upstream?.ok || !upstream.body) return json(res, 502, { error: "upstream gagal" });

    const size = upstream.headers.get("content-length");
    res.writeHead(200, {
      "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
      "Content-Disposition": 'attachment; filename="test.mp4"',
      "Content-Encoding": "identity",
      ...(size ? { "Content-Length": size } : {})
    });
    const { Readable } = await import("node:stream");
    Readable.fromWeb(upstream.body).pipe(res);
    return;
  }

  res.writeHead(404).end();
});

const PORT = 5199;
server.listen(PORT, () => console.log(`harness on http://127.0.0.1:${PORT}`));
