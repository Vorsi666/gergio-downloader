import { useCallback, useState } from "react";
import { ArrowDown, Gauge, ShieldCheck, Zap } from "lucide-react";
import Backdrop, { PaletteBar } from "./components/Backdrop";
import DownloadPanel from "./components/DownloadPanel";
import { detectPlatform, resolveMedia, PLATFORMS, type MediaResult } from "./lib/media";

type Phase = "idle" | "resolving" | "done" | "error";

const SAMPLE_LINKS = [
  { label: "TikTok", href: "https://www.tiktok.com/@example/video/7400000000000000000" },
  { label: "Instagram", href: "https://www.instagram.com/reel/example/" },
  { label: "X / Twitter", href: "https://x.com/example/status/1800000000000000000" },
  { label: "YouTube", href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
];

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<MediaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);

  const handleSubmit = useCallback(async (raw: string) => {
    setPhase("resolving");
    setResult(null);
    setError(null);
    setPendingLabel(detectPlatform(raw).meta.name);

    try {
      const media = await resolveMedia(raw);
      setResult(media);
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
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setError(null);
  }, []);

  const supported = PLATFORMS.filter((p) => p.supported);
  const coming = PLATFORMS.filter((p) => !p.supported);

  return (
    <div className="min-h-dvh text-white">
      <Backdrop />

      {/* Masthead — badge left, status right, like the reference's caption line */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-7 @[30rem]:px-8">
        <div className="rise flex items-center gap-2.5" style={{ animationDelay: "0.05s" }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/35 bg-white/18 backdrop-blur-md">
            <ArrowDown size={18} strokeWidth={3} />
          </span>
          <span className="text-[15px] font-extrabold tracking-tight">Gergio</span>
        </div>
        <span
          className="rise rounded-full border border-white/35 bg-white/15 px-3 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/90 backdrop-blur-md"
          style={{ animationDelay: "0.12s" }}
        >
          v1.0 · Gratis
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 @[30rem]:px-8">
        {/* Hero: caption above, heavy display wordmark, panel breaking the grid right */}
        <section className="grid gap-10 pt-14 @[30rem]:pt-20 @[58rem]:grid-cols-12 @[58rem]:items-start @[58rem]:gap-10">
          <div className="@[58rem]:col-span-7 @[58rem]:pt-6">
            <p
              className="rise max-w-[24rem] text-[13.5px] font-semibold leading-relaxed text-white/85"
              style={{ animationDelay: "0.16s" }}
            >
              Midnight blue blending into soft indigo and scattered with tiny star-like
              sparks — video dari mana pun, tanpa watermark, dalam satu tautan.
            </p>

            <h1 className="display mt-7 select-none">
              <span
                className="rise block text-[19vw] leading-[0.86] @[30rem]:text-[15vw] @[58rem]:text-[7.6vw]"
                style={{ animationDelay: "0.24s" }}
              >
                Gergio
              </span>
              <span
                className="rise block text-[19vw] leading-[0.86] @[30rem]:text-[15vw] @[58rem]:text-[7.6vw]"
                style={{ animationDelay: "0.32s" }}
              >
                Downloader
              </span>
            </h1>

            {/* The frosted pill as a statement bar, echoing the reference's rounded slab */}
            <div
              className="frosted-pill rise mt-9 flex max-w-[34rem] flex-col gap-3 rounded-[26px] px-5 py-4 @[26rem]:flex-row @[26rem]:items-center @[26rem]:justify-between"
              style={{ animationDelay: "0.42s" }}
            >
              <p className="text-[13px] leading-relaxed text-white/85">
                Tempel satu tautan, dapatkan berkas video{" "}
                <b className="font-extrabold text-white">bersih tanpa watermark</b>. Tidak ada
                login, tidak ada upload.
              </p>
              <a
                href="#unduh"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-extrabold text-night-900 transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ArrowDown size={15} strokeWidth={3} />
                Mulai
              </a>
            </div>

            {/* Platform row — supported get solid chips, the rest sit as muted placeholders */}
            <div className="rise mt-8" style={{ animationDelay: "0.5s" }}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-white/60">
                Platform aktif
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {supported.map((p) => (
                  <span
                    key={p.id}
                    className="rounded-full border border-white/45 bg-white/18 px-3.5 py-1.5 text-[12.5px] font-bold backdrop-blur-md transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    {p.name}
                  </span>
                ))}
                {coming.map((p) => (
                  <span
                    key={p.id}
                    className="rounded-full border border-dashed border-white/30 px-3.5 py-1.5 text-[12.5px] font-semibold text-white/45"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div id="unduh" className="rise scroll-mt-8 @[58rem]:col-span-5 @[58rem]:pt-16" style={{ animationDelay: "0.38s" }}>
            <DownloadPanel
              result={result}
              phase={phase}
              error={error}
              onSubmit={handleSubmit}
              onReset={reset}
            />
          </div>
        </section>

        {/* Sample links */}
        <section className="rise mt-14 max-w-[34rem]" style={{ animationDelay: "0.58s" }}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-white/60">
           DEU contoh tautan
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {SAMPLE_LINKS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => void handleSubmit(s.href)}
                disabled={phase === "resolving"}
                className="rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 font-mono text-[11.5px] text-white/85 backdrop-blur-md transition-colors hover:bg-white/22 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* Feature trio — staggered vertical offsets break the grid */}
        <section className="mt-20 grid gap-4 @[30rem]:grid-cols-3">
          <FeatureCard
            delay={0.64}
            lift="-translate-y-3"
            icon={<Zap size={17} strokeWidth={2.5} />}
            title="Instan"
            body="Metadata diambil dalam hitungan detik setelah tautan ditempel."
          />
          <FeatureCard
            delay={0.72}
            lift="translate-y-4"
            icon={<ShieldCheck size={17} strokeWidth={2.5} />}
            title="Tanpa watermark"
            body="Kernels membaca alamat video bersih langsung dari sumber aslinya."
          />
          <FeatureCard
            delay={0.8}
            lift="-translate-y-1"
            icon={<Gauge size={17} strokeWidth={2.5} />}
            title="100% privat"
            body="Berjalan penuh di browser. Tautan tidak pernah dikirim ke server kami."
          />
        </section>

        {/* Palette strip from the reference's bottom band */}
        <section className="rise mt-20 border-t border-white/22 pt-7" style={{ animationDelay: "0.86s" }}>
          <PaletteBar />
        </section>
      </main>

      <footer className="border-t border-white/20 bg-night-900/35 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 @[30rem]:flex-row @[30rem]:items-center @[30rem]:justify-between @[30rem]:px-8">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em]">Gergio Downloader</p>
          <p className="text-[11px] text-white/60">
            {pendingLabel ? `Memproses ${pendingLabel}…` : "Hanya untuk konten yang Anda miliki haknya."}
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  delay,
  lift,
  icon,
  title,
  body
}: {
  delay: number;
  lift: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className={`rise frost-card rounded-[22px] p-5 ${lift}`} style={{ animationDelay: `${delay}s` }}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/35 bg-white/18">
        {icon}
      </span>
      <h3 className="mt-3 text-[14px] font-extrabold">{title}</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-white/72">{body}</p>
    </article>
  );
}
