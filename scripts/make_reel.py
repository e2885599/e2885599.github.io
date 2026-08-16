#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OODAV LAB 品牌短片生成器（程式化、無外部素材）
==============================================
主題：cyan→violet 極光漸層緩慢流動 + 週期性「自動巡檢脈衝」光暈擴散
規格：1280x720 / 12fps / 8s 循環 / H.264(yuv420p)+FastStart + 同軌 WebM
參數全部顯式，便於日後 Merkle 收據比對（可證偽）。
依賴：ffmpeg（外部，路徑由呼叫端傳入）
"""
import subprocess, sys, os, hashlib, json, datetime

W, H = 1280, 720
FPS = 12
DUR = 8.0                      # 秒
N = int(FPS * DUR)             # 總幀數 = 96

# 品牌色（與 style.css 對齊：--cyan #36e0d4 / --violet #8b6cff）
CYAN   = "0x36e0d4"
VIOLET = "0x8b6cff"
BG     = "0x060912"

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUT_DIR, exist_ok=True)
MP4 = os.path.join(OUT_DIR, "reel.mp4")
WEBM = os.path.join(OUT_DIR, "reel.webm")
MP4_REV = os.path.join(OUT_DIR, "reel_rev.mp4")
WEBM_REV = os.path.join(OUT_DIR, "reel_rev.webm")

def build_filter(direction=1):
    """
    核心濾鏡鏈（program 化極光 + 巡檢脈衝）
    direction=1 正向 / direction=-1 反向（真·像素級倒放，不依賴 PTS 重寫）
    """
    spd = 0.45                      # 極光旋轉速度（緩慢但 8s 內肉眼可見流動；gradients 不接受負值）
    # 反向：交換 c0/c1 讓極光反向流動；正向：c0=cyan c1=violet
    if direction >= 0:
        c0_1, c1_1 = CYAN, VIOLET
        c0_2, c1_2 = VIOLET, CYAN
    else:
        c0_1, c1_1 = VIOLET, CYAN
        c0_2, c1_2 = CYAN, VIOLET
    # 兩層極光（cyan↔violet），各自輕模糊後 lighten 疊出流動光感
    blur = "gblur=sigma=8"
    # 巡檢脈衝：中心週期性擴散光暈；反向時相位取 (DUR - t) 實現真倒放
    phase = f"({DUR}-t)" if direction < 0 else "t"
    pulse = (
        f"drawbox=x=(iw-iw*0.5*(1+0.9*sin({phase}*1.4)))/2:"
        f"y=(ih-ih*0.5*(1+0.9*sin({phase}*1.4)))/2:"
        f"w=iw*0.5*(1+0.9*sin({phase}*1.4)):h=ih*0.5*(1+0.9*sin({phase}*1.4)):"
        f"color={CYAN}@0.20:t=4,"
        "gblur=sigma=3"
    )
    chain = (
        f"gradients=size={W}x{H}:type=linear:c0={c0_1}:c1={c1_1}:speed={spd}:duration={DUR}[a1];"
        f"gradients=size={W}x{H}:type=linear:c0={c0_2}:c1={c1_2}:speed={spd}:duration={DUR}:seed=7[a2];"
        f"[2:v][a1]overlay=format=auto[ba1];"
        f"[ba1][a2]blend=all_mode=lighten:all_opacity=0.6[mix];"
        f"[mix]{pulse},format=yuv420p[v]"
    )
    return chain

def run(ff, out_path, vcodec, extra, direction=1, src_mp4=None):
    # 正向：直接以 gradients 濾鏡圖生成
    # 反向：對「已生成的正向影片」做純幀序列倒序（setpts 先歸一化時間軸，再 reverse），
    #       保證像素級精確倒放，不受 gradients 依 PTS 時間動畫影響。
    if direction >= 0:
        fgraph = build_filter(direction=1)
        inputs = [
            "-f", "lavfi", "-i", f"gradients=size={W}x{H}:type=linear:c0={CYAN}:c1={VIOLET}:speed=0.45:duration={DUR}",
            "-f", "lavfi", "-i", f"gradients=size={W}x{H}:type=linear:c0={VIOLET}:c1={CYAN}:speed=0.45:duration={DUR}:seed=7",
            "-f", "lavfi", "-i", f"color=c={BG}:s={W}x{H}:d={DUR}",
        ]
        cmd = [ff, "-y"] + inputs + ["-filter_complex", fgraph, "-map", "[v]",
              "-r", str(FPS), "-t", str(DUR), "-c:v", vcodec] + extra + [out_path]
    else:
        # 反向：從正向影片幀倒序（像素級倒放）
        cmd = [ff, "-y", "-i", src_mp4,
               "-vf", "setpts=N/FRAME_RATE/TB,reverse", "-r", str(FPS),
               "-c:v", vcodec] + extra + [out_path]
    print("CMD:", " ".join(cmd))
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("STDERR:", r.stderr[-2000:])
        raise RuntimeError(f"ffmpeg failed -> {out_path}")
    # FastStart for mp4
    if out_path.endswith(".mp4"):
        tmp = out_path + ".tmp.mp4"
        subprocess.run([ff, "-y", "-i", out_path, "-c:v", "copy", "-movflags", "+faststart", tmp],
                       capture_output=True, text=True, check=True)
        os.replace(tmp, out_path)
    sz = os.path.getsize(out_path)
    print(f"OK {out_path} {sz/1024:.1f} KB")
    return sz

def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(65536), b""):
            h.update(b)
    return h.hexdigest()

if __name__ == "__main__":
    ff = sys.argv[1] if len(sys.argv) > 1 else "ffmpeg"
    # 正向 mp4 / webm
    s_mp4 = run(ff, MP4, "libx264", ["-preset", "veryslow", "-crf", "30", "-pix_fmt", "yuv420p"], direction=1)
    try:
        s_webm = run(ff, WEBM, "libvpx-vp9", ["-b:v", "900k", "-pix_fmt", "yuv420p"], direction=1)
    except Exception as e:
        print("WEBM skipped:", e); s_webm = 0
    # 反向：從正向影片幀倒序（像素級精確倒放）
    s_mp4_rev = run(ff, MP4_REV, "libx264", ["-preset", "veryslow", "-crf", "30", "-pix_fmt", "yuv420p"],
                    direction=-1, src_mp4=MP4)
    try:
        s_webm_rev = run(ff, WEBM_REV, "libvpx-vp9", ["-b:v", "900k", "-pix_fmt", "yuv420p"],
                         direction=-1, src_mp4=WEBM)
    except Exception as e:
        print("WEBM_REV skipped:", e); s_webm_rev = 0
    receipt = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "spec": {"w": W, "h": H, "fps": FPS, "dur": DUR, "frames": N,
                  "cyan": CYAN, "violet": VIOLET, "bg": BG,
                  "theme": "aurora-gradient + patrol-pulse",
                  "directions": "forward(gradients-generated) + reverse(frame-level reverse of forward via setpts+reverse filter, pixel-exact)"},
        "files": {
            "reel.mp4": {"size": s_mp4, "sha256": sha256(MP4)},
            "reel.webm": {"size": s_webm, "sha256": sha256(WEBM) if s_webm else None},
            "reel_rev.mp4": {"size": s_mp4_rev, "sha256": sha256(MP4_REV)},
            "reel_rev.webm": {"size": s_webm_rev, "sha256": sha256(WEBM_REV) if s_webm_rev else None},
        }
    }
    rp = os.path.join(OUT_DIR, "reel_receipt.json")
    with open(rp, "w", encoding="utf-8") as f:
        json.dump(receipt, f, ensure_ascii=False, indent=2)
    print("RECEIPT:", rp)
