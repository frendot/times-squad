// The pure, fixed-step platformer simulation (spec 4, 5.6, 6.1, 7, 8). No drawing, no DOM, no clock, no Math.random:
// the same level + the same question context + the same input log always gives the same run, step for step (AC-21, AC-30).
// Units: 1 T (tile). y points up; the ground top is y = 0.
import { CONFIG as C } from './config.js';

const DT = C.STEP_S;
export const BITS = { left: 1, right: 2, jump: 4, down: 8 };
// v0.5 B2: Fox's height (a slide makes Fox low)
export const foxH = (f) => (f.slide > 0 ? C.SLIDE_H : C.FOX_H);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tri = (t, period) => { const p = ((t / period) % 1 + 1) % 1; return p < 0.5 ? p * 4 - 1 : 3 - p * 4; }; // -1..1..-1

export function newWorld(lvl, opts = {}) {
  const w = {
    lvl, kind: lvl.kind, steps: 0, timer: 0, timerOn: false, started: false, finished: false, frozen: 0,
    mode: 'play', modeT: 0, card: null, events: [], acorns: 0, acornsGot: 0,
    jumpHelp: !!opts.jumpHelp, slow: opts.calm ? C.CALM_SLOW : 1, hard: !!opts.hard, penalty: 0, rightCount: 0, cardTap: false,
    fox: { x: lvl.start, y: 0, vx: 0, vy: 0, ground: true, on: null, coyote: 0, buf: 0, held: false, face: 1, inv: 0, push: 0, sink: 0, wobble: 0,
      safe: { x: lvl.start, y: 0 }, still: 0, bop: 0, land: 0, launch: null, dj: false, glide: false, slide: 0 },
    prev: 0, power: null, powerT: 0, powersGot: 0,
    pickups: [...(lvl.acorns || []).map(([x, y]) => ({ kind: 'acorn', x, y, got: false })), ...(lvl.parts || []).map(([x, y], i) => ({ kind: 'part', i, x, y, got: false, had: (opts.hadParts || []).includes(i) }))],
    partsGot: [], // v0.5b2 shuttle parts found in this run
    mons: (lvl.monsters || []).map((m, i) => ({ ...m, id: i, x: m.x, y: m.y || 0, state: 'live', t: 0, dir: 1 })),
    bays: (lvl.bays || []).map((b) => ({ ...b, q: null, state: 'wait', sunk: [], gone: [], misses: 0, plY: [0, 0, 0], open: 0, glow: -1, landed: -1 })),
    qi: -1, qShown: false, answers: [], checkpoint: false, bossBops: 0, boss: null,
  };
  if (lvl.kind === 'boss') w.boss = { bops: 0, phase: 'intro', t: 0, attack: null, attackI: 0, drift: 0, driftOn: true, q: null, sunk: [], gone: [], misses: 0, plY: [0, 0, 0], glow: -1, retry: [], scale: 1, done: false };
  if (opts.resume) Object.assign(w, opts.resume(w));
  return w;
}
const emit = (w, type, data = {}) => w.events.push({ type, ...data });

