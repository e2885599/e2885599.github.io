#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""真實診斷：線上首頁短片是否「載了但沒播」"""
import subprocess, os, sys, time, json, asyncio, websockets, urllib.request

URL = "https://e2885599.github.io/index.html"   # 線上真實頁
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9351

JS = r"""
(async function(){
  var out = {src:'', paused:null, vw:null, t0:null, t1:null, err:null,
             playRejected:false, loadedData:false, canplay:false, netState:null, mediaErr:null};
  try {
    var v = document.querySelector('.reel-video');
    if (!v) { out.err='no .reel-video'; return out; }
    // 滾動進視口觸發懶載入
    var reel = document.querySelector('.reel');
    if (reel) reel.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r, 3000));
    out.src = v.currentSrc || '(none)';
    out.vw = v.videoWidth; out.netState = v.networkState;
    out.mediaErr = v.error ? v.error.code : null;
    v.addEventListener('loadeddata', ()=>out.loadedData=true, {once:true});
    v.addEventListener('canplay', ()=>out.canplay=true, {once:true});
    // 記錄 play() 是否被拒
    var pr = v.play();
    if (pr && pr.catch) pr.catch(e=>{ out.playRejected = String(e); });
    out.paused = v.paused;
    out.t0 = v.currentTime;
    await new Promise(r=>setTimeout(r, 1500));
    out.t1 = v.currentTime;
    out.paused = v.paused;
  } catch(e){ out.err = 'JSX:'+String(e); }
  return out;
})()
"""

async def main():
    proc = subprocess.Popen([CHROME, f"--remote-debugging-port={PORT}", "--headless=new",
        "--disable-gpu", "--no-sandbox", "--force-prefers-reduced-motion=no-preference",
        "--user-data-dir=" + os.path.join(os.path.dirname(__file__), "_cprof_diag2")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        base = f"http://127.0.0.1:{PORT}"
        for _ in range(40):
            try:
                json.loads(urllib.request.urlopen(base+"/json/version", timeout=2).read()); break
            except Exception: await asyncio.sleep(0.3)
        targets = json.loads(urllib.request.urlopen(base+"/json", timeout=5).read())
        tab = next((t for t in targets if t.get("type")=="page"), None)
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
            print(json.dumps(res.get("result",{}).get("value"), ensure_ascii=False, indent=2))
    finally:
        proc.terminate()
        try: proc.wait(timeout=5)
        except Exception: proc.kill()

if __name__ == "__main__":
    asyncio.run(main())
