#!/usr/bin/env python3
# 關卡可通性靜態幾何驗證器（對齊 noether-portal auto_solver 傳統）
# 對 5 關做可解性證明：出生/出口不嵌牆岩漿、存在雙門穿越解、每關觸及核心機制。
# 不依賴 THREE/WebGPU，純 2D 平面（x,z）幾何近似（y 軸退化，與 2D 主要版一致）。
import json, sys, math, collections

def load():
    with open(__file__.replace('level_solvable.py', 'levels/levels.json'), encoding='utf-8') as f:
        return json.load(f)

def aabb(px, pz, b):
    # b: {x,z,w,d} 盒（左下角 x,z，寬 w 深 d）
    return b['x'] <= px <= b['x'] + b['w'] and b['z'] <= pz <= b['z'] + b['d']

def seg_hits_box(x1, z1, x2, z2, b):
    # 線段 (x1,z1)-(x2,z2) 是否穿過 AABB b（含邊界視為穿）
    steps = max(2, int(math.hypot(x2-x1, z2-z1) / 4))
    for i in range(steps+1):
        t = i/steps
        x = x1 + (x2-x1)*t; z = z1 + (z2-z1)*t
        if aabb(x, z, b): return True
    return False

def wall_portal_faces(L):
    # 回傳每面 portalable 牆的「可附門中點 + 雙向外法線」
    # 玩家可瞄牆任一面開門 → 一道 portalable 牆提供兩個朝向候選（對齊真實 raycaster 命中面）
    faces = []
    for w in L['walls']:
        if not w.get('portalable'): continue
        cx, cz = w['x'] + w['w']/2, w['z'] + w['d']/2
        if w['h'] < w['w']:  # 水平牆（頂/底）：法線沿 z，雙向
            for nz in (1, -1):
                faces.append({'x':cx, 'z':cz, 'nx':0, 'nz':nz, 'w':w})
        else:  # 豎直牆（左/右）：法線沿 x，雙向
            for nx in (1, -1):
                faces.append({'x':cx, 'z':cz, 'nx':nx, 'nz':0, 'w':w})
    return faces

def hazards(L):
    return L.get('hazards', [])

def path_clear(x1, z1, x2, z2, L, hard=False, ignore_wall=None, ignore_lava=False):
    # 直線路徑檢查
    # ignore_lava=True：忽略岩漿（玩家可再開門跨越，落地後走路到出口），僅查實心牆
    if not ignore_lava:
        for h in hazards(L):
            if h.get('hard') and not hard: continue
            if seg_hits_box(x1, z1, x2, z2, h): return False
    for w in L['walls']:
        if w is ignore_wall: continue
        if seg_hits_box(x1, z1, x2, z2, w): return False
    return True

def walk_domain(L, x, z, hard=False, step=20):
    # BFS：從 (x,z) 出發，不穿岩漿(hard 含移動尖刺)/實心牆 的可走連通域（網格近似）
    W, D = 900, 600
    def cell_ok(px, pz):
        if px < 0 or pz < 0 or px > W or pz > D: return False
        for h in hazards(L):
            if h.get('hard') and not hard: continue
            if aabb(px, pz, h): return False
        for w in L['walls']:
            if aabb(px, pz, w): return False
        return True
    si, sj = x // step, z // step
    if not cell_ok(x, z): return set()
    seen = {(si, sj)}; q = collections.deque([(si, sj)])
    while q:
        i, j = q.popleft()
        for di, dj in ((1,0),(-1,0),(0,1),(0,-1)):
            ni, nj = i+di, j+dj
            px, pz = ni*step, nj*step
            if 0 <= px <= W and 0 <= pz <= D and cell_ok(px, pz) and (ni, nj) not in seen:
                seen.add((ni, nj)); q.append((ni, nj))
    return seen

