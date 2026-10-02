// 2D compositing layer drawn over the WebGL frame: captions, lower thirds,
// chapter cards, fades, vignette and film grain. Brand colours follow the
// hackathon proposal (deep purple, violet, gold).

export const BRAND = { ink: '#1e0b2b', violet: '#5b2a86', gold: '#ffd166', paper: '#f4f0fa' };

export function makeOverlay(W, H) {
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');

  // Pre-baked grain tiles, picked per frame (deterministic).
  const grains = [];
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const img = g.createImageData(256, 256);
    let seed = 1234 + k * 999;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      const v = (seed / 2147483647) * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 14;
    }
    g.putImageData(img, 0, 0);
    grains.push(c);
  }

  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(20,5,25,0.55)');

  return {
    canvas: out,
    begin(glCanvas) {
      ctx.globalAlpha = 1;
      ctx.drawImage(glCanvas, 0, 0, W, H);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
    },
    lowerThird(text, a) {
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = '700 44px Figtree';
      const w = ctx.measureText(text).width;
      const x = 110 - (1 - a) * 40;
      ctx.fillStyle = BRAND.gold;
      ctx.fillRect(x, H - 236, 8, 64);
      ctx.fillStyle = 'rgba(30,11,43,0.78)';
      ctx.fillRect(x + 8, H - 236, w + 56, 64);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, x + 36, H - 190);
      ctx.restore();
    },
    caption(text, a) {
      if (!text || a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = '600 40px Figtree';
      ctx.textAlign = 'center';
      // wrap to two lines max
      const words = text.split(' ');
      const lines = [];
      let line = '';
      for (const wd of words) {
        const test = line ? line + ' ' + wd : wd;
        if (ctx.measureText(test).width > 1300 && line) {
          lines.push(line);
          line = wd;
        } else line = test;
      }
      lines.push(line);
      const lh = 54;
      const y0 = H - 70 - (lines.length - 1) * lh;
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 60;
      ctx.fillStyle = 'rgba(15,5,20,0.62)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - bw / 2, y0 - 44, bw, lines.length * lh + 22, 14);
      ctx.fill();
      ctx.fillStyle = '#fff';
      lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));
      ctx.restore();
    },
    /** Full-screen chapter card, p = 0..1 through its lifetime. */
    chapter(step, title, p) {
      if (p <= 0 || p >= 1) return;
      const inA = Math.min(1, p / 0.18);
      const outA = Math.min(1, (1 - p) / 0.15);
      const a = Math.min(inA, outA);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = BRAND.ink;
      ctx.fillRect(0, 0, W, H);
      const slide = (1 - inA) * 60;
      ctx.fillStyle = BRAND.gold;
      ctx.fillRect(W / 2 - 60, H / 2 - 120 + slide, 120 * inA, 8);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c9a8ef';
      ctx.font = '700 46px Figtree';
      ctx.fillText(step.toUpperCase().split('').join(' '), W / 2, H / 2 - 30 + slide);
      ctx.fillStyle = '#fff';
      ctx.font = '800 150px Figtree';
      ctx.fillText(title, W / 2, H / 2 + 120 + slide);
      ctx.restore();
    },
    fade(a, color = '#000') {
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    },
    grain(frame) {
      const pat = ctx.createPattern(grains[frame % grains.length], 'repeat');
      ctx.save();
      ctx.fillStyle = pat;
      ctx.translate((frame * 37) % 256, (frame * 91) % 256);
      ctx.fillRect(-256, -256, W + 512, H + 512);
      ctx.restore();
    },
  };
}
