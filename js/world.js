// The runner world: a pure, seeded simulation (no DOM, no clock). Same seed + same inputs = same run.
// Positions: s = metres along the track; the runner is at s = dist. Lanes are -1, 0, 1.
import { CONFIG as C } from './config.js';
import { rngOn, seedFrom, pick, weighted } from './rng.js';

const lerp = (a, b, f) => a + (b - a) * Math.max(0, Math.min(1, f));
export const LANES = [-1, 0, 1];
export const MONSTERS = ['slime', 'bat', 'roller'];

export function newWorld(seed, { start = 0 } = {}) {
  const w = {
    seed, rng: seedFrom(seed), t: 0, steps: 0, dist: start, speed: C.SPEED_START, startDist: start,
    p: { lane: 0, x: 0, y: 0, vy: 0, slide: 0, dropSlide: false },
    objs: [], nid: 1, inputs: [],
    nextObsS: start + C.SAFE_START_M, nextQS: start + C.SAFE_START_M + 25, nextCoinS: start + 20, nextBoxS: start + C.POWER_BOX_EVERY_M * 0.6,
    nextWanderS: start + C.WANDER_MONSTER_EVERY_M, nextBossS: Math.max(C.BOSS_EVERY_M, Math.ceil((start + 1) / C.BOSS_EVERY_M) * C.BOSS_EVERY_M),
    rows: [], sign: null, blaster: { charge: 0, jam: 0 }, streak: 0,
    powers: { shield: 0, magnet: 0, jetpack: 0, giant: 0 }, landGrace: 0,
    boss: null, bossesDone: 0,
    score: 0, meters: 0, coins: 0, rights: 0, wrongs: 0, zaps: 0, smashes: 0, powersGot: 0,
    crashed: null, lastWrong: null, hint: null, events: [],
  };
  w.rand = rngOn(w);
  return w;
}
const R = (w) => { const n = w.rand(); return n; };
export const laneOf = (w) => Math.max(-1, Math.min(1, Math.round(w.p.x / C.LANE_W)));
const emit = (w, type, data = {}) => w.events.push({ type, t: w.t, ...data });
const speedFrac = (w) => (w.speed - C.SPEED_START) / (C.SPEED_MAX - C.SPEED_START);

// ---- input ----
export function input(w, action) { if (!w.crashed) w.inputs.push(action); }
function applyInput(w, a) {
  const p = w.p;
  if (a === 'left' || a === 'right') {
    const nl = Math.max(-1, Math.min(1, p.lane + (a === 'left' ? -1 : 1)));
    if (nl !== p.lane) { p.lane = nl; emit(w, 'lane'); }
  } else if (a === 'up') {
    if (w.powers.jetpack > 0) return;
    if (p.y <= 0.001) { p.vy = C.JUMP_V; p.slide = 0; emit(w, 'jump'); }
  } else if (a === 'down') {
    if (w.powers.jetpack > 0) return;
    if (p.y > 0.001) { p.vy = Math.min(p.vy, -16); p.dropSlide = true; } else { p.slide = C.SLIDE_S; emit(w, 'slide'); }
  }
}

