import * as THREE from 'three';
import { waxPrint, kente, skin } from './textures.js';

const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, ...o });

function lathe(profile, material, segs = 32) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  const m = new THREE.Mesh(g, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function mesh(geo, material) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export const OUTFITS = {
  akosua: {
    dress: { bg: '#f2a516', ring: '#1d4fa3', ring2: '#f7e7c3', dot: '#c2185b', leaf: '#2e7d32', seed: 4 },
    wrap: ['#c2185b', '#f2a516', '#1d4fa3', '#2e7d32', '#111'],
    skin: '#6a3a20',
  },
  esi: {
    dress: { bg: '#7b1fa2', ring: '#ffca28', ring2: '#4a148c', dot: '#ffffff', leaf: '#26a69a', seed: 8 },
    wrap: ['#26a69a', '#ffca28', '#4a148c', '#fff'],
    skin: '#5a301a',
  },
  porter: {
    dress: { bg: '#00897b', ring: '#ffeb3b', ring2: '#004d40', dot: '#e65100', leaf: '#fff', seed: 12 },
    wrap: ['#e65100', '#ffeb3b', '#004d40'],
    skin: '#4e2a16',
  },
  walker: {
    dress: { bg: '#d84315', ring: '#fff3e0', ring2: '#3e2723', dot: '#ffb300', leaf: '#3e2723', seed: 21 },
    wrap: ['#3e2723', '#ffb300', '#fff3e0'],
    skin: '#6e3d22',
  },
};

/**
 * Build a stylized woman. Returns { root, rig } where rig exposes joints and
 * setters used by the shot scripts.
 */
export function makeWoman(outfit = OUTFITS.akosua, { basin = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // sways/breathes
  root.add(body);

  const fabric = mat({ map: waxPrint(outfit.dress, [3, 2]) });
  const fabricTop = mat({ map: waxPrint(outfit.dress, [2, 1.5]) });
  const skinM = mat({ map: skin(outfit.skin), roughness: 0.55 });
  const dark = mat({ color: '#1a0d08', roughness: 0.4 });

  // Long wrap skirt, flaring slightly at the hem.
  body.add(lathe([[0.001, 0.06], [0.3, 0.06], [0.29, 0.25], [0.25, 0.6], [0.2, 0.9], [0.001, 0.92]], fabric));
  // Top (kaba) with a peplum flare at the waist.
  const torso = new THREE.Group();
  torso.position.y = 0.86;
  body.add(torso);
  torso.add(lathe([[0.001, 0], [0.25, 0.02], [0.2, 0.12], [0.215, 0.3], [0.22, 0.38], [0.17, 0.47], [0.07, 0.5], [0.001, 0.5]], fabricTop));
  // Neck
  const neck = mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.14, 16), skinM);
  neck.position.y = 0.53;
  torso.add(neck);

  // Feet in slippers
  for (const s of [-1, 1]) {
    const foot = mesh(new THREE.SphereGeometry(0.06, 16, 8), mat({ color: '#1e88e5' }));
    foot.scale.set(0.9, 0.45, 1.7);
    foot.position.set(s * 0.1, 0.03, 0.1);
    foot.name = s < 0 ? 'footR' : 'footL';
    root.add(foot);
  }

  // ---- head
  const head = new THREE.Group();
  head.position.y = 0.73;
  torso.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.17, 40, 30), skinM);
  skull.scale.set(0.95, 1.08, 0.97);
  head.add(skull);
  // ears + gold earrings
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.035, 12, 10), skinM);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(s * 0.158, -0.01, 0);
    head.add(ear);
    const ring = mesh(new THREE.TorusGeometry(0.018, 0.005, 8, 20), mat({ color: '#e0b030', metalness: 0.8, roughness: 0.3 }));
    ring.position.set(s * 0.165, -0.06, 0.005);
    head.add(ring);
  }
  // nose
  const nose = mesh(new THREE.SphereGeometry(0.032, 16, 12), skinM);
  nose.scale.set(1.25, 0.85, 0.9);
  nose.position.set(0, -0.025, 0.165);
  head.add(nose);
  // eyes
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.062, 0.025, 0.142);
    const white = mesh(new THREE.SphereGeometry(0.033, 20, 16), mat({ color: '#f5f1ea', roughness: 0.3 }));
    white.scale.set(1, 1.1, 0.6);
    eye.add(white);
    const pupil = mesh(new THREE.SphereGeometry(0.019, 16, 12), dark);
    pupil.position.z = 0.016;
    pupil.scale.z = 0.6;
    eye.add(pupil);
    const glint = mesh(new THREE.SphereGeometry(0.005, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' }));
    glint.position.set(0.007, 0.008, 0.028);
    eye.add(glint);
    head.add(eye);
    eyes.push({ eye, pupil });
    const brow = mesh(new THREE.CapsuleGeometry(0.008, 0.045, 4, 8), dark);
    brow.rotation.z = Math.PI / 2;
    brow.position.set(s * 0.064, 0.085, 0.152);
    brow.name = s < 0 ? 'browR' : 'browL';
    head.add(brow);
  }
  // mouth: dark interior + lips that open with the voice
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.085, 0.152);
  mouth.rotation.x = -0.15;
  head.add(mouth);
  const inside = mesh(new THREE.SphereGeometry(0.03, 20, 12), mat({ color: '#3a0d0d', roughness: 0.6 }));
  inside.scale.set(1.2, 0.25, 0.4);
  mouth.add(inside);
  const lipM = mat({ color: '#5a2418', roughness: 0.45 });
  const upper = mesh(new THREE.CapsuleGeometry(0.009, 0.045, 4, 8), lipM);
  upper.rotation.z = Math.PI / 2;
  upper.position.y = 0.006;
  const lower = upper.clone();
  lower.position.y = -0.006;
  mouth.add(upper, lower);

  // headwrap (duku): dome + knot
  const wrapM = mat({ map: kente(outfit.wrap, [3, 2]) });
  const dome = mesh(new THREE.SphereGeometry(0.19, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), wrapM);
  dome.scale.set(1.0, 1.25, 1.05);
  dome.position.set(0, 0.04, -0.02);
  dome.rotation.x = -0.25;
  head.add(dome);
  const knot = mesh(new THREE.TorusKnotGeometry(0.06, 0.025, 48, 8, 2, 3), wrapM);
  knot.position.set(0, 0.24, 0.02);
  knot.rotation.x = 1.2;
  head.add(knot);

  if (basin) {
    const b = mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.14, 32, 1, true), mat({ color: '#b0b8bf', metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }));
    b.position.y = 0.33;
    head.add(b);
    const goods = mesh(new THREE.SphereGeometry(0.28, 16, 10), mat({ color: '#e8a33c' }));
    goods.scale.set(1, 0.35, 1);
    goods.position.y = 0.38;
    head.add(goods);
  }

  // ---- arms: shoulder -> elbow -> hand, hanging along -y
  const sleeveM = fabricTop;
  const arms = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.215, 0.42, 0);
    torso.add(shoulder);
    const puff = mesh(new THREE.SphereGeometry(0.075, 16, 12), sleeveM);
    puff.scale.set(1, 1.15, 1);
    puff.position.y = -0.04;
    shoulder.add(puff);
    const upperArm = mesh(new THREE.CapsuleGeometry(0.048, 0.2, 6, 12), skinM);
    upperArm.position.y = -0.15;
    shoulder.add(upperArm);
    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    shoulder.add(elbow);
    const fore = mesh(new THREE.CapsuleGeometry(0.042, 0.19, 6, 12), skinM);
    fore.position.y = -0.11;
    elbow.add(fore);
    const hand = new THREE.Group();
    hand.position.y = -0.24;
    elbow.add(hand);
    const palm = mesh(new THREE.SphereGeometry(0.05, 16, 12), skinM);
    palm.scale.set(0.8, 1.1, 0.55);
    hand.add(palm);
    const thumb = mesh(new THREE.CapsuleGeometry(0.014, 0.03, 4, 8), skinM);
    thumb.position.set(-s * 0.035, 0.0, 0.02);
    thumb.rotation.z = -s * 0.6;
    hand.add(thumb);
    arms[side] = { shoulder, elbow, hand };
  }

  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  const rig = {
    body, torso, head, eyes, mouth, arms,
    browL: head.getObjectByName('browL'),
    browR: head.getObjectByName('browR'),
    footL: root.getObjectByName('footL'),
    footR: root.getObjectByName('footR'),
    /** Pose an arm: raise = sideways (rad), swing = forward (rad), bend = elbow (rad). */
    arm(side, { raise = 0.12, swing = 0.05, bend = 0.15, twist = 0 } = {}) {
      const a = arms[side];
      const s = side === 'L' ? 1 : -1;
      a.shoulder.rotation.set(-swing, twist, s * raise, 'XZY');
      a.elbow.rotation.set(-bend, 0, 0);
    },
    /** Face state: mouth 0..1 open, lid 0..1 open, brow -1 (frown)..1 (raised), look [x, y]. */
    face({ mouth: m = 0, lid = 1, brow = 0, look = [0, 0], smile = 0.3 } = {}) {
      mouth.scale.set(1 + smile * 0.25 - m * 0.15, 1, 1);
      inside.scale.y = 0.25 + m * 1.1;
      upper.position.y = 0.006 + m * 0.012;
      lower.position.y = -0.006 - m * 0.016;
      for (const { eye, pupil } of eyes) {
        eye.scale.y = Math.max(0.08, lid);
        pupil.position.x = look[0] * 0.012;
        pupil.position.y = look[1] * 0.01;
      }
      for (const [b, s] of [[rig.browL, 1], [rig.browR, -1]]) {
        b.position.y = 0.085 + brow * 0.015;
        b.rotation.z = Math.PI / 2 + s * brow * 0.25;
      }
    },
    /** Idle life: breathing + gentle sway, phase-shifted per character. */
    idle(t, phase = 0) {
      const b = Math.sin((t + phase) * 2.1);
      torso.scale.set(1 + b * 0.008, 1 + b * 0.012, 1 + b * 0.008);
      body.rotation.z = Math.sin((t + phase) * 0.7) * 0.015;
    },
  };
  rig.arm('L');
  rig.arm('R');
  rig.face();
  return { root, rig };
}

/** Simple walk cycle for background pedestrians. */
export function walk(rig, root, t, speed = 1.1, phase = 0) {
  const p = (t + phase) * speed * Math.PI * 2 * 0.9;
  root.position.y = Math.abs(Math.sin(p)) * 0.03;
  rig.footL.position.z = 0.1 + Math.sin(p) * 0.14;
  rig.footR.position.z = 0.1 - Math.sin(p) * 0.14;
  rig.body.rotation.y = Math.sin(p) * 0.06;
  rig.arm('L', { raise: 0.12, swing: -Math.sin(p) * 0.35, bend: 0.25 });
  rig.arm('R', { raise: 0.12, swing: Math.sin(p) * 0.35, bend: 0.25 });
}