// ---- geometry ----
function moverY(m, t) { return m.y + m.range * tri(t * m.speed / (4 * m.range) + (m.phase || 0), 1); }
export function solidsAt(w) {
  const L = w.lvl, out = [];
  for (const g of L.ground) out.push({ x0: g[0], x1: g[1], top: g[2] ?? 0, bot: -40 });
  for (const s of L.solids || []) out.push({ x0: s[0], x1: s[1], top: s[2], bot: s[3] ?? 0 });
  for (const b of w.bays) if (b.open < 1) out.push({ x0: b.curtain, x1: b.curtain + 0.6, top: 9, bot: -40, curtain: true });
  if (L.walls) for (const x of L.walls) out.push({ x0: x - 0.5, x1: x + 0.5, top: 30, bot: -40 });
  return out;
}
export function onewaysAt(w) {
  const t = w.steps * DT, out = [];
  for (const p of w.lvl.oneway || []) out.push({ x0: p[0], x1: p[1], y: p[2] });
  for (const m of w.lvl.movers || []) { const y = moverY(m, t); out.push({ x0: m.x0, x1: m.x1, y, mover: m, dy: y - moverY(m, t - DT) }); }
  for (const b of w.bays) if (b.q || b.state === 'wait') b.plats.forEach((cx, i) => { if (!b.sunk.includes(i) && !b.gone.includes(i)) out.push({ x0: cx - C.PLAT_W / 2, x1: cx + C.PLAT_W / 2, y: C.PLAT_Y + b.plY[i], bay: b, i, num: true }); });
  if (w.boss && w.boss.q && w.boss.phase === 'ask') bossPlats(w).forEach((p, i) => { if (!w.boss.sunk.includes(i) && !w.boss.gone.includes(i)) out.push({ ...p, y: C.PLAT_Y + w.boss.plY[i], boss: true, i, num: true }); });
  if (w.lvl.ledges) for (const p of w.lvl.ledges) out.push({ x0: p[0], x1: p[1], y: p[2] });
  return out;
}
export function bossPlats(w) {
  const B = w.boss, off = clamp(B.drift, -1, 1);
  return w.lvl.bossPlats.map((cx) => ({ x0: cx + off - C.PLAT_W / 2, x1: cx + off + C.PLAT_W / 2, cx: cx + off }));
}
// v0.5 B2: is there a solid right above a sliding Fox (so Fox cannot stand up yet)?
function roofOver(w, f) { const hw = C.FOX_W / 2; return solidsAt(w).some((s) => f.x + hw > s.x0 && f.x - hw < s.x1 && s.bot > f.y + 0.01 && s.bot < f.y + C.FOX_H); }
// v0.5 B2: a surface right below a falling Fox (a jump press here is a buffered ground jump, not a double jump)
function nearFloor(w, f) {
  const hw = C.FOX_W / 2, reach = Math.max(0.35, -f.vy * C.JUMP_BUFFER_S);
  if (f.vy > 0) return false;
  return solidsAt(w).some((s) => f.x + hw > s.x0 && f.x - hw < s.x1 && s.top <= f.y + 0.001 && s.top >= f.y - reach) || onewaysAt(w).some((p) => f.x >= p.x0 && f.x <= p.x1 && p.y <= f.y + 0.001 && p.y >= f.y - reach);
}
export const inBay = (w) => w.bays.find((b) => w.fox.x > b.x0 && w.fox.x < b.curtain + 0.6) || null;

