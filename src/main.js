import { Viewer } from './scene/viewer.js';
import { Panel } from './ui/panel.js';
import { PARTS, PART_BY_ID, OBJECTIVES } from './data/knowledge.js';

const $ = (s) => document.querySelector(s);

const OBJ_COLORS = { 4: '#c23a2b', 10: '#e0b52a', 20: '#3c8f5a', 40: '#3a6fb5', 100: '#f2f2f2' };

const app = {
  currentObjective: 10,
  viewer: null,
  panel: null,

  focusPart(id, { quiet = false } = {}) {
    if (!id) return;
    this.viewer.select(id, { fly: true });
    this.updateLegend(id);
    if (!quiet) this.panel.showPart(id);
  },

  setObjective(mag) {
    this.currentObjective = mag;
    const idx = OBJECTIVES.findIndex((o) => o.mag === mag);
    this.viewer.setObjective(idx);
    renderObjectiveBar();
    if (this.panel.tab === 'session') this.panel.render();
  },

  lightbox(src, alt) {
    const lb = $('#lightbox');
    lb.querySelector('img').src = src;
    lb.querySelector('img').alt = alt || '';
    lb.hidden = false;
  },

  updateLegend(id) {
    $('#legend').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.part === id));
  },
};

// ---------- 3D viewer ----------
const hoverLabel = $('#hoverLabel');
app.viewer = new Viewer($('#scene'), $('#viewport'), {
  onHover(id, px) {
    if (!id) { hoverLabel.hidden = true; return; }
    const p = PART_BY_ID[id];
    hoverLabel.innerHTML = `${p.short}<small>${p.name}</small>`;
    hoverLabel.style.left = `${px.x}px`;
    hoverLabel.style.top = `${px.y}px`;
    hoverLabel.hidden = false;
  },
  onSelect(id) {
    app.updateLegend(id);
    if (id) app.panel.showPart(id);
  },
});

// ---------- panel ----------
app.panel = new Panel($('#panel'), app);

// ---------- legend (quick part list over the viewport) ----------
const legend = $('#legend');
legend.innerHTML = PARTS.map((p) => `<button data-part="${p.id}">${p.short}</button>`).join('');
legend.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-part]');
  if (b) app.focusPart(b.dataset.part);
});

// ---------- objective bar ----------
function renderObjectiveBar() {
  $('#objectiveBar').innerHTML = OBJECTIVES.map((o) => `
    <button class="objective-btn ${o.mag === app.currentObjective ? 'active' : ''}" data-objective="${o.mag}" title="${o.name}">
      <span class="dot" style="background:${OBJ_COLORS[o.mag]}"></span>${o.label}
    </button>`).join('');
}
renderObjectiveBar();
$('#objectiveBar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-objective]');
  if (b) app.setObjective(Number(b.dataset.objective));
});
app.viewer.setObjective(OBJECTIVES.findIndex((o) => o.mag === app.currentObjective));
app.viewer.parts.nosepiece.userData.turret.rotation.y = app.viewer.turretTarget;

// ---------- top bar controls ----------
const btnSpin = $('#btnSpin');
function syncSpin() { btnSpin.classList.toggle('active', app.viewer.autoRotate); }
$('#btnReset').addEventListener('click', () => { app.viewer.select(null); app.updateLegend(null); app.viewer.resetView(); });
btnSpin.addEventListener('click', () => { app.viewer.setAutoRotate(!app.viewer.autoRotate); syncSpin(); });
$('#btnPanel').addEventListener('click', () => $('.stage').classList.toggle('panel-hidden'));

// theme: dark by default, light on request, remembered in this browser
const btnTheme = $('#btnTheme');
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="color-scheme"]').content = theme;
  btnTheme.textContent = theme === 'dark' ? 'Light' : 'Dark';
  app.viewer.setTheme(theme === 'light');
  try { localStorage.setItem('labophot-theme', theme); } catch {}
}
let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('labophot-theme') || 'dark'; } catch {}
applyTheme(savedTheme);
btnTheme.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

// idle auto-rotate on first load, until the user touches the scene
app.viewer.setAutoRotate(true); syncSpin();
$('#scene').addEventListener('pointerdown', () => { app.viewer.setAutoRotate(false); syncSpin(); }, { once: true });

// ---------- lightbox ----------
const lb = $('#lightbox');
const closeLb = () => { lb.hidden = true; };
lb.querySelector('.lightbox-close').addEventListener('click', closeLb);
lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });

// ---------- keyboard ----------
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  if (e.key === 'Escape') { closeLb(); app.viewer.select(null); app.updateLegend(null); }
  if (e.key === 'r' || e.key === 'R') $('#btnReset').click();
  if (e.key === ' ') { e.preventDefault(); btnSpin.click(); }
  if (e.key === 'p' || e.key === 'P') $('#btnPanel').click();
  if (e.key === 't' || e.key === 'T') btnTheme.click();
  if (e.key === '/') { e.preventDefault(); app.panel.show('ask'); }
  const n = Number(e.key);
  if (n >= 1 && n <= 5) app.setObjective(OBJECTIVES[n - 1].mag);
});

// hide the hint after the first interaction
$('#scene').addEventListener('pointerdown', () => { $('#viewportHint').style.opacity = '0'; }, { once: true });
