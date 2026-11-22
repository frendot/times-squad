// The game rules (spec sections 6 to 9): picking facts, building gates, answers, squad, power bar, boss and stars.
// Pure logic on a player's data object; no screen code. Every random choice uses the run's seeded generator.
import { CONFIG } from './config.js';
import { WORLD1, GROUPS, INTRO_ORDER, TASTE_ORDER, SNEAK_KNOWN, ANCHORS, FOCUS, groupOf, parseFact } from './facts.js';
import { rngOn, seedFrom, pick } from './rng.js';
import { generate, generateFar, freshBalance } from './gen.js';
import { newFact, introduce, isDue, firstTry, addDays, TIERS } from './learn.js';

export const STAGES = ['L1', 'L2', 'L3', 'BOSS'];
export function newProgress() {
  return { power: { level: 1, segments: 0, totalRights: 0 }, bestStars: 0, bestSquad: 0, runsCompleted: 0, rescuedTotal: 0,
    turnaroundSeen: [], sneakPeekSeen: false, fireworksShown: [], howToSeen: false, carryRequeue: [] };
}
export function newPlayerData(pid) { return { pid, progress: newProgress(), facts: {}, attempts: [], history: [], run: null }; }
export const fact = (pd, id) => (pd.facts[id] ||= newFact(id));
const introduced = (pd) => WORLD1.filter((id) => pd.facts[id] && pd.facts[id].box >= 1);
const acc = (xs) => (xs.length >= 4 ? xs.filter(Boolean).length / xs.length : null);
export const displaySquad = (run) => Math.max(CONFIG.SQUAD_FLOOR, run.squad - run.waiting);
export function squadTier(squad) { let t = CONFIG.BOSS_TIERS[0]; for (const x of CONFIG.BOSS_TIERS) if (squad >= x.min) t = x; return t; }
export const starsFor = (tierId) => (tierId === 'C' ? 3 : tierId === 'B' ? 2 : 1);

export function startRun(pd, { now, seed }) {
  const carry = [...new Set(pd.progress.carryRequeue || [])];
  pd.progress.carryRequeue = [];
  pd.run = { runId: 'r' + now.toString(36), seed, rng: seedFrom(seed), stage: 'L1', squadAtStageStart: CONFIG.SQUAD_START, squad: CONFIG.SQUAD_START,
    waiting: 0, gateNumber: 0, slotInLevel: 0, requeue: carry.map((factId) => ({ factId, atGate: 2 })), balance: freshBalance(),
    rescued: 0, rescuedAtStageStart: 0, newThisLevel: 0, recentFirstTry: [], turnaroundCardsThisRun: 0, tasteShownThisRun: false,
    boss: null, startedAt: now, slotFacts: [], prevSlotLearn: false, struggleLeft: 0, inStruggle: false, lastAnswer: null, streak: 0,
    tilesUpLevel: [], tilesUpRun: [], powerGatePending: false, levelsDone: [] };
  startStage(pd);
  return pd.run;
}
export function startStage(pd) {
  const r = pd.run;
  Object.assign(r, { slotInLevel: 0, newThisLevel: 0, balance: freshBalance(), slotFacts: [], prevSlotLearn: false, tilesUpLevel: [],
    squadAtStageStart: r.squad, rescuedAtStageStart: r.rescued, waiting: 0, powerGatePending: false });
  if (r.stage === 'BOSS' && !r.boss) {
    const t = squadTier(r.squad);
    r.boss = { tier: t.id, hitsNeeded: t.hits, hits: 0, meterPct: 0, round: 1, question: 0, powerPie: pd.run.bossPowerPie || false, throwIdx: 0 };
  }
}
// "Go on" after closing the app: a level restarts at slot 1 with the squad it had at the start; the boss keeps its meter and round.
export function resumeStage(pd) {
  const r = pd.run;
  if (r.stage !== 'BOSS') { r.squad = r.squadAtStageStart; r.rescued = r.rescuedAtStageStart; r.requeue = r.requeue.filter((q) => q.atGate <= r.gateNumber + 8); }
  r.waiting = 0;
  const keepSquad = r.squadAtStageStart, keepRes = r.rescuedAtStageStart;
  startStage(pd);
  if (r.stage === 'BOSS') { r.squadAtStageStart = keepSquad; r.rescuedAtStageStart = keepRes; }
}
export const levelComplete = (pd) => pd.run.stage !== 'BOSS' && pd.run.slotInLevel >= CONFIG.GATES_PER_LEVEL && !pd.run.powerGatePending;

