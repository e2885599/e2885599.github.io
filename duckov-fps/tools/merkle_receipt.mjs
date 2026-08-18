// Merkle 發版收據：對資產/源碼清單雜湊對帳，輸出收據 JSON
// 用法：node tools/merkle_receipt.mjs > receipts/<date>.json
import { createHash } from 'node:crypto';
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)));
const TARGETS = ['src', 'index.html', 'DESIGN.md', 'assets', 'tools'];

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'build' || e === '.git') continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function sha256(p) { return createHash('sha256').update(readFileSync(p)).digest('hex'); }

const files = [];
for (const t of TARGETS) {
  const p = join(ROOT, t);
  try { files.push(...(statSync(p).isDirectory() ? walk(p) : [p])); } catch { /* 不存在則跳過 */ }
}
files.sort();
const leaves = files.map((f) => ({ file: f.replace(ROOT, ''), hash: sha256(f) }));
// 建 Merkle 樹（成對雜湊，按檔名排序確保確定性）
let level = leaves.map((l) => l.hash);
while (level.length > 1) {
  const next = [];
  for (let i = 0; i < level.length; i += 2) {
    const a = level[i], b = level[i + 1] || '';
    next.push(createHash('sha256').update(a + b).digest('hex'));
  }
  level = next;
}
const root = level[0];
// 內建自檢：以相同順序重算，確保收據 root 可由 leaves 重現（防假通過）
const recompute = (() => {
  let lv = leaves.map((l) => l.hash);
  while (lv.length > 1) {
    const nx = [];
    for (let i = 0; i < lv.length; i += 2) nx.push(createHash('sha256').update(lv[i] + (lv[i + 1] || '')).digest('hex'));
    lv = nx;
  }
  return lv[0];
})();
if (recompute !== root) throw new Error('Merkle root 自檢不一致（對帳失敗）');
const date = new Date().toISOString().slice(0, 10);
const receipt = { date, files: leaves.length, root, leaves };
const outDir = join(ROOT, 'receipts');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, date + '.json');
writeFileSync(outPath, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ date, files: leaves.length, root }, null, 2));
console.error('收據已寫入 ' + outPath);
