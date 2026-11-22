// Drawing the side-scroller (spec 10): 960 x 540 logical view, letterboxed; 1 T = 48 px. Numbers are always drawn as text.
import { CONFIG as C } from './config.js';
import { art } from './artpack.js';
import { drawFox, runPose, poseOf, blend, rigReady } from './puppet.js';
import { onewaysAt, bossPlats } from './sim.js';
import { WORLDS, BOSSES } from './levels.js';

export const VW = 960, VH = 540, T = 48;
const GY = VH - 96; // screen y of the ground top when the camera is low
let P = WORLDS.x2; // the current world's ground and platform colours
const R = { bossHit: 0, paradeT: 0, cam: { x: 0, y: 0 }, phase: 0, idleT: 0, parts: [], blinkT: 3, t: 0, poseK: 0, last: null, fx: [] };
export function resetView(w) { R.paradeOn = false; R.paradeDone = false; R.paradeT = 0; R.bossHit = 0; R.cam.x = Math.max(0, w.fox.x - 7); R.cam.y = 0; R.parts = []; R.fx = []; R.phase = 0; }
const sx = (x) => (x - R.cam.x) * T, sy = (y) => GY - (y - R.cam.y) * T;
const reduced = () => !!(self.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
function outlineFill(g, fill, out = '#3a2116', lw = 4) { g.fillStyle = fill; g.fill(); g.strokeStyle = out; g.lineWidth = lw; g.stroke(); }
function img(g, a, x, y, h, { flip = false, alpha = 1, rot = 0, sxs = 1, sys = 1 } = {}) {
  if (!a) return false;
  const w = (a.w / a.h) * h;
  g.save(); g.globalAlpha *= alpha; g.translate(x, y); if (rot) g.rotate(rot); g.scale((flip ? -1 : 1) * sxs, sys);
  g.drawImage(a.img, -w * a.ax, -h * a.ay, w, h); g.restore(); return true;
}

// ---- background ----
function background(g, w) {
  const far = art(['bg', P.bg, 'far']);
  if (far) {
    const h = VH, wd = (far.w / far.h) * h, off = (R.cam.x * T * 0.08) % wd;
    for (let x = -off; x < VW; x += wd) g.drawImage(far.img, x, -R.cam.y * T * 0.05, wd, h);
  } else { const gr = g.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, '#8fd3ff'); gr.addColorStop(1, '#dff5ff'); g.fillStyle = gr; g.fillRect(0, 0, VW, VH); }
  const mid = art(['bg', P.bg, 'mid']);
  if (mid) {
    const h = P.bg === 'spring' ? 150 : Math.max(60, Math.min(150, mid.h * 0.6)), wd = (mid.w / mid.h) * h, off = (R.cam.x * T * 0.35) % wd, y = sy(0) - h + 24 + R.cam.y * T * 0.6;
    g.save(); g.globalAlpha = 0.8; for (let x = -off; x < VW; x += wd) g.drawImage(mid.img, x, y, wd, h); g.restore();
  }
}
function leafBed(g, x0, x1) {
  const a = sx(x0), b = sx(x1), y = sy(-1.15);
  if (b < -20 || a > VW + 20) return;
  g.fillStyle = P.dot; g.fillRect(a, y + 10, b - a, VH - y);
  for (let x = a + 6, i = 0; x < b - 4; x += 13, i++) { g.beginPath(); g.ellipse(x, y + 8 + (i % 3) * 4, 10, 6, (i % 5) * 0.6, 0, Math.PI * 2); g.fillStyle = P.bed[i % 4]; g.fill(); }
}
function earth(g, x0, x1, top, bot) {
  const a = sx(x0), b = sx(x1), y = sy(top), yb = bot <= -10 ? VH + 10 : sy(bot);
  if (b < -40 || a > VW + 40) return;
  rr(g, a, y, b - a, yb - y, 10); outlineFill(g, P.dirt);
  g.fillStyle = P.dot; for (let x = a + 14; x < b - 10; x += 34) for (let yy = y + 30; yy < Math.min(yb - 8, VH); yy += 30) { g.beginPath(); g.arc(x + ((yy / 30) % 2) * 12, yy, 4, 0, 7); g.fill(); }
  rr(g, a - 3, y - 4, b - a + 6, 16, 8); outlineFill(g, P.grass);
  g.fillStyle = P.grass2; g.fillRect(a + 4, y - 1, b - a - 8, 4);
}
function log(g, x0, x1, top, bot) {
  const a = sx(x0), b = sx(x1), y = sy(top), yb = sy(bot);
  rr(g, a, y, b - a, yb - y, (yb - y) / 2); outlineFill(g, '#8b5a2b');
  g.beginPath(); g.ellipse(b - (yb - y) * 0.3, (y + yb) / 2, (yb - y) * 0.28, (yb - y) * 0.42, 0, 0, 7); outlineFill(g, '#e0b77a', '#3a2116', 3);
  g.strokeStyle = '#5e3a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(a + 10, y + 12); g.lineTo(b - 30, y + 12); g.stroke();
  g.fillStyle = '#7cc251'; g.beginPath(); g.ellipse(a + (b - a) * 0.35, y + 2, 14, 6, 0, 0, 7); g.fill();
}
function plank(g, x0, x1, y) { const a = sx(x0), b = sx(x1), yy = sy(y); rr(g, a, yy - 2, b - a, 16, 6); outlineFill(g, P.plank); g.strokeStyle = P.plank2; g.lineWidth = 2; for (let x = a + 24; x < b - 8; x += 24) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x, yy + 12); g.stroke(); } }
function leaf(g, x0, x1, y) { const a = sx(x0), b = sx(x1), yy = sy(y); g.beginPath(); g.moveTo(a - 6, yy + 4); g.quadraticCurveTo((a + b) / 2, yy - 14, b + 8, yy + 2); g.quadraticCurveTo((a + b) / 2, yy + 22, a - 6, yy + 4); outlineFill(g, P.leaf, '#24531d'); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(a, yy + 5); g.lineTo(b, yy + 3); g.stroke(); }
function mushroom(g, x) { const X = sx(x), Y = sy(0); rr(g, X - 9, Y - 20, 18, 22, 6); outlineFill(g, '#fff1dc'); g.beginPath(); g.ellipse(X, Y - 22, 30, 16, 0, Math.PI, 0); g.closePath(); outlineFill(g, '#e8433b'); g.fillStyle = '#fff'; for (const [dx, dy] of [[-14, -28], [2, -33], [16, -26]]) { g.beginPath(); g.arc(X + dx, Y + dy, 4, 0, 7); g.fill(); } }
function acorn(g, x, y, s = 1) { const X = sx(x), Y = sy(y); g.save(); g.translate(X, Y); g.scale(s, s); g.beginPath(); g.ellipse(0, 4, 8, 10, 0, 0, 7); outlineFill(g, '#c9852f', '#3a2116', 3); g.beginPath(); g.ellipse(0, -4, 10, 6, 0, Math.PI, 0); g.closePath(); outlineFill(g, '#7a4d24', '#3a2116', 3); g.fillStyle = '#3a2116'; g.fillRect(-1.5, -14, 3, 6); g.restore(); }
function flower(g, x, y) { const X = sx(x), Y = sy(y); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + R.t; g.beginPath(); g.arc(X + Math.cos(a) * 9, Y + Math.sin(a) * 9, 7, 0, 7); outlineFill(g, '#ff8fc8', '#7a2a55', 2); } g.beginPath(); g.arc(X, Y, 6, 0, 7); outlineFill(g, '#ffd23f', '#7a5a10', 2); }
export function powerIcon(g, kind, X, Y, s = 1) {
  g.save(); g.translate(X, Y); g.scale(s, s);
  if (kind === 'boots') { rr(g, -12, -4, 22, 14, 5); outlineFill(g, '#4f7cff', '#1d2a66', 3); g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(-8, 12 + i * 3); g.lineTo(6, 13.5 + i * 3); } g.stroke(); rr(g, -12, -16, 12, 14, 4); outlineFill(g, '#4f7cff', '#1d2a66', 3); }
  else { g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fillStyle = 'rgba(150,220,255,0.55)'; g.fill(); g.strokeStyle = '#2b7bd6'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-5, -5, 4, 0, 7); g.fill(); }
  g.restore();
}
function bubble(g, p) { const X = sx(p.x), Y = sy(p.y) + Math.sin(R.t * 3) * 3; g.beginPath(); g.arc(X, Y, 22, 0, 7); g.fillStyle = 'rgba(190,235,255,0.5)'; g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.stroke(); powerIcon(g, p.power, X, Y, 0.9); }
function flag(g, x, finish) {
  const X = sx(x), Y = sy(0); g.fillStyle = '#5a3a1e'; g.fillRect(X - 3, Y - 150, 6, 150);
  const wave = Math.sin(R.t * 4) * 4;
  g.beginPath(); g.moveTo(X + 3, Y - 148); g.quadraticCurveTo(X + 40, Y - 156 + wave, X + 70, Y - 140); g.lineTo(X + 70, Y - 100); g.quadraticCurveTo(X + 40, Y - 116 + wave, X + 3, Y - 106); g.closePath();
  if (finish) { g.save(); g.clip(); for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#333'; g.fillRect(X + 3 + i * 12, Y - 160 + j * 14, 12, 14); } g.restore(); g.strokeStyle = '#333'; g.lineWidth = 3; g.stroke(); }
  else outlineFill(g, '#ffd23f');
}
// The sign before a bay: the sum as text; a new fact also shows its dot array.
function sign(g, b) {
  const X = sx(b.sign), Y = sy(0);
  if (X < -200 || X > VW + 200) return;
  g.fillStyle = '#6b4423'; g.fillRect(X - 5, Y - 110, 10, 110);
  const wd = 170, ht = b.q && b.q.dots ? 120 : 70;
  rr(g, X - wd / 2, Y - 110 - ht, wd, ht, 12); outlineFill(g, '#f3d9a4', '#5a3a1e', 5);
  g.fillStyle = '#3a2116'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 34px system-ui, sans-serif';
  const txt = b.q ? `${b.q.a} x ${b.q.b}` : '?';
  g.fillText(txt, X, Y - 110 - ht + 36);
  if (b.q && b.q.dots) dotsAt(g, b.q.a, b.q.b, X, Y - 110 - ht + 88, 140, 48);
}
function dotsAt(g, rows, cols, cx, cy, maxW, maxH) {
  const d = Math.min(maxW / cols, maxH / rows, 14), r = d * 0.36;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { g.beginPath(); g.arc(cx + (j - (cols - 1) / 2) * d, cy + (i - (rows - 1) / 2) * d, r, 0, 7); g.fillStyle = '#e8572a'; g.fill(); }
}
// Answer platform: a flat stone with the number as text.
function numPlat(g, x0, y, value, { glow = false, ok = false, fade = 1 } = {}) {
  const a = sx(x0), b = sx(x0 + C.PLAT_W), yy = sy(y);
  g.save(); g.globalAlpha *= fade;
  if (glow) { g.shadowColor = '#fff36b'; g.shadowBlur = 24; }
  rr(g, a, yy - 4, b - a, 26, 10); outlineFill(g, ok ? '#9be07a' : '#e9e3d4', '#4a3a2a', 4);
  g.shadowBlur = 0;
  // the number floats above the plate so Fox never covers it
  rr(g, (a + b) / 2 - 38, yy - 64, 76, 50, 14); outlineFill(g, glow ? '#fff7b0' : '#ffffff', '#4a3a2a', 4);
  g.fillStyle = '#2a1d12'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 34px system-ui, sans-serif';
  if (value !== null && value !== undefined) g.fillText(String(value), (a + b) / 2, yy - 38);
  g.restore();
}
function curtain(g, b) {
  const X = sx(b.curtain), top = sy(9), bot = sy(0), k = b.open;
  if (X < -60 || X > VW + 60) return;
  const len = (bot - top) * (1 - k);
  for (let i = 0; i < 4; i++) {
    const x = X + 4 + i * 6, sway = Math.sin(R.t * 2 + i) * 3 * k;
    g.strokeStyle = '#2f7a28'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, top); g.quadraticCurveTo(x + sway + 4, top + len / 2, x + sway, top + len); g.stroke();
    g.fillStyle = '#5cbf4a'; for (let y = top + 10; y < top + len - 4; y += 26) { g.beginPath(); g.ellipse(x + (i % 2 ? 6 : -6), y, 8, 5, i % 2 ? 0.6 : -0.6, 0, 7); g.fill(); }
  }
  g.fillStyle = '#6b4423'; g.fillRect(X - 6, top - 10, 36, 12);
}
function monster(g, m) {
  if (m.state === 'gone') return;
  const X = sx(m.x), Y = sy(m.y);
  if (X < -80 || X > VW + 80) return;
  const bopped = m.state === 'bopped';
  if (m.type === 'pine') {
    const a = art(['monster', 'pinecone']); const h = 1.35 * T, bob = bopped ? 0 : Math.abs(Math.sin(R.t * 8 + m.id)) * 3;
    if (!img(g, a, X, Y - bob, h, { flip: m.dir > 0, rot: bopped ? m.t * 10 * m.dir : 0, alpha: bopped ? Math.max(0, 1 - m.t / 1.5) : 1 })) { g.beginPath(); g.ellipse(X, Y - 30, 22, 30, 0, 0, 7); outlineFill(g, '#8b5a2b'); }
  } else {
    const a = art(['monster', 'frog']); const air = m.y > 0.05; const h = 1.2 * T;
    if (!img(g, a, X, Y, h, { flip: false, sys: air ? 1.1 : 0.92 + Math.sin(R.t * 6) * 0.03, sxs: air ? 0.9 : 1.06, rot: bopped ? m.t * 10 * m.dir : 0, alpha: bopped ? Math.max(0, 1 - m.t / 1.5) : 1 })) { g.beginPath(); g.ellipse(X, Y - 22, 28, 22, 0, 0, 7); outlineFill(g, '#5cbf4a'); }
  }
}
// v0.4.1: each world has its own boss with 4 poses (idle, move = attack, bopped, friendly); the sum is drawn as text on its belly.
let BOSSART = null;
function bossSprite(wd, pose) { return art(['boss', wd, pose]) || art(['boss', wd, 'idle']) || art(['boss', 'x2', 'idle']); }
const BELLY = { // hand-set belly spots (art-src/bosses-v4.1/bosses.json): centre and size as fractions of the idle sprite
  x2: [0.5, 0.80, 0.34, 0.13], x10: [0.5, 0.81, 0.40, 0.13], x5: [0.5, 0.70, 0.40, 0.20], x3: [0.5, 0.66, 0.46, 0.18], x4: [0.5, 0.71, 0.42, 0.18],
  x9: [0.48, 0.70, 0.30, 0.13], x6: [0.5, 0.64, 0.42, 0.16], x8: [0.5, 0.80, 0.42, 0.18], x7: [0.5, 0.74, 0.42, 0.18], rb: [0.37, 0.71, 0.28, 0.18] };
