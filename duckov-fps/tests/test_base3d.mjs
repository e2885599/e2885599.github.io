// 基地建築驗收（bbox 推導佈局版）：computeLayout 由場景範圍推導 11 均布外圍座標
// 不依賴 three（專案 three 走 CDN），用最小 stub scene + stub 工廠
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLayout, deriveCategories, BaseBuilder3D } from '../src/render/base3d.js';

const P = join(fileURLToPath(new URL('..', import.meta.url)), 'assets/base/base.json');
let fail = 0;
const ok = (n, c, e='') => { if (c) console.log('  PASS  ' + n + (e ? ' (' + e + ')' : '')); else { fail++; console.log('  FAIL  ' + n + (e ? ' (' + e + ')' : '')); } };

// 1) 類別清單由 base.json 動態派生（單一真相源：建築數 = 基地類別數）
const d = JSON.parse(readFileSync(P, 'utf-8'));
const cats = deriveCategories(d);
ok('deriveCategories 返回 11 個物件', cats.length === 11, cats.length + ' 個');
ok('物件含 id/name/visual', cats.every((c) => c.id && c.name && c.visual && 'color' in c.visual && 'shape' in c.visual));
ok('與 base.json categories 一致', cats.every((c, i) => c.id === d.categories[i].id));
const idsSet = new Set(cats.map((c) => c.id));

// 1b) computeLayout 用動態 cats 推導座標，且數量與類別一致
const box = { minX: -20, maxX: 20, minY: -20, maxY: 20, minH: 0, maxH: 4 };  // barn 地面 ±20
const slots = computeLayout(box, cats);
ok('推導座標數 = 類別數 (11)', slots.length === cats.length, slots.length + ' 個');
for (const s of slots) ok('slot ' + s.id + ' 對應基地類別', idsSet.has(s.id));
const slotIds = new Set(slots.map((s) => s.id));
ok('與基地類別雙向一一對應', [...idsSet].every((i) => slotIds.has(i)) && idsSet.size === slotIds.size);
// 視覺欄由 base.json 單一來源派生（無獨立映射表）
const powerSlot = slots.find((s) => s.id === 'power');
ok('視覺 color 來自 base.json (power=0xf59e0b)', powerSlot.color === 0xf59e0b, '0x' + powerSlot.color.toString(16));
ok('視覺 shape 來自 base.json (power=tower)', powerSlot.shape === 'tower');
const extSlot = slots.find((s) => s.id === 'extraction');
ok('逃生通道 visual (0x00ff88/gate) 來自 base.json', extSlot.color === 0x00ff88 && extSlot.shape === 'gate');

// 1c) 增删類別零手動同步：加第 12 類「機場」→ 自動產 12 棟，無需改 base3d 內建陣列
const d12 = JSON.parse(JSON.stringify(d));
d12.categories.push({ id: 'airport', name: '機場', visual: { color: 0xff8800, shape: 'box' }, tiers: [{ cost: {} }] });
const cats12 = deriveCategories(d12);
const slots12 = computeLayout(box, cats12);
ok('增類別自動產 12 棟（零手動同步）', slots12.length === 12 && slots12[11].id === 'airport', slots12.length + ' 棟');
ok('新增類別視覺也由 base.json 派生', slots12[11].color === 0xff8800 && slots12[11].shape === 'box');
// 移除一類 → 自動 10 棟
const d10 = JSON.parse(JSON.stringify(d));
d10.categories = d10.categories.filter((c) => c.id !== 'power');
const slots10 = computeLayout(box, deriveCategories(d10));
ok('刪類別自動變 10 棟', slots10.length === 10, slots10.length + ' 棟');
// 2) 自適應間距：倉庫極大時間距隨周長縮放，外圍半徑不會過疏
const huge = { minX: -200, maxX: 200, minY: -200, maxY: 200, minH: 0, maxH: 4 };
const slotsHuge = computeLayout(huge, cats);
const rHuge = Math.hypot(slotsHuge[0].pos[0], slotsHuge[0].pos[1]);
// half=200, perimeter=800, gap=800/11≈72.7, R=200+72.7*0.5≈236.4
ok('極大倉庫外圍半徑依周長自適應 (~236)', Math.abs(rHuge - 236.4) < 1, rHuge.toFixed(1));
// 相鄰建築間距 = 弧長 = R × (2π/11) ≈ 236.4 × 0.5712 ≈ 135.1（自適應隨周長縮放，非固定6）
const arc = rHuge * (2 * Math.PI / 11);
ok('極大倉庫相鄰間距≈135（自適應隨周長）', Math.abs(arc - 135.1) < 2, arc.toFixed(1));

