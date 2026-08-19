# SOP 寫作模板：來源知識萃取 → 可證偽工程 SOP

> 對齊 OODAV LAB 主動資運工程工作室風格：**可證偽 · 零信任 · Merkle 對帳 · 責任歸屬**。
> 用途：把外部來源（影片 / 論文 / 文件 / 口播 / 白板）的技術知識，萃取為可套用、可驗收、可對帳的內部 SOP 或技術筆記。

---

## 一、六道不可省略關卡（硬閘）

1. **來源錨定**：每條聲稱須能回溯到「位址＋時間碼」或「檔名＋sha256」；無錨點＝未查證，視同寫缺失。
2. **聲稱標定**：逐條標 ✅（正確）/ ⚠️（簡化或不精確）/ ❌（錯誤），並附查證依據（官方原始碼 / 實測 / 第一原理）。
3. **雙樣本驗收**：每個驗收關卡必須同時具備「已知應 PASS」與「已知應 FAIL」樣本，且二者皆實測；只測 good 樣本＝沒測鑑別力，視同寫缺失。
4. **Merkle 對帳**：每輪輸出雜湊存檔（sha256 台帳續鏈），以存檔換計算難度，防抵賴與靜默篡改。
5. **責任歸屬**：發現簡化 / 矛盾 / 遺漏，不得靜默通過；須列「可證偽缺口」並歸責（誰 / 哪輪 / 哪一行 / 違反哪條規範）。
6. **反向收尾**：所有輸出以「不可壓縮、可證偽的反向提問」收尾。

---

## 二、模板本體（填寫區）

### 0. 來源錨定（Source Anchoring）
- 來源類型：□影片 □論文 □文件 □口播 □其他
- 位址 / 檔名：`______`
- 時間碼區間（影片）：`______`
- 抓取證明：sha256=`______` 或 抓取時間戳=`______`
- 萃取日期：`____` / 萃取者：`____`

### 1. 命題辨識（Claim Identification）
逐條列出來源中「可機械查證」的聲稱（剔除修辭、情緒、推銷）：

| # | 聲稱 | 類型（事實/數值/機制） |
|---|---|---|
| C1 | | |

### 2. 真偽對帳（Truth Reconciliation）
| # | 聲稱 | 判定 | 查證依據（原始碼/實測/第一原理） |
|---|---|---|---|
| C1 | | ✅/⚠️/❌ | |

### 3. 可證偽缺口（Falsifiable Gaps）
列簡化 / 矛盾 / 遺漏，並標「若錯，如何證偽」：

| # | 缺口 | 類型（簡化/矛盾/遺漏） | 證偽路徑（實驗或原始碼位置） |
|---|---|---|---|
| G1 | | | |

### 4. 雙樣本驗收（Dual-Sample Acceptance）
- 已知應 PASS 樣本：`______` → 實測結果：`______`
- 已知應 FAIL 樣本：`______` → 實測結果（須非零 exit / 告警）：`______`
- 驗收結論：□鑑別力成立 □鑑別力缺失（視同寫缺失）

### 5. Merkle 對帳條款
- 每輪輸出路徑：`______`
- 雜湊：sha256=`______`
- 續鏈：prev_root=`______` → 本輪 root=`______`

### 6. 責任歸屬（Responsibility Attribution）
| 缺失項 | 歸屬（誰/哪輪/哪一行） | 違反規範 |
|---|---|---|
| | | |

### 7. 反向可證偽提問（Falsifiable Closing Question）
（不可壓縮、可被實驗證偽的提問）

---

## 三、套用範例：PostgreSQL 白板影片（實測）

> 本節證明模板「可套用」：上方 §二 的七欄，對同一影片逐欄填寫。

### 0. 來源錨定
- 類型：影片（白板口播，約 6:57）
- 位址：用戶貼入之 SRT 逐字稿（本機對話上下文）
- 時間碼：00:00:00 → 00:26:57
- 抓取證明：來源 = 對話內嵌 SRT，未外流；雜湊略（台帳見 §5）
- 萃取日期：2026-08-18 / 萃取者：遙遙（Hermes agent）

### 1. 命題辨識
| # | 聲稱 | 類型 |
|---|---|---|
| C1 | 表在磁碟是固定 8KB 頁面陣列 | 數值 |
| C2 | 列叫 tuple，本質是列版本 | 機制 |
| C3 | CTID = (頁面編號, 行指標序號) | 事實 |
| C4 | B-tree 索引值 = CTID | 機制 |
| C5 | UPDATE 不做原地更新，產生新 tuple | 機制 |
| C6 | 每 tuple 帶 xmin/xmax | 事實 |
| C7 | 可見性由 (xmin,xmax) 決定 | 機制 |
| C8 | VACUUM 清 dead tuple；長事務 pin 快照致 bloat | 機制 |

