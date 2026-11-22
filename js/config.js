// All tunable numbers for Times Squad v0.3 (the side-scroller). 1 T = 1 tile. Change these after playtests.
export const CONFIG = {
  VERSION: '0.3.0',
  PLAYERS: ['fox', 'panda', 'frog', 'owl'],
  // ---- view and physics (spec 4.1) ----
  STEP_S: 1 / 60, VIEW_W: 20, VIEW_H: 11.25, TILE_PX: 48,
  RUN_SPEED: 7, RUN_ACCEL_S: 0.15, GRAVITY: 50,
  JUMP_V: 17.3,               // 3 T high
  HOP_CUT_V: 12.2,            // letting go early: about 1.5 T hop (velocity is cut to this)
  BOOTS_JUMP_V: 24.5,         // 6 T high
  BOUNCE_V: 22.4,             // bounce mushroom: 5 T
  BOP_V: 14.2,                // bop bounce: 2 T
  COYOTE_S: 0.10, JUMP_BUFFER_S: 0.12,
  JUMP_HELP: { COYOTE_S: 0.2, JUMP_MULT: 1.15 },
  FOX_W: 1, FOX_H: 1.25,
  PIT_SINK_S: 0.6,
  // ---- layout (spec 4.2 - 4.5) ----
  MAX_GAP_T: 3.5, MAX_STEP_T: 2.5,
  BAY_W: 15, PLAT_W: 3, PLAT_GAP: 2, PLAT_Y: 2.5,
  SIGN_BEFORE_BAY_T: [35, 40],
  CURTAIN_OPEN_S: 0.6,
  // ---- answers (spec 5.6) ----
  CARD_S: 3.0, CARD2_S: 2.0, SINK_S: 0.4,
  RETURN_AFTER: [2, 3],
  MISS_LOOKBACK_DAYS: 14,
  POWER_ON_Q: [2, 4, 6],
  // ---- monsters and powers (spec 8) ----
  PINE_SPEED: 1.5, FROG_HOP_T: 2, FROG_EVERY_S: 1.6,
  PUSH_T: 2, BLINK_S: 1, DROP_ACORNS: 3, FLOWER_ACORNS: 3,
  POWER_S: 8, POWERS: ['boots', 'bubble'],
  // ---- medals (spec 6.2): Gold = E x 1.4, Silver = E x 1.9, rounded up to 5 s. E is measured by tools/expert.mjs. ----
  GOLD_X: 1.4, SILVER_X: 1.9, ROUND_TO_S: 5,
  EXPERT_S: { 'x2-L1': 112.4, 'x2-L2': 123.7, 'x2-L3': 116.2, 'x2-RR': 61.0 },  // replaced by measured values (see PROGRESS.md)
  GHOST_HZ: 10, GHOST_ALPHA: 0.4,
  // ---- boss (spec 7) ----
  BOSS_BOPS: 5, BOSS_DRIFT_V: 0.8, BOSS_DRIFT_T: 2, BOSS_SHRINK: 0.08, ATTACK_WARN_S: 1.2, ATTACK_S: 3,
  ATTACKS: ['spin', 'stomp', 'sneeze', 'spin'], WIND_V: 2,
  // ---- learning (same engine as v0.1 / v0.2) ----
  MAX_TABLE: 10,
  GOLD_MEDIAN_MS: 3000, GOLD_DAYS: 3, SILVER_DAYS: 2,
  BOX_INTERVAL_DAYS: [0, 0, 1, 3, 7, 14],
  CONFUSION_DAYS: 14,
  MAX_CHOICES: 3,
  DISTRACTOR_WEIGHTS: { ADJ: 40, OBF: 35, SWP: 15, ADD: 10 },
  RULE_KEEP_PROB: 0.75,
  ATTEMPTS_KEEP: 2000, HISTORY_KEEP: 200, PLAYTIME_KEEP_DAYS: 60,
  IDLE_STOP_MS: 60000, INSTALL_TIP_EVERY_DAYS: 7, RESET_HOLD_MS: 3000,
};
// Medal targets in seconds for a level (rounded up to 5 s).
export function targets(levelId) {
  const E = CONFIG.EXPERT_S[levelId] || 120, up = (s) => Math.ceil(s / CONFIG.ROUND_TO_S) * CONFIG.ROUND_TO_S;
  return { gold: up(E * CONFIG.GOLD_X), silver: up(E * CONFIG.SILVER_X) };
}
