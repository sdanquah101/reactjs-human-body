// 2D cut-out puppet: a layered vector drawing of a woman, drawn on a canvas and
// mounted in the 3D set as a camera-facing billboard. The billboard writes depth
// (alpha-tested) and casts a shadow, so the table, stall and other props still
// occlude her correctly.
//
// Units inside draw(): centimetres, origin at the feet, y up. The canvas maps
// 190 cm of height onto its full height.
import * as THREE from 'three';
import { waxPrintCanvas, kenteCanvas } from './textures.js';

const CW = 1024;
const CH = 1536;
const PX = CH / 190; // pixels per cm
const INK = '#2b1308';
const LINE = 1.1; // outline width in cm

export const LOOKS = {
  akosua: {
    skin: '#7a4426', skinShade: '#5e3119', lip: '#4a1f14', blush: 'rgba(214,92,70,0.28)',
    dress: { bg: '#f2a516', ring: '#1d4fa3', ring2: '#f7e7c3', dot: '#c2185b', leaf: '#2e7d32', seed: 4 },
    wrap: ['#c2185b', '#f2a516', '#1d4fa3', '#2e7d32', '#111'],
    slipper: '#1e88e5',
  },
  esi: {
    skin: '#5c3119', skinShade: '#45220f', lip: '#3d170f', blush: 'rgba(214,92,70,0.22)',
    dress: { bg: '#7b1fa2', ring: '#ffca28', ring2: '#4a148c', dot: '#ffffff', leaf: '#26a69a', seed: 8 },
    wrap: ['#26a69a', '#ffca28', '#4a148c', '#fff'],
    slipper: '#43a047',
  },
  porter: {
    skin: '#4e2a16', skinShade: '#38190a', lip: '#33120b', blush: 'rgba(214,92,70,0.2)',
    dress: { bg: '#00897b', ring: '#ffeb3b', ring2: '#004d40', dot: '#e65100', leaf: '#fff', seed: 12 },
    wrap: ['#e65100', '#ffeb3b', '#004d40'],
    slipper: '#f9a825',
  },
  walker: {
    skin: '#6e3d22', skinShade: '#522a14', lip: '#3f1a10', blush: 'rgba(214,92,70,0.25)',
    dress: { bg: '#d84315', ring: '#fff3e0', ring2: '#3e2723', dot: '#ffb300', leaf: '#3e2723', seed: 21 },
    wrap: ['#3e2723', '#ffb300', '#fff3e0'],
    slipper: '#8e24aa',
  },
};

const deg = (d) => (d * Math.PI) / 180;

