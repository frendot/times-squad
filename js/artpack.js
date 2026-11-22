// Hand-painted sprite pack (PNG files in art/, listed in art/manifest.json, which the build makes from ART.md and the files).
// Every sprite is optional: if a file is not there, the game draws its built-in cartoon art instead (no errors).
const pack = { ready: false, list: [], img: {}, meta: {} };
const norm = (s) => s.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
export async function loadArt() {
  let man = null;
  try { const r = await fetch(new URL('../art/manifest.json', import.meta.url)); if (r.ok) man = await r.json(); } catch { man = null; }
  if (!man || !Array.isArray(man.sprites)) { pack.ready = true; return pack; }
  await Promise.all(man.sprites.map((s) => new Promise((ok) => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { pack.img[s.file] = im; pack.meta[s.file] = s; pack.list.push({ file: s.file, words: norm(s.key || s.file).split(' ') }); ok(); };
    im.onerror = () => ok();
    im.src = new URL('../art/' + s.file, import.meta.url).href;
  })));
  pack.ready = true; return pack;
}
// Find a sprite by words, e.g. art('fox', 'run'). Tries each alternative list in order. Returns { img, ax, ay, w, h } or null.
const cache = new Map();
export function art(...alts) {
  const key = JSON.stringify(alts);
  if (cache.has(key)) return cache.get(key);
  let hit = null;
  for (const a of alts) {
    const words = Array.isArray(a) ? a : [a];
    const cands = pack.list.filter((x) => words.every((w) => x.words.includes(w)));
    if (cands.length) { cands.sort((p, q) => p.words.length - q.words.length); hit = cands[0]; break; }
  }
  const out = hit ? (() => { const m = pack.meta[hit.file], im = pack.img[hit.file]; return { img: im, ax: m.anchor ? m.anchor[0] : 0.5, ay: m.anchor ? m.anchor[1] : 1, w: im.naturalWidth, h: im.naturalHeight, file: hit.file }; })() : null;
  if (pack.ready) cache.set(key, out);
  return out;
}
export const artReady = () => pack.ready;
export const artCount = () => pack.list.length;
export const artFile = (f) => (pack.img[f] ? new URL('../art/' + f, import.meta.url).href : null);
