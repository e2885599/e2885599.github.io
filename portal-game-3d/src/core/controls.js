// 本地第一人稱視角控制（替代 three/addons PointerLockControls）
// 目的：消除 index.html importmap 對 jsdelivr CDN 的依賴，
//       確保離線 / 防火牆 / CDN 被牆 等環境下也能開啟並遊玩。
import * as THREE from 'three';

export class FirstPersonControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.isLocked = false;
    this.sensitivity = 0.0022;
    this.yaw = 0;
    this.pitch = 0;
    this.minPitch = -Math.PI / 2 + 0.05;
    this.maxPitch = Math.PI / 2 - 0.05;
    this._mouse = this._onMouseMove.bind(this);
    this._lock = this._onLockChange.bind(this);
    document.addEventListener('pointerlockchange', this._lock);
    document.addEventListener('mousemove', this._mouse);
    this._apply();
  }

  // 嘗試鎖定指標（瀏覽器要求使用者手勢，點擊 canvas 時呼叫）
  lock() { try { this.domElement.requestPointerLock && this.domElement.requestPointerLock(); } catch (e) {} }
  unlock() { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {} }

  _onLockChange() { this.isLocked = (document.pointerLockElement === this.domElement); }

  _onMouseMove(e) {
    if (!this.isLocked) return;                 // 未鎖定時不轉視角（避免背景誤轉）
    this.yaw -= e.movementX * this.sensitivity;
    this.pitch -= e.movementY * this.sensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    this._apply();
  }

  _apply() {
    const e = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(e);
  }

  // 供 headless 測試 / 外部直接設定視角（繞過 pointer lock）
  setLook(yaw, pitch) {
    this.yaw = yaw;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, (pitch == null ? this.pitch : pitch)));
    this._apply();
  }

  dispose() {
    document.removeEventListener('pointerlockchange', this._lock);
    document.removeEventListener('mousemove', this._mouse);
  }
}
