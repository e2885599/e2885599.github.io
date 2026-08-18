// Z 路線：本地生成 PBR 紋理（磚牆/金屬地板/岩漿），零外部依賴、離線可開
// 用 canvas 程式化繪製 albedo/normal/roughness，輸出到 ../textures/
// 這是開發期工具（node tools/gen_textures.mjs），不在遊戲運行時路徑內。
import { createCanvas } from 'canvas';
import fs from 'node:fs';
import path from 'node:path';

const SIZE = 512;
const OUT = path.join(import.meta.dirname, '..', 'textures');
fs.mkdirSync(OUT, { recursive: true });

// ---- 噪聲工具（值噪聲，確定性） ----
function hash(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h >>> 0) % 1000) / 1000;
}
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, y, seed, oct = 4) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 17);
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

function makeCanvas() { return createCanvas(SIZE, SIZE); }

// 將高度圖轉法線圖（sobel）
function heightToNormal(height, strength = 2.0) {
  const c = makeCanvas(); const ctx = c.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  const at = (x, y) => height[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const nz = 1.0;
    const len = Math.sqrt(dx * dx + dy * dy + nz * nz);
    const i = (y * SIZE + x) * 4;
    img.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
    img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
    img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---- 1) 磚牆（portalable 牆） ----
function genBrick() {
  const albedoC = makeCanvas(); const actx = albedoC.getContext('2d');
  const roughC = makeCanvas(); const rctx = roughC.getContext('2d');
  const height = new Float32Array(SIZE * SIZE);
  const brickW = 64, brickH = 32, mortar = 4;
  const aimg = actx.createImageData(SIZE, SIZE);
  const rimg = rctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const row = Math.floor(y / brickH);
    const offset = (row % 2) * (brickW / 2);
    const bx = (x + offset) % brickW;
    const by = y % brickH;
    const inMortar = bx < mortar || by < mortar;
    const n = fbm(x * 0.08, y * 0.08, 7, 4);
    let r, g, b, rough;
    if (inMortar) { r = 90 + n * 30; g = 88 + n * 28; b = 82 + n * 26; rough = 0.95; height[y * SIZE + x] = 0.2; }
    else {
      const shade = 0.7 + n * 0.5;
      r = 120 * shade; g = 70 * shade; b = 55 * shade; rough = 0.7 + n * 0.25;
      height[y * SIZE + x] = 0.8 + n * 0.2;
    }
    const i = (y * SIZE + x) * 4;
    aimg.data[i] = r; aimg.data[i + 1] = g; aimg.data[i + 2] = b; aimg.data[i + 3] = 255;
    const rv = Math.max(0, Math.min(255, rough * 255));
    rimg.data[i] = rv; rimg.data[i + 1] = rv; rimg.data[i + 2] = rv; rimg.data[i + 3] = 255;
  }
  actx.putImageData(aimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  return { albedo: albedoC, rough: roughC, normal: heightToNormal(height, 3.0) };
}

// ---- 2) 金屬地板 ----
function genMetal() {
  const albedoC = makeCanvas(); const actx = albedoC.getContext('2d');
  const roughC = makeCanvas(); const rctx = roughC.getContext('2d');
  const height = new Float32Array(SIZE * SIZE);
  const aimg = actx.createImageData(SIZE, SIZE);
  const rimg = rctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const n = fbm(x * 0.05, y * 0.05, 13, 5);
    const scratch = valueNoise(x * 0.5, y * 0.15, 31) > 0.92 ? 0.4 : 1.0;
    const rust = fbm(x * 0.02, y * 0.02, 23, 3) > 0.7 ? 0.6 : 0.0;
    const base = 95 + n * 55;
    let r = base * scratch + rust * 70;
    let g = base * 0.95 * scratch + rust * 35;
    let b = base * 0.9 * scratch + rust * 20;
    const rough = 0.35 + n * 0.4 + rust * 0.3;
    height[y * SIZE + x] = n * 0.6 + rust * 0.3;
    const i = (y * SIZE + x) * 4;
    aimg.data[i] = r; aimg.data[i + 1] = g; aimg.data[i + 2] = b; aimg.data[i + 3] = 255;
    const rv = Math.max(0, Math.min(255, rough * 255));
    rimg.data[i] = rv; rimg.data[i + 1] = rv; rimg.data[i + 2] = rv; rimg.data[i + 3] = 255;
  }
  actx.putImageData(aimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  return { albedo: albedoC, rough: roughC, normal: heightToNormal(height, 1.2) };
}

// ---- 3) 岩漿 ----
function genLava() {
  const albedoC = makeCanvas(); const actx = albedoC.getContext('2d');
  const roughC = makeCanvas(); const rctx = roughC.getContext('2d');
  const height = new Float32Array(SIZE * SIZE);
  const aimg = actx.createImageData(SIZE, SIZE);
  const rimg = rctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const n = fbm(x * 0.06, y * 0.06, 41, 5);
    const crack = valueNoise(x * 0.12, y * 0.12, 53);
    const hot = Math.max(0, n * 1.5 - 0.4);
    // 裂縫發光（暗處裂縫亮）
    const glow = crack > 0.78 ? 1.0 : hot;
    const r = 180 * glow + 40 * (1 - glow);
    const g = 70 * glow + 10 * (1 - glow);
    const b = 15 * glow;
    const rough = 0.4 + n * 0.3;
    height[y * SIZE + x] = n;
    const i = (y * SIZE + x) * 4;
    aimg.data[i] = r; aimg.data[i + 1] = g; aimg.data[i + 2] = b; aimg.data[i + 3] = 255;
    const rv = Math.max(0, Math.min(255, rough * 255));
    rimg.data[i] = rv; rimg.data[i + 1] = rv; rimg.data[i + 2] = rv; rimg.data[i + 3] = 255;
  }
  actx.putImageData(aimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  return { albedo: albedoC, rough: roughC, normal: heightToNormal(height, 1.5) };
}

const sets = { brick: genBrick(), metal: genMetal(), lava: genLava() };
for (const [name, s] of Object.entries(sets)) {
  fs.writeFileSync(path.join(OUT, `${name}_albedo.png`), s.albedo.toBuffer('image/png'));
  fs.writeFileSync(path.join(OUT, `${name}_rough.png`), s.rough.toBuffer('image/png'));
  fs.writeFileSync(path.join(OUT, `${name}_normal.png`), s.normal.toBuffer('image/png'));
  console.log(`✓ ${name}: albedo/rough/normal 已生成`);
}
console.log(`\n貼圖輸出目錄: ${OUT}`);
