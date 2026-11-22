// Pseudo-3D cartoon renderer (canvas 2D): parallax jungle-temple sky, a curving, rolling track, props, monsters, the boss,
// the runner with a run cycle and squash-and-stretch, particles and screen shake. Visual randomness uses its own seeded generator.
import { CONFIG as C } from './config.js';
import { INK, mk, blob, eye, buildSprites, drawPowerIcon } from './sprites.js';
import { art, artReady } from './artpack.js';

const FAR = 130, ZC = 6;
let cv, g, W = 0, H = 0, DPR = 1, S = null, BG = null, SC0, F, CAMH, HZ;
let vseed = 12345;
const vr = () => { vseed = (Math.imul(vseed, 1664525) + 1013904223) | 0; return (vseed >>> 0) / 4294967296; };
const R = { shake: 0, parts: [], pops: [], flash: 0, flashCol: '#fff', camX: 0, runPhase: 0, squash: 0, lastY: 0, bossX: 0, bossHitT: -9, bossCream: 0, beam: null, frameMs: [], lastFrame: 0 };
export const RSTATE = R;
const ANIMAL = {
  fox: { body: '#f0883a', belly: '#fff3e0', ear: 'pointy', tail: true },
  panda: { body: '#ffffff', belly: '#2b2238', ear: 'round', dark: '#2b2238' },
  frog: { body: '#5cbf4a', belly: '#c8f0a8', ear: 'none' },
  owl: { body: '#a8704a', belly: '#f2dcc0', ear: 'tuft' },
};
export function init(canvas) {
  cv = canvas; g = cv.getContext('2d', { alpha: false });
  S = buildSprites(); resize();
}
export function resize() {
  const r = cv.getBoundingClientRect();
  DPR = Math.min(2, self.devicePixelRatio || 1);
  W = Math.max(200, r.width); H = Math.max(200, r.height);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  SC0 = Math.min(W * 0.92, H * 0.78) / (3 * C.LANE_W);
  F = SC0 * ZC; HZ = H * 0.33; CAMH = (H * 0.8 - HZ) / SC0;
  BG = buildBackground();
}
// ---- projection with visual curves and hills ----
let curve = 0, hill = 0;
function P(x, y, z) {
  const d = z + ZC; if (d < 0.4) return null;
  const sc = F / d;
  return { x: W / 2 + (x + curve * z * z - R.camX) * sc, y: HZ + (CAMH - y - hill * z * z) * sc, sc };
}
// ---- background: 4 parallax layers, built once per size ----
function buildBackground() {
  const w = Math.ceil(W * 2.2), h = Math.ceil(HZ + 40);
  const sky = mk(W, h, (q) => {
    const k = q.createLinearGradient(0, 0, 0, h); k.addColorStop(0, '#36c5ff'); k.addColorStop(0.6, '#9ff0ff'); k.addColorStop(1, '#fff3b0'); q.fillStyle = k; q.fillRect(0, 0, W, h);
    const sx = W * 0.72, sy = h * 0.34; const s = q.createRadialGradient(sx, sy, 5, sx, sy, W * 0.35); s.addColorStop(0, 'rgba(255,255,210,1)'); s.addColorStop(0.15, 'rgba(255,240,150,.9)'); s.addColorStop(1, 'rgba(255,240,150,0)'); q.fillStyle = s; q.fillRect(0, 0, W, h);
  });
  const layer = (seed, base, top, col, line, kind) => mk(w, h, (q) => {
    let s = seed; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 4294967296; };
    q.lineJoin = 'round'; q.beginPath(); q.moveTo(0, h);
    if (kind === 'mount') { let x = 0; while (x < w + 80) { const pw = 120 + rnd() * 160, ph = top + rnd() * (base - top); q.lineTo(x + pw / 2, h - ph); q.lineTo(x + pw, h - (base - top) * 0.25 - top * 0.3); x += pw * 0.8; } }
    else { let x = 0; while (x < w + 60) { const r = 30 + rnd() * 50; const yy = h - base - rnd() * (top - base); q.arc(x + r, yy, r, Math.PI, 0); x += r * 1.6; } }
    q.lineTo(w, h); q.closePath(); q.fillStyle = col; q.fill(); q.lineWidth = line; q.strokeStyle = 'rgba(27,18,48,.55)'; q.stroke();
    if (kind === 'mount') { // temple on a peak
      for (let i = 0; i < 3; i++) { const tx = (0.15 + i * 0.33 + rnd() * 0.1) * w, ty = h - top * 0.9; q.fillStyle = 'rgba(255,255,255,.18)';
        for (let k = 0; k < 4; k++) { const bw = 70 - k * 15; q.fillRect(tx - bw / 2, ty - k * 14, bw, 14); } }
    }
  });
  const haze = mk(W, 140, (q) => { const k = q.createLinearGradient(0, 0, 0, 140); k.addColorStop(0, 'rgba(220,250,255,0)'); k.addColorStop(0.45, 'rgba(220,250,255,.75)'); k.addColorStop(1, 'rgba(220,250,255,0)'); q.fillStyle = k; q.fillRect(0, 0, W, 140); });
  const vig = mk(W, H, (q) => { const k = q.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75); k.addColorStop(0, 'rgba(27,18,48,0)'); k.addColorStop(1, 'rgba(27,18,48,.35)'); q.fillStyle = k; q.fillRect(0, 0, W, H); });
  return { haze, vig, sky, far: layer(7, HZ * 0.55, HZ * 0.25, '#8f7be8', 4, 'mount'), mid: layer(11, HZ * 0.35, HZ * 0.18, '#4fb3a3', 5, 'mount'),
    near: layer(23, 20, 70, '#2f9e55', 6, 'hills'), w, h };
}
function bgLayers() {
  if (R.bgl !== undefined) return R.bgl;
  if (!artReady()) return null;
  const L = []; for (const k of [['sky'], ['bg', '1'], ['far'], ['bg', '2'], ['mid'], ['bg', '3'], ['near'], ['bg', '4'], ['background', '1'], ['background', '2'], ['background', '3'], ['background', '4'], ['parallax', '1'], ['parallax', '2'], ['parallax', '3'], ['parallax', '4']]) { const a = art(k); if (a && !L.includes(a)) L.push(a); }
  R.bgl = L.length ? L : null; return R.bgl;
}
function drawBackground(t, dist) {
  const L = bgLayers();
  if (L) {
    // A tall painted backdrop (portrait image) covers the screen, top-aligned, with a little sideways parallax.
    // Wide layers are tiled as bands that sit on the horizon, nearer ones moving faster.
    const back = L.find((a) => a.h > a.w), bands = L.filter((a) => a !== back);
    if (back) { const sc = Math.max((W * 1.12) / back.w, (HZ + 40) / (back.h * 0.62)), bw = back.w * sc, bh = back.h * sc; const ox = (W - bw) / 2 - (curve * 2500 + R.camX * 6); const oy = Math.min(-bh * 0.04, HZ - 40 - bh * 0.24); g.drawImage(back.img, ox, oy - hill * 1500, bw, bh); } // wide screens: slide up so the temple sits above the horizon
    else { g.drawImage(BG.sky, 0, 0, W, BG.h); }
    bands.forEach((a, i) => { const k = (i + 1) / bands.length; const h = Math.min(HZ * 0.5, 260) * (0.8 + 0.3 * k), wd = h * a.w / a.h; const off = ((curve * 9000 * k + dist * 0.6 * k + R.camX * 20 * k) % wd + wd) % wd;
      const scroll = curve * 9000 * k + dist * 0.6 * k + R.camX * 20 * k, n0 = Math.floor(scroll / wd), y0 = HZ + 6 - h - hill * 4000 * k;
      // the strip is not seamless, so every other copy is mirrored
      for (let x = -off, n = n0; x < W; x += wd, n++) { if (n & 1) { g.save(); g.translate(x + wd, y0); g.scale(-1, 1); g.drawImage(a.img, 0, 0, wd + 1, h); g.restore(); } else g.drawImage(a.img, x, y0, wd + 1, h); } });
    return;
  }
  g.drawImage(BG.sky, 0, 0, W, BG.h);
  // slow sun rays
  const sx = W * 0.72, sy = BG.h * 0.34; g.save(); g.translate(sx, sy); g.rotate(t * 0.05); g.fillStyle = 'rgba(255,255,220,.13)';
  for (let i = 0; i < 9; i++) { g.rotate(Math.PI * 2 / 9); g.beginPath(); g.moveTo(0, 0); g.lineTo(W, -60); g.lineTo(W, 60); g.closePath(); g.fill(); }
  g.restore();
  // clouds
  g.fillStyle = 'rgba(255,255,255,.9)';
  for (let i = 0; i < 4; i++) { const x = ((i * 180 - t * (8 + i * 3) - curve * 4000) % (W + 200) + W + 200) % (W + 200) - 100, y = 30 + i * 28; g.beginPath(); g.arc(x, y, 22, 0, 7); g.arc(x + 26, y - 8, 26, 0, 7); g.arc(x + 54, y, 20, 0, 7); g.fill(); }
  const lay = (img, k, yoff) => { const off = ((-(curve * 9000 * k) - dist * 0.4 * k - R.camX * 20 * k) % W + W) % W; g.drawImage(img, -off - W * 0.1, yoff, BG.w, BG.h); };
  lay(BG.far, 0.25, -hill * 2500); lay(BG.mid, 0.5, -hill * 4000); lay(BG.near, 1, -hill * 6000);
}
// ---- track ----
const ROAD = ['#f6c77d', '#efb766'], GRASS = ['#5fd36a', '#4cc45a'], GRASS_ART = ['#2f6f2c', '#2a6328']; // deeper jungle green next to the painted backdrop
function drawTrack(w) {
  const hw = 1.5 * C.LANE_W;
  const gaps = w.objs.filter((o) => o.kind === 'gap' && !o.dead).map((o) => [o.s - w.dist - 1.6, o.s - w.dist + 1.6]);
  let z = FAR; const near = -ZC + 1.2;
  const segs = [];
  while (z > near) { const dz = z > 40 ? 4 : z > 12 ? 2 : 1; segs.push([z, Math.max(near, z - dz)]); z -= dz; }
  for (const [z1, z0] of segs) {
    const a = P(-hw, 0, z1), b = P(hw, 0, z1), c = P(hw, 0, z0), d = P(-hw, 0, z0); if (!a || !d) continue;
    const band = Math.floor((z0 + w.dist) / 3) & 1;
    // grass
    g.fillStyle = (bgLayers() ? GRASS_ART : GRASS)[band]; g.fillRect(0, a.y, W, d.y - a.y + 1);
    const inGap = gaps.some(([g0, g1]) => z0 < g1 && z1 > g0);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath();
    const tile = artReady() && art(['track'], ['plank'], ['tile']);
    if (tile && !inGap) { g.save(); g.clip(); const v = (((z0 + w.dist) % 4) + 4) % 4 / 4; const sy0 = v * tile.h, sh = Math.max(1, (z1 - z0) / 4 * tile.h);
      g.drawImage(tile.img, 0, Math.min(sy0, tile.h - sh), tile.w, Math.min(sh, tile.h), Math.min(a.x, d.x), a.y, Math.max(b.x, c.x) - Math.min(a.x, d.x), d.y - a.y + 1); g.restore(); }
    else { g.fillStyle = inGap ? '#2a1640' : ROAD[band]; g.fill(); }
    // edges
    const ew = Math.max(1, 0.25 * a.sc);
    g.fillStyle = INK; g.fillRect(a.x - ew, a.y, ew, d.y - a.y + 1); g.fillRect(b.x, b.y, ew, c.y - b.y + 1);
    g.beginPath(); g.moveTo(a.x - ew, a.y); g.lineTo(a.x - ew * 3, a.y); g.lineTo(d.x - ew * 3 * (d.sc / a.sc), d.y); g.lineTo(d.x - ew, d.y); g.fillStyle = '#c98a3e'; g.fill();
    g.beginPath(); g.moveTo(b.x + ew, b.y); g.lineTo(b.x + ew * 3, b.y); g.lineTo(c.x + ew * 3 * (c.sc / b.sc), c.y); g.lineTo(c.x + ew, c.y); g.fill();
    if (!inGap && band === 0) { // lane dashes
      for (const lx of [-C.LANE_W / 2, C.LANE_W / 2]) { const p1 = P(lx, 0, z1), p0 = P(lx, 0, z0); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = Math.max(1, 0.12 * p0.sc); g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p0.x, p0.y); g.stroke(); }
    }
    if (inGap) { g.fillStyle = 'rgba(120,60,200,.35)'; g.fillRect(Math.min(a.x, d.x), a.y, Math.max(b.x, c.x) - Math.min(a.x, d.x), (d.y - a.y) * 0.4); }
  }
}
// ---- generic sprite in the world (bottom-centre anchor) ----
function spr(img0, x, y, z, wM, o = {}) {
  const p = P(x, y, z); if (!p) return null;
  const A = img0 && img0.img ? img0 : null, img = A ? A.img : img0, ax = A ? A.ax : 0.5, ay = A ? A.ay : 1;
  const iw = A ? A.w : img.width, ih = A ? A.h : img.height;
  const wpx = wM * p.sc, hpx = wpx * ih / iw;
  if (wpx < 1.5 || p.y < HZ - 400) return p;
  g.save(); g.translate(p.x, p.y);
  if (o.rot) { g.translate(0, -hpx / 2); g.rotate(o.rot); g.translate(0, hpx / 2); }
  g.scale(o.sx || 1, o.sy || 1);
  const fa = Math.max(0, Math.min(1, (FAR - z) / 30));
  g.globalAlpha = (o.alpha !== undefined ? o.alpha : 1) * fa;
  g.drawImage(img, -wpx * ax, -hpx * ay, wpx, hpx);
  g.restore(); return { ...p, wpx, hpx };
}
function shadow(x, z, wM, a = 0.25) { const p = P(x, 0, z); if (!p) return; g.fillStyle = `rgba(27,18,48,${a})`; g.beginPath(); g.ellipse(p.x, p.y, wM * p.sc * 0.5, wM * p.sc * 0.14, 0, 0, 7); g.fill(); }
// ---- sprite pack lookups (hand-painted PNGs when present, built-in art otherwise) ----
const A_ = (fallback, ...alts) => (artReady() && art(...alts)) || fallback;
// ---- number bubbles ----
const bubbleCache = new Map();
const powerArt = (k) => [['power', k], [k, 'icon'], [k], ...(k === 'giant' ? [['power', 'mushroom'], ['mushroom']] : [])];
const ORB_COL = ['blue', 'green', 'purple'], ORB_TINT = ['#3fa7ff', '#3fcf5a', '#a46bff'];
function bubble(n, right, lane = 1) {
  const k = n + (right ? 'r' : '') + '|' + lane;
  if (!bubbleCache.has(k)) {
    if (bubbleCache.size > 60) bubbleCache.clear();
    const orb = artReady() && art(['orb', ORB_COL[lane]], ['orb', 'white'], ['orb'], ['answer'], ['bubble']);
    bubbleCache.set(k, mk(200, 200, (q) => {
      if (orb && /white|grey|gray/.test(orb.file)) {
        // tint the neutral orb to the lane colour: multiply a colour over it, then keep only the orb's own alpha
        const tmp = mk(200, 200, (u) => { u.drawImage(orb.img, 0, 0, 200, 200); u.globalCompositeOperation = 'multiply'; u.fillStyle = ORB_TINT[lane]; u.fillRect(0, 0, 200, 200);
          u.globalCompositeOperation = 'destination-in'; u.drawImage(orb.img, 0, 0, 200, 200); });
        q.drawImage(tmp, 0, 0);
      } else if (orb) q.drawImage(orb.img, 0, 0, 200, 200);
      else {
        blob(q, (p) => p.arc(100, 100, 88, 0, 7), '#ffffff', 10);
        blob(q, (p) => p.arc(100, 100, 76, 0, 7), '#ffe066', 0);
        blob(q, (p) => p.ellipse(72, 62, 24, 12, -0.6, 0, 7), 'rgba(255,255,255,.8)', 0);
      }
      q.font = `900 ${String(n).length > 2 ? 72 : 90}px system-ui, -apple-system, "Segoe UI", sans-serif`; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.lineWidth = 14; q.strokeStyle = INK; q.strokeText(String(n), 100, 106); q.fillStyle = '#fff'; q.fillText(String(n), 100, 106);
    }));
  }
  return bubbleCache.get(k);
}
// ---- the runner (seen from behind, head turned so the big eyes peek out) ----
function drawRunnerArt(w, pid, skin, t, at, base, k) {
  const p = w.p, jet = w.powers.jetpack > 0, air = p.y > 0.01 && !jet, sliding = p.slide > 0;
  // Each pose falls back to the run pose, then to the fox (every player can use the fox sprite); squash/stretch/rotation fake the missing poses.
  const pose = (n) => art([pid, n]) || art(['fox', n]);
  const run = pose('back') || pose('run');
  const a = (sliding && pose('slide')) || (air && pose('jump')) || run;
  const fakeSlide = sliding && a === run, fakeJump = air && a === run;
  if (!a) return false;
  let sx = 1, sy = 1, rot = 0;
  if (fakeSlide) { sy = 0.55; sx = 1.25; rot = -0.25; }
  if (fakeJump) rot = Math.max(-0.4, Math.min(0.4, -p.vy * 0.03));
  if (air) { sy = 1 + Math.min(0.2, Math.abs(p.vy) * 0.02); sx = 1 / sy; }
  if (R.squash > 0) { sy = 1 - R.squash * 0.3; sx = 1 + R.squash * 0.25; }
  const bob = air || sliding ? 0 : Math.abs(Math.sin(R.runPhase)) * 6, lean = (p.lane * C.LANE_W - p.x) * -0.12 + (air ? 0 : Math.sin(R.runPhase) * 0.05);
  const hpx = k * 2.1, wpx = hpx * a.w / a.h;
  g.save(); g.translate(at.x, at.y - bob); g.rotate(lean + rot); g.scale(sx * (Math.sin(R.runPhase * 2) > 0 || air ? 1 : 1), sy);
  if (skin && skin.color) { g.filter = `drop-shadow(0 0 ${Math.round(k * 0.08)}px ${skin.color})`; }
  g.drawImage(a.img, -wpx * a.ax, -hpx * a.ay, wpx, hpx);
  g.filter = 'none'; g.restore();
  R.lastAt = at; return true;
}
function drawRunner(w, pid, skin, t) {
  const A = ANIMAL[pid] || ANIMAL.fox, body = skin && skin.color ? skin.color : A.body;
  const p = w.p, giant = w.powers.giant > 0, jet = w.powers.jetpack > 0;
  const base = P(p.x, 0, 0), at = P(p.x, p.y, 0); if (!base) return;
  const k = SC0 * (giant ? 1.9 : 1.25);
  // shadow
  g.fillStyle = 'rgba(27,18,48,.28)'; g.beginPath(); g.ellipse(base.x, base.y, k * 0.55 / (1 + p.y * 0.3), k * 0.14, 0, 0, 7); g.fill();
  // squash and stretch
  const air = p.y > 0.01 && !jet;
  const sliding = p.slide > 0;
  let sx = 1, sy = 1;
  if (air) { sy = 1 + Math.min(0.22, Math.abs(p.vy) * 0.025); sx = 1 / sy; }
  if (R.squash > 0) { sy = 1 - R.squash * 0.35; sx = 1 + R.squash * 0.3; }
  if (sliding) { sy = 0.55; sx = 1.25; }
  if (drawRunnerArt(w, pid, skin, t, at, base, k)) { auraOnly(w, at, k, t); return; }
  const ph = R.runPhase, sw = Math.sin(ph), lean = (p.lane * C.LANE_W - p.x) * -0.12;
  g.save(); g.translate(at.x, at.y); g.rotate(lean); g.scale(sx, sy);
  const u = k / 100; g.lineJoin = 'round'; g.lineCap = 'round';
  // aura for powers
  if (w.powers.shield > 0 || giant || jet || w.powers.magnet > 0) {
    const col = w.powers.shield > 0 ? '79,195,255' : giant ? '155,93,229' : jet ? '255,159,28' : '255,93,115';
    const gr = g.createRadialGradient(0, -70 * u, 10 * u, 0, -70 * u, 95 * u); gr.addColorStop(0, `rgba(${col},.0)`); gr.addColorStop(0.7, `rgba(${col},.35)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(0, -70 * u, 95 * u, 0, 7); g.fill();
    if (w.powers.shield > 0) { g.strokeStyle = `rgba(${col},.9)`; g.lineWidth = 5 * u; g.beginPath(); g.arc(0, -70 * u, 78 * u + Math.sin(t * 8) * 3 * u, 0, 7); g.stroke(); }
  }
  const L = 6 * u;
  // legs
  const leg = (s) => { const a = air ? s * 0.5 : sw * s * 0.9; g.save(); g.translate(s * 16 * u, -26 * u); g.rotate(a * 0.6);
    blob(g, (q) => q.roundRect(-9 * u, -4 * u, 18 * u, 30 * u, 9 * u), body, L); blob(g, (q) => q.ellipse(0, 28 * u, 14 * u, 9 * u, 0, 0, 7), A.dark || '#5a3a2a', L); g.restore(); };
  if (!sliding) { leg(-1); leg(1); }
  // jetpack
  if (jet) { blob(g, (q) => q.roundRect(-30 * u, -95 * u, 24 * u, 46 * u, 10 * u), '#e8eef7', L); blob(g, (q) => q.roundRect(6 * u, -95 * u, 24 * u, 46 * u, 10 * u), '#e8eef7', L);
    for (const s of [-18, 18]) { const fl = 18 + Math.sin(t * 40 + s) * 6; blob(g, (q) => { q.moveTo((s - 8) * u, -50 * u); q.lineTo(s * u, (-50 + fl) * u); q.lineTo((s + 8) * u, -50 * u); q.closePath(); }, '#ffb020', 3 * u); } }
  // tail
  if (A.tail) { g.save(); g.translate(0, -40 * u); g.rotate(Math.sin(ph * 2) * 0.3); blob(g, (q) => q.ellipse(0, 10 * u, 13 * u, 24 * u, 0, 0, 7), body, L); blob(g, (q) => q.ellipse(0, 26 * u, 9 * u, 10 * u, 0, 0, 7), '#fff', L * 0.7); g.restore(); }
  // body
  blob(g, (q) => q.ellipse(0, -62 * u, 34 * u, 36 * u, 0, 0, 7), body, L);
  // arms swing
  for (const s of [-1, 1]) { g.save(); g.translate(s * 30 * u, -78 * u); g.rotate(s * 0.5 + (air ? -s * 1.2 : sw * s * 0.8));
    blob(g, (q) => q.roundRect(-7 * u, 0, 14 * u, 34 * u, 7 * u), body, L); blob(g, (q) => q.arc(0, 36 * u, 9 * u, 0, 7), A.belly === '#2b2238' ? '#2b2238' : '#fff', L); g.restore(); }
  // blaster on the back
  const bl = R.blasterColor || '#7ee8fa';
  blob(g, (q) => q.roundRect(-14 * u, -84 * u, 28 * u, 26 * u, 8 * u), '#5b5f97', L * 0.8);
  blob(g, (q) => q.arc(0, -71 * u, 7 * u, 0, 7), w.blaster.jam > 0 ? '#ff5d73' : w.blaster.charge > 0 ? (bl === 'rainbow' ? `hsl(${(t * 300) % 360},90%,60%)` : bl) : '#9aa0c8', 3 * u);
  // head (big) with ears, turned toward the lane we steer to
  const look = Math.max(-1, Math.min(1, (p.lane * C.LANE_W - p.x) * 1.2 + Math.sin(t * 0.7) * 0.25));
  g.save(); g.translate(0, -118 * u + (air ? 0 : Math.abs(sw) * -4 * u));
  if (A.ear === 'pointy') for (const s of [-1, 1]) blob(g, (q) => { q.moveTo(s * 18 * u, -26 * u); q.lineTo(s * 40 * u, -62 * u); q.lineTo(s * 44 * u, -18 * u); q.closePath(); }, body, L);
  if (A.ear === 'round') for (const s of [-1, 1]) blob(g, (q) => q.arc(s * 34 * u, -32 * u, 15 * u, 0, 7), '#2b2238', L);
  if (A.ear === 'tuft') for (const s of [-1, 1]) blob(g, (q) => { q.moveTo(s * 14 * u, -34 * u); q.lineTo(s * 36 * u, -56 * u); q.lineTo(s * 40 * u, -22 * u); q.closePath(); }, '#8a5a3c', L);
  if (A.ear === 'none') for (const s of [-1, 1]) { blob(g, (q) => q.arc(s * 24 * u, -36 * u, 17 * u, 0, 7), body, L); }
  blob(g, (q) => q.ellipse(0, 0, 44 * u, 40 * u, 0, 0, 7), body, L);
  if (skin && skin.star) { g.fillStyle = '#ffd23f'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 * u : 14 * u; g.lineTo(Math.cos(a) * r, -18 * u + Math.sin(a) * r); } g.closePath(); g.fill(); g.lineWidth = 3 * u; g.strokeStyle = INK; g.stroke(); }
  // eyes peeking at the side we look to (big cartoon eyes)
  const blink = (Math.floor(t * 10) % 37) === 0;
  const ex = look * 30 * u;
  if (A.ear === 'none') { eye(g, -24 * u + ex * 0.3, -38 * u, 12 * u, look, blink); eye(g, 24 * u + ex * 0.3, -38 * u, 12 * u, look, blink); }
  else { eye(g, ex - 14 * u * (look >= 0 ? -1 : 1) * 0.0 + (look >= 0 ? 26 : -26) * u, -10 * u, 13 * u, look, blink); }
  g.restore();
  g.restore();
  R.lastAt = at;
}
function auraOnly(w, at, k, t) {
  const giant = w.powers.giant > 0, jet = w.powers.jetpack > 0;
  if (!(w.powers.shield > 0 || giant || jet || w.powers.magnet > 0)) return;
  const col = w.powers.shield > 0 ? '79,195,255' : giant ? '155,93,229' : jet ? '255,159,28' : '255,93,115';
  const r = k * 1.2, cy = at.y - k * 0.9;
  const gr = g.createRadialGradient(at.x, cy, r * 0.1, at.x, cy, r); gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.7, `rgba(${col},.3)`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.beginPath(); g.arc(at.x, cy, r, 0, 7); g.fill();
  if (w.powers.shield > 0) { g.strokeStyle = `rgba(${col},.9)`; g.lineWidth = 5; g.beginPath(); g.arc(at.x, cy, r * 0.85 + Math.sin(t * 8) * 3, 0, 7); g.stroke(); }
}
// ---- the Giant Broccoli boss ----
function drawBoss(w, t) {
  const B = w.boss; if (!B) return;
  R.bossX += (B.lane * C.LANE_W - R.bossX) * 0.08;
  const z = B.z + Math.sin(t * 2) * 1.2, hop = Math.abs(Math.sin(t * 7)) * 0.4;
  const p = P(R.bossX, hop, z); if (!p) return;
  shadow(R.bossX, z, 3.4, 0.3);
  const u = p.sc * 3.6 / 100; const hit = t - R.bossHitT < 0.35;
  const ba = (R.bossCream > 0 && art(['broccoli', 'pie'], ['broccoli', 'splat'], ['broccoli', 'splattered'])) || art(['broccoli']);
  if (ba) {
    const hpx = u * 190, wpx = hpx * ba.w / ba.h, sq = hit ? 0.85 : 1 + Math.sin(t * 7) * 0.04;
    g.save(); g.translate(p.x, p.y); g.rotate(Math.sin(t * 3) * 0.06 + (hit ? Math.sin(t * 60) * 0.08 : 0)); g.scale(1 / sq, sq);
    g.drawImage(ba.img, -wpx * ba.ax, -hpx * ba.ay, wpx, hpx); g.restore();
    R.bossAt = { x: p.x, y: p.y - hpx * 0.55, sc: p.sc }; return;
  }
  g.save(); g.translate(p.x, p.y); g.rotate(Math.sin(t * 3) * 0.06 + (hit ? Math.sin(t * 60) * 0.08 : 0));
  const sq = hit ? 0.85 : 1 + Math.sin(t * 7) * 0.03; g.scale(1 / sq, sq);
  // legs
  for (const s of [-1, 1]) { g.save(); g.translate(s * 18 * u, -26 * u); g.rotate(Math.sin(t * 14) * 0.5 * s); blob(g, (q) => q.roundRect(-8 * u, 0, 16 * u, 28 * u, 7 * u), '#a6d57a', 5 * u / 2); g.restore(); }
  blob(g, (q) => { q.moveTo(-28 * u, -110 * u); q.lineTo(28 * u, -110 * u); q.lineTo(34 * u, -20 * u); q.quadraticCurveTo(0, -10 * u, -34 * u, -20 * u); q.closePath(); }, '#b8dc8a', 3 * u);
  for (const s of [-1, 1]) { g.save(); g.translate(s * 30 * u, -70 * u); g.rotate(s * (0.8 + Math.sin(t * 5) * 0.5)); blob(g, (q) => q.roundRect(-6 * u, 0, 12 * u, 36 * u, 6 * u), '#9cc874', 2.5 * u); g.restore(); }
  for (const [x, y, r] of [[-40, -130, 30], [0, -160, 34], [40, -130, 30], [-55, -105, 22], [55, -105, 22], [-20, -125, 30], [22, -125, 30]]) {
    const wob = Math.sin(t * 6 + x) * 2 * u; blob(g, (q) => q.arc(x * u, y * u + wob, r * u, 0, 7), '#3f9a3a', 3 * u); blob(g, (q) => q.arc((x - r / 3) * u, (y - r / 3) * u + wob, r * u / 3, 0, 7), '#5bb84f', 0);
  }
  const blink = (Math.floor(t * 8) % 23) === 0;
  eye(g, -14 * u, -82 * u, 10 * u, Math.sin(t) * 0.5, blink || hit); eye(g, 14 * u, -82 * u, 10 * u, Math.sin(t) * 0.5, blink || hit);
  g.strokeStyle = INK; g.lineWidth = 3 * u; g.beginPath(); g.moveTo(-24 * u, -98 * u); g.lineTo(-6 * u, -92 * u); g.moveTo(24 * u, -98 * u); g.lineTo(6 * u, -92 * u); g.stroke();
  if (hit) blob(g, (q) => q.ellipse(0, -55 * u, 12 * u, 10 * u, 0, 0, 7), '#6b2d2d', 2.5 * u);
  else { g.beginPath(); g.moveTo(-12 * u, -56 * u); g.quadraticCurveTo(0, -48 * u - Math.sin(t * 4) * 4 * u, 12 * u, -56 * u); g.stroke(); }
  for (let i = 0; i < Math.min(5, R.bossCream); i++) blob(g, (q) => q.ellipse(((i * 37) % 60 - 30) * u, (-140 + (i * 23) % 60) * u, 14 * u, 8 * u, 0, 0, 7), '#fffaf0', 2 * u);
  g.restore();
  R.bossAt = { x: p.x, y: p.y - 100 * u, sc: p.sc };
}
// ---- particles ----
export function burst(x, y, kind, n = 14, col = '#ffd23f') {
  for (let i = 0; i < n; i++) {
    const a = vr() * Math.PI * 2, v = 120 + vr() * 280;
    R.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'coin' ? 150 : 60), life: 0.5 + vr() * 0.5, age: 0, kind, col, r: kind === 'poof' ? 14 + vr() * 22 : 4 + vr() * 6, rot: vr() * 6 });
  }
}
export function poofAt(x, y, size) { if (artReady() && art(['poof'])) R.parts.push({ x, y, vx: 0, vy: -20, life: 0.6, age: 0, kind: 'poofimg', r: size }); else burst(x, y, 'poof', 12); }
export function popText(x, y, text, col = '#fff', size = 34) { R.pops.push({ x, y, text, col, size, age: 0, life: 0.9 }); }
function drawParticles(dt) {
  for (const q of R.parts) {
    q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.kind === 'poof' ? -40 : 700) * dt; q.vx *= 0.97;
    const a = Math.max(0, 1 - q.age / q.life);
    if (q.kind === 'poofimg') { const pa = art(['poof']); if (pa) { const sz = q.r * (1 + q.age * 3); g.globalAlpha = a; g.drawImage(pa.img, q.x - sz / 2, q.y - sz / 2, sz, sz * pa.h / pa.w); } }
    else if (q.kind === 'poof') { g.globalAlpha = a; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(q.x, q.y, q.r * (1 + q.age * 2), 0, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(27,18,48,.5)'; g.stroke(); }
    else if (q.kind === 'star' || q.kind === 'coin') { g.globalAlpha = a; g.fillStyle = q.col; g.save(); g.translate(q.x, q.y); g.rotate(q.rot + q.age * 8); g.beginPath(); for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4, r = i % 2 ? q.r * 0.45 : q.r * 1.3; g.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); } g.closePath(); g.fill(); g.restore(); }
    else { g.globalAlpha = a; g.fillStyle = q.col; g.beginPath(); g.arc(q.x, q.y, q.r, 0, 7); g.fill(); }
  }
  g.globalAlpha = 1;
  R.parts = R.parts.filter((q) => q.age < q.life);
  for (const q of R.pops) {
    q.age += dt; const k = q.age / q.life, s = k < 0.2 ? 0.4 + k * 4 : 1.2 - (k - 0.2) * 0.25;
    g.save(); g.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4); g.translate(q.x, q.y - k * 60); g.scale(s, s); g.rotate(Math.sin(q.age * 10) * 0.05);
    g.font = `900 ${q.size}px system-ui, -apple-system, "Segoe UI", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = q.size * 0.22; g.strokeStyle = INK; g.strokeText(q.text, 0, 0); g.fillStyle = q.col; g.fillText(q.text, 0, 0); g.restore();
  }
  R.pops = R.pops.filter((q) => q.age < q.life);
}
function speedLines(w, t) {
  const f = (w.speed - C.SPEED_START) / (C.SPEED_MAX - C.SPEED_START);
  const n = Math.round(f * 14) + (w.powers.jetpack > 0 || w.powers.giant > 0 ? 16 : 0);
  if (!n) return;
  g.strokeStyle = w.powers.jetpack > 0 ? 'rgba(255,200,90,.55)' : w.powers.giant > 0 ? 'rgba(200,160,255,.55)' : 'rgba(255,255,255,.45)'; g.lineWidth = 3;
  for (let i = 0; i < n; i++) {
    const a = ((i * 2.399 + Math.floor(t * 12 + i) * 0.7) % 6.283), r0 = W * 0.35 + ((t * 900 + i * 97) % (W * 0.6)), r1 = r0 + 40 + f * 60;
    const cx = W / 2, cy = HZ + 40; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.9); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.9); g.stroke();
  }
}
// ---- main draw ----
export function shake(a) { R.shake = Math.max(R.shake, a); }
export function flash(col = '#fff', a = 0.5) { R.flash = a; R.flashCol = col; }
export function project(x, y, z) { return P(x, y, z); }
export function draw(w, view, dt) {
  const t0 = performance.now();
  const t = w.t;
  curve = Math.sin(w.dist / 170) * 0.0024 + Math.sin(w.dist / 61) * 0.0006;
  hill = Math.sin(w.dist / 120 + 1) * 0.0004;
  R.camX += (w.p.x * 0.55 - R.camX) * Math.min(1, dt * 8);
  R.runPhase += w.speed * dt * 0.85;
  if (R.lastY > 0.05 && w.p.y <= 0.001 && w.powers.jetpack <= 0) R.squash = 1;
  R.lastY = w.p.y; R.squash = Math.max(0, R.squash - dt * 5);
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (R.shake > 0) { g.translate((vr() - 0.5) * R.shake * 22, (vr() - 0.5) * R.shake * 22); R.shake = Math.max(0, R.shake - dt * 2.5); }
  drawBackground(t, w.dist);
  drawTrack(w);
  if (bgLayers()) g.globalAlpha = 0.45; g.drawImage(BG.haze, 0, HZ - 60, W, 140); g.globalAlpha = 1;
  // collect drawables far -> near
  const items = [];
  for (let s = Math.floor(w.dist / 9) * 9 + 9 * 15; s > w.dist - ZC; s -= 9) {
    const z = s - w.dist, k = Math.round(s / 9);
    const side = (k % 4 === 0) ? 'pillar' : (k % 4 === 2) ? 'palm' : (k % 4 === 1) ? 'bush' : 'torch';
    for (const sd of [-1, 1]) items.push({ z, f: () => spr(S[side], sd * (1.5 * C.LANE_W + 2.4 + (k % 3) * 0.6), 0, z, side === 'palm' ? 4.2 : side === 'pillar' ? 2 : side === 'bush' ? 3.2 : 1) });
  }
  for (const o of w.objs) {
    const z = o.s - w.dist; if (z > FAR || z < -ZC + 0.5) continue;
    if (o.kind === 'gap') continue;
    if (o.dead && o.kind !== 'monster') continue;
    items.push({ z, f: () => drawObj(o, z, t) });
  }
  for (const r of w.rows) if (r.shown && !r.taken && r.q) { const z = r.s - w.dist; if (z < FAR) items.push({ z, f: () => { for (let i = 0; i < 3; i++) { const x = (i - 1) * C.LANE_W; shadow(x, z, 1.4, 0.2); spr(bubble(r.q.choices[i], false, i), x, 0.8 + Math.sin(t * 5 + i) * 0.15, z, 2.1); } } }); }
  if (w.boss) items.push({ z: w.boss.z, f: () => drawBoss(w, t) });
  items.push({ z: 0, f: () => drawRunner(w, view.pid, view.skin, t) });
  items.sort((a, b) => b.z - a.z);
  for (const it of items) it.f();
  // blaster beam
  if (R.beam && t - R.beam.t < 0.18) { const a = R.lastAt; if (a) { g.strokeStyle = R.beam.col; g.lineWidth = 10; g.beginPath(); g.moveTo(a.x, a.y - SC0 * 1.0); g.lineTo(R.beam.x, R.beam.y); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke(); } }
  speedLines(w, t);
  drawParticles(dt);
  g.drawImage(BG.vig, 0, 0, W, H);
  if (R.flash > 0) { g.globalAlpha = R.flash; g.fillStyle = R.flashCol; g.fillRect(-50, -50, W + 100, H + 100); g.globalAlpha = 1; R.flash = Math.max(0, R.flash - dt * 2); }
  const ms = performance.now() - t0; R.frameMs.push(ms); if (R.frameMs.length > 600) R.frameMs.shift();
}
function drawObj(o, z, t) {
  if (o.kind === 'log') { shadow(o.lanes[0] * C.LANE_W, z, 2.0); return spr(A_(S.log, ['log']), o.lanes[0] * C.LANE_W, 0, z, 2.0); }
  if (o.kind === 'rock') { shadow(o.lanes[0] * C.LANE_W, z, 2.0); return spr(A_(S.rock, ['stone'], ['rock']), o.lanes[0] * C.LANE_W, 0, z, 1.9); }
  if (o.kind === 'branch') { const l0 = Math.min(...o.lanes), l1 = Math.max(...o.lanes); const x = (l0 + l1) / 2 * C.LANE_W, wM = (l1 - l0 + 1) * C.LANE_W;
    for (const l of [l0 - 0.45, l1 + 0.45]) { const a = P(l * C.LANE_W, 0, z), b = P(l * C.LANE_W, 1.6, z); if (a && b) { g.strokeStyle = INK; g.lineWidth = Math.max(2, 0.35 * a.sc); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.strokeStyle = '#8a4b1f'; g.lineWidth = Math.max(1, 0.22 * a.sc); g.stroke(); } }
    return spr(A_(S.branch, ['branch']), x, 1.05, z, wM * 1.05); }
  if (o.kind === 'coin') { const sp = Math.cos(t * 6 + o.s); shadow(o.lanes[0] * C.LANE_W, z, 0.6, 0.15); return spr(A_(S.coin, ['coin']), o.lanes[0] * C.LANE_W, 0.5 + Math.sin(t * 4 + o.s) * 0.12, z, 0.8, { sx: Math.max(0.15, Math.abs(sp)) }); }
  if (o.kind === 'box') { shadow(o.lanes[0] * C.LANE_W, z, 1.2); return spr(A_(S.box[o.power], ...powerArt(o.power)), o.lanes[0] * C.LANE_W, 0.4 + Math.sin(t * 3) * 0.2, z, 1.3, { rot: Math.sin(t * 2) * 0.2 }); }
  if (o.kind === 'monster') {
    if (o.dead) return null;
    const x = o.lanes[0] * C.LANE_W, ph = t * 6 + o.id, blink = (Math.floor(t * 9 + o.id) % 19) === 0 ? 1 : 0;
    if (o.type === 'slime') { const wb = Math.sin(ph * 1.5) * 0.12; shadow(x, z, 1.8); return spr(A_(S.mon.slime[blink], ['slime']), x, 0, z, 1.9, { sx: 1 + wb, sy: 1 - wb }); }
    if (o.type === 'bat') { const up = Math.floor(t * 10 + o.id) % 2; shadow(x, z, 1.4, 0.15); const ba = art(['bat']); return ba ? spr(ba, x, 1.15 + Math.sin(ph) * 0.15, z, 2.4, { sy: up ? 1 : 0.85 }) : spr(S.mon.bat[up + blink * 2], x, 1.15 + Math.sin(ph) * 0.15, z, 2.4); }
    if (o.type === 'roller') { shadow(x, z, 1.6); const ra = art(['rock', 'monster'], ['rock']); return ra ? spr(ra, x, Math.abs(Math.sin(ph * 1.6)) * 0.25, z, 1.8, { rot: Math.sin(ph * 1.6) * 0.18 }) : spr(S.mon.roller[blink], x, 0, z, 1.7, { rot: -(o.s * 1.3) }); }
    shadow(x, z, 1.4); return spr(S.mon.ball[0], x, 0, z, 1.5, { rot: -t * 8 });
  }
  return null;
}
export function frameStats() { const a = R.frameMs.slice().sort((p, q) => p - q); if (!a.length) return null; return { n: a.length, avg: a.reduce((s, x) => s + x, 0) / a.length, p95: a[Math.floor(a.length * 0.95)], max: a[a.length - 1] }; }
export function iconCanvas(kind, size = 64) { const a = artReady() && art(...powerArt(kind)); return mk(size, size, (q) => { if (a) q.drawImage(a.img, 0, 0, size, size); else drawPowerIcon(q, kind, size / 2, size / 2, size * 0.38); }); }
export { W as width, H as height };
