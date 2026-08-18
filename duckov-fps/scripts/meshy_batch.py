#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
【角色 R】Meshy 批次資產工程師：依 7GB 預算生成遊戲資產變體（武器/建築/植被/地形/道具/消耗品/動物/載具）。
【目標 O】讀 PROMPTS（類別→提示清單），串行建任務 POST /v2/text-to-3d → 輪詢 → 下載 glb 到
           assets/models/<category>/<name>.glb；Merkle 收據；目標逼近 7GB。
【限制 L】密鑰只讀 os.environ['MESHY_API_KEY']（絕不硬編）；串行+間隔避免限流；失敗非零退出（防假通過）。
【範例 E】對齊 meshy_duck_npc.py：位元組層 sha256、繁中註解。
【實測校正】endpoint=/v2/text-to-3d，建任務需 mode 欄位；preview 模式約 30-90s/隻。
"""
import json
import os
import sys
import time
import hashlib
import urllib.request
import urllib.error
from datetime import datetime, timezone

MESHY_BASE = "https://api.meshy.ai"
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "models")
RECEIPTS = os.path.join(BASE, "receipts")
POLL_SECONDS = 15
MAX_POLLS = 80
TARGET_GB = 7
INTERVAL = 2  # 任務間間隔秒

# PROMPTS 由同目錄 prompts_part.py 注入（避免單檔過大）
from prompts_part import PROMPTS  # noqa


def http_download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "duckov-fps-meshy/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            if r.status != 200:
                return False
            data = r.read()
    except Exception:
        return False
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(data)
    return True


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def create_task(prompt, mode="preview"):
    api_key = os.environ["MESHY_API_KEY"]
    hdr = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        req = urllib.request.Request(f"{MESHY_BASE}/v2/text-to-3d",
                                     data=json.dumps({"prompt": prompt, "mode": mode,
                                                      "art_style": "realistic", "target_polycount": 15000}).encode(),
                                     headers=hdr, method="POST")
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)["result"]
    except urllib.error.HTTPError as e:
        if e.code == 402:
            raise RuntimeError("PAYMENT_REQUIRED")  # 餘額耗盡硬邊界，立即停止整批
        raise


def poll_task(tid):
    api_key = os.environ["MESHY_API_KEY"]
    hdr = {"Authorization": f"Bearer {api_key}"}
    for _ in range(MAX_POLLS):
        time.sleep(POLL_SECONDS)
        with urllib.request.urlopen(urllib.request.Request(f"{MESHY_BASE}/v2/text-to-3d/{tid}", headers=hdr), timeout=60) as r:
            j = json.load(r)
        if j.get("status") == "SUCCEEDED":
            return j.get("model_urls", {}).get("glb")
        if j.get("status") == "FAILED":
            raise RuntimeError(f"失敗: {j.get('task_error')}")
    raise RuntimeError("輪詢逾時")


def generate(cat, name, prompt):
    out_dir = os.path.join(OUT, cat)
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, f"{name}.glb")
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest, "skip"
    tid = create_task(prompt)
    url = poll_task(tid)
    if not url or not http_download(url, dest):
        raise RuntimeError(f"{name} 下載失敗")
    return dest, "new"


def main():
    if "MESHY_API_KEY" not in os.environ:
        print("[FAIL] 缺 MESHY_API_KEY", file=sys.stderr)
        return 2
    ok = 0
    leaves = []
    fails = []
    try:
        for cat, items in PROMPTS.items():
            for name, prompt in items:
                try:
                    dest, st = generate(cat, name, prompt)
                except RuntimeError as e:
                    if "PAYMENT_REQUIRED" in str(e):
                        raise  # 透傳到外層停止整批
                    fails.append((cat, name, str(e)))
                    print(f"[FAIL] {cat}/{name}: {e}", file=sys.stderr, flush=True)
                    continue
                except Exception as e:
                    fails.append((cat, name, str(e)))
                    print(f"[FAIL] {cat}/{name}: {e}", file=sys.stderr, flush=True)
                    continue
                leaves.append(sha256_file(dest))
                ok += 1
                sz = os.path.getsize(dest)
                print(f"[{'OK' if st=='new' else 'SKIP'}] {cat}/{name}.glb {sz}b", flush=True)
            time.sleep(INTERVAL)
            # 達 7GB 預算即停（含已生成 + 既有）
            total_bytes = 0
            for root, _, files in os.walk(OUT):
                for fn in files:
                    if fn.endswith(".glb"):
                        total_bytes += os.path.getsize(os.path.join(root, fn))
            if total_bytes >= TARGET_GB * 1024 ** 3:
                print(f"[STOP] 已逼近 {TARGET_GB}GB 預算 ({total_bytes/1024**3:.2f}GB)，停止生成")
                return 0
    except RuntimeError as e:
        if "PAYMENT_REQUIRED" in str(e):
            print("[STOP] Meshy 餘額耗盡 (402)，停止整批生成。已生成部分保留。", file=sys.stderr)
            return 3
        else:
            raise
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
    rec = {"date": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "kind": "meshy_batch",
           "items": ok, "fails": [f[0] + "/" + f[1] for f in fails], "merkle_root": root,
           "leaves": len(leaves)}
    with open(os.path.join(RECEIPTS, f"meshy_batch_{ts}.json"), "wb") as f:
        f.write(json.dumps(rec, ensure_ascii=False, indent=2).encode("utf-8"))
    print(f"[收據] {ok} 成功 / {len(fails)} 失敗；merkle_root={root[:16]}…")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
