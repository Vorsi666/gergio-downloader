import { useEffect, useMemo, useState } from "react";

interface Star {
  left: string;
  top: string;
  size: number;
  delay: number;
}

/** Starry-night field: gradient sky, graph grid, flowing contours, twinkles, grain. */
export default function Backdrop() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    setStars(
      Array.from({ length: 46 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: 1 + Math.random() * 2.6,
        delay: Math.random() * 5
      }))
    );
  }, []);

  return (
    <div aria-hidden className="starfield fixed inset-0 -z-10 overflow-hidden">
      {/* Flowing contour ribbons — the signature curve of the reference */}
      <Contours />

      <div className="grid-lines absolute inset-0 opacity-45 [mask-image:linear-gradient(180deg,#000_0%,transparent_78%)]" />

      {stars.map((s, i) => (
        <span
          key={i}
          className="twinkle absolute rounded-full bg-white"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`
          }}
        />
      ))}

      <div className="grain" />
    </div>
  );
}

/** A stack of soft S-curves that read as layered topographic lines. */
function Contours() {
  const paths = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const base = 40 + i * 44;
        const amp = 34 + (i % 4) * 13;
        const skew = -70 + i * 16;
        return (
          <path
            key={i}
            d={`M -60 ${base} C ${140 + skew} ${base - amp}, ${260 + skew} ${base + amp}, 460 ${
              base - amp * 0.5
            } S ${700 + skew} ${base + amp * 0.8}, 940 ${base - amp * 0.3}`}
            fill="none"
            stroke={i % 2 === 0 ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.13)"}
            strokeWidth={i % 3 === 0 ? 2.2 : 1.1}
            strokeLinecap="round"
          />
        );
      }),
    []
  );

  return (
    <div className="drift absolute inset-0">
      <svg
        viewBox="0 0 880 880"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full opacity-70"
      >
        {paths}
      </svg>
    </div>
  );
}

/** Palette swatch row, straight from the reference's bottom strip. */
export function PaletteBar() {
  const swatches = [
    { hex: "#0C1446", label: "Midnight Navy" },
    { hex: "#2B5C92", label: "Midnight Blue" },
    { hex: "#B3CDE0", label: "Pale Steel" },
    { hex: "#FFFFFF", label: "Paper" }
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {swatches.map((s) => (
        <span key={s.hex} className="flex items-center gap-2">
          <span
            className="h-3.5 w-3.5 rounded-[3px] border border-white/55 shadow-[0_1px_6px_rgba(0,0,0,.25)]"
            style={{ background: s.hex }}
            aria-hidden
          />
          <span className="font-mono text-[11.5px] font-medium text-white/85">{s.hex}</span>
        </span>
      ))}
    </div>
  );
}