function pools(pd, today) {
  const r = pd.run, intro = introduced(pd);
  const F = (id) => pd.facts[id];
  const L = intro.filter((id) => F(id).box <= 2);
  const D = intro.filter((id) => F(id).box >= 3 && isDue(F(id), today)).sort((a, b) => (F(a).dueOn < F(b).dueOn ? -1 : F(a).dueOn > F(b).dueOn ? 1 : 0));
  let E = intro.filter((id) => (F(id).box >= 3 && !isDue(F(id), today)) || F(id).tier === 'silver' || F(id).tier === 'gold');
  if (!E.length) E = ANCHORS.filter((id) => intro.includes(id));
  const N = r.stage === 'BOSS' ? [] : INTRO_ORDER[r.stage].filter((id) => !pd.facts[id] || pd.facts[id].box === 0);
  return { intro, L, D, E, N };
}

// Spec 7.4 and 7.5: which fact fills the next slot.
export function pickSlot(pd, today, rng) {
  const r = pd.run, boss = r.stage === 'BOSS';
  const slot = r.slotInLevel + 1, gate = r.gateNumber + 1;
  const { intro, L, D, E, N } = pools(pd, today);
  const prev = r.slotFacts[r.slotFacts.length - 1];
  const recent3 = r.slotFacts.slice(-3);
  const free = (ids) => ids.filter((id) => !recent3.includes(id));
  const acc8 = acc(r.recentFirstTry.slice(-CONFIG.STRUGGLE_WINDOW));
  const accOk = acc8 === null || acc8 >= CONFIG.NEW_FACT_MIN_ACCURACY;
  const guard = r.struggleLeft > 0;
  const canNew = (ignorePrev) => !boss && N.length > 0 && r.newThisLevel < CONFIG.MAX_NEW_PER_LEVEL && (ignorePrev || !r.prevSlotLearn) && accOk && !guard;
  const NEW = (src = 'N') => ({ id: N[0], isNew: true, source: src });
  const lowBox = (ids) => { const m = Math.min(...ids.map((id) => pd.facts[id].box)); return pick(rng, ids.filter((id) => pd.facts[id].box === m)); };
  const fromE = () => { const e = free(E); return e.length ? { id: pick(rng, e), source: 'E' } : null; };
  const learning = () => {
    const focus = boss ? [] : free(L.filter((id) => groupOf(id) === FOCUS[r.stage]));
    const other = boss ? free(L) : free(L.filter((id) => groupOf(id) !== FOCUS[r.stage]));
    const newOk = canNew(false);
    const focusAny = focus.length || newOk;
    if (!focusAny && !other.length) return null;
    const useFocus = focusAny && (!other.length || rng() < CONFIG.FOCUS_SHARE);
    if (useFocus) return newOk && (!focus.length || rng() < 0.5) ? NEW() : { id: lowBox(focus), source: 'L' };
    return { id: lowBox(other), source: 'L' };
  };
  const pools4 = {
    L: learning,
    N: () => (canNew(false) ? NEW() : null),
    D: () => { const d = free(D); return d.length ? { id: d[0], source: 'D' } : null; },
    E: fromE,
  };
  const fallback = () => pools4.L() || pools4.N() || pools4.D() || pools4.E()
    || (canNew(true) ? NEW('N*') : null)
    || (intro.filter((id) => id !== prev).length ? { id: pick(rng, intro.filter((id) => id !== prev)), source: 'any' } : null)
    || (!boss && !guard && N.length ? NEW('N!') : null)
    || { id: prev || intro[0] || 'x', source: 'repeat' };

  // Slot 1 (warm-up): an easy fact, or the first Learn Gate when nothing is known.
  if (slot === 1) {
    const e = fromE(); if (e) return e;
    if (canNew(true)) return NEW();
    return fallback();
  }
  // Slot 8 (easy finish)
  if (!boss && slot === CONFIG.GATES_PER_LEVEL) {
    const e = fromE(); if (e) return e;
    const hi = free(intro).sort((a, b) => pd.facts[b].box - pd.facts[a].box);
    if (hi.length) return { id: hi[0], source: 'hi' };
    return fallback();
  }
  // Requeued facts first
  const qi = r.requeue.findIndex((q) => q.atGate <= gate && q.factId !== prev && pd.facts[q.factId] && pd.facts[q.factId].box >= 1);
  if (qi >= 0) { const q = r.requeue.splice(qi, 1)[0]; return { id: q.factId, source: 'Q' }; }
  // Taste of the 3s (Level 3, slot 6 or 7, once per run)
  if (r.stage === 'L3' && (slot === 6 || slot === 7) && !r.tasteShownThisRun && accOk && !guard && !r.prevSlotLearn) {
    const twos = GROUPS[2].filter((id) => pd.facts[id] && pd.facts[id].box >= 1).length;
    const nextTaste = TASTE_ORDER.find((id) => !pd.facts[id] || pd.facts[id].box === 0);
    if (twos >= 6 && nextTaste) return { id: nextTaste, isNew: true, taste: true, source: 'T' };
  }
  // Struggle guard: easy facts, no new facts
  if (r.struggleLeft > 0) { r.struggleLeft--; const e = fromE(); if (e) return e; const d = pools4.D(); if (d) return d; const l = free(L); if (l.length) return { id: lowBox(l), source: 'L' }; return fallback(); }
  const mix = boss ? CONFIG.BOSS_MIX : CONFIG.LEVEL_MIX;
  const x = rng();
  const drawn = x < mix.learning ? 'L' : x < mix.learning + mix.due ? 'D' : 'E';
  return pools4[drawn]() || fallback();
}

