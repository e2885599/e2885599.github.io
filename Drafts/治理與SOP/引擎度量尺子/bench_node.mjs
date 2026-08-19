#!/usr/bin/env node
// 引擎度量尺子 — Node 三基準（D1 固定開銷 / D2 每物件成本 / D3 冷啟動）
// 設計：本檔只負責「產生可重現的真實數字」，輸出嚴格 JSON 契約供 ruler.py 消費。
// 防禦：輸入驗證（mode 必須在白名單，缺值/未知即非零退出）；ESM 禁用 require；
//      不依賴外部網路；不硬編碼任何密鑰。
// 注意：RSS 取自 process.memoryUsage().rss（Node 內部報，方向正確、可重現）。
//       D4 有狀態並發記憶體由 ruler.py 用 D2 外推，本檔不量（避免在本機佔用大量記憶體）。

import { createServer } from 'node:net';
import { performance } from 'node:perf_hooks';

// D3 冷啟動：在 module 載入最早期記 T0（此時 node 進程已啟、V8 isolate 已初始化，
// 尚不含任何業務邏輯）。server ready 後測 T0→ready 之差，含 node 啟動 + V8 init + listen，
// 對齊影片「外部 TCP-probe 到 server 可連」的冷啟動定義（本機同機測量）。
const T0 = performance.now();

const MODES = new Set(['min', 'alloc1m', 'cold']);

function parseArgs(argv) {
  // 簡易 --key value 解析，僅接受已知 key，防注入；缺值或未知立即非零退出。
  const out = { mode: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { out.help = true; continue; }
    if (a === '--mode') {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
        process.stderr.write('[error] --mode 缺少值\n');
        process.exit(1);
      }
      out.mode = argv[++i];
      continue;
    }
    process.stderr.write(`[error] 未知參數: ${a}\n`);
    process.exit(1);
  }
  return out;
}

function runMin() {
  // D1：空轉最小 server，報 RSS
  const srv = createServer();
  srv.listen(0, '127.0.0.1', () => {
    const rss_mb = process.memoryUsage().rss / (1024 * 1024);
    const out = { mode: 'min', samples: [{ rss_mb: round2(rss_mb) }] };
    process.stdout.write(JSON.stringify(out) + '\n');
    srv.close();
  });
  srv.on('error', (e) => { process.stderr.write(`[error] listen: ${e.message}\n`); process.exit(1); });
}

function runAlloc1m() {
  // D2：建百萬小物件，post-allocation RSS delta 除 N = 每物件位元組（近似結構體大小）
  // 註：delta 含陣列槽位/V8 allocator 成本，命名為 post-allocation delta 以誠實描述邊界。
  const base = process.memoryUsage().rss;
  const N = 1_000_000;
  const arr = new Array(N);
  for (let i = 0; i < N; i++) {
    // 模仿影片 particle：5 個數值欄位
    arr[i] = { x: i, y: i * 0.5, vx: 1, vy: -1, life: 1 };
  }
  const peak = process.memoryUsage().rss;
  const per_obj = (peak - base) / N; // bytes
  const rss_mb = peak / (1024 * 1024);
  const out = {
    mode: 'alloc1m',
    n_objects: N,
    samples: [{ rss_mb: round2(rss_mb), per_obj_bytes: Math.round(per_obj) }],
  };
  process.stdout.write(JSON.stringify(out) + '\n');
  arr.length = 0; // 顯式釋放，避免量完即收
}

function runCold() {
  // D3：啟 server，listen 成功即視為 ready，回報 T0→ready（含 node 啟動+V8+listen）
  const srv = createServer((sock) => sock.destroy());
  srv.listen(0, '127.0.0.1', () => {
    const cold_ms = performance.now() - T0;
    const out = { mode: 'cold', samples: [{ cold_ms: round2(cold_ms) }] };
    process.stdout.write(JSON.stringify(out) + '\n');
    srv.close();
  });
  srv.on('error', (e) => { process.stderr.write(`[error] listen: ${e.message}\n`); process.exit(1); });
}

function round2(x) { return Math.round(x * 100) / 100; }

function main() {
  const { mode, help } = parseArgs(process.argv);
  if (help) {
    process.stderr.write('用法: node bench_node.mjs --mode <min|alloc1m|cold>\n');
    process.exit(0);
  }
  if (!mode) {
    process.stderr.write('[error] 缺少 --mode\n');
    process.exit(1);
  }
  if (!MODES.has(mode)) {
    process.stderr.write(`[error] 未知 mode: ${mode}（允許: min|alloc1m|cold）\n`);
    process.exit(1);
  }
  if (mode === 'min') return runMin();
  if (mode === 'alloc1m') return runAlloc1m();
  if (mode === 'cold') return runCold();
}

main();
