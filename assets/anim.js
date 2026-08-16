/* 滾動進場揭示 + 數字計數 + Hero 視差 + 短片懶載入（IntersectionObserver 驅動） */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1) 揭示動畫：對所有 .reveal 元素，進入視口時加 .in（緩慢內容入場）
  //    —— 更長的位移與更柔的過渡，讓內容「緩緩浮現」而非彈入
  var revealEls = [].slice.call(document.querySelectorAll(".reveal"));
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  // 2) 數字計數：data-count 屬性從 0 滾動到目標
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    var dur = 1400, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      var val = target * eased;
      el.textContent = (target % 1 === 0 ? Math.round(val) : val.toFixed(2)) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = (target % 1 === 0 ? target : target.toFixed(2)) + suffix;
    }
    requestAnimationFrame(step);
  }
  var counters = [].slice.call(document.querySelectorAll("[data-count]"));
  if ("IntersectionObserver" in window && !reduce) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(function (el) {
      var t = parseFloat(el.getAttribute("data-count"));
      el.textContent = (t % 1 === 0 ? t : t.toFixed(2)) + (el.getAttribute("data-suffix") || "");
    });
  }

  // 3) Hero 視差（滑鼠微移，僅桌面）
  var heroImg = document.querySelector(".hero-img");
  if (heroImg && !reduce && matchMedia("(min-width: 901px)").matches) {
    var hero = document.querySelector(".hero");
    hero.addEventListener("mousemove", function (ev) {
      var r = hero.getBoundingClientRect();
      var dx = (ev.clientX - r.left) / r.width - 0.5;
      var dy = (ev.clientY - r.top) / r.height - 0.5;
      heroImg.style.transform = "translate(" + (dx * 14) + "px," + (dy * 14) + "px)";
    });
    hero.addEventListener("mouseleave", function () { heroImg.style.transform = ""; });
  }

  // 4) 短片懶載入 + 正/反向播放控制
  //    - 預設「自動雙向」：正放完自動倒放回去（playbackRate=-1），像呼吸一樣來回
  //    - 手動鎖定：點「正向」用 reel.mp4 正放；「反向」用 reel_rev.mp4 正放（相容不支持負速的瀏覽器）
  var reels = [].slice.call(document.querySelectorAll(".reel-video"));
  function loadReel(v) {
    if (v.dataset.loaded) return;
    v.dataset.loaded = "1";
    var dir = v.dataset.dir || "auto";
    appendSources(v, dir);
    v.load();
    startReel(v, dir);
    v.addEventListener("loadeddata", function () { v.classList.add("ready"); }, { once: true });
  }
  function appendSources(v, dir) {
    // 清除舊 source（切換方向時重掛）
    while (v.querySelector("source")) v.removeChild(v.querySelector("source"));
    var webm = (dir === "rev") ? v.getAttribute("data-webm-rev") : v.getAttribute("data-webm");
    var mp4  = (dir === "rev") ? v.getAttribute("data-src-rev")  : v.getAttribute("data-src");
    if (webm) { var s1 = document.createElement("source"); s1.src = webm; s1.type = "video/webm"; v.appendChild(s1); }
    if (mp4)  { var s2 = document.createElement("source"); s2.src = mp4;  s2.type = "video/mp4";  v.appendChild(s2); }
  }
  function startReel(v, dir) {
    var p = v.play();
    if (p && typeof p.catch === "function") p.catch(function () {/* 自動播放被擋時靜默，留 poster */});
    if (dir === "auto") {
      // 監聽到片尾自動倒放（支援負速的瀏覽器走 playbackRate=-1，否則切到 rev 源）
      v.onended = function () {
        try {
          v.playbackRate = -1;           // 倒放
          var pr = v.play();
          if (pr && pr.catch) pr.catch(function(){ switchDir(v, "rev"); });
        } catch (e) { switchDir(v, "rev"); }
      };
      // 倒放結束（timeupdate 到頭）再正放
      v.addEventListener("timeupdate", function () {
        if (v.playbackRate < 0 && v.currentTime <= 0.05) {
          v.playbackRate = 1; v.currentTime = 0; var pr = v.play(); if (pr && pr.catch) pr.catch(function(){});
        }
      });
    } else {
      v.onended = null;
      v.playbackRate = 1;
    }
  }
  function switchDir(v, dir) {
    v.dataset.dir = dir;
    v.onended = null;
    appendSources(v, dir);
    v.load();
    startReel(v, dir);
  }
  // 方向按鈕
  document.querySelectorAll(".rc-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dir = btn.getAttribute("data-dir");
      document.querySelectorAll(".rc-btn").forEach(function (b) {
        b.classList.remove("is-active"); b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("is-active"); btn.setAttribute("aria-pressed", "true");
      // 套用到本頁所有 reel
      reels.forEach(function (v) {
        if (!v.dataset.loaded) { v.dataset.dir = dir; return; }   // 尚未載入：記住方向，載入時套用
        switchDir(v, dir);
      });
    });
  });
  if ("IntersectionObserver" in window && !reduce) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { loadReel(e.target); vio.unobserve(e.target); }
      });
    }, { threshold: 0.25, rootMargin: "200px 0px" });
    reels.forEach(function (v) { vio.observe(v); });
  } else {
    reels.forEach(function (v) { if (!reduce) loadReel(v); else v.classList.add("ready"); });
  }
})();
