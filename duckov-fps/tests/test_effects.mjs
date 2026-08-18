// 基地建造玩法效果驗收：effect 欄由 base.json 派生 + applyEffect 注入引擎狀態
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newEffects, applyEffect, applyAllEffects } from '../src/core/effects.js';

const P = join(fileURLToPath(new URL('..', import.meta.url)), 'assets/base/base.json');
let fail = 0;
const ok = (n, c, e='') => { if (c) console.log('  PASS  ' + n + (e ? ' (' + e + ')' : '')); else { fail++; console.log('  FAIL  ' + n + (e ? ' (' + e + ')' : '')); } };

// 1) base.json 每類別含 effect 欄（單一真相源）
const d = JSON.parse(readFileSync(P, 'utf-8'));
ok('每類別含 effect 欄', d.categories.every((c) => c.effect && c.effect.type));
const effOf = (id) => d.categories.find((c) => c.id === id).effect;
ok('medical.effect = heal_rate/4', effOf('medical').type === 'heal_rate' && effOf('medical').value === 4);
ok('armory.effect = unlock_weapon/rifle', effOf('armory').type === 'unlock_weapon' && effOf('armory').id === 'rifle');
ok('training.effect = recoil_mul/0.9', effOf('training').type === 'recoil_mul' && effOf('training').value === 0.9);
ok('defense.effect = enemy_dmg_mul/0.9', effOf('defense').type === 'enemy_dmg_mul' && effOf('defense').value === 0.9);
ok('supply.effect = move_mul/1.1', effOf('supply').type === 'move_mul' && effOf('supply').value === 1.1);
ok('extraction.effect = win_flag', effOf('extraction').type === 'win_flag');
ok('power/comms/scout/water/research = none', ['power','comms','scout','water','research'].every((id) => effOf(id).type === 'none'));

// 2) applyEffect 注入正確
let e = newEffects();
applyEffect(e, effOf('medical'));
ok('applyEffect 注入 healRate=4', e.healRate === 4);
applyEffect(e, effOf('armory'));
ok('applyEffect 注入 unlockedWeapons 含 rifle', e.unlockedWeapons.has('rifle'));
applyEffect(e, effOf('training'));
ok('applyEffect 注入 recoilMul=0.9', e.recoilMul === 0.9);
applyEffect(e, effOf('defense'));
ok('applyEffect 注入 enemyDmgMul=0.9', e.enemyDmgMul === 0.9);
applyEffect(e, effOf('supply'));
ok('applyEffect 注入 moveMul=1.1', Math.abs(e.moveMul - 1.1) < 1e-9);
applyEffect(e, effOf('extraction'));
ok('applyEffect 注入 winFlag=true', e.winFlag === true);

// 3) 多級疊加取最優（最小乘數）
let e2 = newEffects();
applyEffect(e2, { type: 'recoil_mul', value: 0.9 });
applyEffect(e2, { type: 'recoil_mul', value: 0.8 });   // 更優（更小）
ok('recoil_mul 多級取最小=0.8', Math.abs(e2.recoilMul - 0.8) < 1e-9);
let e3 = newEffects();
applyEffect(e3, { type: 'heal_rate', value: 4 });
applyEffect(e3, { type: 'heal_rate', value: 6 });
ok('heal_rate 多級取最大=6', e3.healRate === 6);

// 4) applyAllEffects：傳入已建集合，補齊 effect
const cats = d.categories.map((c) => ({ id: c.id, effect: c.effect, tiers: c.tiers, built: new Set(['medical@1','armory@1','extraction@1']) }));
let e4 = newEffects();
applyAllEffects(e4, cats);
ok('applyAllEffects 補齊 medical+armory+extraction', e4.healRate === 4 && e4.unlockedWeapons.has('rifle') && e4.winFlag === true);
ok('applyAllEffects 未建類別不生效', e4.recoilMul === 1 && e4.enemyDmgMul === 1 && e4.moveMul === 1);

// 5) none 類別不污染
let e5 = newEffects();
for (const c of d.categories) if (c.effect.type === 'none') applyEffect(e5, c.effect);
ok('none 類別不污染 effects', e5.healRate === 0 && e5.moveMul === 1 && e5.unlockedWeapons.size === 0 && !e5.winFlag);

console.log(`\n結果：${fail === 0 ? 'ALL PASS' : fail + ' 失敗'}`);
process.exit(fail === 0 ? 0 : 1);
