// Sound: real recordings only (spec 12, 13.2). Web Audio with pre-decoded buffers, one gain for effects and one for music.
// No oscillators, no generated audio, no text-to-speech. If a file fails to load, that sound simply does not play.
// The iPhone silent switch is respected: we do not change navigator.audioSession (Chief of Staff call).
let ctx = null, sfx = null, mus = null, musicSrc = null;
const buffers = {};
const stats = { total: 0, loaded: 0, failed: 0, played: 0 };
self.__tsAudio = stats;
let soundOn = true, musicOn = false, wantMusic = false, loading = null, soft = 1, noMusic = false; // v0.5a Calm: softer sounds, music off
const FILES = ['tap', 'pop', 'feet', 'glock', 'chimes', 'cheer', 'woo', 'boing', 'shuffle', 'clap', 'squeak', 'splat', 'splosh', 'giggle',
  'laugh', 'munch', 'stomp', 'swish', 'fabric', 'uke', 'fanfare', 'ting', 'hmph', 'music', 'leafstep', 'rustle', 'sneeze', 'wind', 'spring',
  'toybop', 'duck', 'moo', 'goat', 'cowbell', 'hiccup', 'rain', 'snowstep', 'bubbles', 'blow', 'hey', 'roar', // v0.4.1 boss sounds
  'towel', 'slidewood', 'carrot', 'bzz', 'claws', 'mouse', 'drip', 'snore', 'wheel', 'woodtap', 'coinspin', 'squelch', 'ball', 'sponge', 'jingle', 'rocket', 'vacuum', 'ching', 'door']; // v0.5 B2
