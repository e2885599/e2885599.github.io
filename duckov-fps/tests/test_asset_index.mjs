// assets/index.json 資產索引雙向一致性驗收（對齊影片 vibe-coding「資產單一真相源」）
// 雙重守門：
//   1) assets[X].consumed_by 必須指向 render_modules 中已登記的模組路徑
//   2) render_modules[Y].depends_on 必須指向 assets 中已登記的鍵（assets:<key>）
//   3) 每個 assets 條目列舉的 tests 必須真實存在於磁碟
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)));
let fail = 0;
function ok(name, cond, extra='') {
  if (cond) console.log('  PASS  ' + name + (extra ? ' (' + extra + ')' : ''));
  else { fail++; console.log('  FAIL  ' + name + (extra ? ' (' + extra + ')' : '')); }
}

const idxPath = join(ROOT, 'assets', 'index.json');
ok('assets/index.json 存在', existsSync(idxPath));
if (!existsSync(idxPath)) { console.log(`\n結果：${fail} 失敗`); process.exit(1); }

let idx;
try { idx = JSON.parse(readFileSync(idxPath, 'utf-8')); }
catch (e) { ok('index.json 可解析', false, e.message); console.log(`\n結果：1 失敗`); process.exit(1); }

const assets = idx.assets || {};
const allModules = Object.assign({}, idx.render_modules || {}, idx.core_modules || {}, idx.tools || {});
const modulePaths = new Set(Object.values(allModules).map(m => m.path));

// 守門 1：assets.consumed_by ⊆ 已登記模組
for (const [key, a] of Object.entries(assets)) {
  for (const consumer of (a.consumed_by || [])) {
    ok(`asset[${key}] consumer 已登記: ${consumer}`, modulePaths.has(consumer),
        modulePaths.has(consumer) ? '' : '未在 render_modules 中');
  }
  // 守門 3：列舉的測試檔必須存在
  for (const t of (a.tests || [])) {
    ok(`asset[${key}] 測試檔存在: ${t}`, existsSync(join(ROOT, t)), t);
  }
}

// 守門 2：render_modules.depends_on ⊆ assets 鍵
const assetKeys = new Set(Object.keys(assets).map(k => 'assets:' + k));
for (const [name, m] of Object.entries(allModules)) {
  for (const dep of (m.depends_on || [])) {
    ok(`module[${name}] 依賴資產已登記: ${dep}`, assetKeys.has(dep),
        assetKeys.has(dep) ? '' : '未指向 assets 中任何條目');
  }
}

ok('至少登記 1 個資產', Object.keys(assets).length >= 1);
ok('至少登記 1 個渲染/核心/工具模組', Object.keys(allModules).length >= 1);

console.log(`\n結果：${fail === 0 ? 'ALL PASS' : fail + ' 失敗'}`);
process.exit(fail === 0 ? 0 : 1);
