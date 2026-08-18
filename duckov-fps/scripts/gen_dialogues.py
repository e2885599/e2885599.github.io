#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
【角色 R】任務劇本工程師：為 duckov-fps 的 720 條任務補齊對話樹。
【目標 O】讀 assets/missions/missions.json 每條（giver/brief/objectives/reward），
           生成三態對話樹（accept/active/complete），輸出 assets/missions/dialogues/<MID>.json，
           並於 missions.json 該條加 dialogue_ref 欄位；最終驗收 720/720 載入成功。
【限制 L】對話樹結構須相容既有 src/npc/dialogue.js 的 DialogueScript（nodes+options 跳轉）；
           不破壞既有欄位；失敗須非零退出（防假通過）。
【範例 E】對齊 npc_medic.json 的 dialogue.nodes 結構（start→lore/situation/quest/accept/farewell）。
"""
import json
import os
import sys
import hashlib
from datetime import datetime, timezone

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MISSIONS = os.path.join(BASE, "assets", "missions", "missions.json")
DIALOGUE_DIR = os.path.join(BASE, "assets", "missions", "dialogues")
RECEIPTS = os.path.join(BASE, "receipts")


def build_dialogue(m: dict) -> dict:
    """依單條任務產生三態對話樹（accept 接取/active 進行中/complete 完成）。"""
    giver = m.get("giver_name") or m.get("giver") or "委託人"
    brief = m.get("brief") or ""
    objs = m.get("objectives") or []
    if isinstance(objs, str):
        objs = [objs]
    reward = m.get("reward") or ""
    reward_xp = m.get("reward_xp") or 0
    obj_text = "；".join(map(str, objs)) if objs else "依指示行動"
    return {
        "mid": m["id"],
        "giver": m.get("giver"),
        "giver_name": giver,
        "nodes": {
            "start": {
                "text": f"{giver}：「{brief}」",
                "options": [
                    {"label": "我接下這任務", "next": "accept"},
                    {"label": "說說細節", "next": "detail"},
                    {"label": "再考慮看看", "next": "farewell"},
                ],
            },
            "detail": {
                "text": f"目標：{obj_text}。完成後回報可獲 {reward_xp} 經驗與「{reward}」。",
                "options": [
                    {"label": "接下", "next": "accept"},
                    {"label": "告辭", "next": "farewell"},
                ],
            },
            "accept": {
                "text": "（任務已記入任務板。願鴨神庇佑。）",
                "options": [{"label": "出發", "next": "active"}],
            },
            "active": {
                "text": f"任務進行中：{obj_text}。",
                "options": [{"label": "回報完成", "next": "complete"}],
            },
            "complete": {
                "text": f"幹得漂亮。這是你的酬勞：「{reward}」（{reward_xp} 經驗）。",
                "options": [],
            },
            "farewell": {
                "text": "（你轉身沒入硝煙。）",
                "options": [],
            },
        },
    }


def validate_tree(d: dict) -> bool:
    """對齊 DialogueScript 約束：start 存在、所有 next 跳轉目標存在、結束節點 options 空。"""
    nodes = d.get("nodes", {})
    if "start" not in nodes:
        return False
    for nid, node in nodes.items():
        for opt in node.get("options", []):
            if opt.get("next") not in nodes:
                return False
    return True


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def main() -> int:
    os.makedirs(DIALOGUE_DIR, exist_ok=True)
    with open(MISSIONS, "r", encoding="utf-8") as f:
        data = json.load(f)
    missions = data.get("missions", [])
    total = len(missions)
    if total == 0:
        print("[FAIL] missions.json 無任務", file=sys.stderr)
        return 2
    ok = 0
    leaves = []
    for m in missions:
        mid = m.get("id")
        if not mid:
            print("[FAIL] missions.json 缺少 id", file=sys.stderr)
            return 1
        dlg = build_dialogue(m)
        if not validate_tree(dlg):
            print(f"[FAIL] {mid} 對話樹跳轉無效", file=sys.stderr)
            return 1
        dpath = os.path.join(DIALOGUE_DIR, f"{mid}.json")
        with open(dpath, "w", encoding="utf-8", newline="\r\n") as f:
            json.dump(dlg, f, ensure_ascii=False, indent=2)
        leaves.append(sha256_file(dpath))
        m["dialogue_ref"] = f"assets/missions/dialogues/{mid}.json"
        ok += 1
    data["total"] = total
    # 回寫 missions.json（位元組層，守 CRLF 鐵律）
    with open(MISSIONS, "w", encoding="utf-8", newline="\r\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    # Merkle 收據
    sorted_leaves = sorted(leaves)
    while len(sorted_leaves) > 1:
        nxt = []
        for i in range(0, len(sorted_leaves), 2):
            a = sorted_leaves[i]
            b = sorted_leaves[i + 1] if i + 1 < len(sorted_leaves) else a
            nxt.append(hashlib.sha256((a + b).encode()).hexdigest())
        sorted_leaves = nxt
    root = sorted_leaves[0] if sorted_leaves else "EMPTY"
    os.makedirs(RECEIPTS, exist_ok=True)
    now = datetime.now(timezone.utc)
    rec = {
        "date": now.strftime("%Y-%m-%d"),
        "kind": "mission_dialogues",
        "items": ok,
        "target": total,
        "merkle_root": root,
        "leaves": len(leaves),
    }
    rpath = os.path.join(RECEIPTS, f"dialogues_{now.strftime('%Y-%m-%dT%H-%M-%SZ')}.json")
    with open(rpath, "w", encoding="utf-8", newline="\r\n") as f:
        json.dump(rec, f, ensure_ascii=False, indent=2)
    print(f"[OK] 對話樹 {ok}/{total} 條；merkle_root={root[:16]}… 收據={rpath}")
    # 防假通過：未達總數即非零退出
    return 0 if ok == total else 1


if __name__ == "__main__":
    sys.exit(main())
