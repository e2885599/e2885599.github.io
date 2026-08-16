#!/usr/bin/env python3
"""逐幀生成 16 秒「主動資運」品牌短片，並以 ffmpeg 封裝成影片。"""

from __future__ import annotations

import hashlib
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat


WIDTH, HEIGHT = 1280, 720
FPS = 12
DURATION = 16
SLIDE_SECONDS = 4
TOTAL_FRAMES = FPS * DURATION
FONT_PATH = Path("C:/Windows/Fonts/msjh.ttc")

CYAN = (0x36, 0xE0, 0xD4)
VIOLET = (0x8B, 0x6C, 0xFF)
RED = (0xFF, 0x4D, 0x5E)
GREEN = (0x3D, 0xFF, 0x9E)
INK = (224, 235, 246)
MUTED = (112, 133, 154)


def font(size: int) -> ImageFont.FreeTypeFont:
    """使用指定微軟正黑體，避免各環境字型回退造成畫面差異。"""
    if not FONT_PATH.is_file():
        raise FileNotFoundError(f"找不到字型：{FONT_PATH}")
    return ImageFont.truetype(str(FONT_PATH), size)


FONTS: dict[str, ImageFont.FreeTypeFont] = {}


def init_fonts() -> None:
    FONTS.update(
        title=font(58), headline=font(48), subhead=font(30), body=font(23),
        small=font(17), mono=font(19), percent=font(86),
    )


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def alpha_color(rgb: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return (*rgb, max(0, min(255, alpha)))


def rounded_panel(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, ...] = (12, 25, 39, 235),
    outline: tuple[int, ...] = (*CYAN, 105),
    radius: int = 24,
    width: int = 2,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_background(image: Image.Image, slide: int) -> None:
    """各 slide 使用明顯不同底色與幾何方向，形成滑頁式切換。"""
    palettes = [(5, 14, 25), (5, 25, 28), (27, 8, 30), (8, 27, 24)]
    accent = (CYAN, GREEN, RED, VIOLET)[slide]
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=palettes[slide] + (255,))
    for index in range(8):
        offset = index * 190 - 170
        if slide % 2:
            points = [(offset, 0), (offset + 260, 0), (offset + 700, HEIGHT), (offset + 440, HEIGHT)]
        else:
            points = [(offset, HEIGHT), (offset + 250, HEIGHT), (offset + 610, 0), (offset + 360, 0)]
        draw.polygon(points, fill=alpha_color(accent, 8 + index % 3 * 3))
    draw.line((54, 50, WIDTH - 54, 50), fill=alpha_color(accent, 80), width=2)
    draw.text((56, 18), f"ACTIVE OPS  /  0{slide + 1}", font=FONTS["small"], fill=alpha_color(INK, 175))


def draw_engineer(image: Image.Image, x: int, y: int, phase: float, alert: bool = False) -> None:
    """以橢圓與線條繪製資運工程師角色。"""
    draw = ImageDraw.Draw(image, "RGBA")
    bob = int(math.sin(phase * math.tau) * 4)
    x, y = x, y + bob
    glow = RED if alert else CYAN
    draw.ellipse((x - 105, y + 230, x + 105, y + 265), fill=(0, 0, 0, 75))
    draw.ellipse((x - 48, y - 76, x + 48, y + 20), fill=(220, 229, 234, 255), outline=alpha_color(glow, 230), width=4)
    draw.arc((x - 53, y - 80, x + 53, y + 26), 190, 350, fill=alpha_color(VIOLET, 230), width=8)
    draw.ellipse((x - 19, y - 32, x - 10, y - 23), fill=(15, 26, 38, 255))
    draw.ellipse((x + 10, y - 32, x + 19, y - 23), fill=(15, 26, 38, 255))
    draw.arc((x - 16, y - 20, x + 16, y + 2), 20, 160, fill=(15, 26, 38, 220), width=3)
    draw.rounded_rectangle((x - 55, y + 20, x + 55, y + 150), radius=25, fill=(18, 42, 59, 255), outline=alpha_color(glow, 230), width=4)
    draw.line((x - 48, y + 58, x - 96, y + 126), fill=alpha_color(INK, 240), width=12)
    draw.line((x + 48, y + 58, x + 94, y + 108), fill=alpha_color(INK, 240), width=12)
    draw.ellipse((x - 105, y + 118, x - 87, y + 136), fill=INK + (255,))
    draw.ellipse((x + 85, y + 99, x + 103, y + 117), fill=INK + (255,))
    draw.line((x - 30, y + 146, x - 52, y + 240), fill=alpha_color(INK, 240), width=14)
    draw.line((x + 30, y + 146, x + 54, y + 240), fill=alpha_color(INK, 240), width=14)
    draw.line((x - 70, y + 241, x - 45, y + 241), fill=alpha_color(glow, 240), width=12)
    draw.line((x + 48, y + 241, x + 75, y + 241), fill=alpha_color(glow, 240), width=12)
    draw.rounded_rectangle((x - 34, y + 58, x + 34, y + 103), radius=8, fill=(7, 18, 29, 255), outline=alpha_color(VIOLET, 210), width=2)
    draw.line((x - 20, y + 75, x + 18, y + 75), fill=alpha_color(CYAN, 210), width=3)


