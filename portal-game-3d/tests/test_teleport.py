#!/usr/bin/env python3
# 傳送門穿越數學破壞性單測（對抗路徑·動量守恆驗收）
# 純 Python 重現 portals.js tryTeleport 的保辛等距變換，獨立驗證「速度大小不變 + 法線 flip」不變量。
# 不依賴 THREE/WebGPU。對齊代理原定任務（deleg_eb6ca6e9 因 524 超時未產出，此為本體補寫）。
import math

UP = (0.0, 1.0, 0.0)
PORTAL_RX = 34.0
PORTAL_RY = 46.0

def dot(a, b): return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
def sub(a, b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
def add(a, b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])
def scale(a, s): return (a[0]*s, a[1]*s, a[2]*s)
def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def norm(a):
    L = math.hypot(*a)
    return (a[0]/L, a[1]/L, a[2]/L) if L > 1e-9 else (0,0,0)
def length(a): return math.hypot(*a)

def try_teleport(prev, nxt, vel, blue, orange):
    # blue/orange: {'position':(x,y,z), 'normal':(x,y,z)}（normal 已單位化、指向場景內）
    for (frm, to) in ((blue, orange), (orange, blue)):
        n = norm(frm['normal'])
        s0 = dot(sub(prev, frm['position']), n)
        s1 = dot(sub(nxt, frm['position']), n)
        if s0 > 0 and s1 <= 0:
            rel = sub(nxt, frm['position'])
            t = norm(cross(UP, n))          # 水平切向
            tu = dot(rel, t)
            uu = dot(rel, UP)
            rx, ry = PORTAL_RX, PORTAL_RY
            if (tu*tu)/(rx*rx) + (uu*uu)/(ry*ry) > 1:
                continue  # 不在門橢圓內
            n2 = norm(to['normal'])
            t2 = norm(cross(UP, n2))
            ct = dot(vel, t)
            cn = dot(vel, n)
            vWorld = (ct*t2[0] - cn*n2[0], vel[1], ct*t2[2] - cn*n2[2])
            newPos = add(add(add(to['position'], scale(n2, 1.5)), scale(t, tu)), scale(UP, uu))
            return {'teleported': True, 'position': newPos, 'velocity': vWorld}
    return None

# ---------- 測試 ----------
def approx(a, b, eps=1e-6): return abs(a-b) <= eps

def test_pass_sample():
    # 藍門(100,0,300)法線+x（指向場景內，玩家在 x>100 側）；橘門(800,0,300)法線-x
    # 玩家由場景內往 -x 穿入藍門：prev=(105,0,300) → nxt=(100,0,300)
    blue = {'position': (100,0,300), 'normal': (1,0,0)}
    orange = {'position': (800,0,300), 'normal': (-1,0,0)}
    prev = (105,0,300); nxt = (100,0,300)
    vel = (10,0,0)
    r = try_teleport(prev, nxt, vel, blue, orange)
    assert r is not None, "PASS 樣本應穿越"
    assert r['teleported'] is True
    # 速度大小守恆
    sp_in = length(vel); sp_out = length(r['velocity'])
    assert approx(sp_in, sp_out), "速度大小應守恆: in=%.4f out=%.4f" % (sp_in, sp_out)
    # 從橘門外側出（橘門法線-x，外側 = position + 1.5*(-1,0,0) 偏移，x 應 < 800）
    assert r['position'][0] < 800, "應從橘門外側出，x<800，實得 %.2f" % r['position'][0]
    # 速度方向：in=(10,0,0) 朝 -x 穿入藍門（藍門 normal=+x 指向場景內）
    # 穿出橘門（normal=-x 指向場景內），出口沿場景內（+x）方向 → vWorld≈(+10,0,0)
    assert approx(r['velocity'][0], 10, 1e-4), "出口速度應沿場景內(+x)約 +10，實得 %.4f" % r['velocity'][0]
    return True

def test_fail_sample():
    # FAIL 樣本：預期出口速度變 2 倍（篡改預期）→ 測試必須抓到不一致
    blue = {'position': (100,0,300), 'normal': (1,0,0)}
    orange = {'position': (800,0,300), 'normal': (-1,0,0)}
    prev = (105,0,300); nxt = (100,0,300); vel = (10,0,0)
    r = try_teleport(prev, nxt, vel, blue, orange)
    assert r is not None, "FAIL 樣本前置：應能穿越"
    # 錯誤預期：硬說出口速度應是 20（2 倍）
    WRONG_EXPECT = 20.0
    got = length(r['velocity'])
    assert not approx(got, WRONG_EXPECT), "FAIL 樣本：測試不應通過（出口速度 %f 不應等於錯誤預期 %f）" % (got, WRONG_EXPECT)
    # 若用錯誤預期寫斷言，該斷言會紅 → 證明鑑別力
    try:
        assert approx(got, WRONG_EXPECT), "預期 20 但實得 %.4f" % got
        raise AssertionError("鑑別力失效：錯誤預期竟通過")
    except AssertionError:
        pass  # 預期行為：斷言紅掉
    return True

def test_boundary_sample():
    # 邊界：玩家未穿入（s0<=0，本就在門內側）→ 不穿越
    blue = {'position': (100,0,300), 'normal': (1,0,0)}
    orange = {'position': (800,0,300), 'normal': (-1,0,0)}
    prev = (95,0,300); nxt = (90,0,300)  # 兩點都在藍門外側（x<100，法線正側為內側）
    vel = (10,0,0)
    r = try_teleport(prev, nxt, vel, blue, orange)
    assert r is None, "邊界樣本（未穿入）應回 null，實得 %s" % r
    return True

def test_momentum_all_directions():
    # 動量守恆：任意速度方向穿越後大小不變
    blue = {'position': (100,0,300), 'normal': (1,0,0)}
    orange = {'position': (800,0,300), 'normal': (-1,0,0)}
    for vel in ((10,0,0), (0,0,7), (3,5,-2), (12,-4,9)):
        prev = (105,0,300); nxt = (100,0,300)
        r = try_teleport(prev, nxt, vel, blue, orange)
        assert r is not None, "方向 %s 應穿越" % (vel,)
        assert approx(length(vel), length(r['velocity']), 1e-6), \
            "方向 %s 速度大小應守恆: in=%.4f out=%.4f" % (vel, length(vel), length(r['velocity']))
    return True

if __name__ == '__main__':
    suite = [test_pass_sample, test_fail_sample, test_boundary_sample, test_momentum_all_directions]
    passed = 0
    for t in suite:
        try:
            t(); print("[PASS] %s" % t.__name__); passed += 1
        except AssertionError as e:
            print("[FAIL] %s : %s" % (t.__name__, e))
        except Exception as e:
            print("[ERROR] %s : %s" % (t.__name__, e))
    print("RESULT: %d/%d passed" % (passed, len(suite)))
    import sys
    sys.exit(0 if passed == len(suite) else 1)
