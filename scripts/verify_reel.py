#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
reel.mp4 / reel.webm 視覺真實性核對（測量鏈，不依賴外部 vision API）
========================================================================
抽 3 幀 -> PIL 像素統計，斷言：
 1) 非空（方差 > 0）
 2) 漸層存在：單幀獨特色彩數 ≥ 150（平滑過渡產生大量中間色）
 3) 雙色漸層：同時含接近 cyan(#36e0d4) 與 violet(#8b6cff) 的像素
 4) 流動：首尾幀之間像素均值有明顯差異（角度在動）
並抽出一幀存 PNG 供人眼確認。
"""
import subprocess, os, sys, shutil
from collections import Counter
from PIL import Image

HERE = os.path.dirname(__file__)
ASSETS = os.path.join(HERE, "..", "assets")
MP4 = os.path.join(ASSETS, "reel.mp4")
FF = sys.argv[1] if len(sys.argv) > 1 else "ffmpeg"
TMP = os.path.join(HERE, "_frames")
os.makedirs(TMP, exist_ok=True)

CYAN  = (54, 224, 212)
VIOLET = (139, 108, 255)

def dist(p, q):
    return (sum((a-b)**2 for a, b in zip(p, q))) ** 0.5

def extract_frames():
    stamps = [0.0, 4.0, 7.0]
    paths = []
    for i, s in enumerate(stamps):
        out = os.path.join(TMP, f"f{i}.png")
        subprocess.run([FF, "-y", "-ss", str(s), "-i", MP4, "-frames:v", "1", out],
                       capture_output=True, text=True, check=True)
        paths.append(out)
    return paths

def stats(path):
    im = Image.open(path).convert("RGB")
    px = list(im.getdata())
    n = len(px)
    uniq = len(set(px))
    # 接近 cyan / violet 的像素數
    near_cyan = sum(1 for p in px if dist(p, CYAN) < 90)
    near_violet = sum(1 for p in px if dist(p, VIOLET) < 90)
    # 均值
    mr = sum(p[0] for p in px)/n; mg = sum(p[1] for p in px)/n; mb = sum(p[2] for p in px)/n
    # 方差（證明非全單色）
    var = sum((p[0]-mr)**2 + (p[1]-mg)**2 + (p[2]-mb)**2 for p in px)/n
    # 平滑度：相鄰像素差（證明非色塊錯亂/文字殘影）
    w, h = im.size
    samp = px[::97]  # 抽樣
    neigh = 0.0; cnt = 0
    for idx in range(0, len(samp)-w, w):
        a = samp[idx]; b = samp[idx+1] if idx+1 < len(samp) else a
        c = samp[idx+w] if idx+w < len(samp) else a
        neigh += dist(a, b) + dist(a, c); cnt += 2
    edge = neigh/cnt if cnt else 0
    return {"uniq": uniq, "near_cyan": near_cyan, "near_violet": near_violet,
            "mean": (mr, mg, mb), "var": var, "edge": edge}

def main():
    frames = extract_frames()
    st = [stats(p) for p in frames]
    # 複製一幀給人眼看
    human = os.path.join(ASSETS, "reel_frame_sample.png")
    shutil.copy(frames[1], human)
    print("=== 幀統計 ===")
    for i, s in enumerate(st):
        print(f"f{i}: uniq={s['uniq']} near_cyan={s['near_cyan']} near_violet={s['near_violet']} "
              f"mean={tuple(round(x,1) for x in s['mean'])} var={s['var']:.1f} edge={s['edge']:.1f}")

    # 斷言
    errs = []
    for i, s in enumerate(st):
        if s["var"] < 1.0: errs.append(f"f{i} 幾乎全單色(方差過低)")
        if s["uniq"] < 150: errs.append(f"f{i} 獨特色彩不足({s['uniq']})，漸層可能缺失")
        if s["near_cyan"] < 50: errs.append(f"f{i} 缺 cyan 像素")
        if s["near_violet"] < 50: errs.append(f"f{i} 缺 violet 像素")
        if s["edge"] > 120.0: errs.append(f"f{i} 鄰域差過大(可能的色塊錯亂/文字殘影, edge={s['edge']:.1f})")
    # 流動：首尾均值差
    d = sum(abs(a-b) for a, b in zip(st[0]["mean"], st[2]["mean"]))
    if d < 3.0: errs.append(f"首尾幀幾乎相同(流動不足, Δmean={d:.1f})")

    if errs:
        print("FAIL:")
        for e in errs: print("  -", e)
        sys.exit(1)
    print(f"PASS：雙色漸層+流動確認；人眼樣張 = {human}")
    # 清理抽幀
    shutil.rmtree(TMP, ignore_errors=True)

if __name__ == "__main__":
    main()
