// SCENE 1 — Morning in Kumasi. Ends on the phone ringing and the "Step 1 — Contact" card.
import * as THREE from 'three';
import { makeWorld, PALETTES } from '../lib/world.js';
import { makeWoman, OUTFITS, walk } from '../lib/character.js';
import { makeStall, makePhone, makeTrotro } from '../lib/props.js';
import { track, span, blink, clamp, easeOut } from '../lib/anim.js';

export function build(scene, timeline) {
  const C = timeline.cues;
  makeWorld(scene, PALETTES.dawn);

  const stall = makeStall();
  scene.add(stall);

  const ak = makeWoman(OUTFITS.akosua);
  ak.root.position.set(0.1, 0, -0.68);
  scene.add(ak.root);

  // Sachet she lifts while calling out
  const held = new THREE.Mesh(
    new THREE.SphereGeometry(1, 14, 8).scale(0.085, 0.02, 0.06),
    new THREE.MeshStandardMaterial({ color: '#e8f4ff', roughness: 0.15, transparent: true, opacity: 0.9 })
  );
  held.rotation.z = Math.PI / 2;
  held.position.set(0, -0.06, 0.03);
  ak.rig.arms.R.hand.add(held);

  const phone = makePhone();
  phone.group.position.set(0.3, 0.812, 0.1);
  phone.group.rotation.y = 0.08;
  scene.add(phone.group);

  const esi = makeWoman(OUTFITS.esi);
  esi.root.position.set(3.2, 0, -2.2);
  esi.root.rotation.y = -0.5;
  scene.add(esi.root);

  const porter = makeWoman(OUTFITS.porter, { basin: true });
  porter.root.rotation.y = Math.PI / 2;
  scene.add(porter.root);
  const walker = makeWoman(OUTFITS.walker);
  walker.root.rotation.y = -Math.PI / 2;
  scene.add(walker.root);

  const bus = makeTrotro();
  bus.group.position.z = 9.2;
  scene.add(bus.group);

  // ---- Akosua's performance
  const headYaw = track([[0, -0.2], [3, 0.25], [6, -0.1], [7.3, 0.35], [10.2, 0.3], [11, 0.0], [C.ring.start + 0.4, 0.0], [C.ring.start + 1.0, 0.5]]);
  const headPitch = track([[0, 0.25], [7.2, 0.25], [7.6, -0.08], [10.2, -0.05], [11, 0.15], [C.ring.start + 0.4, 0.15], [C.ring.start + 1.0, 0.38]]);
  const lift = (t) => span(t, C.a1.start - 0.4, C.a1.start + 0.1) * (1 - span(t, C.a1.end + 0.2, C.a1.end + 0.8));
  const reach = (t) => span(t, C.ring.start + 1.4, C.ring.end + 0.3);

  // ---- camera: list of shots, each a function of t
  const shots = [
    { until: 7.25, fov: 40, pos: track([[0, [16, 10, 24]], [7.25, [4.6, 2.5, 10.5]]]), at: track([[0, [0, 2.2, -3]], [7.25, [0.1, 1.3, -0.4]]]) },
    { until: 10.55, fov: 34, pos: track([[7.25, [1.0, 1.6, 2.0]], [10.55, [0.8, 1.58, 1.62]]]), at: () => [0.08, 1.48, -0.62] },
    { until: 13.4, fov: 36, pos: track([[10.55, [1.0, 1.45, 1.25]], [13.4, [0.75, 1.3, 0.95]]]), at: track([[10.55, [0.1, 1.0, -0.2]], [13.4, [0.3, 0.86, 0.05]]]) },
    { until: C.ring.start + 1.8, fov: 30, pos: track([[13.4, [0.32, 1.22, 0.42]], [C.ring.start, [0.31, 1.08, 0.3]], [C.ring.start + 1.8, [0.31, 1.03, 0.27]]]), at: () => [0.3, 0.81, 0.095] },
    { until: 999, fov: 36, pos: track([[C.ring.start + 1.8, [-0.75, 1.45, 1.55]], [C.title.start, [-0.6, 1.42, 1.3]]]), at: () => [0.15, 1.2, -0.45] },
  ];

  function update(t, frame, camera, overlay, glCanvas, renderer) {
    // characters
    ak.rig.idle(t);
    esi.rig.idle(t, 1.3);
    esi.rig.arm('R', { raise: 0.2, swing: 0.5 + Math.sin(t * 1.5) * 0.15, bend: 1.4 });
    esi.rig.face({ lid: blink(t, 1.1), smile: 0.5 });
    ak.rig.head.rotation.set(headPitch(t), headYaw(t), 0);

    const L = lift(t);
    const R = reach(t);
    // arranging sachets (pre-call), lifting a sachet to wave (a1), reaching for phone (ring)
    const arrange = (1 - L) * (1 - R) * Math.sin(t * 2.2);
    ak.rig.arm('R', {
      raise: 0.15 + L * 2.35 + R * 0.25,
      swing: 0.55 + arrange * 0.25 - L * 0.2 + R * 0.4,
      bend: 1.0 - L * 0.4 + Math.sin(t * 9) * 0.35 * L - R * 0.4,
    });
    ak.rig.arm('L', { raise: 0.15, swing: 0.5 + Math.sin(t * 2.2 + 1.5) * 0.18 * (1 - L), bend: 1.1 });
    held.visible = L > 0.05;
    const frameIdx = Math.round(t * timeline.fps);
    const m = timeline.mouth[frameIdx] || 0;
    const surprised = span(t, C.ring.start + 0.6, C.ring.start + 1.2);
    ak.rig.face({
      mouth: m,
      lid: blink(t),
      smile: 0.35 + L * 0.4 - surprised * 0.3,
      brow: L * 0.6 + surprised * 0.8,
      look: [surprised * 0.6, -surprised * 0.8],
    });

    // pedestrians
    porter.root.position.set(-13 + t * 0.85, 0, 3.4);
    walk(porter.rig, porter.root, t, 1.0);
    walker.root.position.set(9 - t * 0.95, 0, 2.6);
    walk(walker.rig, walker.root, t, 1.1, 0.4);

    // tro-tro
    const bp = clamp((t - C.trotro.start) / (C.trotro.end - C.trotro.start));
    bus.group.position.x = -38 + bp * 76;
    bus.group.position.y = Math.sin(t * 13) * 0.02;
    bus.group.rotation.x = Math.sin(t * 7) * 0.006;
    bus.wheels.forEach((w) => (w.rotation.y = t * 30));

    // phone
    const ringing = t >= C.ring.start && t < C.title.start;
    phone.draw(ringing ? 'call' : t > 10.4 ? 'wallet' : 'off', t);
    if (ringing) {
      const buzz = Math.sin(t * 2 * Math.PI / 0.9) > 0 ? 1 : 0;
      phone.group.position.x = 0.3 + Math.sin(t * 160) * 0.0025 * buzz;
      phone.group.rotation.y = 0.08 + Math.sin(t * 130) * 0.02 * buzz;
    }

    // camera
    const shot = shots.find((s) => t < s.until);
    camera.fov = shot.fov;
    camera.position.set(...shot.pos(t));
    camera.lookAt(new THREE.Vector3(...shot.at(t)));
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);

    // 2D overlay
    overlay.begin(glCanvas);
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