// Event -> [file, playback rate, gain]. Pitch steps use the playback rate of the same real recording.
const EVENTS = {
  ui_tap: ['tap', 1, 0.8], start_jingle: ['fanfare', 1, 0.9],
  jump: ['fabric', 1.25, 0.55], jump_big: ['spring', 1, 0.8], land: ['leafstep', 1, 0.45], step: ['leafstep', 1.15, 0.22], mushroom: ['spring', 1.2, 0.8],
  pit: ['splosh', 1.1, 0.7], pit_back: ['boing', 1.3, 0.6], sign: ['ting', 1, 0.55], acorn: ['ting', 1.6, 0.35], flower: ['chimes', 1.2, 0.5],
  power: ['fanfare', 1.26, 0.8], power_end: ['glock', 0.8, 0.5], bubble_in: ['pop', 1.3, 0.6], bubble_pop: ['pop', 0.8, 0.9],
  bop: ['pop', 0.7, 1], bump: ['hmph', 1.2, 0.6], right: ['chimes', 1, 0.7], wrong: ['squeak', 1, 0.5], curtain: ['rustle', 0.9, 0.7],
  checkpoint: ['glock', 1.26, 0.6], finish: ['fanfare', 1, 0.9], medal: ['clap', 1, 0.7], cheer: ['cheer', 1, 0.7],
  attack_warn: ['hmph', 0.85, 0.9], attack_spin: ['wind', 1, 0.9], attack_stomp: ['stomp', 1, 0.9], attack_sneeze: ['sneeze', 1, 1], boss_bop: ['toybop', 1, 1], boss_win: ['laugh', 1, 1], fanfare_win: ['fanfare', 1, 1],
  focus: ['glock', 1.5, 0.3], ding: ['ting', 1.2, 0.6], leg: ['chimes', 1.35, 0.55], penalty: ['tap', 0.7, 0.5], restart: ['swish', 1.2, 0.5],
  squeak: ['squeak', 1.3, 0.5], giggle: ['giggle', 1, 0.6], woo: ['woo', 1, 0.8],
  // v0.5 B2: moves, parts, score, Share Door, launch (all real recordings, SOUNDS.md)
  jump2: ['fabric', 1.5, 0.55], glide: ['towel', 1, 0.6], slide: ['slidewood', 1, 0.7], part: ['chimes', 1.5, 0.6], part_gold: ['glock', 1.68, 0.6],
  score_line: ['ching', 1, 0.7], share_door: ['door', 1, 0.8], sticker: ['pop', 1.2, 0.8], count: ['glock', 1.12, 0.8], rocket: ['rocket', 0.8, 1], rumble: ['vacuum', 1, 0.8],
};
// v0.4.1 boss moves: look -> layers of [file, rate, gain, delay s]. All real recordings (see SOUNDS.md for the stand-ins).
const BOSS_SFX = {
  leafspin: [['wind', 1, 0.9], ['rustle', 1, 0.6, 0.1]], babies: [['boing', 1.3, 0.7], ['boing', 1.5, 0.6, 0.25], ['boing', 1.7, 0.5, 0.5]],
  stomp: [['stomp', 1, 1]], sneeze: [['sneeze', 1.15, 1]],
  coconut: [['shuffle', 0.7, 0.9], ['tap', 0.6, 0.6, 0.3]], hula: [['fabric', 0.8, 0.9], ['fabric', 0.9, 0.7, 0.35], ['wind', 1.1, 0.5]], juice: [['splosh', 1, 1]],
  moonjump: [['spring', 0.7, 0.9], ['stomp', 0.8, 0.7, 0.6]], bubbles: [['bubbles', 1, 1]], moo: [['moo', 1, 1]],
  rain: [['rain', 1, 0.9]], puffs: [['stomp', 1.4, 0.7], ['fabric', 1, 0.6, 0.15]], thunder: [['stomp', 0.6, 1], ['hmph', 0.6, 0.5, 0.1]],
  hiccup: [['hiccup', 1, 1]], tumble: [['rustle', 0.8, 0.9], ['rustle', 0.9, 0.7, 0.4]], sand: [['wind', 1.2, 0.8], ['rustle', 1.4, 0.4]],
  bell: [['cowbell', 1, 1], ['goat', 1, 0.8, 0.35]], leaves: [['rustle', 1, 0.9], ['leafstep', 1, 0.6, 0.3]], hey: [['hey', 1, 1]],
  ring: [['swish', 0.8, 1]], spinwind: [['fabric', 0.75, 0.9], ['wind', 1, 0.6]], juggle: [['stomp', 1.7, 0.7], ['stomp', 1.8, 0.7, 0.3], ['stomp', 1.6, 0.7, 0.6]],
  snowball: [['snowstep', 0.8, 1], ['snowstep', 0.9, 0.8, 0.3]], ice: [['snowstep', 1.5, 0.8], ['swish', 0.6, 0.6, 0.1]], nose: [['blow', 1, 0.9], ['fabric', 1.3, 0.6, 0.2]],
  belly: [['boing', 0.6, 0.9], ['stomp', 0.7, 0.9, 0.05]], storm: [['wind', 0.9, 1]], moons: [['blow', 0.9, 0.9], ['tap', 1.4, 0.5, 0.3], ['tap', 1.6, 0.5, 0.5]],
  colorsneeze: [['sneeze', 1.2, 1], ['pop', 1, 0.8, 0.35]], tail: [['swish', 0.7, 1], ['fabric', 0.8, 0.6, 0.1]],
  roar: [['roar', 1, 1], ['duck', 0.8, 0.5, 0.1], ['duck', 0.7, 0.4, 0.5]],
};
export function bossSound(look) {
  const L = BOSS_SFX[look]; if (!L) return false;
  let any = false; for (const [f, r, g, d] of L) any = playBuf(f, r, g, d || 0) || any; return any || !!ctx;
}
// v0.5b2: each bad guy's own sound when bopped (layered on the shared pop). All real recordings (SOUNDS.md).
const BAD_SFX = { bee: ['bzz', 1.1, 0.7], carrot: ['carrot', 1, 0.8], crab: ['claws', 1, 0.8], starfish: ['giggle', 1.3, 0.6], ufo: ['bubbles', 1.3, 0.6],
  mouse: ['mouse', 1, 0.7], cloud: ['blow', 1.2, 0.7], raindrop: ['drip', 1, 0.8], tumbleweed: ['rustle', 1.2, 0.8], lizard: ['snore', 1, 0.7],
  cheese: ['wheel', 1, 0.8], pinecone: ['woodtap', 1, 0.8], ringrock: ['coinspin', 1, 0.7], jelly: ['squelch', 1, 0.8], snowball: ['snowstep', 1.2, 0.9],
  penguin: ['slidewood', 1.4, 0.7], storm: ['wind', 1.3, 0.7], moon: ['ball', 1, 0.8], sparklestar: ['jingle', 1, 0.7], paintblob: ['sponge', 1, 0.8] };
