# 12 大 NPC 基準 × 720 則派主角任務（含依賴圖 DAG，劇情連鎖版）
# 相對 v1 的深化：
#   - 每則任務加 requires[]：前置為「同 NPC 上一則（同 tier 或 low-1）」+「跨 NPC 低 tier 錨點」
#   - 形成跨 NPC 劇情連鎖（非僅結構調勻）
#   - 拓撲：DAG 無環、全圖可從起始態完成、跨 NPC 依賴佔比可驗收
# 用法：python tools/gen_missions.py  → assets/missions/missions.json
import os, json, random

ROOT = "D:/OODAV-MIRROR/02-STUDIO/duckov-fps"
OUT = os.path.join(ROOT, "assets/missions/missions.json")
SEED = 20260814
random.seed(SEED)

ZONES = ["鴨科夫外圍", "廢棄農場", "地下管網", "工業區", "數據中樞", "實驗設施", "高層塔樓", "鴨科夫核心"]
ENEMIES = ["鴨科夫步卒", "重裝鴨", "變種鴨", "狙擊鴨", "核心守衛", "失控機偶"]
ITEMS = ["能量電池", "加密硬碟", "醫療包", "武器藍圖", "樣本罐", "通訊模組", "反應爐芯", "基因序列"]

NPCS = [
    {"id": "armory",  "name": "軍械庫管理員", "post": "軍備調度", "voice": "把彈藥點清，別讓我找不到你的編號。"},
    {"id": "medic",   "name": "戰地醫療官",   "post": "救護調度", "voice": "傷員若倒在場外，帳就記你頭上。"},
    {"id": "analyst", "name": "情報分析員",   "post": "偵蒐調度", "voice": "數據不會騙人，但敵人會。"},
    {"id": "engineer","name": "叛逃工程師",   "post": "設施滲透", "voice": "那道門的鎖，是我當年親手装的。"},
    {"id": "captain", "name": "傭兵隊長",     "post": "清剿指揮", "voice": "打完這場，啤酒算我的——如果你還活著。"},
    {"id": "smuggler","name": "走私網節點",   "post": "物資中轉", "voice": "貨要準時到，遲一秒我就當你吞了。"},
    {"id": "coach",   "name": "狙擊教練",     "post": "精射訓練", "voice": "一發沒中，就別回靶場。"},
    {"id": "chief",   "name": "倖存者領袖",   "post": "營地民生命", "voice": "營地多一個人活，我就欠你一次。"},
    {"id": "interro","name": "審訊專家",     "post": "俘情處理", "voice": "他嘴硬，但時間不硬。"},
    {"id": "mecha",   "name": "機械維修師",   "post": "載具裝備", "voice": "齒輪壞了能修，人壞了難說。"},
    {"id": "bounty",  "name": "賞金仲裁者",   "post": "獵殺懸賞", "voice": "名單上的，活算你，死也算你。"},
    {"id": "coreai",  "name": "鴨科夫核心AI", "post": "終局滲透", "voice": "檢測到逃脫個體。建議：歸隊。"},
]
NPC_IDS = [n["id"] for n in NPCS]

KINDS = {
    "armory":  [("補給", "向{zone}運送一箱{item}，途中不得遺失。"), ("繳械", "清點{zone}的{enemy}遺留武器，全數回收。")],
    "medic":   [("救援", "在{zone}找到受困傷員，護送回營地。"), ("採樣", "從{zone}取回{item}，用於血清研製。")],
    "analyst": [("偵察", "滲入{zone}，標記{enemy}的巡邏路線。"), ("截獲", "奪取{zone}的{item}，裡面有敵方排程。")],
    "engineer":[("滲透", "潛入{zone}，關閉{enemy}的能源節點。"), ("拆解", "取回{zone}的{item}，那是核心的零件。")],
    "captain": [("清剿", "掃蕩{zone}，殲滅至少一批{enemy}。"), ("佔點", "奪下{zone}的制高點，壓制{enemy}。")],
    "smuggler":[("運輸", "把{item}從{zone}偷運出檢查哨。"), ("交接", "在{zone}與線人完成{item}交易。")],
    "coach":   [("狙殺", "在{zone}以單發擊斃{enemy}指揮官。"), ("校射", "於{zone}標定{enemy}火力點供炮擊。")],
    "chief":   [("護民", "確保{zone}的倖存者撤離路線暢通。"), ("徵集", "在{zone}蒐集{item}維持營地運轉。")],
    "interro": [("捕俘", "於{zone}活捉一名{enemy}，帶回審訊。"), ("逼供", "從{zone}的{item}解開俘虜口供線索。")],
    "mecha":   [("搶修", "在{zone}奪回一台{enemy}裝甲並啟動。"), ("運裝", "把{item}從{zone}運至維修站。")],
    "bounty":  [("獵殺", "懸賞目標現身{zone}，格殺勿論。"), ("緝拿", "於{zone}逮捕叛逃者，繳回{item}。")],
    "coreai":  [("偽派", "核心偽裝指令：誘敵至{zone}集中。"), ("採集", "回收{zone}散落{item}，供核心重組。")],
}