def draw_check(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple[int, int, int]) -> None:
    draw.line((x, y + 10, x + 9, y + 19, x + 27, y - 3), fill=alpha_color(color, 255), width=5, joint="curve")


def draw_dashboard(image: Image.Image, box: tuple[int, int, int, int], progress: float, alert_index: int | None = None) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    rounded_panel(draw, box)
    left, top, right, bottom = box
    draw.text((left + 28, top + 21), "資運即時控制台", font=FONTS["body"], fill=INK + (255,))
    draw.ellipse((right - 52, top + 27, right - 38, top + 41), fill=GREEN + (255,))
    draw.line((left + 25, top + 66, right - 25, top + 66), fill=alpha_color(CYAN, 65), width=2)
    labels = ["帳務事件完整性", "跨系統資料一致", "排程執行狀態", "存取軌跡封存"]
    for index, label in enumerate(labels):
        row_y = top + 95 + index * 73
        is_alert = alert_index == index
        active = progress >= (index + 1) / len(labels)
        row_color = RED if is_alert else (GREEN if active else MUTED)
        draw.rounded_rectangle((left + 25, row_y, right - 25, row_y + 52), radius=12, fill=alpha_color(row_color, 18), outline=alpha_color(row_color, 115), width=2)
        draw.text((left + 46, row_y + 12), label, font=FONTS["small"], fill=alpha_color(INK, 235))
        if is_alert:
            draw.text((right - 104, row_y + 11), "!", font=FONTS["body"], fill=RED + (255,))
        elif active:
            draw_check(draw, right - 82, row_y + 15, GREEN)
        else:
            draw.ellipse((right - 78, row_y + 18, right - 62, row_y + 34), outline=alpha_color(MUTED, 180), width=2)


def draw_slide_one(image: Image.Image, local: float) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    intro = ease(min(1.0, local * 2.5))
    draw_engineer(image, int(-80 + intro * 285), 285, local)
    panel_x = int(WIDTH + 80 - intro * 615)
    draw_dashboard(image, (panel_x, 145, panel_x + 530, 535), 0.0)
    slogan = "主動資運 · 把混亂變秩序"
    bbox = draw.textbbox((0, 0), slogan, font=FONTS["title"])
    text_x = (WIDTH - (bbox[2] - bbox[0])) // 2
    draw.rounded_rectangle((text_x - 25, 566, text_x + bbox[2] + 25, 650), radius=22, fill=(4, 15, 26, 225), outline=alpha_color(CYAN, 150), width=2)
    draw.text((text_x, 577), slogan, font=FONTS["title"], fill=INK + (255,), stroke_width=1, stroke_fill=alpha_color(CYAN, 90))


def draw_slide_two(image: Image.Image, local: float) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    draw.text((72, 93), "自動巡檢", font=FONTS["headline"], fill=GREEN + (255,))
    draw.text((74, 153), "逐項核對，持續留下可追溯狀態", font=FONTS["body"], fill=alpha_color(INK, 195))
    draw_engineer(image, 205, 320, local)
    box = (420, 105, 1170, 635)
    draw_dashboard(image, box, min(1.0, local * 1.18))
    # 掃描線在控制台範圍內反覆由上向下移動。
    scan_y = int(180 + (local * 1.35 % 1.0) * 405)
    for radius, alpha in ((17, 24), (10, 55), (3, 235)):
        draw.rectangle((440, scan_y - radius, 1150, scan_y + radius), fill=alpha_color(CYAN, alpha))
    draw.text((948, 70), f"SCAN {int(local * 100):02d}%", font=FONTS["mono"], fill=alpha_color(CYAN, 210))