export function badSound(name) { const b = BAD_SFX[name]; return b ? playBuf(b[0], b[1], b[2], 0.06) : false; }
export const BAD_NAMES = Object.keys(BAD_SFX);
// The shared laugh, pitched per boss (the same recording at a different playback rate).
export const laugh = (rate = 1) => playBuf('laugh', rate, 1);
export const BOSS_LOOKS = Object.keys(BOSS_SFX);
const STEP = (n) => Math.pow(2, n / 12);
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];
export function unlock() {
  try {
    if (!ctx) {
      const AC = self.AudioContext || self.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      sfx = ctx.createGain(); sfx.gain.value = soundOn ? soft : 0; sfx.connect(ctx.destination);
      mus = ctx.createGain(); mus.gain.value = musicOn && !noMusic ? 0.35 : 0; mus.connect(ctx.destination);
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  } catch { ctx = null; }
  if (!loading) loading = loadAll();
}
async function loadOne(id) {
  try {
    const r = await fetch(new URL('../audio/' + id + '.m4a', import.meta.url));
    if (!r.ok) throw new Error('missing');
    const ab = await r.arrayBuffer();
    buffers[id] = await new Promise((ok, bad) => { const p = ctx.decodeAudioData(ab, ok, bad); if (p && p.catch) p.catch(bad); });
    stats.loaded++;
  } catch { stats.failed++; }
}
async function loadAll() {
  if (!ctx) return;
  stats.total = FILES.length;
  for (const id of FILES) await loadOne(id); // background, one by one; the game never waits for it
  if (wantMusic) startMusic();
}
function playBuf(id, rate = 1, gain = 1, when = 0) {
  if (!ctx || !soundOn || !buffers[id]) return false;
  try {
    const s = ctx.createBufferSource(); s.buffer = buffers[id]; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(sfx);
    s.start(ctx.currentTime + when); stats.played++; return true;
  } catch { return false; }
}
export function play(event, opts = {}) {
  const e = EVENTS[event]; if (!e) return false;
  return playBuf(e[0], e[1] * (opts.rate || 1), e[2] * (opts.gain || 1), opts.when || 0);
}
// Rising notes on the same glockenspiel recording (power meter).
export const step = (event, n) => play(event, { rate: STEP(SCALE[Math.max(0, Math.min(SCALE.length - 1, n))]) });
export function setSound(on) { soundOn = on; if (sfx) sfx.gain.value = on ? soft : 0; }
export function setCalm({ soft: sf = false, music: nm = false } = {}) { soft = sf ? 0.55 : 1; noMusic = !!nm; if (sfx) sfx.gain.value = soundOn ? soft : 0; if (mus) mus.gain.value = musicOn && !noMusic ? 0.35 : 0; if (noMusic) stopMusic(); }
export function setMusic(on) { musicOn = on; if (mus) mus.gain.value = on ? 0.35 : 0; if (on) startMusic(); else stopMusic(); }
export function startMusic() {
  wantMusic = true;
  if (!ctx || !musicOn || noMusic || musicSrc || !buffers.music) return;
  try { musicSrc = ctx.createBufferSource(); musicSrc.buffer = buffers.music; musicSrc.loop = true; musicSrc.connect(mus); musicSrc.start(); stats.played++; } catch { musicSrc = null; }
}
export function stopMusic() { wantMusic = musicOn && wantMusic; if (musicSrc) { try { musicSrc.stop(); } catch { /* already stopped */ } musicSrc = null; } }
export function suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
export function resume() { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }
export const ready = () => loading || Promise.resolve();
export const SOUND_FILES = FILES;
