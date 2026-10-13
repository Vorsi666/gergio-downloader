import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  ClipboardPaste,
  ExternalLink,
  Loader2,
  Play,
  Sparkle,
  X
} from "lucide-react";
import type { MediaResult } from "../lib/media";
import { buildDownloadUrl, hasDownloadProxy } from "../lib/api";

type Phase = "idle" | "resolving" | "done" | "error";
type FetchState = "idle" | "loading" | "done" | "failed";

interface Props {
  result: MediaResult | null;
  phase: Phase;
  error: string | null;
  backend: "vercel" | "remote" | "browser" | null;
  onSubmit: (value: string) => void;
  onReset: () => void;
}

/** Turn a video title into something safe to hand to the filesystem. */
function fileNameFor(label: string, author: string): string {
  const base = `${author.replace(/^@/, "") || "video"}-${label}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "video"}.mp4`;
}

export default function DownloadPanel({
  result,
  phase,
  error,
  backend,
  onSubmit,
  onReset
}: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [fetchMessage, setFetchMessage] = useState<string>("");

  useEffect(() => {
    if (phase === "resolving") {
      setValue("");
      inputRef.current?.focus();
    }
  }, [phase]);

  // Move focus to the status line so the outcome is announced, not just drawn.
  useEffect(() => {
    if (phase === "done" || phase === "error") statusRef.current?.focus();
  }, [phase, result]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const busy = phase === "resolving";

  // Determine best direct HD no-watermark option
  const bestDirect = result?.options.find(
    (o) => o.kind === "direct"
  );

  const download = useCallback(async () => {
    if (!bestDirect || fetchState === "loading") return;
    setFetchState("loading");
    setFetchMessage("Memproses unduh HD…");

    const fileName = fileNameFor(bestDirect.label, result?.author ?? "");
    const proxied = await hasDownloadProxy();

    if (proxied) {
      // Use proxy streaming (same-origin, Content-Disposition applies)
      const a = document.createElement("a");
      a.href = buildDownloadUrl(bestDirect.url, fileName, true);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setFetchState("done");
      setFetchMessage("Unduh selesai");
      return;
    }

    // Fallback: fetch as blob and click download
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await fetch(bestDirect.url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Gagal mengambil video (HTTP ${res.status})`);
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("Video kosong dari server");

      if (window.__blobUrl) URL.revokeObjectURL(window.__blobUrl);
      const url = URL.createObjectURL(blob);
      window.__blobUrl = url;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setFetchState("done");
      setFetchMessage(`Tersimpan · ${(blob.size / (1024 * 1024)).toFixed(1)} MB`);
    } catch (e) {
      setFetchState("failed");
      const why =
        e instanceof Error && e.name === "AbortError"
          ? "Unduhan terlalu lama. Coba lagi."
          : e instanceof Error
            ? e.message
            : "Gagal mengunduh";
      setFetchMessage(`${why} — pastikan tautan valid dan mencoba lagi.`);
    } finally {
      clearTimeout(timer);
    }
  }, [bestDirect, result?.author, fetchState]);

  return (
    <div className="frost-card rounded-[22px] p-4 @[26rem]:rounded-[26px] @[26rem]:p-6">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-white/70">
        Unduh Sekarang
      </p>
      <h2 className="display mt-1.5 text-[24px] text-white @[26rem]:text-[30px]">Tempel tautan</h2>
      <p className="mt-1.5 max-w-[26rem] text-[12.5px] leading-relaxed text-white/75">
        Salin link dari TikTok, Instagram, X, atau YouTube lalu tempel di kolom di bawah.
      </p>

      {/* The frosted pill from the reference, doing real work as the input row.
           Stacks on narrow phones so the input never gets squeezed to nothing. */}
      <div className="frosted-pill mt-4 flex flex-col gap-1.5 rounded-2xl p-1.5 @[24rem]:flex-row @[24rem]:items-center @[24rem]:gap-2 @[24rem]:rounded-full">
        <input
          ref={inputRef}
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="https://vt.tiktok.com/xxxxx"
          aria-label="Tautan video media sosial"
          className="min-w-0 flex-1 rounded-xl bg-transparent px-3.5 py-3 font-mono text-[13px] text-white placeholder:text-white/55 focus:outline-none @[24rem]:rounded-full @[24rem]:px-4 @[24rem]:py-2.5"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText();
              if (text) setValue(text.trim());
            } catch {
              inputRef.current?.focus();
            }
          }}
          title="Tempel dari clipboard"
          aria-label="Tempel dari clipboard"
          className="shrink-0 rounded-md p-1 text-white/70 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          <ClipboardPaste size={14} />
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !value.trim()}
          className="mt-2 shrink-0 rounded-md bg-white px-4 py-2 text-[13px] font-medium text-night-900 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Memproses…
            </>
          ) : (
            "Ambil Video"
          )}
        </button>
      </div>

      {/* Status line for announcements */}
      <p
        ref={statusRef}
        className="mt-3 text-[12px] leading-snug text-white/60 min-w-0"
      >
        {phase === "resolving" && (
          <>
            <Loader2 size={14} className="mr-2 animate-spin" />
            Sedang memproses tautan…
          </>
        )}
        {phase === "done" && result && (
          <>
            <span className="font-medium text-white">
              {result.platformName}
            </span> terdeteksi — siap diunduh HD tanpa watermark.
          </>
        )}
        {phase === "error" && error && (
          <>
            <AlertCircle size={14} className="mr-2" />
            {error}
          </>
        )}
      </p>

      {/* Result card when we have a video */}
      {phase === "done" && result && bestDirect && (
        <div className="mt-6 grid gap-4 @[30rem]:grid-cols-[200px_1fr]">
          {/* Thumbnail */}
          {result.thumbnail ? (
            <img
              src={result.thumbnail}
              alt=""
              className="h-[180px] w-[180px] object-cover rounded-xl bg-white/20"
            />
          ) : (
            <div className="h-[180px] w-[180px] flex items-center justify-center rounded-xl bg-white/20">
              <Play size={24} className="text-white/70" />
            </div>
          )}

          {/* Info and download button */}
          <div className="space-y-3">
            <p className="font-bold text-[16px] leading-snug text-white">
              {result.title}
            </p>
            <p className="text-[13px] text-white/60">
              {result.author ? `@${result.author.replace(/^@/, "")}` : "Unknown"}
            </p>

            {/* Download button */}
            <button
              type="button"
              onClick={download}
              disabled={fetchState === "loading"}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-white px-5 py-4 text-[15px] font-extrabold text-night-900 transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-night-900/40 disabled:opacity-70 disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
            >
              {fetchState === "loading" ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Memproses unduh…
                </>
              ) : fetchState === "done" ? (
                <>
                  <Check size={18} strokeWidth={3} />
                  Unduh Lagi
                </>
              ) : fetchState === "failed" ? (
                <>
                  <AlertCircle size={18} />
                  Coba Lagi
                </>
              ) : (
                <>
                  <ArrowDownToLine size={18} strokeWidth={2.6} />
                  Unduh HD Tanpa Watermark
                </>
              )}
            </button>

            {/* Status message under button */}
            {fetchMessage && (
              <p className="mt-2 text-[12px] leading-snug">
                {fetchState === "failed" ? (
                  <>
                    <AlertCircle size={12} className="mr-1" />
                    {fetchMessage}
                  </>
                ) : (
                  <>
                    <Check size={12} className="mr-1 text-emerald-300" />
                    {fetchMessage}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}