// ---- spawning ----
function zoneBlocked(w, s, pad = 0) {
  const rows = [...w.rows.map((r) => r.s), w.nextQS];
  const monsterLen = w.speed * C.MONSTER_AHEAD_S + 14;
  return rows.some((rs) => s > rs - 12 - pad && s < rs + monsterLen + pad);
}
function add(w, o) { o.id = w.nid++; w.objs.push(o); return o; }
function spawnObstacles(w, s) {
  const f = speedFrac(w), far = s - w.startDist;
  const pats = [['one', 30], ['two', far > 80 ? 25 + 25 * f : 0], ['wideGap', far > 120 ? 12 : 0], ['wideBranch', far > 120 ? 12 : 0], ['combo', f > 0.3 ? 20 * f : 0]];
  const pat = weighted(w.rand, pats);
  const one = () => pick(w.rand, ['log', 'rock', 'branch', 'log', 'rock']);
  if (pat === 'one') add(w, { kind: one(), s, lanes: [pick(w.rand, LANES)] });
  else if (pat === 'two') { const free = pick(w.rand, LANES); for (const l of LANES) if (l !== free) add(w, { kind: pick(w.rand, ['log', 'rock']), s, lanes: [l] }); }
  else if (pat === 'wideGap') add(w, { kind: 'gap', s, lanes: [...LANES] });
  else if (pat === 'wideBranch') add(w, { kind: 'branch', s, lanes: [...LANES] });
  else { const rl = pick(w.rand, LANES); add(w, { kind: 'rock', s, lanes: [rl] }); add(w, { kind: pick(w.rand, ['log', 'branch']), s: s + 0.01, lanes: LANES.filter((l) => l !== rl) }); }
}
function spawn(w) {
  const ahead = w.dist + C.SPAWN_AHEAD_M;
  for (let guard = 0; guard < 50; guard++) {
    const next = Math.min(w.nextObsS, w.nextQS, w.nextCoinS, w.nextBoxS, w.nextWanderS);
    if (next > ahead) break;
    const f = speedFrac(w);
    if (next === w.nextQS) {
      const s = w.nextQS; w.rows.push({ s, shown: false, taken: false });
      const think = lerp(C.THINK_S[0], C.THINK_S[1], f);
      const every = lerp(C.QUESTION_EVERY_M[0], C.QUESTION_EVERY_M[1], f) * (w.boss ? C.BOSS_Q_EVERY_M_FACTOR : 1);
      w.nextQS = s + Math.max(every, w.speed * (think + C.MONSTER_AHEAD_S) + 16);
    } else if (next === w.nextObsS) {
      const s = w.nextObsS;
      if (!w.boss && !zoneBlocked(w, s)) spawnObstacles(w, s);
      w.nextObsS = s + lerp(C.OBSTACLE_GAP_M[0], C.OBSTACLE_GAP_M[1], f) + R(w) * C.OBSTACLE_SPREAD_M;
    } else if (next === w.nextCoinS) {
      const s = w.nextCoinS, lane = pick(w.rand, LANES);
      for (let i = 0; i < 6; i++) add(w, { kind: 'coin', s: s + i * 3, lanes: [lane] });
      w.nextCoinS = s + C.COIN_LINE_EVERY_M + R(w) * 20;
    } else if (next === w.nextBoxS) {
      const s = w.nextBoxS;
      if (!zoneBlocked(w, s, 4)) add(w, { kind: 'box', s, lanes: [pick(w.rand, LANES)], power: pick(w.rand, C.POWERS) });
      w.nextBoxS = s + C.POWER_BOX_EVERY_M * (0.8 + R(w) * 0.4);
    } else {
      const s = w.nextWanderS;
      if (!w.boss && !zoneBlocked(w, s, 6)) add(w, { kind: 'monster', type: pick(w.rand, MONSTERS), s, lanes: [pick(w.rand, LANES)], wander: true });
      w.nextWanderS = s + C.WANDER_MONSTER_EVERY_M * (0.7 + R(w) * 0.6);
    }
  }
}

// ---- powers ----
export function givePower(w, kind, from = 'streak') {
  w.powers[kind] = C.POWER_S[kind]; w.powersGot++;
  if (kind === 'jetpack') { w.p.vy = 0; w.p.slide = 0; }
  emit(w, 'power', { power: kind, from });
}
function powerFromStreak(w) {
  const free = C.POWERS.filter((k) => w.powers[k] <= 0);
  givePower(w, pick(w.rand, free.length ? free : C.POWERS), 'streak');
}

