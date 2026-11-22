// Player data for v0.3. Same IndexedDB records as v0.1/v0.2: facts and attempts carry over, so the Times Map keeps its colours.
// v0.2's progress.runner block (coins, skins) is kept untouched but never shown (spec 12.2, D11).
export const defaultScroller = () => ({ acornsTotal: 0, unlocked: ['x2-L1'], timerVisible: true, jumpHelp: false });
export function newPlayerData(pid) {
  return { pid, progress: { schemaVersion: 3, howToSeen: false, scroller: defaultScroller() }, facts: {}, run: null, attempts: [], history: [], playtime: {}, levels: {}, ghosts: {} };
}
// v0.1 / v0.2 progress -> v0.3. Idempotent: running it twice changes nothing. Returns [progress, changed].
export function migrate(progress) {
  const p = { ...progress };
  let changed = false;
  if ((p.schemaVersion || 1) < 3) { p.howToSeen = false; p.schemaVersion = 3; changed = true; } // new controls: show the how-to once
  const sc = { ...defaultScroller(), ...(p.scroller || {}) };
  if (!Array.isArray(sc.unlocked) || !sc.unlocked.includes('x2-L1')) sc.unlocked = ['x2-L1', ...(Array.isArray(sc.unlocked) ? sc.unlocked : [])];
  if (JSON.stringify(sc) !== JSON.stringify(p.scroller)) { p.scroller = sc; changed = true; }
  return [p, changed];
}
export const LEVEL_IDS = ['x2-L1', 'x2-L2', 'x2-L3', 'x2-RR', 'spring-boss'];
export const nextLevel = (id) => LEVEL_IDS[LEVEL_IDS.indexOf(id) + 1] || null;