// ---- input: one bitmask per step (left 1, right 2, jump 4) ----
export function step(w, bits, ctx) {
  w.events = [];
  const f = w.fox;
  if (w.finished) return w;
  if (!w.started && bits) { w.started = true; if (w.kind !== 'boss') { w.timerOn = true; emit(w, 'timer_start'); } }
  if (w.restoreHold && bits) w.restoreHold = false;
  const jumpEdge = (bits & 4) && !(w.prev & 4), downEdge = (bits & 8) && !(w.prev & 8);
  w.prev = bits;
  // ---- wrong-answer moment: sink, then the card (the world and the timer are frozen) ----
  if (w.mode === 'sink' || w.mode === 'card') {
    w.modeT -= DT;
    if (w.mode === 'sink') { const b = w.card.bay; b.plY[w.card.i] -= DT / C.SINK_S * 0.8; f.y = C.PLAT_Y + b.plY[w.card.i]; }
    // v0.5a: the card stays at least CARD_MIN_S, then a jump press or a tap (w.cardTap) closes it; CARD_MAX_S is a safety close
    if (w.mode === 'card' && C.CARD_MAX_S - w.modeT >= C.CARD_MIN_S && (jumpEdge || w.cardTap)) w.modeT = 0;
    if (w.mode === 'card') w.cardTap = false;
    if (w.modeT <= 0) {
      if (w.mode === 'sink') { w.mode = 'card'; w.modeT = C.CARD_MAX_S; w.cardTap = false; emit(w, 'card', { card: w.card }); }
      else { const b = w.card.bay; b.sunk.push(w.card.i); f.on = null; f.ground = false; f.vy = 0; w.mode = 'play'; w.card = null; emit(w, 'card_close'); }
    }
    return w;
  }
  if (w.restoreHold) return w; // after a checkpoint restore: everything waits for the first input
  w.steps++;
  if (w.timerOn) w.timer++;
  const bay = inBay(w);
  if (w.power && !bay) { w.powerT -= DT; if (w.powerT <= 0) { emit(w, 'power_end', { power: w.power }); w.power = null; } }
  if (w.boss) bossStep(w, ctx);
  // ---- pit: sink in the leaves, bounce back to the last safe edge ----
  if (f.sink > 0) {
    f.sink -= DT;
    if (f.sink <= 0) { f.x = f.safe.x; f.y = f.safe.y + 0.01; f.vx = 0; f.vy = 6; f.ground = false; emit(w, 'pit_back'); }
    return endStep(w, ctx);
  }
  if (f.launch) { // scripted arc (boss spring or sneeze)
    const L = f.launch; L.t += DT; const k = Math.min(1, L.t / L.dur);
    f.x = L.x0 + (L.x1 - L.x0) * k; f.y = L.y0 + (L.y1 - L.y0) * k + L.h * 4 * k * (1 - k);
    if (k >= 1) { f.launch = null; f.vx = 0; f.vy = L.after || 0; if (L.done) L.done(w); }
    return endStep(w, ctx);
  }
  // ---- horizontal ----
  const want = ((bits & 2) ? 1 : 0) - ((bits & 1) ? 1 : 0);
  const acc = C.RUN_SPEED / C.RUN_ACCEL_S;
  let target = f.push > 0 || f.wobble > 0 ? f.vx : want * C.RUN_SPEED;
  // ---- v0.5 B2 Slide: Down while running on the ground; Fox stays low and keeps going for SLIDE_S (longer while under something) ----
  if (downEdge && f.ground && !f.slide && Math.abs(f.vx) >= C.SLIDE_MIN_V && f.push <= 0 && f.wobble <= 0 && !f.pend) { f.slide = C.SLIDE_S; f.slideDir = Math.sign(f.vx); emit(w, 'slide'); }
  if (f.slide > 0) {
    target = f.slideDir * C.RUN_SPEED * C.SLIDE_SPEED;
    f.slide -= DT;
    if (f.slide <= 0 || !f.ground) { if (roofOver(w, f)) f.slide = Math.max(f.slide, DT); else f.slide = 0; }
  }
  if (f.push > 0) f.push -= DT;
  if (f.wobble > 0) { f.wobble -= DT; target = 0; }
  if (w.boss && w.boss.attack && w.boss.attack.kind === 'spin' && w.boss.attack.live) target -= C.WIND_V;
  if (f.vx < target) f.vx = Math.min(target, f.vx + acc * DT); else if (f.vx > target) f.vx = Math.max(target, f.vx - acc * DT);
  if (want) f.face = want;
  // ---- jump (coyote time, jump buffer, variable height) ----
  const coyoteS = w.jumpHelp ? C.JUMP_HELP.COYOTE_S : C.COYOTE_S;
  if (f.ground) f.coyote = coyoteS; else f.coyote -= DT;
  if (jumpEdge) f.buf = C.JUMP_BUFFER_S; else f.buf -= DT;
  if (f.ground) { f.dj = false; f.glide = false; }
  if (f.buf > 0 && f.coyote > 0 && f.wobble <= 0 && !(f.slide > 0 && roofOver(w, f))) {
    const boots = w.power === 'boots'; f.slide = 0;
    f.vy = (boots ? C.BOOTS_JUMP_V : C.JUMP_V) * (w.jumpHelp ? Math.sqrt(C.JUMP_HELP.JUMP_MULT) : 1);
    f.ground = false; f.on = null; f.coyote = 0; f.buf = 0; f.held = true; emit(w, boots ? 'jump_big' : 'jump');
  }
  // ---- v0.5 B2 double jump: one more jump in the air (not just before a landing, where the jump buffer works) ----
  else if (jumpEdge && !f.ground && f.coyote <= 0 && !f.dj && f.wobble <= 0 && f.push <= 0 && !nearFloor(w, f)) {
    f.vy = C.DJUMP_V; f.dj = true; f.held = true; f.buf = 0; f.glide = false; emit(w, 'jump2');
  }
  if (!(bits & 4)) { if (f.held && f.vy > C.HOP_CUT_V) f.vy = C.HOP_CUT_V; f.held = false; }
  f.vy = Math.max(-30, f.vy - C.GRAVITY * DT);
  // ---- v0.5 B2 Tail Spin: hold jump while falling to float down slowly ----
  if (!f.ground && f.vy < -C.GLIDE_V && (bits & 4) && f.push <= 0 && f.wobble <= 0) { f.vy = -C.GLIDE_V; if (!f.glide) { f.glide = true; emit(w, 'glide'); } }
  else if (f.glide && (!(bits & 4) || f.ground)) f.glide = false;
  // ride a moving platform
  if (f.ground && f.on && f.on.mover) f.y += f.on.dy;
  // ---- move x, collide with solids ----
  const hw = C.FOX_W / 2, H = foxH(f), solids = solidsAt(w);
  let nx = f.x + f.vx * DT;
  for (const s of solids) {
    if (f.y < s.top - 0.001 && f.y + H > s.bot && nx + hw > s.x0 && nx - hw < s.x1) {
      if (f.vx > 0 || nx < s.x0 + (s.x1 - s.x0) / 2) nx = Math.min(nx, s.x0 - hw); else nx = Math.max(nx, s.x1 + hw);
      if (f.push <= 0) f.vx = 0;
    }
  }
  f.x = nx;
  // ---- move y, land on solids and one-way platforms ----
  const py = f.y; let ny = f.y + f.vy * DT; let landed = null;
  for (const s of solids) {
    if (f.x + hw > s.x0 && f.x - hw < s.x1) {
      if (f.vy <= 0 && py >= s.top - 0.001 && ny < s.top) { ny = s.top; landed = s; }
      else if (f.vy > 0 && py + H <= s.bot + 0.001 && ny + H > s.bot) { ny = s.bot - H; f.vy = 0; }
    }
  }
  if (!landed && f.vy <= 0) {
    for (const p of onewaysAt(w)) {
      // a platform counts only when the middle of the feet is inside its edges (spec 4.4)
      const pad = p.num ? C.PLAT_EDGE_PAD : 0;
      if (f.x >= p.x0 - pad && f.x <= p.x1 + pad && py >= p.y - 0.001 - Math.max(0, p.dy || 0) && ny < p.y) { if (!landed || p.y > landed.top) { ny = p.y; landed = { ...p, top: p.y }; } }
    }
  }
  const wasGround = f.ground;
  f.y = ny;
  if (landed) {
    f.vy = 0; f.ground = true; f.on = landed;
    if (!wasGround) { f.land = 0.12; emit(w, 'land'); }
    if (landed.mush) { f.vy = C.BOUNCE_V; f.ground = false; f.on = null; emit(w, 'mushroom'); }
    else if (!landed.mover && !landed.num && !landed.curtain && !wasGround) f.safe = { x: clamp(f.x, landed.x0 + 0.7, landed.x1 - 0.7), y: landed.top };
    else if (!landed.mover && !landed.num && wasGround && f.x > landed.x0 + 0.7 && f.x < landed.x1 - 0.7) f.safe = { x: f.x, y: landed.top };
    // v0.5a: a number counts only after Fox stays on it LAND_CONFIRM_S (a landing while pushed or bounced never starts it)
    if (landed.num && !wasGround && f.push <= 0 && f.bop <= 0) f.pend = { i: landed.i, boss: !!landed.boss, bay: landed.bay || null, t: 0 };
  } else { f.ground = false; f.on = null; }
  if (f.pend) {
    const o = f.on, P = f.pend;
    if (f.ground && o && o.num && o.i === P.i && !!o.boss === P.boss && (o.bay || null) === P.bay) { P.t += DT; if (P.t >= C.LAND_CONFIRM_S - 1e-9) { f.pend = null; platformLanding(w, o, ctx); } }
    else f.pend = null;
  }
  // mushrooms are short solids that bounce
  for (const m of w.lvl.mushrooms || []) if (f.vy <= 0 && Math.abs(f.x - m[0]) < 0.7 && py >= 0.6 - 0.001 && f.y <= 0.6 && f.y > 0.1) { f.y = 0.6; f.vy = C.BOUNCE_V; f.ground = false; emit(w, 'mushroom'); }
  if (f.y < -1.4 && f.sink <= 0) { f.sink = C.PIT_SINK_S; f.vy = 0; f.vx = 0; emit(w, 'pit'); }
  if (f.inv > 0) f.inv -= DT;
  if (f.land > 0) f.land -= DT;
  if (f.bop > 0) f.bop -= DT;
  f.still = f.ground && Math.abs(f.vx) < 0.1 ? f.still + DT : 0;
  return endStep(w, ctx);
}

