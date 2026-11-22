// Gameplay screens: strategy card (S5), run (S6), level done (S7), boss intro, battle, funny retry, win (S8 to S10).
import { CONFIG } from './config.js';
import { S, t, show, el, $, $$, sleep, tapOnce, dots, setVar, fmtSquad, today, Stop } from './ui.js';
import * as E from './engine.js';
import { groupOf, parseFact, factId } from './facts.js';
import * as A from './audio.js';
import * as store from './store.js';
import { ICON, broccoli, PIE, FEATHER, SPLAT } from './art.js';
import { goHome, showResults, openPause } from './screens.js';

const now = () => Date.now();
const save = (extra) => store.saveGate(S.pd, extra);
const last = (arr) => arr[arr.length - 1];
let lockUntil = 0;
const COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#b197fc', '#ffa94d', '#f783ac', '#38d9a9'];

// ---- Crowd of runners (at most MAX_SPRITES drawn; above that the crowd looks denser) ----
export function crowdHTML(n, cls = '') {
  const shown = Math.min(CONFIG.MAX_SPRITES, n);
  const R = 30 + Math.min(1, Math.log10(Math.max(10, n)) / 3.3) * 120;
  let h = '';
  for (let i = 0; i < shown; i++) {
    const r = R * Math.sqrt((i + 0.5) / shown), a = i * 2.39996;
    h += `<i class="rn" data-x="${(r * Math.cos(a)).toFixed(1)}" data-y="${(r * Math.sin(a) * 0.42).toFixed(1)}" data-c="${i % COLORS.length}"></i>`;
  }
  return `<div class="crowd ${cls}">${h}</div>`;
}
export function placeCrowd(root) {
  for (const r of $$('.rn', root)) {
    setVar(r, '--x', r.dataset.x + 'px'); setVar(r, '--y', r.dataset.y + 'px'); setVar(r, '--c', COLORS[+r.dataset.c]);
    setVar(r, '--dl', ((+r.dataset.c * 53) % 400) + 'ms');
  }
}
function setCrowd(scr, n) {
  const z = $('.crowdzone', scr); if (!z) return;
  z.innerHTML = crowdHTML(n); placeCrowd(z);
}
function rollCounter(node, from, to) {
  if (!node) return;
  const t0 = performance.now(), d = 600;
  const f = () => { const k = Math.min(1, (performance.now() - t0) / d); node.textContent = fmtSquad(Math.round(from + (to - from) * k)); if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function powerBarHTML() {
  const p = S.pd.progress.power;
  let segs = '';
  for (let i = 0; i < CONFIG.POWER_SEGMENTS; i++) segs += `<i class="${i < p.segments ? 'on' : ''}"></i>`;
  return `<div class="powerbar lvl${Math.min(6, p.level)}${p.level > 1 ? ' layered' : ''}" aria-label="${t('power')}">${segs}<b>x${p.level}</b></div>`;
}
function refreshPower(scr) { const pb = $('.powerbar', scr); if (pb) pb.outerHTML = powerBarHTML(); }

// ---- Entry: Play / Go on / Next ----
export async function playNext({ resume = false } = {}) {
  const pd = S.pd;
  if (!pd.run) E.startRun(pd, { now: now(), seed: now() & 0x7fffffff });
  else if (resume) E.resumeStage(pd);
  await save();
  try {
    if (pd.run.stage === 'BOSS') return await bossIntro();
    await strategyCard(pd.run.stage);
    await runLevel();
  } catch (e) { if (!(e instanceof Stop)) throw e; }
}

// ---- S5 Strategy card ----
async function strategyCard(stage) {
  const n = +stage[1];
  const P = S.pd.progress;
  P.strategySeen = P.strategySeen || [];
  const full = !P.strategySeen.includes(stage);
  let pic = '', lines = '';
  if (n === 1) { lines = `<p>${t('strat_1a', { a: 10, b: 4, c: 40 })}</p><p>${t('strat_1b', { n: 4, c: 40 })}</p>`; }
  if (n === 2) { lines = `<p>${t('strat_2a', { n: 6, t: 60, c: 30 })}</p>`; }
  if (n === 3) { lines = `<p>${t('strat_3a', { n: 7, c: 14 })}</p>`; }
  const scr = show('strategy', `<div class="card big ${full ? 'full' : 'short'}"><div class="lvl">${t('level', { n })}</div><h1>${t('level_' + n)}</h1>
    <div class="pic"></div>${lines}<button class="btn go">${t('go')} ${ICON.next}</button></div>`);
  const box = $('.pic', scr);
  if (n === 1) box.appendChild(dots(4, 10, { max: 260 }));
  if (n === 2) box.appendChild(dots(6, 10, { max: 260, cls: 'halffade', fade: (r, c) => c >= 5 }));
  if (n === 3) box.appendChild(dots(2, 7, { max: 260 }));
  if (!full) box.classList.add('small');
  P.strategySeen.push(stage); P.strategySeen = [...new Set(P.strategySeen)];
  save();
  const go = $('.go', scr);
  if (full) await tapOnce(go);
  else await Promise.race([tapOnce(go), sleep(2000)]);
  A.play('ui_tap');
}

// ---- S6 Run screen ----
function runHTML(boss) {
  const r = S.pd.run;
  const top = `<div class="topbar"><button class="icon pausebtn" aria-label="Pause">${ICON.pause}</button>
    ${boss ? `<div class="giggle"><span>${t('giggle')}</span><div class="meter"><i></i></div></div>` : `<div class="sq">${t('squad')} <b class="sqn">${fmtSquad(E.displaySquad(r))}</b></div>`}
    ${powerBarHTML()}</div>`;
  return `${top}<div class="track ${boss ? 'arena' : ''}">${boss ? `<div class="bossbox">${broccoli('grumpy')}</div>` : '<div class="road"></div>'}
    <div class="signwrap"><div class="sign hidden"><span class="q"></span><div class="signdots"></div></div></div>
    <div class="gates"></div>
    <div class="think hidden"><span>${t('think')}</span></div>
    <button class="bulb hidden" aria-label="${t('help')}">${ICON.bulb}<span>${t('help')}</span></button>
    <div class="msg"></div>
    <div class="arrayblock"></div>
    <div class="fx"></div>
    <div class="crowdzone"></div><div class="waiting"></div>
    ${boss ? `<div class="bossfoot"><span>${t('squad')} <b class="sqn">${fmtSquad(r.squad)}</b></span><span class="rnd">${t('round', { n: r.boss.round })}</span></div>` : ''}
    <button class="btn small lookagain hidden">${t('look_again')}</button>
    </div><div class="layer"></div>`;
}
function mountRun(boss) {
  const scr = show(boss ? 'boss' : 'run', runHTML(boss));
  setCrowd(scr, S.pd.run.squad);
  $('.pausebtn', scr).addEventListener('click', () => openPause());
  if (boss) updateMeter(scr, S.pd.run.boss.meterPct);
  return scr;
}
function updateMeter(scr, pct) { const m = $('.meter i', scr); if (m) setVar(m, '--p', pct + '%'); }
function updateSquad(scr, from, to) { for (const n of $$('.sqn', scr)) rollCounter(n, from, to); }

async function runLevel() {
  const pd = S.pd;
  const scr = mountRun(false);
  for (;;) {
    if (pd.run.powerGatePending) await powerGate(scr);
    if (E.levelComplete(pd)) return levelDone();
    const gate = E.nextGate(pd, { today: today() });
    await save({ factIds: [gate.factId] });
    await doGate(scr, gate);
  }
}

// One gate: cards, then the choice, then the right or miss flow.
async function doGate(scr, gate) {
  const flow = S.flow;
  for (const c of gate.cards) await showCard(scr, gate, c);
  const sign = $('.sign', scr), gates = $('.gates', scr), think = $('.think', scr), bulb = $('.bulb', scr);
  $('.q', sign).textContent = t('fact_q', { a: gate.a, b: gate.b });
  $('.signdots', sign).innerHTML = ''; sign.classList.remove('hidden', 'helped');
  gates.className = `gates g${gate.k}`;
  gates.innerHTML = gate.choices.map((v, i) => `<button class="gate" data-i="${i}" aria-label="${v}"><span>${v}</span><div class="gdots"></div></button>`).join('');
  if (gate.helper) for (const g of $$('.gate', gates)) { g.classList.add('helper'); }
  think.classList.add('hidden'); bulb.classList.add('hidden'); scr.classList.remove('sitting');
  const speed = E.speedFor(S.pd, gate);
  setVar(scr, '--approach', Math.round(CONFIG.GATE_APPROACH_MS / speed) + 'ms');
  gates.classList.remove('approach'); void gates.offsetWidth;
  A.play('gate_whoosh');
  await sleep(300, flow);
  gates.classList.add('approach'); scr.classList.add('running');
  const t0 = performance.now(), p0 = S.pausedMs || 0;
  let thinkStop = false, helpUsed = false;
  const approach = sleep(CONFIG.GATE_APPROACH_MS / speed, flow).then(() => 'stop', () => 'left');
  const choice = waitChoice(scr, gate);
  choice.catch(() => {});
  let idx = await Promise.race([choice, approach]);
  if (idx === 'left' || flow !== S.flow) throw new Stop(); // the child left this screen: record nothing
  if (idx === 'stop') {
    thinkStop = true; scr.classList.remove('running'); scr.classList.add('sitting'); think.classList.remove('hidden');
    sleep(CONFIG.THINK_HELP_DELAY_MS, flow).then(() => {
      if (gate.firstChoice !== undefined) return;
      bulb.classList.remove('hidden'); A.play('help_light');
      bulb.onclick = () => { helpUsed = true; A.play('help_light'); sign.classList.add('helped'); const sd = $('.signdots', sign); sd.innerHTML = ''; sd.appendChild(dots(gate.a, gate.b, { max: 200, maxH: 110, cls: 'faint' })); };
    }, () => {});
    idx = await choice;
  }
  const timeMs = performance.now() - t0 - ((S.pausedMs || 0) - p0);
  scr.classList.remove('sitting'); think.classList.add('hidden'); bulb.classList.add('hidden'); scr.classList.add('running');
  const before = E.displaySquad(S.pd.run);
  const res = E.answer(S.pd, gate, idx, { timeMs, thinkStop, helpUsed, today: today(), now: now() });
  await save({ factIds: [gate.factId], attempts: [last(S.pd.attempts)] });
  if (res.right) await rightFx(scr, gate, res, before, idx);
  else await missFlow(scr, gate, res, idx);
  scr.classList.remove('running');
  sign.classList.add('hidden'); gates.innerHTML = '';
}

function waitChoice(scr, gate) {
  const flow = S.flow;
  return new Promise((ok, bad) => {
    const gs = $$('.gate', scr);
    const track = $('.track', scr);
    let x0 = null;
    const done = (i) => {
      if (S.paused || performance.now() < lockUntil || gate.removed.includes(i)) return;
      lockUntil = performance.now() + CONFIG.INPUT_LOCK_MS;
      cleanup(); A.play('ui_tap', { gain: 0.5 }); ok(i);
    };
    const onClick = (e) => done(+e.currentTarget.dataset.i);
    const ts = (e) => { x0 = e.touches ? e.touches[0].clientX : null; };
    const te = (e) => {
      if (x0 === null) return; const x1 = e.changedTouches ? e.changedTouches[0].clientX : x0; const dx = x1 - x0; x0 = null;
      if (Math.abs(dx) < 50) return;
      const live = [...Array(gate.k).keys()].filter((i) => !gate.removed.includes(i));
      done(dx < 0 ? live[0] : live[live.length - 1]);
    };
    const chk = setInterval(() => { if (flow !== S.flow) { cleanup(); bad(new Stop()); } }, 250);
    function cleanup() { clearInterval(chk); gs.forEach((g) => g.removeEventListener('click', onClick)); track.removeEventListener('touchstart', ts); track.removeEventListener('touchend', te); }
    gs.forEach((g) => g.addEventListener('click', onClick));
    track.addEventListener('touchstart', ts, { passive: true }); track.addEventListener('touchend', te);
  });
}

async function rightFx(scr, gate, res, before, idx) {
  const flow = S.flow;
  const g = $$('.gate', scr)[idx]; if (g) g.classList.add('right');
  A.play('correct_pop');
  if (gate.kind === 'boss') return;
  const ab = $('.arrayblock', scr); ab.innerHTML = ''; ab.appendChild(dots(gate.a, gate.b, { max: 220, maxH: 150, cls: 'runners' })); ab.classList.add('show');
  if (res.power) A.step('power_step', (S.pd.progress.power.segments || 10) - 1);
  refreshPower(scr);
  await sleep(CONFIG.ARRAY_SHOW_MS, flow);
  ab.classList.remove('show'); ab.classList.add('join');
  A.play('runners_join');
  const after = E.displaySquad(S.pd.run);
  updateSquad(scr, before, after); setCrowd(scr, S.pd.run.squad);
  await sleep(450, flow);
  ab.classList.remove('join'); ab.innerHTML = '';
  if (res.powerGate) { A.play('power_ready'); }
}

// ---- Miss flow (6.8): boing, 3 runners step aside, picture, retry, rescue ----
async function missFlow(scr, gate, res, idx) {
  const flow = S.flow;
  A.play('miss_boing');
  const gs = $$('.gate', scr); gs[idx].classList.add('picked');
  const boss = gate.kind === 'boss';
  if (boss) await bossDodge(scr);
  else if (res.stepAside) {
    A.play('step_aside');
    const w = $('.waiting', scr); w.innerHTML = '<i class="rn"></i><i class="rn"></i><i class="rn"></i>'; w.classList.add('show');
    $$('.rn', w).forEach((r, i) => setVar(r, '--c', COLORS[i]));
    for (const n of $$('.sqn', scr)) n.textContent = fmtSquad(res.display);
  }
  const chosen = gate.choices[idx];
  await missPicture(scr, gate, chosen, boss ? CONFIG.MISS_PICTURE_MS.boss : CONFIG.MISS_PICTURE_MS.level);
  // Retry: same gates in the same places; the right gate glows softly with faint dots.
  gs.forEach((g) => g.classList.remove('picked'));
  const rg = gs[gate.correctIndex]; rg.classList.add('glow');
  const gd = $('.gdots', rg); gd.innerHTML = ''; gd.appendChild(dots(gate.a, gate.b, { max: 70, maxH: 70, cls: 'faint' }));
  const look = $('.lookagain', scr); look.classList.remove('hidden');
  look.onclick = async () => { if (S.paused) return; A.play('ui_tap'); look.disabled = true; await missPicture(scr, gate, chosen, CONFIG.MISS_PICTURE_MS.level).catch(() => {}); look.disabled = false; };
  for (;;) {
    const before = E.displaySquad(S.pd.run);
    const i = await waitChoice(scr, gate);
    const r2 = E.answer(S.pd, gate, i, { today: today(), now: now() });
    await save({ factIds: [gate.factId], attempts: [last(S.pd.attempts)] });
    if (r2.right) {
      look.classList.add('hidden'); rg.classList.remove('glow');
      if (r2.rescued) {
        A.play('rescue');
        const m = $('.msg', scr); m.textContent = t('rescued_plus', { n: r2.rescued }); m.className = 'msg show';
        const w = $('.waiting', scr); w.classList.add('back');
        await sleep(900, flow);
        w.classList.remove('show', 'back'); w.innerHTML = ''; m.className = 'msg';
      }
      if (boss) return r2;
      await rightFx(scr, gate, r2, before, i);
      return r2;
    }
    // wrong again (rare): that gate wobbles and fades out, leaving the right one
    gs[i].classList.add('wobble'); A.play('miss_boing', { gain: 0.6 });
    await sleep(700, flow); gs[i].classList.add('gone');
  }
}

// Miss picture (6.8 step 3). Shown as a card over the track for about 4 s (3 s in the boss).
export function missPictureNode(gate, chosen) {
  const { a, b, c } = gate;
  const d = gate.distractors.find((x) => x.value === chosen) || { type: 'OTHER' };
  const card = el(`<div class="mp"><h2>${t('almost')}</h2><div class="mpic"></div><div class="mtext"></div></div>`);
  const pic = $('.mpic', card), txt = $('.mtext', card);
  const line = (s) => { const p = document.createElement('p'); p.textContent = s; txt.appendChild(p); };
  const two = (x, y, glow) => { const w = el(`<div class="mfact ${glow ? 'glow' : 'fade'}"><p></p></div>`); $('p', w).textContent = t('mp_fact', { a: x, b: y, c: x * y }); w.prepend(dots(x, y, { max: 140, maxH: 150 })); return w; };
  if ((d.type === 'ADJ' || d.type === 'OBF') && d.neighbourFactId) {
    const na = d.type === 'ADJ' ? chosen / b : a, nb = d.type === 'ADJ' ? b : chosen / a;
    pic.classList.add('pair'); pic.appendChild(two(a, b, true)); pic.appendChild(two(na, nb, false));
  } else if (d.type === 'ADD') {
    pic.appendChild(dots(a, b, { max: 260, maxH: 170 }));
    line(t('mp_add_1', { a, b, s: a + b })); line(t('mp_add_2', { a, b, c })); line(t('mp_add_3'));
  } else if (d.type === 'SWP') {
    const h = Math.floor(c / 100), tt = Math.floor(c / 10) % 10, o = c % 10;
    const blocks = el('<div class="tenones"></div>');
    for (let i = 0; i < h; i++) blocks.appendChild(el('<i class="hund"></i>'));
    for (let i = 0; i < tt; i++) blocks.appendChild(el('<i class="ten"></i>'));
    for (let i = 0; i < o; i++) blocks.appendChild(el('<i class="one"></i>'));
    pic.appendChild(blocks);
    line(t('mp_swap')); line(h ? t('mp_swap_3', { c, h, t: tt, o }) : t('mp_swap_2', { c, t: tt, o }));
  } else {
    const grp = groupOf(factId(a, b));
    const n = grp === a ? b : a;
    if (grp === 10) { pic.appendChild(dots(n, 10, { max: 260, maxH: 170 })); line(t('groups', { a: n, b: 10 })); line(t('mp_tens', { n, c })); }
    else if (grp === 5) { pic.appendChild(dots(n, 10, { max: 260, maxH: 170, cls: 'halffade', fade: (r, col) => col >= 5 })); line(t('groups', { a: n, b: 5 })); line(t('mp_half', { n, t: n * 10, c })); }
    else if (grp === 2) { pic.appendChild(dots(2, n, { max: 260, maxH: 120 })); line(t('mp_double', { n, c })); }
    else if (grp === 3) { pic.appendChild(dots(3, n, { max: 260, maxH: 120 })); line(t('mp_three', { n, c })); }
    else { pic.appendChild(dots(a, b, { max: 260, maxH: 170 })); line(t('mp_groups', { a, b, c })); }
  }
  return card;
}
async function missPicture(scr, gate, chosen, ms) {
  const layer = $('.layer', scr);
  const card = missPictureNode(gate, chosen);
  layer.innerHTML = ''; layer.appendChild(card); layer.classList.add('show');
  A.play('miss_picture'); A.play('miss_picture', { rate: 1.26, when: 0.18 });
  try { await sleep(ms); } finally { layer.classList.remove('show'); layer.innerHTML = ''; }
}

// ---- Cards: Learn Gate, Turn-around, Sneak Peek ----
async function showCard(scr, gate, card) {
  const layer = $('.layer', scr);
  let node;
  if (card.type === 'learn') {
    A.play('learn_new');
    node = el(`<div class="mp learn"><h2>${ICON.star} ${t('new')}</h2><div class="sign mini">${t('fact_q', { a: gate.a, b: gate.b })}</div><div class="mpic"></div>
      <p class="ans hidden">${t('fact', { a: gate.a, b: gate.b, c: gate.c })}</p><button class="btn go hidden">${t('got_it')} ${ICON.next}</button></div>`);
    $('.mpic', node).appendChild(dots(gate.a, gate.b, { max: 260, maxH: 190, cls: 'build' }));
  } else if (card.type === 'turnaround') {
    A.play('turnaround');
    node = el(`<div class="mp turn"><h2>${ICON.spin} ${t('turnaround')}</h2><p class="ans">${t('turn_eq', { a: gate.a, b: gate.b })}</p><div class="mpic spin"></div><button class="btn go hidden">${t('ok')} ${ICON.next}</button></div>`);
    $('.mpic', node).appendChild(dots(gate.b, gate.a, { max: 200, maxH: 160 }));
  } else {
    A.play('learn_new', { rate: 0.9 });
    const known = card.known.map((id) => { const [x, y] = parseFact(id); const o = x === 3 ? y : x; return `<li>${t('fact', { a: 3, b: o, c: 3 * o })}</li>`; }).join('');
    node = el(`<div class="mp sneak"><h2>${ICON.eyes} ${t('sneak_peek')}</h2>${known ? `<p>${t('know_some')}</p><ul>${known}</ul>` : ''}<p>${t('three_groups')}</p><button class="btn go hidden">${t('cool')} ${ICON.next}</button></div>`);
  }
  layer.innerHTML = ''; layer.appendChild(node); layer.classList.add('show');
  await sleep(card.type === 'learn' ? 1500 : 900);
  const ans = $('.ans', node); if (ans) ans.classList.remove('hidden');
  const go = $('.go', node); go.classList.remove('hidden');
  await tapOnce(go); A.play('ui_tap');
  layer.classList.remove('show'); layer.innerHTML = '';
}

// ---- Power Gate ----
async function powerGate(scr) {
  const flow = S.flow;
  const layer = $('.layer', scr);
  A.play('power_ready');
  const node = el(`<div class="pg"><h2>${t('power_gate')}</h2><button class="rainbow">${t('squad_x2')}</button></div>`);
  layer.innerHTML = ''; layer.appendChild(node); layer.classList.add('show');
  await Promise.race([tapOnce($('.rainbow', node)), sleep(CONFIG.POWER_GATE_AUTO_MS)]);
  const before = E.displaySquad(S.pd.run);
  E.applyPowerGate(S.pd);
  await save();
  A.play('power_gate'); A.play('cheer', { gain: 0.6 });
  $('.rainbow', node).classList.add('through');
  updateSquad(scr, before, E.displaySquad(S.pd.run)); setCrowd(scr, S.pd.run.squad); $('.crowdzone', scr).classList.add('dance');
  refreshPower(scr);
  await sleep(1400, flow);
  $('.crowdzone', scr).classList.remove('dance');
  layer.classList.remove('show'); layer.innerHTML = '';
}

// ---- S7 Level done ----
async function levelDone() {
  const sum = E.finishLevel(S.pd);
  await save();
  A.play('level_done'); A.play('cheer', { gain: 0.6, when: 0.3 });
  const tiles = sum.tilesUp.map((x) => { const [a, b] = parseFact(x.factId); return `<span class="mini t-${x.tier}">${a}x${b}</span>`; }).join('');
  const scr = show('leveldone', `<div class="confetti"></div><div class="card big"><h1>${t('level_done', { n: sum.n })}</h1>
    <p class="big">${t('squad_n', { n: fmtSquad(sum.squad) })}</p>${sum.rescued > 0 ? `<p>${t('rescued_n', { n: sum.rescued })}</p>` : ''}
    ${tiles ? `<div class="tilesup"><span>${t('map_up')}</span>${tiles}</div>` : ''}
    <div class="row"><button class="btn go next">${t('next')} ${ICON.next}</button><button class="btn alt stop">${t('stop_here')}</button></div></div>`);
  confetti($('.confetti', scr));
  const b = await tapOnce([$('.next', scr), $('.stop', scr)]);
  A.play('ui_tap');
  if (b.classList.contains('stop')) return goHome();
  return playNext();
}
export function confetti(box, n = 40) {
  for (let i = 0; i < n; i++) { const c = el('<i></i>'); setVar(c, '--x', ((i * 37) % 100) + '%'); setVar(c, '--c', COLORS[i % COLORS.length]); setVar(c, '--dl', ((i * 71) % 900) + 'ms'); box.appendChild(c); }
}

// ---- S8 Boss intro ----
async function bossIntro() {
  const r = S.pd.run;
  const scr = show('bossintro', `<div class="card big"><div class="bossin">${broccoli('grumpy')}</div><h1>${t('boss_intro')}</h1>
    <div class="vs"><span>${t('squad')} <b>${fmtSquad(r.squad)}</b></span><span>${t('vs')}</span><span>${t('boss_name')}</span></div>
    <p>${t('boss_goal')}</p><button class="btn go">${t('go')} ${ICON.next}</button></div>`);
  A.play('boss_stomp'); A.play('boss_stomp', { when: 0.45 }); A.play('boss_grumble', { when: 0.9 });
  await tapOnce($('.go', scr)); A.play('ui_tap');
  await bossBattle();
}

// ---- S9 Boss battle ----
async function bossBattle() {
  const pd = S.pd;
  const scr = mountRun(true);
  if (pd.run.boss.powerPie) banner(scr, t('power_pie_ready'));
  for (;;) {
    const gate = E.nextGate(pd, { today: today() });
    if (!gate) return bossWin();
    await save({ factIds: [gate.factId] });
    const res = await doBossGate(scr, gate);
    if (res.boss.won) { await sleep(700); return bossWin(); }
    if (res.boss.funny) await funnyRetry(scr);
  }
}
function banner(scr, text) { const m = $('.msg', scr); m.textContent = text; m.className = 'msg show'; setTimeout(() => { m.className = 'msg'; }, 1600); }
async function doBossGate(scr, gate) {
  const flow = S.flow;
  const sign = $('.sign', scr), gates = $('.gates', scr);
  $('.q', sign).textContent = t('fact_q', { a: gate.a, b: gate.b }); sign.classList.remove('hidden', 'helped'); $('.signdots', sign).innerHTML = '';
  gates.className = `gates g${gate.k}`;
  gates.innerHTML = gate.choices.map((v, i) => `<button class="gate" data-i="${i}" aria-label="${v}"><span>${v}</span><div class="gdots"></div></button>`).join('');
  if (gate.helper) for (const g of $$('.gate', gates)) g.classList.add('helper');
  A.play('gate_whoosh');
  await sleep(300, flow);
  const t0 = performance.now(), p0 = S.pausedMs || 0;
  const think = $('.think', scr), bulb = $('.bulb', scr);
  let helpUsed = false, thinkStop = false;
  const stopT = sleep(CONFIG.GATE_APPROACH_MS, flow).then(() => 'stop', () => 'left');
  const choice = waitChoice(scr, gate);
  choice.catch(() => {});
  let idx = await Promise.race([choice, stopT]);
  if (idx === 'left' || flow !== S.flow) throw new Stop(); // the child left this screen: record nothing
  if (idx === 'stop') {
    thinkStop = true; think.classList.remove('hidden');
    sleep(CONFIG.THINK_HELP_DELAY_MS, flow).then(() => {
      if (gate.firstChoice !== undefined) return;
      bulb.classList.remove('hidden'); A.play('help_light');
      bulb.onclick = () => { helpUsed = true; sign.classList.add('helped'); const sd = $('.signdots', sign); sd.innerHTML = ''; sd.appendChild(dots(gate.a, gate.b, { max: 200, maxH: 90, cls: 'faint' })); };
    }, () => {});
    idx = await choice;
  }
  think.classList.add('hidden'); bulb.classList.add('hidden');
  const timeMs = performance.now() - t0 - ((S.pausedMs || 0) - p0);
  let res = E.answer(pd(), gate, idx, { timeMs, thinkStop, helpUsed, today: today(), now: now() });
  await save({ factIds: [gate.factId], attempts: [last(pd().attempts)] });
  if (res.right) { A.play('correct_pop'); $$('.gate', scr)[idx].classList.add('right'); }
  else res = await missFlow(scr, gate, res, idx);
  await bossThrow(scr, res.boss);
  refreshPower(scr);
  if (res.powerPieReady) banner(scr, t('power_pie_ready'));
  sign.classList.add('hidden'); gates.innerHTML = '';
  return res;
}
const pd = () => S.pd;
async function bossThrow(scr, b) {
  const flow = S.flow;
  const fx = $('.fx', scr), box = $('.bossbox', scr);
  const type = b.throwType;
  const art = type === 'tickle' ? FEATHER + FEATHER + FEATHER : type === 'splat' ? SPLAT : PIE;
  fx.innerHTML = `<div class="throw ${type}">${art}</div>`;
  A.play(type === 'tickle' ? 'throw_tickle' : type === 'splat' ? 'throw_splat' : 'throw_pie');
  if (type === 'power') A.play('big_splat', { when: 0.15 });
  banner(scr, t(type === 'power' ? 'power_pie' : 'throw_' + type));
  await sleep(500, flow);
  const cream = Math.min(3, Math.floor((b.hits / 3)) + (type === 'pie' || type === 'power' ? 1 : 0));
  box.innerHTML = broccoli('laugh', cream); box.classList.add('wiggle');
  A.play('boss_laugh', { gain: 0.8 });
  A.step('giggle_step', Math.min(11, b.hits));
  updateMeter(scr, b.meterPct);
  await sleep(900, flow);
  box.classList.remove('wiggle'); fx.innerHTML = '';
  box.innerHTML = broccoli(b.won ? 'happy' : 'laugh', cream);
  const rnd = $('.rnd', scr); if (rnd) rnd.textContent = t('round', { n: S.pd.run.boss ? S.pd.run.boss.round : 2 });
}
async function bossDodge(scr) {
  const flow = S.flow;
  const box = $('.bossbox', scr), fx = $('.fx', scr);
  box.classList.add('dodge'); A.play('boss_dodge');
  banner(scr, t('dodge'));
  await sleep(500, flow);
  fx.innerHTML = `<div class="throw back">${PIE}</div>`; A.play('pie_back', { when: 0.3 });
  await sleep(700, flow);
  $('.crowdzone', scr).classList.add('creamy'); A.play('throw_tickle', { gain: 0.5 });
  banner(scr, t('pie_back'));
  await sleep(600, flow);
  box.classList.remove('dodge'); fx.innerHTML = ''; $('.crowdzone', scr).classList.remove('creamy');
}
// ---- S9a Funny Retry ----
async function funnyRetry(scr) {
  const layer = $('.layer', scr);
  const node = el(`<div class="mp funny"><div class="eat">${broccoli('eat')}<div class="eatpie">${PIE}</div></div><h2>${t('more_pie')}</h2><p class="big">${t('round_2')}</p><button class="btn go">${t('go')} ${ICON.next}</button></div>`);
  layer.innerHTML = ''; layer.appendChild(node); layer.classList.add('show');
  A.play('boss_munch'); A.play('boss_laugh', { when: 1.6, gain: 0.7 });
  await tapOnce($('.go', node)); A.play('ui_tap');
  layer.classList.remove('show'); layer.innerHTML = '';
  const rnd = $('.rnd', scr); if (rnd) rnd.textContent = t('round', { n: 2 });
}
// ---- S10 Boss win ----
async function bossWin() {
  const res = E.finishRun(S.pd, { today: today() });
  const h = last(S.pd.history);
  await store.saveGate(S.pd, { history: h });
  const scr = show('win', `<div class="winstage"><div class="bigpie">${PIE}</div><div class="bossbox win">${broccoli('laugh', 3)}</div>${crowdHTML(Math.min(res.squad, 60), 'small')}</div>
    <div class="card"><h1>${t('big_splat')}</h1><p class="big">${t('boss_fun')}</p><button class="btn go">${ICON.next}</button></div><div class="confetti"></div>`);
  placeCrowd(scr);
  A.play('big_splat'); A.play('throw_pie', { when: 0.05 }); A.play('cheer', { when: 0.2 }); A.play('boss_laugh', { when: 0.8 }); A.play('boss_dance', { when: 1.6 });
  confetti($('.confetti', scr));
  setTimeout(() => { const b = $('.bossbox.win', scr); if (b) { b.innerHTML = broccoli('happy', 3); b.classList.add('dance'); } }, 1500);
  await tapOnce($('.go', scr)).catch(() => {});
  A.play('ui_tap');
  return showResults(res);
}
