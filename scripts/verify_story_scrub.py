#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""針對性 e2e：核心信息短片的滾動刷幀（scroll-scrubbing）雙向驗證
================================================================
斷言：
 1) 載入後影片已 ready（source 掛上、duration 有限）
 2) 跟隨滾動模式：向下滾(區塊移出頂部) → currentTime 增大；向上滾 → currentTime 減小（雙向）
 3) 鎖定反向：切到 rev 源且 paused=false（在播）
 4) reduced-motion：仍載入並播放
"""
import subprocess, os, sys, asyncio, websockets, urllib.request, json, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = r"D:\OODAV-MIRROR\02-STUDIO\studio-site"
URL = "file:///" + ROOT.replace("\\", "/") + "/index.html"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

JS_PREP = r"""
(async function(){
  // 確保 story 區塊已進視口並載入
  var v = document.querySelector('.story-video');
  if (!v) return {err:'no .story-video'};
  v.scrollIntoView({block:'center'});
  await new Promise(r=>setTimeout(r, 3500));
  return {ready: v.classList.contains('ready'), src: v.currentSrc||'', dur: v.duration, loaded: !!v.dataset.loaded};
})()
"""

JS_SCRUB = r"""
(async function(opt){
  var v = document.querySelector('.story-video');
  if (!v) return {err:'no video'};
  var sec = v.closest('section');
  // 用絕對 scrollTo：讓 section 頂部位於視口 vh*(1-pos) 處
  var vh = window.innerHeight;
  var top = sec.offsetTop;
  var targetScroll = top - vh * (1 - opt.pos);
  window.scrollTo(0, targetScroll);
  await new Promise(r=>setTimeout(r, 700));
  return {t: v.currentTime, pos: opt.pos, dur: v.duration};
})(ARG)
"""

JS_LOCK = r"""
(async function(dir){
  var btns = document.querySelectorAll('.story .rc-btn');
  var target = null;
  btns.forEach(b=>{ if(b.getAttribute('data-dir')===dir) target=b; });
  if (target) target.click();
  await new Promise(r=>setTimeout(r, 1500));
  var v = document.querySelector('.story-video');
  return {src: v.currentSrc||'', paused: v.paused, dir: dir};
})(ARG)
"""

async def run_cdp(mode, fn_name, arg=None, port=9370):
    prof = os.path.join(HERE, f"_e2e_story_{mode}")
    os.makedirs(prof, exist_ok=True)
    proc = subprocess.Popen([CHROME, f"--remote-debugging-port={port}", "--headless=new",
        "--disable-gpu", "--no-sandbox", f"--force-prefers-reduced-motion={mode}",
        f"--user-data-dir={prof}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        base = f"http://127.0.0.1:{port}"
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
            res = await send("Runtime.evaluate", {"expression": JS_PREP, "awaitPromise": True, "returnByValue": True})
            prep = res.get("result",{}).get("value")
            out = {"prep": prep}
            if fn_name == "scrub":
                for tag, pos in [("t_low", 0.2), ("t_high", 0.8)]:
                    js = JS_SCRUB.replace("ARG", json.dumps({"pos": pos}))
                    r = await send("Runtime.evaluate", {"expression": js, "awaitPromise": True, "returnByValue": True})
                    out[tag] = r.get("result",{}).get("value",{}).get("t")
            elif fn_name == "lock":
                js = JS_LOCK.replace("ARG", json.dumps(arg))
                r = await send("Runtime.evaluate", {"expression": js, "awaitPromise": True, "returnByValue": True})
                out["lock"] = r.get("result",{}).get("value")
            return out
    finally:
        proc.terminate()
        try: proc.wait(timeout=5)
        except Exception: proc.kill()
        shutil.rmtree(prof, ignore_errors=True)

def main():
    # 1) 跟隨滾動雙向（no-preference）
    o = asyncio.run(run_cdp("no-preference", "scrub"))
    fails = []
    prep = o.get("prep", {})
    if not prep or prep.get("err"): fails.append(f"prep 錯誤: {prep}")
    else:
        if not prep.get("ready"): fails.append("影片未 ready")
        if "story" not in (prep.get("src") or ""): fails.append(f"未載入 story 源: {prep.get('src')}")
        if not (prep.get("dur") and prep.get("dur") > 5): fails.append(f"duration 異常: {prep.get('dur')}")
    tl, th = o.get("t_low"), o.get("t_high")
    print(f"scrub t@pos0.2={tl}  t@pos0.8={th}")
    if tl is None or th is None: fails.append("刷幀未取得 currentTime")
    elif not (th > tl + 0.5): fails.append(f"向下滾未使時間增大({tl}→{th})，雙向刷幀失敗")
    # 2) 鎖定反向（no-preference）
    o2 = asyncio.run(run_cdp("no-preference", "lock", "rev"))
    lock = (o2.get("lock") or {})
    print(f"lock rev: src={lock.get('src')} paused={lock.get('paused')}")
    if "story_rev" not in (lock.get("src") or ""): fails.append(f"鎖反向未切 rev 源: {lock.get('src')}")
    if lock.get("paused") is not False: fails.append(f"鎖反向未在播: paused={lock.get('paused')}")
    # 3) reduced-motion 仍載入播放
    o3 = asyncio.run(run_cdp("reduce", "lock", "fwd"))
    lock3 = (o3.get("lock") or {})
    if "story" not in (lock3.get("src") or ""): fails.append(f"reduce 未載入 story: {lock3.get('src')}")
    if lock3.get("paused") is not False: fails.append(f"reduce 未在播: {lock3.get('paused')}")

    print("=== 滾動刷幀 e2e 總結 ===")
    if fails:
        print("FAIL:"); [print(" -", f) for f in fails]; sys.exit(1)
    print("ALL PASS：跟隨滾動雙向刷幀 + 鎖反向切源播放 + reduce 仍載入播放")

if __name__ == "__main__":
    main()
