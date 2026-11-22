// Start-up: strings, storage, sound settings, service worker, pause on background, play-time counting.
import { CONFIG } from './config.js';
import { S, loadStrings, today } from './ui.js';
import * as store from './store.js';
import * as A from './audio.js';
import { start, openPause, goHome, choosePlayer } from './screens.js';

async function boot() {
  await loadStrings();
  const d0 = new Date(); const pad = (n) => String(n).padStart(2, '0');
  await store.open();
  S.settings = await store.loadSettings(`${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`);
  today(); store.saveSettings(S.settings);
  A.setSound(S.settings.sound); A.setMusic(S.settings.music);
  for (const n of document.querySelectorAll('[data-s]')) n.textContent = S.strings.kid[n.dataset.s];
  self.__tsBooted = true;
  document.getElementById('unsupported').hidden = true;
  start();
}
// Pause at once when the app goes to the background (10.3); the pause menu shows on return.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    flushPlaytime();
    if (S.screen === 'run' || S.screen === 'boss') openPause();
    A.suspend();
  } else {
    A.resume();
    if (S.parentOpen) { S.parentOpen = false; if (S.pd) goHome(); else start(); }
  }
});
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, () => { S.lastInput = Date.now(); }, { passive: true });
// Minutes this week (parent page): only visible, not paused, and not idle for 60 s; never shown to the child.
S.unsaved = 0;
setInterval(() => {
  if (document.hidden || S.paused || !S.pid || S.parentOpen || Date.now() - S.lastInput > CONFIG.IDLE_STOP_MS) return;
  S.unsaved++;
  if (S.unsaved >= 15) flushPlaytime();
}, 1000);
function flushPlaytime() { if (S.pid && S.unsaved > 0) { store.addPlaytime(S.pid, today(), S.unsaved); S.unsaved = 0; } }
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
boot().catch(() => { document.getElementById('unsupported').hidden = false; });
export { choosePlayer };
