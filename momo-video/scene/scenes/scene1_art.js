// SCENE 1 — Morning in Kumasi, "animated illustration" version.
// Generated painted plates (art/generated/) are animated as 2.5D layers:
// camera pushes, parallax, breathing, blinks, lip-sync mouth blending and
// expression dissolves. Phone screens are still drawn in code.
import { track, span, blink, clamp, easeOut, smooth } from '../lib/anim.js';

const W = 1920;
const H = 1080;
const ART = '/art/generated/';

const load = (name) =>
  new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = ART + name;
  });

/** Phone screen drawer (same screens as the 3D version, drawn into a canvas). */
function makeScreen(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const rr = (x, y, ww, hh, r, fill) => {
    g.beginPath();
    g.roundRect(x, y, ww, hh, r);
    g.fillStyle = fill;
    g.fill();
  };
  const S = w / 360; // design units -> pixels
  const bar = (dark) => {
    g.fillStyle = dark ? '#fff' : '#222';
    g.font = `600 ${22 * S}px Figtree`;
    g.textAlign = 'left';
    g.fillText('6:02', 24 * S, 38 * S);
    g.textAlign = 'right';
    g.fillText('▮▮▮  82%', 336 * S, 38 * S);
    g.textAlign = 'left';
  };
  return {
    canvas: c,
    draw(state, t) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (state === 'off') {
        g.fillStyle = '#07080a';
        g.fillRect(0, 0, w, h);
        return;
      }
      if (state === 'wallet') {
        g.fillStyle = '#f3f6f4';
        g.fillRect(0, 0, w, h);
        rr(0, 0, w, 300 * S, 0, '#0b6b4f');
        bar(true);
        g.fillStyle = '#d7f5e7';
        g.font = `600 ${26 * S}px Figtree`;
        g.fillText('Mobile money wallet', 28 * S, 100 * S);
        g.font = `500 ${22 * S}px Figtree`;
        g.fillText('Balance', 28 * S, 160 * S);
        g.fillStyle = '#fff';
        g.font = `800 ${58 * S}px Figtree`;
        g.fillText('GH¢ 640.00', 26 * S, 226 * S);
        g.fillStyle = '#333';
        g.font = `700 ${26 * S}px Figtree`;
        g.fillText('My savings', 28 * S, 360 * S);
        [['School fees – Ama', '450.00', '#7e57c2'], ['Food – this week', '190.00', '#ef6c00']].forEach(([label, amt, col], i) => {
          const y = (390 + i * 120) * S;
          rr(20 * S, y, 320 * S, 100 * S, 18 * S, '#fff');
          rr(38 * S, y + 26 * S, 48 * S, 48 * S, 24 * S, col);
          g.fillStyle = '#222';
          g.font = `600 ${23 * S}px Figtree`;
          g.fillText(label, 100 * S, y + 46 * S);
          g.fillStyle = '#0b6b4f';
          g.font = `800 ${26 * S}px Figtree`;
          g.fillText('GH¢ ' + amt, 100 * S, y + 80 * S);
        });
        return;
      }
      // incoming call
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#263238');
      grd.addColorStop(1, '#0d1417');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      bar(true);
      g.textAlign = 'center';
      g.fillStyle = '#b0bec5';
      g.font = `500 ${26 * S}px Figtree`;
      g.fillText('Incoming call', 180 * S, 150 * S);
      const pulse = (t * 1.6) % 1;
      g.beginPath();
      g.arc(180 * S, 290 * S, (70 + pulse * 50) * S, 0, Math.PI * 2);
      g.fillStyle = `rgba(120,200,255,${0.35 * (1 - pulse)})`;
      g.fill();
      g.beginPath();
      g.arc(180 * S, 290 * S, 70 * S, 0, Math.PI * 2);
      g.fillStyle = '#546e7a';
      g.fill();
      g.fillStyle = '#eceff1';
      g.font = `800 ${80 * S}px Figtree`;
      g.fillText('?', 180 * S, 318 * S);
      g.fillStyle = '#fff';
      g.font = `800 ${38 * S}px Figtree`;
      g.fillText('Unknown number', 180 * S, 430 * S);
      g.fillStyle = '#90a4ae';
      g.font = `500 ${24 * S}px Figtree`;
      g.fillText('Mobile', 180 * S, 468 * S);
      for (const [x, col, sym] of [[90, '#e53935', '✕'], [270, '#43a047', '✆']]) {
        g.beginPath();
        g.arc(x * S, 640 * S, 46 * S, 0, Math.PI * 2);
        g.fillStyle = col;
        g.fill();
        g.fillStyle = '#fff';
        g.font = `700 ${40 * S}px DejaVu Sans`;
        g.fillText(sym, x * S, 654 * S);
      }
      g.textAlign = 'left';
    },
  };
}

