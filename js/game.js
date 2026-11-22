// Playing one level (S6 to S10): fixed 60 Hz steps of the pure simulation, drawing, HUD, the "Almost!" card,
// pause, ghost, checkpoint save, and the results with medals.
import { CONFIG as C, targets } from './config.js';
import { S, t, show, el, $, $$, today, dots, esc } from './ui.js';
import * as A from './audio.js';
import * as store from './store.js';
import * as input from './input.js';
import * as SIM from './sim.js';
import { draw, effects, resetView, VW, VH, iconCanvas, foxCanvas } from './render.js';
import { makeCtx, QUESTIONS, recordLevel, tableFor, strategyFor } from './questions.js';
import { nextLevel, isBoss, fileOf, worldOf, WORLDS, BOSSES, BOSS_IDS } from './levels.js';
import { bossImg } from './screens.js';
import { parseFact } from './facts.js';

const levels = {};
export async function loadLevel(id) {
  if (!levels[id]) { const r = await fetch(new URL(`../levels/${fileOf(id)}.json`, import.meta.url)); const wd = worldOf(id), B = isBoss(id) ? BOSSES[wd] : null; levels[id] = { ...(await r.json()), world: wd, ...(B ? { attacks: B.attacks, parade: B.parade || 0 } : {}) }; }
  return levels[id];
}
export const fmtTime = (steps) => { const s = steps / 60; const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };
const fmtTarget = (secs) => `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`;
let G = null; // the running game
export const isRunning = () => !!(G && !G.over);
export function pauseGame() { if (G && !G.over && !G.pausedMenu) openPause(); }
self.__tsGame = () => (G ? { level: G.levelId, mode: G.w.mode, timer: G.w.timer, fox: { x: G.w.fox.x, y: G.w.fox.y }, finished: G.w.finished, qi: G.w.qi, card: !!G.w.card, power: G.w.power, boss: G.w.boss && { bops: G.w.boss.bops, phase: G.w.boss.phase } } : null);

const SOUNDS = { jump: 'jump', jump_big: 'jump_big', land: 'land', mushroom: 'mushroom', pit: 'pit', pit_back: 'pit_back', sign: 'sign', acorn: 'acorn', flower: 'flower',
  power: 'power', power_end: 'power_end', bop: 'bop', bump: 'bump', bubble_pop: 'bubble_pop', right: 'right', wrong: 'wrong', checkpoint: 'checkpoint', finish: 'finish',
  attack_warn: 'attack_warn', boss_bop: 'boss_bop', bubble: 'bubble_in' };

