# Vibe-Coding 遊戲開發方法論筆記（影片實證萃取）

> 來源：一段 ~36 分鐘 YouTube 逐字稿，主題＝用 AI（Claude Code + Codex + GPT-5.2/5.3 + Nano Banana 2 + Playwright）vibe coding 一款《Final Fantasy Tactics》風格戰棋遊戲。
> 萃取目的：可複用的方法論，並對齊 OODAV 既有工程鐵律（單一真相源 / Merkle / 雙樣本 / 防假通過）。
> 標記：[已有]＝我們既有的對應能力；[缺口]＝我們還沒有、值得補；[落地]＝本輪已在 duckov-fps 實作。

---

## 一、核心工作流（呼叫順序）

| 步驟 | 作法 | 我們的對應狀態 |
|---|---|---|
| 1. 規劃（plan mode） | 用「思考/規劃模型」(GPT-5.2 high) 先做計畫，不急著寫碼 | [缺口] 我們只有 ROLE 框架，無「規劃模型 vs 編碼模型」的分工概念 |
| 2. Ask User Questions | 規劃期主動向人類澄清（用在哪、怎麼對應），避免早期錯誤 | [缺口] 我們的 ROLE 框架靠 E(範例) 與 L(限制) 靜態給定，無互動澄清迴圈 |
| 3. 切編碼模型實作 | 規劃定案後切 GPT-5.3 high / Codex 實作 | [已有] ai-coding-prompt-framework + codex-autofix 覆蓋此段 |
| 4. 資產單一真相源 | asset index.json 讓 AI/渲染層一眼讀到所有資產路徑與約束 | [落地] duckov-fps/assets/index.json + tests/test_asset_index.mjs |
| 5. 事後 learnings | 每次迭代完把「坑/對策/成因」寫入 learnings 資料夾沉澱 | [落地] duckov-fps/learnings/ + tools/add_learning.py(sha256收據) |
| 6. 自動視覺驗收 | Playwright 自動截圖/點擊測試，讓 AI 自行看見錯誤 | [缺口] 我們用 headless Chrome 跑邏輯驗收，無 Playwright 視覺迴圈 |
| 7. 並行控管 | queued message（排隊）vs interrupt（打斷當前實作）的細微差別 | [缺口] 我們單代理線性執行，無此控管手法 |
| 8. 提交 | LazyGit / git 把每步 prompt + plan + code + learnings 全留存 | [已有] Merkle 收據對帳；[缺口] duckov-fps 尚未 git 化 |

---

## 二、值得補強的具體缺口（對照既有工作流）

### 缺口 A：規劃模型 vs 編碼模型 的分工（CLAUDE/Codex 雙引擎）
- 影片重點：規劃用 GPT-5.2（強在多模態/組織/創意），實作用 GPT-5.3/Codex（強在寫碼）。**兩者不可混用**。
- 我們的 `codex-autofix` 已有「動態多模型選型（依 CUD + 三維特徵）」，但那是「糾錯模型」選型，不是「規劃 vs 實作」的任務分層。
- 補強建議：在 `ai-coding-prompt-framework` 增加「先 plan-mode（思考模型）定案 → 再實作（編碼模型）」的強制順序規範，並明定 plan 產物（plan 檔）要落盤。

### 缺口 B：互動澄清迴圈（Ask User Questions）
- 影片：Codex/Claude 的 plan mode 會主動問「portrait 用在哪里？敵人怎麼對應？」再定案。
- 我們的 ROLE 框架是單次指令（R/O/L/E 一次給齊），缺乏「AI 反問 → 人類答 → 再定案」的迭代。
- 補強建議：在委派子代理/Codex 前，允許 plan 階段回傳 `clarifications` 清單交人類裁決（human-in-the-loop），對齊我們既有的「重大決策留人類」原則。

### 缺口 C：Playwright 自動視覺驗收閉環
- 影片：用 Playwright 自動跑遊戲、截圖、讓 AI 看見「對話框擋住角色」這類視覺 bug 並自行修。
- 我們：duckov-fps / game-dungeon 用 headless Chrome 跑**邏輯**驗收（`verify.js` / `test_*.mjs`），但無**視覺**回授（截圖→AI 判讀→修）。
- 補強建議：因本機無 winget/pip 裝 Playwright，可改用既有的「本機 Chrome headless + 截圖 + vision_analyze 判讀」三件式，做出等效的視覺驗收閉環（對齊 webgl-headless-verification 技能）。

### 缺口 D：queued vs interrupt 控管
- 影片：可以用「排隊訊息」讓當前實作跑完再接續，或用「打斷」在 commit 前攔下 bug。
- 我們：單代理線性，無此需求；但對應到「delegate_task 靜默失敗」風險，可在 subagent 任務加 `interrupt_guard`：commit 前先回報 diff 供人類攔截。

### 缺口 E：duckov-fps 尚未 git 化
- 影片強調「每步都留存（prompt/plan/code/learnings）」才能複現與教學。
- duckov-fps 目前 `NO_GIT`，依賴手動備份。建議初始化 git（對齊 codex-autofix 待辦「對 OPS 專案初始化 git」）。

---

## 三、本輪已落地（duckov-fps）

1. **資產單一真相源** `assets/index.json`
   - 收攏 splat_points / base_categories / missions / splat_train_frames 四項資產，標註 path/type/consumed_by/tests/constraints/registry_role。
   - 分 `render_modules` / `core_modules` / `tools` 三類，含 `depends_on` 依賴圖。
   - 驗收 `tests/test_asset_index.mjs`：雙向一致性（assets↔modules）+ 測試檔存在性，ALL PASS。
2. **learnings 沉澱機制** `learnings/` + `tools/add_learning.py`
   - 結構化記錄（ts/feature/context/lesson/evidence），落盤 `learnings.jsonl`。
   - 每條產 sha256 收據（`receipts/learning_<ts>.json`），對帳一致（實測 match=True）。
   - 雙樣本 `--selftest`：GOOD 寫入成功 / BAD 缺失欄位 exit≠0，ALL_PASS。

---

## 四、可直接複用的工程鐵律（與 OODAV 既有一致）

- **單一真相源**：資產索引只指路不複製值；分散清單仍為各自領域單一真相源。
- **雙向守門**：索引改了要能被測試抓到（assets↔modules 互相引用必須對齊），否則索引腐化。
- **誠實約束**：splat 點雲標註「非真3DGS」、WebGPU 路徑標註——與我們「不可壓編、誠實標註」原則一致。
- **收據可對帳**：learnings 收據 sha256 必須能獨立重算一致（對齊 Windows `wb` 寫入鐵律）。
- **雙樣本驗收**：任何新驗收器必跑 GOOD/BAD 雙樣本，否則 = 沒測（用戶硬規）。
