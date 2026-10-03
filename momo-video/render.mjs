// Render a scene to MP4: drives headless Chromium frame by frame and pipes JPEG
// frames into ffmpeg together with the scene's soundtrack.
//
//   node render.mjs scene1                 full scene -> out/scene1.mp4
//   node render.mjs scene1 --stills 0,240  just write PNG/JPEG stills to build/scene1/stills
//   node render.mjs scene1 --from 100 --to 160
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const name = args[0] || 'scene1';
const opt = (k) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.error('[page error]', e.message));
const mode = opt('mode') || '3d';
await page.goto(`http://127.0.0.1:${port}/scene/index.html?scene=${name}&mode=${mode}&capture=1`);
await page.waitForFunction(() => window.SCENE_READY === true, null, { timeout: 120000 });
const info = await page.evaluate(() => window.SCENE_INFO);

const grab = async (i) => Buffer.from((await page.evaluate((i) => window.renderFrame(i), i)).split(',')[1], 'base64');

if (opt('stills')) {
  const dir = path.join(ROOT, 'build', name, mode === '3d' ? 'stills' : `stills_${mode}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of opt('stills').split(',').map(Number)) {
    const t0 = Date.now();
    fs.writeFileSync(path.join(dir, `f${String(f).padStart(4, '0')}.jpg`), await grab(f));
    console.log(`still ${f} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
} else {
  const from = Number(opt('from') ?? 0);
  const to = Number(opt('to') ?? info.frames);
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  const out = path.join(ROOT, 'out', opt('out') || `${name}${mode === '3d' ? '' : '_' + mode}.mp4`);
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'mjpeg', '-i', '-',
    '-ss', String(from / info.fps), '-i', path.join(ROOT, 'build', name, 'mix.wav'),
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const start = Date.now();
  for (let i = from; i < to; i++) {
    const buf = await grab(i);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 24 === 0) {
      const el = (Date.now() - start) / 1000;
      const per = el / (i - from + 1);
      console.log(`frame ${i}/${to}  ${per.toFixed(2)}s/frame  eta ${Math.round(per * (to - i))}s`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('wrote', out);
}
await browser.close();
server.close();
