// Service worker: precache every file at install so Times Squad works offline (spec 13.3). Same-origin only.
// v0.3: a new version installs in the background and activates at once (pages load all their code at start, so an open
// page keeps working); every older cache (times-squad-v1-*, times-squad-v2-*) is deleted. The new version shows on the next launch.
const VERSION = 'v3-27e17236a1';
const CACHE = 'times-squad-' + VERSION;
const ASSETS = [
  "./",
  "./art/bg_spring_far.webp",
  "./art/bg_spring_mid.webp",
  "./art/boss_broccoli.webp",
  "./art/fox-rig.json",
  "./art/fox_portrait.png",
  "./art/frog_portrait.png",
  "./art/fx_poof.png",
  "./art/manifest.json",
  "./art/monster_frog.png",
  "./art/monster_pinecone.png",
  "./art/owl_portrait.png",
  "./art/panda_portrait.png",
  "./art/ui_panel.png",
  "./art/ui_sign.png",
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
  "./audio/leafstep.m4a",
  "./audio/manifest.json",
  "./audio/munch.m4a",
  "./audio/music.m4a",
  "./audio/pop.m4a",
  "./audio/rustle.m4a",
  "./audio/shuffle.m4a",
  "./audio/sneeze.m4a",
  "./audio/splat.m4a",
  "./audio/splosh.m4a",
  "./audio/spring.m4a",
  "./audio/squeak.m4a",
  "./audio/stomp.m4a",
  "./audio/swish.m4a",
  "./audio/tap.m4a",
  "./audio/ting.m4a",
  "./audio/uke.m4a",
  "./audio/wind.m4a",
  "./audio/woo.m4a",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./index.html",
  "./js/art.js",
  "./js/artpack.js",
  "./js/audio.js",
  "./js/bootcheck.js",
  "./js/config.js",
  "./js/facts.js",
  "./js/game.js",
  "./js/gen.js",
  "./js/input.js",
  "./js/learn.js",
  "./js/main.js",
  "./js/nomodule.js",
  "./js/player.js",
  "./js/puppet.js",
  "./js/questions.js",
  "./js/render.js",
  "./js/rng.js",
  "./js/screens.js",
  "./js/sim.js",
  "./js/store.js",
  "./js/ui.js",
  "./levels/spring-boss.json",
  "./levels/x2-L1.json",
  "./levels/x2-L2.json",
  "./levels/x2-L3.json",
  "./levels/x2-RR.json",
  "./manifest.webmanifest",
  "./strings.en.json",
  "./styles.css"
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('times-squad-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && res.type === 'basic') c.put(e.request, res.clone());
    return res;
  }).catch(() => (e.request.mode === 'navigate' ? c.match('./index.html') : Response.error())))));
});