const tableFirst = (id) => { const [a, b] = parseFact(id); const t = groupOf(id); return t === b ? [b, a] : [a, b]; };

// Build the next gate (or null when the level is done). Mutates the run (slot counters) and may introduce a new fact.
export function nextGate(pd, { today }) {
  const r = pd.run;
  if (r.stage !== 'BOSS' && r.slotInLevel >= CONFIG.GATES_PER_LEVEL) return null;
  if (r.stage === 'BOSS' && r.boss.hits >= r.boss.hitsNeeded) return null;
  const rng = rngOn(r);
  const p = pickSlot(pd, today, rng);
  const f = fact(pd, p.id);
  const cards = [];
  const isNew = !!p.isNew && f.box === 0;
  if (p.taste) {
    r.tasteShownThisRun = true;
    if (!pd.progress.sneakPeekSeen) { pd.progress.sneakPeekSeen = true; cards.push({ type: 'sneak', known: SNEAK_KNOWN.filter((id) => pd.facts[id] && pd.facts[id].box >= 1) }); }
  }
  let [a, b] = tableFirst(p.id);
  if (!isNew && f.attempts >= 2 && a !== b && rng() < 0.5) [a, b] = [b, a];
  if (isNew) { introduce(f, today); cards.push({ type: 'learn' }); }
  else if (a !== b && a !== tableFirst(p.id)[0] && f.box >= 1 && !pd.progress.turnaroundSeen.includes(p.id) && r.turnaroundCardsThisRun < 2) {
    cards.push({ type: 'turnaround' }); pd.progress.turnaroundSeen.push(p.id); r.turnaroundCardsThisRun++;
  }
  const kind = isNew ? 'learn' : r.stage === 'BOSS' ? 'boss' : 'normal';
  const acc10 = acc(r.recentFirstTry.slice(-CONFIG.THREE_GATE_WINDOW));
  const k = kind !== 'learn' && !f.helper && f.box >= CONFIG.THREE_GATE_MIN_BOX && acc10 !== null && r.recentFirstTry.length >= 5 && acc10 >= CONFIG.THREE_GATE_MIN_ACCURACY ? 3 : 2;
  const recentWrong = [];
  const since = addDays(today, -CONFIG.CONFUSION_DAYS);
  for (let i = pd.attempts.length - 1; i >= 0 && recentWrong.length < 5; i--) {
    const t = pd.attempts[i];
    if (t.factId === p.id && !t.right && t.day >= since && !recentWrong.includes(t.chosen)) recentWrong.push(t.chosen);
  }
  const g = kind === 'learn' ? generateFar({ a, b, balance: r.balance, rng, prevAnswer: r.lastAnswer }) : generate({ a, b, k, recentWrong, prevAnswer: r.lastAnswer, balance: r.balance, rng });
  r.slotInLevel++; r.gateNumber++;
  r.slotFacts.push(p.id); r.prevSlotLearn = isNew; if (isNew && !p.taste) r.newThisLevel++;
  r.lastAnswer = a * b;
  return { gateNo: r.gateNumber, slot: r.slotInLevel, stage: r.stage, kind, factId: p.id, source: p.source, a, b, c: a * b, k: g.choices.length,
    choices: g.choices, correctIndex: g.correctIndex, distractors: g.distractors, helper: f.helper, cards, taste: !!p.taste,
    retry: false, done: false, removed: [], powerPie: r.stage === 'BOSS' && !!r.boss.powerPie };
}

