# Gergio Downloader

Website video downloader tanpa watermark untuk beberapa platform media sosial.
React + TypeScript + Vite + Tailwind CSS v4, dengan API serverless opsional.

## Arsitektur: jalan di mana saja

Build yang sama berjalan di dua host, dan **tidak ada backend yang wajib hidup**:

```
                    ┌─ 1. /api/resolve  (Vercel)  ─┐
tempel tautan ──────┤                               ├─→ kartu hasil
                    └─ 2. resolver di browser  ────┘
                          (selalu ada, nol backend)
```

| Deploy | Resolve | Unduh | Catatan |
|---|---|---|---|
| **Vercel** | serverless | streaming via proxy | memori datar, file besar aman |
| **GitHub Pages** | browser | blob di memory | 100% gratis, tanpa server |

Di GitHub Pages, `/api/*` membalas 404 dalam <1 detik dan aplikasi diam-diam
jatuh ke resolver browser — tanpa error, tanpa konfigurasi.

## Menjalankan lokal

```bash
npm install
npm run dev          # situs di http://localhost:5180

# uji serverless functions tanpa deploy
npx tsx scripts/test-api.mjs   # http://127.0.0.1:5199/api/resolve
```

## Endpoint

### `GET /api/resolve?url=<post-url>`

```jsonc
{
  "platformName": "TikTok",
  "title": "...",
  "author": "@scout2015",
  "thumbnail": "https://...",
  "options": [
    { "label": "HD · Tanpa Watermark", "detail": "1.9 MB · video bersih",
      "kind": "direct", "url": "https://cdn..." },
    { "label": "Klip asli di TikTok", "detail": "Tautan post asal",
      "kind": "external", "url": "https://..." }
  ]
}
```

### `GET /api/download?url=<cdn-url>&name=<file>.mp4`

Men-stream video melalui server. Karena responsnya same-origin,
`Content-Disposition` berlaku dan browser langsung menyimpan ke disk.

Host tujuan dibatasi daftar putih (`tiktokcdn-*.com`, `twimg.com`, …) supaya
endpoint ini tidak jadi open relay untuk URL sembarang.

## Deploy

### Vercel (dengan API)

```bash
npx vercel          # preview
npx vercel --prod   # production
```

Atau connect repo di dashboard: **https://vercel.com/new** → import repo →
framework autodetect `vite` → Deploy. Tidak ada env var yang perlu diisi.

### GitHub Pages (tanpa API)

Workflow `.github/workflows/deploy.yml` deploy otomatis setiap push ke `main`.
Aktifkan di **Settings → Pages → Deploy from a branch → `main` / `root`**.

`vite.config.ts` memakai `base: "./"` (path relatif) supaya build jalan di subpath
repo tanpa perlu tahu nama repo.

## Strategi resolver

Dua lapis, dicoba berurutan:

1. **tikwm** — API publik, CORS `*`, tanpa key. Mengembalikan `hdplay`/`play`
   (tanpa watermark) dan `wmplay` (berwatermark). Hanya paham TikTok.
2. **Fallback native** — oEmbed TikTok, syndication X/Twitter, embed YouTube,
   metadata Instagram.

Kalau dua-duanya gagal, UI menampilkan hasil yang jujur plus tautan ke sumber —
bukan tombol unduh yang diam-diam tidak berfungsi.

Menambah resolver baru cukup isi `REMOTE_RESOLVERS` di `src/lib/api.ts`.

## Catatan

Unduh hanya konten yang Anda miliki haknya atau yang diizinkan untuk diunduh.
Mematuhi ketentuan layanan dan hak cipta masing-masing platform.

## Lisensi

MIT
