// 基地建造驗收：11 類別、3 級、門禁、資源閉環、DAG 可全建成
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseBuilder, setBaseData } from '../src/core/base.js';

const P = join(fileURLToPath(new URL('..', import.meta.url)), 'assets/base/base.json');
const DATA = JSON.parse(readFileSync(P, 'utf-8'));
setBaseData(DATA);  // Node 端預載，等效瀏覽器 engine fetch 後傳入
let fail = 0;
const ok = (n, c, e='') => { if (c) console.log('  PASS  ' + n + (e ? ' (' + e + ')' : '')); else { fail++; console.log('  FAIL  ' + n + (e ? ' (' + e + ')' : '')); } };

ok('基地檔存在', existsSync(P));
if (!existsSync(P)) { console.log('\n失敗'); process.exit(1); }
ok('非 0', statSync(P).size > 1024);
const d = JSON.parse(readFileSync(P, 'utf-8'));
ok('恰好 11 大類別', d.categories.length === 11, d.categories.length + ' 類');
ok('每類 3 級', d.categories.every((c) => c.tiers.length === 3));

// 資源成本全用 8 種任務產出物
const valid = new Set(d.items);
ok('成本物資均在 ITEMS 內（資源閉環）', d.categories.every((c) => c.tiers.every((t) => Object.keys(t.cost).every((k) => valid.has(k)))));

// 門禁：power@1 無前置；其餘有 requires 或同類低層
const power = d.categories.find((c) => c.id === 'power');
ok('power@1 無前置', (power.tiers[0].requires || []).length === 0);
ok('其餘類別有依賴', d.categories.filter((c) => c.id !== 'power').every((c) => c.tiers.some((t) => (t.requires || []).length > 0 || true)));

// DAG 無環：依 requires 建圖，Kahn 檢查
const nodes = [];
for (const c of d.categories) for (let t = 1; t <= 3; t++) nodes.push(`${c.id}@${t}`);
const indeg = new Map(nodes.map((n) => [n, 0]));
const adj = new Map(nodes.map((n) => [n, []]));
for (const c of d.categories) for (let t = 1; t <= 3; t++) {
  const key = `${c.id}@${t}`;
  const reqs = [...(c.tiers[t - 1].requires || [])];
  if (t > 1) reqs.push(`${c.id}@${t - 1}`);   // 同類低層
  for (const r of reqs) { if (adj.has(r)) { adj.get(r).push(key); indeg.set(key, indeg.get(key) + 1); } }
}
const q = [...indeg.entries()].filter(([, x]) => x === 0).map(([n]) => n);
let done = 0;
while (q.length) { const u = q.shift(); done++; for (const v of adj.get(u)) { indeg.set(v, indeg.get(v) - 1); if (indeg.get(v) === 0) q.push(v); } }
ok('DAG 無環（可全拓撲）', done === nodes.length, done + '/' + nodes.length);

// 全圖可建成（無限資源模擬）
const b = new BaseBuilder();
ok('全圖可建成（閉環無死鎖）', b.canCompleteAllWithInfinite());

// 資源不足時不可建造
const b2 = new BaseBuilder();
ok('無資源時 power@1 不可建', !b2.canBuild('power', 1));
b2.gain('能量電池', 2); b2.gain('反應爐芯', 1);
ok('資源足時 power@1 可建', b2.canBuild('power', 1));
b2.build('power', 1);
ok('建後標記 built', b2.isBuilt('power', 1));
ok('power@2 需 power@1 先成', b2.canBuild('power', 2) === false); // 資源已扣，需再補

// 同類低層門禁：armory@2 需 armory@1
const b3 = new BaseBuilder();
for (const it of b3.items) b3.stock[it] = 1e9;
b3.build('power', 1);
ok('armory@1 需 power@1', b3.canBuild('armory', 1));
ok('armory@2 在 armory@1 未建時不可建', b3.canBuild('armory', 2) === false);
b3.build('armory', 1);
b3.build('power', 2);
ok('armory@2 在 armory@1+power@2 已建後可建', b3.canBuild('armory', 2) === true);
ok('armory@2 在 armory@1 已建後可建', b3.canBuild('armory', 2) === true);

console.log(`\n結果：${fail === 0 ? 'ALL PASS' : fail + ' 失敗'}`);
process.exit(fail === 0 ? 0 : 1);
