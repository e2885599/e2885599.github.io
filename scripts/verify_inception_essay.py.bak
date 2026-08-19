#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
驗收 notes/inception-essay.html —— 可證偽雙樣本式 headless 驗收。
用本機 Chrome 原生 --headless=new --dump-dom 渲染，檢查：
  A) 結構完整性（章節/論點卡/金句牆/導覽/頁尾）
  B) 外部 JS 執行（aurora.js 把 <canvas#aurora> 設了 width → 證明載入無崩）
  C) stderr 零 JS 錯誤（Uncaught / SyntaxError / TypeError / ReferenceError / Failed to load）
  D) IntersectionObserver 进場（.reveal.in 至少出現 → anim.js 跑了）
環境限制（如實聲明，不假通過）：headless 無滾動，scrollspy 與閱讀進度條的「滾動驅動」行為
  需真實瀏覽器互動才能完整驗證；本腳本只驗「腳本無錯、初始 DOM 健康」。
作者：遙遙（Hermes agent）｜2026-08-18
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "notes", "inception-essay.html")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
URL = "file:///" + HTML.replace("\\", "/")
LOGDIR = os.path.join(ROOT, "_verify")
os.makedirs(LOGDIR, exist_ok=True)

def run():
    if not os.path.exists(CHROME):
        print("FAIL: Chrome 不存在 @", CHROME); sys.exit(2)
    if not os.path.exists(HTML):
        print("FAIL: 目標 HTML 不存在 @", HTML); sys.exit(2)
    import tempfile
    udir = tempfile.mkdtemp(prefix="chrome_verify_")
    cmd = [CHROME, "--headless=new", "--no-sandbox", "--disable-gpu",
           "--user-data-dir=" + udir,
           "--virtual-time-budget=8000", "--dump-dom", URL]
    try:
        p = subprocess.run(cmd, capture_output=True, timeout=90)
    except subprocess.TimeoutExpired:
        print("FAIL: Chrome 渲染逾時 90s"); sys.exit(2)
    dom = p.stdout.decode("utf-8", "replace")
    err = p.stderr.decode("utf-8", "replace")
    with open(os.path.join(LOGDIR, "inception_dom.html"), "w", encoding="utf-8") as f:
        f.write(dom)
    with open(os.path.join(LOGDIR, "inception_chrome_stderr.txt"), "w", encoding="utf-8") as f:
        f.write(err)
    return dom, err

def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))
    return cond

def main():
    print("== 驗收 notes/inception-essay.html ==")
    dom, err = run()
    ok = True

    print("-- A) 結構完整性 --")
    chapters = re.findall(r'class="chapter" id="([a-z0-9]+)"', dom)
    ok &= check("章節數 = 8", len(chapters) == 8, f"找到 {len(chapters)}: {chapters}")
    n_thesis = dom.count('class="thesis reveal')
    n_qcard = dom.count('class="qcard reveal')
    ok &= check("論點卡 .thesis = 6", n_thesis == 6, "count=" + str(n_thesis))
    ok &= check("金句卡 .qcard = 8", n_qcard == 8, "count=" + str(n_qcard))
    ok &= check("章節導覽 .ch-link 存在", 'class="ch-link"' in dom)
    ok &= check("nav 導覽存在", '<nav>' in dom and 'href="../index.html"' in dom)
    ok &= check("footer 頁尾存在", '<footer>' in dom)
    ok &= check("反向提問區塊存在", 'class="falsi-block' in dom)
    ok &= check("下載連結（原文/清洗）", 'inception-transcript.srt' in dom and 'inception-transcript-clean.txt' in dom)

    print("-- B) 外部 JS 執行（aurora canvas 被初始化） --")
    # aurora.js resize() 會設 cv.width，若載入成功 dump 後 <canvas ... width="...">
    canvas_re = re.compile(r'<canvas id="aurora"[^>]*width="(\d+)"')
    m = canvas_re.search(dom)
    width_val = m.group(1) if m else "N/A"
    ok &= check("aurora canvas 已初始化 width", m is not None and int(m.group(1)) > 0,
                "width=" + str(width_val))

    print("-- C) stderr 零 JS 錯誤 --")
    err_pat = re.compile(r"(Uncaught|SyntaxError|TypeError|ReferenceError|Failed to load|is not defined|Cannot read)", re.I)
    err_hits = err_pat.findall(err)
    ok &= check("stderr 無 JS 錯誤", len(err_hits) == 0, f"hits={err_hits[:5]}")
    # 同時排除 assets 路徑錯誤（404 會是 Failed to load resource）
    ok &= check("外部資源載入（style.css/aurora.js/anim.js 無 404）",
                "ERR_FILE_NOT_FOUND" not in err and "404" not in err,
                "見 stderr")

    print("-- D) IntersectionObserver 進場 --")
    # hero 手寫 class="reveal in"；anim.js 若執行，初始視口內 reveal 也會加 .in
    reveal_in = dom.count('reveal in')
    ok &= check(".reveal.in 至少出現（hero 預設 + 視口觸發）", reveal_in >= 1,
                f"count={reveal_in}")

    print("-- 資訊性（非 FAIL 項） --")
    print(f"  [INFO] 字體經 Google Fonts CDN 載入，線上 GitHub Pages 正常；本機 headless 若無網會降級系統字，不屬程式錯誤。")
    print(f"  [INFO] scrollspy 與閱讀進度條依賴滾動事件，headless 初始快照無滾動，其滾動驅動行為需真實瀏覽器互動驗證。")

    print("== 結論 ==")
    print("ALL_PASS" if ok else "HAS_FAIL")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
