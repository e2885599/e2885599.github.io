# portal-game-3d 統一設計規格（DESIGN_SPEC）

> 本規格抽取自三份**已存在且可運行**的程式碼，所有欄位與公式均標註真實行號，
> 作為 3D WebGPU 重建（把 portal-lab 3D 與 noether 3D 合併為 portal-game-3d）的藍本。
> 來源檔案（均位於 `D:/OODAV-MIRROR`）：
>
> | 來源 | 路徑 | 關鍵區段 |
> |------|------|----------|
> | ① 2D 主要版（已驗證可玩） | `02-STUDIO/portal-game.html`（638 行） | LEVELS `L96-174`；物理常數 `L80-86`；placePortal `L253-271`；tryTeleport(2D) `L357-380`；碰撞 `L323-355` |
> | ② noether 諾特物理 3D | `01-OPS/noether-portal/noether_portal.html`（1370 行） | `LEVELS_DATA` `L471-503` |
> | ③ portal-lab 3D 穿越數學 | `01-OPS/portal-lab/portal3d_unified.html`（853 行） | firePortal `L303-324`；makePortal `L327-351`；tryTeleport(3D) `L353-410` |

---

## ① 關卡資料模型（JSON schema，含 noether 欄）

### 1.1 現狀 A：2D 主要版（`portal-game.html`）

資料結構註解（`L92`）：
```
牆: {x,y,w,h,portalable}   方塊: {x,y}   按鈕: {x,y,w,h,door}   門: {x,y,w,h,id}   終點: {x,y,r}
```
5 關 `LEVELS` 陣列（`L96-174`），每關頂層欄位（實際萃取）：

| 欄位 | 型別 | 出處 | 說明 |
|------|------|------|------|
| `name` | string | `L98,113,128,143,159` | 關卡名 |
| `intro` | string | `L99,114,129,144,160` | 教學文案 |
| `spawn` | `{x,y}` | `L100,114,130,145,161` | 玩家出生（2D 恆在左側，見 `L93-94` 可解性證明） |
| `goal` | `{x,y,r}` | `L100,114,130,145,161` | 終點圓（半徑 `r:26`） |
| `walls` | `[{x,y,w,h,portalable}]` | `L101-107` 等 | 含 `portalable:true` 才可被門化 |
| `cubes` | `[{x,y}]` | `L137,153,169`（L1/L2 為 `[]`） | 可搬運方塊 |
| `buttons` | `[{x,y,w,h,door}]` | `L138,154,170` | `door:"d1"` 指向門 id |
| `doors` | `[{x,y,w,h,id}]` | `L139,155,171` | `id:"d1"`，未開啟視為實心牆（`L291-302`） |
| `hardHazards` | `[{x,y,w,h}]` | `L109,124,140,156,172` | 僅 hard 模式啟用（`L191`） |

**萃取實例（第 3 關，方塊開門，`L126-141`）：**
```js
{ name:"第 3 關：方塊開門", spawn:{x:140,y:600}, goal:{x:900,y:600,r:26},
  walls:[ /* 5 面，含天花板/左牆/右牆 portalable:true + 左地板/右地板 */ ],
  cubes:[ {x:140,y:640} ],
  buttons:[ {x:1100,y:660,w:70,h:20,door:"d1"} ],
  doors:[ {x:980,y:430,w:40,h:250,id:"d1"} ],
  hardHazards:[ {x:560,y:680,w:160,h:40} ] }
```

### 1.2 現狀 B：noether 3D（`noether_portal.html` `LEVELS_DATA` `L471-503`）

5 關：`vertical-river / horizontal-river / L-shaped / ring-island / cross-quadrants`。
每關頂層欄位（實際萃取）：

