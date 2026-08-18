# -*- coding: utf-8 -*-
"""Meshy 批次生成提示清單（武器/建築/植被/地形/道具/消耗品/動物/載具）。
對齊 7GB 預算拆解：每類數十隻變體。遊戲風格：duckov-fps 卡通軍事風。
"""
PROMPTS = {}

# 武器裝備（48 隻變體）
PROMPTS["weapon"] = [(f"weapon_{i:02d}",
    f"game-ready low-poly {w}, cartoon military style, single mesh glb")
    for i, w in enumerate([
        "assault rifle","sniper rifle","pistol","shotgun","smg","lmg","dmr",
        "rocket launcher","grenade launcher","flamethrower","crossbow","bow",
        "combat knife","machete","bayonet","katana","spear","hatchet","crowbar",
        "riot shield","ballistic shield","claymore mine","frag grenade","smoke grenade",
        "flashbang","c4 charge","tnt","explosive charge","landmine","trap",
        "binoculars","night vision goggles","scope","red dot sight","holo sight",
        "laser designator","ammo box","magazine","revolver","derringer",
        "double barrel shotgun","bolt action rifle","machine pistol","railgun",
        "plasma rifle","railgun pistol","energy sword","gauss rifle","coilgun",
        "mortar","atgm","manpad"
    ][:48])]

# 建築結構（67 隻變體：11 大基建 + 場景建築）
PROMPTS["structure"] = [(f"structure_{i:02d}",
    f"game-ready low-poly {b}, cartoon military base structure, single mesh glb")
    for i, b in enumerate([
        "watchtower","bunker","barracks","command post","ammo depot","fuel depot",
        "medical tent","vehicle garage","generator shack","water tower","comm tower",
        "sandbag wall","concrete barrier","hesco bastion","razor wire","tank trap",
        "firing range","training ground","bridge","gate","fence",
        "warehouse","factory","power plant","radar dome","missile silo",
        "runway","hangar","dock","pier","lighthouse",
        "fortress wall","castle keep","watchpost","outpost","forward operating base",
        "supply cache","field kitchen","latrine","shower unit","chapel",
        "prison cell","interrogation room","armory vault","weapons rack","flag pole",
        "statue","memorial","billboard","crane","scaffold",
        "prefab house","shipping container","railcar","boxcar","flatcar",
        "tunnel entrance","bunker door","blast door","airlock","elevator shaft",
        "stairwell","roof hatch","manhole","sewer grate","vent stack",
        "chimney","water pump","well","cistern","irrigation tower",
        "wind turbine","solar panel array","battery bank","transformer"
    ][:67])]

# 植被自然（38 隻變體）
PROMPTS["foliage"] = [(f"foliage_{i:02d}",
    f"game-ready low-poly {f}, cartoon military terrain vegetation, single mesh glb")
    for i, f in enumerate([
        "oak tree","pine tree","birch tree","palm tree","shrub","bush","fern",
        "grass tuft","flower patch","cactus","rock","boulder","stone","pebble",
        "fallen log","stump","mushroom","vine","ivy","moss",
        "reed","lily pad","water plant","kelp","coral","seaweed",
        "wheat","corn","barley","bush berry","thorn bush","thistle",
        "dead tree","burnt stump","ice spike","snow mound","lava rock","ash pile",
        "bamboo","banana tree","mangrove","jungle fern"
    ][:38])]

# 地形環境（48 隻變體）
PROMPTS["terrain"] = [(f"terrain_{i:02d}",
    f"game-ready low-poly {t}, cartoon military terrain tile, single mesh glb")
    for i, t in enumerate([
        "grass plain","dirt road","mud pit","sand dune","rocky cliff","mountain",
        "hill","valley","canyon","river","lake","pond","swamp","marsh",
        "snow field","ice sheet","volcano","lava flow","crater","meteor",
        "concrete plaza","asphalt road","ruined building","crater zone","trench",
        "foxhole","bunker ruin","bridge ruin","dam","levee",
        "beach","coast","cliff edge","cave","tunnel","mine shaft",
        "forest floor","jungle floor","desert floor","tundra","steppe","plateau",
        "isthmus","peninsula","island","archipelago","fjord","delta","estuary"
    ][:48])]

# 家具道具（33 隻變體）
PROMPTS["prop"] = [(f"prop_{i:02d}",
    f"game-ready low-poly {p}, cartoon military prop, single mesh glb")
    for i, p in enumerate([
        "crate","barrel","pallet","tire","oil drum","toolbox","jerry can",
        "sleeping bag","camp stool","field desk","filing cabinet","safe",
        "locker","shelf","chair","table","bed","stove","radio set",
        "periscope","map table","sandbag","barbed wire roll","cone","barrier",
        "traffic sign","warning sign","billboard","poster","flag","banner",
        "rope","chain","anchor"
    ][:33])]

# 食物消耗品（24 隻變體）
PROMPTS["consumable"] = [(f"consumable_{i:02d}",
    f"game-ready low-poly {c}, cartoon military consumable, single mesh glb")
    for i, c in enumerate([
        "water bottle","ration pack","mre box","energy bar","apple","bread",
        "medkit","bandage","pills","syringe","blood bag","first aid kit",
        "ammo magazine","shell","rocket round","grenade","smoke can","flare",
        "battery","power cell","fuel can","lubricant","cleaning kit","tool kit"
    ][:24])]

# 動物生物（24 隻變體，非鴨子）
PROMPTS["creature"] = [(f"creature_{i:02d}",
    f"game-ready low-poly {c}, cartoon animal, single mesh glb")
    for i, c in enumerate([
        "dog","cat","horse","cow","sheep","pig","chicken","goat",
        "rabbit","fox","wolf","bear","deer","boar","snake","rat",
        "crow","eagle","hawk","owl","fish","crab","frog","spider"
    ][:24])]

# 載具（24 隻變體）
PROMPTS["vehicle"] = [(f"vehicle_{i:02d}",
    f"game-ready low-poly {v}, cartoon military vehicle, single mesh glb")
    for i, v in enumerate([
        "humvee","tank","apc","jeep","truck","pickup","motorcycle","atv",
        "helicopter","fighter jet","bomber","drone","boat","speedboat","submarine",
        "hovercraft","amphibious","artillery","mortar carrier","rocket truck",
        "train","railcar","bicycle","snowmobile"
    ][:24])]
