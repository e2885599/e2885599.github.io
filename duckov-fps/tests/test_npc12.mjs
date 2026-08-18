// 12 NPC 資料 + 對話樹遍歷驗收（對抗循環整合者收斂補完）
// 驗證：① 數量=12 ② 每個 NPC 對話樹從 start 可 BFS 到至少一個終端節點
//       ③ 所有 option.next 指向存在的節點（無斷鏈）④ 無不可達孤島節點
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const charsDir = join(root, 'assets', 'characters');

// 讀 npcs.json 索引（單一真相源）
import { readFileSync as rf } from 'node:fs';
const idx = JSON.parse(rf(join(root, 'assets', 'characters', 'npcs.json'), 'utf8'));

test('npcs.json 索引 count=12 且每條有 file', () => {
  assert.equal(idx.count, 12, `npcs.json count 應為 12，實為 ${idx.count}`);
  assert.equal(idx.npcs.length, 12, 'npcs 陣列長度應為 12');
  for (const n of idx.npcs) {
    assert.ok(n.id && n.file, `NPC 條目缺 id/file: ${JSON.stringify(n)}`);
    assert.ok(existsSync(join(root, n.file)), `NPC 檔缺失: ${n.file}`);
  }
});

// 對話樹遍歷驗收：對每個 NPC 獨立斷言
for (const meta of idx.npcs) {
  test(`對話樹可通且無斷鏈: ${meta.id} (${meta.name})`, () => {
    const npc = JSON.parse(rf(join(root, meta.file), 'utf8'));
    const dlg = npc.dialogue;
    assert.ok(dlg && dlg.start, `NPC ${meta.id} 缺 dialogue.start`);
    assert.ok(dlg.nodes && typeof dlg.nodes === 'object', `NPC ${meta.id} 缺 dialogue.nodes`);

    const nodes = dlg.nodes;
    const start = dlg.start;
    assert.ok(nodes[start], `start 節點 "${start}" 不存在於 nodes`);

    // BFS 從 start
    const reachable = new Set();
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      const node = nodes[cur];
      assert.ok(node, `節點 "${cur}" 被引用但不存在`);
      const opts = node.options || [];
      for (const o of opts) {
        assert.ok(o.next, `節點 "${cur}" 的選項缺 next`);
        // 允許指向終端（下一步不存在節點，但需明確標記 options:[] 終端語義）
        if (!nodes[o.next]) {
          // 終端節點必須自身 options 為空（否則是斷鏈）
          assert.equal(opts.length, 0, `節點 "${cur}" 指向不存在的 "${o.next}" 但自身非終端→斷鏈`);
        } else {
          queue.push(o.next);
        }
      }
    }

    // 至少一個終端節點可達（options 為空 = 對話結束）
    const terminals = [...reachable].filter(id => (nodes[id].options || []).length === 0);
    assert.ok(terminals.length >= 1, `NPC ${meta.id} 無可達終端節點（對話無法結束）`);

    // 無孤島：所有定義的節點都應可從 start 到達
    for (const id of Object.keys(nodes)) {
      assert.ok(reachable.has(id), `節點 "${id}" 不可從 start 到達（孤島）`);
    }
  });
}