def draw_slide_three(image: Image.Image, local: float) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    draw.text((72, 93), "異常報警", font=FONTS["headline"], fill=RED + (255,))
    draw.text((74, 153), "定位偏差，同步通知處理節點", font=FONTS["body"], fill=alpha_color(INK, 195))
    draw_engineer(image, 205, 320, local, alert=True)
    draw_dashboard(image, (420, 105, 1170, 635), 1.0, alert_index=2)
    # Cyan 脈衝環使用透明圖層疊加，維持乾淨的極光感。
    pulse = (local * 1.65) % 1.0
    center = (805, 420)
    for offset in (0.0, 0.32, 0.64):
        p = (pulse + offset) % 1.0
        radius = int(24 + p * 210)
        alpha = int((1.0 - p) * 190)
        draw.ellipse((center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius), outline=alpha_color(CYAN, alpha), width=max(2, int(9 - p * 6)))
    draw.rounded_rectangle((742, 385, 868, 455), radius=18, fill=(29, 5, 17, 238), outline=RED + (230,), width=3)
    draw.text((765, 398), "偏差", font=FONTS["subhead"], fill=RED + (255,))


def draw_slide_four(image: Image.Image, local: float) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    draw.text((72, 92), "交付可驗證", font=FONTS["headline"], fill=VIOLET + (255,))
    draw.text((74, 152), "每一筆結果都有一致性指紋", font=FONTS["body"], fill=alpha_color(INK, 195))
    rounded_panel(draw, (72, 210, 1208, 625), fill=(7, 28, 31, 238), outline=alpha_color(GREEN, 150))
    draw.text((118, 255), "對帳通過", font=FONTS["subhead"], fill=alpha_color(INK, 220))
    count = min(100, int(ease(min(1.0, local * 1.35)) * 100))
    draw.text((112, 297), f"{count}%", font=FONTS["percent"], fill=GREEN + (255,))
    draw.rounded_rectangle((470, 267, 1125, 397), radius=22, fill=(5, 17, 27, 220), outline=alpha_color(CYAN, 100), width=2)
    draw.text((500, 285), "MERKLE FINGERPRINT", font=FONTS["small"], fill=alpha_color(CYAN, 210))
    # 固定十六進位序列讓輸出可重現，色塊以字元值映射品牌色。
    fingerprint = "36e0d48b6cff3dff9eff4d5e71a94c2b"
    colors = (CYAN, VIOLET, GREEN, RED)
    visible = max(1, int(len(fingerprint) * min(1.0, local * 1.6)))
    for index, char in enumerate(fingerprint):
        x = 500 + index * 18
        color = colors[int(char, 16) % len(colors)] if index < visible else (37, 51, 62)
        draw.rounded_rectangle((x, 333, x + 13, 369), radius=3, fill=alpha_color(color, 235))
    draw.text((117, 475), "驗證鏈", font=FONTS["small"], fill=alpha_color(INK, 170))
    nodes = [(225, 500), (445, 500), (665, 500), (885, 500), (1080, 500)]
    for index in range(len(nodes) - 1):
        draw.line((nodes[index][0], nodes[index][1], nodes[index + 1][0], nodes[index + 1][1]), fill=alpha_color(CYAN, 125), width=4)
    for index, (x, y) in enumerate(nodes):
        color = (CYAN, VIOLET, GREEN, CYAN, GREEN)[index]
        draw.ellipse((x - 16, y - 16, x + 16, y + 16), fill=(7, 20, 29, 255), outline=alpha_color(color, 245), width=5)
    draw.text((890, 548), "RECEIPT  /  VERIFIED", font=FONTS["mono"], fill=alpha_color(GREEN, 220))


