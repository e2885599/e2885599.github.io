#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
【角色 R】Meshy 文本轉3D 下載工程師：為 duckov-fps 生成遊戲資產（主力源）。
【目標 O】依提示清單 POST /v2/text-to-3d 建任務 → 輪詢 GET /v2/text-to-3d/<id> 至 SUCCEEDED
           → 下載 model_urls.glb 到 assets/models/<name>/<name>.glb；產 Merkle 收據。
【限制 L】密鑰只讀 os.environ['MESHY_API_KEY']（經 .env 注入，絕不硬編）；
           下載失敗/輪詢逾時即非零退出（防假通過）；外部源僅 api.meshy.ai（官方）。
【範例 E】對齊 fetch_gltf_models.py：位元組層 sha256、繁中註解、subprocess 不用。
【實測校正】技能原版 endpoint /v1 錯誤（404）；真實為 /v2，且建任務需 mode 欄位。
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
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "models")
RECEIPTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "receipts")
POLL_SECONDS = 15
MAX_POLLS = 80  # 80*15s = 20min 上限（preview 模式約數分鐘）


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
    req = urllib.request.Request(f"{MESHY_BASE}/v2/text-to-3d",
                                 data=json.dumps({"prompt": prompt, "mode": mode,
                                                  "art_style": "realistic", "target_polycount": 20000}).encode(),
                                 headers=hdr, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["result"]  # task_id


def poll_task(task_id):
    api_key = os.environ["MESHY_API_KEY"]
    hdr = {"Authorization": f"Bearer {api_key}"}
    for _ in range(MAX_POLLS):
        time.sleep(POLL_SECONDS)
        with urllib.request.urlopen(urllib.request.Request(f"{MESHY_BASE}/v2/text-to-3d/{task_id}", headers=hdr), timeout=60) as r:
            j = json.load(r)
        st = j.get("status")
        if st == "SUCCEEDED":
            return j.get("model_urls", {}).get("glb")
        if st == "FAILED":
            raise RuntimeError(f"Meshy 任務失敗: {j.get('task_error')}")
    raise RuntimeError("Meshy 輪詢逾時")


def generate(name, prompt, mode="preview"):
    out_dir = os.path.join(OUT, name)
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, f"{name}.glb")
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest  # 冪等
    tid = create_task(prompt, mode)
    print(f"  [{name}] 任務 {tid[:8]}…", flush=True)
    url = poll_task(tid)
    if not url:
        raise RuntimeError(f"[{name}] 無 glb url")
    if not http_download(url, dest):
        raise RuntimeError(f"[{name}] 下載失敗")
    return dest


def main():
    # 12 鴨子 NPC 提示（對齊 npc_*.json 角色）
    prompts = {
        "duck_armorer": "cartoon duck character, military armorer with welding gear, game-ready low-poly",
        "duck_mechanic": "cartoon duck character, mechanic with wrench and goggles, game-ready low-poly",
        "duck_sentry": "cartoon duck character, sniper sentry with rifle, game-ready low-poly",
        "duck_medic": "cartoon duck character, combat medic with medical backpack, game-ready low-poly",
        "duck_commander": "cartoon duck character, squad commander with helmet and map, game-ready low-poly",
        "duck_comms": "cartoon duck character, radio operator with antenna, game-ready low-poly",
        "duck_drill": "cartoon duck character, drill sergeant with whistle, game-ready low-poly",
        "duck_engineer": "cartoon duck character, combat engineer with explosives, game-ready low-poly",
        "duck_guide": "cartoon duck character, scout guide with binoculars, game-ready low-poly",
        "duck_hydro": "cartoon duck character, underwater operations duck with rebreather, game-ready low-poly",
        "duck_quartermaster": "cartoon duck character, quartermaster with supply crate, game-ready low-poly",
        "duck_intel": "cartoon duck character, intelligence officer with dossier, game-ready low-poly",
    }
    if "MESHY_API_KEY" not in os.environ:
        print("[FAIL] 缺少 MESHY_API_KEY 環境變數", file=sys.stderr)
        return 2
    ok = 0
    leaves = []
    fails = []
    for name, prompt in prompts.items():
        try:
            dest = generate(name, prompt)
            leaves.append(sha256_file(dest))
            ok += 1
            print(f"[OK] {name}.glb ({os.path.getsize(dest)} bytes)")
        except Exception as e:
            fails.append((name, str(e)))
            print(f"[FAIL] {name}: {e}", file=sys.stderr)
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
    rec = {"date": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "kind": "meshy_duck_npc",
           "items": ok, "target": len(prompts), "merkle_root": root, "leaves": len(leaves),
           "fails": [f[0] for f in fails]}
    with open(os.path.join(RECEIPTS, f"meshy_duck_{ts}.json"), "wb") as f:
        f.write(json.dumps(rec, ensure_ascii=False, indent=2).encode("utf-8"))
    print(f"[收據] {ok}/{len(prompts)} merkle_root={root[:16]}…")
    return 0 if ok == len(prompts) else 1


if __name__ == "__main__":
    sys.exit(main())
