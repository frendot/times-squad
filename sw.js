// Service worker: precache every file at install so Times Squad works offline (spec 13.3). Same-origin only.
// A new version installs in the background and takes over at the next app launch, never in the middle of a run.
const VERSION = 'v1-b43000cb6d';
const CACHE = 'times-squad-' + VERSION;
const ASSETS = [
  "./",
  "./audio/boing.m4a",
  "./audio/cheer.m4a",
  "./audio/chimes.m4a",
  "./audio/clap.m4a",
  "./audio/fabric.m4a",
  "./audio/fanfare.m4a",
  "./audio/feet.m4a",
  "./audio/giggle.m4a",
  "./audio/glock.m4a",
  "./audio/hmph.m4a",
  "./audio/laugh.m4a",
  "./audio/manifest.json",
  "./audio/munch.m4a",
  "./audio/music.m4a",
  "./audio/pop.m4a",
  "./audio/shuffle.m4a",
  "./audio/splat.m4a",
  "./audio/splosh.m4a",
  "./audio/squeak.m4a",
  "./audio/stomp.m4a",
  "./audio/swish.m4a",
  "./audio/tap.m4a",
  "./audio/ting.m4a",
  "./audio/uke.m4a",
  "./audio/woo.m4a",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./index.html",
  "./js/art.js",
  "./js/audio.js",
  "./js/bootcheck.js",
  "./js/config.js",
  "./js/engine.js",
  "./js/facts.js",
  "./js/gen.js",
  "./js/learn.js",
  "./js/main.js",
  "./js/nomodule.js",
  "./js/play.js",
  "./js/rng.js",
  "./js/screens.js",
  "./js/store.js",
  "./js/ui.js",
  "./manifest.webmanifest",
  "./strings.en.json",
  "./styles.css"
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('times-squad-') && k !== CACHE).map((k) => caches.delete(k)))));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && res.type === 'basic') c.put(e.request, res.clone());
    return res;
  }).catch(() => (e.request.mode === 'navigate' ? c.match('./index.html') : Response.error())))));
});
