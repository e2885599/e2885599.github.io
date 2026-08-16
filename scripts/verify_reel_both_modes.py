#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
針對性 e2e：同時驗 no-preference 與 reduce 兩種媒體模式
========================================================
不再假設 no-preference。核心斷言：
 - 兩種模式下 .reel-video 都應載入（currentSrc 指向 reel_scroll）
 - 兩種模式下影片都應「在播」（paused=false）且 currentTime 推進
 - 兩種模式下 video 都應有 .ready 類（opacity=1，肉眼可見）
"""
import subprocess, os, sys, time, json, asyncio, websockets, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
URL = "file:///" + ROOT.replace("\\", "/") + "/index.html"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9361

JS = r"""
(async function(){
  var out = {src:'', paused:null, t0:null, t1:null, readyClass:false, err:null, playRej:false};
  try {
    var v = document.querySelector('.reel-video');
    if (!v) { out.err='no .reel-video'; return out; }
    var reel = document.querySelector('.reel');
    if (reel) reel.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r, 3500));
    out.src = v.currentSrc || '(none)';
    out.readyClass = v.classList.contains('ready');
    var pr = v.play();
    if (pr && pr.catch) pr.catch(e=>{ out.playRej = String(e); });
    out.paused = v.paused;
    out.t0 = v.currentTime;
    await new Promise(r=>setTimeout(r, 1500));
    out.t1 = v.currentTime;
    out.paused = v.paused;
    out.readyClass = v.classList.contains('ready');
  } catch(e){ out.err='JSX:'+String(e); }
  return out;
})()
"""

async def run_once(mode):
    proc = subprocess.Popen([CHROME, f"--remote-debugging-port={PORT}", "--headless=new",
        "--disable-gpu", "--no-sandbox", f"--force-prefers-reduced-motion={mode}",
        "--user-data-dir=" + os.path.join(HERE, f"_cprof_{mode}")],
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
            await send("Emulation.setEmulatedMedia", {"features":[{"name":"prefers-reduced-motion","value":mode}]})
            await send("Page.enable", {})
            await send("Page.navigate", {"url": URL})
            await asyncio.sleep(1.5)
            res = await send("Runtime.evaluate", {"expression": JS, "awaitPromise": True, "returnByValue": True})
            return res.get("result",{}).get("value")
    finally:
        proc.terminate()
        try: proc.wait(timeout=5)
        except Exception: proc.kill()

def check(name, out):
    fails = []
    if not out: fails.append("無輸出")
    else:
        if "reel_scroll" not in (out.get("src") or ""): fails.append(f"未載入卷軸(src={out.get('src')})")
        if out.get("paused") is not False: fails.append(f"未播放(paused={out.get('paused')})")
        t0,t1 = out.get("t0"), out.get("t1")
        if t0 is None or t1 is None or (t1 - t0) < 0.5: fails.append(f"currentTime 未推進({t0}→{t1})")
        if not out.get("readyClass"): fails.append("缺 .ready 類(opacity=0 不可見)")
    status = "PASS" if not fails else "FAIL"
    print(f"[{status}] {name}: " + (json.dumps(out, ensure_ascii=False) if out else "null"))
    if fails:
        for f in fails: print(f"    - {f}")
    return not fails

async def main():
    ok = True
    for mode in ["no-preference", "reduce"]:
        out = await run_once(mode)
        ok = check(f"媒體={mode}", out) and ok
        shutil_rm(mode)
    print("\n=== 總結 ===")
    print("ALL PASS" if ok else "有失敗項（見上）")
    sys.exit(0 if ok else 1)

def shutil_rm(mode):
    import shutil
    d = os.path.join(HERE, f"_cprof_{mode}")
    shutil.rmtree(d, ignore_errors=True)

if __name__ == "__main__":
    asyncio.run(main())
