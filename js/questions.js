// Questions for one level play (spec 5): the 8-question plan, distractors, platform positions, powers.
// Everything here uses the seeded run stream. The level layout never depends on the answers.
import { CONFIG } from './config.js';
import { factId, parseFact } from './facts.js';
import { candidates } from './gen.js';
import { rngOn, seedFrom, weighted } from './rng.js';
import { newFact, introduce, firstTry, daysBetween } from './learn.js';
import { ORDER, tableOf, isBoss, levelIndex, levelNo } from './levels.js';

// v0.4: each table x2..x10 has its own facts (t x 1 .. t x 10); the Rainbow stage mixes all of them.
export const tableFacts = (t) => [...new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => factId(t, k)))];
export const RAINBOW_FACTS = [...new Set(ORDER.flatMap((t) => [2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => factId(t, k))))];
export const factsFor = (levelId) => (tableOf(levelId) ? tableFacts(tableOf(levelId)) : RAINBOW_FACTS);
export const questionsFor = (levelId) => (isBoss(levelId) ? 5 : 6);
export const QUESTIONS = new Proxy({}, { get: (_, id) => questionsFor(String(id)) });
const LEVEL_INDEX = new Proxy({}, { get: (_, id) => levelIndex(String(id)) });
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

// The plan. L1: a sure start, then weak first. L2: the facts this player missed in L1 come back (spaced out),
// then facts L1 did not ask, then weak first. Rainbow: all tables, weak first, with missed facts mixed in. Boss: the weakest five.
const strongest = (pd, ids, rng) => { const top = Math.max(...ids.map((id) => fact(pd, id).box)); const best = ids.filter((id) => fact(pd, id).box === top); return best[Math.floor(rng() * best.length)]; };
export function makePlan(pd, levelId, today, rng) {
  const t = tableOf(levelId), ids = factsFor(levelId), n = questionsFor(levelId);
  const sc = (pd.progress && pd.progress.scroller) || {};
  const missedL1 = (t ? (sc.l1Missed || {})[t] || [] : Object.values(sc.l1Missed || {}).flat()).filter((id) => ids.includes(id));
  if (isBoss(levelId)) {
    const pri = new Map(ids.map((id) => [id, (missedL1.includes(id) ? 4 : 0) + Math.min(3, recentMisses(pd, id, today)) + (fact(pd, id).box <= 1 ? 2 : 0) + rng()]));
    return noRepeats(ids.slice().sort((p, q) => pri.get(q) - pri.get(p)).slice(0, n));
  }
  const allNew = ids.every((id) => fact(pd, id).box === 0);
  const lv = levelNo(levelId);
  let q1;
  if (allNew) q1 = t === 2 ? factId(2, 2) : t === 10 ? factId(2, 10) : t ? factId(t, 10) : factId(2, 10);
  else q1 = strongest(pd, ids.filter((id) => !missedL1.includes(id) || ids.length <= 1), rng) || strongest(pd, ids, rng);
  const plan = [q1];
  const used = new Set([q1]);
  const weak = weakOrder(pd, ids, today, rng);
  if (t && lv === 2) {
    // L2: missed facts at slots 1, 3, 5 (spaced); then facts L1 never asked; then weak first.
    const miss = shuffle(rng, missedL1.filter((id) => id !== q1));
    const asked = new Set((sc.l1Asked || {})[t] || []);
    const notAsked = weak.filter((id) => !asked.has(id) && !used.has(id) && !miss.includes(id));
    const slots = [1, 3, 5, 2, 4].slice(0, Math.min(miss.length, n - 1));
    const filler = [...notAsked, ...weak.filter((id) => !notAsked.includes(id) && !miss.includes(id) && id !== q1)];
    for (let i = 1; i < n; i++) {
      if (slots.includes(i) && miss.length) { const id = miss.shift(); plan.push(id); used.add(id); continue; }
      const id = filler.find((x) => !used.has(x)) || weak[i % weak.length]; plan.push(id); used.add(id);
    }
    return noRepeats(plan);
  }
  if (levelId === 'rb-L1') return rainbowRamp(pd, ids, n, missedL1, weak, rng);
  if (!t) {
    // Rainbow: up to 2 missed facts, the rest weak first with no table twice in a row where possible.
    const miss = shuffle(rng, missedL1.filter((id) => id !== q1)).slice(0, 2);
    const pool = weak.filter((id) => !used.has(id) && !miss.includes(id));
    for (let i = 1; i < n; i++) {
      if ((i === 2 || i === 4) && miss.length) { const id = miss.shift(); plan.push(id); used.add(id); continue; }
      const prevT = parseFact(plan[plan.length - 1]);
      const j = pool.findIndex((id) => { const f = parseFact(id); return !f.some((x) => prevT.includes(x) && x !== 1); });
      plan.push(pool.splice(j >= 0 ? j : 0, 1)[0]);
    }
    return noRepeats(plan);
  }
  // L1: weak first (new facts are box 0, so they come in), no fact twice.
  for (const id of weak) { if (plan.length >= n) break; if (!used.has(id)) { plan.push(id); used.add(id); } }
  return noRepeats(plan);
}
// v0.4.1 Rainbow level 1 ramps up: a sure start (x2 / x10 / x5 with a small number), then 2 easy facts (tables 2, 10, 5),
// then 2 middle facts (3, 4, 9), then 1 hard fact (6, 7, 8). Up to 2 missed facts may take the middle or hard slots. Seeded.
export const factTier = (id) => Math.min(...parseFact(id).filter((x) => x > 1).map((x) => Math.floor(ORDER.indexOf(x) / 3)));
export const SURE_START = [factId(2, 2), factId(2, 3), factId(2, 5), factId(2, 10), factId(3, 10), factId(5, 2), factId(5, 10), factId(10, 10)].filter((v, i, a) => a.indexOf(v) === i);
const RAMP = [0, 0, 0, 1, 1, 2];
function rainbowRamp(pd, ids, n, missedL1, weak, rng) {
  const sure = SURE_START.filter((id) => ids.includes(id));
  const top = Math.max(...sure.map((id) => fact(pd, id).box)), best = sure.filter((id) => fact(pd, id).box === top);
  const plan = [best[Math.floor(rng() * best.length)]], used = new Set(plan);
  const miss = shuffle(rng, missedL1.filter((id) => !used.has(id))).slice(0, 2);
  for (let i = 1; i < n; i++) {
    const tier = RAMP[Math.min(i, RAMP.length - 1)];
    if (tier >= 1 && (i === 3 || i === 5) && miss.length) { const id = miss.shift(); plan.push(id); used.add(id); continue; }
    const prevT = parseFact(plan[plan.length - 1]);
    const pool = weak.filter((id) => !used.has(id) && !miss.includes(id) && factTier(id) === tier);
    const pick = pool.find((id) => !parseFact(id).some((x) => prevT.includes(x) && x !== 1)) || pool[0] || weak.find((id) => !used.has(id));
    plan.push(pick); used.add(pick);
  }
  return plan;
}
// After a level: remember what L1 asked and missed (first try) so L2 can reuse the misses; L2 clears the ones it got right.
export function recordLevel(sc, levelId, answers) {
  const t = tableOf(levelId); if (!t || isBoss(levelId)) return sc;
  sc.l1Missed = sc.l1Missed || {}; sc.l1Asked = sc.l1Asked || {};
  const asked = [...new Set(answers.map((a) => a.q))];
  const missed = [...new Set(answers.filter((a) => !a.first).map((a) => a.q))];
  const rightFirst = new Set(answers.filter((a) => a.first).map((a) => a.q));
  if (levelNo(levelId) === 1) { sc.l1Asked[t] = asked; sc.l1Missed[t] = [...new Set([...(sc.l1Missed[t] || []).filter((id) => !rightFirst.has(id)), ...missed])]; }
  else sc.l1Missed[t] = (sc.l1Missed[t] || []).filter((id) => !rightFirst.has(id) || missed.includes(id));
  return sc;
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
  const counts = n <= 6 ? [2, 2, 2] : [[3, 3, 2], [2, 3, 3], [3, 2, 3]][li % 3];
  let bag = []; counts.forEach((k, p) => { for (let i = 0; i < k; i++) bag.push(p); });
  for (let tries = 0; tries < 50; tries++) {
    const s = shuffle(rng, bag);
    if (!s.some((p, i) => i >= 2 && s[i - 1] === p && s[i - 2] === p)) { bag = s; break; }
  }
  return bag.slice(0, n);
}