function endStep(w, ctx) {
  const f = w.fox, t = w.steps * DT;
  // ---- signs: the sum shows from the sign until the bay is answered ----
  for (let i = 0; i < w.bays.length; i++) {
    const b = w.bays[i];
    if (b.state === 'wait' && f.x >= b.sign) { b.state = 'ask'; b.q = ctx.ask(i, w); w.qi = i; if (b.q && b.q.assist) { b.gone = [b.q.drop]; emit(w, 'assist', { i }); } emit(w, 'sign', { i, q: b.q }); }
  }
  // ---- curtains ----
  for (const b of w.bays) if (b.state === 'done' && b.open < 1) b.open = Math.min(1, b.open + DT / C.CURTAIN_OPEN_S);
  // ---- checkpoint and finish ----
  if (w.lvl.checkpoint && !w.checkpoint && f.x >= w.lvl.checkpoint) { w.checkpoint = true; emit(w, 'checkpoint'); }
  if (w.lvl.finish && f.x >= w.lvl.finish && !w.finished) { w.finished = true; w.timerOn = false; emit(w, 'finish', { steps: w.timer }); }
  // ---- pickups ----
  for (const p of w.pickups) {
    if (p.got) continue;
    if (p.kind === 'bubble') { p.y = Math.min(p.y + DT * 1.2, p.top); }
    if (w.power === 'magnet') { /* not in the demo */ }
    if (Math.abs(p.x - f.x) < 0.75 && Math.abs(p.y - (f.y + 0.6)) < 0.95) {
      p.got = true;
      if (p.kind === 'acorn') { w.acorns++; w.acornsGot++; emit(w, 'acorn', { x: p.x, y: p.y }); }
      else if (p.kind === 'flower') { w.acorns += C.FLOWER_ACORNS; w.acornsGot += C.FLOWER_ACORNS; emit(w, 'flower', { x: p.x, y: p.y }); }
      else if (p.kind === 'part') { w.partsGot.push(p.i); emit(w, 'part', { i: p.i, x: p.x, y: p.y, n: w.partsGot.length, had: p.had }); }
      else if (p.kind === 'bubble') { w.power = p.power; w.powerT = C.POWER_S; w.powersGot++; emit(w, 'power', { power: p.power }); }
    }
  }
  // ---- monsters: fixed patterns, no random numbers ----
  for (const m of w.mons) {
    if (m.state === 'bopped') { m.t += DT; m.x += 6 * DT * m.dir; m.y += (3 - m.t * 12) * DT; if (m.t > 1.5) m.state = 'gone'; continue; }
    if (m.state !== 'live') continue;
    if (m.type === 'pine') { const span = m.x1 - m.x0; const ph = (t * C.PINE_SPEED * w.slow) / span; const k = tri(ph / 2, 1); m.x = m.x0 + span * (k + 1) / 2; m.dir = Math.sign(tri((ph + 0.01) / 2, 1) - k) || 1; }
    if (m.fly) m.y = C.FLY_Y + Math.sin(t * 2.5 + m.id) * C.FLY_BOB; // v0.5b2 flyers hover: slide under or bop from above
    else if (m.type === 'frog') { const ph = (t % (C.FROG_EVERY_S / w.slow)); const hopT = 0.8; m.y = ph < hopT ? C.FROG_HOP_T * 4 * (ph / hopT) * (1 - ph / hopT) : 0; }
    const dx = Math.abs(m.x - f.x), dy = (f.y) - (m.y + 0.9);
    if (dx < 0.95 && f.y < m.y + (m.h || 1.0) && f.y + foxH(f) > m.y) {
      if (f.vy < 0 && dy > -0.55) { // landed on its head: bop
        m.state = 'bopped'; m.t = 0; m.dir = f.x < m.x ? 1 : -1; f.vy = C.BOP_V; f.ground = false; f.bop = 0.3;
        w.pickups.push({ kind: 'flower', x: m.x, y: m.y + 0.5, got: false });
        emit(w, 'bop', { m: m.type, bad: m.bad, x: m.x, y: m.y });
      } else if (f.inv <= 0) bump(w, m.x);
    }
  }
  return w;
}
function bump(w, fromX) {
  const f = w.fox;
  if (w.power === 'bubble') { w.power = null; f.inv = 0.6; emit(w, 'bubble_pop'); return; }
  const dir = f.x < fromX ? -1 : 1;
  f.vx = dir * C.PUSH_T / 0.3; f.push = 0.3; f.vy = 5; f.ground = false; f.inv = C.BLINK_S;
  const n = Math.min(C.DROP_ACORNS, w.acorns); w.acorns -= n;
  for (let i = 0; i < n; i++) w.pickups.push({ kind: 'acorn', x: f.x + dir * (1.2 + i * 0.8), y: Math.max(0.5, f.y + 0.5), got: false, dropped: true });
  emit(w, 'bump', { dropped: n });
}

