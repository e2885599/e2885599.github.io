# -*- coding: utf-8 -*-
"""全量 TTS 合成：13 章英文 → 13 段 mp3（女性溫和聲線，隨意隨機選）。
輸出：
  audio/ch<NN>.mp3        每段音訊
  audio_manifest.json     每段 {idx, file, duration_sec, voice, start_sec, end_sec}
對帳：每段 duration 由 mp3_dur.py 解析（容器時長，與瀏覽器 <audio> 一致）。
"""
import asyncio, os, json, random, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("mp3_dur", os.path.join(HERE, "mp3_dur.py"))
md = importlib.util.module_from_spec(spec); spec.loader.exec_module(md)

# 溫和女聲候選（依公認柔和/平緩特質篩選，非 edge-tts 標註）
GENTLE_FEMALE = [
    "en-GB-SoniaNeural", "en-US-AriaNeural", "en-US-JennyNeural", "en-US-EmmaNeural",
    "en-AU-NatashaNeural", "en-GB-LibbyNeural", "en-IE-EmilyNeural", "en-CA-ClaraNeural",
    "en-NZ-MollyNeural", "en-GB-MaisieNeural", "en-US-MichelleNeural", "en-US-AnaNeural",
    "en-SG-LunaNeural", "en-PH-RosaNeural",
]

import re
# subtitles.js 是瀏覽器腳本（window.SUBTITLES=...），提取 JSON 部分
js_txt = open(os.path.join(HERE, "subtitles.js"), encoding="utf-8").read()
m = re.search(r"window\.SUBTITLES\s*=\s*(\{.*?\});\s*\n", js_txt, re.S)
if not m:
    raise RuntimeError("無法從 subtitles.js 提取 SUBTITLES JSON")
CHAPTERS = json.loads(m.group(1))["chapters"]

async def synth_one(voice, text, out):
    import edge_tts
    comm = edge_tts.Communicate(text, voice)
    buf = b""
    async for msg in comm.stream():
        if msg["type"] == "audio":
            buf += msg["data"]
    with open(out, "wb") as f:
        f.write(buf)

async def main():
    # 隨意隨機選聲線（以當前時間為種子，每次執行可能不同）
    random.seed()
    voice = random.choice(GENTLE_FEMALE)
    audio_dir = os.path.join(HERE, "audio")
    os.makedirs(audio_dir, exist_ok=True)

    manifest = []
    cumulative = 0.0
    for i, ch in enumerate(CHAPTERS):
        idx = f"ch{i:02d}"
        out = os.path.join(audio_dir, f"{idx}.mp3")
        text = ch["en"]
        await synth_one(voice, text, out)
        dur = md.mp3_duration_seconds(out)
        manifest.append({
            "idx": idx, "file": f"audio/{idx}.mp3",
            "voice": voice, "duration_sec": round(dur, 3),
            "start_sec": round(cumulative, 3),
            "end_sec": round(cumulative + dur, 3),
            "title_zh": ch["title_zh"], "title_en": ch["title_en"],
        })
        cumulative += dur
        print(f"  {idx} 合成完成: {dur:.2f}s  ({ch['title_zh']})")

    man_path = os.path.join(HERE, "audio_manifest.json")
    with open(man_path, "w", encoding="utf-8") as f:
        json.dump({"voice": voice, "total_sec": round(cumulative, 3),
                   "chapters": manifest}, f, ensure_ascii=False, indent=2)
    print(f"\n聲線（隨機選）: {voice}")
    print(f"總時長: {cumulative:.2f}s")
    print(f"清單: {man_path}")

asyncio.run(main())
