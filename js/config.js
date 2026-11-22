// All tunable numbers for Times Squad v0.2 (the runner). Change these after playtests; no other file needs to change.
export const CONFIG = {
  VERSION: '0.2.0',
  PLAYERS: ['fox', 'panda', 'frog', 'owl'],
  // ---- Runner ----
  STEP_S: 1 / 60,                 // fixed simulation step
  SPEED_START: 11, SPEED_GAIN: 0.09, SPEED_MAX: 27, // m/s; brisk start, +0.09 m/s every second
  LANE_W: 2.2, LANE_SWITCH_S: 0.13,
  JUMP_V: 9, GRAVITY: 27, SLIDE_S: 0.65,
  SPAWN_AHEAD_M: 140,
  OBSTACLE_GAP_M: [30, 14],       // gap between obstacle groups at start speed / at max speed (plus some seeded spread)
  OBSTACLE_SPREAD_M: 12,
  SAFE_START_M: 40,
  // ---- Maths ----
  QUESTION_EVERY_M: [95, 60],     // from start / at max speed
  THINK_S: [3.4, 2.3],            // how early the sign shows before the numbers reach you (easy fact / hard + fast)
  MONSTER_AHEAD_S: 1.15,          // a monster appears this many seconds ahead after a pickup
  JAM_S: 1.5, HINT_S: 1.5,
  BLASTER_MAX_CHARGE: 3, ZAP_RANGE_M: 30,
  WANDER_MONSTER_EVERY_M: 160,
  // Harder with distance: which tables join the mix (all facts up to 12 x 12 by 1100 m)
  BANDS: [
    { from: 0, tables: [2, 5, 10, 3, 4] },
    { from: 250, tables: [2, 3, 4, 5, 10, 6, 11] },
    { from: 550, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { from: 1100, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  ],
  MIX: { due: 0.4, learning: 0.3, fresh: 0.2, known: 0.1 },
  NO_REPEAT_LAST: 3,
  // ---- Boss ----
  BOSS_EVERY_M: 500, BOSS_HP: [4, 8], BOSS_Q_EVERY_M_FACTOR: 0.6, BOSS_THROW_EVERY_S: 2.6, BOSS_COINS: 50,
  // ---- Powers ----
  POWER_STREAK: 5, POWERS: ['shield', 'magnet', 'jetpack', 'giant'],
  POWER_S: { shield: 12, magnet: 8, jetpack: 5, giant: 6 },
  POWER_BOX_EVERY_M: 330, MAGNET_RANGE_M: 14, JET_Y: 3.2,
  // ---- Score and coins ----
  SCORE: { meter: 1, coin: 5, right: 20, zap: 25, boss: 300, smash: 15 },
  COIN_LINE_EVERY_M: 55,
  TIER_COINS: { bronze: 10, silver: 20, gold: 40 },
  // ---- Learning (same spaced repetition as v0.1) ----
  GOLD_MEDIAN_MS: 3000, GOLD_DAYS: 3, SILVER_DAYS: 2,
  BOX_INTERVAL_DAYS: [0, 0, 1, 3, 7, 14],
  CONFUSION_DAYS: 14,
  MAX_CHOICES: 3,
  DISTRACTOR_WEIGHTS: { ADJ: 40, OBF: 35, SWP: 15, ADD: 10 },
  RULE_KEEP_PROB: 0.75,
  ATTEMPTS_KEEP: 2000, HISTORY_KEEP: 200, PLAYTIME_KEEP_DAYS: 60,
  IDLE_STOP_MS: 60000, INSTALL_TIP_EVERY_DAYS: 7, RESET_HOLD_MS: 3000,
  RETRY_GUARD_MS: 250,
};