export const bossBelly = (wd) => BELLY[wd] || BELLY.x2;
function boss(g, w) {
  const B = w.boss, L = w.lvl, wd = L.world || 'x2', BT = BOSSES[wd] || BOSSES.x2;
  let h = L.bossHead * T * B.scale, rot = 0, sxs = 1, sys = 1, alpha = 1, dx = 0, dy = 0, pose = 'idle';
  const A = B.attack, look = A ? A.look || A.kind : '';
  if (A) {
    const k = A.t, live = k >= C.ATTACK_WARN_S, kk = k - C.ATTACK_WARN_S;
    if (!live) dx = Math.sin(k * 40) * 4; // the warning wiggle
    else {
      pose = 'move';
      if (A.kind === 'spin') rot = Math.sin(kk * 9) * 0.12;
      else if (A.kind === 'stomp') { sys = 0.9 + Math.abs(Math.sin(kk * 10)) * 0.1; sxs = 1.05; if (/moonjump|hiccup|belly|puffs/.test(look)) dy = Math.abs(Math.sin(kk * (look === 'moonjump' ? 3 : 7))) * T * (look === 'moonjump' ? 2.2 : 1.2); }
      else if (A.kind === 'sneeze') sxs = 1 + Math.sin(k * 20) * 0.04;
    }
  }
  if (R.bossHit > 0 && B.phase !== 'win') { pose = 'bopped'; sys = 1; rot = 0; dy = 0; }
  if (B.phase === 'win') { pose = 'friendly'; const k = B.winT || 0; dy = Math.abs(Math.sin(k * 6)) * T * 0.4 * Math.max(0, 1 - k / 2.5); }
  const a = bossSprite(wd, pose), hh = pose === 'bopped' ? h * 0.72 : h, Y = sy(0) - dy;
  let X = sx(L.bossX) + dx; if (a) X = Math.min(X, VW - 6 - (a.w / a.h) * hh * sxs * (1 - a.ax)); // keep wide bosses inside the view
  if (!img(g, a, X, Y, hh, { rot, sxs, sys, alpha })) { g.beginPath(); g.arc(X, sy(h / T / 2), h / 2, 0, 7); outlineFill(g, BT.tint); }
  // the sum on the belly (idle and move poses only), always as text on a soft light patch so it is easy to read
  if (B.q && B.phase === 'ask' && a && pose !== 'bopped') {
    const [bx, by, bw, bh] = bossBelly(wd), wpx = (a.w / a.h) * hh;
    const cx = X + (bx - a.ax) * wpx * sxs, cy = Y + (by - a.ay) * hh * sys, ew = Math.max(96, bw * wpx), eh = Math.max(40, bh * hh);
    g.save(); g.fillStyle = 'rgba(255,253,244,0.88)'; g.strokeStyle = 'rgba(58,33,22,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(cx, cy, ew / 2, eh / 2, 0, 0, 7); g.fill(); g.stroke();
    const txt = `${B.q.a} x ${B.q.b}`; let fs = Math.round(Math.min(eh * 0.62, 36)); g.font = `800 ${fs}px system-ui, sans-serif`;
    while (g.measureText(txt).width > ew * 0.86 && fs > 16) { fs -= 2; g.font = `800 ${fs}px system-ui, sans-serif`; }
    g.fillStyle = '#2b2238'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, cx, cy + 1); g.restore();
  }
  if (B.phase === 'win' && (B.winT || 0) < 1.6) { const p = art(['fx', 'poof']); img(g, p, sx(L.bossX), sy(2.5), 4 * T * Math.min(1, (B.winT || 0) * 2), { alpha: 1 - (B.winT || 0) / 1.6 }); }
  if (A && A.live) { g.save(); try { bossFx(g, w, A, BT.tint); } catch { /* an effect must never stop the game */ } g.restore(); }
}
// Move effects per look. Pictures only: what pushes Fox is the tested mechanic (spin / stomp / sneeze) in sim.js.
const ROLLERS = { coconut: ['#8a5a2b', 0.45], tumble: ['#b88a4a', 0.55], snowball: ['#ffffff', 0.6], babies: ['#58b947', 0.4], juggle: ['#e8e4f0', 0.3], moons: ['#d8cfc0', 0.3] };
const RINGS = { moo: '#ffffff', bell: '#ffd23f', tail: 'rainbow', ring: '#f2c46a', thunder: '#b9c6e0', stomp: '#d9c6a3', hey: '#ffffff', moonjump: '#e2e4ea', belly: '#f0d2a0', hiccup: '#ff8fc8', puffs: '#ffffff' };
const FALLERS = { rain: '#5b8fd9', leaves: '#e88a2f', sand: '#e0a25a', bubbles: 'bubble', colorsneeze: 'confetti', juice: '#ffc93c' };
function bossFx(g, w, A, tint) {
  if (reduced()) return;
  const k = A.t - C.ATTACK_WARN_S, look = A.look || A.kind, bx = w.lvl.bossX, top = 120; // keep effects off the top band (sum and HUD)
  if (A.kind === 'spin' || /hula|spinwind|storm|nose|ice|sand|leafspin/.test(look)) {
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 4;
    for (let i = 0; i < 5; i++) { const y = sy(1 + i * 1.1), off = ((R.t * 600 + i * 140) % (VW + 200)); g.beginPath(); g.moveTo(VW - off, y); g.lineTo(VW - off - 60, y); g.stroke(); }
  }
  if (ROLLERS[look]) { const [c, r] = ROLLERS[look]; const n = look === 'babies' || look === 'juggle' || look === 'moons' ? 3 : 2;
    for (let i = 0; i < n; i++) { const x = bx - 1.5 - (k * 6 + i * 2.2), y = r + (/babies|juggle|moons/.test(look) ? Math.abs(Math.sin(k * 6 + i)) * 1.6 : 0); if (x < -1) continue;
      g.save(); g.translate(sx(x), sy(y)); g.rotate(-k * 8); g.beginPath(); g.arc(0, 0, r * T, 0, 7); outlineFill(g, c); g.beginPath(); g.moveTo(-r * T * 0.6, 0); g.lineTo(r * T * 0.6, 0); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.stroke(); g.restore(); } }
  if (RINGS[look]) { const c = RINGS[look]; for (let i = 0; i < (look === 'hey' ? 3 : 1); i++) { const kk = k - i * 0.35; if (kk < 0) continue; const rr = 30 + kk * 260; g.lineWidth = 8; g.globalAlpha = Math.max(0, 1 - kk / 1.6);
      if (c === 'rainbow') ['#ff6b6b', '#ffd23f', '#6bd66b', '#6bb8ff', '#b28bff'].forEach((cc, j) => { g.strokeStyle = cc; g.beginPath(); g.ellipse(sx(bx), sy(0.3), Math.max(1, rr - j * 8), Math.max(1, rr - j * 8) * 0.35, 0, Math.PI, 2 * Math.PI); g.stroke(); });
      else { g.strokeStyle = c; g.beginPath(); g.ellipse(sx(bx), sy(0.3), rr, rr * 0.35, 0, Math.PI, 2 * Math.PI); g.stroke(); } g.globalAlpha = 1; } }
  if (FALLERS[look]) { const c = FALLERS[look];
    for (let i = 0; i < 18; i++) { const x = bx - 2 - ((i * 37) % 13) - k * (look === 'colorsneeze' || look === 'bubbles' ? 4 : 1), yy = 8.5 - ((k * (c === 'bubble' ? 1.2 : 4) + i * 0.47) % 8.5); const X = sx(x), Y = sy(yy); if (Y < top) continue;
      if (c === 'bubble') { g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3; g.beginPath(); g.arc(X, Y, 10 + (i % 3) * 5, 0, 7); g.stroke(); }
      else if (c === 'confetti') { g.fillStyle = ['#ff6b6b', '#ffd23f', '#6bd66b', '#6bb8ff', '#b28bff'][i % 5]; g.fillRect(X, Y, 9, 6); }
      else if (look === 'rain') { g.fillStyle = c; g.beginPath(); g.ellipse(X, Y, 4, 9, 0, 0, 7); g.fill(); }
      else { g.fillStyle = c; g.beginPath(); g.ellipse(X, Y, 7, 4, i, 0, 7); g.fill(); } } }
}
// The friend parade (Rainbow Dragon fight, one round): the bosses already beaten walk past far behind and wave.
function parade(g, w) {
  const B = w.boss, L = w.lvl, list = w.paradeWorlds || [];
  if (!L.parade || !list.length) return;
  if (!R.paradeOn && !R.paradeDone && B.bops === L.parade && B.phase === 'ask') { R.paradeOn = true; R.paradeT = 0; }
  if (!R.paradeOn) return;
  R.paradeT += R.dt || 1 / 60;
  const h = 2.4 * T, gap = 2.3 * T, v = 260, dur = (VW + list.length * gap + 3 * T) / v;
  if (R.paradeT > dur) { R.paradeOn = false; R.paradeDone = true; return; }
  g.save(); g.globalAlpha = 0.9;
  list.forEach((wd, i) => { const a = bossSprite(wd, 'friendly'); const x = 40 + R.paradeT * v - i * gap; if (x < -3 * T || x > VW + 3 * T) return;
    img(g, a, x, sy(0.9) - h * 0.15 - Math.abs(Math.sin(R.paradeT * 7 + i)) * 10, h, { rot: Math.sin(R.paradeT * 5 + i) * 0.08 }); });
  g.restore();
}
// ---- Fox ----
function foxPose(w, dt) {
  const f = w.fox; let pose, face = 'happy';
  const speed = Math.abs(f.vx);
  if (f.ground && speed > 0.2) R.phase += (speed * dt) / 1.75;
  if (w.finished) { pose = Math.floor(R.t * 3) % 2 ? poseOf('dance1') : poseOf('dance2'); face = 'joy'; }
  else if (f.sink > 0) { pose = poseOf('sink'); face = 'oops'; }
  else if (w.mode !== 'play') { pose = poseOf('idle'); face = 'oops'; }
  else if (f.push > 0 || (f.wobble > 0)) { pose = poseOf('pushed'); face = 'oops'; }
  else if (f.launch) { pose = poseOf('jump'); face = 'joy'; }
  else if (f.bop > 0) { pose = poseOf('bop'); face = 'joy'; }
  else if (!f.ground) { pose = f.vy > 3 ? poseOf('jump') : blend(poseOf('jump'), poseOf('fall'), Math.min(1, (3 - f.vy) / 10)); }
  else if (speed > 0.2) { const k = Math.min(1, speed / C.RUN_SPEED); pose = blend(poseOf('idle'), runPose(R.phase), Math.min(1, k * 1.4)); }
  else {
    const thinking = f.still > 3 && w.bays.some((b) => b.state === 'ask' && Math.abs(b.x0 + 7 - f.x) < 10);
    pose = thinking ? poseOf('think') : blend(poseOf('idle'), poseOf('idle2'), (Math.sin(R.t * 2.2) + 1) / 2);
    if (thinking) face = 'think';
  }
  if (f.land > 0 && f.ground && !w.finished) pose = blend(pose, poseOf('land'), f.land / 0.12 * 0.7);
  return { pose, face };
}
function fox(g, w, dt) {
  if (!rigReady()) return;
  const f = w.fox; const { pose, face } = foxPose(w, dt);
  R.blinkT -= dt; const blink = R.blinkT < 0.12; if (R.blinkT < 0) R.blinkT = 2.5 + ((R.t * 7.3) % 2);
  if (f.inv > 0 && Math.floor(f.inv * 12) % 2 && !w.power) return;
  g.save(); g.translate(sx(f.x), sy(f.y) + (f.sink > 0 ? (1 - f.sink / C.PIT_SINK_S) * 30 : 0)); const s = 0.9; g.scale(s * f.face, s);
  if (w.power === 'boots') { g.strokeStyle = '#ffd23f'; g.lineWidth = 4; g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(-14, -2 - i * 4); g.lineTo(14, -4 - i * 4); } g.stroke(); }
  drawFox(g, pose, { face, blink });
  if (w.power === 'boots') { for (const dx of [-8, 8]) { rr(g, dx - 10, -14, 20, 12, 5); outlineFill(g, '#4f7cff', '#1d2a66', 3); } }
  g.restore();
  if (w.power === 'bubble') { g.beginPath(); g.arc(sx(f.x), sy(f.y + 0.8), 46, 0, 7); g.fillStyle = 'rgba(160,220,255,0.25)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.stroke(); }
}
function ghost(g, gs) {
  if (!gs || !rigReady()) return;
  g.save(); g.globalAlpha = C.GHOST_ALPHA; g.translate(sx(gs.x), sy(gs.y)); g.scale(0.9 * (gs.face || 1), 0.9);
  const pose = gs.air ? poseOf('jump') : gs.moving ? runPose(gs.x / 1.75) : poseOf('idle');
  drawFox(g, pose, { tint: '#5b8cff' }); g.restore();
}
// ---- effects from sim events ----
export function effects(w, evs) {
  for (const e of evs) if (e.type === 'boss_bop') R.bossHit = 0.9;
  if (reduced()) return;
  for (const e of evs) {
    if (e.type === 'acorn' || e.type === 'flower') for (let i = 0; i < 6; i++) R.parts.push({ x: e.x, y: e.y, vx: Math.cos(i) * 2, vy: 2 + Math.sin(i) * 2, t: 0.5, c: '#ffd23f' });
    if (e.type === 'bop') R.fx.push({ kind: 'poof', x: e.x, y: e.y + 0.7, t: 0 });
    if (e.type === 'land' && Math.abs(w.fox.vx) > 1) for (let i = 0; i < 3; i++) R.parts.push({ x: w.fox.x, y: w.fox.y + 0.1, vx: (i - 1) * 1.5, vy: 1, t: 0.3, c: '#d9c6a3' });
    if (e.type === 'right' || e.type === 'boss_bop') for (let i = 0; i < 14; i++) R.parts.push({ x: w.fox.x, y: w.fox.y + 1, vx: Math.cos(i * 0.45) * 5, vy: Math.sin(i * 0.45) * 5 + 2, t: 0.8, c: ['#ffd23f', '#ff8fc8', '#7fd9ff', '#9be07a'][i % 4] });
    if (e.type === 'bubble_pop') R.fx.push({ kind: 'ring', x: w.fox.x, y: w.fox.y + 0.8, t: 0 });
  }
}
function drawEffects(g, dt) {
  for (const p of R.parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 12 * dt; g.globalAlpha = Math.max(0, Math.min(1, p.t * 3)); g.fillStyle = p.c; g.beginPath(); g.arc(sx(p.x), sy(p.y), 4, 0, 7); g.fill(); }
  g.globalAlpha = 1; R.parts = R.parts.filter((p) => p.t > 0);
  for (const e of R.fx) { e.t += dt; if (e.kind === 'poof') img(g, art(['fx', 'poof']), sx(e.x), sy(e.y), 1.8 * T * (0.6 + e.t), { alpha: Math.max(0, 1 - e.t / 0.6) }); else { g.strokeStyle = `rgba(255,255,255,${Math.max(0, 1 - e.t * 2)})`; g.lineWidth = 4; g.beginPath(); g.arc(sx(e.x), sy(e.y), 46 + e.t * 80, 0, 7); g.stroke(); } }
  R.fx = R.fx.filter((e) => e.t < 0.7);
}