export const speedFor = (pd, gate) => {
  if (gate && gate.helper) return CONFIG.SPEED_MIN;
  const s = pd.run.streak;
  return s >= CONFIG.SPEED_STREAK ? Math.min(CONFIG.SPEED_MAX, 1 + CONFIG.SPEED_STEP * (s - CONFIG.SPEED_STREAK + 1)) : 1;
};

function addPower(pd, res) {
  const p = pd.progress.power;
  p.segments++; p.totalRights++;
  res.power = true;
  if (p.segments >= CONFIG.POWER_SEGMENTS) {
    p.level++; p.segments = 0;
    if (pd.run.stage === 'BOSS') { pd.run.boss.powerPie = true; res.powerPieReady = true; } else { pd.run.powerGatePending = true; res.powerGate = true; }
  }
}
function bossHit(pd, res, double) {
  const B = pd.run.boss;
  const n = double ? 2 : 1;
  B.hits = Math.min(B.hitsNeeded, B.hits + n);
  B.meterPct = Math.max(B.meterPct, Math.min(100, Math.round((B.hits * 100) / B.hitsNeeded)));
  const throwType = double ? 'power' : ['tickle', 'pie', 'splat'][B.throwIdx % 3];
  B.throwIdx++; B.question++;
  const won = B.hits >= B.hitsNeeded;
  const funny = !won && B.round === 1 && B.question >= CONFIG.BOSS_ROUND_QUESTIONS;
  if (funny) B.round = 2;
  res.boss = { hits: B.hits, meterPct: B.meterPct, won, funny, throwType };
}
function noteTier(pd, gate, tierUp) {
  if (!tierUp) return null;
  const t = pd.facts[gate.factId].tier;
  for (const list of [pd.run.tilesUpLevel, pd.run.tilesUpRun]) {
    const old = list.find((x) => x.factId === gate.factId);
    if (old) old.tier = t; else list.push({ factId: gate.factId, tier: t });
  }
  return t;
}

