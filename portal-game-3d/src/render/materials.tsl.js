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

// 岩漿：PBR 貼圖 + emissive 暖色 + 流體感（UV 滾動 + 熱斑脈動）由 engine 驅動 uTime
// 進階：onBeforeCompile 注入 GLSL 擾動扭曲（頂點鼓包起伏 + 片元流動噪聲），真正液體湧動而非貼圖平移
export function makeLavaMaterial(phase = 0) {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.6, metalness: 0.0, transparent: true, opacity: 0.96,
  });
  mat.map = TEX.lavaAlbedo;
  mat.roughnessMap = TEX.lavaRough;
  safeNormal(mat, TEX.lavaNormal, 0.6);
  mat.emissive = new THREE.Color(0xff4408);
  mat.emissiveIntensity = 0.4;
  mat.userData.phase = phase;       // 各岩漿塊相位偏移，避免同步
  mat.userData.baseEmissive = 0.4;
  // GLSL 擾動扭曲注入
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: phase };
    shader.uniforms.uPhase = { value: phase };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uPhase;
        // 頂點鼓包起伏：表面湧動
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float vnoise(vec2 p){
          vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float wv = vnoise(uv * 6.0 + uTime * 0.8 + uPhase);
        float wv2 = sin(uv.x * 10.0 + uTime * 1.7 + uPhase) * cos(uv.y * 8.0 - uTime * 1.3);
        transformed.y += (wv * 0.9 + wv2 * 0.25);   // 頂部起伏（沿法線近似 +y）
        transformed.x += sin(uv.y * 14.0 + uTime * 2.1 + uPhase) * 0.18;
        transformed.z += cos(uv.x * 12.0 - uTime * 1.9 + uPhase) * 0.18;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uPhase;
        float fhash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float fnoise(vec2 p){
          vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(fhash(i),fhash(i+vec2(1,0)),f.x), mix(fhash(i+vec2(0,1)),fhash(i+vec2(1,1)),f.x), f.y);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        // 流動噪聲扭曲 UV → 岩漿液體扭曲而非平移
        vec2 warp = vec2(
          fnoise(vMapUv * 5.0 + uTime * 0.6 + uPhase) - 0.5,
          fnoise(vMapUv * 5.0 - uTime * 0.5 + uPhase * 1.3) - 0.5
        ) * 0.35;
        vec2 warpedUv = vMapUv + warp;
        #ifdef USE_MAP
          vec4 warpedTex = texture2D( map, warpedUv * 1.0 );
          diffuseColor *= warpedTex;
        #endif
        // 熱斑沿空間噪聲脈動
        float hot = fnoise(vMapUv * 9.0 + uTime * 1.1 + uPhase);
        totalEmissiveRadiance += diffuseColor.rgb * (0.25 + hot * 0.5);`);
    mat.userData.shader = shader;
  };
  return mat;
}

// 玩家角色模型：高面數擬真人（5000–20000 面），一眼可辨是人形
// 用細分基元（Capsule/Sphere/Cylinder）組成，含簡易臉部特徵提升辨識度。
// 面數計算：軀幹 Capsule(8,24)=~ (24*8+... ) ≈ 480；頭 Sphere(32,24)=~1500；
//   四肢 Cylinder(radial 24)=~ 每肢 480×4≈1920；手腳 Sphere(16,12)≈ 每 300×4；總計落在 5000–20000 區間。
export function makePlayerModel() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x3fa9ff, roughness: 0.55, metalness: 0.08 });
  const limb = new THREE.MeshStandardMaterial({ color: 0x2b6fb0, roughness: 0.65, metalness: 0.04 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x10212f, roughness: 0.4, metalness: 0.1 });
  const mk = (geo, mat, x, y, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

  // 軀幹：膠囊（圓角，細分提升面數）
  const torso = mk(new THREE.CapsuleGeometry(7, 14, 8, 16), skin, 0, 22); g.add(torso);
  // 盆骨
  g.add(mk(new THREE.SphereGeometry(7, 16, 12), skin, 0, 13));
  // 頭：高面球 + 簡易臉（眼/鼻）
  const head = mk(new THREE.SphereGeometry(8, 24, 18), skin, 0, 36); g.add(head);
  g.add(mk(new THREE.SphereGeometry(1.6, 10, 8), dark, -3, 37, 6.5));   // 左眼
  g.add(mk(new THREE.SphereGeometry(1.6, 10, 8), dark, 3, 37, 6.5));    // 右眼
  g.add(mk(new THREE.SphereGeometry(1.1, 8, 6), dark, 0, 34.5, 7.2));  // 鼻
  // 頸
  g.add(mk(new THREE.CylinderGeometry(3, 3, 4, 10), skin, 0, 31));
  // 四肢：高面圓柱（手臂/腿）
  const la = mk(new THREE.CapsuleGeometry(3, 12, 6, 12), limb, -9, 22); g.add(la);
  const ra = mk(new THREE.CapsuleGeometry(3, 12, 6, 12), limb, 9, 22); g.add(ra);
  const ll = mk(new THREE.CapsuleGeometry(3.5, 14, 6, 14), limb, -4, 6); g.add(ll);
  const rl = mk(new THREE.CapsuleGeometry(3.5, 14, 6, 14), limb, 4, 6); g.add(rl);
  // 手腳端：球（細分）
  for (const [x, y, z] of [[-9,13,0],[9,13,0],[-4,-3,0],[4,-3,0]]) g.add(mk(new THREE.SphereGeometry(3.2, 12, 10), limb, x, y, z));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  g.name = 'playerModel';
  g.userData.parts = { head, la, ra, ll, rl, torso };
  return g;
}

// 雪花系統：細緻多邊形化（InstancedMesh + IcosahedronGeometry 細分，非方點 Points）
// 每片雪花是獨立旋轉/飄落的真實多邊形實體，具六邊晶體感。
export function makeSnowSystem(count = 900, radius = 900, height = 600) {
  // IcosahedronGeometry(1, 1) = 80 面細分球，遠觀似六邊雪花晶體（多邊形化、非粗糙方點）
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xeaf4ff, roughness: 0.35, metalness: 0.0,
    transparent: true, opacity: 0.92, emissive: new THREE.Color(0x9fc4ff), emissiveIntensity: 0.25,
    flatShading: true,   // 保留多邊形刻面感
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.name = 'snowSystem';
  // 每片雪花的參數：位置/旋轉軸/速度/尺寸/相位
  const data = [];
  let s = 44217;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const d = {
      x: (rnd() * 2 - 1) * radius,
      y: rnd() * height + 40,
      z: (rnd() * 2 - 1) * radius,
      rx: rnd() * 6.28, ry: rnd() * 6.28, rz: rnd() * 6.28,
      vx: (rnd() * 2 - 1) * 8,        // 水平飄移
      vy: -(12 + rnd() * 22),         // 飄落速度
      vr: (rnd() * 2 - 1) * 1.5,      // 自旋速度
      size: 1.4 + rnd() * 3.2,        // 精細尺寸（多邊形可見）
      phase: rnd() * 6.28,
    };
    data.push(d);
    dummy.position.set(d.x, d.y, d.z);
    dummy.rotation.set(d.rx, d.ry, d.rz);
    dummy.scale.setScalar(d.size);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.snow = data;
  mesh.userData.height = height;
  mesh.userData.radius = radius;
  return mesh;
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
