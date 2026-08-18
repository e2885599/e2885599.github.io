// 基地建造玩法效果驗收（續）：手動建造門禁 + 逃生通道空間門禁
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseBuilder } from '../src/core/base.js';

const P = join(fileURLToPath(new URL('..', import.meta.url)), 'assets/base/base.json');
let fail = 0;
const ok = (n, c, e='') => { if (c) console.log('  PASS  ' + n + (e ? ' (' + e + ')' : '')); else { fail++; console.log('  FAIL  ' + n + (e ? ' (' + e + ')' : '')); } };

const d = JSON.parse(readFileSync(P, 'utf-8'));

// 1) tierOf 正確回報已建最高層級
const b = new BaseBuilder(d);
ok('初始 tierOf(power)=0', b.tierOf('power') === 0);
b.stock['能量電池'] = 999; b.stock['反應爐芯'] = 999;
b.build('power', 1); b.build('power', 2);
ok('建 power@1,2 後 tierOf(power)=2', b.tierOf('power') === 2);
ok('tierOf(unknown)=0', b.tierOf('nope') === 0);

// 2) 手動建造門禁：資源不足時 canBuild=false（玩家點擊會收到「資源不足」回饋而非靜默建成）
const b2 = new BaseBuilder(d);
b2.stock['能量電池'] = 0;  // 不足
ok('資源不足時 power@1 不可建', b2.canBuild('power', 1) === false);
ok('資源不足時手動建造會被擋（模擬 _manualBuild 前置檢查）', !b2.canBuild('power', 1));
b2.stock['能量電池'] = 2; b2.stock['反應爐芯'] = 1;
ok('資源足時 power@1 可建', b2.canBuild('power', 1) === true);

// 3) requires 門禁：supply 需 power@1 先建
const b3 = new BaseBuilder(d);
b3.stock['能量電池'] = 999; b3.stock['反應爐芯'] = 999;
ok('power 未建時 supply@1 不可建（requires power@1）', b3.canBuild('supply', 1) === false);
b3.build('power', 1);
ok('power@1 建後 supply@1 可建', b3.canBuild('supply', 1) === true);

// 4) 逃生通道空間門禁（純函式，不依賴 three）
// 玩家須走進 gate 半徑內才通關；建成只是置 winFlag，不立即 win
function checkWinCondition(playerPos, gatePos, radius) {
  const dx = playerPos[0] - gatePos[0];
  const dy = playerPos[1] - gatePos[1];
  return Math.hypot(dx, dy) < radius;
}
const gate = [0, 17];  // 逃生通道位置（地面環推算，見 base3d computeLayout 單層 ±20 → R≈23.6，此處用抽象座標驗證邏輯）
ok('玩家遠離 gate → 不通關', checkWinCondition([0, 0], gate, 3.5) === false);
ok('玩家走進 gate 半徑 → 通關', checkWinCondition([0.5, 16.8], gate, 3.5) === true);
ok('半徑邊界外 3.6 → 不通關', checkWinCondition([0, 13.4], gate, 3.5) === false);

// 5) 流程模擬：逃生通道建成（winFlag=true）但玩家未到 → 不 win；走到 → win
let winFlag = false, won = false, playerPos = [0, 0];
// 建成逃生通道（模擬 build + applyEffect）
const b4 = new BaseBuilder(d);
b4.stock = { 反應爐芯: 99, 通訊模組: 99, 基因序列: 99, 加密硬碟: 99, 能量電池: 99 };
// 滿足 requires: research@1, power@2, comms@2
b4.stock['能量電池'] = 99;
b4.build('power', 1); b4.build('power', 2);
b4.build('comms', 1); b4.build('comms', 2);
b4.build('research', 1);
const canExt = b4.canBuild('extraction', 1);
ok('滿足前置後 extraction@1 可建', canExt === true);
if (canExt) { b4.build('extraction', 1); winFlag = true; }
ok('逃生通道建成 → winFlag=true', winFlag === true);
ok('建成但玩家未到 → 尚未通關', won === false);
playerPos = [0, 17];
if (winFlag && !won && checkWinCondition(playerPos, gate, 3.5)) won = true;
ok('玩家走到 gate → 通關', won === true);

console.log(`\n結果：${fail === 0 ? 'ALL PASS' : fail + ' 失敗'}`);
process.exit(fail === 0 ? 0 : 1);
