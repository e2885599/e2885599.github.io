# 基地基礎建設藍圖生成器：11 大類別 × 3 級，資源成本綁定任務產出物（ITEMS）
# 設計：與 missions.json 的 8 種 ITEMS 形成資源閉環（完成任務→得物資→建基地）
# 依賴：power 為基礎，其餘依層級門禁，形成 DAG（可證偽無環）
# 用法：python tools/gen_base.py  → assets/base/base.json
import os, json

ROOT = "D:/OODAV-MIRROR/02-STUDIO/duckov-fps"
OUT = os.path.join(ROOT, "assets/base/base.json")

# 任務經濟產出的 8 種物資（與 gen_missions.py ITEMS 一致）
ITEMS = ["能量電池", "加密硬碟", "醫療包", "武器藍圖", "樣本罐", "通訊模組", "反應爐芯", "基因序列"]

# 11 大基地建設類別（實際營地設施職能）
CATS = [
    {"id": "power",      "name": "發電設施", "desc": "供應全營電力，其餘設施的前置根基。",
     "visual": {"color": 16096779, "shape": "tower"}, "effect": {"type": "none"},
     "tiers": [{"cost": {"能量電池":2,"反應爐芯":1}}, {"cost": {"能量電池":4,"反應爐芯":2}}, {"cost": {"能量電池":6,"反應爐芯":4}}]},
    {"id": "supply",     "name": "補給倉庫", "desc": "擴充物資上限，支撐長期作戰。",
     "visual": {"color": 2282478, "shape": "box"}, "effect": {"type": "move_mul", "value": 1.1},
     "tiers": [{"cost": {"能量電池":1}, "requires": ["power@1"]}, {"cost": {"能量電池":2}, "requires": ["power@2"]}, {"cost": {"能量電池":3}, "requires": ["power@3"]}]},
    {"id": "armory",     "name": "軍械庫", "desc": "武器維護與彈藥產線。",
     "visual": {"color": 15680580, "shape": "box"}, "effect": {"type": "unlock_weapon", "id": "rifle"},
     "tiers": [{"cost": {"武器藍圖":1}, "requires": ["power@1"]}, {"cost": {"武器藍圖":2}, "requires": ["power@2"]}, {"cost": {"武器藍圖":3}, "requires": ["power@3"]}]},
    {"id": "medical",    "name": "醫療站", "desc": "傷員救治與血清研製。",
     "visual": {"color": 3462041, "shape": "box"}, "effect": {"type": "heal_rate", "value": 4},
     "tiers": [{"cost": {"醫療包":1,"樣本罐":1}, "requires": ["supply@1"]}, {"cost": {"醫療包":2,"樣本罐":2}, "requires": ["supply@2"]}, {"cost": {"醫療包":3,"樣本罐":3}, "requires": ["supply@3"]}]},
    {"id": "comms",      "name": "通訊塔", "desc": "對外聯絡與任務情報中繼。",
     "visual": {"color": 8490232, "shape": "tower"}, "effect": {"type": "none"},
     "tiers": [{"cost": {"通訊模組":1}, "requires": ["power@1"]}, {"cost": {"通訊模組":2}, "requires": ["power@2"]}, {"cost": {"通訊模組":3}, "requires": ["power@3"]}]},
    {"id": "scout",      "name": "偵察哨", "desc": "擴大敵情預警半徑。",
     "visual": {"color": 1357990, "shape": "box"}, "effect": {"type": "none"},
     "tiers": [{"cost": {"通訊模組":1,"武器藍圖":1}, "requires": ["comms@1"]}, {"cost": {"通訊模組":2,"武器藍圖":2}, "requires": ["comms@2"]}, {"cost": {"通訊模組":3,"武器藍圖":3}, "requires": ["comms@3"]}]},
    {"id": "training",   "name": "訓練場", "desc": "提升主角武器穩定度（降後坐）。",
     "visual": {"color": 16436245, "shape": "box"}, "effect": {"type": "recoil_mul", "value": 0.9},
     "tiers": [{"cost": {"武器藍圖":1}, "requires": ["armory@1"]}, {"cost": {"武器藍圖":2}, "requires": ["armory@2"]}, {"cost": {"武器藍圖":3}, "requires": ["armory@3"]}]},
    {"id": "water",      "name": "水處理廠", "desc": "淨水供應，降低環境耗損。",
     "visual": {"color": 3718648, "shape": "box"}, "effect": {"type": "none"},
     "tiers": [{"cost": {"樣本罐":1}, "requires": ["power@1"]}, {"cost": {"樣本罐":2}, "requires": ["power@2"]}, {"cost": {"樣本罐":3}, "requires": ["power@3"]}]},
    {"id": "research",   "name": "研究實驗室", "desc": "解讀核心AI，推進終局。",
     "visual": {"color": 10980346, "shape": "box"}, "effect": {"type": "none"},
     "tiers": [{"cost": {"加密硬碟":1,"基因序列":1}, "requires": ["power@2","comms@1"]}, {"cost": {"加密硬碟":2,"基因序列":2}, "requires": ["power@3","comms@2"]}, {"cost": {"加密硬碟":3,"基因序列":3}, "requires": ["power@3","comms@3"]}]},
    {"id": "defense",    "name": "防禦工事", "desc": "自動砲塔與護牆，減輕營地受襲。",
     "visual": {"color": 6583435, "shape": "box"}, "effect": {"type": "enemy_dmg_mul", "value": 0.9},
     "tiers": [{"cost": {"武器藍圖":1,"反應爐芯":1}, "requires": ["armory@1","supply@1"]}, {"cost": {"武器藍圖":2,"反應爐芯":2}, "requires": ["armory@2","supply@2"]}, {"cost": {"武器藍圖":3,"反應爐芯":3}, "requires": ["armory@3","supply@3"]}]},
    {"id": "extraction", "name": "逃生通道", "desc": "終局撤離點，通關鑰匙。",
     "visual": {"color": 65416, "shape": "gate"}, "effect": {"type": "win_flag"},
     "tiers": [{"cost": {"反應爐芯":2,"通訊模組":2,"基因序列":1}, "requires": ["research@1","power@2","comms@2"]}, {"cost": {"反應爐芯":3,"通訊模組":3,"基因序列":2}, "requires": ["research@2","power@3","comms@3"]}, {"cost": {"反應爐芯":5,"通訊模組":5,"基因序列":3}, "requires": ["research@3","power@3","comms@3"]}]},
]

