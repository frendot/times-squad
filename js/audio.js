// Sound: real recordings only (spec 12, 13.2). Web Audio with pre-decoded buffers, one gain for effects and one for music.
// No oscillators, no generated audio, no text-to-speech. If a file fails to load, that sound simply does not play.
// The iPhone silent switch is respected: we do not change navigator.audioSession (Chief of Staff call).
let ctx = null, sfx = null, mus = null, musicSrc = null;
const buffers = {};
const stats = { total: 0, loaded: 0, failed: 0, played: 0 };
self.__tsAudio = stats;
let soundOn = true, musicOn = false, wantMusic = false, loading = null;
const FILES = ['tap', 'pop', 'feet', 'glock', 'chimes', 'cheer', 'woo', 'boing', 'shuffle', 'clap', 'squeak', 'splat', 'splosh', 'giggle',
  'laugh', 'munch', 'stomp', 'swish', 'fabric', 'uke', 'fanfare', 'ting', 'hmph', 'music', 'leafstep', 'rustle', 'sneeze', 'wind', 'spring'];
// Event -> [file, playback rate, gain]. Pitch steps use the playback rate of the same real recording.
const EVENTS = {
  ui_tap: ['tap', 1, 0.8], start_jingle: ['fanfare', 1, 0.9],
  jump: ['fabric', 1.25, 0.55], jump_big: ['spring', 1, 0.8], land: ['leafstep', 1, 0.45], step: ['leafstep', 1.15, 0.22], mushroom: ['spring', 1.2, 0.8],
  pit: ['splosh', 1.1, 0.7], pit_back: ['boing', 1.3, 0.6], sign: ['ting', 1, 0.55], acorn: ['ting', 1.6, 0.35], flower: ['chimes', 1.2, 0.5],
  power: ['fanfare', 1.26, 0.8], power_end: ['glock', 0.8, 0.5], bubble_in: ['pop', 1.3, 0.6], bubble_pop: ['pop', 0.8, 0.9],
  bop: ['pop', 0.7, 1], bump: ['hmph', 1.2, 0.6], right: ['chimes', 1, 0.7], wrong: ['squeak', 1, 0.5], curtain: ['rustle', 0.9, 0.7],
  checkpoint: ['glock', 1.26, 0.6], finish: ['fanfare', 1, 0.9], medal: ['clap', 1, 0.7], cheer: ['cheer', 1, 0.7],
  attack_warn: ['hmph', 0.85, 0.9], attack_spin: ['wind', 1, 0.9], attack_stomp: ['stomp', 1, 0.9], attack_sneeze: ['sneeze', 1, 1], boss_bop: ['splat', 1, 1], boss_win: ['splosh', 0.8, 1],
  squeak: ['squeak', 1.3, 0.5], giggle: ['giggle', 1, 0.6], woo: ['woo', 1, 0.8],
};
const STEP = (n) => Math.pow(2, n / 12);
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];
export function unlock() {
  try {
    if (!ctx) {
      const AC = self.AudioContext || self.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      sfx = ctx.createGain(); sfx.gain.value = soundOn ? 1 : 0; sfx.connect(ctx.destination);
      mus = ctx.createGain(); mus.gain.value = musicOn ? 0.35 : 0; mus.connect(ctx.destination);
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
export function setSound(on) { soundOn = on; if (sfx) sfx.gain.value = on ? 1 : 0; }
export function setMusic(on) { musicOn = on; if (mus) mus.gain.value = on ? 0.35 : 0; if (on) startMusic(); else stopMusic(); }
export function startMusic() {
  wantMusic = true;
  if (!ctx || !musicOn || musicSrc || !buffers.music) return;
  try { musicSrc = ctx.createBufferSource(); musicSrc.buffer = buffers.music; musicSrc.loop = true; musicSrc.connect(mus); musicSrc.start(); stats.played++; } catch { musicSrc = null; }
}
export function stopMusic() { wantMusic = musicOn && wantMusic; if (musicSrc) { try { musicSrc.stop(); } catch { /* already stopped */ } musicSrc = null; } }
export function suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
export function resume() { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }
export const ready = () => loading || Promise.resolve();
export const SOUND_FILES = FILES;
