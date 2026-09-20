// Procedural model of a Nikon Labophot 1 (binocular, 5-place nosepiece,
// Abbe condenser, add-on gooseneck lights). Units are centimetres.
// Every selectable part is a THREE.Group with userData.partId set; meshes
// inside inherit it via userData.partId so raycasting can resolve the part.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const MAT = {
  cream: new THREE.MeshStandardMaterial({ color: 0xe6dfcf, roughness: 0.55, metalness: 0.05 }),
  creamDark: new THREE.MeshStandardMaterial({ color: 0xd8d0be, roughness: 0.6, metalness: 0.05 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.45, metalness: 0.2 }),
  blackMatte: new THREE.MeshStandardMaterial({ color: 0x222224, roughness: 0.85, metalness: 0.05 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.25, metalness: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08d3c, roughness: 0.35, metalness: 0.8 }),
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

function part(id, name) {
  const g = new THREE.Group();
  g.name = name || id;
  g.userData.partId = id;
  return g;
}

function tagChildren(group) {
  group.traverse((o) => {
    if (o.isMesh) o.userData.partId = group.userData.partId;
  });
}

/** Objective barrel: hangs downward from the nosepiece. */
function objective(mag, bandMat, length, radius) {
  const g = new THREE.Group();
  // mounting neck
  g.add(mesh(cyl(0.65, 0.65, 0.8), MAT.chrome, { y: -0.4 }));
  // main barrel
  g.add(mesh(cyl(radius, radius * 0.92, length), MAT.black, { y: -0.8 - length / 2 }));
  // colour band + white band
  g.add(mesh(cyl(radius + 0.03, radius + 0.03, 0.22), bandMat, { y: -0.8 - length * 0.55 }));
  g.add(mesh(cyl(radius + 0.02, radius + 0.02, 0.35), MAT.band.white, { y: -0.8 - length * 0.3 }));
  // front nose
  g.add(mesh(cyl(radius * 0.55, radius * 0.4, 0.5), MAT.chrome, { y: -0.8 - length - 0.25 }));
  g.userData.mag = mag;
  return g;
}