| 欄位 | 型別 | 出處 | 說明 |
|------|------|------|------|
| `name` | string | `L471`（L1）、`L472`（L5） | 關卡名（含 ①～⑤ 序號） |
| `archetype` | enum | `L471` `archetype:"vertical-river"`、`L473` `cross-quadrants` | 關卡原型 |
| `noether` | **string（諾特物理寓意）** | `L471`、`L474` 等 | 本關守恆律/對稱性說明（必須保留） |
| `start` | `{x,z}` | `L471` `{x:130,z:300}`、`L475` | 出生點（3D 用 x,z 平面） |
| `exit` | `{x,z,w,d,h}` | `L471` `{x:812,z:276,w:48,d:48,h:200}` | 終點盒 |
| `hardTimer` | number | `L471` `55`；`L477` `110` | 困難模式倒數秒數（55/70/88/95/110） |
| `hint` | string | `L471` | 提示文案 |
| `walls` | `[{x,z,w,d,h,portalable\|noportal}]` | `L471` | `portalable:true` 可門化；`noportal:true` 不可 |
| `hazards` | `[{x,z,w,d,h,hard?,motion?}]` | `L471`、`L490-494` | `hard:true` 僅 hard 出現；`motion:{axis,x0,amp,speed}` 移動尖刺 |
| `boxes` | `[{x,z,w,h,d}]` | `L496` `{x:600,z:430,w:36,h:36,d:36}` | 3D 方塊（含深度 d） |
| `buttons` | `[{x,z,w,d,door}]` | `L497` `{x:588,z:500,w:56,d:40,door:0}` | `door:0` 指門索引 |
| `doors` | `[{x,z,w,d,h}]` | `L498` `{x:726,z:330,w:16,d:200,h:220}` | 門（無 id，改用陣列序） |
| `lavaInstantDeath` | bool | `L471`、`L499` `true` | 岩漿即死標記 |
| `_world_w / _world_d / _pr` | number | `L471`、`L500-502` | 世界寬/深、玩家半徑（900/600/16） |

**萃取實例（第 5 關 cross-quadrants，`L472-503`）：**
```js
{ name:"⑤ 十字交叉", archetype:"cross-quadrants",
  noether:"三守恆綜合：p_t（零穿透）＋ ΔE（岩漿判死）＋ 拓撲荷 Q（出口跳關）同時受檢；本關起點西南、出口東南，只需跨越一道屏障。",
  start:{x:108,z:512}, exit:{x:800,z:520,w:48,d:48,h:200}, hardTimer:110,
  walls:[ /* 9 面，含 portalable / noportal 混合 */ ],
  hazards:[ {x:430,z:0,w:30,d:600,h:60}, {x:0,z:286,w:900,d:30,h:60},
            {x:150,z:340,w:42,d:42,h:120,hard:true,motion:{axis:"z",x0:340,amp:200,speed:1.6}},
            {x:660,z:420,w:42,d:42,h:120,hard:true,motion:{axis:"x",x0:660,amp:160,speed:1.9}} ],
  boxes:[{x:600,z:430,w:36,h:36,d:36}], buttons:[{x:588,z:500,w:56,d:40,door:0}],
  doors:[{x:726,z:330,w:16,d:200,h:220}], lavaInstantDeath:true,
  _world_w:900, _world_d:600, _pr:16 }
```

### 1.3 統一 schema（portal-game-3d 採用）

合併 ① 的 `intro / spawn{x,y} / goal{x,y,r}` 與 ② 的 `archetype / noether / start / exit / hardTimer / lavaInstantDeath / motion`，
座標統一為 **3D（x, y 高度, z）**，2D 的 `spawn.x/y` 對應 3D `start.x/z`（y 由 `exit.h` 決定落地高度）。

