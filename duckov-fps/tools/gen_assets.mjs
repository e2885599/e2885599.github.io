// 可擴容資產生成管線骨架（程序化紋理 + 幾何資產索引）
// 本輪產出「最小真實資產集」：N 張程序化 PNG 紋理 + 幾何資產索引 JSON，
// 並更新 assets/index.json。設計朝「7G 體量」迭代擴容：--count / --res 參數化。
//
// 真實落盤（非 placeholder）：
//   - PNG 由純 JS 編碼器（Node zlib）生成，含真實 RGBA 像素（程序化值噪聲/棋盤/漸層）。
//   - 幾何資產索引記錄真實頂點/面數（由原始公式計算），非假檔。
// 未達成 7G（那是多輪目標）——本骨架只鋪好可擴容結構。
//
// 用法：node tools/gen_assets.mjs [--count 12] [--res 64] [--tex-out assets/textures] [--geo-out assets/generated]
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)));

// ---- 參數解析（可擴容：未來調大 --count / --res 即朝 7G 逼近）----
function parseArgs(argv) {
  const o = { count: 12, res: 64, texOut: 'assets/textures', geoOut: 'assets/generated' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--count') o.count = parseInt(argv[++i], 10);
    else if (argv[i] === '--res') o.res = parseInt(argv[++i], 10);
    else if (argv[i] === '--tex-out') o.texOut = argv[++i];
    else if (argv[i] === '--geo-out') o.geoOut = argv[++i];
  }
  return o;
}
const OPT = parseArgs(process.argv.slice(2));

// ---- 確定性 PRNG（mulberry32），保證可重現 ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 整數雜湊 → [0,1)
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- CRC32（PNG chunk 校驗用）----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---- 最小 PNG 編碼器（RGBA, 8-bit, colortype 6, filter 0）----
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // compression, filter, interlace
  // 每行前置 filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- 程序化紋理：依索引產生不同基底色 + 值噪聲棋盤/漸層 ----
function hslToRgb(h, s, l) {
  h = ((h % 1) + 1) % 1;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
function genTexture(idx, res) {
  const seed = idx + 1;
  const rng = mulberry32(seed * 2654435761);
  const baseHue = rng();
  const [br, bg, bb] = hslToRgb(baseHue, 0.55, 0.45);
  const mode = idx % 3; // 0=噪聲 1=棋盤 2=漸層
  const buf = Buffer.alloc(res * res * 4);
  const checker = 4 + (idx % 5);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const i = (y * res + x) * 4;
      let r, g, b;
      if (mode === 0) {
        const n = hash2(x >> 1, y >> 1, seed) * 0.6 + hash2(x, y) * 0.4;
        const m = 0.6 + n * 0.5;
        r = Math.min(255, br * m); g = Math.min(255, bg * m); b = Math.min(255, bb * m);
      } else if (mode === 1) {
        const c = ((x / checker | 0) + (y / checker | 0)) % 2 === 0;
        const k = c ? 1.0 : 0.55;
        r = Math.min(255, br * k); g = Math.min(255, bg * k); b = Math.min(255, bb * k);
      } else {
        const t = (x / res) * 0.5 + (y / res) * 0.5;
        const [rr, gg, bb2] = hslToRgb(baseHue + t * 0.25, 0.55, 0.35 + t * 0.3);
        r = rr; g = gg; b = bb2;
      }
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }
  return encodePNG(res, res, buf);
}

// ---- 幾何資產索引：真實頂點/面數（原始公式）----
function geoCounts(type, p) {
  switch (type) {
    case 'plane':   { const s = p.seg; return { vertices: (s + 1) * (s + 1), faces: s * s * 2 }; }
    case 'box':     { const s = p.seg; return { vertices: 6 * (s + 1) * (s + 1), faces: 6 * s * s * 2 }; }
    case 'sphere':  { const lat = p.lat, lon = p.lon; return { vertices: (lat + 1) * (lon + 1), faces: lat * lon * 2 }; }
    case 'cylinder':{ const s = p.seg; return { vertices: 2 * (s + 1) + 2, faces: 4 * s }; }
    default: return { vertices: 0, faces: 0 };
  }
}

