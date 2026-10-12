/**
 * Shared platform detection + resolution logic for the serverless functions.
 *
 * Kept dependency-free and runtime-agnostic so it runs unchanged on:
 *   - Vercel Node functions (api/*.ts)
 *   - any Node 18+ worker
 *
 * Layer 1: tikwm (public API, CORS `*`, no key) for TikTok.
 * Layer 2: platform-native public endpoints for everything else.
 */

export type PlatformId =
  | "tiktok"
  | "instagram"
  | "twitter"
  | "youtube"
  | "facebook"
  | "threads"
  | "pinterest"
  | "linkedin"
  | "unknown";

export interface QualityOption {
  label: string;
  detail: string;
  kind: "direct" | "embed" | "external";
  url: string;
}

export interface MediaResult {
  platform: PlatformId;
  platformName: string;
  sourceUrl: string;
  title: string;
  author: string;
  thumbnail: string | null;
  embedUrl: string | null;
  options: QualityOption[];
  note?: string;
}

interface PlatformMeta {
  id: PlatformId;
  name: string;
  supported: boolean;
}

export const PLATFORMS: PlatformMeta[] = [
  { id: "tiktok", name: "TikTok", supported: true },
  { id: "instagram", name: "Instagram", supported: true },
  { id: "twitter", name: "X / Twitter", supported: true },
  { id: "youtube", name: "YouTube", supported: true },
  { id: "facebook", name: "Facebook", supported: false },
  { id: "threads", name: "Threads", supported: false },
  { id: "pinterest", name: "Pinterest", supported: false },
  { id: "linkedin", name: "LinkedIn", supported: false }
];

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

