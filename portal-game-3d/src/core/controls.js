// 自由觀察視角控制（替代 PointerLock / FirstPerson，離線可用、不依賴 CDN）
// 完全自由移動視角：左鍵拖拽旋轉、右鍵拖拽平移、滾輪縮放。
// 對齊主流 3D 遊戲/建模軟體的觀察習慣：可任意旋轉、拉近、平移觀察全場。
// 射門方向 = 當前 camera 前向（camera.getWorldDirection）。
import * as THREE from 'three';

export class FreeOrbitControls {
  constructor(camera, domElement, targetVec) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = targetVec ? targetVec.clone() : new THREE.Vector3();
    this.isLocked = true;            // 自由視角下視角恆可用，不依賴 pointer lock
    this.sensitivity = 0.005;
    this.distance = 140;             // 初始觀察距離
    this.minDist = 30; this.maxDist = 1200;
    this.yaw = Math.PI; this.pitch = 0.35;   // 初始背後略俯視
    this.minPitch = -1.45; this.maxPitch = 1.45;
    this._dragBtn = -1;
    this._px = 0; this._py = 0;
    this._onDown = this._mousedown.bind(this);
    this._onMove = this._mousemove.bind(this);
    this._onUp = this._mouseup.bind(this);
    this._onWheel = this._wheel.bind(this);
    domElement.addEventListener('mousedown', this._onDown);
    addEventListener('mousemove', this._onMove);
    addEventListener('mouseup', this._onUp);
    domElement.addEventListener('wheel', this._onWheel, { passive: false });
    domElement.addEventListener('contextmenu', e => e.preventDefault());
    this._apply();
  }

  _mousedown(e) {
    this._dragBtn = e.button; this._px = e.clientX; this._py = e.clientY;
  }
  _mouseup() { this._dragBtn = -1; }
  _mousemove(e) {
    if (this._dragBtn < 0) return;
    const dx = e.clientX - this._px, dy = e.clientY - this._py;
    this._px = e.clientX; this._py = e.clientY;
    if (this._dragBtn === 0) {           // 左鍵：旋轉
      this.yaw -= dx * this.sensitivity;
      this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch - dy * this.sensitivity));
    } else if (this._dragBtn === 2) {     // 右鍵：平移（在視角平面內移動 target）
      const panX = -dx * this.distance * 0.0015;
      const panY = dy * this.distance * 0.0015;
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
      this.target.addScaledVector(right, panX).addScaledVector(up, panY);
    }
    this._apply();
  }
  _wheel(e) {
    e.preventDefault();
    this.distance = Math.max(this.minDist, Math.min(this.maxDist, this.distance * (1 + Math.sign(e.deltaY) * 0.1)));
    this._apply();
  }

  // 讓視角繞著 target（玩家）更新 camera 位置
  _apply() {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const off = new THREE.Vector3(
      this.distance * cp * sy,
      this.distance * sp,
      this.distance * cp * cy
    );
    this.camera.position.copy(this.target).add(off);
    this.camera.lookAt(this.target);
  }

  // 由外部（玩家移動後）更新觀察中心
  setTarget(v) { this.target.copy(v); this._apply(); }

  dispose() {
    this.domElement.removeEventListener('mousedown', this._onDown);
    removeEventListener('mousemove', this._onMove);
    removeEventListener('mouseup', this._onUp);
    this.domElement.removeEventListener('wheel', this._onWheel);
  }
}
