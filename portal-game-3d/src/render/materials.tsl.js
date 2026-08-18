// TSL 材質美化模組（Three.js 2026 WebGPU + TSL）
// 提供：發光門面（脈動）、岩漿流動（噪聲+時間）、可portal牆微光標記
// 對齊 B4 五維強化之「光照/材質」維度；減少 AI-slop 死板感，改用程序化動態。
import * as THREE from 'three';
import { Fn, uniform, positionLocal, time, vec2, vec3, vec4, float, mix,
         oscSine, mx_fractal_noise_float, positionWorld, color, mul, add, sin, length, smoothstep } from 'three/tsl';

const PORTAL_COLORS = { blue: 0x33aaff, orange: 0xff7700 };

// 門面發光材質：emissive 脈動（藍/橘），對齊 noether 門面能量感
export function makePortalMaterial(kind = 'blue') {
  const base = new THREE.Color(PORTAL_COLORS[kind] || 0x33aaff);
  const mat = new THREE.MeshStandardNodeMaterial({
    color: 0x05060a, roughness: 0.4, metalness: 0.1,
    transparent: true, opacity: 0.92, side: THREE.DoubleSide,
  });
  // 脈動亮度：oscSine(time*1.5) ∈ [-1,1] → [0.35,1.0]
  const pulse = oscSine(time.mul(1.5)).mul(0.32).add(0.68);
  mat.emissiveNode = vec3(base.r, base.g, base.b).mul(pulse);
  return mat;
}

// 岩漿流動材質：fractal noise + time 驅動紅橙流動，拒絕靜態死板
export function makeLavaMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({
    roughness: 0.55, metalness: 0.0, transparent: true, opacity: 0.92,
  });
  // 世界座標採樣噪聲，隨時間漂移形成流動熔岩
  const n = mx_fractal_noise_float(
    positionWorld.xz.mul(0.02).add(vec2(time.mul(0.15), 0.0)), 4, 2.0, 0.5
  );
  const hot = vec3(1.0, 0.85, 0.25);   // 亮橙黃
  const cool = vec3(0.7, 0.12, 0.04);  // 暗紅
  const t = smoothstep(float(0.2), float(0.75), n);
  mat.colorNode = mix(cool, hot, t);
  mat.emissiveNode = mix(cool, hot, t).mul(0.6);
  return mat;
}

// 可 portal 牆微光標記：邊緣藍白描邊，提示玩家「此面可開門」
export function makePortalableWallMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({
    color: 0xe4ecf8, roughness: 0.6, metalness: 0.05,
  });
  // 用局部座標 y 高度做頂部微光（簡化：僅亮度微調，避免過度設計）
  const glow = oscSine(time.mul(0.8)).mul(0.06).add(0.94);
  mat.emissiveNode = vec3(0.18, 0.32, 0.5).mul(glow);
  return mat;
}

// 出口綠柱發光
export function makeExitMaterial() {
  const mat = new THREE.MeshBasicNodeMaterial({
    color: 0x2fe08a, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
  });
  const pulse = oscSine(time.mul(2.0)).mul(0.25).add(0.6);
  mat.colorNode = vec3(0.18, 0.88, 0.54).mul(pulse);
  return mat;
}
