// Seeded random numbers (mulberry32). The state lives in the saved run, so any gate can be reproduced.
// The game never uses the unseeded browser random function (build guard: tools/check-guards.mjs).
export function next(state) {
  let t = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { state: t, value: ((r ^ (r >>> 14)) >>> 0) / 4294967296 };
}
// A tiny wrapper that keeps its state on an object (obj.rng).
export function rngOn(obj) {
  return () => { const n = next(obj.rng | 0); obj.rng = n.state; return n.value; };
}
export function seedFrom(n) { return (Math.imul((n >>> 0) ^ 0x9e3779b9, 2654435761) >>> 0) | 0; }
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export function weighted(rng, items) { // items: [[value, weight]]
  const tot = items.reduce((s, [, w]) => s + w, 0); let x = rng() * tot;
  for (const [v, w] of items) { if ((x -= w) < 0) return v; }
  return items[items.length - 1][0];
}
