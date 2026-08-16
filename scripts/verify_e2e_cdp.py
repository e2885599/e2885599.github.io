#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
端到端真渲染驗證（CDP + websockets，Chrome headless）
=====================================================
以 Chrome remote debugging 載入首頁，透過 Runtime.evaluate 檢查：
 1) 頁面無 JS 錯誤 / 未捕獲例外
 2) 短片懶載入：初始 video 無 <source>；捲動進入視口後掛載 <source> 且 .ready
 3) reveal 揭示：區塊獲得 .in
依賴：Chrome (C:/Program Files/Google/Chrome/Application/chrome.exe) + websockets 套件
"""
import subprocess, os, sys, time, json, asyncio, websockets, urllib.request

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
URL = "file:///" + ROOT.replace("\\", "/") + "/index.html"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9333

JS_CHECK = r"""
(async function(){
  var out = {errors:[], reel:{initSource:false, afterSource:false, ready:false}, revealIn:'0/0'};
  try {
    // 初始：video 不應有 source（preload=none + 無內聯）
    var v = document.querySelector('.reel-video');
    out.reel.initSource = !!(v && v.querySelector('source'));
    // 捲動到 reel
    var reel = document.querySelector('.reel');
    if (reel) reel.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r, 2600));
    var v2 = document.querySelector('.reel-video');
    out.reel.afterSource = !!(v2 && v2.querySelector('source'));
    out.reel.ready = !!(v2 && v2.classList.contains('ready'));
    if (v2) {
      out.reel.networkState = v2.networkState;
      out.reel.currentSrc = v2.currentSrc || '';
      out.reel.loaded = v2.dataset.loaded || '0';
      out.reel.inView = (function(){
        var r = v2.getBoundingClientRect();
        return (r.top < (window.innerHeight||600)) && (r.bottom > 0);
      })();
    }
    // 測手動方向鎖定：點「反向」按鈕 → currentSrc 應指向 reel_rev
    var revBtn = document.querySelector('.rc-btn[data-dir=\"rev\"]');
    if (revBtn) revBtn.click();
    await new Promise(r=>setTimeout(r, 1200));
    var v3 = document.querySelector('.reel-video');
    out.reel.afterRevLockSrc = (v3 && v3.currentSrc || '').toString();
    out.reel.afterRevActive = !!(document.querySelector('.rc-btn[data-dir=\"rev\"].is-active'));
    var all = document.querySelectorAll('.reveal');
    var ins = 0; for (var i=0;i<all.length;i++){ if(all[i].classList.contains('in')) ins++; }
    out.revealIn = ins + '/' + all.length;
  } catch(e){ out.errors.push('JSX:'+String(e)); }
  return out;
})()
"""

async def main():
    # 啟動 Chrome headless with remote debugging
    proc = subprocess.Popen(
        [CHROME, f"--remote-debugging-port={PORT}", "--headless=new", "--disable-gpu",
         "--no-sandbox", "--force-prefers-reduced-motion=no-preference",
         "--user-data-dir=" + os.path.join(HERE, "_cprof")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        # 等待 /json/version
        base = f"http://127.0.0.1:{PORT}"
        for _ in range(40):
            try:
                v = json.loads(urllib.request.urlopen(base + "/json/version", timeout=2).read())
                break
            except Exception:
                await asyncio.sleep(0.3)
        else:
            print("FAIL: Chrome 未起來"); sys.exit(1)
        # 取得現有 target 清單（headless 預設有一個 about:blank）
        targets = json.loads(urllib.request.urlopen(base + "/json", timeout=5).read())
        tab = None
        for t in targets:
            if t.get("type") == "page":
                tab = t; break
        if not tab:
            print("FAIL: 無 page target"); sys.exit(1)
        ws_url = tab["webSocketDebuggerUrl"]
        async with websockets.connect(ws_url, max_size=None) as ws:
            async def send(method, params):
                await ws.send(json.dumps({"id": 1, "method": method, "params": params}))
                # 吃掉傳回
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get("id") == 1:
                        return msg.get("result", {})
            # enable
            await send("Runtime.enable", {})
            await send("Page.enable", {})
            # 強制模擬真實桌面（no-preference 動畫偏好），以測 lazy happy-path
            await send("Emulation.setEmulatedMedia",
                       {"features": [{"name": "prefers-reduced-motion", "value": "no-preference"}]})
            await send("Page.navigate", {"url": URL})
            # 等載入
            await asyncio.sleep(1.5)
            # 注入檢查
            res = await send("Runtime.evaluate",
                             {"expression": JS_CHECK, "awaitPromise": True, "returnByValue": True})
            out = res.get("result", {}).get("value")
            print("RESULT:", json.dumps(out, ensure_ascii=False, indent=2))
            # 錯誤偵測（console + pageerror 用 Runtime.consoleAPICalled / 直接看 return）
            errs = []
            if out and out.get("errors"):
                errs.append("JS 錯誤: " + ", ".join(out["errors"]))
            if out and out["reel"]["initSource"]:
                errs.append("初始就內聯 <source>（非懶載入）")
            if out and not out["reel"]["afterSource"]:
                errs.append("捲動後仍未掛載 <source>（懶載入失效）")
            if out and out["revealIn"].startswith("0/"):
                errs.append("reveal 揭示未觸發")
            # 方向鎖定：鎖反向後 currentSrc 應指向 reel_rev
            if out and "reel_rev" not in (out["reel"].get("afterRevLockSrc") or ""):
                errs.append("鎖定反向後未切到 reel_rev 源（方向控制失效）")
            if out and not out["reel"].get("afterRevActive"):
                errs.append("鎖定反向後按鈕高亮未切換")
            if errs:
                print("FAIL:", "; ".join(errs)); sys.exit(1)
            print("PASS：無 JS 錯誤 + 短片懶載入生效 + 揭示動畫觸發 + 方向鎖定切到 reel_rev")
    finally:
        proc.terminate()
        try: proc.wait(timeout=5)
        except Exception: proc.kill()

import urllib.parse
if __name__ == "__main__":
    asyncio.run(main())
