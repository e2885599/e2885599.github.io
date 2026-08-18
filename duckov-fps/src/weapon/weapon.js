// 武器系統（純邏輯，可單測）：射線檢測/彈匣/後坐力/冷卻
// 渲染層（槍口光/彈跡）由 engine 掛接，本模組只管狀態與物理

export class WeaponSystem {
  constructor(cfg) {
    if (!cfg || cfg.magSize <= 0) throw new RangeError('magSize 必須為正整數');
    this.cfg = Object.assign({
      name: 'rifle', magSize: 30, reserve: 90, damage: 28,
      fireRate: 110,        // 兩發間隔 ms（半自動/全自動同源，由 fire() 觸發）
      reloadTime: 1800,     // ms
      recoilPerShot: 0.12,  // 每發累積後坐力
      recoilDecay: 0.6,     // 每秒衰減
      range: 120,
      partMultipliers: { head: 2.2, torso: 1.0, limb: 0.6 },
      falloffStart: 25, falloffEnd: 110
    }, cfg);
    this.mag = this.cfg.magSize;
    this.reserve = this.cfg.reserve;
    this.cooldown = 0;       // 距下次可射 ms
    this.recoil = 0;         // 累積後坐力 0..1
    this.reloading = false;
    this.reloadTimer = 0;
  }

  // 每幀推進：後坐力衰減 + 裝填計時
  tick(dt) {
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - this.cfg.recoilDecay * dt);
    if (this.reloading) {
      this.reloadTimer -= dt * 1000;
      if (this.reloadTimer <= 0) {
        const need = this.cfg.magSize - this.mag;
        const take = Math.min(need, this.reserve);
        this.mag += take; this.reserve -= take; this.reloading = false;
      }
    }
  }

  canFire() {
    return !this.reloading && this.mag > 0 && this.cooldown <= 0;
  }

  // 觸發一發；返回 {fired, mag, reason}
  fire() {
    if (this.cooldown > 0) return { fired: false, reason: 'cooldown' };
    if (this.reloading) return { fired: false, reason: 'reloading' };
    if (this.mag <= 0) return { fired: false, reason: 'empty' };
    this.mag--;
    this.cooldown = this.cfg.fireRate;
    this.recoil = Math.min(1, this.recoil + this.cfg.recoilPerShot);
    return { fired: true, mag: this.mag, recoil: this.recoil };
  }

  startReload() {
    if (this.reloading || this.mag >= this.cfg.magSize || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadTimer = this.cfg.reloadTime;
    return true;
  }

  // 傷害計算（純函數）：base × 部位倍率 × 距離衰減
  damageAt(distance, part = 'torso') {
    const m = this.cfg.partMultipliers[part];
    if (m === undefined) throw new RangeError('未知部位: ' + part);
    const { falloffStart: s, falloffEnd: e } = this.cfg;
    let f;
    if (distance <= s) f = 1;
    else if (distance >= e) f = 0.2;
    else f = 1 - 0.8 * (distance - s) / (e - s);
    if (f < 0 || f > 1) throw new RangeError('距離衰減越界: ' + f);
    return this.cfg.damage * m * f;
  }
}