export function detectPlatform(raw: string): { meta: PlatformMeta; url: string } {
  const text = (raw ?? "").trim();
  const match = text.match(/https?:\/\/[^\s<>"'`]+/i);
  const url = match ? match[0].replace(/[.,)]+$/, "") : text;
  const host = hostOf(url);

  const byHost: Record<string, PlatformId> = {
    "tiktok.com": "tiktok",
    "vm.tiktok.com": "tiktok",
    "vt.tiktok.com": "tiktok",
    "instagram.com": "instagram",
    "instagr.am": "instagram",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "facebook.com": "facebook",
    "fb.watch": "facebook",
    "threads.net": "threads",
    "pinterest.com": "pinterest",
    "linkedin.com": "linkedin"
  };

  let id: PlatformId = byHost[host] ?? "unknown";
  if (id === "unknown" && /(^|\.)tiktok\.com$/.test(host)) id = "tiktok";

  const meta = PLATFORMS.find((p) => p.id === id) ?? {
    id: "unknown" as PlatformId,
    name: "Link",
    supported: false
  };
  return { meta, url };
}

const formatBytes = (n: unknown): string => {
  const bytes = typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
  if (bytes === null) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": USER_AGENT, ...(init?.headers ?? {}) }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ───────────────────────────── tikwm layer ────────────────────────────── */

interface TikwmData {
  id?: string;
  title?: string;
  cover?: string;
  origin_cover?: string;
  size?: number;
  hd_size?: number;
  play?: string;
  hdplay?: string;
  wmplay?: string;
  author?: { unique_id?: string };
}

interface TikwmResponse {
  code: number;
  msg: string;
  data?: TikwmData;
}

async function resolveViaTikwm(url: string): Promise<MediaResult | null> {
  const attempts: Array<() => Promise<TikwmResponse>> = [
    () =>
      fetchJson<TikwmResponse>(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1&audio=1`,
        undefined,
        15000
      ),
    () =>
      fetchJson<TikwmResponse>(
        "https://www.tikwm.com/api/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, hd: true, audio: true })
        },
        15000
      ),
    () =>
      fetchJson<TikwmResponse>(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=0&audio=1`,
        undefined,
        15000
      )
  ];

  for (const attempt of attempts) {
    let body: TikwmResponse;
    try {
      body = await attempt();
    } catch {
      continue;
    }
    if (!body || body.code !== 0 || !body.data) continue;

    const d = body.data;
    const options: QualityOption[] = [];
    if (d.hdplay) {
      options.push({
        label: "HD · Tanpa Watermark",
        detail: [formatBytes(d.hd_size), "video bersih tanpa logo TikTok"].filter(Boolean).join(" · "),
        kind: "direct",
        url: d.hdplay
      });
    }
    if (d.play) {
      options.push({
        label: "HD · Tanpa Watermark",
        detail: [formatBytes(d.size), "video bersih tanpa logo TikTok"].filter(Boolean).join(" · "),
        kind: "direct",
        url: d.play
      });
    }
    if (options.length === 0) continue;

    options.push({ label: "Klip asli di TikTok", detail: "Tautan post asal", kind: "external", url });

    return {
      platform: "tiktok",
      platformName: "TikTok",
      sourceUrl: url,
      title: d.title?.trim() || "Klip TikTok",
      author: d.author?.unique_id ? `@${d.author.unique_id}` : "TikTok",
      thumbnail: d.cover || d.origin_cover || null,
      embedUrl: null,
      options
    };
  }
  return null;
}

/* ─────────────────────── platform-native fallbacks ─────────────────────── */

interface TikTokOEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

interface TikTokPageData {
  __UNIVERSAL_DATA_FOR_REHYDRATION__?: {
    webapp?: {
      "video-detail"?: {
        itemInfo?: {
          itemStruct?: {
            author?: { uniqueId?: string };
            desc?: string;
            video?: {
              cover?: string;
              downloadAddr?: string;
              playAddr?: string;
              bitrate?: { playAddr?: string }[];
            };
          };
        };
      };
    };
  };
}

async function resolveTikTokNative(url: string): Promise<MediaResult> {
  let title = "";
  let author = "";
  let thumbnail: string | null = null;

  try {
    const oembed = await fetchJson<TikTokOEmbed>(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      undefined,
      10000
    );
    title = oembed.title ?? "";
    author = oembed.author_name ?? "";
    thumbnail = oembed.thumbnail_url ?? null;
  } catch {
    /* page parse below is the real fallback */
  }

  let direct: string | null = null;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT }
    });
    const html = await res.text();
    const blob = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (blob) {
      const data = JSON.parse(blob[1]) as TikTokPageData;
      const item = data.__UNIVERSAL_DATA_FOR_REHYDRATION__?.webapp?.["video-detail"]?.itemInfo
        ?.itemStruct;
      if (item) {
        title = title || item.desc || "";
        author = author || item.author?.uniqueId || "";
        thumbnail = thumbnail || item.video?.cover || null;
        direct =
          item.video?.downloadAddr || item.video?.playAddr || item.video?.bitrate?.[0]?.playAddr || null;
      }
    }
  } catch {
    /* oEmbed result stands */
  }

  const options: QualityOption[] = [];
  if (direct) {
    options.push({
      label: "Tanpa Watermark",
      detail: "alamat play_addr — video bersih",
      kind: "direct",
      url: direct
    });
  }
  options.push({ label: "Buka di TikTok", detail: "Klip asli", kind: "external", url });

  return {
    platform: "tiktok",
    platformName: "TikTok",
    sourceUrl: url,
    title: title || "Klip TikTok",
    author: author ? `@${author}` : "TikTok",
    thumbnail,
    embedUrl: null,
    options,
    note: direct
      ? undefined
      : "Server TikTok memblokir akses. Metadata tetap ditampilkan — simpan lewat app resmi juga menghasilkan berkas tanpa watermark."
  };
}

interface SyndicationTweet {
  video?: {
    poster?: string;
    variants?: { type?: string; src?: string; bitrate?: number }[];
  };
  text?: string;
  user?: { screen_name?: string };
}

