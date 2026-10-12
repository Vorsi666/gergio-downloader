# Gergio Downloader

Website video downloader tanpa watermark untuk beberapa platform media sosial.
Dibangun dengan React + TypeScript + Vite + Tailwind CSS v4.

## Fitur

- Tempel satu tautan, dapatkan opsi unduhan
- Resolver aktif: **TikTok**, **X / Twitter**, **Instagram**, **YouTube**
- Placeholder untuk platform yang segera datang: Facebook, Threads, Pinterest, LinkedIn
- Sepenuhnya berjalan di browser — tautan tidak dikirim ke server mana pun
- Antarmuka bilingual-friendly, responsif dari 320px

## Menjalankan secara lokal

```bash
npm install
npm run dev      # http://localhost:5180
```

## Build produksi

```bash
npm run build    # output ke dist/
npm run preview  # cek hasil build
```

## Deploy

### GitHub Pages (via Actions)

Workflow di `.github/workflows/deploy.yml` otomatis deploy setiap push ke `main`.

1. Buat repo baru di GitHub (misal `gergio-downloader`), **jangan** centang "Add README".
2. Push kode ini:

   ```bash
   git remote add origin https://github.com/<user>/gergio-downloader.git
   git push -u origin main
   ```

3. Di repo: **Settings → Pages → Source → Deploy from a branch → `main` / `root` / `/ (root)`**

Situsnya akan tayang di `https://<user>.github.io/gergio-downloader/`.

`vite.config.ts` memakai `base: "./"` (path relatif), jadi build tetap jalan di
subpath repository tanpa perlu ubah konfigurasi.

## Cara kerja resolver

Semua permintaan keluar dari browser ke endpoint publik — tidak ada API key,
tidak ada backend, tidak ada file yang diunggah ke server.

| Platform | Metode | Hasil |
|---|---|---|
| TikTok | oEmbed publik + parse halaman untuk `play_addr` | Tautan MP4 bersih bila tersedia |
| X / Twitter | endpoint `cdn.syndication.twimg.com` | Semua varian MP4 diurutkan dari bitrate tertinggi |
| Instagram | oEmbed publik | Metadata + tautan asli (IG memblokir unduhan dari luar app) |
| YouTube | ekstraksi video ID | Pemutar embed + catatan bahwa YT tak pernah menyediakan berkas tanpa watermark |

Kalau sebuah platform membatasi akses, kartu hasil menampilkan catatan jujur
menggantikan klaim yang berlebihan tentang apa yang bisa dan tidak bisa dilakukan — bukan
pura-pura menampilkan tombol unduh yang tidak akan bekerja.

## Catatan

Unduh hanya konten yang Anda miliki haknya atau yang diizinkan untuk diunduh.
Mematuhi ketentuan layanan dan hak cipta platform masing-masing.

## Lisensi

MIT
