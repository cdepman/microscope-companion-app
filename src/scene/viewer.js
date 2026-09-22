import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMicroscope, turretAngleFor } from './microscope.js';

const HOME = { pos: new THREE.Vector3(58, 40, 70), target: new THREE.Vector3(0, 19, -3) };
// Preferred camera direction (from part centre toward camera) per part.
const VIEW_DIR = {
  default: new THREE.Vector3(0.75, 0.5, 1),
  focus: new THREE.Vector3(1, 0.35, 0.45),
  sidelight: new THREE.Vector3(-0.9, 0.55, 0.9),
  uvlight: new THREE.Vector3(-0.9, 0.35, 1),
  illuminator: new THREE.Vector3(0.5, 0.75, 1),
  base: new THREE.Vector3(0.6, 0.8, 1),
  condenser: new THREE.Vector3(0.9, 0.25, 1),
  polarizer: new THREE.Vector3(0.7, 0.6, 1),
  arm: new THREE.Vector3(1, 0.4, -0.3),
  head: new THREE.Vector3(0.7, 0.6, 1),
  eyepieces: new THREE.Vector3(0.4, 0.5, 1),
  dimmer: new THREE.Vector3(-0.6, 0.7, 1),
  power: new THREE.Vector3(-1, 0.4, 0.2),
  fielddiaphragm: new THREE.Vector3(0.5, 0.8, 1),
  lamphouse: new THREE.Vector3(0.6, 0.5, -1),
  slideholder: new THREE.Vector3(0.3, 0.9, 0.8),
  stageknobs: new THREE.Vector3(1, 0.1, 0.8),
  analyzer: new THREE.Vector3(1, 0.2, 0.8),
};

