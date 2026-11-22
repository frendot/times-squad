// The run screen: fixed-step loop (60 steps a second), canvas drawing, HUD, sounds, crash screen and instant retry.
import { CONFIG as C } from './config.js';
import { S, t, show, el, $, $$, dots, today } from './ui.js';
import * as W from './world.js';
import * as Rn from './render.js';
import { makeCtx } from './director.js';
import * as A from './audio.js';
import * as store from './store.js';
import * as input from './input.js';
import { skinOf, blasterOf, tierCoins } from './player.js';

export const G = { w: null, ctx: null, raf: 0, acc: 0, last: 0, paused: false, state: 'off', bonus: 0, touched: new Set(), newAtts: [], hud: {}, best0: 0, endedAt: 0, flow: 0 };
let onHome = null, onPause = null, bound = false;
const fmt = (n) => String(Math.floor(n));

export function runScreen({ home, pause }) {
  onHome = home; onPause = pause;
  const scr = show('run', `<canvas class="cv" aria-label="${t('run_label')}"></canvas>
    <div class="hud"><div class="hl"><div class="dist"><b>0</b><span>m</span></div><div class="bestm">${t('best')} <b>0</b> m</div></div>
      <div class="hr"><div class="score"><b>0</b></div><div class="coins"><i class="coin"></i><b>0</b></div></div>
      <button class="icon pausebtn" aria-label="${t('pause')}"><i></i><i></i></button></div>
    <div class="signbox" aria-live="polite"><div class="sign hidden"><span class="q"></span></div></div>
    <div class="meters"><div class="streak" aria-label="${t('power_meter')}">${'<i></i>'.repeat(C.POWER_STREAK)}</div>
      <div class="charge" aria-label="${t('blaster')}">${'<i></i>'.repeat(C.BLASTER_MAX_CHARGE)}</div></div>
    <div class="power hidden"><canvas class="pic" width="64" height="64"></canvas><div class="bar"><i></i></div></div>
    <div class="bossbar hidden"><span>${t('boss_name')}</span><div class="hp"><i></i></div></div>
    <div class="hint hidden"></div><div class="banner"></div><div class="go hidden">${t('go')}</div>
    <div class="crash hidden"></div>`);
  const cv = $('.cv', scr);
  Rn.init(cv);
  G.hud = { scr, dist: $('.dist b', scr), best: $('.bestm b', scr), score: $('.score b', scr), coins: $('.coins b', scr), sign: $('.sign', scr), q: $('.sign .q', scr),
    streak: $$('.streak i', scr), charge: $$('.charge i', scr), power: $('.power', scr), ppic: $('.power .pic', scr), pbar: $('.power .bar i', scr),
    boss: $('.bossbar', scr), hp: $('.bossbar .hp i', scr), hint: $('.hint', scr), banner: $('.banner', scr), crash: $('.crash', scr), go: $('.go', scr), last: {} };
  $('.pausebtn', scr).addEventListener('click', (e) => { e.stopPropagation(); A.play('ui_tap'); pauseGame(); });
  if (!bound) { input.bind(document.getElementById('app')); bound = true; addEventListener('resize', () => { if (G.state !== 'off') Rn.resize(); }); }
  input.setHandler({
    action: (a) => { if (G.state === 'run' && !G.paused) W.input(G.w, a); else if (G.state === 'crash') retryMaybe(); else if (G.paused) resumeGame(); },
    tap: () => { if (G.state === 'crash') retryMaybe(); else if (G.paused) resumeGame(); },
    pause: () => { if (G.state === 'run') (G.paused ? resumeGame() : pauseGame()); },
  });
  newRun();
}
function seedNow() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] | 0; }
export function newRun(seed = seedNow()) {
  const pd = S.pd;
  G.w = W.newWorld(seed); G.ctx = makeCtx(pd, G.w, today());
  G.bonus = 0; G.touched = new Set(); G.newAtts = []; G.state = 'run'; G.paused = false; G.flow = S.flow;
  G.best0 = pd.progress.runner.best;
  G.view = { pid: S.pid, skin: skinOf(pd) };
  Rn.RSTATE.blasterColor = blasterOf(pd).color; Rn.RSTATE.parts = []; Rn.RSTATE.pops = []; Rn.RSTATE.shake = 0; Rn.RSTATE.bossCream = 0;
  const H = G.hud; H.crash.classList.add('hidden'); H.crash.innerHTML = ''; H.best.textContent = fmt(G.best0); H.last = {};
  H.go.classList.remove('hidden'); H.go.classList.remove('pop'); void H.go.offsetWidth; H.go.classList.add('pop'); setTimeout(() => H.go.classList.add('hidden'), 700);
  A.play('go'); A.startMusic();
  G.last = performance.now(); G.acc = 0;
  cancelAnimationFrame(G.raf); G.raf = requestAnimationFrame(frame);
}
function frame(now) {
  if (S.flow !== G.flow) { G.state = 'off'; return; }
  G.raf = requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - G.last) / 1000); G.last = now;
  if (G.paused) dt = 0;
  if (G.state === 'run') {
    G.acc += dt; let n = 0;
    while (G.acc >= C.STEP_S && n < 6) { W.step(G.w, G.ctx); G.acc -= C.STEP_S; n++; handleEvents(); if (G.w.crashed) break; }
    if (G.w.crashed && G.state === 'run') crashed();
  }
  Rn.draw(G.w, G.view, G.state === 'crash' ? dt * 0.3 : dt);
  hud();
}
// ---- world events -> sounds, particles, HUD ----
function handleEvents() {
  const w = G.w; const at = () => Rn.RSTATE.lastAt || { x: Rn.width / 2, y: Rn.height * 0.7 };
  for (const e of w.events) {
    switch (e.type) {
      case 'lane': A.play('lane'); break;
      case 'jump': A.play('jump'); break;
      case 'slide': A.play('slide'); break;
      case 'sign': showSign(e.q); A.play('sign'); break;
      case 'right': {
        A.play('right'); A.step('streak_step', w.streak);
        const p = at(); Rn.popText(p.x, p.y - 160, `${e.q.c}!`, '#7CFF6B', 40); Rn.burst(p.x, p.y - 120, 'star', 10, '#7CFF6B');
        answered(e.q, e);
        if (w.boss || (e.type === 'right' && w.events.some((x) => x.type === 'bosshit'))) { /* boss hit handled below */ }
        break; }
      case 'wrong': {
        A.play('jam'); const p = at(); Rn.popText(p.x, p.y - 160, t('jammed'), '#FF8FA3', 34); Rn.shake(0.25);
        answered(e.q, e); showHint(e.q); break; }
      case 'zap': {
        A.play('zap'); A.play('poof', { when: 0.08 });
        const p = Rn.project(e.lane * C.LANE_W, 0.8, Math.max(2, e.z)); if (p) { Rn.RSTATE.beam = { t: w.t, x: p.x, y: p.y, col: beamCol() }; Rn.poofAt(p.x, p.y, 90); Rn.burst(p.x, p.y, 'star', 10, '#fff27a'); Rn.popText(p.x, p.y - 40, t('poof'), '#fff', 44); }
        break; }
      case 'coin': { A.play('coin'); const p = at(); Rn.burst(p.x, p.y - 60, 'coin', 6, '#ffd23f'); bump('coins'); break; }
      case 'power': { A.play('power'); Rn.flash('#fff6b0', 0.45); const p = at(); Rn.burst(p.x, p.y - 80, 'star', 22, '#ffd23f'); Rn.popText(Rn.width / 2, Rn.height * 0.42, t('pw_' + e.power), '#FFE45C', 46); setPowerIcon(e.power); break; }
      case 'powerend': A.play('power_end'); break;
      case 'shieldpop': A.play('shield_pop'); break;
      case 'smash': { A.play('smash'); Rn.shake(0.35); const p = at(); Rn.burst(p.x, p.y - 80, 'poof', 14); Rn.popText(p.x, p.y - 170, t('smash'), '#fff', 42); break; }
      case 'boss': { A.play('boss_in'); A.play('boss_grumble', { when: 0.4 }); Rn.shake(0.6); banner(t('boss_here')); G.hud.boss.classList.remove('hidden'); break; }
      case 'throw': A.play('throw'); break;
      case 'bosshit': { A.play('boss_hit'); A.play('boss_laugh', { when: 0.25 }); Rn.shake(0.7); Rn.RSTATE.bossHitT = w.t; Rn.RSTATE.bossCream++; const b = Rn.RSTATE.bossAt; if (b) { Rn.RSTATE.beam = { t: w.t, x: b.x, y: b.y, col: beamCol() }; Rn.burst(b.x, b.y, 'poof', 10); Rn.burst(b.x, b.y, 'dot', 16, '#fffaf0'); Rn.popText(b.x, b.y - 30, t('splat'), '#fff', 48); } break; }
      case 'bossdown': { A.play('boss_poof'); A.play('cheer', { when: 0.3 }); Rn.shake(1); Rn.flash('#fff', 0.7); const b = Rn.RSTATE.bossAt || at(); Rn.burst(b.x, b.y, 'poof', 30); Rn.burst(b.x, b.y, 'star', 30, '#ffd23f'); Rn.popText(Rn.width / 2, Rn.height * 0.4, t('boss_poof'), '#FFE45C', 50); banner(t('boss_bye', { n: C.BOSS_COINS })); G.hud.boss.classList.add('hidden'); Rn.RSTATE.bossCream = 0; break; }
      case 'crash': A.play('crash'); A.play('crash_boing', { when: 0.12 }); Rn.shake(1); Rn.flash('#ff8fa3', 0.5); break;
      default: break;
    }
  }
  w.events = [];
}
const beamCol = () => { const c = Rn.RSTATE.blasterColor; return c === 'rainbow' ? `hsl(${(G.w.t * 300) % 360},90%,60%)` : c; };
function answered(q, e) {
  const pd = S.pd; G.touched.add(q.factId);
  const att = pd.attempts[pd.attempts.length - 1]; G.newAtts.push(att);
  if (e.tierUp !== null && e.tierUp !== undefined) { const add = tierCoins(pd, q.factId, e.tier); if (add) { G.bonus += add; banner(t('map_up', { n: add })); A.play('tile_up'); } }
  store.saveGate(pd, { factIds: [q.factId], attempts: [att], keepRun: true });
  hideSign();
}
function showSign(q) {
  const H = G.hud; H.q.textContent = t('fact_q', { a: q.a, b: q.b });
  H.sign.classList.remove('hidden', 'pop', 'new'); void H.sign.offsetWidth; H.sign.classList.add('pop'); if (q.isNew) H.sign.classList.add('new');
}
function hideSign() { G.hud.sign.classList.add('hidden'); }
function showHint(q) {
  const H = G.hud; H.hint.innerHTML = ''; const p = el(`<p></p>`); p.textContent = t('fact', { a: q.a, b: q.b, c: q.c });
  H.hint.appendChild(p); H.hint.appendChild(dots(q.a, q.b, { max: 150, maxH: 70 }));
  H.hint.classList.remove('hidden'); clearTimeout(G.hintT); G.hintT = setTimeout(() => H.hint.classList.add('hidden'), C.HINT_S * 1000);
}
function banner(text) { const b = G.hud.banner; b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function bump(k) { const n = G.hud[k] && G.hud[k].parentNode; if (n) { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); } }
function setPowerIcon(kind) { const c = G.hud.ppic, g = c.getContext('2d'); g.clearRect(0, 0, 64, 64); g.drawImage(Rn.iconCanvas(kind, 64), 0, 0); G.hud.power.dataset.k = kind; }
function hud() {
  const w = G.w, H = G.hud, L = H.last;
  const set = (k, node, v) => { if (L[k] !== v) { L[k] = v; node.textContent = v; } };
  set('d', H.dist, fmt(w.meters)); set('s', H.score, fmt(w.score)); set('c', H.coins, fmt(w.coins + G.bonus));
  if (w.meters > G.best0 && G.best0 > 0 && !L.nb) { L.nb = true; banner(t('new_best')); A.play('cheer'); }
  if (L.st !== w.streak) { L.st = w.streak; H.streak.forEach((n, i) => n.classList.toggle('on', i < w.streak)); }
  const ch = w.blaster.jam > 0 ? -1 : w.blaster.charge;
  if (L.ch !== ch) { L.ch = ch; H.charge.forEach((n, i) => { n.classList.toggle('on', i < ch); n.classList.toggle('jam', ch < 0); }); }
  const pk = C.POWERS.find((k) => w.powers[k] > 0);
  if (pk) { if (H.power.classList.contains('hidden')) setPowerIcon(pk); H.power.classList.remove('hidden'); H.pbar.style.setProperty('--f', String(w.powers[pk] / C.POWER_S[pk])); } else H.power.classList.add('hidden');
  if (w.boss) H.hp.style.setProperty('--f', String(w.boss.hp / w.boss.max));
}
// ---- crash and retry ----
async function crashed() {
  const w = G.w, pd = S.pd, R = pd.progress.runner;
  G.state = 'crash'; G.endedAt = performance.now(); hideSign(); G.hud.boss.classList.add('hidden');
  const coins = w.coins + G.bonus, dist = Math.floor(w.meters), newBest = dist > R.best;
  R.coins += coins; R.coinsEver += coins; R.runs++; R.totalM += dist; R.bosses += w.bossesDone;
  if (newBest) R.best = dist; R.bestScore = Math.max(R.bestScore, Math.floor(w.score));
  const hist = { day: today(), seed: w.seed, m: dist, score: Math.floor(w.score), coins, right: w.rights, wrong: w.wrongs, zaps: w.zaps, bosses: w.bossesDone, by: w.crashed.by, at: Date.now() };
  pd.history = [...(pd.history || []), hist];
  store.saveGate(pd, { history: hist, keepRun: true });
  const cr = w.crashed, H = G.hud;
  const why = cr.q ? `<div class="why"><p class="whyq"></p></div>` : `<p class="tip">${t('tip_' + (cr.type === 'ball' ? 'ball' : cr.type || cr.by))}</p>`;
  H.crash.innerHTML = `<div class="card"><h1 class="bonk">${t('bonk')}</h1>
    <div class="stats"><div><b class="pop1">${dist}</b><span>m</span></div><div><b class="pop2">${Math.floor(w.score)}</b><span>${t('score')}</span></div><div><i class="coin"></i><b class="pop3">+${coins}</b></div></div>
    ${newBest ? `<p class="newbest">${t('new_best')}</p>` : `<p class="bestline">${t('best')} ${R.best} m</p>`}${why}
    <button class="btn huge again">${t('run_again')}</button><p class="small">${t('again_hint')}</p><button class="btn alt homeb">${t('home')}</button></div>`;
  if (cr.q) { const box = $('.why', H.crash); $('.whyq', box).textContent = t('fact', { a: cr.q.a, b: cr.q.b, c: cr.q.c }); box.appendChild(dots(cr.q.a, cr.q.b, { max: 220, maxH: 90 })); }
  H.crash.classList.remove('hidden');
  if (newBest) A.play('cheer', { when: 0.4 });
  $('.again', H.crash).addEventListener('click', (e) => { e.stopPropagation(); retryMaybe(true); });
  $('.homeb', H.crash).addEventListener('click', (e) => { e.stopPropagation(); A.play('ui_tap'); stop(); onHome(); });
}
function retryMaybe(force = false) {
  if (G.state !== 'crash') return;
  if (!force && performance.now() - G.endedAt < C.RETRY_GUARD_MS) return;
  A.play('ui_tap'); newRun();
}
export function stop() { G.state = 'off'; cancelAnimationFrame(G.raf); input.setHandler(null); A.stopMusic(); }
// ---- pause ----
export function pauseGame() {
  if (G.state !== 'run' || G.paused) return;
  G.paused = true; A.suspend();
  const ov = el(`<div class="pause"><div class="card"><h2>${t('paused')}</h2><button class="btn huge goon">${t('go_on')}</button>
    <button class="btn alt tog snd">${t('sound')} <b></b></button><button class="btn alt tog mus">${t('music')} <b></b></button><button class="btn alt homeb">${t('home')}</button></div></div>`);
  G.hud.scr.appendChild(ov);
  const upd = () => { $('.snd b', ov).textContent = S.settings.sound ? t('on') : t('off'); $('.mus b', ov).textContent = S.settings.music ? t('on') : t('off'); };
  upd();
  $('.snd', ov).addEventListener('click', (e) => { e.stopPropagation(); S.settings.sound = !S.settings.sound; A.setSound(S.settings.sound); store.saveSettings(S.settings); upd(); });
  $('.mus', ov).addEventListener('click', (e) => { e.stopPropagation(); S.settings.music = !S.settings.music; A.setMusic(S.settings.music); store.saveSettings(S.settings); upd(); });
  $('.goon', ov).addEventListener('click', (e) => { e.stopPropagation(); resumeGame(); });
  $('.homeb', ov).addEventListener('click', (e) => { e.stopPropagation(); A.resume(); stop(); onHome(); });
  if (onPause) onPause();
}
export function resumeGame() {
  if (!G.paused) return;
  const ov = $('.pause', G.hud.scr); if (ov) ov.remove();
  G.paused = false; G.last = performance.now(); A.resume(); A.play('ui_tap');
}
export const isRunning = () => G.state === 'run' && !G.paused;
