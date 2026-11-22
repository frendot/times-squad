// Answer choices for one gate (spec 6.3 to 6.5): near-miss distractors with a type, and a balanced right-answer position.
import { CONFIG } from './config.js';
import { factId, ruleFor } from './facts.js';
import { weighted, pick } from './rng.js';

const ok = (v, c) => Number.isInteger(v) && v !== c && v >= 2 && v <= 144;
export function swapDigits(c) {
  if (c >= 10 && c <= 99) { const t = Math.floor(c / 10), o = c % 10; if (t === o || o === 0 || t === 0) return null; return o * 10 + t; }
  if (c >= 100 && c <= 144) { const h = Math.floor(c / 100), t = Math.floor(c / 10) % 10, o = c % 10; if (t === o) return null; const v = h * 100 + o * 10 + t; return v === c ? null : v; }
  return null;
}
// All candidates for a x b (a shown first), in type priority order, without duplicates (steps 1 to 3).
export function candidates(a, b, prevAnswer) {
  const c = a * b, out = [], seen = new Set();
  const add = (value, type, nf) => {
    if (!ok(value, c) || seen.has(value)) return;
    seen.add(value);
    if (value === prevAnswer) return;
    out.push(nf ? { value, type, neighbourFactId: nf } : { value, type });
  };
  add(c + b, 'ADJ', factId(a + 1, b)); add(c - b, 'ADJ', a - 1 >= 1 ? factId(a - 1, b) : null);
  add(c + a, 'OBF', factId(a, b + 1)); add(c - a, 'OBF', b - 1 >= 1 ? factId(a, b - 1) : null);
  const s = swapDigits(c); if (s !== null) add(s, 'SWP');
  if (a + b !== c) add(a + b, 'ADD');
  return out;
}
export function freshBalance() { return { rightLarger: 0, gates2: 0, pos2: [0, 0], pos3: [0, 0, 0], gates3: 0, lastPos: [] }; }

// Pick the right answer's position (step 8): never the same place 3 gates in a row; keep each place near an even share.
function placeRight(k, balance, rng) {
  const counts = k === 2 ? balance.pos2 : balance.pos3;
  const [p1, p2] = balance.lastPos.slice(-2);
  const banned = p1 !== undefined && p1 === p2 ? p1 : -1;
  // 3-gates never repeat the last place, so they cannot push a 2-gate into an unbalanced choice.
  const lastOne = balance.lastPos[balance.lastPos.length - 1];
  const allowed = [...Array(k).keys()].filter((p) => p !== banned && (k === 2 || p !== lastOne));
  const min = Math.min(...allowed.map((p) => counts[p]));
  const pos = pick(rng, allowed.filter((p) => counts[p] === min));
  counts[pos]++; balance.lastPos = [...balance.lastPos.slice(-1), pos];
  if (k === 2) balance.gates2++; else balance.gates3++;
  return pos;
}

// Normal and boss gates. recentWrong: values the child chose for this fact in the last 14 days, newest first.
export function generate({ a, b, k, recentWrong = [], prevAnswer = null, balance, rng }) {
  const c = a * b;
  const rule = ruleFor(factId(a, b));
  let left = candidates(a, b, prevAnswer);
  const chosen = [];
  const take = (cand) => { chosen.push(cand); left = left.filter((x) => x !== cand); };
  // 5. confusion first
  for (const w of recentWrong) { const cand = left.find((x) => x.value === w); if (cand) { take(cand); break; } }
  // 6. the rest
  while (chosen.length < k - 1 && left.length) {
    let pool = left;
    const types = new Set(chosen.map((x) => x.type));
    if (k === 3 && chosen.length) { const diff = left.filter((x) => !types.has(x.type)); if (diff.length) pool = diff; }
    const keep = rule ? pool.filter((x) => rule(x.value)) : pool;
    let set = keep.length && keep.length < pool.length ? (rng() < CONFIG.RULE_KEEP_PROB ? keep : pool) : pool;
    if (k === 2 && balance && balance.gates2 > 0) {
      const ratio = balance.rightLarger / balance.gates2;
      const pref = ratio > 0.6 ? set.filter((x) => x.value > c) : ratio < 0.4 ? set.filter((x) => x.value < c) : set;
      if (pref.length) set = pref;
    }
    const W = CONFIG.DISTRACTOR_WEIGHTS;
    const present = [...new Set(set.map((x) => x.type))];
    const type = weighted(rng, present.map((t) => [t, W[t] || 1]));
    take(pick(rng, set.filter((x) => x.type === type)));
  }
  // 7. fallback
  for (const v of [c + 2, c - 2, c + 10, c - 10]) {
    if (chosen.length >= k - 1) break;
    if (ok(v, c) && v !== prevAnswer && !chosen.some((x) => x.value === v)) chosen.push({ value: v, type: 'FALLBACK' });
  }
  return place(c, chosen, k, balance, rng);
}

function place(c, distractors, k, balance, rng) {
  const bal = balance || freshBalance();
  const pos = placeRight(k, bal, rng);
  if (k === 2 && c > distractors[0].value) bal.rightLarger++;
  // 9. wrong values in random order (not sorted)
  const wrong = distractors.slice();
  for (let i = wrong.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [wrong[i], wrong[j]] = [wrong[j], wrong[i]]; }
  const choices = []; let w = 0;
  for (let i = 0; i < k; i++) choices.push(i === pos ? c : wrong[w++].value);
  return { choices, correctIndex: pos, distractors };
}

// Learn Gate ask (6.5): one far, easy wrong answer.
export function generateFar({ a, b, balance, rng, prevAnswer = null }) {
  const c = a * b;
  let far = null;
  for (const v of [2 * c, c % 2 === 0 ? c / 2 : null, c + 20, c - 20]) if (v !== null && ok(v, c) && v !== prevAnswer) { far = v; break; }
  return place(c, [{ value: far, type: 'FAR' }], 2, balance, rng);
}
