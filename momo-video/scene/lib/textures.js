import * as THREE from 'three';
import { rng } from './anim.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

/** African wax-print style fabric: concentric rings, dots and leaves. */
export function waxPrint(opts, repeat = [2, 2]) {
  return tex(waxPrintCanvas(opts), repeat);
}

export function waxPrintCanvas({ bg, ring, ring2, dot, leaf, seed = 3, size = 512 }) {
  const [c, g] = canvas(size);
  const r = rng(seed);
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);
  const cell = size / 2;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      const cx = i * cell + cell / 2 + (j % 2 ? cell / 4 : 0);
      const cy = j * cell + cell / 2;
      for (let k = 6; k > 0; k--) {
        g.beginPath();
        g.arc(cx, cy, (k / 6) * cell * 0.42, 0, Math.PI * 2);
        g.fillStyle = k % 2 ? ring : ring2;
        g.fill();
      }
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.beginPath();
        g.arc(cx + Math.cos(a) * cell * 0.47, cy + Math.sin(a) * cell * 0.47, cell * 0.035, 0, Math.PI * 2);
        g.fillStyle = dot;
        g.fill();
      }
    }
  g.fillStyle = leaf;
  for (let k = 0; k < 10; k++) {
    g.save();
    g.translate(r() * size, r() * size);
    g.rotate(r() * Math.PI);
    g.beginPath();
    g.ellipse(0, 0, size * 0.06, size * 0.018, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  return c;
}

/** Kente-like woven stripes. */
export function kente(colors, repeat = [2, 2], size = 256) {
  return tex(kenteCanvas(colors, size), repeat);
}

export function kenteCanvas(colors, size = 256) {
  const [c, g] = canvas(size);
  const n = 8;
  const s = size / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      g.fillStyle = colors[(i + j * 2) % colors.length];
      g.fillRect(i * s, j * s, s, s);
      g.fillStyle = colors[(i * 3 + j + 1) % colors.length];
      if ((i + j) % 2) g.fillRect(i * s, j * s + s * 0.35, s, s * 0.3);
      else g.fillRect(i * s + s * 0.35, j * s, s * 0.3, s);
    }
  return c;
}

export function stripes(colors, n = 12, size = 512) {
  const [c, g] = canvas(size, 8);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    g.fillRect((i / n) * size, 0, size / n + 1, 8);
  }
  return tex(c);
}

/** Red laterite earth with pebbles and tyre marks. */
export function laterite(repeat = [30, 30]) {
  const size = 512;
  const [c, g] = canvas(size);
  const r = rng(11);
  g.fillStyle = '#b4582f';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2500; i++) {
    const shade = 120 + r() * 80;
    g.fillStyle = `rgba(${shade + 40},${shade * 0.5},${shade * 0.25},${0.15 + r() * 0.25})`;
    const s = 1 + r() * 4;
    g.fillRect(r() * size, r() * size, s, s);
  }
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(80,30,15,${0.05 + r() * 0.1})`;
    g.beginPath();
    g.ellipse(r() * size, r() * size, 20 + r() * 60, 8 + r() * 30, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, repeat);
}

export function asphalt(repeat = [40, 1]) {
  const [c, g] = canvas(512, 128);
  const r = rng(5);
  g.fillStyle = '#3d3a38';
  g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 3000; i++) {
    const v = 40 + r() * 50;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(r() * 512, r() * 128, 2, 2);
  }
  // Faded centre dashes and edge lines.
  g.fillStyle = 'rgba(235,225,200,0.75)';
  for (let x = 0; x < 512; x += 128) g.fillRect(x + 10, 61, 70, 6);
  g.fillStyle = 'rgba(240,200,60,0.6)';
  g.fillRect(0, 4, 512, 4);
  g.fillRect(0, 120, 512, 4);
  return tex(c, repeat);
}

/** Painted wall with dust/grime gradient at the bottom. */
export function wall(color, repeat = [1, 1]) {
  const [c, g] = canvas(256);
  const r = rng(color.length * 7);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  const grd = g.createLinearGradient(0, 140, 0, 256);
  grd.addColorStop(0, 'rgba(120,50,20,0)');
  grd.addColorStop(1, 'rgba(120,50,20,0.55)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.06})`;
    g.fillRect(r() * 256, r() * 256, 3 + r() * 6, 3 + r() * 6);
  }
  return tex(c, repeat);
}

/** Hand-painted shop signboard. */
export function signboard(text, sub, { bg = '#f4e3b5', fg = '#1d3f8f', accent = '#c62828' } = {}) {
  const [c, g] = canvas(1024, 256);
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = accent;
  g.lineWidth = 14;
  g.strokeRect(10, 10, 1004, 236);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.font = '800 92px Figtree, sans-serif';
  g.fillText(text, 512, sub ? 120 : 160, 950);
  if (sub) {
    g.fillStyle = accent;
    g.font = '700 54px Figtree, sans-serif';
    g.fillText(sub, 512, 205, 950);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function corrugated(repeat = [4, 1]) {
  const [c, g] = canvas(128, 64);
  for (let x = 0; x < 128; x++) {
    const v = 130 + 50 * Math.sin((x / 128) * Math.PI * 8);
    g.fillStyle = `rgb(${v * 1.05},${v * 0.85},${v * 0.7})`;
    g.fillRect(x, 0, 1, 64);
  }
  g.fillStyle = 'rgba(140,60,20,0.35)';
  g.fillRect(0, 40, 128, 24);
  return tex(c, repeat);
}

/** Simple radial "skin" texture with soft cheek warmth for faces. */
export function skin(base = '#6b3b22') {
  const [c, g] = canvas(256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  const r = rng(9);
  for (let i = 0; i < 600; i++) {
    g.fillStyle = `rgba(40,15,5,${r() * 0.05})`;
    g.fillRect(r() * 256, r() * 256, 2, 2);
  }
  return tex(c);
}