def render_frame(frame_index: int) -> Image.Image:
    slide = min(3, frame_index // (FPS * SLIDE_SECONDS))
    local_frame = frame_index % (FPS * SLIDE_SECONDS)
    local = local_frame / (FPS * SLIDE_SECONDS - 1)
    image = Image.new("RGB", (WIDTH, HEIGHT))
    draw_background(image, slide)
    (draw_slide_one, draw_slide_two, draw_slide_three, draw_slide_four)[slide](image, local)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.text((1138, 675), f"{slide + 1} / 4", font=FONTS["small"], fill=alpha_color(INK, 150))
    return image


def run(command: list[str]) -> None:
    shown = " ".join(f'"{part}"' if " " in part else part for part in command)
    print(f"> {shown}")
    subprocess.run(command, check=True)


def encode_videos(ffmpeg: Path, frames_dir: Path, assets_dir: Path) -> list[Path]:
    pattern = str(frames_dir / "%05d.png")
    mp4 = assets_dir / "story.mp4"
    webm = assets_dir / "story.webm"
    rev_mp4 = assets_dir / "story_rev.mp4"
    rev_webm = assets_dir / "story_rev.webm"
    common = [str(ffmpeg), "-hide_banner", "-loglevel", "error", "-y"]
    run(common + ["-framerate", str(FPS), "-i", pattern, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "32", "-tune", "animation", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)])
    run(common + ["-framerate", str(FPS), "-i", pattern, "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "39", "-row-mt", "1", "-pix_fmt", "yuv420p", str(webm)])
    # 反向檔必須解碼正向成品後純幀倒序，不從動畫參數重新計算。
    run(common + ["-i", str(mp4), "-vf", "reverse", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "32", "-tune", "animation", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(rev_mp4)])
    run(common + ["-i", str(mp4), "-vf", "reverse", "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "39", "-row-mt", "1", "-pix_fmt", "yuv420p", str(rev_webm)])
    return [mp4, webm, rev_mp4, rev_webm]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_receipt(outputs: list[Path], assets_dir: Path) -> Path:
    receipt = {
        "spec": {
            "width": WIDTH, "height": HEIGHT, "fps": FPS,
            "duration_seconds": DURATION, "frames": TOTAL_FRAMES,
            "slides": ["人物登場", "自動巡檢", "異常報警", "交付可驗證"],
            "reverse_source": "story.mp4 + ffmpeg reverse filter",
            "font": str(FONT_PATH),
        },
        "files": {
            path.name: {"bytes": path.stat().st_size, "sha256": sha256(path)}
            for path in outputs
        },
    }
    destination = assets_dir / "story_receipt.json"
    destination.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return destination


def verify_slide_changes(frames_dir: Path) -> None:
    midpoint_frames = [24, 72, 120, 168]
    samples = [Image.open(frames_dir / f"{index:05d}.png").convert("RGB") for index in midpoint_frames]
    try:
        for index, (before, after) in enumerate(zip(samples, samples[1:]), start=1):
            difference = ImageStat.Stat(ImageChops.difference(before, after)).mean
            mean_difference = sum(difference) / len(difference)
            print(f"VERIFY S{index}→S{index + 1}: mean absolute difference = {mean_difference:.2f}")
            if mean_difference <= 8.0:
                raise RuntimeError(f"S{index}→S{index + 1} 場景差異不足（需 > 8）")
    finally:
        for sample in samples:
            sample.close()


def main() -> int:
    if len(sys.argv) < 2:
        print("用法：python make_story.py <ffmpeg路徑> [--verify]", file=sys.stderr)
        return 2
    ffmpeg = Path(sys.argv[1])
    verify = "--verify" in sys.argv[2:]
    if not ffmpeg.is_file():
        raise FileNotFoundError(f"找不到 ffmpeg：{ffmpeg}")
    init_fonts()
    project_root = Path(__file__).resolve().parent.parent
    assets_dir = project_root / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    temp_root = Path(tempfile.mkdtemp(prefix="story_frames_"))
    try:
        print(f"生成 {TOTAL_FRAMES} 張畫格：{temp_root}")
        for frame_index in range(TOTAL_FRAMES):
            render_frame(frame_index).save(temp_root / f"{frame_index:05d}.png", optimize=False)
            if (frame_index + 1) % 48 == 0:
                print(f"  已完成 {frame_index + 1}/{TOTAL_FRAMES}")
        if verify:
            verify_slide_changes(temp_root)
        outputs = encode_videos(ffmpeg, temp_root, assets_dir)
        receipt = write_receipt(outputs, assets_dir)
        print("產出完成：")
        for path in outputs:
            print(f"  {path.name}: {path.stat().st_size:,} bytes")
        print(f"  {receipt.name}: {receipt.stat().st_size:,} bytes")
        if outputs[0].stat().st_size >= 600 * 1024:
            print("警告：story.mp4 超過 600KB 目標。", file=sys.stderr)
        if any(path.stat().st_size == 0 for path in outputs):
            raise RuntimeError("至少一個影片輸出為空檔案")
    finally:
        shutil.rmtree(temp_root, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
