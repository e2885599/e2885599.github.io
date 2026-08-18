// 基地建築實例化（場景端可見建築，對齊基地類別）
// 不頂層依賴 three：mesh 工廠由外部注入（瀏覽器端傳 three 幾何工廠，Node 測試傳 stub）
// 類別清單 + 視覺（color/shape）全部由 base.json 單一真相源派生，無獨立映射表

// 從 base.json 資料動態派生類別物件清單（單一真相源：建築數 = 基地類別數）
export function deriveCategories(baseData) {
  if (!baseData || !Array.isArray(baseData.categories)) throw new Error('baseData.categories 必須為陣列');
  return baseData.categories;
}

// 由場景 bbox + 類別清單（含 visual）程式化推導建築座標（自適應佈局，消除手寫漂移）
// categoryObjs: [{id, name, visual:{color,shape}}]（由 base.json 派生）
export function computeLayout(box, categoryObjs) {
  if (!Array.isArray(categoryObjs) || categoryObjs.length === 0) throw new Error('computeLayout 需傳入 categoryObjs');
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const halfX = (box.maxX - box.minX) / 2;
  const halfY = (box.maxY - box.minY) / 2;
  const half = Math.max(halfX, halfY);            // 倉庫半徑
  const perimeter = 2 * (halfX + halfY);          // 倉庫周長
  const gap = perimeter / categoryObjs.length;     // 自適應間距 = 周長/N
  const R = half + Math.max(gap, 6) * 0.5;        // 外圍半徑：依周長間距縮放（下限 6m）

  // 多層：若倉庫高度超過閾值，N 棟分為地面環 + 頂層環
  const hMin = box.minH ?? 0, hMax = box.maxH ?? 0;
  const height = hMax - hMin;
  const LAYER_TH = 8;                              // 高度超過 8m 視為多層
  const n = categoryObjs.length;
  let layers;
  if (height > LAYER_TH) {
    const groundN = Math.ceil(n / 2);
    layers = [
      { count: groundN, yOffset: 1.5 },
      { count: n - groundN, yOffset: hMax - 1.5 },
    ];
  } else {
    layers = [{ count: n, yOffset: 1.5 }];
  }

  const slots = [];
  let idx = 0;
  for (const layer of layers) {
    const r = R;
    for (let i = 0; i < layer.count; i++) {
      const c = categoryObjs[idx++];
      const v = c.visual || { color: 0x94a3b8, shape: 'box' };
      const ang = (i / layer.count) * Math.PI * 2 - Math.PI / 2;
      slots.push({
        id: c.id, name: c.name || c.id, color: v.color, shape: v.shape,
        pos: [cx + r * Math.cos(ang), cy + r * Math.sin(ang), layer.yOffset],
      });
    }
  }
  return slots;
}

// 預設 three 幾何工廠（瀏覽器端使用）；Node 測試可傳 stub 工廠
export function defaultMeshFactory(shape, color) {
  throw new Error('defaultMeshFactory 需在瀏覽器端由 engine 注入 three 幾何工廠');
}

export class BaseBuilder3D {
  constructor(scene, meshFactory = defaultMeshFactory) {
    this.scene = scene;
    this.factory = meshFactory;
    this.slots = [];
    this.meshes = new Map();   // catId -> mesh
  }

  // 由場景 bbox + 類別清單設定建築佈局並實例化（初始隱形）
  buildLayout(box, categoryIds) {
    this.slots = computeLayout(box, categoryIds);
    for (const slot of this.slots) {
      const m = this.factory(slot.shape, slot.color);
      m.position.set(slot.pos[0], slot.pos[1], slot.pos[2] + (slot.shape === 'gate' ? -2 : 1.5));
      m.name = 'building_' + slot.id;
      m.visible = false;       // 未建造前隱形
      this.scene.add(m);
      this.meshes.set(slot.id, m);
    }
  }

  // 建造成功一級 → 顯示對應建築（含層級縮放反饋）
  onBuilt(catId, tier) {
    const m = this.meshes.get(catId);
    if (m) {
      m.visible = true;
      const s = 0.6 + 0.2 * tier;   // 層級越高越大
      m.scale.setScalar(s);
      if (catId === 'extraction' && m.material) m.material.emissiveIntensity = 1.2;  // 終局出口高亮
    }
  }
}

// 瀏覽器端 three 幾何工廠（由 engine 在可取得 THREE 時傳入）
export function makeThreeMeshFactory(THREE) {
  return function (shape, color) {
    let geo;
    if (shape === 'tower') geo = new THREE.CylinderGeometry(1.2, 1.6, 8, 12);
    else if (shape === 'gate') geo = new THREE.BoxGeometry(4, 3, 1.5);
    else geo = new THREE.BoxGeometry(4, 3, 4);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.7, metalness: 0.2 });
    return new THREE.Mesh(geo, mat);
  };
}