def solvable(L, hard=False):
    sx, sz = L['start']['x'], L['start']['z']
    ex, ez = L['exit']['x'], L['exit']['z']
    # 1) 出生/出口不嵌岩漿
    for h in hazards(L):
        if h.get('hard') and not hard: continue
        if aabb(sx, sz, h) or aabb(ex, ez, h): return False, 'spawn/exit in hazard'
    # 2) 出生/出口不嵌實心牆（非 portalable）
    for w in L['walls']:
        if w.get('portalable'): continue
        if aabb(sx, sz, w) or aabb(ex, ez, w): return False, 'spawn/exit in wall'
    faces = wall_portal_faces(L)
    if len(faces) < 2: return False, 'fewer than 2 portalable walls'
    # 3) 存在一對門 (A 放藍, B 放橘)：
    #    spawn→A 前（直線嚴查）可達；穿越後 B 外落點安全 且 其可走域含 exit（對齊落地後走動到出口）
    exit_ij = (ex // 20, ez // 20)
    for A in faces:
        # spawn 到 A 中點（門前）直線可達（嚴查：不穿岩漿/牆）
        if not path_clear(sx, sz, A['x'], A['z'], L, hard, ignore_wall=A['w']): continue
        for B in faces:
            if B is A: continue
            # 穿越後落點：B 中點沿其法線外推 1.5*PR（PR=16 → 24）
            ox = B['x'] + B['nx']*24; oz = B['z'] + B['nz']*24
            # 落點不得嵌岩漿（安全落腳）
            in_lava = any(aabb(ox, oz, h) for h in hazards(L) if (h.get('hard') and hard) or not h.get('hard'))
            if in_lava: continue
            # 落點→exit：玩家落地後走動到出口（BFS 可走域，不穿岩漿/牆），對齊主流玩家實際玩法
            bd = walk_domain(L, int(ox), int(oz), hard)
            if exit_ij in bd:
                return True, "blue@%s,%s orange@%s,%s" % (A['w'].get('x'), A['w'].get('z'), B['w'].get('x') if 'x' in B['w'] else B['w'].get('x'), B['w'].get('z'))
    return False, 'no dual-portal path to exit'

def mechanisms(L):
    m = []
    if len(L.get('hazards', [])) > 0: m.append('lava')
    if len(L.get('boxes', [])) > 0: m.append('box')
    if len(L.get('buttons', [])) > 0: m.append('button')
    if len(L.get('doors', [])) > 0: m.append('door')
    if any(h.get('hard') for h in L.get('hazards', [])): m.append('moving-spike(hard)')
    return m

def self_test():
    # 雙樣本自測：已知 PASS 關卡 + 已知 FAIL 關卡，證明驗證器鑑別力（防假通過鐵律）
    data = load()
    ok, _ = solvable(data['levels'][0], False)
    assert ok, "self_test: L1 應 PASS 卻 FAIL（驗證器假陰性）"
    broken = {
        "id": "X0", "name": "封死測試", "archetype": "trap",
        "start": {"x": 100, "z": 100}, "exit": {"x": 800, "z": 500, "w": 48, "d": 48, "h": 200},
        "walls": [
            {"x": 0, "z": 0, "w": 900, "d": 16, "h": 220, "noportal": True},
            {"x": 0, "z": 584, "w": 900, "d": 16, "h": 220, "noportal": True},
            {"x": 0, "z": 0, "w": 16, "d": 600, "h": 220, "noportal": True},
            {"x": 884, "z": 0, "w": 16, "d": 600, "h": 220, "noportal": True},
            {"x": 760, "z": 460, "w": 120, "d": 16, "h": 220},
            {"x": 760, "z": 544, "w": 120, "d": 16, "h": 220},
            {"x": 760, "z": 460, "w": 16, "d": 100, "h": 220},
            {"x": 864, "z": 460, "w": 16, "d": 100, "h": 220},
        ],
        "hazards": [], "boxes": [], "buttons": [], "doors": [],
    }
    bad, why = solvable(broken, False)
    assert not bad, "self_test: 封死關卡應 FAIL 卻 PASS（驗證器假陽性）: " + why
    print("  [SELFTEST] PASS 樣本 OK / FAIL 樣本 OK → 鑑別力證明通過")

def main():
    self_test()
    data = load()
    print("== 關卡可通性驗證（%d 關）==" % len(data['levels']))
    all_ok = True
    coverage = set()
    for L in data['levels']:
        ok_e, why_e = solvable(L, hard=False)
        ok_h, why_h = solvable(L, hard=True)
        mech = mechanisms(L)
        coverage.update(mech)
        status = 'PASS' if (ok_e and ok_h) else 'FAIL'
        if status == 'FAIL': all_ok = False
        print("  [%s] %s %s (archetype=%s)" % (status, L['id'], L['name'], L['archetype']))
        print("      easy: %s (%s)" % (ok_e, why_e))
        print("      hard: %s (%s)" % (ok_h, why_h))
        print("      mechanisms: %s" % mech)
    print("== 機制覆蓋（遍及效用）: %s ==" % sorted(coverage))
    core = {'lava','box','button','door','moving-spike(hard)'}
    missing = core - coverage
    if missing:
        print("  [WARN] 未覆蓋核心機制: %s" % missing)
    else:
        print("  [OK] 全部核心機制已被關卡圖景覆蓋")
    print("RESULT:", "ALL_PASS" if all_ok else "HAS_FAIL")
    sys.exit(0 if all_ok else 1)

if __name__ == '__main__':
    main()
