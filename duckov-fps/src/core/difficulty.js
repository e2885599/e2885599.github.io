// 難度曲線模型（純函數，可單測，雙樣本驗收）
// 固定曲線：progress∈[0,1] → 五分量；自適應 offset：依玩家表現偏移 ±20%

export const CHAPTERS = 8;

// 將數值限制在 [0,1]
export function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

// 平滑階梯：0→0, 0.5→0.5, 1→1，兩端緩動
export function smoothstep(t) {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
}

// 固定基線難度。progress 越界拋 RangeError（供測試驗證鑑別力）
export function baselineDifficulty(progress) {
  if (typeof progress !== 'number' || progress < 0 || progress > 1) {
    throw new RangeError('progress 必須是 [0,1] 的數值');
  }
  // 全域遞增：0.15 → 1.0
  const global = 0.15 + 0.85 * smoothstep(progress);
  // 章內波動：每章先升後微降，幅度 ±0.08
  const chapterPhase = (progress * CHAPTERS) % 1;
  const wave = 0.08 * Math.sin(chapterPhase * Math.PI);
  // 終局 Boss 尖峰：progress>0.92 再疊 +0.25
  const bossSpike = progress > 0.92 ? ((progress - 0.92) / 0.08) * 0.25 : 0;
  const base = clamp01(global + wave + bossSpike);

  return {
    enemyDensity: 0.6 + 1.8 * base,    // 0.6 → 2.4
    enemyDamageMul: 0.7 + 0.9 * base,  // 0.7 → 1.6
    enemyAccuracy: 0.25 + 0.55 * base, // 0.25 → 0.80
    ammoScarcity: 0.3 + 0.7 * base,    // 0.3 → 1.0
    reactionTime: 0.9 - 0.55 * base    // 0.90s → 0.35s
  };
}

// 自適應偏移：perf={kdr, hitRate, deathsPerHour} → offset∈[-0.2,0.2]
export function adaptOffset(perf) {
  if (!perf) return 0;
  const kdr = Number.isFinite(perf.kdr) ? perf.kdr : 1;
  const hitRate = clamp01(perf.hitRate ?? 0.5);
  const dph = Number.isFinite(perf.deathsPerHour) ? perf.deathsPerHour : 2;
  // 技巧分：K/D(權0.4) + 命中率(權0.4) + 低死亡頻(權0.2)
  const skill = clamp01((kdr / 3) * 0.4 + hitRate * 0.4 + (1 - Math.min(1, dph / 8)) * 0.2);
  return (0.5 - skill) * 0.4; // skill 高→負（降難）
}

// 合併：固定基線 × 自適應偏移
export function difficultyAt(progress, perf) {
  const b = baselineDifficulty(progress);
  const off = adaptOffset(perf);
  const shift = (x) => Math.max(0.05, x * (1 + off));
  return {
    enemyDensity: shift(b.enemyDensity),
    enemyDamageMul: shift(b.enemyDamageMul),
    enemyAccuracy: clamp01(b.enemyAccuracy * (1 + off)),
    ammoScarcity: clamp01(b.ammoScarcity * (1 + off)),
    reactionTime: Math.max(0.2, b.reactionTime * (1 - off))
  };
}
