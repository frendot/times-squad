// Sound: real recordings only (spec 12, 13.2). Web Audio with pre-decoded buffers, one gain for effects and one for music.
// No oscillators, no generated audio, no text-to-speech. If a file fails to load, that sound simply does not play.
// The iPhone silent switch is respected: we do not change navigator.audioSession (Chief of Staff call).
let ctx = null, sfx = null, mus = null, musicSrc = null;
const buffers = {};
const stats = { total: 0, loaded: 0, failed: 0, played: 0 };
self.__tsAudio = stats;
let soundOn = true, musicOn = false, wantMusic = false, loading = null;
const FILES = ['tap', 'pop', 'feet', 'glock', 'chimes', 'cheer', 'woo', 'boing', 'shuffle', 'clap', 'squeak', 'splat', 'splosh', 'giggle',
  'laugh', 'munch', 'stomp', 'swish', 'fabric', 'uke', 'fanfare', 'ting', 'hmph', 'music'];
// Event -> [file, playback rate, gain]. Pitch steps use the playback rate of the same real recording.
const EVENTS = {
  ui_tap: ['tap', 1, 0.8], start_jingle: ['fanfare', 1, 0.9], go: ['fanfare', 1.12, 0.7],
  lane: ['swish', 1.5, 0.35], jump: ['fabric', 1.25, 0.6], slide: ['shuffle', 1.1, 0.6],
  sign: ['ting', 1, 0.55], right: ['pop', 1, 0.9], streak_step: ['glock', 1, 0.45], jam: ['boing', 1, 0.8],
  zap: ['swish', 1.9, 0.7], poof: ['pop', 0.7, 1], coin: ['ting', 1.6, 0.3],
  power: ['fanfare', 1.26, 0.85], power_end: ['glock', 0.8, 0.5], shield_pop: ['glock', 1.2, 0.8], smash: ['stomp', 1.1, 0.9],
  boss_in: ['stomp', 0.9, 1], boss_grumble: ['hmph', 0.85, 0.9], throw: ['swish', 0.9, 0.7], boss_hit: ['splat', 1, 1],
  boss_laugh: ['laugh', 0.85, 0.8], boss_poof: ['splosh', 0.8, 1], cheer: ['cheer', 1, 0.7], tile_up: ['glock', 1.26, 0.6],
  crash: ['stomp', 1, 1], crash_boing: ['boing', 0.8, 0.8], munch: ['munch', 1, 0.8], giggle: ['giggle', 1, 0.6],
  squeak: ['squeak', 1.3, 0.5], woo: ['woo', 1, 0.8], clap: ['clap', 1, 0.7], feet: ['feet', 1, 0.5], chimes: ['chimes', 1, 0.6], uke: ['uke', 1, 0.6],
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