// ---- answer bays ----
function platformLanding(w, p, ctx) {
  const holder = p.boss ? w.boss : p.bay;
  if (!holder || !holder.q || (holder.state && holder.state !== 'ask') || (p.boss && w.boss.phase !== 'ask')) return;
  const q = holder.q, right = p.i === q.correctIndex, first = holder.misses === 0;
  emit(w, 'land_num', { i: p.i, right });
  if (right) {
    const res = ctx.answer(q, p.i, { first, w, misses: holder.misses });
    w.answers.push({ q: q.factId, first, misses: holder.misses }); w.rightCount++;
    holder.glow = p.i;
    if (p.boss) { bossRight(w, p); emit(w, 'right', { q, first, res }); return; }
    holder.state = 'done'; w.qShownDone = true; w.fox.vy = 7; w.fox.ground = false; w.fox.on = null; // a quick happy hop
    emit(w, 'right', { q, first, res, i: holder.i });
    if (first && ctx.powerFor) { const pw = ctx.powerFor(holder.i, w); if (pw) { w.pickups.push({ kind: 'bubble', power: pw, x: p.x0 + C.PLAT_W / 2, y: C.PLAT_Y + 0.6, top: C.PLAT_Y + 2.6, got: false }); emit(w, 'bubble', { power: pw }); } }
  } else {
    const res = ctx.answer(q, p.i, { first, w, misses: holder.misses });
    holder.misses++;
    if (w.hard && !p.boss) { w.penalty += C.HARD_PENALTY_S * 60; emit(w, 'penalty', { s: C.HARD_PENALTY_S }); }
    w.mode = 'sink'; w.modeT = C.SINK_S;
    w.card = { bay: holder, i: p.i, q, secs: C.CARD_MAX_S, repeat: !!(res && res.repeat), chosen: q.choices[p.i], misses: holder.misses };
    holder.glow = q.correctIndex; w.fox.vx = 0;
    if (p.boss) w.boss.driftOn = false;
    emit(w, 'wrong', { q, chosen: q.choices[p.i], first, res });
  }
}

