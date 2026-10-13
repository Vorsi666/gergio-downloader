import { useCallback, useState } from "react";
import {
  ArrowDown,
  Gauge,
  ShieldCheck,
  Zap,
  Loader2,
  Check,
  AlertCircle,
  ClipboardPaste,
  ExternalLink,
  Play,
  ArrowDownToLine,
  Sparkle,
} from "lucide-react";
import { useEffect } from "react";
import Backdrop, { PaletteBar } from "./components/Backdrop";
import DownloadPanel from "./components/DownloadPanel";
import { detectPlatform, PLATFORMS, type MediaResult } from "./lib/media";
import { resolveWithFallback } from "./lib/api";

type Phase = "idle" | "resolving" | "done" | "error";

const SAMPLE_LINKS = [
  { label: "TikTok", href: "https://www.tiktok.com/@example/video/7400000000000000000" },
  { label: "Instagram", href: "https://www.instagram.com/reel/example/" },
  { label: "X / Twitter", href: "https://x.com/example/status/1800000000000000000" },
  { label: "YouTube", href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
];

export default function App() {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<MediaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [backend, setBackend] = useState<"vercel" | "remote" | "browser" | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;
    setPhase("resolving");
    setResult(null);
    setError(null);
    setBackend(null);
    setPendingLabel(detectPlatform(input).meta.name);

    try {
      const { result: media, via } = await resolveWithFallback(input);
      setResult(media);
      setBackend(via);
      setPhase("done");
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "AbortError"
          ? "Permintaan terlalu lama. Periksa koneksi lalu coba lagi."
          : e instanceof Error
            ? e.message
            : "Terjadi kesalahan tak terduga.";
      setError(msg);
      setPhase("error");
    } finally {
      setPendingLabel(null);
    }
  }, [input]);

  const reset = useCallback(() => {
    setInput("");
    setPhase("idle");
    setResult(null);
    setError(null);
  }, []);

  const supported = PLATFORMS.filter((p) => p.supported);
  const coming = PLATFORMS.filter((p) => !p.supported);

  return (
    <div className="min-h-dvh text-white">
      <Backdrop />
      <main className="mx-auto max-w-2xl px-4 pt-20">
        <header className="flex items-center justify-between space-x-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Zap size={16} strokeWidth={2} className="text-white" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Gergio Downloader</h1>
              <p className="text-sm text-white/60">Unduh video tanpa watermark, langsung dari sumber</p>
            </div>
          </div>
          <div className="text-xs text-white/40">
            v1.0 · Gratis
          </div>
        </header>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              className="flex-1 min-w-0 rounded-xl bg-white/10 backdrop-blur border border-white/20 px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 transition-colors"
              placeholder="https://vt.tiktok.com/xxxxx"
              aria-label="Tautan video media sosial"
            />
            <button
              onClick={handleSubmit}
              disabled={phase === "resolving"}
              className="shrink-0 rounded-md px-4 py-2 bg-white text-night-900 font-medium transition-colors hover:bg-white/20 disabled:opacity-50"
            >
              {phase === "resolving" ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Memproses…
                </>
              ) : (
                "Ambil Video"
              )}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.readText().then(text => {
                  if (text) setInput(text.trim());
                }).catch(() => {
                  inputRef.current?.focus();
                });
              }}
              title="Tempel dari clipboard"
              aria-label="Tempel dari clipboard"
              className="shrink-0 rounded-md px-2 py-2 bg-white/20 text-white/70 hover:bg-white/30 transition-colors"
            >
              <ClipboardPaste size={14} />
            </button>
          </div>

          {phase === "resolving" && (
            <p className="text-sm text-white/60 flex items-center gap-2">
              <Loader2 size={14} className="mr-2 animate-spin" />
              Sedang memproses tautan…
            </p>
          )}

          {phase === "done" && result && (
            <>
              <p className="text-sm text-white/60">
                <span className="font-medium">{result.platformName}</span> terdeteksi — siap diunduh.
              </p>
              <DownloadPanel
                result={result}
                phase="done"
                error={null}
                backend={backend}
                onSubmit={handleSubmit}
                onReset={reset}
              />
            </>
          )}

          {phase === "error" && error && (
            <p className="text-sm text-white/60 flex items-center gap-2">
              <AlertCircle size={14} className="mr-2" />
              {error}
            </p>
          )}
        </div>

        {/* Sample links */}
        <div className="mt-6">
          <p className="text-sm font-medium text-white/60 uppercase tracking-wider">
            Contoh tautan
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {SAMPLE_LINKS.map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  setInput(s.href);
                  handleSubmit();
                }}
                disabled={phase === "resolving"}
                className="rounded-full border border-white/30 bg-white/10 px-3.5 py-2 font-mono text-[11.5px] text-white/85 backdrop-blur-md transition-colors hover:bg-white/22 disabled:opacity-50 focus-visible:outline-2 focus-visible:offset-2 focus-visible:outline-white"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feature trio */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="frosted-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Zap size={14} strokeWidth={2} className="text-white" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-white">Instan</h3>
                <p className="text-xs text-white/60">Metadata diambil dalam hitungan detik setelah tautan ditempel.</p>
              </div>
            </div>
          </div>
          <div className="frosted-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <ShieldCheck size={14} strokeWidth={2} className="text-white" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-white">Tanpa watermark</h3>
                <p className="text-xs text-white/60">Alamat video bersih dibaca langsung dari sumber aslinya, bukan rekaman layar.</p>
              </div>
            </div>
          </div>
          <div className="frosted-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Gauge size={14} strokeWidth={2} className="text-white" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-white">100% privat</h3>
                <p className="text-xs text-white/60">Berjalan penuh di browser. Tautan tidak pernah dikirim ke server kami.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Palette strip */}
        <div className="mt-8">
          <PaletteBar />
        </div>
      </main>

      <footer className="border-t border-white/20 bg-night-900/35 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 py-4 flex flex-col items-center sm:flex-row sm:justify-between">
          <p className="text-xs font-extrabold uppercase tracking-wider">Gergio Downloader</p>
          <p className="text-xs text-white/60">
            {pendingLabel ? `Memproses ${pendingLabel}…` : "Hanya untuk konten yang Anda miliki haknya."}
          </p>
        </div>
      </footer>
    </div>
  );
}