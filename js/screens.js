// Screens outside a level: start, install tip, player picker, how to play, Season map, level start, Times Map, parent gate and page.
import { CONFIG } from './config.js';
import { S, t, tp, show, el, $, $$, tapOnce, dots, today, Stop, esc, fx, lang, loadStrings, LANGS } from './ui.js';
import { warmupDue, warmupForm, keepForm, addWarmup, thenVsNow, reportCsv, WU_N } from './warmup.js';
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
import { setCalm, calmOf, testAll, canPlay } from './player.js';
import { partsFound, partsMax, worldGold, worldBeaten, PART_WORLDS, shareDoor, addSticker, SHARE_TABLES } from './b2.js';

const tapSound = () => A.play('ui_tap');
export const bossImg = (wd = 'x2', pose = 'idle', cls = 'bimg') => { const a = art(['boss', wd, pose]); return a ? `<img class="${cls}" src="${a.img.src}" alt="">` : broccoli(pose === 'friendly' ? 'laugh' : 'grumpy'); };
const safe = (p) => p.catch((e) => { if (!(e instanceof Stop)) throw e; });
let installPrompt = null;
self.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
const standalone = () => (self.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

// ---- S1 Start ----
export function start() {
  const scr = show('start', `<div class="title"><h1 class="logo">${t('app_name')}</h1><div class="hero"><span class="hfox"></span><span class="hboss">${bossImg()}</span></div>
    <p class="tap">${ICON.play} ${t('start')}</p></div><button class="icon grownup corner" aria-label="${tp('grown_ups')}">${ICON.grownup}</button>
    <button class="btn alt langb" lang="${lang() === 'de' ? 'en' : 'de'}" aria-label="${t('lang')}: ${t('lang_other')}">${t('lang_other')}</button>`);
  $('.langb', scr).addEventListener('click', async (e) => { e.stopPropagation(); removeEventListener('keydown', key); A.unlock(); tapSound(); await setLang(lang() === 'de' ? 'en' : 'de'); start(); });
  $('.hfox', scr).appendChild(foxCanvas('dance1', 170, 'joy'));
  $('.grownup', scr).addEventListener('click', (e) => { e.stopPropagation(); A.unlock(); parentGate(() => start()); });
  const go = () => { removeEventListener('keydown', key); A.unlock(); A.play('start_jingle'); afterStart(); };
  const key = (e) => { if (S.screen === 'start' && ['Enter', 'Space'].includes(e.code)) { e.preventDefault(); go(); } };
  addEventListener('keydown', key);
  scr.addEventListener('click', go, { once: true });
  // v0.5a: 1-tap Continue for the last player: straight into their next level (no picker, no map, no level card)
  const lp = S.settings && S.settings.lastPlayer;
  if (lp && CONFIG.PLAYERS.includes(lp)) store.playerSummaries().then((sums) => {
    const s = sums[lp]; if (!s || !s.scroller || S.screen !== 'start') return;
    const b = el(`<button class="btn go huge cont" aria-label="${t('continue')}">${ICON.play} ${t('continue')} <span class="cwho">${face(lp)}</span></button>`);
    $('.title', scr).appendChild(b);
    b.addEventListener('click', async (e) => {
      e.stopPropagation(); removeEventListener('keydown', key); A.unlock(); tapSound();
      S.pid = lp; S.pd = await store.loadPlayer(lp); store.pruneAttempts(lp); A.setCalm(calmOf(S.pd.progress.scroller));
      if (!S.pd.progress.howToSeen) return howTo();
      A.stopMusic(); run(nextOf(S.pd));
    });
  }).catch(() => { /* the normal start still works */ });
}
// The next thing to play: the first open node without a medal, else the newest open node (same pick as the map glow).
const earnedMedal = (r) => !!(r && r.medal && !r.testOnly); // test-open plays do not count for the next pick
export function nextOf(pd) { const sc = pd.progress.scroller; return sc.unlocked.filter((x) => !earnedMedal(pd.levels[x]))[0] || sc.unlocked[sc.unlocked.length - 1] || 'x2-L1'; }
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
  A.setCalm(calmOf(S.pd.progress.scroller));
  if (!S.pd.progress.howToSeen) return howTo();
  goHome();
}
// ---- S3 How to play (3 cards) ----
export async function howTo(back) {
  const key = (k) => `<span class="key${k.length > 2 && !k.startsWith('&') ? ' wide' : ''}">${k}</span>`;
  const cards = [
    () => `<h2>${t('how_title')}</h2><div class="howfox"></div><div class="ctl"><div class="ctlrow">${key('&larr;')}${key('&rarr;')}<span>${t('how_move')}</span></div>
      <div class="ctlrow">${key('&uarr;')}${key(esc(t('key_space')))}<span>${t('how_jump')}</span></div><p class="small">${t('how_keys')}</p><p class="small">${t('how_touch')}</p><p class="small">${t('tip_jump')}</p></div>`,
    () => `<h2>${t('how_math')}</h2><div class="sign mini">${fx(2, 7)}</div><div class="baydemo"><span>12</span><span class="ok">14</span><span>16</span></div><p>${t('how_math_1')}</p><p>${t('how_math_2')}</p><p>${t('how_math_3')}</p>`,
    () => `<h2>${t('how_moves')}</h2><div class="ctl"><div class="ctlrow">${key('&uarr;')}${key('&uarr;')}<span>${t('how_dj')}</span></div>
      <div class="ctlrow">${key(esc(t('key_hold')))}<span>${t('how_glide')}</span></div><div class="ctlrow">${key('&darr;')}<span>${t('how_slide')}</span></div><p class="small">${t('how_moves_touch')}</p></div>`,
    () => `<h2>${t('how_more')}</h2><div class="powdemo"></div><p>${t('how_more_1')}</p><p>${t('how_more_2')}</p><p>${t('how_more_3')}</p>`,
  ];
  for (let i = 0; i < cards.length; i++) {
    const scr = show('howto', `<div class="card big">${cards[i]()}<div class="dotsnav">${cards.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row"><button class="btn go next">${t('next')} ${ICON.next}</button><button class="btn alt skip">${t('skip')}</button></div></div>`);
    if (i === 0) $('.howfox', scr).appendChild(foxCanvas('jump', 110));
    if (i === 3) { const box = $('.powdemo', scr); const pc = art(['bad', 'bee', 'move1']) || art(['monster', 'pinecone']); if (pc) box.appendChild(el(`<img class="mini-mon" src="${pc.img.src}" alt="">`)); for (const k of CONFIG.POWERS) box.appendChild(iconCanvas(k)); }
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
// v0.5b2 shuttle parts on the world card: "Parts: 4 of 6." and a hint, or "It is gold!"
function partsLine(pd, wd) { const n = partsFound(pd, wd), m = partsMax(wd), pa = art(['part', wd]);
  return `<p class="wparts">${pa ? `<img class="wpimg ${n >= m ? 'gold' : ''}" src="${pa.img.src}" alt="">` : ''}<span>${t('parts_n', { n, m })} ${n >= m ? t('part_is_gold') : t('parts_more')}</span></p>`; }
export function goHome(autoLevel) {
  const pd = S.pd, sc = pd.progress.scroller;
  A.startMusic();
  if (autoLevel) return levelStart(autoLevel);
  // v0.4 world map: 9 table worlds in unlock order, then Rainbow. Each card: Level 1, Level 2 and the boss.
  // hotfix: the next thing to play glows (same pick as the Enter quick-start)
  const nextId = sc.unlocked.filter((x) => !earnedMedal(pd.levels[x]))[0] || null, playId = nextOf(pd), TA = testAll();
  const node = (id) => {
    const open = canPlay(sc, id), real = sc.unlocked.includes(id), r = pd.levels[id] || {}, boss = isBoss(id);
    const label = boss ? t('boss_node') : t('level_n', { n: levelNo(id) });
    return `<button class="node n-${id} ${boss ? 'nboss' : ''} ${open ? 'open' : 'locked'} ${r.medal ? 'done' : ''} ${id === nextId ? 'next' : ''} ${open && !real ? 'testopen' : ''}" data-l="${id}" ${open ? '' : 'aria-disabled="true"'}>
      ${boss ? bossImg(worldOf(id), r.medal ? 'friendly' : 'idle', 'nimg') : ''}<span class="nm">${label}</span><span class="sub">${t('lv_' + id)}</span>${r.medal && !boss ? `<i class="md m${r.medal}"></i>` : ''}${boss && r.medal ? '<i class="md m3"></i>' : ''}${r.brainStar ? '<i class="bs"></i>' : ''}${open ? '' : '<i class="lock"></i>'}</button>`;
  };
  const cur = worldOf(sc.unlocked[sc.unlocked.length - 1] || 'x2-L1');
  const card = (wd, i) => {
    const far = art(['bg', WORLDS[wd].bg, 'far']), ids = CHAIN.filter((id) => worldOf(id) === wd), open = ids.some((id) => canPlay(sc, id)), realOpen = ids.some((id) => sc.unlocked.includes(id));
    const tb = tableOf(ids[0]);
    // v0.5a simpler map: only the world with the next level is shown big; the others are small (finished or still closed)
    const nextHere = ids.includes(nextId), simple = !nextHere && !(wd === cur && !nextId);
    return `<div class="world w-${wd} ${open ? 'open' : 'locked'} ${wd === cur ? 'cur' : ''} ${simple ? 'mini' : 'focus'} ${open && ids.every((id) => pd.levels[id] && pd.levels[id].medal) ? 'alldone' : ''}" data-w="${wd}">${far ? `<img class="wbg" src="${far.img.src}" alt="">` : ''}
      <h2><span class="wn">${i + 1}</span>${t('world_' + wd)} <small>${tb ? t('times_t', { t: tb }) : t('times_all')}</small></h2><div class="path">${ids.map(node).join('')}</div>${!simple && (open || realOpen) ? partsLine(pd, wd) : ''}${realOpen || TA || !i ? '' : `<p class="whint">${t('beat_to_open', { w: t('world_' + WORLD_IDS[i - 1]) })}</p>`}</div>`;
  };
  const scr = show('home', `<div class="topbar"><button class="icon me" aria-label="${t(S.pid)}">${ANIMALS[S.pid]}</button><h1>${t('map_title')}</h1>${TA ? `<span class="testbadge">${t('test_all')}</span>` : ''}<span class="sp"></span>
      <span class="acorns"><i class="ac"></i>${sc.acornsTotal || 0}</span><button class="icon howbtn" aria-label="${t('help')}">${ICON.help}</button><button class="icon shipbtn" aria-label="${t('shuttle')}">${shipIcon()}</button><button class="icon mapbtn" aria-label="${t('map')}">${ICON.map}</button><button class="icon grownup" aria-label="${tp('grown_ups')}">${ICON.grownup}</button></div>
    <div class="worlds">${WORLD_IDS.map(card).join('')}</div>
    <button class="btn go huge playnext" aria-label="${t('play_next')}">${ICON.play} ${t('play_next')} <small>${t('lv_' + playId)}</small></button>`);
  // hotfix: a mouse wheel scrolls the world row sideways (desktop players could not reach the later worlds with a wheel)
  const wr0 = $('.worlds', scr); wr0.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { wr0.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  $('.playnext', scr).addEventListener('click', () => { removeEventListener('keydown', key); tapSound(); A.stopMusic(); run(playId); }); // straight into play
  const curEl = $('.world.focus', scr) || $('.world.cur', scr); if (curEl) requestAnimationFrame(() => { const wr = $('.worlds', scr); wr.scrollLeft = Math.max(0, curEl.offsetLeft - 12); });
  for (const b of $$('.node.open', scr)) b.addEventListener('click', () => { tapSound(); levelStart(b.dataset.l); });
  for (const b of $$('.node.locked', scr)) b.addEventListener('click', () => { A.play('squeak'); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); });
  const key = (e) => { if (S.screen !== 'home') return removeEventListener('keydown', key); if (['Enter', 'Space'].includes(e.code)) { e.preventDefault(); removeEventListener('keydown', key); levelStart(nextOf(pd)); } };
  addEventListener('keydown', key);
  $('.mapbtn', scr).addEventListener('click', () => { tapSound(); timesMap(goHome); });
  $('.shipbtn', scr).addEventListener('click', () => { removeEventListener('keydown', key); tapSound(); shuttleScreen(goHome); });
  $('.howbtn', scr).addEventListener('click', () => { tapSound(); howTo(); });
  $('.me', scr).addEventListener('click', () => { tapSound(); picker(); });
  $('.grownup', scr).addEventListener('click', () => { tapSound(); parentGate(goHome); });
}
const shipIcon = () => { const a = art(['shuttle', 'full']); return a ? `<img class="shipico" src="${a.img.src}" alt="">` : '&#9650;'; };
// v0.5b2 the shuttle on its launch pad: each world adds its part when its boss is beaten; all 6 parts found = a gold part.
// Share Door stickers sit around the shuttle. Missing parts never block anything.
export function shuttleScreen(back) {
  const pd = S.pd, sh = art(['shuttle', 'full']), st = pd.progress.stickers || [];
  const slots = PART_WORLDS.map((wd) => { const on = worldBeaten(pd, wd), g = worldGold(pd, wd), pa = art(['part', wd]), n = partsFound(pd, wd), m = partsMax(wd);
    return `<div class="pslot ${on ? 'on' : 'off'} ${g ? 'gold' : ''}" data-w="${wd}">${pa ? `<img src="${pa.img.src}" alt="">` : ''}<small>${t('world_' + wd)}</small><b>${t('parts_n', { n, m })}</b></div>`; }).join('');
  const built = PART_WORLDS.filter((wd) => worldBeaten(pd, wd)).length;
  const scr = show('shuttle', `<div class="card shut"><h1>${t('shuttle_title')}</h1><div class="shrow"><div class="shipbox b${built}">${sh ? `<img class="ship ghostship" src="${sh.img.src}" alt=""><img class="ship realship" src="${sh.img.src}" alt="">` : ''}
    <div class="stk">${st.map((wd) => `<span class="sticker s-${wd}">${bossImg(wd, 'friendly', 'stimg')}</span>`).join('')}</div></div><div class="pslots">${slots}</div></div>
    <p class="small">${t('stickers', { n: st.length })} ${t('parts_more')}</p><button class="btn go backb">${t('back')}</button></div>`);
  const go = () => { removeEventListener('keydown', key); tapSound(); back(); };
  const key = (e) => { if (S.screen !== 'shuttle') return removeEventListener('keydown', key); if (['Enter', 'Space', 'Escape'].includes(e.code)) { e.preventDefault(); go(); } };
  addEventListener('keydown', key); $('.backb', scr).addEventListener('click', go, { once: true });
}
// v0.5b2 Share Door (division bonus after a table boss): "? x 8 = 56", then "56 : 8 = ?" with the dots splitting into groups, then the
// fact family. No points, no medal, no timer, outside the unlock chain, never a remainder. The reward is a shuttle sticker.
export function shareDoorScreen(wd, back) {
  const pd = S.pd, q = shareDoor(S.pid || 'fox', wd, today()); if (!q) return back();
  const { n, k, p } = q, mul = (a, b, c) => fx(a, b) + ' = ' + c, div = (a, b, c) => `${a} : ${b} = ${c}`;
  A.play('share_door');
  let stage = 0;
  const scr = show('share', `<div class="card share"><div class="door"><i></i></div><h1>${t('share_door')}</h1><p class="small sdi">${t('sd_intro')}</p>
    <div class="sdq" aria-live="polite"></div><div class="sdots"></div><p class="sdh small"></p><p class="sdtry hidden">${t('sd_try')}</p><div class="sdch row"></div>
    <div class="sdfam hidden"></div><div class="row sdend"><button class="btn alt backb">${t('back')}</button></div></div>`);
  const groups = (heap) => { const box = $('.sdots', scr); box.innerHTML = `<div class="sgroups k${Math.min(k, 5)} ${heap ? 'heap' : ''}">${Array.from({ length: n }, () => `<span class="sg">${'<i></i>'.repeat(k)}</span>`).join('')}</div>`; };
  const ask = (text, hint, choices, right, then) => {
    $('.sdq', scr).textContent = text; $('.sdh', scr).textContent = hint; $('.sdtry', scr).classList.add('hidden');
    const row = $('.sdch', scr); row.innerHTML = choices.map((c) => `<button class="btn alt sdc" data-v="${c}">${c}</button>`).join('');
    for (const b of $$('.sdc', row)) b.addEventListener('click', () => {
      if (+b.dataset.v === right) { A.play('right'); b.classList.add('ok'); for (const x of $$('.sdc', row)) x.disabled = true; setTimeout(then, 700); }
      else { A.play('squeak'); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); $('.sdtry', scr).classList.remove('hidden'); }
    });
    try { $('.sdc', row).focus({ preventScroll: true }); } catch { /* fine */ }
  };
  const step1 = () => { stage = 1; groups(false); ask(mul('?', n, p), t('sd_hint1', { n }), q.choices1, k, step2); };
  const step2 = () => { stage = 2; groups(true); ask(div(p, n, '?'), t('sd_hint2', { p, n }), q.choices2, k, () => { groups(true); requestAnimationFrame(() => requestAnimationFrame(() => $('.sgroups', scr).classList.remove('heap'))); setTimeout(step3, 1300); }); };
  const step3 = () => {
    stage = 3; $('.sdch', scr).innerHTML = ''; $('.sdh', scr).textContent = ''; $('.sdq', scr).textContent = t('sd_family');
    const fam = $('.sdfam', scr); fam.classList.remove('hidden');
    fam.innerHTML = q.family.map(([a, b, c, op]) => `<span>${op === 'x' ? mul(a, b, c) : div(a, b, c)}</span>`).join('');
    const isNew = addSticker(pd, wd); store.saveProgress(pd);
    setTimeout(() => { if (S.screen !== 'share') return; A.play('sticker'); fam.insertAdjacentHTML('afterend', `<p class="sdstk"><span class="sticker">${bossImg(wd, 'friendly', 'stimg')}</span>${t(isNew ? 'sd_sticker' : 'sd_sticker_again')}</p>`); $('.sdend', scr).innerHTML = `<button class="btn go donebtn">${t('sd_done')}</button>`; $('.donebtn', scr).addEventListener('click', () => { tapSound(); back(); }, { once: true }); try { $('.donebtn', scr).focus(); } catch { /* fine */ } }, 900);
  };
  $('.backb', scr).addEventListener('click', () => { tapSound(); back(); }, { once: true });
  setTimeout(step1, 600);
  return () => stage;
}
// ---- S6 Level start ----
export async function levelStart(id) {
  const pd = S.pd, r = pd.levels[id] || {};
  await loadLevel(id);
  const T = targets(id), boss = isBoss(id), wd = worldOf(id), tb = tableOf(id);
  const scr = show('lstart', `<div class="card lst"><p class="small">${t('world_' + wd)} – ${tb ? t('times_t', { t: tb }) : t('times_all')}</p><h1>${boss ? t('boss_name') : t('level_n', { n: levelNo(id) })}</h1><h2>${t('lv_' + id)}</h2>
    ${boss ? `<p>${t('boss_hint')}</p>` : ''}
    ${!boss && r.plays ? `<div class="targets"><span class="md m3"></span>${t('gold_target', { t: fmtTarget(T.gold) })}<span class="md m2"></span>${t('silver_target', { t: fmtTarget(T.silver) })}</div><p class="small">${t('best')}: ${r.bestSteps ? fmtTime(r.bestSteps) : '-'}</p>` : !boss ? `<p class="small">${t('first_play')}</p>` : ''}
    <div class="row"><button class="btn alt backb">${t('back')}</button><button class="btn go huge play">${ICON.play} ${t('play')}</button></div></div>`);
  const go = () => { removeEventListener('keydown', key); tapSound(); run(id); };
  const key = (e) => { if (S.screen !== 'lstart') return removeEventListener('keydown', key); if (['Enter', 'Space'].includes(e.code)) { e.preventDefault(); go(); } };
  addEventListener('keydown', key);
  $('.play', scr).addEventListener('click', go, { once: true });
  $('.backb', scr).addEventListener('click', () => { removeEventListener('keydown', key); tapSound(); goHome(); });
}
// v0.5a: "Next level" on the results goes straight into play (no level card in between)
function run(id) { const k = S.pd && warmupDue(S.pd, today()); if (k) return warmup(k, () => play(id)); play(id); }
function play(id) { playLevel(id, { exit: (nx) => (nx ? run(nx) : home()), again: () => play(id) }); }
// back to the map; after a boss win this is where the mid / post / 7-day warm-up is offered (v0.5b1)
function home() { const k = S.pd && warmupDue(S.pd, today(), { after: true }); if (k) return warmup(k, () => goHome()); goHome(); }
// ---- S12 Times Map (1 to 10) ----
export function mapGrid(pd, { readOnly = false } = {}) {
  let h = `<div class="grid g10"><i class="hd">${esc(t('times_sign'))}</i>`;
  for (let c = 1; c <= 10; c++) h += `<i class="hd">${c}</i>`;
  for (let r = 1; r <= 10; r++) {
    h += `<i class="hd">${r}</i>`;
    for (let c = 1; c <= 10; c++) {
      const id = factId(r, c), f = pd.facts[id];
      const tier = f ? f.tier : 'grey';
      const icon = tier === 'gold' ? ICON.star : tier === 'silver' ? '<b></b><b></b>' : tier === 'bronze' ? '<b></b>' : '';
      const w1 = r === 2 || c === 2;
      h += `<${readOnly ? 'span' : 'button'} class="cell t-${tier} ${w1 ? 'w1' : 'w0'}" data-r="${r}" data-c="${c}" aria-label="${fx(r, c)}">${icon}</${readOnly ? 'span' : 'button'}>`;
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
  $('h2', node).textContent = met ? `${t('fact', { a: r, b: c, c: r * c })} – ${t('tier_' + f.tier)}` : `${t('fact_q', { a: r, b: c })} – ${t('coming_soon')}`;
  $('.mpic', node).appendChild(dots(r, c, { max: 240, maxH: 160 }));
  $('.sl', node).textContent = met ? strategyLine(r, c) : '';
  layer.innerHTML = ''; layer.appendChild(node); layer.classList.add('show');
  $('.go', node).addEventListener('click', () => { tapSound(); layer.classList.remove('show'); layer.innerHTML = ''; });
}
// ---- S14 Parent gate ----
const rand = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
// ---- v0.5b1 Brain Warm-up: 12 typed facts, no timer and no score shown; skippable; results stay on the device ----
export function warmup(kind, next) {
  const pd = S.pd, d = today();
  A.stopMusic();
  const scr = show('warmup', `<div class="card wu"><h1>${t('wu_title')}</h1><div class="wufox"></div><p>${t('wu_intro')}</p><p class="small">${t('wu_intro_2')}</p>
    <div class="row"><button class="btn alt later">${t('wu_later')}</button><button class="btn go huge wstart">${ICON.play} ${t('wu_start')}</button></div></div>`);
  $('.wufox', scr).appendChild(foxCanvas('dance1', innerHeight < 520 ? 80 : 120, 'joy'));
  const key = (e) => { if (S.screen !== 'warmup') return removeEventListener('keydown', key); if (['Enter', 'Space'].includes(e.code)) { e.preventDefault(); begin(); } };
  addEventListener('keydown', key);
  const skip = () => { removeEventListener('keydown', key); tapSound(); addWarmup(pd, { kind, day: d, at: Date.now(), skipped: true, items: [] }); store.saveProgress(pd); next(); };
  const begin = () => { removeEventListener('keydown', key); tapSound(); warmupRun(kind, next); };
  $('.later', scr).addEventListener('click', skip, { once: true });
  $('.wstart', scr).addEventListener('click', begin, { once: true });
}
function warmupRun(kind, next) {
  const pd = S.pd, d = today(), n0 = (pd.progress.warmups || []).filter((w) => w.kind === kind).length;
  const post = (pd.progress.warmups || []).filter((w) => w.kind === 'post' && !w.skipped).pop();
  const items = kind === 'keep' ? keepForm(pd.pid || S.pid, post, n0) : warmupForm(pd.pid || S.pid, kind, n0), out = [];
  let i = 0, typed = '', t0 = 0;
  const scr = show('warmup', `<div class="wuq"><div class="wul"><p class="wucount"></p><div class="wudots">${items.map(() => '<i></i>').join('')}</div><p class="wufact"></p><div class="typed wutyped" aria-live="polite"></div></div>
    <div class="gatepad wupad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => `<button class="k" data-k="${v}">${v}</button>`).join('')}<button class="k" data-k="del" aria-label="${t('wu_del')}">${ICON.back}</button><button class="k" data-k="0">0</button><button class="k ok" data-k="ok">${t('ok')}</button></div>
    <div class="wubtns"><button class="btn alt small wudunno" data-k="dunno">${t('wu_dunno')}</button><button class="btn alt small wustop">${t('wu_stop')}</button></div></div>`);
  const showQ = () => {
    const q = items[i]; typed = ''; t0 = performance.now();
    $('.wucount', scr).textContent = t('wu_count', { n: i + 1, m: items.length });
    $('.wufact', scr).textContent = t('wu_q', { f: fx(q.a, q.b) }); $('.wutyped', scr).textContent = '';
    $$('.wudots i', scr).forEach((x, j) => x.classList.toggle('on', j < i));
  };
  const done = (stopped) => {
    removeEventListener('keydown', key);
    addWarmup(pd, { kind, day: d, at: Date.now(), items: out, ...(stopped ? { skipped: true } : {}) }); store.saveProgress(pd);
    if (stopped) return next();
    A.play('leg');
    const s2 = show('warmup', `<div class="card wu wuend"><h1>${t('wu_thanks')}</h1><div class="wufox"></div><button class="btn go huge wgo">${ICON.play} ${t('wu_go')}</button></div>`);
    $('.wufox', s2).appendChild(foxCanvas('dance1', innerHeight < 520 ? 90 : 140, 'joy'));
    const k2 = (e) => { if (S.screen !== 'warmup') return removeEventListener('keydown', k2); if (['Enter', 'Space'].includes(e.code)) { e.preventDefault(); go(); } };
    const go = () => { removeEventListener('keydown', k2); tapSound(); next(); };
    setTimeout(() => addEventListener('keydown', k2), 300);
    $('.wgo', s2).addEventListener('click', go, { once: true });
  };
  const press = (v) => {
    if (S.screen !== 'warmup') return;
    if (v === 'del') typed = typed.slice(0, -1);
    else if (v === 'ok' || v === 'dunno') {
      if (v === 'ok' && !typed) return;
      const q = items[i], ms = Math.round(performance.now() - t0), first = i === 0 ? { noTime: true } : {}; // the first item's time does not count
      out.push(v === 'dunno' ? { id: q.id, a: q.a, b: q.b, typed: null, right: false, dunno: true, ms, ...first } : { id: q.id, a: q.a, b: q.b, typed: +typed, right: +typed === q.a * q.b, ms, ...first });
      A.play('ui_tap'); i++; // the same soft tap for every answer: no right/wrong shown to the child
      return i >= items.length ? done(false) : showQ();
    } else if (typed.length < 3) typed += v;
    $('.wutyped', scr).textContent = typed;
  };
  for (const k of $$('.k, .wudunno', scr)) k.addEventListener('click', () => press(k.dataset.k));
  const key = (e) => {
    if (S.screen !== 'warmup') return removeEventListener('keydown', key);
    if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); else if (e.key === 'Enter') { e.preventDefault(); press('ok'); }
  };
  addEventListener('keydown', key);
  $('.wustop', scr).addEventListener('click', () => { tapSound(); done(true); });
  showQ();
}
// v0.5b1 language switch (English / Deutsch): a device setting, kept in the settings record.
export async function setLang(l) {
  S.settings.lang = LANGS.includes(l) ? l : 'en'; store.saveSettings(S.settings);
  await loadStrings(S.settings.lang);
  for (const n of document.querySelectorAll('[data-s]')) n.textContent = S.strings.kid[n.dataset.s];
}
// v0.5 B2 (German review M3): 12 questions with 12 different answers; after 3 misses the gate waits 60 s (also after re-opening).
export const GATE_WAIT_S = 60;
const gateLock = () => { try { return +localStorage.getItem('ts-gate-lock') || 0; } catch { return S.gateLock || 0; } };
const setGateLock = (v) => { S.gateLock = v; try { localStorage.setItem('ts-gate-lock', String(v)); } catch { /* memory only */ } };
export function parentGate(back) {
  const qs = S.strings.parent_gate;
  let wrong = 0, q = qs[rand(qs.length)], typed = '';
  const scr = show('pgate', `<div class="card"><h2>${ICON.grownup} ${tp('grown_ups')}</h2><p class="pq"></p><div class="typed" aria-live="polite"></div><p class="tryagain hidden">${tp('try_again')}</p>
    <div class="gatepad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="k" data-k="${n}">${n}</button>`).join('')}<button class="k" data-k="del" aria-label="${tp('del')}">${ICON.back}</button><button class="k" data-k="0">0</button><button class="k ok" data-k="ok">${tp('ok')}</button></div>
    <button class="btn alt backb">${tp('back')}</button></div>`);
  const setQ = () => { $('.pq', scr).textContent = `${tp('gate_type')} ${q[0]}.`; typed = ''; $('.typed', scr).textContent = ''; };
  let lockT = null, wasLocked = false;
  const lockView = () => {
    const left = Math.ceil((gateLock() - Date.now()) / 1000);
    scr.classList.toggle('locked', left > 0); for (const k of $$('.k', scr)) k.disabled = left > 0;
    if (left > 0) { wasLocked = true; $('.pq', scr).textContent = tp('gate_wait', { s: left }); $('.typed', scr).textContent = ''; $('.tryagain', scr).classList.add('hidden'); clearTimeout(lockT); lockT = setTimeout(() => { if (S.screen === 'pgate') lockView(); }, 1000); }
    else if (wasLocked) { wasLocked = false; setQ(); }
  };
  setQ(); lockView();
  for (const k of $$('.k', scr)) k.addEventListener('click', () => {
    tapSound(); const v = k.dataset.k; if (gateLock() > Date.now()) return;
    if (v === 'del') typed = typed.slice(0, -1);
    else if (v === 'ok') {
      if (+typed === q[1] && typed !== '') { S.parentOpen = true; return parentPage(S.pid || 'fox', back); }
      wrong++; if (wrong >= 3) { setGateLock(Date.now() + GATE_WAIT_S * 1000); wrong = 0; lockView(); return; }
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
  if (d.type === 'ADJ') return tp('mix_neighbour', { v, f: fx(v / b, b) });
  if (d.type === 'OBF') return tp('mix_neighbour', { v, f: fx(a, v / a) });
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
// v0.5b1 parent "Then vs now" panel (academic review 3.3): first vs latest warm-up, fluent facts then vs now, kept after 7 days.
function tvnHtml(pd) {
  const v = thenVsNow(pd);
  if (!v) return `<p>${tp('tvn_none')}</p>`;
  const dd = (d) => (lang() === 'de' && d ? d.split('-').reverse().join('.') : d); // Swiss date format in German
  v.first.day = dd(v.first.day); v.last.day = dd(v.last.day);
  const L = [tp('tvn_first', { day: v.first.day, r: v.first.right, n: v.first.n, f: v.first.fast })];
  if (v.count > 1) L.push(tp('tvn_last', { day: v.last.day, r: v.last.right, n: v.last.n, f: v.last.fast }));
  L.push(tp('tvn_fluent', { a: v.fluentThen, b: v.fluentNow, n: v.total }));
  L.push(v.kept ? tp('tvn_kept', v.kept) : v.post ? tp('tvn_kept_wait', { day: dd(addDays(v.post, 7)) }) : tp('tvn_kept_later'));
  return `<ul class="tvnl">${L.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="small">${tp('tvn_fluent_note')}</p>`;
}
function mondayOf(d) { const [y, m, dd] = d.split('-').map(Number); const wd = (new Date(y, m - 1, dd).getDay() + 6) % 7; return addDays(d, -wd); }
export async function parentPage(pid, back) {
  const pd = pid === S.pid && S.pd ? S.pd : await store.loadPlayer(pid);
  const play = await store.playtimeFor(pid);
  const d = today(), mon = mondayOf(d);
  const secs = Object.entries(play).filter(([day]) => day >= mon && day <= d).reduce((s, [, v]) => s + v, 0) + (pid === S.pid ? S.unsaved || 0 : 0);
  const sc = pd.progress.scroller, lastRun = (pd.history || []).filter((h) => h.level).slice(-1)[0];
  const where = lastRun ? tp('last_run', { name: t('lv_' + lastRun.level), r: lastRun.right, w: lastRun.notYet }) : Object.keys(pd.levels || {}).length ? '' : tp('no_runs');
  const lvRows = CHAIN.filter((id) => pd.levels[id]).map((id) => { const r = pd.levels[id]; return `<li>${esc(tp('level_row', { name: t('lv_' + id), best: r.bestSteps ? fmtTime(r.bestSteps) : '-', medal: tp('medal_' + (r.medal || 0)), plays: r.plays || 0 }))}</li>`; }).join('');
  const tricky = trickiest(pd, d);
  let idea = tricky.length ? ideaFor(tricky[0].id) : null;
  if (!idea) { const learn = pd.attempts.slice().reverse().find((a) => pd.facts[a.factId] && pd.facts[a.factId].box <= 2); idea = learn ? ideaFor(learn.factId) : [tp('no_idea')]; }
  const tabs = CONFIG.PLAYERS.map((p) => `<button class="tab ${p === pid ? 'on' : ''}" data-p="${p}" aria-label="${t(p)}">${ANIMALS[p]}</button>`).join('');
  const scr = show('parent', `<div class="topbar"><button class="icon backb" aria-label="${tp('back')}">${ICON.back}</button><h1>${tp('parent_page')}</h1></div>
    <div class="ptext"><div class="tabs"><span>${tp('player')}</span>${tabs}</div>
    ${where ? `<p>${esc(where)}</p>` : ''}<h3>${tp('levels')}</h3>${lvRows ? `<ul>${lvRows}</ul>` : `<p>${tp('no_levels')}</p>`}${Object.values(sc.l1Missed || {}).flat().length ? `<p>${esc(tp('missed_list', { list: Object.values(sc.l1Missed).flat().map((id) => { const [a, b] = parseFact(id); return fx(a, b); }).join(', ') }))}</p>` : ''}<p>${tp('week', { n: Math.round(secs / 60) })}</p>
    <h3>${tp('map')}</h3><div class="minimap">${mapGrid(pd, { readOnly: true })}</div>
    <h3>${tp('tricky')}</h3>${tricky.length ? `<ol>${tricky.map((x) => { const [a, b] = parseFact(x.id); return `<li>${fx(a, b)} - ${esc(mixText(x))}</li>`; }).join('')}</ol>` : `<p>${tp('no_tricky')}</p>`}
    ${idea.map((l) => `<p class="idea">${esc(l)}</p>`).join('')}
    <section class="tvn"><h3>${tp('tvn_title')}</h3>${tvnHtml(pd)}<p class="small">${tp('tvn_note')}</p><p class="small">${tp('warmup_info')}</p>
    ${(pd.progress.warmups || []).length ? `<button class="btn alt small savecsv">${tp('tvn_save')}</button><p class="small saved hidden">${tp('tvn_saved')}</p>` : ''}</section>
    <h3>${tp('language')}</h3><div class="toggles langs">${LANGS.map((l) => `<button class="btn alt tog lg ${lang() === l ? 'on' : ''}" data-l="${l}" lang="${l}">${tp('lang_' + l)}</button>`).join('')}</div>
    <div class="toggles"><button class="btn alt tog jh">${tp('jump_help')} <b></b></button><button class="btn alt tog snd">${ICON.speaker} ${tp('sound')} <b></b></button><button class="btn alt tog mus">${ICON.note} ${tp('music')} <b></b></button></div>
    <p class="small">${tp('jump_help_note')}</p>
    <h3>${tp('hard_mode')}</h3><div class="toggles"><button class="btn alt tog hardb">${tp('hard_mode')} <b></b></button></div><p class="small">${tp('hard_note')}</p>
    <h3>${tp('calm_mode')}</h3><div class="toggles"><button class="btn alt tog calmb">${tp('calm_mode')} <b></b></button></div><p class="small">${tp('calm_note')}</p>
    <div class="toggles calmset">${[['calmNoShake', 'calm_shake'], ['calmFewFx', 'calm_fx'], ['calmSoft', 'calm_soft'], ['calmNoMusic', 'calm_music'], ['calmSlow', 'calm_slow'], ['timerVisible', 'timer_show']].map(([k, s]) => `<button class="btn alt tog small ck" data-k="${k}">${tp(s)} <b></b></button>`).join('')}</div>
    <p class="priv">${tp('privacy_1')}<br>${tp('privacy_2')}</p>
    <div class="row"><button class="btn warn resetp">${tp('reset_player')}</button><button class="btn warn reseta">${tp('reset_all')}</button></div>
    <p class="ver">${tp('version', { v: CONFIG.VERSION })}</p></div><div class="layer"></div>`);
  $('.jh', scr).addEventListener('click', () => { tapSound(); sc.jumpHelp = !sc.jumpHelp; store.saveProgress(pd); upd(); });
  $('.hardb', scr).addEventListener('click', () => { tapSound(); sc.hardMode = !sc.hardMode; store.saveProgress(pd); upd(); });
  $('.calmb', scr).addEventListener('click', () => { tapSound(); setCalm(sc, !sc.calm); store.saveProgress(pd); if (pid === S.pid) A.setCalm(calmOf(sc)); upd(); });
  for (const b of $$('.ck', scr)) b.addEventListener('click', () => { tapSound(); sc[b.dataset.k] = !sc[b.dataset.k]; store.saveProgress(pd); if (pid === S.pid) A.setCalm(calmOf(sc)); upd(); });
  const upd = () => { $('.jh b', scr).textContent = sc.jumpHelp ? tp('on') : tp('off'); $('.hardb b', scr).textContent = sc.hardMode ? tp('on') : tp('off'); $('.calmb b', scr).textContent = sc.calm ? tp('on') : tp('off');
    for (const b of $$('.ck', scr)) b.querySelector('b').textContent = sc[b.dataset.k] ? tp('on') : tp('off'); $('.snd b', scr).textContent = S.settings.sound ? tp('on') : tp('off'); $('.mus b', scr).textContent = S.settings.music ? tp('on') : tp('off'); };
  upd();
  $('.snd', scr).addEventListener('click', () => { S.settings.sound = !S.settings.sound; A.setSound(S.settings.sound); store.saveSettings(S.settings); tapSound(); upd(); });
  $('.mus', scr).addEventListener('click', () => { S.settings.music = !S.settings.music; A.setMusic(S.settings.music); store.saveSettings(S.settings); tapSound(); upd(); });
  for (const b of $$('.tab', scr)) b.addEventListener('click', () => { tapSound(); parentPage(b.dataset.p, back); });
  $('.backb', scr).addEventListener('click', () => { tapSound(); S.parentOpen = false; back(); });
  for (const b of $$('.lg', scr)) b.addEventListener('click', async () => { tapSound(); await setLang(b.dataset.l); parentPage(pid, back); });
  const sv = $('.savecsv', scr); if (sv) sv.addEventListener('click', () => { // a local file only: nothing is sent anywhere
    tapSound(); const url = URL.createObjectURL(new Blob([reportCsv(pd)], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `times-squad-warmup-${today()}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000); $('.saved', scr).classList.remove('hidden'); });
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
