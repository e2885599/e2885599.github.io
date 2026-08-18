// 難度模型雙樣本驗收（PASS 樣本 + FAIL 樣本，驗證鑑別力）
// 執行：node tests/test_difficulty.mjs
import { baselineDifficulty, difficultyAt, adaptOffset, CHAPTERS } from '../src/core/difficulty.js';

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

console.log('— PASS 樣本（已知應通過）—');
// 1. 開局低密度
const d0 = baselineDifficulty(0);
ok('開局敵人密度低 (<1.2)', d0.enemyDensity < 1.2);
ok('開局敵人傷害倍率 <1.0', d0.enemyDamageMul < 1.0);
// 2. 中段中等
const d5 = baselineDifficulty(0.5);
ok('中段密度爬升 (>1.2 且 <2.2)', d5.enemyDensity > 1.2 && d5.enemyDensity < 2.2);
// 3. 終局高密度+Boss尖峰
const d1 = baselineDifficulty(1);
ok('終局密度達峰值 (>2.3)', d1.enemyDensity > 2.3);
ok('終局傷害倍率達峰值 (>1.5)', d1.enemyDamageMul > 1.5);
// 4. 章數正確
ok('章數=8', CHAPTERS === 8);
// 5. 自適應：好表現降難
const good = adaptOffset({ kdr: 3, hitRate: 0.8, deathsPerHour: 1 });
const bad = adaptOffset({ kdr: 0.3, hitRate: 0.2, deathsPerHour: 8 });
ok('好表現偏移為負(降難)', good < 0);
ok('差表現偏移為正(升難)', bad > 0);
// 6. 合併不越界
const da = difficultyAt(0.5, { kdr: 2, hitRate: 0.6, deathsPerHour: 3 });
ok('合併反應時間 ≥0.2', da.reactionTime >= 0.2);
ok('合併命中率 ∈[0,1]', da.enemyAccuracy >= 0 && da.enemyAccuracy <= 1);

console.log('— FAIL 樣本（已知應拋錯，驗證鑑別力）—');
let threw = false;
try { baselineDifficulty(1.5); } catch (e) { threw = e instanceof RangeError; }
ok('progress=1.5 拋 RangeError', threw);
threw = false;
try { baselineDifficulty(-0.2); } catch (e) { threw = e instanceof RangeError; }
ok('progress=-0.2 拋 RangeError', threw);
threw = false;
try { baselineDifficulty('x'); } catch (e) { threw = e instanceof RangeError; }
ok('progress=字串 拋 RangeError', threw);

console.log(`\n結果：${pass} 通過 / ${fail} 失敗`);
process.exit(fail === 0 ? 0 : 1);
