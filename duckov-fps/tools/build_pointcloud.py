# 多視角 PNG → 點雲（splat 風格場景層的確定性近似）
# 不依賴 CUDA/3DGS 優化：以已知 Blender 相機位姿將像素反投影到 3D 近似點
# 用法：python tools/build_pointcloud.py
import os, json, math
import numpy as np
from PIL import Image

IMG_DIR = "D:/OODAV-MIRROR/02-STUDIO/duckov-fps/assets/splat_train"
OUT = "D:/OODAV-MIRROR/02-STUDIO/duckov-fps/assets/splat_points.json"
N_VIEWS = 36
RADIUS = 12.0
HEIGHT = 4.0
TARGET = np.array([0.0, 0.0, 2.0])
W, H = 1024, 768
 # Blender 預設相機 fov 由 sensor_fit; 以 vertical fov ~ 49.1°(35mm equiv) 近似
VFov = math.radians(49.1)
fx = fy = (H / 2) / math.tan(VFov / 2)
cx, cy = W / 2, H / 2

def cam_pose(i):
    ang = i / N_VIEWS * 2 * math.pi
    pos = np.array([math.cos(ang) * RADIUS, math.sin(ang) * RADIUS, HEIGHT])
    # -Z 指向 target（與 blender to_track_quat('-Z','Y') 一致）
    fwd = TARGET - pos; fwd /= np.linalg.norm(fwd)
    up0 = np.array([0.0, 0.0, 1.0])
    right = np.cross(fwd, up0); right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    R = np.stack([right, up, -fwd], axis=1)  # 相機→世界
    return pos, R

def backproject(i, u, v, depth):
    pos, R = cam_pose(i)
    # 相機空間方向（x右,y上,z前=-Z朝target）
    d_cam = np.array([(u - cx) / fx, -(v - cy) / fy, -1.0])
    d_cam /= np.linalg.norm(d_cam)
    d_world = R @ d_cam
    return pos + d_world * depth

def main(max_per_view=4000, max_depth=40.0, min_depth=2.0):
    pts = []
    for i in range(N_VIEWS):
        fp = os.path.join(IMG_DIR, f"barn_{i:03d}.png")
        if not os.path.exists(fp): continue
        img = Image.open(fp).convert("RGB").resize((256, 192))  # 降采样加速
        arr = np.asarray(img).reshape(-1, 3).astype(np.float32) / 255.0
        h, w = 192, 256
        # 均勻採樣像素
        idx = np.linspace(0, w * h - 1, max_per_view).astype(int)
        for k in idx:
            y, x = divmod(k, w)
            # 深度：以場景中心距離 + 徑向擾動近似（無真 SfM，用距離原點的投影深度）
            pos, R = cam_pose(i)
            # 簡化：深度 = 相機到原點投影深度附近隨機帶動，使點落在倉庫體積內
            depth = max(min_depth, min(max_depth, np.linalg.norm(pos - TARGET) + (np.random.rand() - 0.5) * 6))
            p = backproject(i, x * (W / w), y * (H / h), depth)
            col = arr[k].tolist()
            pts.append([round(float(p[0]),3), round(float(p[1]),3), round(float(p[2]),3),
                        round(col[0],3), round(col[1],3), round(col[2],3)])
    out = {"n": len(pts), "points": pts, "note": "確定性點雲近似（非真3DGS優化）；真訓練需CUDA+gsplat"}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    size = os.path.getsize(OUT)
    print("POINTCLOUD", len(pts), "points", size, "bytes")

if __name__ == "__main__":
    main()