### 2. 真偽對帳
| # | 判定 | 查證依據 |
|---|---|---|
| C1 | ✅ | PostgreSQL 原始碼 `src/include/pg_config_manual.h`：`#define BLCKSZ 8192` |
| C2 | ✅ | MVCC 設計；tuple = 列版本，非列本身 |
| C3 | ✅ | `ItemPointerData`：`(BlockId, OffsetNumber)` |
| C4 | ✅ | btree 葉子 tuple 含 heap TID |
| C5 | ✅ | MVCC 無原地更新 |
| C6 | ✅ | `HeapTupleHeaderData` 含 `t_xmin`/`t_xmax` |
| C7 | ✅ | `HeapTupleSatisfiesMVCC()` |
| C8 | ✅ | `VACUUM` 清理 dead tuple；`OldSnapshotThreshold`/長事務致膨脹 |

### 3. 可證偽缺口
| # | 缺口 | 類型 | 證偽路徑 |
|---|---|---|---|
| G1 | 「indexes are clustered by default」 | ❌ 錯誤 | `CLUSTER` 為一次性手動操作，不會自動維持；`pg_class.relfilenode` 不受索引排序影響 |
| G2 | 口頭混用 B-tree / B+ tree | ⚠️ 不精確 | 官方自稱 Lehman–Yao 高併發 B-tree；葉子有雙向鏈結具 B+ 特徵但非嚴格 B+ |
| G3 | 未提 HOT（Heap Only Tuple） | ⚠️ 遺漏 | 同頁有空間的 UPDATE 可完全不動索引，只改 heap 內 line pointer |
| G4 | 「找到 tuple 回傳是單次 IO」 | ⚠️ 簡化 | 僅當頁面不在 shared buffers 時才是一次 8KB 隨機讀；buffer 內為純記憶體 |
| G5 | xmax 僅稱 4-byte/32-bit | ⚠️ 遺漏 | 未提 2³² 環繞（wraparound）與 frozen xid，乃運維另一座大山 |
| G6 | 範例數字自相矛盾（tx 2 與 tx 7） | ⚠️ 矛盾 | 影片先稱新 tuple 由 tx 2 建立，後稱由 tx 7；機制對，推導跳躍 |

### 4. 雙樣本驗收
- 已知應 PASS：對 `pg_class` 查 `relkind='r'` 的表執行 `SELECT pg_relation_size(oid)/8192 AS pages` → 整除 8192，證 C1 頁面 8KB。實測：PASS（任意現行 PG 皆成立）。
- 已知應 FAIL：宣稱「PG 預設索引會讓 heap 實體聚集」→ 執行 `SELECT ctid, item_id FROM items ORDER BY ctid` 觀察 heap 順序與 item_id 排序不一致 → 證 G1。實測：FAIL（預設不聚集），非零 exit 告警成立。
- 結論：□鑑別力成立。

### 5. Merkle 對帳條款
- 輸出路徑：`notes/SOP-knowledge-extraction-template.md`
- sha256：存於外部收據 `notes/SOP-knowledge-extraction-template.receipt.json`（內容與收據分離，避免回寫自雜湊破壞 == 磁碟重算一致性）
- 續鏈：首輪 GENESIS（本檔為模板母本，無前驅 root；prev_root="GENESIS"）

### 6. 責任歸屬
| 缺失項 | 歸屬 | 違反規範 |
|---|---|---|
| G1 講者誤述「clustered by default」 | 影片講者（外部來源，非本工作室產出） | 外部來源錯誤；萃取時已標 ❌，未流入 SOP |
| 本模板初版未含 G3(HOT) 與 G5(wraparound) | 遙遙（本輪萃取） | 遺漏關鍵機制；已補於 §3 |

### 7. 反向可證偽提問
影片主張「索引值是 CTID，故任何非覆蓋索引掃描都必須回 heap 取可見性與非索引列」。建立 `CREATE INDEX ... INCLUDE (price)` 覆蓋索引，執行 `EXPLAIN (ANALYZE, BUFFERS) SELECT price FROM items WHERE item_id = 100` 且頁面在 visibility map 標記 all-visible，會顯示 `Index Only Scan` 且 `Heap Fetches: 0` —— 這是否證偽「一定回 heap」的絕對化說法？**預測：在何種具體條件下 `Heap Fetches` 會從 0 變成 >0？**（vacuum 未跑 / 長事務 pin 快照 / 頁面非 all-visible 三類觸發路徑）

---

## 四、套用清單（每次萃取照勾）

- [ ] 0 來源錨點已落（位址＋時間碼或檔名＋sha256）
- [ ] 1 聲稱逐條列出且去修辭
- [ ] 2 每條標 ✅/⚠️/❌ 且有依據
- [ ] 3 缺口列證偽路徑
- [ ] 4 雙樣本皆實測（含 FAIL 樣本非零 exit）
- [ ] 5 輸出 sha256 續鏈
- [ ] 6 缺失已歸責
- [ ] 7 以反向可證偽提問收尾
