// 基地建造產生的玩法效果注入器（純邏輯，可單測 + 瀏覽器端可用）
// effects: { healRate, moveMul, recoilMul, enemyDmgMul, unlockedWeapons:Set, winFlag }
// eff: { type, value?, id? }（來自 base.json 的 categories[].effect）

export function newEffects() {
  return { healRate: 0, moveMul: 1, recoilMul: 1, enemyDmgMul: 1, unlockedWeapons: new Set(), winFlag: false };
}

export function applyEffect(effects, eff) {
  if (!eff || !eff.type || eff.type === 'none') return effects;
  switch (eff.type) {
    case 'heal_rate':     effects.healRate = Math.max(effects.healRate, eff.value); break;
    case 'move_mul':       effects.moveMul = Math.max(effects.moveMul, eff.value); break;   // 取最優（最大乘數=最快）
    case 'recoil_mul':    effects.recoilMul = Math.min(effects.recoilMul, eff.value); break;
    case 'enemy_dmg_mul': effects.enemyDmgMul = Math.min(effects.enemyDmgMul, eff.value); break;
    case 'unlock_weapon': effects.unlockedWeapons.add(eff.id); break;
    case 'win_flag':      effects.winFlag = true; break;
    default: break;
  }
  return effects;
}

export function applyAllEffects(effects, cats) {
  for (const c of cats) {
    for (let t = 1; t <= c.tiers.length; t++) {
      if (c.built && c.built.has && c.built.has(c.id + '@' + t)) applyEffect(effects, c.effect);
    }
  }
  return effects;
}