# 任務獎勵物資映射（依 kind 給 8 ITEMS 之一，回流基地建造資源閉環）
REWARD_BY_KIND = {
    "補給": "能量電池", "繳械": "武器藍圖", "救援": "醫療包", "採樣": "樣本罐",
    "偵察": "通訊模組", "截獲": "加密硬碟", "滲透": "反應爐芯", "拆解": "基因序列",
    "清剿": "武器藍圖", "佔點": "能量電池", "運輸": "能量電池", "交接": "通訊模組",
    "狙殺": "武器藍圖", "校射": "通訊模組", "護民": "醫療包", "徵集": "樣本罐",
    "捕俘": "醫療包", "逼供": "加密硬碟", "搶修": "反應爐芯", "運裝": "基因序列",
    "獵殺": "武器藍圖", "緝拿": "醫療包", "偽派": "反應爐芯", "採集": "基因序列",
}

def compose(npc, kind, zone, target):
    k, tmpl = kind
    text = tmpl.format(zone=zone, enemy=target if target in ENEMIES else "守軍", item=target if target in ITEMS else "物資")
    return k, f"{npc['voice']} {text}"

def main(per_npc=60):
    missions = []
    # 索引：giver -> 該 NPC 任務清單（按產生序）
    by_giver = {nid: [] for nid in NPC_IDS}
    mid = 0
    ref_counter = 0
    for ni, npc in enumerate(NPCS):
        kinds = KINDS[npc["id"]]
        made = 0; tier = 1; j = 0
        prev_id = None  # 同 NPC 上一則（縱向連鎖）
        while made < per_npc:
            kind = kinds[j % len(kinds)]
            zone = ZONES[(tier - 1) % len(ZONES)]
            target = ENEMIES[(made + j) % len(ENEMIES)] if (made + j) % 2 == 0 else ITEMS[(made + j) % len(ITEMS)]
            # 跨 NPC 引用（結構調勻，跳過自己）
            rc = ref_counter % len(NPCS)
            while rc == ni:
                ref_counter += 1; rc = ref_counter % len(NPC_IDS)
            relates = NPC_IDS[rc]; ref_counter += 1
            k, brief = compose(npc, kind, zone, target)
            mid += 1
            mid_str = f"M{mid:04d}"
            # ── 依賴建構 ──
            requires = []
            if prev_id: requires.append(prev_id)  # 縱向：同 NPC 上一則
            # 橫向跨 NPC 錨點：引用 NPC 在「更低 tier」的某則（劇情連鎖）
            # 取被引用 NPC 已產清單中 tier < 當前 tier 的最後一則
            anchor = None
            for cand in reversed(by_giver[relates]):
                if cand["tier"] < tier:
                    anchor = cand["id"]; break
            if anchor and anchor != prev_id:
                requires.append(anchor)
            missions.append({
                "id": mid_str, "giver": npc["id"], "giver_name": npc["name"], "giver_post": npc["post"],
                "tier": tier, "kind": k, "brief": brief, "relates_to": relates,
                "requires": requires, "objectives": [f"{k}：{zone}"], "reward_xp": 100 + tier * 40,
                "reward": REWARD_BY_KIND.get(k, "能量電池"),
            })
            by_giver[npc["id"]].append({"id": mid_str, "tier": tier})
            prev_id = mid_str
            made += 1; j += 1
            if j % 8 == 0: tier = min(8, tier + 1)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"total": len(missions), "npcs": NPC_IDS, "missions": missions}, f, ensure_ascii=False, indent=1)
    print("MISSIONS", len(missions))

if __name__ == "__main__":
    main()
