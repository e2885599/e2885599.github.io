import urllib.request, os, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0"

os.makedirs('assets/shorts', exist_ok=True)

# 讀各主題候選，取第一支下載並核實
for theme in ['ai-basics','cost-feasibility','safety-audit','game-sop','interactive','generic']:
    txt = f'_mixkit_raw/{theme}.txt'
    if not os.path.isfile(txt):
        print(f"{theme}: 無候選"); continue
    first = open(txt,encoding='utf-8').readline().strip().split('\t')[-1]
    out = f'assets/shorts/{theme}.mp4'
    try:
        req = urllib.request.Request(first, headers={'User-Agent': UA, 'Referer':'https://mixkit.co/'})
        data = urllib.request.urlopen(req, timeout=60, context=ctx).read()
        # 核實是 video
        if data[:4] == b'\x00\x00\x00\x18' or data[:4] == b'\x00\x00\x00\x20' or b'ftyp' in data[:32] or data[:3]==b'\x1a\x45\xdf':  # mp4/ftyp/webm/matroska 特徵
            open(out,'wb').write(data)
            print(f"{theme}: 下載 OK {len(data)} bytes -> {out} (video magic ok)")
        else:
            open(out,'wb').write(data)
            print(f"{theme}: 下載 {len(data)} bytes (magic 未確認, 先存)")
    except Exception as e:
        print(f"{theme}: 下載失敗 {e}")
