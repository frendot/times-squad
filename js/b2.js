// v0.5 Drop B2: pure helpers for shuttle parts, the score and the Share Door (no DOM, tested in tools/b2-test.mjs).
import { rngOn, seedFrom } from './rng.js';
// each world adds one shuttle part (v05-design.md (b)); a level hides 3 parts, so a world has 6
export const PART_WORLDS = ['x2', 'x10', 'x5', 'x3', 'x4', 'x9', 'x6', 'x8', 'x7', 'rb'];
export const PARTS_PER_LEVEL = 3;
export const PARTS_PER_WORLD = 6;
export const levelsOfWorld = (wd) => (wd === 'rb' ? ['rb-L1', 'rb-L2', 'rb-L3'] : [wd + '-L1', wd + '-L2']);
export const partsMax = (wd) => levelsOfWorld(wd).length * PARTS_PER_LEVEL;
// parts found in a world (saved per level as a list of part numbers 0..2)
export function partsFound(pd, wd) { const P = (pd.progress && pd.progress.parts) || {}; return levelsOfWorld(wd).reduce((s, id) => s + (Array.isArray(P[id]) ? new Set(P[id]).size : 0), 0); }
// the world part is on the shuttle once the world boss is beaten; it shines gold with all parts found
export const worldBeaten = (pd, wd) => !!(pd.levels && pd.levels[wd + '-boss'] && pd.levels[wd + '-boss'].medal);
export const worldGold = (pd, wd) => partsFound(pd, wd) >= partsMax(wd);
export function addPart(pd, levelId, i) {
  const P = pd.progress.parts = pd.progress.parts || {}; const had = new Set(P[levelId] || []);
  const isNew = !had.has(i); had.add(i); P[levelId] = [...had].sort((a, b) => a - b); return isNew;
}
// ---- the score (v05-design.md (c)): 100 per right answer, 50 per part, 10 per second faster than the goal time ----
export const PTS_RIGHT = 100, PTS_PART = 50, PTS_SECOND = 10;
export function scoreFor({ right, parts, steps, goalSteps }) {
  const faster = Math.max(0, Math.floor((goalSteps - steps) / 60));
  const lines = { right: right * PTS_RIGHT, parts: parts * PTS_PART, speed: faster * PTS_SECOND };
  return { ...lines, faster, total: lines.right + lines.parts + lines.speed };
}
// ---- the Share Door (division bonus, no remainders): ? x n = p, then p : n = ?, then the fact family ----
export const SHARE_TABLES = { x2: 2, x10: 10, x5: 5, x3: 3, x4: 4, x9: 9, x6: 6, x8: 8, x7: 7 };
export function shareDoor(pid, wd, day) {
  const n = SHARE_TABLES[wd]; if (!n) return null;
  const st = { rng: seedFrom([...`${pid}|${wd}|${day}`].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)) }; const rng = rngOn(st);
  const k = 2 + Math.floor(rng() * 8); // 2..9 groups of n (never 1 or 10, so it is a real share)
  const p = k * n;
  const near = (v) => { const s = new Set([v]); let d = 1; while (s.size < 3) { for (const c of [v + d, v - d]) if (c >= 1 && c <= 10 && s.size < 3) s.add(c); d++; } return [...s].sort(() => rng() - 0.5); };
  return { n, k, p, choices1: near(k), choices2: near(k), family: [[k, n, p, 'x'], [n, k, p, 'x'], [p, n, k, ':'], [p, k, n, ':']] };
}
export function addSticker(pd, wd) { const s = new Set(pd.progress.stickers || []); const isNew = !s.has(wd); s.add(wd); pd.progress.stickers = PART_WORLDS.filter((w) => s.has(w)); return isNew; }
