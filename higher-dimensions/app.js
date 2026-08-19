// 互動邏輯：章節導覽 / 真音訊播放 / 時間軸同步高亮
// 設計：有 TTS 英語配音（audio_manifest.json）→ 用 <audio> 真實播放，timeupdate 驅動字幕高亮。
// 章節邊界依 manifest 的 start_sec/end_sec（語音實際長度，非原 SRT 時間碼）。
(function () {
  "use strict";
  // 全域錯誤自報：任何錯誤直接顯示在頁面頂部紅字（免開 DevTools 也能看到）
  function reportErr(msg) {
    var box = document.getElementById("errbox");
    if (!box) {
      box = document.createElement("div");
      box.id = "errbox";
      box.style.cssText = "background:#4a1212;border:1px solid #f56565;color:#ffd2d2;padding:8px 12px;font-size:12px;font-family:monospace;white-space:pre-wrap;margin:8px 0;";
      var main = document.querySelector("main");
      if (main) main.insertBefore(box, main.firstChild);
    }
    box.textContent += "[ERR] " + msg + "\n";
  }
  window.addEventListener("error", function (e) {
    reportErr((e.message || "unknown") + (e.filename ? " @ " + e.filename + ":" + e.lineno : ""));
  });
  window.addEventListener("unhandledrejection", function (e) {
    reportErr("promise: " + (e.reason && (e.reason.stack || e.reason.message || e.reason)));
  });

  var CH = window.SUBTITLES.chapters;
  var MAN = window.AUDIO_MANIFEST;
  var DUR = MAN.total_sec;
  var audio = document.getElementById("audio");
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

  var current = -1;        // 當前章節索引
  var currentAudioIdx = -1; // 當前已載入的 audio src 章節
  var rate = 1;            // 語音播放速率（HTML 預設 1×）

  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    var m = Math.floor(s / 60), sec = s % 60;
    return (m < 10 ? "0" + m : m) + ":" + (sec < 10 ? "0" + sec : sec);
  }

  // 建章節導覽（用 manifest 的 start_sec/end_sec 顯示時間）
  CH.forEach(function (ch, i) {
    var m = MAN.chapters[i];
    var el = document.createElement("div");
    el.className = "chap";
    el.dataset.idx = i;
    var t = document.createElement("div"); t.className = "t"; t.textContent = ch.title_zh;
    var en = document.createElement("div"); en.className = "en"; en.textContent = ch.title_en;
    var ts = document.createElement("div"); ts.className = "ts";
    ts.textContent = fmt(m.start_sec) + " – " + fmt(m.end_sec);
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
    var m = MAN.chapters[current];
    cTitle.textContent = ch.title_zh;
    cSub.textContent = ch.title_en + " · " + fmt(m.start_sec) + "–" + fmt(m.end_sec);
    cEn.textContent = ch.en;
    cZh.textContent = ch.zh;
    now.textContent = "當前章節：" + ch.title_zh + "（" + fmt(m.start_sec) + "–" + fmt(m.end_sec) + "）";
  }

  function syncScrub() {
    var t = audio.currentTime || 0;
    scrub.value = String(Math.round((t / DUR) * 1000));
    clock.textContent = fmt(t) + " / " + fmt(DUR);
  }

  // 依音訊播放時間決定當前章節並同步高亮（timeupdate 事件驅動）
  function onTime() {
    var t = audio.currentTime || 0;
    var idx = chapterAt(t);
    if (idx !== current && idx >= 0) { current = idx; renderActive(); }
    if (current >= 0 && navEls[current]) navEls[current].scrollIntoView({ block: "nearest" });
    syncScrub();
  }

  // 章節邊界：用 manifest 的 start_sec/end_sec（無重疊，依序累加）
  function chapterAt(t) {
    for (var i = 0; i < MAN.chapters.length; i++) {
      if (t >= MAN.chapters[i].start_sec && t < MAN.chapters[i].end_sec) return i;
    }
    if (t >= DUR) return MAN.chapters.length - 1;
    return t < MAN.chapters[0].start_sec ? 0 : -1;
  }

  // 載入指定章節音訊；src 切換會清零 currentTime，故設 src 後於 loadedmetadata 才定位
  function loadAudio(i, seekTo) {
    if (i === currentAudioIdx) {
      if (typeof seekTo === "number") audio.currentTime = seekTo;
      return;
    }
    var m = MAN.chapters[i];
    audio.src = m.file;
    currentAudioIdx = i;
    if (typeof seekTo === "number") {
      var handler = function () {
        audio.currentTime = seekTo;
        audio.removeEventListener("loadedmetadata", handler);
      };
      audio.addEventListener("loadedmetadata", handler);
    }
  }

  function play() {
    if (current < 0) { current = 0; }
    loadAudio(current, MAN.chapters[current].start_sec + 0.01); // 設 src 後定位到章首
    audio.playbackRate = rate;
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function (e) {
        // autoplay 被擋或 file:// 限制：明確回饋，不靜默
        playBtn.textContent = "▶ 播放配音（被瀏覽器擋，請改用 http 開啟）";
        console.warn("播放被拒:", e.name, e.message);
      });
    }
    playBtn.textContent = "⏸ 暫停";
  }
  function stop() {
    audio.pause();
    playBtn.textContent = "▶ 播放配音";
  }
  function toggle() {
    if (audio.paused) play(); else stop();
  }

  function goTo(i, user) {
    i = Math.max(0, Math.min(CH.length - 1, i));
    current = i;
    var seek = MAN.chapters[i].start_sec + 0.01;
    loadAudio(i, seek); // 設 src 後於 loadedmetadata 才定位，避免被清零
    renderActive();
    syncScrub();
    if (user && navEls[i]) navEls[i].scrollIntoView({ block: "center" });
  }

  // 事件
  audio.addEventListener("timeupdate", onTime);
  audio.addEventListener("ended", function () {
    // 自動續播下一章
    if (current < CH.length - 1) { goTo(current + 1, false); play(); }
    else { stop(); }
  });
  audio.addEventListener("play", function () { playBtn.textContent = "⏸ 暫停"; });
  audio.addEventListener("pause", function () { playBtn.textContent = "▶ 播放配音"; });
  playBtn.addEventListener("click", toggle);
  prevBtn.addEventListener("click", function () { goTo(current - 1, true); });
  nextBtn.addEventListener("click", function () { goTo(current + 1, true); });
  rateSel.addEventListener("change", function () {
    rate = parseFloat(rateSel.value);
    audio.playbackRate = rate;
  });
  // scrub 拖曳：抽出共用處理，input 與 change 都觸發（增 headless 環境穩健性）
  function onScrub() {
    var t = (parseFloat(scrub.value) / 1000) * DUR;
    var idx = chapterAt(t);
    if (idx >= 0) {
      if (idx !== current) { current = idx; loadAudio(idx, t); } // 切章後於 loadedmetadata 定位
      else { audio.currentTime = t; }                            // 同章直接定位
      renderActive();
      if (navEls[idx]) navEls[idx].scrollIntoView({ block: "nearest" });
    }
    syncScrub();
  }
  scrub.addEventListener("input", onScrub);
  scrub.addEventListener("change", onScrub);

  // 初始：選第一章
  goTo(0, false);
  syncScrub();

  // file:// 警示：直接雙擊開啟會靜默擋音訊，提示改用 http
  if (location.protocol === "file:") {
    var fw = document.getElementById("filewarn");
    if (fw) fw.style.display = "block";
  }
})();