// ---- 主流程 ----
const texDir = join(ROOT, OPT.texOut);
const geoDir = join(ROOT, OPT.geoOut);
mkdirSync(texDir, { recursive: true });
mkdirSync(geoDir, { recursive: true });

const texPaths = [];
for (let i = 0; i < OPT.count; i++) {
  const png = genTexture(i, OPT.res);
  const name = `tex_${String(i + 1).padStart(4, '0')}.png`;
  const fp = join(texDir, name);
  writeFileSync(fp, png);
  texPaths.push(`assets/textures/${name}`);
}
console.log(`  紋理：${texPaths.length} 張 @ ${OPT.res}x${OPT.res} 寫入 ${OPT.texOut}/`);

// 幾何資產索引（程序化 + 可擴容：count 越大資產越多）
const types = ['box', 'sphere', 'cylinder', 'plane'];
const geoAssets = [];
for (let i = 0; i < OPT.count; i++) {
  const t = types[i % types.length];
  const rng = mulberry32((i + 1) * 40503);
  const p = { seg: 2 + (i % 4), lat: 6 + (i % 6), lon: 8 + (i % 8) };
  const { vertices, faces } = geoCounts(t, p);
  const paramsKey = `${t}|${JSON.stringify(p)}`;
  const crc = crc32(Buffer.from(paramsKey, 'utf-8')) >>> 0;
  geoAssets.push({
    id: `geo_${t}_${String(i + 1).padStart(4, '0')}`,
    type: t,
    params: p,
    vertices, faces,
    seed: i + 1,
    crc32: crc.toString(16).padStart(8, '0')
  });
}
const geoIndex = {
  note: '程序化幾何資產索引（可擴容骨架）。本輪最小真實集；未來調大 --count 朝 7G 逼近。頂點/面數由真實公式計算。',
  generated_at: new Date().toISOString(),
  count: geoAssets.length,
  scale_target: '7G 體量（多輪目標，本輪未達成）',
  assets: geoAssets
};
const geoPath = join(geoDir, 'geometry_index.json');
writeFileSync(geoPath, JSON.stringify(geoIndex, null, 2), 'utf-8');
console.log(`  幾何索引：${geoAssets.length} 項寫入 ${OPT.texOut === 'assets/textures' ? 'assets/generated' : OPT.geoOut}/geometry_index.json`);

// ---- 更新 assets/index.json（讀→合併→寫，保持既有條目不動）----
const idxPath = join(ROOT, 'assets', 'index.json');
const idx = JSON.parse(readFileSync(idxPath, 'utf-8'));
idx.assets = idx.assets || {};
idx.assets.procedural_textures = {
  path: 'assets/textures/tex_*.png',
  type: 'image-sequence',
  format: 'png',
  count: texPaths.length,
  resolution: `${OPT.res}x${OPT.res}`,
  generated_at: geoIndex.generated_at,
  consumed_by: [],
  tests: [],
  constraints: ['程序化生成（純 JS PNG 編碼器，無外部依賴）', '由 tools/gen_assets.mjs 輸出，可參數化擴容'],
  registry_role: '程序化紋理資產（NPC visual.texture 參照來源）'
};
idx.assets.generated_geometry = {
  path: 'assets/generated/geometry_index.json',
  type: 'data-config',
  format: 'json',
  count: geoAssets.length,
  generated_at: geoIndex.generated_at,
  consumed_by: [],
  tests: [],
  constraints: ['頂點/面數由真實公式計算', '可朝 7G 體量迭代擴容'],
  registry_role: '程序化幾何資產索引'
};
writeFileSync(idxPath, JSON.stringify(idx, null, 2), 'utf-8');
console.log('  已更新 assets/index.json（新增 procedural_textures / generated_geometry）');
console.log(`\n完成：生成 ${texPaths.length} 張紋理 + ${geoAssets.length} 項幾何 + 更新索引。`);
