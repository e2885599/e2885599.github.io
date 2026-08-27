/*
 * ROLE: OODAV LAB 主動資運工程師 — 文章主題映照系統 主題對照表
 * O: 把每篇文章依主題映射到一組「色彩心理學」色板＋自製視差/短片資產標識，解決首頁單調與文章無主題映照
 * L: 純資料模組（無 DOM 依賴）；由 theme-inject.js 讀取；Odoo(Odoo ERP) 企業信任藍+創新紫靈感已內化為 --c-trust/--c-innovate
 * E: 每主題必含 6 個色令牌(與 style.css :root 同名覆寫) + parallax(自製資產類型) + short(短片標識)；缺欄視為寫缺失
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ThemeMap = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 色彩心理學依據（可證偽：每色對應一種情緒認知，文獻一致）
  // 藍=信任/專業/冷靜；紫=高端/創新/神祕；金=權威/價值；綠=安全/通過/對帳；橙=能量/警示；青=邏輯/科技
  // Odoo 靈感：其官方企業色為 信任藍(#714b67 紫莓 / #874a8c 實測品牌紫 + 深底)，此處取其「企業信任×創新」語意，非複製其 CSS
  var THEMES = {
    "ai-basics": {
      label: 'AI 基礎概念',
      band: 'AI 基礎概念 · 青色×邏輯',
      psych: '青色×邏輯 — 神經網路/LLM 的理性建構感',
      colors: { '--bg':'#06121f', '--bg2':'#0a1c30', '--panel':'#0d2236', '--panel2':'#103048',
                '--line':'#1f4a6b', '--line2':'#2c6b96', '--accent':'#36e0d4', '--accent2':'#5b8cff',
                '--amber':'#ffd27a', '--ink':'#e7f3fb', '--muted':'#9cc2d8', '--muted2':'#6c95ad' },
      parallax: 'tech-grid',   // 自製：流動網格視差
      short: 'ai-basics'  // 自製短片刷幀標識
    },
    "cost-feasibility": {
      label: '成本與可行性',
      band: '成本與可行性 · 金×權威',
      psych: '金×權威 — 給主管的「該不該花這筆錢」價值感',
      colors: { '--bg':'#1a1206', '--bg2':'#241a0a', '--panel':'#2a2010', '--panel2':'#33260f',
                '--line':'#5a3f1a', '--line2':'#7a5524', '--accent':'#f5c970', '--accent2':'#ffb347',
                '--amber':'#ffe9b8', '--ink':'#fbf3e0', '--muted':'#d8c39c', '--muted2':'#ad9670' },
      parallax: 'gold-particles',
      short: 'cost-feasibility'
    },
    "safety-audit": {
      label: '安全對帳 / 可證偽',
      band: '安全對帳 · 綠×通過',
      psych: '綠×通過 — 對帳/查證的「安全通過」訊號',
      colors: { '--bg':'#06140c', '--bg2':'#0a2016', '--panel':'#0d281c', '--panel2':'#103326',
                '--line':'#1f5a3a', '--line2':'#2c7a50', '--accent':'#7ee787', '--accent2':'#79c0ff',
                '--amber':'#ffd9a0', '--ink':'#e6f6ec', '--muted':'#9ccdb2', '--muted2':'#6cad88' },
      parallax: 'scan-lines',
      short: 'safety-audit'
    },
    "game-sop": {
      label: '博弈 / 人物 SOP',
      band: '博弈 SOP · 紫×創新',
      psych: '紫×創新 — 遊戲/博弈的動態與策略感（Odoo 創新紫靈感內化）',
      colors: { '--bg':'#160a26', '--bg2':'#221038', '--panel':'#2a1648', '--panel2':'#331f59',
                '--line':'#4a2f7a', '--line2':'#63429c', '--accent':'#b388ff', '--accent2':'#8b6cff',
                '--amber':'#ffd27a', '--ink':'#f3ecff', '--muted':'#c6b3e6', '--muted2':'#9d86c4' },
      parallax: 'game-particles',
      short: 'game-sop'
    },
    "interactive": {
      label: '互動實驗 / 高維度',
      band: '互動實驗 · 藍×信任',
      psych: '藍×信任 — 互動工具的冷靜可控感（Odoo 企業信任藍靈感內化）',
      colors: { '--bg':'#0a1426', '--bg2':'#0e1c34', '--panel':'#0f2440', '--panel2':'#13305a',
                '--line':'#234a7a', '--line2':'#2f63a0', '--accent':'#5b8cff', '--accent2':'#36c5e0',
                '--amber':'#ffd27a', '--ink':'#e7eefb', '--muted':'#9cb4d8', '--muted2':'#6c8aad' },
      parallax: 'wave-field',
      short: 'interactive'
    },
    generic: {
      label: '通用 / 工作室',
      band: 'OODAV LAB · 金紫品牌',
      psych: '金紫×品牌 — 回退到 OODAV 既定金紫設計語言',
      colors: { '--bg':'#1a0f2e', '--bg2':'#241544', '--panel':'#2a1a4a', '--panel2':'#331f59',
                '--line':'#4a2f7a', '--line2':'#63429c', '--accent':'#f5c970', '--accent2':'#8b6cff',
                '--amber':'#ffd27a', '--ink':'#f7f0ff', '--muted':'#c6b3e6', '--muted2':'#9d86c4' },
      parallax: 'aurora',
      short: 'generic'
    }
  };

  // 文章路徑 → 主題 對照（全站文章，可證偽：每篇必歸類，否則預設 generic）
  var ROUTES = {
    'notes/ai-concept-teaching.html': 'ai-basics',
    'notes/physics-of-learning.html': 'cost-feasibility',
    'notes/ai-scheming-debate.html': 'safety-audit',
    'notes/inception-essay.html': 'safety-audit',
    'notes/integrals-three-levels.html': 'ai-basics',
    'higher-dimensions/index.html': 'interactive',
    'lab/cg-orchestration.html': 'game-sop',
    'lab/engine-orchestration-blueprint.html': 'game-sop',
    'lab/portal-2d.html': 'game-sop',
    'duckov-fps/index.html': 'game-sop',
    'duckov-fps/architecture.html': 'game-sop',
    'portal-game-3d/index.html': 'game-sop',
    'about.html': 'generic',
    'contact.html': 'generic',
    'services.html': 'generic',
    'pricing.html': 'generic',
    'demo.html': 'generic',
    'lab.html': 'generic',
    'sop-game-character-gameplay.html': 'game-sop',
    'portal-game-3d/probe.html': 'game-sop'
  };

  function themeForPath(path) {
    if (!path) return 'generic';
    // 正規化：去開頭 ./ 與查詢
    var p = path.replace(/^\.\//, '').split('?')[0].split('#')[0];
    // 容許子目錄匹配（如 notes/xxx）
    for (var route in ROUTES) {
      if (p.indexOf(route) !== -1) return ROUTES[route];
    }
    return 'generic';
  }

  function getTheme(name) {
    return THEMES[name] || THEMES.generic;
  }

  // 自製視差資產清單（非模板套圖，皆 canvas/CSS 實作）
  var PARALLAX_ASSETS = {
    'tech-grid': '流動技術網格（青邏輯）',
    'gold-particles': '金色粒子流（權威價值）',
    'scan-lines': '對帳掃描線（綠通過）',
    'game-particles': '遊戲粒子場（紫創新）',
    'wave-field': '波場視差（藍信任）',
    'aurora': '極光流動（品牌金紫）'
  };

  return {
    THEMES: THEMES,
    ROUTES: ROUTES,
    PARALLAX_ASSETS: PARALLAX_ASSETS,
    themeForPath: themeForPath,
    getTheme: getTheme
  };
});