```jsonc
{
  "$schema": "portal-game-3d/level@1",
  "name":   "string",                       // ① L98 等
  "intro":  "string",                       // ① L99 等（教學，可選）
  "archetype": "vertical-river|horizontal-river|L-shaped|ring-island|cross-quadrants", // ② L471
  "noether": "string",                      // ② L471 諾特物理寓意（必要，對齊 noether 欄）
  "start":  { "x": 0, "z": 0 },             // ② L471 start；2D spawn{x,y}→{x,z}
  "exit":   { "x": 0, "z": 0, "w": 48, "d": 48, "h": 200 }, // ② L471 exit
  "goal":   { "x": 0, "y": 0, "r": 26 },    // ① L100 goal（2D 終點，3D 可改用 exit）
  "walls":  [ { "x":0,"z":0,"w":0,"d":0,"h":220, "portalable": true } ], // ② L471；noportal 反之
  "boxes":  [ { "x":0,"z":0,"w":36,"h":36,"d":36 } ],   // ② L496（2D cubes{x,y}→{x,z}）
  "buttons":[ { "x":0,"z":0,"w":56,"d":40, "door": 0 } ], // ② L497；2D door:"d1"→索引 0
  "doors":  [ { "x":0,"z":0,"w":16,"d":200,"h":220 } ],   // ② L498（2D 用 id，3D 用陣列序）
  "hazards":[ { "x":0,"z":0,"w":0,"d":0,"h":60, "hard": true,
                "motion": { "axis":"x|z", "x0":0, "amp":0, "speed":0 } } ], // ② L490-494
  "hardHazards": [ { "x":0,"y":0,"w":0,"h":40 } ],        // ① L109（2D 深淵尖刺，3D 轉 lava）
  "hardTimer": 55,                           // ② L471（55/70/88/95/110）
  "lavaInstantDeath": true,                  // ② L471
  "difficulty": {                            // ③ 雙軌（見 §3）
    "easy": { "hazards": false, "timer": false, "instantDeath": false },
    "hard": { "hazards": true,  "timer": true,  "instantDeath": true }
  },
  "_world_w": 900, "_world_d": 600, "_pr": 16  // ② L471 世界尺度
}
```

---

## ② 傳送門穿越變換公式

### 2.1 2D 版（已驗證，`portal-game.html` `tryTeleport` `L357-380`）

門資料結構（`placePortal` `L269-270`）：`{ side, x, y, nx, ny, tx, ty, len }`，
`(nx,ny)` 為牆面法線、`(tx,ty)=(-ny,nx)` 為切線、`len=PLEN=96`（`L86`）。

穿越判定與速度重映射（`L364-375`）：
```
dn = (ent - P) · n      // 沿法線距離（>0 在房內）
dt = (ent - P) · t      // 沿切線距離
if |dn| < r+4  &&  |dt| < len/2  &&  (vel·n) < 0:        // L367 由外穿入
    vn = vel·n (負值, 朝向牆)                             // L369
    vt = vel·t                                            // L370
    vel' = Q.n*(-vn) + Q.t*vt                             // L371-372 動量守恆重映射
    pos' = Q + Q.n*(r+3)                                  // L373-374 從 Q 外側吐出
    cooldown = 0.12                                       // L375
```
→ 2D 為**純 2D 反射式重映射**：進門法向速度反向、切向速度保留，落點在出口門法線外側 `r+3`。

### 2.2 3D 版（portal-lab，`portal3d_unified.html` `L353-410`）

門資料（`makePortal` `L350`）：`{ x,y,z, nx, nz, group }`（法線在 xz 平面）。
`firePortal`（`L303-324`）用 `THREE.Raycaster` 命中 `portalMeshes`，
取 `h.face.normal` 經 `matrixWorld` 變換並保證指向相機（`L314-317`）後 `makePortal`。

