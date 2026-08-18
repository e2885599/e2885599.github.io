// 任務庫驗收 v2：數量/均衡/引用調勻 + DAG 拓撲（無環、可全完成、跨 NPC 劇情連鎖）
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const P = join(fileURLToPath(new URL('..', import.meta.url)), 'assets/missions/missions.json');
let fail = 0;
const ok = (n, c, e='') => { if (c) console.log('  PASS  ' + n + (e ? ' (' + e + ')' : '')); else { fail++; console.log('  FAIL  ' + n + (e ? ' (' + e + ')' : '')); } };

ok('任務檔存在', existsSync(P));
if (!existsSync(P)) { console.log('\n失敗'); process.exit(1); }
const sz = statSync(P).size; ok('非 0 且 > 100KB', sz > 100 * 1024, (sz / 1024).toFixed(0) + 'KB');
const d = JSON.parse(readFileSync(P, 'utf-8'));
const M = d.missions;
const byId = new Map(M.map(m => [m.id, m]));

ok('總數 ≈ 720 (±5%)', Math.abs(M.length - 720) <= 36, M.length + ' 則');
const byGiver = {};
for (const m of M) byGiver[m.giver] = (byGiver[m.giver] || 0) + 1;
const counts = Object.values(byGiver);
ok('恰 12 個 NPC 頒布者', Object.keys(byGiver).length === 12, Object.keys(byGiver).length + ' 個');
ok('各 NPC 任務數均衡 (±2)', Math.max(...counts) - Math.min(...counts) <= 2, `min=${Math.min(...counts)} max=${Math.max(...counts)}`);

// ── DAG 拓撲驗收 ──
// 1) 所有 requires 指向存在且 id 唯一
const ids = new Set(M.map(m => m.id));
ok('任務 id 唯一', ids.size === M.length);
ok('所有 requires 指向存在任務', M.every(m => m.requires.every(r => byId.has(r))));

// 2) 無自環 + 無自引用
ok('無 NPC 自引用', M.every(m => m.giver !== m.relates_to));
ok('無任務自依賴', M.every(m => !m.requires.includes(m.id)));

// 3) 無環（Kahn 拓撲排序）：requires 視為「前置→本任務」邊
const indeg = new Map(M.map(m => [m.id, 0]));
const adj = new Map(M.map(m => [m.id, []]));
for (const m of M) for (const r of m.requires) {
  adj.get(r).push(m.id); indeg.set(m.id, indeg.get(m.id) + 1);
}
const q = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
let done = 0;
while (q.length) {
  const u = q.shift(); done++;
  for (const v of adj.get(u)) { indeg.set(v, indeg.get(v) - 1); if (indeg.get(v) === 0) q.push(v); }
}
ok('DAG 無環（可全拓撲排序）', done === M.length, done + '/' + M.length);

// 4) 可全完成性：從起始態（無前置者）能完成全部
ok('存在起點（無前置任務）', M.some(m => m.requires.length === 0));

// 5) 縱向連鎖（同 NPC 至少一則鏈到上一則）
const hasSelfChain = M.some(m => m.requires.some(r => byId.get(r).giver === m.giver));
ok('縱向連鎖存在（同 NPC 依賴）', hasSelfChain);

// 6) 跨 NPC 劇情連鎖佔比：至少 30% 任務含「跨 giver 的 requires」
const crossDeps = M.filter(m => m.requires.some(r => byId.get(r).giver !== m.giver));
ok('跨 NPC 依賴佔比 ≥ 30%', crossDeps.length / M.length >= 0.30, (100 * crossDeps.length / M.length).toFixed(0) + '%');

// 7) tier 單調：前置任務 tier 必須 ≤ 本任務 tier（不可時光倒流）
const mono = M.every(m => m.requires.every(r => byId.get(r).tier <= m.tier));
ok('tier 單調（前置 ≤ 本層）', mono);

// 8) tier 覆蓋 1..8
const tiers = new Set(M.map(m => m.tier));
ok('tier 覆蓋 1..8', [1,2,3,4,5,6,7,8].every(t => tiers.has(t)));

console.log(`\n結果：${fail === 0 ? 'ALL PASS' : fail + ' 失敗'}`);
process.exit(fail === 0 ? 0 : 1);
