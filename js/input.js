// Controls: Arrow keys or WASD (Space = jump) on a computer; swipes on a phone. No answer buttons: you steer.
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down' };
let handler = null;
export function setHandler(h) { handler = h; }
const SWIPE_PX = 28;
let t0 = null, swiped = false, lastTouch = 0;
// A tap that starts on a button belongs to that button (e.g. Home on the crash card), not to the game.
const onButton = (e) => !!(e.target && e.target.closest && e.target.closest('button'));
export function bind(target) {
  addEventListener('keydown', (e) => {
    if (!handler) return;
    if (e.repeat && KEYS[e.code]) { e.preventDefault(); return; }
    if (KEYS[e.code]) { e.preventDefault(); handler.action && handler.action(KEYS[e.code], 'key'); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { handler.pause && handler.pause(); return; }
    if (e.code === 'Enter') { e.preventDefault(); handler.tap && handler.tap('key'); }
  });
  target.addEventListener('touchstart', (e) => { lastTouch = Date.now(); const p = e.changedTouches[0]; t0 = { x: p.clientX, y: p.clientY }; swiped = false; t0.btn = onButton(e); }, { passive: true });
  target.addEventListener('touchmove', (e) => {
    if (!t0 || !handler) return; const p = e.changedTouches[0]; const dx = p.clientX - t0.x, dy = p.clientY - t0.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    const a = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    swiped = true; t0 = { x: p.clientX, y: p.clientY }; // more swipes in the same touch are fine
    if (e.cancelable) e.preventDefault();
    handler.action && handler.action(a, 'swipe');
  }, { passive: false });
  target.addEventListener('touchend', () => { if (t0 && !swiped && !t0.btn && handler && handler.tap) handler.tap('touch'); t0 = null; }, { passive: true });
  // mouse drag works like a swipe too (handy on a laptop touchpad)
  let m0 = null;
  target.addEventListener('mousedown', (e) => { if (Date.now() - lastTouch < 900) return; m0 = { x: e.clientX, y: e.clientY, sw: false, btn: onButton(e) }; });
  target.addEventListener('mousemove', (e) => {
    if (!m0 || !handler) return; const dx = e.clientX - m0.x, dy = e.clientY - m0.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX * 1.5) return;
    m0 = { x: e.clientX, y: e.clientY, sw: true, btn: m0.btn };
    handler.action && handler.action(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'), 'drag');
  });
  target.addEventListener('mouseup', () => { if (m0 && !m0.sw && !m0.btn && handler && handler.tap) handler.tap('mouse'); m0 = null; });
}