function fence(g, x) {
  const X = sx(x), Y = sy(0);
  g.fillStyle = P.plank; g.strokeStyle = '#3a2116'; g.lineWidth = 3;
  for (const dx of [-14, 0, 14]) { rr(g, X + dx - 5, Y - 62, 10, 62, 3); g.fill(); g.stroke(); }
  for (const dy of [-48, -22]) { rr(g, X - 22, Y + dy, 44, 9, 3); g.fill(); g.stroke(); }
}
// ---- one frame ----
export function draw(g, w, dt, { ghostAt = null } = {}) {
  R.t += dt; R.dt = dt; R.bossHit = Math.max(0, R.bossHit - dt); P = WORLDS[w.lvl.world] || WORLDS.x2;
  const f = w.fox, L = w.lvl;
  // camera: Fox at 35% from the left, smooth; up when Fox is high (Spring Boots)
  const len = L.length || 20;
  // in front of an open bay the camera frames the whole bay (all 3 numbers and the vine door)
  const bayNear = w.bays.find((b) => b.state === 'ask' && f.x > b.x0 - 8 && f.x < b.curtain + 1);
  const want = bayNear ? Math.max(f.x - 15, Math.min(f.x - 3, bayNear.x0 - 2.5)) : f.x - 7;
  const tx = w.kind === 'boss' ? 0 : Math.max(0, Math.min(len - 20, want));
  const ty = Math.max(0, f.y - 5.5);
  const k = Math.min(1, dt * 6);
  R.cam.x += (tx - R.cam.x) * (Math.abs(tx - R.cam.x) > 8 ? 1 : k); R.cam.y += (ty - R.cam.y) * k;
  background(g, w);
  if (w.boss) { try { parade(g, w); } catch { /* never stop the game for a background picture */ } }
  // pits (soft leaf floors) between ground pieces
  const gr = L.ground.slice().sort((p, q) => p[0] - q[0]);
  for (let i = 1; i < gr.length; i++) if (gr[i][0] > gr[i - 1][1]) leafBed(g, gr[i - 1][1], gr[i][0]);
  for (const s of gr) earth(g, s[0], s[1], s[2] ?? 0, -40);
  for (const s of L.solids || []) { if ((s[3] ?? 0) > 0.05 || s[2] - (s[3] ?? 0) <= 1.05) log(g, s[0], s[1], s[2], s[3] ?? 0); else earth(g, s[0], s[1], s[2], s[3] ?? 0); }
  // v0.4: walls are invisible (v0.3 drew them as full-height green bars); the boss arena shows a short fence instead.
  if (L.fence) fence(g, L.fence);
  for (const m of L.mushrooms || []) mushroom(g, m[0]);
  for (const p of onewaysAt(w)) { if (p.num) continue; if (p.mover) leaf(g, p.x0, p.x1, p.y); else plank(g, p.x0, p.x1, p.y); }
  if (L.checkpoint) flag(g, L.checkpoint, false);
  if (L.finish) flag(g, L.finish, true);
  for (const b of w.bays) {
    sign(g, b);
    if (sx(b.x0) > VW + 100 || sx(b.curtain) < -100) { continue; }
    b.plats.forEach((cx, i) => {
      const sunk = b.sunk.includes(i);
      const val = b.q ? b.q.choices[i] : null;
      numPlat(g, cx - C.PLAT_W / 2, C.PLAT_Y + b.plY[i] - (sunk ? 0.8 : 0), val, { glow: b.glow === i, ok: b.state === 'done' && b.q && i === b.q.correctIndex, fade: sunk ? 0.45 : 1 });
    });
    curtain(g, b);
  }
  if (w.boss) {
    boss(g, w);
    const B = w.boss;
    if (B.q && B.phase === 'ask') bossPlats(w).forEach((p, i) => { const sunk = B.sunk.includes(i); numPlat(g, p.x0, C.PLAT_Y + B.plY[i] - (sunk ? 0.8 : 0), B.q.choices[i], { glow: B.glow === i, fade: sunk ? 0.45 : 1 }); });
  }
  for (const p of w.pickups) { if (p.got) continue; if (sx(p.x) < -30 || sx(p.x) > VW + 30) continue; if (p.kind === 'acorn') acorn(g, p.x, p.y + Math.sin(R.t * 3 + p.x) * 0.06); else if (p.kind === 'flower') flower(g, p.x, p.y); else bubble(g, p); }
  for (const m of w.mons) monster(g, m);
  ghost(g, ghostAt);
  fox(g, w, dt);
  drawEffects(g, dt);
}
// A still icon for menus (How to play, HUD power ring)
export function iconCanvas(kind, size = 56) {
  const c = document.createElement('canvas'); c.width = c.height = size * 2; const g = c.getContext('2d'); g.scale(2, 2);
  if (kind === 'boots' || kind === 'bubble') powerIcon(g, kind, size / 2, size / 2, size / 36);
  c.className = 'icv'; c.style.width = c.style.height = size + 'px'; return c;
}
export function foxCanvas(poseName = 'idle', size = 120, face = 'happy') {
  const c = document.createElement('canvas'); c.width = c.height = size * 2; const g = c.getContext('2d'); g.scale(2, 2);
  g.translate(size / 2, size * 0.95); const s = size / 130; g.scale(s, s); if (rigReady()) drawFox(g, poseOf(poseName), { face });
  c.className = 'foxcv'; c.style.width = c.style.height = size + 'px'; return c;
}
