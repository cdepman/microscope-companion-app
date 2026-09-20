// Procedural model of a Nikon Labophot 1 (binocular, 5-place nosepiece,
// Abbe condenser, add-on gooseneck lights). Units are centimetres, Y up,
// +Z toward the viewer. The optical axis is x=0, z=AXIS_Z.
// Every selectable part is a THREE.Group with userData.partId set; meshes
// inside inherit it via userData.partId so raycasting can resolve the part.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const AXIS_Z = 3.5;      // optical axis z
const STAGE_Y = 15.0;    // stage top surface
const NOSE_Y = 25.4;     // turret centre
const ARM_BOTTOM = 29.6; // underside of the arm overhang
const ARM_TOP = 35.0;    // top of the arm
const PILLAR_FRONT = -10; // front face of the vertical pillar (nosepiece clears it by ~7 cm)

const MAT = {
  cream: new THREE.MeshStandardMaterial({ color: 0xe9dfc3, roughness: 0.5, metalness: 0.05 }),
  creamDark: new THREE.MeshStandardMaterial({ color: 0xd9cdab, roughness: 0.6, metalness: 0.05 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.45, metalness: 0.2 }),
  blackMatte: new THREE.MeshStandardMaterial({ color: 0x1f2022, roughness: 0.9, metalness: 0.02 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd4d7da, roughness: 0.22, metalness: 0.95 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xaeb2b6, roughness: 0.35, metalness: 0.85 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xbfd9e8, roughness: 0.05, metalness: 0, transmission: 0.6, thickness: 0.3, transparent: true, opacity: 0.85 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd66b, emissiveIntensity: 1.6, roughness: 0.3 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95, metalness: 0 }),
  band: {
    red: new THREE.MeshStandardMaterial({ color: 0xc23a2b, roughness: 0.5 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xe0b52a, roughness: 0.5 }),
    green: new THREE.MeshStandardMaterial({ color: 0x3c8f5a, roughness: 0.5 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x3a6fb5, roughness: 0.5 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }),
  },
};

function mesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const box = (w, h, d, r = 0.3) => new RoundedBoxGeometry(w, h, d, 4, r);
const cyl = (rt, rb, h, seg = 40) => new THREE.CylinderGeometry(rt, rb, h, seg);

/** Knurled ring: a cylinder with a fine radial notch pattern via many segments. */
function knurl(r, h, mat = MAT.black) {
  const g = new THREE.CylinderGeometry(r, r, h, 48);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const rr = Math.hypot(x, z);
    if (rr > r * 0.99) {
      const k = 1 + 0.025 * Math.sign(Math.sin(a * 24));
      pos.setX(i, x * k); pos.setZ(i, z * k);
    }
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function part(id, name) {
  const g = new THREE.Group();
  g.name = name || id;
  g.userData.partId = id;
  return g;
}

function tagChildren(group) {
  group.traverse((o) => {
    if (o.isMesh) { o.userData.partId = group.userData.partId; o.castShadow = true; o.receiveShadow = true; }
  });
}

/** Nikon CF objective: chrome barrel, black knurled grip near the shoulder, colour code band. */
function objective(mag, bandMat, length, radius) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.6, 0.6, 0.6), MAT.steel, { y: -0.3 }));                                   // RMS thread neck
  const grip = knurl(radius + 0.08, 0.9, MAT.black); grip.position.y = -1.05; g.add(grip);   // knurled grip
  g.add(mesh(cyl(radius, radius * 0.9, length), MAT.chrome, { y: -1.5 - length / 2 }));       // barrel
  g.add(mesh(cyl(radius + 0.02, radius + 0.02, 0.25), bandMat, { y: -1.5 - length * 0.45 })); // colour band
  g.add(mesh(cyl(radius * 0.55, radius * 0.42, 0.6), MAT.steel, { y: -1.5 - length - 0.3 })); // front element housing
  g.userData.mag = mag;
  return g;
}

/** Gooseneck lamp arm through the given points; head aims along the final tangent. */
function gooseneck(...points) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.TubeGeometry(curve, 48, 0.32, 12, false);
  const g = new THREE.Group();
  g.add(mesh(tube, MAT.rubber));
  const end = curve.getPoint(1);
  const tangent = curve.getTangent(1).normalize();
  const head = mesh(cyl(1.1, 0.6, 1.6), MAT.black);
  head.position.copy(end);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  g.add(head);
  const led = mesh(new THREE.CircleGeometry(0.85, 24), MAT.lamp);
  led.position.copy(end.clone().add(tangent.clone().multiplyScalar(0.82)));
  led.lookAt(end.clone().add(tangent.clone().multiplyScalar(3)));
  g.add(led);
  return g;
}

