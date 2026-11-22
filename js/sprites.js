// Cartoon sprites, drawn once into small canvases (thick dark outlines, bright colours). Original procedural art, no files.
export const INK = '#1b1230';
export function mk(w, h, draw) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h);
  const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round'; draw(g, w, h); return c;
}
// fill + thick outline helper
export function blob(g, path, fill, lw = 6, stroke = INK) { g.beginPath(); path(g); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); } }
const ell = (x, y, rx, ry, r = 0) => (g) => g.ellipse(x, y, rx, ry, r, 0, Math.PI * 2);
const circ = (x, y, r) => ell(x, y, r, r);
const rr = (x, y, w, h, r) => (g) => g.roundRect(x, y, w, h, r);
export function eye(g, x, y, r, look = 0, closed = false) {
  if (closed) { g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x, y + r * 0.7, x + r, y); g.lineWidth = r * 0.35; g.strokeStyle = INK; g.stroke(); return; }
  blob(g, circ(x, y, r), '#fff', r * 0.28);
  blob(g, circ(x + look * r * 0.35, y + r * 0.1, r * 0.5), INK, 0);
  blob(g, circ(x + look * r * 0.35 + r * 0.18, y - r * 0.12, r * 0.17), '#fff', 0);
}
function grad(g, y0, y1, a, b) { const k = g.createLinearGradient(0, y0, 0, y1); k.addColorStop(0, a); k.addColorStop(1, b); return k; }

