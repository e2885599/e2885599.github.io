/* 滾動進場揭示 + 數字計數 + Hero 視差（IntersectionObserver 驅動） */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1) 揭示動畫：對所有 .reveal 元素，進入視口時加 .in
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
})();
