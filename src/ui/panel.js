// Side panel: tabs for Ask, Parts, Guides, Session, History, Archive.
// The panel is a thin view over knowledge.js and talks to the viewer through
// the `app` object (selectPart, focusPart, setObjective, openGuide).

import {
  PARTS, PART_BY_ID, OBJECTIVES, GUIDES, TROUBLESHOOTING, HISTORY,
  PHOTOS, DOCUMENTS, SOURCES, CHECKLIST,
} from '../data/knowledge.js';
import { ask, SUGGESTIONS } from './ask.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CONF = {
  confirmed: ['Confirmed', 'ok'],
  documented: ['Documented', 'ok'],
  photo: ['From photos', 'info'],
  verify: ['Verify marking', 'warn'],
};

function badge(conf) {
  const [label, tone] = CONF[conf] || [conf, 'info'];
  return `<span class="badge ${tone}">${label}</span>`;
}

function partLink(id, text) {
  if (!id || !PART_BY_ID[id]) return '';
  return `<button class="link part-link" data-part="${id}">${esc(text || `Show ${PART_BY_ID[id].short.toLowerCase()} in 3D`)} ↗</button>`;
}

export class Panel {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.body = root.querySelector('#panelBody');
    this.tabs = root.querySelector('#tabs');
    this.tab = 'ask';
    this.guideId = 'quickstart';
    this.stepIndex = 0;
    this.lastQuestion = '';
    this.tabs.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (b) this.show(b.dataset.tab);
    });
    this.body.addEventListener('click', (e) => this.onClick(e));
    this.render();
  }

  show(tab) {
    this.tab = tab;
    this.tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    this.render();
    this.body.scrollTop = 0;
  }

  showPart(id) {
    this.partId = id;
    this.show('parts');
  }

  openGuide(id, step = 0) {
    this.guideId = id;
    this.stepIndex = step;
    this.show('guides');
  }

  onClick(e) {
    const t = e.target;
    if (t.closest('[data-back]')) { this.partId = null; this.render(); return; }
    const pl = t.closest('[data-part]');
    if (pl && !t.closest('[data-step]')) {
      this.app.focusPart(pl.dataset.part);
      if (pl.classList.contains('part-card')) this.showPart(pl.dataset.part);
      return;
    }
    const g = t.closest('[data-guide]');
    if (g) { this.openGuide(g.dataset.guide); return; }
    const s = t.closest('[data-step]');
    if (s) { this.stepIndex = Number(s.dataset.step); this.render(); this.focusStepPart(); return; }
    const nav = t.closest('[data-stepnav]');
    if (nav) {
      const guide = GUIDES.find((x) => x.id === this.guideId);
      const n = guide.steps.length;
      this.stepIndex = (this.stepIndex + Number(nav.dataset.stepnav) + n) % n;
      this.render(); this.focusStepPart(); return;
    }
    const sug = t.closest('[data-suggest]');
    if (sug) { this.runAsk(sug.dataset.suggest); return; }
    const obj = t.closest('[data-objective]');
    if (obj) { this.app.setObjective(Number(obj.dataset.objective)); return; }
    const img = t.closest('img[data-zoom]');
    if (img) { this.app.lightbox(img.src, img.alt); return; }
    if (t.id === 'resetChecks') {
      CHECKLIST.forEach((c) => localStorage.removeItem('labophot-' + c.id));
      this.render(); return;
    }
    if (t.id === 'clearLog') {
      localStorage.removeItem('labophot-log'); this.render(); return;
    }
  }

  focusStepPart() {
    const guide = GUIDES.find((x) => x.id === this.guideId);
    const step = guide.steps?.[this.stepIndex];
    if (step?.part) this.app.focusPart(step.part, { quiet: true });
  }

  runAsk(q) {
    this.lastQuestion = q;
    this.results = ask(q);
    this.render();
    const first = this.results[0];
    if (first?.part) this.app.focusPart(first.part, { quiet: true });
  }

  render() {
    const r = {
      ask: () => this.renderAsk(),
      parts: () => this.renderParts(),
      guides: () => this.renderGuides(),
      session: () => this.renderSession(),
      history: () => this.renderHistory(),
      archive: () => this.renderArchive(),
    }[this.tab];
    this.body.innerHTML = r();
    this.afterRender();
  }

  afterRender() {
    const input = this.body.querySelector('#askInput');
    if (input) {
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.runAsk(input.value); });
      this.body.querySelector('#askBtn')?.addEventListener('click', () => this.runAsk(input.value));
      if (this.tab === 'ask' && !this.lastQuestion) input.focus();
    }
    this.body.querySelectorAll('[data-check]').forEach((c) => {
      c.checked = localStorage.getItem('labophot-' + c.dataset.check) === '1';
      c.addEventListener('change', () => localStorage.setItem('labophot-' + c.dataset.check, c.checked ? '1' : '0'));
    });
    const log = this.body.querySelector('#logInput');
    if (log) {
      const save = () => {
        const text = log.value.trim();
        if (!text) return;
        const entries = JSON.parse(localStorage.getItem('labophot-log') || '[]');
        entries.unshift({ t: Date.now(), text });
        localStorage.setItem('labophot-log', JSON.stringify(entries.slice(0, 200)));
        log.value = '';
        this.render();
      };
      log.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); });
      this.body.querySelector('#logSave')?.addEventListener('click', save);
    }
  }

  // ---------- Ask ----------
  renderAsk() {
    const results = this.results || [];
    return `
      <div class="ask-box">
        <input id="askInput" type="text" placeholder="Ask about a part, a symptom, a procedure…" value="${esc(this.lastQuestion)}" autocomplete="off" />
        <button id="askBtn" class="primary">Ask</button>
      </div>
      <p class="hint">Or click any part of the microscope. Answers come from the Nikon manuals and your own notes; nothing leaves this page.</p>
      ${results.length ? results.map((r, i) => `
        <article class="card answer ${i === 0 ? 'top' : ''}">
          <div class="card-kicker">${esc(kindLabel(r.kind))}</div>
          <h3>${esc(r.title)}</h3>
          <p>${esc(r.text)}</p>
          ${r.more ? `<p class="muted">${esc(r.more)}</p>` : ''}
          <div class="card-actions">
            ${partLink(r.part)}
            ${r.guide ? `<button class="link" data-guide="${r.guide}">Open guide →</button>` : ''}
            ${r.objective ? `<button class="link" data-objective="${r.objective}">Swing ${r.objective}× to front</button>` : ''}
          </div>
        </article>`).join('')
      : this.lastQuestion ? `<div class="card empty">No confident match. Try naming a part (condenser, stage, polarizer) or a symptom (dim, drifts, halo).</div>` : ''}
      <div class="suggest">
        <div class="section-label">${results.length ? 'Ask something else' : 'Try asking'}</div>
        ${SUGGESTIONS.map((s) => `<button class="chip" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}
      </div>`;
  }

  // ---------- Parts ----------
  renderParts() {
    const p = this.partId ? PART_BY_ID[this.partId] : null;
    if (p) {
      return `
        <button class="link back" data-back="1">← All parts</button>
        <article class="part-detail">
          ${badge(p.confidence)}
          <h2>${esc(p.name)}</h2>
          <p>${esc(p.body)}</p>
          <p class="muted">${esc(p.detail)}</p>
          ${p.tips?.length ? `<div class="section-label">Habits</div><ul class="tips">${p.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          <div class="card-actions">${partLink(p.id, 'Frame in 3D')}</div>
          ${p.id === 'objectives' || p.id === 'nosepiece' ? this.renderObjectiveTable() : ''}
          ${this.relatedGuides(p.id)}
        </article>`;
    }
    return `
      <p class="hint">Click a part here or in the 3D view.</p>
      <div class="part-grid">
        ${PARTS.map((x) => `
          <button class="part-card" data-part="${x.id}">
            <span class="part-name">${esc(x.short)}</span>
            <span class="part-sub">${esc(x.name)}</span>
          </button>`).join('')}
      </div>`;
  }

  renderObjectiveTable() {
    return `
      <div class="section-label">Objective set</div>
      <table class="objectives">
        <thead><tr><th>Lens</th><th>Total</th><th>NA</th><th>Res.</th></tr></thead>
        <tbody>${OBJECTIVES.map((o) => `
          <tr data-objective="${o.mag}" class="row-btn">
            <td><strong>${esc(o.label)}</strong><br><span class="muted">${esc(o.lens)}</span></td>
            <td>${esc(o.total)}</td><td>${esc(o.na)}</td><td>${esc(o.res)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <p class="muted small">Typical values for these magnification classes. The 4× and 20× are generic; barrel engravings were not readable, so treat NA and resolution as representative. Click a row to swing that objective to the front.</p>`;
  }

  relatedGuides(partId) {
    const rel = GUIDES.filter((g) => g.focusPart === partId || (g.steps || g.cards || []).some((s) => s.part === partId));
    const trouble = TROUBLESHOOTING.filter((t) => t.part === partId);
    if (!rel.length && !trouble.length) return '';
    return `
      ${rel.length ? `<div class="section-label">Related guides</div><div class="chips">${rel.map((g) => `<button class="chip" data-guide="${g.id}">${esc(g.title)}</button>`).join('')}</div>` : ''}
      ${trouble.length ? `<div class="section-label">If something looks wrong</div>${trouble.map((t) => `<details class="trouble"><summary>${esc(t.q)}</summary><p>${esc(t.a)}</p></details>`).join('')}` : ''}`;
  }

  // ---------- Guides ----------
  renderGuides() {
    const g = GUIDES.find((x) => x.id === this.guideId) || GUIDES[0];
    const nav = `<div class="chips guide-nav">${GUIDES.map((x) => `<button class="chip ${x.id === g.id ? 'active' : ''}" data-guide="${x.id}">${esc(x.title)}</button>`).join('')}<button class="chip ${this.guideId === 'trouble' ? 'active' : ''}" data-guide="trouble">Troubleshooting</button></div>`;
    if (this.guideId === 'trouble') {
      return `${nav}<h2>Troubleshooting</h2><p class="hint">Work from optical causes to mechanical or electrical ones. Most “bad microscope” images are alignment, contamination or specimen problems.</p>
        ${TROUBLESHOOTING.map((t) => `<details class="trouble"><summary>${esc(t.q)}</summary><p>${esc(t.a)}</p>${partLink(t.part)}</details>`).join('')}`;
    }
    let body = '';
    if (g.steps) {
      const s = g.steps[this.stepIndex] || g.steps[0];
      body = `
        <div class="stepper">
          <div class="step-list">
            ${g.steps.map((st, i) => `<button class="step ${i === this.stepIndex ? 'active' : ''}" data-step="${i}"><span class="n">${i + 1}</span>${esc(st.t)}</button>`).join('')}
          </div>
          <div class="step-panel card">
            <div class="card-kicker">Step ${this.stepIndex + 1} of ${g.steps.length}</div>
            <h3>${esc(s.t)}</h3>
            <p>${esc(s.b)}</p>
            ${s.why ? `<p class="why"><strong>Why:</strong> ${esc(s.why)}</p>` : ''}
            <div class="card-actions">
              <button class="ghost" data-stepnav="-1">← Prev</button>
              <button class="primary" data-stepnav="1">Next →</button>
              ${partLink(s.part)}
            </div>
          </div>
        </div>`;
    } else if (g.cards) {
      body = `<div class="cards">${g.cards.map((c) => `
        <article class="card">
          <h3>${esc(c.t)}</h3><p>${esc(c.b)}</p>
          <div class="card-actions">${partLink(c.part)}</div>
        </article>`).join('')}</div>`;
    }
    return `${nav}
      <h2>${esc(g.title)}</h2>
      <p class="hint">${esc(g.deck)}</p>
      ${body}
      ${g.warning ? `<div class="notice danger">${esc(g.warning)}</div>` : ''}`;
  }

  // ---------- Session ----------
  renderSession() {
    const entries = JSON.parse(localStorage.getItem('labophot-log') || '[]');
    return `
      <h2>This session</h2>
      <p class="hint">Checklist and bench log are saved in this browser only.</p>
      <div class="card checklist">
        ${CHECKLIST.map((c) => `<label><input type="checkbox" data-check="${c.id}"> <span>${esc(c.label)}</span></label>`).join('')}
        <button class="ghost small" id="resetChecks">Reset checklist</button>
      </div>
      <div class="section-label">Objective in use</div>
      <div class="chips">${OBJECTIVES.map((o) => `<button class="chip ${this.app.currentObjective === o.mag ? 'active' : ''}" data-objective="${o.mag}">${esc(o.label)}</button>`).join('')}</div>
      <div class="section-label">Bench log</div>
      <div class="card">
        <textarea id="logInput" rows="3" placeholder="What did you look at? Which objective, what lighting, what worked… (⌘/Ctrl+Enter to save)"></textarea>
        <div class="card-actions"><button class="primary small" id="logSave">Save entry</button>${entries.length ? `<button class="link" id="clearLog">Clear log</button>` : ''}</div>
      </div>
      ${entries.map((e) => `<div class="log-entry"><time>${new Date(e.t).toLocaleString()}</time><p>${esc(e.text)}</p></div>`).join('')}`;
  }

  // ---------- History ----------
  renderHistory() {
    return `
      <h2>Where the Labophot sits</h2>
      <p class="hint">At the transition from classic finite-tube microscopes to the modular research systems that followed.</p>
      <div class="timeline">
        ${HISTORY.map((h) => `<div class="event"><time>${esc(h.year)}</time><h3>${esc(h.title)}</h3><p>${esc(h.body)}</p></div>`).join('')}
      </div>
      <div class="card">
        <h3>Why it still holds up</h3>
        <p>The core tasks of a compound brightfield microscope have not changed: stable mechanics, good objectives, a controllable condenser and properly aligned illumination. The Labophot has all four. Newer microscopes mainly add convenience: LED illumination, infinity optics, easier digital imaging, and more standardized accessories.</p>
      </div>
      <div class="card">
        <h3>The compatibility fact that matters most</h3>
        <p>Finite 160 mm tube length, 45 mm parfocal Nikon CF objectives. Objectives marked <strong>160</strong> are the right family. Modern CFI objectives marked <strong>∞</strong> are not drop-in replacements.</p>
      </div>`;
  }

  // ---------- Archive ----------
  renderArchive() {
    return `
      <h2>Photos and provenance</h2>
      <div class="section-label">Photos</div>
      <div class="photo-grid">
        ${PHOTOS.map((p) => `<figure><img src="${p.src}" alt="${esc(p.caption)}" data-zoom loading="lazy"><figcaption>${esc(p.caption)}</figcaption></figure>`).join('')}
      </div>
      <div class="section-label">Original documents</div>
      <div class="photo-grid">
        ${DOCUMENTS.map((p) => `<figure><img src="${p.src}" alt="${esc(p.caption)}" data-zoom loading="lazy"><figcaption>${esc(p.caption)}</figcaption></figure>`).join('')}
      </div>
      <div class="card">
        <h3>Still worth verifying on the instrument</h3>
        <p>Straight-on photos of each objective barrel, the eyepiece engraving, the condenser engraving, and the electrical label under the base would replace the “typical” values here with exact NA, coverslip requirement, field number and electrical spec.</p>
      </div>
      <div class="section-label">Sources</div>
      <ol class="sources">
        ${SOURCES.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a><span>${esc(s.note)}</span></li>`).join('')}
      </ol>`;
  }
}

function kindLabel(k) {
  return { part: 'Part', objective: 'Objective', trouble: 'Troubleshooting', faq: 'Answer', guide: 'Guide' }[k] || k;
}
