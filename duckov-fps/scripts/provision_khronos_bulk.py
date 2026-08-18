#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
【角色 R】資產運維工程師：將 Khronos 全量免費 glb（120 個）鋪設進 duckov-fps 資產庫。
【目標 O】從 _vendor_src/khronos_models/Models/<Name>/glTF-Binary/<Name>.glb 複製到
           assets/models/<Name>/<Name>.glb（扁平化、對齊既 21 項結構）；產 manifest + Merkle 收據。
【限制 L】僅本機已 clone 的官方 CC0/MIT 源（非短網址/非 exe）；冪等（已存在跳過）；失敗非零退出。
【範例 E】對齊 fetch_gltf_models.py：位元組層 sha256、繁中註解、subprocess 不用。
"""
import json
import os
import sys
import hashlib
import shutil
from datetime import datetime, timezone

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "_vendor_src", "khronos_models", "Models")
OUT = os.path.join(BASE, "assets", "models")
RECEIPTS = os.path.join(BASE, "receipts")


def sha256_file(p: str) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def main() -> int:
    if not os.path.isdir(SRC):
        print(f"[FAIL] 來源目錄不存在: {SRC}", file=sys.stderr)
        return 2
    os.makedirs(OUT, exist_ok=True)
    models = [d for d in os.listdir(SRC) if os.path.isdir(os.path.join(SRC, d))]
    ok = 0
    leaves = []
    copied = 0
    for name in sorted(models):
        src_glb = os.path.join(SRC, name, "glTF-Binary", f"{name}.glb")
        if not os.path.exists(src_glb):
            continue
        dst_dir = os.path.join(OUT, name)
        os.makedirs(dst_dir, exist_ok=True)
        dst = os.path.join(dst_dir, f"{name}.glb")
        # 冪等：已存在且大小一致則跳過
        if os.path.exists(dst) and os.path.getsize(dst) == os.path.getsize(src_glb):
            pass
        else:
            shutil.copy2(src_glb, dst)
            copied += 1
        leaves.append(sha256_file(dst))
        ok += 1
    # Merkle 收據
    sl = sorted(leaves)
    while len(sl) > 1:
        nxt = []
        for i in range(0, len(sl), 2):
            a = sl[i]
            b = sl[i + 1] if i + 1 < len(sl) else a
            nxt.append(hashlib.sha256((a + b).encode()).hexdigest())
        sl = nxt
    root = sl[0] if sl else "EMPTY"
    os.makedirs(RECEIPTS, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    rec = {"date": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "kind": "khronos_bulk",
           "items": ok, "copied": copied, "merkle_root": root, "leaves": len(leaves)}
    with open(os.path.join(RECEIPTS, f"khronos_bulk_{ts}.json"), "wb") as f:
        f.write(json.dumps(rec, ensure_ascii=False, indent=2).encode("utf-8"))
    # 更新 manifest（合併既有）
    man_path = os.path.join(OUT, "manifest.json")
    manifest = {"generated_at": datetime.now(timezone.utc).isoformat(), "source": "Khronos+Meshy", "models": []}
    if os.path.exists(man_path):
        try:
            manifest = json.load(open(man_path, "r", encoding="utf-8"))
        except Exception:
            pass
    manifest["models"] = sorted(os.listdir(OUT))
    manifest["generated_at"] = datetime.now(timezone.utc).isoformat()
    with open(man_path, "wb") as f:
        f.write(json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"))
    print(f"[OK] Khronos 鋪設 {ok} 個 glb（新複製 {copied}）；merkle_root={root[:16]}…")
    # 防假通過
    return 0 if ok >= 100 else 1


if __name__ == "__main__":
    sys.exit(main())
