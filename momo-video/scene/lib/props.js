import * as THREE from 'three';
import { stripes, signboard } from './textures.js';
import { rng } from './anim.js';

const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });

function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** Roadside sachet-water stall: table, umbrella, cooler, sachet piles, board. */
export function makeStall() {
  const g = new THREE.Group();
  const wood = mat({ color: '#8d5a34' });

  // Table
  const top = mesh(new THREE.BoxGeometry(1.3, 0.05, 0.7), wood);
  top.position.y = 0.78;
  g.add(top);
  for (const [x, z] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) {
    const leg = mesh(new THREE.BoxGeometry(0.05, 0.78, 0.05), wood);
    leg.position.set(x, 0.39, z);
    g.add(leg);
  }
  // Cloth over the table front
  const cloth = mesh(new THREE.PlaneGeometry(1.32, 0.42), mat({ color: '#1565c0', side: THREE.DoubleSide }));
  cloth.position.set(0, 0.58, 0.352);
  g.add(cloth);

  // Umbrella
  const pole = mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.3, 8), mat({ color: '#ddd', metalness: 0.6 }));
  pole.position.set(-0.75, 1.15, -0.2);
  g.add(pole);
  const canopyTex = stripes(['#d32f2f', '#fff8e1', '#fbc02d', '#fff8e1', '#2e7d32', '#fff8e1'], 12);
  const canopy = mesh(new THREE.ConeGeometry(1.4, 0.45, 24, 1, true), mat({ map: canopyTex, side: THREE.DoubleSide, roughness: 0.9 }));
  canopy.position.set(-0.75, 2.3, -0.2);
  canopy.rotation.z = 0.08;
  g.add(canopy);

  // Blue cooler with white lid
  const cooler = new THREE.Group();
  const box = mesh(new THREE.BoxGeometry(0.62, 0.46, 0.42), mat({ color: '#1e63c4', roughness: 0.4 }));
  box.position.y = 0.23;
  const lid = mesh(new THREE.BoxGeometry(0.66, 0.08, 0.46), mat({ color: '#f5f5f5', roughness: 0.4 }));
  lid.position.y = 0.5;
  cooler.add(box, lid);
  cooler.position.set(0.95, 0, 0.15);
  g.add(cooler);

  // Sachets: little pillows stacked on the table and in an open bag
  const sachetGeo = new THREE.SphereGeometry(1, 12, 6);
  sachetGeo.scale(0.075, 0.016, 0.052);
  const sachetMat = mat({ color: '#e8f4ff', roughness: 0.15, transparent: true, opacity: 0.88 });
  const r = rng(42);
  const sachets = new THREE.InstancedMesh(sachetGeo, sachetMat, 120);
  sachets.castShadow = true;
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (let layer = 0; layer < 3; layer++)
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) {
        if (n >= 120) break;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.5, (r() - 0.5) * 0.2));
        m4.compose(new THREE.Vector3(-0.5 + i * 0.13 + (r() - 0.5) * 0.03, 0.82 + layer * 0.03, -0.15 + j * 0.11), q, new THREE.Vector3(1, 1, 1));
        sachets.setMatrixAt(n++, m4);
      }
  sachets.count = n;
  g.add(sachets);
  // Blue print band on sachets is suggested by a second, smaller instanced layer
  const bandGeo = new THREE.SphereGeometry(1, 10, 4);
  bandGeo.scale(0.044, 0.017, 0.03);
  const bands = new THREE.InstancedMesh(bandGeo, mat({ color: '#2a7de1', roughness: 0.3 }), n);
  for (let i = 0; i < n; i++) {
    sachets.getMatrixAt(i, m4);
    bands.setMatrixAt(i, m4);
  }
  g.add(bands);

  // Stool behind the table
  const stool = mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.42, 16), mat({ color: '#e53935', roughness: 0.5 }));
  stool.position.set(-0.3, 0.21, -0.75);
  g.add(stool);

  // PURE WATER board leaning on the table
  const board = mesh(new THREE.PlaneGeometry(0.75, 0.24), mat({ map: signboard('PURE WATER', 'ICE COLD', { bg: '#fffde7', fg: '#0d47a1', accent: '#d32f2f' }) }));
  board.position.set(-0.35, 0.56, 0.37);
  g.add(board);

  return g;
}

/**
 * Phone with a canvas screen. draw(state, t) repaints it each frame.
 * States: 'wallet' | 'call' | 'off'.
 */
