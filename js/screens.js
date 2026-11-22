// Screens outside a level: start, install tip, player picker, how to play, Season map, level start, Times Map, parent gate and page.
import { CONFIG } from './config.js';
import { S, t, tp, show, el, $, $$, tapOnce, dots, today, Stop, esc } from './ui.js';
import * as A from './audio.js';
import * as store from './store.js';
import { ANIMALS, ICON, broccoli } from './art.js';
import { art } from './artpack.js';
// Painted portrait if the sprite pack has one, else the drawn animal.
const face = (p) => { const a = art([p, 'portrait']); return a ? `<img class="por" src="${a.img.src}" alt="">` : ANIMALS[p]; };
import { factId, parseFact, groupOf } from './facts.js';
import { addDays, daysBetween } from './learn.js';
import { playLevel, loadLevel, fmtTime, fmtTarget } from './game.js';
import { LEVEL_IDS, CHAIN, WORLD_IDS, WORLDS, isBoss, tableOf, worldOf, levelNo } from './levels.js';
import { iconCanvas, foxCanvas } from './render.js';
import { targets } from './config.js';

const tapSound = () => A.play('ui_tap');
export const bossImg = (wd = 'x2', pose = 'idle', cls = 'bimg') => { const a = art(['boss', wd, pose]); return a ? `<img class="${cls}" src="${a.img.src}" alt="">` : broccoli(pose === 'friendly' ? 'laugh' : 'grumpy'); };
const safe = (p) => p.catch((e) => { if (!(e instanceof Stop)) throw e; });
let installPrompt = null;
self.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
const standalone = () => (self.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

// ---- S1 Start ----
export function start() {
  const scr = show('start', `<div class="title"><h1 class="logo">${t('app_name')}</h1><div class="hero"><span class="hfox"></span><span class="hboss">${bossImg()}</span></div>
    <p class="tap">${ICON.play} ${t('start')}</p></div><button class="icon grownup corner" aria-label="${tp('grown_ups')}">${ICON.grownup}</button>`);
  $('.hfox', scr).appendChild(foxCanvas('dance1', 170, 'joy'));
  $('.grownup', scr).addEventListener('click', (e) => { e.stopPropagation(); A.unlock(); parentGate(() => start()); });
  const go = () => { removeEventListener('keydown', key); A.unlock(); A.play('start_jingle'); afterStart(); };
  const key = (e) => { if (S.screen === 'start' && ['Enter', 'Space'].includes(e.code)) { e.preventDefault(); go(); } };
  addEventListener('keydown', key);
  scr.addEventListener('click', go, { once: true });
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
    const s = sums[p]; const best = s && s.scroller && s.scroller.acornsTotal ? `<i class="ac"></i>${s.scroller.acornsTotal}` : '';
    return `<button class="pick" data-p="${p}" aria-label="${t(p)}">${face(p)}<span class="pbest">${best}</span></button>`;
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
// ---- S3 How to play (3 cards) ----
export async function howTo(back) {
  const key = (k) => `<span class="key${k.length > 2 && !k.startsWith('&') ? ' wide' : ''}">${k}</span>`;
  const cards = [
    () => `<h2>${t('how_title')}</h2><div class="howfox"></div><div class="ctl"><div class="ctlrow">${key('&larr;')}${key('&rarr;')}<span>${t('how_move')}</span></div>
      <div class="ctlrow">${key('&uarr;')}${key('Space')}<span>${t('how_jump')}</span></div><p class="small">${t('how_keys')}</p><p class="small">${t('how_touch')}</p><p class="small">${t('tip_jump')}</p></div>`,
    () => `<h2>${t('how_math')}</h2><div class="sign mini">2 x 7</div><div class="baydemo"><span>12</span><span class="ok">14</span><span>16</span></div><p>${t('how_math_1')}</p><p>${t('how_math_2')}</p><p>${t('how_math_3')}</p>`,
    () => `<h2>${t('how_more')}</h2><div class="powdemo"></div><p>${t('how_more_1')}</p><p>${t('how_more_2')}</p><p>${t('how_more_3')}</p>`,
  ];
  for (let i = 0; i < cards.length; i++) {
    const scr = show('howto', `<div class="card big">${cards[i]()}<div class="dotsnav">${cards.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row"><button class="btn go next">${t('next')} ${ICON.next}</button><button class="btn alt skip">${t('skip')}</button></div></div>`);
    if (i === 0) $('.howfox', scr).appendChild(foxCanvas('jump', 110));
    if (i === 2) { const box = $('.powdemo', scr); const pc = art(['monster', 'pinecone']); if (pc) box.appendChild(el(`<img class="mini-mon" src="${pc.img.src}" alt="">`)); for (const k of CONFIG.POWERS) box.appendChild(iconCanvas(k)); }
    const k = (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); $('.next', scr).click(); } };
    addEventListener('keydown', k);
    const b = await safe(tapOnce([$('.next', scr), $('.skip', scr)]));
    removeEventListener('keydown', k);
    if (!b) return;
    tapSound();
    if (b.classList.contains('skip')) break;
  }
  S.pd.progress.howToSeen = true; store.saveProgress(S.pd);
  if (back) return back();
  goHome();
}
// ---- S5 Season map (home) ----
const MEDAL = ['', 'bronze', 'silver', 'gold', 'fox'];
export function goHome(autoLevel) {
  const pd = S.pd, sc = pd.progress.scroller;
  A.startMusic();
  if (autoLevel) return levelStart(autoLevel);
  // v0.4 world map: 9 table worlds in unlock order, then Rainbow. Each card: Level 1, Level 2 and the boss.
  // hotfix: the next thing to play glows (same pick as the Enter quick-start)
  const nextId = sc.unlocked.filter((x) => !(pd.levels[x] && pd.levels[x].medal))[0] || null;
  const node = (id) => {
    const open = sc.unlocked.includes(id), r = pd.levels[id] || {}, boss = isBoss(id);
    const label = boss ? t('boss_node') : t('level_n', { n: levelNo(id) });
    return `<button class="node n-${id} ${boss ? 'nboss' : ''} ${open ? 'open' : 'locked'} ${r.medal ? 'done' : ''} ${id === nextId ? 'next' : ''}" data-l="${id}" ${open ? '' : 'aria-disabled="true"'}>
      ${boss ? bossImg(worldOf(id), r.medal ? 'friendly' : 'idle', 'nimg') : ''}<span class="nm">${label}</span><span class="sub">${t('lv_' + id)}</span>${r.medal && !boss ? `<i class="md m${r.medal}"></i>` : ''}${boss && r.medal ? '<i class="md m3"></i>' : ''}${r.brainStar ? '<i class="bs"></i>' : ''}${open ? '' : '<i class="lock"></i>'}</button>`;
  };
  const cur = worldOf(sc.unlocked[sc.unlocked.length - 1] || 'x2-L1');
  const card = (wd, i) => {
    const far = art(['bg', WORLDS[wd].bg, 'far']), ids = CHAIN.filter((id) => worldOf(id) === wd), open = ids.some((id) => sc.unlocked.includes(id));
    const tb = tableOf(ids[0]);
    return `<div class="world w-${wd} ${open ? 'open' : 'locked'} ${wd === cur ? 'cur' : ''}" data-w="${wd}">${far ? `<img class="wbg" src="${far.img.src}" alt="">` : ''}
      <h2><span class="wn">${i + 1}</span>${t('world_' + wd)} <small>${tb ? t('times_t', { t: tb }) : t('times_all')}</small></h2><div class="path">${ids.map(node).join('')}</div>${open || !i ? '' : `<p class="whint">${t('beat_to_open', { w: t('world_' + WORLD_IDS[i - 1]) })}</p>`}</div>`;
  };
  const scr = show('home', `<div class="topbar"><button class="icon me" aria-label="${t(S.pid)}">${ANIMALS[S.pid]}</button><h1>${t('map_title')}</h1><span class="sp"></span>
      <span class="acorns"><i class="ac"></i>${sc.acornsTotal || 0}</span><button class="icon howbtn" aria-label="?">${ICON.help}</button><button class="icon mapbtn" aria-label="${t('map')}">${ICON.map}</button></div>
    <div class="worlds">${WORLD_IDS.map(card).join('')}</div>
    <button class="icon grownup corner" aria-label="${tp('grown_ups')}">${ICON.grownup}</button>`);
  // hotfix: a mouse wheel scrolls the world row sideways (desktop players could not reach the later worlds with a wheel)
  const wr0 = $('.worlds', scr); wr0.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { wr0.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  const curEl = $('.world.cur', scr); if (curEl) requestAnimationFrame(() => { const wr = $('.worlds', scr); wr.scrollLeft = Math.max(0, curEl.offsetLeft - 12); });
  for (const b of $$('.node.open', scr)) b.addEventListener('click', () => { tapSound(); levelStart(b.dataset.l); });
  for (const b of $$('.node.locked', scr)) b.addEventListener('click', () => { A.play('squeak'); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); });
  const key = (e) => { if (S.screen !== 'home') return removeEventListener('keydown', key); if (['Enter', 'Space'].includes(e.code)) { e.preventDefault(); removeEventListener('keydown', key); const open = sc.unlocked.filter((x) => !(pd.levels[x] && pd.levels[x].medal)); levelStart(open[0] || sc.unlocked[sc.unlocked.length - 1]); } };
  addEventListener('keydown', key);
  $('.mapbtn', scr).addEventListener('click', () => { tapSound(); timesMap(goHome); });
  $('.howbtn', scr).addEventListener('click', () => { tapSound(); howTo(); });
  $('.me', scr).addEventListener('click', () => { tapSound(); picker(); });
  $('.grownup', scr).addEventListener('click', () => { tapSound(); parentGate(goHome); });
}
// ---- S6 Level start ----
export async function levelStart(id) {
  const pd = S.pd, r = pd.levels[id] || {};
  await loadLevel(id);
  const T = targets(id), boss = isBoss(id), wd = worldOf(id), tb = tableOf(id);
  const scr = show('lstart', `<div class="card lst"><p class="small">${t('world_' + wd)} · ${tb ? t('times_t', { t: tb }) : t('times_all')}</p><h1>${boss ? t('boss_name') : t('level_n', { n: levelNo(id) })}</h1><h2>${t('lv_' + id)}</h2>
    ${boss ? `<p>${t('boss_hint')}</p>` : ''}
    ${!boss && r.plays ? `<div class="targets"><span class="md m3"></span>${t('gold_target', { t: fmtTarget(T.gold) })}<span class="md m2"></span>${t('silver_target', { t: fmtTarget(T.silver) })}</div><p class="small">${t('best')}: ${r.bestSteps ? fmtTime(r.bestSteps) : '-'}</p>` : !boss ? `<p class="small">${t('first_play')}</p>` : ''}
    <div class="row"><button class="btn alt backb">${t('back')}</button><button class="btn go huge play">${ICON.play} ${t('play')}</button></div></div>`);
  const go = () => { removeEventListener('keydown', key); tapSound(); run(id); };
  const key = (e) => { if (S.screen !== 'lstart') return removeEventListener('keydown', key); if (['Enter', 'Space'].includes(e.code)) { e.preventDefault(); go(); } };
  addEventListener('keydown', key);
  $('.play', scr).addEventListener('click', go, { once: true });
  $('.backb', scr).addEventListener('click', () => { removeEventListener('keydown', key); tapSound(); goHome(); });
}
function run(id) { playLevel(id, { exit: (nx) => (nx ? levelStart(nx) : goHome()), again: () => run(id) }); }
// ---- S12 Times Map (1 to 10) ----
export function mapGrid(pd, { readOnly = false } = {}) {
  let h = '<div class="grid g10"><i class="hd">x</i>';
  for (let c = 1; c <= 10; c++) h += `<i class="hd">${c}</i>`;
  for (let r = 1; r <= 10; r++) {
    h += `<i class="hd">${r}</i>`;
    for (let c = 1; c <= 10; c++) {
      const id = factId(r, c), f = pd.facts[id];
      const tier = f ? f.tier : 'grey';
      const icon = tier === 'gold' ? ICON.star : tier === 'silver' ? '<b></b><b></b>' : tier === 'bronze' ? '<b></b>' : '';
      const w1 = r === 2 || c === 2;
      h += `<${readOnly ? 'span' : 'button'} class="cell t-${tier} ${w1 ? 'w1' : 'w0'}" data-r="${r}" data-c="${c}" aria-label="${r} x ${c}">${icon}</${readOnly ? 'span' : 'button'}>`;
    }
  }
  return h + '</div>';
}
export function timesMap(back) {
  const pd = S.pd;
  const scr = show('map', `<div class="topbar"><button class="icon backb" aria-label="${t('back')}">${ICON.back}</button><h1>${t('map')}</h1></div>
    <div class="mapwrap">${mapGrid(pd)}<div class="key"><span class="cell t-grey w1"></span>${t('tier_grey')}<span class="cell t-bronze"><b></b></span>${t('tier_bronze')}
    <span class="cell t-silver"><b></b><b></b></span>${t('tier_silver')}<span class="cell t-gold">${ICON.star}</span>${t('tier_gold')}</div></div><div class="layer"></div>`);
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
  $('.mpic', node).appendChild(dots(r, c, { max: 240, maxH: 160 }));
  $('.sl', node).textContent = met ? strategyLine(r, c) : '';
  layer.innerHTML = ''; layer.appendChild(node); layer.classList.add('show');
  $('.go', node).addEventListener('click', () => { tapSound(); layer.classList.remove('show'); layer.innerHTML = ''; });
}
// ---- S14 Parent gate ----
const rand = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
export function parentGate(back) {
  const qs = S.strings.parent_gate;
  let wrong = 0, q = qs[rand(qs.length)], typed = '';
  const scr = show('pgate', `<div class="card"><h2>${ICON.grownup} ${tp('grown_ups')}</h2><p class="pq"></p><div class="typed" aria-live="polite"></div><p class="tryagain hidden">${tp('try_again')}</p>
    <div class="gatepad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="k" data-k="${n}">${n}</button>`).join('')}<button class="k" data-k="del" aria-label="delete">${ICON.back}</button><button class="k" data-k="0">0</button><button class="k ok" data-k="ok">${tp('ok')}</button></div>
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
  const sc = pd.progress.scroller, lastRun = (pd.history || []).filter((h) => h.level).slice(-1)[0];
  const where = lastRun ? tp('last_run', { name: t('lv_' + lastRun.level), r: lastRun.right, w: lastRun.notYet }) : tp('no_runs');
  const lvRows = CHAIN.filter((id) => pd.levels[id]).map((id) => { const r = pd.levels[id]; return `<li>${esc(tp('level_row', { name: t('lv_' + id), best: r.bestSteps ? fmtTime(r.bestSteps) : '-', medal: tp('medal_' + (r.medal || 0)), plays: r.plays || 0 }))}</li>`; }).join('');
  const tricky = trickiest(pd, d);
  let idea = tricky.length ? ideaFor(tricky[0].id) : null;
  if (!idea) { const learn = pd.attempts.slice().reverse().find((a) => pd.facts[a.factId] && pd.facts[a.factId].box <= 2); idea = learn ? ideaFor(learn.factId) : [tp('no_idea')]; }
  const tabs = CONFIG.PLAYERS.map((p) => `<button class="tab ${p === pid ? 'on' : ''}" data-p="${p}" aria-label="${t(p)}">${ANIMALS[p]}</button>`).join('');
  const scr = show('parent', `<div class="topbar"><button class="icon backb" aria-label="${tp('back')}">${ICON.back}</button><h1>${tp('parent_page')}</h1></div>
    <div class="ptext"><div class="tabs"><span>${tp('player')}</span>${tabs}</div>
    <p>${esc(where)}</p><h3>${tp('levels')}</h3>${lvRows ? `<ul>${lvRows}</ul>` : `<p>${tp('no_levels')}</p>`}${Object.values(sc.l1Missed || {}).flat().length ? `<p>${esc(tp('missed_list', { list: Object.values(sc.l1Missed).flat().map((id) => { const [a, b] = parseFact(id); return `${a} x ${b}`; }).join(', ') }))}</p>` : ''}<p>${tp('week', { n: Math.round(secs / 60) })}</p>
    <h3>${tp('map')}</h3><div class="minimap">${mapGrid(pd, { readOnly: true })}</div>
    <h3>${tp('tricky')}</h3>${tricky.length ? `<ol>${tricky.map((x) => { const [a, b] = parseFact(x.id); return `<li>${a} x ${b} - ${esc(mixText(x))}</li>`; }).join('')}</ol>` : `<p>${tp('no_tricky')}</p>`}
    ${idea.map((l) => `<p class="idea">${esc(l)}</p>`).join('')}
    <div class="toggles"><button class="btn alt tog jh">${tp('jump_help')} <b></b></button><button class="btn alt tog snd">${ICON.speaker} ${tp('sound')} <b></b></button><button class="btn alt tog mus">${ICON.note} ${tp('music')} <b></b></button></div>
    <p class="small">${tp('jump_help_note')}</p><p class="priv">${tp('privacy_1')}<br>${tp('privacy_2')}</p>
    <div class="row"><button class="btn warn resetp">${tp('reset_player')}</button><button class="btn warn reseta">${tp('reset_all')}</button></div>
    <p class="ver">${tp('version', { v: CONFIG.VERSION })}</p></div><div class="layer"></div>`);
  $('.jh', scr).addEventListener('click', () => { tapSound(); sc.jumpHelp = !sc.jumpHelp; store.saveProgress(pd); upd(); });
  const upd = () => { $('.jh b', scr).textContent = sc.jumpHelp ? tp('on') : tp('off'); $('.snd b', scr).textContent = S.settings.sound ? tp('on') : tp('off'); $('.mus b', scr).textContent = S.settings.music ? tp('on') : tp('off'); };
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
