// TSL 材質美化模組（Three.js WebGPU + TSL）— Z+X 視覺升級版
// Z：PBR 貼圖（brick/metal/lava 由 tools/gen_textures.mjs 本地生成，零外部依賴）
// X：splat 風背景層（THREE.Points 程序化光點塵埃 + 場景霧）
import * as THREE from 'three';
import { Fn, uniform, positionLocal, time, vec2, vec3, vec4, float, mix,
         oscSine, mx_fractal_noise_float, positionWorld, color, mul, add, sin, length, smoothstep,
         texture, uv, normalMap } from 'three/tsl';

const PORTAL_COLORS = { blue: 0x33aaff, orange: 0xff7700 };

// ---- 紋理預載入（本地 PNG，離線可開） ----
const loader = new THREE.TextureLoader();
loader.setPath('./textures/');
function loadTex(name, srgb = false) {
  const t = loader.load(name);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}
const TEX = {
  brickAlbedo: loadTex('brick_albedo.png', true),
  brickNormal: loadTex('brick_normal.png'),
  brickRough:  loadTex('brick_rough.png'),
  metalAlbedo: loadTex('metal_albedo.png', true),
  metalNormal: loadTex('metal_normal.png'),
  metalRough:  loadTex('metal_rough.png'),
  lavaAlbedo:  loadTex('lava_albedo.png', true),
  lavaNormal:  loadTex('lava_normal.png'),
  lavaRough:   loadTex('lava_rough.png'),
};
// 重複平鋪（牆/地板按尺寸）
[TEX.brickAlbedo, TEX.brickNormal, TEX.brickRough].forEach(t => { t.repeat.set(2, 2); t.needsUpdate = true; });
[TEX.metalAlbedo, TEX.metalNormal, TEX.metalRough].forEach(t => { t.repeat.set(4, 4); t.needsUpdate = true; });
[TEX.lavaAlbedo, TEX.lavaNormal, TEX.lavaRough].forEach(t => { t.repeat.set(3, 3); t.needsUpdate = true; });

// 門面發光材質：emissive 脈動（藍/橘）
export function makePortalMaterial(kind = 'blue') {
  const base = new THREE.Color(PORTAL_COLORS[kind] || 0x33aaff);
  const mat = new THREE.MeshStandardNodeMaterial({
    color: 0x05060a, roughness: 0.4, metalness: 0.1,
    transparent: true, opacity: 0.92, side: THREE.DoubleSide,
  });
  const pulse = oscSine(time.mul(1.5)).mul(0.32).add(0.68);
  mat.emissiveNode = vec3(base.r, base.g, base.b).mul(pulse);
  return mat;
}

// 岩漿：PBR 貼圖 + TSL 流動 emissive
export function makeLavaMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({
    roughness: 0.55, metalness: 0.0, transparent: true, opacity: 0.95,
  });
  mat.map = TEX.lavaAlbedo;
  mat.roughnessMap = TEX.lavaRough;
  if ('normalMap' in mat) { mat.normalMap = TEX.lavaNormal; mat.normalScale = new THREE.Vector2(0.6, 0.6); }
  // TSL：世界座標流動噪聲驅動 emissive，讓貼圖「活」起來
  const n = mx_fractal_noise_float(
    positionWorld.xz.mul(0.02).add(vec2(time.mul(0.15), 0.0)), 4, 2.0, 0.5
  );
  const t = smoothstep(float(0.25), float(0.8), n);
  mat.emissiveNode = mix(vec3(0.7, 0.12, 0.04), vec3(1.0, 0.85, 0.25), t).mul(0.7);
  return mat;
}

// 可 portal 牆：brick PBR 貼圖 + 邊緣微光提示
export function makePortalableWallMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({
    color: 0xffffff, roughness: 0.7, metalness: 0.05,
  });
  mat.map = TEX.brickAlbedo;
  mat.roughnessMap = TEX.brickRough;
  if ('normalMap' in mat) { mat.normalMap = TEX.brickNormal; mat.normalScale = new THREE.Vector2(1, 1); }
  const glow = oscSine(time.mul(0.8)).mul(0.06).add(0.94);
  mat.emissiveNode = vec3(0.18, 0.32, 0.5).mul(glow);
  return mat;
}

// 新增：金屬地板 PBR 材質（Z 升級，取代原本扁平 Lambert）
export function makeMetalFloorMaterial() {
  const mat = new THREE.MeshStandardNodeMaterial({
    color: 0xffffff, roughness: 0.5, metalness: 0.6,
  });
  mat.map = TEX.metalAlbedo;
  mat.roughnessMap = TEX.metalRough;
  if ('normalMap' in mat) { mat.normalMap = TEX.metalNormal; mat.normalScale = new THREE.Vector2(0.8, 0.8); }
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

// X：splat 風背景層 — 程序化飄浮光點（高斯潑濺風塵埃/光斑）
// 回傳 THREE.Points 物件（基礎 PointsMaterial，WebGPU 相容、零 TSL 風險），由 engine 加入場景並在 update 驅動飄浮。
export function makeSplatBackground(count = 2200, radius = 900) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  let s = 99173;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < count; i++) {
    const r = radius * Math.cbrt(rnd());
    const th = rnd() * Math.PI * 2;
    const ph = Math.acos(2 * rnd() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.6 + 120;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    const warm = rnd();
    col[i * 3] = 0.4 + warm * 0.6;
    col[i * 3 + 1] = 0.6 + warm * 0.3;
    col[i * 3 + 2] = 0.9;
    seed[i] = rnd() * 6.28;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    size: 6, sizeAttenuation: true, vertexColors: true, opacity: 0.55,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.name = 'splatBackground';
  pts.userData.seed = seed;
  return pts;
}
