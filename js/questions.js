// Questions for one level play (spec 5): the 8-question plan, distractors, platform positions, powers.
// Everything here uses the seeded run stream. The level layout never depends on the answers.
import { CONFIG } from './config.js';
import { factId, parseFact } from './facts.js';
import { candidates } from './gen.js';
import { rngOn, seedFrom, weighted } from './rng.js';
import { newFact, introduce, firstTry, daysBetween } from './learn.js';

export const LEVEL_FACTS = {
  'x2-L1': [1, 2, 3, 4, 5].map((k) => factId(2, k)),
  'x2-L2': [6, 7, 8, 9, 10].map((k) => factId(2, k)),
  'x2-L3': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => factId(2, k)),
  'x2-RR': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => factId(2, k)),
  'spring-boss': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => factId(2, k)),
};
const LEVEL_INDEX = { 'x2-L1': 0, 'x2-L2': 1, 'x2-L3': 2, 'x2-RR': 3, 'spring-boss': 4 };
export const QUESTIONS = { 'x2-L1': 8, 'x2-L2': 8, 'x2-L3': 8, 'x2-RR': 6, 'spring-boss': 5 };

export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
export const runSeed = (pid, levelId, playCount) => seedFrom(hashStr(pid) ^ LEVEL_INDEX[levelId] ^ Math.imul(playCount + 1, 0x9e37));

