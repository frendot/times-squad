// World 1 facts (spec 7.1, 7.5). A fact id puts the smaller factor first: "3x7" covers 3 x 7 and 7 x 3.
export const factId = (a, b) => (a <= b ? `${a}x${b}` : `${b}x${a}`);
export const parseFact = (id) => id.split('x').map(Number);
export const GROUPS = {
  10: ['2x10', '3x10', '4x10', '5x10', '6x10', '7x10', '8x10', '9x10', '10x10', '10x11', '10x12'],
  5: ['2x5', '3x5', '4x5', '5x5', '5x6', '5x7', '5x8', '5x9', '5x11', '5x12'],
  2: ['2x2', '2x3', '2x4', '2x6', '2x7', '2x8', '2x9', '2x11', '2x12'],
  3: ['3x3', '3x4', '3x6'],
};
export const WORLD1 = [...GROUPS[10], ...GROUPS[5], ...GROUPS[2], ...GROUPS[3]];
export const INTRO_ORDER = {
  L1: ['2x10', '5x10', '3x10', '4x10', '10x10', '6x10', '7x10', '8x10', '9x10', '10x11', '10x12'],
  L2: ['2x5', '4x5', '5x6', '3x5', '5x5', '5x8', '5x7', '5x9', '5x11', '5x12'],
  L3: ['2x2', '2x3', '2x4', '2x6', '2x7', '2x8', '2x9', '2x11', '2x12'],
};
export const TASTE_ORDER = ['3x4', '3x3', '3x6'];
export const SNEAK_KNOWN = ['2x3', '3x5', '3x10'];
export const ANCHORS = ['2x10', '5x10', '10x10', '2x2'];
export const FOCUS = { L1: 10, L2: 5, L3: 2 };
// Which group (table) a fact belongs to.
export function groupOf(id) {
  for (const g of [10, 5, 2, 3]) if (GROUPS[g].includes(id)) return g;
  return 0;
}
export const isWorld1 = (id) => WORLD1.includes(id);
// The cells that look "World 1" on the Times Map (any fact with a 2, 5 or 10, plus the taste facts).
export const isWorld1Cell = (r, c) => [2, 5, 10].includes(r) || [2, 5, 10].includes(c) || GROUPS[3].includes(factId(r, c));
// Last-digit rule of the table (spec 6.4 step 4).
export function ruleFor(id) {
  const [a, b] = parseFact(id);
  if (a === 5 || b === 5) return (v) => v % 5 === 0;
  if (a === 10 || b === 10) return (v) => v % 10 === 0;
  if (a === 2 || b === 2) return (v) => v % 2 === 0;
  return null;
}
// Strategy line used on cards and in the miss picture.
export function strategyOf(id) { return { 10: 'tens', 5: 'half', 2: 'double', 3: 'three' }[groupOf(id)] || 'groups'; }