// ---- boss ----
export function startBoss(w) {
  if (w.boss) return;
  const n = w.bossesDone;
  w.boss = { hp: 0, max: Math.min(C.BOSS_HP[1], C.BOSS_HP[0] + n), lane: 0, moveT: 1.5, throwT: C.BOSS_THROW_EVERY_S, z: 18, hits: 0 };
  w.boss.hp = w.boss.max;
  w.objs = w.objs.filter((o) => !(['log', 'rock', 'branch', 'gap', 'monster'].includes(o.kind) && o.s - w.dist > 20));
  w.nextQS = Math.min(w.nextQS, w.dist + w.speed * lerp(C.THINK_S[0], C.THINK_S[1], speedFrac(w)) + 25);
  emit(w, 'boss');
}
function bossThrow(w, lane) {
  add(w, { kind: 'monster', type: 'ball', s: w.dist + w.boss.z - 1, lanes: [lane], roll: 7 });
  emit(w, 'throw');
}
function bossStep(w, dt) {
  const B = w.boss;
  B.moveT -= dt; B.throwT -= dt;
  if (B.moveT <= 0) { B.lane = pick(w.rand, LANES); B.moveT = 1.2 + R(w); }
  if (B.throwT <= 0) { bossThrow(w, R(w) < 0.6 ? w.p.lane : pick(w.rand, LANES)); B.throwT = C.BOSS_THROW_EVERY_S * (0.8 + R(w) * 0.4); }
}
function bossHit(w) {
  const B = w.boss; B.hp--; B.hits++; emit(w, 'bosshit', { hp: B.hp });
  if (B.hp <= 0) {
    w.boss = null; w.bossesDone++; w.coins += C.BOSS_COINS; w.score += C.SCORE.boss;
    w.nextBossS = Math.max(w.dist + 100, (Math.floor(w.dist / C.BOSS_EVERY_M) + 1) * C.BOSS_EVERY_M);
    w.objs = w.objs.filter((o) => o.type !== 'ball');
    emit(w, 'bossdown');
  }
}

// ---- answers ----
function answer(w, row, laneIdx, ctx) {
  row.taken = true;
  const q = row.q, timeMs = (w.t - row.shownAt) * 1000;
  const res = ctx.answer(q, laneIdx, timeMs);
  w.sign = null;
  if (res.right) {
    w.rights++; w.streak++; w.score += C.SCORE.right;
    w.blaster.charge = Math.min(C.BLASTER_MAX_CHARGE, w.blaster.charge + 1);
    emit(w, 'right', { q, tierUp: res.tierUp, tier: res.tier });
    if (w.boss) { w.blaster.charge = Math.max(0, w.blaster.charge - 1); bossHit(w); }
    if (w.streak >= C.POWER_STREAK) { w.streak = 0; powerFromStreak(w); }
  } else {
    w.wrongs++; w.streak = 0; w.blaster.jam = C.JAM_S; w.lastWrong = { q, chosen: q.choices[laneIdx], t: w.t };
    w.hint = { q, until: w.t + C.HINT_S };
    emit(w, 'wrong', { q, chosen: q.choices[laneIdx] });
    if (w.boss) bossThrow(w, w.p.lane);
  }
  // The monster for this question shows up ahead in your lane (zapped at once if the blaster is charged).
  if (!w.boss) add(w, { kind: 'monster', type: pick(w.rand, MONSTERS), s: w.dist + Math.max(14, w.speed * C.MONSTER_AHEAD_S), lanes: [w.p.lane], fromQ: true });
}

// ---- collisions ----
function avoided(w, o) {
  const p = w.p;
  if (w.powers.jetpack > 0 || w.landGrace > 0) return true;
  switch (o.kind) {
    case 'log': return p.y > 0.55;
    case 'gap': return p.y > 0.2;
    case 'branch': return p.slide > 0;
    case 'rock': return false;
    case 'monster': return o.type === 'bat' ? p.slide > 0 : o.type === 'ball' ? false : p.y > 0.6;
    default: return true;
  }
}
function crash(w, o) {
  if (w.powers.giant > 0 || w.powers.shield > 0) {
    if (w.powers.giant <= 0) { w.powers.shield = 0; emit(w, 'shieldpop'); }
    o.poof = w.t; o.dead = true; w.smashes++; w.score += C.SCORE.smash; emit(w, 'smash', { kind: o.kind, x: o.lanes[0] });
    return;
  }
  const after = w.lastWrong && w.t - w.lastWrong.t < 4 && o.kind === 'monster' ? w.lastWrong : null;
  w.crashed = { by: o.kind, type: o.type || null, t: w.t, q: after ? after.q : null, chosen: after ? after.chosen : null };
  emit(w, 'crash', { by: o.kind });
}

