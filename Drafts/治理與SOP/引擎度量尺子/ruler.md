# 引擎度量尺子（Engine Memory Ruler）

> 落區：Drafts/治理與SOP/引擎度量尺子/（備選區，未升格、不推送 GitHub）
> 來源影片：Theo (t3.gg) — TypeScript→C/LLVM 編譯器評測（Vercel Labs "script C"/S2C，2026）
> 用途：把「選 TS/JS 執行時」量化成四個可測維度，做可證偽的引擎選型判準。

## 一、為什麼需要這把尺子
影片揭示的事實（已用 `youtube-content` 技能抓字幕核實）：
- TS 不被執行，JS 才被執行；兩者跑在**託管執行時**（V8 / JavaScriptCore / QuickJS），記憶體由 GC 管制。
- 把 TS 直接編譯成 C/LLVM IR→clang 成靜態二進制，脫離 GC，改採**引用計數＋原生 struct**，記憶體大幅下降。
- **最關鍵的相反結果**：在 60-tick 射擊遊戲中，Node / Bun / S2C 的**吞吐打平**，唯有記憶體差 3–6×。
  → 原生編譯「省記憶體、不增算力」。

影片聲稱數字（**影片方單機測試，未第三方複現，僅方向參考**）：

| 項目 | Node(V8) | Bun(JSCore) | S2C(原生) |
|---|---|---|---|
| ① 最小 VMRSS | ~70 MB | ~40 MB | ~2.2 MB |
| ② 百萬物件 | ~259 MB | ~176 MB | ~88 MB |
| ③ 冷啟動 | ~56 ms | ~15.8 ms | ~2.3 ms |
| ④ 800路 P50 | ~170 MB | ~131 MB | ~30 MB |
| ④ 1600路 P50 | ~228 MB | ~140 MB | ~58 MB |

結構體聲稱：C=72B / V8=140B / JSCore=88B（依版本/ABI 而變，非常數）。

## 二、四維度量尺（可實操）
| 維度 | 測什麼 | 測法 | 對應場景 |
|---|---|---|---|
| **D1 固定開銷** | 引擎基礎 heap/isolate 成本 | 空轉/最小 server，量 RSS | 常駐空閒服務佔用 |
| **D2 每物件成本** | 每個小物件的頭/形狀/GC 簿記 | 百萬物件，peakRSS−baseRSS 除以 N | 大量小物件服務 |
| **D3 冷啟動** | server 到 TCP 可連的延遲 | server 啟動＋TCP-probe 計時 | serverless/邊緣計費與 p99 |
| **D4 有狀態並發記憶體** | 千連線各 N 狀態物件的預估 MB | D2 × 預估並發物件數外推 | 長連線（WS）後端 |

## 三、決策表（量化門檻，可證偽）
門檻常數（集中於 `ruler.py` 頂部 `THRESHOLDS`，可調）：
- `COLD_EDGE_MS = 10`：冷啟 < 10ms → 邊緣/serverless 友善
- `PEROBJ_EDGE_B = 100`：每物件 < 100B → 原生/緊湊
- `PEROBJ_HEAVY_B = 200`：每物件 > 200B → V8 頭成本顯著

判定邏輯（常數全用上，消除語意矛盾）：
- `D3 < COLD_EDGE_MS` 且 `D2 < PEROBJ_EDGE_B` → **A_native_candidate**（原生編譯路徑值得試點）
- `D2 > PEROBJ_HEAVY_B` → **B_heavy_gc**（V8 頭成本顯著，有狀態高並發需評估容器配額）
- 否則 → **stay**（維持現有託管執行時即可）
- D4 僅作資訊外推展示（千連線預估 MB），不單獨設門檻。

## 四、本機實操步驟（不假通過）
```bash
# 1) 跑 Node 三基準（真實數字，非影片聲稱）
node bench_node.mjs --mode min      # D1
node bench_node.mjs --mode alloc1m  # D2
node bench_node.mjs --mode cold     # D3

# 2) 主控：收斂分位數(P10/P50/P90) + 決策 + Merkle 對帳
python ruler.py run --repeat 7

# 3) 雙樣本驗收（鑑別力：GOOD 出有效 verdict，BAD 負值被拒）
python ruler.py verify
```

## 五、對 OODAV 的可操作推論
1. 盡調/儀錶板後端若走 edge/serverless，**記憶體＋冷啟動是硬成本項**；可在「高並發有狀態」子服務試點原生編譯路徑。
2. 依可證偽鐵律：任何「節省」必須用**你自己的負載重測**，不能用影片 P50 當基準。
3. 這把尺子的價值在「把選引擎量化成四可測維度」——測法本身可複用。

## 六、查證狀態誠實邊界
- ✅ 字幕已抓（youtube-content 技能），確認工具來自 Vercel Labs、四實驗設計、相反結果。
- ⚠️ 本環境 web_search/Firecrawl 額度不可用，**無法**獨立核實 S2C 官方倉庫與現狀，亦無他人複現基準。
- ⚠️ 影片數字為作者單機聲稱，非第三方複現；作者自承「真實 app 會不同」「不確定是否 production ready」。
- ✅ 底層 CS 機制（V8 物件模型/GC 簿記/引用計數/冷啟動差異）為可獨立查證事實。
