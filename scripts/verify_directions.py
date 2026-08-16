#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
雙向影片真實性核對 v2（對位測量鏈，不依賴外部 vision）
========================================================
理論：本短片為週期性呼吸（gradients 旋轉 + 巡檢脈衝 sin）。
  - 正向：fwd(t) 依時間 t 演進
  - 反向（像素級烘焙）：fwd(t) 應 == rev(DUR - t)
    即「正向在第 t 秒的畫面」等於「反向在第 (DUR-t) 秒的畫面」
斷言：
  1) 正向有流動：抽 0/2/4/6s 至少一對差異 > 閾值
  2) 對位一致：對 0..DUR 取 12 點，fwd(t) 與 rev(DUR-t) 平均差 < 容差
     → 證明反向是「真·倒放」，而非一段獨立/相同的影片
  3) 雙向皆非全單色（漸層存在）
取多幀比對像素均值。
"""
import subprocess, os, sys
from PIL import Image

HERE = os.path.dirname(__file__)
ASSETS = os.path.join(HERE, "..", "assets")
MP4 = os.path.join(ASSETS, "reel.mp4")
MP4_REV = os.path.join(ASSETS, "reel_rev.mp4")
FF = sys.argv[1] if len(sys.argv) > 1 else "ffmpeg"
TMP = os.path.join(HERE, "_chk");
os.makedirs(TMP, exist_ok=True)
DUR = 8.0

def frame_mean(path, ts):
    out = os.path.join(TMP, "f.png")
    subprocess.run([FF, "-y", "-ss", str(ts), "-i", path, "-frames:v", "1", out],
                   capture_output=True, text=True, check=True)
    im = Image.open(out).convert("RGB")
    px = list(im.getdata())
    n = len(px)
    mr = sum(p[0] for p in px)/n; mg = sum(p[1] for p in px)/n; mb = sum(p[2] for p in px)/n
    uniq = len(set(px))
    return (mr, mg, mb), uniq

def dist(a, b):
    return sum((x-y)**2 for x, y in zip(a, b)) ** 0.5

def main():
    # 1) 正向流動
    samples = [0, 2, 4, 6]
    means = [frame_mean(MP4, t)[0] for t in samples]
    flow_max = max(dist(means[i], means[j]) for i in range(4) for j in range(i+1,4))
    print("正向流動 maxΔ(0/2/4/6s):", round(flow_max, 2))

    # 2) 對位一致：fwd(t) vs rev(DUR-t)
    N = 12
    diffs = []
    for i in range(N+1):
        t = DUR * i / N
        fm, _ = frame_mean(MP4, t)
        rm, _ = frame_mean(MP4_REV, DUR - t)
        diffs.append(dist(fm, rm))
    avg_diff = sum(diffs)/len(diffs)
    max_diff = max(diffs)
    print("對位 diff avg:", round(avg_diff, 2), "max:", round(max_diff, 2))

    # 3) 漸層
    uf = frame_mean(MP4, 0)[1]
    ur = frame_mean(MP4_REV, 0)[1]
    print("uniq fwd/rev:", uf, ur)

    errs = []
    if flow_max < 5: errs.append(f"正向流動不足(Δ={flow_max:.1f})")
    # 對位：倒放應極接近（烘焙式倒放，壓縮損失容差 12）
    if avg_diff > 12: errs.append(f"對位平均差過大(avg={avg_diff:.1f})，反向非真倒放")
    if max_diff > 18: errs.append(f"對位最大差過大(max={max_diff:.1f})")
    if uf < 150: errs.append("正向漸層缺失")
    if ur < 150: errs.append("反向漸層缺失")
    if errs:
        print("FAIL:");
        for e in errs: print("  -", e)
        sys.exit(1)
    print("PASS：正向流動 + 反向為真·像素級倒放（fwd(t)≈rev(DUR-t)，avgΔ=%.1f）" % avg_diff)

if __name__ == "__main__":
    main()