async function resolveTwitter(url: string): Promise<MediaResult> {
  const idMatch = url.match(/status\/(\d+)/);
  if (!idMatch) {
    return {
      platform: "twitter",
      platformName: "X / Twitter",
      sourceUrl: url,
      title: "Post X",
      author: "X",
      thumbnail: null,
      embedUrl: null,
      options: [{ label: "Buka di X", detail: "Tautan post asli", kind: "external", url }],
      note: "Tautan post X tidak dikenali. Salin tautan status, bukan halaman profil."
    };
  }

  const id = idMatch[1];
  const embedUrl = `https://platform.twitter.com/embed/Tweet.html?id=${id}`;

  try {
    const data = await fetchJson<SyndicationTweet>(
      `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=id&token=a`,
      undefined,
      12000
    );
    const variants = (data.video?.variants ?? [])
      .filter((v) => v.type === "video/mp4" && v.src)
      .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

    if (variants.length > 0) {
      return {
        platform: "twitter",
        platformName: "X / Twitter",
        sourceUrl: url,
        title: (data.text ?? "Post X").slice(0, 140),
        author: data.user?.screen_name ? `@${data.user.screen_name}` : "X",
        thumbnail: data.video?.poster ?? null,
        embedUrl,
        options: variants.map((v, i) => ({
          label: `MP4 ${Math.round((v.bitrate ?? 0) / 1000)} kbps`,
          detail: i === 0 ? "Kualitas tertinggi, tanpa watermark" : "Kualitas lebih rendah",
          kind: "direct" as const,
          url: v.src as string
        }))
      };
    }

    return {
      platform: "twitter",
      platformName: "X / Twitter",
      sourceUrl: url,
      title: (data.text ?? "Post X").slice(0, 140),
      author: data.user?.screen_name ? `@${data.user.screen_name}` : "X",
      thumbnail: data.video?.poster ?? null,
      embedUrl,
      options: [{ label: "Buka di X", detail: "Tautan post asli", kind: "external", url }],
      note: "Post ini tidak memuat video, atau videonya diproteksi. Metadata tetap ditampilkan."
    };
  } catch {
    return {
      platform: "twitter",
      platformName: "X / Twitter",
      sourceUrl: url,
      title: "Post X",
      author: "X",
      thumbnail: null,
      embedUrl,
      options: [{ label: "Buka di X", detail: "Tautan post asli", kind: "external", url }],
      note: "Endpoint publik X tidak bisa dihubungi dari server. Buka lewat app X."
    };
  }
}

async function resolveInstagram(url: string): Promise<MediaResult> {
  let title = "Post Instagram";
  let author = "Instagram";
  let thumbnail: string | null = null;

  try {
    const oembed = await fetchJson<{
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    }>(`https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}`, undefined, 9000);
    title = oembed.title || title;
    author = oembed.author_name || author;
    thumbnail = oembed.thumbnail_url ?? thumbnail;
  } catch {
    /* token-gated */
  }

  return {
    platform: "instagram",
    platformName: "Instagram",
    sourceUrl: url,
    title,
    author,
    thumbnail,
    embedUrl: null,
    options: [{ label: "Buka di Instagram", detail: "Tautan post asli", kind: "external", url }],
    note: "Instagram memblokir unduhan video tanpa watermark dari luar app. Simpan dari app resmi tetap menghasilkan berkas bersih."
  };
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, "") === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{6,})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function resolveYouTube(url: string): MediaResult {
  const id = youtubeId(url);
  return {
    platform: "youtube",
    platformName: "YouTube",
    sourceUrl: url,
    title: id ? `YouTube · ${id}` : "Video YouTube",
    author: "YouTube",
    thumbnail: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null,
    embedUrl: id ? `https://www.youtube.com/embed/${id}` : null,
    options: [{ label: "Tonton di YouTube", detail: "Tautan video asli", kind: "external", url }],
    note: "YouTube tidak menyediakan berkas video tanpa watermark. Yang tersedia adalah pemutar di bawah ini."
  };
}

/* ──────────────────────────────── router ──────────────────────────────── */

export async function resolveMedia(rawUrl: string): Promise<MediaResult> {
  const { meta, url } = detectPlatform(rawUrl);

  if (meta.id === "tiktok") {
    const viaApi = await resolveViaTikwm(url);
    if (viaApi) return viaApi;
    return resolveTikTokNative(url);
  }
  if (meta.id === "twitter") return resolveTwitter(url);
  if (meta.id === "instagram") return resolveInstagram(url);
  if (meta.id === "youtube") return resolveYouTube(url);

  return {
    platform: meta.id,
    platformName: meta.name,
    sourceUrl: url,
    title: meta.supported ? "Tautan video" : `${meta.name} belum didukung`,
    author: meta.name,
    thumbnail: null,
    embedUrl: null,
    options: [{ label: `Buka ${meta.name}`, detail: "Tautan asli", kind: "external", url }],
    note: meta.supported
      ? undefined
      : `${meta.name} belum punya resolver. Kernels yang aktif: TikTok, X/Twitter, Instagram, YouTube.`
  };
}

/**
 * Only allow proxying hosts we actually resolve. Without this the download
 * endpoint would be an open relay for arbitrary URLs.
 */
const ALLOWED_DOWNLOAD_HOSTS = [
  "tiktokcdn-us.com",
  "tiktokcdn.com",
  "tiktokcdn.eu",
  "tiktokcdn--us.com",
  "muscdn.com",
  "musical.ly",
  "ibytedtos.com",
  "byteoversea.com",
  "byteimg.com",
  "twimg.com",
  "video.twimg.com"
];

export function isAllowedDownloadHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_DOWNLOAD_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}