export function buildSprites() {
  const S = {};
  S.log = mk(260, 120, (g) => {
    blob(g, rr(14, 22, 232, 86, 40), grad(g, 22, 108, '#c9803f', '#8a4b1f'), 8);
    blob(g, ell(52, 65, 30, 40), '#f3c27a', 7); blob(g, ell(52, 65, 17, 24), '#d9984d', 4); blob(g, ell(52, 65, 6, 9), '#a9662a', 0);
    g.strokeStyle = '#6d3712'; g.lineWidth = 5; for (const x of [120, 170, 210]) { g.beginPath(); g.moveTo(x, 34); g.quadraticCurveTo(x + 8, 65, x, 96); g.stroke(); }
    blob(g, ell(160, 26, 26, 9), '#6ccf3f', 5);
  });
  S.rock = mk(220, 200, (g) => {
    blob(g, (q) => { q.moveTo(20, 190); q.quadraticCurveTo(0, 90, 70, 40); q.quadraticCurveTo(120, 0, 170, 50); q.quadraticCurveTo(220, 110, 200, 190); q.closePath(); }, grad(g, 10, 190, '#b3b7d6', '#62668f'), 9);
    blob(g, ell(90, 70, 30, 16, -0.5), 'rgba(255,255,255,.45)', 0);
    blob(g, (q) => { q.moveTo(40, 60); q.quadraticCurveTo(90, 20, 160, 46); q.quadraticCurveTo(110, 50, 60, 76); q.closePath(); }, '#7bd655', 6);
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(130, 120); g.lineTo(150, 150); g.lineTo(140, 175); g.stroke();
  });
  S.branch = mk(420, 110, (g) => {
    blob(g, rr(6, 30, 408, 46, 23), grad(g, 30, 76, '#a5682f', '#6d3d16'), 8);
    for (const [x, y, r] of [[60, 28, 0.4], [150, 82, -0.5], [250, 26, 0.6], [340, 84, -0.3], [390, 30, 0.2]]) blob(g, ell(x, y, 34, 14, r), '#59c43a', 6);
    for (const x of [100, 200, 300]) blob(g, circ(x, 52, 7), '#ffd23f', 4);
  });
  S.coin = mk(120, 120, (g) => {
    blob(g, circ(60, 60, 50), grad(g, 10, 110, '#fff1a0', '#f2a516'), 8);
    blob(g, circ(60, 60, 34), '#ffd23f', 5);
    g.fillStyle = '#fff8d0'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 22; g.lineTo(60 + Math.cos(a) * r, 60 + Math.sin(a) * r); } g.closePath(); g.fill(); g.lineWidth = 4; g.strokeStyle = '#c47a07'; g.stroke();
  });
  const PCOL = { shield: '#4fc3ff', magnet: '#ff5d73', jetpack: '#ff9f1c', giant: '#9b5de5' };
  S.box = {};
  for (const k of Object.keys(PCOL)) S.box[k] = mk(160, 160, (g) => {
    blob(g, rr(12, 12, 136, 136, 26), grad(g, 12, 148, '#fff', PCOL[k]), 9);
    blob(g, rr(28, 28, 104, 104, 18), PCOL[k], 5);
    drawPowerIcon(g, k, 80, 80, 40);
  });
  // monsters: [open, blink] frames
  const slime = (blink) => mk(200, 170, (g) => {
    blob(g, (q) => { q.moveTo(16, 160); q.quadraticCurveTo(0, 60, 100, 20); q.quadraticCurveTo(200, 60, 184, 160); q.quadraticCurveTo(100, 172, 16, 160); }, grad(g, 20, 160, '#b6ff7a', '#2fbf4a'), 9);
    blob(g, ell(70, 50, 22, 12, -0.6), 'rgba(255,255,255,.6)', 0);
    eye(g, 72, 88, 24, 0.3, blink); eye(g, 132, 84, 28, -0.2, blink);
    blob(g, (q) => { q.moveTo(80, 128); q.quadraticCurveTo(104, 148, 128, 126); q.closePath(); }, '#7a1f3d', 5);
    blob(g, ell(104, 134, 9, 5), '#ff7aa2', 0);
  });
  const bat = (up, blink) => mk(260, 170, (g) => {
    const wing = (s) => (q) => { const y = up ? 20 : 120; q.moveTo(130, 85); q.quadraticCurveTo(130 + s * 60, y - 10, 130 + s * 125, y); q.quadraticCurveTo(130 + s * 95, 100, 130 + s * 105, 125); q.quadraticCurveTo(130 + s * 70, 105, 130 + s * 55, 120); q.closePath(); };
    blob(g, wing(-1), '#8f5bd6', 7); blob(g, wing(1), '#8f5bd6', 7);
    blob(g, (q) => { q.moveTo(100, 50); q.lineTo(108, 18); q.lineTo(122, 46); q.closePath(); }, '#6f3fb8', 6);
    blob(g, (q) => { q.moveTo(160, 50); q.lineTo(152, 18); q.lineTo(138, 46); q.closePath(); }, '#6f3fb8', 6);
    blob(g, circ(130, 85, 46), grad(g, 40, 130, '#c49bff', '#7a43c9'), 8);
    eye(g, 113, 80, 17, 0.2, blink); eye(g, 149, 80, 17, -0.2, blink);
    blob(g, (q) => { q.moveTo(118, 108); q.lineTo(124, 120); q.lineTo(130, 108); q.lineTo(136, 120); q.lineTo(142, 108); q.closePath(); }, '#fff', 4);
  });
  const roller = (blink) => mk(180, 180, (g) => {
    blob(g, circ(90, 90, 80), grad(g, 10, 170, '#ffb36b', '#e0592a'), 9);
    g.strokeStyle = '#a8380f'; g.lineWidth = 9; for (const a of [-0.9, 0, 0.9]) { g.beginPath(); g.arc(90, 90, 62, a - 0.35, a + 0.35); g.stroke(); }
    eye(g, 66, 80, 20, 0.4, blink); eye(g, 114, 80, 20, 0.4, blink);
    blob(g, (q) => { q.moveTo(70, 118); q.quadraticCurveTo(90, 134, 110, 118); }, 'rgba(0,0,0,0)', 6);
  });
  const ball = () => mk(150, 150, (g) => {
    for (const [x, y, r] of [[50, 60, 34], [95, 55, 36], [75, 30, 32], [70, 95, 40], [105, 95, 30]]) blob(g, circ(x, y, r), '#3fae3a', 8);
    for (const [x, y, r] of [[50, 60, 26], [95, 55, 28], [75, 30, 24], [70, 95, 32], [105, 95, 22]]) blob(g, circ(x - 6, y - 6, r * 0.35), '#78d661', 0);
  });
  S.mon = { slime: [slime(false), slime(true)], bat: [bat(true, false), bat(false, false), bat(true, true), bat(false, true)], roller: [roller(false), roller(true)], ball: [ball(), ball()] };
  // side props
  S.palm = mk(260, 420, (g) => {
    g.lineWidth = 30; g.strokeStyle = INK; g.beginPath(); g.moveTo(140, 415); g.quadraticCurveTo(110, 250, 150, 110); g.stroke();
    g.lineWidth = 20; g.strokeStyle = '#b5713a'; g.stroke();
    for (const [a, l] of [[-2.7, 120], [-2.1, 110], [-0.4, 120], [-1.0, 110], [-1.6, 90]]) {
      blob(g, (q) => { q.moveTo(150, 110); q.quadraticCurveTo(150 + Math.cos(a) * l * 0.6, 110 + Math.sin(a) * l * 0.6 - 30, 150 + Math.cos(a) * l, 110 + Math.sin(a) * l + 40); q.quadraticCurveTo(150 + Math.cos(a) * l * 0.5, 110 + Math.sin(a) * l * 0.5 + 10, 150, 110); }, '#3ccf4e', 7);
    }
    blob(g, circ(140, 120, 14), '#8a4b1f', 5); blob(g, circ(162, 124, 12), '#8a4b1f', 5);
  });
  S.pillar = mk(160, 400, (g) => {
    blob(g, rr(30, 60, 100, 330, 8), grad(g, 60, 390, '#f2d6a2', '#c29a5b'), 8);
    blob(g, rr(14, 30, 132, 40, 10), '#e7c27f', 8); blob(g, rr(14, 370, 132, 26, 8), '#d4ac68', 7);
    g.strokeStyle = 'rgba(80,50,20,.45)'; g.lineWidth = 6; for (const x of [55, 80, 105]) { g.beginPath(); g.moveTo(x, 80); g.lineTo(x, 360); g.stroke(); }
    blob(g, (q) => { q.moveTo(30, 150); q.quadraticCurveTo(60, 120, 90, 170); q.quadraticCurveTo(110, 210, 130, 190); q.lineTo(130, 220); q.quadraticCurveTo(100, 240, 80, 200); q.quadraticCurveTo(60, 160, 30, 180); q.closePath(); }, '#3ccf4e', 5);
  });
  S.bush = mk(240, 150, (g) => {
    for (const [x, y, r] of [[60, 100, 50], [120, 70, 62], [180, 100, 50], [120, 115, 45]]) blob(g, circ(x, y, r), '#2fb64a', 8);
    for (const [x, y] of [[80, 70], [150, 50], [190, 90]]) blob(g, circ(x, y, 9), '#ff5d8f', 4);
  });
  S.torch = mk(90, 300, (g) => {
    blob(g, rr(36, 90, 18, 205, 6), '#8a4b1f', 6);
    blob(g, rr(22, 72, 46, 30, 8), '#6b5b4b', 6);
    blob(g, (q) => { q.moveTo(45, 6); q.quadraticCurveTo(80, 50, 64, 76); q.lineTo(26, 76); q.quadraticCurveTo(10, 50, 45, 6); }, '#ffb020', 5);
    blob(g, (q) => { q.moveTo(45, 34); q.quadraticCurveTo(60, 60, 54, 74); q.lineTo(36, 74); q.quadraticCurveTo(30, 60, 45, 34); }, '#fff27a', 0);
  });
  return S;
}
export function drawPowerIcon(g, k, x, y, r) {
  g.save(); g.translate(x, y); g.lineJoin = 'round'; g.lineCap = 'round';
  if (k === 'shield') blob(g, (q) => { q.moveTo(0, -r); q.quadraticCurveTo(r, -r * 0.8, r * 0.85, -r * 0.2); q.quadraticCurveTo(r * 0.6, r * 0.7, 0, r); q.quadraticCurveTo(-r * 0.6, r * 0.7, -r * 0.85, -r * 0.2); q.quadraticCurveTo(-r, -r * 0.8, 0, -r); }, '#e8f8ff', r * 0.14);
  if (k === 'magnet') { g.lineWidth = r * 0.5; g.strokeStyle = INK; g.beginPath(); g.arc(0, -r * 0.1, r * 0.6, Math.PI, 0); g.lineTo(r * 0.6, r * 0.7); g.moveTo(-r * 0.6, -r * 0.1); g.lineTo(-r * 0.6, r * 0.7); g.stroke(); g.lineWidth = r * 0.3; g.strokeStyle = '#fff'; g.stroke(); }
  if (k === 'jetpack') { blob(g, rr(-r * 0.7, -r * 0.8, r * 0.6, r * 1.3, r * 0.25), '#e8eef7', r * 0.12); blob(g, rr(r * 0.1, -r * 0.8, r * 0.6, r * 1.3, r * 0.25), '#e8eef7', r * 0.12); blob(g, (q) => { q.moveTo(-r * 0.6, r * 0.55); q.lineTo(-r * 0.4, r); q.lineTo(-r * 0.2, r * 0.55); q.moveTo(r * 0.2, r * 0.55); q.lineTo(r * 0.4, r); q.lineTo(r * 0.6, r * 0.55); }, '#ffd23f', r * 0.08); }
  if (k === 'giant') { blob(g, (q) => { q.moveTo(-r * 0.2, -r); q.lineTo(r * 0.5, -r); q.lineTo(r * 0.1, -r * 0.1); q.lineTo(r * 0.6, -r * 0.1); q.lineTo(-r * 0.3, r); q.lineTo(-r * 0.05, r * 0.1); q.lineTo(-r * 0.55, r * 0.1); q.closePath(); }, '#fff27a', r * 0.14); }
  g.restore();
}
