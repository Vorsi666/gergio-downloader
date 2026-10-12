import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveMedia } from "./_lib/resolver";

/**
 * GET /api/resolve?url=<post-url>
 *
 * Server-side resolver. Same two-layer strategy the browser runs, but from a
 * server: no CORS dance, no client IP exposure, and it keeps working when the
 * upstream tikwm instance rate-limits a browser session.
 *
 * The frontend calls this first and silently falls back to the in-browser
 * resolver if the endpoint is absent (GitHub Pages) or erroring.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Permissive CORS: this endpoint is public and keyed on nothing sensitive.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const raw = typeof req.query.url === "string" ? req.query.url : "";
  if (!raw) {
    res.status(400).json({ error: "Missing ?url=" });
    return;
  }

  try {
    const result = await resolveMedia(raw);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(result);
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : "Resolver gagal",
      hint: "Frontend akan mencoba resolver di browser sebagai cadangan."
    });
  }
}
