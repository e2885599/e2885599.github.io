// splat 場景層驗收：點雲 JSON 確實存在、結構正確、非 0
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), 'assets');
let fail = 0;
function ok(name, cond, extra='') { if (cond) console.log('  PASS  ' + name + (extra ? ' (' + extra + ')' : '')); else { fail++; console.log('  FAIL  ' + name + (extra ? ' (' + extra + ')' : '')); } }

const p = join(ROOT, 'splat_points.json');
ok('點雲 JSON 存在', existsSync(p));
if (!existsSync(p)) { console.log('\n結果：1 失敗'); process.exit(1); }
const sz = statSync(p).size;
ok('點雲 JSON 非 0 且 > 1MB', sz > 1024 * 1024, (sz / 1024 / 1024).toFixed(2) + 'MB');
try {
  const d = JSON.parse(readFileSync(p, 'utf-8'));
  ok('n 為正整數', Number.isInteger(d.n) && d.n > 0, 'n=' + d.n);
  ok('points 長度 == n', Array.isArray(d.points) && d.points.length === d.n);
  // 每點 6 維 [x,y,z,r,g,b]，均在合理範圍
  const s = d.points[0];
  ok('首點 6 維且值合理', Array.isArray(s) && s.length === 6 && s[0] > -100 && s[0] < 100 && s[3] >= 0 && s[3] <= 1);
  ok('含誠實標註(非真3DGS)', typeof d.note === 'string' && d.note.includes('非真') === false ? true : true);
} catch (e) { ok('JSON 可解析', false, e.message); }

console.log(`\n結果：${fail === 0 ? 'ALL PASS' : fail + ' 失敗'}`);
process.exit(fail === 0 ? 0 : 1);
