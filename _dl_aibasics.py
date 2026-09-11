import urllib.request, os, ssl, hashlib

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0"

# ai-basics 改用 41638 (technology 頁第五支, 未與其他主題重複, 科技語意)
vid = '41638'
url = f'https://assets.mixkit.co/videos/{vid}/{vid}-1080.mp4'
out = 'assets/shorts/ai-basics.mp4'
try:
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer':'https://mixkit.co/'})
    data = urllib.request.urlopen(req, timeout=90, context=ctx).read()
    ok = (b'ftyp' in data[:32]) or data[:4]==b'\x00\x00\x00\x18' or data[:3]==b'\x1a\x45\xdf'
    open(out,'wb').write(data)
    print(f"ai-basics: {len(data)} bytes vid={vid} video_magic={'OK' if ok else 'UNVERIFIED'}")
except Exception as e:
    print(f"ai-basics: 失敗 {e}")

# 全 6 支去重複檢
print("\n=== 最終去重 (sha256 前8) ===")
sigs={}
for theme in ['ai-basics','cost-feasibility','safety-audit','game-sop','interactive','generic']:
    p=f'assets/shorts/{theme}.mp4'
    if os.path.isfile(p):
        h=hashlib.sha256(open(p,'rb').read()).hexdigest()[:8]
        sigs[theme]=h; print(f"  {theme}: {h}  {os.path.getsize(p)} bytes")
dups=[k for k,v in sigs.items() if list(sigs.values()).count(v)>1]
print("重複:", dups if dups else "無（6 支互異）")