function shuffle(rng, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const fact = (pd, id) => pd.facts[id] || newFact(id);
function recentMisses(pd, id, today, days = 14) {
  return (pd.attempts || []).filter((a) => a.factId === id && !a.right && a.firstTry && a.day && daysBetween(a.day, today) <= days).length;
}
// Weak first: lowest box, then most misses in the last 14 days, ties seeded.
function weakOrder(pd, ids, today, rng) {
  const tie = new Map(ids.map((id) => [id, rng()]));
  return ids.slice().sort((p, q) => fact(pd, p).box - fact(pd, q).box || recentMisses(pd, q, today) - recentMisses(pd, p, today) || tie.get(p) - tie.get(q));
}
// No fact twice in a row: swap forward when needed.
function noRepeats(plan) {
  for (let i = 1; i < plan.length; i++) if (plan[i] === plan[i - 1]) {
    const j = plan.findIndex((x, k) => k > i && x !== plan[i] && plan[k - 1] !== x && (k + 1 >= plan.length || plan[k + 1] !== plan[i]));
    if (j > 0) [plan[i], plan[j]] = [plan[j], plan[i]];
  }
  return plan;
}

// The plan (5.2 for levels, 5.3 for the Review Road, weakest five for the boss).
export function makePlan(pd, levelId, today, rng) {
  const ids = LEVEL_FACTS[levelId], n = QUESTIONS[levelId];
  if (levelId === 'x2-RR' || levelId === 'spring-boss') {
    const list = (pd.progress.scroller && pd.progress.scroller.reviewList) || [];
    const pri = new Map(ids.map((id) => [id, (list.includes(id) ? 4 : 0) + Math.min(3, recentMisses(pd, id, today)) + (fact(pd, id).box <= 1 ? 2 : 0) + rng()]));
    const order = ids.slice().sort((p, q) => pri.get(q) - pri.get(p));
    let plan = order.slice(0, n);
    if (levelId === 'x2-RR') plan = shuffle(rng, plan); // the road mixes them up
    return noRepeats(plan);
  }
  // Q1: the strongest fact (a sure start); all new: 2 x 2 (L1) or 2 x 10.
  const allNew = ids.every((id) => fact(pd, id).box === 0);
  let q1;
  if (allNew) q1 = levelId === 'x2-L1' ? factId(2, 2) : factId(2, 10);
  else { const top = Math.max(...ids.map((id) => fact(pd, id).box)); const best = ids.filter((id) => fact(pd, id).box === top); q1 = best[Math.floor(rng() * best.length)]; }
  const rest = [];
  const others = ids.filter((id) => id !== q1);
  if (ids.length <= n) { rest.push(...shuffle(rng, others)); }
  const weak = weakOrder(pd, levelId === 'x2-L3' ? others : ids, today, rng);
  let k = 0;
  while (rest.length < n - 1) { const id = weak[k++ % weak.length]; if (levelId === 'x2-L3' && rest.includes(id) && k <= weak.length) continue; rest.push(id); }
  // Extra (weak) slots go after the first round; keep them apart from their twin.
  return noRepeats([q1, ...rest]);
}

// Distractors (5.4) with even preference and a balanced "answer is biggest / smallest" share.
export function makeChoices(a, b, { rng, prev, recentWrong = [], balance }) {
  const c = a * b;
  let pool = candidates(a, b, prev);
  for (const v of [c + 2, c - 2, c + 4, c + 10]) if (v >= 1 && v <= 100 && v !== c && v !== prev && !pool.some((p) => p.value === v)) pool.push({ value: v, type: 'FALLBACK' });
  const W = { ADJ: 40, OBF: 35, SWP: 15, ADD: 10, FALLBACK: 4 };
  const evenRule = c % 2 === 0;
  const pickOne = (exclude) => {
    const items = pool.filter((p) => !exclude.includes(p.value));
    const rw = items.filter((p) => recentWrong.includes(p.value));
    if (rw.length && rng() < 0.5) return rw[Math.floor(rng() * rw.length)];
    if (evenRule) {
      const ev = items.filter((p) => p.value % 2 === 0), od = items.filter((p) => p.value % 2 !== 0);
      const useEven = ev.length && (!od.length || rng() < 0.75);
      const from = useEven ? ev : od;
      return weighted(rng, from.map((p) => [p, W[p.type]]));
    }
    return weighted(rng, items.map((p) => [p, W[p.type]]));
  };
  // Which shape do we want: answer biggest, smallest, or middle? Keep each near a third.
  const n = balance.n || 0, big = balance.big || 0, small = balance.small || 0;
  const want = big / Math.max(1, n) < 0.3 ? 'big' : small / Math.max(1, n) < 0.3 ? 'small' : null;
  let best = null;
  for (let t = 0; t < 30; t++) {
    const d1 = pickOne([]), d2 = pickOne([d1.value]);
    if (!d1 || !d2 || d1.value === d2.value) continue;
    const shape = c > d1.value && c > d2.value ? 'big' : c < d1.value && c < d2.value ? 'small' : 'mid';
    const tooMany = (shape === 'big' && big / Math.max(1, n) > 0.45) || (shape === 'small' && small / Math.max(1, n) > 0.45);
    if (!best && !tooMany) best = [d1, d2, shape];
    if ((!want || shape === want) && !tooMany) { best = [d1, d2, shape]; break; }
    if (t === 29 && !best) best = [d1, d2, shape];
  }
  balance.n = n + 1; if (best[2] === 'big') balance.big = big + 1; if (best[2] === 'small') balance.small = small + 1;
  return [best[0], best[1]];
}

// Right-answer positions: a bag of 3 left, 3 middle, 2 right (rotated per level), never 3 in a row.
export function positionBag(rng, levelId, n) {
  const li = LEVEL_INDEX[levelId] || 0;
  const counts = [[3, 3, 2], [2, 3, 3], [3, 2, 3]][li % 3];
  let bag = []; counts.forEach((k, p) => { for (let i = 0; i < k; i++) bag.push(p); });
  for (let tries = 0; tries < 50; tries++) {
    const s = shuffle(rng, bag);
    if (!s.some((p, i) => i >= 2 && s[i - 1] === p && s[i - 2] === p)) { bag = s; break; }
  }
  return bag.slice(0, n);
}

const doubleLine = (id) => { const [a, b] = parseFact(id); const k = a === 2 ? b : a; return { k, c: 2 * k }; };

// The context the simulation talks to. pd is changed in place (learning), and saved by the game.
export function makeCtx(pd, levelId, today, playCount) {
  const run = { rng: runSeed(pd.pid || 'p', levelId, playCount) };
  const rng = rngOn(run);
  const plan = makePlan(pd, levelId, today, rng);
  const nQ = QUESTIONS[levelId];
  const bag = positionBag(rng, levelId, nQ);
  const balance = {};
  const missedHere = new Set();
  const reviewAdd = [];
  const powers = [];
  let prev = null;
  const seen = {}; // meetings this play (display order rule)
  const ctx = {
    plan, reviewAdd, missedHere, run,
    ask(i, w) {
      if (levelId === 'spring-boss' && i >= plan.length) plan.push(plan[i % 5]);
      let id = plan[i];
      if (id === prev && plan.length > i + 1) { [plan[i], plan[i + 1]] = [plan[i + 1], plan[i]]; id = plan[i]; }
      const f = fact(pd, id);
      const [x, y] = parseFact(id);
      const other = x === 2 ? y : x;
      const met = Math.max(f.attempts || 0, seen[id] || 0);
      seen[id] = (seen[id] || 0) + 1;
      const twoFirst = met < 2 || rng() < 0.5;
      const a = twoFirst ? 2 : other, b = twoFirst ? other : 2;
      const c = a * b;
      const recentWrong = (pd.attempts || []).filter((t) => t.factId === id && !t.right && typeof t.chosen === 'number').slice(-3).map((t) => t.chosen);
      const ds = makeChoices(a, b, { rng, prev, recentWrong, balance });
      let pos = levelId === 'spring-boss' ? Math.floor(rng() * 3) : bag[i % bag.length];
      if (levelId === 'spring-boss' && run.lastPos && run.lastPos[0] === run.lastPos[1] && pos === run.lastPos[0]) pos = (pos + 1 + Math.floor(rng() * 2)) % 3;
      run.lastPos = [pos, ...(run.lastPos || [])].slice(0, 2);
      const choices = [null, null, null]; choices[pos] = c;
      const rest = [0, 1, 2].filter((p) => p !== pos); choices[rest[0]] = ds[0].value; choices[rest[1]] = ds[1].value;
      prev = c;
      return { factId: id, a, b, c, choices, correctIndex: pos, distractors: ds.map((d) => ({ value: d.value, type: d.type })),
        dots: f.box === 0, askStep: w ? w.steps : 0, i };
    },
    answer(q, idx, { first, w, misses }) {
      const right = idx === q.correctIndex;
      const f = pd.facts[q.factId] || (pd.facts[q.factId] = newFact(q.factId));
      const repeat = !right && (missedHere.has(q.factId) || misses > 0 || recentMisses(pd, q.factId, today, 14) > 0);
      if (first) {
        if (f.box === 0) introduce(f, today);
        const lead = levelId === 'spring-boss' ? 0 : 5000;
        const timeMs = w ? Math.max(500, ((w.steps - q.askStep) / 60) * 1000 - lead) : 3000;
        firstTry(f, { right, timeMs, k: 3, today });
        pd.attempts = [...(pd.attempts || []), { day: today, factId: q.factId, shown: `${q.a} x ${q.b}`, chosen: q.choices[idx], right, firstTry: true,
          timeMs: Math.round(timeMs), distractors: q.distractors, kind: levelId === 'spring-boss' ? 'boss' : 'scroller' }].slice(-CONFIG.ATTEMPTS_KEEP);
        if (!right) {
          missedHere.add(q.factId);
          // Comes back 2 or 3 questions later, or goes on the Review Road list.
          const back = q.i + (levelId === 'spring-boss' ? 2 : rng() < 0.5 ? 2 : 3);
          if (levelId === 'spring-boss') { plan.splice(Math.min(back, plan.length), 0, q.factId); }
          else if (back < nQ && levelId !== 'x2-RR') { plan.splice(back, 0, q.factId); plan.length = Math.max(nQ, plan.length); plan.splice(nQ); noRepeatsFrom(plan, q.i + 1); }
          else if (!reviewAdd.includes(q.factId)) reviewAdd.push(q.factId);
        }
      }
      const s = doubleLine(q.factId);
      return { right, repeat, strategy: s };
    },
    powerFor(i) {
      if (!CONFIG.POWER_ON_Q.includes(i + 1)) return null;
      let p = CONFIG.POWERS[Math.floor(rng() * CONFIG.POWERS.length)];
      if (powers.length >= 2 && powers[powers.length - 1] === p && powers[powers.length - 2] === p) p = CONFIG.POWERS.find((x) => x !== p);
      powers.push(p); return p;
    },
  };
  return ctx;
}
function noRepeatsFrom(plan, from) {
  for (let i = Math.max(1, from); i < plan.length; i++) if (plan[i] === plan[i - 1]) {
    const j = plan.findIndex((x, k) => k > i && x !== plan[i] && plan[k - 1] !== x);
    if (j > 0) [plan[i], plan[j]] = [plan[j], plan[i]];
  }
}
