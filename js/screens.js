// Non-gameplay screens: start, install tip, player picker, how to play, home, results, Times Map, pause, parent gate and page.
import { CONFIG } from './config.js';
import { S, t, tp, show, el, $, $$, sleep, tapOnce, dots, setVar, fmtSquad, today, Stop, esc } from './ui.js';
import * as E from './engine.js';
import * as A from './audio.js';
import * as store from './store.js';
import { ANIMALS, ICON, broccoli } from './art.js';
import { factId, parseFact, isWorld1, isWorld1Cell, groupOf } from './facts.js';
import { addDays, daysBetween } from './learn.js';
import { playNext, crowdHTML, placeCrowd, confetti } from './play.js';

const tapSound = () => A.play('ui_tap');
const safe = (p) => p.catch((e) => { if (!(e instanceof Stop)) throw e; });
let installPrompt = null;
self.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
const standalone = () => (self.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

// ---- S1 Start ----
export function start() {
  const scr = show('start', `<div class="title"><h1>${t('app_name')}</h1><div class="hero">${crowdHTML(10, 'wave')}</div>
    <p class="tap">${ICON.play} ${t('start')}</p></div><button class="icon grownup corner" aria-label="${tp('grown_ups')}">${ICON.grownup}</button>`);
  placeCrowd(scr);
  $('.grownup', scr).addEventListener('click', (e) => { e.stopPropagation(); A.unlock(); parentGate(() => start()); });
  scr.addEventListener('click', () => { A.unlock(); A.play('start_jingle'); afterStart(); }, { once: true });
}
function afterStart() {
  const st = S.settings, d = today();
  const due = !st.installTipLastShownOn || daysBetween(st.installTipLastShownOn, d) >= CONFIG.INSTALL_TIP_EVERY_DAYS;
  if (!standalone() && !st.installTipDismissed && due) return installTip();
  picker();
}
// ---- S2 Install tip (grown-ups) ----
function installTip() {
  S.settings.installTipLastShownOn = today(); store.saveSettings(S.settings);
  const scr = show('install', `<div class="card"><h2>${ICON.grownup} ${tp('grown_ups')}</h2><p>${tp('install_1')}</p><p>${tp('install_2')}</p><p>${tp('install_3')}</p>
    <p class="ios">${ICON.share} ${esc(tp('install_ios'))}</p>
    ${installPrompt ? `<p>${tp('install_android')} <button class="btn small inst">${tp('install_btn')}</button></p>` : ''}
    <div class="row"><button class="btn alt later">${tp('later')}</button><button class="btn alt never">${tp('never')}</button></div></div>`);
  const inst = $('.inst', scr);
  if (inst) inst.addEventListener('click', async () => { try { installPrompt.prompt(); await installPrompt.userChoice; } catch { /* ignore */ } installPrompt = null; picker(); });
  $('.later', scr).addEventListener('click', () => { tapSound(); picker(); });
  $('.never', scr).addEventListener('click', () => { tapSound(); S.settings.installTipDismissed = true; store.saveSettings(S.settings); picker(); });
}
// ---- Player picker (T F: kids share one device; animal icons, no names, no typing) ----
export async function picker() {
  const sums = await store.playerSummaries();
  const cards = CONFIG.PLAYERS.map((p) => {
    const s = sums[p];
    const stars = s ? [1, 2, 3].map((i) => `<span class="st ${i <= s.bestStars ? 'on' : ''}">${ICON.star}</span>`).join('') : '';
    return `<button class="pick" data-p="${p}" aria-label="${t(p)}">${ANIMALS[p]}<span class="stars">${stars}</span></button>`;
  }).join('');
  const scr = show('picker', `<h1>${t('who')}</h1><div class="picks">${cards}</div>`);
  const b = await safe(tapOnce($$('.pick', scr)));
  if (!b) return;
  tapSound();
  await choosePlayer(b.dataset.p);
}
export async function choosePlayer(pid) {
  S.pid = pid; S.pd = await store.loadPlayer(pid);
  store.pruneAttempts(pid);
  S.settings.lastPlayer = pid; store.saveSettings(S.settings);
  if (!S.pd.progress.howToSeen) return howTo();
  goHome();
}
// ---- S3 How to play ----
export async function howTo(back) {
  const cards = [
    () => `<div class="sign mini">5 x 2</div><div class="gates g2 demo"><div class="gate"><span>10</span></div><div class="gate"><span>12</span></div></div><p>${t('howto_1')}</p>`,
    () => `<div class="pic"></div><p>${t('howto_2')}</p>`,
    () => `<div class="hero">${crowdHTML(10, 'stepaside')}</div><p>${t('howto_3')}</p>`,
  ];
  for (let i = 0; i < cards.length; i++) {
    const scr = show('howto', `<div class="card big">${cards[i]()}<div class="dotsnav">${cards.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row"><button class="btn go next">${t('next')} ${ICON.next}</button><button class="btn alt skip">${t('skip')}</button></div></div>`);
    if (i === 1) $('.pic', scr).appendChild(dots(2, 5, { max: 200, cls: 'runners' }));
    placeCrowd(scr);
    const b = await safe(tapOnce([$('.next', scr), $('.skip', scr)]));
    if (!b) return;
    tapSound();
    if (b.classList.contains('skip')) break;
  }
  S.pd.progress.howToSeen = true; store.saveGate(S.pd);
  if (back) return back();
  goHome();
}
// ---- S4 Home: Ten Town ----
export function goHome() {
  const pd = S.pd, r = pd.run, P = pd.progress;
  A.startMusic();
  const done = new Set(r ? r.levelsDone || [] : []);
  const cur = r ? r.stage : null;
  const node = (st, label) => `<div class="node ${done.has(st) ? 'done' : ''} ${cur === st ? 'cur' : ''}">${done.has(st) ? ICON.check : label}</div>`;
  let segs = ''; for (let i = 0; i < CONFIG.POWER_SEGMENTS; i++) segs += `<i class="${i < P.power.segments ? 'on' : ''}"></i>`;
  const stars = [1, 2, 3].map((i) => `<span class="st ${i <= P.bestStars ? 'on' : ''}">${ICON.star}</span>`).join('');
  const scr = show('home', `<div class="topbar"><button class="icon me" aria-label="${t(S.pid)}">${ANIMALS[S.pid]}</button><span class="sp"></span>
      <button class="icon howbtn" aria-label="?">${ICON.help}</button><button class="icon mapbtn" aria-label="${t('map')}">${ICON.map}</button></div>
    <h1 class="town">${t('town')}</h1>
    <div class="path">${node('L1', 1)}<b></b>${node('L2', 2)}<b></b>${node('L3', 3)}<b></b><div class="node boss ${cur === 'BOSS' ? 'cur' : ''}">${broccoli('happy')}</div></div>
    <div class="homepower"><span>${t('power')}</span><div class="powerbar lvl${Math.min(6, P.power.level)}${P.power.level > 1 ? ' layered' : ''}">${segs}<b>x${P.power.level}</b></div></div>
    <div class="best"><span>${t('best')}:</span>${stars}</div>
    <button class="btn huge play">${ICON.play} ${r ? t('go_on') : t('play')}</button>
    <div class="world2">${ICON.cloud} ${t('world2')} <span>${t('later')}</span></div>
    <button class="icon grownup corner" aria-label="${tp('grown_ups')}">${ICON.grownup}</button>`);
  $('.play', scr).addEventListener('click', () => { tapSound(); A.stopMusic(); playNext({ resume: !!r }); }, { once: true });
  $('.mapbtn', scr).addEventListener('click', () => { tapSound(); timesMap(goHome); });
  $('.howbtn', scr).addEventListener('click', () => { tapSound(); howTo(); });
  $('.me', scr).addEventListener('click', () => { tapSound(); picker(); });
  $('.grownup', scr).addEventListener('click', () => { tapSound(); parentGate(goHome); });
}
// ---- S11 Results ----
export async function showResults(res) {
  A.startMusic();
  const stars = [1, 2, 3].map((i) => `<span class="st big ${i <= res.stars ? 'earn' : ''}">${ICON.star}</span>`).join('');
  const tiles = res.tilesUp.map((x) => { const [a, b] = parseFact(x.factId); return `<span class="mini t-${x.tier}">${a}x${b}</span>`; }).join('');
  const scr = show('results', `<div class="card big"><div class="stars3">${stars}</div><p class="big">${t('squad_n', { n: fmtSquad(res.squad) })}</p>
    ${res.rescued ? `<p>${t('rescued_n_run', { n: res.rescued })}</p>` : ''}
    ${res.tilesUp.length ? `<div class="tilesup"><span>${t('tiles_up', { n: res.tilesUp.length })}</span>${tiles}</div>` : ''}
    <h2>${t('great_job')}</h2><p>${t('strong_brain')}</p>
    <div class="row three"><button class="btn eq mapb">${ICON.map} ${t('map')}</button><button class="btn eq homeb">${t('home')}</button><button class="btn eq again">${t('play_again')}</button></div></div>`);
  const flow = S.flow;
  (async () => {
    for (let i = 0; i < res.stars; i++) { await sleep(450, flow); $$('.st', scr)[i].classList.add('pop'); A.step('star', i * 2); }
    for (let i = 0; i < res.tilesUp.length; i++) { await sleep(250, flow); const m = $$('.mini', scr)[i]; m.classList.add('pop'); A.play('tile_up', { rate: { bronze: 0.84, silver: 1, gold: 1.26 }[res.tilesUp[i].tier] || 1 }); }
  })().catch(() => {});
  const b = await safe(tapOnce([$('.mapb', scr), $('.homeb', scr), $('.again', scr)]));
  if (!b) return;
  tapSound();
  if (b.classList.contains('mapb')) return timesMap(() => showResults(res));
  if (b.classList.contains('homeb')) return goHome();
  A.stopMusic(); playNext();
}
// ---- S12 Times Map ----
export function mapGrid(pd, { readOnly = false } = {}) {
  const shown = pd.progress.fireworksShown || [];
  let h = '<div class="grid"><i class="hd"></i>';
  for (let c = 2; c <= 12; c++) h += `<i class="hd">${c}${shown.includes('col-' + c) ? ICON.ribbon : ''}</i>`;
  for (let r = 2; r <= 12; r++) {
    h += `<i class="hd">${r}${shown.includes('row-' + r) ? ICON.ribbon : ''}</i>`;
    for (let c = 2; c <= 12; c++) {
      const id = factId(r, c), f = pd.facts[id];
      const tier = f ? f.tier : 'grey';
      const icon = tier === 'gold' ? ICON.star : tier === 'silver' ? '<b></b><b></b>' : tier === 'bronze' ? '<b></b>' : '';
      h += `<${readOnly ? 'span' : 'button'} class="cell t-${tier} ${isWorld1Cell(r, c) ? 'w1' : 'later'}" data-r="${r}" data-c="${c}" aria-label="${r} x ${c}">${icon}</${readOnly ? 'span' : 'button'}>`;
    }
  }
  return h + '</div>';
}
const fullGold = (pd) => {
  const g = (r, c) => pd.facts[factId(r, c)] && pd.facts[factId(r, c)].tier === 'gold';
  const out = [];
  for (let n = 2; n <= 12; n++) { let all = true; for (let m = 2; m <= 12; m++) if (!g(n, m)) { all = false; break; } if (all) out.push('row-' + n, 'col-' + n); }
  return out;
};
export function timesMap(back) {
  const pd = S.pd;
  const fresh = fullGold(pd).filter((k) => !(pd.progress.fireworksShown || []).includes(k));
  const scr = show('map', `<div class="topbar"><button class="icon backb" aria-label="${t('back')}">${ICON.back}</button><h1>${t('map')}</h1></div>
    ${mapGrid(pd)}<div class="key"><span class="cell t-grey w1"></span>${t('tier_grey')}<span class="cell t-bronze"><b></b></span>${t('tier_bronze')}
    <span class="cell t-silver"><b></b><b></b></span>${t('tier_silver')}<span class="cell t-gold">${ICON.star}</span>${t('tier_gold')}</div><div class="firework"></div><div class="layer"></div>`);
  if (fresh.length) {
    pd.progress.fireworksShown = [...(pd.progress.fireworksShown || []), ...fresh]; store.saveGate(pd);
    A.play('row_firework'); confetti($('.firework', scr), 30);
  }
  $('.backb', scr).addEventListener('click', () => { tapSound(); back(); });
  for (const c of $$('.cell[data-r]', scr)) c.addEventListener('click', () => { tapSound(); tileDetail(scr, +c.dataset.r, +c.dataset.c); });
}
function strategyLine(a, b) {
  const id = factId(a, b), g = groupOf(id), c = a * b, n = g === a ? b : a;
  if (g === 10) return t('mp_tens', { n, c });
  if (g === 5) return t('mp_half', { n, t: n * 10, c });
  if (g === 2) return t('mp_double', { n, c });
  if (g === 3) return t('mp_three', { n, c });
  return t('groups', { a, b });
}
function tileDetail(scr, r, c) {
  const f = S.pd.facts[factId(r, c)];
  const met = f && f.box >= 1;
  const layer = $('.layer', scr);
  const node = el(`<div class="mp tile"><h2></h2><div class="mpic"></div><p class="sl"></p><button class="btn go">${t('ok')}</button></div>`);
  $('h2', node).textContent = met ? `${t('fact', { a: r, b: c, c: r * c })} · ${t('tier_' + f.tier)}` : `${t('fact_q', { a: r, b: c })} · ${t('coming_soon')}`;
  $('.mpic', node).appendChild(dots(r, c, { max: 240, maxH: 200 }));
  $('.sl', node).textContent = met ? strategyLine(r, c) : '';
  layer.innerHTML = ''; layer.appendChild(node); layer.classList.add('show');
  $('.go', node).addEventListener('click', () => { tapSound(); layer.classList.remove('show'); layer.innerHTML = ''; });
}
// ---- S13 Pause ----
export function openPause() {
  if (S.paused || !['run', 'boss'].includes(S.screen)) return;
  S.paused = true; S.pauseStart = performance.now();
  const scr = $('.scr'); const ov = el(`<div class="pause"><div class="card"><h2>${t('paused')}</h2>
    <button class="btn go goon">${ICON.play} ${t('go_on')}</button>
    <button class="btn alt tog snd">${ICON.speaker} ${t('sound')} <b></b></button>
    <button class="btn alt tog mus">${ICON.note} ${t('music')} <b></b></button>
    <button class="btn alt homeb">${t('home')}</button></div></div>`);
  scr.appendChild(ov);
  const upd = () => { $('.snd b', ov).textContent = S.settings.sound ? t('on') : t('off'); $('.mus b', ov).textContent = S.settings.music ? t('on') : t('off'); };
  upd();
  $('.snd', ov).addEventListener('click', () => { S.settings.sound = !S.settings.sound; A.setSound(S.settings.sound); store.saveSettings(S.settings); tapSound(); upd(); });
  $('.mus', ov).addEventListener('click', () => { S.settings.music = !S.settings.music; A.setMusic(S.settings.music); store.saveSettings(S.settings); tapSound(); upd(); });
  $('.goon', ov).addEventListener('click', () => { A.resume(); tapSound(); closePause(ov); });
  $('.homeb', ov).addEventListener('click', () => { A.resume(); tapSound(); closePause(ov); goHome(); });
}
function closePause(ov) { S.pausedMs = (S.pausedMs || 0) + (performance.now() - S.pauseStart); S.paused = false; ov.remove(); }
// ---- S14 Parent gate ----
const rand = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
export function parentGate(back) {
  const qs = S.strings.parent_gate;
  let wrong = 0, q = qs[rand(qs.length)], typed = '';
  const scr = show('pgate', `<div class="card"><h2>${ICON.grownup} ${tp('grown_ups')}</h2><p class="pq"></p><div class="typed" aria-live="polite"></div><p class="tryagain hidden">${tp('try_again')}</p>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="k" data-k="${n}">${n}</button>`).join('')}<button class="k" data-k="del" aria-label="delete">${ICON.back}</button><button class="k" data-k="0">0</button><button class="k ok" data-k="ok">${tp('ok')}</button></div>
    <button class="btn alt backb">${tp('back')}</button></div>`);
  const setQ = () => { $('.pq', scr).textContent = `${tp('gate_type')} ${q[0]}.`; typed = ''; $('.typed', scr).textContent = ''; };
  setQ();
  for (const k of $$('.k', scr)) k.addEventListener('click', () => {
    tapSound(); const v = k.dataset.k;
    if (v === 'del') typed = typed.slice(0, -1);
    else if (v === 'ok') {
      if (+typed === q[1] && typed !== '') { S.parentOpen = true; return parentPage(S.pid || 'fox', back); }
      wrong++; if (wrong >= 3) return S.pd ? goHome() : start();
      $('.tryagain', scr).classList.remove('hidden'); let nq; do { nq = qs[rand(qs.length)]; } while (nq === q); q = nq; setQ(); return;
    } else if (typed.length < 3) typed += v;
    $('.typed', scr).textContent = typed;
  });
  $('.backb', scr).addEventListener('click', () => { tapSound(); back(); });
}
// ---- S15 Parent page ----
function trickiest(pd, d) {
  const since = addDays(d, -14);
  const per = {};
  for (const a of pd.attempts) {
    if (a.day < since || a.kind === 'learn') continue;
    const x = (per[a.factId] ||= { misses: 0, slow: 0, wrong: {}, rec: {} });
    if (a.firstTry && !a.right) { x.misses++; x.wrong[a.chosen] = (x.wrong[a.chosen] || 0) + 1; x.rec[a.chosen] = a; }
    if (a.firstTry && a.right && a.timeMs > 6000) x.slow++;
  }
  return Object.entries(per).filter(([, x]) => x.misses > 0)
    .map(([id, x]) => ({ id, score: x.misses * 2 + x.slow, box: (pd.facts[id] || {}).box || 0, x }))
    .sort((p, q) => q.score - p.score || p.box - q.box).slice(0, 3);
}
function mixText(item) {
  const [v] = Object.entries(item.x.wrong).sort((p, q) => q[1] - p[1])[0];
  const att = item.x.rec[v]; const d = att.distractors.find((y) => String(y.value) === String(v)) || {};
  const [a, b] = att.shown.split(' x ').map(Number);
  if (d.type === 'ADJ') return tp('mix_neighbour', { v, f: `${v / b} x ${b}` });
  if (d.type === 'OBF') return tp('mix_neighbour', { v, f: `${a} x ${v / a}` });
  if (d.type === 'ADD') return tp('mix_add', { v, a, b });
  if (d.type === 'SWP') return tp('mix_swap', { v });
  return tp('mix_other', { v });
}
function ideaFor(id) {
  const [x, y] = parseFact(id), g = groupOf(id), n = g === x ? y : x, c = x * y;
  const lines = [tp('idea', { a: n, b: g || y })];
  if (g === 10) lines.push(tp('try_tens', { n, c })); else if (g === 5) lines.push(tp('try_half', { n, t: n * 10, c }));
  else if (g === 2) lines.push(tp('try_double', { n, c })); else if (g === 3) lines.push(tp('try_three', { n, c }));
  return lines;
}
function mondayOf(d) { const [y, m, dd] = d.split('-').map(Number); const wd = (new Date(y, m - 1, dd).getDay() + 6) % 7; return addDays(d, -wd); }
export async function parentPage(pid, back) {
  const pd = pid === S.pid && S.pd ? S.pd : await store.loadPlayer(pid);
  const play = await store.playtimeFor(pid);
  const d = today(), mon = mondayOf(d);
  const secs = Object.entries(play).filter(([day]) => day >= mon && day <= d).reduce((s, [, v]) => s + v, 0) + (pid === S.pid ? S.unsaved || 0 : 0);
  const r = pd.run;
  const where = !r ? tp('where_home') : r.stage === 'BOSS' ? tp('where_boss') : tp('where_level', { n: r.stage[1] });
  const tricky = trickiest(pd, d);
  let idea = tricky.length ? ideaFor(tricky[0].id) : null;
  if (!idea) { const learn = pd.attempts.slice().reverse().find((a) => pd.facts[a.factId] && pd.facts[a.factId].box <= 2); idea = learn ? ideaFor(learn.factId) : [tp('no_idea')]; }
  const tabs = CONFIG.PLAYERS.map((p) => `<button class="tab ${p === pid ? 'on' : ''}" data-p="${p}" aria-label="${t(p)}">${ANIMALS[p]}</button>`).join('');
  const scr = show('parent', `<div class="topbar"><button class="icon backb" aria-label="${tp('back')}">${ICON.back}</button><h1>${tp('parent_page')}</h1></div>
    <div class="ptext"><div class="tabs"><span>${tp('player')}</span>${tabs}</div>
    <p>${esc(tp('now', { where }))}</p><p>${tp('week', { n: Math.round(secs / 60) })}</p>
    <h3>${tp('map')}</h3><div class="minimap">${mapGrid(pd, { readOnly: true })}</div>
    <h3>${tp('tricky')}</h3>${tricky.length ? `<ol>${tricky.map((x) => { const [a, b] = parseFact(x.id); return `<li>${a} x ${b} - ${esc(mixText(x))}</li>`; }).join('')}</ol>` : `<p>${tp('no_tricky')}</p>`}
    ${idea.map((l) => `<p class="idea">${esc(l)}</p>`).join('')}
    <div class="toggles"><button class="btn alt tog snd">${ICON.speaker} ${tp('sound')} <b></b></button><button class="btn alt tog mus">${ICON.note} ${tp('music')} <b></b></button></div>
    <p class="priv">${tp('privacy_1')}<br>${tp('privacy_2')}</p>
    <div class="row"><button class="btn warn resetp">${tp('reset_player')}</button><button class="btn warn reseta">${tp('reset_all')}</button></div>
    <p class="ver">${tp('version', { v: CONFIG.VERSION })}</p></div><div class="layer"></div>`);
  const upd = () => { $('.snd b', scr).textContent = S.settings.sound ? tp('on') : tp('off'); $('.mus b', scr).textContent = S.settings.music ? tp('on') : tp('off'); };
  upd();
  $('.snd', scr).addEventListener('click', () => { S.settings.sound = !S.settings.sound; A.setSound(S.settings.sound); store.saveSettings(S.settings); tapSound(); upd(); });
  $('.mus', scr).addEventListener('click', () => { S.settings.music = !S.settings.music; A.setMusic(S.settings.music); store.saveSettings(S.settings); tapSound(); upd(); });
  for (const b of $$('.tab', scr)) b.addEventListener('click', () => { tapSound(); parentPage(b.dataset.p, back); });
  $('.backb', scr).addEventListener('click', () => { tapSound(); S.parentOpen = false; back(); });
  $('.resetp', scr).addEventListener('click', () => resetConfirm(scr, 'player', pid, back));
  $('.reseta', scr).addEventListener('click', () => resetConfirm(scr, 'all', pid, back));
}
function resetConfirm(scr, kind, pid, back) {
  tapSound();
  const layer = $('.layer', scr);
  const node = el(`<div class="mp reset"><h2>${tp(kind === 'all' ? 'reset_q_all' : 'reset_q_player')}</h2>${kind === 'player' ? `<div class="who">${ANIMALS[pid]}</div>` : ''}<p>${tp('reset_text')}</p>
    <div class="row"><button class="btn alt cancel">${tp('cancel')}</button><button class="btn warn hold"><i class="fill"></i><span>${tp('hold')}</span></button></div></div>`);
  layer.innerHTML = ''; layer.appendChild(node); layer.classList.add('show');
  $('.cancel', node).addEventListener('click', () => { tapSound(); layer.classList.remove('show'); layer.innerHTML = ''; });
  const hold = $('.hold', node); let timer = null;
  const startHold = (e) => {
    e.preventDefault(); try { hold.setPointerCapture(e.pointerId); } catch { /* not supported */ } hold.classList.add('holding');
    timer = setTimeout(async () => {
      if (kind === 'all') { await store.resetAll(); S.settings = await store.loadSettings(today()); await store.saveSettings(S.settings); A.setSound(true); A.setMusic(false); }
      else await store.resetPlayer(pid);
      S.pd = null; S.pid = null; S.parentOpen = false;
      start();
    }, CONFIG.RESET_HOLD_MS);
  };
  const stopHold = () => { hold.classList.remove('holding'); clearTimeout(timer); };
  hold.addEventListener('pointerdown', startHold);
  // Pointer capture keeps the hold alive if the finger wobbles; lifting or cancelling stops it.
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) hold.addEventListener(ev, stopHold);
}
export { safe };