/** A smooth gooseneck lamp arm from `from` to `to`, bulging via `via`. */
function gooseneck(...points) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.TubeGeometry(curve, 48, 0.32, 12, false);
  const g = new THREE.Group();
  g.add(mesh(tube, MAT.rubber));
  // lamp head
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
  const base = part('base', 'Base');
  base.add(mesh(box(22, 3.2, 30, 0.6), MAT.cream, { y: 1.6 }));
  // sloping rear rise of the base into the arm foot
  base.add(mesh(box(14, 4.5, 12, 0.6), MAT.cream, { y: 4.4, z: -8 }));
  // brightness dial on right side of base
  base.add(mesh(cyl(1.3, 1.3, 0.6), MAT.black, { x: 11.1, y: 1.6, z: 8, rz: Math.PI / 2 }));
  base.add(mesh(cyl(0.5, 0.5, 0.7), MAT.chrome, { x: 11.5, y: 1.6, z: 8, rz: Math.PI / 2 }));
  // Nikon badge
  base.add(mesh(box(3.2, 1.0, 0.15, 0.1), MAT.black, { y: 1.9, z: 15.05 }));
  // rubber feet
  for (const [x, z] of [[-9, 13], [9, 13], [-9, -13], [9, -13]]) {
    base.add(mesh(cyl(1, 1, 0.4), MAT.rubber, { x, y: -0.1, z }));
  }
  tagChildren(base);
  root.add(base);
  parts.base = base;

  // ---------- Illuminator (field lens + field diaphragm ring + lamp housing) ----------
  const illum = part('illuminator', 'Illuminator');
  illum.add(mesh(cyl(2.6, 2.6, 0.5), MAT.black, { y: 3.4, z: 3.5 }));       // field diaphragm ring
  illum.add(mesh(cyl(1.9, 1.9, 0.2), MAT.lamp, { y: 3.72, z: 3.5 }));         // glowing field lens
  illum.add(mesh(box(7, 5, 6, 0.5), MAT.creamDark, { y: 3.0, z: -14 }));    // lamp housing at rear
  illum.add(mesh(cyl(1.4, 1.4, 1.2), MAT.black, { y: 3.0, z: -17.4, rx: Math.PI / 2 })); // lamp cap
  const glow = new THREE.PointLight(0xffd77a, 6, 12, 2);
  glow.position.set(0, 4.6, 3.5);
  illum.add(glow);
  tagChildren(illum);
  root.add(illum);
  parts.illuminator = illum;

  // ---------- Arm ----------
  const arm = part('arm', 'Arm');
  arm.add(mesh(box(9, 28, 9, 0.8), MAT.cream, { y: 18, z: -9 }));          // pillar
  arm.add(mesh(box(9, 5, 13, 0.8), MAT.cream, { y: 29.5, z: -4.5 }));      // overhang; head sits on top at the front
  arm.add(mesh(box(4.5, 14, 2.5, 0.4), MAT.black, { y: 15, z: -4.2 }));     // focusing rack (dovetail)
  arm.add(mesh(box(2.2, 0.8, 0.15, 0.05), MAT.black, { x: 2.2, y: 26, z: -4.4 })); // small label
  tagChildren(arm);
  root.add(arm);
  parts.arm = arm;

  // ---------- Focus knobs (both sides) ----------
  const focus = part('focus', 'Focus');
  for (const side of [-1, 1]) {
    const x = side * 5.6;
    focus.add(mesh(cyl(2.6, 2.6, 1.4), MAT.black, { x: x + side * 0.7, y: 9.5, z: -9, rz: Math.PI / 2 }));   // coarse
    focus.add(mesh(cyl(1.5, 1.5, 1.6), MAT.blackMatte, { x: x + side * 2.2, y: 9.5, z: -9, rz: Math.PI / 2 })); // fine
    focus.add(mesh(cyl(0.9, 0.9, 1.4), MAT.black, { x, y: 9.5, z: -9, rz: Math.PI / 2 }));                       // hub
  }
  tagChildren(focus);
  root.add(focus);
  parts.focus = focus;

  // ---------- Stage ----------
  const stage = part('stage', 'Stage');
  const stageY = 14.5;
  stage.add(mesh(box(16, 0.9, 13, 0.25), MAT.black, { y: stageY, z: 1.5 }));
  // slide holder rails and slide
  stage.add(mesh(box(9, 0.35, 0.4, 0.05), MAT.blackMatte, { y: stageY + 0.6, z: -1.5 }));
  stage.add(mesh(box(0.4, 0.35, 5.5, 0.05), MAT.blackMatte, { x: -4.5, y: stageY + 0.6, z: 1.2 }));
  stage.add(mesh(new THREE.BoxGeometry(7.6, 0.12, 2.6), MAT.glass, { x: 0.2, y: stageY + 0.55, z: 3.3 }));
  stage.add(mesh(new THREE.BoxGeometry(2.2, 0.06, 2.2), MAT.glass, { x: 0, y: stageY + 0.66, z: 3.6 })); // coverslip
  // stage clip
  stage.add(mesh(box(3, 0.3, 1.4, 0.1), MAT.chrome, { x: 3.2, y: stageY + 0.75, z: 3.3 }));
  // coaxial X/Y stage knobs hanging under the right-front corner
  stage.add(mesh(cyl(0.35, 0.35, 5), MAT.chrome, { x: 7, y: stageY - 3, z: 6.4 }));
  stage.add(mesh(cyl(1.3, 1.3, 1.0), MAT.black, { x: 7, y: stageY - 3.6, z: 6.4 }));
  stage.add(mesh(cyl(0.85, 0.85, 1.2), MAT.blackMatte, { x: 7, y: stageY - 4.9, z: 6.4 }));
  // stage bracket to the rack
  stage.add(mesh(box(5, 2.2, 4, 0.3), MAT.black, { y: stageY - 0.9, z: -5.2 }));
  tagChildren(stage);
  root.add(stage);
  parts.stage = stage;

  // ---------- Condenser ----------
  const cond = part('condenser', 'Condenser');
  cond.add(mesh(cyl(2.2, 2.2, 2.4), MAT.black, { y: stageY - 2.0, z: 3.5 }));          // condenser body
  cond.add(mesh(cyl(1.4, 1.4, 0.15), MAT.glass, { y: stageY - 0.75, z: 3.5 }));        // top lens
  cond.add(mesh(cyl(2.6, 2.6, 0.7), MAT.blackMatte, { y: stageY - 3.6, z: 3.5 }));     // iris ring
  cond.add(mesh(cyl(0.25, 0.25, 1.6), MAT.chrome, { x: 2.6, y: stageY - 3.6, z: 3.4, rz: Math.PI / 2 })); // iris lever
  cond.add(mesh(box(2.4, 2.2, 3.5, 0.2), MAT.black, { y: stageY - 3.2, z: -0.4 }));    // carrier bracket
  for (const side of [-1, 1]) {
    cond.add(mesh(cyl(0.3, 0.3, 1.4), MAT.chrome, { x: side * 1.6, y: stageY - 3.2, z: 0.5, rz: Math.PI / 2 })); // centering screws
  }
  cond.add(mesh(cyl(1.1, 1.1, 0.8), MAT.black, { x: -4.3, y: stageY - 4.4, z: -3.6, rz: Math.PI / 2 })); // condenser height knob
  tagChildren(cond);
  root.add(cond);
  parts.condenser = cond;

  // ---------- Polarizer (over field lens) and analyzer (under head) ----------
  const pol = part('polarizer', 'Polarizer');
  pol.add(mesh(cyl(2.4, 2.4, 0.35), MAT.blackMatte, { y: 4.3, z: 3.5 }));
  pol.add(mesh(cyl(1.8, 1.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x4d5a6b, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.85 }), { y: 4.52, z: 3.5 }));
  pol.add(mesh(box(1.6, 0.3, 0.6, 0.1), MAT.black, { x: 2.8, y: 4.3, z: 3.5 })); // rotation tab
  pol.add(mesh(box(4.2, 0.5, 4.2, 0.15), MAT.blackMatte, { y: 26.55, z: 1.6 })); // analyzer slider above the nosepiece
  tagChildren(pol);
  root.add(pol);
  parts.polarizer = pol;

  // ---------- Nosepiece (rotating) ----------
  const nose = part('nosepiece', 'Nosepiece');
  nose.position.set(0, 25.2, 1.2);
  const noseTilt = new THREE.Group();
  noseTilt.rotation.x = THREE.MathUtils.degToRad(20); // turret axis leans so the working objective hangs vertical
  nose.add(noseTilt);
  const turret = new THREE.Group();
  turret.name = 'turret';
  noseTilt.add(turret);
  turret.add(mesh(cyl(3.6, 3.1, 1.4), MAT.black, { y: 0 }));
  turret.add(mesh(cyl(3.7, 3.7, 0.5), MAT.blackMatte, { y: 0.85 })); // knurled ring
  nose.userData.turret = turret;
  tagChildren(nose);
  root.add(nose);
  parts.nosepiece = nose;

  // ---------- Objectives (children of the turret so they rotate with it) ----------
  const objs = part('objectives', 'Objectives');
  const spec = [
    { mag: 4, band: MAT.band.red, len: 2.2, r: 0.75 },
    { mag: 10, band: MAT.band.yellow, len: 3.2, r: 0.8 },
    { mag: 20, band: MAT.band.green, len: 3.8, r: 0.8 },
    { mag: 40, band: MAT.band.blue, len: 4.1, r: 0.8 },
    { mag: 100, band: MAT.band.white, len: 4.1, r: 0.8 },
  ];
  const ring = 2.7;
  const tilt = THREE.MathUtils.degToRad(20);
  spec.forEach((s, i) => {
    const o = objective(s.mag, s.band, s.len, s.r);
    const a = (i / spec.length) * Math.PI * 2; // 0 = front (+z)
    o.position.set(Math.sin(a) * ring, -0.7, Math.cos(a) * ring);
    // tilt barrel outward so the front element converges under the turret
    o.rotation.set(-Math.cos(a) * tilt, 0, Math.sin(a) * tilt);
    o.userData.index = i;
    objs.add(o);
  });
  turret.add(objs);
  tagChildren(objs);
  parts.objectives = objs;
  nose.userData.objectiveCount = spec.length;

  // ---------- Head ----------
  const headY = 32.0, headZ = 0.8;
  const head = part('head', 'Head');
  head.position.set(0, headY, headZ);
  head.add(mesh(cyl(3.6, 3.6, 0.8), MAT.black, { y: 0.4 }));                       // dovetail ring on the arm
  head.add(mesh(box(9.5, 4.0, 7.0, 0.7), MAT.black, { y: 2.8, z: -0.4 }));         // prism housing
  head.add(mesh(box(6.5, 1.6, 4.0, 0.5), MAT.black, { y: 5.4, z: -1.0 }));         // prism hump
  head.add(mesh(box(2.6, 0.8, 1.6, 0.2), MAT.blackMatte, { x: 4.9, y: 2.8, z: 0.5 })); // Nikon label
  head.add(mesh(cyl(0.5, 0.5, 1.0), MAT.chrome, { x: 5.0, y: 1.6, z: 1.5, rz: Math.PI / 2 })); // dovetail clamp screw
  // observation tube housing: rises 30° toward the viewer
  const tubeTilt = -THREE.MathUtils.degToRad(30);
  const tubes = new THREE.Group();
  tubes.position.set(0, 3.2, 2.4);
  tubes.rotation.x = tubeTilt;
  tubes.add(mesh(box(8.6, 3.0, 4.0, 0.7), MAT.black, { y: 0.2, z: 1.6 }));
  head.add(tubes);
  tagChildren(head);
  root.add(head);
  parts.head = head;

  // ---------- Eyepieces ----------
  const eyes = part('eyepieces', 'Eyepieces');
  eyes.position.copy(head.position);
  const eyeGroup = new THREE.Group();
  eyeGroup.position.set(0, 3.2, 2.4);
  eyeGroup.rotation.x = tubeTilt;
  for (const side of [-1, 1]) {
    const x = side * 3.1;
    eyeGroup.add(mesh(cyl(1.35, 1.35, 4.4), MAT.black, { x, y: 0.2, z: 5.4, rx: Math.PI / 2 }));       // tube
    eyeGroup.add(mesh(cyl(1.55, 1.55, 0.7), MAT.blackMatte, { x, y: 0.2, z: 7.4, rx: Math.PI / 2 }));  // diopter ring
    eyeGroup.add(mesh(cyl(1.2, 1.2, 0.6), MAT.rubber, { x, y: 0.2, z: 8.0, rx: Math.PI / 2 }));        // eyecup
    eyeGroup.add(mesh(new THREE.CircleGeometry(0.75, 24), MAT.glass, { x, y: 0.2, z: 8.32 }));         // eye lens
  }
  eyes.add(eyeGroup);
  tagChildren(eyes);
  root.add(eyes);
  parts.eyepieces = eyes;

  // ---------- Gooseneck side lights ----------
  const side = part('sidelight', 'Side lights');
  // clamp on left edge of stage
  side.add(mesh(box(2.2, 2.6, 2.2, 0.3), MAT.black, { x: -8.6, y: stageY, z: 2.5 }));
  side.add(gooseneck(
    new THREE.Vector3(-8.6, stageY + 1.3, 2.5), new THREE.Vector3(-10.5, stageY + 12, -2),
    new THREE.Vector3(-6.5, stageY + 11, 5.5), new THREE.Vector3(-4.2, stageY + 8.5, 6.2)));
  side.add(gooseneck(
    new THREE.Vector3(-8.6, stageY + 1.3, 2.5), new THREE.Vector3(-13.5, stageY + 5, 9),
    new THREE.Vector3(-8, stageY + 5.5, 10), new THREE.Vector3(-5.5, stageY + 4, 8.5)));
  const l1 = new THREE.SpotLight(0xfff0c8, 40, 25, 0.5, 0.6, 1.5);
  l1.position.set(-4.2, stageY + 8.5, 6.2);
  l1.target.position.set(0, stageY, 3.5);
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
