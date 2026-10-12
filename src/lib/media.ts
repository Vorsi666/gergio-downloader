/**
 * Platform detection + public no-watermark source resolution.
 *
 * Resolution strategy (browser-only, no key, no upload):
 *  1. TikTok  → oEmbed (public, CORS-enabled, returns the unwatermarked `play_addr`).
 *  2. Twitter/X → public syndication endpoint (returns the fullscreen video variants).
 *  3. Instagram → public oEmbed for metadata (a few embeds already expose a direct
 *     `video_url`; most are protected, so the card shows metadata + a safe external link).
 *  4. YouTube → direct iframe embed of the source URL (platform always overlays its
 *     own branding; the card states that plainly instead of pretending otherwise).
 *  5. Unknown / unsupported → the original link, untouched.
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
  tint: string;
  supported: boolean;
}

export const PLATFORMS: PlatformMeta[] = [
  { id: "tiktok", name: "TikTok", tint: "#0B0F2B", supported: true },
  { id: "instagram", name: "Instagram", tint: "#C0389F", supported: true },
  { id: "twitter", name: "X / Twitter", tint: "#0B0F2B", supported: true },
  { id: "youtube", name: "YouTube", tint: "#E23A2C", supported: true },
  { id: "facebook", name: "Facebook", tint: "#2C49B4", supported: false },
  { id: "threads", name: "Threads", tint: "#0B0F2B", supported: false },
  { id: "pinterest", name: "Pinterest", tint: "#B02B2B", supported: false },
  { id: "linkedin", name: "LinkedIn", tint: "#2C49B4", supported: false }
];

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

/** Heuristic: pick the platform and the canonical post URL from pasted text. */
export function detectPlatform(raw: string): { meta: PlatformMeta; url: string } {
  const text = raw.trim();
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

  // TikTok short links (vt./vm.) resolve to tiktok.com hosts after redirect — still tiktok.
  if (id === "unknown" && /(^|\.)tiktok\.com$/.test(host)) id = "tiktok";

  const meta = PLATFORMS.find((p) => p.id === id) ?? {
    id: "unknown" as PlatformId,
    name: "Link",
    tint: "#4F7DF3",
    supported: false
  };
  return { meta, url };
}

async function fetchJson<T>(input: string, init?: RequestInit, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------- TikTok ------------------------------- */

interface TikTokOEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  html?: string;
}

interface TikTokPageData {
  __UNIVERSAL_DATA_FOR_REHYDRATION__?: {
    webapp?: {
      "video-detail"?: {
        itemInfo?: {
          itemStruct?: {
            author?: { uniqueId?: string; nickname?: string };
            desc?: string;
            video?: {
              cover?: string;
              originCover?: string;
              playAddr?: string;
              downloadAddr?: string;
              bitrate?: { playAddr?: string }[];
            };
          };
        };
      };
    };
  };
}

async function resolveTikTok(url: string): Promise<MediaResult> {
  const notes: string[] = [];

  // Attempt 1 — TikTok's own public oEmbed endpoint (CORS enabled, no key).
  let title = "";
  let author = "";
  let thumbnail: string | null = null;
  try {
    const oembed = await fetchJson<TikTokOEmbed>(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    );
    title = oembed.title ?? "";
    author = oembed.author_name ?? "";
    thumbnail = oembed.thumbnail_url ?? null;
  } catch {
    notes.push("Metadata TikTok tidak terbaca, trying direct page parse.");
  }

  // Attempt 2 — scrape the page's rehydration blob for the unwatermarked play_addr.
  let direct: string | null = null;
  try {
    const res = await fetch(url, { redirect: "follow" });
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
          item.video?.downloadAddr ||
          item.video?.playAddr ||
          item.video?.bitrate?.[0]?.playAddr ||
          null;
      }
    }
  } catch {
    /* page fetch blocked — oEmbed result (if any) still stands */
  }

  const options: QualityOption[] = [];
  if (direct) {
    options.push({
      label: "Tanpa Watermark",
      detail: "play_addr — video bersih, tanpa logo TikTok",
      kind: "direct",
      url: direct
    });
  }
  if (url) {
    options.push({
      label: "Buka di TikTok",
      detail: "Klip asli,-download dari app bila watermark tidak tersedia",
      kind: "external",
      url
    });
  }

  return {
    platform: "tiktok",
    platformName: "TikTok",
    sourceUrl: url,
    title: title || "Klip TikTok",
    author: author ? `@${author}` : "TikTok",
    thumbnail,
    embedUrl: null,
    options,
    note:
      direct === null
        ? "TikTok membatasi akses dari browser tanpa sesi login. Metadata ditampilkan, unduhan langsung dilakukan lewat tautan asli."
        : notes.join(" ")
  };
}

/* ------------------------------ Twitter/X ----------------------------- */

interface SyndicationTweet {
  video?: {
    contentType?: string;
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
      options: [
        {
          label: "Buka di X",
          detail: "Tautan post asli",
          kind: "external",
          url
        }
      ],
      note: "Tautan post X tidak dikenali. Pastikan Anda menyalin tautan status, bukan halaman profil."
    };
  }

  const id = idMatch[1];
  const embedUrl = `https://platform.twitter.com/embed/Tweet.html?id=${id}`;
  const endpoint = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=id&token=a`;

  try {
    const data = await fetchJson<SyndicationTweet>(endpoint);
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
          label: i === 0 ? `MP4 · ${Math.round((v.bitrate ?? 0) / 1000)} kbps` : `MP4 · ${Math.round((v.bitrate ?? 0) / 1000)} kbps`,
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
      note: "Post ini tidak memuat video, atau video-nya diproteksi. Metadata tetap ditampilkan."
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
      note: "Endpoint publik X tidak dapat dihubungi dari browser. Gunakan tautan asli atau buka unduhan lewat app X."
    };
  }
}

/* ----------------------------- Instagram ------------------------------ */

async function resolveInstagram(url: string): Promise<MediaResult> {
  const options: QualityOption[] = [{ label: "Buka di Instagram", detail: "Tautan post asli", kind: "external", url }];
  let title = "Post Instagram";
  let author = "Instagram";
  let thumbnail: string | null = null;

  try {
    const oembed = await fetchJson<{
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    }>(`https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}`);
    title = oembed.title || title;
    author = oembed.author_name || author;
    thumbnail = oembed.thumbnail_url ?? thumbnail;
  } catch {
    /* IG's oEmbed needs a token — metadata falls back to defaults */
  }

  return {
    platform: "instagram",
    platformName: "Instagram",
    sourceUrl: url,
    title,
    author,
    thumbnail,
    embedUrl: null,
    options,
    note: "Instagram memblokir unduhan video tanpa watermark dari luar app. Gunakan tautan di atas — simpan dari app resmi tetap menghasilkan berkas tanpa watermark."
  };
}

/* ------------------------------ YouTube -------------------------------- */

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

async function resolveYouTube(url: string): Promise<MediaResult> {
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
    note: "YouTube tidak pernah menyediakan berkas video tanpa watermark. Yang bisa dilakukan adalah menonton langsung lewat pemutar di bawah ini."
  };
}

/* ------------------------------- Router -------------------------------- */

export async function resolveMedia(rawUrl: string): Promise<MediaResult> {
  const { meta, url } = detectPlatform(rawUrl);

  if (meta.id === "tiktok") return resolveTikTok(url);
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
