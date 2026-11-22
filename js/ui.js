// Screen helpers shared by all screens: strings, DOM building, pause-aware waiting, and app state.
import { CONFIG } from './config.js';
import { dayOf, maxDay } from './learn.js';

export const S = { settings: null, pid: null, pd: null, paused: false, flow: 0, screen: '', lastInput: Date.now(), strings: null, onResume: null, parentOpen: false };
export async function loadStrings() {
  const r = await fetch(new URL('../strings.en.json', import.meta.url));
  S.strings = await r.json();
}
const fill = (s, v = {}) => s.replace(/\{(\w+)\}/g, (_, k) => (k in v ? String(v[k]) : '{' + k + '}'));
export const t = (key, v) => fill(S.strings.kid[key] ?? key, v);
export const tp = (key, v) => fill(S.strings.parent[key] ?? key, v);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fmtSquad = (n) => (n > CONFIG.SQUAD_DISPLAY_CAP ? CONFIG.SQUAD_DISPLAY_CAP + '+' : String(n));
export function today() {
  const d = dayOf(new Date());
  const t0 = maxDay(d, S.settings && S.settings.lastSeenDay);
  if (S.settings && t0 !== S.settings.lastSeenDay) S.settings.lastSeenDay = t0;
  return t0;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
export const app = () => document.getElementById('app');
// Show a screen: a new flow id stops any waiting code from the old screen.
export function show(name, html) {
  S.flow++; S.screen = name;
  const root = app(); root.innerHTML = ''; const node = el(`<section class="scr scr-${name}" data-screen="${name}">${html}</section>`);
  root.appendChild(node); root.scrollTop = 0; window.scrollTo(0, 0);
  return node;
}
export class Stop extends Error {}
// Pause-aware sleep: time does not pass while the pause menu is open. Throws Stop if the screen changed.
export function sleep(ms, flow = S.flow) {
  return new Promise((ok, bad) => {
    let left = ms, last = performance.now();
    const step = () => {
      if (flow !== S.flow) return bad(new Stop());
      const now = performance.now(); if (!S.paused) left -= now - last; last = now;
      if (left <= 0) ok(); else setTimeout(step, Math.min(50, Math.max(5, left)));
    };
    setTimeout(step, Math.min(50, ms));
  });
}
// Wait for a click on one of the elements; resolves with the element.
export function tapOnce(nodes, flow = S.flow) {
  return new Promise((ok, bad) => {
    const list = Array.isArray(nodes) ? nodes : [nodes];
    const chk = setInterval(() => { if (flow !== S.flow) { clearInterval(chk); bad(new Stop()); } }, 200);
    const h = (e) => { if (S.paused) return; clearInterval(chk); list.forEach((n) => n.removeEventListener('click', h)); ok(e.currentTarget); };
    list.forEach((n) => n.addEventListener('click', h));
  });
}
export function setVar(node, name, val) { node.style.setProperty(name, val); }
// A dot array: rows x cols, sized to fit the box. Options: faint, half (fade the right half for the 5s picture).
export function dots(rows, cols, { max = 300, maxH = 220, cls = '', fade = null } = {}) {
  const d = Math.max(4, Math.min(26, Math.floor(Math.min(max / cols, maxH / rows)) - 2));
  const n = el(`<div class="dots ${cls}" role="img" aria-label="${rows} x ${cols}"></div>`);
  setVar(n, '--cols', cols); setVar(n, '--d', d + 'px');
  let h = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) h += `<i class="${fade && fade(r, c) ? 'f' : ''}"></i>`;
  n.innerHTML = h;
  return n;
}
export const noop = () => {};