export function makePuppet(look = LOOKS.akosua, { basin = false } = {}) {
  const c = document.createElement('canvas');
  c.width = CW;
  c.height = CH;
  const g = c.getContext('2d');
  const dressPat = g.createPattern(waxPrintCanvas({ ...look.dress, size: 256 }), 'repeat');
  dressPat.setTransform(new DOMMatrix().scale(0.11, -0.11));
  const wrapPat = g.createPattern(kenteCanvas(look.wrap, 96), 'repeat');
  wrapPat.setTransform(new DOMMatrix().scale(0.09, -0.09));

  // ---- drawing helpers (all in cm, y up)
  const outline = () => {
    g.lineWidth = LINE;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  };
  const ellipse = (x, y, rx, ry, rot = 0) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  };
  const poly = (pts) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  };
  const curve = (pts) => {
    // smooth closed shape through points via quadratic midpoints
    g.beginPath();
    const n = pts.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let m = mid(pts[n - 1], pts[0]);
    g.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) {
      const nm = mid(pts[i], pts[(i + 1) % n]);
      g.quadraticCurveTo(pts[i][0], pts[i][1], nm[0], nm[1]);
    }
    g.closePath();
  };
  const shade = (alpha = 0.18) => {
    g.fillStyle = `rgba(40,15,5,${alpha})`;
    g.fill();
  };

  function arm(side, { shoulder = 8, elbow = 10, item = null }, sleeveY) {
    // side: +1 = screen-right (her left arm), -1 = screen-left
    const s = side;
    g.save();
    g.translate(s * 20, sleeveY);
    g.rotate(s * deg(shoulder)); // positive raises the arm outward
    // upper arm
    g.fillStyle = look.skin;
    curve([[-5.6, 1], [5.6, 1], [4.6, -23], [-4.6, -23]]);
    g.fill();
    outline();
    // elbow -> forearm
    g.translate(0, -22);
    g.rotate(s * deg(-elbow)); // bend forearm toward the front/inside
    g.fillStyle = look.skin;
    curve([[-4.8, 1.5], [4.8, 1.5], [3.8, -21], [-3.8, -21]]);
    g.fill();
    outline();
    // hand (mitten with thumb)
    g.translate(0, -20.5);
    g.fillStyle = look.skin;
    curve([[-4.6, 0.5], [4.6, 0.5], [5.2, -6], [2.4, -11], [-2.8, -11], [-5.2, -6]]);
    g.fill();
    outline();
    ellipse(-s * 4.2, -3.5, 1.6, 3.2, s * 0.5);
    g.fillStyle = look.skin;
    g.fill();
    outline();
    if (item === 'sachet') {
      g.save();
      g.translate(0, -9);
      g.rotate(s * 0.5);
      g.fillStyle = 'rgba(230,244,255,0.95)';
      ellipse(0, -6, 5.5, 9.5);
      g.fill();
      outline();
      g.fillStyle = '#2a7de1';
      ellipse(0, -6, 2.8, 4.5);
      g.fill();
      g.restore();
    }
    g.restore();
  }

  function head(face, yaw, pitch, roll) {
    g.save();
    g.translate(0, 150); // base of neck
    g.rotate(-roll * 0.6);
    // neck
    g.fillStyle = look.skin;
    poly([[-4.5, -2], [4.5, -2], [4.5, 8], [-4.5, 8]]);
    g.fill();
    ellipse(0, 7, 5.2, 2.2);
    g.fillStyle = look.skinShade;
    g.fill();
    // face shape: broad forehead, soft jaw (origin at the chin)
    g.translate(yaw * 1.5, 3 + pitch * 1.2);
    g.scale(1.22, 1.22);
    const fx = yaw * 2.2;
    const fy = -pitch * 1.5;
    g.fillStyle = look.skin;
    curve([[-11.5, 2], [11.5, 2], [12.5, 12], [11, 20], [0, 24.5], [-11, 20], [-12.5, 12]]);
    g.fill();
    outline();
    // ears + earrings
    for (const s of [-1, 1]) {
      const ex = s * 12.2 - yaw * 0.6 * s;
      ellipse(ex, 11, 2.2, 3.4);
      g.fillStyle = look.skin;
      g.fill();
      outline();
      g.beginPath();
      g.arc(ex, 7.2, 1.6, 0, Math.PI * 2);
      g.strokeStyle = '#e0b030';
      g.lineWidth = 0.8;
      g.stroke();
    }
    // cheeks
    g.fillStyle = look.blush;
    ellipse(-7 + fx, 8 + fy, 3.2, 2.2);
    g.fill();
    ellipse(7 + fx, 8 + fy, 3.2, 2.2);
    g.fill();
    // eyes
    const lid = Math.max(0.05, face.lid);
    for (const s of [-1, 1]) {
      const ex = s * 5.2 + fx;
      const ey = 12 + fy;
      g.save();
      // almond eye white, clipped by lid openness
      g.beginPath();
      g.ellipse(ex, ey, 3.3, 2.4 * lid, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#fbf7f0';
      g.fillRect(ex - 4, ey - 3, 8, 6);
      // iris + pupil
      const ix = ex + face.look[0] * 1.2;
      const iy = ey + face.look[1] * 0.8;
      g.fillStyle = '#4a2a14';
      ellipse(ix, iy, 1.9, 2.0);
      g.fill();
      g.fillStyle = '#120804';
      ellipse(ix, iy, 1.0, 1.1);
      g.fill();
      g.fillStyle = '#fff';
      ellipse(ix + 0.6, iy + 0.7, 0.45, 0.45);
      g.fill();
      g.restore();
      // eye outline + lash line
      g.beginPath();
      g.ellipse(ex, ey, 3.3, 2.4 * lid, 0, 0, Math.PI * 2);
      g.lineWidth = 0.8;
      g.strokeStyle = INK;
      g.stroke();
      g.beginPath();
      g.ellipse(ex, ey, 3.4, 2.4 * lid, 0, Math.PI, Math.PI * 2);
      g.lineWidth = 1.4;
      g.stroke();
      // brow
      const b = face.brow;
      g.beginPath();
      g.moveTo(ex - 3.6, ey + 4.2 + b * 0.6 - s * b * 0.3);
      g.quadraticCurveTo(ex, ey + 6.4 + b * 1.4, ex + 3.6, ey + 4.2 + b * 0.6 + s * b * 0.3);
      g.lineWidth = 1.5;
      g.strokeStyle = INK;
      g.stroke();
    }
    // nose: broad bridge, rounded nostrils
    g.beginPath();
    g.moveTo(fx - 1.2, 11 + fy);
    g.quadraticCurveTo(fx - 3.2, 6 + fy, fx - 1.4, 5.2 + fy);
    g.quadraticCurveTo(fx, 4.6 + fy, fx + 1.4, 5.2 + fy);
    g.quadraticCurveTo(fx + 3.2, 6 + fy, fx + 1.2, 11 + fy);
    g.lineWidth = 0.9;
    g.strokeStyle = INK;
    g.stroke();
    ellipse(fx - 2.2, 5.4 + fy, 0.8, 0.55);
    g.fillStyle = look.skinShade;
    g.fill();
    ellipse(fx + 2.2, 5.4 + fy, 0.8, 0.55);
    g.fill();
    // mouth: lips + opening driven by the voice
    const m = face.mouth;
    const sm = face.smile;
    const my = 1.2 + fy;
    const w = 4.6 + sm * 0.8 - m * 0.6;
    g.fillStyle = '#3a0d0d';
    curve([[fx - w, my], [fx, my + 0.8 + sm * 0.4], [fx + w, my], [fx + w * 0.8, my - 1.0 - m * 5.5], [fx, my - 1.4 - m * 7], [fx - w * 0.8, my - 1.0 - m * 5.5]]);
    g.fill();
    if (m > 0.12) {
      g.save();
      g.clip();
      g.fillStyle = '#fff';
      g.fillRect(fx - w, my - 0.3, 2 * w, 1.6);
      g.fillStyle = '#b2423a';
      ellipse(fx, my - 1.6 - m * 7, w * 0.6, 2.2);
      g.fill();
      g.restore();
    }
    // lips
    g.fillStyle = look.lip;
    curve([[fx - w, my], [fx - w * 0.5, my + 1.6], [fx, my + 1.2], [fx + w * 0.5, my + 1.6], [fx + w, my], [fx, my + 0.5]]);
    g.fill();
    curve([[fx - w, my], [fx, my - 0.9 - sm * 0.4], [fx + w, my], [fx, my - 2.0]]);
    g.fill();
    g.beginPath();
    g.moveTo(fx - w, my);
    g.quadraticCurveTo(fx, my + 0.6 + sm * 0.5, fx + w, my);
    g.lineWidth = 0.9;
    g.strokeStyle = INK;
    g.stroke();
    // headwrap (duku): wide band + folded dome + knot on top
    // tall folded duku with a big knot at the front-top
    g.fillStyle = wrapPat;
    curve([[-13.8, 16.5], [13.8, 16.5], [16, 24], [15, 34], [9, 42], [0, 45], [-9, 42], [-15, 34], [-16, 24]]);
    g.fill();
    outline();
    g.beginPath();
    g.moveTo(-13.2, 20.5);
    g.quadraticCurveTo(0, 14.5, 13.2, 20.5);
    g.lineWidth = LINE;
    g.strokeStyle = INK;
    g.stroke();
    g.beginPath();
    g.moveTo(-14, 28);
    g.quadraticCurveTo(-2, 24, 10, 31);
    g.lineWidth = 0.8;
    g.stroke();
    g.fillStyle = wrapPat;
    curve([[-2, 40], [8, 41], [15, 47], [10, 52], [1, 51], [-5, 46]]);
    g.fill();
    outline();
    curve([[-3, 42], [-11, 45], [-14, 50], [-8, 51], [-2, 47]]);
    g.fill();
    outline();
    if (basin) {
      g.fillStyle = '#b8c0c8';
      poly([[-19, 44], [19, 44], [15, 34], [-15, 34]]);
      g.fill();
      outline();
      g.fillStyle = '#e8a33c';
      ellipse(0, 45, 17, 4);
      g.fill();
      outline();
    }
    g.restore();
  }

  function draw(pose = {}, face = {}) {
    const P = { armL: { shoulder: 8, elbow: 12 }, armR: { shoulder: 8, elbow: 12 }, yaw: 0, pitch: 0, roll: 0, lean: 0, bob: 0, ...pose };
    const F = { mouth: 0, lid: 1, brow: 0, smile: 0.4, look: [0, 0], ...face };
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, CW, CH);
    // cm space, y up, feet at bottom centre
    g.setTransform(PX, 0, 0, -PX, CW / 2, CH - 8);
    g.rotate(-P.lean);
    g.translate(0, P.bob);

    // slippers
    for (const s of [-1, 1]) {
      ellipse(s * 7, 2.5, 7, 2.6);
      g.fillStyle = look.slipper;
      g.fill();
      outline();
    }
    // skirt (long wrap), with a shaded fold
    g.fillStyle = dressPat;
    curve([[-17, 10], [17, 10], [15.5, 50], [14, 92], [-14, 92], [-15.5, 50]]);
    g.fill();
    outline();
    g.beginPath();
    g.moveTo(5, 92);
    g.quadraticCurveTo(10, 50, 3, 10);
    g.lineTo(17, 10);
    g.lineTo(14, 92);
    g.closePath();
    shade(0.12);
    // back arm (her right / screen-left) behind the torso
    arm(-1, P.armR, 134);
    // kaba top with peplum
    g.fillStyle = dressPat;
    curve([[-19, 92], [19, 92], [18, 100], [15.5, 120], [20, 138], [8, 146], [-8, 146], [-20, 138], [-15.5, 120], [-18, 100]]);
    g.fill();
    outline();
    // neckline
    g.fillStyle = look.skin;
    curve([[-7, 146.5], [7, 146.5], [5, 141], [0, 139], [-5, 141]]);
    g.fill();
    // puff sleeves
    for (const s of [-1, 1]) {
      g.fillStyle = dressPat;
      curve([[s * 14, 142], [s * 23, 141], [s * 26, 133], [s * 22, 126], [s * 15, 128]]);
      g.fill();
      outline();
    }
    head(F, P.yaw, P.pitch, P.roll);
    // front arm (her left / screen-right)
    arm(1, P.armL, 134);
    tex.needsUpdate = true;
  }

  // ---- billboard in the 3D scene
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const H = 1.9; // metres, matches the 190 cm canvas
  const geo = new THREE.PlaneGeometry(H * (CW / CH), H);
  geo.translate(0, H / 2, 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  const root = new THREE.Group();
  root.add(mesh);

  /** Keep the plane facing the camera around the vertical axis only. */
  function face(camera) {
    const p = new THREE.Vector3();
    root.getWorldPosition(p);
    mesh.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
  }

  draw();
  return { root, mesh, draw, face, canvas: c };
}