export async function build(scene, timeline) {
  const C = timeline.cues;
  const [wide, closed, open, surprised, bgEmpty, cutout, table, stall] = await Promise.all([
    'S1_wide_plate.png', 's1_akosua_closed.png', 's1_akosua_open.png', 's1_akosua_surprised.png',
    's1_bg_empty.png', 's1_akosua_cutout.png', 's1_table_plate.png', 'akosua_stall_v1.png',
  ].map((n) => load(n.toLowerCase())));

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d');

  // Scratch canvases for face blending
  const face = document.createElement('canvas');
  face.width = W;
  face.height = H;
  const fg = face.getContext('2d');
  const mask = document.createElement('canvas');
  mask.width = W;
  mask.height = H;
  const mg = mask.getContext('2d');

  // Landmarks measured on the close-up plates (1920x1080)
  const MOUTH = { x: 968, y: 540, rx: 150, ry: 120 };
  const EYES = [{ x: 878, y: 392 }, { x: 1066, y: 392 }];
  const EYE = { rx: 48, ry: 30 };
  const SKIN = '#7a4426';
  // Phone body on the table plate
  const PHONE = { x: 890, y: 176, w: 280, h: 534 };
  const SCREEN = { x: 905, y: 190, w: 250, h: 506, r: 30 };
  const screen = makeScreen(500, 1012);

  /** Draw an image with a camera (scale about a point, plus offset). */
  function plate(img, { zoom = 1, cx = W / 2, cy = H / 2, dx = 0, dy = 0, alpha = 1 } = {}) {
    g.save();
    g.globalAlpha = alpha;
    g.translate(cx + dx, cy + dy);
    g.scale(zoom, zoom);
    g.translate(-cx, -cy);
    g.drawImage(img, 0, 0, W, H);
    g.restore();
  }

  /**
   * Compose Akosua's face: base plate, a blended region from `alt` (mouth open or
   * surprised) with weight `k`, and eyelids for the blink.
   */
  function composeFace(base, alt, k, lid, region) {
    fg.clearRect(0, 0, W, H);
    fg.drawImage(base, 0, 0, W, H);
    if (k > 0.01 && alt) {
      // soft elliptical mask
      mg.clearRect(0, 0, W, H);
      const grad = mg.createRadialGradient(region.x, region.y, 0, region.x, region.y, 1);
      grad.addColorStop(0, `rgba(0,0,0,${k})`);
      grad.addColorStop(0.7, `rgba(0,0,0,${k})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      mg.save();
      mg.translate(region.x, region.y);
      mg.scale(region.rx, region.ry);
      mg.translate(-region.x, -region.y);
      mg.fillStyle = grad;
      mg.fillRect(region.x - 1, region.y - 1, 2, 2);
      mg.restore();
      mg.globalCompositeOperation = 'source-in';
      mg.drawImage(alt, 0, 0, W, H);
      mg.globalCompositeOperation = 'source-over';
      fg.drawImage(mask, 0, 0);
    }
    if (lid < 0.98) {
      // eyelids close from the top: skin-coloured soft shape over the upper part of each eye
      for (const e of EYES) {
        const cover = (1 - lid) * EYE.ry * 2.2;
        fg.save();
        fg.beginPath();
        fg.ellipse(e.x, e.y, EYE.rx * 1.15, EYE.ry * 1.25, 0, 0, Math.PI * 2);
        fg.clip();
        const gr = fg.createLinearGradient(0, e.y - EYE.ry * 1.3, 0, e.y - EYE.ry * 1.3 + cover + 10);
        gr.addColorStop(0, SKIN);
        gr.addColorStop(Math.max(0.01, (cover - 6) / (cover + 10)), SKIN);
        gr.addColorStop(1, 'rgba(122,68,38,0)');
        fg.fillStyle = gr;
        fg.fillRect(e.x - 80, e.y - EYE.ry * 1.3, 160, cover + 10);
        fg.restore();
      }
    }
    return face;
  }

  // ---- shot timing
  const S2 = 7.25; // close-up: "Pure water!"
  const S3 = 10.55; // stall reference shot, narrator on savings
  const S4 = 13.4; // table / phone
  const S5 = C.ring.start + 1.8; // reaction
  const breathe = (t) => 1 + Math.sin(t * 2.1) * 0.004;

  function update(t, frame, camera, overlay, glCanvas, renderer) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const m = timeline.mouth[Math.round(t * timeline.fps)] || 0;

    if (t < S2) {
      // Slow push-in across the street, drifting right, with a gentle sway.
      const p = smooth(clamp(t / S2));
      plate(wide, { zoom: 1.0 + p * 0.14, cx: 1060, cy: 560, dx: -p * 40, dy: Math.sin(t * 0.5) * 3 });
    } else if (t < S3) {
      const p = clamp((t - S2) / (S3 - S2));
      const zoom = 1.04 + p * 0.05;
      // background drifts less than the character: parallax
      plate(bgEmpty, { zoom: zoom * 0.98, cx: 960, cy: 500, dx: p * 6 });
      const f = composeFace(cutout, open, clamp(m * 1.6), blink(t), MOUTH);
      const b = breathe(t);
      g.save();
      g.translate(960 + Math.sin(t * 0.9) * 4 + p * -10, 1080);
      g.scale(zoom * b, zoom * (2 - b));
      g.rotate(Math.sin(t * 0.7) * 0.004);
      g.translate(-960, -1080);
      g.drawImage(f, 0, 0);
      g.restore();
    } else if (t < S4) {
      const p = clamp((t - S3) / (S4 - S3));
      plate(stall, { zoom: 1.0 + p * 0.08, cx: 1000, cy: 560, dy: -p * 12 });
    } else if (t < S5) {
      const p = clamp((t - S4) / (S5 - S4));
      const ringing = t >= C.ring.start;
      const buzz = ringing && Math.sin((t * 2 * Math.PI) / 0.9) > 0;
      const sx = buzz ? Math.sin(t * 160) * 3 : 0;
      const sy = buzz ? Math.cos(t * 150) * 2 : 0;
      const zoom = 1.0 + p * 0.1;
      plate(table, { zoom, cx: 1030, cy: 440 });
      // phone as its own sprite so it can vibrate on the table
      g.save();
      g.translate(1030, 440);
      g.scale(zoom, zoom);
      g.translate(-1030, -440);
      g.translate(sx, sy);
      g.drawImage(table, PHONE.x - 14, PHONE.y - 14, PHONE.w + 28, PHONE.h + 28, PHONE.x - 14, PHONE.y - 14, PHONE.w + 28, PHONE.h + 28);
      screen.draw(ringing ? 'call' : t > S4 + 0.9 ? 'wallet' : 'off', t);
      g.save();
      g.beginPath();
      g.roundRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, SCREEN.r);
      g.clip();
      g.drawImage(screen.canvas, SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
      // glass reflection
      const gl = g.createLinearGradient(SCREEN.x, SCREEN.y, SCREEN.x + SCREEN.w, SCREEN.y + SCREEN.h);
      gl.addColorStop(0, 'rgba(255,255,255,0.10)');
      gl.addColorStop(0.5, 'rgba(255,255,255,0.0)');
      g.fillStyle = gl;
      g.fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
      g.restore();
      // screen glow onto the wood when lit
      if (t > S4 + 0.9) {
        const rg = g.createRadialGradient(1030, 440, 100, 1030, 440, 520);
        rg.addColorStop(0, ringing ? 'rgba(140,200,255,0.18)' : 'rgba(120,240,190,0.10)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg;
        g.fillRect(0, 0, W, H);
      }
      g.restore();
    } else {
      const p = clamp((t - S5) / 1.2);
      const k = smooth(clamp((t - S5) / 0.35)); // dissolve into the surprised expression
      plate(bgEmpty, { zoom: 1.06 + p * 0.03, cx: 960, cy: 500 });
      const f = composeFace(closed, surprised, k, blink(t + 1.3), { x: 968, y: 430, rx: 330, ry: 330 });
      const b = breathe(t);
      g.save();
      g.translate(960 + Math.sin(t * 0.9) * 3, 1080);
      g.scale((1.06 + p * 0.04) * b, (1.06 + p * 0.04) * (2 - b));
      g.translate(-960, -1080);
      g.drawImage(f, 0, 0);
      g.restore();
    }

    overlay.begin(out);
    overlay.lowerThird('Kumasi, 6:00 a.m.', span(t, 1.0, 1.6) * (1 - span(t, 5.6, 6.2)));
    for (const c of timeline.captions) {
      const a = span(t, c.start - 0.15, c.start + 0.1) * (1 - span(t, c.end + 0.2, c.end + 0.45));
      overlay.caption(c.text, a);
    }
    overlay.chapter('Step 1', 'Contact', (t - C.title.start) / (C.title.end - C.title.start));
    overlay.grain(frame);
    overlay.fade(1 - easeOut(clamp(t / 1.6)));
    overlay.fade(span(t, timeline.duration - 0.45, timeline.duration));
  }

  return { update };
}
