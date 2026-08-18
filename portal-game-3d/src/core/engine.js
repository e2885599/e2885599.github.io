// 引擎核心骨架：Three.js WebGPU 啟動 + 主迴圈 + 玩家 + 關卡載入
// 技術棧：本地 vendor/three.webgpu.js (2026) via importmap（已證可初始化，backend=webgpu）
// 設計依據：DESIGN_SPEC.md；對齊 duckov-fps/src/core/engine.js 分層

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { PortalSystem } from './portals.js';
import { makePortalMaterial, makeLavaMaterial, makePortalableWallMaterial, makeExitMaterial } from '../render/materials.tsl.js';

const WORLD_W = 900, WORLD_D = 600, WALL_H = 220;
const PR = 16, PH = 34;             // 玩家半徑/身高
const GRAV = 2200, MOVE = 320, JUMP = -760;
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
  }

  async init() {
    // WebGPU 優先；真機不支援時降級 WebGL2 backend（2026 版 WebGPURenderer 同時含 WebGL fallback，NodeMaterial 自動兼容）
    const useWebGL = !navigator.gpu;
    if (useWebGL) console.warn('[portal] WebGPU 不可用，降級 WebGL2 backend');
    this.renderer = new THREE.WebGPURenderer({ canvas: this.canvas, antialias: true, forceWebGL: useWebGL });
    try {
      await this.renderer.init();
    } catch (e) {
      // 極端環境（連 WebGL2 都無）：明確報錯而非白屏
      throw new Error('渲染器初始化失敗（WebGPU/WebGL 均不可用）：' + e);
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

    this.controls = new PointerLockControls(this.camera, this.canvas);
    this._portals = new PortalSystem(this.scene);

    this._bindInput();
    window.__portalReady = false; // 驗收旗標
    return this;
  }

  _bindInput() {
    addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.key === 'r' && this.mode === 'playing') this.resetLevel();
      if (e.key === 'h' && this.mode !== 'playing') {
        this.setDifficulty(this.difficulty === 'hard' ? 'easy' : 'hard');
      }
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    this.canvas.addEventListener('click', () => { if (this.mode === 'playing' && !this.controls.isLocked) this.controls.lock(); });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousedown', e => {
      if (this.mode !== 'playing' || !this.controls.isLocked) return;
      if (e.button === 0) this._firePortal('blue');
      else if (e.button === 2) this._firePortal('orange');
    });
    addEventListener('resize', () => this.renderer.setSize(innerWidth, innerHeight));
  }

  async loadLevel(index) {
    const res = await fetch('./levels/levels.json');
    const data = await res.json();
    this._levelDataAll = data.levels;
    this.levelIndex = index;
    this.levelData = this._levelDataAll[index];
    // 難度倒數：hard 用關卡 hardTimer，easy 不限時
    this._timeLeft = (this.difficulty === 'hard' && this.levelData.hardTimer) ? this.levelData.hardTimer : 0;
    this._buildLevel();
  }

  _totalLevels() { return this._levelDataAll ? this._levelDataAll.length : '?'; }

  setDifficulty(d) {
    this.difficulty = (d === 'hard') ? 'hard' : 'easy';
    if (this._levelDataAll) this.loadLevel(this.levelIndex); // 重載套用難度
  }

  _buildLevel() {
    // 清理舊場景
    if (this.world) this.scene.remove(this.world);
    this._portals.clear();
    this.portalMeshes = [];
    this.world = new THREE.Group();
    const L = this.levelData;
    const mk = (w, h, d, color, opts = {}) => new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color, ...opts })
    );

    // 地板
    const floor = mk(WORLD_W, 8, WORLD_D, COLORS.floor);
    floor.position.set(WORLD_W / 2, 0, WORLD_D / 2); floor.receiveShadow = true;
    this.world.add(floor);

    // 牆
    for (const w of L.walls) {
      const mesh = w.portalable
        ? new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), makePortalableWallMaterial())
        : mk(w.w, w.h, w.d, COLORS.wall);
      mesh.position.set(w.x + w.w / 2, w.h / 2, w.z + w.d / 2);
      mesh.castShadow = true; mesh.receiveShadow = true;
      if (w.portalable) { mesh.userData.portalable = true; this.portalMeshes.push(mesh); }
      this.world.add(mesh);
    }
    // 岩漿（TSL 流動材質）
    for (const hz of L.hazards || []) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(hz.w, hz.h || 8, hz.d), makeLavaMaterial());
      m.position.set(hz.x + hz.w / 2, (hz.h || 8) / 2, hz.z + hz.d / 2);
      this.world.add(m);
    }
    // 方塊
    for (const b of L.boxes || []) {
      const m = mk(b.w, b.h, b.d, COLORS.box);
      m.position.set(b.x, b.h / 2, b.z); m.castShadow = true;
      this.world.add(m);
    }
    // 出口
    const ex = new THREE.Mesh(new THREE.BoxGeometry(L.exit.w, L.exit.h, L.exit.d), makeExitMaterial());
    ex.position.set(L.exit.x, L.exit.h / 2, L.exit.z);
    this.world.add(ex);

    this.scene.add(this.world);

    // HUD：關卡名 / 難度
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
    this.onGround = true;
    this.mode = 'playing';
  }

  _firePortal(color) {
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

  update(dt) {
    if (this.mode !== 'playing') return;
    // 水平移動
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const move = new THREE.Vector3();
    if (this.keys['KeyW']) move.add(fwd);
    if (this.keys['KeyS']) move.sub(fwd);
    if (this.keys['KeyD']) move.add(right);
    if (this.keys['KeyA']) move.sub(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(MOVE * dt);
    this.playerVel.x = move.x; this.playerVel.z = move.z;

    // 跳躍 / 重力
    if (this.keys['Space'] && this.onGround) { this.playerVel.y = JUMP; this.onGround = false; }
    this.playerVel.y += GRAV * dt;

    const prev = this.playerPos.clone();
    this.playerPos.addScaledVector(this.playerVel, dt);

    // 地面
    if (this.playerPos.y <= PH / 2) { this.playerPos.y = PH / 2; this.playerVel.y = 0; this.onGround = true; }

    // 傳送門穿越
    const tele = this._portals.tryTeleport(prev, this.playerPos.clone(), this.playerVel);
    if (tele && tele.teleported) {
      this.playerPos.copy(tele.position);
      this.playerVel.copy(tele.velocity);
    }

    this.camera.position.copy(this.playerPos);

    // 難度倒數（hard 模式）
    if (this.difficulty === 'hard' && this._timeLeft > 0) {
      this._timeLeft = Math.max(0, this._timeLeft - dt);
      if (this._hudTimerEl) this._hudTimerEl.textContent = Math.ceil(this._timeLeft) + 's';
      if (this._timeLeft <= 0) { this.mode = 'failed'; this._showHint('時間到！按 R 重來'); }
    }
  }

  resetLevel() {
    if (this._levelDataAll) this.loadLevel(this.levelIndex);
  }

  _showHint(msg) {
    const el = document.getElementById('hint');
    if (el) { el.textContent = msg; el.style.opacity = 1; }
  }

  start() {
    const loop = () => {
      const dt = Math.min(0.033, this.clock.getDelta() || 0);
      this.update(dt);
      this.renderer.renderAsync(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.__portalReady = true; // 驗收旗標：主迴圈已起
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
