# -*- coding: utf-8 -*-
"""純標準庫 mp3 時長解析（CBR/VBR 通用），無外部依賴。
對齊「不裝未驗證 exe/套件」原則。"""
import struct

def mp3_duration_seconds(path):
    with open(path, "rb") as f:
        data = f.read()
    # 找第一個 MPEG 音訊幀同步位元組 0xFF Ex (E=0b1110)
    i = 0
    n = len(data)
    while i + 4 < n:
        if data[i] == 0xFF and (data[i+1] & 0xE0) == 0xE0:
            break
        i += 1
    if i + 4 >= n:
        raise ValueError("找不到 MPEG 幀")
    b0, b1, b2, b3 = data[i], data[i+1], data[i+2], data[i+3]
    # 取樣率索引
    sr_idx = (b2 >> 2) & 0x03
    SR = {0: 44100, 1: 48000, 2: 32000, 3: None}[sr_idx]
    if SR is None:
        raise ValueError("保留取樣率")
    # 層 (b1 低 2 位) 應為 11 = Layer III
    layer = (b1 >> 1) & 0x03
    # 位元率索引
    br_idx = (b2 >> 4) & 0x0F
    # 檢查 Xing/Info 頭（VBR）
    # 幀頭後跳 side info (Layer III: MPEG1=32B, MPEG2/2.5=17B)
    mpeg1 = (b1 & 0x08) != 0  # b1 bit3 = 0x08 → version bit
    # b1: 000XXXXX; bit3 (0x08) = MPEG version (1 if set? 實際 bit 3 = 0 表示 MPEG1)
    # 準確：b1 第 4 位 (從 0 起 bit3) = version: 11=MPEG1,10=MPEG2,00=MPEG2.5
    ver_bits = (b1 >> 3) & 0x03
    mpeg1 = (ver_bits == 0b11)
    side = 32 if mpeg1 else 17
    xing_off = i + 4 + side
    tag = data[xing_off:xing_off+4]
    if tag in (b"Xing", b"Info"):
        # 找 frames 欄位（4 位元組標誌後依序 num_frames 等）
        flags = struct.unpack(">I", data[xing_off+4:xing_off+8])[0]
        # 標誌 bit: 0x0001=frames, 0x0002=bytes, 0x0004=toc, 0x0008=quality
        off = xing_off + 8
        if flags & 0x0001:
            frames = struct.unpack(">I", data[off:off+4])[0]
            off += 4
        if flags & 0x0002:
            bytes_ = struct.unpack(">I", data[off:off+4])[0]
            off += 4
        # 計算每幀樣本數：MPEG1 LayerIII = 1152, MPEG2/2.5 = 576
        spf = 1152 if mpeg1 else 576
        dur = frames * spf / SR
        return dur
    # CBR：用位元率表
    # MPEG1 Layer III bitrates
    if mpeg1:
        BR = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0]
    else:
        BR = [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0]
    br = BR[br_idx]
    if br == 0:
        raise ValueError("free bitrate 不支援")
    # 檔案去掉 ID3 後的純音訊大小
    audio_start = i
    # 粗略：用檔案總長減去 audio_start
    dur = (n - audio_start) * 8 / (br * 1000)
    return dur

if __name__ == "__main__":
    import sys
    for p in sys.argv[1:]:
        try:
            d = mp3_duration_seconds(p)
            print(f"{p}: {d:.3f}s")
        except Exception as e:
            print(f"{p}: ERROR {e}")
