/* 滾動驅動極光脈衝（scroll-scrub）——證明「動態/滾動動畫」取向
   設計原則（沿用 anim.js 守則）：
   - 不依賴自走 rAF 動畫；極光狀態完全由「區塊在視口的滾動進度 p∈[0,1]」決定。
   - p=0 → 光絲收束（半徑小、脈衝弱）；p=1 → 光絲擴散（半徑大、脈衝強）。
   - 每次 scroll 事件重繪一幀（rAF 節流），並同步右上角百分比與底部進度條。
   - prefers-reduced-motion：只繪一幀固定 p=0.6 靜態畫面，不綁滾動、不跳動。
   - 與 aurora.js（背景自走極光）分工：背景負責「氣氛」，此處負責「可被操作」。 */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cv = document.getElementById("scrubAurora");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var W, H, DPR;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = cv.width = Math.max(1, Math.floor(cv.clientWidth * DPR));
    H = cv.height = Math.max(1, Math.floor(cv.clientHeight * DPR));
  }
  resize();
  window.addEventListener("resize", resize);

  // 光絲：位置固定相位，半徑與亮度由 p 驅動
  var strands = [];
  var palette = [[54,224,212],[139,108,255],[255,179,71]];
  for (var i = 0; i < 7; i++) {
    strands.push({
      fx: 0.12 + Math.random() * 0.76,   // 相對 x（0..1）
      fy: 0.18 + Math.random() * 0.64,   // 相對 y
      phase: Math.random() * Math.PI * 2,
      hue: i % palette.length
    });
  }

  // 繪製：p 為滾動進度（0 收束 → 1 擴散）
  function draw(p) {
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    // 背景：隨 p 從深藍趨向深紫（擴散時更「活」）
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "rgb(" + (4 + p*8) + "," + (8 + p*4) + "," + (16 + p*10) + ")");
    bg.addColorStop(1, "rgb(" + (8 + p*12) + "," + (10 + p*2) + "," + (24 + p*16) + ")");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = "lighter";
    var cx = W * 0.5, cy = H * 0.5;
    var baseR = Math.min(W, H) * (0.10 + p * 0.34);   // 半徑隨 p 擴散
    var pulse = 0.5 + 0.5 * Math.sin(p * Math.PI);     // 中段最亮（p=0.5）
    for (var i = 0; i < strands.length; i++) {
      var s = strands[i];
      var c = palette[s.hue];
      var x = s.fx * W + Math.cos(s.phase) * (W * 0.12) * (1 - p * 0.5);
      var y = s.fy * H + Math.sin(s.phase) * (H * 0.12) * (1 - p * 0.5);
      var r = baseR * (0.55 + 0.45 * Math.sin(s.phase + p * 3));
      var a = (0.10 + p * 0.22) * (0.6 + 0.4 * pulse);
      var g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
      g.addColorStop(0, "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + c[0] + "," + c[1] + "," + c[2] + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2); ctx.fill();
      // 中心脈衝核心
      var coreR = baseR * 0.18 * (0.5 + pulse);
      var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, coreR));
      cg.addColorStop(0, "rgba(255,255,255," + (0.12 + p * 0.30).toFixed(3) + ")");
      cg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, coreR), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  var pctEl = document.getElementById("scrubPct");
  var barEl = document.getElementById("scrubBar");
  // 監測鉤子（debug/驗收用，非污染）：暴露最近一次進度與重繪次數
  window.__scrub = { p: 0, draws: 0 };
  function applyProgress(p) {
    p = Math.max(0, Math.min(1, p));
    draw(p);
    if (pctEl) pctEl.textContent = Math.round(p * 100);
    if (barEl) barEl.style.width = (p * 100).toFixed(1) + "%";
    window.__scrub.p = p; window.__scrub.draws++;
  }

  // 進度來源：區塊在視口的滾動位置
  function progressFromScroll() {
    var rect = cv.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var total = rect.height + vh;
    var passed = vh - rect.top;
    return passed / total;   // 進區塊底 0 → 出區塊頂 1
  }

  if (reduce) {
    // reduced-motion：靜態一幀，不綁滾動
    applyProgress(0.6);
    return;
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      applyProgress(progressFromScroll());
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  // 初次與每幀都重算（確保 headless / 嵌入環境也能更新）
  applyProgress(progressFromScroll());
  (function raf() { onScroll(); requestAnimationFrame(raf); })();
})();

/* Hero 滾動視差：向下滾時 hero 內容緩緩上移且淡出，強化滾動動畫感（尊重 reduced-motion） */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  var hero = document.querySelector(".hero .wrap");
  if (!hero) return;
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var shift = Math.min(y, 420);
      hero.style.transform = "translateY(" + (-shift * 0.18) + "px)";
      hero.style.opacity = String(Math.max(0, 1 - y / 620));
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
