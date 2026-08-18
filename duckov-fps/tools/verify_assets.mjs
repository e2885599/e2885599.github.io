// 資產驗收器：確認 Blender 產出的 glTF 與多視角 PNG 確實存在且非 0 位元組
// 注意：本機 Blender 5.2 背景 export_scene.gltf 損壞，改自寫 writer 產 .gltf+.bin
// 用法：node tools/verify_assets.mjs
import { statSync, readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), 'assets');
let fail = 0;
function ok(name, cond, extra='') { if (cond) console.log('  PASS  ' + name + (extra ? ' (' + extra + ')' : '')); else { fail++; console.log('  FAIL  ' + name + (extra ? ' (' + extra + ')' : '')); } }
function size(p) { try { return statSync(p).size; } catch { return 0; } }

console.log('— glTF 資產（自寫 writer 產出 .gltf+.bin）—');
const wg = join(ROOT, 'weapons/raygun.gltf'), wb = join(ROOT, 'weapons/raygun.bin');
ok('武器 raygun.gltf 存在且非0', size(wg) > 0, size(wg) + 'B');
ok('武器 raygun.bin 存在且非0', size(wb) > 0, size(wb) + 'B');
const cg = join(ROOT, 'characters/duckkov_enemy.gltf'), cb = join(ROOT, 'characters/duckkov_enemy.bin');
ok('角色 duckkov_enemy.gltf 存在且非0', size(cg) > 0, size(cg) + 'B');
ok('角色 duckkov_enemy.bin 存在且非0', size(cb) > 0, size(cb) + 'B');
const sg = join(ROOT, 'scenes/barn.gltf'), sbn = join(ROOT, 'scenes/barn.bin');
ok('場景 barn.gltf 存在且非0', size(sg) > 0, size(sg) + 'B');
ok('場景 barn.bin 存在且非0', size(sbn) > 0, size(sbn) + 'B');
ok('場景 barn.blend 兜底存在', size(join(ROOT, 'scenes/barn.blend')) > 0);
// glTF JSON 結構有效性
try {
  const d = JSON.parse(readFileSync(wg, 'utf-8'));
  ok('glTF 含 mesh/accessor/buffer', d.meshes?.length > 0 && d.accessors?.length > 0 && d.buffers?.length > 0,
     `meshes=${d.meshes?.length} acc=${d.accessors?.length} buf=${d.buffers?.length}`);
} catch (e) { ok('glTF JSON 可解析', false, e.message); }

console.log('— splat 多視角訓練集 —');
const sp = join(ROOT, 'splat_train');
let n = 0;
try { n = readdirSync(sp).filter(f => f.endsWith('.png')).length; } catch {}
ok('多視角 PNG ≥ 24 張', n >= 24, n + ' 張');
ok('每張 PNG 非0位元組', (() => { try { return readdirSync(sp).filter(f => f.endsWith('.png')).every(f => size(join(sp, f)) > 0); } catch { return false; } })());

console.log(`\n結果：${fail === 0 ? 'ALL PASS' : fail + ' 失敗'}`);
process.exit(fail === 0 ? 0 : 1);
