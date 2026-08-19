# 程序化動畫技術摘要（C）

來源影片：**"Step by Step" Procedural Animation** — Lincoln Margison（YouTube: `vKiqs_h1WXM`）
引擎：Unreal Engine 5 Control Rig。核心概念跨引擎（Unity / 自研 / Three.js 皆可用）。

---

## 一、程序化動畫是什麼

> 用「程序（邏輯 + 變數）」產生的動畫，而非手 K 關鍵幀。

- 輸入改變 → 輸出改變。輸入可以是「環境」（如階梯高度、坡度）或「系統變數」（如步幅 stride length）。
- 優點：一套系統適應多情境，不必為每種階梯高度 / 方向 / 轉向各做一條動畫。
- 影片範例：蜘蛛 8 足程序化行走循環（Procedural Walk Cycle）。

---

## 二、核心演算法步驟（萃取自字幕）

| 步 | 名稱 | 作法 |
|---|---|---|
| 1 | **足部命中地面** (Foot Placement) | 對每條腿末端骨 `foot`，從其上方 +150（後改 ±450）與下方 -150 做 sphere/line trace，命中點 = 地面位置 |
| 2 | **世界空間鎖定** (World-Locked Feet) | Setup Event 把每腳初始命中位置存入陣列 `WorldLockedFootLocations`；IK 求解時把腳鎖在該世界座標。需用 `To World` / `From World` 在 rig space ↔ world space 轉換 |
| 3 | **速度計算** (Calculate Velocity) | 取 pelvis（根骨）當前世界座標 − 上幀保存 `PreviousWorldLocation`，除以 `DeltaTime` → 速度向量；再用插值平滑（避免幀時差抖動） |
| 4 | **預測落點** (Predicted Foot Target) | 在 `CalculateNewFootTargets`：當前 foot 世界位置 + 速度 × 預測時間 → 投影未來點；對該未來點做 trace 找地面 → 存 `WorldTargetFootLocations` |
| 5 | **步態計時器** (Foot Timings) | 每腳一個計時器陣列；`IncreaseFootTimings` 每幀 += DeltaTime（可乘速度因子加速）；超過閾值（如 3）觸發重算落點並重置；誤差補償：腳與目標距離 > clamp 上限（如 1200）也強制觸發 |
| 6 | **抬腳弧線** (Lift Arc) | `lerp(locked, target, alpha)` 中對 Z 加 height = `Curve(alpha) × maxLift`；Curve 起終 0、中段 1（auto 平滑）；`maxLift` 依速度 clamp（靜止不抬腳） |
| 7 | **骨盆彈簧插值** (Pelvis Spring) | 骨盆目標 = 所有腳平均位置（`CalculateAverageFootLocation`）；用 Spring Interp（strength≈2, damping≈0.5）插值，避免過邊緣瞬落；trace 用較大半徑 sphere |
| 8 | **局部 vs 世界空間** (Local/World) | 影片承認純世界空間在高速 / 轉向 / 人形角色會不自然；正解應在 local space 預測與做弧線、落地再鎖回 world |

**IK 求解**：腿用 Basic IK（兩骨 IK，item A=根、item B=小腿、effector=腳尖）；需設 primary/secondary axis 與 pole vector（蜘蛛膝全朝上 → pole vector Z=10000）。

---

## 三、關鍵陷阱（作者親述 bug / fix，可證偽）

| 編號 | 現象 | 根因 | 解法 |
|---|---|---|---|
| T1 | 腳穿地（過邊緣瞬落穿模） | trace 起點在正上方腳，腿非垂直 → 過邊緣命中錯 | trace 起點改 `interpolate(pelvis, foot, t=0.5)` 中點 |
| T2 | 移動中腳穿地 | 先 trace 再投影未來位置（順序錯） | 先投影未來位置，再對該點 trace 找地面 |
| T3 | 靜止時腳一直抬 | maxLift 固定值 | maxLift 乘速度長度 remap（速度 0 → 抬升 0） |
| T4 | 全部腳同步抬 | 計時器同時歸零 | 初始化用 `index × 0.125` 偏移；高速強制重置設隨機負值 |
| T5 | 速度算錯（全腳指向一處） | `PreviousWorldLocation` 只取 bone global transform 未轉 world | 必須 `To World` 轉換 |
| T6 | 陣列越界報錯 | ①for-each 迴圈內放 return 節點 ②Target array 未預填 | return 放 on complete；Setup Event 預填 8 筆 |
| T7 | 編譯報錯（loop limit） | Control Rig 預設 Node Run Limit=64，巢狀迴圈超限 | Class Settings 調到 128 |
| T8 | 骨盆過邊緣瞬落 | 直接 set 命中位置 | Spring Interp + 加大 sphere trace 半徑 |
| T9 | 預測過遠腿拉伸 | 速度向量未 clamp | clamp 速度長度（如 1200）限制預測距離 |
| T10 | squid 現象（全腳指同一點） | 迴圈內沒用當前 foot index 當陣列索引 | 用 local `currentFootIndex` 當陣列索引 |
| T11 | IK 腿扭曲 | 未設極軸/極向量 | 設 primary/secondary axis + pole vector |

---

## 四、可移植到 Three.js / WebGPU 的要點

1. **空間轉換**：rig space（骨架本地）↔ world space 對應 Three.js 的 `bone.worldToLocal()` / `localToWorld()`。
2. **Foot Trace**：Three.js 用 `Raycaster` 從腳上方向下打地面（Plane 或地形 mesh），取 `intersection.point`。
3. **速度**：`(rootWorldPos - prevRootWorldPos) / dt`，`dt` 取 `clock.getDelta()`；平滑用 `Vector3.lerp()`。
4. **抬腳曲線**：用 `THREE.CatmullRomCurve3` 或簡單 `sin(α×π)` 當 lift profile。
5. **骨盆彈簧**：自寫 spring-damper（`v += (target-pos)×stiffness×dt; v×=(1-damping); pos+=v×dt`）或用 `MathUtils.damp`。
6. **IK**：Three.js 無內建 two-bone IK，需自寫（law of cosines + pole vector）——見 B demo。
