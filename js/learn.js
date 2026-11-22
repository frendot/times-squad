// Spaced repetition boxes, mastery tiers and helper mode (spec 7.2, 7.3, 7.6). Pure functions on a fact record.
import { CONFIG } from './config.js';
import { parseFact } from './facts.js';

export const TIERS = ['grey', 'bronze', 'silver', 'gold'];
const pad = (n) => String(n).padStart(2, '0');
export const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
export const daysBetween = (a, b) => {
  const f = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((f(b) - f(a)) / 86400000);
};
export const maxDay = (a, b) => (!a ? b : !b ? a : a > b ? a : b);

export function newFact(id) {
  const [a, b] = parseFact(id);
  return { factId: id, a, b, box: 0, tier: 'grey', introducedOn: null, lastPromotedOn: null, dueOn: null,
    firstTryRightDays: [], lastFirstTryTimesMs: [], rightOn3Gate: false, recentResults: [], helper: false,
    attempts: 0, firstTryRights: 0, misses: 0 };
}
export function introduce(f, today) {
  f.box = 1; f.introducedOn = today; f.lastPromotedOn = today; f.dueOn = today;
}
export const isDue = (f, today) => f.box >= 1 && f.dueOn && f.dueOn <= today;
const median = (xs) => { const s = xs.slice().sort((p, q) => p - q); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export function tierFor(f) {
  const days = f.firstTryRightDays.length;
  if (days >= CONFIG.GOLD_DAYS && f.lastFirstTryTimesMs.length >= 3 && median(f.lastFirstTryTimesMs.slice(-3)) <= CONFIG.GOLD_MEDIAN_MS && f.rightOn3Gate && !f.helper) return 'gold';
  if (days >= CONFIG.SILVER_DAYS) return 'silver';
  if (days >= 1) return 'bronze';
  return 'grey';
}
const raise = (f) => { const t = tierFor(f); if (TIERS.indexOf(t) > TIERS.indexOf(f.tier)) { const old = f.tier; f.tier = t; return old; } return null; };
function helperAfter(f, firstTryRight) {
  f.recentResults = [...f.recentResults, firstTryRight].slice(-5);
  if (!f.helper && f.recentResults.filter((x) => !x).length >= 2) f.helper = true;
  else if (f.helper && f.recentResults.length >= 2 && f.recentResults.slice(-2).every(Boolean)) f.helper = false;
}
// A first try on a normal or boss gate. Returns { tierUp: oldTier|null }.
export function firstTry(f, { right, timeMs, k, today }) {
  f.attempts++;
  helperAfter(f, right);
  if (right) {
    f.firstTryRights++;
    if (today > (f.lastPromotedOn || '')) {
      f.box = Math.min(5, f.box + 1); f.lastPromotedOn = today; f.dueOn = addDays(today, CONFIG.BOX_INTERVAL_DAYS[f.box]);
    }
    if (!f.firstTryRightDays.includes(today)) f.firstTryRightDays = [...f.firstTryRightDays, today].slice(-10);
    f.lastFirstTryTimesMs = [...f.lastFirstTryTimesMs, Math.max(0, Math.round(timeMs))].slice(-3);
    if (k === 3) f.rightOn3Gate = true;
  } else {
    f.misses++;
    f.box = Math.max(1, f.box - 1); f.dueOn = today;
  }
  return { tierUp: raise(f) };
}
