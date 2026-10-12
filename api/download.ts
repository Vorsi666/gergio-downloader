import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAllowedDownloadHost } from "./_lib/resolver";

/**
 * GET /api/download?url=<cdn-url>&name=<suggested>.mp4
 *
 * Streams the video through the server instead of buffering it in the browser.
 *
 * Why this exists:
 *  - The `download` attribute is ignored for cross-origin URLs, so without a
 *    proxy the browser opens a preview tab instead of saving the file.
 *  - The blob approach that fixes that loads the whole file into tab memory,
 *    which dies on a 200 MB video. Streaming keeps memory flat.
 *  - Because the response comes back same-origin, Content-Disposition here is
 *    honoured and the file saves directly.
 *
 * Host allow-listing keeps this from being an open relay for arbitrary URLs.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).end("Method not allowed");
    return;
  }

  const url = typeof req.query.url === "string" ? req.query.url : "";
  const name = typeof req.query.name === "string" ? req.query.name : "video.mp4";

  if (!url) {
    res.status(400).end("Missing ?url=");
    return;
  }
  if (!isAllowedDownloadHost(url)) {
    res.status(403).end("Host tidak diizinkan");
    return;
  }

  // Keep the filename filesystem-safe and force a .mp4 extension.
  const safeName = (() => {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const stem = base || "video";
    return stem.endsWith(".mp4") ? stem : `${stem}.mp4`;
  })();

  const upstream = await fetch(url, {
    headers: {
      // TikTok CDN requires a browser-like UA or it answers 503.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Referer: "https://www.tiktok.com/"
    }
  }).catch(() => null);

  if (!upstream || !upstream.ok || !upstream.body) {
    res.status(502).end("Gagal menghubungi server video");
    return;
  }

  const size = upstream.headers.get("content-length");
  res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "video/mp4");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  res.setHeader("Cache-Control", "private, no-store");
  if (size) res.setHeader("Content-Length", size);

  // No compression on video bytes — it is already compressed.
  res.setHeader("Content-Encoding", "identity");
  res.status(200);

  // Stream chunk-by-chunk. Backpressure is handled by Readable.fromWeb.
  const { Readable } = await import("node:stream");
  const nodeStream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);
  nodeStream.on("error", () => {
    if (!res.headersSent) res.status(500).end("Stream terputus");
    else res.end();
  });
  nodeStream.pipe(res);
}
