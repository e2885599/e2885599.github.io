// glTF 載入層驗收：確認自寫 writer 產出的 .gltf 含 data URI 且 JSON 結構可被 GLTFLoader 解析
// 註：完整 three 載入需瀏覽器環境；此處做可在 node 跑的結構/可達性驗收（防假通過）
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), 'assets');
let fail = 0;
function ok(name, cond, extra='') { if (cond) console.log('  PASS  ' + name + (extra ? ' (' + extra + ')' : '')); else { fail++; console.log('  FAIL  ' + name + (extra ? ' (' + extra + ')' : '')); } }

const files = ['weapons/raygun.gltf', 'characters/duckkov_enemy.gltf', 'scenes/barn.gltf'];
for (const f of files) {
  const p = join(ROOT, f);
  ok('存在 ' + f, existsSync(p));
  if (!existsSync(p)) continue;
  const txt = readFileSync(p, 'utf-8');
  let d;
  try { d = JSON.parse(txt); } catch (e) { ok('JSON 可解析 ' + f, false, e.message); continue; }
  // buffers 必須含 data URI（否則 GLTFLoader 載不進二進位）
  const buf = d.buffers && d.buffers[0];
  ok('buffer 含 data URI ' + f, buf && typeof buf.uri === 'string' && buf.uri.startsWith('data:application/octet-stream;base64,'));
  // data URI 解碼後位元組數 = byteLength
  if (buf && buf.uri && buf.uri.startsWith('data:')) {
    const b64 = buf.uri.split(',')[1];
    const decLen = Buffer.from(b64, 'base64').length;
    ok('data URI 位元組數 == byteLength ' + f, decLen === buf.byteLength, decLen + '/' + buf.byteLength);
  }
  // 結構完整性
  ok('含 mesh/accessor ' + f, Array.isArray(d.meshes) && d.meshes.length > 0 && Array.isArray(d.accessors) && d.accessors.length > 0);
}

console.log(`\n結果：${fail === 0 ? 'ALL PASS' : fail + ' 失敗'}`);
process.exit(fail === 0 ? 0 : 1);
