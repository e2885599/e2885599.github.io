#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全程以 ffmpeg 原生濾鏡生成 OODAV LAB 的 8 秒無縫卷軸短片。"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


WIDTH = 1280
HEIGHT = 720
FPS = 12
DURATION = 8
FRAME_COUNT = FPS * DURATION

CYAN = "0x36e0d4"
VIOLET = "0x8b6cff"
DEEP_CYAN = "0x123f49"
DEEP_VIOLET = "0x241a55"

SCRIPT_DIR = Path(__file__).resolve().parent
ASSET_DIR = SCRIPT_DIR.parent / "assets"
RECEIPT_PATH = ASSET_DIR / "reel_scroll_receipt.json"

OUTPUTS = {
    "reel_scroll.mp4": ASSET_DIR / "reel_scroll.mp4",
    "reel_scroll.webm": ASSET_DIR / "reel_scroll.webm",
    "reel_scroll_rev.mp4": ASSET_DIR / "reel_scroll_rev.mp4",
    "reel_scroll_rev.webm": ASSET_DIR / "reel_scroll_rev.webm",
}


def run_checked(command: list[str], purpose: str) -> None:
    """執行 ffmpeg；失敗時保留尾端診斷，避免安靜產出壞檔。"""
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        diagnostic = result.stderr[-4000:].strip()
        raise RuntimeError(f"{purpose}失敗：\n{diagnostic}")


def build_scroll_filter() -> str:
    """建立可垂直平鋪的極光紋理，並以時間驅動的 crop 位移製成向下卷軸。

    關鍵修正（相對初版 Codex 產出）：
    - 初版 crop 的 y 用 'mod(720-n*7.5,720)'，但 filtergraph 的 crop 表達式裡 n 並非
      frame number，導致 y 恆定、畫面完全不卷動（獨立測量鏈实测 maxΔ≈0.5 證實）。
    - 改以時間 t 驅動：y = mod(t*SCROLL_SPEED, H)，t 在每幀遞增，卷軸確定向下移。
    - gradients 用 speed 讓底色本身緩慢流動（不再只取 1 幀 loop）。
    """
    SCROLL_SPEED = 90  # 每秒向下卷動像素（8s 內移 720px = 一個畫面高度，無縫循環）

    # 底色：cyan↔violet 四色極光，speed 讓其緩慢流動（不再靜止 loop 單幀）
    gradient = (
        f"gradients=s={WIDTH}x{HEIGHT}:type=linear:"
        f"c0={DEEP_CYAN}:c1={CYAN}:c2={VIOLET}:c3={DEEP_VIOLET}:"
        f"n=4:x0=0:y0=0:x1={WIDTH}:y1={HEIGHT}:speed=0.15:duration={DURATION},"
        f"format=rgb24"
    )

    # 半透明水平光帶（靜止在紋理上），上下複本疊成 2x 高以便 crop 捲動時無縫
    texture = (
        f"drawbox=x=0:y=58:w=iw:h=22:c={CYAN}@0.24:t=fill,"
        f"drawbox=x=0:y=174:w=iw:h=5:c={VIOLET}@0.42:t=fill,"
        f"drawbox=x=0:y=318:w=iw:h=38:c={CYAN}@0.12:t=fill,"
        f"drawbox=x=0:y=491:w=iw:h=8:c={VIOLET}@0.34:t=fill,"
        f"drawbox=x=0:y=626:w=iw:h=28:c={CYAN}@0.18:t=fill,"
        "gblur=sigma=4,"
        # 把紋理複製成 2 倍高（vstack 自身），crop 時 y 在 [0,H] 滑動即無縫
        "split=2[t0][tb];"
        "[t0][tb]vstack=inputs=2[tiled];"
    )

    # 時間驅動的向下卷軸：y = mod(t*SCROLL_SPEED, H)
    scroll = (
        f"[tiled]crop=w={WIDTH}:h={HEIGHT}:x=0:"
        f"y='mod(t*{SCROLL_SPEED},{HEIGHT})':exact=1[scroll];"
    )

    # 中心巡檢脈衝（cyan 方形光環模糊後 screen 疊色）
    pulse = (
        f"color=c=black:s={WIDTH}x{HEIGHT}:r={FPS}:d={DURATION},"
        "drawbox="
        "x='(iw-iw*(0.22+0.34*(1+sin(2*PI*t/4))/2))/2':"
        "y='(ih-ih*(0.22+0.34*(1+sin(2*PI*t/4))/2))/2':"
        "w='iw*(0.22+0.34*(1+sin(2*PI*t/4))/2)':"
        "h='ih*(0.22+0.34*(1+sin(2*PI*t/4))/2)':"
        f"c={CYAN}@0.72:t=10,gblur=sigma=22[pulse];"
        "[scroll][pulse]blend=all_mode=screen:all_opacity=0.48,"
        f"format=yuv420p[v]"
    )
    return gradient + "," + texture + scroll + pulse


