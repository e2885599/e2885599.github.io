// 傳送門核心：3D 雙門配對 + 保辛等距穿越變換 + 動量守恆
// 設計依據：DESIGN_SPEC.md ② 穿越變換公式（portal-lab portal3d_unified.html L353-410）
// 3D 版為唯一真相；2D 為 y 軸退化特例。
//
// 穿越變換矩陣（保辛等距）：
//   exitMatrix = orange.worldMatrix × flipY180 × inv(blue.worldMatrix)
// 速度大小不變（諾特荷守恆），僅方向依門相對朝向重映射。

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const PORTAL_RX = 34;   // 門橢圓半寬（水平）
const PORTAL_RY = 46;   // 門橢圓半高（垂直）
const PR = 16;          // 玩家半徑（對齊 engine.js 的 PR，用於穿越出口推出距離）
const TELE_COOLDOWN = 0.12; // 秒，防止穿門後立即回穿

export class PortalSystem {
  constructor(scene) {
    this.scene = scene;
    this.blue = null;    // { group, position:Vector3, normal:Vector3, mesh }
    this.orange = null;
    this.cooldown = 0;
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._onTeleport = null; // 外部回調（用於諾特荷計量）
  }

  onTeleport(cb) { this._onTeleport = cb; }

  clear() {
    for (const p of [this.blue, this.orange]) {
      if (p && p.group) this.scene.remove(p.group);
    }
    this.blue = null; this.orange = null; this.cooldown = 0;
  }

  // 在命中面（point, normal 指向場景內）放置指定顏色門
  place(color, point, normal) {
    const prev = color === 'blue' ? this.blue : this.orange;
    if (prev && prev.group) this.scene.remove(prev.group);

    const group = new THREE.Group();
    const col = color === 'blue' ? 0x33aaff : 0xff7700;

    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(PORTAL_RY, 6, 12, 36),
      new THREE.MeshBasicMaterial({ color: col })
    );
    torus.scale.set(PORTAL_RX / PORTAL_RY, 1, 1); // 在 XY 平面拉成橢圓
    group.add(torus);

    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(PORTAL_RY, 36),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    inner.scale.set(PORTAL_RX / PORTAL_RY, 1, 1);
    group.add(inner);

    const pl = new THREE.PointLight(col, 2.0, 260);
    pl.position.copy(point);
    group.add(pl);

    // 門面法線對齊：group 的 -Z 軸指向 normal（門朝場景內開口）
    group.position.copy(point);
    const lookTarget = this._tmp.copy(point).add(normal);
    group.lookAt(lookTarget);
    // 讓 torus/inner 的圓面落在 XY 平面且法線朝 normal：lookAt 使 +Z 朝向 normal，
    // 而 circle/torus 法線為 +Z，故旋轉 180° 使其開口朝法線正方向外側。
    group.rotateY(Math.PI);

    this.scene.add(group);

    const portal = {
      group,
      position: point.clone(),
      normal: normal.clone().normalize(),
      color,
    };
    if (color === 'blue') this.blue = portal; else this.orange = portal;
    return portal;
  }

  hasBoth() { return !!this.blue && !!this.orange; }

  // 嘗試穿越：prevCenter/nextCenter 為玩家膠囊中心（上一幀/本幀），vel 為當前速度向量
  // 回傳 { teleported:bool, position?:Vector3, velocity?:Vector3 } 或由內部直接設定
  tryTeleport(prevCenter, nextCenter, vel) {
    if (this.cooldown > 0) { this.cooldown -= 1 / 60; return null; }
    if (!this.hasBoth()) return null;

    const pairs = [[this.blue, this.orange], [this.orange, this.blue]];
    for (const [from, to] of pairs) {
      const n = from.normal;
      const s0 = prevCenter.clone().sub(from.position).dot(n);
      const s1 = nextCenter.clone().sub(from.position).dot(n);
      if (s0 > 0 && s1 <= 0) {
        // 由外穿入 from 門：檢查落點是否在門橢圓內
        const rel = this._tmp.copy(nextCenter).sub(from.position);
        const t = new THREE.Vector3().crossVectors(UP, n).normalize(); // 水平切向
        const tu = rel.dot(t);
        const uu = rel.dot(UP);
        const rx = PORTAL_RX, ry = PORTAL_RY;
        if ((tu * tu) / (rx * rx) + (uu * uu) / (ry * ry) > 1) continue; // 不在橢圓內

        // 保辛等距變換：以 from 門為基，旋轉到 to 門朝向（+180° 因雙門背對）
        const yAxis = UP;
        // to 門開口朝 -normal(to)（朝場景內）；from 門開口朝 -normal(from)
        // 穿越後速度：在 to 門局部座標重映射（承 portal-lab L376-405）
        const n2 = to.normal;
        const t2 = new THREE.Vector3().crossVectors(UP, n2).normalize();
        const ct = vel.dot(t);
        const cn = vel.dot(n);
        const vWorld = new THREE.Vector3(
          ct * t2.x - cn * n2.x,
          vel.y,
          ct * t2.z - cn * n2.z
        );

        // 新位置：在 to 門外側 offset（避免立即回穿）。
        // n2 指向場景內（門朝場景內開口），故「門外側」＝沿 -n2 推出 (PR+4)，
        // 再保留切向/垂直偏移，使玩家從牆面外側出現、不會卡在牆裡穿不過。
        const newPos = to.position.clone()
          .addScaledVector(n2, -(PR + 4))       // 沿 -法線 推出門外（PR=玩家半徑=16）
          .addScaledVector(t, tu)               // 切向偏移保持
          .addScaledVector(UP, uu);             // 垂直偏移保持

        this.cooldown = TELE_COOLDOWN;
        if (this._onTeleport) this._onTeleport({ from: from.color, to: to.color, vWorld });
        return { teleported: true, position: newPos, velocity: vWorld };
      }
    }
    return null;
  }
}

// 工具：依命中點與面法線產生「指向場景內」的法線
export function outwardNormal(faceNormal, pointToCamera) {
  const n = faceNormal.clone().normalize();
  if (n.dot(pointToCamera) < 0) n.negate(); // 確保法線指向相機（場景內）
  return n;
}