穿越基變換（`tryTeleport` `L357-410`，整理為公式）：
```
up  = (0,1,0)
n   = normalize(P.nx, 0, P.nz)              // L361 入口門法線
t   = normalize(cross(up, n))               // L362 切線
s0  = (prevCenter - P) · n                  // L365 上一幀
s1  = (curCenter  - P) · n                  // L364 本幀
if s0 > 0 && s1 <= 0:                       // L366 由外穿入
    rel = curCenter - P                     // L368
    tu  = rel·t ;  uu = rel·up              // L369 門內局部座標
    if |tu| > 46 || |uu| > 80: continue     // L370 門橢圓半徑46 / 半高80
    if vel·n >= 0: continue                 // L372 速度須朝向門內
    n2  = normalize(other.nx,0,other.nz)    // L374 出口門法線
    t2  = normalize(cross(up, n2))          // L375
    cLocal = (rel·t, rel·up, rel·n)         // L376 入口局部座標
    newCenter = Op + t2*cLocal.x + up*cLocal.y + n2*(-cLocal.z - 3)   // L377-381 出門在外側 -n2
    // 速度變換（保辛、‖v‖ 不變）
    ct = vel·t ;  cn = vel·n                                          // L383-384
    vWorld = ( ct*t2.x - cn*n2.x ,  vel.y ,  ct*t2.z - cn*n2.z )      // L385-389
    // 視角（前向）同步變換
    fLocal = ( _v·t , _v.y , _v·n )                                   // L392
    fWorld = ( fLocal.x*t2.x - fLocal.z*n2.x , fLocal.y , fLocal.x*t2.z - fLocal.z*n2.z ) // L393-397
    yaw   = atan2(-fWorld.x, -fWorld.z)                               // L403
    pitch = clamp(asin(clamp(fWorld.y,-1,1)), -1.4, 1.4)             // L404
    teleCool = 0.12                                                    // L405
```
→ 3D 為**保辛等距變換**（對齊 noether `ring-island` 的 L_y 守恆 `L471`）：
將入口局部座標 `(t, up, n)` 重映射到出口局部 `(t2, up, -n2)`，速度與前向同理，保證 ‖v‖ 不變。

### 2.3 統一公式（portal-game-3d 採用）

以 ③ 的 3D 基變換為**唯一真相**，2D 的 `L357-380` 視為其 y 軸退化特例（up 固定、橢圓半高=len/2）。
門物件統一為 `{x,y,z,nx,ny,nz,halfW:46,halfH:80}`（`halfH` 在 2D 退化為 `PLEN/2=48`）。
玩家每子步（`L417-422` 的 sub=2 子步進）執行一次穿越檢測，cooldown=0.12s 防抖。

---

## ③ 難度雙軌（easy 不會死 / hard 岩漿即死＋移動尖刺＋倒數）

| 維度 | easy | hard | 來源證據 |
|------|------|------|----------|
| 死亡 | 不會死 | 岩漿即死 / 尖刺即死 | ① L57「簡單：不會死」；② `lavaInstantDeath:true` `L471` |
| 危害物 | 無 | 啟用 `hardHazards`（① L191 `mode==="hard"` 才載入）＋ `hazards` 中 `hard:true` 者（② L490-494、L...L4 `motion`） | ① L191；② hazards 含 `"hard":true` |
| 移動尖刺 | 無 | `motion:{axis,x0,amp,speed}` 週期移動（② L493-494 `axis/sp/x0/amp/speed`；L4 ring-island `motion:{axis:"z",x0:110,amp:340,speed:1.6}`） | ② L490-494 |
| 倒數計時 | 無 | `hardTimer`（55/70/88/95/110 秒，超時即死或重來） | ② `hardTimer` `L471`/`L477` |
| 重生 | 無需 | `deadFlash`→`hardRespawn()`（① L399） | ① L399 |

**雙軌實作要點：**
- `easy`：`hazards=[]`、`lavaInstantDeath=false`、`timer` 停用、不重置計時。
- `hard`：載入 `hardHazards` + `hazards[hard]`；岩漿/尖刺碰到觸發 `instantDeath`；`hardTimer` 倒數，`elapsed`（`L401`、`L181`）超時判死。

---

## ④ 玩家物理（重力 / 跳躍 / 碰撞）

