import urllib.request, os, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0"

os.makedirs('assets/shorts', exist_ok=True)

# 每主題指定唯一 vid + 對應分類語意（確保不相重且主題相關）
PICKS = {
  'ai-basics':       ('46635', 'technology 科技/數據流動'),
  'cost-feasibility':('308',   'business 商業/金錢價值'),
  'safety-audit':     ('99786', 'technology 次支(避免重複) 對帳/掃描語意'),
  'game-sop':         ('4192',  'animation 遊戲/粒子動態'),
  'interactive':      ('50748', 'technology 三支 互動/科技藍'),
  'generic':          ('44818', 'abstract 極光/抽象品牌'),
}

for theme,(vid,desc) in PICKS.items():
    url = f'https://assets.mixkit.co/videos/{vid}/{vid}-1080.mp4'
    out = f'assets/shorts/{theme}.mp4'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer':'https://mixkit.co/'})
        data = urllib.request.urlopen(req, timeout=90, context=ctx).read()
        ok = (b'ftyp' in data[:32]) or data[:4]==b'\x00\x00\x00\x18' or data[:3]==b'\x1a\x45\xdf'
        open(out,'wb').write(data)
        print(f"{theme}: {len(data)} bytes  vid={vid}  [{desc}]  video_magic={'OK' if ok else 'UNVERIFIED'}")
    except Exception as e:
        print(f"{theme}: 失敗 {e}")

# 重複檢查：6 檔 sha256 是否互異
import hashlib
print("\n=== 去重檢查 (sha256 前8) ===")
sigs={}
for theme in PICKS:
    p=f'assets/shorts/{theme}.mp4'
    if os.path.isfile(p):
        h=hashlib.sha256(open(p,'rb').read()).hexdigest()[:8]
        sigs[theme]=h
        print(f"  {theme}: {h}")
dups=[k for k,v in sigs.items() if list(sigs.values()).count(v)>1]
print("重複主題:", dups if dups else "無（6 支互異）")