// The table a fact is shown under: the level's table, or (Rainbow) the bigger factor.
export const tableFor = (levelId, id) => { const [a, b] = parseFact(id); const t = tableOf(levelId); return t && (a === t || b === t) ? t : Math.max(a, b); };
export const strategyFor = (t, id) => { const [a, b] = parseFact(id); const k = a === t ? b : a; return { t, k, c: t * k }; };

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
      if (i >= plan.length) plan.push(plan[i % Math.max(1, plan.length)]);
      let id = plan[i];
      if (id === prev && plan.length > i + 1) { [plan[i], plan[i + 1]] = [plan[i + 1], plan[i]]; id = plan[i]; }
      const f = fact(pd, id);
      const [x, y] = parseFact(id);
      const tt = tableFor(levelId, id), other = x === tt ? y : x;
      const met = Math.max(f.attempts || 0, seen[id] || 0);
      seen[id] = (seen[id] || 0) + 1;
      const tFirst = met < 2 || rng() < 0.5; // the table number first for the first 2 meetings
      const a = tFirst ? tt : other, b = tFirst ? other : tt;
      const c = a * b;
      const recentWrong = (pd.attempts || []).filter((t) => t.factId === id && !t.right && typeof t.chosen === 'number').slice(-3).map((t) => t.chosen);
      const ds = makeChoices(a, b, { rng, prev, recentWrong, balance });
      let pos = isBoss(levelId) ? Math.floor(rng() * 3) : bag[i % bag.length];
      if (isBoss(levelId) && run.lastPos && run.lastPos[0] === run.lastPos[1] && pos === run.lastPos[0]) pos = (pos + 1 + Math.floor(rng() * 2)) % 3;
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
        const lead = isBoss(levelId) ? 0 : 5000;
        const timeMs = w ? Math.max(500, ((w.steps - q.askStep) / 60) * 1000 - lead) : 3000;
        firstTry(f, { right, timeMs, k: 3, today });
        pd.attempts = [...(pd.attempts || []), { day: today, factId: q.factId, shown: `${q.a} x ${q.b}`, chosen: q.choices[idx], right, firstTry: true,
          timeMs: Math.round(timeMs), distractors: q.distractors, kind: isBoss(levelId) ? 'boss' : 'scroller' }].slice(-CONFIG.ATTEMPTS_KEEP);
        if (!right) {
          missedHere.add(q.factId);
          // Comes back 2 or 3 questions later, or goes on the Review Road list.
          const back = q.i + (isBoss(levelId) ? 2 : rng() < 0.5 ? 2 : 3);
          if (isBoss(levelId)) { plan.splice(Math.min(back, plan.length), 0, q.factId); }
          else if (back < nQ) { plan.splice(back, 0, q.factId); plan.length = Math.max(nQ, plan.length); plan.splice(nQ); noRepeatsFrom(plan, q.i + 1); }
          else if (!reviewAdd.includes(q.factId)) reviewAdd.push(q.factId);
        }
      }
      const s = strategyFor(tableFor(levelId, q.factId), q.factId);
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
