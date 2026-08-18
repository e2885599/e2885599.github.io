# splat 訓練 hook（階段二入口）：將多視角 PNG 轉 COLMAP 工作區
# 實際訓練需 gsplat/nerfstudio（外部依賴，本機若未裝則只產工作區不訓練）
# 用法：python tools/splat_train.py --imgdir assets/splat_train --out assets/splat_model
import sys, os, json, argparse

def build_colmap_workspace(imgdir, out):
    os.makedirs(out, exist_ok=True)
    imgs = sorted(f for f in os.listdir(imgdir) if f.lower().endswith(('.png', '.jpg')))
    if not imgs:
        raise FileNotFoundError('無多視角影像：' + imgdir)
    # 產 images.txt 佔位（真實 pose 須 COLMAP/SfM 估計，此處僅標記工作區結構）
    manifest = {
        'n_views': len(imgs),
        'imgdir': os.path.abspath(imgdir),
        'images': imgs,
        'note': 'splat 訓練須 COLMAP 估 pose 後由 gsplat/nerfstudio 執行；本 hook 僅建工作區'
    }
    with open(os.path.join(out, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    return manifest

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--imgdir', default='assets/splat_train')
    ap.add_argument('--out', default='assets/splat_model')
    a = ap.parse_args()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    imgdir = a.imgdir if os.path.isabs(a.imgdir) else os.path.join(root, a.imgdir)
    out = a.out if os.path.isabs(a.out) else os.path.join(root, a.out)
    m = build_colmap_workspace(imgdir, out)
    print('SPLAT_WORKSPACE', m['n_views'], 'views ->', out)
