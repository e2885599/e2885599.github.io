#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解析 notes/inception-transcript.srt → 產出：
  1) notes/inception-transcript-clean.txt  —— 清洗後可讀全文（句子級，雙換行分隔）
  2) notes/inception-meta.json             —— 對帳收據（sha256 / 字數 / 句數 / 時長）
設計目標：容忍轉錄軟體產生的壞時間碼（如 00:35.00.000），
           不丢幀、不崩潰，輸出可供 Merkle 對帳的穩定雜湊。
作者：遙遙（Hermes agent）｜2026-08-18
"""
import os, re, json, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "notes", "inception-transcript.srt")
OUT_TXT = os.path.join(ROOT, "notes", "inception-transcript-clean.txt")
OUT_META = os.path.join(ROOT, "notes", "inception-meta.json")

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def parse_tc(tc):
    """容忍 HH:MM:SS,mmm / HH:MM.SS.mmm / MM:SS.mmm 等變體。回傳秒數或 None。"""
    tc = tc.strip().replace(",", ".")
    toks = [t for t in re.split(r"[:.]", tc) if t != ""]
    try:
        if len(toks) >= 4:
            h, m, s, ms = int(toks[0]), int(toks[1]), int(toks[2]), int(toks[3].ljust(3, "0")[:3])
        elif len(toks) == 3:
            h, m, s, ms = 0, int(toks[0]), int(toks[1]), int(toks[2].ljust(3, "0")[:3])
        elif len(toks) == 2:
            h, m, s, ms = 0, int(toks[0]), int(toks[1]), 0
        else:
            return None
        return h * 3600 + m * 60 + s + ms / 1000.0
    except Exception:
        return None

def parse_srt(text):
    """回傳 [(start, end, text), ...] 清掉空檔。"""
    raw = re.split(r"\r?\n\r?\n", text.strip())
    cues = []
    for block in raw:
        lines = [l for l in block.splitlines() if l.strip() != ""]
        if len(lines) < 2:
            continue
        # 找時間軸行（含 -->）
        tcline = None
        tci = -1
        for i, l in enumerate(lines):
            if "-->" in l:
                tcline = l; tci = i; break
        if tcline is None:
            continue
        parts = tcline.split("-->")
        if len(parts) != 2:
            continue
        start = parse_tc(parts[0])
        end = parse_tc(parts[1])
        if start is None or end is None:
            continue
        body = " ".join(lines[tci + 1:]).strip()
        if not body:
            continue
        cues.append((start, end, body))
    return cues

def clean_text(body):
    """去 [music] / [__]（遮罩穢語）/ 行首 >>（銀幕字幕標記），正規化空白。"""
    body = re.sub(r"\[music\]", "", body, flags=re.I)        # 音樂提示
    body = re.sub(r"\[[\s_]*\]", "", body)                    # 遮罩穢語 [ __ ] 等
    body = re.sub(r"^>>\s*", "", body)                        # 銀幕字幕標記
    body = re.sub(r"\s+", " ", body).strip()
    return body

def main():
    with open(SRC, "r", encoding="utf-8") as f:
        raw_text = f.read()
    src_sha = sha256_file(SRC)
    cues = parse_srt(raw_text)
    # 全文字串（依時間序串接，用空格）
    full = " ".join(clean_text(c[2]) for c in cues)
    # 切句：以 . ? ! 後的空白為界；保留標點
    sentences = re.split(r"(?<=[.!?])\s+", full)
    sentences = [s.strip() for s in sentences if s.strip()]
    # 輸出可讀全文：句子雙換行
    clean_prose = "\n\n".join(sentences)
    with open(OUT_TXT, "wb") as f:
        f.write(clean_prose.encode("utf-8"))
    clean_sha = hashlib.sha256(clean_prose.encode("utf-8")).hexdigest()

    duration = max((c[1] for c in cues), default=0.0)
    word_count = len(full.split())
    char_count = len(full)
    meta = {
        "source_srt": "notes/inception-transcript.srt",
        "source_sha256": src_sha,
        "clean_sha256": clean_sha,
        "duration_sec": round(duration, 3),
        "duration_hms": "%02d:%02d:%02d" % (int(duration // 3600), int((duration % 3600) // 60), int(duration % 60)),
        "cue_count": len(cues),
        "sentence_count": len(sentences),
        "word_count": word_count,
        "char_count": char_count,
    }
    with open(OUT_META, "wb") as f:
        f.write(json.dumps(meta, ensure_ascii=False, indent=2).encode("utf-8"))
    print("OK parse_inception_transcript")
    print(json.dumps(meta, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
