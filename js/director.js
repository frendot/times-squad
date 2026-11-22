// The maths director: which fact comes next, and the three numbers across the lanes.
// Uses the v0.1 learn engine (spaced repetition boxes) and near-miss answers. Seeded random only.
import { CONFIG } from './config.js';
import { factId, parseFact } from './facts.js';
import { newFact, introduce, isDue, firstTry } from './learn.js';
import { generate, freshBalance } from './gen.js';
import { weighted, pick } from './rng.js';

export function bandAt(dist) { let b = CONFIG.BANDS[0]; for (const x of CONFIG.BANDS) if (dist >= x.from) b = x; return b; }
export function poolFor(dist) {
  const t = bandAt(dist).tables, out = new Set();
  const others = [2, 3, 4, 5, 6, 7, 8, 9, 10, ...t.filter((x) => x > 10)];
  for (const a of t) for (const b of others) out.add(factId(a, b));
  return [...out].sort();
}
// Pick the next fact. pd.facts holds the learn records (shared with the Times Map and v0.1).
export function nextFact(pd, run, rng, today) {
  const pool = poolFor(run.dist).filter((id) => !run.recent.includes(id));
  const F = (id) => pd.facts[id];
  const due = pool.filter((id) => F(id) && isDue(F(id), today));
  const learning = pool.filter((id) => F(id) && F(id).box >= 1 && F(id).box <= 2 && !due.includes(id));
  const fresh = pool.filter((id) => !F(id) || F(id).box === 0);
  const known = pool.filter((id) => F(id) && F(id).box >= 3 && !due.includes(id));
  const kinds = [['due', due], ['learning', learning], ['fresh', fresh], ['known', known]].filter(([, l]) => l.length);
  const kind = weighted(rng, kinds.map(([k]) => [k, CONFIG.MIX[k]]));
  const list = kinds.find(([k]) => k === kind)[1];
  // Fresh facts come from the newest band first, so the run gets harder as you go.
  const id = pick(rng, list);
  run.recent = [...run.recent, id].slice(-CONFIG.NO_REPEAT_LAST);
  return { id, kind };
}
// Build a question: shown order (bigger number first half the time), three numbers, right lane.
export function makeQuestion(pd, run, rng, today) {
  const { id, kind } = nextFact(pd, run, rng, today);
  let [a, b] = parseFact(id);
  if (rng() < 0.5) [a, b] = [b, a];
  const recentWrong = (pd.attempts || []).filter((x) => x.factId === id && !x.right).slice(-3).map((x) => x.chosen).reverse();
  run.balance = run.balance || freshBalance();
  const g = generate({ a, b, k: CONFIG.MAX_CHOICES, recentWrong, prevAnswer: run.prevAnswer, balance: run.balance, rng });
  run.prevAnswer = a * b;
  const isNew = !pd.facts[id] || pd.facts[id].box === 0;
  return { factId: id, a, b, c: a * b, kind, isNew, choices: g.choices, correctIndex: g.correctIndex, distractors: g.distractors };
}
// Record an answer in the learn engine. Returns { tierUp } (old tier or null) and the attempt record.
export function recordAnswer(pd, q, laneIdx, timeMs, today) {
  const f = pd.facts[q.factId] || (pd.facts[q.factId] = newFact(q.factId));
  if (f.box === 0) introduce(f, today);
  const right = laneIdx === q.correctIndex;
  const r = firstTry(f, { right, timeMs, k: 3, today });
  const att = { day: today, factId: q.factId, shown: `${q.a} x ${q.b}`, chosen: q.choices[laneIdx], right, firstTry: true, timeMs: Math.round(timeMs),
    distractors: q.distractors.map((d) => ({ value: d.value, type: d.type })), kind: 'run' };
  pd.attempts = [...(pd.attempts || []), att].slice(-CONFIG.ATTEMPTS_KEEP);
  return { right, tierUp: r.tierUp, tier: f.tier, att };
}
// The bridge between the world and the learn engine. Questions use their own seeded stream (from the run seed),
// so the track layout never depends on the answers.
export function makeCtx(pd, w, today) {
  const run = { dist: 0, recent: [], state: (w.seed ^ 0x5bd1e995) | 0 };
  const rng = () => { let t = (run.state = (run.state + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    run,
    ask: (ww) => { run.dist = ww.dist; return makeQuestion(pd, run, rng, today); },
    answer: (q, li, ms) => recordAnswer(pd, q, li, ms, today),
  };
}
