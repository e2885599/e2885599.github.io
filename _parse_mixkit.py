import urllib.request, re, os
# 抓 Mixkit 多分類頁，解析真實 mp4 CDN 直鏈（assets.mixkit.co/videos/<id>/<id>-720.mp4）
cats = ['technology','abstract','city','nature','science','business','computer','digital']
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
seen = {}
for cat in cats:
    url = f'https://mixkit.co/free-stock-video/{cat}/'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        html = urllib.request.urlopen(req, timeout=25).read().decode('utf-8', 'ignore')
    except Exception as e:
        print(f'# {cat} 失敗: {e}')
        continue
    # 解析 assets.mixkit.co 直鏈
    links = re.findall(r'https://assets\.mixkit\.co/videos/(\d+)/\d+-720\.mp4', html)
    for vid in links:
        if vid not in seen:
            seen[vid] = f'https://assets.mixkit.co/videos/{vid}/{vid}-720.mp4'
    print(f'# {cat}: 解析到 {len(links)} 支, 累計去重 {len(seen)}')

print('\n=== 可用直鏈 (前 12) ===')
for vid, u in list(seen.items())[:12]:
    print(vid, u)
# 存檔
with open('_mixkit_links.txt','w',encoding='utf-8') as f:
    for vid,u in seen.items():
        f.write(f'{vid}\t{u}\n')
print(f'\n總計 {len(seen)} 支直鏈已存 _mixkit_links.txt')