// ---- boss (spec 7): always winnable, no timer, attacks only push or lift ----
function bossStep(w, ctx) {
  const B = w.boss, f = w.fox; B.t += DT;
  if (B.driftOn && B.phase === 'ask') B.drift = C.BOSS_DRIFT_T * 0.5 * tri(B.t * C.BOSS_DRIFT_V / (4 * C.BOSS_DRIFT_T * 0.5), 1);
  if (B.phase === 'intro' && B.t > 1.5) nextBossQ(w, ctx);
  if (B.phase === 'attack') {
    const A = B.attack; A.t += DT;
    if (!A.live && A.t >= C.ATTACK_WARN_S) {
      A.live = true; emit(w, 'attack', { kind: A.kind, look: A.look });
      if (A.kind === 'stomp' && f.ground) { f.vy = 6; f.ground = false; f.wobble = 0.4; }
      if (A.kind === 'sneeze') { f.launch = { t: 0, dur: 1, x0: f.x, y0: f.y, x1: (w.lvl.ledges[0][0] + w.lvl.ledges[0][1]) / 2, y1: w.lvl.ledges[0][2], h: 2 }; }
    }
    if (A.t >= C.ATTACK_WARN_S + (A.kind === 'stomp' ? 0.6 : A.kind === 'sneeze' ? 1.2 : C.ATTACK_S)) { B.attack = null; nextBossQ(w, ctx); }
  }
  if (B.phase === 'win') { B.winT = (B.winT || 0) + DT; if (B.winT > 3 && !B.done) { B.done = true; w.finished = true; emit(w, 'boss_done'); } }
}
function nextBossQ(w, ctx) {
  const B = w.boss;
  B.phase = 'ask'; B.q = ctx.ask(B.bops, w); B.sunk = []; B.gone = B.q && B.q.assist ? [B.q.drop] : []; if (B.gone.length) emit(w, 'assist', { boss: true }); B.misses = 0; B.plY = [0, 0, 0]; B.glow = -1; B.driftOn = true;
  emit(w, 'sign', { i: B.bops, q: B.q, boss: true });
}
function bossRight(w, p) {
  const B = w.boss, f = w.fox;
  B.phase = 'launch'; B.q = null;
  f.launch = { t: 0, dur: 1, x0: f.x, y0: f.y, x1: w.lvl.bossX, y1: w.lvl.bossHead * B.scale, h: 2.5, after: 9, done: (ww) => {
    const BB = ww.boss; BB.bops++; BB.scale *= 1 - C.BOSS_SHRINK; emit(ww, 'boss_bop', { bops: BB.bops });
    ww.fox.launch = { t: 0, dur: 0.7, x0: ww.fox.x, y0: ww.fox.y, x1: 7, y1: 0, h: 1.5 };
    if (BB.bops >= C.BOSS_BOPS) { BB.phase = 'win'; BB.winT = 0; emit(ww, 'boss_win'); }
    else { const AT = ww.lvl.attacks || C.ATTACKS.map((k) => [k, k]); if (BB.bops <= AT.length) { const [kind, look] = AT[BB.bops - 1]; BB.phase = 'attack'; BB.attack = { kind, look, t: 0, live: false }; emit(ww, 'attack_warn', { kind, look }); } }
  } };
}
// The steady state used by digest tests.
export function digest(w) { const f = w.fox; return [w.steps, w.timer, f.x.toFixed(3), f.y.toFixed(3), w.acorns, w.answers.map((a) => a.q + (a.first ? '+' : '-')).join(','), w.powersGot, w.mons.filter((m) => m.state !== 'live').length].join('|'); }
