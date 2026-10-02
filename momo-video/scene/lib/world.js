import * as THREE from 'three';
import { laterite, asphalt, wall, signboard, corrugated } from './textures.js';
import { rng } from './anim.js';

const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });

function mesh(geo, material, cast = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

export const PALETTES = {
  dawn: { zenith: '#5d8fd1', horizon: '#ffc59a', sun: '#ffd2a0', sunI: 2.6, hemiSky: '#ffe2c4', hemiGround: '#7a3a1e', hemiI: 1.0, fog: '#f3c6a2', sunPos: [28, 11, 14] },
  evening: { zenith: '#2a2350', horizon: '#e0785a', sun: '#ff9a5a', sunI: 1.4, hemiSky: '#9b8fc4', hemiGround: '#40201a', hemiI: 0.6, fog: '#9a6a78', sunPos: [-28, 5, 10] },
};

function skyDome(p) {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(p.zenith) },
      horizon: { value: new THREE.Color(p.horizon) },
      sunDir: { value: new THREE.Vector3(...p.sunPos).normalize() },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, zenith, pow(h, 0.55));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.75, 0.45) * pow(s, 24.0) * 0.6 + vec3(1.0,0.95,0.85) * pow(s, 800.0) * 2.0;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, m);
}

function shop({ x, w, color, sign, sub, z = -4.2, depth = 3.2, h = 3.0 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z - depth / 2);
  const walls = mesh(new THREE.BoxGeometry(w, h, depth), mat({ map: wall(color) }));
  walls.position.y = h / 2;
  g.add(walls);
  // dark open doorway
  const door = mesh(new THREE.PlaneGeometry(w * 0.45, 2.1), mat({ color: '#2a1a12' }), false);
  door.position.set(-w * 0.15, 1.05, depth / 2 + 0.01);
  g.add(door);
  const win = mesh(new THREE.PlaneGeometry(w * 0.25, 0.9), mat({ color: '#203040', roughness: 0.3 }), false);
  win.position.set(w * 0.28, 1.5, depth / 2 + 0.01);
  g.add(win);
  // signboard
  const board = mesh(new THREE.BoxGeometry(w * 0.92, 0.62, 0.06), mat({ map: signboard(sign, sub) }));
  board.position.set(0, h + 0.25, depth / 2 + 0.05);
  g.add(board);
  // sloped corrugated awning
  const awn = mesh(new THREE.BoxGeometry(w + 0.2, 0.04, 1.6), mat({ map: corrugated([w, 1]), metalness: 0.3, roughness: 0.6 }));
  awn.position.set(0, h - 0.35, depth / 2 + 0.75);
  awn.rotation.x = 0.22;
  g.add(awn);
  for (const s of [-1, 1]) {
    const post = mesh(new THREE.CylinderGeometry(0.04, 0.04, h - 0.4, 6), mat({ color: '#6d4c41' }));
    post.position.set(s * (w / 2 - 0.1), (h - 0.4) / 2, depth / 2 + 1.45);
    g.add(post);
  }
  return g;
}

function mangoTree(x, z, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  const bark = mat({ color: '#5b3a24' });
  const trunk = mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.6, 10), bark);
  trunk.position.y = 1.3;
  g.add(trunk);
  const leaf = mat({ color: '#2f6b2a', flatShading: true });
  const r = rng(Math.round(x * 13 + z * 7));
  for (let i = 0; i < 9; i++) {
    const c = mesh(new THREE.IcosahedronGeometry(1 + r() * 0.6, 1), leaf);
    c.position.set((r() - 0.5) * 2.6, 3.0 + r() * 1.4, (r() - 0.5) * 2.6);
    c.material = leaf.clone();
    c.material.color.offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.08);
    g.add(c);
  }
  return g;
}

function palm(x, z, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  const bark = mat({ color: '#7a6248' });
  let y = 0;
  let lean = 0;
  for (let i = 0; i < 7; i++) {
    const seg = mesh(new THREE.CylinderGeometry(0.15, 0.18, 1.1, 8), bark);
    lean += 0.03;
    seg.position.set(lean * i * 0.6, y + 0.55, 0);
    seg.rotation.z = -lean;
    g.add(seg);
    y += 1.05;
  }
  const top = new THREE.Group();
  top.position.set(lean * 4.2, y, 0);
  g.add(top);
  const frondM = mat({ color: '#3d7a2c', side: THREE.DoubleSide, flatShading: true });
  for (let i = 0; i < 10; i++) {
    const f = mesh(new THREE.ConeGeometry(0.35, 2.8, 4, 1), frondM);
    f.scale.z = 0.15;
    f.geometry.translate(0, 1.4, 0);
    f.rotation.set(0, (i / 10) * Math.PI * 2, 1.15 + (i % 2) * 0.25, 'YZX');
    top.add(f);
  }
  return g;
}

