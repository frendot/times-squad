// Fox cut-out puppet (spec 10.1): flat painted parts on a skeleton, posed from art/fox-rig.json.
// The run cycle has 8 key poses; the phase follows the distance walked, so feet do not slide.
let RIG = null;
export async function loadRig() {
  try { const r = await fetch(new URL('../art/fox-rig.json', import.meta.url)); RIG = await r.json(); } catch { RIG = null; }
  return RIG;
}
const D = Math.PI / 180;
const lerp = (a, b, k) => a + (b - a) * k;
export const rigKeys = () => (RIG ? RIG.keys : []);
export function poseOf(name) { return RIG && RIG.poses[name]; }
export function blend(p, q, k) { return p.map((v, i) => lerp(v, q[i], k)); }
export function runPose(phase) { // phase 0..1
  const R = RIG.run, n = R.length, x = (((phase % 1) + 1) % 1) * n, i = Math.floor(x), k = x - i;
  const s = k * k * (3 - 2 * k);
  return blend(R[i], R[(i + 1) % n], s);
}
const P = (o) => Object.fromEntries(RIG.keys.map((k, i) => [k, o[i]]));
function limb(g, x, y, a1, l1, a2, l2, w, col, sock, out) {
  const x1 = x + Math.sin(a1 * D) * l1, y1 = y + Math.cos(a1 * D) * l1;
  const x2 = x1 + Math.sin((a1 - a2) * D) * l2, y2 = y1 + Math.cos((a1 - a2) * D) * l2;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = out; g.lineWidth = w + 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = sock; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  return [x2, y2, a1 - a2];
}
// Draw Fox with feet at (0,0), facing right, 100 units tall. opts: { face: 'happy'|'oops'|'think'|'joy', blink, alpha, tint }
export function drawFox(g, pose, opts = {}) {
  if (!RIG) return;
  const p = P(pose), C = RIG.colours, S = RIG.skeleton, out = opts.tint || C.outline;
  const fur = opts.tint ? opts.tint : C.fur, dark = opts.tint ? opts.tint : C.furDark, cream = opts.tint ? '#dfeaff' : C.cream, sock = opts.tint ? opts.tint : C.sock;
  g.save();
  g.translate(0, -p.bob);
  // tail (behind)
  g.save(); g.translate(S.tailRoot[0], S.tailRoot[1]); g.rotate((-70 - p.tail) * D);
  g.beginPath(); g.moveTo(0, -6); g.bezierCurveTo(10, -16, 30, -14, S.tailLen, 0); g.bezierCurveTo(30, 14, 10, 16, 0, 6); g.closePath();
  g.fillStyle = fur; g.strokeStyle = out; g.lineWidth = 4; g.fill(); g.stroke();
  g.beginPath(); g.moveTo(S.tailLen - 11, -8); g.quadraticCurveTo(S.tailLen + 2, -4, S.tailLen, 0); g.quadraticCurveTo(S.tailLen + 2, 4, S.tailLen - 11, 8); g.quadraticCurveTo(S.tailLen - 15, 0, S.tailLen - 11, -8);
  g.fillStyle = cream; g.fill(); g.stroke();
  g.restore();
  // back arm and back leg
  limb(g, S.shoulder[0] - 3, S.shoulder[1], p.armB, S.upperArm, p.elbB, S.foreArm, 7, dark, sock, out);
  limb(g, S.hipB[0], S.hipB[1], p.hipB, S.thigh, p.kneeB, S.shin, 9, dark, sock, out);
  // body
  g.save(); g.translate(S.hip[0], S.hip[1]); g.rotate(p.lean * D);
  g.beginPath(); g.ellipse(4, -10, 19, 14, -0.5, 0, Math.PI * 2); g.fillStyle = fur; g.strokeStyle = out; g.lineWidth = 4; g.fill(); g.stroke();
  g.beginPath(); g.ellipse(11, -12, 8, 10, -0.6, 0, Math.PI * 2); g.fillStyle = cream; g.fill();
  g.restore();
  // front leg
  limb(g, S.hipF[0], S.hipF[1], p.hipF, S.thigh, p.kneeF, S.shin, 9, fur, sock, out);
  // head
  g.save(); g.translate(S.neck[0] + p.lean * 0.3, S.neck[1]); g.rotate(p.head * D);
  const ear = (x, s) => { g.beginPath(); g.moveTo(x - 7 * s, -10); g.lineTo(x - 2, -32); g.lineTo(x + 8 * s, -11); g.closePath(); g.fillStyle = fur; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 3, -13); g.lineTo(x - 2, -26); g.lineTo(x + 4, -13); g.closePath(); g.fillStyle = C.sock; if (!opts.tint) g.fill(); };
  g.strokeStyle = out; g.lineWidth = 4;
  ear(-6, 1); ear(7, 1);
  g.beginPath(); g.ellipse(0, -6, 16, 14, 0, 0, Math.PI * 2); g.fillStyle = fur; g.fill(); g.stroke();
  // snout
  g.beginPath(); g.moveTo(8, -12); g.quadraticCurveTo(26, -6, 29, -1); g.quadraticCurveTo(20, 6, 4, 6); g.closePath(); g.fillStyle = cream; g.fill(); g.stroke();
  g.beginPath(); g.arc(28, -2, 3.5, 0, Math.PI * 2); g.fillStyle = C.eye; g.fill();
  // face
  const face = opts.face || 'happy';
  g.fillStyle = C.eye; g.strokeStyle = C.eye; g.lineWidth = 2.5;
  if (opts.blink || face === 'joy') { g.beginPath(); g.arc(8, -9, 4, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  else {
    const r = face === 'oops' ? 5 : 4;
    g.beginPath(); g.ellipse(8, face === 'think' ? -11 : -9, r * 0.8, r, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(9.2, (face === 'think' ? -12.5 : -10.5), 1.4, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = C.eye; g.lineWidth = 2.5;
  if (face === 'oops') { g.beginPath(); g.arc(18, 3, 2.6, 0, Math.PI * 2); g.stroke(); }
  else { g.beginPath(); g.arc(17, 0, face === 'joy' ? 5 : 3.5, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  g.restore();
  // front arm
  limb(g, S.shoulder[0], S.shoulder[1], p.armF, S.upperArm, p.elbF, S.foreArm, 7, fur, sock, out);
  g.restore();
}
export const rigReady = () => !!RIG;
