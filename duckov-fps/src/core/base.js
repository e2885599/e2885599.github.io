// 基地建造管理器（純邏輯，可單測 + 瀏覽器端可用）：資源扣減 + 依 requires 門禁
// 不依賴 node: 協議，資料由外部傳入（Node 測試讀檔 / 瀏覽器由 engine fetch 後傳入）
let _sharedData = null;
export function setBaseData(d) { _sharedData = d; }

export class BaseBuilder {
  constructor(data) {
    const d = data || _sharedData;
    if (!d) throw new Error('BaseBuilder 需要資料：傳入 data 或先 setBaseData');
    this.items = d.items;
    this.cats = d.categories;
    this.built = new Set();        // "catId@tier"
    this.stock = {};               // 物資庫存
    for (const it of this.items) this.stock[it] = 0;
  }

  _key(catId, tier) { return `${catId}@${tier}`; }

  // 依任務完成獲得物資（與 missions reward 並行，這裡只管物資）
  gain(item, n = 1) {
    if (!(item in this.stock)) throw new RangeError('未知物資: ' + item);
    this.stock[item] += n;
  }

  isBuilt(catId, tier) { return this.built.has(this._key(catId, tier)); }

  // 返回某類別已建最高層級（0 表示未建）
  tierOf(catId) {
    const c = this.cats.find((x) => x.id === catId);
    if (!c) return 0;
    let t = 0;
    for (let i = 1; i <= c.tiers.length; i++) if (this.isBuilt(catId, i)) t = i;
    return t;
  }

  canBuild(catId, tier) {
    const c = this.cats.find((x) => x.id === catId);
    if (!c) throw new RangeError('未知類別: ' + catId);
    if (tier < 1 || tier > c.tiers.length) throw new RangeError('層級越界: ' + catId + '@' + tier);
    if (this.isBuilt(catId, tier)) return false;
    const t = c.tiers[tier - 1];
    // 前置：同類別低一層 + requires
    if (tier > 1 && !this.isBuilt(catId, tier - 1)) return false;
    for (const r of t.requires || []) if (!this.built.has(r)) return false;
    // 資源足夠
    for (const [it, n] of Object.entries(t.cost)) if ((this.stock[it] || 0) < n) return false;
    return true;
  }

  build(catId, tier) {
    if (!this.canBuild(catId, tier)) throw new Error('不可建造: ' + catId + '@' + tier);
    const c = this.cats.find((x) => x.id === catId);
    const t = c.tiers[tier - 1];
    for (const [it, n] of Object.entries(t.cost)) this.stock[it] -= n;
    this.built.add(this._key(catId, tier));
    return { id: this._key(catId, tier), name: c.name, tier };
  }

  // 全圖可建成性（資源無限供給模擬）：從 power@1 開始遞迴解鎖
  canCompleteAllWithInfinite() {
    const b = new BaseBuilder({ items: this.items, categories: this.cats });
    for (const it of b.items) b.stock[it] = 1e9;
    let guard = 0;
    while (guard++ < 500) {
      let did = false;
      for (const c of b.cats) for (let t = 1; t <= c.tiers.length; t++) {
        if (b.canBuild(c.id, t)) { b.build(c.id, t); did = true; }
      }
      if (!did) break;
    }
    const total = b.cats.reduce((s, c) => s + c.tiers.length, 0);
    return b.built.size === total;
  }
}
