// Original art drawn as inline SVG (no image files, no fonts from outside). Only presentation attributes; no inline styles (CSP).
const svg = (vb, body, cls = '') => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
const eyes = (y = 52, dx = 14, r = 5) => `<circle cx="${50 - dx}" cy="${y}" r="${r}" fill="#2b2238"/><circle cx="${50 + dx}" cy="${y}" r="${r}" fill="#2b2238"/><circle cx="${50 - dx + 1.6}" cy="${y - 1.8}" r="1.6" fill="#fff"/><circle cx="${50 + dx + 1.6}" cy="${y - 1.8}" r="1.6" fill="#fff"/>`;
const smile = (y = 66) => `<path d="M40 ${y} Q50 ${y + 9} 60 ${y}" stroke="#2b2238" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
export const ANIMALS = {
  fox: svg('0 0 100 100', `<path d="M18 22 L36 40 L22 52Z M82 22 L64 40 L78 52Z" fill="#e8762c"/><path d="M22 30 L32 41 L25 47Z M78 30 L68 41 L75 47Z" fill="#fff3e6"/>
    <path d="M50 88 C24 88 14 66 18 44 C24 34 36 32 50 34 C64 32 76 34 82 44 C86 66 76 88 50 88Z" fill="#f0883a"/>
    <path d="M50 88 C36 88 28 78 26 66 C34 62 42 64 50 72 C58 64 66 62 74 66 C72 78 64 88 50 88Z" fill="#fff6ea"/>${eyes(54, 15)}<ellipse cx="50" cy="70" rx="5" ry="3.6" fill="#2b2238"/>`, 'animal'),
  panda: svg('0 0 100 100', `<circle cx="24" cy="26" r="12" fill="#2b2238"/><circle cx="76" cy="26" r="12" fill="#2b2238"/><circle cx="50" cy="56" r="36" fill="#fff"/>
    <ellipse cx="35" cy="52" rx="10" ry="12" fill="#2b2238" transform="rotate(-20 35 52)"/><ellipse cx="65" cy="52" rx="10" ry="12" fill="#2b2238" transform="rotate(20 65 52)"/>
    <circle cx="36" cy="51" r="4" fill="#fff"/><circle cx="64" cy="51" r="4" fill="#fff"/><ellipse cx="50" cy="68" rx="6" ry="4" fill="#2b2238"/>${smile(74)}`, 'animal'),
  frog: svg('0 0 100 100', `<circle cx="30" cy="30" r="15" fill="#5cbf4a"/><circle cx="70" cy="30" r="15" fill="#5cbf4a"/><ellipse cx="50" cy="60" rx="40" ry="30" fill="#5cbf4a"/>
    <circle cx="30" cy="30" r="9" fill="#fff"/><circle cx="70" cy="30" r="9" fill="#fff"/><circle cx="31" cy="31" r="5" fill="#2b2238"/><circle cx="71" cy="31" r="5" fill="#2b2238"/>
    <path d="M28 64 Q50 82 72 64" stroke="#2b2238" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="24" cy="62" r="5" fill="#ff9e9e" opacity=".6"/><circle cx="76" cy="62" r="5" fill="#ff9e9e" opacity=".6"/>`, 'animal'),
  owl: svg('0 0 100 100', `<path d="M20 20 L36 32 L22 40Z M80 20 L64 32 L78 40Z" fill="#8a5a3c"/><ellipse cx="50" cy="58" rx="34" ry="36" fill="#a8704a"/><ellipse cx="50" cy="70" rx="20" ry="20" fill="#f2dcc0"/>
    <circle cx="36" cy="46" r="12" fill="#fff"/><circle cx="64" cy="46" r="12" fill="#fff"/><circle cx="37" cy="47" r="6" fill="#2b2238"/><circle cx="63" cy="47" r="6" fill="#2b2238"/>
    <path d="M45 56 L55 56 L50 64Z" fill="#f2a43a"/>`, 'animal'),
};
// The Giant Broccoli: mood = grumpy | laugh | happy | eat. Silly, never hurt.
export function broccoli(mood = 'happy', cream = 0) {
  const floret = [[30, 34, 20], [52, 24, 22], [74, 34, 20], [22, 52, 16], [80, 52, 16], [42, 44, 20], [62, 44, 20]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#3f9a3a"/><circle cx="${x - r / 3}" cy="${y - r / 3}" r="${r / 3}" fill="#5bb84f"/>`).join('');
  const brow = mood === 'grumpy' ? `<path d="M36 70 L46 74 M64 70 L54 74" stroke="#1d3b1a" stroke-width="3" stroke-linecap="round"/>` : '';
  const eye = mood === 'laugh' ? `<path d="M37 80 Q41 75 45 80 M55 80 Q59 75 63 80" stroke="#1d3b1a" stroke-width="3" fill="none" stroke-linecap="round"/>` : `<circle cx="41" cy="80" r="4" fill="#1d3b1a"/><circle cx="59" cy="80" r="4" fill="#1d3b1a"/>`;
  const mouth = { grumpy: `<path d="M42 96 Q50 90 58 96" stroke="#1d3b1a" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    laugh: `<path d="M38 90 Q50 106 62 90 Z" fill="#6b2d2d"/><path d="M42 97 Q50 102 58 97" fill="#ff8f8f"/>`,
    happy: `<path d="M40 92 Q50 102 60 92" stroke="#1d3b1a" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    eat: `<ellipse cx="50" cy="95" rx="7" ry="6" fill="#6b2d2d"/>` }[mood];
  const creamBits = ['<ellipse cx="30" cy="34" rx="14" ry="8" fill="#fffaf0"/>', '<ellipse cx="66" cy="88" rx="9" ry="6" fill="#fffaf0"/>', '<ellipse cx="56" cy="22" rx="12" ry="7" fill="#fffaf0"/><circle cx="58" cy="16" r="4" fill="#e23b4a"/>'].slice(0, cream).join('');
  return svg('0 0 100 130', `<path d="M34 60 L66 60 L70 122 Q50 128 30 122Z" fill="#b8dc8a"/><path d="M26 92 Q14 84 10 96 M74 92 Q86 84 90 96" stroke="#9cc874" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M40 124 L38 130 M60 124 L62 130" stroke="#9cc874" stroke-width="7" stroke-linecap="round"/>${floret}${brow}${eye}${mouth}
    <circle cx="34" cy="90" r="4" fill="#ff9e9e" opacity=".5"/><circle cx="66" cy="90" r="4" fill="#ff9e9e" opacity=".5"/>${creamBits}`, 'broccoli ' + mood);
}
export const PIE = svg('0 0 100 60', `<path d="M8 30 L92 30 L84 54 L16 54Z" fill="#c98a4b"/><path d="M8 30 L92 30" stroke="#a86a33" stroke-width="4"/>
  <path d="M10 30 Q18 8 30 22 Q40 4 52 20 Q64 4 72 22 Q84 8 90 30Z" fill="#fffaf0"/><circle cx="50" cy="12" r="6" fill="#e23b4a"/>`, 'pie');
