// On-device storage (spec 11): IndexedDB "times-squad". Nothing leaves the device. Each player (animal icon) has its own
// progress, facts, run, history and play time, keyed by the player id. If IndexedDB is not available the game runs from memory.
import { CONFIG } from './config.js';
import { newPlayerData, migrate, migrateLevels, repairUnlocks, CHAIN } from './player.js';
export { migrate };

const DB = 'times-squad', VER = 2; // v0.3: IDB version 2 adds 'levels' and 'ghosts' (spec 12.2); nothing is removed
let db = null, mem = {};
const STORES = ['settings', 'progress', 'facts', 'attempts', 'run', 'history', 'playtime', 'levels', 'ghosts'];
export const defaultSettings = (today) => ({ schemaVersion: 3, sound: true, music: false, installTipDismissed: false, installTipLastShownOn: null,
  createdOn: today, lastSeenDay: today, lastPlayer: null });

const req = (r) => new Promise((ok, bad) => { r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
export async function open() {
  try {
    if (!('indexedDB' in self)) throw new Error('no idb');
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of ['settings', 'progress', 'facts', 'run', 'playtime', 'levels', 'ghosts']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
      for (const s of ['attempts', 'history']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { autoIncrement: true }).createIndex('pid', 'pid');
    };
    db = await req(r);
    db.onversionchange = () => { try { db.close(); } catch { /* closed */ } db = null; }; // reopened on the next write
    db.onclose = () => { db = null; }; // e.g. iOS drops the connection after the app was in the background: reopen on the next write
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (e) { db = null; mem = mem || {}; }
  return !!db;
}
// v0.4 hotfix: writes never fail silently for good. If a write fails (lost connection), reopen the database and try once more.
let opening = null;
async function ensure() { if (db) return true; if (!('indexedDB' in self)) return false; opening = opening || open().finally(() => { opening = null; }); return opening; }
async function write(fn) {
  for (let k = 0; k < 2; k++) {
    try { if (!(await ensure())) return false; await fn(); return true; } catch (e) { try { db && db.close(); } catch { /* closed */ } db = null; }
  }
  return false;
}
// Progress is written as a merge: unlocks are never taken away by an older copy (for example a second tab that was open).
export function mergeProgress(stored, mine) {
  if (!stored || !stored.scroller) return mine;
  const a = stored.scroller.unlocked || [], b = mine.scroller.unlocked || [];
  const all = [...new Set([...b, ...a])];
  const out = { ...mine, scroller: { ...mine.scroller, unlocked: [...CHAIN.filter((id) => all.includes(id)), ...all.filter((id) => !CHAIN.includes(id))],
    acornsTotal: Math.max(mine.scroller.acornsTotal || 0, stored.scroller.acornsTotal || 0) }, howToSeen: !!(mine.howToSeen || stored.howToSeen) };
  return out;
}
function putProgress(t, pd) {
  const st = t.objectStore('progress'), r = st.get(pd.pid);
  r.onsuccess = () => { const m = mergeProgress(r.result, pd.progress); pd.progress.scroller.unlocked = m.scroller.unlocked; pd.progress.scroller.acornsTotal = m.scroller.acornsTotal; st.put(pd.progress, pd.pid); };
  mirror(pd);
}
// A small second copy of the unlocks in localStorage, so a lost database write can never lock a child out.
const MIRROR = (pid) => 'times-squad-unlocked:' + pid;
function mirror(pd) { try { localStorage.setItem(MIRROR(pd.pid), JSON.stringify(pd.progress.scroller.unlocked || [])); } catch { /* storage off */ } }
export function readMirror(pid) { try { const v = JSON.parse(localStorage.getItem(MIRROR(pid)) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; } }
function tx(stores, mode = 'readonly') { return db.transaction(stores, mode); }
const done = (t) => new Promise((ok, bad) => { t.oncomplete = () => ok(); t.onerror = () => bad(t.error); t.onabort = () => bad(t.error); });

export async function loadSettings(today) {
  const d = defaultSettings(today);
  if (!db) return { ...d, ...(mem.settings || {}) };
  try { const s = await req(tx(['settings']).objectStore('settings').get('settings')); return { ...d, ...(s || {}), schemaVersion: 3 }; } catch { return d; }
}
export async function saveSettings(s) {
  if (!db) { mem.settings = { ...s }; return; }
  try { const t = tx(['settings'], 'readwrite'); t.objectStore('settings').put(s, 'settings'); await done(t); } catch { /* keep going from memory */ }
}
const byPid = async (store, pid) => req(tx([store]).objectStore(store).index('pid').getAll(IDBKeyRange.only(pid)));
export async function loadPlayer(pid) {
  const pd = newPlayerData(pid);
  if (!db) await ensure();
  if (!db) return mem['p:' + pid] || (mem['p:' + pid] = pd);
  try {
    const t = tx(['progress', 'facts', 'run', 'playtime', 'levels', 'ghosts']);
    const range = IDBKeyRange.bound(pid + ':', pid + ':\uffff');
    const [prog, facts, run, play, lv, lvKeys, gh, ghKeys] = await Promise.all([
      req(t.objectStore('progress').get(pid)),
      req(t.objectStore('facts').getAll(IDBKeyRange.bound(pid + ':', pid + ':\uffff'))),
      req(t.objectStore('run').get(pid)),
      req(t.objectStore('playtime').getAll(IDBKeyRange.bound(pid + ':', pid + ':\uffff'))),
      req(t.objectStore('levels').getAll(range)), req(t.objectStore('levels').getAllKeys(range)),
      req(t.objectStore('ghosts').getAll(range)), req(t.objectStore('ghosts').getAllKeys(range)),
    ]);
    // Migration per player on load (spec 12.2): progress -> schemaVersion 3; a v0.2 runner run (no "kind") is deleted.
    const [p3, changed] = migrate(prog ? { ...prog } : pd.progress);
    pd.progress = p3;
    (lvKeys || []).forEach((k, i) => { pd.levels[k.slice(pid.length + 1)] = lv[i]; });
    (ghKeys || []).forEach((k, i) => { pd.ghosts[k.slice(pid.length + 1)] = gh[i]; });
    // v0.4: v0.3 level records and ghosts move to the new level ids (medals, Brain Stars, plays and ghosts are kept).
    const mv = migrateLevels(pd.levels, pd.ghosts);
    if (mv.changed) {
      pd.levels = mv.levels; pd.ghosts = mv.ghosts;
      const w2 = tx(['levels', 'ghosts'], 'readwrite');
      for (const [s, id] of mv.del) w2.objectStore(s).delete(pid + ':' + id);
      for (const [s, id, v] of mv.put) w2.objectStore(s).put(v, pid + ':' + id);
      await done(w2);
    }
    const mir = readMirror(pid).filter((id) => CHAIN.includes(id) && !pd.progress.scroller.unlocked.includes(id));
    if (mir.length) { const all = new Set([...pd.progress.scroller.unlocked, ...mir]); pd.progress.scroller.unlocked = CHAIN.filter((id) => all.has(id)); }
    const fixed = repairUnlocks(pd.progress.scroller, pd.levels) || mir.length > 0;
    const v3run = run && run.kind === 'level' && !run.v4; // a v0.3 checkpoint belongs to an old course
    const oldRun = (run && !run.kind) || v3run;
    if (prog && (changed || oldRun || fixed)) {
      const w = tx(['progress', 'run'], 'readwrite'); w.objectStore('progress').put(pd.progress, pid); if (oldRun) w.objectStore('run').delete(pid); await done(w);
    }
    if (prog || mir.length) mirror(pd);
    for (const f of facts || []) { const { pid: _p, ...rest } = f; pd.facts[f.factId] = rest; }
    pd.run = run && run.kind && !v3run ? run : null;
    pd.playtime = Object.fromEntries((play || []).map((p) => [p.day, p.activeSeconds]));
    const atts = await byPid('attempts', pid);
    pd.attempts = (atts || []).slice(-CONFIG.ATTEMPTS_KEEP).map(({ pid: _p, ...a }) => a);
    pd.history = (await byPid('history', pid) || []).slice(-CONFIG.HISTORY_KEEP).map(({ pid: _p, ...h }) => h);
  } catch { /* fresh start, no message for the child */ }
  return pd;
}
// One transaction after every gate: facts, attempts, run and progress (spec 11 rules).
export async function saveGate(pd, { factIds = [], attempts = [], history = null, keepRun = false } = {}) {
  if (!db && !('indexedDB' in self)) return;
  mirror(pd);
  await write(async () => {
    const t = tx(['progress', 'facts', 'attempts', 'run', 'history'], 'readwrite');
    putProgress(t, pd);
    for (const id of factIds) if (pd.facts[id]) t.objectStore('facts').put({ ...pd.facts[id], pid: pd.pid }, pd.pid + ':' + id);
    for (const a of attempts) t.objectStore('attempts').add({ ...a, pid: pd.pid });
    if (history) t.objectStore('history').add({ ...history, pid: pd.pid });
    if (!keepRun) { if (pd.run) t.objectStore('run').put(pd.run, pd.pid); else t.objectStore('run').delete(pd.pid); }
    await done(t);
  }); // the game keeps running from memory; the next gate writes again
}
export async function saveAll(pd) { await saveGate(pd, { factIds: Object.keys(pd.facts) }); }
export async function addPlaytime(pid, day, secs) {
  if (!db) return;
  try {
    const t = tx(['playtime'], 'readwrite'); const s = t.objectStore('playtime'); const k = pid + ':' + day;
    const cur = await req(s.get(k));
    s.put({ day, activeSeconds: ((cur && cur.activeSeconds) || 0) + secs }, k);
    await done(t);
  } catch { /* ignore */ }
}
export async function playtimeFor(pid) {
  if (!db) return {};
  try { const all = await req(tx(['playtime']).objectStore('playtime').getAll(IDBKeyRange.bound(pid + ':', pid + ':\uffff'))); return Object.fromEntries(all.map((p) => [p.day, p.activeSeconds])); } catch { return {}; }
}
// Small summary per player for the picker (power level and best stars).
export async function playerSummaries() {
  const out = {};
  if (!db) { for (const p of CONFIG.PLAYERS) { const pd = mem['p:' + p]; if (pd) out[p] = pd.progress; } return out; }
  try { const t = tx(['progress']); for (const p of CONFIG.PLAYERS) { const v = await req(t.objectStore('progress').get(p)); if (v) out[p] = v; } } catch { /* none */ }
  return out;
}
export async function resetPlayer(pid) {
  try { localStorage.removeItem(MIRROR(pid)); } catch { /* storage off */ }
  if (!db) { delete mem['p:' + pid]; return; }
  try {
    const t = tx(STORES.filter((s) => s !== 'settings'), 'readwrite');
    t.objectStore('progress').delete(pid); t.objectStore('run').delete(pid);
    for (const s of ['facts', 'levels', 'ghosts']) t.objectStore(s).delete(IDBKeyRange.bound(pid + ':', pid + ':\uffff'));
    t.objectStore('playtime').delete(IDBKeyRange.bound(pid + ':', pid + ':\uffff'));
    for (const s of ['attempts', 'history']) {
      const keys = await req(t.objectStore(s).index('pid').getAllKeys(IDBKeyRange.only(pid)));
      for (const k of keys) t.objectStore(s).delete(k);
    }
    await done(t);
  } catch { /* ignore */ }
}
// Reset everything: delete and recreate the database (spec 11).
export async function resetAll() {
  try { for (const p of CONFIG.PLAYERS) localStorage.removeItem(MIRROR(p)); } catch { /* storage off */ }
  if (!db) { mem = {}; return; }
  db.close(); db = null;
  try { await req(indexedDB.deleteDatabase(DB)); } catch { /* ignore */ }
  await open();
}
export async function pruneAttempts(pid) {
  if (!db) return;
  try {
    const t = tx(['attempts'], 'readwrite');
    const keys = await req(t.objectStore('attempts').index('pid').getAllKeys(IDBKeyRange.only(pid)));
    for (const k of keys.slice(0, Math.max(0, keys.length - CONFIG.ATTEMPTS_KEEP))) t.objectStore('attempts').delete(k);
    await done(t);
  } catch { /* ignore */ }
}

// v0.3: one level result (best time, medal, Brain Star, ghost) and the checkpoint run record.
export async function saveLevel(pd, levelId, { ghost = null } = {}) {
  mirror(pd);
  await write(async () => {
    const t = tx(['progress', 'levels', 'ghosts'], 'readwrite');
    putProgress(t, pd);
    if (pd.levels[levelId]) t.objectStore('levels').put(pd.levels[levelId], pd.pid + ':' + levelId);
    if (ghost) t.objectStore('ghosts').put(ghost, pd.pid + ':' + levelId);
    await done(t);
  });
}
export async function saveRun(pd) {
  await write(async () => { const t = tx(['run'], 'readwrite'); if (pd.run) t.objectStore('run').put(pd.run, pd.pid); else t.objectStore('run').delete(pd.pid); await done(t); });
}
export async function saveProgress(pd) {
  mirror(pd);
  await write(async () => { const t = tx(['progress'], 'readwrite'); putProgress(t, pd); await done(t); });
}