export async function playLevel(levelId, { exit, again }) {
  const lvl = await loadLevel(levelId);
  const pd = S.pd, d = today();
  const rec = pd.levels[levelId] || (pd.levels[levelId] = { bestSteps: null, medal: 0, brainStar: false, plays: 0, ghostOn: true, finishedOn: null, v4: true });
  const resume = pd.run && pd.run.kind === 'level' && pd.run.levelId === levelId && pd.run.playCount === rec.plays ? pd.run : null;
  const ctx = makeCtx(pd, levelId, d, rec.plays);
  const sc = pd.progress.scroller;
  const opts = { jumpHelp: !!sc.jumpHelp };
  if (resume) opts.resume = (w) => {
    const done = new Set(resume.done || []);
    w.bays.forEach((b, i) => { if (done.has(i)) { b.state = 'done'; b.open = 1; } });
    const x = lvl.checkpoint + 0.5;
    return { timer: resume.timer, timerOn: true, started: true, restoreHold: true, checkpoint: true, acorns: resume.acorns || 0, answers: resume.answers || [],
      fox: { ...w.fox, x, safe: { x, y: 0 } } };
  };
  const w = SIM.newWorld(lvl, opts);
  if (lvl.parade) w.paradeWorlds = BOSS_IDS.filter((b) => b !== levelId && sc.unlocked.includes(nextLevel(b))).map(worldOf); // bosses already beaten
  const ghostData = rec.medal >= 1 && rec.ghostOn !== false && pd.ghosts[levelId] && pd.ghosts[levelId].samples ? pd.ghosts[levelId] : null;
  A.stopMusic();
  const scr = show('play', `<div class="stage"><canvas class="cv"></canvas>
    <div class="hud"><div class="hsum" aria-live="polite"></div><div class="hright"><span class="htime"></span><span class="hacorn"><i class="ac"></i><b>0</b></span><span class="hpow"></span><span class="hbops"></span>
    <button class="icon pauseb" aria-label="${t('pause')}"><svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/></svg></button></div></div>
    <div class="pad"><button class="tb tl" data-btn="left" aria-label="${t('left')}"><svg viewBox="0 0 24 24"><path d="M15 4 L7 12 L15 20Z"/></svg></button><button class="tb tr" data-btn="right" aria-label="${t('right_btn')}"><svg viewBox="0 0 24 24"><path d="M9 4 L17 12 L9 20Z"/></svg></button>
    <button class="tb tj" data-btn="jump" aria-label="${t('jump')}"><svg viewBox="0 0 24 24"><path d="M4 16 L12 7 L20 16Z"/></svg></button></div>
    <div class="cardlayer"></div><div class="toast"></div><div class="menu"></div></div>`);
  const stage = $('.stage', scr), cv = $('.cv', scr), g = cv.getContext('2d');
  G = { levelId, lvl, w, ctx, scr, stage, over: false, pausedMenu: false, samples: [], ghostData, exit, again, rec, resume, lastSave: 0 };
  const fit = () => {
    const vw = innerWidth, vh = innerHeight, s = Math.min(vw / VW, vh / VH), dpr = Math.min(2, devicePixelRatio || 1);
    const cw = Math.round(VW * s), ch = Math.round(VH * s);
    stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); G.scale = (cw * dpr) / VW;
  };
  fit(); addEventListener('resize', fit); G.fit = fit;
  input.bind(stage, { pause: () => (G.pausedMenu ? closePause() : openPause()) });
  $('.pauseb', scr).addEventListener('click', () => { A.play('ui_tap'); openPause(); });
  resetView(w);
  hud();
  if (!sc.timerVisible) $('.htime', scr).classList.add('hidden');
  if (resume) toast(t('checkpoint'));
  let last = performance.now(), acc = 0;
  const frame = (now) => {
    if (G === null || G.w !== w || G.over && G.doneDrawing) return;
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!S.paused && !G.pausedMenu) {
      acc += dt;
      while (acc >= C.STEP_S) { acc -= C.STEP_S; tick(); if (G.over) break; }
    } else dt = 0;
    g.setTransform(G.scale, 0, 0, G.scale, 0, 0);
    draw(g, w, dt, { ghostAt: ghostAt() });
    hud();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