// ---- one fixed step ----
export function step(w, ctx) {
  if (w.crashed) return;
  const dt = C.STEP_S, p = w.p;
  w.steps++; w.t += dt;
  while (w.inputs.length) applyInput(w, w.inputs.shift());
  // runner
  const tx = p.lane * C.LANE_W, dx = tx - p.x, mv = (C.LANE_W / C.LANE_SWITCH_S) * dt;
  p.x = Math.abs(dx) <= mv ? tx : p.x + Math.sign(dx) * mv;
  if (w.powers.jetpack > 0) { p.y += (C.JET_Y - p.y) * Math.min(1, dt * 6); p.vy = 0; }
  else { p.vy -= C.GRAVITY * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; if (p.dropSlide) { p.dropSlide = false; p.slide = C.SLIDE_S; emit(w, 'slide'); } } }
  if (p.slide > 0) p.slide -= dt;
  for (const k of C.POWERS) if (w.powers[k] > 0) { w.powers[k] -= dt; if (w.powers[k] <= 0) { w.powers[k] = 0; emit(w, 'powerend', { power: k }); if (k === 'jetpack') w.landGrace = 0.6; } }
  if (w.landGrace > 0) w.landGrace -= dt;
  if (w.blaster.jam > 0) w.blaster.jam -= dt;
  // speed and distance
  w.speed = Math.min(C.SPEED_MAX, C.SPEED_START + C.SPEED_GAIN * w.t);
  const ds = w.speed * dt; w.dist += ds; w.meters += ds; w.score += ds * C.SCORE.meter;
  if (!w.boss && w.dist >= w.nextBossS) startBoss(w);
  if (w.boss) bossStep(w, dt);
  spawn(w);
  // signs: show the question when the number row is close enough to think about it
  const think = lerp(C.THINK_S[0], C.THINK_S[1], speedFrac(w));
  for (const r of w.rows) if (!r.shown && r.s - w.dist <= w.speed * think) {
    r.shown = true; r.shownAt = w.t; r.q = ctx.ask(w); w.sign = r; emit(w, 'sign', { q: r.q });
  }
  const lane = laneOf(w), li = lane + 1;
  // number rows
  for (const r of w.rows) if (r.shown && !r.taken && r.s - w.dist <= 0.3) answer(w, r, li, ctx);
  w.rows = w.rows.filter((r) => r.s - w.dist > -5);
  // objects
  for (const o of w.objs) {
    if (o.roll) o.s -= o.roll * dt;
    if (o.dead) continue;
    const z = o.s - w.dist;
    if (o.kind === 'coin' && w.powers.magnet > 0 && z < C.MAGNET_RANGE_M && z > -1) { o.lanes = [lane]; }
    if (o.kind === 'monster' && !o.zapped && w.blaster.charge > 0 && w.blaster.jam <= 0 && z > 2 && z < C.ZAP_RANGE_M && o.lanes.includes(lane) && !w.boss) {
      w.blaster.charge--; o.zapped = w.t; o.dead = true; w.zaps++; w.score += C.SCORE.zap; emit(w, 'zap', { type: o.type, z, lane: o.lanes[0] });
      continue;
    }
    if (z > 0.5 || z < -0.6 || o.done) continue;
    o.done = true;
    if (!o.lanes.includes(lane)) continue;
    if (o.kind === 'coin') { o.dead = true; w.coins++; w.score += C.SCORE.coin; emit(w, 'coin'); continue; }
    if (o.kind === 'box') { o.dead = true; givePower(w, o.power, 'box'); continue; }
    if (avoided(w, o)) { if (o.kind === 'monster' || o.kind === 'gap' || o.kind === 'log') emit(w, 'dodge', { kind: o.kind }); continue; }
    crash(w, o);
    if (w.crashed) return;
  }
  w.objs = w.objs.filter((o) => o.s - w.dist > -8 && !(o.dead && w.t - (o.poof || o.zapped || w.t) > 1.2));
  if (w.hint && w.t > w.hint.until) w.hint = null;
}
// A short hash of the run, for determinism tests.
export function digest(w) {
  return [w.steps, w.dist.toFixed(3), Math.round(w.score), w.coins, w.rights, w.wrongs, w.zaps, w.bossesDone, w.powersGot, w.crashed ? w.crashed.by : '-', w.rng].join('|');
}