def forward_command(ffmpeg: str, destination: Path, codec_args: list[str]) -> list[str]:
    return [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-filter_complex",
        build_scroll_filter(),
        "-map",
        "[v]",
        "-an",
        "-r",
        str(FPS),
        "-t",
        str(DURATION),
        "-c:v",
        *codec_args,
        str(destination),
    ]


def reverse_command(
    ffmpeg: str, source: Path, destination: Path, codec_args: list[str]
) -> list[str]:
    # 嚴格由正向成品解碼後逐幀倒序；不得以負速重算 gradients。
    return [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source),
        "-vf",
        f"reverse,format=yuv420p",
        "-an",
        "-r",
        str(FPS),
        "-t",
        str(DURATION),
        "-c:v",
        *codec_args,
        str(destination),
    ]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def gray_frame(ffmpeg: str, video: Path, second: int) -> bytes:
    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        str(second),
        "-i",
        str(video),
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "gray",
        "pipe:1",
    ]
    result = subprocess.run(command, capture_output=True, check=False)
    if result.returncode != 0 or len(result.stdout) != WIDTH * HEIGHT:
        raise RuntimeError(f"無法抽取 {video.name} 的 {second}s 驗證幀")
    return result.stdout


def mean_absolute_difference(left: bytes, right: bytes) -> float:
    return sum(abs(a - b) for a, b in zip(left, right)) / len(left)


def verify_motion(ffmpeg: str, video: Path) -> dict[str, float]:
    """可選自驗：抽取 0/4/7 秒，確認相鄰樣本不是靜止畫面。"""
    frames = {second: gray_frame(ffmpeg, video, second) for second in (0, 4, 7)}
    differences = {
        "0s_to_4s_mae": mean_absolute_difference(frames[0], frames[4]),
        "4s_to_7s_mae": mean_absolute_difference(frames[4], frames[7]),
    }
    if any(value <= 3.0 for value in differences.values()):
        raise RuntimeError(f"卷軸位移自驗未達門檻：{differences}")
    return differences


def write_receipt(sizes: dict[str, int], verification: dict[str, float] | None) -> None:
    receipt = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "spec": {
            "width": WIDTH,
            "height": HEIGHT,
            "fps": FPS,
            "duration_seconds": DURATION,
            "frames": FRAME_COUNT,
            "pixel_format": "yuv420p",
            "mp4": "H.264 + FastStart",
            "webm": "VP9",
            "colors": {"cyan": "#36e0d4", "violet": "#8b6cff"},
            "motion": "downward seamless tiled scroll; crop y uses mod over 96 frames",
            "pulse": "center cyan patrol halo; 4-second periodic cycle",
            "reverse": "decoded forward artifact; setpts=N/FRAME_RATE/TB,reverse",
            "verification": verification,
        },
        "files": {
            name: {"size_bytes": sizes[name], "sha256": sha256_file(path)}
            for name, path in OUTPUTS.items()
        },
    }
    RECEIPT_PATH.write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("用法：python make_reel_scroll.py <ffmpeg 絕對路徑> [--verify]")

    ffmpeg = os.path.abspath(sys.argv[1])
    if not os.path.isfile(ffmpeg):
        raise SystemExit(f"找不到 ffmpeg：{ffmpeg}")

    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    mp4_args = [
        "libx264",
        "-preset",
        "veryslow",
        "-crf",
        "32",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
    ]
    webm_args = [
        "libvpx-vp9",
        "-crf",
        "40",
        "-b:v",
        "0",
        "-deadline",
        "good",
        "-cpu-used",
        "2",
        "-pix_fmt",
        "yuv420p",
    ]

    jobs = (
        (forward_command(ffmpeg, OUTPUTS["reel_scroll.mp4"], mp4_args), "正向 MP4"),
        (forward_command(ffmpeg, OUTPUTS["reel_scroll.webm"], webm_args), "正向 WebM"),
        (
            reverse_command(
                ffmpeg,
                OUTPUTS["reel_scroll.mp4"],
                OUTPUTS["reel_scroll_rev.mp4"],
                mp4_args,
            ),
            "反向 MP4",
        ),
        (
            reverse_command(
                ffmpeg,
                OUTPUTS["reel_scroll.webm"],
                OUTPUTS["reel_scroll_rev.webm"],
                webm_args,
            ),
            "反向 WebM",
        ),
    )
    for command, purpose in jobs:
        run_checked(command, purpose)

    verification = None
    if "--verify" in sys.argv[2:]:
        verification = verify_motion(ffmpeg, OUTPUTS["reel_scroll.mp4"])
        print(f"自驗通過：{verification}")

    sizes = {name: path.stat().st_size for name, path in OUTPUTS.items()}
    if any(size <= 0 for size in sizes.values()):
        raise RuntimeError("至少一個輸出檔為空")
    write_receipt(sizes, verification)

    for name, size in sizes.items():
        print(f"{name}: {size:,} bytes ({size / 1024:.1f} KiB)")
    print(f"receipt: {RECEIPT_PATH}")


if __name__ == "__main__":
    main()
