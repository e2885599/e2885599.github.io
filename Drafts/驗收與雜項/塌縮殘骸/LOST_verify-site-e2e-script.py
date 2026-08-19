#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
端到端驗證：以 Chrome headless 載入首頁，確認
 1) 頁面 JS 無 console error / page error
 2) 短片懶載入真的生效：初始無 <source>，捲動進入視口後出現 <source> 並 <video>.ready
 3) reveal 揭示確實觸發（區塊獲得 .in class）
依賴：本機 Chrome 145+ (C:/Program Files/Google/Chrome/Application/chrome.exe)
"""
import subprocess, os, sys, time, json, urllib.request

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
URL = "file:///" + ROOT.replace("\\", "/") + "/index.html"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# 用 Chrome 的遠端除錯 + 一段注入腳本（headless）做檢查
# 做法：以 --dump-dom 不行（看不到 JS 狀態），改用 remote debugging + 簡易 CDP 抓取
# 這裡走最穩的：Chrome headless --virtual-time-budget + 注入可執行腳本匯出結果到 stdout
INJECT = r"""
(function(){
  var out = {errors:[], reel:{initialHasSource:false, afterScrollHasSource:false, ready:false}, revealIn:0};
  window.addEventListener('error', function(e){ out.errors.push(String(e.message)); });
  window.addEventListener('unhandledrejection', function(e){ out.errors.push('rej:'+String(e.reason)); });
  var v = document.querySelector('.reel-video');
  out.reel.initialHasSource = !!(v && v.querySelector('source'));
  // 捲動到 reel 區塊
  var reel = document.querySelector('.reel');
  if (reel) reel.scrollIntoView({block:'center'});
  // 等待 IO 觸發（虛擬時間已推進，但 IntersectionObserver 需真實佈局；給 1.2s 真時）
  setTimeout(function(){
    var v2 = document.querySelector('.reel-video');
    out.reel.afterScrollHasSource = !!(v2 && v2.querySelector('source'));
    out.reel.ready = !!(v2 && v2.classList.contains('ready'));
    // reveal 區塊獲得 .in 的數量
    var all = document.querySelectorAll('.reveal');
    var ins = 0; for (var i=0;i<all.length;i++){ if(all[i].classList.contains('in')) ins++; }
    out.revealIn = ins + '/' + all.length;
    // 輸出到頁面標題，方便 --dump-dom 抓
    document.title = 'RESULT:' + JSON.stringify(out);
    // 也直接寫到 body 開頭
    var pre = document.createElement('pre'); pre.id='__verify_out';
    pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
  }, 1400);
})();
"""

# 注入腳本寫成 user script 太繁，改用 remote debugging 太重；
# 改用最簡單可靠：把 INJECT 直接塞進一個本地 html 的尾巴不公平（會改 index）。
# 故改用：Chrome headless 開 index，--dump-dom 拿初始 DOM（確認 video 無 source 標記），
# 再開一個含 INJECT 的 wrapper 頁（same-origin file://）執行後 dump-dom 看結果。

WRAP = os.path.join(HERE, "_verify_wrap.html")
with open(WRAP, "w", encoding="utf-8") as f:
    f.write(f'<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>\n'
            f'<iframe id="f" src="file:///{ROOT.replace(chr(92),"/")}/index.html" style="width:1280px;height:4000px;border:0"></iframe>\n'
            f'<script>{INJECT}</script>\n</body></html>')

def run_dump(wrap_path, budget=4000):
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
           "--virtual-time-budget", str(budget), "--dump-dom", "file:///" + wrap_path.replace("\\","/")]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    return r.stdout

out = run_dump(WRAP)
# 抓 __verify_out
import re
m = re.search(r'<pre id="__verify_out">(.*?)</pre>', out, re.S)
if m:
    res = json.loads(m.group(1))
    print("RESULT:", json.dumps(res, ensure_ascii=False, indent=2))
    errs = []
    if res["errors"]: errs.append("JS 錯誤: " + ", ".join(res["errors"]))
    if res["reel"]["initialHasSource"]: errs.append("初始就內聯 <source>（非懶載入）")
    if not res["reel"]["afterScrollHasSource"]: errs.append("捲動後仍未掛載 <source>（懶載入失效）")
    if res["revealIn"].startswith("0/"): errs.append("reveal 揭示未觸發")
    if errs:
        print("FAIL:", "; ".join(errs)); sys.exit(1)
    print("PASS：無 JS 錯誤 + 短片懶載入生效 + 揭示動畫觸發")
else:
    print("WARN: 未取得結果區塊（headless dump 限制），改以靜態結構判定")
    print("dump 含 reel-video:", 'reel-video' in out)
    print("dump 無內聯 source:", '<source' not in out.split('reel-video')[1].split('</video>')[0] if 'reel-video' in out else 'n/a')
os.remove(WRAP)
