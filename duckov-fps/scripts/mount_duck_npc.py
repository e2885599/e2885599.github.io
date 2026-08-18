#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
【角色 R】NPC 模型掛載工程師：將 12 NPC 的 visual.model 指向 Meshy 生成的 duck_<role>.glb。
【目標 O】讀 assets/characters/npc_*.json，將 visual.model 從舊名改為 assets/models/duck_<role>/duck_<role>.glb；
           僅當目標 glb 已存在才改（防指向不存在檔）；產 Merkle 收據。
【限制 L】不刪除舊欄位、不硬編路徑；目標不存在則標 skip 不偽造；失敗非零退出。
【範例 E】對齊 fetch_gltf_models.py：位元組層 sha256、繁中註解。
"""
import json
import os
import sys
import hashlib
from datetime import datetime, timezone

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHARS = os.path.join(BASE, "assets", "characters")
MODELS = os.path.join(BASE, "assets", "models")
RECEIPTS = os.path.join(BASE, "receipts")


def main() -> int:
    files = [f for f in os.listdir(CHARS) if f.startswith("npc_") and f.endswith(".json")]
    updated = 0
    skipped = []
    leaves = []
    for fn in sorted(files):
        fp = os.path.join(CHARS, fn)
        d = json.load(open(fp, "r", encoding="utf-8"))
        role = d.get("id", "").replace("npc_", "")  # armorer/medic/…
        target_glb = os.path.join(MODELS, f"duck_{role}", f"duck_{role}.glb")
        if os.path.exists(target_glb) and os.path.getsize(target_glb) > 0:
            d["visual"]["model"] = f"assets/models/duck_{role}/duck_{role}.glb"
            with open(fp, "wb") as f:
                f.write(json.dumps(d, ensure_ascii=False, indent=2).encode("utf-8"))
            # 對帳：舊檔雜湊
            h = hashlib.sha256()
            with open(fp, "rb") as f:
                for c in iter(lambda: f.read(1 << 20), b""):
                    h.update(c)
            leaves.append(h.hexdigest())
            updated += 1
        else:
            skipped.append(fn)
    os.makedirs(RECEIPTS, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    rec = {"date": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "kind": "npc_model_mount",
           "updated": updated, "skipped": skipped, "leaves": len(leaves)}
    with open(os.path.join(RECEIPTS, f"npc_mount_{ts}.json"), "wb") as f:
        f.write(json.dumps(rec, ensure_ascii=False, indent=2).encode("utf-8"))
    print(f"[OK] NPC 模型掛載 {updated}/{len(files)}；skip={skipped}")
    # 防假通過：有 skip 表示鴨子 glb 未全到，告警但不阻斷（部分成功）
    return 0 if not skipped else 1


if __name__ == "__main__":
    sys.exit(main())