// 3) 多層分佈：倉庫高度>8m 時分地面環+頂層環
const tall = { minX: -20, maxX: 20, minY: -20, maxY: 20, minH: 0, maxH: 30 };
const slotsTall = computeLayout(tall, cats);
ok('高倉庫產 11 棟', slotsTall.length === 11);
const groundYs = slotsTall.filter((s) => Math.abs(s.pos[2] - 1.5) < 0.1).length;
const topYs = slotsTall.filter((s) => Math.abs(s.pos[2] - (30 - 1.5)) < 0.1).length;
ok('地面環 + 頂層環分佈', groundYs === 6 && topYs === 5, 'ground=' + groundYs + ' top=' + topYs);

// 4) 均布性（單層）：最大角度間隔≤34°
const R = 20 + Math.max((2*(20+20))/11, 6) * 0.5;
const angles = slots.map((s) => Math.atan2(s.pos[1] - 0, s.pos[0] - 0));
let maxGap = 0;
for (let i = 0; i < angles.length; i++) {
  const a = angles[i], b = angles[(i + 1) % angles.length];
  let gap = Math.abs(a - b); if (gap > Math.PI) gap = 2 * Math.PI - gap;
  maxGap = Math.max(maxGap, gap);
}
ok('11 建築均布（最大角度間隔≤34°）', maxGap <= 34 * Math.PI / 180, (maxGap * 180 / Math.PI).toFixed(1) + '°');

// 5) 外圍半徑正確（單層 ±20 → half=20, perimeter=80, gap=80/11≈7.27>6, R=20+7.27*0.5=23.64）
const r0 = Math.hypot(slots[0].pos[0], slots[0].pos[1]);
ok('單層外圍半徑 = half + max(gap,6)*0.5 ≈ 23.64', Math.abs(r0 - 23.64) < 0.01, r0.toFixed(2));

// 6) 倉庫變大 → 建築自動外移（消除手寫漂移）
const big = { minX: -40, maxX: 40, minY: -40, maxY: 40, minH: 0, maxH: 4 };
const slots2 = computeLayout(big, cats);
const r2 = Math.hypot(slots2[0].pos[0], slots2[0].pos[1]);
ok('倉庫擴大後建築自動外移', Math.abs(r2 - 47.27) < 1 && r2 > r0, 'r=' + r2.toFixed(2) + ' > ' + r0.toFixed(2));

// 5) 實例化 + 初始隱形 + 建造成功轉可見（stub 工廠）
class StubScene { constructor() { this._o = []; } add(o) { this._o.push(o); } getObjectByName(n) { return this._o.find((o) => o.name === n) || null; } }
function stubFactory() {
  const scale = { x: 1, setScalar(s) { this.x = s; } };
  return { name: '', visible: false, position: { set() {} }, scale, material: { emissiveIntensity: 0.4 } };
}
const scene = new StubScene();
const b3d = new BaseBuilder3D(scene, stubFactory);
b3d.buildLayout(box, cats);
let hidden = 0;
for (const s of slots) { const m = scene.getObjectByName('building_' + s.id); if (m && m.visible === false) hidden++; }
ok('所有建築初始隱形', hidden === 11, hidden + '/11');
b3d.onBuilt('extraction', 3);
const em = scene.getObjectByName('building_extraction');
ok('逃生通道建造成功轉可見', em && em.visible === true);
ok('逃生通道高亮', em.material.emissiveIntensity === 1.2);
ok('層級縮放反映 Lv3', Math.abs(em.scale.x - (0.6 + 0.2 * 3)) < 1e-6);

console.log(`\n結果：${fail === 0 ? 'ALL PASS' : fail + ' 失敗'}`);
process.exit(fail === 0 ? 0 : 1);
