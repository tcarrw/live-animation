// scripts/stream.js
//
// ENV needed at runtime:
//   STREAM_URL   – full https URL to the animation (e.g. https://imoon.plnt.earth/)
//   STREAM_MIN   – length in minutes before exit (omit for indefinite)
//   YT_KEY       – YouTube Live stream key (or Twitch key)
//   SUPA_URL     – Supabase project URL
//   SUPA_ANON    – Supabase anon key (read-only)
//   TABLE        – (optional) name of config table, defaults to "stream_cfg"
//
// Node 20+ recommended.  Run:  node scripts/stream.js
//
// ----------------------------------------------

import puppeteer from 'puppeteer';
import { getStream } from '@kldzj/puppeteer-stream';
import { spawn }   from 'child_process';
import ffmpegPath  from 'ffmpeg-static';
import fetch       from 'node-fetch';

const WIDTH  = 1920;
const HEIGHT = 1080;
const FPS    = 30;
const BITRATE = '6M';

const STREAM_URL = process.env.STREAM_URL;
if (!STREAM_URL) {
  console.error('Missing STREAM_URL env'); process.exit(1);
}

const SUPA_URL  = process.env.SUPA_URL;
const SUPA_ANON = process.env.SUPA_ANON;
const TABLE     = process.env.TABLE || 'stream_cfg';

async function pullConfig() {
  if (!SUPA_URL || !SUPA_ANON) return null;
  const resp = await fetch(`${SUPA_URL}/rest/v1/${TABLE}?select=*`, {
    headers: { apiKey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` }
  });
  if (!resp.ok) return null;
  const rows = await resp.json();
  return rows[0] || null;
}

(async () => {
  const cfg = await pullConfig().catch(() => null);
  const urlWithCfg = cfg
    ? `${STREAM_URL}?cfg=${encodeURIComponent(JSON.stringify(cfg))}`
    : STREAM_URL;

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: WIDTH, height: HEIGHT },
    args: [`--window-size=${WIDTH},${HEIGHT}`, '--no-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(urlWithCfg, { waitUntil: 'networkidle0' });

  // Disable clicks & cursor to avoid layout shifts
  await page.evaluate(() => {
    document.body.style.pointerEvents = 'none';
    document.body.style.cursor = 'none';
  });

  const webm = await getStream(page, { video: true, audio: true, fps: FPS });

  const ff = spawn(ffmpegPath, [
    '-re',              // treat input as live
    '-i', '-',          // stdin
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-b:v', BITRATE,
    '-maxrate', BITRATE,
    '-pix_fmt', 'yuv420p',
    '-g', String(FPS * 2), // 2-second key-int
    '-profile:v', 'high',
    '-f', 'flv',
    `rtmps://a.rtmp.youtube.com/live2/${process.env.YT_KEY}`
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  webm.pipe(ff.stdin);

  const minutes = Number(process.env.STREAM_MIN || 0);
  if (minutes > 0) {
    setTimeout(() => {
      webm.destroy();
      ff.kill('SIGINT');
      browser.close();
    }, minutes * 60_000);
  }
})();
