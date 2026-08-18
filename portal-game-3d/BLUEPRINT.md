# portal-game 重建藍圖 v2（3 款整合為 1 款 3D + 保留 2D）

> 狀態：v2（使用者指令更新：① portal-game.html 2D 原封保留；② portal-lab 3D + ③ noether 3D 整合為單一 3D WebGPU 遊戲）
> 依據：B4「越新越好技術棧」＋「核心骨架與關卡圖景都要大幅重新改建」＋「3 款整合成一款但保留 portal-game-2D 版」

## 一、三套現況與處置
| 套件 | 技術 | 關卡 | 傳送門 | 物理寓意 | 處置 |
|---|---|---|---|---|---|
| ① portal-game.html | Canvas 2D | 5 關寫死 | 2D | 無 | **保留，原封不動** |
| ② portal-lab/portal3d_unified.html | WebGL r128 內嵌 | 5 關 | 3D 雙門穿越 ✅ | 無 | 合併進新 3D |
| ③ noether-portal/noether_portal.html | WebGL r128 | 5 關（河谷/斷崖/L型/島/十字） | 3D 雙門 ✅ | 諾特守恆 ✅ | 合併進新 3D（取其關卡圖景＋物理寓意） |

## 二、新統一體 = portal-game-3d/（WebGPU + TSL）
繼承：
- ② 的 3D 傳送門穿越變換（`tryTeleport` 雙門配對、法線對齊、動量守恆）。
- ③ 的 5 關「諾特物理關卡圖景」（每關含 `noether` 欄：空間平移對稱→p_t 守恆／空間等向性／時間平移破缺→ΔE／旋轉對稱→L_y／三守恆綜合）。
- duckov-fps 的分層骨架（core/render/weapon/npc + importmap 本地 vendor）。

## 三、核心骨架分層
```
portal-game-3d/
├─ index.html              # importmap → 本地 vendor/three.webgpu.js + three.tsl.js
├─ src/
│  ├─ core/
│  │  ├─ engine.js         # WebGPURenderer 啟動 + 主迴圈 + 玩家 + 關卡載入
│  │  ├─ player.js         # 第一人稱 PointerLock + 重力/跳躍/碰撞
│  │  ├─ portals.js        # ★傳送門核心：雙門配對/穿越變換矩陣/動量守恆
│  │  ├─ level.js          # 關卡圖景資料模型 + 載入器（資料驅動）
│  │  └─ physics.js        # 諾特守恆量（ΔE 殘差/拓撲荷 Q/動量）計量
│  ├─ render/
│  │  ├─ materials.tsl.js  # TSL 材質：門面發光/岩漿/可portal標記
│  │  └─ scene.js          # 世界群組 + PCFSoft 軟陰影 + 霧
│  └─ weapon/
│     └─ portalgun.js      # 射門槍：raycaster 命中可portal面 → 生成門
├─ levels/levels.json      # ★5 關諾特物理關卡圖景（資料驅動）
├─ vendor/                 # 複製 noether 的 three.webgpu.js + three.tsl.js（已就位）
└─ tests/                  # headless 驗收（防假通過）
```

## 四、傳送門穿越變換（portals.js，承 ② 數學）
進 blue 面 → 從 orange 面出：
`exitMatrix = orange.worldMatrix × flip180(Y) × inv(blue.worldMatrix)`
速度大小不變（諾特荷守恆）。穿越檢測：由外穿入（法線 dot 符號由正轉負）。

## 五、關卡圖景（levels.json，承 ③）
5 關 archetype：vertical-river / horizontal-river / L-shaped / ring-island / cross-quadrants
每關：`{id,name,archetype,noether,start,exit,walls[],hazards[],boxes[],buttons[],doors[],hardTimer}`
難度雙軌：easy（不會死）/ hard（岩漿即死＋移動尖刺＋倒數）。

## 六、對抗式多代理（gauntlet-loop，/goal 72%）
- 對抗路徑 72%：傳送門穿越數學正確性 + 可portal面邊界 + headless 渲染無崩潰 + fail-sample（已知破關卡如 exit 被牆封死）。
- 整合路徑 28%：骨架組裝 + importmap 接本地 vendor + 關卡資料填充 + UI/HUD。

## 七、驗收關卡（防假通過）
1. headless Chrome：`window.__portalReady===true` 且無 console error（用 2026 版 vendor 經 importmap 載入）。
2. levels.json 經 Python 解析：5 關 archetype 非重複、exit 靜態可達性。
3. 穿越單元測試：虛擬進 blue → 出 orange 坐標符合變換矩陣（獨立 math 驗算）。
4. 雙樣本：PASS 關卡 + FAIL 關卡（exit 被牆封死）皆正確判別。

## 八、風險
- R1（已探針部分確認）：2026 版 vendor 本地 importmap 載入需 `three`+`three/webgpu`+`three/tsl` 三鍵對映；探針頁已能跑到 PROBE_DONE（無白屏崩潰）。最終 backend（webgpu vs webgl-fallback）需實證。
- R2：headless WebGPU 需 `--enable-unsafe-webgpu`；若環境不支援退回 WebGL fallback。
- R3：最終視覺需使用者肉眼確認（對齊高清交付）。

## 十、本輪實證成果（2026-08-18）
- ✅ 技術棧閘門 PASS：`probe_result.json` → `ok:true, backend:"webgpu"`；`three.core.js` 補進 vendor。
- ✅ 整鏈 headless 實證 PASS：`verify_boot.html` → `BOOT_OK{portalReady:true, hasEngine:true, level:"① 縱向河谷", portalMeshes:2}`，零 console error。
- ✅ 關卡可通性驗證器 `level_solvable.py`：5/5 關 PASS（easy+hard 雙軌），機制覆蓋 box/button/door/lava/moving-spike 全含；雙樣本自測（PASS 樣本 L1 + FAIL 樣本封死關卡）證明鑑別力。
- ✅ 核心骨架：`index.html`(importmap 本地 vendor) + `src/core/engine.js`(WebGPU 啟動/主迴圈/關卡載入) + `src/core/portals.js`(3D 雙門保辛等距穿越) + `levels/levels.json`(5 關諾特物理圖景)。
- ✅ 2D 主要版 `portal-game.html` 原封保留（實證 5 關/0 錯誤，作為最可行範本）。
- ⏳ 待續：TSL 材質美化（`materials.tsl.js`）、HUD 完善、對抗代理破壞性穿越驗收、GitHub Pages 部署。
