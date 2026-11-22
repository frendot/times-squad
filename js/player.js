// Player data for v0.2. Same IndexedDB records as v0.1 (facts and attempts are shared, so the Times Map carries over).
// New runner fields live in progress.runner; older saves get them added on load (safe migration, nothing is removed).
import { CONFIG } from './config.js';

export const SKINS = [
  { id: 'skin_basic', cost: 0, color: null }, { id: 'skin_sky', cost: 60, color: '#4fa3ff' }, { id: 'skin_mint', cost: 120, color: '#38c99a' },
  { id: 'skin_sun', cost: 200, color: '#ffc531' }, { id: 'skin_berry', cost: 320, color: '#c158dc' }, { id: 'skin_star', cost: 500, color: '#ff6f91', star: true },
];
export const BLASTERS = [
  { id: 'blaster_basic', cost: 0, color: '#7ee8fa' }, { id: 'blaster_lime', cost: 80, color: '#b6f35a' }, { id: 'blaster_fire', cost: 180, color: '#ff9f43' },
  { id: 'blaster_rainbow', cost: 400, color: 'rainbow' },
];
export const defaultRunner = () => ({ coins: 0, owned: ['skin_basic', 'blaster_basic'], skin: 'skin_basic', blaster: 'blaster_basic',
  best: 0, bestScore: 0, runs: 0, totalM: 0, bosses: 0, coinsEver: 0, tierCoinsPaid: {} });
export function newPlayerData(pid) {
  return { pid, progress: { schemaVersion: 2, howToSeen: false, runner: defaultRunner() }, facts: {}, run: null, attempts: [], history: [], playtime: {} };
}
// v0.1 progress -> v0.2: keep every old field, add the runner block.
export function migrate(progress) {
  const p = { ...progress };
  p.runner = { ...defaultRunner(), ...(progress.runner || {}) };
  if (!Array.isArray(p.runner.owned)) p.runner.owned = ['skin_basic', 'blaster_basic'];
  for (const id of ['skin_basic', 'blaster_basic']) if (!p.runner.owned.includes(id)) p.runner.owned.push(id);
  if ((p.schemaVersion || 1) < 2) { p.howToSeen = false; p.schemaVersion = 2; } // new controls: show the how-to once
  return p;
}
export const skinOf = (pd) => SKINS.find((s) => s.id === pd.progress.runner.skin) || SKINS[0];
export const blasterOf = (pd) => BLASTERS.find((s) => s.id === pd.progress.runner.blaster) || BLASTERS[0];
export function buy(pd, item) {
  const R = pd.progress.runner;
  if (R.owned.includes(item.id)) return 'owned';
  if (R.coins < item.cost) return 'short';
  R.coins -= item.cost; R.owned.push(item.id); return 'ok';
}
// Coins for mastering tables: paid once per fact per tier.
export function tierCoins(pd, factId, tier) {
  const R = pd.progress.runner, key = factId + ':' + tier;
  if (!CONFIG.TIER_COINS[tier] || R.tierCoinsPaid[key]) return 0;
  R.tierCoinsPaid[key] = 1; return CONFIG.TIER_COINS[tier];
}
