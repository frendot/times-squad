// Controls (spec 9): keys on a computer; big Left / Right / Jump buttons on a phone (they appear after the first touch).
const held = { left: new Set(), right: new Set(), jump: new Set(), down: new Set() };
let onPause = null, touchSeen = false, root = null;
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'down', KeyS: 'down' }; // v0.5 B2: Down = Slide
function kd(e) {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (onPause) { e.preventDefault(); onPause(); } return; }
  const k = KEYS[e.code]; if (!k) return; e.preventDefault(); held[k].add('k' + e.code);
}
function ku(e) { const k = KEYS[e.code]; if (k) held[k].delete('k' + e.code); }
function blur() { for (const s of Object.values(held)) s.clear(); }
export function bits() { return (held.left.size ? 1 : 0) | (held.right.size ? 2 : 0) | (held.jump.size ? 4 : 0) | (held.down.size ? 8 : 0); }
// v0.5 B2: a swipe down on a phone = Down for a short moment (the Slide)
function swipeDown() { held.down.add('swipe'); setTimeout(() => held.down.delete('swipe'), 120); }
export function clear() { blur(); }
function showTouch() { touchSeen = true; if (root) root.classList.add('touch'); }
export function bind(node, { pause }) {
  root = node; onPause = pause;
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', blur);
  if (touchSeen) node.classList.add('touch');
  node.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') showTouch(); });
  // swipe down anywhere on the game (also starting on a button): Slide
  const sw = new Map();
  node.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sw.set(e.pointerId, { y: e.clientY, x: e.clientX, t: performance.now(), done: false }); }, true);
  node.addEventListener('pointermove', (e) => { const s0 = sw.get(e.pointerId); if (!s0 || s0.done) return; const dy = e.clientY - s0.y, dx = Math.abs(e.clientX - s0.x);
    if (dy > Math.max(28, innerHeight * 0.06) && dy > dx && performance.now() - s0.t < 600) { s0.done = true; swipeDown(); } }, true);
  for (const ev of ['pointerup', 'pointercancel']) node.addEventListener(ev, (e) => sw.delete(e.pointerId), true);
  for (const b of node.querySelectorAll('[data-btn]')) {
    const k = b.dataset.btn;
    const down = (e) => { e.preventDefault(); showTouch(); held[k].add('p' + e.pointerId); try { b.setPointerCapture(e.pointerId); } catch { /* fine */ } b.classList.add('on'); };
    const up = (e) => { held[k].delete('p' + e.pointerId); if (!held[k].size) b.classList.remove('on'); };
    b.addEventListener('pointerdown', down);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
export function unbind() { removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur); blur(); onPause = null; root = null; }
export const touchMode = () => touchSeen;
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') touchSeen = true; }, { passive: true, capture: true });