### 4.1 物理常數（`portal-game.html` `L80-86`，2D 已驗證）
```
GRAV = 2200   // px/s^2 重力（L81）
MOVE = 320    // 水平速度（L82）
JUMP = -760   // 跳躍初速（L83）
PR   = 14     // 玩家半徑（L84）
CR   = 16     // 方塊半徑（L85）
PLEN = 96     // 傳送門長度（L86）
```

### 4.2 主更新迴圈（`portal-game.html` `update` `L395-438`）
```
ax = (←?-1:0)+(→?+1:0)              // L405-407
p.vx = ax*MOVE                      // L408 水平速度
if jumpKey && p.onGround: p.vy=JUMP; p.onGround=false   // L410
p.vy += GRAV*dt                     // L412 重力積分
if p.vy>1400: p.vy=1400             // L413 終端速度
sub=2; sdt=dt/sub                   // L416 子步進
for s in 0..sub:
    p.x += p.vx*sdt; p.y += p.vy*sdt   // L418 積分
    tryTeleport(p,p.r)                  // L419 穿越檢測（每子步）
    collideDoors(p,p.r)                 // L420 門碰撞
    p.onGround = collideWalls(p,p.r)    // L421 牆碰撞＋落地標記
```
方塊物理同構（`L428-438`：`GRAV`、`sub2=2`、穿越/門/牆碰撞各一次）。
搬運：`state.carry` 時方塊黏附玩家上方 `c.y=p.y-(p.r+c.r+2)`（`L425`）。

### 4.3 碰撞解算（圓 vs 矩形，`portal-game.html` `L323-355`）
- `resolveCircleRect`（`L324-339`）：求圓心到矩形最近點，穿透 `pen=r-d`，回傳法線 `(nx,ny)`；退化情形（圓心在矩形內）取最小邊推離（`L332-337`）。
- `collideWalls`（`L340-355`）：3 遍迭代解算，抵消穿透並移除指向法線的負速度（`vn<0` 時 `v -= vn*n`，`L348-349`）；`hit.ny<-0.5` 設 `grounded`（`L350`）。
- `collideDoors`（`L291-302`）：未開啟門 `d.open` 視為實心牆（`L294`）。

### 4.4 3D 物理對齊（portal-game-3d）
- 重力改為 3D：`vy += GRAV*dt`（y 為高度），水平保留 `vx/vz`；終端速度 1400 沿用（`L413`）。
- 碰撞：`resolveCircleRect` 推廣為圓柱 vs AABB（xz 平面同 2D，y 軸獨立）；`collideWalls` 的 3 遍迭代 + 法線速度抵消沿用（`L342-349`）。
- 子步進 `sub=2` 沿用（`L416`），每子步執行 ② 的 `tryTeleport`（`L419` 對應 ③ L419 概念）。

---

## 附錄：5 關映射表（2D ↔ noether 3D）

| # | 2D（① L96-174） | noether 3D（② L471-503） | 統一後 archetype / noether 關鍵字 |
|---|------------------|----------------------------|-----------------------------------|
| 1 | 跳過大洞 | ① 縱向河谷 | `vertical-river`：空間平移對稱→p_t 守恆 |
| 2 | 兩個大洞 | ② 橫向斷崖 | `horizontal-river`：守恆律與座標軸無關（空間等向性） |
| 3 | 方塊開門 | ③ L 型迴廊 | `L-shaped`：時間平移對稱破缺→dE/dt>0，死亡=守恆殘差 ΔE |
| 4 | 大洞加開門 | ④ 中央島嶼 | `ring-island`：繞 y 軸旋轉對稱→L_y 守恆，門為保辛等距 |
| 5 | 最後一關 | ⑤ 十字交叉 | `cross-quadrants`：三守恆綜合（p_t＋ΔE＋拓撲荷 Q） |

> 備註：本規格所有行號均已對照原始檔案實際讀取；2D `portal-game.html` 共 638 行、noether `LEVELS_DATA` 位於 `L471-503`、portal-lab `firePortal/makePortal/tryTeleport` 位於 `L300-410`。