export function makePhone() {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.075, 0.012, 0.155), mat({ color: '#202124', roughness: 0.3, metalness: 0.4 }));
  g.add(body);
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = 744;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.142), screenMat);
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = 0.0065;
  g.add(screen);
  const glow = new THREE.PointLight('#bfe3ff', 0, 0.25);
  glow.position.y = 0.08;
  g.add(glow);

  function roundRect(x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function statusBar(dark) {
    ctx.fillStyle = dark ? '#fff' : '#222';
    ctx.font = '600 22px Figtree';
    ctx.textAlign = 'left';
    ctx.fillText('6:02', 24, 38);
    ctx.textAlign = 'right';
    ctx.fillText('▮▮▮  82%', 336, 38);
    ctx.textAlign = 'left';
  }

  const draw = (state, t = 0) => {
    ctx.textAlign = 'left';
    if (state === 'off') {
      ctx.fillStyle = '#050608';
      ctx.fillRect(0, 0, c.width, c.height);
      glow.intensity = 0;
    } else if (state === 'wallet') {
      ctx.fillStyle = '#f3f6f4';
      ctx.fillRect(0, 0, c.width, c.height);
      roundRect(0, 0, 360, 300, 0, '#0b6b4f');
      statusBar(true);
      ctx.fillStyle = '#d7f5e7';
      ctx.font = '600 26px Figtree';
      ctx.fillText('Mobile money wallet', 28, 100);
      ctx.font = '500 22px Figtree';
      ctx.fillText('Balance', 28, 160);
      ctx.fillStyle = '#fff';
      ctx.font = '800 58px Figtree';
      ctx.fillText('GH¢ 640.00', 26, 226);
      ctx.fillStyle = '#333';
      ctx.font = '700 26px Figtree';
      ctx.fillText('My savings', 28, 360);
      const rows = [['School fees – Ama', '450.00', '#7e57c2'], ['Food – this week', '190.00', '#ef6c00']];
      rows.forEach(([label, amt, col], i) => {
        const y = 390 + i * 120;
        roundRect(20, y, 320, 100, 18, '#fff');
        roundRect(38, y + 26, 48, 48, 24, col);
        ctx.fillStyle = '#222';
        ctx.font = '600 23px Figtree';
        ctx.fillText(label, 100, y + 46);
        ctx.fillStyle = '#0b6b4f';
        ctx.font = '800 26px Figtree';
        ctx.fillText('GH¢ ' + amt, 100, y + 80);
      });
      glow.intensity = 0.01;
    } else if (state === 'call') {
      const grd = ctx.createLinearGradient(0, 0, 0, c.height);
      grd.addColorStop(0, '#263238');
      grd.addColorStop(1, '#0d1417');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, c.width, c.height);
      statusBar(true);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#b0bec5';
      ctx.font = '500 26px Figtree';
      ctx.fillText('Incoming call', 180, 150);
      // pulsing avatar
      const pulse = (t * 1.6) % 1;
      ctx.beginPath();
      ctx.arc(180, 290, 70 + pulse * 50, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(120,200,255,${0.35 * (1 - pulse)})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(180, 290, 70, 0, Math.PI * 2);
      ctx.fillStyle = '#546e7a';
      ctx.fill();
      ctx.fillStyle = '#eceff1';
      ctx.font = '800 80px Figtree';
      ctx.fillText('?', 180, 318);
      ctx.fillStyle = '#fff';
      ctx.font = '800 38px Figtree';
      ctx.fillText('Unknown number', 180, 430);
      ctx.fillStyle = '#90a4ae';
      ctx.font = '500 24px Figtree';
      ctx.fillText('Mobile', 180, 468);
      for (const [x, col, sym] of [[90, '#e53935', '✕'], [270, '#43a047', '✆']]) {
        ctx.beginPath();
        ctx.arc(x, 640, 46, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 40px DejaVu Sans';
        ctx.fillText(sym, x, 654);
      }
      glow.intensity = 0.03 + 0.02 * Math.sin(t * 10);
    }
    tex.needsUpdate = true;
  };
  draw('off');
  return { group: g, draw };
}

/** Tro-tro minibus with a painted slogan. Faces +x. */
export function makeTrotro() {
  const g = new THREE.Group();
  const paint = mat({ color: '#f5f2e8', roughness: 0.35, metalness: 0.2 });
  const glass = mat({ color: '#1b2a33', roughness: 0.1, metalness: 0.5 });
  const body = mesh(new THREE.BoxGeometry(4.6, 1.75, 1.95), paint);
  body.position.y = 1.35;
  g.add(body);
  const nose = mesh(new THREE.BoxGeometry(0.7, 0.85, 1.9), paint);
  nose.position.set(2.6, 0.9, 0);
  g.add(nose);
  const windshield = mesh(new THREE.BoxGeometry(0.05, 0.75, 1.8), glass);
  windshield.position.set(2.32, 1.75, 0);
  windshield.rotation.z = -0.35;
  g.add(windshield);
  for (const s of [-1, 1]) {
    const win = mesh(new THREE.BoxGeometry(4.0, 0.6, 0.02), glass);
    win.position.set(-0.1, 1.75, s * 0.98);
    g.add(win);
    const stripe = mesh(new THREE.BoxGeometry(4.6, 0.16, 0.02), mat({ color: '#c62828' }));
    stripe.position.set(0, 1.2, s * 0.985);
    g.add(stripe);
    const slogan = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.42),
      mat({ map: signboard('ONYAME NNAE', null, { bg: '#f5f2e8', fg: '#1a237e', accent: '#f5f2e8' }), transparent: true })
    );
    slogan.position.set(-0.3, 0.82, s * 0.99);
    if (s < 0) slogan.rotation.y = Math.PI;
    g.add(slogan);
  }
  // roof rack with luggage
  const rack = mesh(new THREE.BoxGeometry(3.6, 0.08, 1.7), mat({ color: '#555', metalness: 0.6 }));
  rack.position.y = 2.3;
  g.add(rack);
  const bag = mesh(new THREE.BoxGeometry(1.2, 0.4, 1.0), mat({ color: '#6d4c41' }));
  bag.position.set(-0.6, 2.54, 0);
  g.add(bag);
  // wheels
  const wheels = [];
  for (const x of [-1.5, 1.8])
    for (const s of [-1, 1]) {
      const w = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.26, 20), mat({ color: '#151515', roughness: 0.9 }));
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.38, s * 0.92);
      g.add(w);
      wheels.push(w);
    }
  // headlights
  for (const s of [-1, 1]) {
    const hl = mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff6d0' }));
    hl.position.set(2.96, 0.95, s * 0.65);
    g.add(hl);
  }
  return { group: g, wheels };
}