export class Viewer {
  constructor(canvas, container, { onHover, onSelect } = {}) {
    this.canvas = canvas;
    this.container = container;
    this.onHover = onHover || (() => {});
    this.onSelect = onSelect || (() => {});

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.7;

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
    this.camera.position.copy(HOME.pos);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(HOME.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 140;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.autoRotateSpeed = 0.6;
    this.controls.addEventListener('start', () => { this.userInteracting = true; this.tween = null; });
    this.controls.addEventListener('end', () => { this.userInteracting = false; });

    this.buildLights();
    this.buildGround();

    this.model = buildMicroscope();
    this.scene.add(this.model);
    this.parts = this.model.userData.parts;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-10, -10);
    this.pointerPx = { x: 0, y: 0 };
    this.hovered = null;
    this.selected = null;
    this.tween = null;
    this.turretTarget = 0;
    this.pickables = [];
    this.model.traverse((o) => { if (o.isMesh && o.userData.partId) this.pickables.push(o); });

    this.bindEvents();
    this.resize();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0xdfe8f5, 0x2a2622, 0.55);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff4e2, 2.2);
    key.position.set(25, 45, 30);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 5; key.shadow.camera.far = 140;
    key.shadow.camera.left = -40; key.shadow.camera.right = 40;
    key.shadow.camera.top = 50; key.shadow.camera.bottom = -20;
    key.shadow.bias = -0.0006;
    key.shadow.radius = 4;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.6);
    fill.position.set(-30, 20, -10);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(-10, 25, -40);
    this.scene.add(rim);
  }

  buildGround() {
    const geo = new THREE.CircleGeometry(60, 64);
    const mat = new THREE.ShadowMaterial({ opacity: 0.35 });
    this.groundShadow = mat;
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.3;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // faint bench disc for grounding
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(34, 64),
      new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.95, metalness: 0, transparent: true, opacity: 0.55 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.31;
    disc.receiveShadow = true;
    this.scene.add(disc);
    this.bench = disc;
  }

  /** Swap bench colours for the light or dark UI theme. */
  setTheme(light) {
    this.bench.material.color.set(light ? 0xe4e0d6 : 0x1a1c20);
    this.bench.material.opacity = light ? 0.6 : 0.55;
    this.groundShadow.opacity = light ? 0.22 : 0.35;
  }

  bindEvents() {
    const c = this.canvas;
    let downAt = null;
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.pointerPx = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    c.addEventListener('pointerleave', () => { this.pointer.set(-10, -10); this.setHover(null); });
    c.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    c.addEventListener('pointerup', (e) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      const quick = performance.now() - downAt.t < 400;
      downAt = null;
      if (moved < 6 && quick) {
        const id = this.pick();
        this.select(id, { fly: true });
        this.onSelect(id);
      }
    });
    window.addEventListener('resize', () => this.resize());
    new ResizeObserver(() => this.resize()).observe(this.container);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    return hits.length ? hits[0].object.userData.partId : null;
  }

  setEmissive(partId, color, intensity) {
    const g = this.parts[partId];
    if (!g) return;
    g.traverse((o) => {
      if (!o.isMesh || o.userData.partId !== partId) return;
      if (!o.userData.origMat) o.userData.origMat = o.material;
      if (color === null) { o.material = o.userData.origMat; return; }
      const m = o.userData.origMat.clone();
      if (m.emissive) { m.emissive.set(color); m.emissiveIntensity = intensity; }
      o.material = m;
    });
  }

  setHover(id) {
    if (id === this.hovered) return;
    if (this.hovered && this.hovered !== this.selected) this.setEmissive(this.hovered, null);
    this.hovered = id;
    if (id && id !== this.selected) this.setEmissive(id, 0xf0c51a, 0.35);
    this.canvas.style.cursor = id ? 'pointer' : 'grab';
    this.onHover(id, this.pointerPx);
  }

  select(id, { fly = false } = {}) {
    if (this.selected) this.setEmissive(this.selected, null);
    this.selected = id;
    if (id) {
      this.setEmissive(id, 0xf0c51a, 0.55);
      if (fly) this.flyTo(id);
    }
  }

  /** Smoothly frame a part. */
  flyTo(id) {
    const g = this.parts[id];
    if (!g) return;
    const bbox = new THREE.Box3().setFromObject(g);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3()).length();
    const dist = THREE.MathUtils.clamp(size * 1.6 + 11, 22, 70);
    // blend the part's preferred viewing direction with where the user already is
    const preferred = (VIEW_DIR[id] || VIEW_DIR.default).clone().normalize();
    const current = this.camera.position.clone().sub(this.controls.target).normalize();
    const dir = preferred.lerp(current, 0.35).normalize();
    if (dir.y < 0.2) { dir.y = 0.2; dir.normalize(); }
    const pos = center.clone().add(dir.multiplyScalar(dist));
    this.tween = { fromPos: this.camera.position.clone(), fromTarget: this.controls.target.clone(), toPos: pos, toTarget: center, t: 0, dur: 0.9 };
    this.controls.autoRotate = false;
  }

  resetView() {
    this.tween = { fromPos: this.camera.position.clone(), fromTarget: this.controls.target.clone(), toPos: HOME.pos.clone(), toTarget: HOME.target.clone(), t: 0, dur: 1.0 };
  }

  setAutoRotate(on) { this.controls.autoRotate = on; }
  get autoRotate() { return this.controls.autoRotate; }

  /** Bring objective `index` to the front of the turret. */
  setObjective(index) {
    this.turretTarget = turretAngleFor(index, this.parts.nosepiece.userData.objectiveCount);
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    // camera tween
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const e = 1 - Math.pow(1 - tw.t, 3);
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, e);
      this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e);
      if (tw.t >= 1) this.tween = null;
    }
    // turret easing (shortest path)
    const turret = this.parts.nosepiece.userData.turret;
    let diff = this.turretTarget - turret.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    turret.rotation.y += diff * Math.min(1, dt * 6);

    this.controls.update();
    if (!this.userInteracting) this.setHover(this.pick());
    this.renderer.render(this.scene, this.camera);
  }
}