function ghostAt() {
  const D = G.ghostData; if (!D || !G.w.started) return null;
  const k = G.w.timer / 6, i = Math.floor(k), s = D.samples;
  if (i >= s.length - 1) return null;
  const a = s[i], b = s[i + 1], f = k - i;
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, face: a[2] & 1 ? -1 : 1, air: !!(a[2] & 2), moving: !!(a[2] & 4) };
}
function tick() {
  const w = G.w;
  SIM.step(w, input.bits(), G.ctx);
  if (w.timerOn && w.mode === 'play' && w.timer % 6 === 0 && G.samples.length * 6 <= w.timer) {
    const f = w.fox; G.samples.push([Math.round(f.x * 100) / 100, Math.round(f.y * 100) / 100, (f.face < 0 ? 1 : 0) | (f.ground ? 0 : 2) | (Math.abs(f.vx) > 0.3 ? 4 : 0)]);
  }
  const f = w.fox; if (f.ground && Math.abs(f.vx) > 3 && w.mode === 'play' && w.steps % 19 === 0) A.play('step');
  if (w.events.length) onEvents(w.events);
}
function onEvents(evs) {
  const w = G.w;
  effects(w, evs);
  for (const e of evs) {
    if (SOUNDS[e.type]) A.play(SOUNDS[e.type]);
    if (e.type === 'right' || e.type === 'wrong') saveAnswer();
    if (e.type === 'right') { toast(e.first ? t('right') : t('great')); if (!w.boss) setTimeout(() => A.play('curtain'), 150); }
    if (e.type === 'card') showCard(e.card);
    if (e.type === 'card_close') hideCard();
    if (e.type === 'power') toast(t('pw_' + e.power));
    if (e.type === 'bubble_pop') toast(t('pop'));
    if (e.type === 'bop') toast(t('poof'));
    if (e.type === 'checkpoint') { toast(t('checkpoint')); saveCheckpoint(); }
    if (e.type === 'attack_warn') toast(t('atk_' + e.look));
    if (e.type === 'attack') { if (!A.bossSound(e.look)) A.play('attack_' + e.kind); }
    if (e.type === 'sign' && e.boss && e.i === 0) { toast(t('boss_here_' + w.lvl.world)); if (w.lvl.world === 'rb') A.bossSound('roar'); }
    if (e.type === 'sign' && e.boss && w.lvl.parade && e.i === w.lvl.parade && (w.paradeWorlds || []).length) { toast(t('parade')); A.play('cheer'); }
    if (e.type === 'boss_win') { A.laugh(WORLDS[w.lvl.world].voice); if (w.lvl.world === 'x5') A.bossSound('moo'); toast(t('end_' + w.lvl.world)); }
    if (e.type === 'finish') { G.over = true; setTimeout(() => finish(), 1400); }
    if (e.type === 'boss_done') { G.over = true; setTimeout(() => bossWin(), 300); }
  }
}
function saveAnswer() {
  const pd = S.pd, att = pd.attempts[pd.attempts.length - 1];
  if (att && !att._saved) { att._saved = true; store.saveGate(pd, { factIds: [att.factId], attempts: [{ ...att, _saved: undefined }], keepRun: true }); }
}
function saveCheckpoint() {
  const w = G.w, pd = S.pd;
  pd.run = { kind: 'level', v4: true, levelId: G.levelId, playCount: G.rec.plays, timer: w.timer, acorns: w.acorns, answers: w.answers, done: w.bays.map((b, i) => (b.state === 'done' ? i : -1)).filter((i) => i >= 0), day: today() };
  store.saveRun(pd);
}
function hud() {
  const w = G.w, scr = G.scr;
  const b = w.bays.find((x) => x.state === 'ask') || (w.boss && w.boss.q ? w.boss : null);
  const q = b && b.q;
  const sum = q ? `${q.a} x ${q.b} = ?` : '';
  const hs = $('.hsum', scr); if (hs.textContent !== sum) hs.textContent = sum;
  hs.classList.toggle('show', !!q);
  if (!w.boss) { const tt = fmtTime(w.timer); const ht = $('.htime', scr); if (ht.textContent !== tt) ht.textContent = tt; }
  else { $('.htime', scr).classList.add('hidden'); const bb = $('.hbops', scr), n = String(w.boss.bops); if (bb.dataset.n !== n) { bb.dataset.n = n; bb.innerHTML = Array.from({ length: C.BOSS_BOPS }, (_, i) => `<i class="${i < w.boss.bops ? 'on' : ''}"></i>`).join(''); } }
  const ac = $('.hacorn b', scr), an = String(w.acorns); if (ac.textContent !== an) ac.textContent = an;
  const hp = $('.hpow', scr);
  if (w.power) { if (hp.dataset.p !== w.power) { hp.dataset.p = w.power; hp.innerHTML = ''; hp.appendChild(iconCanvas(w.power, 34)); } hp.style.setProperty('--k', String(Math.max(0, w.powerT / C.POWER_S))); hp.classList.add('show'); }
  else if (hp.dataset.p) { hp.dataset.p = ''; hp.innerHTML = ''; hp.classList.remove('show'); }
}
function toast(text) {
  const n = $('.toast', G.scr); if (!n) return;
  n.textContent = text; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show');
}
// ---- the "Almost!" card (spec 5.6): the fact, a dot array, and (on a repeat miss) a strategy line ----
function showCard(card) {
  const q = card.q, layer = $('.cardlayer', G.scr);
  const st = strategyFor(tableFor(G.levelId, q.factId), q.factId);
  const node = el(`<div class="almost"><h2>${t('almost')}</h2><p class="cf">${t('card_fact', { a: q.a, b: q.b, c: q.c })}</p><div class="cdots"></div>
    <p class="picked">${t('you_picked', { v: card.chosen })}</p>${card.repeat ? `<p class="strat">${strategyText(st)}</p>` : ''}</div>`);
  $('.cdots', node).appendChild(dots(q.a, q.b, { max: 260, maxH: 110 }));
  layer.innerHTML = ''; layer.appendChild(node); layer.classList.add('show');
}
function hideCard() { const layer = $('.cardlayer', G.scr); layer.classList.remove('show'); layer.innerHTML = ''; }
// One short strategy line per table (simple English, numbers as digits).
export function strategyText({ t: tb, k, c }) {
  if (tb === 2) return t('mp_double', { n: k, c });
  if (tb === 10) return t('mp_ten', { n: k, c });
  if (tb === 5) return t('mp_five', { n: k, c, d: k * 10 });
  if (tb === 4) return t('mp_four', { n: k, d: 2 * k, c });
  if (tb === 9) return t('mp_nine', { n: k, d: 10 * k, c });
  return t('mp_count', { t: tb, n: k, c });
}
// ---- pause (S9) ----
function openPause() {
  if (!G || G.over) return;
  G.pausedMenu = true; input.clear();
  const sc = S.pd.progress.scroller, m = $('.menu', G.scr), rec = G.rec;
  const ghostOk = rec.medal >= 1 && S.pd.ghosts[G.levelId];
  m.innerHTML = `<div class="pmenu"><h2>${t('paused')}</h2><button class="btn go goon">${t('go_on')}</button><button class="btn alt again">${t('start_again')}</button>
    ${ghostOk ? `<button class="btn alt tog gh">${t('ghost')} <b>${rec.ghostOn !== false ? t('on') : t('off')}</b></button>` : ''}
    ${G.w.boss ? '' : `<button class="btn alt tog tm">${t('timer')} <b>${sc.timerVisible ? t('show') : t('hide')}</b></button>`}
    <button class="btn alt tog snd">${t('sound')} <b>${S.settings.sound ? t('on') : t('off')}</b></button><button class="btn alt tog mus">${t('music')} <b>${S.settings.music ? t('on') : t('off')}</b></button>
    <button class="btn alt tomap">${t('to_map')}</button></div>`;
  m.classList.add('show');
  const tap = () => A.play('ui_tap');
  $('.goon', m).addEventListener('click', () => { tap(); closePause(); });
  const { again, exit } = G;
  $('.again', m).addEventListener('click', () => { tap(); quit(); S.pd.run = null; store.saveRun(S.pd); again(); });
  $('.tomap', m).addEventListener('click', () => { tap(); quit(); S.pd.run = null; store.saveRun(S.pd); exit(); });
  const gh = $('.gh', m); if (gh) gh.addEventListener('click', () => { tap(); rec.ghostOn = rec.ghostOn === false; G.ghostData = rec.ghostOn ? S.pd.ghosts[G.levelId] : null; store.saveLevel(S.pd, G.levelId); openPause(); });
  const tm = $('.tm', m); if (tm) tm.addEventListener('click', () => { tap(); sc.timerVisible = !sc.timerVisible; $('.htime', G.scr).classList.toggle('hidden', !sc.timerVisible); store.saveProgress(S.pd); openPause(); });
  $('.snd', m).addEventListener('click', () => { S.settings.sound = !S.settings.sound; A.setSound(S.settings.sound); store.saveSettings(S.settings); tap(); openPause(); });
  $('.mus', m).addEventListener('click', () => { S.settings.music = !S.settings.music; A.setMusic(S.settings.music); store.saveSettings(S.settings); tap(); openPause(); });
}
function closePause() { if (!G) return; G.pausedMenu = false; const m = $('.menu', G.scr); m.classList.remove('show'); m.innerHTML = ''; input.clear(); }
function quit() { if (!G) return; G.over = true; G.doneDrawing = true; input.unbind(); removeEventListener('resize', G.fit); G = null; }

