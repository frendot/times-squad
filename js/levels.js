// v0.4 level structure: 9 tables x 2 levels + a boss each, then the Rainbow stage (3 levels + the Rainbow Dragon).
// Unlock is linear in ORDER. Level ids: x<t>-L1, x<t>-L2, x<t>-boss, rb-L1..rb-L3, rb-boss.
export const ORDER = [2, 10, 5, 3, 4, 9, 6, 8, 7];
export const WORLD_IDS = [...ORDER.map((t) => 'x' + t), 'rb'];
export const CHAIN = [...ORDER.flatMap((t) => [`x${t}-L1`, `x${t}-L2`, `x${t}-boss`]), 'rb-L1', 'rb-L2', 'rb-L3', 'rb-boss'];
export const LEVEL_IDS = CHAIN.filter((id) => !id.endsWith('-boss')); // the 21 levels
export const BOSS_IDS = CHAIN.filter((id) => id.endsWith('-boss'));    // the 10 boss fights
export const nextLevel = (id) => CHAIN[CHAIN.indexOf(id) + 1] || null;
export const isBoss = (id) => /-boss$/.test(id);
export const worldOf = (id) => id.split('-')[0];
export const tableOf = (id) => (id.startsWith('x') ? Number(id.slice(1).split('-')[0]) : 0); // 0 = Rainbow (all tables)
export const levelIndex = (id) => Math.max(0, CHAIN.indexOf(id));
export const levelNo = (id) => (isBoss(id) ? 0 : Number(id.split('-L')[1]));
export const fileOf = (id) => (isBoss(id) ? 'boss' : id); // every boss uses the shared arena boss.json
// Per-world look: background art keys and ground / platform tints; boss name key and its belly spot (fraction of the sprite).
export const WORLDS = {
  x2:  { bg: 'spring', grass: '#6cc04a', grass2: '#86d35f', dirt: '#9a6a3e', dot: '#86592f', plank: '#c98a4b', plank2: '#8a5a2b', leaf: '#58b947', bed: ['#e8902f', '#d9662a', '#f2b33d', '#b5562a'], belly: [0.5, 0.75], voice: 1.0 },
  x10: { bg: 'x10', grass: '#e9d18a', grass2: '#f6e3a6', dirt: '#d9b46c', dot: '#c49a52', plank: '#b77a45', plank2: '#7a4b22', leaf: '#3fae5a', bed: ['#45c4d9', '#2fa7c0', '#7fdcea', '#2a8fb0'], belly: [0.5, 0.79], voice: 1.12 },
  x5:  { bg: 'x5', grass: '#c9ccd6', grass2: '#e2e4ea', dirt: '#8f93a3', dot: '#7a7e8e', plank: '#a9adbd', plank2: '#5f6373', leaf: '#9fb4e8', bed: ['#5d4f8a', '#4a3f75', '#7a6aa8', '#3c3366'], belly: [0.47, 0.69], voice: 0.85 },
  x3:  { bg: 'x3', grass: '#ffffff', grass2: '#f3f6ff', dirt: '#cfd9f0', dot: '#b8c6e6', plank: '#f6d6e6', plank2: '#b48aa6', leaf: '#bfe3ff', bed: ['#cfe8ff', '#b9dbff', '#e6f2ff', '#a9cff5'], belly: [0.5, 0.6], voice: 1.2 },
  x4:  { bg: 'x4', grass: '#e0a25a', grass2: '#efbb78', dirt: '#b45a32', dot: '#9a4a28', plank: '#c98a4b', plank2: '#7a4520', leaf: '#6fae4a', bed: ['#d9a35a', '#c98b45', '#e8b870', '#b87838'], belly: [0.5, 0.72], voice: 1.05 },
  x9:  { bg: 'x9', grass: '#8cb04a', grass2: '#a6c862', dirt: '#8a6a4a', dot: '#74563a', plank: '#b06a3a', plank2: '#6e3e1e', leaf: '#e88a2f', bed: ['#e8902f', '#d9662a', '#f2b33d', '#b5562a'], belly: [0.5, 0.66], voice: 0.8 },
  x6:  { bg: 'x6', grass: '#e8c87a', grass2: '#f4dca0', dirt: '#b89058', dot: '#a07a46', plank: '#c9a0e0', plank2: '#7a5a96', leaf: '#f2c46a', bed: ['#b79be0', '#9f82cf', '#cdb6ef', '#8a6dbd'], belly: [0.5, 0.66], voice: 1.1 },
  x8:  { bg: 'x8', grass: '#ffffff', grass2: '#eef6ff', dirt: '#9fb8cf', dot: '#88a2bb', plank: '#a8d4f0', plank2: '#4f86ad', leaf: '#4f9a6a', bed: ['#cfe9ff', '#b6dcff', '#e6f4ff', '#9fcbef'], belly: [0.5, 0.78], voice: 0.9 },
  x7:  { bg: 'x7', grass: '#f0d2a0', grass2: '#f8e2bc', dirt: '#c08a5a', dot: '#a87448', plank: '#d9a46a', plank2: '#8a5a2b', leaf: '#e0a070', bed: ['#e8b07a', '#d4955e', '#f2c896', '#c07a48'], belly: [0.5, 0.72], voice: 0.75 },
  rb:  { bg: 'rb', grass: '#7fd36a', grass2: '#a6e58e', dirt: '#b088d8', dot: '#9a72c4', plank: '#ffb86b', plank2: '#b0662a', leaf: '#6ac6ff', bed: ['#ff8a8a', '#ffd36b', '#8ae08a', '#8ab8ff'], belly: [0.4, 0.69], voice: 1.0 },
};
