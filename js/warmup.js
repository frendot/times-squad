// v0.5b1 Brain Warm-up (academic review, section 3): 12 facts typed on a number pad (recall, not 1-of-3).
// No visible timer and no score for the child. Pure functions here (tested in tools/questions-test.mjs); the screens are in screens.js.
// When: before the first level (pre), after the Moon boss (x5), after the Snowman King (x8), after the Rainbow Dragon (post),
// and 7 days after the post check (keep). It can always be skipped and never blocks play.
import { factId, parseFact } from './facts.js';
import { rngOn, seedFrom } from './rng.js';
import { daysBetween } from './learn.js';

export const WU_N = 12;
export const WU_FAST_MS = 5000; // "quick" for a typed answer (typing on a pad takes ~2 s more than the 3 s landing rule)
export const KINDS = ['pre', 'mid1', 'mid2', 'post', 'keep'];
const uniq = (a) => [...new Set(a)];
// v0.5 B2 (German review 3.1): 4 easy (a 2, 5 or 10), 4 middle (3 and 4 times 3-9, 9 times 3-5), 4 hard = the 3 anchors
// 6·7, 7·8, 6·8 (always, for a clean before/now) + 1 rotating from 6·6, 7·7, 8·8, 6·9, 7·9, 8·9. 2 easy items open the form.
export const EASY = uniq([2, 5, 10].flatMap((t) => [2, 3, 4, 5, 6, 7, 8, 9].map((k) => factId(t, k))));
export const MIDDLE = uniq([...[3, 4].flatMap((t) => [3, 4, 5, 6, 7, 8, 9].map((k) => factId(t, k))), ...[3, 4, 5].map((k) => factId(9, k))]).filter((id) => !EASY.includes(id));
export const ANCHORS = ['6x7', '7x8', '6x8'];
export const ROTATE = ['6x6', '7x7', '8x8', '6x9', '7x9', '8x9'];
export const HARD = [...ANCHORS, ...ROTATE];
export const ALL_FACTS = uniq([2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((a) => [2, 3, 4, 5, 6, 7, 8, 9, 10].map((b) => factId(a, b)))); // 45 facts
const hash = (s) => { let h = 7; for (const c of String(s)) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0; return h; };
function take(rng, pool, n) { const p = pool.slice(), out = []; while (out.length < n && p.length) out.push(p.splice(Math.floor(rng() * p.length), 1)[0]); return out; }
// A parallel form: other facts of the same difficulty, factors turned around at random, in a seeded order.
export function warmupForm(pid, kind, n = 0) {
  const o = { rng: seedFrom(hash(`${pid}|${kind}|${n}`) >>> 0) }, rng = rngOn(o);
  const easy = take(rng, EASY, 4), ids = [...easy.slice(2), ...take(rng, MIDDLE, 4), ...ANCHORS, ...take(rng, ROTATE, 1)];
  const turn = (id) => { const [x, y] = parseFact(id); return rng() < 0.5 ? { id, a: x, b: y } : { id, a: y, b: x }; };
  const rest = ids.map(turn);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return [...easy.slice(0, 2).map(turn), ...rest];
}
// The 7-day check (German review M4) asks the SAME 12 facts as the post check, in a new seeded order.
export function keepForm(pid, post, n = 0) {
  if (!post || !post.items || !post.items.length) return warmupForm(pid, 'keep', n);
  const o = { rng: seedFrom(hash(`${pid}|keep|${n}`) >>> 0) }, rng = rngOn(o);
  const items = post.items.map((i) => ({ id: i.id, a: i.a, b: i.b }));
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
}
const beat = (L, id) => !!(L && L[id] && (L[id].medal || L[id].finishedOn));
// Which warm-up is due now (or null). A skipped one is offered once more on a later day. Only the newest stage is offered
// (a player who is already past the Moon does not get the 'pre' one too).
export function warmupDue(pd, today, { after = false } = {}) {
  if (typeof self !== 'undefined' && self.__tsNoWarmup) return null; // test-only switch (set by the browser tests before the app loads)
  const W = (pd.progress && pd.progress.warmups) || [], L = pd.levels || {};
  const of = (k) => W.filter((w) => w.kind === k), done = (k) => of(k).some((w) => !w.skipped);
  const ok = (k) => { if (done(k)) return false; const sk = of(k).filter((w) => w.skipped); return !sk.length || (sk.length < 2 && sk[sk.length - 1].day < today); };
  const post = of('post').find((w) => !w.skipped);
  if (post && daysBetween(post.day, today) >= 7 && ok('keep')) return 'keep';
  const stage = beat(L, 'rb-boss') ? 'post' : beat(L, 'x8-boss') ? 'mid2' : beat(L, 'x5-boss') ? 'mid1' : 'pre';
  if (stage === 'pre') return !after && !W.some((w) => !w.skipped) && ok('pre') ? 'pre' : null; // pre: before a level only
  return ok(stage) ? stage : null;
}
export function addWarmup(pd, rec) { pd.progress.warmups = [...(pd.progress.warmups || []), rec]; return rec; }
// v0.5 B2: the first item's time is not counted (orientation), and a 'Don't know' item is simply not right.
export const isFast = (i) => !!(i.right && !i.noTime && i.ms <= WU_FAST_MS);
export const scoreOf = (w) => ({ n: w.items.length, right: w.items.filter((i) => i.right).length, fast: w.items.filter(isFast).length });
// Fluent (German review 3.6): (1) the most recent typed warm-up answer to the fact was right in 5 s or less (timed),
// (2) it was also right on an earlier, different day (typed, or right first try in a level, where a landing only counts after
// Fox stands still), (3) no typed answer since then was wrong (follows from 1). upTo = the last warm-up to count.
export function fluentFacts(pd, upTo = null) {
  const W = ((pd.progress && pd.progress.warmups) || []).filter((w) => !w.skipped && (!upTo || w.at <= upTo.at));
  const last = {}, rightDays = {};
  for (const [id, f] of Object.entries(pd.facts || {})) for (const d of f.firstTryRightDays || []) (rightDays[id] ||= new Set()).add(d);
  for (const w of W) for (const i of w.items) { last[i.id] = { i, day: w.day }; if (i.right) (rightDays[i.id] ||= new Set()).add(w.day); }
  return ALL_FACTS.filter((id) => { const L = last[id]; if (!L || !isFast(L.i)) return false; return [...(rightDays[id] || [])].some((d) => d < L.day); });
}
// Facts asked at least once in a typed warm-up (the 'of n checked' on the parent panel).
export function checkedFacts(pd, upTo = null) {
  const W = ((pd.progress && pd.progress.warmups) || []).filter((w) => !w.skipped && (!upTo || w.at <= upTo.at));
  return uniq(W.flatMap((w) => w.items.map((i) => i.id)));
}
// Then vs now for the parent page. Never shown to the child.
export function thenVsNow(pd) {
  const W = ((pd.progress && pd.progress.warmups) || []).filter((w) => !w.skipped && w.items && w.items.length);
  if (!W.length) return null;
  const first = W[0], last = W[W.length - 1];
  const post = W.filter((w) => w.kind === 'post').pop(), keep = W.filter((w) => w.kind === 'keep').pop();
  let kept = null;
  if (post && keep) { const had = post.items.filter((i) => i.right).map((i) => i.id); const now = new Set(keep.items.filter((i) => i.right).map((i) => i.id));
    const asked = had.filter((id) => keep.items.some((i) => i.id === id)); // only facts asked in both (German review M4)
    kept = { k: asked.filter((id) => now.has(id)).length, n: asked.length }; }
  return { first: { ...scoreOf(first), day: first.day, kind: first.kind }, last: { ...scoreOf(last), day: last.day, kind: last.kind }, count: W.length,
    fluentThen: fluentFacts(pd, first).length, fluentNow: fluentFacts(pd).length, total: checkedFacts(pd).length, all: ALL_FACTS.length, post: post ? post.day : null, kept };
}
// A small CSV report the parent can save (nothing is sent anywhere).
export function reportCsv(pd) {
  const rows = [['warmup', 'kind', 'day', 'fact', 'typed', 'right', 'seconds']];
  ((pd.progress && pd.progress.warmups) || []).forEach((w, n) => { if (w.skipped) rows.push([n + 1, w.kind, w.day, '', '', 'skipped', '']); else for (const i of w.items) rows.push([n + 1, w.kind, w.day, `${i.a}x${i.b}`, i.dunno ? 'dont_know' : i.typed, i.right ? 1 : 0, i.noTime ? '' : (i.ms / 1000).toFixed(1)]); });
  const tv = thenVsNow(pd);
  if (tv) rows.push([], ['fluent_then', tv.fluentThen], ['fluent_now', tv.fluentNow], ['of_checked', tv.total]);
  return rows.map((r) => r.join(',')).join('\n') + '\n';
}
