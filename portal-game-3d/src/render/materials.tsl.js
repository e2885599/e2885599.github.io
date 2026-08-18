// 材質模組（Three.js WebGPU + WebGL2 雙相容）— Z+X 視覺升級版（穩定版）
// Z：PBR 貼圖（brick/metal/lava 由 tools/gen_textures.mjs 本地生成，零外部依賴）
// X：splat 風背景層（THREE.Points 程序化光點塵埃 + 場景霧）
// 注意：使用標準 MeshStandardMaterial / MeshBasicMaterial（非 Node 版），
//       避免 TSL 節點（emissiveNode/colorNode）在部分 backend 下靜默編譯失敗。
import * as THREE from 'three';

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
[TEX.brickAlbedo, TEX.brickNormal, TEX.brickRough].forEach(t => { t.repeat.set(2, 2); t.needsUpdate = true; });
[TEX.metalAlbedo, TEX.metalNormal, TEX.metalRough].forEach(t => { t.repeat.set(4, 4); t.needsUpdate = true; });
[TEX.lavaAlbedo, TEX.lavaNormal, TEX.lavaRough].forEach(t => { t.repeat.set(3, 3); t.needsUpdate = true; });

function safeNormal(mat, tex, scale = 1) {
  mat.normalMap = tex;
  mat.normalScale = new THREE.Vector2(scale, scale);
}

// 門面發光材質（標準材質 + emissive 固定色）
export function makePortalMaterial(kind = 'blue') {
  const c = PORTAL_COLORS[kind] || 0x33aaff;
  return new THREE.MeshStandardMaterial({
    color: 0x0a0e16, roughness: 0.4, metalness: 0.1,
    transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    emissive: new THREE.Color(c), emissiveIntensity: 0.85,
  });
}

// 岩漿：PBR 貼圖 + emissive 暖色
export function makeLavaMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.6, metalness: 0.0, transparent: true, opacity: 0.96,
  });
  mat.map = TEX.lavaAlbedo;
  mat.roughnessMap = TEX.lavaRough;
  safeNormal(mat, TEX.lavaNormal, 0.6);
  mat.emissive = new THREE.Color(0xff4408);
  mat.emissiveIntensity = 0.4;
  return mat;
}

// 可 portal 牆：brick PBR 貼圖 + 微弱 emissive 提示
export function makePortalableWallMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.75, metalness: 0.05,
  });
  mat.map = TEX.brickAlbedo;
  mat.roughnessMap = TEX.brickRough;
  safeNormal(mat, TEX.brickNormal, 1);
  mat.emissive = new THREE.Color(0x224466);
  mat.emissiveIntensity = 0.15;
  return mat;
}

// 金屬地板 PBR 材質（Z 升級，取代原本扁平 Lambert）
export function makeMetalFloorMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.5, metalness: 0.6,
  });
  mat.map = TEX.metalAlbedo;
  mat.roughnessMap = TEX.metalRough;
  safeNormal(mat, TEX.metalNormal, 0.8);
  return mat;
}

// 出口綠柱發光（標準基礎材質 + emissive）
export function makeExitMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0x2fe08a, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
  });
}

// X：splat 風背景層 — 程序化飄浮光點
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
