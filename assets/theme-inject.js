/*
 * ROLE: OODAV LAB 主動資運工程師 — 主題注入層（文章主題映照系統執行端）
 * O: 依 <body data-theme> 或路徑自動判定主題，套用 theme-map.js 色板＋啟動「滾動驅動」視差資產（下滾正向、上滾反向）；
 *    升級：①解決子頁自帶 :root 實色背景遮罩視差 canvas 的問題（body 背景透明化，html 留主題 --bg 作基底）；
 *        ②修正子頁相對路徑：短片回源改以 script 標籤自身 src 推導站點根，避免 notes/assets/... 404；
 *        ③新增頂部主題色帶（theme-band），把「該篇文章主題＋色彩心理學寓意」顯式映照出來。
 * L: 純前端、無外部依賴；視差全自製(canvas)，不引用任何模板庫；若 ThemeMap 缺失則靜默降級 generic。
 * E: window.__theme 暴露 {name, applied, parallax, band}；window.__themeScroll 暴露 {progress, dir, t} 供 headless 驗收正向/反向捲動；
 *    window.__themeShort 暴露 {id, src, present, loaded, error} 供短片存在性對帳。
 * 色彩心理學依據（可證偽）：藍=信任/專業、紫=高端/創新、金=權威/價值、綠=安全/通過、橙=能量、青=邏輯/科技。
 * 設計靈感：Odoo 官方企業站「信任藍＋創新紫＋多彩色塊」已內化為本工作室自有色板（非複製其 CSS 模板）。
 */
