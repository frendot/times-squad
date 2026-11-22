// On-device storage (spec 11): IndexedDB "times-squad". Nothing leaves the device. Each player (animal icon) has its own
// progress, facts, run, history and play time, keyed by the player id. If IndexedDB is not available the game runs from memory.
import { CONFIG } from './config.js';
import { newPlayerData, migrate } from './player.js';
export { migrate };

const DB = 'times-squad', VER = 2; // v0.3: IDB version 2 adds 'levels' and 'ghosts' (spec 12.2); nothing is removed
let db = null, mem = null;
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
    db.onversionchange = () => { db.close(); db = null; };
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (e) { db = null; mem = mem || {}; }
  return !!db;
}
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
    const oldRun = run && !run.kind;
    if (prog && (changed || oldRun)) {
      const w = tx(['progress', 'run'], 'readwrite'); w.objectStore('progress').put(pd.progress, pid); if (oldRun) w.objectStore('run').delete(pid); await done(w);
    }
    for (const f of facts || []) { const { pid: _p, ...rest } = f; pd.facts[f.factId] = rest; }
    pd.run = run && run.kind ? run : null;
    pd.playtime = Object.fromEntries((play || []).map((p) => [p.day, p.activeSeconds]));
    const atts = await byPid('attempts', pid);
    pd.attempts = (atts || []).slice(-CONFIG.ATTEMPTS_KEEP).map(({ pid: _p, ...a }) => a);
    pd.history = (await byPid('history', pid) || []).slice(-CONFIG.HISTORY_KEEP).map(({ pid: _p, ...h }) => h);
  } catch { /* fresh start, no message for the child */ }
  return pd;
}
// One transaction after every gate: facts, attempts, run and progress (spec 11 rules).
export async function saveGate(pd, { factIds = [], attempts = [], history = null, keepRun = false } = {}) {
  if (!db) return;
  try {
    const t = tx(['progress', 'facts', 'attempts', 'run', 'history'], 'readwrite');
    t.objectStore('progress').put(pd.progress, pd.pid);
    for (const id of factIds) if (pd.facts[id]) t.objectStore('facts').put({ ...pd.facts[id], pid: pd.pid }, pd.pid + ':' + id);
    for (const a of attempts) t.objectStore('attempts').add({ ...a, pid: pd.pid });
    if (history) t.objectStore('history').add({ ...history, pid: pd.pid });
    if (!keepRun) { if (pd.run) t.objectStore('run').put(pd.run, pd.pid); else t.objectStore('run').delete(pd.pid); }
    await done(t);
  } catch { /* the game keeps running from memory; the next gate writes again */ }
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
  if (!db) return;
  try {
    const t = tx(['progress', 'levels', 'ghosts'], 'readwrite');
    t.objectStore('progress').put(pd.progress, pd.pid);
    if (pd.levels[levelId]) t.objectStore('levels').put(pd.levels[levelId], pd.pid + ':' + levelId);
    if (ghost) t.objectStore('ghosts').put(ghost, pd.pid + ':' + levelId);
    await done(t);
  } catch { /* keep going from memory */ }
}
export async function saveRun(pd) {
  if (!db) return;
  try { const t = tx(['run'], 'readwrite'); if (pd.run) t.objectStore('run').put(pd.run, pd.pid); else t.objectStore('run').delete(pd.pid); await done(t); } catch { /* ignore */ }
}
export async function saveProgress(pd) {
  if (!db) return;
  try { const t = tx(['progress'], 'readwrite'); t.objectStore('progress').put(pd.progress, pd.pid); await done(t); } catch { /* ignore */ }
}
