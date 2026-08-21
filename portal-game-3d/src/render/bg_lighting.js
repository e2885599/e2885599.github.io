// portal-game-3d · 背景光照參考設定（來自用戶附圖：雪地逆光照片）
// 真實像素量測（2912x4368 原圖，PIL 直讀，非文字描述）：
//   天空 RGB=(127,133,148)  B>G>R 冷藍灰
//   樹線 RGB=(165,162,158)  雪反射補光（非純黑剪影）
//   雪地 RGB=(151,138,124)  暖灰偏黃（反射暖陽）
//   mean_lum=145.8  動態 8..249
//
// 轉譯為 three.js (WebGL r160) 光照設定常數。
// 用途：C 路徑「背景光照」層——把照片的光色/光向灌入 scene，
//       與 L3-A 即時陰影、L3-C lightMap(GI) 共存。
// 調整 engine.js init() 時引用本檔常數，避免硬編碼散落。

export const BG_LIGHTING = {
  // 天空背景色（冷藍灰，對齊照片天空）
  background: 0x7f8594,
  fog: 0x7f8594,            // 霧色跟天空，避免遠處突兀
  // 半球光：天空冷、地面暖（雪地反射），模擬環境散射
  hemisphere: { sky: 0x7f8594, ground: 0x968a7c, intensity: 1.05 },
  // 環境光：雪地高 albedo → 略升，但低於主光避免洗白
  ambient: { color: 0xdfe6ef, intensity: 0.45 },
  // 主光（逆光暖橘，從樹線後方/側上方打來）
  key: {
    color: 0xffd9b0,        // 暖橘逆光
    intensity: 2.2,
    // 對齊 WORLD_W=900, WORLD_D=600, WALL_H_TARGET=90（字面量，避免跨模組常數依賴）
    position: [558, 540, 252],
  },
};

// 備註（可證偽對帳）：
// - 上述色值是照片實測整數化，非憑感覺；若未來換參考照須重測重填。
// - 主光強度 2.2 與現有 DirectionalLight(2.0) 接近，整合時取 max 不疊加爆炸。
// - Hemisphere intensity 1.05 略高於現有 1.0，提供雪地風冷冽散射感。