export const FEATHER = svg('0 0 60 100', `<path d="M30 4 C54 26 50 70 30 92 C10 70 6 26 30 4Z" fill="#ffd3ec"/><path d="M30 10 L30 98" stroke="#d1669f" stroke-width="3"/>`, 'feather');
export const SPLAT = svg('0 0 100 100', `<path d="M50 14 C58 30 70 10 72 30 C90 24 84 44 92 52 C80 58 92 74 74 74 C76 92 58 82 50 92 C42 80 26 94 26 76 C8 76 18 58 8 50 C20 44 10 26 28 30 C28 12 42 28 50 14Z" fill="#ff6fa8"/>
  <circle cx="40" cy="44" r="6" fill="#ffb3d1"/>`, 'splat');
export const ICON = {
  pause: svg('0 0 24 24', '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>'),
  map: svg('0 0 24 24', '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="2"/>'),
  help: svg('0 0 24 24', '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.2 9.2a3 3 0 1 1 4 2.8c-.8.4-1.2 1-1.2 1.8v.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.3" fill="currentColor"/>'),
  grownup: svg('0 0 24 24', '<circle cx="9" cy="7" r="3" fill="currentColor"/><path d="M3 20c0-4 3-7 6-7s6 3 6 7z" fill="currentColor"/><circle cx="17.5" cy="10" r="2.2" fill="currentColor"/><path d="M13.5 20c.3-3 2-5 4-5s3.7 2 4 5z" fill="currentColor"/>'),
  speaker: svg('0 0 24 24', '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  note: svg('0 0 24 24', '<path d="M9 18V6l11-2v12" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6.5" cy="18" r="2.8" fill="currentColor"/><circle cx="17.5" cy="16" r="2.8" fill="currentColor"/>'),
  bulb: svg('0 0 24 24', '<path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" fill="#ffd84a" stroke="#8a6d00" stroke-width="1.5"/><rect x="8.5" y="18" width="7" height="3" rx="1" fill="#8a6d00"/>'),
  star: svg('0 0 24 24', '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor"/>', 'star'),
  check: svg('0 0 24 24', '<path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  back: svg('0 0 24 24', '<path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  play: svg('0 0 24 24', '<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  next: svg('0 0 24 24', '<path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  share: svg('0 0 24 24', '<path d="M12 3v12M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 11v9h14v-9" fill="none" stroke="currentColor" stroke-width="2"/>'),
  phone: svg('0 0 48 48', '<rect x="14" y="6" width="20" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M40 20a14 14 0 0 1-6 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M33 31l1 4 4-1" fill="none" stroke="currentColor" stroke-width="3"/>'),
  eyes: svg('0 0 24 24', '<ellipse cx="7.5" cy="12" rx="5" ry="6" fill="#fff" stroke="currentColor" stroke-width="1.5"/><ellipse cx="16.5" cy="12" rx="5" ry="6" fill="#fff" stroke="currentColor" stroke-width="1.5"/><circle cx="8.5" cy="13" r="2.2" fill="currentColor"/><circle cx="17.5" cy="13" r="2.2" fill="currentColor"/>'),
  spin: svg('0 0 24 24', '<path d="M20 12a8 8 0 1 1-2.3-5.7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M18 2v5h-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'),
  cloud: svg('0 0 32 20', '<path d="M8 18a6 6 0 0 1 0-12 8 8 0 0 1 15 1 5.5 5.5 0 0 1 1 11z" fill="currentColor"/>'),
  ribbon: svg('0 0 24 24', '<circle cx="12" cy="9" r="6" fill="#ffcc33"/><path d="M8 13l-2 9 6-3 6 3-2-9" fill="#e23b4a"/>'),
};
