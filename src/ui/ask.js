// Local question answering over the bundled knowledge base.
// No network, no model: tokenises the question, scores every entry by
// keyword and text overlap, and returns the best few answers.

import { PARTS, OBJECTIVES, TROUBLESHOOTING, FAQ, GUIDES } from '../data/knowledge.js';

const STOP = new Set('a an the is are was were be been do does did how what which why when where who can could should would i my me it its this that to of for on in at with and or not no if into from about use using'.split(' '));

function norm(s) {
  return s.toLowerCase()
    .replace(/×/g, 'x')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9./\- ]+/g, ' ');
}

function tokens(s) {
  return norm(s).split(/\s+/).filter((t) => t && !STOP.has(t));
}

function stem(t) {
  return t.replace(/(ing|ers|er|es|s)$/, '');
}

// Build a flat corpus of answerable entries.
function corpus() {
  const out = [];
  for (const p of PARTS) {
    out.push({ kind: 'part', title: p.name, text: p.body, more: p.detail, part: p.id, keywords: p.keywords, weight: 1.0 });
  }
  for (const o of OBJECTIVES) {
    out.push({
      kind: 'objective', title: o.name, part: 'objectives', objective: o.mag,
      text: `${o.desc} Total magnification ${o.total} with 10× eyepieces. NA ${o.na}, ideal resolution ${o.res}. ${o.oil ? 'Requires immersion oil.' : 'Dry objective.'}`,
      more: o.habit, keywords: [`${o.mag}x`, o.label.toLowerCase(), 'objective', 'magnification', o.oil ? 'oil' : 'dry'], weight: 1.1,
    });
  }
  for (const t of TROUBLESHOOTING) {
    out.push({ kind: 'trouble', title: t.q, text: t.a, part: t.part, keywords: t.keywords, weight: 1.2 });
  }
  for (const f of FAQ) {
    out.push({ kind: 'faq', title: f.q, text: f.a, part: f.part, keywords: f.keywords, weight: 1.2 });
  }
  for (const g of GUIDES) {
    const body = (g.steps || g.cards || []).map((s) => `${s.t}. ${s.b}`).join(' ');
    out.push({ kind: 'guide', title: g.title, text: g.deck, more: body, part: g.focusPart, guide: g.id, keywords: [g.id, g.title.toLowerCase()], weight: 0.9 });
  }
  for (const e of out) {
    e.kw = new Set((e.keywords || []).map((k) => norm(k).trim()));
    e.kwTokens = new Set([...e.kw].flatMap((k) => k.split(' ')).map(stem));
    e.bodyTokens = new Set(tokens(`${e.title} ${e.text} ${e.more || ''}`).map(stem));
  }
  return out;
}

const CORPUS = corpus();

export function ask(question, limit = 4) {
  const q = norm(question).trim();
  if (!q) return [];
  const qt = tokens(question).map(stem);
  const scored = CORPUS.map((e) => {
    let score = 0;
    // whole-phrase keyword hits are strong signals
    for (const k of e.kw) if (k && q.includes(k)) score += 3 + k.length / 8;
    for (const t of qt) {
      if (e.kwTokens.has(t)) score += 2;
      else if (e.bodyTokens.has(t)) score += 0.6;
    }
    // title overlap
    const tt = tokens(e.title).map(stem);
    for (const t of qt) if (tt.includes(t)) score += 1.2;
    return { entry: e, score: score * e.weight };
  }).filter((s) => s.score > 1.5)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => ({ ...s.entry, score: s.score }));
}

export const SUGGESTIONS = [
  'What is the condenser for?',
  'Which bulb does it take?',
  'Why is the image dim?',
  'How do I use the 100× oil objective?',
  'Which objectives are compatible?',
  'What does the polarizer do?',
  'Focus keeps drifting down',
  'How do I set up Köhler?',
];
