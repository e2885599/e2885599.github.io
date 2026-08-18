// 引擎核心：Three.js WebGPU 啟動 + 主迴圈 + 第一人稱玩家 + 碰撞 + 關卡流程
// 技術棧：本地 vendor/three.webgpu.js (r185) via importmap（無 CDN 依賴，離線可開）
// 第一人稱控制：本地 src/core/controls.js（消除對 three/addons 的 CDN 依賴）
// 對齊 DESIGN_SPEC.md 與 2D 主要版 portal-game.html 的已驗證物理

import * as THREE from 'three';
import { FirstPersonControls } from './controls.js';
import { PortalSystem } from './portals.js';
import { makePortalMaterial, makeLavaMaterial, makePortalableWallMaterial, makeExitMaterial, makeMetalFloorMaterial, makeSplatBackground } from '../render/materials.tsl.js';

const WORLD_W = 900, WORLD_D = 600;
// 垂直比例參照傳送門2（Portal 2）：以玩家身高 PH=34 為基準
//   Portal 2 天花板高約 2.6× 玩家身高 → 本作目標牆高 = 90（原 levels.json 以 220 為語意值）
//   VSCALE 把 levels.json 裡的語意高度（220/200/120/60）線性映射到 Portal 2 視覺比例
const WALL_H_REF = 220;            // levels.json 裡的語意牆高（不動關卡座標）
const WALL_H_TARGET = 90;         // Portal 2 比例下的實際牆高（2.65× PH）
const VSCALE = WALL_H_TARGET / WALL_H_REF;
const PR = 11, PH = 34;            // 玩家半徑/身高（半徑 0.32× 身高，Portal 2 感）
const EYE = PH * 0.42;             // 眼睛高度偏移：視線在身高 0.92 處（Portal 2 第一人稱視角）
const GRAV = 2200, MOVE = 85, JUMP = 760, TERMINAL = 1400;
const SUBSTEPS = 2;                   // 子步進提升碰撞/穿越穩定
const COLORS = {
  wall: 0x39435a, portalWall: 0xe4ecf8, floor: 0x131a28,
  lava: 0xff4a1e, spike: 0xff2f6b, box: 0xc98b3e,
  btnOff: 0x8a7a2a, btnOn: 0xffe24a, door: 0xb0364a,
  exit: 0x2fe08a, blue: 0x2f9bff, orange: 0xff9a2f,
};

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.playerPos = new THREE.Vector3(130, PH / 2, 300);
    this.playerVel = new THREE.Vector3();
    this.onGround = true;
    this.blue = null; this.orange = null;
    this.level = null; this.levelIndex = 0; this.mode = 'menu';
    this.difficulty = 'easy';
    this.keys = {};
    this._levelDataAll = null;
    this._timeLeft = 0;
    this._portals = null;
    this.portalMeshes = [];
    this.deadFlash = 0;
    this.won = false;
    this.elapsed = 0;
    this.cubes = [];
    this.buttons = [];
    this.doors = [];
    this.hazards = [];
    this.boxes3d = [];        // Three 網格對應 cubes
    this.spikes3d = [];       // 移動尖刺網格
    this._carrying = null;
  }

  async init() {
    // 標準 WebGLRenderer（WebGL2）——最廣相容、最穩定，不依賴 WebGPU 實驗性支援
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.Fog(0x05060a, 420, 1250);

    this.camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.6, 4200);
    this.camera.position.copy(this.playerPos);

    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x202830, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 2.0);
    dir.position.set(5, 10, 5);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    this.scene.add(dir);

    this.controls = new FirstPersonControls(this.camera, this.canvas);
    this._portals = new PortalSystem(this.scene);

    this._bindInput();
    window.__portalReady = false;
    return this;
  }

  _bindInput() {
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.key === 'r' && this.mode === 'playing') this.resetLevel();
      if (e.key === 'h' && this.mode !== 'playing') this.setDifficulty(this.difficulty === 'hard' ? 'easy' : 'hard');
      if (e.key === 'Escape') this._backToMenu();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    this.canvas.addEventListener('click', () => {
      if (this.mode === 'playing' && !this.controls.isLocked) this.controls.lock();
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousedown', (e) => {
      if (this.mode !== 'playing' || !this.controls.isLocked) return;
      if (e.button === 0) this._firePortal('blue');
      else if (e.button === 2) this._firePortal('orange');
    });
    addEventListener('resize', () => this.renderer.setSize(innerWidth, innerHeight));
  }

  _backToMenu() {
    this.mode = 'menu';
    this.controls.unlock();
    const menu = document.getElementById('menu');
    const hud = document.getElementById('hud');
    if (menu) menu.classList.remove('hidden');
    if (hud) hud.classList.add('hidden');
  }

  async loadLevel(index) {
    const res = await fetch('./levels/levels.json');
    if (!res.ok) throw new Error('關卡資料載入失敗 HTTP ' + res.status);
    const data = await res.json();
    this._levelDataAll = data.levels;
    this.levelIndex = index;
    this.levelData = this._levelDataAll[index];
    this._timeLeft = (this.difficulty === 'hard' && this.levelData.hardTimer) ? this.levelData.hardTimer : 0;
    this._buildLevel();
  }

  _totalLevels() { return this._levelDataAll ? this._levelDataAll.length : '?'; }

  setDifficulty(d) {
    this.difficulty = (d === 'hard') ? 'hard' : 'easy';
    if (this._levelDataAll && this.mode !== 'menu') this.loadLevel(this.levelIndex);
  }

  resetLevel() { if (this._levelDataAll) this.loadLevel(this.levelIndex); }

  _buildLevel() {
    if (this.world) this.scene.remove(this.world);
    this._portals.clear();
    this.portalMeshes = [];
    this.cubes = []; this.buttons = []; this.doors = []; this.hazards = [];
    this.boxes3d = []; this.spikes3d = []; this._carrying = null;
    this.deadFlash = 0; this.won = false; this.elapsed = 0;
    this.world = new THREE.Group();
    const L = this.levelData;
    const mk = (w, h, d, color, opts = {}) => new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color, ...opts })
    );

    // 地板（Z：金屬 PBR 貼圖，取代扁平 Lambert）
    const floor = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W, 8, WORLD_D), makeMetalFloorMaterial());
    floor.position.set(WORLD_W / 2, 0, WORLD_D / 2); floor.receiveShadow = true;
    this.world.add(floor);

    // X：splat 風背景層（程序化飄浮光點，高斯潑濺風塵埃）
    this.splat = makeSplatBackground(2200, 900);
    this.world.add(this.splat);

    // 牆（portalable → 可門化材質）；垂直尺寸套用 Portal 2 比例 VSCALE
    for (const w of L.walls) {
      const wh = (w.h || WALL_H_REF) * VSCALE;
      const mesh = w.portalable
        ? new THREE.Mesh(new THREE.BoxGeometry(w.w, wh, w.d), makePortalableWallMaterial())
        : mk(w.w, wh, w.d, COLORS.wall);
      mesh.position.set(w.x + w.w / 2, wh / 2, w.z + w.d / 2);
      mesh.castShadow = true; mesh.receiveShadow = true;
      if (w.portalable) { mesh.userData.portalable = true; this.portalMeshes.push(mesh); }
      this.world.add(mesh);
    }

    // 岩漿（只有 easy 也顯示，但僅 hard 致命）；垂直尺寸套用 VSCALE
    for (const hz of L.hazards || []) {
      const hh = (hz.h || 8) * VSCALE;
      const m = new THREE.Mesh(new THREE.BoxGeometry(hz.w, hh, hz.d), makeLavaMaterial());
      m.position.set(hz.x + hz.w / 2, hh / 2, hz.z + hz.d / 2);
      this.world.add(m);
      const isHard = !!hz.hard;
      this.hazards.push({ x: hz.x, z: hz.z, w: hz.w, d: hz.d, hard: isHard, motion: hz.motion || null, base: { x: hz.x, z: hz.z }, mesh: m });
    }

    // 方塊（可推動）
    for (const b of L.boxes || []) {
      const m = mk(b.w, b.h, b.d, COLORS.box);
      m.position.set(b.x, b.h / 2, b.z); m.castShadow = true;
      this.world.add(m);
      this.cubes.push({ x: b.x, z: b.z, vx: 0, vz: 0, w: b.w, h: b.h, d: b.d, mesh: m });
    }

    // 按鈕
    for (const b of L.buttons || []) {
      const m = mk(b.w, 10, b.d, COLORS.btnOff);
      m.position.set(b.x + b.w / 2, 10, b.z + b.d / 2);
      this.world.add(m);
      this.buttons.push({ x: b.x, z: b.z, w: b.w, d: b.d, door: b.door, pressed: false, mesh: m });
    }

    // 門（未開啟視為實心牆）；垂直尺寸套用 VSCALE
    for (const dr of L.doors || []) {
      const dh = (dr.h || WALL_H_REF) * VSCALE;
      const m = mk(dr.w, dh, dr.d, COLORS.door);
      m.position.set(dr.x + dr.w / 2, dh / 2, dr.z + dr.d / 2); m.castShadow = true;
      this.world.add(m);
      this.doors.push({ x: dr.x, z: dr.z, w: dr.w, h: dr.h, d: dr.d, open: false, mesh: m });
    }

    // 出口（綠柱發光）；垂直尺寸套用 VSCALE
    const exH = (L.exit.h || WALL_H_REF) * VSCALE;
    const ex = new THREE.Mesh(new THREE.BoxGeometry(L.exit.w, exH, L.exit.d), makeExitMaterial());
    ex.position.set(L.exit.x, exH / 2, L.exit.z);
    this.world.add(ex);
    this.exitBox = { x: L.exit.x, z: L.exit.z, w: L.exit.w, d: L.exit.d };

    // 移動尖刺補充 mesh（hard 模式才顯示，這裡先建好由 update 控制可見性）
    this.scene.add(this.world);

    const nameEl = document.getElementById('cName');
    const modeEl = document.getElementById('cMode');
    const lvEl = document.getElementById('cLv');
    if (nameEl) nameEl.textContent = L.name;
    if (modeEl) modeEl.textContent = this.difficulty === 'hard' ? '難一點' : '容易';
    if (lvEl) lvEl.textContent = (this.levelIndex + 1) + '/' + this._totalLevels();
    this._hudTimerEl = document.getElementById('cTimer');

    // 玩家出生
    this.playerPos.set(L.start.x, PH / 2, L.start.z);
    this.playerVel.set(0, 0, 0);
    this.camera.position.copy(this.playerPos);
    this.camera.position.y += EYE;
    this.controls.setLook(0, 0);
    this.onGround = true;
    this.mode = 'playing';
  }

  _firePortal(color) {
    if (!this.controls.isLocked) return;
    const ray = new THREE.Raycaster();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    ray.set(this.camera.position, dir);
    const hits = ray.intersectObjects(this.portalMeshes, false);
    for (const h of hits) {
      if (h.object.userData.portalable) {
        const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
        const toCam = this.camera.position.clone().sub(h.point).normalize();
        if (n.dot(toCam) < 0) n.negate();
        this._portals.place(color, h.point, n);
        return;
      }
    }
  }

  // ---------- 碰撞：圓柱(xz) vs AABB ----------
  _resolveCircleAABB(ent, r, box) {
    // box: {x,z,w,d} 矩形（xz 平面）
    const cx = Math.max(box.x, Math.min(ent.x, box.x + box.w));
    const cz = Math.max(box.z, Math.min(ent.z, box.z + box.d));
    let dx = ent.x - cx, dz = ent.z - cz;
    let d2 = dx * dx + dz * dz;
    if (d2 > r * r) return null;
    let nx, nz, pen;
    if (d2 > 1e-6) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d; }
    else {
      const l = ent.x - box.x, rr = box.x + box.w - ent.x, t = ent.z - box.z, b = box.z + box.d - ent.z;
      const m = Math.min(l, rr, t, b);
      if (m === l) { nx = -1; nz = 0; pen = r + l; }
      else if (m === rr) { nx = 1; nz = 0; pen = r + rr; }
      else if (m === t) { nx = 0; nz = -1; pen = r + t; }
      else { nx = 0; nz = 1; pen = r + b; }
    }
    return { nx, nz, pen };
  }

  _collideWalls(ent, r) {
    let grounded = false;
    const boxes = [];
    for (const w of this.levelData.walls) boxes.push({ x: w.x, z: w.z, w: w.w, d: w.d });
    for (let pass = 0; pass < 3; pass++) {
      for (const box of boxes) {
        const hit = this._resolveCircleAABB(ent, r, box);
        if (hit) {
          ent.x += hit.nx * hit.pen; ent.z += hit.nz * hit.pen;
          const vn = this.playerVel.x * hit.nx + this.playerVel.z * hit.nz;
          if (vn < 0) { this.playerVel.x -= vn * hit.nx; this.playerVel.z -= vn * hit.nz; }
        }
      }
      // 未開啟的門視為實心牆
      for (const dr of this.doors) {
        if (dr.open) continue;
        const hit = this._resolveCircleAABB(ent, r, { x: dr.x, z: dr.z, w: dr.w, d: dr.d });
        if (hit) {
          ent.x += hit.nx * hit.pen; ent.z += hit.nz * hit.pen;
          const vn = this.playerVel.x * hit.nx + this.playerVel.z * hit.nz;
          if (vn < 0) { this.playerVel.x -= vn * hit.nx; this.playerVel.z -= vn * hit.nz; }
        }
      }
    }
    // 地板（y=0）
    if (ent.y <= PH / 2) { ent.y = PH / 2; if (this.playerVel.y < 0) this.playerVel.y = 0; grounded = true; }
    return grounded;
  }

  update(dt) {
    if (this.mode !== 'playing') return;
    const L = this.levelData;

    // 死亡閃爍期：凍結並重生
    if (this.deadFlash > 0) {
      this.deadFlash -= dt;
      if (this.deadFlash <= 0) this.resetLevel();
      return;
    }
    if (this.won) return;

    this.elapsed += dt;
    const p = this.playerPos;

    // 水平移動（取相機前向在 xz 平面投影）
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const move = new THREE.Vector3();
    if (this.keys['KeyW'] || this.keys['ArrowUp']) move.add(fwd);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) move.sub(fwd);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) move.add(right);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) move.sub(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(MOVE);
    this.playerVel.x = move.x; this.playerVel.z = move.z;

    // 跳躍 / 重力
    if ((this.keys['Space'] || this.keys['KeyW'] && false) && this.onGround) { this.playerVel.y = JUMP; this.onGround = false; }
    // 跳躍鍵：Space
    if (this.keys['Space'] && this.onGround) { this.playerVel.y = JUMP; this.onGround = false; }
    this.playerVel.y = Math.max(-TERMINAL, this.playerVel.y - GRAV * dt);

    const sdt = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      const prev = p.clone();
      p.addScaledVector(this.playerVel, sdt);
      // 傳送門穿越
      const tele = this._portals.tryTeleport(prev, p.clone(), this.playerVel);
      if (tele && tele.teleported) { p.copy(tele.position); this.playerVel.copy(tele.velocity); }
      // 方塊與門碰撞 + 落地
      this.onGround = this._collideWalls(p, PR);
      // 岩漿/尖刺（hard 致命，或 easy 不致死）
      this._checkHazards(p);
    }

    // 方塊物理 + 推動
    this._updateCubes(dt);
    // 按鈕 / 門狀態
    this._updateButtonsDoors();
    // 移動尖刺運動
    this._updateMovingSpikes(dt);
    // 出口判定
    this._checkExit(p);

    this.camera.position.copy(p);
    this.camera.position.y += EYE;   // Portal 2 第一人稱：視線在玩家眼睛高度

    // X：splat 背景層飄浮驅動（高斯潑濺風塵埃）
    // 用物件級 transform（旋轉+整體微浮），避免 WebGPU 下 BufferAttribute array 即時更新坑
    if (this.splat) {
      const tt = performance.now() * 0.001;
      this.splat.rotation.y = tt * 0.02;
      this.splat.position.y = Math.sin(tt * 0.3) * 18;
    }
    // 難度倒數
    if (this.difficulty === 'hard' && this._timeLeft > 0) {
      this._timeLeft = Math.max(0, this._timeLeft - dt);
      if (this._hudTimerEl) this._hudTimerEl.textContent = Math.ceil(this._timeLeft) + 's';
      if (this._timeLeft <= 0) { this._die(); }
    }
  }

  _checkHazards(p) {
    const hardOnly = this.difficulty !== 'hard';
    for (const hz of this.hazards) {
      if (hz.hard && hardOnly) continue;       // easy 模式移動尖刺不致命
      const box = hz.motion
        ? { x: hz.mesh.position.x - hz.w / 2, z: hz.mesh.position.z - hz.d / 2, w: hz.w, d: hz.d }
        : { x: hz.x, z: hz.z, w: hz.w, d: hz.d };
      // 玩家足跡是否落在岩漿/尖刺上（xz 重疊且 y 接近地面）
      if (p.x > box.x - PR && p.x < box.x + box.w + PR && p.z > box.z - PR && p.z < box.z + box.d + PR) {
        if (this.difficulty === 'hard') { this._die(); return; }
        // easy：岩漿為視覺，不致死；但若有 lavaInstantDeath 標記仍標記（本作 easy 不致死）
      }
    }
  }

  _updateCubes(dt) {
    const p = this.playerPos;
    for (const c of this.cubes) {
      // 推動：玩家靠近方塊外緣且朝其移動
      const dx = c.x - p.x, dz = c.z - p.z;
      const horiz = Math.hypot(dx, dz);
      const reach = PR + c.w / 2 + 2;
      if (horiz < reach && horiz > 1e-3) {
        // 把玩家速度投影到方塊方向，推動方塊
        const nx = dx / horiz, nz = dz / horiz;
        const push = this.playerVel.x * nx + this.playerVel.z * nz;
        if (push > 0) { c.vx = nx * push * 0.9; c.vz = nz * push * 0.9; }
      } else { c.vx = 0; c.vz = 0; }

      c.x += c.vx * dt; c.z += c.vz * dt;
      // 方塊與牆碰撞
      for (let pass = 0; pass < 2; pass++) {
        for (const w of this.levelData.walls) {
          const box = { x: w.x, z: w.z, w: w.w, d: w.d };
          const hit = this._resolveCircleAABB({ x: c.x, z: c.z }, c.w / 2, box);
          if (hit) { c.x += hit.nx * hit.pen; c.z += hit.nz * hit.pen; c.vx = 0; c.vz = 0; }
        }
        for (const dr of this.doors) {
          if (dr.open) continue;
          const hit = this._resolveCircleAABB({ x: c.x, z: c.z }, c.w / 2, { x: dr.x, z: dr.z, w: dr.w, d: dr.d });
          if (hit) { c.x += hit.nx * hit.pen; c.z += hit.nz * hit.pen; c.vx = 0; c.vz = 0; }
        }
      }
      c.mesh.position.set(c.x, c.h / 2, c.z);
    }
  }

  _updateButtonsDoors() {
    for (const b of this.buttons) {
      let pressed = false;
      const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
      for (const c of this.cubes) {
        if (Math.abs(c.x - cx) < b.w / 2 + c.w / 2 + 6 && Math.abs(c.z - cz) < b.d / 2 + c.d / 2 + 10) pressed = true;
      }
      if (Math.abs(this.playerPos.x - cx) < b.w / 2 + PR + 6 && Math.abs(this.playerPos.z - cz) < b.d / 2 + PR + 10) pressed = true;
      b.pressed = pressed;
      b.mesh.material.color.setHex(pressed ? COLORS.btnOn : COLORS.btnOff);
    }
    for (let i = 0; i < this.doors.length; i++) {
      const open = this.buttons.some((b) => b.door === i && b.pressed);
      this.doors[i].open = open;
      this.doors[i].mesh.visible = !open;   // 開門後隱藏
    }
  }

  _updateMovingSpikes(dt) {
    const t = performance.now() / 1000;
    for (const hz of this.hazards) {
      if (!hz.motion) continue;
      // 只有 hard 模式才顯示移動尖刺
      const visible = this.difficulty === 'hard';
      hz.mesh.visible = visible;
      if (!visible) continue;
      const m = hz.motion;
      const off = Math.sin(t * m.speed) * m.amp;
      if (m.axis === 'x') hz.mesh.position.set(hz.base.x + hz.w / 2 + off, (hz.h || 60) / 2, hz.z + hz.d / 2);
      else hz.mesh.position.set(hz.x + hz.w / 2, (hz.h || 60) / 2, hz.base.z + hz.d / 2 + off);
    }
  }

  _checkExit(p) {
    const e = this.exitBox;
    if (!e) return;
    if (p.x > e.x - e.w / 2 && p.x < e.x + e.w / 2 && p.z > e.z - e.d / 2 && p.z < e.z + e.d / 2) {
      this._winLevel();
    }
  }

  _die() {
    if (this.deadFlash > 0 || this.won) return;
    this.deadFlash = 0.6;
    this.controls.unlock();
    this._showHint('💀 失敗！按 R 或等待重生');
  }

  _winLevel() {
    this.won = true;
    this.controls.unlock();
    this.mode = 'won';
    const isLast = this.levelIndex >= this._totalLevels() - 1;
    const title = document.getElementById('winTitle');
    const text = document.getElementById('winText');
    const next = document.getElementById('winNext');
    if (title) title.textContent = isLast ? '🏆 全部過關！' : '✅ 過關了！';
    if (text) text.innerHTML = `${this.levelData.name} 過關！<br>用時 <b>${this.elapsed.toFixed(1)}</b> 秒。`;
    if (next) {
      next.textContent = isLast ? '再玩一次' : '下一關';
      next.onclick = () => {
        const win = document.getElementById('win');
        if (win) win.classList.add('hidden');
        if (isLast) { this.levelIndex = 0; } else { this.levelIndex++; }
        this.loadLevel(this.levelIndex);
      };
    }
    const win = document.getElementById('win');
    if (win) win.classList.remove('hidden');
  }

  _showHint(msg) {
    const el = document.getElementById('hint');
    if (el) { el.textContent = msg; el.style.opacity = 1; }
  }

  start() {
    const loop = () => {
      const dt = Math.min(0.033, this.clock.getDelta() || 0);
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.__portalReady = true;
  }
}

export async function boot(canvasId, levelIndex = 0) {
  const canvas = document.getElementById(canvasId);
  const engine = new GameEngine(canvas);
  await engine.init();
  await engine.loadLevel(levelIndex);
  engine.start();
  window.__engine = engine;
  return engine;
}