// ---- results (S10) ----
function medalFor(levelId, steps, rec) {
  const T = targets(levelId), s = steps / 60; // targets come from the measured expert times (experts.js)
  let m = 1; if (s <= T.silver) m = 2; if (s <= T.gold) m = 3;
  const isBest = rec.bestSteps === null || steps < rec.bestSteps;
  if (m === 3 && rec.medal >= 3 && isBest && rec.bestSteps !== null) m = 4; // Fox Medal: gold already earned, then a new best inside gold
  return m;
}
async function finish() {
  const Gs = G, w = Gs.w, pd = S.pd, rec = Gs.rec, levelId = Gs.levelId, d = today();
  input.unbind(); removeEventListener('resize', Gs.fit); Gs.doneDrawing = true;
  const steps = w.timer, firstPlay = rec.plays === 0;
  const m = medalFor(levelId, steps, rec);
  const isBest = rec.bestSteps === null || steps < rec.bestSteps;
  const oldBest = rec.bestSteps;
  const brain = w.answers.length >= QUESTIONS[levelId] && w.answers.every((a) => a.first) && !Gs.resume;
  rec.plays++; rec.medal = Math.max(rec.medal, m); rec.brainStar = rec.brainStar || brain; rec.finishedOn = d;
  if (isBest) rec.bestSteps = steps;
  const sc = pd.progress.scroller;
  sc.acornsTotal = (sc.acornsTotal || 0) + w.acorns;
  const nx = nextLevel(levelId); if (nx && !sc.unlocked.includes(nx)) sc.unlocked.push(nx);
  recordLevel(sc, levelId, w.answers); // L1 misses come back in L2
  pd.run = null; store.saveRun(pd);
  let ghost = null;
  if (isBest && !Gs.resume) { ghost = { samples: Gs.samples, steps }; pd.ghosts[levelId] = ghost; }
  pd.history = [...(pd.history || []), { day: d, level: levelId, steps, medal: m, right: w.answers.filter((a) => a.first).length, notYet: w.answers.filter((a) => !a.first).length }].slice(-C.HISTORY_KEEP);
  await store.saveLevel(pd, levelId, { ghost });
  store.saveGate(pd, { keepRun: true, history: pd.history[pd.history.length - 1] });
  G = null;
  results({ levelId, steps, m, isBest, oldBest, brain, acorns: w.acorns, missed: [...Gs.ctx.missedHere], firstPlay, exit: Gs.exit, again: Gs.again, nx });
}
function results({ levelId, steps, m, isBest, oldBest, brain, acorns, missed, firstPlay, exit, again, nx }) {
  A.play(m >= 3 ? 'cheer' : 'medal');
  const T = targets(levelId);
  const names = ['', 'medal_bronze', 'medal_silver', 'medal_gold', 'medal_fox'];
  const nextT = m === 1 ? T.silver : m === 2 ? T.gold : null;
  const scr = show('results', `<div class="res"><div class="rleft"><div class="medal m${m}" aria-label="${t(names[m])}"><span></span></div><h1>${t(names[m])}</h1>
    ${brain ? `<p class="brain"><i class="bstar"></i>${t('brain_star')} <small>${t('brain_star_hint')}</small></p>` : ''}</div>
    <div class="rright"><p class="rt"><span>${t('time')}</span><b>${fmtTime(steps)}</b>${isBest && oldBest !== null ? `<em>${t('new_best')}</em>` : ''}</p>
    <p class="rt"><span>${t('best')}</span><b>${fmtTime(isBest ? steps : oldBest)}</b></p>
    <p class="rt"><span>${t('acorns')}</span><b><i class="ac"></i>${acorns}</b></p>
    ${nextT && !firstPlay ? `<p class="small">${t('faster', { t: fmtTarget(nextT) })}</p>` : ''}
    ${m >= 1 && firstPlay ? `<p class="small">${t('ghost_hint')}</p>` : ''}
    ${missed.length ? `<div class="lookagain"><h3>${t('look_again')}</h3><div class="las"></div></div>` : ''}
    <div class="row"><button class="btn alt again">${t('replay')}</button>${nx ? `<button class="btn go nextb">${t('next_level')}</button>` : ''}<button class="btn alt tomap">${t('to_map')}</button></div></div></div>`);
  const las = $('.las', scr);
  if (las) for (const id of missed.slice(0, 3)) { const [a, b] = parseFact(id); const tb = tableFor(levelId, id); const [x, y] = a === tb ? [a, b] : [b, a]; const n = el(`<div class="la"><b>${t('fact', { a: x, b: y, c: x * y })}</b></div>`); n.appendChild(dots(x, y, { max: 140, maxH: 40 })); las.appendChild(n); }
  $('.again', scr).addEventListener('click', () => { A.play('ui_tap'); again(); });
  $('.tomap', scr).addEventListener('click', () => { A.play('ui_tap'); exit(); });
  const nb = $('.nextb', scr); if (nb) nb.addEventListener('click', () => { A.play('ui_tap'); exit(nx); });
  const key = (e) => { if (S.screen !== 'results') return removeEventListener('keydown', key); if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); removeEventListener('keydown', key); (nb || $('.again', scr)).click(); } };
  addEventListener('keydown', key);
}
async function bossWin() {
  const Gs = G, pd = S.pd, rec = Gs.rec, d = today();
  input.unbind(); removeEventListener('resize', Gs.fit);
  rec.plays++; rec.medal = Math.max(rec.medal, 1); rec.finishedOn = d;
  const sc = pd.progress.scroller, nx = nextLevel(Gs.levelId); if (nx && !sc.unlocked.includes(nx)) sc.unlocked.push(nx);
  pd.run = null; store.saveRun(pd); store.saveProgress(pd);
  await store.saveLevel(pd, Gs.levelId);
  G = null;
  const wd = worldOf(Gs.levelId);
  if (wd === 'rb') return finale(Gs);
  A.play('cheer');
  const scr = show('bosswin', `<div class="bw"><h1>${t('boss_win')}</h1><div class="bwrow"><div class="bwfox"></div><div class="bwboss">${bossImg(wd, 'friendly', 'bwimg')}</div></div><p class="bwline">${t('end_' + wd)}</p><p>${t('boss_win_2')}</p><button class="btn go tomap">${t('to_map')}</button></div>`);
  $('.bwfox', scr).appendChild(foxCanvas('dance1', 200, 'joy'));
  $('.tomap', scr).addEventListener('click', () => { removeEventListener('keydown', key); A.play('ui_tap'); Gs.exit(); });
  // hotfix: keyboard players can leave the win screen with Enter or Space (it had no key before)
  const key = (e) => { if (S.screen !== 'bosswin') return removeEventListener('keydown', key); if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); $('.tomap', scr).click(); } };
  setTimeout(() => addEventListener('keydown', key), 600);
}
// v0.4.1 finale after the Rainbow Dragon: "You did it!" with the friend parade (all 10 bosses, friendly). Tap or any key skips it.
function finale(Gs) {
  A.play('fanfare_win'); setTimeout(() => A.play('cheer'), 900);
  const friends = ['rb', 'x2', 'x10', 'x5', 'x3', 'x4', 'x9', 'x6', 'x8', 'x7'].map((wd, i) => `<span class="pf pf${i}">${bossImg(wd, 'friendly', 'pfimg')}</span>`).join('');
  const scr = show('finale', `<div class="fin" role="dialog" aria-label="${t('fin_title')}"><div class="confetti"></div><h1>${t('fin_title')}</h1><p class="finline">${t('end_rb')}</p>
    <div class="parade">${friends}</div><div class="finfox"></div><p class="finskip">${t('fin_skip')}</p></div>`);
  $('.finfox', scr).appendChild(foxCanvas('dance1', innerHeight < 520 ? 96 : 170, 'joy'));
  let done = false; const go = () => { if (done) return; done = true; clearTimeout(tm); removeEventListener('keydown', key); A.play('ui_tap'); Gs.exit(); };
  const key = (e) => { e.preventDefault(); go(); };
  setTimeout(() => { if (!done) { scr.addEventListener('click', go); addEventListener('keydown', key); } }, 400); // a short guard so the last jump press does not skip it
  const tm = setTimeout(go, 12000);
}
export function levelTitle(id) { return t('lv_' + id); }
export { fmtTarget };
export const live = () => G;
