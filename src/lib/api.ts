import { resolveMedia as resolveInBrowser, type MediaResult } from "./media";

/**
 * Resolve a post through whichever backend is available.
 *
 * The site is built to survive any single backend being gone:
 *
 *   1. Vercel serverless  (/api/resolve)  — preferred when deployed on Vercel
 *   2. In-browser resolver                 — always available, zero backend
 *   3. Public API passthrough              — last resort, direct from browser
 *
 * On GitHub Pages step 1 404s in under a second and we fall through silently,
 * so the same build works on both hosts with no configuration.
 */

/** Same-origin on Vercel; harmless 404 on GitHub Pages. */
const SAME_ORIGIN_API = "/api/resolve";

/**
 * Extra remote resolvers. Point this at any compatible endpoint to add a
 * fallback layer without touching the app — e.g. a Cloudflare Worker.
 * Each is tried in order after the browser fallback fails.
 */
const REMOTE_RESOLVERS: string[] = [];

const isMediaResult = (v: unknown): v is MediaResult => {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.platformName === "string" && Array.isArray(o.options);
};

async function trySameOrigin(url: string, timeoutMs: number): Promise<MediaResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SAME_ORIGIN_API}?url=${encodeURIComponent(url)}`, {
      signal: controller.signal
    });
    // 404 here means "not deployed on Vercel" — expected, not an error.
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return isMediaResult(body) ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryRemote(base: string, url: string, timeoutMs: number): Promise<MediaResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const endpoint = `${base}${base.includes("?") ? "&" : "?"}url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return isMediaResult(body) ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns the resolved media plus which backend answered, so the UI can be
 *          honest about where the request went.
 */
export interface ResolveOutcome {
  result: MediaResult;
  via: "vercel" | "remote" | "browser";
}

export async function resolveWithFallback(url: string): Promise<ResolveOutcome> {
  // 1. Serverless — fastest and most reliable when present.
  const viaServer = await trySameOrigin(url, 12000);
  if (viaServer) return { result: viaServer, via: "vercel" };

  // 2. Any user-supplied remote resolvers.
  for (const base of REMOTE_RESOLVERS) {
    const viaRemote = await tryRemote(base, url, 10000);
    if (viaRemote) return { result: viaRemote, via: "remote" };
  }

  // 3. Always-available browser resolver.
  const viaBrowser = await resolveInBrowser(url);
  return { result: viaBrowser, via: "browser" };
}

/**
 * Build the href used to save a file.
 *
 * When the serverless proxy is present we route through it: the response is
 * same-origin, so Content-Disposition applies and the file saves directly with
 * flat memory use. Otherwise we fall back to the CDN URL and let the caller
 * fetch it as a blob (see DownloadPanel).
 */
export function buildDownloadUrl(
  cdnUrl: string,
  fileName: string,
  hasProxy: boolean
): string {
  if (!hasProxy) return cdnUrl;
  return `/api/download?url=${encodeURIComponent(cdnUrl)}&name=${encodeURIComponent(fileName)}`;
}

/** Probe once whether the serverless proxy exists, so the UI can pick a path. */
let proxyAvailable: boolean | null = null;
export async function hasDownloadProxy(): Promise<boolean> {
  if (proxyAvailable !== null) return proxyAvailable;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("/api/download?url=", { method: "GET", signal: controller.signal });
    clearTimeout(timer);
    // A 400 means the route exists and rejected our empty param; a 404 means it isn't deployed.
    proxyAvailable = res.status === 400 || res.status === 403;
  } catch {
    proxyAvailable = false;
  }
  return proxyAvailable;
}