def main():
    # 視覺欄位由單一真相源生成（消除獨立 BUILDING_META 映射表）
    VISUAL = {
        "power":      {"color": 16096779, "shape": "tower"},   # 0xf59e0b
        "supply":     {"color": 2282478,  "shape": "box"},     # 0x22d3ee
        "armory":     {"color": 15680580, "shape": "box"},     # 0xef4444
        "medical":    {"color": 3462041,  "shape": "box"},     # 0x34d399
        "comms":      {"color": 8490232,  "shape": "tower"},   # 0x818cf8
        "scout":      {"color": 1357990,  "shape": "box"},     # 0x14b8a6
        "training":   {"color": 16436245, "shape": "box"},     # 0xfacc15
        "water":      {"color": 3718648,  "shape": "box"},     # 0x38bdf8
        "research":   {"color": 10980346, "shape": "box"},     # 0xa78bfa
        "defense":    {"color": 6583435,  "shape": "box"},     # 0x64748b
        "extraction": {"color": 65416,    "shape": "gate"},    # 0x00ff88
    }
    # 校驗 requires 引用合法
    ids = {c["id"] for c in CATS}
    for c in CATS:
        c["visual"] = VISUAL.get(c["id"], {"color": 9737368, "shape": "box"})  # 0x94a3b8 預設
        for t in c["tiers"]:
            for r in t.get("requires", []):
                rc, lvl = r.split("@")
                if rc not in ids: raise ValueError("依賴類別不存在: " + r)
                if not (1 <= int(lvl) <= 3): raise ValueError("依賴層級非法: " + r)
            for item in t["cost"]:
                if item not in ITEMS: raise ValueError("成本物資不存在: " + item)
    data = {"items": ITEMS, "categories": CATS}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print("BASE", len(CATS), "類別", sum(len(c["tiers"]) for c in CATS), "級")

if __name__ == "__main__":
    main()
