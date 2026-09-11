import urllib.request, re, os, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0"

CATS = {
  'ai-basics': 'https://mixkit.co/free-stock-video/technology/',
  'cost-feasibility': 'https://mixkit.co/free-stock-video/business/',
  'safety-audit': 'https://mixkit.co/free-stock-video/technology/',
  'game-sop': 'https://mixkit.co/free-stock-video/animation/',
  'interactive': 'https://mixkit.co/free-stock-video/technology/',
  'generic': 'https://mixkit.co/free-stock-video/abstract/',
}

os.makedirs('_mixkit_raw', exist_ok=True)
for theme, url in CATS.items():
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        html = urllib.request.urlopen(req, timeout=25, context=ctx).read().decode('utf-8', 'ignore')
        mp4s = re.findall(r'https://assets\.mixkit\.co/videos/(\d+)/\d+-(\d+)\.mp4', html)
        # 取 1080 或 720 版本（第一個出現的每支）
        seen = {}
        for vid, res in mp4s:
            if vid not in seen and res in ('1080','720'):
                seen[vid] = res
        picks = list(seen.items())[:6]
        with open(f'_mixkit_raw/{theme}.txt','w',encoding='utf-8') as f:
            for vid, res in picks:
                f.write(f"{vid}\t{res}\thttps://assets.mixkit.co/videos/{vid}/{vid}-{res}.mp4\n")
        print(f"{theme}: 抓到 {len(picks)} 候選 from {url}")
    except Exception as e:
        print(f"{theme}: 失敗 {e}")
