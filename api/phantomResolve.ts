import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveMedia } from './_lib/resolver';
import { chromium } from 'playwright';

/**
 * GET /api/phantomResolve?url=<post-url>
 *
 * 1. Try to use Playwright to open the page and extract a direct video URL.
 * 2. If that fails or finds no video, fall back to the regular resolver (tikwm/oEmbed).
 * 3. Always returns a MediaResult-shaped object so the UI does not need to change.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS so it can be called from the browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).end('Method not allowed');
    return;
  }

  const raw = typeof req.query.url === 'string' ? req.query.url : '';
  if (!raw) {
    return res.status(400).json({ error: 'Missing ?url=' });
  }

  try {
    // ----- 1. Attempt with Playwright -----
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Block unnecessary resources to speed up and save memory
    await page.route('**/*.{png,jpg,jpeg,svg,woff,woff2,ttf,eot,ico}', route => route.abort());
    await page.goto(raw, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Look for <video> or <source> with video/mp4
    const videoUrl = await page.evaluate(() => {
      const vid = document.querySelector('video[src]');
      if (vid && (vid as HTMLVideoElement).src) return (vid as HTMLVideoElement).src;
      const source = document.querySelector('source[type="video/mp4"][src]');
      if (source && (source as HTMLSourceElement).src) return (source as HTMLSourceElement).src;
      return null;
    });

    await browser.close();

    if (videoUrl) {
      // We have a direct video URL – build a simple MediaResult
      const result = {
        platform: 'unknown' as const,
        platformName: 'Phantom (headless)',
        sourceUrl: raw,
        title: 'Video from headless‑browser',
        author: '',
        thumbnail: null,
        embedUrl: null,
        options: [
          {
            label: 'Unduh via Phantom',
            detail: 'Direct video URL from the page',
            kind: 'direct' as const,
            url: videoUrl,
          },
          {
            label: 'Buka halaman asli',
            detail: 'Tautan post',
            kind: 'external' as const,
            url: raw,
          },
        ],
        note:
          'Hasil diperoleh dengan menjalankan halaman di Chromium headless. Cocok untuk situs yang membutuhkan JS untuk memutar video.',
      } as const;
      return res.status(200).json(result);
    }
  } catch (e) {
    // If Playwright fails (timeout, missing browser, etc.), fall back to normal resolver
    console.warn('PhantomResolve failed, falling back to regular resolver:', e);
  }

  // ----- 2. Fallback to regular resolver (tikwm/oEmbed) -----
  try {
    const fallback = await resolveMedia(raw);
    return res.status(200).json(fallback);
  } catch (err) {
    return res
      .status(502)
      .json({ error: err instanceof Error ? err.message : 'Resolver gagal' });
  }
}