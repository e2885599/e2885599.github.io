/* 極光流動網格背景（輕量、自適應、尊重 reduced-motion）
   首幀同步繪製（不依賴 rAF 迴圈），確保 JS 載入即見流光；之後 rAF 持續飄移。 */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cv = document.getElementById("aurora");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var W, H, DPR;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = cv.width = Math.floor(innerWidth * DPR);
    H = cv.height = Math.floor(innerHeight * DPR);
    cv.style.width = innerWidth + "px";
    cv.style.height = innerHeight + "px";
  }
  resize();
  addEventListener("resize", resize);

  var N = 5;
  var strands = [];
  // 金紫交融調色盤（活躍版）：金 #f5c970 / 紫 #8b6cff / 暖金 #ffd27a
  var palette = [
    [245, 201, 112], [139, 108, 255], [255, 210, 122], [245, 201, 112], [139, 108, 255]
  ];
  for (var i = 0; i < N; i++) {
    strands.push({
      x: Math.random() * (innerWidth * DPR),
      y: Math.random() * (innerHeight * DPR),
      vx: (Math.random() - 0.5) * 0.34,
      vy: (Math.random() - 0.5) * 0.34,
      r: (120 + Math.random() * 220) * DPR,
      c: palette[i % palette.length],
      a: 0.12 + Math.random() * 0.08
    });
  }

  function drawFrame() {
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < strands.length; i++) {
      var s = strands[i];
      s.x += s.vx; s.y += s.vy;
      if (s.x < -s.r) s.x = W + s.r; if (s.x > W + s.r) s.x = -s.r;
      if (s.y < -s.r) s.y = H + s.r; if (s.y > H + s.r) s.y = -s.r;
      var g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, "rgba(" + s.c[0] + "," + s.c[1] + "," + s.c[2] + "," + s.a + ")");
      g.addColorStop(1, "rgba(" + s.c[0] + "," + s.c[1] + "," + s.c[2] + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // 首幀同步繪製：即使 rAF 被環境節流，也能立即看到流光
  drawFrame();

  if (!reduce) {
    (function loop() { drawFrame(); requestAnimationFrame(loop); })();
  }
})();
