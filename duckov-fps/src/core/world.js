import * as THREE from 'three';
import { loadGltf } from './loader.js';
import { NPC } from '../npc/npc.js';
import { ZONE_CENTERS } from './triggers.js';

export class World {
  constructor(engine) {
    this.engine = engine;
    this.npcs = [];
    this.loaded = false;
  }

  async load() {
    const scene = this.engine.scene;
    const engine = this.engine;
    // 載入場景（含 data URI 自包含 glTF）
    // MVP 場景：程序化地面 + 掩體盒（不依賴不存在的 barn.gltf）
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x3a5f3a, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const cover = await loadGltf('assets/models/Box/Box.glb');
    for (let i = 0; i < 4; i++) {
      const c = cover.scene.clone();
      c.position.set((i - 1.5) * 6, 0.5, -3 - i);
      c.scale.setScalar(1.5);
      scene.add(c);
    }
    this.barn = ground;  // 留引用供基地佈局計算 bbox
    // 載入武器（玩家手持，縮放後掛相機）—MVP 指向已生成的 weapon_00.glb
    const gun = await loadGltf('assets/models/weapon/weapon_00.glb');
    const gunMesh = gun.scene;
    gunMesh.scale.setScalar(0.25);
    gunMesh.position.set(0.25, -0.25, -0.6);
    engine.camera.add(gunMesh);
    scene.add(engine.camera);
    // 佈署 3 名敵人（難度由 engine.currentDifficulty() 注入更新）—MVP 指向已生成的 duck_armorer.glb（鴨子敵人）
    for (let i = 0; i < 3; i++) {
      const enemy = await loadGltf('assets/models/duck_armorer/duck_armorer.glb');
      const obj = enemy.scene;
      obj.position.set((i - 1) * 4, 0, -6 - i * 2);
      obj.scale.setScalar(1.0);
      const npc = new NPC({ id: 'duck' + i, pos: [obj.position.x, obj.position.y, obj.position.z], hp: 100 });
      npc.object = obj;
      this.npcs.push(npc);
      engine.add(npc);
      scene.add(obj);
    }
    this.loaded = true;
    this._spawnZoneMarkers(scene);
    return this;
  }

  _spawnZoneMarkers(scene) {
    // 在場景真實幾何位置放可見發光柱，標示 8 個任務 zone（空間自洽）
    for (const [name, c] of Object.entries(ZONE_CENTERS)) {
      const geo = new THREE.CylinderGeometry(0.3, 0.3, 3, 12);
      const mat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 1.5, transparent: true, opacity: 0.6 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(c[0], (c[2] || 0) + 1.5, c[1]);  // 注意：場景用 (x,z,y)? 這裡按世界 (x,y,z) 對齊
      m.name = 'zoneMarker_' + name;
      scene.add(m);
    }
  }

  update(dt) {
    // NPC 難度注入：依目前進度/表現調整視野與反應（由 difficultyAt 提供）
    for (const n of this.npcs) {
      const diff = this.engine.currentDifficulty();
      if (diff) n.visionRange = 40 * (0.6 + diff.enemyAccuracy);
    }
  }
}