// The child chose gate `index`. Returns what happened, for the screen to show.
export function answer(pd, gate, index, { timeMs = 0, thinkStop = false, helpUsed = false, today, now = 0 }) {
  const r = pd.run, f = fact(pd, gate.factId);
  const right = index === gate.correctIndex;
  const firstTryFlag = !gate.retry;
  pd.attempts.push({ ts: now, day: today, runId: r.runId, factId: gate.factId, shown: `${gate.a} x ${gate.b}`, choices: gate.choices.slice(),
    chosen: gate.choices[index], correct: gate.c, kind: gate.retry ? 'retry' : gate.kind, firstTry: firstTryFlag, right,
    timeMs: Math.round(timeMs), thinkStop, helpUsed, distractors: gate.distractors.map((d) => ({ ...d })) });
  if (pd.attempts.length > CONFIG.ATTEMPTS_KEEP) pd.attempts.splice(0, pd.attempts.length - CONFIG.ATTEMPTS_KEEP);
  const res = { right, firstTry: firstTryFlag, squadAdd: 0, rescued: 0, power: false, tierUp: null, wobble: null, stepAside: 0 };
  const boss = gate.kind === 'boss';
  if (firstTryFlag) {
    gate.firstChoice = index;
    if (gate.kind === 'learn') {
      f.attempts++;
      if (right) { r.squad += gate.c; res.squadAdd = gate.c; addPower(pd, res); }
      else { gate.retry = true; gate.noStepAside = true; }
    } else {
      const { tierUp } = firstTry(f, { right, timeMs, k: gate.k, today });
      res.tierUp = noteTier(pd, gate, tierUp);
      r.recentFirstTry = [...r.recentFirstTry, right].slice(-CONFIG.THREE_GATE_WINDOW);
      const a8 = acc(r.recentFirstTry.slice(-CONFIG.STRUGGLE_WINDOW));
      if (a8 !== null && a8 < CONFIG.STRUGGLE_THRESHOLD && !r.inStruggle) { r.inStruggle = true; r.struggleLeft = CONFIG.STRUGGLE_EASY_SLOTS; }
      else if (a8 !== null && a8 >= CONFIG.STRUGGLE_THRESHOLD) r.inStruggle = false;
      r.streak = right ? r.streak + 1 : 0;
      if (right) {
        if (boss) { const dbl = !!r.boss.powerPie; if (dbl) r.boss.powerPie = false; bossHit(pd, res, dbl); }
        else { r.squad += gate.c; res.squadAdd = gate.c; }
        addPower(pd, res);
      } else {
        gate.retry = true;
        if (!boss) { r.waiting = CONFIG.MISS_STEP_ASIDE; res.stepAside = CONFIG.MISS_STEP_ASIDE; }
        for (const off of CONFIG.REQUEUE_OFFSETS) r.requeue.push({ factId: gate.factId, atGate: gate.gateNo + off });
      }
    }
  } else if (right) {
    if (boss) bossHit(pd, res, false);
    else {
      if (!gate.noStepAside && r.waiting > 0) { r.rescued += r.waiting; res.rescued = r.waiting; }
      r.waiting = 0; r.squad += gate.c; res.squadAdd = gate.c;
    }
  } else {
    res.wobble = index; gate.removed.push(index);
  }
  if (right) gate.done = true;
  res.squad = r.squad; res.display = displaySquad(r);
  return res;
}

export function applyPowerGate(pd) {
  const r = pd.run; const add = Math.min(r.squad, CONFIG.POWER_GATE_MAX_ADD);
  r.squad += add; r.powerGatePending = false; return add;
}
// After slot 8: summary for the Level done screen, then move the run to the next stage.
export function finishLevel(pd) {
  const r = pd.run;
  const n = STAGES.indexOf(r.stage) + 1;
  const sum = { n, squad: r.squad, rescued: r.rescued - r.rescuedAtStageStart, tilesUp: r.tilesUpLevel.slice() };
  r.levelsDone = [...new Set([...(r.levelsDone || []), r.stage])];
  r.stage = STAGES[n];
  startStage(pd);
  return sum;
}
// After the boss win: stars, history, best values. The run closes.
export function finishRun(pd, { today }) {
  const r = pd.run, P = pd.progress;
  const stars = starsFor(r.boss.tier);
  const out = { stars, squad: r.squad, rescued: r.rescued, tilesUp: r.tilesUpRun.slice(), tier: r.boss.tier };
  P.bestStars = Math.max(P.bestStars, stars); P.bestSquad = Math.max(P.bestSquad, r.squad); P.runsCompleted++; P.rescuedTotal += r.rescued;
  P.carryRequeue = [...new Set([...(P.carryRequeue || []), ...r.requeue.map((q) => q.factId)])];
  pd.history.push({ runId: r.runId, finishedOn: today, squad: r.squad, stars, rescued: r.rescued, tilesUp: r.tilesUpRun.map((t) => t.factId) });
  if (pd.history.length > CONFIG.HISTORY_KEEP) pd.history.splice(0, pd.history.length - CONFIG.HISTORY_KEEP);
  pd.run = null;
  return out;
}
export const tierRank = (t) => TIERS.indexOf(t);
