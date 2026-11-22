// Player data for v0.4. Same IndexedDB records as v0.1-v0.3: facts and attempts carry over, so the Times Map keeps its colours.
// v0.2's progress.runner block (coins, skins) is kept untouched but never shown.
export { LEVEL_IDS, BOSS_IDS, CHAIN, nextLevel } from './levels.js';
import { CHAIN } from './levels.js';
export const defaultScroller = () => ({ acornsTotal: 0, unlocked: ['x2-L1'], timerVisible: true, jumpHelp: false, l1Missed: {}, l1Asked: {} });
export function newPlayerData(pid) {
  return { pid, progress: { schemaVersion: 4, howToSeen: false, scroller: defaultScroller() }, facts: {}, run: null, attempts: [], history: [], playtime: {}, levels: {}, ghosts: {} };
}
// v0.1 / v0.2 / v0.3 progress -> v0.4 progress. Idempotent: running it twice changes nothing. Returns [progress, changed].
export function migrate(progress) {
  const p = { ...progress };
  let changed = false;
  if ((p.schemaVersion || 1) < 3) { p.howToSeen = false; changed = true; } // new controls (v0.3): show the how-to once
  const old = p.scroller || {};
  const sc = { ...defaultScroller(), ...old };
  if ((p.schemaVersion || 1) < 4) {
    // v0.3 had 5 nodes (x2-L1, x2-L2, x2-L3, x2-RR, spring-boss). Map the unlocks onto the new chain.
    const u = new Set(['x2-L1']);
    const was = Array.isArray(old.unlocked) ? old.unlocked : [];
    if (was.some((id) => ['x2-L2', 'x2-L3', 'x2-RR', 'spring-boss'].includes(id))) u.add('x2-L2');
    if (was.some((id) => ['x2-L3', 'x2-RR', 'spring-boss'].includes(id))) u.add('x2-boss');
    sc.unlocked = CHAIN.filter((id) => u.has(id));
    // The v0.3 Review Road list becomes the x2 "missed in level 1" list, so x2 level 2 brings those facts back.
    if (Array.isArray(old.reviewList) && old.reviewList.length) { sc.l1Missed = { ...(sc.l1Missed || {}), 2: [...new Set(old.reviewList)] }; }
    sc.v3 = { unlocked: was, reviewList: old.reviewList || [] }; // kept for reference, never shown
    delete sc.reviewList;
    p.schemaVersion = 4; changed = true;
  }
  if (!Array.isArray(sc.unlocked) || !sc.unlocked.includes('x2-L1')) sc.unlocked = ['x2-L1', ...(Array.isArray(sc.unlocked) ? sc.unlocked : [])];
  if (!sc.l1Missed || typeof sc.l1Missed !== 'object') sc.l1Missed = {};
  if (!sc.l1Asked || typeof sc.l1Asked !== 'object') sc.l1Asked = {};
  if (JSON.stringify(sc) !== JSON.stringify(p.scroller)) { p.scroller = sc; changed = true; }
  return [p, changed];
}
// v0.3 level records and ghosts -> v0.4 ids (the old layouts are gone, so old best times cannot be compared).
// Medals, Brain Stars and plays are kept; old ghosts are kept under "<old id>@v3" (never replayed: a different course).
// Returns { levels, ghosts, put: [[store, id, value]], del: [[store, id]] }. Idempotent: v0.4 ids are left alone.
const MAP3 = { 'x2-L1': 'x2-L1', 'x2-L2': 'x2-L2', 'x2-L3': 'x2-L2', 'spring-boss': 'x2-boss' };
export function migrateLevels(levels, ghosts) {
  const L = { ...levels }, G = { ...ghosts }, put = [], del = [];
  const old = Object.keys(L).filter((id) => L[id] && !L[id].v4 && (id in MAP3 || id === 'x2-RR'));
  if (!old.length) return { levels: L, ghosts: G, put, del, changed: false };
  const fresh = {};
  for (const id of old) {
    const r = L[id], to = MAP3[id];
    put.push(['levels', id + '@v3', { ...r }]); L[id + '@v3'] = { ...r };
    if (to) {
      const n = fresh[to] || { bestSteps: null, medal: 0, brainStar: false, plays: 0, ghostOn: true, finishedOn: null, v4: true, fromV3: [] };
      n.medal = Math.max(n.medal, r.medal || 0); n.brainStar = n.brainStar || !!r.brainStar; n.plays += r.plays || 0;
      n.finishedOn = [n.finishedOn, r.finishedOn].filter(Boolean).sort().pop() || null;
      n.fromV3.push({ id, bestSteps: r.bestSteps ?? null, medal: r.medal || 0 });
      fresh[to] = n;
    }
    delete L[id]; del.push(['levels', id]);
    if (G[id]) { G[id + '@v3'] = G[id]; put.push(['ghosts', id + '@v3', G[id]]); delete G[id]; del.push(['ghosts', id]); }
  }
  for (const [id, n] of Object.entries(fresh)) { L[id] = n; put.push(['levels', id, n]); }
  return { levels: L, ghosts: G, put, del, changed: true };
}
// Unlock repair, run on every load (v0.4 hotfix). A node counts as done when it has a medal or a finish date (boss wins too).
// 1) every node up to the furthest unlocked or done node is open (no gaps); 2) a done node opens the next one.
// Never removes an unlock. Returns true if it changed anything.
export const isDone = (r) => !!(r && (r.medal || r.finishedOn));
export function repairUnlocks(sc, levels) {
  if (!Array.isArray(sc.unlocked)) sc.unlocked = ['x2-L1'];
  const before = sc.unlocked.join();
  let far = 0;
  CHAIN.forEach((id, i) => { if (sc.unlocked.includes(id) || isDone(levels[id])) far = i; });
  for (let i = 0; i <= far; i++) if (isDone(levels[CHAIN[i]]) && i + 1 < CHAIN.length) far = Math.max(far, i + 1);
  const open = new Set([...sc.unlocked, ...CHAIN.slice(0, far + 1)]);
  sc.unlocked = [...CHAIN.filter((id) => open.has(id)), ...sc.unlocked.filter((id) => !CHAIN.includes(id))];
  return sc.unlocked.join() !== before;
}