export function makeWorld(scene, palette = PALETTES.dawn) {
  const p = palette;
  scene.background = new THREE.Color(p.horizon);
  scene.fog = new THREE.Fog(p.fog, 35, 140);
  scene.add(skyDome(p));

  const hemi = new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiI);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(p.sun, p.sunI);
  sun.position.set(...p.sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 90 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const ground = mesh(new THREE.PlaneGeometry(300, 300), mat({ map: laterite() }), false);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const road = mesh(new THREE.PlaneGeometry(300, 6.5), mat({ map: asphalt([45, 1]), roughness: 0.9 }), false);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.012, 7.6);
  scene.add(road);
  const gutter = mesh(new THREE.BoxGeometry(300, 0.12, 0.45), mat({ color: '#8f8a80' }));
  gutter.position.set(0, 0.0, 4.15);
  scene.add(gutter);

  const shops = [
    { x: -9.5, w: 4.2, color: '#4fb3e8', sign: 'SEE ME AGAIN', sub: 'Provisions Store' },
    { x: -5.0, w: 4.0, color: '#f3a6c4', sign: 'BLESSED HANDS', sub: 'Hair Salon' },
    { x: -0.6, w: 4.2, color: '#f2cf7a', sign: 'GOD IS KING', sub: 'Phone Accessories' },
    { x: 3.8, w: 4.0, color: '#a8d672', sign: 'AUNTIE ESI', sub: 'Kenkey & Fish' },
    { x: 8.4, w: 4.4, color: '#c9a3df', sign: 'PSALM 23', sub: 'Chop Bar' },
    { x: 13.0, w: 4.2, color: '#ffb08a', sign: 'FAITH TAILORING', sub: 'Kaba & Slit' },
  ];
  shops.forEach((s) => scene.add(shop(s)));

  scene.add(mangoTree(-3.3, -0.4, 1.0));
  scene.add(mangoTree(17.5, -2.0, 1.2));
  [[-13, -9, 1.1], [-2, -10, 1.0], [6, -11, 1.25], [11, -9.5, 0.95], [21, -8, 1.1], [-20, -6, 1.0]].forEach(([x, z, s]) => scene.add(palm(x, z, s)));

  // Electricity poles + sagging wires along the near side of the road
  const poleM = mat({ color: '#6b5a4a' });
  const poles = [-22, -10, 8, 20];
  poles.forEach((x) => {
    const pl = mesh(new THREE.CylinderGeometry(0.09, 0.12, 8, 8), poleM);
    pl.position.set(x + 2, 4, 4.6);
    scene.add(pl);
    const arm = mesh(new THREE.BoxGeometry(0.1, 0.1, 1.4), poleM);
    arm.position.set(x + 2, 7.6, 4.6);
    scene.add(arm);
  });
  const wireM = new THREE.LineBasicMaterial({ color: '#2a2a2a' });
  for (const dz of [-0.6, 0, 0.6])
    for (let i = 0; i < poles.length - 1; i++) {
      const pts = [];
      for (let k = 0; k <= 20; k++) {
        const u = k / 20;
        pts.push(new THREE.Vector3(poles[i] + 2 + u * 12, 7.65 - Math.sin(u * Math.PI) * 0.45, 4.6 + dz));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
    }

  // Distant town silhouettes
  const r = rng(77);
  const far = ['#d9a98a', '#e8c39e', '#c79b86', '#e2b6a0', '#bfa1a4'];
  for (let i = 0; i < 70; i++) {
    const w = 3 + r() * 6;
    const h = 3 + r() * 9;
    const b = mesh(new THREE.BoxGeometry(w, h, 4 + r() * 4), mat({ color: far[i % far.length] }), false);
    const side = r() < 0.75 ? -1 : 1;
    b.position.set(-90 + r() * 180, h / 2, side < 0 ? -22 - r() * 50 : 24 + r() * 40);
    scene.add(b);
  }
  return { sun, hemi };
}
