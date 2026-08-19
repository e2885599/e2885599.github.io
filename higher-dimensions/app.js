// 互動邏輯：章節導覽 / 模擬播放 / 時間軸同步高亮
// 設計：無影片源 → 用 requestAnimationFrame 推進虛擬時鐘，依 currentChapter 高亮對應章節。
(function () {
  "use strict";
  var CH = window.SUBTITLES.chapters;
  var DUR = window.VIDEO_DURATION;
  var nav = document.getElementById("nav");
  var card = document.getElementById("card");
  var cTitle = document.getElementById("cTitle");
  var cSub = document.getElementById("cSub");
  var cEn = document.getElementById("cEn");
  var cZh = document.getElementById("cZh");
  var now = document.getElementById("now");
  var scrub = document.getElementById("scrub");
  var clock = document.getElementById("clock");
  var playBtn = document.getElementById("play");
  var prevBtn = document.getElementById("prev");
  var nextBtn = document.getElementById("next");
  var rateSel = document.getElementById("rate");

  var current = -1;     // 當前章節索引
  var playing = false;
  var rate = 2;
  var virtualTime = 0;  // 秒
  var lastTs = null;
  var rafId = null;

  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    var m = Math.floor(s / 60), sec = s % 60;
    return (m < 10 ? "0" + m : m) + ":" + (sec < 10 ? "0" + sec : sec);
  }

  // 建章節導覽
  CH.forEach(function (ch, i) {
    var el = document.createElement("div");
    el.className = "chap";
    el.dataset.idx = i;
    // 用 textContent 建構，避免任何未來不可信來源導入 XSS（Codex 建議）
    var t = document.createElement("div"); t.className = "t"; t.textContent = ch.title_zh;
    var en = document.createElement("div"); en.className = "en"; en.textContent = ch.title_en;
    var ts = document.createElement("div"); ts.className = "ts";
    ts.textContent = fmt(ch.start) + " – " + fmt(ch.end);
    el.appendChild(t); el.appendChild(en); el.appendChild(ts);
    el.addEventListener("click", function () { goTo(i, true); });
    nav.appendChild(el);
  });
  var navEls = Array.prototype.slice.call(nav.querySelectorAll(".chap"));

  function renderActive() {
    navEls.forEach(function (e, i) {
      e.classList.toggle("active", i === current);
    });
    if (current < 0) return;
    var ch = CH[current];
    cTitle.textContent = ch.title_zh;
    cSub.textContent = ch.title_en + " · " + fmt(ch.start) + "–" + fmt(ch.end);
    cEn.textContent = ch.en;
    cZh.textContent = ch.zh;
    now.textContent = "當前章節：" + ch.title_zh + "（" + fmt(ch.start) + "–" + fmt(ch.end) + "）";
  }

  function syncScrub() {
    scrub.value = String(Math.round((virtualTime / DUR) * 1000));
    clock.textContent = fmt(virtualTime) + " / " + fmt(DUR);
  }

  // 依虛擬時間決定當前章節。
  // 章節時間存在重疊（如 ch0 0–77.32 與 ch1 74.92 起），
  // 若用「第一個符合區間」會在重疊時跳回前章（Codex 審計發現的實際缺陷）。
  // 修正：取「最晚開始且 start ≤ t」的章節 → 重疊時後章優先，避免跳回。
  function chapterAt(t) {
    var best = -1;
    for (var i = 0; i < CH.length; i++) {
      if (t >= CH[i].start) best = i; // 持續更新為最晚符合者
    }
    if (best === -1) return 0;          // t 早於所有 start
    // 若 t 已超過最後章節 end，視為收尾
    if (t >= DUR) return CH.length - 1;
    return best;
  }

  function tick(ts) {
    if (!playing) return;
    if (lastTs === null) lastTs = ts;
    var dt = (ts - lastTs) / 1000 * rate;
    lastTs = ts;
    virtualTime += dt;
    if (virtualTime >= DUR) { virtualTime = DUR; stop(); }
    var idx = chapterAt(virtualTime);
    if (idx !== current && idx >= 0) { current = idx; renderActive(); }
    // 平滑滾動到當前章節
    if (current >= 0 && navEls[current]) {
      navEls[current].scrollIntoView({ block: "nearest" });
    }
    syncScrub();
    if (playing) rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (playing) return;
    if (virtualTime >= DUR) virtualTime = 0;
    playing = true;
    lastTs = null;
    playBtn.textContent = "⏸ 暫停";
    rafId = requestAnimationFrame(tick);
  }
  function stop() {
    playing = false;
    playBtn.textContent = "▶ 模擬播放";
    if (rafId) cancelAnimationFrame(rafId);
  }
  function toggle() { playing ? stop() : play(); }

  function goTo(i, user) {
    i = Math.max(0, Math.min(CH.length - 1, i));
    current = i;
    virtualTime = CH[i].start + 0.001;
    renderActive();
    syncScrub();
    if (user && navEls[i]) navEls[i].scrollIntoView({ block: "center" });
  }

  // 事件
  playBtn.addEventListener("click", toggle);
  prevBtn.addEventListener("click", function () { goTo(current - 1, true); });
  nextBtn.addEventListener("click", function () { goTo(current + 1, true); });
  rateSel.addEventListener("change", function () { rate = parseFloat(rateSel.value); });
  scrub.addEventListener("input", function () {
    stop();
    virtualTime = (parseFloat(scrub.value) / 1000) * DUR;
    var idx = chapterAt(virtualTime);
    if (idx >= 0) { current = idx; renderActive(); }
    syncScrub();
  });

  // 初始：選第一章
  goTo(0, false);
  syncScrub();
})();
