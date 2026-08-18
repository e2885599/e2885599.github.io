// 引擎核心骨架：Three.js WebGPU 啟動 + FPS + 任務板 + 敵我開火 + 玩家血量
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { difficultyAt } from './difficulty.js';
import { World } from './world.js';
import { MissionBoard } from './missions.js';
import { BaseBuilder } from './base.js';
import { BaseBuilder3D } from '../render/base3d.js';
import { newEffects, applyEffect, applyAllEffects } from './effects.js';
import { missionsCompletableByZone } from './triggers.js';
import { DialogueMount } from '../npc/dialogueMount.js';

// 動態載入對話樹（依 dialogue_ref 相對路徑 fetch JSON）
async function loadDialogueRef(relPath) {
  const res = await fetch(relPath);
  if (!res.ok) throw new Error('對話樹載入失敗: ' + relPath + ' ' + res.status);
  return res.json();
}

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.entities = new Set();
    this.progress = 0;
    this.perf = null;
    this.playerPos = new THREE.Vector3(0, 1.7, 0);
    this.playerHp = 100;
    this.world = null;
    this.board = null;
    this.base = null;
    this.base3d = null;
    this.effects = newEffects();
    this._buildOpen = false;
    this._won = false;
    this._keys = {};
    this._hud = null;
    this._hintEl = null;
    this._lastEnemyFire = 0;
    this.dialogueMount = null;   // 任務對話掛載器（B3：NPC 任務對話）
    this._dlgOpen = false;       // 對話 HUD 是否開啟
  }

  async init() {
    this.renderer = new THREE.WebGPURenderer({ canvas: this.canvas, antialias: true });
    await this.renderer.init();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    // 啟用軟陰影（PCFSoft），對齊 B4 五維強化之光照維度
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e14);
    this.scene.fog = new THREE.Fog(0x0a0e14, 30, 120);

    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 500);
    this.camera.position.copy(this.playerPos);

    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x202830, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 2.0);
    dir.position.set(5, 10, 5);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 80;
    dir.shadow.camera.left = -60;
    dir.shadow.camera.right = 60;
    dir.shadow.camera.top = 60;
    dir.shadow.camera.bottom = -60;
    dir.shadow.bias = -0.0005;
    this.scene.add(dir);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9, metalness: 0.0 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.controls = new PointerLockControls(this.camera, this.canvas);
    this.scene.add(this.controls.object);
    this.canvas.addEventListener('click', () => this.controls.lock());
    this._bindKeys();
    addEventListener('resize', () => this._onResize());

    this._buildHud();
    return this;
  }

  _buildHud() {
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = '<div id="cross">+</div><div id="stat"></div><div id="hpbar"><div id="hpfill"></div></div><div id="mission"></div>' +
      '<div id="buildpanel" style="display:none"></div>';
    document.body.appendChild(hud);
    this._hud = hud;
    this._hintEl = document.getElementById('hint');
  }

  _renderBuildPanel() {
    const p = document.getElementById('buildpanel');
    if (!p || !this._buildOpen || !this.base) return;
    const rows = this.base.cats.map((c, i) => {
      const cur = this.base.tierOf(c.id);
      const next = cur + 1;
      const maxT = c.tiers.length;
      const can = next <= maxT && this.base.canBuild(c.id, next);
      const status = cur >= maxT ? '滿級' : (can ? '可建' : '鎖');
      const cost = next <= maxT ? Object.entries(c.tiers[next - 1].cost).map(([k, v]) => k + '×' + v).join(' ') : '';
      const color = cur >= maxT ? '#888' : (can ? '#6f6' : '#f66');
      return `<div style="color:${color}">[${i < 9 ? i + 1 : i === 9 ? 0 : '-'}] ${c.name} Lv${cur}/${maxT} ${status} ${cost}</div>`;
    }).join('');
    p.innerHTML = '<b>基地建造（按 B 關閉）</b><br>' + rows;
  }

  _bindKeys() {
    addEventListener('keydown', (e) => {
      this._keys[e.code] = true;
      if (e.code === 'KeyB') this._toggleBuildPanel();
      // B3：按 E 與最近 NPC 觸發任務對話（對話開啟時數字鍵走對話選項）
      if (e.code === 'KeyE') { if (this._dlgOpen) this._advanceDialogue(0); else this._tryTalk(); }
      if (e.code === 'Escape' && this._dlgOpen) this._closeDialogue();
      if (this._dlgOpen && /^(Digit1|Digit2|Digit3|Digit4|Digit5|Digit6|Digit7|Digit8|Digit9|Digit0)$/.test(e.code)) {
        const idx = { Digit1:0, Digit2:1, Digit3:2, Digit4:3, Digit5:4, Digit6:5, Digit7:6, Digit8:7, Digit9:8, Digit0:9 }[e.code];
        this._advanceDialogue(idx);
      } else if (this._buildOpen && /^(Digit1|Digit2|Digit3|Digit4|Digit5|Digit6|Digit7|Digit8|Digit9|Digit0)$/.test(e.code)) {
        const idx = { Digit1:0, Digit2:1, Digit3:2, Digit4:3, Digit5:4, Digit6:5, Digit7:6, Digit8:7, Digit9:8, Digit0:9 }[e.code];
        this._manualBuild(idx);
      }
    });
    addEventListener('keyup', (e) => { this._keys[e.code] = false; });
    addEventListener('mousedown', (e) => { if (this.controls.isLocked && e.button === 0) this._fire(); });
  }

  // B3：尋找準星/最近距離≤3m 的 NPC，開啟其任務對話
  async _tryTalk() {
    if (!this.dialogueMount) return;
    const npcs = (this.world?.npcs || []).filter((n) => n.object);
    let near = null, best = 3.0; // 互動半徑 3m
    for (const n of npcs) {
      const d = n.object.position.distanceTo(this.camera.position);
      if (d <= best) { best = d; near = n; }
    }
    if (!near) { this._flash('附近沒有可對話的 NPC'); return; }
    try {
      const cur = await this.dialogueMount.openForNpc(near.id);
      if (!cur) { this._flash(near.id + '：暫無委託'); return; }
      this._dlgOpen = true;
      this._renderDialogue();
    } catch (err) {
      this._flash('對話載入失敗: ' + err.message);
    }
  }

  // 渲染當前對話節點到 HUD（#dlg 容器）
  _renderDialogue() {
    const node = this.dialogueMount.currentNode();
    if (!node) { this._closeDialogue(); return; }
    let el = document.getElementById('dlg');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dlg';
      el.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);max-width:640px;background:rgba(2,6,23,.92);border:1px solid #22d3ee;color:#e2e8f0;padding:14px 18px;border-radius:10px;font:13px/1.5 monospace;pointer-events:none;';
      document.body.appendChild(el);
    }
    const opts = (node.options || []).map((o, i) => `[${i + 1}] ${o.label}`).join('　');
    el.innerHTML = `<div style="color:#7dd3fc;margin-bottom:6px;">${node.text}</div>` +
      (opts ? `<div style="color:#cbd5e1;">${opts}</div><div style="color:#64748b;margin-top:6px;">數字鍵選項 / E 繼續 / Esc 離開</div>` : `<div style="color:#64748b;margin-top:6px;">E 結束</div>`);
  }

  // 推進對話（idx 選項索引；0 表示 E 鍵預設第一項）
  _advanceDialogue(idx) {
    try {
      const node = this.dialogueMount.choose(idx);
      this._renderDialogue();
      if (this.dialogueMount.current && this.dialogueMount.current.script.isEnd()) {
        setTimeout(() => this._closeDialogue(), 400);
      }
    } catch (err) {
      this._flash('對話推進錯誤: ' + err.message);
    }
  }

  _closeDialogue() {
    this._dlgOpen = false;
    this.dialogueMount && this.dialogueMount.close();
    const el = document.getElementById('dlg');
    if (el) el.remove();
  }

  _toggleBuildPanel() {
    this._buildOpen = !this._buildOpen;
    const p = document.getElementById('buildpanel');
    if (p) p.style.display = this._buildOpen ? 'block' : 'none';
    this._flash(this._buildOpen ? '建造面板：數字鍵選類別建下一級' : '建造面板關閉');
  }

  // 手動建造：玩家選第 idx 類別，建其下一未建層級（需滿足 requires + 資源）
  _manualBuild(idx) {
    if (!this.base || !this.base3d) return;
    const c = this.base.cats[idx];
    if (!c) return;
    const next = (this.base.tierOf(c.id) || 0) + 1;
    if (next > c.tiers.length) { this._flash('「' + c.name + '」已滿級'); return; }
    if (!this.base.canBuild(c.id, next)) {
      const need = Object.entries(c.tiers[next - 1].cost).map(([k, v]) => k + '×' + v).join(',');
      this._flash('『' + c.name + ' Lv' + next + '』資源不足/前置未達：需 ' + need);
      return;
    }
    this.base.build(c.id, next);
    this.base3d.onBuilt(c.id, next);
    this.applyEffect(c.effect);
    this._flash('手動建造: ' + c.name + ' Lv' + next + (c.effect.type !== 'none' ? ' → ' + c.effect.type : ''));
  }

  _onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  _fire() {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const targets = (this.world?.npcs || []).map((n) => n.object).filter(Boolean);
    const hits = ray.intersectObjects(targets, true);
    if (hits.length) {
      const obj = hits[0].object;
      const npc = (this.world?.npcs || []).find((n) => n.object && (n.object === obj || n.object.children.includes(obj)));
      if (npc) {
        npc.takeDamage(28);
        this._flash('命中 ' + npc.id + ' 剩 ' + npc.hp);
        if (npc.hp === 0) this._onEnemyKilled(npc);
      }
    }
  }

  _onEnemyKilled(npc) {
    // 敵人死亡：完成一則相關戰鬥任務（依 giver 配對簡化），獎勵物資回流基地
    const cand = this.board?.available().find((m) => m.kind === '清剿' || m.kind === '狙殺' || m.kind === '獵殺' || m.kind === '捕俘');
    if (cand) {
      this.board.accept(cand.id);
      const r = this.board.complete(cand.id);
      if (this.base && r.reward) this.base.gain(r.reward, 1);
      this._flash('任務完成: ' + cand.kind + ' +' + r.reward);
    }
  }

  _enemyFire(dt) {
    // 敵人依難度開火扣玩家血（演示：每 reactionTime 一次）
    const diff = this.currentDifficulty();
    if (!diff) return;
    this._lastEnemyFire += dt;
    const interval = diff.reactionTime;
    const enemiesEngaged = (this.world?.npcs || []).filter((n) => n.fsm && n.fsm.current === 'engage').length;
    if (enemiesEngaged > 0 && this._lastEnemyFire >= interval) {
      this._lastEnemyFire = 0;
      const dmg = 6 * diff.enemyDamageMul * (this.effects.enemyDmgMul || 1) * enemiesEngaged;
      this.playerHp = Math.max(0, this.playerHp - dmg);
      this._flash('受擊 -' + dmg.toFixed(0) + '  HP ' + this.playerHp);
    }
  }

  _flash(msg) {
    const s = this._hud.querySelector('#stat');
    if (s) { s.textContent = msg; clearTimeout(this._flash._t); this._flash._t = setTimeout(() => { if (s.textContent === msg) s.textContent = ''; }, 1400); }
  }

  add(entity) {
    this.entities.add(entity);
    if (entity.object) {
      entity.object.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.scene.add(entity.object);
    }
  }

  currentDifficulty() { return difficultyAt(this.progress, this.perf); }

  async loadWorld() {
    this.world = new World(this);
    await this.world.load();
    const { loadSplatLayer } = await import('../render/splat.js');
    try { await loadSplatLayer('assets/splat_points.json', this.scene); console.log('[OK] splat 場景層載入'); }
    catch (e) { console.warn('[WARN] splat 層跳過', e.message); }
    // 任務板
    const res = await fetch('assets/missions/missions.json');
    const md = await res.json();
    this.board = new MissionBoard(md.missions);
    console.log('[OK] 任務板載入', this.board.byId.size, '則');
    // B3：任務對話掛載器（依 dialogue_ref 動態載入 720 條對話樹）
    this.dialogueMount = new DialogueMount(this.board, loadDialogueRef);
    // 基地建造系統
    const bres = await fetch('assets/base/base.json');
    const bd = await bres.json();
    this.base = new BaseBuilder(bd);
    console.log('[OK] 基地系統載入', bd.categories.length, '大類別');
    // 基地建築實例化（場景端可見，位置由場景 bbox 推導）
    const { BaseBuilder3D, makeThreeMeshFactory } = await import('../render/base3d.js');
    this.base3d = new BaseBuilder3D(this.scene, makeThreeMeshFactory(THREE));
    // 由 barn 物件 bbox 程式化推導建築佈局（倉庫尺寸變動自動重新包圍）
    const barnObj = (this.world && this.world.barn) || this.scene;
    const box = { minX: -20, maxX: 20, minY: -20, maxY: 20, minH: 0, maxH: 4 };  // 預設（fallback）
    try {
      const b = new THREE.Box3().setFromObject(barnObj);
      box.minX = b.min.x; box.maxX = b.max.x; box.minY = b.min.z; box.maxY = b.max.z;
      box.minH = b.min.y; box.maxH = b.max.y;
    } catch (e) { /* fallback 用預設 */ }
    this.base3d.buildLayout(box, this.base.cats);
    // 基地建築實例開啟陰影投射（對齊 B4 光照維度強化）
    if (this.base3d.meshes) {
      for (const m of this.base3d.meshes.values()) {
        if (m && m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
      }
    }
    this.applyAllEffects();  // 補齊預建類別的玩法效果
    // 自動接取起點任務
    for (const m of this.board.available().filter((x) => x.requires.length === 0)) {
      this.board.accept(m.id);
    }
    return this.world;
  }

  _zoneTriggers() {
    if (!this.board) return;
    const p = [this.playerPos.x, this.playerPos.y, this.playerPos.z];
    const ids = missionsCompletableByZone(p, this.board);
    for (const id of ids) {
      const start = !this.board.accepted.has(id) && this.board.isAvailable(id);
      const r = start ? (this.board.accept(id), this.board.complete(id)) : this.board.complete(id);
      if (this.base && r.reward) this.base.gain(r.reward, 1);
      this._flash('任務完成(地點): ' + r.kind + ' +' + r.reward);
    }
  }

  _renderHud() {
    const hp = this._hud.querySelector('#hpfill');
    if (hp) hp.style.width = this.playerHp + '%';
    const mp = this._hud.querySelector('#mission');
    if (mp && this.board) {
      const pr = this.board.progress();
      const av = this.board.available()[0];
      let txt = '任務 ' + pr.completed + '/' + pr.total + (av ? ' ｜ 可接: ' + av.giver_name + '·' + av.kind : '');
      if (this.base) {
        const total = this.base.cats.reduce((s, c) => s + c.tiers.length, 0);
        txt += ' ｜ 基地 ' + this.base.built.size + '/' + total + '級';
        const e = this.effects;
        const tags = [];
        if (e.healRate > 0) tags.push('回血+' + e.healRate);
        if (e.moveMul < 1) tags.push('移速×' + e.moveMul);
        if (e.recoilMul < 1) tags.push('後坐×' + e.recoilMul);
        if (e.enemyDmgMul < 1) tags.push('敵傷×' + e.enemyDmgMul);
        if (e.unlockedWeapons.size) tags.push('武:' + [...e.unlockedWeapons].join('/'));
        if (e.winFlag) tags.push('逃生就緒');
        if (tags.length) txt += ' ｜ ' + tags.join(' ');
      }
      mp.textContent = txt;
    }
    this._renderBuildPanel();
  }

  update(dt) {
    const speed = 5 * (this.effects.moveMul || 1) * dt;
    if (this._keys['KeyW']) this.controls.moveForward(speed);
    if (this._keys['KeyS']) this.controls.moveForward(-speed);
    if (this._keys['KeyA']) this.controls.moveRight(-speed);
    if (this._keys['KeyD']) this.controls.moveRight(speed);
    this.playerPos.copy(this.camera.position);
    // 醫療站效果：每秒回血（不足 100 才回）
    if (this.effects.healRate > 0 && this.playerHp < 100) {
      this.playerHp = Math.min(100, this.playerHp + this.effects.healRate * dt);
    }
    for (const e of this.entities) if (e.update) e.update(dt, this);
    if (this.world) this.world.update(dt);
    this._enemyFire(dt);
    this._zoneTriggers();
    this._tryAutoBuild();
    this._checkWin();
    this._renderHud();
  }

  // 將單一類別的 effect 注入引擎狀態（委託純函式，可單測）
  applyEffect(eff) { return applyEffect(this.effects, eff); }

  // 重算所有已建成類別的 effect（委託純函式）
  applyAllEffects() {
    if (!this.base) return;
    const cats = this.base.cats.map((c) => ({ effect: c.effect, tiers: c.tiers, built: this.base.built }));
    applyAllEffects(this.effects, cats);
  }

  // 手動建造模式：建造由玩家在建造面板觸發（_manualBuild），不再自動全建
  _tryAutoBuild() { /* 已改為手動建造：保留方法名避免 update 呼叫點變動，內部不再自動建 */ }

  // 逃生通道空間門禁：建成後，玩家實際走進 gate 座標半徑內才觸發通關
  _checkWin() {
    if (!this.effects.winFlag) return;          // 逃生通道須先建成（win_flag）
    if (this._won) return;
    const gate = this.base3d?.meshes.get('extraction');
    if (!gate) return;
    const dx = this.playerPos.x - gate.position.x;
    const dy = this.playerPos.y - gate.position.y;
    if (Math.hypot(dx, dy) < 3.5) {
      this._won = true;
      this._flash('★ 抵達逃生通道 — 通關！★');
      console.log('[WIN] 玩家抵達逃生通道，遊戲通關');
    }
  }


  start() {
    this.renderer.setAnimationLoop(() => {
      const dt = this.clock.getDelta();
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    });
  }
}

export async function boot(canvasId = 'game') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) throw new Error('找不到 canvas#' + canvasId);
  const engine = new GameEngine(canvas);
  await engine.init();
  await engine.loadWorld();
  engine.start();
  window.__engine = engine;
  return engine;
}
