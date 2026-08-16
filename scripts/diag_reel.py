#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
診斷：首頁短片為何「沒載入、停在同畫面」
==========================================
用 Chrome CDP 真渲染首頁，抓取：
 1) 頁面 JS / <video> error 事件、HTMLMediaError.code（MEDIA_ERR_ABORTED=1/ NETWORK=2/ DECODE=3/ SRC=4）
 2) video.networkState（網路狀態）、currentSrc（線上實際指向）
 3) 直接設 video.src=線上 URL（繞過 lazy 掛 source 邏輯），看是否也能載入 → 區分「lazy 邏輯 bug」vs「資源本身 404/格式錯」
 4) 懶載入是否觸發（監聽 reel-ctrl 按鈕是否存在、video 是否真有 source）
"""
import subprocess, os, sys, time, json, asyncio, websockets, urllib.request, urllib.parse

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
URL = "file:///" + ROOT.replace("\\", "/") + "/index.html"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9341
ONLINE = "https://e2885599.github.io/assets/reel.mp4"

JS = r"""
(async function(){
  var out = {errors:[], video:{events:[], netState:null, curSrc:'', mediaErr:null, hasSource:false, ready:false}, lazyTriggered:false, ctrlBtns:0};
  try {
    var v = document.querySelector('.reel-video');
    if (!v) { out.errors.push('no .reel-video'); return out; }
    out.ctrlBtns = document.querySelectorAll('.rc-btn').length;
    v.addEventListener('error', function(e){ out.video.events.push('error:'+(v.error?v.error.code:'?')); }, true);
    v.addEventListener('stalled', function(){ out.video.events.push('stalled'); }, true);
    v.addEventListener('loadeddata', function(){ out.video.ready = true; }, true);
    // 初始
    out.video.hasSource = !!v.querySelector('source');
    out.video.netState = v.networkState;
    out.video.curSrc = v.currentSrc || '';
    // 捲動觸發懶載入
    var reel = document.querySelector('.reel');
    if (reel) reel.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r, 2500));
    out.lazyTriggered = !!v.querySelector('source');
    out.video.hasSource = !!v.querySelector('source');
    out.video.netState = v.networkState;
    out.video.curSrc = v.currentSrc || '';
    out.video.ready = v.classList.contains('ready');
    // 測試：直接設 src 繞過 lazy（若這能載入 → lazy 邏輯有問題；若仍不能 → 資源/格式問題）
    var v2 = document.querySelector('.reel-video');
    try {
      v2.src = "URL_PLACEHOLDER";
      v2.load();
      await new Promise(r=>setTimeout(r, 2500));
      out.video.directSet = {netState:v2.networkState, curSrc:v2.currentSrc, ready:v2.ready || v2.classList.contains('ready'), err: v2.error?v2.error.code:null};
    } catch(e){ out.errors.push('directSet:'+e); }
  } catch(e){ out.errors.push('JSX:'+String(e)); }
  return out;
})()
""".replace("URL_PLACEHOLDER", ONLINE)

async def main():
    proc = subprocess.Popen(
        [CHROME, f"--remote-debugging-port={PORT}", "--headless=new", "--disable-gpu",
         "--no-sandbox", "--force-prefers-reduced-motion=no-preference",
         "--user-data-dir=" + os.path.join(HERE, "_cprof_diag")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        base = f"http://127.0.0.1:{PORT}"
        for _ in range(40):
            try:
                json.loads(urllib.request.urlopen(base + "/json/version", timeout=2).read()); break
            except Exception:
                await asyncio.sleep(0.3)
        else:
            print("FAIL: Chrome 未起"); sys.exit(1)
        targets = json.loads(urllib.request.urlopen(base + "/json", timeout=5).read())
        tab = next((t for t in targets if t.get("type")=="page"), None)
        if not tab: print("FAIL: 無 page"); sys.exit(1)
        async with websockets.connect(tab["webSocketDebuggerUrl"], max_size=None) as ws:
            async def send(m,p):
                await ws.send(json.dumps({"id":1,"method":m,"params":p}))
                while True:
                    msg=json.loads(await ws.recv())
                    if msg.get("id")==1: return msg.get("result",{})
            await send("Emulation.setEmulatedMedia", {"features":[{"name":"prefers-reduced-motion","value":"no-preference"}]})
            await send("Page.enable", {})
            await send("Page.navigate", {"url": URL})
            await asyncio.sleep(1.5)
            res = await send("Runtime.evaluate", {"expression": JS, "awaitPromise": True, "returnByValue": True})
            out = res.get("result",{}).get("value")
            print(json.dumps(out, ensure_ascii=False, indent=2))
    finally:
        proc.terminate()
        try: proc.wait(timeout=5)
        except Exception: proc.kill()

if __name__ == "__main__":
    asyncio.run(main())
