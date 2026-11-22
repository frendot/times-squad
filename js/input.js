// Controls (spec 9): keys on a computer; big Left / Right / Jump buttons on a phone (they appear after the first touch).
const held = { left: new Set(), right: new Set(), jump: new Set() };
let onPause = null, touchSeen = false, root = null;
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' };
function kd(e) {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (onPause) { e.preventDefault(); onPause(); } return; }
  const k = KEYS[e.code]; if (!k) return; e.preventDefault(); held[k].add('k' + e.code);
}
function ku(e) { const k = KEYS[e.code]; if (k) held[k].delete('k' + e.code); }
function blur() { for (const s of Object.values(held)) s.clear(); }
export function bits() { return (held.left.size ? 1 : 0) | (held.right.size ? 2 : 0) | (held.jump.size ? 4 : 0); }
export function clear() { blur(); }
function showTouch() { touchSeen = true; if (root) root.classList.add('touch'); }
export function bind(node, { pause }) {
  root = node; onPause = pause;
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', blur);
  if (touchSeen) node.classList.add('touch');
  node.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') showTouch(); });
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
