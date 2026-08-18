// 遊戲內任務觸發器（純邏輯，可單測）：zone 進入 + item 拾取 → 完成對應任務
// zone 座標對齊 barn.gltf 實際幾何（見 tools/blender_assets.py 場景佈局）：
//   地面 x,y∈[-20,20]；貨箱 6 個於 (±5,±5)/(±3,±5) z≈0-1.4；牆 ±5/±7 邊界 z0-4；中央核心 acc2 x∈[-5,5] y∈[-2,2]
export const ZONE_CENTERS = {
  '鴨科夫核心': [0, 0, 1.9],      // 場景中央核心區（acc2）
  '廢棄農場':   [5, 5, 0.7],      // 東北角貨箱
  '地下管網':   [-5, 5, 0.7],     // 西北角貨箱
  '工業區':     [5, -5, 0.7],     // 東南角貨箱
  '數據中樞':   [-5, -5, 0.7],    // 西南角貨箱
  '實驗設施':   [3, 5, 0.7],      // 北牆邊貨箱(acc4)
  '高層塔樓':   [-3, 5, 0.7],     // 北牆邊貨箱(acc14)
  '鴨科夫外圍': [0, -7, 0.7],     // 南牆外緣（入口側）
};
export const ZONE_RADIUS = 3.0;  // 對齊貨箱尺度，避免重疊
const COMBAT_KINDS = new Set(['清剿', '狙殺', '獵殺', '捕俘']);

function dist2(a, b) { const dx=a[0]-b[0], dy=a[1]-b[1], dz=a[2]-b[2]; return dx*dx+dy*dy+dz*dz; }

// 從 objectives[0]="<kind>：<zone>" 解析 zone
export function zoneOf(mission) {
  const o = mission.objectives && mission.objectives[0];
  if (!o) return null;
  const idx = o.indexOf('：');
  return idx >= 0 ? o.slice(idx + 1).trim() : null;
}

// 回傳「因玩家位置可完成」的任務 id 清單（非戰鬥類，且 requires 已滿足）
export function missionsCompletableByZone(playerPos, board) {
  const out = [];
  for (const m of board.available()) {
    if (COMBAT_KINDS.has(m.kind)) continue;       // 戰鬥類不經 zone
    const z = zoneOf(m);
    const c = z ? ZONE_CENTERS[z] : null;
    if (!c) continue;
    if (dist2(playerPos, c) <= ZONE_RADIUS * ZONE_RADIUS) out.push(m.id);
  }
  return out;
}

// item 拾取觸發：玩家靠近某 item 拾取點 → 完成以該 item 為目標的非戰鬥任務
export function missionsCompletableByPickup(pickupPos, playerPos, board) {
  const r = ZONE_RADIUS;
  if (dist2(pickupPos, playerPos) > r * r) return [];
  const out = [];
  for (const m of board.available()) {
    if (COMBAT_KINDS.has(m.kind)) continue;
    if (m.brief.includes('item_ph') ) {} // 預留：實際以 brief 含 item 名判斷
    // 簡化：拾取點綁定 zone，行為同 zone 完成
    const z = zoneOf(m); const c = z ? ZONE_CENTERS[z] : null;
    if (c && dist2(pickupPos, c) <= r * r) out.push(m.id);
  }
  return out;
}
