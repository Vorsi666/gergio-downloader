import { useEffect, useRef, useState } from "react";
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
import type { MediaResult, QualityOption } from "../lib/media";

type Phase = "idle" | "resolving" | "done" | "error";

interface Props {
  result: MediaResult | null;
  phase: Phase;
  error: string | null;
  onSubmit: (value: string) => void;
  onReset: () => void;
}

export default function DownloadPanel({ result, phase, error, onSubmit, onReset }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

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

  return (
    <div className="frost-card rounded-[26px] p-5 @[26rem]:p-6">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-white/70">
        Unduh Sekarang
      </p>
      <h2 className="display mt-1.5 text-[26px] text-white @[26rem]:text-[30px]">Tempel tautan</h2>
      <p className="mt-1.5 max-w-[26rem] text-[13px] leading-relaxed text-white/75">
        Salin link dari TikTok, Instagram, X, atau YouTube lalu tempel di kolom di bawah.
      </p>

      {/* The frosted pill from the reference, doing real work as the input row */}
      <div className="frosted-pill mt-4 flex flex-col gap-2 rounded-full p-1.5 @[24rem]:flex-row @[24rem]:items-center">
        <input
          ref={inputRef}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="https://vt.tiktok.com/xxxxx"
          aria-label="Tautan video media sosial"
          className="min-w-0 flex-1 rounded-full bg-transparent px-4 py-2.5 font-mono text-[13px] text-white placeholder:text-white/55 focus:outline-none"
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
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white/22 px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-white/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ClipboardPaste size={16} strokeWidth={2.4} />
          <span className="@[24rem]:hidden">Tempel</span>
        </button>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!value.trim() || busy}
        className="sheen relative mt-3 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-night-900 px-6 py-3.5 text-[15px] font-extrabold tracking-tight text-white transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-night-900/40 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
      >
        {busy ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Menganalisis tautan…
          </>
        ) : (
          <>
            <Sparkle size={18} strokeWidth={2.4} />
            Ambil Video
          </>
        )}
      </button>

      <StatusLine phase={phase} error={error} result={result} statusRef={statusRef} onReset={onReset} />

      {result && phase === "done" && <ResultBody result={result} />}
    </div>
  );
}

function StatusLine({
  phase,
  error,
  result,
  statusRef,
  onReset
}: {
  phase: Phase;
  error: string | null;
  result: MediaResult | null;
  statusRef: React.RefObject<HTMLParagraphElement | null>;
  onReset: () => void;
}) {
  const busy = phase === "resolving";
  const failed = phase === "error";

  return (
    <p
      ref={statusRef}
      tabIndex={-1}
      aria-live="polite"
      className="mt-3 flex min-h-[22px] items-start gap-2 text-[13px] leading-snug text-white/80 focus:outline-none"
    >
      {busy && (
        <>
          <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin" />
          <span>
            Mengambil metadata dari <b className="font-bold text-white">{result?.platformName ?? "sumber"}</b>…
          </span>
        </>
      )}
      {failed && (
        <>
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-300" />
          <span className="text-rose-200">{error}</span>
        </>
      )}
      {phase === "done" && result && (
        <>
          <Check size={15} className="mt-0.5 shrink-0 text-emerald-300" />
          <span className="min-w-0 flex-1">
            <b className="font-bold text-white">{result.platformName}</b> terdeteksi —{" "}
            {result.options.length} opsi unduhan siap.
          </span>
          <button
            type="button"
            onClick={onReset}
            title="Bersihkan"
            aria-label="Bersihkan hasil"
            className="shrink-0 rounded-md p-1 text-white/70 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            <X size={14} />
          </button>
        </>
      )}
    </p>
  );
}

function ResultBody({ result }: { result: MediaResult }) {
  return (
    <div aria-live="polite" className="mt-4 border-t border-white/22 pt-4">
      <div className="flex gap-3.5 @[26rem]:gap-4">
        <div className="relative aspect-square w-[86px] shrink-0 overflow-hidden rounded-2xl bg-white/18 @[26rem]:w-[104px]">
          {result.thumbnail ? (
            <img
              src={result.thumbnail}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Play size={20} className="text-white/70" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-steel-300">
            {result.platformName}
          </p>
          <p className="mt-1 line-clamp-2 text-[14px] font-bold leading-snug text-white">{result.title}</p>
          <p className="mt-0.5 truncate font-mono text-[11.5px] text-white/65">{result.author}</p>
        </div>
      </div>

      {result.embedUrl && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/22 bg-night-900">
          <iframe
            src={result.embedUrl}
            title={`Pratinjau ${result.platformName}`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="aspect-video w-full"
          />
        </div>
      )}

      {result.note && (
        <p className="mt-3 flex gap-2 rounded-xl border border-amber-200/25 bg-amber-200/12 px-3 py-2.5 text-[12.5px] leading-snug text-amber-50">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{result.note}</span>
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {result.options.map((opt: QualityOption, i: number) => (
          <li key={`${opt.url.slice(-24)}-${i}`}>
            <a
              href={opt.url}
              target="_blank"
              rel="noreferrer noopener"
              download={opt.kind === "direct" ? true : undefined}
              className="group flex items-center gap-3 rounded-2xl border border-white/18 bg-white/10 px-3.5 py-3 transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/18 text-white transition-colors group-hover:bg-white group-hover:text-night-900">
                {opt.kind === "direct" ? (
                  <ArrowDownToLine size={15} strokeWidth={2.4} />
                ) : (
                  <ExternalLink size={15} strokeWidth={2.4} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold leading-tight text-white">{opt.label}</span>
                <span className="block truncate text-[11.5px] text-white/65">{opt.detail}</span>
              </span>
              <ExternalLink size={14} className="shrink-0 text-white/50 transition-transform group-hover:translate-x-0.5" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