export function buildMicroscope() {
  const root = new THREE.Group();
  root.name = 'labophot';
  const parts = {};

  // ---------- Base ----------
  // Wide cream slab; the rear third rises into the pillar foot. A black plateau
  // on top carries the field lens and the analyzer/polarizer accessories.
  const base = part('base', 'Base');
  base.add(mesh(box(25, 3.4, 37, 0.7), MAT.cream, { y: 1.7, z: -2.5 }));                    // slab, z -21..16
  base.add(mesh(box(13, 2.4, 26, 0.6), MAT.cream, { y: 4.4, z: -6 }));                       // raised spine from the pillar to the field lens
  base.add(mesh(box(19, 2.0, 12, 0.6), MAT.cream, { y: 6.0, z: PILLAR_FRONT - 4 }));         // pillar foot
  base.add(mesh(box(10, 0.6, 10, 0.2), MAT.blackMatte, { y: 5.55, z: AXIS_Z }));             // recessed black panel around the field lens
  // brightness control wheel on the front face, bottom-left
  // horizontal thumb wheel (vertical axis), sunk into the front-left corner so its rim shows edge-on
  const wheel = knurl(2.4, 1.0, MAT.black); wheel.position.set(-9.6, 1.8, 15.2); base.add(wheel);
  base.add(mesh(cyl(2.6, 2.6, 0.25), MAT.black, { x: -9.6, y: 2.45, z: 15.2 }));  // top lip
  base.add(mesh(box(1.4, 0.9, 2.2, 0.15), MAT.black, { x: -12.7, y: 2.4, z: -10 }));       // power rocker, left rear
  base.add(mesh(box(4.2, 1.3, 0.2, 0.1), MAT.black, { y: 1.9, z: 16.1 }));                 // Nikon badge, front
  base.add(mesh(box(3.4, 0.7, 0.1, 0.05), MAT.chrome, { y: 1.9, z: 16.22 }));
  for (const [x, z] of [[-10.5, 14], [10.5, 14], [-10.5, -19], [10.5, -19]]) base.add(mesh(cyl(1, 1, 0.4), MAT.rubber, { x, y: -0.1, z }));
  tagChildren(base);
  root.add(base);
  parts.base = base;

  // ---------- Illuminator (field lens + field diaphragm ring + lamp housing) ----------
  const illum = part('illuminator', 'Illuminator');
  illum.add(mesh(cyl(2.7, 2.7, 0.6), MAT.black, { y: 6.1, z: AXIS_Z }));                   // field diaphragm ring
  const fdRing = knurl(2.85, 0.35, MAT.black); fdRing.position.set(0, 5.95, AXIS_Z); illum.add(fdRing);
  illum.add(mesh(cyl(2.0, 2.0, 0.2), MAT.lamp, { y: 6.45, z: AXIS_Z }));                  // glowing field lens
  illum.add(mesh(box(8, 5.5, 5, 0.5), MAT.creamDark, { y: 4.2, z: -23 }));                 // lamp housing behind the base
  illum.add(mesh(cyl(1.4, 1.4, 1.0), MAT.black, { y: 4.2, z: -25.9, rx: Math.PI / 2 }));   // lamp cap
  const glow = new THREE.PointLight(0xffd77a, 6, 12, 2);
  glow.position.set(0, 7.3, AXIS_Z);
  illum.add(glow);
  tagChildren(illum);
  root.add(illum);
  parts.illuminator = illum;

  // ---------- Arm: vertical pillar at the back, overhang forward to the head ----------
  const arm = part('arm', 'Arm');
  arm.add(mesh(box(11, 30, 10, 0.9), MAT.cream, { y: 20, z: PILLAR_FRONT - 5 }));           // pillar, z -20..-10
  arm.add(mesh(box(11, ARM_TOP - ARM_BOTTOM, 25.5, 0.9), MAT.cream, { y: (ARM_TOP + ARM_BOTTOM) / 2, z: -7.2 })); // overhang z -19.95..5.55
  // sloped underside toward the nosepiece is suggested by a small chamfer block
  arm.add(mesh(box(9, 1.6, 4, 0.5), MAT.creamDark, { y: ARM_BOTTOM - 0.5, z: 3.2 }));
  // black focusing rack on the pillar front
  arm.add(mesh(box(5, 17, 1.4, 0.3), MAT.blackMatte, { y: 15, z: PILLAR_FRONT + 0.4 }));
  // Nikon Labophot plate on the pillar side
  arm.add(mesh(box(0.15, 2.2, 3.4, 0.05), MAT.black, { x: 5.6, y: 30, z: -13 }));
  arm.add(mesh(box(0.1, 1.2, 2.6, 0.05), MAT.chrome, { x: 5.7, y: 30.2, z: -13 }));
  // head dovetail clamp screw on the arm front, right side
  arm.add(mesh(cyl(0.55, 0.55, 1.3), MAT.chrome, { x: 5.9, y: ARM_TOP - 1.2, z: 1.5, rz: Math.PI / 2 }));
  tagChildren(arm);
  root.add(arm);
  parts.arm = arm;

  // ---------- Focus knobs: large coaxial pair low on the pillar sides ----------
  const focus = part('focus', 'Focus');
  for (const side of [-1, 1]) {
    const x = side * 5.5, y = 9.0, z = PILLAR_FRONT - 4.5;
    const coarse = knurl(3.3, 1.6, MAT.black); coarse.rotation.z = Math.PI / 2; coarse.position.set(x + side * 0.8, y, z); focus.add(coarse);
    const fine = knurl(2.0, 1.8, MAT.blackMatte); fine.rotation.z = Math.PI / 2; fine.position.set(x + side * 2.5, y, z); focus.add(fine);
    focus.add(mesh(cyl(1.0, 1.0, 1.2), MAT.black, { x: x + side * 3.9, y, z, rz: Math.PI / 2 }));   // fine knob cap
    focus.add(mesh(cyl(1.4, 1.4, 1.2), MAT.black, { x, y, z, rz: Math.PI / 2 }));                   // hub
  }
  tagChildren(focus);
  root.add(focus);
  parts.focus = focus;

  // ---------- Stage ----------
  const stage = part('stage', 'Stage');
  const stageZ = 1.8;
  stage.add(mesh(box(17, 1.0, 13, 0.25), MAT.blackMatte, { y: STAGE_Y - 0.5, z: stageZ }));
  stage.add(mesh(cyl(2.2, 2.2, 1.05), MAT.black, { y: STAGE_Y - 0.5, z: AXIS_Z }));          // aperture surround
  // slide holder: L-shaped guide plus spring arm
  stage.add(mesh(box(8, 0.35, 0.5, 0.05), MAT.black, { x: -1, y: STAGE_Y + 0.15, z: AXIS_Z - 2.6 }));
  stage.add(mesh(box(0.5, 0.35, 5.6, 0.05), MAT.black, { x: -5, y: STAGE_Y + 0.15, z: AXIS_Z }));
  stage.add(mesh(box(3.2, 0.3, 1.2, 0.1), MAT.chrome, { x: 3.4, y: STAGE_Y + 0.25, z: AXIS_Z + 0.2 })); // spring clip
  stage.add(mesh(new THREE.BoxGeometry(7.6, 0.12, 2.6), MAT.glass, { x: -0.2, y: STAGE_Y + 0.06, z: AXIS_Z + 0.1 }));  // slide
  stage.add(mesh(new THREE.BoxGeometry(2.2, 0.06, 2.2), MAT.glass, { x: 0, y: STAGE_Y + 0.15, z: AXIS_Z }));          // coverslip
  // vernier scale strip along the right edge
  stage.add(mesh(box(0.2, 0.15, 9, 0.02), MAT.chrome, { x: 8.3, y: STAGE_Y + 0.05, z: stageZ }));
  // coaxial X/Y stage knobs under the right-front corner
  stage.add(mesh(cyl(0.35, 0.35, 5.5), MAT.chrome, { x: 7.4, y: STAGE_Y - 3.5, z: 7 }));
  const sk1 = knurl(1.3, 1.1, MAT.black); sk1.position.set(7.4, STAGE_Y - 4.2, 7); stage.add(sk1);
  const sk2 = knurl(0.9, 1.3, MAT.blackMatte); sk2.position.set(7.4, STAGE_Y - 5.5, 7); stage.add(sk2);
  // stage bracket riding the rack
  stage.add(mesh(box(5.5, 2.6, 7.0, 0.3), MAT.black, { y: STAGE_Y - 1.6, z: PILLAR_FRONT + 4.0 }));
  tagChildren(stage);
  root.add(stage);
  parts.stage = stage;

  // ---------- Condenser ----------
  const cond = part('condenser', 'Condenser');
  const cy = STAGE_Y - 2.3;
  cond.add(mesh(cyl(2.3, 2.3, 2.6), MAT.black, { y: cy, z: AXIS_Z }));                          // condenser body
  cond.add(mesh(cyl(1.4, 1.4, 0.15), MAT.glass, { y: STAGE_Y - 0.95, z: AXIS_Z }));             // top lens
  const irisRing = knurl(2.75, 0.8, MAT.blackMatte); irisRing.position.set(0, cy - 1.7, AXIS_Z); cond.add(irisRing); // aperture ring
  cond.add(mesh(cyl(0.25, 0.25, 1.8), MAT.chrome, { x: 2.8, y: cy - 1.7, z: AXIS_Z + 0.6, rz: Math.PI / 2 })); // iris lever
  cond.add(mesh(cyl(2.9, 2.9, 0.5), MAT.black, { y: cy - 2.4, z: AXIS_Z }));                    // carrier ring
  cond.add(mesh(box(2.6, 2.4, 9.0, 0.2), MAT.black, { y: cy - 1.2, z: PILLAR_FRONT + 5.8 }));   // carrier bracket
  for (const s of [-1, 1]) cond.add(mesh(cyl(0.35, 0.35, 1.6), MAT.chrome, { x: s * 2.3, y: cy - 2.4, z: AXIS_Z - 2.2, ry: s * Math.PI / 4, rz: Math.PI / 2 })); // centering screws
  const hk = knurl(1.2, 0.9, MAT.black); hk.rotation.z = Math.PI / 2; hk.position.set(-4.6, cy - 3.2, PILLAR_FRONT + 2.5); cond.add(hk); // height knob
  tagChildren(cond);
  root.add(cond);
  parts.condenser = cond;

  // ---------- Polarizer (over field lens) and analyzer (above the nosepiece) ----------
  const pol = part('polarizer', 'Polarizer');
  pol.add(mesh(cyl(2.4, 2.4, 0.35), MAT.blackMatte, { y: 6.75, z: AXIS_Z }));
  pol.add(mesh(cyl(1.8, 1.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x4d5a6b, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.85 }), { y: 6.97, z: AXIS_Z }));
  pol.add(mesh(box(1.6, 0.3, 0.6, 0.1), MAT.black, { x: 2.8, y: 6.75, z: AXIS_Z })); // rotation tab
  pol.add(mesh(box(5.5, 0.5, 5.5, 0.15), MAT.blackMatte, { y: NOSE_Y + 1.55, z: 1.2 })); // analyzer plate
  pol.add(mesh(box(2.4, 0.4, 1.4, 0.1), MAT.black, { x: 3.8, y: NOSE_Y + 1.55, z: 1.2 })); // slider tab
  tagChildren(pol);
  root.add(pol);
  parts.polarizer = pol;

  // ---------- Nosepiece (rotating) ----------
  const nose = part('nosepiece', 'Nosepiece');
  nose.position.set(0, NOSE_Y, 1.2);
  nose.add(mesh(cyl(3.0, 3.0, ARM_BOTTOM - NOSE_Y - 1.8), MAT.black, { y: (ARM_BOTTOM - NOSE_Y + 1.8) / 2 })); // mount block up to the arm
  const noseTilt = new THREE.Group();
  noseTilt.rotation.x = THREE.MathUtils.degToRad(20); // turret axis leans so the working objective hangs vertical
  nose.add(noseTilt);
  const turret = new THREE.Group();
  turret.name = 'turret';
  noseTilt.add(turret);
  turret.add(mesh(cyl(3.7, 3.2, 1.5), MAT.black, { y: 0 }));
  const kn = knurl(4.0, 0.7, MAT.black); kn.position.y = 0.9; turret.add(kn); // big knurled ring
  nose.userData.turret = turret;
  tagChildren(nose);
  root.add(nose);
  parts.nosepiece = nose;

  // ---------- Objectives (children of the turret so they rotate with it) ----------
  const objs = part('objectives', 'Objectives');
  const spec = [
    { mag: 4, band: MAT.band.red, len: 1.8, r: 0.8 },
    { mag: 10, band: MAT.band.yellow, len: 2.8, r: 0.85 },
    { mag: 20, band: MAT.band.green, len: 3.4, r: 0.85 },
    { mag: 40, band: MAT.band.blue, len: 3.7, r: 0.85 },
    { mag: 100, band: MAT.band.white, len: 3.7, r: 0.85 },
  ];
  const ring = 2.7;
  const tilt = THREE.MathUtils.degToRad(20);
  spec.forEach((s, i) => {
    const o = objective(s.mag, s.band, s.len, s.r);
    const a = (i / spec.length) * Math.PI * 2; // 0 = front (+z)
    o.position.set(Math.sin(a) * ring, -0.75, Math.cos(a) * ring);
    o.rotation.set(-Math.cos(a) * tilt, 0, Math.sin(a) * tilt);
    o.userData.index = i;
    objs.add(o);
  });
  turret.add(objs);
  tagChildren(objs);
  parts.objectives = objs;
  nose.userData.objectiveCount = spec.length;

  // ---------- Head: black prism base, cream wedge cover, black tubes rising 30° ----------
  const headY = ARM_TOP, headZ = 0.5;
  const head = part('head', 'Head');
  head.position.set(0, headY, headZ);
  head.add(mesh(cyl(3.8, 3.8, 0.7), MAT.black, { y: 0.35 }));                                 // dovetail ring
  head.add(mesh(box(9.8, 2.2, 8.0, 0.5), MAT.black, { y: 1.75, z: -0.2 }));                  // prism housing, lower
  head.add(mesh(box(9.8, 3.6, 8.4, 0.9), MAT.cream, { y: 4.5, z: -0.6 }));                   // cream cover
  head.add(mesh(box(7.0, 1.4, 4.4, 0.6), MAT.cream, { y: 6.9, z: -1.6 }));                   // cover crown
  head.add(mesh(box(2.8, 0.9, 0.12, 0.05), MAT.black, { y: 4.4, z: 3.65 }));                  // Nikon label on the front
  const tubeTilt = -THREE.MathUtils.degToRad(30);
  const tubes = new THREE.Group();
  tubes.position.set(0, 3.0, 3.2);
  tubes.rotation.x = tubeTilt;
  tubes.add(mesh(box(9.0, 3.4, 4.6, 0.8), MAT.black, { y: 0.4, z: 1.6 }));                  // observation tube housing
  tubes.add(mesh(box(9.4, 0.5, 0.9, 0.1), MAT.blackMatte, { y: 0.4, z: 3.9 }));             // interpupillary hinge line
  head.add(tubes);
  tagChildren(head);
  root.add(head);
  parts.head = head;

  // ---------- Eyepieces ----------
  const eyes = part('eyepieces', 'Eyepieces');
  eyes.position.copy(head.position);
  const eyeGroup = new THREE.Group();
  eyeGroup.position.set(0, 3.0, 3.2);
  eyeGroup.rotation.x = tubeTilt;
  for (const side of [-1, 1]) {
    const x = side * 3.2;
    eyeGroup.add(mesh(cyl(1.4, 1.4, 4.6), MAT.black, { x, y: 0.4, z: 5.9, rx: Math.PI / 2 }));       // tube
    const dio = knurl(1.6, 0.8, MAT.blackMatte); dio.rotation.x = Math.PI / 2; dio.position.set(x, 0.4, 8.0); eyeGroup.add(dio); // diopter ring
    eyeGroup.add(mesh(cyl(1.25, 1.25, 0.7), MAT.rubber, { x, y: 0.4, z: 8.7, rx: Math.PI / 2 }));    // eyecup
    eyeGroup.add(mesh(new THREE.CircleGeometry(0.8, 24), MAT.glass, { x, y: 0.4, z: 9.07 }));        // eye lens
  }
  eyes.add(eyeGroup);
  tagChildren(eyes);
  root.add(eyes);
  parts.eyepieces = eyes;

  // ---------- Gooseneck side lights (add-on, clamped to the left of the stage) ----------
  const side = part('sidelight', 'Side lights');
  side.add(mesh(box(2.2, 2.8, 2.2, 0.3), MAT.black, { x: -9.2, y: STAGE_Y - 0.4, z: 2.5 }));
  side.add(gooseneck(
    new THREE.Vector3(-9.2, STAGE_Y + 1.0, 2.5), new THREE.Vector3(-11, STAGE_Y + 12, -2),
    new THREE.Vector3(-7, STAGE_Y + 11, 5.5), new THREE.Vector3(-4.6, STAGE_Y + 8.5, 6.4)));
  side.add(gooseneck(
    new THREE.Vector3(-9.2, STAGE_Y + 1.0, 2.5), new THREE.Vector3(-14, STAGE_Y + 5, 9),
    new THREE.Vector3(-8.5, STAGE_Y + 5.5, 10.5), new THREE.Vector3(-5.8, STAGE_Y + 4, 8.8)));
  const l1 = new THREE.SpotLight(0xfff0c8, 40, 25, 0.5, 0.6, 1.5);
  l1.position.set(-4.6, STAGE_Y + 8.5, 6.4);
  l1.target.position.set(0, STAGE_Y, AXIS_Z);
  side.add(l1, l1.target);
  tagChildren(side);
  root.add(side);
  parts.sidelight = side;

  root.userData.parts = parts;
  return root;
}

/** Rotate the turret so objective `index` (0..4) faces front (+z). */
export function turretAngleFor(index, count = 5) {
  return -(index / count) * Math.PI * 2;
}