(function () {
  'use strict';

  // 滾動狀態：progress=滾動進度(0..1)，dir=方向(+1下滾/-1上滾)，t=動畫相位(跟隨滾動)
  var scrollState = { progress: 0, dir: 0, t: 0, lastY: 0 };
  function updateScroll() {
    var y = window.scrollY || window.pageYOffset || 0;
    var max = (document.documentElement.scrollHeight - window.innerHeight) || 1;
    var p = Math.min(1, Math.max(0, y / max));
    var d = y > scrollState.lastY ? 1 : (y < scrollState.lastY ? -1 : scrollState.dir);
    scrollState.lastY = y;
    scrollState.progress = p;
    scrollState.dir = d;
    // 相位 t 跟隨滾動：下滾增、上滾減（反向播放）；以 progress*常數為主軸確保可重現
    scrollState.t = p * 40; // 全頁滾動對應 40 個相位單位
    window.__themeScroll = { progress: p, dir: d, t: scrollState.t };
  }

  // 由 script 標籤自身 src 推導站點根（解決子頁相對路徑錯誤）
  function siteRoot() {
    var me = document.querySelector('script[src*="theme-inject.js"]');
    var src = me ? me.getAttribute('src') : 'assets/theme-inject.js';
    var parts = src.split('/');
    var ups = 0;
    for (var i = 0; i < parts.length; i++) { if (parts[i] === '..') ups++; else break; }
    var root = '';
    for (var j = 0; j < ups; j++) root += '../';
    return root; // 頂層='' ; 一層='../' ; 兩層='../../'
  }
  var ROOT = siteRoot();

  function applyTheme(name) {
    if (!window.ThemeMap) { console.warn('[theme-inject] ThemeMap 缺失，降級 generic'); name = 'generic'; }
    var theme = window.ThemeMap.getTheme(name);
    var root = document.documentElement;
    for (var k in theme.colors) {
      if (theme.colors.hasOwnProperty(k)) root.style.setProperty(k, theme.colors[k]);
    }
    root.setAttribute('data-theme', name);
    document.body.setAttribute('data-theme', name);

    // ① 背景透明化：子頁自帶 :root 實色背景會蓋住 fixed 視差 canvas；
    //    改以 html 留主題 --bg 作最底基底（canvas 在其上、body 在更上），body 透明讓視差/短片透出。
    root.style.background = theme.colors['--bg'] || '#1a0f2e';
    document.body.style.background = 'transparent';
    document.body.style.backgroundImage = 'none';

    injectBand(theme);
    startParallax(theme.parallax);
    startShort(theme.short);
    updateScroll();
    window.__theme = { name: name, applied: true, parallax: theme.parallax, psych: theme.psych, band: theme.label };
    return window.__theme;
  }

  // ③ 頂部主題色帶：把文章主題＋色彩心理學寓意顯式映照（Odoo 企業感多彩色塊靈感）。
  //    注意：子頁（notes/ 等）多自帶獨立 :root 而未載入 assets/style.css，#theme-band 的外部 CSS 規則會缺失，
  //    故此處將關鍵樣式「內聯」寫入元素，確保無論是否載入 style.css 都能映照主題色（解決文章頁主題色帶不顯色）。
  function injectBand(theme) {
    var old = document.getElementById('theme-band');
    if (old) old.parentNode.removeChild(old);
    var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8b6cff';
    var accent2 = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim() || '#5b8cff';
    var bg = 'linear-gradient(90deg, ' + accent + ', ' + accent2 + ')';
    var band = document.createElement('div');
    band.id = 'theme-band';
    band.style.cssText = 'position:sticky;top:0;z-index:70;display:flex;align-items:center;gap:12px;'
      + 'padding:8px 24px;font-size:13px;letter-spacing:.3px;color:#fff;background:' + bg + ';'
      + 'border-bottom:1px solid ' + accent + ';box-shadow:0 4px 20px ' + accent + '55;backdrop-filter:blur(8px);';
    var dot = document.createElement('span');
    dot.style.cssText = 'width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:0 0 10px #fff;flex:none;';
    var label = document.createElement('span');
    label.style.cssText = 'font-weight:800;letter-spacing:1px;white-space:nowrap;';
    label.textContent = '主題 · ' + (theme.label || '通用');
    var psych = document.createElement('span');
    psych.style.cssText = 'opacity:.92;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    psych.textContent = (theme.psych || '');
    band.appendChild(dot); band.appendChild(label); band.appendChild(psych);
    document.body.insertBefore(band, document.body.firstChild);
    document.body.classList.add('has-theme-band');
  }

  // 自製視差資產：依類型啟動對應 canvas 動畫（相位 t 由滾動驅動，下滾正/上滾反）
  var canvasEl = null, rafId = null, ctx = null;
  function ensureCanvas() {
    if (canvasEl) return canvasEl;
    canvasEl = document.createElement('canvas');
    canvasEl.id = 'theme-parallax';
    canvasEl.style.cssText = 'position:fixed;inset:0;z-index:-3;width:100%;height:100%;display:block;pointer-events:none;opacity:.5;';
    document.body.appendChild(canvasEl);
    ctx = canvasEl.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', updateScroll, { passive: true });
    return canvasEl;
  }
  function resize() {
    if (!canvasEl) return;
    canvasEl.width = window.innerWidth;
    canvasEl.height = window.innerHeight;
  }
  function clearLoop() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }

  function startParallax(type) {
    clearLoop();
    var c = ensureCanvas();
    if (!ctx) return;
    var W = c.width, H = c.height;
    var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8b6cff';
    var accent2 = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim() || '#5b8cff';

    function frame() {
      var t = scrollState.t; // 相位由滾動驅動（下滾增/上滾減）
      ctx.clearRect(0, 0, W, H);
      if (type === 'tech-grid') {
        // AI/邏輯頁：流動方格網（青理性，非共用底紋）
        ctx.strokeStyle = accent; ctx.globalAlpha = 0.12; ctx.lineWidth = 1;
        for (var y = -H; y < H; y += 40) {
          var off = (y + t * 12) % (H * 2);
          ctx.beginPath(); ctx.moveTo(0, off); ctx.lineTo(W, off - W * 0.3); ctx.stroke();
        }
      } else if (type === 'aurora') {
        // 首頁/通用：柔和流光帶（金紫品牌，與方格網區分，不共用質感）
        for (var a = 0; a < 3; a++) {
          var ay = H * (0.25 + a * 0.27) + Math.sin(t * 0.3 + a) * 40;
          var grad = ctx.createLinearGradient(0, ay, W, ay + 60);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(0.5, accent);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.strokeStyle = grad; ctx.globalAlpha = 0.10; ctx.lineWidth = 2;
          ctx.beginPath();
          for (var ax = 0; ax <= W; ax += 12) {
            var ay2 = ay + Math.sin(ax * 0.004 + t * 0.4 + a) * 26;
            if (ax === 0) ctx.moveTo(ax, ay2); else ctx.lineTo(ax, ay2);
          }
          ctx.stroke();
        }
      } else if (type === 'gold-particles' || type === 'game-particles') {
        ctx.fillStyle = accent;
        for (var i = 0; i < 60; i++) {
          var px = (i * 97 + t * 6 * (i % 3 + 1)) % W;
          var py = (i * 53 + Math.sin(t + i) * 40 + t * 4) % H;
          ctx.globalAlpha = 0.2 + 0.3 * Math.abs(Math.sin(t + i));
          ctx.beginPath(); ctx.arc(px, py, 1.5 + (i % 3), 0, 6.28); ctx.fill();
        }
      } else if (type === 'scan-lines') {
        ctx.fillStyle = accent; ctx.globalAlpha = 0.10;
        var sy = (t * 16) % H;
        ctx.fillRect(0, sy, W, 3);
        ctx.strokeStyle = accent2; ctx.globalAlpha = 0.08;
        for (var x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      } else if (type === 'wave-field') {
        ctx.strokeStyle = accent; ctx.globalAlpha = 0.14; ctx.lineWidth = 1.5;
        for (var wy = 0; wy < H; wy += 30) {
          ctx.beginPath();
          for (var wx = 0; wx <= W; wx += 10) {
            var yy = wy + Math.sin(wx * 0.01 + t * 0.5) * 18;
            if (wx === 0) ctx.moveTo(wx, yy); else ctx.lineTo(wx, yy);
          }
          ctx.stroke();
        }
      }
      rafId = requestAnimationFrame(frame);
    }
    frame();
  }

  // 可選背景短片層：依站點根解析 assets/shorts/<short>.mp4（修復子頁相對路徑），靜音 loop 播放，否則保持 canvas 視差
  var videoEl = null;
  function startShort(shortId) {
    if (videoEl) { videoEl.remove(); videoEl = null; }
    if (!shortId) return;
    var src = ROOT + 'assets/shorts/' + shortId + '.mp4';
    var v = document.createElement('video');
    v.id = 'theme-short';
    v.src = src; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.preload = 'auto';
    v.style.cssText = 'position:fixed;inset:0;z-index:-4;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;opacity:.28;';
    var state = { id: shortId, src: src, present: true, loaded: false, error: false };
    v.addEventListener('loadeddata', function () { state.loaded = true; });
    v.addEventListener('error', function () { state.error = true; v.remove(); });
    document.body.appendChild(v);
    var pr = v.play();
    if (pr && pr.catch) pr.catch(function () {});
    videoEl = v;
    window.__themeShort = state;
  }

  function boot() {
    var explicit = document.body.getAttribute('data-theme');
    var name = explicit || (window.ThemeMap ? window.ThemeMap.themeForPath(location.pathname) : 'generic');
    applyTheme(name);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
